// M2 新增實體的 schema 測試（08 第 3.4、3.5 節）與 validateBundle 的引用檢查：章節的 objectiveIds 與 levelIds、關卡的 questionIds 同章與題數、
// 題目的 objectiveId 同章、misconceptionId 存在於該目標、已發布只能引用已發布；ChoiceOption 的 short 與 pin、transaction_effect 的 scoring。
import { describe, expect, it } from 'vitest';
import { Level, Objective, ObjectiveFile, Question, levelSizeIssue, validateBundle, type ContentBundle } from '../src/index.ts';

const lt = (zh: string, en: string) => ({ 'zh-TW': zh, en });
const ok = (schema: { safeParse: (d: unknown) => { success: boolean } }, data: unknown) => schema.safeParse(data).success;
const option = (id: string, zh: string, en: string) => ({ id, text: lt(zh, en), feedback: lt(`${zh}的回饋`, `Feedback for ${en}`) });
/** 與 question.test.ts 的情境單選相同形狀（不直接匯入，避免重複註冊那個檔案的測試） */
const single = {
  id: 'q_m4t9x2ka',
  rev: 1,
  revKind: 'text',
  status: 'published',
  type: 'single_choice',
  chapterId: 'ch_c5f8w2',
  objectiveId: 'obj_d7q2x5',
  difficulty: 2,
  tags: ['cash_flow_activity'],
  termRefs: ['tm_r4w8n2qe'],
  scored: true,
  vars: { amount: 260000 },
  prompt: lt('月底才付款 {{money:vars.amount}}，哪個數字反映？', 'Paid {{money:vars.amount}} at month end. Which figure?'),
  options: [option('o_r2v8', '應收帳款增加', 'Receivables up'), option('o_k5p1', '現金增加', 'Cash up'), option('o_w9d3', '收入不變', 'Revenue unchanged')],
  correctOptionId: 'o_r2v8',
  explanation: lt('選「{{option:o_k5p1}}」是混淆了。', 'Choosing {{option:o_k5p1}} mixes things up.'),
};

export const objective = {
  id: 'obj_d7q2x5',
  rev: 1,
  revKind: 'text',
  status: 'published',
  chapterId: 'ch_c5f8w2',
  order: 1,
  statement: lt('能分辨一筆收入是否已經收到現金。', 'Can tell whether a revenue item has been received in cash.'),
  skill: 'identify',
  misconceptions: [{ id: 'mc_7f2d', text: lt('把收入和收到現金當成同一件事。', 'Treating revenue and cash received as the same thing.') }],
  plannedQuestions: 5,
  suggestedTypes: ['single_choice', 'true_false'],
  termRefs: ['tm_r4w8n2qe'],
};
const objectiveFile = { chapterId: 'ch_c5f8w2', items: [objective] };
const level = {
  id: 'lv_k7m2q9xd',
  rev: 1,
  revKind: 'text',
  status: 'published',
  chapterId: 'ch_c5f8w2',
  order: 1,
  title: lt('第一關', 'Level one'),
  objectiveIds: ['obj_d7q2x5'],
  questionIds: ['q_m4t9x2ka'],
  timerSeconds: 300,
};

describe('Objective（08 第 3.4 節）', () => {
  it('範例通過；一章一檔的檔案形狀通過', () => {
    expect(ok(Objective, objective)).toBe(true);
    expect(ok(ObjectiveFile, objectiveFile)).toBe(true);
  });
  it('skill 不在列舉、迷思 ID 格式或重複、plannedQuestions 負數、未知欄位、檔案 chapterId 不一致都失敗', () => {
    expect(ok(Objective, { ...objective, skill: 'remember' })).toBe(false);
    expect(ok(Objective, { ...objective, misconceptions: [{ id: 'mc_7f2', text: lt('x', 'x') }] })).toBe(false);
    expect(ok(Objective, { ...objective, misconceptions: [objective.misconceptions[0], objective.misconceptions[0]] })).toBe(false);
    expect(ok(Objective, { ...objective, plannedQuestions: -1 })).toBe(false);
    expect(ok(Objective, { ...objective, page: 12 })).toBe(false);
    expect(ok(Objective, { ...objective, suggestedTypes: ['essay'] })).toBe(false);
    expect(ok(ObjectiveFile, { chapterId: 'ch_m2t7q4', items: [objective] })).toBe(false);
    expect(ok(ObjectiveFile, { chapterId: 'ch_c5f8w2', items: [objective, { ...objective, order: 2 }] })).toBe(false);
  });
});

