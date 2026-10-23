// 題目 schema（04 第 16.2 節、08 第 3.6 節）與 validateBundle 的跨檔案規則：multi_choice 的四條規則、journal_entry 的章節限制、佔位符作用範圍
import { describe, expect, it } from 'vitest';
import { Question, validateBundle, type ContentBundle } from '../src/index.ts';
import { scenario, story, template } from './fixtures.ts';

const lt = (zh: string, en: string) => ({ 'zh-TW': zh, en });
const option = (id: string, zh: string, en: string) => ({ id, text: lt(zh, en), feedback: lt(`${zh}的回饋`, `Feedback for ${en}`) });

const base = {
  rev: 1,
  revKind: 'text',
  status: 'published',
  chapterId: 'ch_c5f8w2',
  objectiveId: 'obj_d7q2x5',
  difficulty: 2,
  tags: ['cash_flow_activity'],
  termRefs: ['tm_r4w8n2qe'],
  scored: true,
  explanation: lt('解說。', 'Explanation.'),
};

export const single = {
  ...base,
  id: 'q_m4t9x2ka',
  type: 'single_choice',
  vars: { amount: 260000 },
  prompt: lt('月底才付款 {{money:vars.amount}}，哪個數字反映？', 'Paid {{money:vars.amount}} at month end. Which figure?'),
  options: [option('o_r2v8', '應收帳款增加', 'Receivables up'), option('o_k5p1', '現金增加', 'Cash up'), option('o_w9d3', '收入不變', 'Revenue unchanged')],
  correctOptionId: 'o_r2v8',
  explanation: lt('選「{{option:o_k5p1}}」是混淆了。', 'Choosing {{option:o_k5p1}} mixes things up.'),
};

export const multi = {
  ...base,
  id: 'q_h6w3m8ta',
  type: 'multi_choice',
  prompt: lt('哪些做法符合要求？', 'Which approaches meet the requirement?'),
  options: [
    option('o_a7k2', '增資', 'New capital'),
    option('o_b4m9', '借款', 'Borrow'),
    option('o_c8t3', '賣存貨', 'Sell inventory'),
    option('o_d5x6', '預收', 'Collect in advance'),
  ],
  correctOptionIds: ['o_a7k2', 'o_c8t3'],
  scoringMode: 'any_correct',
};

export const trueFalse = {
  ...base,
  id: 'q_d2h5s9fb',
  type: 'true_false',
  statement: lt('提列折舊時現金也會減少。', 'Cash falls when depreciation is recorded.'),
  correct: false,
  feedbackTrue: lt('沒有現金付出去。', 'No cash is paid.'),
  feedbackFalse: lt('沒錯。', 'Correct.'),
};

export const judgment = {
  ...base,
  id: 'q_j6p3d8vb',
  type: 'judgment',
  scored: false,
  prompt: lt('你會建議哪一種做法？', 'Which approach would you suggest?'),
  options: [1, 2, 3].map((i) => ({
    id: `o_f1b${i}`,
    text: lt(`做法 ${i}`, `Approach ${i}`),
    upside: lt('好處。', 'Upside.'),
    downside: lt('壞處。', 'Downside.'),
  })),
  viewpoint: lt('沒有標準答案。', 'There is no single right answer.'),
  attribution: 'site',
};

export const effect = {
  ...base,
  id: 'q_tx7h2c9d',
  type: 'transaction_effect',
  scenario,
  choices: ['up', 'down', 'unchanged'],
  prompt: lt('以現金 {{money:e1.price}} 賣出。', 'Sold for {{money:e1.price}} in cash.'),
  explanation: lt('現金增加 {{money:expected.t1.delta}}。', 'Cash rises by {{money:expected.t1.delta}}.'),
};

