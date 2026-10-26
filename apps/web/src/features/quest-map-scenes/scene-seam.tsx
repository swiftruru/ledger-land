// 陸接陸的交界（第 7 輪看圖驗收，第 8 輪重做）：主線第 3 到 9 章頂端和上一章的交界重畫成多頻的起伏、依章節種子擺的凹口、兩側的散點與凹口尖端的物件。
// 只有這 7 章用，不放進 scene-kit（每一章都載 scene-kit，預算 5 KB）；7 章共用，vite 會把它分成一個 shared~scene-… chunk（算進場景的單章與合計預算）。
import type { ReactNode } from 'react';
import type { Point, Rect, SceneGeo } from '../quest-map/layout.ts';
import { hashSeed, inflate, rectsIntersect, SEAM, seededRandom } from '../quest-map/layout.ts';
import { dayNight, GLOW, LEAF, LINE, PAPER, ROCK_DEEP, seamWave, waveAt, WOOD, type Placed, type TerrainBlock } from './scene-kit.tsx';

/** 交界取樣的間距 */
const EDGE_STEP = 4;
/** 路面那一段（路線左右 14px，蓋在路底下）是同一個 y；走廊到路線左右 100px（60px 再 40px 緩回自由曲線），細的起伏在路面保護框外 12px 內加滿 */
const ROAD_FLAT = 14;
const CORRIDOR = 100;
/** 凹口：寬、深；和相鄰交界同一翼的凹口至少相隔 NOTCH_GAP */
const NOTCH_W = [80, 200] as const;
const NOTCH_D = [24, 60] as const;
const NOTCH_GAP = 160;
/** 兩翼的交界整段往下移 WING_DROP 到 WING_DROP + 8（上一章的地在翼裡多一截，這一章的地才有地方往上伸），往軌道那一側 100px 緩回 */
const WING_DROP = 18;
/** 細的起伏（振幅 1.5 與 0.9、波長 44 到 60 與它的 0.62 倍）：曲線在哪裡都不是平的 */
const RIPPLE = 1.5;
/** 物件與畫面上所有東西：外擴 8 不碰、交界往下最多到這些東西上緣往上 12 */
const CLEAR = 12;
/** 平順的限制：先往兩側擴 ERODE（取最小），再做兩次半徑 BLUR 的平均（每一點都只會比原本更收，曲線沒有台階與平頂） */
const ERODE = 12;
const BLUR = 5;
/** 散點：上一章的底色在交界下方、這一章的底色在交界上方，0 到 SCATTER px 由密到疏 */
const SCATTER = 16;

export interface Notch {
  readonly side: 'left' | 'right';
  /** 中心、舌的寬與深；up 是這一章的地往上伸（舌尖離區段頂端 4px 以上），否則是上一章的地往下伸 */
  readonly c: number;
  readonly w: number;
  readonly d: number;
  readonly up: boolean;
  /** 舌的範圍 */
  readonly x0: number;
  readonly x1: number;
}

export interface SeamTip {
  /** TIPS 的索引、底邊中心、是否水平翻轉 */
  readonly k: number;
  readonly x: number;
  readonly y: number;
  readonly flip: boolean;
}

export interface SeamEdge {
  /** 新的交界（每 EDGE_STEP 一點，區帶座標） */
  readonly line: readonly Point[];
  /** 交界以上（上一章的底色）、交界以下到地景層的圓點以下（這一章的底色）：整段蓋掉地景層的接縫重畫 */
  readonly above: string;
  readonly below: string;
  /** 散點（短筆觸）：down 是上一章底色散在交界下方，up 是這一章底色散在交界上方；各兩種粗細 */
  readonly dots: { readonly down: readonly [string, string]; readonly up: readonly [string, string] };
  readonly notches: readonly Notch[];
  /** 凹口尖端的物件與它們的框（不是 placeProps 放的物件，直接用區帶座標畫） */
  readonly tips: readonly SeamTip[];
  readonly items: readonly Rect[];
}

