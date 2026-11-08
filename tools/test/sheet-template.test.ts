// Excel 範本（tools/lib/sheet-template.mjs）：欄位定義涵蓋 schema 的每個欄位（schema 加欄位時這裡會失敗，提醒決定進表格還是進保留清單）；
// 範例列通過 Zod；整份目前的內容匯出成 xlsx 再讀回、匯入，358 筆全部「無變動」、沒有任何問題（08 第 5.8 節「比對範本與 schema 一致」加 10 第 13 節的來回測試）。
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ClassifyQuestion, JudgmentQuestion, MultiChoiceQuestion, Question, SingleChoiceQuestion, Term, TrueFalseQuestion } from '@ledgerland/content-schema';
import { describe, expect, it } from 'vitest';
import { loadContentFiles } from '../lib/content-files.mjs';
import { ROOT, readJson } from '../lib/fs.mjs';
import { runImport } from '../lib/import-run.mjs';
import {
  ITEM_COLUMNS,
  OPTION_COLUMNS,
  QUESTION_COLUMNS,
  QUESTION_PRESERVED_FIELDS,
  SHEET,
  TERM_COLUMNS,
  TERM_PRESERVED_FIELDS,
  TEXT_TYPES,
  buildTemplate,
  exampleRows,
  questionToRows,
  quoteFormulaLike,
  stripQuotePrefix,
  termToRow,
  topField,
} from '../lib/sheet-template.mjs';
import { readWorkbook } from '../lib/xlsx-read.mjs';
import { writeWorkbook } from '../lib/xlsx-write.mjs';
import { chapter } from './fixtures.ts';

const lt = (zh: string, en: string) => ({ 'zh-TW': zh, en });
const objective = {
  id: 'obj_5vk2m7',
  rev: 1,
  revKind: 'text',
  status: 'published',
  chapterId: 'ch_n3f8q1',
  order: 1,
  statement: lt('目標', 'Objective'),
  skill: 'identify',
  plannedQuestions: 2,
};
const smallContent = { chapters: [chapter('ch_n3f8q1', 1).data], objectives: [objective], questions: [], terms: [] };

describe('欄位定義涵蓋 schema', () => {
  /** 題目表以外另有工作表或由工具推導的欄位 */
  const handledElsewhere = new Set(['id', 'options', 'items', 'correctOptionId', 'correctOptionIds', 'correctCategories', 'statement', 'labRef']);
  const questionTops = new Set([...QUESTION_COLUMNS.map((c) => topField(c.key)), ...QUESTION_PRESERVED_FIELDS, ...handledElsewhere]);
  for (const [name, schema] of Object.entries({ SingleChoiceQuestion, MultiChoiceQuestion, TrueFalseQuestion, JudgmentQuestion, ClassifyQuestion })) {
    it(`${name} 的每個欄位都在題目表、其他表或保留清單裡`, () => {
      const missing = Object.keys(schema.shape).filter((k) => !questionTops.has(k));
      expect(missing).toEqual([]);
    });
  }
  it('Term 的每個欄位都在名詞表或保留清單裡', () => {
    const tops = new Set([...TERM_COLUMNS.map((c) => topField(c.key)), ...TERM_PRESERVED_FIELDS, 'id']);
    expect(Object.keys(Term.shape).filter((k) => !tops.has(k))).toEqual([]);
  });
  it('選項與分類項目的欄位對得上 ChoiceOption、JudgmentOption 與 ClassifyItem', () => {
    const optionTops = new Set(OPTION_COLUMNS.map((c) => topField(c.key)));
    for (const k of ['text', 'short', 'feedback', 'misconceptionId', 'pin', 'upside', 'downside']) expect(optionTops.has(k)).toBe(true);
    const itemTops = new Set(ITEM_COLUMNS.map((c) => topField(c.key)));
    for (const k of ['account', 'ratio', 'text', 'allowContra']) expect(itemTops.has(k)).toBe(true);
  });
  it('欄位 key 不重複，有 types 的欄只列表格可維護的題型', () => {
    for (const cols of [QUESTION_COLUMNS, OPTION_COLUMNS, ITEM_COLUMNS, TERM_COLUMNS]) expect(new Set(cols.map((c) => c.key)).size).toBe(cols.length);
    for (const c of [...QUESTION_COLUMNS, ...OPTION_COLUMNS]) for (const t of c.types ?? []) expect(TEXT_TYPES).toContain(t);
  });
});

