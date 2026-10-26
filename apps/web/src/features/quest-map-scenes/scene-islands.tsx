// 第 2 章「三表地圖」：海上的群島（圖規 6.4 的 C02）。底色是海（地圖組的 .qm-terrain），這一層畫島（地形塊）與物件：
// - 軌道裡三座小島（沙加草地）各墊在一個節點下方，最後一座往上延伸到章末區：拱門與紙籤（卡片加木樁）外擴 24 都在島上，島頂和上一章的陸地接成一片。
// - 章節牌那一帶是從第 1 章的沙地往上伸的沙灘（圖規 4.4：章節牌立在地上），卡片加立柱外擴 24、入口走廊與往第一座島的彎道都在沙上；
//   外形貼著內容走、岸線有起伏（沒有長直線），底端從 seamCoast 的 x 起筆，第 1 章頂端的兩條海岸在同一個 x，海岸上下接成一條。
// - 路線跨海的地方（島與島之間）是沿路線彎的橋（第 4 輪看圖驗收）：橋面 36px、兩側欄杆、每 10px 一條木板線，兩端各伸 8px 到沙地上；
//   路面與圓點由地圖組畫在上面。
// - medium 以上：入口那一翼的主角道具是插著三面旗（roof、leaf、glow，旗面無字）的小島，旗桿頂有小燈（深色主題才有光暈）；
//   兩翼另有長著小樹的小島、礁石、帆船與海鷗；超寬螢幕離軌道 400px 以外是只有地形的遠方大島。
// - 手機與沒有兩翼的 medium：主角道具是一面旗（40 × 56），插在節點空側的小沙洲上；軌道裡另外最多兩個小東西（島上小樹、礁石）。
// 會長東西的小島在物件放好之後才依物件的位置畫出來（像第 1 章的岸線依棧橋畫），所以著地檢查一定過得了，也不會和節點相撞。
// 島的浪花：同一個 path 先描 5px 的 scene-foam 再填沙色（paint-order），兩座島疊在一起時只剩外圈的浪花，不會在島內交叉。
import type { Bp, Point, Rect, SceneGeo } from '../quest-map/layout.ts';
import { hashSeed, inflate, SEAM, seededRandom } from '../quest-map/layout.ts';
import type { SceneProps } from '../quest-map/scenes.tsx';
import {
  byDepth,
  envelope,
  FOAM,
  Glow,
  GLOW,
  Gulls,
  LEAF,
  LINE,
  MEADOW,
  organic,
  placeProps,
  pointInPoly,
  polyPath,
  Prop,
  rectPoly,
  roughen,
  ROCK_DEEP,
  ROOF,
  Sailboat,
  SAND,
  SceneDefs,
  seamCoast,
  seamWave,
  smoothClosed,
  TerrainRect,
  useSceneIds,
  waveAt,
  WING_REACH,
  WOOD,
  type Anchor,
  type Placed,
  type PropSpec,
  type TerrainBlock,
} from './scene-kit.tsx';

export const geoAware = true;

const WIDE: readonly Bp[] = ['medium', 'expanded'];

/** 主角道具：有兩翼時是三面旗的小島（入口那一翼），沒有時是一面旗（節點的空側） */
const HERO: PropSpec = {
  id: 'flags',
  tier: 'hero',
  ground: ['isle'],
  variants: [
    {
      w: 120,
      h: 100,
      bps: WIDE,
      form: 'flags',
      anchors: [
        { wing: 'near', u: 0.3, v: 0.6 },
        { wing: 'near', u: 0.1, v: 0.5 },
        { wing: 'near', u: 0.5, v: 0.72 },
      ],
    },
    { w: 100, h: 88, bps: WIDE, form: 'flags', anchors: [{ wing: 'near', u: 0, v: 0.6 }] },
    {
      w: 40,
      h: 56,
      form: 'flag',
      anchors: [{ node: 0 }, { node: 1 }, { node: 2 }, { node: 0, dv: -24 }, { node: 1, dv: 24 }],
    },
  ],
};

/** 會長在小島上的東西（兩翼）：小島在放好之後依位置畫出來 */
const LAND: readonly PropSpec[] = [
  {
    id: 'trees-near',
    tier: 'minor',
    ground: ['isle'],
    variants: [
      {
        w: 56,
        h: 46,
        form: 'trees',
        anchors: [
          { wing: 'near', u: 0.55, v: 0.24 },
          { wing: 'near', u: 0.25, v: 0.3 },
          { wing: 'near', u: 0.85, v: 0.36 },
        ],
      },
    ],
  },
  {
    id: 'trees-far',
    tier: 'minor',
    ground: ['isle'],
    variants: [
      {
        w: 56,
        h: 46,
        form: 'trees',
        anchors: [
          { wing: 'far', u: 0.3, v: 0.46 },
          { wing: 'far', u: 0.6, v: 0.4 },
          { wing: 'far', u: 0.1, v: 0.56 },
        ],
      },
    ],
  },
  {
    id: 'tree-far',
    tier: 'minor',
    ground: ['isle'],
    variants: [
      {
        w: 30,
        h: 40,
        form: 'tree',
        anchors: [
          { wing: 'far', u: 0.75, v: 0.86 },
          { wing: 'far', u: 0.4, v: 0.9 },
        ],
      },
    ],
  },
];

/** 軌道裡（手機）：節點小島上的小樹；放在節點小島上，不另外長島，不碰橋 */
const spots = (vs: readonly number[], us: readonly number[]): Anchor[] => vs.flatMap((v) => us.map((u) => ({ track: true as const, u, v })));
const TRACK_LAND: readonly PropSpec[] = [
  {
    id: 'tree-track',
    tier: 'minor',
    ground: ['isle', '!pier'],
    variants: [{ w: 26, h: 34, form: 'tree', anchors: spots([0.36, 0.62, 0.5, 0.74], [0.5, 0.35, 0.65, 0.2, 0.8]) }],
  },
];