describe('Level（08 第 3.5 節）', () => {
  it('範例通過；草稿可以沒有題目', () => {
    expect(ok(Level, level)).toBe(true);
    expect(ok(Level, { ...level, status: 'draft', questionIds: [] })).toBe(true);
  });
  it('questionIds 重複、timerSeconds 非正整數、未知欄位都失敗', () => {
    expect(ok(Level, { ...level, questionIds: ['q_m4t9x2ka', 'q_m4t9x2ka'] })).toBe(false);
    expect(ok(Level, { ...level, timerSeconds: 0 })).toBe(false);
    expect(ok(Level, { ...level, stars: 3 })).toBe(false);
  });
  it('levelSizeIssue：5 到 8 題計分題，至多 1 題 judgment，暫不計分的不算', () => {
    const scored = (n: number) => Array.from({ length: n }, () => ({ type: 'single_choice', scored: true }));
    const judgment = { type: 'judgment', scored: false };
    expect(levelSizeIssue(scored(5))).toBeNull();
    expect(levelSizeIssue([...scored(8), judgment])).toBeNull();
    expect(levelSizeIssue(scored(4))).toMatch(/5 到 8/);
    expect(levelSizeIssue(scored(9))).toMatch(/5 到 8/);
    expect(levelSizeIssue([...scored(5), judgment, judgment])).toMatch(/judgment/);
    expect(levelSizeIssue([...scored(4), { type: 'single_choice', scored: false, pendingRefs: ['T01'] }])).toMatch(/5 到 8/);
  });
});

describe('ChoiceOption 的 short 與 pin、transaction_effect 的 scoring（03 第 2.4、2.8 節）', () => {
  it('short 與 pin: last 通過；兩個 pin 失敗；pin 其他值失敗', () => {
    const options = single.options.map((o, i) => (i === 2 ? { ...o, short: lt('收入', 'Revenue'), pin: 'last' } : o));
    expect(ok(Question, { ...single, options })).toBe(true);
    expect(ok(Question, { ...single, options: single.options.map((o) => ({ ...o, pin: 'last' })) })).toBe(false);
    expect(ok(Question, { ...single, options: single.options.map((o, i) => (i === 0 ? { ...o, pin: 'first' } : o)) })).toBe(false);
  });
  it('scoring 只接受 allOrNothing 與 perTarget', () => {
    const q = {
      ...single,
      id: 'q_tx7h2c9d',
      type: 'transaction_effect',
      options: undefined,
      correctOptionId: undefined,
      scenario: {
        opening: { balances: { cash: 100000, share_capital: 100000 } },
        events: [{ id: 'e1', template: 'tpl.purchase_inventory_cash', params: { amount: 30000 } }],
        policy: 'teacher@1',
        layout: 'teacher@1',
        window: 'cumulative',
        targets: [{ id: 't1', kind: 'line', line: 'bs_cash', measure: 'direction' }],
      },
      choices: ['up', 'down', 'unchanged'],
      explanation: lt('解說。', 'Explanation.'),
    };
    const { options: _o, correctOptionId: _c, ...te } = q;
    expect(ok(Question, te)).toBe(true);
    expect(ok(Question, { ...te, scoring: 'perTarget' })).toBe(true);
    expect(ok(Question, { ...te, scoring: 'partial' })).toBe(false);
  });
});