const ease = (t: number) => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};
/** 圓頭的舌：中心 1、兩端 0，根部的切線是水平的 */
const tongue = (u: number) => (Math.abs(u) >= 1 ? 0 : (1 - u * u) ** 1.4);

/**
 * 凹口的位置只看區帶寬與軌道（每一章一樣），由第 3 章起依序決定，每一章避開前一章同一翼的凹口（NOTCH_GAP）：
 * 每翼 0 到 2 個，x 在翼內均勻取樣（翼靠軌道那一側留 44px，出口走廊在哪一側都碰不到），寬、深、方向都由章節種子決定。
 * 物件與保護框只決定放不放得下（放不下就收淺或拿掉），不移動位置，所以相鄰兩章的間距一定成立
 */
function notchZones(geo: Pick<SceneGeo, 'bandW' | 'track' | 'wings'>) {
  return (['left', 'right'] as const)
    .filter((side) => geo.wings[side])
    .map((side) => (side === 'left' ? { side, a: 12, b: geo.track.left - 44 } : { side, a: geo.track.right + 44, b: geo.bandW - 12 }))
    .filter((z) => z.b - z.a >= NOTCH_W[0] + 8);
}

export function notchPlan(geo: Pick<SceneGeo, 'bandW' | 'track' | 'wings'>, chapter: number): Notch[] {
  const zones = notchZones(geo);
  let prev: Notch[] = [];
  for (let j = 3; j <= chapter; j++) {
    const rand = seededRandom(hashSeed(`seam notch ${j}`));
    const cur: Notch[] = [];
    for (const { side, a, b } of zones) {
      const len = b - a;
      const r = rand();
      const n = r < 0.2 ? 0 : r < 0.6 || len < 2 * NOTCH_W[0] + 120 ? 1 : 2;
      for (let m = 0; m < n; m++)
        for (let tries = 0; tries < 12; tries++) {
          const up = rand() < 0.5;
          const w = Math.min(len - 8, NOTCH_W[0] + (NOTCH_W[1] - NOTCH_W[0]) * rand());
          const c = a + w / 2 + rand() * (len - w);
          const d = NOTCH_D[0] + (NOTCH_D[1] - NOTCH_D[0]) * rand();
          if (cur.some((q) => q.side === side && Math.abs(q.c - c) < (q.w + w) / 2 + 48) || prev.some((q) => q.side === side && Math.abs(q.c - c) < NOTCH_GAP))
            continue;
          cur.push({ side, c, w, d, up, x0: c - w / 2, x1: c + w / 2 });
          break;
        }
    }
    prev = cur;
  }
  return prev;
}

/**
 * 陸接陸的交界重畫（主線第 3 到 9 章的頂端，chapter 是章序；海岸、海接海、地圖頂端與同一種地面不做）：
 * - 自由曲線：地景層的波浪乘上 0.8 到 1 的包絡，再加兩個長波長的正弦（振幅 0 到 16 由另一個包絡決定）；兩翼整段往下移 18 到 26px；
 * - 凹口（notchPlan）：上一章的地往下伸（放不下就收淺或拿掉），或這一章的地往上伸（從翼裡往下移的交界伸回區段頂端附近）；
 * - 往下不碰物件、保護框與這一章的其他地形塊（離 12px）、不高於區段頂端往下 2：不是硬夾，而是每一點和原本波浪之間的權重先往兩側取最小、再平均兩次，
 *   限制線兩側緩緩混回原本的波浪，沒有台階、平頂與直角（第 8 輪看圖驗收）；凹口以外斜率不超過 0.95，任何連續 24px 都不是平的（細的起伏，剩下的加小包）；
 * - 路線：路面底下（左右 14px）是同一個 y（兩緣一樣高，路左右的交界不錯開），到路線左右 100px 緩回；
 * - 兩側的散點：上一章的底色以短筆觸散在交界下方 0 到 16px、這一章的底色散在交界上方，靠交界密、往外疏；
 * - 凹口尖端的物件：往下伸的舌尖站上一章的物件、往上伸的舌上站這一章的物件，有些凹口不放。
 * 所有東西畫在這一章的地形塊與物件底下
 */
