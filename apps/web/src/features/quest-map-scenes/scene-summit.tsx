// 第 10 章「六大指標：產出」：登頂（圖規 6.4 的 C10）。底色是 scene-meadow-deep（地圖組的 .qm-terrain：淺色與夜空是深草地，
// 莓果與紅酒是那個風味地面的深一階，不是草地），這一層畫地形塊與物件：
// - 地形：由下往上的等高線（第 4 輪看圖驗收：原本是三條橫跨整個視窗的水平色帶，深色下就是三條橫紋）。現在是以山頂與兩翼山稜為中心的閉合環線：
//   山頂在章末區（軌道上方，中心在區段頂端外），三圈不規則的環由外往內是淺草坡（scene-meadow）、草與岩之間、岩坡（scene-rock），章末區在最內圈；
//   深色主題的外兩圈從底色往岩坡過渡（底色混岩坡 25%、50%，見 FILLS）：環是大面積的地面，草地色只留給小面積的草叢
//   （第 7 輪 handoff：莓果與紅酒 1440 寬兩翼外側各約 250px 的灰綠色草坡）；
//   兩翼的山稜與遠山各自再墊兩圈。環的外形是橢圓經 scene-kit 的 organic 推出 0 到 44px 的起伏，色塊填在環內，環緣是 1.5px 淡淡的等高線，沒有橫跨全幅的邊。
// - 有兩翼時：入口那一翼是山稜剪影（山頂插一面旗，山腳一塊不寫字的終點牌），主角道具；旁邊是旗幟、帳篷（夜裡透光）、石堆與針葉林。
//   另一翼是遠山（顏色淡一些）、針葉林、營地帳篷與石堆。
// - 手機與沒有兩翼的 medium：主角道具是兩個小帳篷（72 × 48），放在節點交錯留下的空側；軌道裡最多再兩個小東西。
// 山頂的環往上畫到區段頂端之外：照 geo.seam（和地圖組畫在地景層的 .qm-seam__fill 同一條波浪與填色）蓋在環上，海峽直接用那條波浪接到岩地。
// 等高線畫在所有物件之下，遠山不透明，線不會穿過山。放置、著地與保護框交給 scene-kit 的 placeProps。
import type { ReactNode } from 'react';
import type { Bp, Point, SceneGeo } from '../quest-map/layout.ts';
import { SEAM, hashSeed, seededRandom, inflate } from '../quest-map/layout.ts';
import type { SceneProps } from '../quest-map/scenes.tsx';
import {
  byDepth,
  Glow,
  GLOW,
  LEAF,
  LINE,
  MEADOW,
  MEADOW_DEEP,
  organic,
  PAPER,
  placeProps,
  Prop,
  rectPoly,
  ROCK,
  ROCK_DEEP,
  ROOF,
  SceneDefs,
  shadeFill,
  smoothClosed,
  TerrainRect,
  useSceneIds,
  WOOD,
  type Anchor,
  type Placed,
  type PropSpec,
  type TerrainBlock,
} from './scene-kit.tsx';

export const geoAware = true;

const WIDE: readonly Bp[] = ['medium', 'expanded'];
/** 手機的主角道具：節點交錯留下的空側，先試中間兩個節點，再試上下位移 */
const NODE_SPOTS: readonly Anchor[] = [1, 2, 0, 3].flatMap((node) => [0, -24, 24, -44, 44].map((dv) => ({ node, dv })));
const r1 = (n: number) => Math.round(n * 10) / 10;

/** 主角道具：有兩翼時是山稜剪影加終點牌（依翼寬由大到小），沒有時是軌道裡的兩個小帳篷 */
const HERO: PropSpec = {
  id: 'ridge',
  tier: 'hero',
  ground: ['meadow'],
  variants: [
    {
      w: 220,
      h: 140,
      bps: WIDE,
      form: 'ridge',
      anchors: [
        { wing: 'near', u: 0.2, v: 0.46 },
        { wing: 'near', u: 0, v: 0.5 },
      ],
    },
    { w: 140, h: 100, bps: WIDE, form: 'ridge', anchors: [{ wing: 'near', u: 0.5, v: 0.46 }] },
    { w: 112, h: 84, bps: WIDE, form: 'ridge', anchors: [{ wing: 'near', u: 0.5, v: 0.46 }] },
    { w: 72, h: 48, form: 'tents', anchors: NODE_SPOTS },
  ],
};

