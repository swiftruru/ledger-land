/// <reference types="node" />
// 本機煙霧測試（04 第 18.3 節；14 第 5.3 節「確認 xlsx 讀取方式能取得公式字串與輸入值」）：
// 對 S0 到 S3 四個檔案只斷言結構性質（工作表、公式格數量、每個公式都能求值、教材的四個勾稽點、IFERROR 的分母為 0 行為），
// 不寫入任何教材數字；原始輸出寫到 .local-reports/excel/（已被 .gitignore 排除）供人工核對。
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  type EvalResult,
  type Rational,
  equals,
  evaluateCell,
  evaluateWorkbook,
  formatRational,
  formulaCells,
  inputCells,
  parseFormula,
  rational,
} from './excel-model.ts';
import { excelFiles } from './references.ts';
import { type Sheet, type Workbook, readXlsx } from './xlsx.ts';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '../../../../..');
const REPORT_DIR = join(REPO_ROOT, '.local-reports', 'excel');
const STATEMENTS = '財務報表';
const INDICATORS = '財務分析指標';
const FORMULA_COUNT = { [STATEMENTS]: 16, [INDICATORS]: 23 } as const;
/** 教材的四個勾稽點：左邊等於右邊（都在「財務報表」） */
const RECONCILIATIONS: ReadonlyArray<readonly [string, string]> = [
  ['L29', 'N29'],
  ['H41', 'L12'],
  ['R33', 'H11'],
  ['R35', 'N26'],
];

function exact(r: EvalResult, where: string): Rational {
  if (r.kind !== 'number') throw new Error(`${where} 不是數字：${r.kind === 'text' ? r.value : r.code}`);
  return r.exact;
}

function serialise(r: EvalResult): Record<string, string | number> {
  if (r.kind === 'number') return { kind: 'number', value: r.value, exact: formatRational(r.exact) };
  if (r.kind === 'text') return { kind: 'text', value: r.value };
  return { kind: 'error', code: r.code };
}

const files = excelFiles();