describe('validateBundle 的引用檢查（08 第 5.3 節）', () => {
  const term = {
    id: 'tm_r4w8n2qe',
    rev: 1,
    revKind: 'text',
    status: 'published',
    category: 'concept',
    label: lt('資產', 'Asset'),
    teacherLabel: '資產',
    currentTwLabel: null,
    ifrsEnglish: 'Asset',
    aliases: { 'zh-TW': [], en: [] },
    flags: [],
    confidence: 'high',
    pendingRefs: [],
    definition: lt('定義。', 'Definition.'),
  };
  const chapter = {
    id: 'ch_c5f8w2',
    rev: 1,
    revKind: 'text',
    status: 'published',
    order: 1,
    scope: 'core',
    examScope: 'midterm',
    title: lt('章', 'Chapter'),
    summary: lt('簡介。', 'Summary.'),
    objectiveIds: ['obj_d7q2x5'],
    levelIds: ['lv_k7m2q9xd'],
  };
  const other = { ...chapter, id: 'ch_m2t7q4', order: 2, objectiveIds: [], levelIds: [] };
  const five = Array.from({ length: 5 }, (_, i) => ({
    ...single,
    id: `q_m4t9x2k${'abcde'[i]}`,
    options: single.options.map((o) => ({ ...o, misconceptionId: 'mc_7f2d' })),
  }));
  const bundle = (over: Partial<ContentBundle> = {}): ContentBundle => ({
    terms: [{ file: 'content/terms/tm_r4w8n2qe.json', data: term }],
    chapters: [
      { file: 'content/chapters/ch_c5f8w2.json', data: chapter },
      { file: 'content/chapters/ch_m2t7q4.json', data: other },
    ],
    objectives: [{ file: 'content/objectives/ch_c5f8w2.json', data: objectiveFile }],
    levels: [{ file: 'content/levels/lv_k7m2q9xd.json', data: { ...level, questionIds: five.map((q) => q.id) } }],
    questions: five.map((q) => ({ file: `content/questions/ch_c5f8w2/${q.id}.json`, data: q })),
    ...over,
  });
  const messages = (b: ContentBundle) => validateBundle(b).map((i) => `${i.file} ${i.path}：${i.message}`);

  it('引用自洽的 bundle 沒有問題', () => {
    expect(messages(bundle())).toEqual([]);
  });
  it('章節列了不存在或別章的目標與關卡', () => {
    const missing = bundle({
      chapters: [
        { file: 'c', data: { ...chapter, objectiveIds: ['obj_000000'], levelIds: ['lv_00000000'] } },
        { file: 'o', data: other },
      ],
    });
    expect(messages(missing)).toEqual(
      expect.arrayContaining([expect.stringContaining('引用不存在的學習目標 obj_000000'), expect.stringContaining('引用不存在的關卡 lv_00000000')]),
    );
    const moved = bundle({
      chapters: [
        { file: 'c', data: { ...chapter, objectiveIds: [], levelIds: [] } },
        { file: 'o', data: { ...other, objectiveIds: ['obj_d7q2x5'], levelIds: ['lv_k7m2q9xd'] } },
      ],
    });
    expect(messages(moved)).toEqual(expect.arrayContaining([expect.stringContaining('屬於章節 ch_c5f8w2，不是 ch_m2t7q4')]));
  });
  it('關卡的題目要存在、同章；已發布的關卡題數 5 到 8 題', () => {
    const b = bundle({ levels: [{ file: 'l', data: { ...level, questionIds: ['q_00000000', ...five.slice(0, 4).map((q) => q.id)] } }] });
    expect(messages(b)).toEqual(expect.arrayContaining([expect.stringContaining('引用不存在的題目 q_00000000')]));
    const short = bundle({ levels: [{ file: 'l', data: { ...level, questionIds: five.slice(0, 4).map((q) => q.id) } }] });
    expect(messages(short)).toEqual(expect.arrayContaining([expect.stringContaining('5 到 8 題計分題')]));
    const draft = bundle({
      levels: [{ file: 'l', data: { ...level, status: 'draft', questionIds: five.slice(0, 2).map((q) => q.id) } }],
      chapters: [
        { file: 'c', data: { ...chapter, levelIds: [] } },
        { file: 'o', data: other },
      ],
    });
    expect(messages(draft)).toEqual([]);
    const otherChapter = bundle({
      questions: five.map((q, i) => ({ file: `q${i}`, data: i === 0 ? { ...q, chapterId: 'ch_m2t7q4', objectiveId: 'obj_d7q2x5' } : q })),
    });
    expect(messages(otherChapter)).toEqual(
      expect.arrayContaining([expect.stringContaining('關卡屬於 ch_c5f8w2'), expect.stringContaining('題目屬於 ch_m2t7q4')]),
    );
  });
  it('題目的 objectiveId 要存在、同章；misconceptionId 要存在於該目標', () => {
    const b = bundle({ questions: five.map((q, i) => ({ file: `q${i}`, data: i === 0 ? { ...q, objectiveId: 'obj_000000' } : q })) });
    expect(messages(b)).toEqual(expect.arrayContaining([expect.stringContaining('引用不存在的學習目標 obj_000000')]));
    const mc = bundle({
      questions: five.map((q, i) => ({ file: `q${i}`, data: i === 0 ? { ...q, options: q.options.map((o) => ({ ...o, misconceptionId: 'mc_0000' })) } : q })),
    });
    expect(messages(mc)).toEqual(expect.arrayContaining([expect.stringContaining('沒有迷思 mc_0000')]));
  });
  it('已發布只能引用已發布：章節列草稿目標、關卡列草稿題目、題目對應草稿目標', () => {
    const draftObjective = bundle({ objectives: [{ file: 'o', data: { chapterId: 'ch_c5f8w2', items: [{ ...objective, status: 'draft' }] } }] });
    const msgs = messages(draftObjective);
    expect(msgs).toEqual(
      expect.arrayContaining([expect.stringContaining('已發布的章節只能列已發布的學習目標'), expect.stringContaining('已發布的題目只能對應已發布的學習目標')]),
    );
    const draftQuestion = bundle({ questions: five.map((q, i) => ({ file: `q${i}`, data: i === 0 ? { ...q, status: 'draft' } : q })) });
    expect(messages(draftQuestion)).toEqual(expect.arrayContaining([expect.stringContaining('已發布的關卡只能列已發布的題目')]));
  });
  it('已發布的關卡與題目只能屬於已發布的章節（ref.publishedClosure，finding core-4）', () => {
    const draftChapter = bundle({
      chapters: [
        { file: 'c', data: { ...chapter, status: 'draft' } },
        { file: 'o', data: other },
      ],
    });
    const issues = validateBundle(draftChapter).filter((i) => i.rule === 'ref.publishedClosure');
    expect(issues.map((i) => `${i.file} ${i.path}：${i.message}`)).toEqual(
      expect.arrayContaining([
        'content/levels/lv_k7m2q9xd.json chapterId：已發布的關卡只能屬於已發布的章節，ch_c5f8w2 是 draft',
        `content/questions/ch_c5f8w2/${five[0]!.id}.json chapterId：已發布的題目只能屬於已發布的章節，ch_c5f8w2 是 draft`,
      ]),
    );
    expect(issues).toHaveLength(1 + five.length);
    // 草稿章節裡的草稿關卡與題目不受影響
    const allDraft = bundle({
      chapters: [
        { file: 'c', data: { ...chapter, status: 'draft' } },
        { file: 'o', data: other },
      ],
      levels: [{ file: 'l', data: { ...level, status: 'draft', questionIds: five.map((q) => q.id) } }],
      questions: five.map((q) => ({ file: `content/questions/ch_c5f8w2/${q.id}.json`, data: { ...q, status: 'draft' } })),
    });
    expect(validateBundle(allDraft).filter((i) => i.rule === 'ref.publishedClosure')).toEqual([]);
  });
  it('省略 objectives 與 levels 時不檢查這些引用（M1 的 bundle 仍可用）', () => {
    const b = bundle();
    delete b.objectives;
    delete b.levels;
    expect(messages(b)).toEqual([]);
  });
  it('全站 ID 不得跨實體重複；已發布的目標要有 en', () => {
    const dup = bundle({
      levels: [
        { file: 'l', data: { ...level, id: 'lv_k7m2q9xd', questionIds: five.map((q) => q.id) } },
        { file: 'l2', data: { ...level, id: 'lv_k7m2q9xd', questionIds: five.map((q) => q.id) } },
      ],
    });
    expect(messages(dup)).toEqual(expect.arrayContaining([expect.stringContaining('關卡 ID 重複')]));
    const noEn = bundle({ objectives: [{ file: 'o', data: { chapterId: 'ch_c5f8w2', items: [{ ...objective, statement: { 'zh-TW': '只有中文。' } }] } }] });
    expect(messages(noEn)).toEqual(expect.arrayContaining([expect.stringContaining('items.0.statement.en：published 的內容必須有 en 文字')]));
  });
});
