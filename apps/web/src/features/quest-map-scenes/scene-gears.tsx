// 第 7 章「杜邦與績效指標」：齒輪工坊（圖規 6.4 的 C07）。底色是廣場（地圖組的 .qm-terrain），這一層畫地形塊與物件：
// - 木地板（第 4 輪看圖驗收）：涵蓋軌道與入口那一翼、章高 8% 到 80% 的一大塊不規則地（scene-kit 的 plotArea），板縫只畫在裡面，外框是清楚的 1.5px 線（手機也有）。
// - 有兩翼時：主角道具是入口那一翼地板上三個咬合的齒輪（純益率、週轉率、權益倍數一起轉出 ROE），前面是工作台、木箱與一盞燈，附近是木柴堆、手推車與木桶，地板下方一片小樹林。
//   另一翼是工坊小屋與高煙囪（夜裡窗子透光）、木箱堆與木桶，上下各一片小樹林。樹林底下的草地依樹的位置畫。
// - 手機與沒有兩翼的 medium：主角道具是兩個齒輪（72 × 56），放在節點交錯留下的空側；軌道裡最多再兩個小東西。
// 齒輪是輪齒外形加中空的軸孔，不畫成實心圓（6.4）。放置、著地與保護框交給 scene-kit 的 placeProps；這個檔只決定構圖與畫法。
import type { ReactNode } from 'react';
import type { Bp, Point, Rect, SceneGeo } from '../quest-map/layout.ts';
import { SEAM, inflate } from '../quest-map/layout.ts';
import type { SceneProps } from '../quest-map/scenes.tsx';
import {
  byDepth,
  dayNight,
  Glow,
  GLOW,
  Grass,
  grounded,
  LEAF,
  LINE,
  MEADOW,
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
  roughen,
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

/** 主角道具：有兩翼時是三個齒輪（依翼寬由大到小），沒有時是軌道裡的兩個齒輪。放下時還沒有地板（地板依齒輪的位置鋪），放好之後改成 floor */
const HERO: PropSpec = {
  id: 'gears',
  tier: 'hero',
  ground: ['plaza'],
  variants: [
    {
      w: 150,
      h: 110,
      bps: WIDE,
      form: 'gears3',
      anchors: [
        { wing: 'near', u: 0.3, v: 0.5 },
        { wing: 'near', u: 0.1, v: 0.55 },
        { wing: 'near', u: 0.5, v: 0.45 },
      ],
    },
    { w: 104, h: 80, bps: WIDE, form: 'gears3', anchors: [{ wing: 'near', u: 0.5, v: 0.5 }] },
    { w: 72, h: 56, form: 'gears2', anchors: NODE_SPOTS },
  ],
};

/** 固定畫法的物件原尺寸：放大的尺寸用 scale 畫（線寬跟著放大，最多 1.3 倍） */
const BASE: Readonly<Record<string, readonly [number, number]>> = {
  shed: [92, 84],
  chimney: [30, 118],
  stack: [64, 50],
  barrels: [40, 32],
  cart: [58, 34],
  bench: [68, 40],
  logs: [56, 30],
};
/** 依原尺寸與倍數產生由大到小的尺寸 */
const sizes = (form: string, ks: readonly number[]) => ks.map((k) => [r1(BASE[form]![0] * k), r1(BASE[form]![1] * k)] as const);

/** 工坊的木地板：涵蓋軌道與入口那一翼的一大塊地（scene-kit 的 plotArea）；板縫與接縫是 pattern */
export interface Floor {
  readonly d: string;
  readonly poly: readonly Point[];
}

export interface GearsPlan {
  readonly blocks: readonly TerrainBlock[];
  readonly floors: readonly Floor[];
  /** 樹林底下的草地（地形塊 lawn，畫成一個 path） */
  readonly lawns: readonly (readonly Point[])[];
  /** 碎石小路（地形塊 lane） */
  readonly lanes: readonly Lane[];
  readonly props: readonly Placed[];
}

export interface Lane {
  readonly poly: readonly Point[];
  readonly d: string;
  /** 兩側的路緣線 */
  readonly edges: string;
}

const polyD = (poly: readonly Point[]) => `M${poly.map((p) => `${r1(p.x)} ${r1(p.y)}`).join('L')}Z`;

/** 樹林底下的草地：以物件底線為中心的橢圓（加一點起伏），底線與底線往上 30% 的那一排都在裡面 */
function lawnUnder(p: Rect, seed: string): Point[] {
  const w = p.x1 - p.x0;
  const h = p.y1 - p.y0;
  const cx = (p.x0 + p.x1) / 2;
  const cy = p.y1 - 0.15 * h;
  const rx = 0.66 * w + 10;
  const ry = 0.34 * h + 9;
  const pts = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  });
  return smoothClosed(roughen(pts, seed, 7)).poly;
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
  return { poly, d: polyD(poly), edges: edge(L) + edge(R) };
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

