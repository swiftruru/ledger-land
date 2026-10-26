// 地景層（圖規第 6.1、6.3、6.4 節）：每章的底色（.qm-terrain，第一次繪製就有，CSS 背景）與頂端接縫的波浪 path。
// 章與章的交界畫在下面那一章的頂端：波浪以上填「上方那一章」的底色，兩章在交界咬合，沒有直線切口；
// 兩章底色相同時：陸類畫一條 2px 的石緣線，海類什麼都不畫（海面直接相接）；最頂端那一章的波浪填 --ll-bg，地圖頂端自然收邊。
// 第 4 輪看圖驗收（14 章疊成一條條規律的花邊、海陸交界沒有海岸）：波浪改成兩個正弦相加（相位以章節種子決定），不再是規律的扇貝；
// 海接陸時沿波浪在海的那一側畫海岸（淺灘帶加浪花線，和島嶼海岸同一種樣式）；陸接陸時波浪下方用上方那一章底色的小圓點漸淡，顏色交接不是一刀切。
// 純函式，不碰 DOM；場景物件（.qm-scene）在延後載入的場景 chunk，不在這裡。
import { SEAM, seededRandom } from './layout.ts';
import type { SceneKind } from './scenes.tsx';

export type Terrain = 'sea' | 'sea-deep' | 'sand' | 'meadow' | 'meadow-deep' | 'field' | 'plaza' | 'rock';

/** 各章的地景底色（圖規 6.4 的表，相鄰兩章不同色；延伸區四章與海峽同是深海，交界畫浪花線） */
export const SCENE_TERRAIN: Record<SceneKind, Terrain> = {
  dock: 'sand',
  islands: 'sea',
  market: 'plaza',
  scale: 'rock',
  river: 'meadow',
  lighthouse: 'rock',
  gears: 'plaza',
  farm: 'field',
  bakery: 'plaza',
  summit: 'meadow-deep',
  'isle-valuation': 'sea-deep',
  'isle-finance': 'sea-deep',
  'isle-stakeholders': 'sea-deep',
  'isle-ledger': 'sea-deep',
};

/** 延伸區海峽的底色 */
export const STRAIT_TERRAIN: Terrain = 'sea-deep';

export function isWater(t: Terrain): boolean {
  return t === 'sea' || t === 'sea-deep';
}

/**
 * 接縫波浪（圖規 6.3，第 4 輪看圖驗收改）：y = 中線 + 7·sin(2πx/176 + φ1) + 4·sin(2πx/64 + φ2)，φ1、φ2 由章節種子決定。
 * 兩個波長不成整數比，起伏一段大一段小，看不出一格一格的花邊；振幅合計最多 11，中線 12 時整條落在頂端 1 到 23px。
 */
export const SEAM_WAVE = { a1: 7, l1: 176, a2: 4, l2: 64 } as const;
/** 中線：一般 12；上方是海時 20（海岸的淺灘帶畫在波浪上方，要留出空間，不被區段頂端切掉） */
export const SEAM_MID = SEAM / 2;
export const SEAM_MID_LOW = 20;
/** 接縫 svg 的高度：波浪（最低 31）加波浪下方的海岸或圓點漸層 */
export const SEAM_SVG = SEAM * 2;
/** 海岸：淺灘帶 9px（opacity 0.4）、浪花線 2.5px，和島嶼（scene-islands）的「20px 淡浪花描邊加 5px 浪花描邊、內半被沙蓋住」看起來相同 */
export const COAST = { shallow: 9, foam: 2.5, shallowOpacity: 0.4 } as const;
/** 陸接陸的漸層：波浪下方三排圓點（直徑 3、每 12px 一顆），透明度 0.5、0.3、0.12 */
export const SEAM_DOTS = { r: 1.5, gap: 12, rows: [0.5, 0.3, 0.12] } as const;

const STEP = 8;
const TAU = Math.PI * 2;

/** 波浪在 x 的高度（y 向下，區段頂端為 0） */
export function seamY(x: number, seed: number, mid: number = SEAM_MID): number {
  const rand = seededRandom((seed ^ 0x5eed5eed) >>> 0);
  const { a1, l1, a2, l2 } = SEAM_WAVE;
  return mid + a1 * Math.sin((TAU * x) / l1 + rand() * TAU) + a2 * Math.sin((TAU * x) / l2 + rand() * TAU);
}

/**
 * 波浪的 path：每 8px 一點的折線（波長最短 64，折線和曲線最多差 0.4px，放大也看不出折角）。
 * dy 把整條往下（正）或往上（負）平移；reverse 時由右往左、用 L 接在前一段後面（組成帶狀區域的另一條邊）
 */
function wave(bandW: number, seed: number, mid: number, dy = 0, reverse = false): string {
  const pts: string[] = [];
  for (let x = -STEP; x < bandW + 2 * STEP; x += STEP) pts.push(`${x} ${Math.round((seamY(x, seed, mid) + dy) * 10) / 10}`);
  if (reverse) pts.reverse();
  return `${reverse ? 'L' : 'M'}${pts.join('L')}`;
}

