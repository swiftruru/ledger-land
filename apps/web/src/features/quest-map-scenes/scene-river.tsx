// 第 5 章「現金流量表」：草地上的河（圖規 6.4 的 C05）。底色是草地（地圖組的 .qm-terrain），這一層畫河（地形塊）、橋與物件：
// - 一條河（sea）從一側流到另一側的區帶邊緣，中間繞過節點、星星籤、章節牌、紙籤與拱門（在 10px 的格子上找最短路，過路線的格子很貴，
//   所以只過一次路；路面兩側 hw + 26 以內都很貴，河不會沿著路走），離接縫至少 50px，不會伸出地形。道路過河的地方鋪一段木橋（沿路線的切線，長度是河寬加 24），
//   路面兩側各寬出 9px，橋面上兩條欄杆、四角各一根短柱
//   （畫在路線底下、路面外側，算地形不算物件）。
// - medium 以上：入口那一翼的主角道具是三條支流匯成主流（240 × 160；翼窄時 180 × 128、112 × 104），主流接著那條河往軌道流；
//   支流往外接到區帶邊緣。河的水是地形（一個 path：先描浪花色再填水色，支流與主流疊在一起只剩外圈的岸線），主角道具本身畫支流上的小橋與蘆葦。
//   兩翼另有蘆葦、石頭、樹叢，遠側那一翼的河上有一座小木橋。
// - 手機與沒有兩翼的 medium：主角道具是水閘（64 × 48，放不下時 56 × 42、48 × 36），先放在節點的空側，河再從左緣流進水閘、從水閘流到右緣；軌道裡另外最多兩個小東西（蘆葦、石頭）。
// 夜景：水面的亮點（淺色主題是浪花色的短浪，深色主題換成 scene-glow）。
import type { Bp, Point, Rect, SceneGeo } from '../quest-map/layout.ts';
import { inflate, SEAM } from '../quest-map/layout.ts';
import type { SceneProps } from '../quest-map/scenes.tsx';
import {
  byDepth,
  FOAM,
  GLOW,
  Grass,
  LEAF,
  LINE,
  MEADOW,
  nearSide,
  placeProps,
  polyPath,
  Prop,
  rectPoly,
  ROCK_DEEP,
  SceneDefs,
  SEA,
  TerrainRect,
  useSceneIds,
  wingSpan,
  WOOD,
  type Anchor,
  type Placed,
  type PropSpec,
  type Side,
  type TerrainBlock,
} from './scene-kit.tsx';
import { SeamEdgeArt, seamEdge } from './scene-seam.tsx';

export const geoAware = true;

const WIDE: readonly Bp[] = ['medium', 'expanded'];
const r1 = (n: number) => Math.round(n * 10) / 10;

/** 主角道具：有兩翼時是三條支流匯成主流（入口那一翼），沒有時是水閘（河決定之後放在河上） */
const HERO: PropSpec = {
  id: 'confluence',
  tier: 'hero',
  ground: ['meadow'],
  variants: [
    {
      w: 240,
      h: 160,
      bps: WIDE,
      form: 'confluence',
      anchors: [
        { wing: 'near', u: 0.4, v: 0.52 },
        { wing: 'near', u: 0.2, v: 0.46 },
        { wing: 'near', u: 0.6, v: 0.6 },
      ],
    },
    { w: 180, h: 128, bps: WIDE, form: 'confluence', anchors: [{ wing: 'near', u: 0, v: 0.52 }] },
    { w: 112, h: 104, bps: WIDE, form: 'confluence', anchors: [{ wing: 'near', u: 0, v: 0.52 }] },
  ],
};

// ---------------------------------------------------------------------------------------------
// 河道：10px 的格子上找最短路（Dijkstra）

const CELL = 10;
/** 過路線的格子的額外代價：河只過一次路 */
const ROAD_COST = 80;

interface Grid {
  readonly nx: number;
  readonly ny: number;
  readonly block: Uint8Array;
  readonly extra: Float32Array;
}

