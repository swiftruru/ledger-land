// Excel 匯入（tools/lib/sheet-import.mjs、import-run.mjs）：列的身分規則、格式轉換、錯誤對回「工作表、列、欄」、差異分類與 rev、保留欄位、判分方式與狀態的規則
// （10 第 13 節的完成標準）。用 fixtures 的小 bundle，工作表直接用二維陣列組。
import { describe, expect, it } from 'vitest';
import { classifyCandidates, localiseMessage, locate, runImport, sheetsFromCsv, suggestionFor } from '../lib/import-run.mjs';
import { colLetter } from '../lib/ooxml.mjs';
import { convertCell, detectSheet, sheetRows, templateVersionOf } from '../lib/sheet-import.mjs';
import {
  ITEM_COLUMNS,
  OPTION_COLUMNS,
  QUESTION_COLUMNS,
  SHEET,
  TEMPLATE_VERSION,
  TERM_COLUMNS,
  headerRows,
  questionToRows,
  termToRow,
} from '../lib/sheet-template.mjs';
import { bundleWith, qMulti } from './fixtures.ts';

const lt = (zh: string, en: string) => ({ 'zh-TW': zh, en });
const seeded = () => {
  let s = 7;
  return () => (s = (s * 48271) % 2147483647) / 2147483647;
};

/** 既有的單選題（已發布）與一題草稿 */
const qSingle = {
  id: 'q_s1ng13aa',
  rev: 2,
  revKind: 'text',
  status: 'published',
  type: 'single_choice',
  chapterId: 'ch_n3f8q1',
  objectiveId: 'obj_5vk2m7',
  difficulty: 1,
  tags: ['cash'],
  termRefs: [],
  scored: true,
  vars: { cash: 35000 },
  display: { statements: ['bs'] },
  prompt: lt('帳上剩 {{money:vars.cash}} 現金，在哪一張報表？', 'There is {{money:vars.cash}} in cash. Which statement shows it?'),
  options: [
    { id: 'o_a1a1', text: lt('資產負債表', 'Balance sheet'), feedback: lt('對。', 'Right.') },
    { id: 'o_b2b2', text: lt('損益表', 'Income statement'), feedback: lt('不對。', 'No.'), misconceptionId: undefined },
    { id: 'o_c3c3', text: lt('現金流量表', 'Cash flow statement'), feedback: lt('不對。', 'No.') },
  ],
  correctOptionId: 'o_a1a1',
  explanation: lt('{{option:o_a1a1}}。', '{{option:o_a1a1}}.'),
};
delete (qSingle.options[1] as { misconceptionId?: string }).misconceptionId;
const qDraft = {
  ...structuredClone(qSingle),
  id: 'q_dr4ft000',
  rev: 1,
  status: 'draft',
  options: qSingle.options.map((o) => ({ ...o, id: o.id.replace('o_', 'o_d').slice(0, 6) })),
};
qDraft.correctOptionId = qDraft.options[0].id;
qDraft.explanation = lt(`{{option:${qDraft.options[0].id}}}。`, `{{option:${qDraft.options[0].id}}}.`);

