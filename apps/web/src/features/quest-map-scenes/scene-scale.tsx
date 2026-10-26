// 第 4 章「資產負債表」：天平廣場（圖規 6.4 的 C04）。底色是岩地（地圖組的 .qm-terrain），這一層畫方磚地（地形塊）與物件：
// - medium 以上：入口那一翼（入口在右，near 是右翼）的主角道具是一座大天平，左盤一個大箱子、右盤兩個疊起來的箱子，橫樑水平（兩邊相等，不寫字）；
//   兩翼另有噴水池（側面看的水盆，兩道往外彎的水與三顆水滴，不是圓形色塊）、長椅、路燈、木箱、花台與樹籬。
// - 方磚地（第 4 輪看圖驗收）：涵蓋軌道與入口那一翼、章高約 78% 的一大塊不規則地（scene-kit 的 plotArea），格線只畫在裡面，外框是清楚的 1.5px 線。
// - 手機與沒有兩翼的 medium：主角道具是小一號的天平（88 × 80，放不下時 72 × 64 或 64 × 58），放在節點空側；軌道裡另外最多兩個小東西（木箱、長椅）。
// 夜景：路燈與天平頂的小燈（深色主題才有光暈）。
import type { Bp, SceneGeo } from '../quest-map/layout.ts';
import { SEAM } from '../quest-map/layout.ts';
import type { SceneProps } from '../quest-map/scenes.tsx';
import {
  byDepth,
  FOAM,
  Glow,
  GLOW,
  Lamps,
  LEAF,
  LINE,
  placeProps,
  Plot,
  plotArea,
  Prop,
  rectPoly,
  ROCK,
  ROCK_DEEP,
  ROOF,
  SceneDefs,
  SEA,
  shadeStroke,
  TerrainRect,
  useSceneIds,
  WOOD,
  type Anchor,
  type Placed,
  type PropSpec,
  type TerrainBlock,
} from './scene-kit.tsx';
import { SeamEdgeArt, seamEdge } from './scene-seam.tsx';

export const geoAware = true;

const WIDE: readonly Bp[] = ['medium', 'expanded'];

const HERO: PropSpec = {
  id: 'scale',
  tier: 'hero',
  ground: ['rock'],
  variants: [
    {
      w: 140,
      h: 128,
      bps: WIDE,
      form: 'scale',
      anchors: [
        { wing: 'near', u: 0.3, v: 0.56 },
        { wing: 'near', u: 0.1, v: 0.48 },
        { wing: 'near', u: 0.5, v: 0.66 },
      ],
    },
    { w: 108, h: 100, bps: WIDE, form: 'scale', anchors: [{ wing: 'near', u: 0, v: 0.56 }] },
    // 手機，或 medium 窄到沒有兩翼：小一號的天平放在節點的空側。這一章是 zigzag，手機的軌道裡沒有 88 × 80 的空位，依序退到 72 × 64、64 × 58
    ...(
      [
        [88, 80],
        [72, 64],
        [64, 58],
      ] as const
    ).map(([w, h]) => ({
      w,
      h,
      form: 'scale',
      anchors: [{ node: 2 }, { node: 1 }, { node: 0 }, { node: 3 }, { node: 2, dv: -16 }, { node: 1, dv: 16 }],
    })),
  ],
};

const spots = (vs: readonly number[], us: readonly number[]): Anchor[] => vs.flatMap((v) => us.map((u) => ({ track: true as const, u, v })));
const wingAt = (wing: 'near' | 'far', list: readonly (readonly [number, number])[]): Anchor[] => list.map(([u, v]) => ({ wing, u, v }));
const minor = (id: string, form: string, w: number, h: number, anchors: Anchor[], extra: Partial<PropSpec> = {}): PropSpec => ({
  id,
  tier: 'minor',
  ground: ['rock'],
  ...extra,
  variants: [{ w, h, form, anchors }],
});

