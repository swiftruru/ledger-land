/// <reference types="node" />
// oxlint-disable vitest/valid-expect, vitest/no-conditional-expect -- 逐格比對寫成迴圈；expect 的第二個引數指出哪一格
// 本機老師 Excel 逐格比對（04 第 18.3 節、第 11.7 節、第 12.2 節；10 第 8 節 M1 第一級）：
// 重播正式故事 story_ywv2dy 到第 1、2、3 步，與 S1、S2、S3 的「財務報表」輸入格、16 個公式格與「財務分析指標」23 格比對。
// 期望值一律在執行時從 xlsx 讀出並以極小求值器重算；這個檔案與 repo 內任何檔案都不寫入老師的數字或文字。
// 差異逐項列出（cell、Excel 值、核心值）印在測試輸出，並寫到 gitignored 的 .local-reports/excel/core-vs-excel.json。
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { CoreContext } from '../../src/ledger/index.ts';
import { type RatioResult, computeRatio, defaultRatioRegistry } from '../../src/ratios/index.ts';
import { unwrap } from '../../src/result.ts';
import { type Statements, buildStatements, measureMap } from '../../src/statements/index.ts';
import { type Story, createCoreContext, orderedSteps, replayStory } from '../../src/story/index.ts';
import officialStoryJson from '../../../../content/stories/story_ywv2dy.json' with { type: 'json' };
import { type EvalResult, type Rational, equals, evaluateCell, formatRational, formulaCells, inputCells, rational } from './excel-model.ts';
import { type ExcelLabel, excelFiles } from './references.ts';
import { type Workbook, readXlsx } from './xlsx.ts';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '../../../../..');
const REPORT_PATH = join(REPO_ROOT, '.local-reports', 'excel', 'core-vs-excel.json');
const STATEMENTS = '財務報表';
const INDICATORS = '財務分析指標';
/** 情境標籤對應正式故事的第幾步（S1 是第 1 筆交易之後，以此類推） */
const CASES: ReadonlyArray<readonly [ExcelLabel, number]> = [
  ['S1', 1],
  ['S2', 2],
  ['S3', 3],
];

interface Difference {
  readonly scenario: ExcelLabel;
  readonly sheet: string;
  readonly cell: string;
  readonly kind:
    'input' | 'formula' | 'indicator_status' | 'indicator_exact' | 'indicator_display' | 'indicator_formula' | 'unmapped_input' | 'text_at_core_cell';
  readonly line: string | null;
  readonly excel: string | number | null;
  readonly core: string | number | null;
}

const ctx: CoreContext = createCoreContext();
const story = officialStoryJson as Story;
const run = unwrap(replayStory(story, [], ctx));
const registry = defaultRatioRegistry();
const files = excelFiles();

/** 核心版面的 cell 對線：分組標題在 Excel 是文字標籤，不比對 */
function coreCells(st: Statements): Map<string, { line: string; value: number }> {
  const out = new Map<string, { line: string; value: number }>();
  for (const v of st.lines.values()) {
    if (v.cell === null || v.kind === 'group') continue;
    if (out.has(v.cell)) throw new Error(`版面有兩條線用同一格 ${v.cell}`);
    out.set(v.cell, { line: v.line, value: v.value });
  }
  return out;
}

/** 04 第 11.7 節的匯出規則：R14 期末存貨轉成負數；H 欄各列核心已依教材的正負號慣例帶號 */
function exportValue(cell: string, value: number): number {
  const v = cell === 'R14' ? -value : value;
  return Object.is(v, -0) ? 0 : v;
}

function describeResult(r: EvalResult): string | number {
  if (r.kind === 'number') return formatRational(r.exact);
  if (r.kind === 'text') return r.value;
  return r.code;
}

