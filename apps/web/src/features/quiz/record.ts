// 作答後寫進進度儲存（06 第 4.2 節、03 第 2.10 到 2.11 節）：作答紀錄只增不改；答錯自動進錯題本盒子 1（已在錯題本的回盒子 1）；
// 一次作答的所有寫入先讀後算、再一起送出，不在寫入之間 await（快速跳頁時少掉一筆的機會，14 第 5.2 節）；
// 答對按「我是猜的」也進盒子 1；送出含 termRefs 的題目就解鎖名詞；完成關卡更新 levelProgress（星星與最佳成績取最大）。
// 時間與亂數都從 lib/progress 的包裝取，packages/progress 與 quiz 本身不讀時鐘。
// 進度資料庫暫停時（另一個分頁升級，06 第 4.3 節）讀取會丟 StoreSuspendedError、寫入排進暫存佇列：作答紀錄用先前讀到的 deviceId 照樣送出，
// 名詞解鎖也照樣送出（重放冪等、保留最早的時間）；要讀舊值才能算的錯題本盒子與關卡成績不盲寫，關卡成績丟出錯誤交給頁面。
import {
  generateAttemptId,
  type Attempt,
  type AttemptSource,
  type BackupReminderState,
  type JsonValue,
  type LevelProgress,
  type ProgressStore,
  type ReviewQueueEntry,
} from '@ledgerland/progress';
import { enterReview, levelScore, nextReview, type LevelItem, type ScoreResult } from '@ledgerland/quiz';
import type { QuestionSnapshot } from '../../lib/content.ts';
import { nowIso, secureRandom } from '../../lib/progress/app-info.ts';
import { getProgressStore } from '../../lib/progress/index.ts';

/** 結果頁的星星與正確率也在這裡取用，讓頁面和判分、紀錄一起延後載入（scoring-lazy.ts） */
export { levelScore };

/** 先前讀到的 deviceId：資料庫暫停時讀不到 meta，作答紀錄仍要帶裝置 ID */
let knownDeviceId: string | null = null;

/** 進度資料庫是否暫停中（不從 indexeddb-store 匯入錯誤類別：它在進度執行期的 chunk，判分 chunk 不帶它） */
function isSuspended(s: ProgressStore, e: unknown): boolean {
  return (e instanceof Error && e.name === 'StoreSuspendedError') || (s as { isSuspended?: unknown }).isSuspended === true;
}

async function deviceIdOf(s: ProgressStore): Promise<string> {
  try {
    const meta = await s.getMeta();
    knownDeviceId = meta.deviceId;
    return meta.deviceId;
  } catch (e) {
    if (knownDeviceId !== null && isSuspended(s, e)) return knownDeviceId;
    throw e;
  }
}

export interface RecordAttemptInput {
  readonly q: QuestionSnapshot;
  readonly answer: JsonValue;
  readonly result: ScoreResult;
  readonly source: AttemptSource;
  readonly levelId?: string;
  readonly durationMs: number;
}

export interface RecordAttemptOutput {
  readonly attemptId: string;
  /** 這次新解鎖的名詞 ID（Toast 用） */
  readonly unlockedTerms: string[];
}

export async function recordAttempt(input: RecordAttemptInput, store?: ProgressStore): Promise<RecordAttemptOutput> {
  const s = store ?? (await getProgressStore());
  const now = nowIso();
  const deviceId = await deviceIdOf(s);
  const attemptId = generateAttemptId(secureRandom);
  const { q, result } = input;
  const attempt: Attempt = {
    attemptId,
    questionId: q.id,
    rev: q.rev,
    chapterId: q.chapterId,
    ...(input.levelId === undefined ? {} : { levelId: input.levelId }),
    answer: input.answer,
    correct: result.correct,
    score: q.scored ? result.score : 0,
    durationMs: Math.max(0, Math.round(input.durationMs)),
    answeredAt: now,
    deviceId,
    source: input.source,
  };
  // 先把要讀的都讀完、算好全部要寫的東西，再一次送出所有寫入（不在寫入之間 await）：
  // 以前是 addAttempt、getReview、putReview、hasUnlock、addUnlock 逐筆 await，頁面在 addAttempt 完成後、putReview 還沒呼叫前被關閉，錯題本那一筆就掉了
  const toReview = q.scored && !result.correct && input.source === 'play';
  let reads: [ReviewQueueEntry | undefined, boolean[]];
  try {
    reads = await Promise.all([
      toReview ? s.getReview(q.id) : Promise.resolve(undefined),
      Promise.all(q.termRefs.map((termId) => s.hasUnlock(`term:${termId}`))),
    ]);
  } catch (e) {
    if (!isSuspended(s, e)) throw e;
    // 暫停中：作答紀錄與名詞解鎖照樣排進暫存佇列；錯題本要讀舊的盒子才能算，盲寫 enterReview 會蓋掉較新的紀錄，所以不寫。
    // 不回報新解鎖的名詞（不知道是不是第一次），畫面不顯示「收進名詞圖鑑」
    await Promise.all([s.addAttempt(attempt), ...q.termRefs.map((termId) => s.addUnlock({ id: `term:${termId}`, kind: 'term', unlockedAt: now }))]);
    return { attemptId, unlockedTerms: [] };
  }
  const [existing, unlocked] = reads;
  const writes: Promise<void>[] = [s.addAttempt(attempt)];
  if (toReview)
    writes.push(
      s.putReview(existing === undefined || existing.status === 'mastered' ? enterReview(q.id, q.rev, now, 'auto') : nextReview(existing, 'wrong', now)),
    );
  const unlockedTerms: string[] = [];
  q.termRefs.forEach((termId, i) => {
    if (unlocked[i]) return;
    writes.push(s.addUnlock({ id: `term:${termId}`, kind: 'term', unlockedAt: now }));
    unlockedTerms.push(termId);
  });
  await Promise.all(writes);
  return { attemptId, unlockedTerms };
}