/** 接縫的路徑：fill 是波浪以上的區域（從 y=0 到波浪），line 只畫波浪本身 */
export function seamPaths(bandW: number, seed: number, mid: number = SEAM_MID): { fill: string; line: string } {
  const line = wave(bandW, seed, mid);
  return { fill: `${line}V-1H${-STEP}Z`, line };
}

/** 波浪與它平移 dy 之後的那一條之間的帶狀區域（dy 正是往下、負是往上） */
function band(bandW: number, seed: number, mid: number, dy: number, from = 0): string {
  return `${wave(bandW, seed, mid, from)}${wave(bandW, seed, mid, from + dy, true)}Z`;
}

/** 接縫波浪的中線：上方是海（下方是陸或另一種深淺的海）時是 20（海岸畫在波浪上方），其他是 12 */
export function seamMid(terrain: Terrain, above: Terrain | null): number {
  return above !== null && above !== terrain && isWater(above) ? SEAM_MID_LOW : SEAM_MID;
}

/** 接縫：填色區、波浪、海岸（海接陸時）與陸接陸的圓點漸層 */
export interface SeamShape {
  /** 波浪以上的區域 */
  readonly d: string;
  /** 波浪以上的填色（上方那一段的底色，地圖頂端是 --ll-bg） */
  readonly fill: string;
  /** 波浪本身（場景要沿接縫畫東西時用） */
  readonly line: string;
  /** 海接陸：海那一側的淺灘帶與浪花線（帶狀的 path，填 scene-foam，淺灘帶 opacity 0.4）；其他情況是 null */
  readonly coast: { readonly shallow: string; readonly foam: string } | null;
  /** 陸接陸：波浪下方三排圓點的區域（每一排是一條帶，填上方那一章底色的圓點圖樣），由上到下；其他情況是空陣列 */
  readonly dots: readonly string[];
  /**
   * 海接海（深淺不同；只有 fixture 的第 2 章頂端接海峽）：海面中間的浪花線沒有地理意義（第 5 輪看圖驗收），伸過接縫的陸地（第 2 章的島）
   * 要自己在陸地上收出海岸、只蓋回陸地那一段。d、fill、coast 仍照「上方是海」算好，給場景用
   */
  readonly blend?: boolean;
}

/**
 * 接縫的形狀：上下同地景時什麼都不畫（海接同一種海：海面直接相接；第 5 輪看圖驗收前是一條橫跨全幅的浪花線），回傳 null。
 * - 海在下、陸在上：海岸畫在波浪下方（海那一側）。
 * - 上方是海、下方是陸：中線降到 20，海岸畫在波浪上方（填色區裡）。
 * - 海接另一種深淺的海：標上 blend（地景層只畫填色、不畫浪花線，第 2 章的島沿波浪收出自己的北岸；正式內容沒有這種接縫）。
 * - 陸接陸：波浪下方三排上方那一章底色的圓點，越往下越淡。
 * - 地圖頂端：只有填色。
 * 地圖的 Seam（.qm-seam__fill）與場景共用：第 2 章的島與第 10 章的岩坡畫在物件層、會蓋掉地景層的接縫，
 * 場景照 SceneGeo.seam 再畫一次同一條波浪（填色，有海岸時也畫海岸）
 */
export function seamFill(bandW: number, seed: number, terrain: Terrain, above: Terrain | null): SeamShape | null {
  if (above !== null && above === terrain) return null;
  const fill = above ? `var(--ll-scene-${above})` : 'var(--ll-bg)';
  const lowWater = above !== null && isWater(terrain) && !isWater(above);
  // 上方是海：下方是陸，或下方是另一種深淺的海（fixture 的第 2 章頂端接海峽，島伸過接縫時島的上緣就是海岸）
  const highWater = above !== null && isWater(above);
  const mid = seamMid(terrain, above);
  const { fill: d, line } = seamPaths(bandW, seed, mid);
  // 海在下：帶往下長（正）；海在上：帶往上長（負）
  const dir = lowWater ? 1 : -1;
  const coast = lowWater || highWater ? { shallow: band(bandW, seed, mid, dir * COAST.shallow), foam: band(bandW, seed, mid, dir * COAST.foam) } : null;
  // 陸接陸：第 i 排是波浪下方 1 + 12i 到 1 + 12(i + 1) 的帶（圖樣的圓點在每格中央）
  const dots =
    above !== null && !isWater(terrain) && !isWater(above) ? SEAM_DOTS.rows.map((_, i) => band(bandW, seed, mid, SEAM_DOTS.gap, 1 + SEAM_DOTS.gap * i)) : [];
  return highWater && isWater(terrain) ? { d, fill, line, coast, dots, blend: true } : { d, fill, line, coast, dots };
}

/** 海峽的浪線（圖規 4.6：2px、振幅 6、波長 96）：只畫完整落在 [x0, x1] 裡的半波（區間由呼叫端扣掉保護框） */
export function foamPath(x0: number, x1: number, y: number, seed: number): string {
  const length = 96;
  const half = length / 2;
  const start = -((seed >>> 0) % length);
  const parts: string[] = [];
  let i = 0;
  for (let x = start; x + half <= x1; x += half, i++) {
    if (x < x0) continue;
    parts.push(`M${x} ${y} q${half / 2} ${i % 2 === 0 ? -12 : 12} ${half} 0`);
  }
  return parts.join(' ');
}