function makeGrid(geo: SceneGeo, pad: number, avoid: readonly Rect[], roadClear: number): Grid {
  const nx = Math.ceil(geo.bandW / CELL) + 1;
  const ny = Math.ceil(geo.h / CELL) + 1;
  const block = new Uint8Array(nx * ny);
  const extra = new Float32Array(nx * ny);
  const fill = (x0: number, y0: number, x1: number, y1: number, f: (k: number) => void) => {
    for (let j = Math.max(0, Math.ceil(y0 / CELL)); j <= Math.min(ny - 1, Math.floor(y1 / CELL)); j++)
      for (let i = Math.max(0, Math.ceil(x0 / CELL)); i <= Math.min(nx - 1, Math.floor(x1 / CELL)); i++) f(j * nx + i);
  };
  // 離接縫 50px 以內、離區段底部 12px 以內都不走
  fill(-CELL, -CELL, geo.bandW + CELL, SEAM + 26 + pad, (k) => (block[k] = 1));
  fill(-CELL, geo.h - 12 - pad, geo.bandW + CELL, geo.h + CELL, (k) => (block[k] = 1));
  for (const r of avoid) fill(r.x0 - pad, r.y0 - pad, r.x1 + pad, r.y1 + pad, (k) => (block[k] = 1));
  // 路面兩側 roadClear 以內的格子都很貴（第 2 輪看圖驗收：河沿著路走、路壓在河面上約 200px）：河岸離路緣至少 16px，只在交叉點過一次路
  for (const r of geo.protect)
    if (r.kind === 'road') {
      const cx = (r.x0 + r.x1) / 2;
      const cy = (r.y0 + r.y1) / 2;
      fill(cx - roadClear, cy - roadClear, cx + roadClear, cy + roadClear, (k) => {
        const i = k % nx;
        const j = (k - i) / nx;
        if (Math.hypot(i * CELL - cx, j * CELL - cy) <= roadClear) extra[k] = ROAD_COST;
      });
    }
  return { nx, ny, block, extra };
}

const DIRS: readonly (readonly [number, number, number])[] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/** 從 starts 出發走到第一個 goal 的格子；yPref 讓河盡量維持在某個高度（每偏 100px 多 6% 代價） */
function shortest(g: Grid, starts: readonly number[], goal: (k: number) => boolean, yPref: number): Point[] | null {
  const N = g.nx * g.ny;
  const dist = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const hd: number[] = [];
  const hk: number[] = [];
  const push = (d: number, k: number) => {
    let i = hd.length;
    hd.push(d);
    hk.push(k);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hd[p]! <= d) break;
      hd[i] = hd[p]!;
      hk[i] = hk[p]!;
      i = p;
    }
    hd[i] = d;
    hk[i] = k;
  };
  const pop = (): [number, number] => {
    const d = hd[0]!;
    const k = hk[0]!;
    const ld = hd.pop()!;
    const lk = hk.pop()!;
    if (hd.length) {
      let i = 0;
      for (;;) {
        const a = 2 * i + 1;
        if (a >= hd.length) break;
        const b = a + 1 < hd.length && hd[a + 1]! < hd[a]! ? a + 1 : a;
        if (hd[b]! >= ld) break;
        hd[i] = hd[b]!;
        hk[i] = hk[b]!;
        i = b;
      }
      hd[i] = ld;
      hk[i] = lk;
    }
    return [d, k];
  };
  for (const s of starts) {
    dist[s] = 0;
    push(0, s);
  }
  while (hd.length) {
    const [d, k] = pop();
    if (d > dist[k]!) continue;
    if (goal(k)) {
      const out: Point[] = [];
      for (let c = k; c >= 0; c = prev[c]!) out.push({ x: (c % g.nx) * CELL, y: Math.floor(c / g.nx) * CELL });
      return out.reverse();
    }
    const i = k % g.nx;
    const j = (k - i) / g.nx;
    for (const [di, dj, len] of DIRS) {
      const ii = i + di;
      const jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= g.nx || jj >= g.ny) continue;
      const nk = jj * g.nx + ii;
      if (g.block[nk]) continue;
      const nd = d + len * (1 + g.extra[nk]! + Math.abs(jj * CELL - yPref) * 0.0006);
      if (nd < dist[nk]!) {
        dist[nk] = nd;
        prev[nk] = k;
        push(nd, nk);
      }
    }
  }
  return null;
}

/** 格子路徑 → 每 3 格取一點 → Chaikin 平滑兩次（曲線留在折線的凸包裡，不會切進障礙物） */
function smooth(path: readonly Point[]): Point[] {
  let pts = path.filter((_, i) => i % 3 === 0 || i === path.length - 1);
  for (let n = 0; n < 2; n++) {
    const out: Point[] = [pts[0]!];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    out.push(pts[pts.length - 1]!);
    pts = out;
  }
  return pts;
}

/** 中心線 → 兩岸（左右各一條）與水域多邊形；hw(t) 是 t（0 到 1）處的半寬 */
function ribbon(c: readonly Point[], hw: (t: number) => number): { poly: Point[]; left: Point[]; right: Point[] } {
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i < c.length; i++) {
    const a = c[Math.max(0, i - 1)]!;
    const b = c[Math.min(c.length - 1, i + 1)]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const w = hw(i / Math.max(1, c.length - 1));
    const p = c[i]!;
    left.push({ x: p.x + nx * w, y: p.y + ny * w });
    right.push({ x: p.x - nx * w, y: p.y - ny * w });
  }
  return { poly: [...left, ...[...right].reverse()], left, right };
}

/** 二次貝茲曲線取樣 */
function quad(a: Point, c: Point, b: Point, n = 12): Point[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return { x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y };
  });
}