/** 固定畫法的物件原尺寸：放大的尺寸用 scale 畫 */
const BASE: Readonly<Record<string, readonly [number, number]>> = {
  tents: [72, 48],
  flags: [44, 52],
  cairn: [28, 32],
};
const sizes = (form: string, ks: readonly number[]) => ks.map((k) => [r1(BASE[form]![0] * k), r1(BASE[form]![1] * k)] as const);

/** 一圈等高環：level 1 是最外圈（淺草坡），3 是最內圈（岩坡） */
export interface Ring {
  readonly level: 1 | 2 | 3;
  readonly poly: readonly Point[];
  readonly d: string;
}

export interface SummitPlan {
  readonly blocks: readonly TerrainBlock[];
  readonly rings: readonly Ring[];
  readonly props: readonly Placed[];
}

/** 超橢圓（中心 cx、cy，半軸 a、b，指數 p；2 是橢圓）沿外法線推出 0 到 2 × amp + 3 的起伏（scene-kit 的 organic，波長 80 到 140 與 150 到 230） */
function ring(level: Ring['level'], cx: number, cy: number, a: number, b: number, amp: number, seed: string, p = 2): Ring {
  const n = 32;
  const a0 = seededRandom(hashSeed(seed))() * Math.PI;
  const k = (v: number) => Math.sign(v) * Math.abs(v) ** (2 / p);
  const base = Array.from({ length: n }, (_, i) => {
    const t = a0 + (i / n) * Math.PI * 2;
    return { x: cx + a * k(Math.cos(t)), y: cy + b * k(Math.sin(t)) };
  });
  const { d, poly } = smoothClosed(
    organic(base, seed, amp, () => 1, 28),
    3,
  );
  return { level, poly, d };
}