/** 依 Excel 數字格式四捨五入（.5 遠離 0）：0.0% 取百分點 1 位，0.00 取 2 位；回傳十進位字串 */
function excelDisplay(exact: Rational, format: string): string {
  const percent = format.endsWith('%');
  const decimals = (format.replace('%', '').split('.')[1] ?? '').length;
  const scale = 10n ** BigInt(decimals);
  let num = exact.num * (percent ? 100n : 1n) * scale;
  const neg = num < 0n;
  if (neg) num = -num;
  const q = num / exact.den;
  const r = num % exact.den;
  const rounded = 2n * r >= exact.den ? q + 1n : q;
  const whole = (rounded / scale).toString();
  const frac = decimals === 0 ? '' : `.${(rounded % scale).toString().padStart(decimals, '0')}`;
  const text = `${whole}${frac}`;
  return `${neg && rounded !== 0n ? '-' : ''}${text}${percent ? '%' : ''}`;
}

function coreExact(r: RatioResult): Rational | null {
  return r.exact === null ? null : rational(BigInt(r.exact.num), BigInt(r.exact.den));
}

const normaliseFormula = (f: string): string => f.replace(/^=/, '').replace(/\$/g, '').replace(/\s+/g, '').toUpperCase();

const allDifferences: Difference[] = [];
const summary: Record<string, Record<string, number>> = {};

