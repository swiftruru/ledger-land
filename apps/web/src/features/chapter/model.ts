// 章節頁的純函式（站規 2.3）：主卡的進度與星星、本章下一關（主卡主按鈕「開始 1-1」「繼續 1-2」「再挑戰 1-1」，關卡列標出同一關）、徽章狀態、場景縮圖的題材。
// 只讀地圖的資料與進度（features/quest-map 的 data.ts、progress.ts），不改它們；單元測試在 apps/web/test/chapter-model.test.ts。
import type { MapChapter, MapLevel, QuestMapData } from '../quest-map/data.ts';
import { badgeStateFor, levelDone, starsOf, type BadgeState, type MapProgress } from '../quest-map/progress.ts';

export interface ChapterStats {
  /** 已完成的關卡（計分關卡至少一星、不計分關卡已讀完） */
  readonly done: number;
  readonly total: number;
  /** 計分關卡得到的星星與滿星（不計分關卡沒有星等，不算進來） */
  readonly stars: number;
  readonly maxStars: number;
  /** 本章第一個還沒完成的關卡；全部完成時是 null */
  readonly next: MapLevel | null;
  readonly badge: BadgeState;
}

export function chapterStats(data: QuestMapData, progress: MapProgress, chapter: MapChapter): ChapterStats {
  let done = 0;
  let stars = 0;
  let maxStars = 0;
  let next: MapLevel | null = null;
  for (const l of chapter.levels) {
    const finished = levelDone(progress, l);
    if (finished) done++;
    else next ??= l;
    if (!l.unscored) {
      stars += starsOf(progress, l.id);
      maxStars += 3;
    }
  }
  return { done, total: chapter.levels.length, stars, maxStars, next, badge: badgeStateFor(data, progress, chapter.id) };
}

/** 主卡的主要動作：還沒開始是「開始」第一關；做到一半是「繼續」下一個沒完成的關卡；全部完成是「再挑戰」第一關；沒有關卡時沒有動作 */
export type ChapterAction = { readonly kind: 'start' | 'continue' | 'replay'; readonly level: MapLevel };

export function chapterAction(chapter: MapChapter, stats: Pick<ChapterStats, 'done' | 'next'>): ChapterAction | null {
  const first = chapter.levels[0];
  if (!first) return null;
  if (stats.next === null) return { kind: 'replay', level: first };
  return { kind: stats.done === 0 ? 'start' : 'continue', level: stats.next };
}

/**
 * 關卡列裡對準主卡主按鈕的那一關（第 4 輪看圖驗收：延伸章主卡寫「開始 E1-1」，關卡列卻沒有任何一張被標出來）。
 * 就是本章第一個還沒完成的關卡（和 chapterStats 的 next、主卡的「開始／繼續」同一關）；它剛好是全站的目前關卡時
 * suggested 為 true（地圖、首頁指的同一關，關卡列才加「建議下一關」膠囊），延伸章與還沒輪到的主線章只標外框與播放圖示。
 * 本章全部完成時沒有：主卡是 secondary「再挑戰 1-1」，不是「下一關」；全部關卡都完成時全站的目前關卡是最後玩的那一關，
 * 章節頁不再標它，免得主卡寫 1-1、關卡列卻框住另一張。
 */
export function chapterNextLevel(
  chapter: MapChapter,
  progress: MapProgress,
  currentId: string | null,
): { readonly id: string; readonly suggested: boolean } | null {
  const next = chapter.levels.find((l) => !levelDone(progress, l));
  return next ? { id: next.id, suggested: next.id === currentId } : null;
}

/** 場景縮圖的題材（闖關地圖規格 6.4 的章節主題，依主線與延伸區各自的章序；章數超過時輪流使用） */
export type ThumbKind =
  | 'dock'
  | 'islands'
  | 'market'
  | 'scale'
  | 'river'
  | 'lighthouse'
  | 'gears'
  | 'farm'
  | 'bakery'
  | 'summit'
  | 'isle-valuation'
  | 'isle-finance'
  | 'isle-stakeholders'
  | 'isle-ledger';

