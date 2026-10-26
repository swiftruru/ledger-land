// 闖關地圖的資料來源（17 第 5.1 節）：content-manifest 的 chapters[] 與 levels[]、章節索引（全部章節的摘要，一個語系一檔）、進度。
// 延伸區由章節的 scope（extension）決定位置；「不列入期中考」的標示另看快照的 examScope（not_in_exam），延伸章一律標示；
// 主線章節的 examScope 為 midterm 時標「期中考範圍」，並說明範圍以老師公告為準（T32）。
// 關卡名稱、學習目標與題數在章節索引的 levels[]（tools/lib/content-snapshot.mjs 的關卡摘要），load() 時一併填好，
// 不必逐關載入關卡檔；舊快照沒有 levels[] 時才退回讀關卡檔（17 第 8 節的分段載入）。測試與開發用的 fixture 來源在 fixtures.ts，形狀相同。
import type { Locale } from '@ledgerland/i18n';
import { LAB_STEP_ROUTE_READY } from '../../app/routes-ready.ts';
import { loadChapterIndex, loadLevel, loadManifest, resolveId, type ResolvedId } from '../../lib/content.ts';

export interface MapLevel {
  readonly id: string;
  readonly chapterId: string;
  /** 章內序號（1 起） */
  readonly levelNo: number;
  /** 整關都是不計分的取捨題（關卡與章節快照、manifest 的 levels[] 帶 unscored: true）：沒有星等，只有「已讀完」與「尚未讀」 */
  readonly unscored: boolean;
}

export interface MapObjective {
  readonly id: string;
  readonly statement: string;
}

export interface MapChapter {
  readonly id: string;
  readonly order: number;
  /** 主線與延伸區各自從 1 起算的章序（17 評估四） */
  readonly chapterNo: number;
  readonly extension: boolean;
  /** 不列入期中考（03 第 2.2 節）：延伸章一律是；主線章節依快照的 examScope 為 not_in_exam 時也是 */
  readonly notInExam: boolean;
  /** 期中考範圍（T32）：主線章節且快照的 examScope 為 midterm；unconfirmed 或沒有 examScope 時不標（03 第 3 節） */
  readonly inExam: boolean;
  readonly title: string;
  readonly summary?: string;
  readonly badgeTitle?: string;
  readonly objectives: readonly MapObjective[];
  readonly levels: readonly MapLevel[];
  readonly chapterEndLinks: readonly { kind: 'lab'; story: string; step: string }[];
}

export interface LevelMeta {
  readonly title: string;
  readonly objectiveIds: readonly string[];
  /** 該關已發布的題數（章節快照的 levels[] 才有；fixture 與舊快照沒有） */
  readonly questionCount?: number;
}

export interface QuestMapData {
  readonly chapters: readonly MapChapter[];
  readonly levelById: ReadonlyMap<string, MapLevel>;
  readonly chapterById: ReadonlyMap<string, MapChapter>;
  /** 已下架的關卡 ID 與（若有）替代關卡。正式來源一律是空的：地圖第一次繪製不讀墓碑檔（少一個請求，06 第 8.2 節），
   *  代號與 QR 遇到下架關卡時由 source.resolve 另外查墓碑；fixture 用它模擬一個下架的關卡 */
  readonly retiredLevels: ReadonlyMap<string, { supersededBy?: string }>;
  /** manifest 裡已發布的故事 ID；章末的「相關實驗室步驟」只連到這裡有的故事（故事 M4a 才發布，沒有就不顯示） */
  readonly publishedStories: ReadonlySet<string>;
}

export interface QuestMapSource {
  load(locale: Locale): Promise<QuestMapData>;
  levelMeta(levelId: string, locale: Locale): Promise<LevelMeta>;
  resolve(levelId: string): Promise<ResolvedId>;
}

/** 依 manifest 的 chapters 順序（order）組出地圖資料；主線在前、延伸章在後。unscoredLevelIds 是不計分關卡的 ID（快照摘要與 manifest 的 unscored: true） */
export function buildChapters(
  raw: readonly {
    id: string;
    order: number;
    scope?: string;
    examScope?: string;
    title: string;
    summary?: string;
    levelIds: readonly string[];
    badge?: { title: string };
    objectives: readonly { id: string; statement: string }[];
    chapterEndLinks?: readonly { kind: 'lab'; story: string; step: string }[];
  }[],
  unscoredLevelIds: ReadonlySet<string> = new Set(),
): MapChapter[] {
  const sorted = [...raw].sort((a, b) => a.order - b.order);
  const core = sorted.filter((c) => c.scope !== 'extension');
  const ext = sorted.filter((c) => c.scope === 'extension');
  const make = (c: (typeof sorted)[number], chapterNo: number, extension: boolean): MapChapter => ({
    id: c.id,
    order: c.order,
    chapterNo,
    extension,
    notInExam: extension || c.examScope === 'not_in_exam',
    inExam: !extension && c.examScope === 'midterm',
    title: c.title,
    summary: c.summary,
    badgeTitle: c.badge?.title,
    objectives: c.objectives.map((o) => ({ id: o.id, statement: o.statement })),
    levels: c.levelIds.map((id, i) => ({ id, chapterId: c.id, levelNo: i + 1, unscored: unscoredLevelIds.has(id) })),
    chapterEndLinks: c.chapterEndLinks ?? [],
  });
  return [...core.map((c, i) => make(c, i + 1, false)), ...ext.map((c, i) => make(c, i + 1, true))];
}

