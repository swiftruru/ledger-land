// 延伸第 1 章「本益比與估價」：外海小島（圖規 6.4 的 E01）。島、章節牌沙灘與棧橋見 scene-isle-kit.tsx；這一章的主角道具是一堆金幣（盈餘）旁邊立著一張空白的價目牌（價格），
// 桌面放在入口那一翼（島往外長出一塊墊住，旁邊一盞島上燈與一棵棕櫚），手機放在節點交錯留下的空側，島上另有一盞燈。海上有遠方的小島剪影、一艘帆船、短浪與亮點。
// 金幣用 scene-glow（不用 --ll-star 的金色）；價目牌不寫字。夜景是島上燈的光暈。
import type { Bp, SceneGeo } from '../quest-map/layout.ts';
import type { SceneProps } from '../quest-map/scenes.tsx';
import { AT_SEA, Glint, Islet, IsleScene, isletSpec, Palm, planIsle, Ripple, sparkles, type IslePlan, type IsleSpec } from './scene-isle-kit.tsx';
import { dayNight, GLOW, Lamps, LINE, PAPER, ROCK, Sailboat, shadeStroke, WOOD, type Placed } from './scene-kit.tsx';

export const geoAware = true;

const WIDE: readonly Bp[] = ['medium', 'expanded'];

const SPEC: IsleSpec = {
  seed: 'isle-valuation',
  // 下方是海峽：南岸是深的岬角（第 5 輪看圖驗收，手機上不再是一條貼著交界的直線）
  southDeep: true,
  anchored: (c) => [
    {
      id: 'coins',
      tier: 'hero',
      ground: ['site'],
      group: 'hero',
      variants: [
        {
          w: 100,
          h: 72,
          bps: WIDE,
          form: 'coins',
          anchors: [
            { wing: 'near', u: 0.08, v: c.v(0.62) },
            { wing: 'near', u: 0.08, v: c.v(0.4) },
            { wing: 'near', u: 0, v: c.v(0.85) },
          ],
        },
        { w: 56, h: 40, form: 'coins-s', anchors: [{ node: 0 }, { node: 1 }, { node: 0, dv: 34 }, { node: 1, dv: -34 }, { node: 0, dv: -34 }] },
      ],
    },
  ],
  around: (c, hero) => [
    {
      id: 'tag',
      tier: 'minor',
      ground: ['site'],
      group: 'hero',
      variants: [
        { w: 28, h: 40, form: 'tag', anchors: [c.beside(hero, 28, 40, 'outer'), c.beside(hero, 28, 40, 'below-out'), c.beside(hero, 28, 40, 'above-out')] },
      ],
    },
    {
      id: 'lamp',
      tier: 'minor',
      ground: ['site'],
      group: 'hero',
      tall: true,
      variants: [{ w: 20, h: 50, form: 'lamp', anchors: [c.beside(hero, 20, 50, 'above'), c.beside(hero, 20, 50, 'below')] }],
    },
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
          anchors: [c.beside(hero, 44, 66, 'above-out'), c.beside(hero, 44, 66, 'outer', -48), c.beside(hero, 44, 66, 'below-out')],
        },
      ],
    },
  ],
  rest: (c) => [
    // 手機（或沒有兩翼）：價目牌與棕櫚在島上的空位；桌面的價目牌已經在主角道具旁邊
    ...(c.wide
      ? []
      : [
          {
            id: 'tag-track',
            tier: 'minor' as const,
            ground: ['meadow'],
            variants: [{ w: 28, h: 40, form: 'tag', anchors: c.spots([0.08, 0.92, 0.5], [0.3, 0.55, 0.15, 0.75]) }],
          },
          // 夜景：島上一盞燈（圖規 6.4），和價目牌算同一組
          {
            id: 'lamp-track',
            tier: 'minor' as const,
            group: 'tag-track',
            ground: ['isle'],
            tall: true,
            variants: [{ w: 20, h: 50, form: 'lamp', anchors: c.spots([0.06, 0.94, 0.62, 0.38], [0.5, 0.25, 0.8, 0.05, 1]) }],
          },
        ]),
    {
      id: 'palm-track',
      tier: 'minor',
      ground: ['isle'],
      tall: true,
      variants: [{ w: 40, h: 60, form: 'palm', anchors: c.spots([0.94, 0.06, 0.7, 0.3], [0.75, 0.45, 0.1, 0.9]) }],
    },
    isletSpec('islet', [
      { wing: 'far', u: 0.55, v: 0.32 },
      { wing: 'far', u: 0.3, v: 0.5 },
      { wing: 'far', u: 0.8, v: 0.22 },
    ]),
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
            { wing: 'near', u: 0.55, v: 0.97 },
            { wing: 'far', u: 0.2, v: 0.82 },
            { wing: 'near', u: 0.7, v: 0.2 },
          ],
        },
      ],
    },
    ...sparkles(
      [
        ['ripple-1', 'far', 0.15, 0.62],
        ['ripple-2', 'near', 0.85, 0.16],
        ['ripple-3', 'far', 0.75, 0.9],
      ],
      'ripple',
    ),
    ...sparkles([['glint-1', 'far', 0.9, 0.5]], 'glint'),
  ],
};