const objectiveFiles = [
  {
    file: 'content/objectives/ch_n3f8q1.json',
    data: {
      chapterId: 'ch_n3f8q1',
      items: [
        {
          id: 'obj_5vk2m7',
          rev: 1,
          revKind: 'text',
          status: 'published',
          chapterId: 'ch_n3f8q1',
          order: 1,
          statement: lt('目標一', 'Objective one'),
          skill: 'identify',
          plannedQuestions: 2,
        },
        {
          id: 'obj_4tw8m3',
          rev: 1,
          revKind: 'text',
          status: 'published',
          chapterId: 'ch_n3f8q1',
          order: 2,
          statement: lt('目標二', 'Objective two'),
          skill: 'identify',
          plannedQuestions: 2,
          misconceptions: [{ id: 'mc_7f2d', text: lt('迷思', 'Misconception') }],
        },
      ],
    },
  },
  {
    file: 'content/objectives/ch_x4d9p2.json',
    data: {
      chapterId: 'ch_x4d9p2',
      items: [
        {
          id: 'obj_8wc3k6',
          rev: 1,
          revKind: 'text',
          status: 'published',
          chapterId: 'ch_x4d9p2',
          order: 1,
          statement: lt('目標三', 'Objective three'),
          skill: 'identify',
          plannedQuestions: 2,
        },
      ],
    },
  },
];
function makeBundle() {
  const b = bundleWith([structuredClone(qSingle), structuredClone(qMulti), structuredClone(qDraft)]);
  return {
    ...b,
    objectives: objectiveFiles,
    levels: [],
    formulas: [],
    questions: b.questions.map((q) => ({ ...q, file: `content/questions/${String(q.data.chapterId)}/${String(q.data.id)}.json` })),
  };
}
const lock = {
  lockVersion: 1,
  contentVersion: 1,
  items: [
    { id: 'q_s1ng13aa', kind: 'question', rev: 2, revKind: 'text', answerRev: 1, status: 'published', optionIds: ['o_a1a1', 'o_b2b2', 'o_c3c3'] },
    { id: 'q_p9k4r7cx', kind: 'question', rev: 1, revKind: 'text', answerRev: 1, status: 'published', optionIds: ['o_f3k8', 'o_g6v4', 'o_h7n2', 'o_j2c9'] },
  ],
};

/** 把一題或名詞匯出成列，組成工作表（第 1、2 列是 key 與說明） */
function sheetsOf(questions: Record<string, unknown>[], terms: Record<string, unknown>[] = []) {
  const q: unknown[][] = [...headerRows(QUESTION_COLUMNS)];
  const o: unknown[][] = [...headerRows(OPTION_COLUMNS)];
  const i: unknown[][] = [...headerRows(ITEM_COLUMNS)];
  const t: unknown[][] = [...headerRows(TERM_COLUMNS)];
  for (const x of questions) {
    const r = questionToRows(x);
    q.push(r.question);
    o.push(...r.options);
    i.push(...r.items);
  }
  for (const x of terms) t.push(termToRow(x));
  return { [SHEET.about]: [['templateVersion', TEMPLATE_VERSION]], [SHEET.questions]: q, [SHEET.options]: o, [SHEET.items]: i, [SHEET.terms]: t };
}
const col = (columns: readonly { key: string }[], key: string) => columns.findIndex((c) => c.key === key);
const letter = (columns: readonly { key: string }[], key: string) => colLetter(col(columns, key) + 1);
const errors = (r: { issues: { severity: string }[] }) => r.issues.filter((i) => i.severity === 'error');
const run = (sheets: Record<string, unknown[][]>, bundle = makeBundle()) => runImport({ sheets, bundle, lock, random: seeded() });

