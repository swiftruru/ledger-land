// 作答流程測試用的題目快照（全部自編，形狀同 tools/lib/content-snapshot.mjs 的輸出）
import type { QuestionSnapshot } from '../src/lib/content.ts';

const base = {
  chapterId: 'ch_t3st001',
  objectiveId: 'obj_t3st01',
  difficulty: 1 as const,
  scored: true,
  rev: 1,
  revKind: 'text' as const,
  answerRev: 1,
  termRefs: ['tm_t3st0001'],
};

export const qSingle: QuestionSnapshot = {
  ...base,
  id: 'q_s1ng1e01',
  type: 'single_choice',
  vars: { loan: 240000 },
  prompt: '店向銀行借了 {{money:vars.loan}}，這筆錢是哪一類？',
  options: [
    { id: 'o_a1b2', text: '負債', feedback: '要還的錢是負債。' },
    { id: 'o_c3d4', text: '股東權益', feedback: '股東權益不用還。' },
    { id: 'o_e5f6', text: '收入', feedback: '借錢不是賺來的。' },
  ],
  correctOptionId: 'o_a1b2',
  explanation: '要還的是{{option:o_a1b2}}，{{term:tm_t3st0001}}不用還。',
};

export const qMulti: QuestionSnapshot = {
  ...base,
  id: 'q_m2t1a001',
  type: 'multi_choice',
  scoringMode: 'all_correct',
  prompt: '哪些是負債？',
  options: [
    { id: 'o_p1a1', text: '應付帳款', feedback: '是負債。' },
    { id: 'o_p2b2', text: '短期借款', feedback: '是負債。' },
    { id: 'o_p3c3', text: '存貨', feedback: '是資產。' },
  ],
  correctOptionIds: ['o_p1a1', 'o_p2b2'],
  explanation: '欠別人的才是負債。',
};

export const qTrueFalse: QuestionSnapshot = {
  ...base,
  id: 'q_tr3fa1s1',
  type: 'true_false',
  statement: '借來的錢屬於股東權益。',
  correct: false,
  feedbackTrue: '借來的錢要還。',
  feedbackFalse: '答對了。',
  explanation: '要還的是負債。',
};

export const qClassify: QuestionSnapshot = {
  ...base,
  id: 'q_c14ss1fy',
  type: 'classify',
  prompt: '把卡片放進正確的格子。',
  dimension: 'element',
  items: [
    { id: 'it_c1a1', account: 'cash' },
    { id: 'it_c2b2', account: 'accounts_payable' },
    { id: 'it_c3d3', text: '老闆投入的錢' },
  ],
  correctCategories: { it_c3d3: 'equity' },
  explanation: '現金是資產。',
  compiled: { categories: { it_c1a1: 'asset', it_c2b2: 'liability', it_c3d3: 'equity' } },
};

export const qEffect: QuestionSnapshot = {
  ...base,
  id: 'q_3ff3ct01',
  type: 'transaction_effect',
  prompt: '用現金 {{money:e1.amount}} 買存貨，各數字怎麼變？',
  scenario: {
    opening: { balances: { cash: 400000, share_capital: 400000 } },
    events: [{ id: 'e1', template: 'tpl.purchase_inventory_cash', params: { amount: 150000 } }],
    policy: 'teacher@1',
    layout: 'teacher@1',
    window: 'transaction',
    targets: [
      { id: 't1', kind: 'line', line: 'bs_cash', measure: 'direction' },
      { id: 't2', kind: 'line', line: 'bs_inventory', measure: 'delta' },
    ],
  },
  choices: ['up', 'down', 'unchanged'],
  explanation: '現金減少 {{money:expected.t1.delta|sign}}。',
  compiled: {
    values: { 'e1.amount': 150000 },
    expected: { t1: { direction: 'down', before: 400000, after: 250000, delta: -150000 }, t2: { direction: 'up', before: 0, after: 150000, delta: 150000 } },
  },
};

export const qJudgment: QuestionSnapshot = {
  ...base,
  id: 'q_j2dgm3nt',
  type: 'judgment',
  scored: false,
  prompt: '先看哪一張表？',
  options: [
    { id: 'o_j1a1', text: '損益表', upside: '看得到怎麼賺的。', downside: '看不到現金。' },
    { id: 'o_j2b2', text: '資產負債表', upside: '看得到欠多少。', downside: '只是一天的快照。' },
    { id: 'o_j3c3', text: '現金流量表', upside: '現金騙不了人。', downside: '分不出賺的還是借的。' },
  ],
  viewpoint: '三張一起看。',
  attribution: 'site',
  explanation: '沒有標準答案。',
};

export const qFiveStep: QuestionSnapshot = {
  ...base,
  id: 'q_f1v3st3p',
  type: 'five_step_fill',
  prompt: '填入兩個勾稽點的數字。',
  scenario: {
    opening: { balances: { cash: 400000, share_capital: 400000 } },
    events: [{ id: 'e1', template: 'tpl.purchase_inventory_cash', params: { amount: 150000 } }],
    policy: 'teacher@1',
    layout: 'teacher@1',
    window: 'cumulative',
    targets: [],
  },
  openCells: ['cf_pretax_income', 'bs_cash'],
  explanation: '兩邊要一樣。',
  compiled: { expected: {}, values: { 'e1.amount': 150000 }, cells: { cf_pretax_income: 0, bs_cash: 250000 } },
};

export const qRatioNumeric: QuestionSnapshot = {
  ...base,
  id: 'q_r4t10num',
  type: 'ratio_numeric',
  prompt: '負債比率是多少？',
  vars: { liabilities: 100000, assets: 400000 },
  compute: { ratioRef: 'debt_ratio@excel', measures: { bs_total_liabilities: 'vars.liabilities', bs_total_assets: 'vars.assets' } },
  answerUnit: 'percent',
  decimals: 2,
  tolerance: 0.01,
  explanation: '負債總額 ÷ 資產總計。',
  compiled: { ratio: { ratioRef: 'debt_ratio@excel', status: 'ok', exact: { num: '1', den: '4' }, displayValue: 25 } },
};

export const qJournal: QuestionSnapshot = {
  ...base,
  id: 'q_j0urn4l1',
  type: 'journal_entry',
  prompt: '用現金 {{money:e1.amount}} 買存貨，分錄怎麼寫？',
  scenario: {
    opening: { balances: { cash: 400000, share_capital: 400000 } },
    events: [{ id: 'e1', template: 'tpl.purchase_inventory_cash', params: { amount: 150000 } }],
    policy: 'teacher@1',
    layout: 'teacher@1',
    window: 'transaction',
    targets: [],
  },
  accountChoices: ['cash', 'inventory', 'accounts_payable', 'revenue'],
  explanation: '借存貨、貸現金。',
  compiled: {
    expected: {},
    values: { 'e1.amount': 150000 },
    expectedEntries: [
      { account: 'inventory', side: 'debit', amount: 150000 },
      { account: 'cash', side: 'credit', amount: 150000 },
    ],
  },
};
