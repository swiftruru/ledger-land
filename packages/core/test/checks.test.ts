// 五步驟檢查（04 第 13 節）：核心自算四個勾稽點差額為 0；勾稽練習的學生輸入參與重算（第 13 節的範例數字）。自編數字。
import { describe, expect, it } from 'vitest';
import {
  type CoreContext,
  DEFAULT_OPEN_CELLS,
  type FiveStepResult,
  type Layout,
  RE_EXPECTED_LINE,
  type Story,
  buildStatements,
  createCoreContext,
  fiveStepCheck,
  replayStory,
  teacherLayout,
  unwrap,
} from '../src/index.ts';
import { LIME_LEAF_STEP_IDS as S, limeLeafStory } from './fixtures/story-lime-leaf.ts';

const ctx: CoreContext = createCoreContext();
const run = unwrap(replayStory(limeLeafStory, [], ctx));
const at = (to: string | null, layout: Layout = ctx.layout) => buildStatements(run, { kind: 'cumulative', to }, layout, ctx.policy);

function expectAllPass(r: FiveStepResult): void {
  expect(r.checks.map((c) => c.diff)).toEqual([0, 0, 0, 0]);
  expect(r.checks.every((c) => c.pass)).toBe(true);
  expect(r.firstFailedStep).toBeNull();
}

