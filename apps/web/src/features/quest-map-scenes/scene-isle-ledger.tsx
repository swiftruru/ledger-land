// 延伸第 4 章「借貸與分錄」：外海小島（圖規 6.4 的 E04，也是整張地圖的最後一章：路線停在拱門中心，島把拱門整個墊住）。島、章節牌沙灘與棧橋見 scene-isle-kit.tsx；
// 主角道具是兩座平衡的天秤（借方與貸方永遠相等），中間一本攤開的帳簿，手機是一座天秤；桌面放在入口那一翼（島往外長出一塊墊住，旁邊一棵棕櫚），
// 手機放在節點交錯留下的空側。海上有礁石、帆船、遠方的小島剪影、短浪與亮點。夜景是天秤頂的小燈。
import type { Bp, SceneGeo } from '../quest-map/layout.ts';
import type { SceneProps } from '../quest-map/scenes.tsx';
import { AT_SEA, Glint, Islet, IsleScene, isletSpec, Palm, planIsle, Reef, Ripple, sparkles, type IslePlan, type IsleSpec } from './scene-isle-kit.tsx';
import { dayNight, Glow, GLOW, LEAF, LINE, PAPER, ROCK, ROCK_DEEP, ROOF, Sailboat, shadeStroke, WOOD, type Placed } from './scene-kit.tsx';

export const geoAware = true;

const WIDE: readonly Bp[] = ['medium', 'expanded'];

const SPEC: IsleSpec = {
  seed: 'isle-ledger',
  anchored: (c) => [
    {
      id: 'scales',
      tier: 'hero',
      ground: ['site'],
      group: 'hero',
      variants: [
        {
          w: 140,
          h: 100,
          bps: WIDE,
          form: 'scales',
          anchors: [
            { wing: 'near', u: 0.08, v: c.v(0.62) },
            { wing: 'near', u: 0.08, v: c.v(0.4) },
            { wing: 'near', u: 0, v: c.v(0.85) },
          ],
        },
        {
          w: 112,
          h: 80,
          bps: WIDE,
          form: 'scales',
          anchors: [
            { wing: 'near', u: 0, v: c.v(0.62) },
            { wing: 'near', u: 0, v: c.v(0.4) },
          ],
        },
        { w: 64, h: 60, form: 'scale', anchors: [{ node: 1 }, { node: 0 }, { node: 2 }, { node: 1, dv: 30 }, { node: 0, dv: -30 }] },
      ],
    },
  ],
  around: (c, hero) => [
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
          anchors: [c.beside(hero, 44, 66, 'above-out'), c.beside(hero, 44, 66, 'below-out'), c.beside(hero, 44, 66, 'outer', -20)],
        },
      ],
    },
  ],
  rest: (c) => [
    {
      id: 'palm-track',
      tier: 'minor',
      ground: ['isle'],
      tall: true,
      variants: [{ w: 40, h: 60, form: 'palm', anchors: c.spots([0.06, 0.94, 0.3, 0.7], [0.55, 0.25, 0.85, 0.1]) }],
    },
    isletSpec('islet', [
      { wing: 'far', u: 0.75, v: 0.2 },
      { wing: 'far', u: 0.5, v: 0.75 },
      { wing: 'near', u: 0.9, v: 0.9 },
    ]),
    ...(['far', 'near'] as const).map((wing, i) => ({
      id: `reef-${wing}`,
      tier: 'minor' as const,
      ground: AT_SEA,
      whole: true,
      variants: [
        {
          w: 52 - i * 10,
          h: 24 - i * 2,
          form: 'reef',
          anchors:
            wing === 'far'
              ? [
                  { wing, u: 0.3, v: 0.5 },
                  { wing, u: 0.6, v: 0.7 },
                  { wing, u: 0.15, v: 0.3 },
                ]
              : [
                  { wing, u: 0.7, v: 0.95 },
                  { wing, u: 0.4, v: 0.15 },
                ],
        },
      ],
    })),
    {
      id: 'boat',
      tier: 'minor',
      ground: AT_SEA,
      whole: true,
      variants: [
        {
          w: 48,
          h: 56,
          form: 'sailboat',
          anchors: [
            { wing: 'far', u: 0.7, v: 0.92 },
            { wing: 'far', u: 0.75, v: 0.3 },
          ],
        },
      ],
    },
    ...sparkles(
      [
        ['ripple-1', 'far', 0.85, 0.58],
        ['ripple-2', 'near', 0.85, 0.2],
        ['ripple-3', 'far', 0.1, 0.84],
      ],
      'ripple',
    ),
    ...sparkles([['glint-1', 'far', 0.55, 0.16]], 'glint'),
  ],
};

