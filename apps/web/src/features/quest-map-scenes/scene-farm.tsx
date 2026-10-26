// 第 8 章「六大指標：投入」：農田與水車（圖規 6.4 的 C08）。底色是田地（地圖組的 .qm-terrain），這一層畫地形塊與物件：
// - 有兩翼時：入口那一翼有一條小溪從區帶外緣流進來、從水車底下流過再流回外緣；主角道具是水車與磨坊小屋（夜裡窗子透光），
//   旁邊是種子袋；溪和軌道之間是幾塊田畦（scene-meadow-deep 的條紋，和田地的底色交替）。另一翼是田畦、紅穀倉、乾草捆、稻草人與一叢樹。
//   夜裡田上有幾點螢火（很小，不像節點、不像圓點路線；淺色主題看不到）。
// - 手機與沒有兩翼的 medium：主角道具是種子袋（48 × 52），放在節點交錯留下的空側；軌道裡最多再兩個小東西。
// 放置、著地與保護框交給 scene-kit 的 placeProps；這個檔只決定構圖與畫法。
import type { ReactNode } from 'react';
import type { Bp, Point, SceneGeo } from '../quest-map/layout.ts';
import { SEAM, hashSeed, seededRandom, inflate } from '../quest-map/layout.ts';
import type { SceneProps } from '../quest-map/scenes.tsx';
import {
  byDepth,
  dayNight,
  FIELD,
  FOAM,
  Glow,
  GLOW,
  Grass,
  LEAF,
  LINE,
  MEADOW_DEEP,
  nearSide,
  PAPER,
  placeProps,
  pointInPoly,
  polyPath,
  Prop,
  rectPoly,
  ROCK_DEEP,
  ROOF,
  SceneDefs,
  SEA,
  smoothClosed,
  TerrainRect,
  useSceneIds,
  WING_GAP,
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
/** 手機的主角道具：節點交錯留下的空側，先試中間兩個節點，再試上下位移 */
const NODE_SPOTS: readonly Anchor[] = [1, 2, 0, 3].flatMap((node) => [0, -24, 24, -44, 44].map((dv) => ({ node, dv })));
const r1 = (n: number) => Math.round(n * 10) / 10;

/** 主角道具：有兩翼時是水車與磨坊（依翼寬由大到小），沒有時是軌道裡的種子袋 */
const HERO: PropSpec = {
  id: 'wheel',
  tier: 'hero',
  ground: ['field'],
  variants: [
    {
      w: 120,
      h: 120,
      bps: WIDE,
      form: 'wheel',
      anchors: [
        { wing: 'near', u: 0.4, v: 0.52 },
        { wing: 'near', u: 0.2, v: 0.48 },
      ],
    },
    { w: 100, h: 100, bps: WIDE, form: 'wheel', anchors: [{ wing: 'near', u: 0.5, v: 0.5 }] },
    { w: 48, h: 52, form: 'seeds', anchors: NODE_SPOTS },
  ],
};

/** 固定畫法的物件原尺寸：放大的尺寸用 scale 畫 */
const BASE: Readonly<Record<string, readonly [number, number]>> = {
  barn: [96, 84],
  hay: [56, 30],
  scarecrow: [34, 56],
  bags: [44, 32],
  fence: [72, 24],
};
const sizes = (form: string, ks: readonly number[]) => ks.map((k) => [r1(BASE[form]![0] * k), r1(BASE[form]![1] * k)] as const);

export interface Stream {
  readonly poly: readonly Point[];
  readonly d: string;
  /** 兩岸的淺色線 */
  readonly banks: string;
}

export interface FarmPlan {
  readonly blocks: readonly TerrainBlock[];
  readonly streams: readonly Stream[];
  /** 田畦：外框（地形塊 crop）與條紋 */
  readonly crops: readonly (readonly Point[])[];
  readonly rows: string;
  readonly props: readonly Placed[];
}

/** 開放曲線的 Catmull-Rom 取樣 */
function sampleOpen(pts: readonly Point[], per = 10): Point[] {
  const out: Point[] = [];
  const P = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))]!;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1);
    const p1 = P(i);
    const p2 = P(i + 1);
    const p3 = P(i + 2);
    for (let k = 0; k < per; k++) {
      const t = k / per;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

/** 小溪：沿中線兩側各 half 寬的帶狀多邊形，兩岸各一條淺色線 */
function stream(centre: readonly Point[], half: number, bandW: number): Stream {
  const c = sampleOpen(centre);
  const L: Point[] = [];
  const R: Point[] = [];
  c.forEach((p, i) => {
    const a = c[Math.max(0, i - 1)]!;
    const b = c[Math.min(c.length - 1, i + 1)]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    L.push({ x: p.x + nx * half, y: p.y + ny * half });
    R.push({ x: p.x - nx * half, y: p.y - ny * half });
  });
  const poly = [...L, ...R.reverse()];
  const bank = (pts: readonly Point[]) => {
    let d = '';
    let on = false;
    for (const p of pts) {
      const ok = p.x > 0 && p.x < bandW;
      if (ok) d += `${on ? 'L' : 'M'}${r1(p.x)} ${r1(p.y)}`;
      on = ok;
    }
    return d;
  };
  return { poly, d: polyPath(poly), banks: bank(L) + bank(R) };
}

/** 圓角：每個角先在兩邊各退 c 切出斜角，再做一次 Chaikin，角變圓、邊維持直線 */
function rounded(pts: readonly Point[], c = 14): Point[] {
  const cut: Point[] = [];
  pts.forEach((p, i) => {
    const a = pts[(i + pts.length - 1) % pts.length]!;
    const b = pts[(i + 1) % pts.length]!;
    const to = (q: Point) => {
      const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      const t = Math.min(c, len / 3) / len;
      return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
    };
    cut.push(to(a), to(b));
  });
  const q: Point[] = [];
  for (let i = 0; i < cut.length; i++) {
    const a = cut[i]!;
    const b = cut[(i + 1) % cut.length]!;
    q.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y }, { x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
  }
  return q;
}

/** 田畦的條紋：沿 angle 方向每 14px 一條 7px 寬的條紋（scene-meadow-deep），內縮 6px */
function rowsIn(poly: readonly Point[], angle: number): string {
  const ca = Math.cos(-angle);
  const sa = Math.sin(-angle);
  const rot = (p: Point, c: number, s: number) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c });
  const q = poly.map((p) => rot(p, ca, sa));
  const ys = q.map((p) => p.y);
  let d = '';
  for (let y = Math.min(...ys) + 10; y < Math.max(...ys) - 7; y += 15) {
    const xs: number[] = [];
    for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
      const a = q[i]!;
      const b = q[j]!;
      if (a.y > y !== b.y > y) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      if (xs[k + 1]! - xs[k]! < 24) continue;
      const a = rot({ x: xs[k]! + 8, y }, Math.cos(angle), Math.sin(angle));
      const b = rot({ x: xs[k + 1]! - 8, y }, Math.cos(angle), Math.sin(angle));
      d += `M${r1(a.x)} ${r1(a.y)}L${r1(b.x)} ${r1(b.y)}`;
    }
  }
  return d;
}