describe('老師 Excel 讀取與重算（本機）', () => {
  it('找得到 S0 到 S3 四個 xlsx', () => {
    expect(files.map((f) => f.label)).toEqual(['S0', 'S1', 'S2', 'S3']);
  });

  for (const file of files) {
    describe(`檔案 ${file.label}`, () => {
      const book: Workbook = readXlsx(file.path);

      it('讀得到兩張工作表', () => {
        expect([...book.keys()]).toEqual([STATEMENTS, INDICATORS]);
      });

      it('公式格數量符合教材結構', () => {
        expect(formulaCells(book, STATEMENTS).length).toBe(FORMULA_COUNT[STATEMENTS]);
        expect(formulaCells(book, INDICATORS).length).toBe(FORMULA_COUNT[INDICATORS]);
      });

      it('每個公式都能被求值器解析', () => {
        const failures: string[] = [];
        for (const sheet of [STATEMENTS, INDICATORS]) {
          for (const { ref, formula } of formulaCells(book, sheet)) {
            try {
              parseFormula(formula);
            } catch (e) {
              failures.push(`${sheet}!${ref}: ${formula}\n  ${e instanceof Error ? e.message : String(e)}`);
            }
          }
        }
        expect(failures).toEqual([]);
      });

      it('每個公式都能被求值，而且輸出型別只有數字或文字', () => {
        const results = evaluateWorkbook(book);
        const problems: string[] = [];
        for (const sheet of [STATEMENTS, INDICATORS]) {
          const sheetResults = results.get(sheet);
          if (sheetResults === undefined) {
            problems.push(`${sheet}：沒有結果`);
            continue;
          }
          for (const [ref, r] of sheetResults) {
            if (r.kind === 'error') problems.push(`${sheet}!${ref}：${r.code}`);
            else if (r.kind === 'number' && !Number.isFinite(r.value)) problems.push(`${sheet}!${ref}：數值不是有限數`);
          }
        }
        expect(problems).toEqual([]);
      });

      it('四個勾稽點成立', () => {
        const mismatches: string[] = [];
        for (const [left, right] of RECONCILIATIONS) {
          const a = exact(evaluateCell(book, STATEMENTS, left), `${file.label} ${left}`);
          const b = exact(evaluateCell(book, STATEMENTS, right), `${file.label} ${right}`);
          // 不印出數值，只印出哪一組勾稽點不相等
          if (!equals(a, b)) mismatches.push(`${left} 不等於 ${right}`);
        }
        expect(mismatches).toEqual([]);
      });

      it('指標工作表的公式都包在 IFERROR 裡，分母為 0 時回傳文字', () => {
        const results = evaluateWorkbook(book).get(INDICATORS) ?? new Map<string, EvalResult>();
        const notWrapped = formulaCells(book, INDICATORS)
          .filter(({ formula }) => !formula.toUpperCase().startsWith('IFERROR('))
          .map(({ ref }) => ref);
        expect(notWrapped).toEqual([]);
        const badKinds = [...results].filter(([, r]) => r.kind !== 'number' && r.kind !== 'text').map(([ref]) => ref);
        expect(badKinds).toEqual([]);
        // 空白表格（S0）所有輸入都是 0，每個指標的分母都是 0（或分母引用了文字結果），所以全部應為文字；其他檔案不限制
        const nonText = [...results].filter(([, r]) => r.kind !== 'text').map(([ref]) => ref);
        expect(file.label === 'S0' ? nonText : []).toEqual([]);
      });

      it('把輸入格與公式結果寫到 .local-reports/excel 供人工核對', () => {
        const results = evaluateWorkbook(book);
        const report: Record<string, unknown> = { file: file.fileName, label: file.label, sheets: {} };
        const sheets = report['sheets'] as Record<string, unknown>;
        for (const sheet of [STATEMENTS, INDICATORS]) {
          const formulas: Record<string, unknown> = {};
          for (const { ref, formula } of formulaCells(book, sheet)) {
            const r = results.get(sheet)?.get(ref);
            formulas[ref] = { formula, result: r === undefined ? null : serialise(r) };
          }
          sheets[sheet] = { inputs: inputCells(book, sheet), formulas };
        }
        mkdirSync(REPORT_DIR, { recursive: true });
        writeFileSync(join(REPORT_DIR, `${file.label}.json`), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
        expect(Object.keys(sheets)).toHaveLength(2);
      });
    });
  }
});

// 求值器本身的行為，用自編數字與自編工作簿（不碰教材）
describe('求值器（自編工作簿）', () => {
  const data: Sheet = new Map([
    ['A1', { value: 7 }],
    ['A2', { value: 0 }],
    ['A3', { value: 3 }],
    ['B1', { value: '文字' }],
    ['C1', { value: 1 }],
    ['C2', { value: 2 }],
    ['C3', { value: 3 }],
  ]);
  const formulas: Sheet = new Map([
    ['D1', { formula: 'IFERROR(資料!A1/資料!A2,"分母為 0")', value: null }],
    ['D2', { formula: 'IFERROR(\'資料\'!A1/資料!A3,"不會用到")', value: null }],
    ['D3', { formula: 'SUM(資料!C1:C3,資料!A1,資料!A9)', value: null }],
    ['D4', { formula: '-(資料!A1-資料!A3)*2/4', value: null }],
    ['D5', { formula: 'IFERROR(365/D1,"上游是文字")', value: null }],
    ['D6', { formula: 'SUM(資料!A1:C3)', value: null }],
    ['D7', { formula: '資料!A9+1', value: null }],
  ]);
  const book: Workbook = new Map([
    ['資料', data],
    ['算式', formulas],
  ]);

  it('IFERROR 在分母為 0 時回傳文字，否則保留精確分數', () => {
    expect(evaluateCell(book, '算式', 'D1')).toEqual({ kind: 'text', value: '分母為 0' });
    expect(equals(exact(evaluateCell(book, '算式', 'D2'), 'D2'), rational(7n, 3n))).toBe(true);
  });

  it('SUM 接受範圍、多參數與空白格；範圍內的文字略過', () => {
    expect(equals(exact(evaluateCell(book, '算式', 'D3'), 'D3'), rational(13n))).toBe(true);
    expect(equals(exact(evaluateCell(book, '算式', 'D6'), 'D6'), rational(16n))).toBe(true);
  });

  it('一元負號、括號與四則運算的優先順序', () => {
    expect(equals(exact(evaluateCell(book, '算式', 'D4'), 'D4'), rational(-2n))).toBe(true);
  });

  it('上游是文字時算術產生錯誤，再被 IFERROR 接住；空白格視為 0', () => {
    expect(evaluateCell(book, '算式', 'D5')).toEqual({ kind: 'text', value: '上游是文字' });
    expect(equals(exact(evaluateCell(book, '算式', 'D7'), 'D7'), rational(1n))).toBe(true);
  });

  it('不支援的函式與語法會丟出錯誤並附上公式', () => {
    expect(() => parseFormula('ROUND(A1,2)')).toThrow(/ROUND/);
    expect(() => parseFormula('A1^2')).toThrow(/\^/);
    expect(() => parseFormula('SUM(A1')).toThrow(/預期/);
  });
});
