// oxlint-disable vitest/valid-expect -- expect 的第二個引數是失敗時指出哪一步、哪一列的訊息
// 黃金測試（04 第 18.2 節）：青檸文具社 18 步（自編數字，teacher@1）每一步之後的累計三表、23 項 excel 版指標與五步驟檢查。
// 期望值在 golden/lime-leaf.teacher@1.json，由獨立的計算表（只用加減法逐步累計）算出，不是核心的 snapshot；第 18 步另與 04 第 17 節的表逐項核對。
// 另含表 B 的幾個狀態情境：毛利為 0、營業利益為負的 DOL；流動負債為 0 的流動比率；有股利的現金再投資比率與步驟④；盤損。
import { describe, expect, it } from 'vitest';
import { fiveStepCheck } from '../src/checks/index.ts';
import type { CoreContext } from '../src/ledger/index.ts';
import { type RatioResult, type RatioStatus, computeAllRatios, computeRatio } from '../src/ratios/index.ts';
import { unwrap } from '../src/result.ts';
import { type Statements, buildStatements, lineValue, measureMap } from '../src/statements/index.ts';
import { type Story, type StoryStep, createCoreContext, orderedSteps, replayStory } from '../src/story/index.ts';
import { LIME_LEAF_STEP_IDS as S, limeLeafStory } from './fixtures/story-lime-leaf.ts';
import golden from './golden/lime-leaf.teacher@1.json' with { type: 'json' };

interface GoldenStep {
  readonly stepId: string;
  readonly order: number;
  readonly lines: Readonly<Record<string, number>>;
  readonly ratios: Readonly<Record<string, { readonly status: RatioStatus; readonly displayValue: number | null }>>;
  readonly fiveStep: {
    readonly step1: { grossProfit: number; operatingIncome: number; ordinaryIncome: number; pretaxIncome: number; netIncome: number };
    readonly checks: readonly { step: number; left: number; right: number; diff: number }[];
  };
}

const ctx: CoreContext = createCoreContext();
const run = unwrap(replayStory(limeLeafStory, [], ctx));
const steps = golden.steps as readonly GoldenStep[];
const cumulativeTo = (to: string, r = run): Statements => buildStatements(r, { kind: 'cumulative', to }, ctx.layout, ctx.policy);

/** 23 項 excel 版指標，只取 status 與 displayValue，鍵是指標 ID */
function excelRatios(st: Statements): Record<string, { status: RatioStatus; displayValue: number | null }> {
  const out: Record<string, { status: RatioStatus; displayValue: number | null }> = {};
  for (const r of computeAllRatios(measureMap(st), {}, ['excel'])) out[r.ratioRef.replace(/@excel$/, '')] = { status: r.status, displayValue: r.displayValue };
  return out;
}