describe('convertCell 與 sheetRows', () => {
  it('各種格式：整數、布林（TRUE、是、1）、JSON、逗號與分號清單、空白、單引號前綴', () => {
    expect(convertCell({ kind: 'int', key: 'x' }, '3')).toEqual({ ok: true, value: 3 });
    expect(convertCell({ kind: 'int', key: 'x' }, 2.5).ok).toBe(false);
    for (const v of [true, 'TRUE', '是', 1, 'yes']) expect(convertCell({ kind: 'bool', key: 'x' }, v)).toEqual({ ok: true, value: true });
    for (const v of [false, 'FALSE', '否', 0]) expect(convertCell({ kind: 'bool', key: 'x' }, v)).toEqual({ ok: true, value: false });
    expect(convertCell({ kind: 'bool', key: 'x' }, '也許').ok).toBe(false);
    expect(convertCell({ kind: 'json', key: 'x' }, '{"a": 1}')).toEqual({ ok: true, value: { a: 1 } });
    expect(convertCell({ kind: 'json', key: 'x' }, '[1]').ok).toBe(false);
    expect(convertCell({ kind: 'csv', key: 'x' }, 'a, b，c')).toEqual({ ok: true, value: ['a', 'b', 'c'] });
    expect(convertCell({ kind: 'semicolon', key: 'x' }, '甲, 乙; 丙')).toEqual({ ok: true, value: ['甲, 乙', '丙'] });
    expect(convertCell({ kind: 'text', key: 'x' }, '  ')).toEqual({ ok: true, value: undefined });
    expect(convertCell({ kind: 'text', key: 'x' }, "'=SUM")).toEqual({ ok: true, value: '=SUM' });
  });
  it('第 1 列少欄是錯誤、多欄是警告；整列空白略過；列號是 Excel 的列號', () => {
    const [keys, labels] = headerRows(TERM_COLUMNS);
    const r = sheetRows([[...keys, 'extra'], labels, [], ['tm_x']], TERM_COLUMNS, SHEET.terms);
    expect(r.issues.map((i) => [i.severity, i.column, i.field])).toEqual([['warning', colLetter(keys.length + 1), 'extra']]);
    expect(r.rows.map((x) => x.row)).toEqual([4]);
    const missing = sheetRows([keys.slice(1), labels], TERM_COLUMNS, SHEET.terms);
    expect(missing.issues[0]).toMatchObject({ severity: 'error', code: 'sheet.columns', row: 1, field: 'id' });
  });
  it('CSV 依第 1 列判斷工作表；說明表的 templateVersion', () => {
    expect(detectSheet(headerRows(QUESTION_COLUMNS)[0])).toBe(SHEET.questions);
    expect(detectSheet(headerRows(OPTION_COLUMNS)[0])).toBe(SHEET.options);
    expect(detectSheet(headerRows(ITEM_COLUMNS)[0])).toBe(SHEET.items);
    expect(detectSheet(headerRows(TERM_COLUMNS)[0])).toBe(SHEET.terms);
    expect(detectSheet(['a', 'b'])).toBeNull();
    expect(templateVersionOf([['templateVersion', '1']])).toBe(1);
    expect(templateVersionOf(undefined)).toBeNull();
    const r = sheetsFromCsv([
      { name: 'a.csv', rows: headerRows(TERM_COLUMNS) },
      { name: 'b.csv', rows: headerRows(TERM_COLUMNS) },
      { name: 'c.csv', rows: [['x']] },
    ]);
    expect(r.issues.map((i) => i.code)).toEqual([['sheet.duplicate'], ['sheet.unknown']].flat());
  });
});