describe('範例列與匯出', () => {
  it('範例題目與名詞換成合法 ID 後都通過 Zod', () => {
    const ex = exampleRows(smallContent);
    ex.questions.forEach((q, i) => {
      const r = Question.safeParse({ ...q, revKind: 'text', id: `q_${String(i).padStart(8, '0')}` });
      expect(r.success, `${q.type}: ${r.success ? '' : JSON.stringify(r.error.issues)}`).toBe(true);
    });
    expect(Term.safeParse({ ...ex.term, revKind: 'text', id: 'tm_00000000' }).success).toBe(true);
  });
  it('以 = + - @ 開頭的文字匯出時加單引號，匯入時去掉', () => {
    expect(quoteFormulaLike('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(quoteFormulaLike('-5 元')).toBe("'-5 元");
    expect(quoteFormulaLike('一般文字')).toBe('一般文字');
    expect(stripQuotePrefix("'=SUM(A1)")).toBe('=SUM(A1)');
  });
  it('questionToRows 與 termToRow 的欄位數等於欄位定義', () => {
    const ex = exampleRows(smallContent);
    for (const q of ex.questions) {
      const r = questionToRows(q);
      expect(r.question).toHaveLength(QUESTION_COLUMNS.length);
      for (const o of r.options) expect(o).toHaveLength(OPTION_COLUMNS.length);
      for (const it of r.items) expect(it).toHaveLength(ITEM_COLUMNS.length);
    }
    expect(termToRow(ex.term)).toHaveLength(TERM_COLUMNS.length);
  });
  it('空範本的工作簿：六張表、第 1 列 key、下拉清單指向清單表', () => {
    const wb = buildTemplate(smallContent, { generatedAt: '2026-11-08T00:00:00Z', contentCommit: 'abc' });
    expect(wb.sheets.map((s) => s.name)).toEqual([SHEET.about, SHEET.questions, SHEET.options, SHEET.items, SHEET.terms, SHEET.lists]);
    const q = wb.sheets.find((s) => s.name === SHEET.questions)!;
    expect(q.rows[0]).toEqual(QUESTION_COLUMNS.map((c) => c.key));
    expect(q.rows.length - 2).toBe(5);
    expect(q.validations!.some((v) => 'sheet' in v && v.sheet === SHEET.lists)).toBe(true);
    const buf = writeWorkbook(wb);
    const back = readWorkbook(buf);
    expect(back.problems).toEqual([]);
    expect(back.sheets.find((s) => s.name === SHEET.about)!.rows[0]).toEqual(['templateVersion', 1]);
  });
});

describe('整份內容的來回', () => {
  const hasContent = existsSync(join(ROOT, 'content/questions'));
  it.skipIf(!hasContent)(
    'content:template --filled 的 xlsx 讀回再匯入，全部無變動、沒有問題',
    () => {
      const bundle = loadContentFiles();
      const content = {
        chapters: bundle.chapters.map((e) => e.data),
        objectives: bundle.objectives.flatMap((f) => f.data.items),
        questions: bundle.questions.map((e) => e.data),
        terms: bundle.terms.map((e) => e.data),
      };
      const wb = buildTemplate(content, { filled: true, generatedAt: '2026-11-08T00:00:00Z' });
      const back = readWorkbook(writeWorkbook(wb));
      expect(back.problems).toEqual([]);
      const sheets = Object.fromEntries(back.sheets.map((s) => [s.name, s.rows]));
      const textQuestions = content.questions.filter((q) => TEXT_TYPES.includes(q.type)).length;
      expect(sheets[SHEET.questions].length - 2).toBe(textQuestions);
      const lock = readJson(join(ROOT, 'content/published.lock.json'));
      const result = runImport({ sheets, bundle, lock });
      expect(result.issues).toEqual([]);
      expect(result.summary.unchanged).toBe(textQuestions + content.terms.length);
      expect(result.summary.new + result.summary.text + result.summary.answer + result.summary.retire + result.summary.conflict + result.summary.error).toBe(0);
    },
    30_000,
  );
});