/** 水裡的東西：整個在海裡、不碰到任何島與橋 */
const SEA_ONLY = ['sea', '!isle', '!pier'];
const WATER: readonly PropSpec[] = [
  {
    id: 'boat-near',
    tier: 'minor',
    ground: SEA_ONLY,
    whole: true,
    variants: [
      {
        w: 48,
        h: 56,
        form: 'sailboat',
        anchors: [
          { wing: 'near', u: 0.75, v: 0.13 },
          { wing: 'near', u: 0.4, v: 0.12 },
          { wing: 'near', u: 0.95, v: 0.2 },
        ],
      },
    ],
  },
  {
    id: 'gulls-near',
    tier: 'minor',
    group: 'boat-near',
    ground: SEA_ONLY,
    whole: true,
    variants: [
      {
        w: 36,
        h: 14,
        form: 'gulls',
        anchors: [
          { wing: 'near', u: 0.2, v: 0.07 },
          { wing: 'near', u: 0.5, v: 0.05 },
        ],
      },
    ],
  },
  {
    id: 'reef-near',
    tier: 'minor',
    ground: SEA_ONLY,
    whole: true,
    variants: [
      {
        w: 48,
        h: 24,
        form: 'reef',
        anchors: [
          { wing: 'near', u: 0.6, v: 0.88 },
          { wing: 'near', u: 0.2, v: 0.84 },
          { wing: 'near', u: 0.9, v: 0.94 },
        ],
      },
    ],
  },
  {
    id: 'boat-far',
    tier: 'minor',
    ground: SEA_ONLY,
    whole: true,
    variants: [
      {
        w: 48,
        h: 56,
        form: 'sailboat',
        anchors: [
          { wing: 'far', u: 0.5, v: 0.68 },
          { wing: 'far', u: 0.85, v: 0.7 },
          { wing: 'far', u: 0.2, v: 0.74 },
        ],
      },
    ],
  },
  {
    id: 'reef-far',
    tier: 'minor',
    ground: SEA_ONLY,
    whole: true,
    variants: [
      {
        w: 48,
        h: 24,
        form: 'reef',
        anchors: [
          { wing: 'far', u: 0.25, v: 0.2 },
          { wing: 'far', u: 0.7, v: 0.16 },
          { wing: 'far', u: 0.5, v: 0.26 },
        ],
      },
    ],
  },
  {
    id: 'reef-track',
    tier: 'minor',
    ground: SEA_ONLY,
    whole: true,
    variants: [{ w: 36, h: 18, form: 'reef', anchors: spots([0.3, 0.5, 0.42], [0.5, 0.3, 0.7]) }],
  },
  // 水面的短浪（細節，不佔組的名額）
  ...(
    [
      ['ripple-1', 'near', 0.45, 0.4],
      ['ripple-2', 'far', 0.4, 0.94],
      ['ripple-3', 'far', 0.8, 0.3],
    ] as const
  ).map(([id, wing, u, v]): PropSpec => ({
    id,
    tier: 'detail',
    ground: SEA_ONLY,
    whole: true,
    variants: [
      {
        w: 30,
        h: 10,
        form: 'ripple',
        anchors: [
          { wing, u, v },
          { wing, u: u * 0.6, v: v - 0.05 },
          { wing, u: Math.min(1, u + 0.2), v: v + 0.06 },
        ],
      },
    ],
  })),
];

// ---------------------------------------------------------------------------------------------
// 島的形狀

/** 橢圓上的 n 個控制點；半徑只往外隨機放大 0 到 12%，島一定蓋得住原本的橢圓（種子決定） */
function oval(cx: number, cy: number, rx: number, ry: number, rand: () => number, n = 9): Point[] {
  const a0 = rand() * Math.PI;
  return Array.from({ length: n }, (_, i) => {
    const a = a0 + (i / n) * Math.PI * 2;
    const k = 1 + 0.12 * rand();
    return { x: cx + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k };
  });
}

/** 凸包（monotone chain） */
function hull(pts: readonly Point[]): Point[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: readonly Point[]) => {
    const out: Point[] = [];
    for (const q of list) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, q) <= 0) out.pop();
      out.push(q);
    }
    out.pop();
    return out;
  };
  return [...half(p), ...half([...p].reverse())];
}

export interface Isle {
  readonly d: string;
  readonly poly: readonly Point[];
  /** 島上的草地（沙灘內側），可以有好幾塊 */
  readonly meadow: string;
  /** 最後一座島：閉運算補上陸地的那幾列（小灣上緣的圓弧，測試檢查圓弧兩端接得順） */
  readonly bays?: readonly Point[];
}

/** 統一成正面積的方向：島、長出來的小島與章節牌沙灘畫在同一個 path（nonzero），方向不同時重疊的地方會變成洞（第 2 輪：小旗的小島和沙灘重疊處破了一個洞） */
function orient(pts: Point[]): Point[] {
  let a = 0;
  for (let i = 0; i < pts.length; i++) a += pts[i]!.x * pts[(i + 1) % pts.length]!.y - pts[(i + 1) % pts.length]!.x * pts[i]!.y;
  return a < 0 ? pts.reverse() : pts;
}

function makeIsle(seed: string, outer: readonly Point[][], inner: readonly Point[][], rough = 7): Isle {
  const { d, poly } = smoothClosed(orient(roughen(hull(outer.flat()), seed, rough)));
  return { d, poly, meadow: inner.map((pts) => smoothClosed(pts).d).join('') };
}

/** 物件腳下的小島：底線與底線往上 30% 的那一排都在島內（著地檢查一定過） */
function isleUnder(p: Rect, seed: string, extra = 0): Isle {
  const rand = seededRandom(hashSeed(seed));
  const w = p.x1 - p.x0;
  const h = p.y1 - p.y0;
  const cx = (p.x0 + p.x1) / 2;
  const cy = p.y1 - 0.15 * h;
  const rx = w / 2 + 24 + extra;
  const ry = 0.15 * h + 16 + extra * 0.3;
  return makeIsle(seed, [oval(cx, cy, rx, ry, rand)], [oval(cx + rx * 0.12, cy - 4, rx * 0.62, ry * 0.5, rand, 7)], 4);
}

/**
 * 章節牌沙灘（第 2 輪看圖驗收：原本兩側是 160 到 200px 的垂直直線，把軌道框成一塊板子）：必須墊住的是章節牌（卡片加立柱）外擴 24
 * 與入口走廊到第一座島的那一段路（外擴 24）；外形是這些框聯集外擴之後的每列極值（scene-kit 的 envelope），
 * 再用和其他章同一個擺動函式（organic：振幅 12，往外 0 到 24、波長 80 到 140 與 150 到 230）往外推，兩側在立柱附近自然內縮或外凸。
 * 底端從 seamCoast 的 xa、xb 起筆（第 1 章頂端的兩條海岸在同一個 x），在章底往上 48px 內過渡到自己的形狀，海岸上下接成一條；
 * 離畫面邊不到 48px 的岸線推到畫面外（手機的沙灘鋪滿整個寬度）
 */