export function planLedger(geo: SceneGeo): IslePlan {
  return planIsle(geo, SPEC);
}

/** 天秤（以中心 x 與高 100 設計）：底座、柱與橫桿、吊繩、秤盤與砝碼、頂上的小燈 */
function scaleParts(cx: number) {
  return {
    base: `M${cx - 18} 96 ${cx - 12} 86h24l6 10Z`,
    wood: `M${cx - 3} 86V22h6v64ZM${cx - 32} 20h64v5h-64Z`,
    strings: `M${cx - 29} 25 ${cx - 39} 54M${cx - 29} 25 ${cx - 19} 54M${cx + 29} 25 ${cx + 19} 54M${cx + 29} 25 ${cx + 39} 54`,
    pans: `M${cx - 43} 54q14 11 28 0ZM${cx + 15} 54q14 11 28 0Z`,
    left: `M${cx - 35} 54v-7h10v7Z`,
    right: `M${cx + 23} 54v-7h10v7Z`,
    lamp: `M${cx - 4} 8h8v10h-8Z`,
    cap: `M${cx - 5} 7h10M${cx} 7V4`,
  };
}

function Scales({ centres, book, w, h, gid }: { centres: readonly number[]; book: boolean; w: number; h: number; gid: string }) {
  const parts = centres.map(scaleParts);
  const join = (k: keyof ReturnType<typeof scaleParts>) => parts.map((p) => p[k]).join('');
  const width = book ? 140 : 84;
  const sx = w / width;
  const sy = h / 100;
  const ns = { vectorEffect: 'non-scaling-stroke' } as const;
  return (
    <>
      {centres.map((cx) => (
        <Glow key={cx} x={cx * sx} y={13 * sy} r={20} gid={gid} />
      ))}
      <g transform={`scale(${sx} ${sy})`}>
        <path
          d={`M${centres[0]! - 22} 98H${centres[centres.length - 1]! + 22}`}
          {...shadeStroke}
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.16"
          {...ns}
        />
        <path d={join('strings')} stroke={LINE} strokeWidth="1.2" opacity="0.75" {...ns} />
        <path d={join('wood')} fill={WOOD} stroke={LINE} strokeWidth="1.4" strokeLinejoin="round" {...ns} />
        <path d={join('base')} fill={ROCK_DEEP} stroke={LINE} strokeWidth="1.4" strokeLinejoin="round" {...ns} />
        <path d={join('left')} fill={ROOF} stroke={LINE} strokeWidth="1.2" {...ns} />
        <path d={join('right')} fill={LEAF} stroke={LINE} strokeWidth="1.2" {...ns} />
        <path d={join('pans')} fill={ROCK} stroke={LINE} strokeWidth="1.4" strokeLinejoin="round" {...ns} />
        <path d={join('lamp')} fill={GLOW} stroke={LINE} strokeWidth="1.2" {...ns} />
        <path d={join('cap')} stroke={LINE} strokeWidth="1.5" strokeLinecap="round" {...ns} />
        {book && (
          <>
            <path
              d="M52 96q9-5 18 0q9-5 18 0V82q-9-5-18 0q-9-5-18 0Z"
              {...dayNight(PAPER, WOOD)}
              stroke={LINE}
              strokeWidth="1.4"
              strokeLinejoin="round"
              {...ns}
            />
            <path d="M70 82v14M56 86q5-2 10 0M56 90q5-2 10 0M74 86q5-2 10 0M74 90q5-2 10 0" fill="none" stroke={LINE} strokeWidth="1.1" opacity="0.6" {...ns} />
          </>
        )}
      </g>
    </>
  );
}

function art(p: Placed, gid: string) {
  const w = p.x1 - p.x0;
  const h = p.y1 - p.y0;
  switch (p.form) {
    case 'scales':
      return <Scales centres={[34, 106]} book w={w} h={h} gid={gid} />;
    case 'scale':
      return <Scales centres={[42]} book={false} w={w} h={h} gid={gid} />;
    case 'palm':
      return <Palm w={w} h={h} />;
    case 'reef':
      return <Reef w={w} h={h} />;
    case 'islet':
      return <Islet w={w} h={h} />;
    case 'sailboat':
      return <Sailboat />;
    case 'ripple':
      return <Ripple />;
    case 'glint':
      return <Glint />;
    default:
      return null;
  }
}

export default function IsleLedger({ geo }: SceneProps) {
  return <IsleScene geo={geo} plan={planLedger(geo)} art={art} />;
}