describe('runImport：身分規則與差異', () => {
  it('原樣匯回全部無變動；範例列略過', () => {
    const sheets = sheetsOf([qSingle, qMulti, qDraft]);
    sheets[SHEET.questions].push([...questionToRows({ ...qSingle, id: '#example-x' }).question]);
    const r = run(sheets);
    expect(errors(r)).toEqual([]);
    expect(r.summary).toMatchObject({ unchanged: 3, new: 0, examples: 1 });
    expect(r.writable).toEqual([]);
  });
  it('改解說是文字改版（rev 加一）、換正解是答案改版、草稿改了 rev 不動、名詞一律文字改版', () => {
    const sheets = sheetsOf([qSingle, qMulti, qDraft]);
    const q = sheets[SHEET.questions];
    q[2][col(QUESTION_COLUMNS, 'explanation.zh-TW')] = '{{option:o_a1a1}}，現金是資產。';
    const o = sheets[SHEET.options];
    const isAnswer = col(OPTION_COLUMNS, 'isAnswer');
    const rowsOfMulti = o.map((r, i) => (r[0] === qMulti.id ? i : -1)).filter((i) => i >= 0);
    o[rowsOfMulti[1]][isAnswer] = true; // 多正解題多勾一個正解
    q[4][col(QUESTION_COLUMNS, 'difficulty')] = 3; // 草稿
    const r = run(sheets);
    expect(errors(r)).toEqual([]);
    const by = Object.fromEntries(r.candidates.map((c) => [c.id, c]));
    expect(by[qSingle.id]).toMatchObject({ change: 'text', changedFields: ['explanation'] });
    expect(by[qSingle.id].data.rev).toBe(3);
    expect(by[qSingle.id].data.revKind).toBe('text');
    expect(by[qMulti.id]).toMatchObject({ change: 'answer' });
    expect(by[qMulti.id].data).toMatchObject({ rev: 2, revKind: 'answer', correctOptionIds: ['o_f3k8', 'o_g6v4', 'o_h7n2'] });
    expect(by[qDraft.id]).toMatchObject({ change: 'text' });
    expect(by[qDraft.id].data.rev).toBe(1);
    expect(r.needsConfirmation).toBe(true);
    expect(r.writable.map((c) => c.id).sort()).toEqual([qDraft.id, qMulti.id, qSingle.id].sort());
  });
  it('表格沒有的欄位（display）原樣保留；表格有的欄位清空就刪除（vars）', () => {
    const sheets = sheetsOf([qSingle]);
    const q = sheets[SHEET.questions];
    q[2][col(QUESTION_COLUMNS, 'vars')] = '';
    q[2][col(QUESTION_COLUMNS, 'prompt.zh-TW')] = '帳上的現金在哪一張報表？';
    q[2][col(QUESTION_COLUMNS, 'prompt.en')] = 'Which statement shows cash?';
    const r = run(sheets);
    expect(errors(r)).toEqual([]);
    const c = r.candidates[0];
    expect(c.data.display).toEqual({ statements: ['bs'] });
    expect(c.data.vars).toBeUndefined();
    expect(c.changedFields.sort()).toEqual(['prompt', 'vars']);
  });
  it('新增：id 空白產生 ID，#new 配選項，名詞新增；新題目題幹和既有題目相同時警告', () => {
    const sheets = sheetsOf([]);
    const nq = questionToRows({ ...qSingle, id: '#new:cash', rev: undefined, status: 'draft', explanation: lt('現金是資產。', 'Cash is an asset.') });
    sheets[SHEET.questions].push(nq.question);
    sheets[SHEET.options].push(...nq.options.map((row) => row.map((v, j) => (j === col(OPTION_COLUMNS, 'optionId') ? '' : v))));
    const nt = termToRow({
      id: '',
      rev: undefined,
      status: 'draft',
      category: 'concept',
      label: lt('新名詞', 'New term'),
      teacherLabel: '新名詞',
      currentTwLabel: null,
      ifrsEnglish: 'New',
      aliases: { 'zh-TW': ['別名'], en: [] },
      flags: [],
      confidence: 'high',
      pendingRefs: [],
      definition: lt('定義。', 'Definition.'),
    });
    sheets[SHEET.terms].push(nt);
    const r = run(sheets);
    expect(errors(r)).toEqual([]);
    expect(r.summary.new).toBe(2);
    const q = r.candidates.find((c) => c.kind === 'question')!;
    expect(q.id).toMatch(/^q_[0-9a-hjkmnp-tv-z]{8}$/);
    expect(q.data.options.map((o: { id: string }) => o.id).every((id: string) => /^o_[0-9a-hjkmnp-tv-z]{4}$/.test(id))).toBe(true);
    expect(q.data.correctOptionId).toBe(q.data.options[0].id);
    expect(r.issues.find((i) => i.code === 'row.duplicatePrompt')).toMatchObject({ severity: 'warning', sheet: SHEET.questions, row: 3 });
    const t = r.candidates.find((c) => c.kind === 'term')!;
    expect(t.data).toMatchObject({ rev: 1, status: 'draft', aliases: { 'zh-TW': ['別名'], en: [] }, currentTwLabel: null });
  });
  it('baseRev 不等於目前的 rev 是衝突，這一列不匯入；缺 baseRev 也擋；已發布改回 draft 擋', () => {
    const sheets = sheetsOf([qSingle, qMulti, qDraft]);
    const q = sheets[SHEET.questions];
    q[2][col(QUESTION_COLUMNS, 'baseRev')] = 1;
    q[3][col(QUESTION_COLUMNS, 'baseRev')] = '';
    q[4][col(QUESTION_COLUMNS, 'status')] = 'draft';
    q[3][col(QUESTION_COLUMNS, 'status')] = 'draft';
    const r = run(sheets);
    const codes = errors(r).map((i) => [i.code, i.row, i.column]);
    expect(codes).toContainEqual(['row.conflict', 3, letter(QUESTION_COLUMNS, 'baseRev')]);
    expect(codes).toContainEqual(['row.baseRevMissing', 4, letter(QUESTION_COLUMNS, 'baseRev')]);
    expect(codes).toContainEqual(['row.statusBackwards', 4, letter(QUESTION_COLUMNS, 'status')]);
    expect(r.summary.conflict).toBe(2);
    expect(r.writable).toEqual([]);
  });
  it('下架：status 改 retired 歸「下架」，要再確認', () => {
    const sheets = sheetsOf([qSingle]);
    sheets[SHEET.questions][2][col(QUESTION_COLUMNS, 'status')] = 'retired';
    const r = run(sheets);
    expect(errors(r)).toEqual([]);
    expect(r.candidates[0]).toMatchObject({ change: 'retire' });
    expect(r.needsConfirmation).toBe(true);
  });
  it('找不到的 id、題型不能用表格維護、範本版本不對', () => {
    const sheets = sheetsOf([qSingle]);
    sheets[SHEET.questions][2][col(QUESTION_COLUMNS, 'id')] = 'q_n0pe0000';
    sheets[SHEET.questions].push([...sheets[SHEET.questions][2]]);
    sheets[SHEET.questions][3][col(QUESTION_COLUMNS, 'id')] = '';
    sheets[SHEET.questions][3][col(QUESTION_COLUMNS, 'type')] = 'ratio_numeric';
    const r = run(sheets);
    expect(errors(r).map((i) => i.code)).toEqual(expect.arrayContaining(['row.unknownId', 'sheet.type']));
    const old = run({ ...sheetsOf([qSingle]), [SHEET.about]: [['templateVersion', 0]] });
    expect(errors(old)[0]).toMatchObject({ code: 'sheet.templateVersion', sheet: SHEET.about, column: 'B' });
  });
});