export function seamEdge(
  geo: SceneGeo,
  plan: { readonly blocks: readonly TerrainBlock[]; readonly props: readonly Placed[] },
  base: string,
  chapter: number,
): SeamEdge | null {
  const seam = geo.seam;
  if (!seam || seam.coast || seam.blend || seam.fill.includes('--ll-bg')) return null;
  const wave = seamWave(geo);
  if (wave.length < 2) return null;
  const W = geo.bandW;
  const rand = seededRandom(hashSeed(seam.line ?? 'edge'));
  const ph = () => rand() * 6.28;
  const xs = Array.from({ length: Math.ceil((W + 16) / EDGE_STEP) + 1 }, (_, i) => i * EDGE_STEP - 8);
  const N = xs.length;
  const ix = (x: number) => Math.max(0, Math.min(N - 1, Math.round((x + 8) / EDGE_STEP)));
  // 每一欄往下最多到哪裡：物件（外擴 8）、保護框、這一章的其他地形塊上緣，再留 CLEAR；原本的波浪更低的地方照原本的
  const lim = xs.map(() => Infinity);
  const cover = (x0: number, x1: number, y: number) => {
    for (let i = 0; i < N; i++) if (xs[i]! >= x0 && xs[i]! <= x1) lim[i] = Math.min(lim[i]!, y);
  };
  for (const r of [...geo.protect, ...plan.props.map((p) => inflate(p, 8))]) if (r.y0 < 160) cover(r.x0, r.x1, r.y0);
  for (const b of plan.blocks) {
    if (b.id === base) continue;
    const P = b.poly;
    for (let k = 0; k < P.length; k++) {
      const a = P[k]!;
      const c = P[(k + 1) % P.length]!;
      if (Math.min(a.y, c.y) > 160) continue;
      for (let i = 0; i < N; i++) {
        const x = xs[i]!;
        if ((a.x - x) * (c.x - x) > 0 || a.x === c.x) continue;
        lim[i] = Math.min(lim[i]!, a.y + ((c.y - a.y) * (x - a.x)) / (c.x - a.x));
      }
    }
  }
  const y0 = xs.map((x) => waveAt(wave, x));
  const hi = xs.map((_, i) => Math.max(y0[i]!, lim[i]! - CLEAR));
  const mid = SEAM / 2;
  // 自由曲線：包絡與長波的波長由種子決定，每章不同
  const [l1, l2, l3, l4] = [440 + 220 * rand(), 520 + 200 * rand(), 230 + 110 * rand(), 120 + 50 * rand()];
  const [p1, p2, p3, p4] = [ph(), ph(), ph(), ph()];
  const drop = notchZones(geo).map((z) => ({ ...z, by: WING_DROP + 8 * rand() }));
  let ys = xs.map((x, i) => {
    const e1 = 0.8 + 0.2 * (0.5 + 0.5 * Math.sin((x / l1) * 6.28 + p1));
    const e2 = (0.5 + 0.5 * Math.sin((x / l2) * 6.28 + p2)) ** 1.5;
    const wing = drop.reduce((s, z) => s + z.by * (1 - ease((z.side === 'left' ? x - z.b : z.a - x) / 100)), 0);
    return mid + wing + (y0[i]! - mid) * e1 + 16 * e2 * (0.62 * Math.sin((x / l3) * 6.28 + p3) + 0.38 * Math.sin((x / l4) * 6.28 + p4));
  });
  // 凹口：往下伸的整段放得下才畫（深度收到放得下為止）；往上伸的舌尖離區段頂端 4px 以上
  const exit = geo.corridor.exit;
  const roomIn = (x0: number, x1: number) => {
    let r = Infinity;
    for (let i = ix(x0); i <= ix(x1); i++) r = Math.min(r, hi[i]! - 8 - mid);
    return r;
  };
  const notches: Notch[] = [];
  for (const n of notchPlan(geo, chapter)) {
    if (n.up) {
      notches.push(n);
      continue;
    }
    const down = Math.min(n.d, roomIn(n.c - n.w * 0.35, n.c + n.w * 0.35) - 10 - WING_DROP);
    if (down >= NOTCH_D[0]) notches.push({ ...n, d: down });
  }
  ys = ys.map((y, i) => {
    const x = xs[i]!;
    let t = y;
    for (const g of notches) {
      if (x <= g.x0 || x >= g.x1) continue;
      const hw = g.w / 2;
      const u = tongue((x - g.c) / hw);
      if (g.up) {
        // 往上伸：圓頭的舌，從交界往上 d（舌尖離區段頂端至少 4）
        const v = Math.max(4, Math.min(t, mid + WING_DROP) - g.d);
        t -= (t - Math.min(t, v)) * u;
      } else {
        // 往下伸：圓頭的舌，平順地取大，再乘舌的輪廓（兩端是 0，舌的兩側圓圓地接回交界，不在舌的兩端跳一格）
        const v = mid + WING_DROP + g.d * u;
        t += ((v - t + Math.sqrt((t - v) ** 2 + 400)) / 2) * u;
      }
    }
    return t;
  });
  // 平順的限制：每一點和原本波浪之間能走多少（0 到 1），往兩側取最小再平均兩次，乘回去
  let wt = ys.map((y, i) => {
    const o = y0[i]!;
    if (y > hi[i]!) return (hi[i]! - o) / (y - o);
    if (y < 2) return o <= 2 ? 0 : (o - 2) / (o - y);
    return 1;
  });
  wt = wt.map((_, i) => Math.max(0, Math.min(1, ...wt.slice(Math.max(0, i - ERODE), i + ERODE + 1))));
  for (let it = 0; it < 2; it++) {
    const src = wt;
    wt = src.map((_, i) => {
      const a = src.slice(Math.max(0, i - BLUR), i + BLUR + 1);
      return a.reduce((s, v) => s + v, 0) / a.length;
    });
  }
  ys = ys.map((y, i) => y0[i]! + (y - y0[i]!) * wt[i]!);
  // 路線：路面底下是同一個 y（路面那一段原本波浪最高的地方，路面保護框底下不比原本更往下；波浪貼著區段頂端時不高過頂端往下 2），到路線左右 CORRIDOR 緩回
  if (exit !== null) {
    let flat = Infinity;
    let top = -Infinity;
    for (let i = ix(exit - ROAD_FLAT - 6); i <= ix(exit + ROAD_FLAT + 6); i++) {
      flat = Math.min(flat, y0[i]! + 0.5);
      top = Math.max(top, Math.min(2, y0[i]!));
    }
    flat = Math.min(flat, Math.max(top, flat - 0.5));
    ys = ys.map((y, i) => {
      const k = 1 - ease((Math.abs(xs[i]! - exit) - ROAD_FLAT) / (CORRIDOR - ROAD_FLAT));
      return y + (flat - y) * k;
    });
  }
  // 細的起伏：路面底下不加（路面保護框外 12px 內加滿）；往下的那一半離限制線不到 2.5 RIPPLE 時按比例收，往上的那一半離區段頂端往下 2 不到時按比例收
  const lr = 44 + 16 * rand();
  const p5 = ph();
  ys = ys.map((y, i) => {
    const x = xs[i]!;
    const road = exit === null ? 1 : Math.min(1, Math.max(0, (Math.abs(x - exit) - ROAD_FLAT - 4) / 12));
    const r = RIPPLE * (Math.sin((x / lr) * 6.28 + p5) + 0.6 * Math.sin((x / lr) * 10.2 + p5 * 2));
    const room = r > 0 ? hi[i]! - y : y - 2;
    return y + r * road * Math.min(1, Math.max(0, room / (2.5 * RIPPLE)));
  });
  // 凹口以外斜率不超過 0.95：只把陡的那一側往上收（不會碰到東西，也不會高過鄰點），前後各掃一次
  const free = (x: number) => !notches.some((g) => x > g.x0 - 8 && x < g.x1 + 8);
  for (const dir of [1, -1])
    for (let k = 1; k < N; k++) {
      const i = dir > 0 ? k : N - 1 - k;
      if (free(xs[i]!)) ys[i] = Math.min(ys[i]!, ys[i - dir]! + 0.95 * EDGE_STEP);
    }
  // 還有連續 24px 每一步都不到 0.5px 的地方（幾種起伏剛好互相抵銷），在那裡加一個 32px 寬、2.4px 的小包（往下沒地方就往上），最多掃三次
  const road = (x: number) => exit !== null && Math.abs(x - exit) <= ROAD_FLAT;
  for (let pass = 0; pass < 3; pass++)
    for (let i = 0; i + 6 < N; i++) {
      if (xs[i]! < -4 || xs[i + 6]! > W + 4 || road(xs[i]!) || road(xs[i + 6]!)) continue;
      let flat = true;
      for (let j = i + 1; j <= i + 6 && flat; j++) flat = Math.abs(ys[j]! - ys[j - 1]!) < 0.5;
      if (!flat) continue;
      const c = i + 3;
      const s = hi[c]! - ys[c]! >= 4 ? 1 : ys[c]! - 2 >= 4 ? -1 : 0;
      for (let j = c - 4; j <= c + 4; j++) if (j >= 0 && j < N) ys[j]! += (s * 2.4 * (1 + Math.cos(((j - c) * Math.PI) / 4))) / 2;
    }
  // 最後保險：不碰東西、不高過區段頂端往下 2（上面的混法已經保證，這一步通常不動任何點）
  const line = xs.map((x, i) => ({ x, y: Math.max(Math.min(2, y0[i]!), Math.min(ys[i]!, hi[i]!)) }));
  const at = (x: number) => line[ix(x)]!.y;
  const f = (n: number) => Math.round(n * 10) / 10;
  const run = (pts: readonly Point[]) => pts.map((p) => `${f(p.x)} ${f(p.y)}`).join('L');
  const band = (top: (p: Point, i: number) => number, bot: (p: Point, i: number) => number) =>
    `M${run(line.map((p, i) => ({ x: p.x, y: top(p, i) })))}L${run(line.map((p, i) => ({ x: p.x, y: bot(p, i) })).reverse())}Z`;
  // 散點：每 2.6px 一欄，兩側各一半機會有一點；離交界的距離是 1.5 加 14.5 乘亂數平方（靠交界密、往外疏），相對座標串成一條 path
  const dr = seededRandom(hashSeed(`seam dots ${chapter}`));
  const dots = { down: ['', ''] as [string, string], up: ['', ''] as [string, string] };
  const pen = [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ];
  for (let x = -2; x < W + 2; x += 2.6)
    for (const s of [1, -1] as const) {
      if (dr() < 0.5) continue;
      const r = dr();
      const big = dr() < 0.35 ? 1 : 0;
      const px = Math.round(x + dr() * 2 - 1);
      const py = Math.round(at(px) + s * (1.5 + (SCATTER - 1.5) * r * r));
      const dx = Math.round(dr() * 2 - 1) || 1;
      if (py < 2 || px < -2 || px > W + 2) continue;
      const k = (s > 0 ? 0 : 2) + big;
      const q = pen[k]!;
      const arr = s > 0 ? dots.down : dots.up;
      arr[big] += `${arr[big] ? 'm' : 'M'}${arr[big] ? px - q[0]! : px} ${arr[big] ? py - q[1]! : py}l${dx} 0`;
      pen[k] = [px + dx, py];
    }
  // 凹口尖端的物件：往下伸的站上一章的物件（腳踩在舌尖），往上伸的站這一章的物件（舌裡，腳下中間那一段在這一章的地上）；
  // 不碰物件、保護框（外擴 8），離畫面邊 16px 以上，約三成的凹口不放
  const tips: SeamTip[] = [];
  const items: Rect[] = [];
  const tr = seededRandom(hashSeed(`seam tips ${chapter}`));
  const blocked = (r: Rect) =>
    r.y0 < 2 || r.x0 < 16 || r.x1 > W - 16 || [...geo.protect, ...plan.props.map((p) => inflate(p, 8))].some((q) => rectsIntersect(q, r));
  for (const g of notches) {
    const list = TIPS_OF[g.up ? chapter : chapter + 1] ?? [];
    const k = list[Math.floor(tr() * list.length)];
    const flip = tr() < 0.5;
    if (tr() < 0.3 || k === undefined) continue;
    const { w, h } = TIPS[k]!;
    const x = g.c + (tr() - 0.5) * g.w * 0.2;
    const span = line.slice(ix(g.c - g.w / 2), ix(g.c + g.w / 2) + 1).map((p) => p.y);
    const [top, low] = [Math.min(...span), Math.max(...span)];
    // 往下伸：腳踩在舌尖（舌尖往上 2）；往上伸：站在舌裡（舌尖往下 14 起，頂端不出區段，到舌根為止），腳下中間那一段都在這一章的地上
    for (let y = g.up ? Math.max(top + 14, h + 3) : low - 2; g.up ? y <= low - 2 : y === low - 2; y += 2) {
      const r = { x0: x - w / 2, y0: y - h, x1: x + w / 2, y1: y };
      if (g.up && ![x - w * 0.3, x, x + w * 0.3].every((fx) => at(fx) <= y - 2)) continue;
      if (!blocked(r)) {
        tips.push({ k, x, y, flip });
        items.push(r);
      }
      break;
    }
  }
  return {
    line,
    above: band(
      () => -2,
      (p) => p.y,
    ),
    below: band(
      (p) => p.y,
      (p, i) => Math.max(p.y, y0[i]!) + 38,
    ),
    dots,
    notches,
    tips,
    items,
  };
}