/** 構圖（純函式，測試也用）：先放齒輪，依它鋪出工坊的木地板（齒輪在後方，前面是工作台與木箱），再放次要道具，最後在樹林底下畫草地 */
export function planGears(input: SceneGeo): GearsPlan {
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
  // 木地板（第 4 輪看圖驗收：原本只在齒輪底下鋪一塊羽化邊的圓角方）：涵蓋軌道與入口那一翼、章高 8% 到 80% 的一大塊地，下方留給樹林
  const plot = plotArea(input, 'gears floor', 0.08, 0.8);
  const deck: Floor = plot;
  const floorBlock: TerrainBlock = { id: 'floor', poly: plot.poly };

  const spots = (vs: readonly number[], us: readonly number[]): Anchor[] => vs.flatMap((v) => us.map((u) => ({ track: true as const, u, v })));
  const grassTrack: PropSpec = {
    id: 'grass-track',
    tier: 'minor',
    ground: ['plaza'],
    variants: [{ w: 28, h: 18, form: 'grass', anchors: spots([0.72, 0.56, 0.4], [0.3, 0.7, 0.5]) }],
  };
  if (!placed || placed.form !== 'gears3') {
    const track: PropSpec[] = [
      {
        id: 'crate-track',
        tier: 'minor',
        ground: ['plaza'],
        variants: [{ w: 30, h: 26, form: 'crate', anchors: spots([0.38, 0.52, 0.66], [0.5, 0.42, 0.58]) }],
      },
      grassTrack,
    ];
    const rest = placeProps(track, geo, { blocks: [plaza], taken: placed ? [placed] : [] });
    return { blocks: [plaza, floorBlock], floors: [deck], lawns: [], lanes: [], props: placed ? [placed, ...rest] : rest };
  }

  // 平台上的東西以齒輪為準：工作台與木箱在前方（齒輪往下 70px）、燈在內側
  const span = wingSpan(near, geo)!;
  const fy0 = Math.max(SEAM + 8, placed.y0 - 22);
  const fy1 = Math.min(h - 16, placed.y1 + 96);
  const hero: Placed = { ...placed, ground: grounded(placed, ['floor'], [floorBlock]) ? ['floor'] : ['plaza'] };

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
  // 平台上的位置：以平台在翼裡的範圍換算 u
  const depth = Math.abs(span.inner - span.outer);
  const uOf = (x: number, w: number) => {
    const dist = near === 'left' ? geo.track.left - x : x - geo.track.right;
    return Math.min(1, Math.max(0, (dist - WING_GAP - w / 2) / Math.max(1, depth - w)));
  };
  const toIn = near === 'left' ? 1 : -1;
  const xIn = near === 'left' ? hero.x1 : hero.x0;
  const xOut = near === 'left' ? hero.x0 : hero.x1;
  const vFront = (hero.y1 + 70) / h;
  const vH = hero.y1 / h;
  const vAbove = (fy0 - 26) / h;
  const vBelow = (fy1 + 108) / h;
  // 平台上：工作台（前方外側）、木箱（前方內側）、平台內側的燈，同一組
  const deckItems = placeProps(
    [
      on(
        'bench',
        'bench',
        'near',
        ['floor'],
        sizes('bench', [1.2, 1]),
        [
          [uOf(xOut + toIn * 44, 82), vFront + 0.01],
          [uOf(xOut + toIn * 56, 68), vFront + 0.02],
          [uOf((xIn + xOut) / 2, 68), vFront],
        ],
        'deck',
      ),
      on(
        'crates',
        'crates',
        'near',
        ['floor'],
        [
          [52, 46],
          [46, 40],
        ],
        [
          [uOf(xIn - toIn * 30, 52), vFront + 0.01],
          [uOf(xIn - toIn * 40, 46), vFront - 0.02],
        ],
        'deck',
      ),
      on(
        'lamp',
        'lamp',
        'near',
        ['floor'],
        [[14, 40]],
        [
          [uOf(xIn + toIn * 10, 14), vH + 0.03],
          [uOf(xIn + toIn * 10, 14), vH + 0.1],
          [uOf(xIn + toIn * 10, 14), vH - 0.04],
        ],
        'deck',
      ),
    ],
    geo,
    { blocks: [plaza, floorBlock], taken: [hero] },
  );
  const blocks: TerrainBlock[] = [plaza, floorBlock];
  const grove = (id: string, wing: 'near' | 'far', spots2: readonly (readonly [number, number])[]) =>
    on(
      id,
      'trees',
      wing,
      ['plaza', '!floor', '!lane'],
      [
        [132, 64],
        [100, 54],
        [72, 46],
      ],
      spots2,
    );
  const offFloor = ['plaza', '!floor', '!lane'];
  /** 木柴、手推車與木桶可以放在地板上 */
  const anyGround = ['plaza', '!lane'];
  // 第一步：另一翼的工坊小屋與高煙囪（小路依小屋的門畫）
  const buildings = placeProps(
    [
      on('shed', 'shed', 'far', ['plaza'], sizes('shed', [1.3, 1.1, 1]), [
        [0.2, 0.5],
        [0.05, 0.5],
        [0.4, 0.49],
      ]),
      on(
        'chimney',
        'chimney',
        'far',
        ['plaza'],
        sizes('chimney', [1.2, 1]),
        [
          [0.95, 0.49],
          [1, 0.45],
          [0.75, 0.47],
        ],
        'shed',
      ),
    ],
    geo,
    { blocks, taken: [hero, ...deckItems] },
  );
  const shed = buildings.find((p) => p.id === 'shed');
  const far = near === 'left' ? 'right' : 'left';
  const sx = (side: 'left' | 'right', d: number) => (side === 'left' ? geo.track.left - d : geo.track.right + d);
  const edge = (side: 'left' | 'right') => (side === 'left' ? geo.track.left : geo.bandW - geo.track.right) + 30;
  const lanes: Lane[] = [];
  if (shed)
    lanes.push(
      lane(
        [
          { x: sx(far, edge(far)), y: 0.86 * h },
          { x: sx(far, Math.min(edge(far), 440) * 0.6), y: 0.66 * h },
          { x: (shed.x0 + shed.x1) / 2, y: shed.y1 + 13 },
          { x: sx(far, edge(far)), y: 0.34 * h },
        ],
        9,
        geo.bandW,
      ),
    );
  // 平台外側的出口：一條小路從平台邊往外緣
  // 從地板外緣（小路起點那一列）往外 2px 起筆：地板是半透明的，小路不伸進地板底下；地板外緣離畫面邊還有 120px 以上（超寬螢幕）才有這條路
  const dx = rimX(deck.poly, fy1 - 30, near) - toIn * 2;
  if (near === 'left' ? dx > 120 : geo.bandW - dx > 120)
    lanes.push(
      lane(
        [
          { x: dx, y: fy1 - 30 },
          { x: dx + (sx(near, edge(near)) - dx) * 0.45, y: fy1 + 6 },
          { x: sx(near, edge(near)), y: fy1 + 40 },
        ],
        9,
        geo.bandW,
      ),
    );
  const all: TerrainBlock[] = [...blocks, ...lanes.map((l) => ({ id: 'lane', poly: l.poly }))];
  const minor: PropSpec[] = [
    // 平台上方：小樹林與木柴堆；下方：手推車與木桶
    grove('grove-near', 'near', [
      [0.5, vAbove],
      [0.25, vAbove],
      [0.7, vAbove - 0.04],
      [0.4, vBelow + 0.08],
    ]),
    on(
      'logs',
      'logs',
      'near',
      anyGround,
      sizes('logs', [1.15, 1]),
      [
        [0, vAbove],
        [1, vAbove],
        [0.1, vAbove - 0.08],
      ],
      'grove-near',
    ),
    on('cart', 'cart', 'near', anyGround, sizes('cart', [1.25, 1]), [
      [0.55, vBelow],
      [0.3, vBelow + 0.02],
      [0.75, vBelow - 0.02],
    ]),
    grove('grove-near2', 'near', [
      [0.3, 0.95],
      [0.6, 0.94],
      [0.1, 0.93],
    ]),
    on(
      'barrels-near',
      'barrels',
      'near',
      anyGround,
      sizes('barrels', [1.2, 1]),
      [
        [0.05, vBelow],
        [1, vBelow + 0.03],
        [0.15, vBelow + 0.08],
      ],
      'cart',
    ),
    // 另一翼：上方小樹林；木箱堆與木桶；下方小樹林（工坊小屋與高煙囪先放好了）
    grove('grove-far', 'far', [
      [0.45, 0.24],
      [0.7, 0.22],
      [0.2, 0.25],
    ]),
    on('stack', 'stack', 'far', offFloor, sizes('stack', [1.25, 1]), [
      [0.55, 0.69],
      [0.8, 0.68],
      [0.25, 0.68],
    ]),
    on(
      'barrels-far',
      'barrels',
      'far',
      offFloor,
      sizes('barrels', [1.2, 1]),
      [
        [0.1, 0.7],
        [1, 0.71],
        [0.3, 0.74],
      ],
      'stack',
    ),
    grove('grove-far2', 'far', [
      [0.3, 0.93],
      [0.6, 0.94],
      [0.1, 0.92],
    ]),
  ];
  const props = [hero, ...deckItems, ...buildings, ...placeProps(minor, geo, { blocks: all, taken: [hero, ...deckItems, ...buildings] })];
  // 樹林底下的草地：碰到木地板、小路或伸進軌道的不畫（樹就直接站在廣場上）
  const lawns: Point[][] = [];
  const out = props.map((p) => {
    if (p.form !== 'trees') return p;
    const poly = lawnUnder(p, `gears-${p.id}`);
    if (poly.some((q) => pointInPoly(q, deck.poly) || lanes.some((l) => pointInPoly(q, l.poly)) || (q.x > geo.track.left - 6 && q.x < geo.track.right + 6)))
      return p;
    lawns.push(poly);
    return { ...p, ground: ['lawn'] };
  });
  return { blocks: [...all, ...lawns.map((poly) => ({ id: 'lawn', poly }))], floors: [deck], lawns, lanes, props: out };
}

