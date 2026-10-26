// 第 3 章「損益表」：港邊的市集廣場（圖規 6.4 的 C03）。底色是廣場（地圖組的 .qm-terrain），這一層畫鋪石的地面（地形塊）與物件：
// - 鋪石（第 4 輪看圖驗收）：涵蓋軌道與入口那一翼、章高約 78% 的一大塊不規則地（scene-kit 的 plotArea），石塊紋（scene-line 的小石塊，淡、不排成線）只畫在裡面，
//   外框是清楚的 1.5px 線。原本只在階梯、攤位與手推車腳下各鋪一小塊。
// - medium 以上：入口那一翼的主角道具是五層階梯（每一階的階緣一個色帶，無字，象徵損益表的五層利益），階梯頂有一盞燈；
//   兩翼另有攤位（遮陽篷、櫃台、掛著的燈籠）、三角彩旗串、空白的價目牌、木箱與手推車。
// - 手機與沒有兩翼的 medium：主角道具是兩個並排的攤位（64 × 56），放在節點空側；軌道裡另外最多兩個小東西（價目牌、彩旗串）。
// 夜景：攤位的燈籠與階梯頂的燈（深色主題才有光暈）。
import type { Bp, SceneGeo } from '../quest-map/layout.ts';
import { SEAM } from '../quest-map/layout.ts';
import type { SceneProps } from '../quest-map/scenes.tsx';
import {
  byDepth,
  dayNight,
  Glow,
  GLOW,
  Lamps,
  LEAF,
  LINE,
  PAPER,
  placeProps,
  PLAZA,
  Plot,
  plotArea,
  Prop,
  rectPoly,
  ROCK,
  ROCK_DEEP,
  ROOF,
  SceneDefs,
  SEA,
  TerrainRect,
  useSceneIds,
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

const HERO: PropSpec = {
  id: 'steps',
  tier: 'hero',
  ground: ['plaza'],
  variants: [
    {
      w: 160,
      h: 120,
      bps: WIDE,
      form: 'steps',
      anchors: [
        { wing: 'near', u: 0.3, v: 0.56 },
        { wing: 'near', u: 0.1, v: 0.48 },
        { wing: 'near', u: 0.5, v: 0.66 },
      ],
    },
    { w: 132, h: 100, bps: WIDE, form: 'steps', anchors: [{ wing: 'near', u: 0, v: 0.56 }] },
    { w: 108, h: 84, bps: WIDE, form: 'steps', anchors: [{ wing: 'near', u: 0, v: 0.56 }] },
    // 手機，或 medium 窄到沒有兩翼：兩個並排的攤位放在節點的空側
    {
      w: 64,
      h: 56,
      form: 'stalls',
      anchors: [{ node: 1 }, { node: 2 }, { node: 0 }, { node: 3 }, { node: 1, dv: 24 }, { node: 2, dv: -24 }],
    },
  ],
};

const spots = (vs: readonly number[], us: readonly number[]): Anchor[] => vs.flatMap((v) => us.map((u) => ({ track: true as const, u, v })));
const wingAt = (wing: 'near' | 'far', list: readonly (readonly [number, number])[]): Anchor[] => list.map(([u, v]) => ({ wing, u, v }));

const MINOR: readonly PropSpec[] = [
  {
    id: 'stall-near',
    tier: 'minor',
    ground: ['plaza'],
    variants: [
      {
        w: 70,
        h: 64,
        form: 'stall-roof',
        anchors: wingAt('near', [
          [0.55, 0.88],
          [0.15, 0.9],
          [0.85, 0.82],
        ]),
      },
    ],
  },
  {
    id: 'bunting-near',
    tier: 'minor',
    ground: ['plaza'],
    variants: [
      {
        w: 124,
        h: 38,
        form: 'bunting',
        anchors: wingAt('near', [
          [0.35, 0.27],
          [0.1, 0.3],
          [0.7, 0.22],
        ]),
      },
      {
        w: 84,
        h: 32,
        form: 'bunting',
        anchors: wingAt('near', [
          [0.3, 0.27],
          [0.8, 0.22],
        ]),
      },
    ],
  },
  {
    id: 'crates-near',
    tier: 'minor',
    ground: ['plaza'],
    variants: [
      {
        w: 44,
        h: 34,
        form: 'crates',
        anchors: wingAt('near', [
          [0.95, 0.68],
          [0.05, 0.74],
          [0.5, 0.12],
        ]),
      },
    ],
  },
  {
    id: 'stall-far',
    tier: 'minor',
    ground: ['plaza'],
    variants: [
      {
        w: 70,
        h: 64,
        form: 'stall-glow',
        anchors: wingAt('far', [
          [0.3, 0.42],
          [0.6, 0.48],
          [0.1, 0.36],
        ]),
      },
    ],
  },
  {
    id: 'bunting-far',
    tier: 'minor',
    ground: ['plaza'],
    variants: [
      {
        w: 124,
        h: 38,
        form: 'bunting',
        anchors: wingAt('far', [
          [0.4, 0.7],
          [0.1, 0.66],
          [0.8, 0.74],
        ]),
      },
      {
        w: 84,
        h: 32,
        form: 'bunting',
        anchors: wingAt('far', [
          [0.4, 0.7],
          [0.9, 0.74],
        ]),
      },
    ],
  },
  {
    id: 'cart-far',
    tier: 'minor',
    ground: ['plaza'],
    variants: [
      {
        w: 58,
        h: 42,
        form: 'cart',
        anchors: wingAt('far', [
          [0.55, 0.17],
          [0.25, 0.14],
          [0.85, 0.22],
        ]),
      },
    ],
  },
  {
    id: 'crates-far',
    tier: 'minor',
    ground: ['plaza'],
    variants: [
      {
        w: 44,
        h: 34,
        form: 'crates',
        anchors: wingAt('far', [
          [0.25, 0.92],
          [0.65, 0.95],
          [0.9, 0.88],
        ]),
      },
    ],
  },
  // 手機的軌道裡：價目牌、短的彩旗串（最多兩個，放不下就不畫；有兩翼時軌道已經夠擠，不放）
  {
    id: 'sign-track',
    tier: 'minor',
    ground: ['plaza'],
    variants: [{ w: 24, h: 32, bps: ['compact'], form: 'sign', anchors: spots([0.62, 0.4, 0.5, 0.72], [0.5, 0.3, 0.7, 0.2, 0.8]) }],
  },
  {
    id: 'bunting-track',
    tier: 'minor',
    ground: ['plaza'],
    variants: [{ w: 72, h: 28, bps: ['compact'], form: 'bunting', anchors: spots([0.33, 0.45, 0.58], [0.5, 0.35, 0.65]) }],
  },
];

export interface MarketPlan {
  readonly blocks: readonly TerrainBlock[];
  /** 鋪石的範圍：涵蓋軌道與入口那一翼的一大塊地（scene-kit 的 plotArea） */
  readonly paving: string;
  readonly props: readonly Placed[];
}

/** 翼裡左緣在 x0、寬 w 的物件換算成候選位置的 u */
function uOf(geo: SceneGeo, side: 'left' | 'right', x0: number, w: number): number {
  const span = wingSpan(side, geo);
  if (!span) return 0;
  const depth = Math.abs(span.inner - span.outer);
  const off = side === 'left' ? span.inner - (x0 + w) : x0 - span.inner;
  return Math.min(1, Math.max(0, off / Math.max(1, depth - w)));
}

/** 構圖（純函式，測試也用）：主角道具 → 次要道具；鋪石是涵蓋軌道與入口那一翼的一大塊地 */
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

export function planMarket(input: SceneGeo): MarketPlan {
  const geo = strict(input);
  const plaza: TerrainBlock = { id: 'plaza', poly: rectPoly({ x0: 0, y0: SEAM, x1: geo.bandW, y1: geo.h }) };
  const blocks = [plaza];
  const [hero] = placeProps([HERO], geo, { blocks });
  const taken = hero ? [hero] : [];
  // 價目牌跟著攤位：放在攤位靠軌道的那一邊，放不下就放外側
  const first = placeProps(MINOR, geo, { blocks, taken });
  const signs: PropSpec[] = first
    .filter((p) => p.id.startsWith('stall-') && p.region !== 'track')
    .map((stall) => {
      const side = stall.region as 'left' | 'right';
      const xs = side === 'left' ? [stall.x1 + 6, stall.x0 - 30] : [stall.x0 - 30, stall.x1 + 6];
      return {
        id: `sign-${stall.id}`,
        tier: 'minor',
        group: stall.group,
        ground: ['plaza'],
        variants: [{ w: 24, h: 32, form: 'sign', anchors: xs.map((x0) => ({ wing: side, u: uOf(geo, side, x0, 24), v: stall.y1 / geo.h })) }],
      };
    });
  const sign = placeProps(signs, geo, { blocks, taken: [...taken, ...first] });
  const props = [...taken, ...first, ...sign];
  const pave = plotArea(input, 'market paving');
  return { blocks: [...blocks, { id: 'pave', poly: pave.poly }], paving: pave.d, props };
}

// ---------------------------------------------------------------------------------------------
// 畫法（往左是外側；右翼會水平翻轉）

/** 五層階梯 w × h（正面看的五層石階，往上一層窄一點）：石造的本體、每一層階面一條色帶（由下往上 wood、sea、leaf、glow、roof）、頂上一盞燈 */
function Steps({ w, h, gid }: { w: number; h: number; gid: string }) {
  const lamp = Math.min(24, Math.round(h * 0.22));
  const sh = (h - 2 - lamp - 4) / 5;
  const m = (w - 4) * 0.085;
  const rows = Array.from({ length: 5 }, (_, i) => ({ x0: 2 + m * i, x1: w - 2 - m * i, y0: h - 2 - (i + 1) * sh }));
  // 輪廓：左側由下往上一階一階爬到頂，再沿右側一階一階下來
  let body = `M2 ${h - 2}`;
  for (let i = 0; i < 5; i++) body += `V${rows[i]!.y0}H${i < 4 ? rows[i + 1]!.x0 : rows[4]!.x1}`;
  for (let i = 3; i >= 0; i--) body += `V${rows[i]!.y0}H${rows[i]!.x1}`;
  body += `V${h - 2}Z`;
  const colours = [WOOD, SEA, LEAF, GLOW, ROOF];
  const band = (i: number) => {
    const r = rows[i]!;
    return `M${r.x0 + 3} ${r.y0 + sh * 0.38}H${r.x1 - 3}V${r.y0 + sh - 2}H${r.x0 + 3}Z`;
  };
  return (
    <>
      <path d={body} fill={ROCK} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      {colours.map((c, i) => (
        <path key={i} d={band(i)} fill={c} stroke={LINE} strokeWidth="1" strokeLinejoin="round" />
      ))}
      <Lamps at={[{ x: w / 2, y: rows[4]!.y0, h: lamp }]} gid={gid} />
    </>
  );
}

/** 攤位 w × h（往左是外側）：兩根柱子、扇形邊的遮陽篷（兩條淺色條紋）、櫃台、篷下掛一盞燈籠 */
function stallParts(x: number, w: number, h: number) {
  const top = h * 0.12;
  const eave = h * 0.4;
  const n = Math.max(3, Math.round(w / 10));
  const step = (w - 4) / n;
  let scallop = '';
  for (let i = 0; i < n; i++) scallop += `q${-step / 2} ${step * 0.55} ${-step} 0`;
  const counterY = h * 0.62;
  return {
    posts: `M${x + 6} ${eave}V${h - 1}M${x + w - 6} ${eave}V${h - 1}`,
    awning: `M${x + 2} ${eave}L${x + 9} ${top}H${x + w - 9}L${x + w - 2} ${eave}${scallop}Z`,
    stripes: `M${x + w * 0.36} ${top}L${x + w * 0.33} ${eave}h${w * 0.1}l${w * 0.01}-${eave - top}ZM${x + w * 0.64} ${top}l${w * 0.02} ${eave - top}h${w * 0.1}L${x + w * 0.73} ${top}Z`,
    counter: `M${x + 3} ${counterY}h${w - 6}v${h - 1 - counterY}h${6 - w}Z`,
    lantern: { x: x + w * 0.26, y: eave + step * 0.55 + 2 },
  };
}

function Stalls({ w, h, awnings, gid }: { w: number; h: number; awnings: readonly string[]; gid: string }) {
  const sw = awnings.length > 1 ? w / 2 - 1 : w;
  const parts = awnings.map((_, i) => stallParts(i * (sw + 2), sw, h));
  return (
    <>
      {parts.map((p) => (
        <Glow key={p.lantern.x} x={p.lantern.x} y={p.lantern.y + 5} r={16} gid={gid} />
      ))}
      <path d={parts.map((p) => p.posts + p.counter).join('')} fill={WOOD} stroke={LINE} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      {parts.map((p, i) => (
        <path key={i} d={p.awning} fill={awnings[i]} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      ))}
      <path d={parts.map((p) => p.stripes).join('')} {...dayNight(PAPER, ROCK)} opacity="0.85" />
      <path
        d={parts.map((p) => `M${p.lantern.x} ${p.lantern.y - 4}v3M${p.lantern.x - 3} ${p.lantern.y}h6l-1 9h-4Z`).join('')}
        fill={GLOW}
        stroke={LINE}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </>
  );
}

/** 三角彩旗串 w × h：兩根短柱、一條下垂的繩子、掛在繩上的三角旗（兩種顏色輪流） */
function Bunting({ w, h }: { w: number; h: number }) {
  const P0 = { x: 4, y: 6 };
  const C = { x: w / 2, y: h * 0.7 };
  const P2 = { x: w - 4, y: 6 };
  const at = (t: number) => ({
    x: (1 - t) ** 2 * P0.x + 2 * (1 - t) * t * C.x + t * t * P2.x,
    y: (1 - t) ** 2 * P0.y + 2 * (1 - t) * t * C.y + t * t * P2.y,
  });
  const n = Math.max(4, Math.round(w / 18));
  const tris: string[][] = [[], []];
  for (let i = 0; i < n; i++) {
    const p = at((i + 0.7) / (n + 0.4));
    tris[i % 2]!.push(`M${p.x - 5.5} ${p.y}h11l-5.5 ${Math.min(12, h * 0.34)}Z`);
  }
  const colours = [ROOF, GLOW];
  return (
    <>
      <path d={`M4 ${h - 1}V4M${w - 4} ${h - 1}V4M4 6Q${C.x} ${C.y} ${w - 4} 6`} fill="none" stroke={LINE} strokeWidth="1.5" strokeLinecap="round" />
      {tris.map((t, i) => (
        <path key={i} d={t.join('')} fill={colours[i]} stroke={LINE} strokeWidth="1" strokeLinejoin="round" />
      ))}
    </>
  );
}

/** 空白的價目牌 24 × 32：立架與一塊沒有字的牌子 */
function Sign() {
  return (
    <path d="M7 31 10 17M17 31l-3-14M3 3h18v14H3Z" {...dayNight(PAPER, WOOD)} stroke={LINE} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
  );
}

/** 疊起來的木箱 44 × 34 */
function Crates() {
  return (
    <path
      d="M2 33V17h20v16ZM22 33V21h20v12ZM10 17V3h18v14ZM2 17l20 16M22 21l20 12M10 3l18 14"
      fill={WOOD}
      stroke={LINE}
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
  );
}

/** 手推車 58 × 42（往左是外側）：車斗、把手、兩個輪子（小）、車斗上堆的蔬果 */
function Cart() {
  return (
    <>
      <path d="M8 16q4-9 10-3q3-8 9-2q4-7 10 0q5-6 9 2v3H8Z" fill={LEAF} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M4 16h44v14H4ZM48 20l9-6" fill={WOOD} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M8 35a5 5 0 1 0 10 0a5 5 0 1 0-10 0M34 35a5 5 0 1 0 10 0a5 5 0 1 0-10 0" fill={ROCK_DEEP} stroke={LINE} strokeWidth="1.5" />
    </>
  );
}

function Art({ p, gid }: { p: Placed; gid: string }) {
  const w = p.x1 - p.x0;
  const h = p.y1 - p.y0;
  switch (p.form) {
    case 'steps':
      return <Steps w={w} h={h} gid={gid} />;
    case 'stalls':
      return <Stalls w={w} h={h} awnings={[ROOF, GLOW]} gid={gid} />;
    case 'stall-roof':
      return <Stalls w={w} h={h} awnings={[ROOF]} gid={gid} />;
    case 'stall-glow':
      return <Stalls w={w} h={h} awnings={[GLOW]} gid={gid} />;
    case 'bunting':
      return <Bunting w={w} h={h} />;
    case 'sign':
      return <Sign />;
    case 'crates':
      return <Crates />;
    case 'cart':
      return <Cart />;
    default:
      return null;
  }
}

export default function Market({ geo }: SceneProps) {
  const ids = useSceneIds();
  const plan = planMarket(geo);
  const cobble = `${ids.ripple}c`;
  return (
    <>
      <SceneDefs ids={ids} />
      <defs>
        {/* 鋪石紋：一格 40 × 28 裡七顆大小不一的石塊（只有外框、淡），不排成直線，看起來不像路線的圓點 */}
        <pattern id={cobble} width="40" height="28" patternUnits="userSpaceOnUse">
          <path
            d="M3 4h8q2 0 2 2v2q0 2-2 2H3q-2 0-2-2V6q0-2 2-2ZM18 2h10q2 0 2 2v1q0 2-2 2H18q-2 0-2-2V4q0-2 2-2ZM33 6h4q2 0 2 2v3q0 2-2 2h-4q-2 0-2-2V8q0-2 2-2ZM9 14h7q2 0 2 2v2q0 2-2 2H9q-2 0-2-2v-2q0-2 2-2ZM23 12h6q2 0 2 2v3q0 2-2 2h-6q-2 0-2-2v-3q0-2 2-2ZM2 22h4q2 0 2 2v1q0 2-2 2H2ZM15 23h9q2 0 2 2v.5q0 1.5-2 1.5h-9q-2 0-2-1.5V25q0-2 2-2Z"
            fill="none"
            stroke={LINE}
            strokeWidth="1"
            opacity="0.36"
          />
        </pattern>
      </defs>
      <TerrainRect id="plaza" r={{ x0: 0, y0: SEAM, x1: geo.bandW, y1: geo.h }} />
      {/* 頂端和上一章的交界：多頻起伏、依章節種子擺的凹口、兩側的散點與凹口尖端的物件（scene-seam 的 seamEdge，第 7、8 輪看圖驗收） */}
      <SeamEdgeArt edge={seamEdge(geo, plan, 'plaza', 3)} own={PLAZA} above={geo.seam?.fill ?? ''} />
      <Plot id="pave" d={plan.paving} fill={ROCK} night={ROCK} opacity={0.3} pattern={cobble} />
      {[...plan.props].sort(byDepth).map((p) => (
        <Prop key={p.id} p={p}>
          <Art p={p} gid={ids.glow} />
        </Prop>
      ))}
    </>
  );
}
