// 延伸區海峽的物件層（圖規 4.6、6.4 的「海峽」）：棧橋、說明卡、浪線與接縫是地圖組畫的（QuestMap.tsx 的 Strait），這一層只放海面上的東西：
// 兩翼各一艘帆船（入口那一翼多一組海鷗）、礁石、短浪與亮點（亮點白天是浪花色、夜裡是燈光色），軌道裡棧橋旁一個浮標與三顆海面燈光（圖規 6.4 的夜景）。
// 沒有主角道具（圖規 6.4）。頂端是延伸第 1 章的章節牌沙灘越過交界的那一截（scene-isle-kit 的 footPoly，和上面那一章同一串控制點），棧橋從那裡出發；
// 淺水帶那一段的棧橋由這一層再畫一次（地圖組的棧橋在這一層底下，會被淺水蓋住）。
// 底色整片是深海，物件整個在水裡；放置、保護框（說明卡、木樁、棧橋、路面）交給 scene-kit 的 placeProps。
// 接法：QuestMap.tsx 的 Strait 在 .qm-strait__pier 之後放（同一層、DOM 順序在後，頂端沙灘蓋住棧橋上端）<ChapterScene kind="strait" geo={sceneGeo(strait, g)} />（scenes.tsx 的 SceneLayerKind 與 LOADERS 有 strait）。
import type { SceneGeo } from '../quest-map/layout.ts';
import type { SceneProps } from '../quest-map/scenes.tsx';
import { AT_SEA, footPoly, Glint, guard, IsleLand, landAndReef, pierPoly, Reef, Ripple, sparkles, type IsleShape, type Pier } from './scene-isle-kit.tsx';
import {
  byDepth,
  dayNight,
  FOAM,
  Glow,
  GLOW,
  Gulls,
  LINE,
  placeProps,
  pointInPoly,
  Prop,
  rectPoly,
  ROOF,
  Sailboat,
  SceneDefs,
  TerrainRect,
  useSceneIds,
  type Placed,
  type PropSpec,
  type TerrainBlock,
} from './scene-kit.tsx';

export const geoAware = true;

const PROPS: readonly PropSpec[] = [
  {
    id: 'boat-near',
    tier: 'minor',
    ground: AT_SEA,
    whole: true,
    variants: [
      {
        w: 48,
        h: 56,
        form: 'sailboat',
        anchors: [
          { wing: 'near', u: 0.45, v: 0.72 },
          { wing: 'near', u: 0.8, v: 0.8 },
          { wing: 'near', u: 0.15, v: 0.7 },
        ],
      },
    ],
  },
  {
    id: 'gulls-near',
    tier: 'minor',
    group: 'boat-near',
    ground: AT_SEA,
    whole: true,
    variants: [
      {
        w: 36,
        h: 14,
        form: 'gulls',
        anchors: [
          { wing: 'near', u: 0.85, v: 0.36 },
          { wing: 'near', u: 0.2, v: 0.32 },
          { wing: 'near', u: 0.55, v: 0.97 },
        ],
      },
    ],
  },
  {
    id: 'boat-far',
    tier: 'minor',
    ground: AT_SEA,
    whole: true,
    variants: [
      {
        w: 48,
        h: 56,
        form: 'sailboat',
        anchors: [
          { wing: 'far', u: 0.62, v: 0.62 },
          { wing: 'far', u: 0.3, v: 0.7 },
          { wing: 'far', u: 0.9, v: 0.66 },
        ],
      },
    ],
  },
  {
    id: 'reef-far',
    tier: 'minor',
    ground: AT_SEA,
    whole: true,
    variants: [
      {
        w: 52,
        h: 24,
        form: 'reef',
        anchors: [
          { wing: 'far', u: 0.1, v: 0.92 },
          { wing: 'far', u: 0.25, v: 0.4 },
        ],
      },
    ],
  },
  // 棧橋旁的浮標（軌道裡，棧橋與說明卡之間或說明卡下方）
  {
    id: 'buoy',
    tier: 'minor',
    ground: AT_SEA,
    whole: true,
    variants: [
      {
        w: 16,
        h: 26,
        form: 'buoy',
        anchors: [
          { track: true, u: 0.24, v: 0.62 },
          { track: true, u: 0.24, v: 0.92 },
          { track: true, u: 0.6, v: 0.98 },
          { track: true, u: 0.9, v: 0.98 },
        ],
      },
    ],
  },
  ...sparkles(
    [
      ['ripple-1', 'far', 0.85, 0.32],
      ['ripple-2', 'near', 0.6, 0.4],
    ],
    'ripple',
  ),
  ...sparkles(
    [
      ['glint-1', 'far', 0.4, 0.3],
      ['glint-2', 'near', 0.3, 0.95],
    ],
    'glint',
  ),
  // 海面上的燈光（夜景，圖規 6.4）：三顆小亮點，白天是浪花色；手機在說明卡下方與棧橋旁，桌面在兩翼
  ...(
    [
      ['light-1', 0.42, 0.97, 'near', 0.7, 0.55],
      ['light-2', 0.66, 0.93, 'far', 0.15, 0.82],
      ['light-3', 0.9, 0.98, 'far', 0.85, 0.45],
    ] as const
  ).map(([id, u, v, wing, wu, wv]): PropSpec => ({
    id,
    tier: 'detail',
    ground: AT_SEA,
    whole: true,
    variants: [
      {
        w: 16,
        h: 16,
        form: 'light',
        anchors: [
          { track: true, u, v },
          { track: true, u: u - 0.12, v: v - 0.03 },
          { track: true, u: Math.min(0.95, u + 0.08), v: 0.99 },
          { wing, u: wu, v: wv },
          { wing, u: wu * 0.5, v: wv - 0.1 },
        ],
      },
    ],
  })),
  // 手機：說明卡下方的水面
  {
    id: 'ripple-track',
    tier: 'detail',
    ground: AT_SEA,
    whole: true,
    variants: [
      {
        w: 30,
        h: 10,
        form: 'ripple',
        anchors: [
          { track: true, u: 0.78, v: 0.99 },
          { track: true, u: 0.45, v: 0.99 },
        ],
      },
    ],
  },
];