/** 構圖（純函式，測試也用）：先放主角道具（山稜）與次要道具，再依山頂（章末區）與兩翼山稜的位置畫等高環 */
export function planSummit(input: SceneGeo): SummitPlan {
  // 保護框再外擴 3px 再放：量測（G9）用 DOM 實際畫出的路線取樣，和幾何的取樣點差一點點，貼著邊放的物件會被算成相交；
  // 章節牌與紙籤的下緣再多留 16px（量測把立柱算成整個寬度）
  const geo: SceneGeo = {
    ...input,
    protect: input.protect.map((r) => {
      const g = inflate(r, 3);
      return { ...r, ...g, y1: g.y1 + (r.kind === 'plaque' || r.kind === 'banner' ? 16 : 0) };
    }),
  };
  const h = geo.h;
  const meadow: TerrainBlock = { id: 'meadow', poly: rectPoly({ x0: 0, y0: SEAM, x1: geo.bandW, y1: geo.h }) };
  const blocks: TerrainBlock[] = [meadow];
  const [hero] = placeProps([HERO], geo, { blocks });
  // 山頂的三圈：中心在軌道中線、區段頂端往上 0.06h；最內圈（岩坡）墊住整個章末區，最外圈的下緣約在 0.72h
  const tw = (geo.track.right - geo.track.left) / 2;
  const cx = (geo.track.left + geo.track.right) / 2;
  const cy = -0.06 * h;
  // 山頂三圈是指數 3 的超橢圓（底比橢圓平）。最內圈墊住章末區（拱門與紙籤外擴 12 的四個角；字級放大時章末區變高）；
  // 最外圈連起伏都不碰到區段底邊（底下 24px 是下一章的接縫）
  const P = 3;
  const a3 = tw + 60;
  let b3 = 0.38 * h;
  for (const r of input.protect.filter((q) => q.kind === 'arch' || q.kind === 'plaque'))
    for (const x of [r.x0 - 12, r.x1 + 12]) {
      const u = Math.min(0.95, Math.abs(x - cx) / a3);
      b3 = Math.max(b3, (r.y1 + 12 - cy) / (1 - u ** P) ** (1 / P));
    }
  const b1 = Math.min(b3 + 0.38 * h, h - 70 - cy);
  const b2 = Math.min(b3 + 0.18 * h, (b1 + b3) / 2);
  const summit = (props: readonly Placed[]): Ring[] => [
    ring(1, cx, cy, tw + 240, b1, 20, 'summit-1', P),
    ring(2, cx, cy, tw + 150, b2, 20, 'summit-2', P),
    ring(3, cx, cy, a3, b3, 16, 'summit-3', P),
    // 兩翼的山稜與遠山：山腳的中心往外兩圈
    ...props
      .filter((p) => p.form === 'ridge' || p.form === 'farridge')
      .flatMap((p) => {
        const w = (p.x1 - p.x0) / 2;
        const hh = (p.y1 - p.y0) / 2;
        const x = (p.x0 + p.x1) / 2;
        const y = p.y1 - 0.6 * hh;
        return [ring(1, x, y, w + 64, hh + 54, 12, `${p.id}-1`), ring(2, x, y, w + 22, hh + 18, 10, `${p.id}-2`)];
      }),
  ];

  const spots = (vs: readonly number[], us: readonly number[]): Anchor[] => vs.flatMap((v) => us.map((u) => ({ track: true as const, u, v })));
  const track: PropSpec[] = [
    { id: 'cairn-track', tier: 'minor', ground: ['meadow'], variants: [{ w: 28, h: 32, form: 'cairn', anchors: spots([0.4, 0.56, 0.7], [0.5, 0.42, 0.58]) }] },
    { id: 'pines-track', tier: 'minor', ground: ['meadow'], variants: [{ w: 44, h: 40, form: 'pines', anchors: spots([0.74, 0.6, 0.46], [0.3, 0.7, 0.5]) }] },
  ];
  if (!hero || hero.form !== 'ridge') {
    const rest = placeProps(track, geo, { blocks, taken: hero ? [hero] : [] });
    const props = hero ? [hero, ...rest] : rest;
    return withRings(blocks, summit(props), props);
  }

  const on = (
    id: string,
    form: string,
    wing: 'near' | 'far',
    dims: readonly (readonly [number, number])[],
    spots2: readonly (readonly [number, number])[],
    group?: string,
  ): PropSpec => ({
    id,
    tier: 'minor',
    group,
    ground: ['meadow'],
    variants: dims.map(([w, h2]) => ({ w, h: h2, form, anchors: spots2.map(([u, v]) => ({ wing, u, v })) })),
  });
  const vH = hero.y1 / h;
  const pines = (id: string, wing: 'near' | 'far', spots2: readonly (readonly [number, number])[], group?: string) =>
    on(
      id,
      'pines',
      wing,
      [
        [96, 64],
        [72, 52],
        [48, 42],
      ],
      spots2,
      group,
    );
  const minor: PropSpec[] = [
    // 入口翼：山稜旁的旗幟、上方的針葉林、下方的帳篷營地與石堆
    on(
      'flags',
      'flags',
      'near',
      sizes('flags', [1, 0.8]),
      [
        [0, vH - 0.04],
        [0, vH + 0.04],
        [1, vH - 0.14],
      ],
      'ridge',
    ),
    pines('pines-near', 'near', [
      [0.3, vH - 0.22],
      [0.6, vH - 0.24],
      [0.1, 0.16],
    ]),
    on('camp-near', 'tents', 'near', sizes('tents', [1.25, 1]), [
      [0.2, vH + 0.22],
      [0.5, vH + 0.24],
      [0, vH + 0.2],
    ]),
    on(
      'cairn-near',
      'cairn',
      'near',
      sizes('cairn', [1.2, 1]),
      [
        [0.8, vH + 0.22],
        [1, vH + 0.18],
        [0.6, vH + 0.36],
      ],
      'camp-near',
    ),
    pines('pines-near2', 'near', [
      [0.4, 0.95],
      [0.7, 0.94],
      [0.1, 0.95],
    ]),
    // 另一翼：遠山、針葉林、營地與石堆
    on(
      'far-ridge',
      'farridge',
      'far',
      [
        [200, 92],
        [150, 72],
        [110, 56],
      ],
      [
        [0.4, 0.26],
        [0.15, 0.25],
        [0.7, 0.27],
      ],
    ),
    pines('pines-far', 'far', [
      [0.6, 0.5],
      [0.3, 0.48],
      [0.85, 0.52],
    ]),
    on('camp-far', 'tents', 'far', sizes('tents', [1.25, 1]), [
      [0.25, 0.72],
      [0.55, 0.74],
      [0.05, 0.7],
    ]),
    on(
      'cairn-far',
      'cairn',
      'far',
      sizes('cairn', [1.2, 1]),
      [
        [0.85, 0.7],
        [0.7, 0.78],
        [1, 0.66],
      ],
      'camp-far',
    ),
    pines('pines-far2', 'far', [
      [0.5, 0.95],
      [0.2, 0.94],
      [0.8, 0.95],
    ]),
    { id: 'cairn-track', tier: 'minor', ground: ['meadow'], variants: [{ w: 28, h: 32, form: 'cairn', anchors: spots([0.62, 0.5, 0.74], [0.3, 0.7, 0.5]) }] },
  ];
  const props = [hero, ...placeProps(minor, geo, { blocks, taken: [hero] })];
  return withRings(blocks, summit(props), props);
}

