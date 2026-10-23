// 累計視窗的量測值（04 第 5.2、11 節）：從帳本起點到某一步的餘額、發生額、現金行標籤合計、存貨標籤合計與未分配盈餘的借方標籤合計。
// toStep 為 null 表示「帳本起點」（run 沒有步驟，或本筆變動要減去第一步之前的狀態）：餘額是期初、發生額與各合計都是 0。
import type { CashFlowActivity } from '../accounts/types.ts';
import { CASH_FLOW_KINDS, type CashFlowKind, type InventoryTag } from '../data/types.ts';
import { type CashByTag, activityOf, balanceAfterStep, balanceAtWindowStart, cashByTag, inventoryTagTotals } from '../ledger/activity.ts';
import type { PostedRun } from '../ledger/types.ts';
import type { Money } from '../money.ts';

export type EquityTag = 'dividend' | 'reserve_appropriation';

export interface CumulativeMeasures {
  readonly run: PostedRun;
  readonly toStep: string | null;
  /** 帳本起點的餘額（期初），正常餘額表示 */
  balanceStart(accountId: string): Money;
  /** toStep 之後的餘額，正常餘額表示 */
  balanceEnd(accountId: string): Money;
  /** 帳本起點到 toStep 的發生額，正常餘額表示 */
  activity(accountId: string): Money;
  readonly cash: CashByTag;
  readonly inventory: Readonly<Record<InventoryTag, Money>>;
  /** 借記未分配盈餘時標 dividend、reserve_appropriation 的合計（W05） */
  readonly equityTags: Readonly<Record<EquityTag, Money>>;
}

function zeroCash(): CashByTag {
  const byKind: Record<string, Money> = {};
  for (const activity of Object.keys(CASH_FLOW_KINDS) as CashFlowActivity[]) for (const kind of CASH_FLOW_KINDS[activity]) byKind[kind] = 0;
  return { byKind: byKind as Record<CashFlowKind, Money>, byActivity: { operating: 0, investing: 0, financing: 0 }, total: 0 };
}

function equityTagTotals(run: PostedRun, toStep: string | null): Record<EquityTag, Money> {
  const totals: Record<EquityTag, Money> = { dividend: 0, reserve_appropriation: 0 };
  if (toStep === null) return totals;
  for (const step of run.steps) {
    for (const entry of step.entries)
      for (const line of entry.lines) {
        if (line.side !== 'debit') continue;
        if (line.tag === 'dividend' || line.tag === 'reserve_appropriation') totals[line.tag] += line.amount;
      }
    if (step.stepId === toStep) break;
  }
  return totals;
}

/** 累計視窗的量測值；餘額與發生額以 Map 記住，同一個科目只算一次 */
export function measuresAt(run: PostedRun, toStep: string | null): CumulativeMeasures {
  const { chart } = run.finalState;
  const ends = new Map<string, Money>();
  const acts = new Map<string, Money>();
  const memo = (map: Map<string, Money>, id: string, f: () => Money): Money => {
    const hit = map.get(id);
    if (hit !== undefined) return hit;
    if (!chart.byId.has(id)) throw new TypeError(`measuresAt：科目不存在 ${id}`);
    const v = f();
    map.set(id, v);
    return v;
  };
  return {
    run,
    toStep,
    balanceStart: (id) => balanceAtWindowStart(run, null, id),
    balanceEnd: (id) => memo(ends, id, () => (toStep === null ? balanceAtWindowStart(run, null, id) : balanceAfterStep(run, toStep, id))),
    activity: (id) => memo(acts, id, () => (toStep === null ? 0 : activityOf(run, null, toStep, id))),
    cash: toStep === null ? zeroCash() : cashByTag(run, null, toStep),
    inventory: toStep === null ? { purchase: 0, cost_of_sale: 0, count_overage: 0, count_shortage: 0 } : inventoryTagTotals(run, null, toStep),
    equityTags: equityTagTotals(run, toStep),
  };
}

/** 視窗終點的步驟 ID：cumulative 的 to（null 表示最後一步；沒有步驟時為 null） */
export function lastStepId(run: PostedRun): string | null {
  const last = run.steps[run.steps.length - 1];
  return last === undefined ? null : last.stepId;
}

/** 某一步的前一步 ID；第一步的前一步是帳本起點（null） */
export function previousStepId(run: PostedRun, stepId: string): string | null {
  const i = run.steps.findIndex((s) => s.stepId === stepId);
  if (i < 0) throw new RangeError(`run 裡沒有步驟 ${stepId}`);
  return i === 0 ? null : (run.steps[i - 1]?.stepId ?? null);
}
