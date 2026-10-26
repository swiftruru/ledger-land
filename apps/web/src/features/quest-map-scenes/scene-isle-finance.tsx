// 延伸第 2 章「融資與資本公積」：外海小島（圖規 6.4 的 E02）。島、章節牌沙灘與棧橋見 scene-isle-kit.tsx；主角道具是一間有柱廊與山牆的小銀行，
// 旁邊兩個錢袋（不畫符號、不寫字）；桌面放在入口那一翼（島往外長出一塊墊住，旁邊一棵棕櫚），手機放在節點交錯留下的空側。
// 海上有一座燈浮標（夜裡亮）、遠方的小島剪影、短浪與亮點。夜景是銀行的窗光與燈浮標。
import type { Bp, SceneGeo } from '../quest-map/layout.ts';
import type { SceneProps } from '../quest-map/scenes.tsx';
import { AT_SEA, Glint, Islet, IsleScene, isletSpec, Palm, planIsle, Ripple, sparkles, type IslePlan, type IsleSpec } from './scene-isle-kit.tsx';
import { dayNight, FOAM, Glow, GLOW, LINE, PAPER, ROCK, ROCK_DEEP, ROOF, shadeStroke, WOOD, type Anchor, type Placed, type PropSpec } from './scene-kit.tsx';

export const geoAware = true;

const WIDE: readonly Bp[] = ['medium', 'expanded'];

const bags = (id: string, anchors: readonly Anchor[], ground: readonly string[]): PropSpec => ({
  id,
  tier: 'minor',
  ground,
  group: id === 'bags' ? 'hero' : id,
  variants: [{ w: 40, h: 30, form: 'bags', anchors }],
});

const SPEC: IsleSpec = {
  seed: 'isle-finance',
  anchored: (c) => [
    {
      id: 'bank',
      tier: 'hero',
      ground: ['site'],
      group: 'hero',
      variants: [
        {
          w: 96,
          h: 90,
          bps: WIDE,
          form: 'bank',
          anchors: [
            { wing: 'near', u: 0.08, v: c.v(0.6) },
            { wing: 'near', u: 0.08, v: c.v(0.4) },
            { wing: 'near', u: 0, v: c.v(0.85) },
          ],
        },
        { w: 56, h: 52, form: 'bank', anchors: [{ node: 1 }, { node: 0 }, { node: 1, dv: 30 }, { node: 0, dv: -30 }, { node: 0, dv: 30 }] },
      ],
    },
  ],
  around: (c, hero) => [
    bags('bags', [c.beside(hero, 40, 30, 'outer'), c.beside(hero, 40, 30, 'below-out'), c.beside(hero, 40, 30, 'below')], ['site']),
    {
      id: 'palm-near',
      tier: 'minor',
      ground: ['site'],
      group: 'hero',
      tall: true,
      variants: [
        {
          w: 44,
          h: 66,
          form: 'palm',
          anchors: [c.beside(hero, 44, 66, 'outer', -40), c.beside(hero, 44, 66, 'above-out'), c.beside(hero, 44, 66, 'above')],
        },
      ],
    },
  ],
  rest: (c) => [
    // 手機（或沒有兩翼）：錢袋與棕櫚在島上的空位
    ...(c.wide ? [] : [bags('bags-track', c.spots([0.08, 0.92, 0.5], [0.3, 0.55, 0.15, 0.75]), ['meadow'])]),
    {
      id: 'palm-track',
      tier: 'minor',
      ground: ['isle'],
      tall: true,
      variants: [{ w: 40, h: 60, form: 'palm', anchors: c.spots([0.94, 0.06, 0.6, 0.3], [0.45, 0.85, 0.15, 0.65]) }],
    },
    {
      id: 'beacon',
      tier: 'minor',
      ground: AT_SEA,
      whole: true,
      variants: [
        {
          w: 22,
          h: 46,
          form: 'beacon',
          anchors: [
            { wing: 'far', u: 0.4, v: 0.45 },
            { wing: 'far', u: 0.7, v: 0.3 },
            { wing: 'near', u: 0.5, v: 0.97 },
          ],
        },
      ],
    },
    isletSpec('islet', [
      { wing: 'near', u: 0.85, v: 0.97 },
      { wing: 'near', u: 1, v: 0.2 },
      { wing: 'far', u: 0.75, v: 0.92 },
    ]),
    ...sparkles(
      [
        ['ripple-1', 'far', 0.75, 0.62],
        ['ripple-2', 'near', 0.85, 0.18],
        ['ripple-3', 'far', 0.15, 0.88],
      ],
      'ripple',
    ),
    ...sparkles([['glint-1', 'far', 0.85, 0.2]], 'glint'),
  ],
};

