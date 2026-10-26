// 地圖要用的進度（17 第 5.1 節）：關卡最佳星星、徽章、錯題本待複習數，全部由 @ledgerland/progress 的 ProgressStore 讀出。
// 目前關卡 = 建議順序中第一個還沒完成的關卡（計分關卡沒有星星、不計分關卡還沒讀完）；全部完成時 = 最後一次挑戰的關卡。
// 不計分關卡（level.unscored）：沒有星等，只有「已讀完」（進度裡有這一關的紀錄）與「尚未讀」。
// 章節徽章（03 第 2.10 節）：「完成」是章內每一計分關卡至少一星，「精通」是每一計分關卡三星（同一枚徽章的進階外觀，不另外計數）；
// 判定跳過不計分關卡，整章都不計分時「完成」是每關都讀完、沒有精通。
// 判定是純函式（badgeStateFor、earnedBadges）；寫入走 ProgressStore 的 addUnlock（kind badge，id badge:<章節 ID> 與 badge:<章節 ID>:mastery），由 syncBadges 負責。
import type { Stars, Unlock } from '@ledgerland/progress';
import { getProgressStore, nowIso, todayLocal } from '../../lib/progress/index.ts';
import { orderedLevels, type MapLevel, type QuestMapData } from './data.ts';

export interface LevelBest {
  readonly stars: Stars;
  readonly bestScore: number;
  readonly lastPlayedAt: string;
  /** 第一次完成的時間（沒有完成紀錄時省略）：徽章的取得日期用它，不用最後一次重玩的時間（finding map-3） */
  readonly firstCompletedAt?: string;
}

export interface MapProgress {
  readonly levels: ReadonlyMap<string, LevelBest>;
  /** 已取得的徽章 unlock ID（badge:<章節 ID> 與 badge:<章節 ID>:mastery） */
  readonly badges: ReadonlySet<string>;
  readonly due: number;
  /** 已下架關卡所屬的章節（由作答紀錄的 chapterId 反查；只在章節頁需要時填） */
  readonly retiredChapterOf?: ReadonlyMap<string, string>;
}

export const EMPTY_PROGRESS: MapProgress = { levels: new Map(), badges: new Set(), due: 0 };

export function badgeUnlockId(chapterId: string): string {
  return `badge:${chapterId}`;
}

export function masteryUnlockId(chapterId: string): string {
  return `badge:${chapterId}:mastery`;
}

export type BadgeState = 'locked' | 'done' | 'mastery';

/** 依星星算出的徽章等級（不看已存的 unlock）：章內沒有關卡時是 locked；不計分關卡跳過，整章都不計分時每關讀完就是 done（沒有精通） */
export function badgeStateByStars(data: QuestMapData, progress: MapProgress, chapterId: string): BadgeState {
  const c = data.chapterById.get(chapterId);
  if (!c || c.levels.length === 0) return 'locked';
  const scored = c.levels.filter((l) => !l.unscored);
  if (scored.length === 0) return c.levels.every((l) => levelRead(progress, l.id)) ? 'done' : 'locked';
  let allDone = true;
  let allMastered = true;
  for (const l of scored) {
    const s = starsOf(progress, l.id);
    if (s === 0) allDone = false;
    if (s < 3) allMastered = false;
  }
  if (allMastered) return 'mastery';
  return allDone ? 'done' : 'locked';
}

/** 章節牌要顯示的徽章狀態：星星算出的等級與已存的 unlock 取較高者（徽章不收回，內容調整後已取得的仍顯示） */
export function badgeStateFor(data: QuestMapData, progress: MapProgress, chapterId: string): BadgeState {
  const byStars = badgeStateByStars(data, progress, chapterId);
  if (byStars === 'mastery' || progress.badges.has(masteryUnlockId(chapterId))) return 'mastery';
  if (byStars === 'done' || progress.badges.has(badgeUnlockId(chapterId))) return 'done';
  return 'locked';
}

/** 頂部統計的徽章數：每章一枚，精通是同一枚的進階外觀，不另外計數 */
export function badgeCount(progress: MapProgress): number {
  let n = 0;
  for (const id of progress.badges) if (!id.endsWith(':mastery')) n++;
  return n;
}

