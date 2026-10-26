// 延伸第 3 章「利害關係人觀點」：外海小島（圖規 6.4 的 E03）。島、章節牌沙灘與棧橋見 scene-isle-kit.tsx；主角道具是五棟小屋圍著一圈小路（各方利害關係人），
// 手機是三棟；小路（實線，不是虛線）圍著小屋、從中間往外接出去。桌面放在入口那一翼（島往外長出一塊墊住，旁邊一棵棕櫚），
// 手機放在節點交錯留下的空側。海上有小船、帆船、遠方的小島剪影、短浪與亮點。夜景是小屋的窗光。
import type { Bp, SceneGeo } from '../quest-map/layout.ts';
import type { SceneProps } from '../quest-map/scenes.tsx';
import { AT_SEA, Glint, Islet, IsleScene, isletSpec, Palm, planIsle, Ripple, sparkles, type IslePlan, type IsleSpec } from './scene-isle-kit.tsx';
import { dayNight, FOAM, Glow, GLOW, LINE, PAPER, ROCK, ROOF, Sailboat, SAND, WOOD, type Placed } from './scene-kit.tsx';

export const geoAware = true;

const WIDE: readonly Bp[] = ['medium', 'expanded'];

const SPEC: IsleSpec = {
  seed: 'isle-stakeholders',
  anchored: (c) => [
    {
      id: 'huts',
      tier: 'hero',
      ground: ['site'],
      group: 'hero',
      variants: [
        {
          w: 140,
          h: 90,
          bps: WIDE,
          form: 'huts',
          anchors: [
            { wing: 'near', u: 0.08, v: c.v(0.62) },
            { wing: 'near', u: 0.08, v: c.v(0.4) },
            { wing: 'near', u: 0, v: c.v(0.85) },
          ],
        },
        {
          w: 112,
          h: 72,
          bps: WIDE,
          form: 'huts',
          anchors: [
            { wing: 'near', u: 0, v: c.v(0.62) },
            { wing: 'near', u: 0, v: c.v(0.4) },
          ],
        },
        { w: 80, h: 48, form: 'huts-s', anchors: [{ node: 0 }, { node: 1 }, { node: 0, dv: 30 }, { node: 1, dv: -30 }, { node: 1, dv: 30 }] },
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
          anchors: [c.beside(hero, 44, 66, 'outer', -12), c.beside(hero, 44, 66, 'above-out'), c.beside(hero, 44, 66, 'below-out')],
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
      variants: [{ w: 40, h: 60, form: 'palm', anchors: c.spots([0.06, 0.94, 0.4, 0.75], [0.9, 0.5, 0.2, 0.7]) }],
    },
    {
      id: 'palm-track-2',
      tier: 'minor',
      ground: ['isle'],
      tall: true,
      variants: [{ w: 34, h: 52, form: 'palm', anchors: c.spots([0.94, 0.06, 0.6], [0.3, 0.6, 0.85]) }],
    },
    isletSpec('islet', [
      { wing: 'far', u: 0.6, v: 0.2 },
      { wing: 'far', u: 0.85, v: 0.5 },
      { wing: 'near', u: 0.9, v: 0.15 },
    ]),
    {
      id: 'skiff',
      tier: 'minor',
      ground: AT_SEA,
      whole: true,
      variants: [
        {
          w: 44,
          h: 22,
          form: 'skiff',
          anchors: [
            { wing: 'far', u: 0.35, v: 0.62 },
            { wing: 'far', u: 0.7, v: 0.4 },
            { wing: 'near', u: 0.6, v: 0.95 },
          ],
        },
      ],
    },
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
            { wing: 'near', u: 0.6, v: 0.97 },
            { wing: 'far', u: 0.75, v: 0.95 },
            { wing: 'near', u: 0.8, v: 0.18 },
          ],
        },
      ],
    },
    ...sparkles(
      [
        ['ripple-1', 'far', 0.8, 0.2],
        ['ripple-2', 'near', 0.85, 0.2],
        ['ripple-3', 'far', 0.2, 0.86],
      ],
      'ripple',
    ),
    ...sparkles([['glint-1', 'far', 0.15, 0.4]], 'glint'),
  ],
};

export function planStakeholders(geo: SceneGeo): IslePlan {
  return planIsle(geo, SPEC);
}

