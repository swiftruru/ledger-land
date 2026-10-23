// oxlint-disable vitest/no-standalone-expect, vitest/valid-expect -- 不變式檢查寫成 helper；expect 的第二個引數是失敗時指出哪一步的訊息
// 三表的性質測試（04 第 11.4、18.1 節）：重播隨機合法事件序列，每一步檢查全部不變式、四個勾稽點為 0、本筆變動加總等於累計、決定性。
// 事件產生器沿用 story.property.test.ts 的 model-based 寫法（複製一份，只保留需要的部分）。自編數字。
import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';
import {
  type CoreContext,
  type LedgerState,
  type PostableStep,
  type PostedRun,
  type Statements,
  buildStatements,
  canonicalJson,
  checkStatementInvariants,
  createCoreContext,
  createLedger,
  fiveStepCheck,
  lineAccountTraces,
  measureMap,
  normalBalance,
  postStep,
  unwrap,
} from '../src/index.ts';

const ctx: CoreContext = createCoreContext();
const ifrsCtx: CoreContext = createCoreContext({ policy: 'ifrs@1' });
const altPolicy = { ...ctx.policy, id: 'teacher-overage-noi@1', switches: { ...ctx.policy.switches, inventoryOverage: 'non_operating_income' as const } };
const altCtx: CoreContext = createCoreContext({ policy: altPolicy });

type Pick = (state: LedgerState, u: number) => Record<string, number> | null;
const share = (u: number, cap: number): number => Math.floor((cap * u) / 1000);
const cash = (s: LedgerState) => normalBalance(s, 'cash');
const spendCash: Pick = (s, u) => ({ amount: share(u, cash(s)) });
const MOVES: readonly { readonly template: string; readonly pick: Pick }[] = [
  { template: 'tpl.issue_shares_cash', pick: (_s, u) => ({ amount: share(u, 1_000_000) }) },
  { template: 'tpl.buy_office_supplies_cash', pick: spendCash },
  { template: 'tpl.buy_equipment_cash', pick: spendCash },
  { template: 'tpl.pay_outsourcing_cash', pick: spendCash },
  { template: 'tpl.pay_org_costs', pick: spendCash },
  { template: 'tpl.purchase_inventory_cash', pick: spendCash },
  { template: 'tpl.sell_all_inventory_cash', pick: (s, u) => (normalBalance(s, 'inventory') > 0 ? { price: share(u, 2_000_000) } : null) },
  { template: 'tpl.borrow_short_term', pick: (_s, u) => ({ amount: share(u, 1_000_000) }) },
  { template: 'tpl.purchase_inventory_credit', pick: (_s, u) => ({ amount: share(u, 1_000_000) }) },
  { template: 'tpl.sell_all_inventory_credit', pick: (s, u) => (normalBalance(s, 'inventory') > 0 ? { price: share(u, 2_000_000) } : null) },
  { template: 'tpl.pay_all_payables', pick: (s) => (normalBalance(s, 'accounts_payable') > 0 && cash(s) >= normalBalance(s, 'accounts_payable') ? {} : null) },
  { template: 'tpl.collect_receivables', pick: (s, u) => ({ amount: share(u, normalBalance(s, 'accounts_receivable')) }) },
  { template: 'tpl.pay_directors_remuneration_cash', pick: spendCash },
  { template: 'tpl.pay_packing_freight_cash', pick: spendCash },
  {
    template: 'tpl.repay_all_short_term_loans_with_interest',
    pick: (s, u) => {
      const loan = normalBalance(s, 'short_term_borrowings');
      return loan > 0 && cash(s) >= loan ? { interest: share(u, cash(s) - loan) } : null;
    },
  },
  { template: 'tpl.inventory_count', pick: (s, u) => ({ countedAmount: share(u, 2 * Math.max(normalBalance(s, 'inventory'), 100_000)) }) },
  {
    template: 'tpl.depreciation_straight_line',
    pick: (s, u) =>
      normalBalance(s, 'machinery_equipment') - normalBalance(s, 'accumulated_depreciation_machinery') > 0 ? { usefulLifeYears: 1 + share(u, 49) } : null,
  },
  { template: 'tpl.amortise_org_costs', pick: (_s, u) => ({ years: 1 + share(u, 49) }) },
  { template: 'tpl.pay_income_tax_cash', pick: spendCash },
  { template: 'tpl.pay_dividends_cash', pick: spendCash },
];

const CROCKFORD = '0123456789abcdefghjkmnpqrstvwxyz';
function stepId(i: number): string {
  let s = '';
  let n = i;
  for (let k = 0; k < 6; k++) {
    s = CROCKFORD[n % 32] + s;
    n = Math.floor(n / 32);
  }
  return `st_${s}`;
}

const choices = fc.array(fc.tuple(fc.nat(MOVES.length - 1), fc.nat(1000)), { minLength: 0, maxLength: 24 });
/** 自訂期初：現金、存貨、應付帳款、未分配盈餘與股本，借方減貸方加總為 0 */
const openings = fc
  .tuple(fc.nat(2_000_000), fc.nat(500_000), fc.nat(300_000), fc.nat(400_000))
  .map(([extra, inv, ap, re]) => ({ cash: ap + re + extra, inventory: inv, accounts_payable: -ap, retained_earnings: -re, share_capital: -(extra + inv) }));

