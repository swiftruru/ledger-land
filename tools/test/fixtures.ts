// tools 測試共用的內容範例：04 第 17.2 節的交易影響題、第 17.3 節的指標計算題、第 17.10 節的多正解題、第 17.11 節的分錄題，
// 搭配核心的自編故事（青檸文具社）與內建範本。名詞與章節只補到引用自洽的最小欄位。
import { defaultTemplates } from '@ledgerland/core';
import { limeLeafStory } from '../../packages/core/test/fixtures/story-lime-leaf.ts';

export interface Entry {
  file: string;
  data: Record<string, unknown>;
}

const lt = (zh: string, en: string) => ({ 'zh-TW': zh, en });

export function term(id: string): Entry {
  return {
    file: `content/terms/${id}.json`,
    data: {
      id,
      rev: 1,
      revKind: 'text',
      status: 'published',
      category: 'concept',
      label: lt(`名詞 ${id}`, `Term ${id}`),
      teacherLabel: `名詞 ${id}`,
      currentTwLabel: null,
      ifrsEnglish: `Term ${id}`,
      aliases: { 'zh-TW': [], en: [] },
      flags: [],
      confidence: 'high',
      pendingRefs: [],
      definition: lt('測試用的名詞。', 'A term used in tests.'),
    },
  };
}

export function chapter(id: string, order: number, scope: 'core' | 'extension' = 'core'): Entry {
  return {
    file: `content/chapters/${id}.json`,
    data: {
      id,
      rev: 1,
      revKind: 'text',
      status: 'published',
      order,
      scope,
      examScope: scope === 'extension' ? 'not_in_exam' : 'unconfirmed',
      title: lt(`章節 ${id}`, `Chapter ${id}`),
      summary: lt('測試用的章節。', 'A chapter used in tests.'),
      objectiveIds: [],
      levelIds: [],
    },
  };
}

export const templateEntries: Entry[] = defaultTemplates.map((t) => ({
  file: `packages/core/data/templates/${t.id.slice('tpl.'.length)}.json`,
  data: t as unknown as Record<string, unknown>,
}));
export const storyEntry: Entry = { file: 'content/stories/story_q7m2v9.json', data: limeLeafStory as unknown as Record<string, unknown> };

/** 04 第 17.2 節：賣出全部存貨的交易影響題 */
export const q172 = {
  id: 'q_tx7h2c9d',
  rev: 1,
  revKind: 'text',
  status: 'published',
  type: 'transaction_effect',
  chapterId: 'ch_n3f8q1',
  objectiveId: 'obj_5vk2m7',
  difficulty: 2,
  tags: ['inventory', 'sale', 'cash_flow'],
  termRefs: ['tm_g5c2m8tw', 'tm_g8p4w1rz', 'tm_n7v3k8pq', 'tm_p2a7c5vk'],
  labRef: { story: 'story_q7m2v9', step: 'st_h8q3z6' },
  scored: true,
  scenario: {
    opening: { storyRef: 'story_q7m2v9', afterStep: 'st_p4n7e2' },
    events: [{ id: 'e1', template: 'tpl.sell_all_inventory_cash', params: { price: 1120000 } }],
    policy: 'teacher@1',
    layout: 'teacher@1',
    window: 'cumulative',
    targets: [
      { id: 't1', kind: 'line', line: 'bs_cash', measure: 'direction' },
      { id: 't2', kind: 'line', line: 'bs_inventory', measure: 'direction' },
      { id: 't3', kind: 'line', line: 'is_gross_profit', measure: 'direction' },
      { id: 't4', kind: 'line', line: 'cf_operating_total', measure: 'direction' },
    ],
  },
  choices: ['up', 'down', 'unchanged'],
  prompt: lt(
    '青檸文具社把倉庫裡全部的貨，以現金 {{money:e1.price}} 一次賣給一家連鎖書店。這筆交易之後，下面四個數字各會怎麼變？',
    'Lime Leaf Stationery sells all of its inventory to a bookstore chain for {{money:e1.price}} in cash. After this transaction, how does each of the four figures below change?',
  ),
  explanation: lt(
    '帳上存貨的成本是 {{money:e1.costOfAllInventory}}，全部轉成{{term:tm_g5c2m8tw}}，存貨歸零，營業毛利增加 {{money:expected.t3.delta}}。收到的錢屬於營業活動，所以現金與營業活動現金流量都增加 {{money:expected.t1.delta}}。',
    'The inventory on the books cost {{money:e1.costOfAllInventory}}. All of it becomes {{term:tm_g5c2m8tw}} and inventory falls to zero, so gross profit rises by {{money:expected.t3.delta}}. The cash received comes from operating activities, so both cash and operating cash flow rise by {{money:expected.t1.delta}}.',
  ),
};