export const ratioNumeric = {
  ...base,
  id: 'q_r8n2v5qe',
  type: 'ratio_numeric',
  vars: { netIncome: 1180000, totalAssets: 4720000 },
  compute: { ratioRef: 'roa@excel', measures: { is_net_income: 'vars.netIncome', bs_total_assets: 'vars.totalAssets' } },
  answerUnit: 'percent',
  decimals: 2,
  tolerance: 0.01,
  prompt: lt(
    '淨利 {{money:vars.netIncome}}，資產 {{money:vars.totalAssets}}，ROA？',
    'Net income {{money:vars.netIncome}}, assets {{money:vars.totalAssets}}. ROA?',
  ),
  explanation: lt('ROA ＝ {{percent:expected.answer.value}}。', 'ROA = {{percent:expected.answer.value}}.'),
};

export const journal = {
  ...base,
  id: 'q_y3m7k2dw',
  type: 'journal_entry',
  chapterId: 'ch_e4j7r2',
  scenario: { ...scenario, window: 'transaction', targets: [] },
  accountChoices: ['cash', 'revenue', 'inventory', 'cost_of_goods_sold'],
  prompt: lt('請寫出分錄。', 'Write the journal entry.'),
};

const classify = {
  ...base,
  id: 'q_c1a5s7fy',
  type: 'classify',
  prompt: lt('分類。', 'Classify.'),
  dimension: 'element',
  items: [
    { id: 'it_k3w9', account: 'cash' },
    { id: 'it_m2p4', ratio: 'roa' },
    { id: 'it_x8c1', text: lt('老闆的車', "The owner's car") },
  ],
  correctCategories: { it_x8c1: 'not_in_books' },
};

const ok = (data: unknown) => Question.safeParse(data).success;
const messages = (data: unknown) => (Question.safeParse(data).error?.issues ?? []).map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');

describe('12 種題型的結構', () => {
  it('範例全部通過', () => {
    for (const q of [single, multi, trueFalse, judgment, effect, ratioNumeric, journal, classify]) expect(messages(q)).toBe('');
    expect(ok({ ...single, id: 'q_p1ck5t4t', type: 'pick_statement' })).toBe(true);
    expect(ok({ ...single, id: 'q_r4t1px9k', type: 'ratio_interpret', ratioRef: 'roa@excel' })).toBe(true);
    const { choices: _c, ...effectNoChoices } = effect;
    expect(ok({ ...effectNoChoices, id: 'q_p1ckn1n3', type: 'pick_line', statement: 'bs', correctLines: ['bs_cash'] })).toBe(true);
    expect(ok({ ...effectNoChoices, id: 'q_f1v3st3p', type: 'five_step_fill', openCells: ['cf_pretax_income', 'bs_cash'] })).toBe(true);
  });
  it('未知題型、未知欄位、錯誤的 ID 都失敗', () => {
    expect(ok({ ...single, type: 'essay' })).toBe(false);
    expect(ok({ ...single, extra: 1 })).toBe(false);
    expect(ok({ ...single, id: 'q_abc' })).toBe(false);
    expect(ok({ ...single, options: [{ ...single.options[0], id: 'opt_1' }, ...single.options.slice(1)] })).toBe(false);
  });
});

describe('multi_choice（D12）', () => {
  it('少於兩個正解', () => {
    expect(ok({ ...multi, correctOptionIds: ['o_a7k2'] })).toBe(false);
    expect(messages({ ...multi, correctOptionIds: ['o_a7k2', 'o_a7k2'] })).toContain('不得重複');
  });
  it('缺 scoringMode 與非法的 scoringMode', () => {
    const { scoringMode: _s, ...noMode } = multi;
    expect(ok(noMode)).toBe(false);
    expect(ok({ ...multi, scoringMode: 'partial' })).toBe(false);
    expect(ok({ ...multi, scoringMode: 'all_correct' })).toBe(true);
  });
  it('正解不在 options', () => expect(messages({ ...multi, correctOptionIds: ['o_a7k2', 'o_zzzz'] })).toContain('不在 options'));
  it('選項 3 到 5 個，且至少一個不是正解', () => {
    expect(ok({ ...multi, options: multi.options.slice(0, 2), correctOptionIds: ['o_a7k2', 'o_b4m9'] })).toBe(false);
    expect(ok({ ...multi, options: [...multi.options, option('o_e1e1', '五', 'Five'), option('o_e2e2', '六', 'Six')] })).toBe(false);
    expect(messages({ ...multi, options: multi.options.slice(0, 3), correctOptionIds: ['o_a7k2', 'o_b4m9', 'o_c8t3'] })).toContain('至少要留一個不是正解');
  });
});

