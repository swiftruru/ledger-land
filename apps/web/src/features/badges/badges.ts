// 章節徽章的讀取端（03 第 2.10 節、08 第 7.3 節）：只讀 ProgressStore 的 unlock（badge:<章節 ID> 是完成、badge:<章節 ID>:mastery 是精通），
// 判定與寫入在 features/quest-map/progress.ts。沒有 DOM、沒有 React。
export type ChapterBadgeLevel = 'locked' | 'done' | 'mastery';

export interface ChapterBadgeStatus {
  readonly state: ChapterBadgeLevel;
  /** 完成徽章的取得時間（ISO，含本地時區位移） */
  readonly doneAt?: string;
  readonly masteryAt?: string;
}

export function badgeUnlockId(chapterId: string): string {
  return `badge:${chapterId}`;
}

export function masteryUnlockId(chapterId: string): string {
  return `badge:${chapterId}:mastery`;
}

/** 由 unlock（id 對 unlockedAt）算出某一章的徽章狀態；只有精通沒有完成時也視為精通（精通是同一枚徽章的進階外觀） */
export function badgeStatusOf(unlocks: ReadonlyMap<string, string>, chapterId: string): ChapterBadgeStatus {
  const doneAt = unlocks.get(badgeUnlockId(chapterId));
  const masteryAt = unlocks.get(masteryUnlockId(chapterId));
  const state: ChapterBadgeLevel = masteryAt !== undefined ? 'mastery' : doneAt !== undefined ? 'done' : 'locked';
  return {
    state,
    ...(doneAt === undefined ? {} : { doneAt }),
    ...(masteryAt === undefined ? {} : { masteryAt }),
  };
}

/** ISO 時間字串的日期部分（nowIso 帶本地時區位移，所以前十碼就是裝置的本地日期） */
export function isoDatePart(iso: string): string {
  return iso.slice(0, 10);
}

/** 整章不計分的章（finding pages-a-1）：章節索引裡已發布的關卡全部帶 unscored: true。和地圖的 badgeStateByStars（scored.length === 0）同一個判定：
 *  這種章每關讀完就是「完成」、沒有精通，徽章頁不能寫「每關至少一星」或「三星升級精通」 */
export function unscoredChapterIds(summaries: readonly { readonly id: string; readonly levels?: readonly { readonly unscored?: boolean }[] }[]): Set<string> {
  const out = new Set<string>();
  for (const s of summaries) {
    const levels = s.levels ?? [];
    if (levels.length > 0 && levels.every((l) => l.unscored === true)) out.add(s.id);
  }
  return out;
}