export function planFinance(geo: SceneGeo): IslePlan {
  return planIsle(geo, SPEC);
}

/** 小銀行（以 96 × 90 設計，縮放到 w × h，線寬不跟著縮）：台階、柱廊、兩扇窗（窗光）、門與山牆 */
function Bank({ w, h, gid }: { w: number; h: number; gid: string }) {
  const sx = w / 96;
  const sy = h / 90;
  const ns = { vectorEffect: 'non-scaling-stroke' } as const;
  const cols = [20, 37, 59, 76];
  return (
    <>
      <Glow x={28.5 * sx} y={54 * sy} r={20} gid={gid} />
      <Glow x={67.5 * sx} y={54 * sy} r={20} gid={gid} />
      <g transform={`scale(${sx} ${sy})`}>
        <path d="M6 88h84" {...shadeStroke} strokeWidth="5" strokeLinecap="round" opacity="0.16" {...ns} />
        <path d="M14 36h68v38H14Z" fill={ROCK_DEEP} stroke={LINE} strokeWidth="1.3" {...ns} />
        <path d="M25 60v-10a3.5 3.5 0 0 1 7 0v10ZM64 60v-10a3.5 3.5 0 0 1 7 0v10Z" fill={GLOW} stroke={LINE} strokeWidth="1.2" {...ns} />
        <path d="M43 74V56a5 5 0 0 1 10 0v18Z" fill={WOOD} stroke={LINE} strokeWidth="1.3" {...ns} />
        <path
          d={`M10 28h76v8H10ZM11 74h74v5H11Z${cols.map((x) => `M${x - 4} 36h8v38h-8Z`).join('')}`}
          {...dayNight(PAPER, ROCK)}
          stroke={LINE}
          strokeWidth="1.3"
          strokeLinejoin="round"
          {...ns}
        />
        <path d="M6 28 48 8l42 20Z" fill={ROOF} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" {...ns} />
        <path d="M4 88V82h88v6ZM8 82v-3h80v3" fill={ROCK} stroke={LINE} strokeWidth="1.3" strokeLinejoin="round" {...ns} />
      </g>
    </>
  );
}

/** 兩個錢袋 40 × 30：袋身、束口的繩子（不畫符號） */
function Bags() {
  return (
    <>
      <path d="M4 29h34" {...shadeStroke} strokeWidth="4" strokeLinecap="round" opacity="0.16" />
      <path
        d="M6 28q-5 0-4-7q2-8 9-10l-3-5h10l-3 5q7 2 9 10q1 7-4 7ZM25 28q-4 0-3-5q1-6 6-7l-2-4h8l-2 4q5 1 6 7q1 5-3 5Z"
        fill={WOOD}
        stroke={LINE}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M10 11h8M27 16h6" stroke={LINE} strokeWidth="1.8" strokeLinecap="round" />
    </>
  );
}

/** 燈浮標 22 × 46：浮體、燈架、燈（夜裡有光暈）與水面的圈 */
function Beacon({ gid }: { gid: string }) {
  return (
    <>
      <Glow x={11} y={10} r={20} gid={gid} />
      <path d="M8 24V14h6v10M7 7h8" fill="none" stroke={LINE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 8h6v6H8Z" fill={GLOW} stroke={LINE} strokeWidth="1.2" />
      <path d="M4 41 7 24h8l3 17Z" fill={ROOF} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M1 43q10 4 20 0M6 33h10" fill="none" stroke={FOAM} strokeWidth="2.2" strokeLinecap="round" />
    </>
  );
}

function art(p: Placed, gid: string) {
  const w = p.x1 - p.x0;
  const h = p.y1 - p.y0;
  switch (p.form) {
    case 'bank':
      return <Bank w={w} h={h} gid={gid} />;
    case 'bags':
      return <Bags />;
    case 'palm':
      return <Palm w={w} h={h} />;
    case 'beacon':
      return <Beacon gid={gid} />;
    case 'islet':
      return <Islet w={w} h={h} />;
    case 'ripple':
      return <Ripple />;
    case 'glint':
      return <Glint />;
    default:
      return null;
  }
}

export default function IsleFinance({ geo }: SceneProps) {
  return <IsleScene geo={geo} plan={planFinance(geo)} art={art} />;
}