export function beach(geo: SceneGeo, road: readonly Point[]): Isle | null {
  const ban = geo.protect.find((p) => p.kind === 'banner');
  if (!ban) return null;
  const H = geo.h;
  const { xa, xb } = seamCoast(geo);
  const n0 = geo.nodes[0];
  const rects: Rect[] = [{ ...ban, y1: Math.min(ban.y1, H) }];
  for (const p of road) {
    if (n0 && Math.hypot(p.x - n0.x, p.y - n0.y) < 70) break;
    rects.push({ x0: p.x - 18, y0: p.y - 18, x1: p.x + 18, y1: p.y + 18 });
  }
  const PAD = 24;
  const top = Math.min(...rects.map((r) => r.y0)) - PAD;
  const env = envelope(rects, PAD, top, H - 44, 12);
  const snapL = (x: number) => (x < 48 ? -80 : x);
  const snapR = (x: number) => (x > geo.bandW - 48 ? geo.bandW + 80 : x);
  const left = env.ys.map((y, i) => ({ x: snapL(Math.min(env.L[i]!, y > H - 70 ? xa + 24 : Infinity)), y }));
  const right = env.ys.map((y, i) => ({ x: snapR(Math.max(env.R[i]!, y > H - 70 ? xb - 24 : -Infinity)), y }));
  const ctrl: Point[] = [
    ...left,
    { x: xa, y: H - 14 },
    { x: xa, y: H - 2 },
    { x: xa, y: H + 12 },
    { x: xa, y: H + 40 },
    { x: xb, y: H + 40 },
    { x: xb, y: H + 12 },
    { x: xb, y: H - 2 },
    { x: xb, y: H - 14 },
    ...right.reverse(),
  ];
  // 章底往上 20px 以內與畫面外的點不推（和第 1 章對齊的那一段），往上 64px 內漸漸加到全幅
  const keep = (p: Point) => (p.x < -40 || p.x > geo.bandW + 40 ? 0 : Math.min(1, Math.max(0, (H - 20 - p.y) / 44)));
  const { d, poly } = smoothClosed(orient(organic(ctrl, 'c02 beach', 12, keep)));
  return { d, poly, meadow: '' };
}

/** envelope 的左右界在任意 y 的值（列與列之間線性內插） */
function envAt(env: { ys: readonly number[]; L: readonly number[]; R: readonly number[] }, y: number): { l: number; r: number } {
  const { ys, L, R } = env;
  if (y <= ys[0]!) return { l: L[0]!, r: R[0]! };
  for (let i = 1; i < ys.length; i++)
    if (y <= ys[i]!) {
      const t = (y - ys[i - 1]!) / (ys[i]! - ys[i - 1]!);
      return { l: L[i - 1]! + (L[i]! - L[i - 1]!) * t, r: R[i - 1]! + (R[i]! - R[i - 1]!) * t };
    }
  return { l: L.at(-1)!, r: R.at(-1)! };
}

/** 島頂兩側的圓角半徑：上一章是陸地時往外彎進接縫的海岸（第 6 輪 handoff：至少 40），上方是海峽（blend）時往島內收（第 7 輪看圖驗收） */
const FILLET = 48;
/** 島側凹進去的轉角（紙籤下方的小灣上緣、節點與章末區之間）最小的圓弧半徑：比 organic 最大的推出量（約 23px）大，往外推之後凹處不會折出交叉的小圈 */
const BAY_R = 52;
/** 小灣上緣的圓弧以外，起伏在這段距離內由 0 漸漸加到全幅 */
const BAY_KEEP = 72;
/** 島側凸出去的轉角最小的圓弧半徑（envelope 的外擴只有 16，12px 一列取樣後轉角很尖） */
const KNEE_R = 48;
/** blend 的島頂：從圓角上端起，沿這段距離由「波浪最低點往下 4px」那一列漸漸回到波浪往下 2px（切線在圓角上端是水平的） */
const EASE_RUN = 40;

/**
 * 每列左右界的形態學閉運算（先往外長 rad、再往內收 rad，只會補上陸地）：凹進去的轉角變成半徑 rad 的圓弧。
 * sgn 是 -1（左界）或 1（右界）；上下各補 rad 的空列，島頭島尾的圓角不會被拉平
 */
function closeRows(ys: readonly number[], xs: readonly number[], sgn: number, rad: number, none = sgn < 0 ? Infinity : -Infinity): number[] {
  const step = ys.length > 1 ? ys[1]! - ys[0]! : 4;
  const k = Math.ceil(rad / step);
  const Y = [
    ...Array.from({ length: k }, (_, i) => ys[0]! - step * (k - i)),
    ...ys,
    ...Array.from({ length: k }, (_, i) => ys[ys.length - 1]! + step * (i + 1)),
  ];
  const v = [...Array<number>(k).fill(none), ...xs, ...Array<number>(k).fill(none)];
  const reach = (arr: readonly number[], i: number, d: number, pick: (a: number, b: number) => number) => {
    let best = arr[i]! + d * rad;
    for (let j = Math.max(0, i - k); j <= Math.min(Y.length - 1, i + k); j++) {
      const dy = Math.abs(Y[j]! - Y[i]!);
      if (j !== i && dy < rad) best = pick(best, arr[j]! + d * Math.sqrt(rad * rad - dy * dy));
    }
    return best;
  };
  const out = sgn < 0 ? Math.min : Math.max;
  const inn = sgn < 0 ? Math.max : Math.min;
  const grown = v.map((_, i) => reach(v, i, sgn, out));
  return grown.map((_, i) => reach(grown, i, -sgn, inn)).slice(k, k + xs.length);
}