export interface EarnedBadge {
  readonly chapterId: string;
  /** 這次新取得的等級（同時新取得完成與精通時是 mastery） */
  readonly state: 'done' | 'mastery';
  /** 要寫進進度的 unlock ID（可能同時有完成與精通兩個） */
  readonly unlockIds: readonly string[];
}

/** 依星星已達成、但進度裡還沒有的徽章（依章節順序） */
export function earnedBadges(data: QuestMapData, progress: MapProgress): EarnedBadge[] {
  const out: EarnedBadge[] = [];
  for (const c of data.chapters) {
    const byStars = badgeStateByStars(data, progress, c.id);
    if (byStars === 'locked') continue;
    const ids: string[] = [];
    if (!progress.badges.has(badgeUnlockId(c.id))) ids.push(badgeUnlockId(c.id));
    if (byStars === 'mastery' && !progress.badges.has(masteryUnlockId(c.id))) ids.push(masteryUnlockId(c.id));
    if (ids.length === 0) continue;
    out.push({ chapterId: c.id, state: ids.includes(masteryUnlockId(c.id)) ? 'mastery' : 'done', unlockIds: ids });
  }
  return out;
}

/** 把新徽章寫進進度（ProgressStore.addUnlock；已存在時保留較早的時間）。寫不進去時不丟錯，下次打開地圖再試 */
export async function syncBadges(earned: readonly EarnedBadge[], unlockedAt: string = nowIso()): Promise<boolean> {
  const ids = earned.flatMap((e) => e.unlockIds);
  if (ids.length === 0) return true;
  try {
    const store = await getProgressStore();
    for (const id of ids) {
      const unlock: Unlock = { id, kind: 'badge', unlockedAt };
      await store.addUnlock(unlock);
    }
    return true;
  } catch {
    return false;
  }
}

/** 回傳加上這些徽章之後的進度（不改原物件） */
export function withBadges(progress: MapProgress, ids: Iterable<string>): MapProgress {
  const badges = new Set(progress.badges);
  for (const id of ids) badges.add(id);
  return { ...progress, badges };
}

export async function loadMapProgress(): Promise<MapProgress> {
  try {
    const store = await getProgressStore();
    const [levelList, unlocks, due] = await Promise.all([store.listLevelProgress(), store.listUnlocks('badge'), store.listDueReviews(todayLocal())]);
    const levels = new Map<string, LevelBest>();
    for (const l of levelList)
      levels.set(
        l.levelId,
        l.firstCompletedAt === undefined
          ? { stars: l.stars, bestScore: l.bestScore, lastPlayedAt: l.lastPlayedAt }
          : { stars: l.stars, bestScore: l.bestScore, lastPlayedAt: l.lastPlayedAt, firstCompletedAt: l.firstCompletedAt },
      );
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

/** 不計分關卡的「已讀完」：進度裡有這一關的紀錄（結果頁只記完成、不寫星星） */
export function levelRead(progress: MapProgress, levelId: string): boolean {
  return progress.levels.has(levelId);
}

/** 關卡是否完成：計分關卡至少一星；不計分關卡已讀完 */
export function levelDone(progress: MapProgress, level: Pick<MapLevel, 'id' | 'unscored'>): boolean {
  return level.unscored ? levelRead(progress, level.id) : starsOf(progress, level.id) > 0;
}

export function totalStars(progress: MapProgress): number {
  let n = 0;
  for (const l of progress.levels.values()) n += l.stars;
  return n;
}

export function currentLevelId(data: QuestMapData, progress: MapProgress): string | null {
  const levels = orderedLevels(data);
  if (levels.length === 0) return null;
  const first = levels.find((l) => !levelDone(progress, l));
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
  return { done: c.levels.filter((l) => levelDone(progress, l)).length, total: c.levels.length };
}

/** 已下架的關卡 ID：進度裡有、內容裡沒有 */
export function orphanLevelIds(data: QuestMapData, progress: MapProgress): string[] {
  return [...progress.levels.keys()].filter((id) => !data.levelById.has(id));
}
