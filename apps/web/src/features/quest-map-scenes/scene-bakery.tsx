// 第 9 章「六大指標：轉換」：麵包工坊（圖規 6.4 的 C09）。底色是廣場（地圖組的 .qm-terrain），這一層畫地形塊與物件：
// - 磚院子（第 4 輪看圖驗收）：涵蓋軌道與入口那一翼、章高 8% 到 80% 的一大塊不規則地（scene-kit 的 plotArea），磚縫只畫在裡面，外框是清楚的 1.5px 線（手機也有）。
// - 有兩翼時：主角道具是院子裡的圓頂烤爐（爐口是 scene-glow，夜裡爐口一圈半徑 24 以內的光暈；旁邊靠著麵包鏟），
//   前面是輸送帶與麵包（原料轉成成品）、麵粉袋，附近有木柴；院子下方一叢樹。
//   另一翼是磨麵粉的風車（後面 2 到 3 塊各自歪一點的麥田）、麵包店（遮雨棚、櫥窗夜裡透光）、麵粉袋與麥束，最下面一叢樹。不畫糖果甜點（6.4）。
// - 手機與沒有兩翼的 medium：主角道具是小烤爐（80 × 68），放在節點交錯留下的空側；軌道裡最多再兩個小東西。
// 放置、著地與保護框交給 scene-kit 的 placeProps；這個檔只決定構圖與畫法。
import type { ReactNode } from 'react';
import type { Bp, Point, SceneGeo } from '../quest-map/layout.ts';
import { SEAM, hashSeed, inflate, seededRandom } from '../quest-map/layout.ts';
import type { SceneProps } from '../quest-map/scenes.tsx';
import {
  byDepth,
  dayNight,
  FIELD,
  Glow,
  GLOW,
  Grass,
  grounded,
  LEAF,
  LINE,
  nearSide,
  PAPER,
  placeProps,
  PLAZA,
  Plot,
  plotArea,
  pointInPoly,
  Prop,
  rectPoly,
  ROCK_DEEP,
  ROOF,
  SAND,
  SceneDefs,
  smoothClosed,
  TerrainRect,
  useSceneIds,
  WING_GAP,
  wingSpan,
  WOOD,
  type Anchor,
  type Placed,
  type PropSpec,
  type TerrainBlock,
} from './scene-kit.tsx';
import { SeamEdgeArt, seamEdge } from './scene-seam.tsx';

export const geoAware = true;

const WIDE: readonly Bp[] = ['medium', 'expanded'];
/** 手機的主角道具：節點交錯留下的空側，先試中間兩個節點，再試上下位移 */
const NODE_SPOTS: readonly Anchor[] = [1, 2, 0, 3].flatMap((node) => [0, -24, 24, -44, 44].map((dv) => ({ node, dv })));
const r1 = (n: number) => Math.round(n * 10) / 10;

/** 主角道具：有兩翼時是圓頂烤爐（依翼寬由大到小），沒有時是軌道裡的小烤爐。放下時還沒有院子（院子依烤爐的位置鋪），放好之後改成 yard */
const HERO: PropSpec = {
  id: 'oven',
  tier: 'hero',
  ground: ['plaza'],
  variants: [
    {
      w: 130,
      h: 110,
      bps: WIDE,
      form: 'oven',
      anchors: [
        { wing: 'near', u: 0.3, v: 0.46 },
        { wing: 'near', u: 0.1, v: 0.5 },
        { wing: 'near', u: 0.5, v: 0.42 },
      ],
    },
    { w: 104, h: 88, bps: WIDE, form: 'oven', anchors: [{ wing: 'near', u: 0.5, v: 0.46 }] },
    { w: 80, h: 68, form: 'oven', anchors: NODE_SPOTS },
  ],
};

/** 固定畫法的物件原尺寸：放大的尺寸用 scale 畫 */
const BASE: Readonly<Record<string, readonly [number, number]>> = {
  belt: [96, 40],
  sacks: [52, 36],
  logs: [56, 30],
  shop: [110, 96],
  mill: [76, 132],
  wheat: [30, 38],
};
const sizes = (form: string, ks: readonly number[]) => ks.map((k) => [r1(BASE[form]![0] * k), r1(BASE[form]![1] * k)] as const);

/** 磚院子：涵蓋軌道與入口那一翼的一大塊地（scene-kit 的 plotArea）；磚縫是 pattern */
export interface Yard {
  readonly d: string;
  readonly poly: readonly Point[];
}