/**
 * 最後一座島（第 3 輪看圖驗收：紙籤的木樁立在海上、拱門只有台座踩在島緣、上半部懸在水上，違反 12.4 的地標感與 6.4 C02）：
 * 節點（圓盤與星星籤）、走到拱門的那一段路、拱門外擴 24 與紙籤（卡片加木樁）外擴 24 的框先聯集，每列取左右極值（envelope，外擴 16），
 * 凹進去的轉角（紙籤下方小灣的上緣）用半徑 BAY_R 的圓收圓（第 7 輪看圖驗收：小灣上緣是尖角，往外推起伏之後還折出一道露出浪花的細縫），
 * 再沿外法線推出起伏（organic，振幅 10）；拱門與紙籤在章的頂端，所以島一路伸出區段頂端（畫面外的那一段不推），
 * 接縫由 Islands 照 geo.seam 蓋回去（和第 10 章的岩坡同一種做法），島和上一章的陸地接成一片，跨到上一章的那一段不再是棧橋。
 * 離畫面邊不到 48px 的岸線推到畫面外（手機的島頂鋪滿整個寬度，不留細縫）。第 8 輪看圖驗收（fixture 375 的小灣上緣圓弧往下接回島側時折出小肩）：
 * 先推到畫面外再收圓，圓弧和灣頂、島側都相切；凸出去的轉角也收成半徑 KNEE_R 的圓；圓弧上不推起伏，離開圓弧 BAY_KEEP 內漸漸加回；岸線點距約 12px（長段補點）。
 * - 上一章是陸地（正式內容：第 3 章的廣場）：島的兩側在接縫下方彎成半徑 48 的圓角（FILLET），圓角上端水平、落在該側的波浪上，
 *   島的浪花與淺灘沿圓角接進地圖的接縫海岸，不再和海岸成直角（第 5 輪看圖驗收問題 2、第 6 輪 handoff）。這一段不推起伏，曲線保持乾淨。
 * - 上一章是另一種深淺的海（geo.seam.blend，只有 fixture 的第 2 章頂端接海峽）：島頂不越過接縫，沿波浪往下 2px 收出自己的北岸，
 *   浪花與淺灘只在島頂；海峽的棧橋伸過波浪 8px，落在這段北岸上。島頂兩角是往外凸的圓角（第 7 輪看圖驗收：原本往外彎的圓角讓島頂沿波浪多伸出一截、
 *   兩端收成尖岬，像鐵砧）：四分之一圓同時和島側、和「該角波浪最低點往下 4px」那一列相切，島頂比島身窄；島頂離開圓角上端後在 EASE_RUN 內回到波浪往下 2px
 */