/** 等高環也輸出成地形塊（最外圈 slope、最內圈 peak；物件的著地仍是整章的 meadow） */
function withRings(blocks: readonly TerrainBlock[], rings: readonly Ring[], props: readonly Placed[]): SummitPlan {
  const id = (r: Ring) => (r.level === 3 ? 'peak' : r.level === 2 ? 'ridge' : 'slope');
  return { blocks: [...blocks, ...rings.map((r) => ({ id: id(r), poly: r.poly }))], rings, props };
}

// ---------------------------------------------------------------------------------------------
// 畫法（框內座標，往左是外側）

/** 山稜剪影（w × h，依 220 × 140 縮放）：三座山頭、背光面的淡影、主峰的雪頂與一面旗，內側山腳一塊不寫字的終點牌 */
function Ridge({ w, h }: { w: number; h: number }) {
  const kx = w / 220;
  const ky = h / 140;
  const P = (x: number, y: number) => `${r1(x * kx)} ${r1(y * ky)}`;
  return (
    <>
      <path
        d={`M${P(0, 139)}L${P(36, 74)}L${P(58, 92)}L${P(108, 30)}L${P(150, 76)}L${P(172, 58)}L${P(208, 139)}Z`}
        fill={ROCK_DEEP}
        stroke={LINE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d={`M${P(36, 74)}L${P(44, 139)}H${P(0, 139).split(' ')[0]}ZM${P(108, 30)}L${P(100, 139)}L${P(58, 92)}ZM${P(172, 58)}L${P(166, 139)}L${P(150, 76)}Z`}
        {...shadeFill}
        opacity="0.16"
      />
      <path
        d={`M${P(108, 30)}L${P(124, 48)}L${P(116, 46)}L${P(110, 54)}L${P(102, 46)}L${P(94, 48)}ZM${P(172, 58)}L${P(181, 78)}L${P(174, 74)}L${P(166, 80)}L${P(163, 70)}Z`}
        fill={PAPER}
        stroke={LINE}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d={`M${P(108, 31)}V${P(108, 6).split(' ')[1]}M${P(204, 139)}V${P(204, 104).split(' ')[1]}`} stroke={LINE} strokeWidth="2" strokeLinecap="round" />
      <path d={`M${P(109, 7)}L${P(128, 12)}L${P(109, 18)}Z`} fill={ROOF} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
      <path d={`M${P(190, 104)}h${r1(28 * kx)}v${r1(18 * ky)}h${r1(-28 * kx)}Z`} fill={WOOD} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
    </>
  );
}

/** 遠山 w × h：兩座淡淡的山頭與雪頂 */
function FarRidge({ w, h }: { w: number; h: number }) {
  const P = (x: number, y: number) => `${r1(x * w)} ${r1(y * h)}`;
  return (
    <>
      <path
        d={`M${P(0, 0.99)}L${P(0.3, 0.2)}L${P(0.48, 0.5)}L${P(0.66, 0.08)}L${P(1, 0.99)}Z`}
        fill={ROCK_DEEP}
        stroke={LINE}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeOpacity="0.6"
      />
      <path
        d={`M${P(0.66, 0.08)}L${P(0.74, 0.26)}L${P(0.68, 0.23)}L${P(0.63, 0.3)}L${P(0.6, 0.22)}ZM${P(0.3, 0.2)}L${P(0.37, 0.36)}L${P(0.31, 0.33)}L${P(0.25, 0.36)}Z`}
        fill={PAPER}
        stroke={LINE}
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeOpacity="0.6"
      />
    </>
  );
}

/** 兩個小帳篷 72 × 48：一大一小，門口是 scene-glow（夜裡有光暈） */
function Tents({ gid }: { gid: string }) {
  return (
    <>
      <path d="M2 47 24 8l22 39ZM40 47l16-28 15 28Z" fill={ROOF} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M24 8v-6M56 19v-5" stroke={LINE} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M17 47l7-15 7 15ZM51 47l5-10 5 10Z" fill={GLOW} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
      <Glow x={24} y={40} r={22} gid={gid} />
    </>
  );
}

/** 兩面旗 44 × 52：兩根旗桿、三角旗（scene-roof 與 scene-leaf） */
function Flags() {
  return (
    <>
      <path d="M6 51V4M30 51V14" stroke={LINE} strokeWidth="2" strokeLinecap="round" />
      <path d="M7 5l20 6-20 7Z" fill={ROOF} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M31 15l12 5-12 6Z" fill={LEAF} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
    </>
  );
}

/** 石堆 28 × 32：四顆疊起來的石頭 */
function Cairn() {
  return (
    <path
      d="M3 31q0-8 11-8t11 8ZM6 23q0-6 8-6t8 6ZM8 17q0-5 6-5t6 5ZM10 12q0-5 4-5t4 5Z"
      fill={ROCK_DEEP}
      stroke={LINE}
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  );
}

/** 針葉林 w × h：三到四棵三層的針葉樹（scene-leaf），彼此不重疊；樹幹一個 path、樹冠一個 path */
function Pines({ w, h }: { w: number; h: number }) {
  const n = Math.max(2, Math.min(4, Math.round(w / 24)));
  const sw = w / n;
  const T = Array.from({ length: n }, (_, i) => ({ x: sw * (i + 0.5), top: i % 2 ? h * 0.18 : 2, hw: sw * 0.5 - 1 }));
  const tree = (t: { x: number; top: number; hw: number }) => {
    const H = h - 8 - t.top;
    const tier = (y0: number, y1: number, k: number) => `M${r1(t.x)} ${r1(y0)}L${r1(t.x + t.hw * k)} ${r1(y1)}H${r1(t.x - t.hw * k)}Z`;
    return tier(t.top, t.top + H * 0.45, 0.62) + tier(t.top + H * 0.22, t.top + H * 0.72, 0.82) + tier(t.top + H * 0.46, t.top + H, 1);
  };
  return (
    <>
      <path d={T.map((t) => `M${r1(t.x - 2)} ${h - 1}v-10h4v10Z`).join('')} fill={WOOD} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
      <path d={T.map(tree).join('')} fill={LEAF} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
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
    case 'ridge':
      return <Ridge w={w} h={h} />;
    case 'farridge':
      return <FarRidge w={w} h={h} />;
    case 'tents':
      return scaled(<Tents gid={gid} />);
    case 'flags':
      return scaled(<Flags />);
    case 'cairn':
      return scaled(<Cairn />);
    case 'pines':
      return <Pines w={w} h={h} />;
    default:
      return null;
  }
}

/** 三圈的填色：淺色是淺草坡、草與岩之間（兩者各半）、岩坡；深色的外兩圈是底色（scene-meadow-deep）混岩坡 25% 與 50%，
 *  不再是草地色（莓果與紅酒的草地色是灰綠，大面積鋪在暖色地面上像污漬）。不支援 light-dark() 的瀏覽器用屬性上的淺色值 */
const FILLS: readonly { fill: string; style?: { fill: string } }[] = [
  { fill: MEADOW, style: { fill: `light-dark(${MEADOW}, color-mix(in oklab, ${MEADOW_DEEP} 75%, ${ROCK}))` } },
  {
    fill: ROCK,
    style: {
      fill: `light-dark(color-mix(in oklab, ${MEADOW}, ${ROCK}), color-mix(in oklab, color-mix(in oklab, ${MEADOW_DEEP}, ${ROCK}) 96%, var(--ll-text)))`,
    },
  },
  { fill: ROCK, style: { fill: `light-dark(${ROCK}, color-mix(in oklab, ${ROCK} 92%, var(--ll-text)))` } },
];

/** 接縫的波浪（和 terrain.ts 的 seamPaths 同一種：中線 12、振幅 8、波長 64），geo 沒有帶 seam 時用 */
function seamWave(bandW: number): string {
  let d = 'M0 12 q16 -16 32 0';
  for (let x = 32; x < bandW; x += 32) d += ' t32 0';
  return `${d} V0 H0 Z`;
}

/**
 * 地圖組畫在地景層的接縫（.qm-seam__fill：波浪以上填上方那一段的底色）。物件層在地景層之上，岩坡畫滿到頂端會蓋掉它，
 * 所以照 geo.seam（同一個 path 與填色，terrain.ts 的 seamFill）蓋在岩坡上，交界就是同一條波浪；上下同地景時（null）不用蓋。
 * 沒有 geo.seam 時（單元測試、場景草稿）用同樣的波浪，顏色依有沒有出口猜：有出口時上方是海峽（深海），沒有時是地圖頂端（頁面底色）
 */
function seamOf(geo: SceneGeo): { readonly d: string; readonly fill: string } | null {
  if (geo.seam !== undefined) return geo.seam;
  return { d: seamWave(geo.bandW), fill: geo.corridor.exit !== null ? 'var(--ll-scene-sea-deep)' : 'var(--ll-bg)' };
}

export default function SummitScene({ geo }: SceneProps) {
  const ids = useSceneIds();
  const plan = planSummit(geo);
  const seam = seamOf(geo);
  return (
    <g>
      <SceneDefs ids={ids} />
      <TerrainRect id="meadow" r={{ x0: 0, y0: SEAM, x1: geo.bandW, y1: geo.h }} />
      {/* 由外往內一圈一圈畫：同一圈（山頂與兩翼的山）合成一個 path，先描等高線再填色（paint-order），重疊的地方只剩外緣那條線 */}
      {([1, 2, 3] as const).map((level) => {
        const d = plan.rings
          .filter((r) => r.level === level)
          .map((r) => r.d)
          .join('');
        return d ? (
          <path
            key={level}
            data-terrain-block={level === 3 ? 'peak' : level === 2 ? 'ridge' : 'slope'}
            d={d}
            fill={FILLS[level - 1]!.fill}
            style={FILLS[level - 1]!.style}
            stroke={LINE}
            strokeOpacity="0.3"
            strokeWidth="3"
            strokeLinejoin="round"
            paintOrder="stroke"
          />
        ) : null;
      })}
      {seam && <path d={seam.d} style={{ fill: seam.fill }} />}
      {[...plan.props].sort(byDepth).map((p) => (
        <Prop key={p.id} p={p}>
          <Art p={p} gid={ids.glow} />
        </Prop>
      ))}
    </g>
  );
}