/** 凹口尖端的物件（w × h，往左是外側）：各章場景裡同一種東西的簡化版，畫在這個 chunk 裡（不載別章的場景） */
const TIPS: readonly { readonly w: number; readonly h: number; readonly art: ReactNode }[] = [
  // 第 3 章：疊起來的木箱、空白的價目牌
  {
    w: 44,
    h: 34,
    art: (
      <path
        d="M2 33V17h20v16ZM22 33V21h20v12ZM10 17V3h18v14ZM2 17l20 16M22 21l20 12M10 3l18 14"
        fill={WOOD}
        stroke={LINE}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    ),
  },
  {
    w: 24,
    h: 32,
    art: (
      <path d="M7 31 10 17M17 31l-3-14M3 3h18v14H3Z" {...dayNight(PAPER, WOOD)} stroke={LINE} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    ),
  },
  // 第 4 章：花台
  {
    w: 40,
    h: 40,
    art: (
      <>
        <path
          d="M5.6 24.8C.8 16 6.4 5.6 14.4 8 16.8.8 28 1.6 28.8 9.6 36.8 8 40 18.4 34.4 24.8Z"
          fill={LEAF}
          stroke={LINE}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M3.2 24h33.6l-2.4 15H5.6Z" fill={ROCK_DEEP} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      </>
    ),
  },
  // 第 5 章：一叢蘆葦、幾顆石頭
  {
    w: 28,
    h: 28,
    art: (
      <>
        <path
          d="M5.6 27q-1-14-3.9-20.7M11.2 27q0-16.8 1.1-25.2M16.2 27q1-14 4.5-19.6M21.3 27q2-8.4 5.6-11.8"
          fill="none"
          stroke={LEAF}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path d="M12.3 2.2a2.4 5 0 1 0 .1 0ZM1.7 6.7a2.2 4.4 0 1 0 .1 0Z" fill={WOOD} stroke={LINE} strokeWidth="1" />
      </>
    ),
  },
  {
    w: 34,
    h: 20,
    art: (
      <path
        d="M2 19q0-12.4 10.2-12.4T22.4 19ZM17 19q1.4-8.4 6.8-8.4T29.9 19ZM27.2 19q0-5.2 2.7-5.2T33.3 19Z"
        fill={ROCK_DEEP}
        stroke={LINE}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    ),
  },
  // 第 6 章：路燈（另外也用第 5 章那幾顆石頭）
  { w: 14, h: 40, art: <path d="M3 3h8v10H3ZM6 13h2v24h2.5v2h-7v-2H6Z" fill={GLOW} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" /> },
  // 第 7 章：兩個木桶
  {
    w: 40,
    h: 32,
    art: (
      <path
        d="M3 31q-3-14 0-28h14q3 14 0 28ZM23 31q-3-11 0-22h14q3 11 0 22ZM2 10h16M2 24h16M22 15h16M22 25h16"
        fill={WOOD}
        stroke={LINE}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    ),
  },
  // 第 8 章：乾草捆
  {
    w: 56,
    h: 30,
    art: (
      <>
        <path d="M2 29V9q0-6 6-6h18q6 0 6 6v20ZM28 29V13q0-5 5-5h16q5 0 5 5v16Z" fill={GLOW} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M12 4v25M22 4v25M36 9v20M45 9v20" stroke={LINE} strokeWidth="1.2" opacity="0.6" />
      </>
    ),
  },
  // 第 9 章：麵粉袋、麥束
  {
    w: 52,
    h: 36,
    art: (
      <path
        d="M18 18q-2-8 4-12l-1-4h12l-1 4q6 4 4 12ZM2 35q-3-14 5-19l-1-4h14l-1 4q8 5 5 19ZM26 35q-3-14 5-19l-1-4h14l-1 4q8 5 5 19ZM7 15h12M31 15h12M22 6h10"
        {...dayNight(PAPER, ROCK_DEEP)}
        stroke={LINE}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    ),
  },
  {
    w: 30,
    h: 38,
    art: (
      <>
        <path d="M8 37l5-17M15 37V20M22 37l-5-17M11 37l3-17M19 37l-3-17" stroke={WOOD} strokeWidth="1.8" strokeLinecap="round" />
        <path
          d="M10 20q-6-8-2-17q6 6 5 17ZM15 19q-3-10 1-18q4 8 1 18ZM20 20q-1-11 6-17q2 9-4 17ZM10 27h11"
          fill={GLOW}
          stroke={LINE}
          strokeWidth="1.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </>
    ),
  },
  // 第 7 章：一個木箱
  { w: 30, h: 26, art: <path d="M2 25V4h26v21ZM2 14h26M8 4v21" fill={WOOD} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" /> },
  // 第 10 章：石堆
  {
    w: 28,
    h: 32,
    art: (
      <path
        d="M3 31q0-8 11-8t11 8ZM6 23q0-6 8-6t8 6ZM8 17q0-5 6-5t6 5ZM10 12q0-5 4-5t4 5Z"
        fill={ROCK_DEEP}
        stroke={LINE}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    ),
  },
];
/** 各章（章序）能站在凹口尖端的物件 */
const TIPS_OF: Readonly<Record<number, readonly number[]>> = { 3: [0, 1], 4: [2], 5: [3, 4], 6: [5, 4], 7: [6, 10], 8: [7], 9: [8, 9], 10: [11] };

/** 畫 seamEdge：上一章與這一章的底色、兩側的散點、凹口尖端的物件 */
export function SeamEdgeArt({ edge, own, above }: { edge: SeamEdge | null; own: string; above: string }) {
  if (!edge) return null;
  const dot = (d: string, color: string, k: number, key: string) =>
    d ? <path key={key} d={d} fill="none" style={{ stroke: color }} strokeWidth={k ? 2.8 : 2} strokeLinecap="round" /> : null;
  return (
    <>
      <path d={edge.above} style={{ fill: above }} />
      <path d={edge.below} fill={own} />
      {edge.dots.down.map((d, k) => dot(d, above, k, `d${k}`))}
      {edge.dots.up.map((d, k) => dot(d, own, k, `u${k}`))}
      {edge.tips.map((t, i) => {
        const { w, h, art } = TIPS[t.k]!;
        return (
          <g key={i} transform={`translate(${t.x - w / 2} ${t.y - h})${t.flip ? ` translate(${w} 0) scale(-1 1)` : ''}`}>
            {art}
          </g>
        );
      })}
    </>
  );
}