function endIsle(geo: SceneGeo, n: Point, road: readonly Point[]): Isle {
  const arch = geo.protect.find((p) => p.kind === 'arch')!;
  const plaque = geo.protect.find((p) => p.kind === 'plaque');
  // 保護框本身已經外擴（拱門 8、紙籤與木樁 12），再補到 24；兩者都往上拉到區段頂端之外，島頂整段越過接縫（不在拱門旁留一角海）
  const up = (r: Rect): Rect => ({ ...r, y0: -48 });
  const rects: Rect[] = [up(inflate(arch, 16)), ...(plaque ? [up(inflate(plaque, 12))] : []), { x0: n.x - 84, y0: n.y - 50, x1: n.x + 84, y1: n.y + 74 }];
  const from = road.findIndex((p) => Math.hypot(p.x - n.x, p.y - n.y) < 4);
  if (from >= 0)
    for (const p of road.slice(from)) {
      if (p.y < arch.y0) break;
      rects.push({ x0: p.x - 30, y0: p.y - 30, x1: p.x + 30, y1: p.y + 30 });
    }
  const bottom = Math.max(...rects.map((r) => r.y1)) + 12;
  // 每 4px 一列算外形與閉運算，再每 12px 取一列（organic 的法線取前後兩點，列太密時法線不平順）。
  // 離畫面邊不到 48px 的岸先推到畫面外、再做閉運算（第 8 輪看圖驗收：原本先收圓角再推，圓角靠畫面邊的那一半被推掉，
  // 剩下的陡段和水平的灣頂在小灣上緣折出一個小肩）：灣頂和島側之間是一整段和兩邊都相切的圓弧，閉運算之後不再推
  const snapL = (x: number) => (x < 48 ? -80 : x);
  const snapR = (x: number) => (x > geo.bandW - 48 ? geo.bandW + 80 : x);
  const fine = envelope(rects, 16, -48, bottom, 4);
  const Ls = fine.L.map(snapL);
  const Rs = fine.R.map(snapR);
  const Lb = closeRows(fine.ys, Ls, -1, BAY_R);
  const Rb = closeRows(fine.ys, Rs, 1, BAY_R);
  // 凸出去的轉角（島底的兩個角、島身往內縮的那幾列）也收成半徑 KNEE_R 的圓（開運算：sgn 反過來就是先往內收再往外長，頭尾補的空列是沒有陸地）
  const Lc = closeRows(fine.ys, Lb, 1, KNEE_R, Infinity);
  const Rc = closeRows(fine.ys, Rb, -1, KNEE_R, -Infinity);
  const pick = <T,>(a: readonly T[]) => a.filter((_, i) => i % 3 === 0 || i === a.length - 1);
  const env = { ys: pick(fine.ys), L: pick(Lc), R: pick(Rc) };
  const wave = seamWave(geo);
  const blend = !!geo.seam?.blend && wave.length > 1;
  const ref = envAt(env, 40);
  // 圓角半徑：上一章是陸地時往外彎，該側離畫面邊還要留 56px；blend 時往內收，島頂至少留 160px。最多 FILLET，小於 16 就不做
  const radius = (room: number) => (geo.seam?.coast && wave.length > 1 ? Math.min(FILLET, Math.max(0, room)) : 0);
  const roomL = blend ? (ref.l < 48 ? 0 : (ref.r - ref.l - 160) / 2) : ref.l - 56;
  const roomR = blend ? (ref.r > geo.bandW - 48 ? 0 : (ref.r - ref.l - 160) / 2) : geo.bandW - ref.r - 56;
  const rl = radius(roomL) >= 16 ? radius(roomL) : 0;
  const rr = radius(roomR) >= 16 ? radius(roomR) : 0;
  const below = (x0: number, x1: number) => Math.max(waveAt(wave, x0), waveAt(wave, x1), ...wave.filter((p) => p.x > x0 && p.x < x1).map((p) => p.y)) + 4;
  // 圓角上端：上一章是陸地時在圓角外緣那一點的波浪上（波浪以上被蓋回）；blend 時在圓角與緩和段那一段波浪最低點往下 4px
  const ywl = rl ? (blend ? below(ref.l, ref.l + rl + EASE_RUN) : waveAt(wave, ref.l - rl)) : 0;
  const ywr = rr ? (blend ? below(ref.r - rr - EASE_RUN, ref.r) : waveAt(wave, ref.r + rr)) : 0;
  // 圓角在 y 的水平位移：往外彎（陸地）是 r 到 0 的凹弧；往內收（blend）是 r 到 0 的凸弧
  const arcX = (r: number, dy: number) => r - Math.sqrt(Math.max(0, r * r - dy * dy));
  const fillet = (r: number, yw: number, y: number) => (r === 0 || y >= yw + r ? 0 : blend ? -arcX(r, yw + r - y) : y <= yw ? r : arcX(r, r - (y - yw)));
  // 列：envelope 的列，圓角那一段改成每 3px 一列（圓角的點原樣保留，不推起伏；落在圓角裡的 envelope 列拿掉，間距不勻時平滑曲線會在圓角上折出小圈）
  const arc = (r: number, yw: number) => (r ? Array.from({ length: Math.ceil(r / 3) + 1 }, (_, i) => yw + Math.min(r, i * 3)) : []);
  const rows = (r: number, yw: number) => [...new Set([...fine.ys.filter((y) => !r || y < yw - 2 || y > yw + r + 2), ...arc(r, yw)])].sort((a, b) => a - b);
  // 岸線用每 4px 一列的外形，沿岸每 12px 弧長留一點（圓角裡的點全留）：小灣上緣的圓弧在水平的那一段也有足夠的點，organic 的法線沿弧平順轉過去，
  // 不會在圓弧接回島側的地方折出小肩（第 8 輪看圖驗收；原本每 12px 一列，圓弧近水平的那一段只剩一兩點）
  const thin = (pts: readonly Point[], r: number, yw: number) =>
    pts.filter((p, i, a) => {
      if (i === 0 || i === a.length - 1 || (r && p.y >= yw - 2 && p.y <= yw + r + 2)) return true;
      let j = i - 1;
      while (j > 0 && !kept.has(a[j]!)) j--;
      const q = a[j]!;
      const ok = Math.hypot(p.x - q.x, p.y - q.y) >= 12;
      if (ok) kept.add(p);
      return ok;
    });
  const kept = new Set<Point>();
  // 海峽下方（blend）：兩側從圓角上端（沒有圓角時是波浪最低點往下 4px）那一列開始
  const cut = blend ? Math.max(...wave.map((p) => p.y)) + 4 : -Infinity;
  const cutL = blend && rl ? ywl : cut;
  const cutR = blend && rr ? ywr : cut;
  const fineEnv = { ys: fine.ys, L: Lc, R: Rc };
  const left = thin(
    rows(rl, ywl)
      .filter((y) => y >= cutL)
      .map((y) => ({ x: envAt(fineEnv, y).l - fillet(rl, ywl, y), y })),
    rl,
    ywl,
  );
  const right = thin(
    rows(rr, ywr)
      .filter((y) => y >= cutR)
      .map((y) => ({ x: envAt(fineEnv, y).r + fillet(rr, ywr, y), y })),
    rr,
    ywr,
  );
  // blend 的島頂：波浪往下 2px；離圓角上端 EASE_RUN 以內漸漸降到圓角上端那一列（smoothstep，切線在圓角上端是水平的）
  const ease = (t: number) => {
    const u = Math.min(1, Math.max(0, t));
    return u * u * (3 - 2 * u);
  };
  const x0 = left[0]!.x;
  const x1 = right[0]!.x;
  const topY = (p: Point) => {
    const y = p.y + 2;
    const wl = rl ? 1 - ease((p.x - x0) / EASE_RUN) : 0;
    const wr = rr ? 1 - ease((x1 - p.x) / EASE_RUN) : 0;
    return y + Math.max(0, ywl - y) * wl + Math.max(0, ywr - y) * wr;
  };
  const top = blend ? wave.filter((p) => p.x > x0 + 4 && p.x < x1 - 4).map((p) => ({ x: p.x, y: topY(p) })) : [];
  // 長的一段（小灣灣頂從圓弧上端推到畫面外的那一段、島底）每 12px 補一點：點距不勻時平滑曲線在短段那一頭繞出小鉤（第 8 輪看圖驗收）
  const ring = [...[...top].reverse(), ...left, ...right.reverse()].flatMap((p, i, a) => {
    const q = a[(i + 1) % a.length]!;
    const off = (r: Point) => r.x < -40 || r.x > geo.bandW + 40 || r.y < -24;
    const k = off(p) && off(q) ? 1 : Math.max(1, Math.round(Math.hypot(q.x - p.x, q.y - p.y) / 12));
    return Array.from({ length: k }, (_, j) => ({ x: p.x + ((q.x - p.x) * j) / k, y: p.y + ((q.y - p.y) * j) / k }));
  });
  // 起伏：區段頂端以上、畫面外、圓角與海峽下方的北岸不推；之後漸漸加到全幅（原本 24px；有圓角時 64px 的 smoothstep，
  // 圓角下端是垂直的岸，馬上推出起伏會在圓角下面折出一個角）
  const calm = Math.max(blend ? cut : -8, rl ? ywl + rl : -8, rr ? ywr + rr : -8);
  const ramp = rl || rr || blend ? 64 : 24;
  // 閉運算補上陸地的列（小灣上緣的圓弧）不推起伏，離開圓弧 BAY_KEEP 內漸漸加回（第 8 輪看圖驗收：圓弧上照樣推起伏，凹的圓弧被扭成 S 形，
  // 接回島側的地方折出一個小肩）：圓弧本身和灣頂、島側都相切，起伏從圓弧兩端以外才開始
  const bays: Point[] = [];
  fine.ys.forEach((y, i) => {
    for (const [c, s] of [
      [Lb[i]!, Ls[i]!],
      [Rb[i]!, Rs[i]!],
    ] as const)
      if (Math.abs(c - s) > 0.05 && c > 0 && c < geo.bandW && y > 0) bays.push({ x: c, y });
  });
  const bayKeep = (p: Point) => (bays.length ? ease(Math.min(...bays.map((b) => Math.hypot(p.x - b.x, p.y - b.y))) / BAY_KEEP) : 1);
  const keep = (p: Point) =>
    (p.y < calm || p.x < -40 || p.x > geo.bandW + 40 ? 0 : ramp === 24 ? Math.min(1, (p.y - calm) / ramp) : ease((p.y - calm) / ramp)) * bayKeep(p);
  const { d, poly } = smoothClosed(orient(organic(ring, 'c02 end isle', 10, keep)));
  const rand = seededRandom(hashSeed('end isle'));
  const ax = (arch.x0 + arch.x1) / 2;
  const meadow = [oval(n.x + 6, n.y + 2, 54, 38, rand, 7), oval(ax + 6, arch.y1 - 30, 42, 20, rand, 7)].map((pts) => smoothClosed(pts).d).join('');
  return { d, poly, meadow, bays };
}