/** 04 第 17.2 節 content:compile 寫入快照的答案 */
export const q172Expected = {
  t1: { direction: 'up', before: 1094000, after: 2214000, delta: 1120000 },
  t2: { direction: 'down', before: 640000, after: 0, delta: -640000 },
  t3: { direction: 'up', before: 0, after: 480000, delta: 480000 },
  t4: { direction: 'up', before: -796000, after: 324000, delta: 1120000 },
};
export const q172Values = { 'e1.price': 1120000, 'e1.costOfAllInventory': 640000, 'e1.grossProfit': 480000 };

/** 04 第 17.3 節：指標計算題（measures）與正解為 N/A 的變體 */
export const qRoa = {
  id: 'q_r8n2v5qe',
  rev: 1,
  revKind: 'text',
  status: 'published',
  type: 'ratio_numeric',
  chapterId: 'ch_x4d9p2',
  objectiveId: 'obj_8wc3k6',
  difficulty: 2,
  tags: ['roa', 'profitability'],
  termRefs: [],
  scored: true,
  vars: { netIncome: 1180000, totalAssets: 4720000 },
  compute: { ratioRef: 'roa@excel', measures: { is_net_income: 'vars.netIncome', bs_total_assets: 'vars.totalAssets' } },
  answerUnit: 'percent',
  decimals: 2,
  tolerance: 0.01,
  prompt: lt(
    '本期淨利 {{money:vars.netIncome}}，資產總計 {{money:vars.totalAssets}}，ROA 是多少？',
    'Net income {{money:vars.netIncome}}, total assets {{money:vars.totalAssets}}. What is ROA?',
  ),
  explanation: lt('ROA 是 {{percent:expected.answer.value}}。', 'ROA is {{percent:expected.answer.value}}.'),
};
export const qCurrentRatioNa = {
  id: 'q_c3k7w1nb',
  rev: 1,
  revKind: 'text',
  status: 'published',
  type: 'ratio_numeric',
  chapterId: 'ch_x4d9p2',
  objectiveId: 'obj_2mz7r4',
  difficulty: 2,
  tags: ['current_ratio', 'na_vs_zero'],
  termRefs: [],
  scored: true,
  vars: { currentAssets: 1860000, currentLiabilities: 0 },
  compute: { ratioRef: 'current_ratio@excel', measures: { bs_current_assets: 'vars.currentAssets', bs_current_liabilities: 'vars.currentLiabilities' } },
  answerUnit: 'multiple',
  decimals: 2,
  tolerance: 0.01,
  acceptStatus: ['na'],
  prompt: lt(
    '流動資產 {{money:vars.currentAssets}}，沒有流動負債，流動比率是多少？',
    'Current assets {{money:vars.currentAssets}}, no current liabilities. What is the current ratio?',
  ),
  explanation: lt('沒有可以除的數，答案是 N/A。', 'There is nothing to divide by, so the answer is N/A.'),
};

const option = (id: string, zh: string, en: string) => ({ id, text: lt(zh, en), feedback: lt(`關於 ${zh} 的回饋。`, `Feedback about ${en}.`) });