export function indexData(
  chapters: readonly MapChapter[],
  retiredLevels: QuestMapData['retiredLevels'],
  publishedStories: ReadonlySet<string> = new Set(),
): QuestMapData {
  const levelById = new Map<string, MapLevel>();
  const chapterById = new Map<string, MapChapter>();
  for (const c of chapters) {
    chapterById.set(c.id, c);
    for (const l of c.levels) levelById.set(l.id, l);
  }
  return { chapters, levelById, chapterById, retiredLevels, publishedStories };
}

/** 章末可以顯示的「相關實驗室步驟」連結：故事步驟的路由要存在（LAB_STEP_ROUTE_READY，站規 2.2.6 的 404 防護），
 *  而且只留故事已發布（在 manifest 的 stories 裡）的，找不到就不顯示壞連結 */
export function availableEndLinks(data: QuestMapData, chapter: MapChapter, routeReady: boolean = LAB_STEP_ROUTE_READY): MapChapter['chapterEndLinks'] {
  if (!routeReady) return [];
  return chapter.chapterEndLinks.filter((l) => data.publishedStories.has(l.story));
}

/** 建議順序中的所有關卡（主線再延伸區） */
export function orderedLevels(data: QuestMapData): MapLevel[] {
  return data.chapters.flatMap((c) => c.levels);
}

const dataCache = new Map<Locale, Promise<QuestMapData>>();
const metaCache = new Map<string, Promise<LevelMeta>>();

/** 正式來源：content-manifest 與快照（apps/web/src/lib/content.ts） */
export const contentSource: QuestMapSource = {
  load(locale) {
    let p = dataCache.get(locale);
    if (!p) {
      p = (async () => {
        const m = await loadManifest();
        // 章節索引一檔就有全部章節的標題、徽章、關卡摘要與學習目標（08 第 7.3 節），不逐章讀章節檔；墓碑檔也不讀（retiredLevels 的註解），
        // 地圖第一次繪製只等 manifest 與這一檔（06 第 8.2 節）
        const snapshots = await loadChapterIndex(locale);
        // 不計分關卡：manifest 的 levels[] 與章節快照的 levels[] 摘要都帶 unscored: true（只在 true 時輸出）
        const unscored = new Set<string>();
        for (const l of m.levels ?? []) if ((l as { unscored?: boolean }).unscored === true) unscored.add(l.id);
        // 章節快照的關卡摘要直接填進 LevelMeta 快取，levelMeta() 就不用再載關卡檔
        for (const s of snapshots)
          for (const l of s.levels ?? []) {
            if ((l as { unscored?: boolean }).unscored === true) unscored.add(l.id);
            metaCache.set(`${locale}:${l.id}`, Promise.resolve({ title: l.title, objectiveIds: l.objectiveIds ?? [], questionCount: l.questionCount }));
          }
        const chapters = buildChapters(
          snapshots.map((s) => ({
            id: s.id,
            order: s.order,
            scope: typeof s.scope === 'string' ? s.scope : undefined,
            examScope: typeof s.examScope === 'string' ? s.examScope : undefined,
            title: s.title,
            summary: s.summary,
            levelIds: s.levelIds,
            badge: s.badge,
            objectives: s.objectives,
            chapterEndLinks: Array.isArray(s.chapterEndLinks) ? s.chapterEndLinks : undefined,
          })),
          unscored,
        );
        const stories = (m as { stories?: readonly { id?: string }[] }).stories;
        const publishedStories = new Set<string>();
        for (const st of Array.isArray(stories) ? stories : []) if (typeof st?.id === 'string') publishedStories.add(st.id);
        return indexData(chapters, new Map(), publishedStories);
      })();
      dataCache.set(locale, p);
      p.catch(() => dataCache.delete(locale));
    }
    return p;
  },
  levelMeta(levelId, locale) {
    const key = `${locale}:${levelId}`;
    let p = metaCache.get(key);
    if (!p) {
      p = loadLevel(levelId, locale).then((s) => ({ title: s.level.title, objectiveIds: s.level.objectiveIds ?? [] }));
      metaCache.set(key, p);
      p.catch(() => metaCache.delete(key));
    }
    return p;
  },
  resolve(levelId) {
    return resolveId(levelId);
  },
};