const MINOR: readonly PropSpec[] = [
  // 天平兩側的路燈（和天平同一組，不另佔名額；位置在 planScale 裡依天平的框算）
  minor('lamps-near', 'lamp', 20, 72, [], { group: 'scale' }),
  minor(
    'crates-near',
    'crates',
    52,
    40,
    wingAt('near', [
      [0.85, 0.3],
      [0.45, 0.26],
      [0.15, 0.32],
    ]),
  ),
  minor(
    'bench-near',
    'benchlamp',
    92,
    72,
    wingAt('near', [
      [0.35, 0.87],
      [0.7, 0.9],
      [0.1, 0.83],
    ]),
  ),
  minor(
    'planter-near',
    'planter',
    48,
    48,
    wingAt('near', [
      [0.75, 0.7],
      [0.2, 0.72],
      [0.5, 0.36],
    ]),
  ),
  minor(
    'hedge-near',
    'hedge',
    120,
    30,
    wingAt('near', [
      [0.4, 0.13],
      [0.1, 0.16],
      [0.8, 0.12],
    ]),
  ),
  minor(
    'fountain-far',
    'fountain',
    120,
    82,
    wingAt('far', [
      [0.35, 0.5],
      [0.6, 0.44],
      [0.1, 0.56],
    ]),
  ),
  minor(
    'bench-far',
    'benchlamp',
    92,
    72,
    wingAt('far', [
      [0.3, 0.72],
      [0.65, 0.74],
      [0.85, 0.68],
    ]),
  ),
  minor(
    'crates-far',
    'crates',
    52,
    40,
    wingAt('far', [
      [0.5, 0.93],
      [0.15, 0.9],
      [0.8, 0.95],
    ]),
  ),
  minor(
    'planter-far',
    'planter',
    48,
    48,
    wingAt('far', [
      [0.4, 0.14],
      [0.75, 0.12],
      [0.1, 0.18],
    ]),
  ),
  minor(
    'hedge-far',
    'hedge',
    104,
    28,
    wingAt('far', [
      [0.65, 0.84],
      [0.2, 0.8],
    ]),
  ),
  // 手機的軌道裡：木箱、長椅（最多兩個，放不下就不畫；有兩翼時軌道已經夠擠，不放）
  {
    id: 'crates-track',
    tier: 'minor',
    ground: ['rock'],
    variants: [{ w: 40, h: 30, bps: ['compact'], form: 'crates', anchors: spots([0.62, 0.4, 0.5, 0.72], [0.5, 0.3, 0.7, 0.2, 0.8]) }],
  },
  {
    id: 'bench-track',
    tier: 'minor',
    ground: ['rock'],
    variants: [{ w: 48, h: 26, bps: ['compact'], form: 'bench', anchors: spots([0.33, 0.45, 0.58], [0.5, 0.35, 0.65]) }],
  },
];

export interface ScalePlan {
  readonly blocks: readonly TerrainBlock[];
  /** 方磚地：涵蓋軌道與入口那一翼的一大塊地（scene-kit 的 plotArea，一個 path） */
  readonly tiles: readonly string[];
  readonly props: readonly Placed[];
}

/** 構圖（純函式，測試也用）：主角道具 → 天平兩側的路燈 → 次要道具；方磚地是涵蓋軌道與入口那一翼的一大塊地 */
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

export function planScale(input: SceneGeo): ScalePlan {
  const geo = strict(input);
  const rock: TerrainBlock = { id: 'rock', poly: rectPoly({ x0: 0, y0: SEAM, x1: geo.bandW, y1: geo.h }) };
  const blocks = [rock];
  const [hero] = placeProps([HERO], geo, { blocks });
  const taken = hero ? [hero] : [];
  // 有兩翼時，天平兩側各一盞路燈（貼著天平的框，放不下就只放一盞或不放）
  const lamps: Placed[] = [];
  if (hero && hero.region !== 'track') {
    const side = hero.region;
    const spec = MINOR[0]!;
    for (const [k, x0] of [
      [0, hero.x0 - 30],
      [1, hero.x1 + 10],
    ] as const) {
      const placed = placeProps(
        [
          {
            ...spec,
            id: `lamp-scale-${k}`,
            variants: [{ ...spec.variants[0]!, anchors: [{ wing: side, u: uOf(geo, side, x0, 20), v: (hero.y1 - 4) / geo.h }] }],
          },
        ],
        geo,
        { blocks, taken: [...taken, ...lamps] },
      );
      lamps.push(...placed);
    }
  }
  const rest = placeProps(MINOR.slice(1), geo, { blocks, taken: [...taken, ...lamps] });
  const props = [...taken, ...lamps, ...rest];
  const tiles = plotArea(input, 'scale tiles');
  return { blocks: [...blocks, { id: 'tiles', poly: tiles.poly }], tiles: [tiles.d], props };
}