describe('正式故事第 1 到 3 步對老師 Excel 逐格比對（本機）', () => {
  it('找得到 S1 到 S3', () => {
    expect(files.map((f) => f.label)).toEqual(expect.arrayContaining(['S1', 'S2', 'S3']));
  });

  for (const [label, order] of CASES) {
    const file = files.find((f) => f.label === label);
    if (file === undefined) continue;
    describe(`${label}：第 ${order} 步之後`, () => {
      const book: Workbook = readXlsx(file.path);
      const stepId = orderedSteps(story).find((s) => s.order === order)?.id;
      if (stepId === undefined) throw new Error(`正式故事沒有第 ${order} 步`);
      const st = buildStatements(run, { kind: 'cumulative', to: stepId }, ctx.layout, ctx.policy);
      const cells = coreCells(st);
      const formulas = new Map(formulaCells(book, STATEMENTS).map((c) => [c.ref, c.formula]));
      const inputs = new Map(inputCells(book, STATEMENTS).map((c) => [c.ref, c.value]));
      const differences: Difference[] = [];
      const counts: Record<string, number> = { inputs: 0, coreCells: 0, formulas: 0, indicators: 0 };
      const diff = (d: Omit<Difference, 'scenario'>): void => {
        differences.push({ scenario: label, ...d });
      };

      it('(a) 「財務報表」每個數字輸入格等於核心同 cell 的值（含 H11、L12、N26 等手動抄寫格）', () => {
        for (const [ref, value] of inputs) {
          if (typeof value !== 'number') continue;
          counts['inputs'] = (counts['inputs'] ?? 0) + 1;
          const core = cells.get(ref);
          if (core === undefined) {
            diff({ sheet: STATEMENTS, cell: ref, kind: 'unmapped_input', line: null, excel: value, core: null });
            continue;
          }
          const exported = exportValue(ref, core.value);
          if (exported !== value) diff({ sheet: STATEMENTS, cell: ref, kind: 'input', line: core.line, excel: value, core: exported });
        }
        expect(differences.filter((d) => d.kind === 'input' || d.kind === 'unmapped_input')).toEqual([]);
      });

      it('(a) 反向：核心有 cell 的每一列，在 Excel 是相同的輸入值（空白視為 0）或公式格', () => {
        for (const [ref, core] of cells) {
          if (formulas.has(ref)) continue;
          counts['coreCells'] = (counts['coreCells'] ?? 0) + 1;
          const raw = inputs.get(ref);
          if (typeof raw === 'string') {
            diff({ sheet: STATEMENTS, cell: ref, kind: 'text_at_core_cell', line: core.line, excel: raw, core: exportValue(ref, core.value) });
            continue;
          }
          const excel = raw ?? 0;
          const exported = exportValue(ref, core.value);
          if (exported !== excel) diff({ sheet: STATEMENTS, cell: ref, kind: 'input', line: core.line, excel, core: exported });
        }
        expect(differences.filter((d) => d.kind === 'input' || d.kind === 'text_at_core_cell')).toEqual([]);
      });

      it('(b) 16 個公式格的重算值等於核心同 cell 的值', () => {
        expect(formulas.size).toBe(16);
        for (const ref of formulas.keys()) {
          counts['formulas'] = (counts['formulas'] ?? 0) + 1;
          const core = cells.get(ref);
          const excel = evaluateCell(book, STATEMENTS, ref);
          if (core === undefined) {
            diff({ sheet: STATEMENTS, cell: ref, kind: 'formula', line: null, excel: describeResult(excel), core: null });
            continue;
          }
          const exported = exportValue(ref, core.value);
          if (excel.kind !== 'number' || !equals(excel.exact, rational(BigInt(exported))))
            diff({ sheet: STATEMENTS, cell: ref, kind: 'formula', line: core.line, excel: describeResult(excel), core: exported });
        }
        expect(differences.filter((d) => d.kind === 'formula')).toEqual([]);
      });

      it('(c) 23 個指標格：文字對 na；數字對核心 excel 版的精確分數，並依 Excel 格式四捨五入後比對顯示值', () => {
        const measures = measureMap(st);
        const indicatorFormulas = new Map(formulaCells(book, INDICATORS).map((c) => [c.ref, c.formula]));
        expect(indicatorFormulas.size).toBe(23);
        let seen = 0;
        for (const cv of registry.versions.values()) {
          if (cv.version !== 'excel' || cv.spec.excel === undefined) continue;
          seen += 1;
          counts['indicators'] = (counts['indicators'] ?? 0) + 1;
          const { cell, formula, format, iferror } = cv.spec.excel;
          const result = computeRatio(cv.ratioRef, measures);
          const excelFormula = indicatorFormulas.get(cell);
          const expectedFormula = `IFERROR(${formula},"${iferror}")`;
          if (excelFormula === undefined || normaliseFormula(excelFormula) !== normaliseFormula(expectedFormula))
            diff({ sheet: INDICATORS, cell, kind: 'indicator_formula', line: cv.ratioRef, excel: excelFormula ?? null, core: expectedFormula });
          const excel = evaluateCell(book, INDICATORS, cell);
          if (excel.kind === 'text') {
            // Excel 的 IFERROR 文字：分母為 0 或上游是文字，核心應判為 na
            if (result.status !== 'na') diff({ sheet: INDICATORS, cell, kind: 'indicator_status', line: cv.ratioRef, excel: excel.value, core: result.status });
            continue;
          }
          if (excel.kind !== 'number') {
            diff({ sheet: INDICATORS, cell, kind: 'indicator_status', line: cv.ratioRef, excel: excel.code, core: result.status });
            continue;
          }
          // Excel 有數值：核心可以是 ok、zero，或表 B 的 not_meaningful（DOL、DFL 在營業利益為負時仍有值）
          const exact = coreExact(result);
          if (result.status === 'na' || exact === null) {
            diff({ sheet: INDICATORS, cell, kind: 'indicator_status', line: cv.ratioRef, excel: formatRational(excel.exact), core: result.status });
            continue;
          }
          if (!equals(excel.exact, exact))
            diff({ sheet: INDICATORS, cell, kind: 'indicator_exact', line: cv.ratioRef, excel: formatRational(excel.exact), core: formatRational(exact) });
          const excelShown = excelDisplay(excel.exact, format);
          const coreShown = excelDisplay(exact, format);
          if (excelShown !== coreShown) diff({ sheet: INDICATORS, cell, kind: 'indicator_display', line: cv.ratioRef, excel: excelShown, core: coreShown });
        }
        expect(seen).toBe(23);
        expect(differences.filter((d) => d.kind.startsWith('indicator'))).toEqual([]);
      });

      it('彙總：沒有任何差異，並把結果寫到 .local-reports/excel/core-vs-excel.json', () => {
        summary[label] = { ...counts, differences: differences.length };
        allDifferences.push(...differences);
        mkdirSync(join(REPO_ROOT, '.local-reports', 'excel'), { recursive: true });
        writeFileSync(REPORT_PATH, `${JSON.stringify({ story: story.id, summary, differences: allDifferences }, null, 2)}\n`, 'utf8');
        if (differences.length > 0) console.log(`${label} 與老師 Excel 的差異：\n${JSON.stringify(differences, null, 2)}`);
        expect(differences).toEqual([]);
      });
    });
  }
});
