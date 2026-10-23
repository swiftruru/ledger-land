// oxlint-disable vitest/no-standalone-expect, vitest/valid-expect -- 不變式檢查寫成 helper 給三個性質測試共用；expect 的第二個引數是失敗時指出哪一步的訊息
// 性質測試（04 第 18.1 節）：model-based 的事件產生器，只在前置條件成立的範圍內產生參數；
// 不變式：每筆分錄借貸平衡、全部科目借方減貸方加總為 0、受限科目不為負或被擋下、T 字帳等式、決定性。自編數字。
import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';
import {
  type CoreContext,
  type LedgerState,
  type PostableStep,
  type PostedRun,
  type Story,
  type StoryStep,
  buildTAccounts,
  canonicalJson,
  cashByTag,
  createCoreContext,
  createLedger,
  inventoryTagTotals,
  normalBalance,
  postStep,
  replayStory,
  unwrap,
} from '../src/index.ts';

const ctx: CoreContext = createCoreContext();
const ifrsCtx: CoreContext = createCoreContext({ policy: 'ifrs@1' });
const { chart } = ctx;

/** 每種交易怎麼依目前帳上狀態產生「一定合法」的參數；u 是 0 到 1000 的千分比。回傳 null 表示這一步不適用 */
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

const choices = fc.array(fc.tuple(fc.nat(MOVES.length - 1), fc.nat(1000)), { minLength: 1, maxLength: 30 });

/** 依帳上狀態逐步產生事件並過帳；回傳實際採用的步驟與 run */
function generate(ctxUsed: CoreContext, list: readonly (readonly [number, number])[]): { steps: PostableStep[]; run: PostedRun } {
  let state = createLedger(ctxUsed.chart);
  const steps: PostableStep[] = [];
  for (const [i, u] of list) {
    const move = MOVES[i];
    if (move === undefined) continue;
    const params = move.pick(state, u);
    if (params === null) continue;
    const step: PostableStep = { id: stepId(steps.length), events: [{ id: 'e1', template: move.template, params }] };
    const r = postStep(state, step, ctxUsed);
    expect(r.ok ? 'ok' : JSON.stringify(r.error), `${step.id} ${move.template} ${JSON.stringify(params)}`).toBe('ok');
    state = unwrap(r).state;
    steps.push(step);
  }
  return { steps, run: { steps: state.steps, finalState: state } };
}

function toStory(steps: readonly PostableStep[]): Story {
  const text = { 'zh-TW': '測試', en: 'test' };
  const storySteps: StoryStep[] = steps.map((s, i) => ({
    id: s.id,
    order: i + 1,
    title: text,
    narrative: text,
    events: s.events.map((e) => ({ ...e })),
    termRefs: [],
  }));
  return {
    id: 'story_pr0p3r',
    rev: 1,
    revKind: 'text',
    status: 'draft',
    title: text,
    origin: 'original',
    company: { name: text },
    ledger: { currency: 'TWD', scale: 0 },
    policy: 'teacher@1',
    layout: 'teacher@1',
    steps:
      storySteps.length === 0
        ? [
            {
              id: 'st_000000',
              order: 1,
              title: text,
              narrative: text,
              events: [{ id: 'e1', template: 'tpl.borrow_short_term', params: { amount: 0 } }],
              termRefs: [],
            },
          ]
        : storySteps,
  };
}