export interface Lane {
  readonly poly: readonly Point[];
  readonly d: string;
  /** 兩側的路緣線 */
  readonly edges: string;
}

export interface BakeryPlan {
  readonly blocks: readonly TerrainBlock[];
  readonly yards: readonly Yard[];
  /** 碎石小路（地形塊 lane） */
  readonly lanes: readonly Lane[];
  /** 麥田（地形塊 wheat）與麥稈的條紋 */
  readonly fields: readonly (readonly Point[])[];
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

/** 小路：沿中線兩側各 half 寬的帶狀多邊形，兩側各一條路緣線（只畫區帶內的部分） */
function lane(centre: readonly Point[], half: number, bandW: number): Lane {
  const c = sampleOpen(centre);
  const L: Point[] = [];
  const R: Point[] = [];
  c.forEach((p, i) => {
    const a = c[Math.max(0, i - 1)]!;
    const b = c[Math.min(c.length - 1, i + 1)]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    L.push({ x: p.x - ((b.y - a.y) / len) * half, y: p.y + ((b.x - a.x) / len) * half });
    R.push({ x: p.x + ((b.y - a.y) / len) * half, y: p.y - ((b.x - a.x) / len) * half });
  });
  const edge = (pts: readonly Point[]) => {
    let d = '';
    let on = false;
    for (const p of pts) {
      const ok = p.x > 0 && p.x < bandW;
      if (ok) d += `${on ? 'L' : 'M'}${r1(p.x)} ${r1(p.y)}`;
      on = ok;
    }
    return d;
  };
  const poly = [...L, ...[...R].reverse()];
  return { poly, d: `M${poly.map((p) => `${r1(p.x)} ${r1(p.y)}`).join('L')}Z`, edges: edge(L) + edge(R) };
}

/** 圓角：每個角先在兩邊各退 c 切出斜角，再做一次 Chaikin */
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

/** 麥田的條紋：沿 angle 方向每 13px 一條，內縮 8px */
function rowsIn(poly: readonly Point[], angle: number): string {
  const rot = (p: Point, a: number) => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) });
  const q = poly.map((p) => rot(p, -angle));
  const ys = q.map((p) => p.y);
  let d = '';
  for (let y = Math.min(...ys) + 9; y < Math.max(...ys) - 6; y += 13) {
    const xs: number[] = [];
    for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
      const a = q[i]!;
      const b = q[j]!;
      if (a.y > y !== b.y > y) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      if (xs[k + 1]! - xs[k]! < 24) continue;
      const a = rot({ x: xs[k]! + 8, y }, angle);
      const b = rot({ x: xs[k + 1]! - 8, y }, angle);
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

/** 多邊形在水平線 y 上最外側的 x（左翼取最左、右翼取最右）；那一列沒有交點時取整個多邊形的極值 */
function rimX(poly: readonly Point[], y: number, side: 'left' | 'right'): number {
  const xs: number[] = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > y !== b.y > y) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
  }
  const all = xs.length ? xs : poly.map((p) => p.x);
  return side === 'left' ? Math.min(...all) : Math.max(...all);
}

