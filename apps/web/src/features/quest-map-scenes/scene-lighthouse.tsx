// 第 6 章「五步驟勾稽」：岩岸與燈塔（圖規 6.4 的 C06）。底色是岩地（地圖組的 .qm-terrain），這一層畫地形塊與物件：
// - 有兩翼時：遠側翼是一片海灣（從區帶外緣進來，岸線不規則，靠軌道那一側留一條岩岸，軌道就是岩岸上的路），海上有礁石、帆船、海鷗、浮標與短浪；
//   入口那一翼是岬角，主角道具是燈塔加四盞小燈的石階（四個勾稽點，燈塔是第五步），燈塔外側是一個小灣，夜裡光束朝外照向海面（靜止，不蓋到文字）；
//   岬角上還有守塔人的小屋、草叢與岸邊礁石。
// - 軌道裡：節點外側的燈柱（沿著道路，不碰保護框，放不下就不畫）。
// - 手機與沒有兩翼的 medium：主角道具是 40 × 100 的燈塔，放在節點交錯留下的空側。
// 放置、著地與保護框交給 scene-kit 的 placeProps；這個檔只決定構圖與畫法。海灣的形狀（bay）只有這一章與農田章用，各自留一份（scene-kit 的預算很緊）。
import type { Bp, Point, SceneGeo } from '../quest-map/layout.ts';
import { SEAM, inflate } from '../quest-map/layout.ts';
import type { SceneProps } from '../quest-map/scenes.tsx';
import {
  byDepth,
  dayNight,
  FOAM,
  Glow,
  GLOW,
  Grass,
  grounded,
  Gulls,
  LINE,
  nearSide,
  PAPER,
  placeProps,
  pointInPoly,
  Prop,
  rectPoly,
  ROCK,
  ROCK_DEEP,
  ROOF,
  roughen,
  SceneDefs,
  SEA,
  smoothClosed,
  Terrain,
  TerrainRect,
  useSceneIds,
  WaterTexture,
  waterTexture,
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

/** 主角道具：有兩翼時是岬角上的燈塔加石階（依翼寬由大到小），沒有時是軌道裡的燈塔 */
const HERO: PropSpec = {
  id: 'lighthouse',
  tier: 'hero',
  ground: ['rock', '!sea'],
  tall: true,
  variants: [
    {
      w: 112,
      h: 150,
      bps: WIDE,
      form: 'lighthouse',
      anchors: [
        { wing: 'near', u: 0.3, v: 0.56 },
        { wing: 'near', u: 0.1, v: 0.5 },
      ],
    },
    { w: 84, h: 144, bps: WIDE, form: 'lighthouse', anchors: [{ wing: 'near', u: 0, v: 0.56 }] },
    {
      w: 40,
      h: 100,
      form: 'tower',
      ground: ['rock'],
      anchors: NODE_SPOTS,
    },
  ],
};

export interface Water {
  readonly side: Side;
  readonly d: string;
  readonly poly: readonly Point[];
  readonly shore: string;
  readonly swash: string;
  /** 離軌道 400px 以外的地紋（6.6）；那一塊不到 160px 寬時是空字串 */
  readonly texture: string;
}

export interface LighthousePlan {
  readonly blocks: readonly TerrainBlock[];
  readonly waters: readonly Water[];
  readonly props: readonly Placed[];
}

/** 折線：只畫 keep 為真的點，中間斷開的地方另起一段（岸線跑出畫面再回來時不會連成一條直線） */
function line(pts: readonly Point[], keep: (p: Point) => boolean): string {
  let d = '';
  let on = false;
  for (const p of pts) {
    if (!keep(p)) {
      on = false;
      continue;
    }
    d += `${on ? 'L' : 'M'}${r1(p.x)} ${r1(p.y)}`;
    on = true;
  }
  return d;
}

/** 海灣離區段頂端（含接縫 24px）與底邊至少多遠（第 4 輪看圖驗收：海一路畫到章頂，左上角和白色岸線撞上接縫，像被接縫裁掉） */
export const BAY_TOP = SEAM + 40;
export const BAY_BOTTOM = 40;

/**
 * 一翼的海灣：從區帶外緣（畫面外 40px）進來，岸線經過 (y, d) 控制點（d 是離軌道邊的距離），最後回到外緣；上下兩端都收在畫面外，
 * 離章頂 BAY_TOP、章底 BAY_BOTTOM 以內（控制點再多留 16px）。keep 範圍內的岸線不加起伏（例如燈塔旁邊，岸線要剛好貼著物件）。
 * 外緣那一邊每 40px 補一個點：只有頭尾兩點時，平滑曲線在頭尾的切線是「下一點減上一點」，外緣那一邊很長，曲線會往上下甩出去碰到接縫
 */
function bay(geo: SceneGeo, side: Side, ctrl: readonly (readonly [number, number])[], seed: string, keep?: readonly [number, number]): Water {
  const sx = (d: number) => (side === 'left' ? geo.track.left - d : geo.track.right + d);
  const edge = side === 'left' ? -40 : geo.bandW + 40;
  const lo = BAY_TOP + 16;
  const hi = geo.h - BAY_BOTTOM - 16;
  const cy = (y: number) => Math.min(hi, Math.max(lo, y));
  const ya = cy(ctrl[0]![0]);
  const yb = cy(ctrl[ctrl.length - 1]![0]);
  const n = Math.max(1, Math.round((yb - ya) / 40));
  const back = Array.from({ length: n - 1 }, (_, i) => ({ x: edge, y: yb - ((yb - ya) * (i + 1)) / n }));
  const pts: Point[] = [{ x: edge, y: ya }, ...ctrl.slice(1, -1).map(([y, d]) => ({ x: sx(d), y: cy(y) })), { x: edge, y: yb }, ...back];
  const near = (p: Point) => !!keep && p.y > keep[0] && p.y < keep[1];
  const rough = roughen(pts, seed, 9, (a, b) => a.x === edge || b.x === edge || near(a) || near(b));
  const { d, poly } = smoothClosed(rough);
  const inside = (p: Point) => p.x > 0 && p.x < geo.bandW;
  // 第二道浪線：沿岸線往水裡 10px，離接縫 32px 以下才畫
  const swash = poly.map((p, i) => {
    const a = poly[(i + poly.length - 1) % poly.length]!;
    const b = poly[(i + 1) % poly.length]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    let q = { x: p.x - ((b.y - a.y) / len) * 10, y: p.y + ((b.x - a.x) / len) * 10 };
    if (!pointInPoly(q, poly)) q = { x: 2 * p.x - q.x, y: 2 * p.y - q.y };
    return inside(p) && q.y > 32 && q.x > 4 && q.x < geo.bandW - 4 && pointInPoly(q, poly) ? q : { x: -1e4, y: 0 };
  });
  const texture = waterTexture(geo, side, poly);
  return { side, d, poly, shore: line(poly, inside), swash: line(swash, (q) => q.x > -1e3), texture };
}

/** 構圖（純函式，測試也用）：先放燈塔，依它畫出岬角外側的小灣，再畫遠側翼的海灣，最後放次要道具與細節 */
export function planLighthouse(input: SceneGeo): LighthousePlan {
  // 保護框再外擴 3px 再放：量測（G9）用 DOM 實際畫出的路線取樣，和幾何的取樣點差一點點，貼著邊放的物件會被算成相交；
  // 章節牌與紙籤的下緣再多留 16px（量測把立柱算成整個寬度）
  const geo: SceneGeo = {
    ...input,
    protect: input.protect.map((r) => {
      const g = inflate(r, 3);
      return { ...r, ...g, y1: g.y1 + (r.kind === 'plaque' || r.kind === 'banner' ? 16 : 0) };
    }),
  };
  const rock: TerrainBlock = { id: 'rock', poly: rectPoly({ x0: 0, y0: SEAM, x1: geo.bandW, y1: geo.h }) };
  const base = [rock];
  const [hero] = placeProps([HERO], geo, { blocks: base });
  const near = nearSide(geo);
  const far: Side = near === 'left' ? 'right' : 'left';
  const h = geo.h;
  const mid = (geo.track.left + geo.track.right) / 2;

  // 軌道裡的燈柱：每個節點外側（遠離道路那一側）一盞，放不下時試翼裡貼著軌道的位置；同一組只佔一個名額
  const tw = geo.track.right - geo.track.left;
  const at = (x: number, y1: number): Anchor => ({ track: true, u: (x - geo.track.left) / tw, v: y1 / h });
  const lampSpecs: PropSpec[] = geo.nodes.map((n, i) => {
    const out = n.x < mid ? -1 : 1;
    return {
      id: `lamp-${i}`,
      tier: 'minor',
      group: 'lamps',
      ground: ['rock', '!sea'],
      variants: [
        {
          w: 14,
          h: 40,
          form: 'lamp',
          anchors: [
            at(out > 0 ? Math.min(n.x + 58, geo.track.right - 12) : Math.max(n.x - 58, geo.track.left + 12), n.y + 26),
            at(n.x - out * 58, n.y + 26),
            at(n.x + out * 58, n.y - 2),
            { wing: n.x < mid ? 'left' : 'right', u: 0, v: (n.y + 26) / h },
          ],
        },
      ],
    };
  });

  if (!hero || hero.form !== 'lighthouse') {
    // 手機（或沒有兩翼）：岩地、燈塔與軌道裡的燈柱
    const rest = placeProps([...lampSpecs.slice(0, 2), ...TRACK_PROPS], geo, { blocks: base, taken: hero ? [hero] : [] });
    return { blocks: base, waters: [], props: hero ? [hero, ...rest] : rest };
  }

  const reach = (side: Side) => (side === 'left' ? geo.track.left : geo.bandW - geo.track.right) + 40;
  const distOf = (x: number, side: Side) => (side === 'left' ? geo.track.left - x : x - geo.track.right);
  const heroNear = Math.min(distOf(hero.x0, near), distOf(hero.x1, near));
  const heroFar = Math.max(distOf(hero.x0, near), distOf(hero.x1, near));
  const S = reach(near);
  const { y0, y1 } = hero;
  // 入口翼外側的海：燈塔站在伸進海裡的岬角上（岸線繞過整個物件框），岬角上下是兩個小灣，比岬角更靠近軌道；上下兩端回到區帶外緣
  const inlet = Math.min(Math.max(heroNear + 52, 0.42 * S), heroFar - 24);
  const coveAt = (pad: number) =>
    bay(
      geo,
      near,
      [
        [0.1 * h, 0],
        [0.17 * h, Math.max(inlet + 30, 0.7 * S)],
        [Math.min(y0 - 0.1 * h, 0.3 * h), inlet],
        [y0 - 0.03 * h, heroFar + pad],
        [(y0 + y1) / 2, heroFar + pad + 6],
        [y1 + 0.03 * h, heroFar + pad],
        [Math.max(y1 + 0.13 * h, 0.72 * h), inlet + 10],
        [0.86 * h, Math.max(inlet + 40, 0.75 * S)],
        [0.92 * h, 0],
      ],
      'lighthouse-cove',
      [y0 - 0.08 * h, y1 + 0.08 * h],
    );
  let cove = coveAt(12);
  for (const pad of [20, 28, 36, 48]) {
    if (grounded(hero, hero.ground, [...base, { id: 'sea', poly: cove.poly }], hero)) break;
    cove = coveAt(pad);
  }
  // 遠側翼的海灣：靠軌道那一側留一條岩岸
  const Sf = reach(far);
  const farSea = geo.wings[far]
    ? bay(
        geo,
        far,
        [
          [0.07 * h, 0],
          [0.14 * h, 0.55 * Sf],
          [0.25 * h, Math.max(42, 0.16 * Sf)],
          [0.39 * h, Math.max(38, 0.1 * Sf)],
          [0.53 * h, Math.max(52, 0.22 * Sf)],
          [0.67 * h, Math.max(40, 0.12 * Sf)],
          [0.78 * h, Math.max(64, 0.32 * Sf)],
          [0.85 * h, 0.75 * Sf],
          [0.89 * h, 0],
        ],
        'lighthouse-far',
      )
    : null;
  const waters = [cove, ...(farSea ? [farSea] : [])];
  const blocks = [...base, ...waters.map((w) => ({ id: 'sea', poly: w.poly }))];

  // 以「物件中心離軌道邊的距離」換算成翼內的比例 u
  const uAt = (side: Side, centre: number, w: number): number => {
    const span = wingSpan(side, geo);
    if (!span) return 0;
    const depth = Math.abs(span.inner - span.outer);
    return Math.min(1, Math.max(0, (centre - WING_GAP - w / 2) / Math.max(1, depth - w)));
  };
  const sea = (
    id: string,
    w: number,
    h2: number,
    form: string,
    wing: 'near' | 'far',
    spots: readonly (readonly [number, number])[],
    group?: string,
  ): PropSpec => ({
    id,
    tier: 'minor',
    group,
    ground: ['sea'],
    whole: true,
    variants: [{ w, h: h2, form, anchors: spots.map(([u, v]) => ({ wing, u, v })) }],
  });
  const land = (id: string, w: number, h2: number, form: string, wing: 'near' | 'far', spots: readonly (readonly [number, number])[]): PropSpec => ({
    id,
    tier: 'minor',
    ground: ['rock', '!sea'],
    variants: [{ w, h: h2, form, anchors: spots.map(([u, v]) => ({ wing, u, v })) }],
  });
  const vTop = y0 / h;
  const vBot = y1 / h;
  const uIn = (w: number) => uAt(near, (24 + inlet) / 2, w);
  const minor: PropSpec[] = [
    ...lampSpecs,
    // 入口翼：守塔人的小屋（岬角內側）、海上的帆船與海鷗、岸邊礁石、草叢
    land('cottage', 52, 42, 'cottage', 'near', [
      [uIn(52), vBot + 0.16],
      [uIn(52), vTop - 0.06],
      [0, vBot + 0.24],
      [0, 0.92],
    ]),
    sea('boat-near', 48, 56, 'sailboat', 'near', [
      [1, vBot + 0.2],
      [0.85, vBot + 0.16],
      [1, vTop - 0.08],
      [0.8, 0.3],
    ]),
    sea(
      'gulls-near',
      36,
      14,
      'gulls',
      'near',
      [
        [0.9, vTop - 0.14],
        [1, 0.24],
        [0.8, vBot + 0.06],
      ],
      'boat-near',
    ),
    land('rocks-near', 44, 22, 'rocks', 'near', [
      [uAt(near, inlet - 14, 44), vTop - 0.12],
      [uAt(near, inlet - 10, 44), vBot + 0.3],
      [0.2, 0.95],
    ]),
    land('grass-near', 28, 18, 'grass', 'near', [
      [uIn(28), 0.2],
      [0, 0.16],
      [0.1, 0.94],
    ]),
    // 遠側翼：海上的兩叢礁石與帆船（帶海鷗）
    sea('reef-1', 56, 26, 'reef', 'far', [
      [0.55, 0.3],
      [0.75, 0.34],
      [0.4, 0.26],
    ]),
    sea('boat-far', 48, 56, 'sailboat', 'far', [
      [0.6, 0.56],
      [0.85, 0.6],
      [0.4, 0.5],
    ]),
    sea(
      'gulls-far',
      36,
      14,
      'gulls',
      'far',
      [
        [0.35, 0.44],
        [0.7, 0.42],
      ],
      'boat-far',
    ),
    sea('reef-2', 44, 22, 'reef', 'far', [
      [0.45, 0.76],
      [0.7, 0.72],
      [0.3, 0.7],
    ]),
    // 水面的短浪（細節，不佔組的名額）
    ...(
      [
        ['ripple-1', 'far', 0.8, 0.2],
        ['ripple-2', 'far', 0.3, 0.64],
        ['ripple-3', 'near', 1, (vTop + vBot) / 2],
      ] as const
    ).map(([id, wing, u, v]): PropSpec => ({
      id,
      tier: 'detail',
      ground: ['sea'],
      whole: true,
      variants: [
        {
          w: 30,
          h: 10,
          form: 'ripple',
          anchors: [
            { wing, u, v },
            { wing, u: u * 0.8, v: v + 0.05 },
            { wing, u: Math.min(1, u + 0.15), v: v - 0.05 },
          ],
        },
      ],
    })),
  ];
  const props = [hero, ...placeProps(minor, geo, { blocks, taken: [hero] })];
  return { blocks, waters, props };
}

/** 手機的軌道裡：一叢草或幾顆石頭（燈柱之外最多一組，放不下就不畫） */
const spots = (vs: readonly number[], us: readonly number[]): Anchor[] => vs.flatMap((v) => us.map((u) => ({ track: true as const, u, v })));
const TRACK_PROPS: readonly PropSpec[] = [
  { id: 'rocks-track', tier: 'minor', ground: ['rock'], variants: [{ w: 36, h: 20, form: 'rocks', anchors: spots([0.36, 0.52, 0.68], [0.5, 0.4, 0.6]) }] },
];

// ---------------------------------------------------------------------------------------------
// 畫法（框內座標，往左是外側）

/** 燈塔：岩座加石階（從內側的地面往上到燈塔的平台）、塔身兩道紅條、迴廊、燈室與尖頂；compact（40 × 100）只有塔身。夜裡燈室有光暈，beam 時光束朝外 */
function Lighthouse({ w, h, gid, beam }: { w: number; h: number; gid: string; beam: boolean }) {
  const solo = w < 60;
  const tw = solo ? w - 6 : 40;
  const cx = solo ? w / 2 : tw / 2 + 6;
  const yb = solo ? h - 8 : h - 20;
  const yt = solo ? 34 : 44;
  const bb = tw / 2;
  const bt = bb * 0.64;
  const hw = (y: number) => bt + ((bb - bt) * (y - yt)) / (yb - yt);
  const band = (a: number, b: number) => {
    const ya = yt + a * (yb - yt);
    const yb2 = yt + b * (yb - yt);
    return `M${r1(cx - hw(ya))} ${r1(ya)}H${r1(cx + hw(ya))}L${r1(cx + hw(yb2))} ${r1(yb2)}H${r1(cx - hw(yb2))}Z`;
  };
  const ly = yt - 14;
  // 石階：w ≥ 100 時四階、84 寬時三階
  const n = solo ? 0 : w >= 100 ? 4 : 3;
  const x0 = cx + bb + 2;
  const sw = (w - 2 - x0) / Math.max(1, n);
  const rise = (h - 2 - yb) / Math.max(1, n);
  let stairs = '';
  if (n) {
    stairs = `M${r1(x0)} ${yb}`;
    for (let k = n - 1; k >= 0; k--) stairs += `H${r1(w - 2 - k * sw)}V${r1(h - 2 - k * rise)}`;
    stairs += `V${h}H${r1(x0)}Z`;
  }
  return (
    <>
      {beam && (
        <>
          {/* 光束：從燈室往外側漸漸淡掉（不會在海面上留下一道直的邊），淺色主題整個透明 */}
          <defs>
            <linearGradient id={`${gid}b`} gradientUnits="userSpaceOnUse" x1={cx} y1={ly} x2={-170} y2={ly}>
              <stop offset="0" stopColor="transparent" stopOpacity={0.4} style={{ stopColor: 'light-dark(transparent, var(--ll-scene-glow))' }} />
              <stop offset="1" stopColor="transparent" stopOpacity={0} style={{ stopColor: 'light-dark(transparent, var(--ll-scene-glow))' }} />
            </linearGradient>
          </defs>
          <path d={`M${cx - 6} ${ly - 3}L-170 ${ly - 38}V${ly + 26}L${cx - 6} ${ly + 3}Z`} fill={`url(#${gid}b)`} />
        </>
      )}
      <Glow x={cx} y={ly} r={solo ? 20 : 28} gid={gid} />
      {/* 岩座與石階 */}
      <path
        d={`M0 ${h}C${r1(cx * 0.2)} ${yb - 4} ${r1(cx * 0.6)} ${yb - 3} ${r1(x0 + 4)} ${yb}V${h}Z${stairs}`}
        fill={ROCK_DEEP}
        stroke={LINE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* 塔身、紅條與尖頂、迴廊與門、燈室 */}
      <path
        d={`M${r1(cx - bb)} ${yb}L${r1(cx - bt)} ${yt}H${r1(cx + bt)}L${r1(cx + bb)} ${yb}Z`}
        {...dayNight(PAPER, ROCK_DEEP)}
        stroke={LINE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d={`${band(0.22, 0.4)}${band(0.6, 0.78)}M${r1(cx - 9)} ${ly - 7}L${cx} ${ly - 16}L${r1(cx + 9)} ${ly - 7}Z`}
        fill={ROOF}
        stroke={LINE}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d={`M${r1(cx - bt - 5)} ${yt}h${r1(2 * bt + 10)}v-5h${r1(-2 * bt - 10)}ZM${r1(cx - 4)} ${yb}v-9a4 4 0 0 1 8 0v9Z`}
        fill={WOOD}
        stroke={LINE}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d={`M${r1(cx - 7)} ${yt - 5}V${ly - 7}H${r1(cx + 7)}V${yt - 5}ZM${cx} ${ly - 7}V${yt - 5}`}
        fill={GLOW}
        stroke={LINE}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </>
  );
}

/** 路燈 14 × h：燈罩與燈柱合成一個 path（scene-glow 填色、scene-line 描邊），夜裡有光暈 */
function Lamp({ h, gid }: { h: number; gid: string }) {
  return (
    <>
      <Glow x={7} y={8} r={22} gid={gid} />
      <path d={`M3 3h8v10H3ZM6 13h2V${h - 3}h2.5v2h-7v-2H6Z`} fill={GLOW} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
    </>
  );
}

/** 守塔人的小屋 52 × 42：屋身、屋頂與煙囪、門與窗（scene-glow） */
function Cottage() {
  return (
    <>
      <path d="M6 41V22h40v19Z" {...dayNight(PAPER, ROCK_DEEP)} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M2 23 26 5l24 18ZM38 12V4h6v12" fill={ROOF} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M11 25h10v8H11ZM30 41v-12h8v12" fill={GLOW} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
    </>
  );
}

/** 礁石：海裡的一叢石頭，底下一道浪花 */
function Reef({ w, h }: { w: number; h: number }) {
  const b = h - 5;
  return (
    <>
      <path
        d={`M3 ${b}q${w * 0.06}-${h * 0.7} ${w * 0.3}-${h * 0.72}q${w * 0.2} 0 ${w * 0.3} ${h * 0.72}ZM${w * 0.56} ${b}q${w * 0.05}-${h * 0.45} ${w * 0.2}-${h * 0.46}q${w * 0.14} 0 ${w * 0.2} ${h * 0.46}Z`}
        fill={ROCK_DEEP}
        stroke={LINE}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d={`M1 ${h - 3}q${w * 0.25} 4 ${w * 0.5} 0t${w * 0.48} 0`} fill="none" stroke={FOAM} strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

/** 幾顆石頭（w × h，大小不一） */
function Rocks({ w, h }: { w: number; h: number }) {
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

/** 帆船 48 × 56（和 scene-kit 的 Sailboat 同樣的形狀，船身與桅杆合成一個 path，少一個圖形） */
function Boat() {
  return (
    <>
      <path d="M6 53q9 4 18 0t18 0" fill="none" stroke={FOAM} strokeWidth="2" strokeLinecap="round" />
      <path d="M4 42h40l-7 9H11ZM24 42V5" fill={WOOD} stroke={LINE} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M26 8 41 38H26ZM22 14 9 38h13Z" {...dayNight(PAPER, ROCK_DEEP)} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
    </>
  );
}

function Art({ p, gid }: { p: Placed; gid: string }) {
  const w = p.x1 - p.x0;
  const h = p.y1 - p.y0;
  switch (p.form) {
    case 'lighthouse':
      return <Lighthouse w={w} h={h} gid={gid} beam />;
    case 'tower':
      return <Lighthouse w={w} h={h} gid={gid} beam={false} />;
    case 'lamp':
      return <Lamp h={h} gid={gid} />;
    case 'cottage':
      return <Cottage />;
    case 'sailboat':
      return <Boat />;
    case 'gulls':
      return <Gulls />;
    case 'reef':
      return <Reef w={w} h={h} />;
    case 'rocks':
      return <Rocks w={w} h={h} />;
    case 'grass':
      return <Grass w={w} h={h} />;
    case 'ripple':
      return <path d="M1 8q7-7 14 0t14 0" fill="none" stroke={FOAM} strokeWidth="2" strokeLinecap="round" />;
    default:
      return null;
  }
}

export default function LighthouseScene({ geo }: SceneProps) {
  const ids = useSceneIds();
  const plan = planLighthouse(geo);
  return (
    <>
      <SceneDefs ids={ids} />
      <TerrainRect id="rock" r={{ x0: 0, y0: SEAM, x1: geo.bandW, y1: geo.h }} />
      {/* 頂端和上一章的交界：多頻起伏、依章節種子擺的凹口、兩側的散點與凹口尖端的物件（scene-seam 的 seamEdge，第 7、8 輪看圖驗收） */}
      <SeamEdgeArt edge={seamEdge(geo, plan, 'rock', 6)} own={ROCK} above={geo.seam?.fill ?? ''} />
      {plan.waters.length > 0 && (
        <Terrain id="sea" d={plan.waters.map((w) => w.d).join('')} fill={SEA}>
          <WaterTexture ids={ids} geo={geo} d={plan.waters.map((w) => w.texture).join('')} />
          <path
            d={plan.waters.map((w) => w.swash).join('')}
            fill="none"
            stroke={FOAM}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.75"
          />
          <path d={plan.waters.map((w) => w.shore).join('')} fill="none" stroke={FOAM} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </Terrain>
      )}
      {[...plan.props].sort(byDepth).map((p) => (
        <Prop key={p.id} p={p}>
          <Art p={p} gid={ids.glow} />
        </Prop>
      ))}
    </>
  );
}