describe('fiveStepCheck', () => {
  it('核心自算：每一步四個勾稽點差額都是 0；步驟①是五層利益；別名 A、C、B、D 依步驟順序', () => {
    for (const step of run.steps) expectAllPass(fiveStepCheck(at(step.stepId)));
    const r = fiveStepCheck(at(null));
    expect(r.step1).toEqual({ grossProfit: 3_700_000, operatingIncome: 2_864_000, ordinaryIncome: 2_807_000, pretaxIncome: 2_807_000, netIncome: 2_247_000 });
    expect(r.checks.map((c) => [c.step, c.alias, c.left.line, c.right.line])).toEqual([
      [2, 'A', 'is_pretax_income', 'cf_pretax_income'],
      [3, 'C', 'cf_cash_end', 'bs_cash'],
      [4, 'B', RE_EXPECTED_LINE, 'bs_retained_earnings'],
      [5, 'D', 'bs_total_assets', 'bs_total_liabilities_equity'],
    ]);
    expect(r.checks.map((c) => [c.left.cell, c.right.cell])).toEqual([
      ['R33', 'H11'],
      ['H41', 'L12'],
      [null, 'N26'],
      ['L29', 'N29'],
    ]);
    expect(r.checks.every((c) => c.left.source === 'core' && c.right.source === 'core')).toBe(true);
    expect(r.checks[2]).toMatchObject({ left: { value: 2_247_000 }, right: { value: 2_247_000 } });
    expect(DEFAULT_OPEN_CELLS).toEqual(['cf_pretax_income', 'bs_cash', 'bs_retained_earnings']);
  });

  it('04 第 13 節的範例：第 7 步之後學生把 N26 誤填成營業毛利 480,000', () => {
    const r = fiveStepCheck(at(S.sellCash), { cf_pretax_income: 324_000, bs_cash: 2_214_000, bs_retained_earnings: 480_000 });
    expect(r).toEqual({
      step1: { grossProfit: 480_000, operatingIncome: 324_000, ordinaryIncome: 324_000, pretaxIncome: 324_000, netIncome: 324_000 },
      checks: [
        {
          step: 2,
          alias: 'A',
          left: { line: 'is_pretax_income', cell: 'R33', value: 324_000, source: 'core' },
          right: { line: 'cf_pretax_income', cell: 'H11', value: 324_000, source: 'learner' },
          diff: 0,
          pass: true,
        },
        {
          step: 3,
          alias: 'C',
          left: { line: 'cf_cash_end', cell: 'H41', value: 2_214_000, source: 'core' },
          right: { line: 'bs_cash', cell: 'L12', value: 2_214_000, source: 'learner' },
          diff: 0,
          pass: true,
        },
        {
          step: 4,
          alias: 'B',
          left: { line: 're_expected', cell: null, value: 324_000, source: 'core' },
          right: { line: 'bs_retained_earnings', cell: 'N26', value: 480_000, source: 'learner' },
          diff: -156_000,
          pass: false,
        },
        {
          step: 5,
          alias: 'D',
          left: { line: 'bs_total_assets', cell: 'L29', value: 2_724_000, source: 'core' },
          right: { line: 'bs_total_liabilities_equity', cell: 'N29', value: 2_880_000, source: 'core' },
          diff: -156_000,
          pass: false,
        },
      ],
      firstFailedStep: 4,
    });
  });

  it('H11 填錯：步驟②不平，而且 H20、H23、H39、H41 跟著重算使步驟③也不平；firstFailedStep 是 2', () => {
    const r = fiveStepCheck(at(S.sellCash), { cf_pretax_income: 300_000 });
    expect(r.checks[0]).toMatchObject({ step: 2, diff: 24_000, pass: false, right: { value: 300_000, source: 'learner' } });
    expect(r.checks[1]).toMatchObject({
      step: 3,
      left: { value: 2_190_000, source: 'core' },
      right: { value: 2_214_000, source: 'core' },
      diff: -24_000,
      pass: false,
    });
    expect(r.checks[2]?.pass).toBe(true);
    expect(r.checks[3]?.pass).toBe(true);
    expect(r.firstFailedStep).toBe(2);
  });

  it('進階模式：填期末存貨 R14 讓 R15、五層利益、H11、N26 都重算；re_expected 用重算後的淨利', () => {
    const r = fiveStepCheck(at(null), { is_closing_inventory: 400_000 });
    expect(r.step1).toEqual({ grossProfit: 3_680_000, operatingIncome: 2_844_000, ordinaryIncome: 2_787_000, pretaxIncome: 2_787_000, netIncome: 2_227_000 });
    // H11 連到重算後的稅前淨利，H20 到 H41 跟著少 20,000，但 L12 是核心值，所以步驟③先不平；N26 用重算後的淨利，步驟④平；L29 用 L14 的核心值，步驟⑤差 20,000
    expect(r.checks[1]).toMatchObject({ left: { value: 2_117_000, source: 'core' }, right: { value: 2_137_000, source: 'core' }, diff: -20_000, pass: false });
    expect(r.checks[2]).toMatchObject({ left: { value: 2_227_000 }, right: { value: 2_227_000 }, pass: true });
    expect(r.checks[3]).toMatchObject({ left: { value: 4_647_000 }, right: { value: 4_627_000 }, diff: 20_000, pass: false });
    expect(r.firstFailedStep).toBe(3);
    // undefined 的輸入視同沒填
    expectAllPass(fiveStepCheck(at(null), { bs_cash: undefined }));
  });

  it('股利與提列公積取自 tag 為 dividend、reserve_appropriation 的分錄行（W05）', () => {
    const story: Story = {
      ...limeLeafStory,
      id: 'story_d1v1d3',
      opening: { cash: 900_000, retained_earnings: -400_000, share_capital: -500_000 },
      steps: [
        {
          id: 'st_0div00',
          order: 1,
          title: { 'zh-TW': '發股利', en: 'Dividend' },
          narrative: { 'zh-TW': '發放現金股利。', en: 'A cash dividend is paid.' },
          events: [{ id: 'e1', template: 'tpl.pay_dividends_cash', params: { amount: 120_000 } }],
          termRefs: [],
        },
      ],
    };
    const r = unwrap(replayStory(story, [], ctx));
    const result = fiveStepCheck(buildStatements(r, { kind: 'cumulative', to: null }, ctx.layout, ctx.policy));
    expectAllPass(result);
    expect(result.checks[2]).toMatchObject({ left: { value: 280_000 }, right: { value: 280_000 } });
  });

  it('版面不顯示經常利益時 ordinaryIncome 為 null；本筆變動視窗不能做五步驟檢查', () => {
    const layout: Layout = { ...teacherLayout, options: { ...teacherLayout.options, showOrdinaryIncome: false } };
    expect(fiveStepCheck(at(null, layout)).step1.ordinaryIncome).toBeNull();
    expect(() => fiveStepCheck(buildStatements(run, { kind: 'transaction', step: S.sellCash }, ctx.layout, ctx.policy))).toThrow(RangeError);
  });

  it('版面缺少勾稽點的列是程式錯誤', () => {
    type StatementKey = keyof Layout['statements'];
    const mutate = (
      statement: StatementKey,
      id: string,
      patch: (l: Layout['statements'][StatementKey][number]) => Layout['statements'][StatementKey][number],
    ): Layout => ({
      ...teacherLayout,
      statements: { ...teacherLayout.statements, [statement]: teacherLayout.statements[statement].map((l) => (l.id === id ? patch(l) : l)) },
    });
    const dropCheck = (l: Layout['statements'][StatementKey][number]) => {
      const { check: _check, ...rest } = l as { check?: string };
      return rest as Layout['statements'][StatementKey][number];
    };
    expect(() => fiveStepCheck(at(null, mutate('cash_flow_indirect', 'cf_pretax_income', dropCheck)))).toThrow(/step2/);
    expect(() => fiveStepCheck(at(null, mutate('cash_flow_indirect', 'cf_cash_end', dropCheck)))).toThrow(/step3/);
    expect(() =>
      fiveStepCheck(
        at(
          null,
          mutate('balance_sheet', 'bs_cash', (l) => ({ ...l, kind: 'accounts', accounts: ['cash', 'accounts_receivable'], measure: 'balance' })),
        ),
      ),
    ).toThrow(/餘額列/);
    expect(() =>
      fiveStepCheck(
        at(
          null,
          mutate('balance_sheet', 'bs_retained_earnings', (l) => ({ ...l, kind: 'accounts', accounts: ['retained_earnings'], measure: 'balance' })),
        ),
      ),
    ).toThrow(/retained_earnings/);
    expect(() =>
      fiveStepCheck(
        at(
          null,
          mutate('balance_sheet', 'bs_total_liabilities_equity', (l) => ({ ...l, kind: 'total', sum: [], invariant: undefined })),
        ),
      ),
    ).toThrow(/equals_line/);
    expect(() =>
      fiveStepCheck(
        at(
          null,
          mutate('income_statement', 'is_gross_profit', (l) => ({ ...l, kind: 'formula', expr: '0', level: undefined })),
        ),
      ),
    ).toThrow(/第 1 層/);
  });
});