/**
 * 一塊田拆成 2 到 3 塊不規則的四邊形（第 3 輪看圖驗收：整塊近乎正矩形、有外框的田像貼紙）：沿長邊切開（每塊寬度差 0.8 到 1.2 倍），塊與塊之間留 12px 的田埂；
 * 每塊四個角各自往內錯開 0 到 20px（成了梯形或歪的四邊形），繞自己的中心轉 3 到 6 度（相鄰兩塊方向相反），再切圓角。
 * along 是條紋的方向（第一塊沿長邊、下一塊轉 90 度，相鄰兩塊的條紋交錯成拼布，跟著那一塊轉）
 */
function pieces(x0: number, y0: number, x1: number, y1: number, seed: string): { poly: Point[]; along: number }[] {
  const rand = seededRandom(hashSeed(seed));
  const wide = x1 - x0 >= y1 - y0;
  const len = wide ? x1 - x0 : y1 - y0;
  const n = len >= 260 ? 3 : 2;
  const ws = Array.from({ length: n }, () => 0.8 + 0.4 * rand());
  const unit = (len - 12 * (n - 1)) / ws.reduce((a, b) => a + b, 0);
  let a = wide ? x0 : y0;
  return ws.map((k, i) => {
    const r = wide ? { x0: a, x1: a + k * unit, y0, y1 } : { x0, x1, y0: a, y1: a + k * unit };
    a += k * unit + 12;
    const cx = (r.x0 + r.x1) / 2;
    const cy = (r.y0 + r.y1) / 2;
    const t = ((i % 2 ? -1 : 1) * (3 + 3 * rand()) * Math.PI) / 180;
    const corners = (
      [
        [r.x0, r.y0, 1, 1],
        [r.x1, r.y0, -1, 1],
        [r.x1, r.y1, -1, -1],
        [r.x0, r.y1, 1, -1],
      ] as const
    ).map(([x, y, sx, sy]) => {
      const dx = x + sx * 20 * rand() - cx;
      const dy = y + sy * 20 * rand() - cy;
      return { x: cx + dx * Math.cos(t) - dy * Math.sin(t), y: cy + dx * Math.sin(t) + dy * Math.cos(t) };
    });
    return { poly: rounded(corners, 10), along: (r.x1 - r.x0 >= r.y1 - r.y0 === (i % 2 === 0) ? 0 : Math.PI / 2) + t };
  });
}

