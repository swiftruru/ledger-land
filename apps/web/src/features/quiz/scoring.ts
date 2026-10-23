// 判分的膠水（04 第 15.2 節第 9 步）：快照裡的 compiled（核心在建置時算出的答案）組成 quiz 的 ScoreContext，再交給 scoreAttempt。
// classify 的正解分類在 compiled.categories（科目卡與指標卡由科目表或指標登錄檔推導）、transaction_effect 的正解在 compiled.expected。
// 本模組不含會計知識，也不碰 React。
import type { Question, TargetAnswer } from '@ledgerland/content-schema';
import type { JsonValue } from '@ledgerland/progress';
import { UNSCORED, scoreAttempt, type ScoreContext, type ScoreResult } from '@ledgerland/quiz';
import type { QuestionSnapshot } from '../../lib/content.ts';
import { toQuizAnswer } from './answers.ts';

export function scoreContextOf(q: QuestionSnapshot): ScoreContext {
  const categories = q.compiled?.categories;
  const expected = q.compiled?.expected as Readonly<Record<string, TargetAnswer>> | undefined;
  return {
    ...(categories === undefined ? {} : { classifyKey: (item: { id: string }) => categories[item.id] }),
    ...(expected === undefined ? {} : { expected }),
  };
}

/** 介面狀態直接判分；取捨題與其他不計分的題目回 UNSCORED。作答形狀不對（不該發生）也回 UNSCORED，不讓畫面炸掉 */
export function scoreSnapshotQuestion(q: QuestionSnapshot, uiAnswer: JsonValue): { result: ScoreResult; answer: JsonValue } {
  const answer = toQuizAnswer(q, uiAnswer);
  if (!q.scored) return { result: UNSCORED, answer };
  const r = scoreAttempt(q as unknown as Question, answer, scoreContextOf(q));
  return { result: r.ok ? r.value : UNSCORED, answer };
}