/**
 * 跨海的橋（第 4 輪看圖驗收：原本是沿路線取樣點、寬 40 的甲板壓在沙下，岸線斜切過甲板，看起來像固定角度的直板橋、路面斜穿過去）：
 * 橋由路線本身產生。路線離開沙地與回到沙地的兩點之間（每 2px 檢查一次）是跨海的那一段，兩端各多伸 8px 到沙地上；
 * 橋面是這段子路徑 stroke 成 36px 的 scene-wood（路面 20px 置中，兩側各露出 8px 木板），欄杆是同一條路徑往兩側偏 18px 的 1.5px scene-line，
 * 木板線是沿路徑每 10px 一條垂直於切線的 1px 短線，四個角各一根小橋柱。橋畫在沙地之上：兩端的平頭落在沙上，不被岸線斜切
 */
export interface Bridge {
  /** 橋面中心線（每 4px 一點） */
  readonly deck: string;
  /** 兩側欄杆 */
  readonly rails: string;
  readonly planks: string;
  /** 四個角的橋柱 */
  readonly posts: string;
  /** 橋面外擴 2px 的外框（地形塊 pier：海上的物件不得碰到） */
  readonly poly: readonly Point[];
}

const r1 = (n: number) => Math.round(n * 10) / 10;
/** 橋面半寬、兩端伸到沙地上的長度、木板間距 */
const DECK = 18;
const TUCK = 8;
const PLANK = 10;

/** 折線的弧長參數化：at(s) 是弧長 s 的位置與單位切線（切線取前後 3px 的弦，轉彎處的法線平順） */
function arcOf(pts: readonly Point[]) {
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  const total = len[len.length - 1]!;
  const pos = (s: number): Point => {
    const t0 = Math.min(total, Math.max(0, s));
    let i = 1;
    while (i < pts.length - 1 && len[i]! < t0) i++;
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const t = Math.min(1, Math.max(0, (t0 - len[i - 1]!) / Math.max(0.01, len[i]! - len[i - 1]!)));
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  };
  const at = (s: number) => {
    const p = pos(s);
    const a = pos(s - 3);
    const b = pos(s + 3);
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: p.x, y: p.y, tx: (b.x - a.x) / l, ty: (b.y - a.y) / l };
  };
  return { total, at };
}

/** 一座橋：弧長 a 到 b 的子路徑 */
function bridge(A: ReturnType<typeof arcOf>, a: number, b: number): Bridge {
  const n = Math.max(2, Math.ceil((b - a) / 4));
  const P = Array.from({ length: n + 1 }, (_, i) => A.at(a + ((b - a) * i) / n));
  // 法線 (-ty, tx)
  const off = (k: number) => P.map((p) => ({ x: p.x - p.ty * k, y: p.y + p.tx * k }));
  const line = (q: readonly Point[]) => `M${q.map((p) => `${r1(p.x)} ${r1(p.y)}`).join('L')}`;
  const planks: string[] = [];
  for (let s = a + PLANK / 2; s < b - 2; s += PLANK) {
    const p = A.at(s);
    planks.push(`M${r1(p.x + p.ty * DECK)} ${r1(p.y - p.tx * DECK)}L${r1(p.x - p.ty * DECK)} ${r1(p.y + p.tx * DECK)}`);
  }
  const posts: string[] = [];
  for (const s of [a + 3, b - 3]) {
    const p = A.at(s);
    for (const k of [-DECK, DECK]) {
      const cx = p.x - p.ty * k;
      const cy = p.y + p.tx * k;
      const q = [
        [3, 3],
        [3, -3],
        [-3, -3],
        [-3, 3],
      ].map(([u, v]) => `${r1(cx + p.tx * u! - p.ty * v!)} ${r1(cy + p.ty * u! + p.tx * v!)}`);
      posts.push(`M${q.join('L')}Z`);
    }
  }
  return {
    deck: line(P),
    rails: `${line(off(-DECK))}${line(off(DECK))}`,
    planks: planks.join(''),
    posts: posts.join(''),
    poly: [...off(-DECK - 2), ...off(DECK + 2).reverse()],
  };
}

/** 路線的中心線：道路保護框（layout 每 8px 一點、依路線順序）的中心，相鄰重複的點去掉 */
function routeLine(geo: SceneGeo): Point[] {
  const out: Point[] = [];
  for (const r of geo.protect) {
    if (r.kind !== 'road') continue;
    const p = { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 };
    const q = out[out.length - 1];
    if (!q || Math.hypot(p.x - q.x, p.y - q.y) > 0.5) out.push(p);
  }
  return out;
}

/** 路線跨海的每一段各一座橋：沿路線每 2px 檢查在不在沙地上，離岸與上岸兩點之間（不到 6px 的擦邊不算）兩端各多 8px */
function bridges(road: readonly Point[], land: readonly (readonly Point[])[]): Bridge[] {
  if (road.length < 2) return [];
  const A = arcOf(road);
  const wet = (s: number) => {
    const p = A.at(s);
    return !land.some((poly) => pointInPoly(p, poly));
  };
  const out: Bridge[] = [];
  for (let s = 0; s <= A.total; s += 2) {
    if (!wet(s)) continue;
    let e = s;
    while (e + 2 <= A.total && wet(e + 2)) e += 2;
    if (e - s >= 6) out.push(bridge(A, Math.max(0, s - 1 - TUCK), Math.min(A.total, e + 1 + TUCK)));
    s = e;
  }
  return out;
}

export interface IslandsPlan {
  readonly blocks: readonly TerrainBlock[];
  readonly isles: readonly Isle[];
  /** 章節牌沙灘（沒有淺灘的外圈） */
  readonly beach: Isle | null;
  /** 畫出來的橋（blend 時跨過區段頂端的那一座由海峽的棧橋代替，不在這裡；地形塊 pier 仍包含它） */
  readonly bridges: readonly Bridge[];
  readonly props: readonly Placed[];
}

/** 構圖（純函式，測試也用）：節點小島 → 主角道具與兩翼長在島上的東西 → 依它們長出小島 → 水裡的東西 */
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