const CORE_THUMBS: readonly ThumbKind[] = ['dock', 'islands', 'market', 'scale', 'river', 'lighthouse', 'gears', 'farm', 'bakery', 'summit'];
const EXTENSION_THUMBS: readonly ThumbKind[] = ['isle-valuation', 'isle-finance', 'isle-stakeholders', 'isle-ledger'];

export function thumbKindFor(chapterNo: number, extension: boolean): ThumbKind {
  const list = extension ? EXTENSION_THUMBS : CORE_THUMBS;
  const i = Math.max(0, Math.floor(chapterNo) - 1) % list.length;
  return list[i]!;
}

/** 地景底色（闖關地圖規格 6.4 的「底色」欄）：縮圖第一次繪製時先畫這個顏色，插圖晚一步才載入，尺寸不變 */
export type Terrain = 'sand' | 'sea' | 'plaza' | 'rock' | 'meadow' | 'field' | 'meadow-deep' | 'sea-deep';

const TERRAIN: Record<ThumbKind, Terrain> = {
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

export function terrainOf(kind: ThumbKind): Terrain {
  return TERRAIN[kind];
}

/** 螢幕座標的矩形（getBoundingClientRect 的子集） */
export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** 縮圖裡的小物件離左右邊緣至少這麼遠（CSS px）才畫 */
export const THUMB_EDGE = 8;

/**
 * 縮圖的裝飾物件（帆船、樹、木箱、短浪…）是否整個看得到：左右離外框至少 edge、上下不超出外框，也不伸進上緣的圓角。
 * 插圖是 720 × 160 的橫幅以 slice 填滿外框，外框比例不同時兩側裁掉的寬度不同，所以在瀏覽器量過才知道；
 * 看不完整的物件整個不畫（thumb-art.tsx），邊緣不會出現半艘船或一小段弧線。radius 是外框上緣的圓角半徑。
 */
export function thumbObjectFits(box: Rect, obj: Rect, radius = 0, edge = THUMB_EDGE): boolean {
  if (obj.left < box.left + edge || obj.right > box.right - edge) return false;
  if (obj.top < box.top - 1 || obj.bottom > box.bottom + 1) return false;
  const inTopBand = obj.top < box.top + radius;
  return !(inTopBand && (obj.left < box.left + radius || obj.right > box.right - radius));
}

const OPEN_QUOTES = '‘“「『';
const CLOSE_QUOTES = '’”」』';

/** 徽章預覽句子的三段：名字前、徽章名（連同前後的引號）、名字後 */
export interface BadgeTitleParts {
  readonly before: string;
  readonly title: string;
  readonly after: string;
}

/**
 * 從徽章預覽的譯文裡找出徽章名（連同緊鄰的引號，例如「開店了」、‘Open for business’）。主卡把它包成 inline-block，
 * 放得下時整個換到下一行，不在名字中間斷開（M3 驗收第 5 輪：英文 375 斷成「…to earn ‘Open」「for business’」）。
 * 譯文一定原樣含有徽章名（ICU 參數），引號是譯文的一部分，所以從譯文裡找，不改訊息格式；找不到時回傳 null（整句照原樣顯示）。
 */
export function splitBadgeTitle(text: string, name: string): BadgeTitleParts | null {
  const at = name ? text.indexOf(name) : -1;
  if (at < 0) return null;
  const start = at > 0 && OPEN_QUOTES.includes(text.charAt(at - 1)) ? at - 1 : at;
  const stop = at + name.length;
  const end = stop < text.length && CLOSE_QUOTES.includes(text.charAt(stop)) ? stop + 1 : stop;
  return { before: text.slice(0, start), title: text.slice(start, end), after: text.slice(end) };
}