export function planValuation(geo: SceneGeo): IslePlan {
  return planIsle(geo, SPEC);
}

/** 一堆金幣 w × h：幾疊高低不同的金幣（側面、邊線、頂面各合成一個 path），前面一枚立著的金幣 */
function Coins({ w, h, small }: { w: number; h: number; small?: boolean }) {
  const rx = small ? 10 : 13;
  const ry = small ? 4 : 5;
  const t = small ? 4 : 5;
  const yb = h - 5;
  const stacks: readonly (readonly [number, number])[] = small
    ? [
        [w * 0.32, 5],
        [w * 0.7, 3],
      ]
    : [
        [w * 0.22, 4],
        [w * 0.5, 7],
        [w * 0.78, 3],
      ];
  const sides = stacks
    .map(([x, k]) => `M${x - rx} ${yb - k * t}V${yb}A${rx} ${ry} 0 0 0 ${x + rx} ${yb}V${yb - k * t}A${rx} ${ry} 0 0 1 ${x - rx} ${yb - k * t}Z`)
    .join('');
  const edges = stacks
    .flatMap(([x, k]) => Array.from({ length: k - 1 }, (_, j) => `M${x - rx} ${yb - (j + 1) * t}A${rx} ${ry} 0 0 0 ${x + rx} ${yb - (j + 1) * t}`))
    .join('');
  const tops = stacks.map(([x, k]) => `M${x - rx} ${yb - k * t}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`).join('');
  return (
    <>
      <path d={`M${w * 0.08} ${yb + 2}h${w * 0.84}`} {...shadeStroke} strokeWidth="5" strokeLinecap="round" opacity="0.16" />
      <path d={sides} fill={GLOW} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d={edges} fill="none" stroke={LINE} strokeWidth="1" opacity="0.55" />
      <path d={tops} fill={GLOW} stroke={LINE} strokeWidth="1.5" />
      {!small && (
        // 前面一枚立著的金幣（外框與內圈）
        <path
          d={`M${w * 0.62 - 6} ${yb - 10}a6 11 0 1 0 12 0a6 11 0 1 0 -12 0ZM${w * 0.62 - 3} ${yb - 10}a3 7 0 1 0 6 0a3 7 0 1 0 -6 0Z`}
          fill={WOOD}
          stroke={LINE}
          strokeWidth="1.3"
          transform={`rotate(-14 ${w * 0.62} ${yb - 10})`}
        />
      )}
    </>
  );
}

/** 空白的價目牌 28 × 40：木樁加一支橫木，吊著一張有穿孔的牌子（不寫字） */
function Tag() {
  return (
    <>
      <path d="M22 39V5M23 6H11" fill="none" stroke={WOOD} strokeWidth="3.5" strokeLinecap="round" />
      <g transform="rotate(-6 12 8)">
        <path d="M12 7v7" stroke={LINE} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12 12l6 5v16H6V17Z" {...dayNight(PAPER, ROCK)} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="12" cy="18" r="1.6" fill="none" stroke={LINE} strokeWidth="1.2" />
      </g>
    </>
  );
}

function art(p: Placed, gid: string) {
  const w = p.x1 - p.x0;
  const h = p.y1 - p.y0;
  switch (p.form) {
    case 'coins':
      return <Coins w={w} h={h} />;
    case 'coins-s':
      return <Coins w={w} h={h} small />;
    case 'tag':
      return <Tag />;
    case 'lamp':
      return <Lamps at={[{ x: w / 2, y: h - 1, h: h - 12 }]} gid={gid} />;
    case 'palm':
      return <Palm w={w} h={h} />;
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

export default function IsleValuation({ geo }: SceneProps) {
  return <IsleScene geo={geo} plan={planValuation(geo)} art={art} />;
}