describe('runImport：判分方式、正解、狀態與文字規則（完成標準）', () => {
  it('multi_choice 缺判分方式、單選填了判分方式、判分方式不在清單裡', () => {
    const sheets = sheetsOf([qSingle, qMulti]);
    const q = sheets[SHEET.questions];
    const sm = col(QUESTION_COLUMNS, 'scoringMode');
    q[2][sm] = 'any_correct';
    q[3][sm] = '';
    const r = run(sheets);
    const got = errors(r).map((i) => [i.row, i.column, i.code]);
    expect(got).toContainEqual([3, letter(QUESTION_COLUMNS, 'scoringMode'), 'sheet.notForType']);
    expect(got).toContainEqual([4, letter(QUESTION_COLUMNS, 'scoringMode'), 'struct.schema']);
    expect(errors(r).find((i) => i.row === 4)!.message).toContain('值不在允許的清單裡');
    const bad = sheetsOf([qMulti]);
    bad[SHEET.questions][2][sm] = 'some_correct';
    const r2 = run(bad);
    expect(errors(r2)[0]).toMatchObject({ row: 3, column: letter(QUESTION_COLUMNS, 'scoringMode'), message: '值不在允許的清單裡（any_correct、all_correct）' });
  });
  it('multi_choice 少於兩個正解、全部都是正解；單選兩個正解或沒有正解', () => {
    const sheets = sheetsOf([qSingle, qMulti]);
    const o = sheets[SHEET.options];
    const isAnswer = col(OPTION_COLUMNS, 'isAnswer');
    const multiRows = o.map((r, i) => (r[0] === qMulti.id ? i : -1)).filter((i) => i >= 0);
    const singleRows = o.map((r, i) => (r[0] === qSingle.id ? i : -1)).filter((i) => i >= 0);
    o[multiRows[2]][isAnswer] = false; // 只剩一個正解
    o[singleRows[1]][isAnswer] = true; // 單選兩個正解
    const r = run(sheets);
    const got = errors(r).map((i) => [i.sheet, i.row, i.code]);
    expect(got).toContainEqual([SHEET.options, singleRows[1] + 1, 'ans.singleCorrect']);
    expect(got).toContainEqual([SHEET.options, multiRows[0] + 1, 'struct.schema']);
    const all = sheetsOf([qMulti]);
    for (const [i, row] of all[SHEET.options].entries()) if (i >= 2) row[isAnswer] = true;
    const r2 = run(all);
    expect(errors(r2).some((i) => i.message.includes('至少要留一個'))).toBe(true);
    const none = sheetsOf([qSingle]);
    for (const i of none[SHEET.options].keys()) if (i >= 2) none[SHEET.options][i][isAnswer] = false;
    const r3 = run(none);
    expect(errors(r3)[0]).toMatchObject({ sheet: SHEET.options, row: 3, code: 'ans.singleCorrect' });
  });
  it('狀態欄只接受 draft、published、retired', () => {
    const sheets = sheetsOf([qSingle]);
    sheets[SHEET.questions][2][col(QUESTION_COLUMNS, 'status')] = 'review';
    const r = run(sheets);
    expect(errors(r)[0]).toMatchObject({ row: 3, column: letter(QUESTION_COLUMNS, 'status'), message: '值不在允許的清單裡（draft、published、retired）' });
  });
  it('找不到章節、學習目標不屬於該章：欄對到 chapterId 與 objectiveId；選項的回饋空白對到選項表的列', () => {
    const sheets = sheetsOf([qSingle]);
    sheets[SHEET.questions][2][col(QUESTION_COLUMNS, 'objectiveId')] = 'obj_8wc3k6';
    sheets[SHEET.options][3][col(OPTION_COLUMNS, 'feedback.en')] = '';
    const r = run(sheets);
    const got = errors(r).map((i) => [i.sheet, i.row, i.column]);
    expect(got).toContainEqual([SHEET.questions, 3, letter(QUESTION_COLUMNS, 'objectiveId')]);
    expect(got).toContainEqual([SHEET.options, 4, letter(OPTION_COLUMNS, 'feedback.en')]);
    const moved = sheetsOf([qSingle]);
    moved[SHEET.questions][2][col(QUESTION_COLUMNS, 'chapterId')] = 'ch_9x2k7m';
    expect(errors(run(moved)).map((i) => i.column)).toContain(letter(QUESTION_COLUMNS, 'chapterId'));
  });
  it('中國用語與破折號是錯誤，對到那一格', () => {
    const sheets = sheetsOf([qSingle]);
    sheets[SHEET.questions][2][col(QUESTION_COLUMNS, 'explanation.zh-TW')] = '{{option:o_a1a1}}，請看視頻。';
    sheets[SHEET.options][2][col(OPTION_COLUMNS, 'text.zh-TW')] = '資產負債表—主表';
    const r = run(sheets);
    expect(errors(r)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'style.twTerms',
          sheet: SHEET.questions,
          row: 3,
          column: letter(QUESTION_COLUMNS, 'explanation.zh-TW'),
          suggestion: '改成影片。',
        }),
        expect.objectContaining({ code: 'style.dash', sheet: SHEET.options, row: 3, column: letter(OPTION_COLUMNS, 'text.zh-TW') }),
      ]),
    );
  });
  it('選項列的 questionId 不在題目表裡；分類項目給了非 classify 題', () => {
    const sheets = sheetsOf([qSingle]);
    sheets[SHEET.options][2][0] = 'q_gh0st000';
    sheets[SHEET.items].push(['q_s1ng13aa', '', 1, 'cash', '', '', '', '', '']);
    const r = run(sheets);
    expect(errors(r).map((i) => i.code)).toEqual(expect.arrayContaining(['row.orphan', 'sheet.notForType']));
  });
  it('labRef.step 對到故事；找不到的步驟報錯', () => {
    const sheets = sheetsOf([qSingle]);
    sheets[SHEET.questions][2][col(QUESTION_COLUMNS, 'labRef.step')] = 'st_h8q3z6';
    const r = run(sheets);
    expect(errors(r)).toEqual([]);
    expect(r.candidates[0].data.labRef).toEqual({ story: 'story_q7m2v9', step: 'st_h8q3z6' });
    sheets[SHEET.questions][2][col(QUESTION_COLUMNS, 'labRef.step')] = 'st_zzzzzz';
    expect(errors(run(sheets))[0]).toMatchObject({ code: 'ref.step', column: letter(QUESTION_COLUMNS, 'labRef.step') });
  });
});