// ---------------------------------------------------------------------------------------------
// 畫法（框內座標，往左是外側）

/** 齒輪外形加軸孔（evenodd 挖空）：teeth 個梯形齒，齒深是半徑的 20% */
function gear(cx: number, cy: number, r: number, teeth: number, phase = 0): string {
  const inner = r * 0.8;
  const step = (Math.PI * 2) / teeth;
  const pts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = phase + i * step;
    for (const [da, rr] of [
      [-0.3, inner],
      [-0.16, r],
      [0.16, r],
      [0.3, inner],
    ] as const)
      pts.push(`${r1(cx + rr * Math.cos(a + da * step))} ${r1(cy + rr * Math.sin(a + da * step))}`);
  }
  const hole = r * 0.28;
  return `M${pts.join('L')}ZM${r1(cx + hole)} ${r1(cy)}a${r1(hole)} ${r1(hole)} 0 1 0 ${r1(-2 * hole)} 0a${r1(hole)} ${r1(hole)} 0 1 0 ${r1(2 * hole)} 0Z`;
}

/** 三個咬合的齒輪（w × h，依 150 × 110 縮放）：大齒輪靠外側，中、小齒輪往內側咬合；木架、底座與每個齒輪的內圈 */
function Gears3({ w, h }: { w: number; h: number }) {
  const k = Math.min(w / 150, h / 110);
  const G = [
    { x: 48, y: 52, r: 36, t: 12, fill: WOOD, p: 0 },
    { x: 100, y: 70, r: 24, t: 9, fill: GLOW, p: 0.2 },
    { x: 122, y: 32, r: 17, t: 7, fill: ROOF, p: 0.1 },
  ].map((g) => ({ ...g, x: g.x * k, y: g.y * k, r: g.r * k }));
  const base = h - 1;
  return (
    <>
      {/* 木架：兩根立柱、一條橫梁與底座 */}
      <path
        d={`M${r1(10 * k)} ${base}V${r1(24 * k)}M${r1(140 * k)} ${base}V${r1(14 * k)}M${r1(6 * k)} ${r1(20 * k)}H${r1(144 * k)}`}
        stroke={LINE}
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path d={`M${r1(2 * k)} ${base}V${r1(base - 9 * k)}H${r1(148 * k)}V${base}Z`} fill={WOOD} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      {G.map((g) => (
        <path key={g.x} d={gear(g.x, g.y, g.r, g.t, g.p)} fill={g.fill} fillRule="evenodd" stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      ))}
      {/* 內圈 */}
      <path
        d={G.map(
          (g) =>
            `M${r1(g.x + g.r * 0.58)} ${r1(g.y)}a${r1(g.r * 0.58)} ${r1(g.r * 0.58)} 0 1 0 ${r1(-1.16 * g.r)} 0a${r1(g.r * 0.58)} ${r1(g.r * 0.58)} 0 1 0 ${r1(1.16 * g.r)} 0`,
        ).join('')}
        fill="none"
        stroke={LINE}
        strokeWidth="1.2"
        opacity="0.6"
      />
    </>
  );
}