/** 翼裡左緣在 x0、寬 w 的物件換算成候選位置的 u */
function uOf(geo: SceneGeo, side: 'left' | 'right', x0: number, w: number): number {
  const wing = side === 'left' ? geo.wings.left : geo.wings.right;
  if (!wing) return 0;
  const inner = side === 'left' ? geo.track.left - 24 : geo.track.right + 24;
  const outer = side === 'left' ? Math.max(wing.x0 + (wing.x0 > 0 ? 0 : 8), geo.track.left - 400) : Math.min(geo.bandW - 8, geo.track.right + 400);
  const depth = Math.abs(inner - outer);
  const off = side === 'left' ? inner - (x0 + w) : x0 - inner;
  return Math.min(1, Math.max(0, off / Math.max(1, depth - w)));
}

// ---------------------------------------------------------------------------------------------
// 畫法（往左是外側；右翼會水平翻轉）

/** 天平 w × h：底座、柱子、水平的橫樑（木頭一個 path）、吊繩、兩個秤盤；左盤一個大箱子（sea），右盤兩個疊起來的箱子（roof、leaf）；柱頂一盞小燈 */
function Scale({ w, h, gid }: { w: number; h: number; gid: string }) {
  const s = w / 140;
  const cx = w / 2;
  const beamY = 16 * s + 6;
  const armL = 18 * s;
  const armR = w - 18 * s;
  const panY = h * 0.68;
  const panW = 44 * s;
  const wood = [
    `M${cx - 26 * s} ${h - 1}L${cx - 17 * s} ${h - 12 * s}H${cx + 17 * s}L${cx + 26 * s} ${h - 1}Z`,
    `M${cx - 4 * s} ${h - 12 * s}V${beamY + 3}h${8 * s}V${h - 12 * s}Z`,
    `M${8 * s} ${beamY - 3}H${w - 8 * s}a3 3 0 0 1 0 6H${8 * s}a3 3 0 0 1 0-6Z`,
  ].join('');
  const strings = [armL, armR].map((x) => `M${x} ${beamY + 3}L${x - panW / 2 + 3} ${panY}M${x} ${beamY + 3}L${x + panW / 2 - 3} ${panY}`).join('');
  const pans = [armL, armR].map((x) => `M${x - panW / 2} ${panY}h${panW}q-4 ${9 * s}-${panW / 2} ${9 * s}t-${panW / 2}-${9 * s}Z`).join('');
  const bw = 30 * s;
  const big = `M${armL - bw / 2} ${panY}v${-26 * s}h${bw}v${26 * s}Z`;
  const low = `M${armR - bw / 2} ${panY}v${-13 * s}h${bw}v${13 * s}Z`;
  const high = `M${armR - bw / 2} ${panY - 13 * s}v${-13 * s}h${bw}v${13 * s}Z`;
  return (
    <>
      <Glow x={cx} y={beamY - 8} r={20} gid={gid} />
      <path d={strings} fill="none" stroke={LINE} strokeWidth="1.3" />
      <path d={wood} fill={WOOD} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d={pans} fill={ROCK_DEEP} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d={big} fill={SEA} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d={low} fill={ROOF} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d={high} fill={LEAF} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d={`M${cx - 4} ${beamY - 4}a4 4 0 1 1 8 0a4 4 0 1 1-8 0`} fill={GLOW} stroke={LINE} strokeWidth="1.2" />
    </>
  );
}

