// 首頁要的闖關進度（站規 2.1、1.16）：目前關卡（建議順序中第一個還沒完成的關卡，和地圖同一套 currentLevelId）、所在章節、
// 章節小地圖要的整張地圖輸入、已完成的關卡與各關的星星（完成的節點下方畫星星籤，第 2 輪看圖驗收），
// 這一章的進度（寬版主卡的進度條與星星數），加上玩家統計（捷徑的圖鑑與徽章數）。只在第一次繪製之後以 import() 載入（useHomeQuest）。
// 關卡名與章名在這裡先用 web-ui 的 phraseParts 切成詞（titleParts，M3 驗收第 9 輪：320 的主卡排成「下一關「綜合挑／戰：從數字倒推」」），
// 首頁（首次載入的 chunk）只用 me/PhrasedParts.tsx 在詞與詞之間放 <wbr>，不帶切詞程式。keep 清單和章節頁、名詞頁同一種做法：
// 名稱裡出現的名詞（名詞索引的名稱、現行用語與別名，6 個字以內：「每股盈餘」不拆成「每股／盈餘」）、英數字串（「N/A」不拆在斜線），
// 加上冒號前的小標（「綜合挑戰：」「償債能力：」，兩行時斷在冒號後）。
import type { Locale } from '@ledgerland/i18n';
import type { Stars } from '@ledgerland/progress';
import { phraseParts } from '@ledgerland/web-ui';
import { loadTermIndex } from '../../lib/content.ts';
import { loadPlayerStats, type PlayerStats } from '../me/player-stats.ts';
import { contentSource, orderedLevels } from '../quest-map/data.ts';
import { currentLevelId, levelDone, loadMapProgress, starsOf } from '../quest-map/progress.ts';

export interface HomeLevel {
  readonly levelId: string;
  readonly title: string;
  /** 關卡名切成的詞（phraseParts；英文或不支援 Segmenter 時沒有） */
  readonly titleParts?: readonly string[];
  /** 章序（主線與延伸區各自從 1 起算）與章內關序 */
  readonly chapterNo: number;
  readonly levelNo: number;
  readonly extension: boolean;
}

export interface HomeChapter {
  readonly id: string;
  readonly title: string;
  /** 章名切成的詞（同上） */
  readonly titleParts?: readonly string[];
  readonly chapterNo: number;
  readonly extension: boolean;
}

export interface HomeQuest {
  /** new：還沒有任何進度；continue：有下一關；allDone：全部關卡都完成了（next 是最後玩的那一關） */
  readonly state: 'new' | 'continue' | 'allDone';
  readonly next: HomeLevel;
  readonly chapter: HomeChapter;
  /** 整張地圖的輸入（依建議順序；小地圖要排整張圖，入口側與路線樣板才會和地圖頁一樣） */
  readonly chapters: readonly { readonly id: string; readonly levelIds: readonly string[]; readonly extension: boolean }[];
  /** 建議順序中的序號（已走與未走的路線依它切分） */
  readonly order: ReadonlyMap<string, number>;
  readonly done: ReadonlySet<string>;
  /** 計分關卡的最佳星星（沒有紀錄的關卡不在裡面） */
  readonly stars: ReadonlyMap<string, Stars>;
  /** 整關不計分的關卡（沒有星等，節點下方不畫星星籤） */
  readonly unscored: ReadonlySet<string>;
  /** 目前這一章的進度：完成的關數與總關數、拿到的星星與滿星數（不計分關卡不算星星） */
  readonly progress: { readonly done: number; readonly total: number; readonly stars: number; readonly maxStars: number };
}

export interface HomeData {
  /** 沒有任何已發布的關卡時是 null */
  readonly quest: HomeQuest | null;
  readonly stats: PlayerStats;
}

const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;
/** 冒號前的小標（2 到 6 個字加全形冒號） */
const HEAD = /^[^：]{2,6}：/;
/** 英數字串（「N/A」「ROE」「NT$1,200」）：Segmenter 會在斜線兩邊切開 */
const LATIN = /[A-Za-z0-9$][\w$/.,%&+-]*[\w%]/g;
/** keep 清單收的名詞最長幾個字（太長的整塊在 200% 字級時放不進一行） */
const MAX_KEEP = 6;

/** 名稱切成詞（exactOptionalPropertyTypes：英文或不支援 Segmenter 時不放這個欄位）。keep 是名詞索引的名稱 */
function withParts(title: string, terms: readonly string[]): { titleParts?: readonly string[] } {
  const head = HEAD.exec(title)?.[0];
  const keep = [...terms.filter((w) => title.includes(w)), ...(title.match(LATIN) ?? [])];
  if (head !== undefined) keep.push(head);
  const parts = phraseParts(title, keep);
  if (parts) return { titleParts: parts };
  // 整個名稱黏成一個詞（「把利益換回現金」：單字都黏著前後的詞）：整塊不拆，不退回逐字換行
  return CJK.test(title) && typeof Intl.Segmenter === 'function' ? { titleParts: [title] } : {};
}

export async function loadHomeData(locale: Locale): Promise<HomeData> {
  const [data, progress] = await Promise.all([contentSource.load(locale), loadMapProgress()]);
  const stats = await loadPlayerStats(locale, { data, progress });
  const levels = orderedLevels(data);
  const currentId = currentLevelId(data, progress);
  const current = currentId === null ? undefined : data.levelById.get(currentId);
  const chapter = current === undefined ? undefined : data.chapterById.get(current.chapterId);
  if (current === undefined || chapter === undefined) return { quest: null, stats };
  const done = new Set(levels.filter((l) => levelDone(progress, l)).map((l) => l.id));
  const meta = await contentSource.levelMeta(current.id, locale).catch(() => undefined);
  const state: HomeQuest['state'] = progress.levels.size === 0 ? 'new' : done.size === levels.length ? 'allDone' : 'continue';
  const stars = new Map<string, Stars>();
  for (const l of levels) if (!l.unscored && progress.levels.has(l.id)) stars.set(l.id, starsOf(progress, l.id));
  const inChapter = chapter.levels;
  const scored = inChapter.filter((l) => !l.unscored);
  const levelTitle = meta?.title ?? '';
  const terms = await loadTermIndex(locale).then(
    (list) => list.flatMap((t) => [t.label, t.currentTwLabel ?? '', ...(t.aliases?.[locale] ?? [])]).filter((w) => w.length >= 2 && w.length <= MAX_KEEP),
    () => [],
  );
  return {
    stats,
    quest: {
      state,
      next: {
        levelId: current.id,
        title: levelTitle,
        ...withParts(levelTitle, terms),
        chapterNo: chapter.chapterNo,
        levelNo: current.levelNo,
        extension: chapter.extension,
      },
      chapter: { id: chapter.id, title: chapter.title, ...withParts(chapter.title, terms), chapterNo: chapter.chapterNo, extension: chapter.extension },
      chapters: data.chapters.map((c) => ({ id: c.id, levelIds: c.levels.map((l) => l.id), extension: c.extension })),
      order: new Map(levels.map((l, i) => [l.id, i] as const)),
      done,
      stars,
      unscored: new Set(levels.filter((l) => l.unscored).map((l) => l.id)),
      progress: {
        done: inChapter.filter((l) => done.has(l.id)).length,
        total: inChapter.length,
        stars: scored.reduce((n, l) => n + starsOf(progress, l.id), 0),
        maxStars: scored.length * 3,
      },
    },
  };
}