describe('其他題型的規則', () => {
  it('single_choice 類：3 或 4 個選項、正解要在 options、ratio_interpret 要有 ratioRef', () => {
    expect(ok({ ...single, options: single.options.slice(0, 2) })).toBe(false);
    expect(messages({ ...single, correctOptionId: 'o_zzzz' })).toContain('必須是 options 裡的選項');
    expect(messages({ ...single, type: 'ratio_interpret' })).toContain('ratioRef');
    expect(messages({ ...single, options: [single.options[0], single.options[0], single.options[1]] })).toContain('選項 ID 重複');
  });
  it('judgment 的 scored 必須是 false；pendingRefs 非空時 scored 必須是 false', () => {
    expect(ok({ ...judgment, scored: true })).toBe(false);
    expect(messages({ ...single, pendingRefs: ['T04'] })).toContain('scored 必須是 false');
    expect(ok({ ...single, pendingRefs: ['T04'], scored: false })).toBe(true);
    expect(ok({ ...judgment, options: judgment.options.slice(0, 2) })).toBe(false);
  });
  it('ratio_numeric 的 scenario 與 measures 二選一，measures 只能引用已宣告的 vars', () => {
    expect(messages({ ...ratioNumeric, compute: { ratioRef: 'roa@excel' } })).toContain('二選一');
    expect(messages({ ...ratioNumeric, compute: { ...ratioNumeric.compute, scenario } })).toContain('二選一');
    expect(ok({ ...ratioNumeric, compute: { ratioRef: 'roa@excel', scenario }, explanation: lt('解說。', 'Explanation.') })).toBe(true);
    expect(messages({ ...ratioNumeric, compute: { ...ratioNumeric.compute, measures: { is_net_income: 'vars.nope' } } })).toContain('未宣告的 vars.nope');
    expect(ok({ ...ratioNumeric, compute: { ...ratioNumeric.compute, measures: { is_net_income: 'netIncome' } } })).toBe(false);
  });
  it('transaction_effect 有 direction 目標時 choices 必填，沒有時不可填', () => {
    const { choices: _c, ...noChoices } = effect;
    expect(messages(noChoices)).toContain('choices 必填');
    const deltaOnly = { ...effect, scenario: { ...scenario, targets: [{ id: 't1', kind: 'line', line: 'bs_cash', measure: 'delta' }] } };
    expect(messages(deltaOnly)).toContain('只適用於 direction');
    const { choices: _d, ...deltaNoChoices } = deltaOnly;
    expect(ok(deltaNoChoices)).toBe(true);
  });
  it('classify：項目剛好一種來源、自訂文字項目要有 correctCategories', () => {
    expect(messages({ ...classify, items: [{ id: 'it_k3w9', account: 'cash', ratio: 'roa' }, classify.items[1]] })).toContain('剛好填一個');
    expect(messages({ ...classify, correctCategories: {} })).toContain('缺 correctCategories');
    expect(messages({ ...classify, correctCategories: { ...classify.correctCategories, it_k3w9: 'asset' } })).toContain('只給自訂文字項目');
  });
});