/** 噴水池 w × h（側面）：寬的八角下層水盆（上緣看得到一圈水面）、中間的柱子與上層小盆、從小盆兩側落進下層的水、頂上一小柱噴水 */
function Fountain({ w, h }: { w: number; h: number }) {
  const rim = h * 0.62;
  const bowl = h * 0.3;
  return (
    <>
      <path
        d={`M${w * 0.06} ${rim}H${w * 0.94}l-${w * 0.05} ${h - 2 - rim}H${w * 0.11}ZM${w * 0.46} ${rim}V${bowl + h * 0.08}h${w * 0.08}V${rim}ZM${w * 0.3} ${bowl}h${w * 0.4}l-${w * 0.06} ${h * 0.09}H${w * 0.36}Z`}
        fill={ROCK_DEEP}
        stroke={LINE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d={`M${w * 0.1} ${rim}q${w * 0.4}-${h * 0.1} ${w * 0.8} 0q-${w * 0.4} ${h * 0.06}-${w * 0.8} 0Z`} fill={SEA} stroke={LINE} strokeWidth="1.2" />
      {/* 水：上盆兩側各一道往外彎落進下盆的弧，上盆正上方三顆水滴（第 4 輪看圖驗收：原本中間一根直的水柱加一個弧頂，看起來像「上傳」箭頭） */}
      <path
        d={`M${w * 0.31} ${bowl + 1}q-${w * 0.08} ${h * 0.04}-${w * 0.1} ${rim - bowl - h * 0.06}M${w * 0.69} ${bowl + 1}q${w * 0.08} ${h * 0.04} ${w * 0.1} ${rim - bowl - h * 0.06}`}
        fill="none"
        stroke={FOAM}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d={[
          [0.42, bowl - h * 0.1],
          [0.5, bowl - h * 0.2],
          [0.58, bowl - h * 0.1],
        ]
          .map(([x, y]) => `M${w * x!} ${y! - 3.5}q2.6 3.6 0 5.4q-2.6-1.8 0-5.4Z`)
          .join('')}
        fill={FOAM}
        stroke={LINE}
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </>
  );
}

/** 長椅加一盞路燈 w × h（往左是外側）：路燈在外側、長椅在內側 */
function BenchLamp({ w, h, gid }: { w: number; h: number; gid: string }) {
  const bw = w - 26;
  return (
    <>
      <Lamps at={[{ x: 9, y: h - 1, h: h - 12 }]} gid={gid} />
      <g transform={`translate(24 ${h - 32})`}>
        <Bench w={bw} h={32} />
      </g>
    </>
  );
}

/** 長椅 w × h（側面）：椅面、椅背、兩對椅腳 */
function Bench({ w, h }: { w: number; h: number }) {
  return (
    <path
      d={`M3 ${h * 0.55}h${w - 6}v${h * 0.14}H3ZM5 ${h * 0.2}h${w - 10}v${h * 0.14}H5ZM8 ${h * 0.69}V${h - 1}M${w - 8} ${h * 0.69}V${h - 1}M10 ${h * 0.34}v${h * 0.21}M${w - 10} ${h * 0.34}v${h * 0.21}`}
      fill={WOOD}
      stroke={LINE}
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
}

/** 疊起來的木箱 w × h */
function Crates({ w, h }: { w: number; h: number }) {
  const a = w / 2 - 1;
  return (
    <path
      d={`M2 ${h - 1}V${h * 0.5}h${a}V${h - 1}ZM${a + 2} ${h - 1}V${h * 0.62}h${a}V${h - 1}ZM${w * 0.22} ${h * 0.5}V${h * 0.08}h${a}V${h * 0.5}ZM2 ${h * 0.5}l${a} ${h * 0.5}M${a + 2} ${h * 0.62}l${a} ${h * 0.38}M${w * 0.22} ${h * 0.08}l${a} ${h * 0.42}`}
      fill={WOOD}
      stroke={LINE}
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
  );
}

/** 花台 w × h：石砌的花台與一叢圓弧邊的灌木（不是實心大圓） */
function Planter({ w, h }: { w: number; h: number }) {
  return (
    <>
      <path
        d={`M${w * 0.14} ${h * 0.62}C${w * 0.02} ${h * 0.4} ${w * 0.16} ${h * 0.14} ${w * 0.36} ${h * 0.2}C${w * 0.42} ${h * 0.02} ${w * 0.7} ${h * 0.04} ${w * 0.72} ${h * 0.24}C${w * 0.92} ${h * 0.2} ${w * 1.0} ${h * 0.46} ${w * 0.86} ${h * 0.62}Z`}
        fill={LEAF}
        stroke={LINE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d={`M${w * 0.08} ${h * 0.6}h${w * 0.84}l-${w * 0.06} ${h * 0.4 - 1}H${w * 0.14}Z`}
        fill={ROCK_DEEP}
        stroke={LINE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </>
  );
}

/** 樹籬 w × h：一長條圓弧邊的灌木（leaf）與底下一道淡影 */
function Hedge({ w, h }: { w: number; h: number }) {
  const n = Math.max(3, Math.round(w / 22));
  const step = (w - 8) / n;
  let top = `M4 ${h - 3}V${h * 0.5}`;
  for (let i = 0; i < n; i++) top += `q${step * 0.1}-${h * 0.52} ${step / 2}-${h * 0.46}q${step * 0.4} ${h * 0.06} ${step / 2} ${h * 0.46}`;
  return (
    <>
      <path d={`M2 ${h - 3}h${w - 4}`} {...shadeStroke} strokeWidth="5" strokeLinecap="round" opacity="0.16" />
      <path d={`${top}V${h - 3}Z`} fill={LEAF} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
    </>
  );
}

function Art({ p, gid }: { p: Placed; gid: string }) {
  const w = p.x1 - p.x0;
  const h = p.y1 - p.y0;
  switch (p.form) {
    case 'scale':
      return <Scale w={w} h={h} gid={gid} />;
    case 'fountain':
      return <Fountain w={w} h={h} />;
    case 'bench':
      return <Bench w={w} h={h} />;
    case 'benchlamp':
      return <BenchLamp w={w} h={h} gid={gid} />;
    case 'crates':
      return <Crates w={w} h={h} />;
    case 'planter':
      return <Planter w={w} h={h} />;
    case 'hedge':
      return <Hedge w={w} h={h} />;
    case 'lamp':
      return <Lamps at={[{ x: w / 2, y: h - 1, h: h - 12 }]} gid={gid} />;
    default:
      return null;
  }
}

export default function ScaleScene({ geo }: SceneProps) {
  const ids = useSceneIds();
  const plan = planScale(geo);
  const grid = `${ids.ripple}t`;
  return (
    <>
      <SceneDefs ids={ids} />
      <defs>
        {/* 方磚的格線：一格 28px，只畫上緣與左緣兩條線（淡） */}
        <pattern id={grid} width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M0 .5h28M.5 0v28" fill="none" stroke={LINE} strokeWidth="1" opacity="0.4" />
        </pattern>
      </defs>
      <TerrainRect id="rock" r={{ x0: 0, y0: SEAM, x1: geo.bandW, y1: geo.h }} />
      {/* 頂端和上一章的交界：多頻起伏、依章節種子擺的凹口、兩側的散點與凹口尖端的物件（scene-seam 的 seamEdge，第 7、8 輪看圖驗收） */}
      <SeamEdgeArt edge={seamEdge(geo, plan, 'rock', 4)} own={ROCK} above={geo.seam?.fill ?? ''} />
      {plan.tiles.map((d) => (
        <Plot key={d} id="tiles" d={d} fill={ROCK_DEEP} night={ROCK_DEEP} opacity={0.26} pattern={grid} />
      ))}
      {[...plan.props].sort(byDepth).map((p) => (
        <Prop key={p.id} p={p}>
          <Art p={p} gid={ids.glow} />
        </Prop>
      ))}
    </>
  );
}