/** 04 第 17.10 節：all_correct 的多正解題（縮短文字） */
export const qMulti = {
  id: 'q_p9k4r7cx',
  rev: 1,
  revKind: 'text',
  status: 'published',
  type: 'multi_choice',
  chapterId: 'ch_n3f8q1',
  objectiveId: 'obj_4tw8m3',
  difficulty: 2,
  tags: ['cash_flow', 'operating_activities'],
  termRefs: [],
  scored: true,
  scoringMode: 'all_correct',
  prompt: lt('哪些會讓營業活動的現金流量增加？', 'Which of these increase operating cash flows?'),
  options: [
    option('o_f3k8', '收回賒帳的貨款', 'Collecting a receivable'),
    option('o_g6v4', '向銀行借款', 'Borrowing from the bank'),
    option('o_h7n2', '以現金賣出存貨', 'Selling inventory for cash'),
    option('o_j2c9', '以現金買設備', 'Buying equipment for cash'),
  ],
  correctOptionIds: ['o_f3k8', 'o_h7n2'],
  explanation: lt('{{option:o_f3k8}}與{{option:o_h7n2}}是本業的收現。', '{{option:o_f3k8}} and {{option:o_h7n2}} are cash from the core business.'),
};

/** 04 第 17.11 節：延伸章的分錄題 */
export const qJournal = {
  id: 'q_y3m7k2dw',
  rev: 1,
  revKind: 'text',
  status: 'published',
  type: 'journal_entry',
  chapterId: 'ch_e4j7r2',
  objectiveId: 'obj_9wr3e6',
  difficulty: 2,
  tags: ['journal_entry', 'borrowing', 'interest'],
  termRefs: [],
  labRef: { story: 'story_q7m2v9', step: 'st_w4r8n2' },
  scored: true,
  scenario: {
    opening: { storyRef: 'story_q7m2v9', afterStep: 'st_m2x8r5' },
    events: [{ id: 'e1', template: 'tpl.repay_all_short_term_loans_with_interest', params: { interest: 27000 } }],
    policy: 'teacher@1',
    layout: 'teacher@1',
    window: 'transaction',
    targets: [],
  },
  accountChoices: ['cash', 'short_term_borrowings', 'interest_expense', 'accounts_payable', 'revenue'],
  allowAliases: true,
  prompt: lt(
    '還清短期借款 {{money:e1.principal}} 並付利息 {{money:e1.interest}}，請寫出分錄。',
    'Repay borrowings of {{money:e1.principal}} and pay interest of {{money:e1.interest}}. Write the entry.',
  ),
  explanation: lt('付出的現金合計 {{money:e1.totalPaid}}。', 'Total cash paid is {{money:e1.totalPaid}}.'),
};
export const qJournalExpectedEntries = [
  { account: 'short_term_borrowings', side: 'debit', amount: 900000 },
  { account: 'interest_expense', side: 'debit', amount: 27000 },
  { account: 'cash', side: 'credit', amount: 927000 },
];

/** 把題目放進引用自洽的 bundle：名詞、章節、核心範本、自編故事 */
export function bundleWith(questions: Record<string, unknown>[], extra: Partial<Record<'terms' | 'chapters' | 'stories', Entry[]>> = {}) {
  // 題目、核心範本與故事步驟引用的名詞都要存在（ref.term），所以照引用產生最小的名詞卡
  const termIds = new Set<string>();
  for (const q of questions) for (const t of (q.termRefs as string[]) ?? []) termIds.add(t);
  for (const t of templateEntries) for (const ref of t.data.termRefs as string[]) termIds.add(ref);
  for (const s of [storyEntry, ...(extra.stories ?? [])])
    for (const step of s.data.steps as { termRefs: string[] }[]) for (const ref of step.termRefs) termIds.add(ref);
  return {
    terms: [...[...termIds].map(term), ...(extra.terms ?? [])],
    chapters: [chapter('ch_n3f8q1', 1), chapter('ch_x4d9p2', 2), chapter('ch_e4j7r2', 3, 'extension'), ...(extra.chapters ?? [])],
    templates: templateEntries,
    stories: [storyEntry, ...(extra.stories ?? [])],
    questions: questions.map((q) => ({ file: `content/questions/${String(q.id)}.json`, data: q })),
  };
}
