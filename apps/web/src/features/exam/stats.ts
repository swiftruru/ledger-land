// 苦練區的進度統計（M4c）：由 questionState 算某一組題練過幾題、答對率；純函式
import type { QuestionState } from './db.ts';

export interface SetStats {
  total: number;
  practised: number;
  /** 最近一次答錯的題數（「只練錯過的」） */
  wrong: number;
  /** 0 到 1；沒練過時 null */
  accuracy: number | null;
}

export function statsOf(questionIds: readonly string[], states: ReadonlyMap<string, QuestionState>): SetStats {
  let practised = 0;
  let wrong = 0;
  let seen = 0;
  let correct = 0;
  for (const id of questionIds) {
    const s = states.get(id);
    if (!s || s.seen === 0) continue;
    practised++;
    seen += s.seen;
    correct += s.correct;
    if (!s.lastCorrect) wrong++;
  }
  return { total: questionIds.length, practised, wrong, accuracy: seen === 0 ? null : correct / seen };
}

export const wrongIdsOf = (states: ReadonlyMap<string, QuestionState>): Set<string> =>
  new Set([...states.values()].filter((s) => s.seen > 0 && !s.lastCorrect).map((s) => s.questionId));