/** 構圖（純函式，測試也用）：磚院子是涵蓋軌道與入口那一翼的一大塊地；先放烤爐，前面是輸送帶與麵粉袋，再放次要道具 */
export function planBakery(input: SceneGeo): BakeryPlan {
  // 保護框再外擴 3px 再放：量測（G9）用 DOM 實際畫出的路線取樣，和幾何的取樣點差一點點，貼著邊放的物件會被算成相交；
  // 章節牌與紙籤的下緣再多留 16px（量測把立柱算成整個寬度）
  const geo: SceneGeo = {
    ...input,
    protect: input.protect.map((r) => {
      const g = inflate(r, 3);
      return { ...r, ...g, y1: g.y1 + (r.kind === 'plaque' || r.kind === 'banner' ? 16 : 0) };
    }),
  };
  const plaza: TerrainBlock = { id: 'plaza', poly: rectPoly({ x0: 0, y0: SEAM, x1: geo.bandW, y1: geo.h }) };
  const near = nearSide(geo);
  const h = geo.h;
  const [placed] = placeProps([HERO], geo, { blocks: [plaza] });
  // 磚院子（第 4 輪看圖驗收：原本只在烤爐底下鋪一塊羽化邊的圓角方，深色主題變成一團發霧的方形光暈）：涵蓋軌道與入口那一翼、章高 8% 到 80% 的一大塊地
  const court: Yard = plotArea(input, 'bakery yard', 0.08, 0.8);
  const yardBlock: TerrainBlock = { id: 'yard', poly: court.poly };

  const spots = (vs: readonly number[], us: readonly number[]): Anchor[] => vs.flatMap((v) => us.map((u) => ({ track: true as const, u, v })));
  const grassTrack: PropSpec = {
    id: 'grass-track',
    tier: 'minor',
    ground: ['plaza'],
    variants: [{ w: 28, h: 18, form: 'grass', anchors: spots([0.72, 0.56, 0.4], [0.3, 0.7, 0.5]) }],
  };
  if (!placed || placed.region === 'track') {
    const track: PropSpec[] = [
      {
        id: 'sacks-track',
        tier: 'minor',
        ground: ['plaza'],
        variants: [{ w: 42, h: 29, form: 'sacks', anchors: spots([0.38, 0.52, 0.66], [0.5, 0.42, 0.58]) }],
      },
      grassTrack,
    ];
    const rest = placeProps(track, geo, { blocks: [plaza], taken: placed ? [placed] : [] });
    return { blocks: [plaza, yardBlock], yards: [court], lanes: [], fields: [], rows: '', props: placed ? [placed, ...rest] : rest };
  }

  // 院子裡的東西以烤爐為準：輸送帶與麵粉袋在前方（烤爐往下 66px）
  const span = wingSpan(near, geo)!;
  const fy0 = Math.max(SEAM + 8, placed.y0 - 20);
  const fy1 = Math.min(h - 16, placed.y1 + 92);
  const hero: Placed = { ...placed, ground: grounded(placed, ['yard'], [yardBlock]) ? ['yard'] : ['plaza'] };

  const on = (
    id: string,
    form: string,
    wing: 'near' | 'far',
    ground: readonly string[],
    dims: readonly (readonly [number, number])[],
    spots2: readonly (readonly [number, number])[],
    group?: string,
  ): PropSpec => ({
    id,
    tier: 'minor',
    group,
    ground,
    variants: dims.map(([w, h2]) => ({ w, h: h2, form, anchors: spots2.map(([u, v]) => ({ wing, u, v })) })),
  });
  const depth = Math.abs(span.inner - span.outer);
  const uOf = (x: number, w: number) => {
    const dist = near === 'left' ? geo.track.left - x : x - geo.track.right;
    return Math.min(1, Math.max(0, (dist - WING_GAP - w / 2) / Math.max(1, depth - w)));
  };
  const toIn = near === 'left' ? 1 : -1;
  const xIn = near === 'left' ? hero.x1 : hero.x0;
  const xOut = near === 'left' ? hero.x0 : hero.x1;
  const vFront = (hero.y1 + 66) / h;
  const vAbove = (fy0 - 22) / h;
  const vBelow = (fy1 + 70) / h;
  // 院子裡：輸送帶與麵包（前方內側）、麵粉袋（前方外側），同一組
  const deckItems = placeProps(
    [
      on(
        'belt',
        'belt',
        'near',
        ['yard'],
        sizes('belt', [0.85, 0.7]),
        [
          [uOf(xIn - toIn * 44, 82), vFront],
          [uOf(xIn - toIn * 38, 67), vFront + 0.01],
          [uOf((xIn + xOut) / 2, 67), vFront],
        ],
        'yard',
      ),
      on(
        'sacks',
        'sacks',
        'near',
        ['yard'],
        sizes('sacks', [0.9, 0.75]),
        [
          [uOf(xOut + toIn * 26, 47), vFront + 0.01],
          [uOf(xOut + toIn * 22, 39), vFront + 0.02],
          [uOf(xOut + toIn * 22, 39), vFront - 0.03],
        ],
        'yard',
      ),
    ],
    geo,
    { blocks: [plaza, yardBlock], taken: [hero] },
  );
  const blocks: TerrainBlock[] = [plaza, yardBlock];
  const offYard = ['plaza', '!yard'];
  const grove = (id: string, wing: 'near' | 'far', spots2: readonly (readonly [number, number])[]) =>
    on(
      id,
      'trees',
      wing,
      offYard,
      [
        [126, 62],
        [96, 52],
        [72, 46],
      ],
      spots2,
    );
  // 第一步：另一翼的風車與麵包店（小路與麥田依它們的位置畫）
  const buildings = placeProps(
    [
      on('mill', 'mill', 'far', ['plaza'], sizes('mill', [1, 0.85]), [
        [0.55, 0.38],
        [0.8, 0.36],
        [0.3, 0.36],
      ]),
      on('shop', 'shop', 'far', ['plaza'], sizes('shop', [1.2, 1.05, 0.9]), [
        [0.25, 0.68],
        [0.05, 0.68],
        [0.5, 0.7],
      ]),
    ],
    geo,
    { blocks, taken: [hero, ...deckItems] },
  );
  const mill = buildings.find((p) => p.id === 'mill');
  const shop = buildings.find((p) => p.id === 'shop');
  const far = near === 'left' ? 'right' : 'left';
  const sx = (side: 'left' | 'right', d: number) => (side === 'left' ? geo.track.left - d : geo.track.right + d);
  const edge = (side: 'left' | 'right') => (side === 'left' ? geo.track.left : geo.bandW - geo.track.right) + 30;
  const door = (p: Placed) => ({ x: (p.x0 + p.x1) / 2, y: p.y1 + 13 });
  const lanes: Lane[] = [];
  if (geo.wings[far] && (mill || shop))
    lanes.push(
      lane(
        [{ x: sx(far, edge(far)), y: 0.92 * h }, ...(shop ? [door(shop)] : []), ...(mill ? [door(mill)] : []), { x: sx(far, edge(far)), y: 0.3 * h }],
        9,
        geo.bandW,
      ),
    );
  // 院子外側的出口：一條小路從院子邊往外緣
  // 從院子外緣（小路起點那一列）往外 2px 起筆：院子是半透明的，小路不伸進院子底下；院子外緣離畫面邊還有 120px 以上（超寬螢幕）才有這條路
  const yx = rimX(court.poly, fy1 - 34, near) - toIn * 2;
  if (near === 'left' ? yx > 120 : geo.bandW - yx > 120)
    lanes.push(
      lane(
        [
          { x: yx, y: fy1 - 34 },
          { x: yx + (sx(near, edge(near)) - yx) * 0.45, y: fy1 + 4 },
          { x: sx(near, edge(near)), y: fy1 + 40 },
        ],
        9,
        geo.bandW,
      ),
    );
  // 麥田：另一翼上方、風車後面，2 到 3 塊各自歪一點的不規則四邊形（碰到小路就往內縮）
  const fields: Point[][] = [];
  let rows = '';
  const sp = wingSpan(far, geo);
  if (sp) {
    const lim = Math.abs(sp.outer - sp.inner) + WING_GAP;
    const yb = mill ? mill.y1 - 34 : 0.3 * h;
    for (let e = Math.min(0.92 * Math.min(edge(far), 440), lim); e >= 110; e -= 16) {
      const xa = sx(far, 52);
      const xb = sx(far, e);
      const parts = pieces(Math.min(xa, xb), 0.07 * h, Math.max(xa, xb), yb, `bakery wheat ${far}`);
      if (
        yb - 0.07 * h < 70 ||
        parts.some(({ poly }) => lanes.some((l) => poly.some((q) => pointInPoly(q, l.poly)) || l.poly.some((q) => pointInPoly(q, poly))))
      )
        continue;
      fields.push(...parts.map((q) => q.poly));
      rows = parts.map((q) => rowsIn(q.poly, q.along)).join('');
      break;
    }
  }
  const all: TerrainBlock[] = [...blocks, ...lanes.map((l) => ({ id: 'lane', poly: l.poly })), ...fields.map((poly) => ({ id: 'wheat', poly }))];
  const dry = ['plaza', '!yard', '!lane', '!wheat'];
  const groveDry = (id: string, wing: 'near' | 'far', spots2: readonly (readonly [number, number])[]) => ({ ...grove(id, wing, spots2), ground: dry });
  const minor: PropSpec[] = [
    // 院子上方：一叢樹；下方：木柴與一叢樹
    groveDry('grove-near', 'near', [
      [0.45, vAbove],
      [0.2, vAbove],
      [0.7, vAbove - 0.03],
    ]),
    on('logs', 'logs', 'near', ['plaza', '!lane'], sizes('logs', [1.15, 1]), [
      [0.1, vBelow + 0.04],
      [0.6, vBelow + 0.06],
      [0.3, vBelow + 0.08],
    ]),
    groveDry('grove-near2', 'near', [
      [0.25, 0.95],
      [0.55, 0.94],
      [0.8, 0.95],
    ]),
    // 另一翼：風車旁的麥束、麵包店旁的麵粉袋（同一組）、小路旁的樹
    on(
      'wheat-far',
      'wheat',
      'far',
      dry,
      sizes('wheat', [1.2, 1]),
      [
        [0.05, 0.38],
        [1, 0.38],
        [0.15, 0.42],
      ],
      'mill',
    ),
    on(
      'sacks-far',
      'sacks',
      'far',
      dry,
      sizes('sacks', [1.1, 0.9]),
      [
        [0.95, 0.69],
        [1, 0.64],
        [0.7, 0.6],
      ],
      'shop',
    ),
    groveDry('grove-far', 'far', [
      [0.15, 0.96],
      [0.45, 0.95],
      [0.1, 0.88],
    ]),
    grassTrack,
  ];
  const props = [hero, ...deckItems, ...buildings, ...placeProps(minor, geo, { blocks: all, taken: [hero, ...deckItems, ...buildings] })];
  return { blocks: all, yards: [court], lanes, fields, rows, props };
}

