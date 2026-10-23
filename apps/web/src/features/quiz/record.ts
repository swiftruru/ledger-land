// 作答後寫進進度儲存（06 第 4.2 節、03 第 2.10 到 2.11 節）：作答紀錄只增不改；答錯自動進錯題本盒子 1（已在錯題本的回盒子 1）；
// 答對按「我是猜的」也進盒子 1；送出含 termRefs 的題目就解鎖名詞；完成關卡更新 levelProgress（星星與最佳成績取最大）。
// 時間與亂數都從 lib/progress 的包裝取，packages/progress 與 quiz 本身不讀時鐘。
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
  const meta = await s.getMeta();
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
    deviceId: meta.deviceId,
    source: input.source,
  };
  await s.addAttempt(attempt);
  if (q.scored && !result.correct && input.source === 'play') {
    const existing = await s.getReview(q.id);
    await s.putReview(existing === undefined || existing.status === 'mastered' ? enterReview(q.id, q.rev, now, 'auto') : nextReview(existing, 'wrong', now));
  }
  const unlockedTerms: string[] = [];
  for (const termId of q.termRefs) {
    const id = `term:${termId}`;
    if (await s.hasUnlock(id)) continue;
    await s.addUnlock({ id, kind: 'term', unlockedAt: now });
    unlockedTerms.push(termId);
  }
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

/** 完成關卡：星星與最佳成績取最大，firstCompletedAt 只記第一次 */
export async function recordLevelComplete(levelId: string, items: readonly LevelItem[], store?: ProgressStore): Promise<LevelCompletion> {
  const s = store ?? (await getProgressStore());
  const now = nowIso();
  const score = levelScore(items);
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