export function planIslands(input: SceneGeo): IslandsPlan {
  const geo = strict(input);
  const sea: TerrainBlock = { id: 'sea', poly: rectPoly({ x0: 0, y0: SEAM, x1: geo.bandW, y1: geo.h }) };
  const last = geo.nodes.length - 1;
  const arch = geo.protect.find((p) => p.kind === 'arch');
  // 節點小島：圓盤與星星籤都在島上；最後一座往上延伸到章末區，拱門與紙籤都立在島上（endIsle）
  const road = routeLine(input);
  const isles: Isle[] = geo.nodes.map((n, i) => {
    if (i === last && arch) return endIsle(input, n, road);
    const rand = seededRandom(hashSeed(`isle ${i}`));
    return makeIsle(`isle ${i}`, [oval(n.x, n.y + 12, 84, 62, rand)], [oval(n.x + 6, n.y + 2, 54, 38, rand, 7)], 10);
  });
  // 超寬螢幕：離軌道 400px 以外那一塊有 160px 以上時，畫一座只有地形的遠方大島（貼著區帶外緣）
  const outerL = geo.track.left - WING_REACH;
  if (geo.wings.left && outerL >= 160) {
    const rand = seededRandom(hashSeed('far left'));
    isles.push(
      makeIsle(
        'far left',
        [oval(outerL * 0.42, geo.h * 0.42, outerL * 0.62, geo.h * 0.2, rand, 11)],
        [oval(outerL * 0.4, geo.h * 0.4, outerL * 0.4, geo.h * 0.12, rand, 9)],
        14,
      ),
    );
  }
  const outerR = geo.bandW - (geo.track.right + WING_REACH);
  if (geo.wings.right && outerR >= 160) {
    const rand = seededRandom(hashSeed('far right'));
    const cx = geo.bandW - outerR * 0.42;
    isles.push(
      makeIsle('far right', [oval(cx, geo.h * 0.66, outerR * 0.62, geo.h * 0.16, rand, 11)], [oval(cx, geo.h * 0.64, outerR * 0.38, geo.h * 0.1, rand, 9)], 14),
    );
  }
  const fixed = isles.map((s) => ({ id: 'isle', poly: s.poly }));

  // 主角道具與兩翼長在島上的東西：先用「到處都是島」放，再依位置長出小島
  const anywhere: TerrainBlock = { id: 'isle', poly: rectPoly({ x0: 0, y0: SEAM, x1: geo.bandW, y1: geo.h }) };
  // 長出來的小島比物件框寬 24 到 34、外圈淺灘再 10：兩翼靠外緣那一側先收 52px，小島和淺灘都留在畫面裡（finding：1024 寬右緣的小樹島被裁掉）
  const inner: SceneGeo = {
    ...geo,
    bandW: geo.bandW - 44,
    wings: {
      left: geo.wings.left ? { ...geo.wings.left, x0: Math.max(geo.wings.left.x0, 52) } : null,
      right: geo.wings.right ? { ...geo.wings.right, x1: geo.wings.right.x1 - 44 } : null,
    },
  };
  const [hero] = placeProps([HERO], inner, { blocks: [anywhere] });
  const taken = hero ? [hero] : [];
  const wingLand = hero?.region === 'track' ? [] : placeProps(LAND, inner, { blocks: [anywhere], taken });
  const grown = [...(hero ? [hero] : []), ...wingLand].map((p, i) => isleUnder(p, `grown ${p.id}`, p.tier === 'hero' ? 6 : i % 2 ? 10 : 2));
  const allIsles = [...isles, ...grown];
  const shore = beach(input, road);
  const spans = bridges(road, [...(shore ? [shore.poly] : []), ...allIsles.map((s) => s.poly)]);
  // 海峽下方（blend，只有 fixture 的第 2 章頂端接海峽）：從區段頂端跨到島頂北岸的那一座橋不畫。海峽的棧橋（QuestMap 的 PierStub，甲板 ±20、繩子 ±24）
  // 已經越過波浪伸到岸上 8px，蓋在這座橋上面，兩層的橋柱錯開約 1.5px，5 倍看是雙層的輪廓（第 7 輪 handoff）。
  // 它仍是放置用的地形塊 pier（棧橋那一帶的海面不放東西），只是不畫出來
  const wave = input.seam?.blend ? seamWave(input) : [];
  const seamTop = wave.length > 1 ? Math.max(...wave.map((p) => p.y)) + 4 : null;
  const drawn = seamTop === null ? spans : spans.filter((w) => !w.poly.some((p) => p.y <= seamTop));
  const blocks = [
    sea,
    ...allIsles.map((s) => ({ id: 'isle', poly: s.poly })),
    ...(shore ? [{ id: 'isle', poly: shore.poly }] : []),
    ...spans.map((w) => ({ id: 'pier', poly: w.poly })),
  ];
  // 軌道裡的小樹只放在節點小島上
  const trackLand = placeProps(TRACK_LAND, geo, { blocks: [...fixed, ...spans.map((w) => ({ id: 'pier', poly: w.poly }))], taken: [...taken, ...wingLand] });
  const water = placeProps(WATER, geo, { blocks, taken: [...taken, ...wingLand, ...trackLand] });
  return { blocks, isles: allIsles, beach: shore, bridges: drawn, props: [...taken, ...wingLand, ...trackLand, ...water] };
}

// ---------------------------------------------------------------------------------------------
// 畫法（往左是外側；右翼會水平翻轉）

/** 一面旗：旗桿、燕尾旗（旗面無字）、桿頂的小燈 */
function flagPath(x: number, base: number, h: number, s: number): { pole: string; flag: string; knob: Point } {
  const top = base - h;
  const fw = 24 * s;
  const fh = 8.5 * s;
  return {
    pole: `M${x} ${base}V${top + 3}`,
    flag: `M${x + 1} ${top + 6}h${fw}l${-fw / 4} ${fh} ${fw / 4} ${fh}h${-fw}Z`,
    knob: { x, y: top + 2 },
  };
}

function Flags({ w, h, colours, gid }: { w: number; h: number; colours: readonly string[]; gid: string }) {
  const n = colours.length;
  const xs = n === 1 ? [w * 0.3] : [w * 0.12, w * 0.42, w * 0.7];
  const bases = n === 1 ? [h - 3] : [h - 5, h - 15, h - 3];
  const hs = n === 1 ? [h - 6] : [h * 0.62, h * 0.84, h * 0.66];
  const f = xs.map((x, i) => flagPath(x, bases[i]!, hs[i]!, n === 1 ? 0.92 : w / 110));
  return (
    <>
      {f.map((q) => (
        <Glow key={q.knob.x} x={q.knob.x} y={q.knob.y} r={16} gid={gid} />
      ))}
      <path d={f.map((q) => q.pole).join('')} fill="none" stroke={LINE} strokeWidth="2.2" strokeLinecap="round" />
      {f.map((q, i) => (
        <path key={q.flag} d={q.flag} fill={colours[i]} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      ))}
      <path d={f.map((q) => `M${q.knob.x - 3} ${q.knob.y}a3 3 0 1 0 6 0a3 3 0 1 0-6 0`).join('')} fill={GLOW} stroke={LINE} strokeWidth="1.2" />
    </>
  );
}