/** 構圖（純函式，測試也用）：先放水車，依它畫出小溪，再在兩翼鋪田畦（避開小溪），最後放次要道具與螢火 */
export function planFarm(input: SceneGeo): FarmPlan {
  // 保護框再外擴 3px 再放：量測（G9）用 DOM 實際畫出的路線取樣，和幾何的取樣點差一點點，貼著邊放的物件會被算成相交；
  // 章節牌與紙籤的下緣再多留 16px（量測把立柱算成整個寬度）
  const geo: SceneGeo = {
    ...input,
    protect: input.protect.map((r) => {
      const g = inflate(r, 3);
      return { ...r, ...g, y1: g.y1 + (r.kind === 'plaque' || r.kind === 'banner' ? 16 : 0) };
    }),
  };
  const field: TerrainBlock = { id: 'field', poly: rectPoly({ x0: 0, y0: SEAM, x1: geo.bandW, y1: geo.h }) };
  const near = nearSide(geo);
  const far: Side = near === 'left' ? 'right' : 'left';
  const h = geo.h;
  const [hero] = placeProps([HERO], geo, { blocks: [field] });

  const spots = (vs: readonly number[], us: readonly number[]): Anchor[] => vs.flatMap((v) => us.map((u) => ({ track: true as const, u, v })));
  if (!hero || hero.form !== 'wheel') {
    const track: PropSpec[] = [
      { id: 'hay-track', tier: 'minor', ground: ['field'], variants: [{ w: 44, h: 24, form: 'hay', anchors: spots([0.36, 0.52, 0.68], [0.5, 0.42, 0.58]) }] },
      { id: 'grass-track', tier: 'minor', ground: ['field'], variants: [{ w: 28, h: 18, form: 'grass', anchors: spots([0.72, 0.56, 0.4], [0.3, 0.7, 0.5]) }] },
    ];
    const rest = placeProps(track, geo, { blocks: [field], taken: hero ? [hero] : [] });
    return { blocks: [field], streams: [], crops: [], rows: '', props: hero ? [hero, ...rest] : rest };
  }

  const sx = (side: Side, d: number) => (side === 'left' ? geo.track.left - d : geo.track.right + d);
  const edgeD = (side: Side) => (side === 'left' ? geo.track.left : geo.bandW - geo.track.right) + 30;
  const distOf = (x: number) => (near === 'left' ? geo.track.left - x : x - geo.track.right);
  const heroFar = Math.max(distOf(hero.x0), distOf(hero.x1));
  const W = hero.x1 - hero.x0;
  // 水輪中心離軌道邊的距離（水輪畫在框的外側）
  const wheelD = heroFar - W * 0.38;
  const E = edgeD(near);
  const S = Math.min(E, 440);
  const y1 = hero.y1;
  const half = Math.max(8, W * 0.09);
  const brook = stream(
    [
      { x: sx(near, E + 20), y: 0.1 * h },
      { x: sx(near, Math.max(heroFar + 40, 0.82 * S)), y: 0.2 * h },
      { x: sx(near, wheelD + 18), y: y1 - 0.1 * h },
      { x: sx(near, wheelD), y: y1 - 6 },
      { x: sx(near, wheelD + 26), y: y1 + 0.1 * h },
      { x: sx(near, Math.max(heroFar + 30, 0.7 * S)), y: 0.86 * h },
      { x: sx(near, E + 20), y: 0.93 * h },
    ],
    half,
    geo.bandW,
  );
  const blocks: TerrainBlock[] = [field, { id: 'sea', poly: brook.poly }];

  // 田畦：每翼兩到三片，每片拆成 2 到 3 塊各自歪一點的不規則四邊形（離軌道 d0 到 d1、y0 到 y1）；碰到小溪或水車的往內縮，縮不下就不畫
  const crops: Point[][] = [];
  let rows = '';
  const patch = (side: Side, d0: number, d1: number, ya: number, yb: number) => {
    const sp = wingSpan(side, geo);
    if (!sp) return;
    const lim = Math.abs(sp.outer - sp.inner) + WING_GAP;
    for (let e = Math.min(d1, lim); e - d0 >= 64; e -= 16) {
      const xa = sx(side, d0);
      const xb = sx(side, e);
      const parts = pieces(Math.min(xa, xb), ya, Math.max(xa, xb), yb, `farm ${side} ${r1(ya)}`);
      const hit = parts.some(
        ({ poly: pts }) =>
          pts.some((p) => pointInPoly(p, brook.poly)) ||
          brook.poly.some((p) => pointInPoly(p, pts)) ||
          pts.some((p) => p.x > hero.x0 - 10 && p.x < hero.x1 + 10 && p.y > hero.y0 - 10 && p.y < hero.y1 + 10),
      );
      if (hit) continue;
      crops.push(...parts.map((q) => q.poly));
      rows += parts.map((q) => rowsIn(q.poly, q.along)).join('');
      return;
    }
  };
  patch(near, 12, 0.6 * S, 0.1 * h, 0.3 * h);
  patch(near, 12, Math.max(56, wheelD - 70), y1 - 0.2 * h, y1 + 0.04 * h);
  patch(near, 12, 0.55 * S, 0.68 * h, 0.94 * h);
  const Sf = Math.min(edgeD(far), 440);
  patch(far, 12, 0.85 * Sf, 0.06 * h, 0.3 * h);
  patch(far, 60, 0.9 * Sf, 0.6 * h, 0.82 * h);
  blocks.push(...crops.map((poly) => ({ id: 'crop', poly })));

  const on = (
    id: string,
    form: string,
    wing: 'near' | 'far',
    ground: readonly string[],
    dims: readonly (readonly [number, number])[],
    spots2: readonly (readonly [number, number])[],
    group?: string,
    tier: 'minor' | 'detail' = 'minor',
  ): PropSpec => ({
    id,
    tier,
    group,
    ground,
    variants: dims.map(([w, h2]) => ({ w, h: h2, form, anchors: spots2.map(([u, v]) => ({ wing, u, v })) })),
  });
  const dry = ['field', '!sea', '!crop'];
  const vH = y1 / h;
  const minor: PropSpec[] = [
    // 入口翼：磨坊旁的種子袋、溪邊的草
    on(
      'bags',
      'bags',
      'near',
      dry,
      sizes('bags', [1.2, 1]),
      [
        [0.05, vH + 0.06],
        [0, vH + 0.12],
        [0.2, vH + 0.14],
      ],
      'wheel',
    ),
    on(
      'grass-near',
      'grass',
      'near',
      ['field', '!sea'],
      [[28, 18]],
      [
        [0.7, vH + 0.26],
        [0.5, 0.36],
        [0.9, vH - 0.22],
      ],
    ),
    on('hay-near', 'hay', 'near', dry, sizes('hay', [1.2, 1]), [
      [0.1, 0.4],
      [0.3, 0.36],
      [0.1, 0.62],
    ]),
    // 另一翼：紅穀倉與柵欄（同一組）、乾草捆、稻草人（站在田畦裡）、一叢樹
    on('barn', 'barn', 'far', dry, sizes('barn', [1.25, 1.1, 1]), [
      [0.3, 0.5],
      [0.1, 0.5],
      [0.55, 0.52],
    ]),
    on(
      'fence',
      'fence',
      'far',
      dry,
      sizes('fence', [1.2, 1]),
      [
        [0.95, 0.5],
        [0.85, 0.55],
        [0.05, 0.56],
      ],
      'barn',
    ),
    on('hay-far', 'hay', 'far', dry, sizes('hay', [1.2, 1]), [
      [0.7, 0.4],
      [0.15, 0.4],
      [0.6, 0.56],
    ]),
    on('scarecrow', 'scarecrow', 'far', ['crop'], sizes('scarecrow', [1.2, 1]), [
      [0.5, 0.25],
      [0.3, 0.22],
      [0.7, 0.26],
    ]),
    on(
      'trees-far',
      'trees',
      'far',
      dry,
      [
        [120, 60],
        [96, 52],
      ],
      [
        [0.4, 0.95],
        [0.1, 0.94],
        [0.7, 0.95],
      ],
    ),
    // 螢火（細節，夜裡才看得到）
    on(
      'fireflies-1',
      'fireflies',
      'far',
      ['field'],
      [[60, 34]],
      [
        [0.6, 0.72],
        [0.3, 0.7],
      ],
      undefined,
      'detail',
    ),
    on(
      'fireflies-2',
      'fireflies',
      'near',
      ['field'],
      [[60, 34]],
      [
        [0.3, 0.8],
        [0.2, 0.22],
      ],
      undefined,
      'detail',
    ),
    on(
      'fireflies-3',
      'fireflies',
      'far',
      ['field'],
      [[60, 34]],
      [
        [0.4, 0.14],
        [0.6, 0.18],
      ],
      undefined,
      'detail',
    ),
    { id: 'grass-track', tier: 'minor', ground: ['field'], variants: [{ w: 28, h: 18, form: 'grass', anchors: spots([0.72, 0.56, 0.4], [0.3, 0.7, 0.5]) }] },
  ];
  const props = [hero, ...placeProps(minor, geo, { blocks, taken: [hero] })];
  return { blocks, streams: [brook], crops, rows, props };
}

