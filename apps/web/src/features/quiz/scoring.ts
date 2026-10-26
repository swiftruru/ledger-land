// 判分的膠水（04 第 15.2 節第 9 步）：快照裡的 compiled（核心在建置時算出的答案）組成 quiz 的 ScoreContext，再交給 scoreAttempt。
// classify 的正解分類在 compiled.categories（科目卡與指標卡由科目表或指標登錄檔推導）、transaction_effect 的正解在 compiled.expected、
// five_step_fill 的正確金額在 compiled.cells、ratio_numeric 的指標結果在 compiled.ratio、journal_entry 的正解行在 compiled.expectedEntries
// （科目表由核心的 defaultAccounts 建立，別名比對要用）。本模組不含會計知識，也不碰 React。
// 這個模組只由 scoring-lazy.ts 動態載入（按下「確認答案」才需要），所以可以引入核心與科目表資料，不會進作答頁第一次繪製的 chunk。
import type { Question, TargetAnswer } from '@ledgerland/content-schema';
import { buildChart, defaultAccounts, type Chart, type EntryLine, type RatioResult } from '@ledgerland/core';
import type { JsonValue } from '@ledgerland/progress';
import { UNSCORED, scoreAttempt, type ScoreContext, type ScoreResult } from '@ledgerland/quiz';
import type { QuestionSnapshot } from '../../lib/content.ts';
import { logError } from '../../lib/errors.ts';
import { toQuizAnswer } from './answers.ts';

let chart: Chart | undefined;
/** 預設科目表（建一次就好；分錄題比對科目別名用） */
export function defaultChart(): Chart {
  chart ??= buildChart(defaultAccounts);
  return chart;
}

export function scoreContextOf(q: QuestionSnapshot): ScoreContext {
  const compiled = q.compiled;
  const categories = compiled?.categories;
  const expected = compiled?.expected as Readonly<Record<string, TargetAnswer>> | undefined;
  const cells = compiled?.cells;
  const ratio = compiled?.ratio;
  const expectedEntries = compiled?.expectedEntries;
  return {
    ...(categories === undefined ? {} : { classifyKey: (item: { id: string }) => categories[item.id] }),
    ...(expected === undefined ? {} : { expected }),
    ...(cells === undefined ? {} : { expectedCells: cells }),
    // 快照只存 RatioResult 的子集（scoreNumeric 只看 status 與 exact），其餘欄位補成核心的形狀
    ...(ratio === undefined ? {} : { ratio: { ...ratio, value: null, reason: null, flags: [], inputs: {} } satisfies RatioResult }),
    // 核心的 expectedJournalEntries 回傳攤平的一筆分錄，scoreJournalEntry 要的是分錄的陣列
    ...(expectedEntries === undefined ? {} : { expectedEntries: [expectedEntries as readonly EntryLine[]], chart: defaultChart() }),
  };
}

/** 介面狀態直接判分；取捨題與其他不計分的題目回 UNSCORED。作答形狀不對（不該發生）也回 UNSCORED，不讓畫面炸掉；
 *  快照缺少 compiled（內容建置出錯）時判分會丟出 TypeError，這裡記進錯誤紀錄後同樣回 UNSCORED，畫面照樣有回饋與「下一題」 */
export function scoreSnapshotQuestion(q: QuestionSnapshot, uiAnswer: JsonValue): { result: ScoreResult; answer: JsonValue } {
  const answer = toQuizAnswer(q, uiAnswer);
  if (!q.scored) return { result: UNSCORED, answer };
  try {
    const r = scoreAttempt(q as unknown as Question, answer, scoreContextOf(q));
    return { result: r.ok ? r.value : UNSCORED, answer };
  } catch (e) {
    void logError(`判分失敗 ${q.id}：${e instanceof Error ? e.message : String(e)}`, e instanceof Error ? (e.stack ?? '') : '');
    return { result: UNSCORED, answer };
  }
}