// ---------------------------------------------------------------------------------------------
// 畫法（框內座標，往左是外側）

/** 圓頂烤爐（w × h，依 130 × 110 縮放）：石座、磚砌的圓頂與兩道磚紋、發光的拱形爐口（裡面兩條麵包）、煙管與兩縷煙、靠在內側的麵包鏟 */
function Oven({ w, h, gid }: { w: number; h: number; gid: string }) {
  const k = Math.min(w / 130, h / 110);
  const s = (n: number) => r1(n * k);
  const big = w >= 100;
  return (
    <>
      {/* 煙管與石座 */}
      <path
        d={`M${s(84)} ${s(30)}V${s(6)}h${s(12)}v${s(30)}ZM${s(2)} ${r1(h - 1)}V${s(94)}H${s(114)}V${r1(h - 1)}Z`}
        fill={ROCK_DEEP}
        stroke={LINE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d={`M${s(6)} ${s(94)}C${s(6)} ${s(40)} ${s(30)} ${s(22)} ${s(58)} ${s(22)}S${s(110)} ${s(40)} ${s(110)} ${s(94)}Z`}
        fill={ROOF}
        stroke={LINE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* 圓頂的磚紋與煙 */}
      <path
        d={`M${s(18)} ${s(70)}C${s(22)} ${s(46)} ${s(38)} ${s(36)} ${s(58)} ${s(36)}S${s(94)} ${s(46)} ${s(98)} ${s(70)}M${s(30)} ${s(52)}C${s(38)} ${s(44)} ${s(48)} ${s(42)} ${s(58)} ${s(42)}M${s(88)} ${s(4)}q${s(-4)} ${s(-2)} ${s(-1)} ${s(-4)}M${s(93)} ${s(4)}q${s(4)} ${s(-2)} ${s(1)} ${s(-4)}`}
        fill="none"
        stroke={LINE}
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path d={`M${s(38)} ${s(94)}V${s(72)}a${s(20)} ${s(20)} 0 0 1 ${s(40)} 0V${s(94)}Z`} fill={GLOW} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      {/* 爐裡的兩條麵包與靠在內側的麵包鏟 */}
      <path
        d={`M${s(44)} ${s(92)}q${s(8)} ${s(-8)} ${s(14)} 0ZM${s(58)} ${s(92)}q${s(8)} ${s(-9)} ${s(14)} 0Z${big ? `M${s(118)} ${r1(h - 1)}L${s(126)} ${s(36)}M${s(122)} ${s(40)}l${s(4)} ${s(-14)}h${s(-8)}Z` : ''}`}
        fill={WOOD}
        stroke={LINE}
        strokeWidth="1.3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* 爐口的光（第 4 輪看圖驗收：只在爐口，半徑 24 以內，不擴到整塊磚牆） */}
      <g opacity="0.5">
        <Glow x={58 * k} y={80 * k} r={Math.min(24, 22 * k)} gid={gid} />
      </g>
    </>
  );
}

/** 輸送帶與麵包 96 × 40：帶子、三個滾輪（輪框）、兩根腳，帶上三條麵包（有刀痕） */
function Belt() {
  return (
    <>
      <path d="M10 39V28M86 39V28" stroke={LINE} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M8 16h80a6 6 0 0 1 0 12H8a6 6 0 0 1 0-12Z" fill={ROCK_DEEP} stroke={LINE} strokeWidth="1.5" />
      <path d="M12 16q0-10 12-10t12 10ZM40 16q0-12 13-12t13 12ZM70 16q0-9 10-9t10 9Z" fill={GLOW} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path
        d="M19 10l3-3M25 10l3-3M47 9l4-3M54 9l4-3M11 22a3 3 0 1 0 0 .1M48 22a3 3 0 1 0 0 .1M85 22a3 3 0 1 0 0 .1"
        fill="none"
        stroke={LINE}
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.75"
      />
    </>
  );
}

/** 麵粉袋 52 × 36：三袋（白色袋身、束口），夜裡是石色 */
function Sacks() {
  return (
    <>
      <path
        d="M18 18q-2-8 4-12l-1-4h12l-1 4q6 4 4 12ZM2 35q-3-14 5-19l-1-4h14l-1 4q8 5 5 19ZM26 35q-3-14 5-19l-1-4h14l-1 4q8 5 5 19ZM7 15h12M31 15h12M22 6h10"
        {...dayNight(PAPER, ROCK_DEEP)}
        stroke={LINE}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </>
  );
}

/** 木柴堆 56 × 30 */
function Logs() {
  return (
    <>
      <path
        d="M6 29h46a5 5 0 0 0 0-10H6a5 5 0 0 0 0 10ZM14 19h30a5 5 0 0 0 0-10H14a5 5 0 0 0 0 10Z"
        fill={WOOD}
        stroke={LINE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8 24a2.5 2.5 0 1 0 0 .1M16 14a2.5 2.5 0 1 0 0 .1M22 24a2.5 2.5 0 1 0 0 .1" fill="none" stroke={LINE} strokeWidth="1.2" />
    </>
  );
}

/** 麵包店 110 × 96：屋身、屋頂、紅白相間的遮雨棚、櫥窗（scene-glow，裡面兩條麵包，夜裡有光暈）、門 */
function Shop({ gid }: { gid: string }) {
  let stripes = '';
  for (let x = 8; x < 102; x += 16) stripes += `M${x} 46h8v12q-4 4-8 0Z`;
  return (
    <>
      <path d="M10 95V40h90v55Z" {...dayNight(PAPER, ROCK_DEEP)} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path
        d="M8 46h94v12q-4 4-8 0q-4 4-8 0q-4 4-8 0q-4 4-8 0q-4 4-8 0q-4 4-8 0q-4 4-8 0q-4 4-8 0q-4 4-8 0q-4 4-8 0q-4 4-8 0q-4 4-6 0Z"
        {...dayNight(PAPER, ROCK_DEEP)}
        stroke={LINE}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* 屋頂與遮雨棚的紅色條紋（同一個 path） */}
      <path d={`M4 42 22 14h66l18 28Z${stripes}`} fill={ROOF} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M18 66h40v20H18ZM70 95V68h18v27" fill={GLOW} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M24 84q0-8 8-8t8 8ZM40 84q0-7 7-7t7 7Z" fill={WOOD} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
      <g opacity="0.5">
        <Glow x={38} y={76} r={36} gid={gid} />
      </g>
    </>
  );
}

/** 風車 76 × 132：上窄下寬的塔身、塔頂、門，四片扇葉（框加一條中線，不畫虛線） */
function Mill() {
  const blade = (a: number) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const p = (r: number, t: number) => `${r1(38 + r * c - t * s)} ${r1(34 + r * s + t * c)}`;
    return `M${p(4, 0)}L${p(36, 0)}M${p(10, 2)}L${p(36, 2)}L${p(36, 13)}L${p(10, 13)}ZM${p(10, 7.5)}L${p(36, 7.5)}`;
  };
  return (
    <>
      <path d="M18 131 27 42h22l9 89Z" {...dayNight(PAPER, ROCK_DEEP)} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M22 44q16-20 32 0ZM32 131v-16a6 6 0 0 1 12 0v16M33 70h10v10H33Z" fill={ROOF} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path
        d={[0.4, 1.97, 3.54, 5.11].map(blade).join('')}
        fill={WOOD}
        fillOpacity="0.35"
        stroke={LINE}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M38 31a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z" fill={WOOD} stroke={LINE} strokeWidth="1.2" />
    </>
  );
}