// ---------------------------------------------------------------------------------------------
// 畫法（框內座標，往左是外側）

/** 水車與磨坊（w × h，依 120 × 120 縮放）：水輪在外側（輪框、八根輪輻、十二片葉板、軸心），磨坊在內側（夜裡窗子透光），輪底的水花 */
function Wheel({ w, h, gid }: { w: number; h: number; gid: string }) {
  const k = Math.min(w / 120, h / 120);
  const cx = 46 * k;
  const cy = 64 * k;
  const R = 40 * k;
  const ri = R - 6 * k;
  const ring = `M${r1(cx + R)} ${r1(cy)}a${r1(R)} ${r1(R)} 0 1 0 ${r1(-2 * R)} 0a${r1(R)} ${r1(R)} 0 1 0 ${r1(2 * R)} 0ZM${r1(cx + ri)} ${r1(cy)}a${r1(ri)} ${r1(ri)} 0 1 1 ${r1(-2 * ri)} 0a${r1(ri)} ${r1(ri)} 0 1 1 ${r1(2 * ri)} 0Z`;
  let spokes = '';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    spokes += `M${r1(cx + 6 * k * Math.cos(a))} ${r1(cy + 6 * k * Math.sin(a))}L${r1(cx + ri * Math.cos(a))} ${r1(cy + ri * Math.sin(a))}`;
  }
  let paddles = '';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const p = (r: number, t: number) => `${r1(cx + r * c - t * s)} ${r1(cy + r * s + t * c)}`;
    paddles += `M${p(R - 1, -3.5 * k)}L${p(R + 8 * k, -3.5 * k)}L${p(R + 8 * k, 3.5 * k)}L${p(R - 1, 3.5 * k)}Z`;
  }
  const hx = 84 * k;
  return (
    <>
      {/* 磨坊：屋身、屋頂、窗與門 */}
      <path
        d={`M${r1(hx)} ${r1(h - 1)}V${r1(52 * k)}H${r1(118 * k)}V${r1(h - 1)}Z`}
        {...dayNight(PAPER, ROCK_DEEP)}
        stroke={LINE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d={`M${r1(hx - 6 * k)} ${r1(54 * k)}L${r1(101 * k)} ${r1(30 * k)}L${r1(124 * k)} ${r1(54 * k)}Z`}
        fill={ROOF}
        stroke={LINE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d={`M${r1(92 * k)} ${r1(64 * k)}h${r1(16 * k)}v${r1(14 * k)}h${r1(-16 * k)}ZM${r1(96 * k)} ${r1(h - 1)}v${r1(-18 * k)}h${r1(12 * k)}v${r1(18 * k)}`}
        fill={GLOW}
        stroke={LINE}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <Glow x={100 * k} y={71 * k} r={22 * k} gid={gid} />
      {/* 水輪 */}
      <path d={spokes} stroke={LINE} strokeWidth="2" strokeLinecap="round" />
      <path d={paddles} fill={WOOD} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
      <path d={ring} fill={WOOD} fillRule="evenodd" stroke={LINE} strokeWidth="1.5" />
      <path d={`M${r1(cx)} ${r1(cy)}H${r1(hx)}`} stroke={LINE} strokeWidth="3" strokeLinecap="round" />
      <path
        d={`M${r1(cx - 22 * k)} ${r1(h - 4)}q${r1(6 * k)} ${r1(-7 * k)} ${r1(12 * k)} 0t${r1(12 * k)} 0M${r1(cx + 6 * k)} ${r1(h - 3)}q${r1(6 * k)} ${r1(-6 * k)} ${r1(12 * k)} 0`}
        fill="none"
        stroke={FOAM}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </>
  );
}

/** 種子袋 48 × 52（手機的主角道具）：兩個麻布袋，前面那袋敞開、露出種子，旁邊幾顆芽 */
function Seeds() {
  return (
    <>
      <path d="M26 50q-4-18 2-30l-2-6h14l-2 6q8 12 2 30Z" fill={WOOD} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M4 50q-4-20 4-32q-2-4 2-6h14q4 2 2 6q8 12 4 32Z" fill={WOOD} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 15q8 4 16 0" fill="none" stroke={LINE} strokeWidth="1.2" />
      <path d="M12 14q5-4 10 0M44 51V42M44 44q-5-1-6-6q5 0 6 5q1-6 6-6q0 5-6 7" fill={GLOW} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
    </>
  );
}

/** 紅穀倉 96 × 84：屋身、山牆屋頂、大門的交叉木條、閣樓窗（scene-glow，夜裡有光暈） */
function Barn({ gid }: { gid: string }) {
  return (
    <>
      <path d="M8 83V40L48 14l40 26v43Z" fill={ROOF} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M2 42 48 8l46 34" fill="none" stroke={LINE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M32 83V56h32v27ZM32 56l32 27M64 56 32 83M42 30h12v12H42Z"
        {...dayNight(PAPER, ROCK_DEEP)}
        stroke={LINE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M43 31h10v10H43Z" fill={GLOW} />
      <Glow x={48} y={36} r={20} gid={gid} />
    </>
  );
}

/** 乾草捆 56 × 30：兩捆，捆繩兩條 */
function Hay() {
  return (
    <>
      <path d="M2 29V9q0-6 6-6h18q6 0 6 6v20ZM28 29V13q0-5 5-5h16q5 0 5 5v16Z" fill={GLOW} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 4v25M22 4v25M36 9v20M45 9v20" stroke={LINE} strokeWidth="1.2" opacity="0.6" />
    </>
  );
}

/** 稻草人 34 × 56：木架、草帽、上衣 */
function Scarecrow() {
  return (
    <>
      <path d="M17 55V12M3 24h28" stroke={WOOD} strokeWidth="3" strokeLinecap="round" />
      <path d="M8 22h18l-2 18H10ZM9 12q8-12 16 0ZM4 13h26" fill={ROOF} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </>
  );
}

/** 一段柵欄 72 × 24：三根樁、兩條橫木 */
function Fence() {
  return <path d="M4 23V5M36 23V3M68 23V5M2 10h68M2 18h68" fill="none" stroke={WOOD} strokeWidth="3" strokeLinecap="round" />;
}

/** 種子袋（翼裡的小東西）44 × 32：兩個袋子 */
function Bags() {
  return (
    <>
      <path
        d="M2 31q-3-12 3-19l3-3-2-5 6 2 6-2-2 5 3 3q6 7 3 19ZM24 31q-2-10 3-15l2-2-2-4 5 2 5-2-2 4 2 2q5 5 3 15Z"
        fill={WOOD}
        stroke={LINE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M7 10h10M28 15h9" stroke={LINE} strokeWidth="1.5" strokeLinecap="round" />
    </>
  );
}

/** 一叢樹 w × h：有起伏的樹冠與露出的樹幹（和工坊那一章同樣的畫法） */
function Trees({ w, h }: { w: number; h: number }) {
  const n = Math.max(2, Math.min(5, Math.round(w / 30)));
  const r = Math.min(w / n / 1.5, h * 0.3);
  const ground = h - 1;
  const bottom = ground - Math.max(11, h * 0.24);
  const xs = Array.from({ length: n }, (_, i) => r + ((w - 2 * r) * i) / (n - 1));
  const topY = (i: number) => 2 + (i % 2 ? 0 : r * 0.45);
  const pts: Point[] = [{ x: 2, y: bottom - r * 0.4 }];
  xs.forEach((x, i) => {
    const t = topY(i);
    pts.push({ x: x - 0.72 * r, y: t + 0.36 * r }, { x, y: t }, { x: x + 0.72 * r, y: t + 0.36 * r });
    if (i < n - 1) pts.push({ x: (x + xs[i + 1]!) / 2, y: Math.max(t, topY(i + 1)) + 0.6 * r });
  });
  pts.push({ x: w - 2, y: bottom - r * 0.4 }, { x: w * 0.72, y: bottom + 1 }, { x: w * 0.28, y: bottom + 1 });
  // 樹冠之間的分界：從凹處往下的短弧線（和樹冠同一個 path）
  const seams = xs
    .slice(1)
    .map((x, i) => `M${r1((xs[i]! + x) / 2)} ${r1(Math.max(topY(i), topY(i + 1)) + 0.6 * r + 2)}q-3 ${r1(r * 0.35)} 0 ${r1(r * 0.7)}`)
    .join('');
  return (
    <>
      <path
        d={xs.map((x) => `M${r1(x - 2)} ${ground}V${r1(bottom - 6)}h4V${ground}Z`).join('')}
        fill={WOOD}
        stroke={LINE}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d={smoothClosed(pts, 4).d + seams} fill={LEAF} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </>
  );
}

/** 螢火 60 × 34：幾個很小的亮點，只在深色主題看得到 */
function Fireflies({ seed }: { seed: string }) {
  const rand = seededRandom(hashSeed(seed));
  const d = Array.from({ length: 6 }, () => {
    const x = 4 + rand() * 52;
    const y = 4 + rand() * 26;
    const r = 1.2 + rand() * 0.8;
    return `M${r1(x - r)} ${r1(y)}a${r1(r)} ${r1(r)} 0 1 0 ${r1(2 * r)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(-2 * r)} 0`;
  }).join('');
  return <path d={d} fill="transparent" style={{ fill: 'light-dark(transparent, var(--ll-scene-glow))' }} />;
}

function Art({ p, gid }: { p: Placed; gid: string }) {
  const w = p.x1 - p.x0;
  const h = p.y1 - p.y0;
  const base = BASE[p.form];
  const k = base ? Math.round((w / base[0]) * 100) / 100 : 1;
  const scaled = (node: ReactNode) => (k === 1 ? node : <g transform={`scale(${k})`}>{node}</g>);
  switch (p.form) {
    case 'wheel':
      return <Wheel w={w} h={h} gid={gid} />;
    case 'seeds':
      return <Seeds />;
    case 'barn':
      return scaled(<Barn gid={gid} />);
    case 'hay':
      return scaled(<Hay />);
    case 'scarecrow':
      return scaled(<Scarecrow />);
    case 'fence':
      return scaled(<Fence />);
    case 'bags':
      return scaled(<Bags />);
    case 'trees':
      return <Trees w={w} h={h} />;
    case 'fireflies':
      return <Fireflies seed={p.id} />;
    case 'grass':
      return <Grass w={w} h={h} />;
    default:
      return null;
  }
}

const CROP = `light-dark(${MEADOW_DEEP}, ${LEAF})`;

export default function FarmScene({ geo }: SceneProps) {
  const ids = useSceneIds();
  const plan = planFarm(geo);
  return (
    <>
      <SceneDefs ids={ids} />
      <TerrainRect id="field" r={{ x0: 0, y0: SEAM, x1: geo.bandW, y1: geo.h }} />
      {/* 頂端和上一章的交界：多頻起伏、依章節種子擺的凹口、兩側的散點與凹口尖端的物件（scene-seam 的 seamEdge，第 7、8 輪看圖驗收） */}
      <SeamEdgeArt edge={seamEdge(geo, plan, 'field', 8)} own={FIELD} above={geo.seam?.fill ?? ''} />
      {/* 田畦：不描外框，條紋半透明（第 3 輪看圖驗收）；深色主題改用葉色（比田地亮一點的綠），scene-meadow-deep 在夜裡比田地暗，整塊像深色的板子 */}
      {plan.crops.length > 0 && (
        <>
          <path data-terrain-block="crop" d={plan.crops.map((c) => polyPath(c)).join('')} fill={MEADOW_DEEP} fillOpacity="0.35" style={{ fill: CROP }} />
          <path d={plan.rows} fill="none" stroke={MEADOW_DEEP} strokeWidth="7" strokeLinecap="round" opacity="0.5" style={{ stroke: CROP }} />
        </>
      )}
      {plan.streams.map((s) => (
        <g key={s.d.length}>
          <path data-terrain-block="sea" d={s.d} fill={SEA} />
          <path d={s.banks} fill="none" stroke={FOAM} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}
      {[...plan.props].sort(byDepth).map((p) => (
        <Prop key={p.id} p={p}>
          <Art p={p} gid={ids.glow} />
        </Prop>
      ))}
    </>
  );
}