const chapterCore = {
  id: 'ch_c5f8w2',
  rev: 1,
  revKind: 'text',
  status: 'published',
  order: 1,
  scope: 'core',
  examScope: 'unconfirmed',
  title: lt('會計是什麼', 'What accounting is'),
  summary: lt('從一家小店開始。', 'Start from a small shop.'),
  objectiveIds: [],
  levelIds: [],
};
const chapterExtension = { ...chapterCore, id: 'ch_e4j7r2', order: 9, scope: 'extension', examScope: 'not_in_exam' };
const term = {
  id: 'tm_r4w8n2qe',
  rev: 1,
  revKind: 'text',
  status: 'published',
  category: 'concept',
  label: lt('資產', 'Asset'),
  teacherLabel: '資產',
  currentTwLabel: '資產',
  ifrsEnglish: 'Asset',
  aliases: { 'zh-TW': [], en: [] },
  flags: [],
  confidence: 'high',
  pendingRefs: [],
  definition: lt('資源。', 'A resource.'),
};
const term2 = { ...term, id: 'tm_v3n8q2ye', label: lt('營業收入', 'Revenue'), teacherLabel: '營業收入', currentTwLabel: '營業收入', ifrsEnglish: 'Revenue' };

function bundle(extra: Partial<ContentBundle>): ContentBundle {
  return {
    terms: [
      { file: 'terms/a', data: term },
      { file: 'terms/b', data: term2 },
    ],
    chapters: [
      { file: 'chapters/core', data: chapterCore },
      { file: 'chapters/ext', data: chapterExtension },
    ],
    templates: [{ file: 'templates/sell', data: template }],
    stories: [{ file: 'stories/lime', data: story }],
    ...extra,
  };
}
const has = (issues: { message: string }[], text: string) => issues.some((i) => i.message.includes(text));

