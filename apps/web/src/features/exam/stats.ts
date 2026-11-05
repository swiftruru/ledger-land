// 苦練區的進度統計（M4c）：由 questionState 算某一組題練過幾題、答對率、熟練幾題；純函式
// 熟練（M4c 第二批，2026-11-05）：同一題連續答對 MASTERY_STREAK 次；答錯歸零。不熟 = 練過但還沒熟練（含最近答錯的）；沒練過的不算不熟。
import type { QuestionState } from './db.ts';

export const MASTERY_STREAK = 2;

export interface SetStats {
  total: number;
  practised: number;
  /** 最近一次答錯的題數（「只練錯過的」） */
  wrong: number;
  /** 連對 MASTERY_STREAK 次的題數 */
  mastered: number;
  /** 0 到 1；沒練過時 null */
  accuracy: number | null;
}

export const isMastered = (s: QuestionState | undefined): boolean => !!s && s.seen > 0 && s.streak >= MASTERY_STREAK;

export function statsOf(questionIds: readonly string[], states: ReadonlyMap<string, QuestionState>): SetStats {
  let practised = 0;
  let wrong = 0;
  let mastered = 0;
  let seen = 0;
  let correct = 0;
  for (const id of questionIds) {
    const s = states.get(id);
    if (!s || s.seen === 0) continue;
    practised++;
    seen += s.seen;
    correct += s.correct;
    if (!s.lastCorrect) wrong++;
    if (isMastered(s)) mastered++;
  }
  return { total: questionIds.length, practised, wrong, mastered, accuracy: seen === 0 ? null : correct / seen };
}

export const wrongIdsOf = (states: ReadonlyMap<string, QuestionState>): Set<string> =>
  new Set([...states.values()].filter((s) => s.seen > 0 && !s.lastCorrect).map((s) => s.questionId));

/** 練過但還沒熟練的題（含最近答錯的） */
export const unsureIdsOf = (states: ReadonlyMap<string, QuestionState>): Set<string> =>
  new Set([...states.values()].filter((s) => s.seen > 0 && !isMastered(s)).map((s) => s.questionId));

/** 題組用的兩組挑選（sets.ts 的 resolveSet） */
export const picksOf = (states: ReadonlyMap<string, QuestionState>): { wrongIds: Set<string>; unsureIds: Set<string> } => ({
  wrongIds: wrongIdsOf(states),
  unsureIds: unsureIdsOf(states),
});