export interface StraitPlan {
  readonly blocks: readonly TerrainBlock[];
  /** 頂端：延伸第 1 章的章節牌沙灘越過交界的那一截（棧橋從這裡出發） */
  readonly shoal: IsleShape;
  readonly props: readonly Placed[];
}

/**
 * 構圖（純函式，測試也用）。棧橋的上端（第 4 輪看圖驗收：地圖組的棧橋畫在這一層底下，淺水帶蓋住了它的上端，路面先在淺水上走一段才接到橋）：
 * 這一層在淺水之上、沙地之下再畫一段同樣的棧橋（同 x、同寬、木板線與繩柱的相位和地圖組的相同），從交界畫到淺水帶下緣再多 10px，
 * 看得到的棧橋從沙岸開始，上端 8px 以上壓在沙下
 */
export function planStrait(geo: SceneGeo): StraitPlan {
  // 延伸第 1 章的南岸是深的岬角（IsleSpec.southDeep），兩段用同一串控制點，在交界上接得起來
  const { land, reef } = landAndReef([footPoly(geo, geo.corridor.entry)]);
  const x = geo.corridor.entry;
  let y = 0;
  while (y < geo.h / 2 && reef.some((s) => pointInPoly({ x, y: y + 1 }, s.poly))) y += 2;
  const piers: Pier[] = y > 0 ? [{ x, y0: 0, y1: y + 10 }] : [];
  const blocks: TerrainBlock[] = [
    { id: 'sea', poly: rectPoly({ x0: -1, y0: -1, x1: geo.bandW + 1, y1: geo.h + 1 }) },
    ...land.map((s) => ({ id: 'isle', poly: s.poly })),
    ...reef.map((s) => ({ id: 'reef', poly: s.poly })),
    ...piers.map((p) => ({ id: 'pier', poly: pierPoly(p) })),
  ];
  return {
    blocks,
    shoal: { land: land.map((s) => s.d).join(''), reef: reef.map((s) => s.d).join(''), piers },
    props: placeProps(PROPS, { ...geo, protect: guard(geo) }, { blocks }),
  };
}

/** 浮標 16 × 26：浮體、白帶與水面的圈 */
function Buoy() {
  return (
    <>
      <path d="M3 21V11a5 5 0 0 1 10 0v10ZM8 6V1" fill={ROOF} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M1 23q7 4 14 0M4 15h8" fill="none" stroke={FOAM} strokeWidth="2.2" strokeLinecap="round" />
    </>
  );
}

/** 海面的燈光 16 × 16：r 2 的亮點（白天是浪花色），夜裡外面一圈 6px 的光暈 */
function Light({ gid }: { gid: string }) {
  return (
    <>
      <Glow x={8} y={8} r={8} gid={gid} />
      <circle cx={8} cy={8} r={2} {...dayNight(FOAM, GLOW)} opacity={0.6} />
    </>
  );
}

function Art({ p, gid }: { p: Placed; gid: string }) {
  switch (p.form) {
    case 'light':
      return <Light gid={gid} />;
    case 'sailboat':
      return <Sailboat />;
    case 'gulls':
      return <Gulls />;
    case 'reef':
      return <Reef w={p.x1 - p.x0} h={p.y1 - p.y0} />;
    case 'buoy':
      return <Buoy />;
    case 'ripple':
      return <Ripple />;
    case 'glint':
      return <Glint />;
    default:
      return null;
  }
}

/** 說明卡的木樁插在水裡（第 3 輪看圖驗收）：木樁底部兩圈 1.5px scene-foam 的橢圓波紋（rx 10、14）。木樁是說明卡的 ::after（地圖組），位置取 geo.protect 的 stake（外擴 12） */
function StakeRipples({ geo }: { geo: SceneGeo }) {
  const k = geo.protect.find((p) => p.kind === 'stake');
  if (!k) return null;
  const x = (k.x0 + k.x1) / 2;
  const y = k.y1 - 12;
  return (
    <path
      d={`M${x - 10} ${y}a10 3 0 1 0 20 0a10 3 0 1 0-20 0M${x - 14} ${y + 1}a14 4.5 0 1 0 28 0a14 4.5 0 1 0-28 0`}
      fill="none"
      stroke={FOAM}
      strokeWidth="1.5"
    />
  );
}

export default function StraitScene({ geo }: SceneProps) {
  const ids = useSceneIds();
  const plan = planStrait(geo);
  return (
    <>
      <SceneDefs ids={ids} />
      <TerrainRect id="sea" r={{ x0: 0, y0: 0, x1: geo.bandW, y1: geo.h }} />
      <IsleLand shape={plan.shoal} />
      <StakeRipples geo={geo} />
      {[...plan.props].sort(byDepth).map((p) => (
        <Prop key={p.id} p={p}>
          <Art p={p} gid={ids.glow} />
        </Prop>
      ))}
    </>
  );
}
