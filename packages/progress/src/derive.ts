// 由作答紀錄推導的值（06 第 4.2 節：levelProgress 由 attempts 推導、reviewQueue.wrongCount 由合併後的 attempts 重算）
// 與備份提醒（06 第 4.5 節）。全部是純函式；星星用 packages/quiz 的 starsFor（03 第 2.10 節的門檻），測試可注入別的規則。
import { starsFor as quizStarsFor } from '@ledgerland/quiz';
import type { Attempt, BackupReminderState, LevelProgress, Stars } from './model.ts';
import { MS_PER_DAY, compareIso, diffMs, latestIso } from './time.ts';
import { compareCodeUnits } from './util.ts';

/** 推導關卡成績時需要知道每一關的計分題（取捨題不算，03 第 2.10 節） */
export interface LevelSpec {
  readonly levelId: string;
  readonly scoredQuestionIds: readonly string[];
}

export interface DeriveOptions {
  /** 由計分題得分總和與題數算星星；預設是 quiz 的 starsFor */
  readonly starsFor?: (totalScore: number, scoredCount: number) => Stars;
}

/** 一筆作答的得分：省略 score 時以 correct 推算 */
export function attemptScore(a: Attempt): number {
  return a.score ?? (a.correct ? 1 : 0);
}

/**
 * 由作答紀錄推導各關卡的最佳成績。只看 source 為 play 且帶 levelId 的紀錄（錯題本複習不改變星星）。
 * 一次「闖關」的切分：依時間順序累積該關的作答，同一題再次出現就視為下一次闖關開始；
 * 答完所有計分題才算完成（未達 60% 也算完成）。stars 與 bestScore 取各次完成的最大值，
 * firstCompletedAt 是第一次完成的最後一題時間，lastPlayedAt 是最後一筆作答的時間。
 * 沒有任何完成紀錄的關卡仍列出（stars 0、bestScore 0、沒有 firstCompletedAt）；沒有作答紀錄的關卡不列出。
 */
export function deriveLevelProgress(attempts: readonly Attempt[], levels: readonly LevelSpec[], options: DeriveOptions = {}): LevelProgress[] {
  const starsFor = options.starsFor ?? quizStarsFor;
  const byLevel = new Map<string, Attempt[]>();
  for (const a of attempts) {
    if (a.source !== 'play' || a.levelId === undefined) continue;
    const list = byLevel.get(a.levelId) ?? [];
    list.push(a);
    byLevel.set(a.levelId, list);
  }
  const out: LevelProgress[] = [];
  const specs = new Map(levels.map((l) => [l.levelId, l]));
  for (const [levelId, list] of byLevel) {
    const spec = specs.get(levelId);
    if (spec === undefined) continue;
    const scored = new Set(spec.scoredQuestionIds);
    const sorted = [...list].sort((x, y) => compareIso(x.answeredAt, y.answeredAt) || compareCodeUnits(x.attemptId, y.attemptId));
    let lastPlayedAt = sorted[0]!.answeredAt;
    let stars: Stars = 0;
    let bestScore = 0;
    let firstCompletedAt: string | undefined;
    let run = new Map<string, number>();
    const finishRun = (at: string) => {
      if (run.size !== scored.size || scored.size === 0) return;
      let total = 0;
      for (const s of run.values()) total += s;
      const rate = total / scored.size;
      const s = starsFor(total, scored.size);
      if (s > stars) stars = s;
      if (rate > bestScore) bestScore = rate;
      if (firstCompletedAt === undefined) firstCompletedAt = at;
    };
    let runLastAt = '';
    for (const a of sorted) {
      lastPlayedAt = latestIso(lastPlayedAt, a.answeredAt);
      if (!scored.has(a.questionId)) continue;
      if (run.has(a.questionId)) {
        finishRun(runLastAt);
        run = new Map();
      }
      run.set(a.questionId, attemptScore(a));
      runLastAt = a.answeredAt;
      if (run.size === scored.size) {
        finishRun(runLastAt);
        run = new Map();
      }
    }
    const lp: LevelProgress = { levelId, stars, bestScore: Math.min(1, bestScore), lastPlayedAt };
    out.push(firstCompletedAt === undefined ? lp : { ...lp, firstCompletedAt });
  }
  return out.sort((x, y) => compareCodeUnits(x.levelId, y.levelId));
}

/** 每題答錯的次數（不分 rev），給 reviewQueue.wrongCount 重算用 */
export function recomputeWrongCount(attempts: readonly Attempt[]): ReadonlyMap<string, number> {
  const out = new Map<string, number>();
  for (const a of attempts) {
    if (a.correct) continue;
    out.set(a.questionId, (out.get(a.questionId) ?? 0) + 1);
  }
  return out;
}

/** 執行環境（06 第 4.5 與 4.8 節）：Safari 分頁與 App 內建瀏覽器屬於容易被清除的環境 */
export type StorageEnvironment = 'app' | 'browser' | 'safari-tab' | 'in-app-browser';

export interface PersistReminderInput extends BackupReminderState {
  /** navigator.storage.persisted() 的結果；不支援時傳 false */
  readonly persisted: boolean;
  readonly environment: StorageEnvironment;
}

/** 備份提醒的政策（06 第 4.5 節的暫定預設；D10(a)），可調整 */
export interface ReminderPolicy {
  /** 沒有 persistent 時每完成幾關提醒一次 */
  readonly levelsEvery: number;
  /** 沒有 persistent 時距上次匯出幾天提醒一次（從未匯出時以上次提醒時間起算；兩者都沒有就不以天數觸發） */
  readonly daysEvery: number;
  /** Safari 分頁與 App 內建瀏覽器每完成幾關提醒一次（不論 persist 結果） */
  readonly fragileLevelsEvery: number;
  /** 取得 persistent 後是否仍提醒（預設不提醒） */
  readonly remindWhenPersisted: boolean;
}
export const DEFAULT_REMINDER_POLICY: ReminderPolicy = { levelsEvery: 3, daysEvery: 7, fragileLevelsEvery: 1, remindWhenPersisted: false };

export type ReminderReason = 'levels' | 'days';
export interface PersistReminderResult {
  readonly due: boolean;
  readonly reason?: ReminderReason;
}

/**
 * 備份提醒是否到期（06 第 4.5 節）：沒有取得 persistent 時，每完成 3 個關卡或距離上次匯出 7 天（先到者）；
 * Safari 分頁與 App 內建瀏覽器每完成 1 個關卡就提醒。now 由呼叫端傳入；提醒過後呼叫端要重設 levelsCompletedSinceExport 或寫 lastRemindedAt。
 */
export function persistReminderDue(state: PersistReminderInput, now: string, policy: ReminderPolicy = DEFAULT_REMINDER_POLICY): PersistReminderResult {
  const fragile = state.environment === 'safari-tab' || state.environment === 'in-app-browser';
  if (fragile) return state.levelsCompletedSinceExport >= policy.fragileLevelsEvery ? { due: true, reason: 'levels' } : { due: false };
  if (state.persisted && !policy.remindWhenPersisted) return { due: false };
  if (state.levelsCompletedSinceExport >= policy.levelsEvery) return { due: true, reason: 'levels' };
  const since = state.lastExportedAt ?? state.lastRemindedAt;
  if (since !== undefined && diffMs(since, now) >= policy.daysEvery * MS_PER_DAY) return { due: true, reason: 'days' };
  return { due: false };
}