describe('小工具', () => {
  it('Zod 訊息中文化與建議對照', () => {
    expect(localiseMessage('Invalid option: expected one of "a"|"b"')).toBe('值不在允許的清單裡（a、b）');
    expect(localiseMessage('Invalid input: expected string, received undefined')).toBe('這一格是必填');
    expect(localiseMessage('Unrecognized key: "foo"')).toBe('多了這個題型沒有的欄位 foo');
    expect(localiseMessage('Too small: expected array to have >=2 items')).toBe('項目至少要 2 個');
    expect(localiseMessage('其他訊息')).toBe('其他訊息');
    expect(suggestionFor('ref.termRefsListed', '')).toContain('termRefs');
    expect(suggestionFor('x', '引用不存在的學習目標 obj_1')).toContain('學習目標');
    expect(suggestionFor('x', 'y')).toContain('08-content-admin.md');
  });
  it('locate 把 JSON 路徑對回欄；classifyCandidates 的 rev 規則', () => {
    const headers = {
      questions: new Map([['prompt.zh-TW', 'P']]),
      options: new Map([['feedback.en', 'I']]),
      items: new Map(),
      terms: new Map([['definition.en', 'T']]),
    };
    const c = {
      kind: 'question',
      sheet: SHEET.questions,
      row: 5,
      data: { options: [{ id: 'o_1' }, { id: 'o_2' }] },
      optionRows: new Map([
        ['o_1', 10],
        ['o_2', 11],
      ]),
      itemRows: new Map(),
    };
    expect(locate(c, 'statement.zh-TW', headers)).toEqual({ sheet: SHEET.questions, row: 5, column: 'P', field: 'prompt.zh-TW' });
    expect(locate(c, 'options.1.feedback.en', headers)).toEqual({ sheet: SHEET.options, row: 11, column: 'I', field: 'feedback.en' });
    expect(locate(c, 'correctOptionId', headers)).toMatchObject({ sheet: SHEET.options, row: 10, field: 'isAnswer' });
    expect(locate({ kind: 'term', sheet: SHEET.terms, row: 7, data: {} }, 'definition.en', headers)).toEqual({
      sheet: SHEET.terms,
      row: 7,
      column: 'T',
      field: 'definition.en',
    });
    const existing = { file: 'f', data: { id: 'tm_1', rev: 3, revKind: 'text', status: 'published', label: 'a' } };
    const cands = [
      { kind: 'term', id: 'tm_1', isNew: false, conflict: false, existing, data: { id: 'tm_1', rev: 3, revKind: 'text', status: 'published', label: 'b' } },
      {
        kind: 'term',
        id: 'tm_2',
        isNew: false,
        conflict: false,
        existing: { file: 'g', data: { id: 'tm_2', rev: 1, revKind: 'text', status: 'draft', label: 'a' } },
        data: { id: 'tm_2', rev: 1, revKind: 'text', status: 'draft', label: 'b' },
      },
      { kind: 'term', id: 'tm_3', isNew: true, conflict: false, data: { id: 'tm_3', rev: 9, status: 'draft' } },
    ];
    classifyCandidates(cands, { compiledBefore: new Map(), compiledAfter: new Map(), lockIds: new Set(['tm_1']), now: '2026-11-08T00:00:00Z' });
    expect(cands.map((c) => [c.change, c.data.rev, c.data.revKind])).toEqual([
      ['text', 4, 'text'],
      ['text', 1, 'text'],
      ['new', 1, 'text'],
    ]);
    expect(cands[0].data.updatedAt).toBe('2026-11-08T00:00:00Z');
  });
});