/** 答對後按「我是猜的」：放進盒子 1（已在錯題本的不動） */
export async function recordGuessed(q: QuestionSnapshot, store?: ProgressStore): Promise<void> {
  const s = store ?? (await getProgressStore());
  const existing = await s.getReview(q.id);
  if (existing !== undefined && existing.status !== 'mastered') return;
  await s.putReview(enterReview(q.id, q.rev, nowIso(), 'guessed'));
}

/** 錯題本複習作答後：依 nextReview 更新盒子 */
export async function recordReviewResult(entry: ReviewQueueEntry, correct: boolean, store?: ProgressStore): Promise<ReviewQueueEntry> {
  const s = store ?? (await getProgressStore());
  const next = nextReview(entry, correct ? 'correct' : 'wrong', nowIso());
  await s.putReview(next);
  return next;
}

export interface LevelCompletion {
  readonly progress: LevelProgress;
  /** 這是這台裝置第一次完成任何關卡（呼叫 maybePersist('first-level-complete') 的時機） */
  readonly firstEver: boolean;
  readonly previousStars: 0 | 1 | 2 | 3 | undefined;
}

export interface LevelCompleteOptions {
  /** 整關不計分（level.unscored）：不算星星也不動 stars 與 bestScore，只記 firstCompletedAt 與 lastPlayedAt */
  readonly unscored?: boolean;
}

/** 完成關卡：星星與最佳成績取最大，firstCompletedAt 只記第一次；不計分的關卡只記完成。
 *  資料庫暫停時讀不到舊成績，不用空的舊值寫（會蓋掉較高的星星），讀取的錯誤原樣丟給頁面 */
export async function recordLevelComplete(
  levelId: string,
  items: readonly LevelItem[],
  store?: ProgressStore,
  options: LevelCompleteOptions = {},
): Promise<LevelCompletion> {
  const s = store ?? (await getProgressStore());
  const now = nowIso();
  const score = options.unscored ? { stars: 0 as const, ratio: 0 } : levelScore(items);
  const [existing, all] = await Promise.all([s.getLevelProgress(levelId), s.listLevelProgress()]);
  const firstEver = !all.some((p) => p.firstCompletedAt !== undefined);
  const progress: LevelProgress = {
    levelId,
    stars: existing === undefined ? score.stars : (Math.max(existing.stars, score.stars) as 0 | 1 | 2 | 3),
    bestScore: Math.max(existing?.bestScore ?? 0, score.ratio),
    firstCompletedAt: existing?.firstCompletedAt ?? now,
    lastPlayedAt: now,
  };
  await s.putLevelProgress(progress);
  await bumpLevelCounters(s, now);
  return { progress, firstEver, previousStars: existing?.stars };
}

/** 完成關卡的累計（settings）：levelsCompleted 給安裝提示看（06 第 2.5 節），backupReminder.levelsCompletedSinceExport 給備份提醒看（06 第 4.5 節）；匯出時由備份頁歸零 */
export const LEVELS_COMPLETED_SETTING = 'levelsCompleted';

async function bumpLevelCounters(s: ProgressStore, now: string): Promise<void> {
  const completed = (await s.getSetting(LEVELS_COMPLETED_SETTING))?.value;
  await s.setSetting(LEVELS_COMPLETED_SETTING, (typeof completed === 'number' ? completed : 0) + 1, now);
  const reminder = (await s.getSetting('backupReminder'))?.value as BackupReminderState | undefined;
  const next: BackupReminderState = { ...(reminder ?? {}), levelsCompletedSinceExport: (reminder?.levelsCompletedSinceExport ?? 0) + 1 };
  await s.setSetting('backupReminder', next, now);
}
