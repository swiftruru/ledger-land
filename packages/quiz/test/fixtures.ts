// 測試用的自編題目：ID、情境與數字都是自編，不取自教材。用 content-schema 的 Question 解析，確保 fixture 符合 schema
import { Question, type QuestionType } from '@ledgerland/content-schema';
import type { RatioResult } from '@ledgerland/core';

export const lt = (zh: string, en: string) => ({ 'zh-TW': zh, en });
const option = (id: string, zh: string, en: string) => ({ id, text: lt(zh, en), feedback: lt(`${zh}。`, `${en}.`) });

export const base = {
  rev: 1,
  revKind: 'text',
  status: 'published',
  chapterId: 'ch_7q2w9k',
  objectiveId: 'obj_3m8p5t',
  difficulty: 1,
  tags: [],
  termRefs: [],
  scored: true,
  explanation: lt('解說。', 'Explanation.'),
};

/** 解析並縮小成指定題型，給 scoreQuestion 的泛型用 */
export function question<T extends QuestionType>(data: unknown): Question & { readonly type: T } {
  return Question.parse(data) as Question & { readonly type: T };
}

export const OPTIONS = [option('o_a1b2', '甲', 'A'), option('o_c3d4', '乙', 'B'), option('o_e5f6', '丙', 'C'), option('o_g7h8', '丁', 'D')];

export const single = question<'single_choice'>({
  ...base,
  id: 'q_5n2x8k4m',
  type: 'single_choice',
  prompt: lt('單選題幹。', 'Single choice prompt.'),
  options: OPTIONS.slice(0, 3),
  correctOptionId: 'o_c3d4',
});

export const anyCorrect = question<'multi_choice'>({
  ...base,
  id: 'q_8w3m2k9p',
  type: 'multi_choice',
  prompt: lt('多正解題幹。', 'Multi choice prompt.'),
  options: OPTIONS,
  correctOptionIds: ['o_a1b2', 'o_e5f6'],
  scoringMode: 'any_correct',
});

export const allCorrect = question<'multi_choice'>({ ...anyCorrect, id: 'q_9x4n3m2q', scoringMode: 'all_correct' });

export const trueFalse = question<'true_false'>({
  ...base,
  id: 'q_2t7f4b8n',
  type: 'true_false',
  statement: lt('敘述。', 'Statement.'),
  correct: false,
  feedbackTrue: lt('選對的回饋。', 'Feedback for true.'),
  feedbackFalse: lt('選不對的回饋。', 'Feedback for false.'),
});

export const judgment = question<'judgment'>({
  ...base,
  id: 'q_4j8d2m6v',
  type: 'judgment',
  scored: false,
  prompt: lt('取捨題幹。', 'Judgment prompt.'),
  options: [1, 2, 3].map((i) => ({
    id: `o_j${i}k${i}`,
    text: lt(`方案 ${i}`, `Plan ${i}`),
    upside: lt('好處。', 'Upside.'),
    downside: lt('代價。', 'Downside.'),
  })),
  viewpoint: lt('觀點。', 'Viewpoint.'),
  attribution: 'site',
});

/** 自編情境：期初現金 500,000，借入短期借款 80,000 */
export const scenario = {
  opening: { balances: { cash: 500000, share_capital: 500000 } },
  events: [{ id: 'e1', template: 'tpl.borrow_short_term', params: { amount: 80000 } }],
  policy: 'teacher@1',
  layout: 'teacher@1',
  window: 'cumulative',
  targets: [
    { id: 't1', kind: 'line', line: 'bs_cash', measure: 'direction' },
    { id: 't2', kind: 'account', account: 'short_term_borrowings', measure: 'delta' },
    { id: 't3', kind: 'line', line: 'is_net_income', measure: 'direction' },
  ],
};

/** 呼叫端用核心算出的正解（這裡自編） */
export const effectExpected = {
  t1: { direction: 'up', before: 500000, after: 580000, delta: 80000 },
  t2: { direction: 'up', before: 0, after: 80000, delta: 80000 },
  t3: { direction: 'unchanged', before: 0, after: 0, delta: 0 },
} as const;

export const effect = question<'transaction_effect'>({
  ...base,
  id: 'q_6e3f9k2w',
  type: 'transaction_effect',
  scenario,
  choices: ['up', 'down', 'unchanged'],
  prompt: lt('交易影響題幹。', 'Transaction effect prompt.'),
});

export const pickLine = question<'pick_line'>({
  ...base,
  id: 'q_3p5k7n9m',
  type: 'pick_line',
  scenario,
  statement: 'bs',
  correctLines: ['bs_cash', 'bs_short_term_borrowings'],
  prompt: lt('點選報表列題幹。', 'Pick line prompt.'),
});

export const fiveStep = question<'five_step_fill'>({
  ...base,
  id: 'q_7f2s4t6p',
  type: 'five_step_fill',
  scenario,
  openCells: ['cf_pretax_income', 'bs_cash'],
  prompt: lt('勾稽填格題幹。', 'Five step prompt.'),
});

export const classify = question<'classify'>({
  ...base,
  id: 'q_2c4a6s8y',
  type: 'classify',
  prompt: lt('分類題幹。', 'Classify prompt.'),
  dimension: 'element',
  items: [
    { id: 'it_2k4m', account: 'cash' },
    { id: 'it_3n5p', account: 'short_term_borrowings' },
    { id: 'it_4q6r', ratio: 'roa' },
    { id: 'it_5s7t', text: lt('店長的機車', "The manager's scooter") },
  ],
  correctCategories: { it_5s7t: 'not_in_books' },
});

export const ratioNumeric = question<'ratio_numeric'>({
  ...base,
  id: 'q_9r2n4v6e',
  type: 'ratio_numeric',
  vars: { netIncome: 37500, totalAssets: 300000 },
  compute: { ratioRef: 'roa@excel', measures: { is_net_income: 'vars.netIncome', bs_total_assets: 'vars.totalAssets' } },
  answerUnit: 'percent',
  decimals: 2,
  tolerance: 0.01,
  prompt: lt('指標計算題幹。', 'Ratio numeric prompt.'),
});

export const journal = question<'journal_entry'>({
  ...base,
  id: 'q_4y6m8k2d',
  type: 'journal_entry',
  chapterId: 'ch_4e7j2r',
  scenario: { ...scenario, window: 'transaction', targets: [] },
  accountChoices: ['cash', 'short_term_borrowings'],
  prompt: lt('分錄題幹。', 'Journal entry prompt.'),
});

/** 自編指標結果：37,500 ÷ 300,000 ＝ 0.125，percent 顯示 12.5 */
export function ratioResult(partial: Partial<RatioResult> = {}): RatioResult {
  return {
    ratioRef: 'roa@excel',
    status: 'ok',
    exact: { num: '1', den: '8' },
    value: 0.125,
    displayValue: 12.5,
    reason: null,
    flags: [],
    inputs: {},
    ...partial,
  };
}

export const NA_RESULT: RatioResult = ratioResult({
  status: 'na',
  exact: null,
  value: null,
  displayValue: null,
  reason: { key: 'ratio.reason.denominator_zero' },
});
