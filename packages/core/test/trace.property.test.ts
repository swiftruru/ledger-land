// oxlint-disable vitest/no-standalone-expect, vitest/valid-expect -- 不變式檢查寫成 helper；expect 的第二個引數是失敗時指出哪一步哪一列的訊息
// 追蹤樹的性質測試（04 第 18.1 節「追蹤」）：隨機事件序列（沿用 story.property 的 model-based 產生器）對每一步、兩種視窗、每一條線
// 跑 verifyTraceTree 全部成立；teacher@1 與 ifrs@1 都跑；同一輸入兩次 deep equal、序列化再解析相同。自編數字。
import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';
import {
  type CoreContext,
  type LedgerState,
  type PostableStep,
  type PostedRun,
  type StatementWindow,
  buildStatements,
  canonicalJson,
  createCoreContext,
  createLedger,
  normalBalance,
  postStep,
  traceAllLines,
  unwrap,
  verifyTraceTree,
} from '../src/index.ts';

const ctx: CoreContext = createCoreContext();
const ifrsCtx: CoreContext = createCoreContext({ policy: 'ifrs@1' });

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

const choices = fc.array(fc.tuple(fc.nat(MOVES.length - 1), fc.nat(1000)), { minLength: 1, maxLength: 14 });
/** 自訂期初（正常餘額，借方減貸方表示）：有時帶期初，讓 opening 欄位也被測到 */
const OPENINGS: readonly Readonly<Record<string, number>>[] = [
  {},
  { cash: 300_000, inventory: 50_000, share_capital: -350_000 },
  { cash: 80_000, short_term_borrowings: -30_000, share_capital: -50_000 },
];
const openings = fc.constantFrom(...OPENINGS);

function generate(ctxUsed: CoreContext, opening: Readonly<Record<string, number>>, list: readonly (readonly [number, number])[]): PostedRun {
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

function checkTraces(ctxUsed: CoreContext, run: PostedRun, label: string): string {
  const { layout, policy } = ctxUsed;
  const windows: StatementWindow[] = [{ kind: 'cumulative', to: null }];
  for (const step of run.steps) windows.push({ kind: 'cumulative', to: step.stepId }, { kind: 'transaction', step: step.stepId });
  const serialised: string[] = [];
  for (const win of windows) {
    const st = buildStatements(run, win, layout, policy);
    for (const node of traceAllLines(run, win, layout, policy, { statements: st })) {
      const v = verifyTraceTree(node, layout, { statements: st });
      expect(v.failures, `${label} ${JSON.stringify(win)} ${node.line}`).toEqual([]);
      serialised.push(canonicalJson(node));
    }
  }
  return serialised.join('\n');
}

describe('追蹤樹的不變式', () => {
  test.prop([openings, choices], { numRuns: 60 })(
    'teacher@1：每一步、兩種視窗、每一條線的樹都成立；同一輸入兩次結果相同',
    (opening, list) => {
      const run = generate(ctx, opening, list);
      const a = checkTraces(ctx, run, 'teacher');
      const again = generate(ctx, opening, list);
      const b = checkTraces(ctx, again, 'teacher-again');
      expect(b).toBe(a);
      expect(JSON.parse(a.split('\n')[0] ?? 'null')).toEqual(JSON.parse(b.split('\n')[0] ?? 'null'));
      // 60 次隨機序列各跑兩遍追蹤樹，覆蓋率插樁下接近 5 秒，放寬逾時避免 test:coverage 偶發逾時
    },
    20_000,
  );

  test.prop([openings, choices], { numRuns: 30 })('ifrs@1：同一組事件在 ifrs@1 下各自成立', (opening, list) => {
    const run = generate(ifrsCtx, opening, list);
    checkTraces(ifrsCtx, run, 'ifrs');
  });
});
