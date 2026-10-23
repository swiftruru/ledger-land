// 地圖要用的進度（17 第 5.1 節）：關卡最佳星星、徽章數、錯題本待複習數，全部由 @ledgerland/progress 的 ProgressStore 讀出。
// 目前關卡 = 建議順序中第一個沒有星星的關卡；全部完成時 = 最後一次挑戰的關卡。
import type { Stars } from '@ledgerland/progress';
import { getProgressStore, todayLocal } from '../../lib/progress/index.ts';
import { orderedLevels, type QuestMapData } from './data.ts';

export interface LevelBest {
  readonly stars: Stars;
  readonly bestScore: number;
  readonly lastPlayedAt: string;
}

export interface MapProgress {
  readonly levels: ReadonlyMap<string, LevelBest>;
  /** 已取得的徽章 unlock ID（badge:<章節 ID>） */
  readonly badges: ReadonlySet<string>;
  readonly due: number;
  /** 已下架關卡所屬的章節（由作答紀錄的 chapterId 反查；只在章節頁需要時填） */
  readonly retiredChapterOf?: ReadonlyMap<string, string>;
}

export const EMPTY_PROGRESS: MapProgress = { levels: new Map(), badges: new Set(), due: 0 };

export function badgeUnlockId(chapterId: string): string {
  return `badge:${chapterId}`;
}

export async function loadMapProgress(): Promise<MapProgress> {
  try {
    const store = await getProgressStore();
    const [levelList, unlocks, due] = await Promise.all([store.listLevelProgress(), store.listUnlocks('badge'), store.listDueReviews(todayLocal())]);
    const levels = new Map<string, LevelBest>();
    for (const l of levelList) levels.set(l.levelId, { stars: l.stars, bestScore: l.bestScore, lastPlayedAt: l.lastPlayedAt });
    return { levels, badges: new Set(unlocks.map((u) => u.id)), due: due.length };
  } catch {
    return EMPTY_PROGRESS;
  }
}

/** 已下架的關卡（進度有、內容沒有）所屬的章節：從該關卡的作答紀錄取 chapterId */
export async function retiredChaptersOf(levelIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
  const out = new Map<string, string>();
  if (levelIds.length === 0) return out;
  try {
    const store = await getProgressStore();
    for (const levelId of levelIds) {
      const attempts = await store.listAttempts({ levelId });
      const withChapter = attempts.find((a) => a.chapterId !== undefined);
      if (withChapter?.chapterId) out.set(levelId, withChapter.chapterId);
    }
  } catch {
    /* 讀不到就不列 */
  }
  return out;
}

export function starsOf(progress: MapProgress, levelId: string): Stars {
  return progress.levels.get(levelId)?.stars ?? 0;
}

export function totalStars(progress: MapProgress): number {
  let n = 0;
  for (const l of progress.levels.values()) n += l.stars;
  return n;
}

export function currentLevelId(data: QuestMapData, progress: MapProgress): string | null {
  const levels = orderedLevels(data);
  if (levels.length === 0) return null;
  const first = levels.find((l) => starsOf(progress, l.id) === 0);
  if (first) return first.id;
  let last: { id: string; at: string } | null = null;
  for (const l of levels) {
    const at = progress.levels.get(l.id)?.lastPlayedAt;
    if (at !== undefined && (last === null || at > last.at)) last = { id: l.id, at };
  }
  return last?.id ?? levels[levels.length - 1]!.id;
}

/** 建議順序中的前一關（第一關為 null） */
export function previousLevelId(data: QuestMapData, levelId: string): string | null {
  const levels = orderedLevels(data);
  const i = levels.findIndex((l) => l.id === levelId);
  return i > 0 ? levels[i - 1]!.id : null;
}

export function chapterDone(data: QuestMapData, progress: MapProgress, chapterId: string): { done: number; total: number } {
  const c = data.chapterById.get(chapterId);
  if (!c) return { done: 0, total: 0 };
  return { done: c.levels.filter((l) => starsOf(progress, l.id) > 0).length, total: c.levels.length };
}

/** 已下架的關卡 ID：進度裡有、內容裡沒有 */
export function orphanLevelIds(data: QuestMapData, progress: MapProgress): string[] {
  return [...progress.levels.keys()].filter((id) => !data.levelById.has(id));
}