function distToLine(p: Point, line: readonly Point[]): number {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// 構圖

export interface Bridge {
  /** 橋面（木頭，畫在路線底下） */
  readonly deck: string;
  /** 兩側欄杆與端柱 */
  readonly rails: string;
}

export interface RiverPlan {
  readonly blocks: readonly TerrainBlock[];
  /** 河（含支流）：一個 path，好幾段 */
  readonly water: string;
  readonly bridges: readonly Bridge[];
  readonly props: readonly Placed[];
  /** 河的中心線（測試用） */
  readonly centre: readonly Point[];
}

/** 翼或軌道裡、底線中點在 (cx, y1) 的 w 寬物件的候選位置 */
function anchorAt(geo: SceneGeo, cx: number, y1: number, w: number): Anchor | null {
  const v = y1 / geo.h;
  if (cx >= geo.track.left && cx <= geo.track.right) return { track: true, u: (cx - geo.track.left) / (geo.track.right - geo.track.left), v };
  const side: Side = cx < geo.track.left ? 'left' : 'right';
  const span = wingSpan(side, geo);
  if (!span) return null;
  const depth = Math.abs(span.inner - span.outer);
  const off = side === 'left' ? span.inner - (cx + w / 2) : cx - w / 2 - span.inner;
  if (off < -w / 2 || off > depth) return null;
  return { wing: side, u: Math.min(1, Math.max(0, off / Math.max(1, depth - w))), v };
}

/** 主角道具框（往左是外側；右翼時鏡射）裡的支流：三條入口、匯流點、出口（主流接著河道） */
function confluenceGeom(p: Placed) {
  const w = p.x1 - p.x0;
  const h = p.y1 - p.y0;
  const X = (x: number) => (p.flip ? p.x1 - x : p.x0 + x);
  const pt = (x: number, y: number): Point => ({ x: X(x), y: p.y0 + y });
  const join = pt(w * 0.66, h * 0.6);
  const out = pt(w, h * 0.6);
  const inlets = [pt(0, h * 0.14), pt(0, h * 0.52), pt(0, h * 0.9)];
  const ctrl = [pt(w * 0.42, h * 0.12), pt(w * 0.34, h * 0.56), pt(w * 0.4, h * 0.92)];
  return { w, h, join, out, inlets, ctrl, s: Math.min(1, w / 240) };
}

/** 構圖（純函式，測試也用） */
/** 放置時用的保護框比 geo.protect 嚴一點，和 G9 的量法一致：紙籤與章節牌整個寬度往下多 16px（木樁、立柱那一帶），路面多 2px */
function strict(geo: SceneGeo): SceneGeo {
  return {
    ...geo,
    protect: geo.protect.map((r) =>
      r.kind === 'road'
        ? { ...r, x0: r.x0 - 2, y0: r.y0 - 2, x1: r.x1 + 2, y1: r.y1 + 2 }
        : r.kind === 'plaque' || r.kind === 'banner'
          ? { ...r, y1: r.y1 + 16 }
          : r,
    ),
  };
}

export function planRiver(input: SceneGeo): RiverPlan {
  const geo = strict(input);
  const meadow: TerrainBlock = { id: 'meadow', poly: rectPoly({ x0: 0, y0: SEAM, x1: geo.bandW, y1: geo.h }) };
  const [hero] = placeProps([HERO], geo, { blocks: [meadow] });
  const wide = !!hero;
  const hw0 = wide ? 13 : 10;
  const hw1 = wide ? 19 : 13;
  const pad = wide ? hw1 + 6 : hw1 + 3;
  const hard = geo.protect.filter((r) => r.kind !== 'road');
  const soft = hard.filter((r) => r.kind !== 'bell');
  // 節點外圈與星星籤再多留 16px：格子路徑取樣後平滑會切一點彎，河岸還是離它們的保護框 12px 以上（星星籤不會像浮在水上）
  const roomy = (list: SceneGeo['protect']) => list.map((r) => (r.kind === 'node' || r.kind === 'stars' ? inflate(r, 16) : r));
  // 河道：四種避讓（先避開鈴框並多留空間，再依序放寬）各找一條，取「貼著路面的格子」最少的那一條（同樣多時取前面的）：
  // 避開鈴框時常常只剩沿著路走的縫，放寬一點反而能離路遠（第 2 輪看圖驗收）
  // 河只往一個方向流：behind 那一側（x 小於 lo 或大於 hi）的格子不走，不會繞回頭
  const routeFrom = (
    starts: (g: Grid) => number[],
    goal: (g: Grid) => (k: number) => boolean,
    yPref: number,
    extraAvoid: readonly Rect[],
    lo = -Infinity,
    hi = Infinity,
  ) => {
    let best: { path: Point[]; near: number } | null = null;
    for (const avoid of [roomy(hard), roomy(soft), hard, soft]) {
      const fence = [
        ...(lo > -Infinity ? [{ x0: -CELL * 2 - pad, y0: -CELL - pad, x1: lo - pad, y1: geo.h + CELL + pad }] : []),
        ...(hi < Infinity ? [{ x0: hi + pad, y0: -CELL - pad, x1: geo.bandW + CELL * 2 + pad, y1: geo.h + CELL + pad }] : []),
      ];
      const g = makeGrid(geo, pad, [...avoid, ...extraAvoid, ...fence], 10 + hw1 + 16);
      const ss = starts(g).filter((k) => !g.block[k]);
      if (!ss.length) continue;
      const path = shortest(g, ss, goal(g), yPref);
      if (!path) continue;
      const near = path.filter((p) => g.extra[Math.round(p.y / CELL) * g.nx + Math.round(p.x / CELL)]! > 0).length;
      if (!best || near < best.near) best = { path, near };
    }
    return best?.path ?? null;
  };
  let centre: Point[] = [];
  let sluice: Placed | null = null;
  const streams: Point[][] = [];
  const blocks: TerrainBlock[] = [meadow];
  const water: string[] = [];
  if (hero) {
    const c = confluenceGeom(hero);
    const toFar = hero.region === 'left' ? 1 : -1;
    const startX = c.out.x + toFar * (hw1 + 12);
    const path = routeFrom(
      (g) => {
        const j = Math.round(c.out.y / CELL);
        const i = Math.round(startX / CELL);
        return [j * g.nx + i, (j - 1) * g.nx + i, (j + 1) * g.nx + i];
      },
      (g) => (k) => (toFar > 0 ? k % g.nx === g.nx - 1 : k % g.nx === 0),
      c.out.y,
      [{ x0: hero.x0 + 10, y0: hero.y0 + 10, x1: hero.x1 - 10, y1: hero.y1 - 10 }],
      toFar > 0 ? startX - CELL : -Infinity,
      toFar > 0 ? Infinity : startX + CELL,
    );
    if (path) {
      const raw = [
        { x: c.out.x - toFar * 8, y: c.out.y },
        ...smooth([{ x: startX, y: c.out.y }, ...path.slice(1)]),
        { x: toFar > 0 ? geo.bandW + 30 : -30, y: path[path.length - 1]!.y },
      ];
      // 遠側翼裡（離軌道 60px 以外）最短路幾乎是直線：加上平緩的彎（振幅 16、波長 280），彎了會碰到障礙物或太靠近接縫就不彎
      const from = toFar > 0 ? geo.track.right + 60 : geo.track.left - 60;
      const bent = raw.map((p) => {
        const d = (p.x - from) * toFar;
        return d <= 0 ? p : { x: p.x, y: p.y + Math.min(1, d / 120) * 16 * Math.sin((d / 280) * 2 * Math.PI) };
      });
      const clash = bent.some(
        (p, i) =>
          p !== raw[i] &&
          (p.y < SEAM + 26 + pad || p.y > geo.h - 12 - pad || hard.some((r) => p.x > r.x0 - pad && p.x < r.x1 + pad && p.y > r.y0 - pad && p.y < r.y1 + pad)),
      );
      centre = clash ? raw : bent;
    }
    // 支流：框裡三條匯到匯流點，再往外接到區帶邊緣（平緩的彎，兩端固定）
    const edge = hero.region === 'left' ? -20 : geo.bandW + 20;
    c.inlets.forEach((a, i) => {
      const inner = quad(a, c.ctrl[i]!, c.join);
      const y0 = a.y + (i - 1) * 18;
      const len = Math.abs(a.x - edge);
      const n = Math.max(6, Math.round(len / 20));
      const outer = Array.from({ length: n }, (_, k) => {
        const t = k / n;
        return { x: edge + (a.x - edge) * t, y: y0 + (a.y - y0) * t + 12 * Math.sin(Math.PI * t) * Math.sin((t * len) / 46 + i * 2) };
      });
      streams.push([...outer, ...inner]);
    });
    streams.push(quad(c.join, { x: (c.join.x + c.out.x) / 2, y: c.join.y }, centre[0] ?? c.out, 6));
  } else {
    // 手機（或沒有兩翼）：水閘放在節點的空側，河從左緣流進水閘、再從水閘流到右緣（只往右流，不繞回頭）；
    // 依序試每個候選位置與尺寸，第一個兩段河道都走得通的就用
    const cell = (g: Grid, p: Point) => Math.round(p.y / CELL) * g.nx + Math.round(p.x / CELL);
    const anchors: Anchor[] = [
      { node: 1 },
      { node: 2 },
      { node: 0 },
      { node: 3 },
      { node: 1, dv: 20 },
      { node: 2, dv: -20 },
      { node: 0, dv: -20 },
      { node: 3, dv: 20 },
    ];
    search: for (const [w, h] of [
      [64, 48],
      [56, 42],
      [48, 36],
    ] as const)
      for (const a of anchors) {
        const [p] = placeProps([{ id: 'sluice', tier: 'minor', ground: ['meadow'], variants: [{ w, h, form: 'sluice', anchors: [a] }] }], geo, {
          blocks: [meadow],
        });
        if (!p) continue;
        const y = p.y1 - 10;
        const box = { x0: p.x0 + 4, y0: p.y0, x1: p.x1 - 4, y1: p.y1 };
        const inlet = { x: p.x0 - pad - CELL, y };
        const outlet = { x: p.x1 + pad + CELL, y };
        const left = routeFrom(
          (g) => Array.from({ length: g.ny }, (_, j) => j * g.nx),
          (g) => (k) => k === cell(g, inlet),
          y,
          [box],
          -Infinity,
          inlet.x + CELL,
        );
        if (!left) continue;
        const right = routeFrom(
          (g) => [cell(g, outlet)],
          (g) => (k) => k % g.nx === g.nx - 1,
          y,
          [box],
          outlet.x - CELL,
        );
        if (!right) continue;
        sluice = { ...p, tier: 'hero' };
        centre = [{ x: -30, y: left[0]!.y }, ...smooth([...left, inlet, outlet, ...right]), { x: geo.bandW + 30, y: right[right.length - 1]!.y }];
        break search;
      }
  }
  if (centre.length > 1) {
    const main = ribbon(centre, (t) => hw0 + (hw1 - hw0) * t);
    blocks.push({ id: 'river', poly: main.poly });
    water.push(polyPath(main.poly));
  }
  streams.forEach((s, i) => {
    const last = i === streams.length - 1;
    const r = ribbon(s, (t) => (last ? 10 + (hw0 - 10) * t : 5 + 4 * t));
    blocks.push({ id: 'river', poly: r.poly });
    water.push(polyPath(r.poly));
  });

  // 道路過河的地方：橋沿著路線的中心線（路線的取樣點）鋪，所以橋的角度就是交叉點的路線切線、橋面中心對準路面中心；
  // 長度是河寬加 24px（離河道中心線 hw + 12 以內的那一段，兩端各伸出河岸 12px），左右各 19px 鋪橋面、15px 處是欄杆
  const roads = geo.protect.filter((r) => r.kind === 'road').map((r) => ({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 }));
  const bridges: Bridge[] = [];
  if (centre.length > 1) {
    const inRiver = roads.map((p) => distToLine(p, centre) < hw1 + 12);
    for (let i = 0; i < roads.length; i++) {
      if (!inRiver[i] || inRiver[i - 1]) continue;
      let j = i;
      while (inRiver[j + 1]) j++;
      const seg = roads.slice(i, j + 1);
      if (seg.length < 2) continue;
      const deck = ribbon(seg, () => 19);
      const rail = ribbon(seg, () => 15);
      const post = ribbon(seg, () => 23);
      const line = (pts: readonly Point[]) => `M${pts.map((p) => `${r1(p.x)} ${r1(p.y)}`).join('L')}`;
      // 欄杆在橋面上、路面外側（±15px），四個角各一根往外伸的短柱
      const posts = [0, seg.length - 1].flatMap((k) =>
        (['left', 'right'] as const).map((side) => `M${r1(rail[side][k]!.x)} ${r1(rail[side][k]!.y)}L${r1(post[side][k]!.x)} ${r1(post[side][k]!.y)}`),
      );
      bridges.push({ deck: polyPath(deck.poly), rails: `${line(rail.left)}${line(rail.right)}${posts.join('')}` });
      i = j;
    }
  }

  const taken: Placed[] = hero ? [hero] : sluice ? [sluice] : [];

  // 次要道具：沿河兩岸的蘆葦與石頭、兩翼的小樹、遠側翼河上的小木橋、水面的亮點
  const DRY = ['meadow', '!river'];
  const along = (fracs: readonly number[], off: number, w: number, h: number): Anchor[] => {
    if (centre.length < 3) return [];
    const out: Anchor[] = [];
    for (const f of fracs) {
      const i = Math.max(1, Math.min(centre.length - 2, Math.round(f * (centre.length - 1))));
      const a = centre[i - 1]!;
      const b = centre[i + 1]!;
      const p = centre[i]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      for (const sgn of [1, -1]) {
        const q = { x: p.x + (-(b.y - a.y) / len) * off * sgn, y: p.y + ((b.x - a.x) / len) * off * sgn };
        const an = anchorAt(geo, q.x, q.y + h / 2, w);
        if (an) out.push(an);
      }
    }
    return out;
  };
  const wingTrees = (wing: 'near' | 'far', list: readonly (readonly [number, number])[]): Anchor[] => list.map(([u, v]) => ({ wing, u, v }));
  const minor: PropSpec[] = [
    { id: 'reeds-1', tier: 'minor', ground: DRY, variants: [{ w: 28, h: 28, form: 'reeds', anchors: along([0.12, 0.2, 0.06], hw1 + 22, 28, 28) }] },
    { id: 'stones-1', tier: 'minor', ground: DRY, variants: [{ w: 36, h: 20, form: 'stones', anchors: along([0.3, 0.38, 0.24], hw1 + 18, 36, 20) }] },
    { id: 'reeds-2', tier: 'minor', ground: DRY, variants: [{ w: 28, h: 28, form: 'reeds', anchors: along([0.62, 0.7, 0.55], hw1 + 22, 28, 28) }] },
    { id: 'stones-2', tier: 'minor', ground: DRY, variants: [{ w: 36, h: 20, form: 'stones', anchors: along([0.86, 0.8, 0.92], hw1 + 18, 36, 20) }] },
    ...(wide
      ? [
          {
            id: 'trees-near-1',
            tier: 'minor' as const,
            ground: DRY,
            variants: [
              {
                w: 76,
                h: 60,
                form: 'trees',
                anchors: wingTrees('near', [
                  [0.6, 0.2],
                  [0.25, 0.16],
                  [0.9, 0.28],
                ]),
              },
            ],
          },
          {
            id: 'trees-near-2',
            tier: 'minor' as const,
            ground: DRY,
            variants: [
              {
                w: 76,
                h: 60,
                form: 'trees',
                anchors: wingTrees('near', [
                  [0.35, 0.88],
                  [0.75, 0.84],
                  [0.1, 0.82],
                ]),
              },
            ],
          },
          {
            id: 'trees-far-1',
            tier: 'minor' as const,
            ground: DRY,
            variants: [
              {
                w: 76,
                h: 60,
                form: 'trees',
                anchors: wingTrees('far', [
                  [0.45, 0.2],
                  [0.15, 0.24],
                  [0.8, 0.14],
                ]),
              },
            ],
          },
          {
            id: 'trees-far-2',
            tier: 'minor' as const,
            ground: DRY,
            variants: [
              {
                w: 76,
                h: 60,
                form: 'trees',
                anchors: wingTrees('far', [
                  [0.3, 0.86],
                  [0.7, 0.9],
                  [0.55, 0.76],
                ]),
              },
            ],
          },
          {
            id: 'tree-far-3',
            tier: 'minor' as const,
            ground: DRY,
            variants: [
              {
                w: 34,
                h: 46,
                form: 'tree',
                anchors: wingTrees('far', [
                  [0.85, 0.62],
                  [0.2, 0.62],
                  [0.6, 0.66],
                ]),
              },
            ],
          },
        ]
      : []),
  ];
  // 遠側翼河上的小木橋：河段大致水平、在翼裡的地方
  if (wide && centre.length > 3) {
    const far: Side = nearSide(geo) === 'left' ? 'right' : 'left';
    const span = wingSpan(far, geo);
    if (span) {
      const lo = Math.min(span.inner, span.outer) + 30;
      const hi = Math.max(span.inner, span.outer) - 30;
      const bh = 2 * hw1 + 28;
      const cands: Anchor[] = [];
      for (let i = 2; i < centre.length - 2; i++) {
        const p = centre[i]!;
        if (p.x < lo || p.x > hi) continue;
        const a = centre[i - 2]!;
        const b = centre[i + 2]!;
        if (Math.abs(b.y - a.y) > Math.abs(b.x - a.x) * 0.3) continue;
        const an = anchorAt(geo, p.x, p.y + bh / 2, 26);
        if (an) cands.push(an);
      }
      const pick = cands.filter((_, i) => i % 3 === 0).sort((a, b) => ('u' in a && 'u' in b ? Math.abs(a.u - 0.5) - Math.abs(b.u - 0.5) : 0));
      if (pick.length)
        minor.unshift({ id: 'footbridge', tier: 'minor', ground: ['meadow'], variants: [{ w: 26, h: bh, form: 'footbridge', anchors: pick.slice(0, 12) }] });
    }
  }
  // 水面的亮點（細節）
  const sparkle = (id: string, f: number): PropSpec => ({
    id,
    tier: 'detail',
    ground: ['river'],
    whole: true,
    variants: [
      {
        w: 18,
        h: 8,
        form: 'sparkle',
        anchors: along([f], 0, 18, 8)
          .slice(0, 1)
          .concat(along([f + 0.04, f - 0.04], 0, 18, 8)),
      },
    ],
  });
  minor.push(sparkle('sparkle-1', 0.18), sparkle('sparkle-2', 0.45), sparkle('sparkle-3', 0.72), sparkle('sparkle-4', 0.9));
  // 兩翼草地上的幾叢草（細節，不佔組的名額）
  if (wide)
    (
      [
        ['grass-1', 'near', 0.2, 0.7],
        ['grass-2', 'near', 0.75, 0.62],
        ['grass-3', 'near', 0.5, 0.3],
        ['grass-4', 'far', 0.3, 0.58],
        ['grass-5', 'far', 0.75, 0.3],
        ['grass-6', 'far', 0.55, 0.96],
      ] as const
    ).forEach(([id, wing, u, v]) =>
      minor.push({
        id,
        tier: 'detail',
        ground: DRY,
        variants: [
          {
            w: 28,
            h: 18,
            form: 'grass',
            anchors: [
              { wing, u, v },
              { wing, u: Math.min(1, u + 0.15), v: v + 0.04 },
              { wing, u: u * 0.6, v: v - 0.05 },
            ],
          },
        ],
      }),
    );
  const props = [...taken, ...placeProps(minor, geo, { blocks, taken })];
  return { blocks, water: water.join(''), bridges, props, centre };
}

// ---------------------------------------------------------------------------------------------
// 畫法（往左是外側；右翼會水平翻轉）

/** 主角道具：支流的水是地形，這裡只畫中間那條支流上的小木橋（俯視）與匯流處的一叢蘆葦 */
function Confluence({ w, h }: { w: number; h: number }) {
  const s = Math.min(1, w / 240);
  const bx = w * 0.3;
  const by = h * 0.52 + (h * 0.04 + 0) * 0.3;
  const bw = 16 * s + 6;
  const bh = 34 * s + 8;
  return (
    <>
      <path d={`M${bx - bw / 2} ${by - bh / 2}h${bw}v${bh}h${-bw}Z`} fill={WOOD} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path
        d={`M${bx - bw / 2 - 3} ${by - bh / 2 - 2}v${bh + 4}M${bx + bw / 2 + 3} ${by - bh / 2 - 2}v${bh + 4}${Array.from({ length: 3 }, (_, i) => `M${bx - bw / 2} ${by - bh / 2 + ((i + 1) * bh) / 4}h${bw}`).join('')}`}
        fill="none"
        stroke={LINE}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <g transform={`translate(${w * 0.56} ${h * 0.26})`}>
        <Reeds w={26 * s + 6} h={26 * s + 6} />
      </g>
    </>
  );
}

/** 一叢蘆葦 w × h：幾根彎的莖與兩個穗 */
function Reeds({ w, h }: { w: number; h: number }) {
  const b = h - 1;
  return (
    <>
      <path
        d={`M${w * 0.2} ${b}q-1-${h * 0.5}-${w * 0.14}-${h * 0.74}M${w * 0.4} ${b}q0-${h * 0.6} ${w * 0.04}-${h * 0.9}M${w * 0.58} ${b}q1-${h * 0.5} ${w * 0.16}-${h * 0.7}M${w * 0.76} ${b}q2-${h * 0.3} ${w * 0.2}-${h * 0.42}`}
        fill="none"
        stroke={LEAF}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d={`M${w * 0.44} ${h * 0.08}a2.4 5 0 1 0 0.1 0ZM${w * 0.06} ${h * 0.24}a2.2 4.4 0 1 0 0.1 0Z`} fill={WOOD} stroke={LINE} strokeWidth="1" />
    </>
  );
}

/** 幾顆石頭（w × h，大小不一） */
function Stones({ w, h }: { w: number; h: number }) {
  const b = h - 1;
  return (
    <path
      d={`M2 ${b}q0-${h * 0.62} ${w * 0.3}-${h * 0.62}q${w * 0.28} 0 ${w * 0.3} ${h * 0.62}ZM${w * 0.5} ${b}q${w * 0.04}-${h * 0.42} ${w * 0.2}-${h * 0.42}q${w * 0.16} 0 ${w * 0.18} ${h * 0.42}ZM${w * 0.8} ${b}q0-${h * 0.26} ${w * 0.08}-${h * 0.26}q${w * 0.09} 0 ${w * 0.1} ${h * 0.26}Z`}
      fill={ROCK_DEEP}
      stroke={LINE}
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  );
}

/** 小樹（一棵或一叢）：樹幹與三個圓弧組成的樹冠（不是實心大圓）；items 是每棵樹的 x、y、寬、高 */
function treePath(x: number, y: number, w: number, h: number): { crown: string; trunk: string } {
  const ch = h * 0.72;
  return {
    crown: `M${x + w * 0.12} ${y + ch * 0.9}C${x - w * 0.06} ${y + ch * 0.62} ${x + w * 0.1} ${y + ch * 0.28} ${x + w * 0.32} ${y + ch * 0.3}C${x + w * 0.34} ${y} ${x + w * 0.72} ${y} ${x + w * 0.74} ${y + ch * 0.3}C${x + w * 0.98} ${y + ch * 0.3} ${x + w * 1.04} ${y + ch * 0.7} ${x + w * 0.86} ${y + ch * 0.9}Z`,
    trunk: `M${x + w * 0.44} ${y + h - 1}h${w * 0.14}l-1-${h * 0.36}h${2 - w * 0.14}Z`,
  };
}

function Trees({ items }: { items: readonly (readonly [number, number, number, number])[] }) {
  const t = items.map(([x, y, w, h]) => treePath(x, y, w, h));
  return (
    <>
      <path d={t.map((q) => q.trunk).join('')} fill={WOOD} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
      <path d={t.map((q) => q.crown).join('')} fill={LEAF} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
    </>
  );
}

/** 水閘 w × h（正面）：兩根石柱、橫樑與閘門（木板）、門下流出的水花 */
function Sluice({ w, h }: { w: number; h: number }) {
  const pw = w * 0.16;
  return (
    <>
      <path d={`M${w * 0.18} ${h - 6}q${w * 0.16}-6 ${w * 0.32} 0t${w * 0.32} 0`} fill="none" stroke={FOAM} strokeWidth="2.4" strokeLinecap="round" />
      <path
        d={`M2 ${h - 2}V${h * 0.16}h${pw}V${h - 2}ZM${w - 2 - pw} ${h - 2}V${h * 0.16}h${pw}V${h - 2}Z`}
        fill={ROCK_DEEP}
        stroke={LINE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d={`M0 ${h * 0.04}h${w}v${h * 0.14}H0ZM${2 + pw} ${h * 0.26}h${w - 4 - 2 * pw}v${h * 0.42}h${-(w - 4 - 2 * pw)}Z`}
        fill={WOOD}
        stroke={LINE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d={[0.35, 0.5, 0.65].map((t) => `M${w * t} ${h * 0.27}v${h * 0.4}`).join('')} stroke={LINE} strokeWidth="1" opacity="0.6" />
    </>
  );
}

/** 小木橋 w × h（俯視，跨在河上）：橋面、兩側欄杆 */
function Footbridge({ w, h }: { w: number; h: number }) {
  return (
    <>
      <path d={`M4 2h${w - 8}v${h - 4}H4Z`} fill={WOOD} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path
        d={`M2 0v${h}M${w - 2} 0v${h}${Array.from({ length: Math.floor(h / 10) }, (_, i) => `M5 ${8 + i * 10}h${w - 10}`).join('')}`}
        fill="none"
        stroke={LINE}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </>
  );
}

function Art({ p }: { p: Placed }) {
  const w = p.x1 - p.x0;
  const h = p.y1 - p.y0;
  switch (p.form) {
    case 'confluence':
      return <Confluence w={w} h={h} />;
    case 'sluice':
      return <Sluice w={w} h={h} />;
    case 'reeds':
      return <Reeds w={w} h={h} />;
    case 'stones':
      return <Stones w={w} h={h} />;
    case 'tree':
      return <Trees items={[[0, 0, w, h]]} />;
    case 'trees':
      return (
        <Trees
          items={[
            [0, h * 0.18, w * 0.42, h * 0.82],
            [w * 0.5, h * 0.3, w * 0.36, h * 0.7],
            [w * 0.24, 0, w * 0.46, h * 0.86],
          ]}
        />
      );
    case 'footbridge':
      return <Footbridge w={w} h={h} />;
    case 'grass':
      return <Grass w={w} h={h} />;
    case 'sparkle':
      return <path d="M1 6q4-5 8 0t8 0" fill="none" stroke={FOAM} strokeWidth="2" strokeLinecap="round" style={{ stroke: `light-dark(${FOAM}, ${GLOW})` }} />;
    default:
      return null;
  }
}

export default function River({ geo }: SceneProps) {
  const ids = useSceneIds();
  const plan = planRiver(geo);
  return (
    <>
      <SceneDefs ids={ids} />
      <TerrainRect id="meadow" r={{ x0: 0, y0: SEAM, x1: geo.bandW, y1: geo.h }} />
      {/* 頂端和上一章的交界：多頻起伏、依章節種子擺的凹口、兩側的散點與凹口尖端的物件（scene-seam 的 seamEdge，第 7、8 輪看圖驗收） */}
      <SeamEdgeArt edge={seamEdge(geo, plan, 'meadow', 5)} own={MEADOW} above={geo.seam?.fill ?? ''} />
      {/* 河與支流：先描 5px 的浪花色再填水色（paint-order），疊在一起的水只剩外圈的岸線 */}
      <path data-terrain-block="river" d={plan.water} fill={SEA} stroke={FOAM} strokeWidth="5" strokeLinejoin="round" paintOrder="stroke" />
      {plan.bridges.length > 0 && (
        <>
          <path d={plan.bridges.map((b) => b.deck).join('')} fill={WOOD} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
          <path d={plan.bridges.map((b) => b.rails).join('')} fill="none" stroke={LINE} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {[...plan.props].sort(byDepth).map((p) => (
        <Prop key={p.id} p={p}>
          <Art p={p} />
        </Prop>
      ))}
    </>
  );
}