/** 兩個咬合的齒輪 72 × 56（手機） */
function Gears2() {
  return (
    <>
      <path d="M4 55h64" stroke={LINE} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <path d={gear(24, 30, 22, 10)} fill={WOOD} fillRule="evenodd" stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d={gear(54, 38, 15, 8, 0.2)} fill={GLOW} fillRule="evenodd" stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
    </>
  );
}

/** 工作台 68 × 40：桌面、桌腳、虎鉗，桌上一支槌子與一把鋸子 */
function Bench() {
  return (
    <>
      <path d="M6 39V22M62 39V22M6 32h56" stroke={LINE} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M2 16h64v7H2ZM50 16V8h8v8M24 16l4-9h3l-3 9" fill={WOOD} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 13h12l-2-3H8ZM34 14l10-6" fill={ROCK_DEEP} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
    </>
  );
}

/** 木箱 w × h（兩個並排、上面疊一個）：箱身與板縫 */
function Crates({ w, h }: { w: number; h: number }) {
  const s = h / 2;
  return (
    <>
      <path
        d={`M1 ${h - 1}V${s}h${r1(w * 0.56)}v${s - 1}ZM${r1(w * 0.42)} ${h - 1}V${r1(s + 4)}h${r1(w * 0.56)}V${h - 1}ZM${r1(w * 0.18)} ${s}V2h${r1(w * 0.5)}v${s - 2}`}
        fill={WOOD}
        stroke={LINE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d={`M4 ${r1(s * 1.5)}h${r1(w * 0.5)}M${r1(w * 0.45)} ${r1(s * 1.5 + 2)}h${r1(w * 0.5)}M${r1(w * 0.21)} ${r1(s / 2 + 1)}h${r1(w * 0.44)}`}
        stroke={LINE}
        strokeWidth="1.2"
        opacity="0.6"
      />
    </>
  );
}

/** 一個木箱 30 × 26（軌道裡） */
function Crate() {
  return <path d="M2 25V4h26v21ZM2 14h26M8 4v21" fill={WOOD} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />;
}

/** 木箱堆 64 × 50：底下兩個、上面一個 */
function Stack() {
  return (
    <>
      <path d="M1 49V27h30v22ZM33 49V27h30v22ZM16 27V5h30v22ZM4 38h24M36 38h24M19 16h24" fill={WOOD} stroke={LINE} strokeWidth="1.4" strokeLinejoin="round" />
    </>
  );
}

/** 兩個木桶 40 × 32 */
function Barrels() {
  return (
    <>
      <path
        d="M3 31q-3-14 0-28h14q3 14 0 28ZM23 31q-3-11 0-22h14q3 11 0 22ZM2 10h16M2 24h16M22 15h16M22 25h16"
        fill={WOOD}
        stroke={LINE}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </>
  );
}

/** 工坊小屋 92 × 84：小煙囪與兩縷煙（線條）、屋身、屋頂、兩扇窗與門（scene-glow，夜裡有光暈） */
function Shed({ gid }: { gid: string }) {
  return (
    <>
      <path d="M68 30V12h12v16" fill={ROCK_DEEP} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M72 8q-4-4 0-7M78 9q3-4 0-8" fill="none" stroke={LINE} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path d="M8 83V44h76v39Z" {...dayNight(PAPER, ROCK_DEEP)} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M2 46 24 22h48l18 24Z" fill={ROOF} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M18 52h22v14H18ZM29 52v14M54 83V58h18v25" fill={GLOW} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
      <g opacity="0.5">
        <Glow x={29} y={59} r={34} gid={gid} />
      </g>
    </>
  );
}

/** 木柴堆 56 × 30：疊起來的圓木（端面是小圓） */
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

/** 高煙囪 30 × 118：磚砌的煙囪、頂端的帽緣、兩縷煙（線條） */
function Chimney() {
  return (
    <>
      <path d="M8 117 10 40h12l2 77ZM6 40h20v-6H6Z" fill={ROOF} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 60h12M9 80h14M9 100h14M16 60v20M12 80v20M20 80v20" stroke={LINE} strokeWidth="1.2" opacity="0.5" />
      <path d="M14 29q-5-6 0-11t0-12M20 28q5-5 1-10" fill="none" stroke={LINE} strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
    </>
  );
}

/** 手推車 58 × 34：車斗、把手、輪子（輪框，不是實心圓） */
function Cart() {
  return (
    <>
      <path d="M4 8h36l-4 16H8ZM40 10l16-6" fill={WOOD} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M30 26a6 6 0 1 0 0 .1M14 26a6 6 0 1 0 0 .1M12 8V2h8v6M22 8V4h8v4" fill="none" stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
    </>
  );
}

/** 小樹林 w × h：一團有起伏的樹冠（每棵樹一個圓頂，後排的高一點），底下露出樹幹；樹冠與樹幹各一個 path，不會互相蓋出多餘的線 */
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

/** 路燈 14 × h：燈罩與燈柱合成一個 path（scene-glow 填色、scene-line 描邊），夜裡以燈罩為中心一圈 r 40 的光暈（中心不透明度 0.35） */
function Lamp({ h, gid }: { h: number; gid: string }) {
  return (
    <>
      <g opacity="0.5">
        <Glow x={7} y={8} r={40} gid={gid} />
      </g>
      <path d={`M3 3h8v10H3ZM6 13h2V${h - 3}h2.5v2h-7v-2H6Z`} fill={GLOW} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
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
    case 'gears3':
      return <Gears3 w={w} h={h} />;
    case 'gears2':
      return <Gears2 />;
    case 'bench':
      return scaled(<Bench />);
    case 'crates':
      return <Crates w={w} h={h} />;
    case 'crate':
      return <Crate />;
    case 'stack':
      return scaled(<Stack />);
    case 'barrels':
      return scaled(<Barrels />);
    case 'shed':
      return scaled(<Shed gid={gid} />);
    case 'lamp':
      return <Lamp h={h} gid={gid} />;
    case 'logs':
      return scaled(<Logs />);
    case 'chimney':
      return scaled(<Chimney />);
    case 'cart':
      return scaled(<Cart />);
    case 'trees':
      return <Trees w={w} h={h} />;
    case 'grass':
      return <Grass w={w} h={h} />;
    default:
      return null;
  }
}

/** 地板在深色主題的填色：木色只取一半（再乘上 Plot 的不透明度），夜裡不會像一團橘褐色的霧 */
const FLOOR = `color-mix(in srgb, ${WOOD} 55%, transparent)`;

export default function GearsScene({ geo }: SceneProps) {
  const ids = useSceneIds();
  const plan = planGears(geo);
  return (
    <>
      <SceneDefs ids={ids} />
      <TerrainRect id="plaza" r={{ x0: 0, y0: SEAM, x1: geo.bandW, y1: geo.h }} />
      {/* 頂端和上一章的交界：多頻起伏、依章節種子擺的凹口、兩側的散點與凹口尖端的物件（scene-seam 的 seamEdge，第 7、8 輪看圖驗收） */}
      <SeamEdgeArt edge={seamEdge(geo, plan, 'plaza', 7)} own={PLAZA} above={geo.seam?.fill ?? ''} />
      {plan.lawns.length > 0 && (
        <path data-terrain-block="lawn" d={plan.lawns.map(polyD).join('')} fill={MEADOW} stroke={LINE} strokeWidth="1.5" strokeOpacity="0.3" />
      )}
      {plan.lanes.length > 0 && (
        <>
          <path data-terrain-block="lane" d={plan.lanes.map((l) => l.d).join('')} fill={SAND} />
          <path d={plan.lanes.map((l) => l.edges).join('')} fill="none" stroke={LINE} strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
        </>
      )}
      {/* 工坊地板：涵蓋軌道與入口那一翼的一大塊地，scene-wood 淡淡一層（深色主題再淡一半）、木板縫與錯開的接縫、清楚的 1.5px 外框；
          夜景只有燈與小屋窗子各自一圈光暈 */}
      <defs>
        <pattern id={`${ids.ripple}k`} width="110" height="24" patternUnits="userSpaceOnUse">
          <path d="M0 .5H110M0 12.5H110M34 1v11M89 13v11" fill="none" stroke={LINE} strokeWidth="1" opacity="0.4" />
        </pattern>
      </defs>
      {plan.floors.map((f) => (
        <Plot key={f.d} id="floor" d={f.d} fill={WOOD} night={FLOOR} opacity={0.34} pattern={`${ids.ripple}k`} />
      ))}
      {[...plan.props].sort(byDepth).map((p) => (
        <Prop key={p.id} p={p}>
          <Art p={p} gid={ids.glow} />
        </Prop>
      ))}
    </>
  );
}
