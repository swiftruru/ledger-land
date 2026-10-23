// 闖關地圖的資料來源（17 第 5.1 節）：content-manifest 的 chapters[] 與 levels[]、各章的章節快照、進度。
// 關卡名稱、學習目標與題數在章節快照的 levels[]（tools/lib/content-snapshot.mjs 的關卡摘要），load() 時一併填好，
// 不必逐關載入關卡檔；舊快照沒有 levels[] 時才退回讀關卡檔（17 第 8 節的分段載入）。測試與開發用的 fixture 來源在 fixtures.ts，形狀相同。
import type { Locale } from '@ledgerland/i18n';
import { loadChapter, loadLevel, loadManifest, loadTombstones, resolveId, type ResolvedId } from '../../lib/content.ts';

export interface MapLevel {
  readonly id: string;
  readonly chapterId: string;
  /** 章內序號（1 起） */
  readonly levelNo: number;
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
  /** 已下架的關卡 ID 與（若有）替代關卡 */
  readonly retiredLevels: ReadonlyMap<string, { supersededBy?: string }>;
}

export interface QuestMapSource {
  load(locale: Locale): Promise<QuestMapData>;
  levelMeta(levelId: string, locale: Locale): Promise<LevelMeta>;
  resolve(levelId: string): Promise<ResolvedId>;
}

/** 依 manifest 的 chapters 順序（order）組出地圖資料；主線在前、延伸章在後 */
export function buildChapters(
  raw: readonly {
    id: string;
    order: number;
    scope?: string;
    title: string;
    summary?: string;
    levelIds: readonly string[];
    badge?: { title: string };
    objectives: readonly { id: string; statement: string }[];
    chapterEndLinks?: readonly { kind: 'lab'; story: string; step: string }[];
  }[],
): MapChapter[] {
  const sorted = [...raw].sort((a, b) => a.order - b.order);
  const core = sorted.filter((c) => c.scope !== 'extension');
  const ext = sorted.filter((c) => c.scope === 'extension');
  const make = (c: (typeof sorted)[number], chapterNo: number, extension: boolean): MapChapter => ({
    id: c.id,
    order: c.order,
    chapterNo,
    extension,
    title: c.title,
    summary: c.summary,
    badgeTitle: c.badge?.title,
    objectives: c.objectives.map((o) => ({ id: o.id, statement: o.statement })),
    levels: c.levelIds.map((id, i) => ({ id, chapterId: c.id, levelNo: i + 1 })),
    chapterEndLinks: c.chapterEndLinks ?? [],
  });
  return [...core.map((c, i) => make(c, i + 1, false)), ...ext.map((c, i) => make(c, i + 1, true))];
}

export function indexData(chapters: readonly MapChapter[], retiredLevels: QuestMapData['retiredLevels']): QuestMapData {
  const levelById = new Map<string, MapLevel>();
  const chapterById = new Map<string, MapChapter>();
  for (const c of chapters) {
    chapterById.set(c.id, c);
    for (const l of c.levels) levelById.set(l.id, l);
  }
  return { chapters, levelById, chapterById, retiredLevels };
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
        const [snapshots, tombstones] = await Promise.all([Promise.all(m.chapters.map((c) => loadChapter(c.id, locale))), loadTombstones().catch(() => [])]);
        // 章節快照的關卡摘要直接填進 LevelMeta 快取，levelMeta() 就不用再載關卡檔
        for (const s of snapshots)
          for (const l of s.levels ?? [])
            metaCache.set(`${locale}:${l.id}`, Promise.resolve({ title: l.title, objectiveIds: l.objectiveIds ?? [], questionCount: l.questionCount }));
        const chapters = buildChapters(
          snapshots.map((s) => ({
            id: s.id,
            order: s.order,
            scope: typeof s.scope === 'string' ? s.scope : undefined,
            title: s.title,
            summary: s.summary,
            levelIds: s.levelIds,
            badge: s.badge,
            objectives: s.objectives,
            chapterEndLinks: Array.isArray(s.chapterEndLinks) ? (s.chapterEndLinks as { kind: 'lab'; story: string; step: string }[]) : undefined,
          })),
        );
        const retired = new Map<string, { supersededBy?: string }>();
        for (const t of tombstones) if (t.kind === 'level') retired.set(t.id, t.supersededBy === undefined ? {} : { supersededBy: t.supersededBy });
        return indexData(chapters, retired);
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