describe('validateBundle（跨檔案規則）', () => {
  it('乾淨的內容沒有問題', () => {
    const issues = validateBundle(bundle({ questions: [single, multi, effect, ratioNumeric, journal].map((q) => ({ file: `questions/${q.id}`, data: q })) }));
    expect(issues).toEqual([]);
  });
  it('journal_entry 只能放在 scope 為 extension 的章節', () => {
    const issues = validateBundle(bundle({ questions: [{ file: 'q', data: { ...journal, chapterId: 'ch_c5f8w2' } }] }));
    expect(has(issues, 'journal_entry 只能放在')).toBe(true);
    expect(has(validateBundle(bundle({ questions: [{ file: 'q', data: journal }] })), 'journal_entry 只能放在')).toBe(false);
  });
  it('journal_entry 不得用 entryQuestionBlockedBy 非空的範本', () => {
    const blocked = { ...template, entryQuestionBlockedBy: ['T04'] };
    const issues = validateBundle(bundle({ templates: [{ file: 't', data: blocked }], questions: [{ file: 'q', data: journal }] }));
    expect(has(issues, 'entryQuestionBlockedBy 非空')).toBe(true);
  });
  it('引用存在：章節、名詞、labRef 的故事與步驟、scenario 的期初步驟、範本、步驟 ID 全站唯一', () => {
    const issues = validateBundle(
      bundle({
        questions: [
          { file: 'q1', data: { ...single, chapterId: 'ch_000000', termRefs: ['tm_00000000'] } },
          { file: 'q2', data: { ...single, id: 'q_00000001', labRef: { story: 'story_q7m2v9', step: 'st_000000' } } },
          { file: 'q3', data: { ...single, id: 'q_00000002', labRef: { story: 'story_000000', step: 'st_y5c1h8' } } },
          {
            file: 'q4',
            data: {
              ...effect,
              scenario: {
                ...scenario,
                opening: { storyRef: 'story_q7m2v9', afterStep: 'st_000000' },
                events: [{ ...scenario.events[0], template: 'tpl.nope' }],
              },
            },
          },
        ],
        stories: [
          { file: 's1', data: story },
          { file: 's2', data: { ...story, id: 'story_000001' } },
        ],
      }),
    );
    expect(has(issues, '不存在的章節 ch_000000')).toBe(true);
    expect(has(issues, '不存在的名詞 tm_00000000')).toBe(true);
    expect(has(issues, '步驟 st_000000 不屬於故事 story_q7m2v9')).toBe(true);
    expect(has(issues, '不存在的故事 story_000000')).toBe(true);
    expect(has(issues, '不存在的範本 tpl.nope')).toBe(true);
    expect(has(issues, '步驟 ID 全站唯一')).toBe(true);
  });
  it('佔位符作用範圍：一般內容不得用 param.、derived.、amount；引用要在本題宣告過', () => {
    const q = {
      ...single,
      prompt: lt(
        '{{money:param.price}} {{money:vars.nope}} {{money:e1.price}} {{money:expected.t1.delta}} {{money:amount}}',
        '{{money:param.price}} {{money:vars.nope}} {{money:e1.price}} {{money:expected.t1.delta}} {{money:amount}}',
      ),
    };
    const issues = validateBundle(bundle({ questions: [{ file: 'q', data: q }] }));
    expect(has(issues, 'param.* 只能用在交易範本')).toBe(true);
    expect(has(issues, '未宣告的 vars.nope')).toBe(true);
    expect(has(issues, '沒有事件可引用')).toBe(true);
    expect(has(issues, '沒有 target 可引用')).toBe(true);
    expect(has(issues, 'amount 只能用在')).toBe(true);
    const ok = validateBundle(bundle({ questions: [{ file: 'q', data: { ...single, prompt: lt('門檻 {{percent:0.5}}', 'Threshold {{percent:0.5}}') } }] }));
    expect(ok).toEqual([]);
  });
  it('佔位符作用範圍：範本的 summary 與 explanation 可用已宣告的 param.、derived.，title 不行', () => {
    expect(validateBundle(bundle({}))).toEqual([]);
    const bad = { ...template, summary: lt('{{money:derived.nope}}', '{{money:derived.nope}}'), title: lt('{{money:param.price}}', '{{money:param.price}}') };
    const issues = validateBundle(bundle({ templates: [{ file: 't', data: bad }] }));
    expect(has(issues, '未宣告的 derived.nope')).toBe(true);
    expect(issues.some((i) => i.path.startsWith('title.') && i.message.includes('只能用在交易範本的 summary'))).toBe(true);
  });
  it('佔位符引用：選項要屬於本題、名詞要存在；故事步驟只能引用本步的事件', () => {
    const issues = validateBundle(
      bundle({
        questions: [{ file: 'q', data: { ...single, explanation: lt('{{option:o_zzzz}} {{term:tm_00000000}}', '{{option:o_zzzz}} {{term:tm_00000000}}') } }],
      }),
    );
    expect(has(issues, '不存在的選項 o_zzzz')).toBe(true);
    expect(has(issues, '不存在的名詞 tm_00000000')).toBe(true);
    const badStory = { ...story, steps: [{ ...story.steps[0], narrative: lt('{{money:e5.amount}}', '{{money:e5.amount}}') }] };
    expect(has(validateBundle(bundle({ stories: [{ file: 's', data: badStory }] })), '不存在的事件 e5')).toBe(true);
  });
  it('published 的新實體所有多語欄位都要有 en；draft 可以只有中文', () => {
    const zhOnly = { ...multi, options: [{ ...multi.options[0], feedback: { 'zh-TW': '只有中文' } }, ...multi.options.slice(1)] };
    expect(validateBundle(bundle({ questions: [{ file: 'q', data: zhOnly }] })).some((i) => i.path === 'options.0.feedback.en')).toBe(true);
    expect(validateBundle(bundle({ questions: [{ file: 'q', data: { ...zhOnly, status: 'draft' } }] }))).toEqual([]);
  });
  it('ID 重複', () => {
    const issues = validateBundle(
      bundle({
        questions: [
          { file: 'q1', data: single },
          { file: 'q2', data: single },
        ],
      }),
    );
    expect(has(issues, '題目 ID 重複')).toBe(true);
  });
});