/** 麥束 30 × 38：一把麥稈、中間一道綁繩、上面的麥穗 */
function Wheat() {
  return (
    <>
      <path d="M8 37l5-17M15 37V20M22 37l-5-17M11 37l3-17M19 37l-3-17" stroke={WOOD} strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M10 20q-6-8-2-17q6 6 5 17ZM15 19q-3-10 1-18q4 8 1 18ZM20 20q-1-11 6-17q2 9-4 17ZM10 27h11"
        fill={GLOW}
        stroke={LINE}
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
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

function Art({ p, gid }: { p: Placed; gid: string }) {
  const w = p.x1 - p.x0;
  const h = p.y1 - p.y0;
  const base = BASE[p.form];
  const k = base ? Math.round((w / base[0]) * 100) / 100 : 1;
  const scaled = (node: ReactNode) => (k === 1 ? node : <g transform={`scale(${k})`}>{node}</g>);
  switch (p.form) {
    case 'oven':
      return <Oven w={w} h={h} gid={gid} />;
    case 'belt':
      return scaled(<Belt />);
    case 'sacks':
      return scaled(<Sacks />);
    case 'logs':
      return scaled(<Logs />);
    case 'shop':
      return scaled(<Shop gid={gid} />);
    case 'mill':
      return scaled(<Mill />);
    case 'wheat':
      return scaled(<Wheat />);
    case 'trees':
      return <Trees w={w} h={h} />;
    case 'grass':
      return <Grass w={w} h={h} />;
    default:
      return null;
  }
}

/** 院子在深色主題的填色：石色只取一半（再乘上 Plot 的不透明度），夜裡不會像一團灰霧 */
const YARD = `color-mix(in srgb, ${ROCK_DEEP} 50%, transparent)`;

export default function BakeryScene({ geo }: SceneProps) {
  const ids = useSceneIds();
  const plan = planBakery(geo);
  return (
    <>
      <SceneDefs ids={ids} />
      <TerrainRect id="plaza" r={{ x0: 0, y0: SEAM, x1: geo.bandW, y1: geo.h }} />
      {/* 頂端和上一章的交界：多頻起伏、依章節種子擺的凹口、兩側的散點與凹口尖端的物件（scene-seam 的 seamEdge，第 7、8 輪看圖驗收） */}
      <SeamEdgeArt edge={seamEdge(geo, plan, 'plaza', 9)} own={PLAZA} above={geo.seam?.fill ?? ''} />
      {/* 麥田：不描外框，麥稈條紋半透明（第 3 輪看圖驗收） */}
      {plan.fields.length > 0 && (
        <>
          <path data-terrain-block="wheat" d={plan.fields.map((f) => `M${f.map((p) => `${r1(p.x)} ${r1(p.y)}`).join('L')}Z`).join('')} fill={FIELD} />
          <path
            d={plan.rows}
            fill="none"
            stroke={GLOW}
            strokeWidth="6"
            strokeLinecap="round"
            opacity="0.5"
            style={{ stroke: 'light-dark(var(--ll-scene-glow), var(--ll-scene-wood))' }}
          />
        </>
      )}
      {plan.lanes.length > 0 && (
        <>
          <path data-terrain-block="lane" d={plan.lanes.map((l) => l.d).join('')} fill={SAND} />
          <path d={plan.lanes.map((l) => l.edges).join('')} fill="none" stroke={LINE} strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
        </>
      )}
      {/* 磚院子：涵蓋軌道與入口那一翼的一大塊地，淡淡一層 scene-rock-deep、磚縫（上下兩排錯開半塊）、清楚的 1.5px 外框；
          夜景不再整塊罩光，只有爐口一圈光暈（Oven 裡） */}
      <defs>
        <pattern id={`${ids.ripple}k`} width="24" height="20" patternUnits="userSpaceOnUse">
          <path d="M0 .5H24M0 10.5H24M8 1v9M20 11v9" fill="none" stroke={LINE} strokeWidth="1" opacity="0.36" />
        </pattern>
      </defs>
      {plan.yards.map((y) => (
        <Plot key={y.d} id="yard" d={y.d} fill={ROCK_DEEP} night={YARD} opacity={0.3} pattern={`${ids.ripple}k`} />
      ))}
      {[...plan.props].sort(byDepth).map((p) => (
        <Prop key={p.id} p={p}>
          <Art p={p} gid={ids.glow} />
        </Prop>
      ))}
    </>
  );
}