function checkInvariants(run: PostedRun): void {
  const sumAll = (b: Readonly<Record<string, number>>) => Object.values(b).reduce((a, x) => a + x, 0);
  for (const step of run.steps) {
    for (const entry of step.entries) {
      let debit = 0;
      let credit = 0;
      for (const l of entry.lines) {
        expect(Number.isSafeInteger(l.amount) && l.amount > 0).toBe(true);
        if (l.side === 'debit') debit += l.amount;
        else credit += l.amount;
      }
      expect(debit, `${step.stepId} ${entry.eventId}`).toBe(credit);
    }
    expect(sumAll(step.balancesAfter), step.stepId).toBe(0);
    for (const account of chart.accounts) {
      const normal = (step.balancesAfter[account.id] ?? 0) * (account.normalSide === 'debit' ? 1 : -1);
      if (!account.allowNegative) expect(normal, `${step.stepId} ${account.id}`).toBeGreaterThanOrEqual(0);
      if (account.contraOf !== null) {
        const parent = chart.byId.get(account.contraOf);
        const parentNormal = (step.balancesAfter[account.contraOf] ?? 0) * (parent?.normalSide === 'debit' ? 1 : -1);
        expect(parentNormal - normal, `${step.stepId} ${account.id}`).toBeGreaterThanOrEqual(0);
      }
    }
    // T 字帳等式：期初 ＋ 借方合計 － 貸方合計（依正常方向換算）＝ 期末 ＝ balancesAfter
    for (const t of buildTAccounts(run, step.stepId)) {
      const sign = chart.byId.get(t.account)?.normalSide === 'debit' ? 1 : -1;
      const debit = t.debits.reduce((a, d) => a + d.amount, 0);
      const credit = t.credits.reduce((a, c) => a + c.amount, 0);
      expect(t.opening + sign * (debit - credit)).toBe(t.closing);
    }
    // 本筆變動（delta）加到 before 等於 after
    for (const [id, d] of Object.entries(step.delta)) expect((step.balancesBefore[id] ?? 0) + d).toBe(step.balancesAfter[id]);
    expect(step.noEffect).toBe(step.entries.every((e) => e.lines.length === 0));
  }
  const last = run.steps[run.steps.length - 1];
  if (last !== undefined) {
    expect(cashByTag(run, null, last.stepId).total).toBe(normalBalance(run.finalState, 'cash'));
    const inv = inventoryTagTotals(run, null, last.stepId);
    expect(inv.purchase + inv.count_overage - inv.cost_of_sale - inv.count_shortage).toBe(normalBalance(run.finalState, 'inventory'));
  }
}

describe('model-based 事件產生器', () => {
  test.prop([choices], { numRuns: 150 })('只在前置條件成立的範圍產生參數時，每一步都過帳成功且不變式成立；重播同一個故事得到相同結果', (list) => {
    const { steps, run } = generate(ctx, list);
    checkInvariants(run);
    const story = toStory(steps);
    const replayed = unwrap(replayStory(story, [], ctx));
    if (steps.length > 0) {
      expect(replayed.steps).toEqual(run.steps);
      expect(canonicalJson(replayed.steps)).toBe(canonicalJson(run.steps));
      expect(JSON.parse(canonicalJson(run.steps))).toEqual(JSON.parse(canonicalJson(replayed.steps)));
    }
    const again = unwrap(replayStory(story, [], ctx));
    expect(again.steps).toEqual(replayed.steps);
    expect(again.finalState.balances).toEqual(replayed.finalState.balances);
  });

  test.prop([choices], { numRuns: 60 })('ifrs@1 下同一組事件：各自滿足不變式', (list) => {
    const { run } = generate(ifrsCtx, list);
    checkInvariants(run);
  });

  test.prop([fc.array(fc.tuple(fc.nat(MOVES.length - 1), fc.nat(1_500_000)), { minLength: 1, maxLength: 20 })], { numRuns: 150 })(
    '不看帳上狀態、隨便填金額時：不是全部成功並滿足不變式，就是被擋下並指出步驟、事件與錯誤碼',
    (list) => {
      const steps: PostableStep[] = list.map(([i, amount], k) => {
        const move = MOVES[i] ?? MOVES[0];
        const template = move?.template ?? 'tpl.issue_shares_cash';
        const spec = ctx.templates.get(template)?.params[0];
        const params = spec === undefined ? {} : { [spec.name]: spec.type === 'years' ? 1 + (amount % 50) : amount };
        return { id: stepId(k), events: [{ id: 'e1', template, params }] };
      });
      const story = toStory(steps);
      const r = replayStory(story, [], ctx);
      if (r.ok) {
        checkInvariants(r.value);
        return;
      }
      expect(['balance.negative', 'precondition.failed']).toContain(r.error.code);
      expect(steps.some((s) => s.id === r.error.at.stepId)).toBe(true);
      expect(r.error.at.eventId).toBe('e1');
      expect(r.error.message.params?.['stepId']).toBe(r.error.at.stepId);
      if (r.error.code === 'balance.negative') {
        expect(typeof r.error['account']).toBe('string');
        expect(typeof r.error['balanceAfter']).toBe('number');
        expect(r.error['balanceAfter'] as number).toBeLessThan(0);
      }
    },
  );
});