describe('黃金資料的形狀', () => {
  it('對應青檸文具社的 18 步、teacher@1 政策與版面，步驟順序與故事一致', () => {
    expect(golden.story).toBe(limeLeafStory.id);
    expect(golden.policy).toBe(ctx.policy.id);
    expect(golden.layout).toBe(ctx.layout.id);
    expect(steps.map((s) => s.stepId)).toEqual(orderedSteps(limeLeafStory).map((s) => s.id));
    expect(steps.map((s) => s.order)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });

  it('每一步都有 23 項指標與四個勾稽點，勾稽點的 diff 全為 0', () => {
    for (const s of steps) {
      expect(Object.keys(s.ratios), `第 ${s.order} 步`).toHaveLength(23);
      expect(
        s.fiveStep.checks.map((c) => c.step),
        `第 ${s.order} 步`,
      ).toEqual([2, 3, 4, 5]);
      for (const c of s.fiveStep.checks) {
        expect(c.left - c.right, `第 ${s.order} 步的步驟 ${c.step}`).toBe(0);
        expect(c.diff, `第 ${s.order} 步的步驟 ${c.step}`).toBe(0);
      }
    }
  });

  it('第 18 步與 04 第 17 節的表一致', () => {
    const last = steps[steps.length - 1];
    expect(last).toBeDefined();
    const L = (last as GoldenStep).lines;
    expect(L).toMatchObject({
      is_revenue: 6720000,
      is_cogs: 3020000,
      is_gross_profit: 3700000,
      is_sga_total: 836000,
      is_operating_income: 2864000,
      is_non_operating_expense_total: 57000,
      is_ordinary_income: 2807000,
      is_pretax_income: 2807000,
      is_income_tax_expense: 560000,
      is_net_income: 2247000,
      cf_operating_subtotal: 834000,
      cf_operating_total: 247000,
      cf_investing_total: -510000,
      cf_financing_total: 2400000,
      cf_cash_end: 2137000,
      bs_cash: 2137000,
      bs_accounts_receivable: 1700000,
      bs_inventory: 420000,
      bs_machinery_net: 270000,
      bs_deferred_org_costs: 120000,
      bs_total_assets: 4647000,
      bs_share_capital: 2400000,
      bs_retained_earnings: 2247000,
      bs_total_liabilities_equity: 4647000,
      dc_cash_generated_from_operations: 834000,
      dc_operating_total: 247000,
    });
  });
});

describe('青檸文具社每一步的累計三表、指標與五步驟檢查等於黃金資料', () => {
  for (const g of steps) {
    describe(`第 ${g.order} 步 ${g.stepId}`, () => {
      const st = cumulativeTo(g.stepId);

      it('三表每一列（含 hidden 與分組列）', () => {
        expect(measureMap(st)).toEqual(g.lines);
      });

      it('23 項 excel 版指標的狀態與顯示值', () => {
        expect(excelRatios(st)).toEqual(g.ratios);
      });

      it('五層利益與四個勾稽點', () => {
        const r = fiveStepCheck(st);
        expect(r.step1).toEqual(g.fiveStep.step1);
        expect(r.firstFailedStep).toBeNull();
        expect(r.checks.map((c) => ({ step: c.step, left: c.left.value, right: c.right.value, diff: c.diff }))).toEqual(g.fiveStep.checks);
        expect(r.checks.every((c) => c.pass)).toBe(true);
      });
    });
  }
});

describe('表 B 的狀態情境', () => {
  it('第 2 步之後毛利為 0、營業利益為負：DOL 是 not_meaningful，仍帶 Excel 值 0 並說明基數為負；DFL 同樣 not_meaningful 且值為 1', () => {
    const m = measureMap(cumulativeTo(S.officeSupplies));
    expect(m['is_gross_profit']).toBe(0);
    expect(m['is_operating_income']).toBeLessThan(0);
    const dol = computeRatio('dol@excel', m);
    expect(dol.status).toBe('not_meaningful');
    expect(dol.displayValue).toBe(0);
    expect(dol.exact).toEqual({ num: '0', den: '1' });
    expect(dol.reason?.key).toBe('ratio.reason.negative_base');
    const dfl = computeRatio('dfl@excel', m);
    expect(dfl.status).toBe('not_meaningful');
    expect(dfl.displayValue).toBe(1);
  });

  it('流動負債為 0 時流動比率與速動比率是 na（第 1 到 7 步、還款後的第 15 到 18 步），借款期間算得出數值', () => {
    const statusAt = (step: string, ref: string): RatioResult => computeRatio(ref, measureMap(cumulativeTo(step)));
    for (const step of [S.issueShares, S.sellCash, S.repay, S.incomeTax]) {
      for (const ref of ['current_ratio@excel', 'quick_ratio@excel']) {
        const r = statusAt(step, ref);
        expect(r.status, `${step} ${ref}`).toBe('na');
        expect(r.displayValue, `${step} ${ref}`).toBeNull();
        expect(r.reason?.key, `${step} ${ref}`).toBe('ratio.reason.denominator_zero');
      }
    }
    // 第 8 步：流動資產 3,114,000 ÷ 流動負債 900,000 ＝ 3.46
    expect(statusAt(S.borrow, 'current_ratio@excel')).toMatchObject({ status: 'ok', displayValue: 3.46 });
    // 第 9 步：速動資產 3,114,000 ÷ (2,800,000 ＋ 900,000) ＝ 0.84；流動比率 (3,114,000 ＋ 2,800,000) ÷ 3,700,000 ＝ 1.60
    expect(statusAt(S.purchaseCredit, 'quick_ratio@excel')).toMatchObject({ status: 'ok', displayValue: 0.84 });
    expect(statusAt(S.purchaseCredit, 'current_ratio@excel')).toMatchObject({ status: 'ok', displayValue: 1.6 });
  });

  it('有股利的情境：第 18 步後發放現金股利 100,000，現金再投資比率的分子是 H23 減股利、H35 為負、步驟④的左邊扣掉股利', () => {
    const dividendStep: StoryStep = {
      id: 'st_dv1d3nd',
      order: 19,
      title: { 'zh-TW': '發放現金股利', en: 'Paying a cash dividend' },
      narrative: { 'zh-TW': '年度結束後發放股利。', en: 'A dividend is paid after year end.' },
      events: [{ id: 'e1', template: 'tpl.pay_dividends_cash', params: { amount: 100000 } }],
      termRefs: [],
    };
    const story: Story = { ...limeLeafStory, steps: [...limeLeafStory.steps, dividendStep] };
    const r = unwrap(replayStory(story, [], ctx));
    const st = cumulativeTo(dividendStep.id, r);
    const m = measureMap(st);
    // 現金 2,137,000 － 100,000；H35 ＝ －100,000；H36 ＝ 2,400,000 － 100,000；H23 不變
    expect(m).toMatchObject({
      bs_cash: 2037000,
      cf_dividends_paid: -100000,
      cf_financing_total: 2300000,
      cf_operating_total: 247000,
      cf_cash_end: 2037000,
      is_net_income: 2247000,
      bs_retained_earnings: 2147000,
      bs_total_assets: 4547000,
      bs_total_liabilities_equity: 4547000,
      bs_current_liabilities: 0,
    });
    // 分子 247,000 － 100,000 ＝ 147,000；分母 4,547,000 － 0；D17 的 H23－H35 會把股利加回（T25），網站不重現
    const ratio = computeRatio('cash_reinvestment@excel', m);
    expect(ratio.status).toBe('ok');
    expect(ratio.exact).toEqual({ num: '147', den: '4547' });
    expect(ratio.displayValue).toBe(3.23);
    expect(ratio.inputs).toMatchObject({ 'line.cf_operating_total': 247000, 'line.cf_dividends_paid': -100000 });
    // 現金流量允當比率的分母含股利正值：510,000 ＋ 420,000 ＋ 100,000 ＝ 1,030,000
    expect(computeRatio('cash_flow_adequacy@excel', m).exact).toEqual({ num: '247', den: '1030' });
    // 步驟④：0 ＋ 2,247,000 － 100,000 ＝ 2,147,000 ＝ N26
    const five = fiveStepCheck(st);
    const step4 = five.checks.find((c) => c.step === 4);
    expect(step4).toMatchObject({
      left: { line: 're_expected', value: 2147000 },
      right: { line: 'bs_retained_earnings', value: 2147000 },
      diff: 0,
      pass: true,
    });
    expect(five.firstFailedStep).toBeNull();
  });

  it('盤損的情境：第 9 步後盤點 2,500,000（帳上 2,800,000）：營業成本加 300,000、存貨減 300,000、稅前淨利減 300,000，現金不變', () => {
    const countStep: StoryStep = {
      id: 'st_sh0rt4g',
      order: 10,
      title: { 'zh-TW': '盤點發現短少', en: 'A stocktake finds a shortage' },
      narrative: { 'zh-TW': '盤點後存貨比帳上少。', en: 'The count comes in below the books.' },
      events: [{ id: 'e1', template: 'tpl.inventory_count', params: { countedAmount: 2500000 } }],
      termRefs: [],
    };
    const upToPurchase = orderedSteps(limeLeafStory).filter((s) => s.order <= 9);
    const story: Story = { ...limeLeafStory, steps: [...upToPurchase, countStep] };
    const r = unwrap(replayStory(story, [], ctx));
    const before = cumulativeTo(S.purchaseCredit, r);
    const after = cumulativeTo(countStep.id, r);
    const posted = r.steps[r.steps.length - 1];
    expect(posted?.derivedValues).toMatchObject({ 'e1.shortage': 300000, 'e1.overage': 0 });
    const diff = (id: string): number => lineValue(after, id).value - lineValue(before, id).value;
    expect(diff('is_cogs')).toBe(300000);
    expect(diff('bs_inventory')).toBe(-300000);
    expect(diff('is_closing_inventory')).toBe(-300000);
    expect(diff('is_purchases')).toBe(0);
    expect(diff('is_pretax_income')).toBe(-300000);
    expect(diff('bs_cash')).toBe(0);
    expect(diff('cf_inventory_increase')).toBe(300000);
    expect(diff('cf_operating_total')).toBe(0);
    expect(measureMap(after)).toMatchObject({ is_cogs: 940000, bs_inventory: 2500000, is_gross_profit: 180000, is_pretax_income: 24000, bs_cash: 3114000 });
    expect(fiveStepCheck(after).firstFailedStep).toBeNull();
    // 存貨週轉率 940,000 ÷ 2,500,000 ＝ 0.376 → 0.38
    expect(computeRatio('inventory_turnover@excel', measureMap(after))).toMatchObject({ status: 'ok', displayValue: 0.38 });
  });
});