/** 小樹（w × h）：樹幹與三個圓弧組成的樹冠（不是實心大圓） */
function treePath(x: number, y: number, w: number, h: number): { crown: string; trunk: string } {
  const cw = w;
  const ch = h * 0.72;
  return {
    crown: `M${x + cw * 0.12} ${y + ch * 0.9}C${x - cw * 0.06} ${y + ch * 0.62} ${x + cw * 0.1} ${y + ch * 0.28} ${x + cw * 0.32} ${y + ch * 0.3}C${x + cw * 0.34} ${y} ${x + cw * 0.72} ${y} ${x + cw * 0.74} ${y + ch * 0.3}C${x + cw * 0.98} ${y + ch * 0.3} ${x + cw * 1.04} ${y + ch * 0.7} ${x + cw * 0.86} ${y + ch * 0.9}Z`,
    trunk: `M${x + cw * 0.44} ${y + h - 1}h${cw * 0.14}l-1-${h * 0.36}h${2 - cw * 0.14}Z`,
  };
}

function Trees({ items }: { items: readonly (readonly [number, number, number, number])[] }) {
  const t = items.map(([x, y, w, h]) => treePath(x, y, w, h));
  return (
    <>
      <path d={t.map((q) => q.trunk).join('')} fill={WOOD} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
      <path d={t.map((q) => q.crown).join('')} fill={LEAF} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
    </>
  );
}

/** 礁石 w × h：幾顆石頭與底下的浪花 */
function Reef({ w, h }: { w: number; h: number }) {
  const b = h - 5;
  return (
    <>
      <path d={`M2 ${h - 3}q${w * 0.25}-6 ${w * 0.5} 0t${w * 0.48} 0`} fill="none" stroke={FOAM} strokeWidth="2.2" strokeLinecap="round" />
      <path
        d={`M${w * 0.08} ${b}q0-${h * 0.6} ${w * 0.26}-${h * 0.62}q${w * 0.24} 0 ${w * 0.26} ${h * 0.62}ZM${w * 0.52} ${b}q${w * 0.04}-${h * 0.4} ${w * 0.18}-${h * 0.4}q${w * 0.14} 0 ${w * 0.16} ${h * 0.4}ZM${w * 0.76} ${b}q0-${h * 0.22} ${w * 0.08}-${h * 0.22}q${w * 0.08} 0 ${w * 0.09} ${h * 0.22}Z`}
        fill={ROCK_DEEP}
        stroke={LINE}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </>
  );
}

function Art({ p, gid }: { p: Placed; gid: string }) {
  const w = p.x1 - p.x0;
  const h = p.y1 - p.y0;
  switch (p.form) {
    case 'flags':
      return <Flags w={w} h={h} colours={[ROOF, LEAF, GLOW]} gid={gid} />;
    case 'flag':
      return <Flags w={w} h={h} colours={[ROOF]} gid={gid} />;
    case 'trees':
      return (
        <Trees
          items={[
            [2, 6, w * 0.5, h - 6],
            [w * 0.44, 0, w * 0.54, h],
          ]}
        />
      );
    case 'tree':
      return <Trees items={[[0, 0, w, h]]} />;
    case 'sailboat':
      return <Sailboat />;
    case 'gulls':
      return <Gulls />;
    case 'reef':
      return <Reef w={w} h={h} />;
    case 'ripple':
      return <path d="M1 8q7-7 14 0t14 0" fill="none" stroke={FOAM} strokeWidth="2" strokeLinecap="round" />;
    default:
      return null;
  }
}

export default function Islands({ geo }: SceneProps) {
  const ids = useSceneIds();
  const plan = planIslands(geo);
  const d = plan.isles.map((s) => s.d).join('');
  return (
    <>
      <SceneDefs ids={ids} />
      <TerrainRect id="sea" r={{ x0: 0, y0: SEAM, x1: geo.bandW, y1: geo.h }} />
      {/* 淺灘：島外一圈淡淡的浪花色（章節牌沙灘是第 1 章陸地的一部分，沒有這一圈）；島與沙灘先描浪花再填沙（paint-order），疊在一起的只剩外圈 */}
      <path d={d} fill="none" stroke={FOAM} strokeWidth="20" strokeLinejoin="round" opacity="0.4" />
      <path data-terrain-block="isle" d={`${plan.beach?.d ?? ''}${d}`} fill={SAND} stroke={FOAM} strokeWidth="5" strokeLinejoin="round" paintOrder="stroke" />
      <path d={plan.isles.map((s) => s.meadow).join('')} fill={MEADOW} />
      {/* 跨海的橋（所有橋合成一組 path）：畫在沙地之上，兩端的平頭落在沙上；路面與圓點由地圖組畫在上面 */}
      {plan.bridges.length > 0 && (
        <g>
          <path data-terrain-block="pier" d={plan.bridges.map((b) => polyPath(b.poly)).join('')} fill="none" />
          <path d={plan.bridges.map((b) => b.deck).join('')} fill="none" stroke={WOOD} strokeWidth={DECK * 2} strokeLinejoin="round" />
          <path d={plan.bridges.map((b) => b.planks).join('')} stroke={LINE} strokeWidth="1" />
          <path d={plan.bridges.map((b) => b.rails).join('')} fill="none" stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
          <path d={plan.bridges.map((b) => b.posts).join('')} fill={ROCK_DEEP} stroke={LINE} strokeWidth="1" />
        </g>
      )}
      {/* 最後一座島伸出區段頂端：照 geo.seam 把接縫（波浪以上填上一章的底色）蓋回去，交界和地景層同一條波浪。
          海峽下方（blend）的島不越過接縫，不必蓋回 */}
      {geo.seam && !geo.seam.blend && <path d={geo.seam.d} style={{ fill: geo.seam.fill }} />}
      {[...plan.props].sort(byDepth).map((p) => (
        <Prop key={p.id} p={p}>
          <Art p={p} gid={ids.glow} />
        </Prop>
      ))}
    </>
  );
}