function generate(ctxUsed: CoreContext, list: readonly (readonly [number, number])[], opening: Readonly<Record<string, number>> = {}): PostedRun {
  let state = createLedger(ctxUsed.chart, opening);
  let n = 0;
  for (const [i, u] of list) {
    const move = MOVES[i];
    if (move === undefined) continue;
    const params = move.pick(state, u);
    if (params === null) continue;
    const step: PostableStep = { id: stepId(n++), events: [{ id: 'e1', template: move.template, params }] };
    const r = postStep(state, step, ctxUsed);
    expect(r.ok ? 'ok' : JSON.stringify(r.error), `${step.id} ${move.template} ${JSON.stringify(params)}`).toBe('ok');
    state = unwrap(r).state;
  }
  return { steps: state.steps, finalState: state };
}

function expectStatementInvariants(st: Statements, label: string): void {
  const failed = checkStatementInvariants(st).filter((r) => !r.pass);
  expect(failed, `${label} ${JSON.stringify(failed)}`).toEqual([]);
  // 追蹤：葉列的科目層與現金行帶號加總等於列值（被 only 或政策門檻歸 0 的列除外）
  for (const [id, v] of st.lines) {
    const t = lineAccountTraces(st, id);
    if (t.gated || t.kind === 'retained_earnings' || (t.accounts.length === 0 && t.kind !== 'cash_tag')) continue;
    const sum = t.accounts.reduce((a, x) => a + x.amount, 0) + t.cashSources.reduce((a, x) => a + x.signed, 0);
    expect(sum, `${label} ${id}`).toBe(v.value);
  }
}

function checkRun(ctxUsed: CoreContext, run: PostedRun, label: string): void {
  const { layout, policy } = ctxUsed;
  const total = new Map<string, number>();
  for (const step of run.steps) {
    const cumulative = buildStatements(run, { kind: 'cumulative', to: step.stepId }, layout, policy);
    expectStatementInvariants(cumulative, `${label} cumulative ${step.stepId}`);
    const five = fiveStepCheck(cumulative);
    expect(
      five.checks.map((c) => c.diff),
      `${label} five-step ${step.stepId}`,
    ).toEqual([0, 0, 0, 0]);
    expect(five.firstFailedStep).toBeNull();
    const tx = buildStatements(run, { kind: 'transaction', step: step.stepId }, layout, policy);
    expectStatementInvariants(tx, `${label} transaction ${step.stepId}`);
    for (const [id, v] of tx.lines) total.set(id, (total.get(id) ?? 0) + v.value);
    // H15 與 H17 擇一；期末存貨與 L14 在畫面上一律相同
    expect(cumulative.lines.get('cf_receivables_increase')?.value === 0 || cumulative.lines.get('cf_receivables_decrease')?.value === 0).toBe(true);
    expect(cumulative.lines.get('is_closing_inventory')?.value).toBe(cumulative.lines.get('bs_inventory')?.value);
  }
  const final = buildStatements(run, { kind: 'cumulative', to: null }, layout, policy);
  expectStatementInvariants(final, `${label} final`);
  expect(fiveStepCheck(final).firstFailedStep).toBeNull();
  // 各步本筆變動逐列加總 ＝ 累計報表減帳本起點（期初的那張報表）
  const start = buildStatements(
    { steps: [], finalState: createLedger(run.finalState.chart, run.finalState.opening) },
    { kind: 'cumulative', to: null },
    layout,
    policy,
  );
  const expected = measureMap(final);
  for (const [id, v] of start.lines) expected[id] = (expected[id] ?? 0) - v.value;
  expect(Object.fromEntries(total), `${label} sum of transactions`).toEqual(run.steps.length === 0 ? {} : expected);
  // 決定性：同一輸入跑兩次 deep equal，canonical JSON 也相同
  const again = buildStatements(run, { kind: 'cumulative', to: null }, layout, policy);
  expect(measureMap(again)).toEqual(measureMap(final));
  expect(canonicalJson(again.statements)).toBe(canonicalJson(final.statements));
}

describe('三表的性質測試', () => {
  test.prop([choices], { numRuns: 120 })('teacher@1：每一步不變式成立、四個勾稽點為 0、本筆變動加總等於累計、決定性', (list) => {
    checkRun(ctx, generate(ctx, list), 'teacher');
  });

  test.prop([choices, openings], { numRuns: 80 })('自訂期初（含應付帳款與未分配盈餘）下同樣成立；H18 減少時以反號填入並加註', (list, opening) => {
    const run = generate(ctx, list, opening);
    checkRun(ctx, run, 'opening');
    for (const step of run.steps) {
      const st = buildStatements(run, { kind: 'cumulative', to: step.stepId }, ctx.layout, ctx.policy);
      const h18 = st.lines.get('cf_payables_increase');
      expect(h18 !== undefined && h18.value < 0 === (h18.note?.key === 'template_has_no_decrease_row')).toBe(true);
    }
  });

  test.prop([choices], { numRuns: 50 })('ifrs@1 政策配教材版面：不變式與勾稽點同樣成立', (list) => {
    checkRun(ifrsCtx, generate(ifrsCtx, list), 'ifrs');
  });

  test.prop([choices], { numRuns: 50 })('盤盈改列營業外收入的政策：R15 的公式含盤盈列，仍等於營業成本發生額', (list) => {
    checkRun(altCtx, generate(altCtx, list), 'overage');
  });
});