/** 一排小屋：[中心 x, 地面 y, 屋寬, 牆高]；牆、屋頂、窗（窗光）、門各合成一個 path */
type Hut = readonly [number, number, number, number];
function Huts({ huts, ring, gid }: { huts: readonly Hut[]; ring: string; gid: string }) {
  const walls = huts.map(([x, y, w, h]) => `M${x - w / 2} ${y}v-${h}h${w}v${h}Z`).join('');
  const roofs = huts.map(([x, y, w, h]) => `M${x - w / 2 - 4} ${y - h + 1}L${x} ${y - h - w * 0.55}L${x + w / 2 + 4} ${y - h + 1}Z`).join('');
  const wins = huts.map(([x, y, w, h]) => `M${x + w * 0.12} ${y - h * 0.72}h${w * 0.24}v${h * 0.3}h-${w * 0.24}Z`).join('');
  const doors = huts.map(([x, y, w, h]) => `M${x - w * 0.32} ${y}v-${h * 0.62}h${w * 0.24}v${h * 0.62}Z`).join('');
  const front = huts.filter((t) => t[2] >= 26);
  // 整組縮放時線寬不跟著縮
  const ns = { vectorEffect: 'non-scaling-stroke' } as const;
  return (
    <>
      {front.map(([x, y, w, h]) => (
        <Glow key={x} x={x + w * 0.24} y={y - h * 0.57} r={18} gid={gid} />
      ))}
      <path d={ring} fill="none" stroke={LINE} strokeWidth="10" strokeLinecap="round" opacity="0.3" {...ns} />
      <path d={ring} fill="none" stroke={SAND} strokeWidth="7" strokeLinecap="round" {...ns} />
      <path d={walls} {...dayNight(PAPER, ROCK)} stroke={LINE} strokeWidth="1.4" strokeLinejoin="round" {...ns} />
      <path d={doors} fill={WOOD} stroke={LINE} strokeWidth="1.2" {...ns} />
      <path d={wins} fill={GLOW} stroke={LINE} strokeWidth="1.2" {...ns} />
      <path d={roofs} fill={ROOF} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" {...ns} />
    </>
  );
}

/** 五棟小屋圍一圈（w × h，以 140 × 90 設計，小一號時整組縮放） */
function Village({ w, h, gid }: { w: number; h: number; gid: string }) {
  const s = Math.min(w / 140, h / 90);
  return (
    <g transform={`translate(${(w - 140 * s) / 2} ${h - 90 * s}) scale(${s})`}>
      <Huts
        gid={gid}
        ring="M20 62C20 49 120 49 120 62C120 75 20 75 20 62ZM70 75Q71 84 63 90"
        huts={[
          [24, 52, 26, 15],
          [70, 45, 26, 15],
          [116, 52, 26, 15],
          [40, 87, 34, 20],
          [100, 87, 34, 20],
        ]}
      />
    </g>
  );
}

/** 三棟小屋 80 × 48（手機） */
function Hamlet({ gid }: { gid: string }) {
  return (
    <Huts
      gid={gid}
      ring="M10 36Q40 26 70 36M40 30Q41 39 35 46"
      huts={[
        [40, 26, 20, 11],
        [16, 46, 26, 15],
        [64, 46, 26, 15],
      ]}
    />
  );
}

/** 小船 44 × 22：船身、兩支槳、船尾的浪花 */
function Skiff() {
  return (
    <>
      <path d="M2 21q10 3 20 0t20 0" fill="none" stroke={FOAM} strokeWidth="2" strokeLinecap="round" />
      <path d="M14 13 6 21M30 13l8 8" stroke={WOOD} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M2 10h40l-6 8H8Z" fill={ROOF} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
    </>
  );
}

function art(p: Placed, gid: string) {
  const w = p.x1 - p.x0;
  const h = p.y1 - p.y0;
  switch (p.form) {
    case 'huts':
      return <Village w={w} h={h} gid={gid} />;
    case 'huts-s':
      return <Hamlet gid={gid} />;
    case 'palm':
      return <Palm w={w} h={h} />;
    case 'skiff':
      return <Skiff />;
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

export default function IsleStakeholders({ geo }: SceneProps) {
  return <IsleScene geo={geo} plan={planStakeholders(geo)} art={art} />;
}
