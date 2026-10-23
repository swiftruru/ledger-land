// 視窗內的推導值（04 第 5.2、11 節），給三表與追蹤模組使用：發生額、各標籤的現金行合計、存貨標籤合計。
// 視窗以步驟 ID 表示；本檔不叫 window.ts，避免與 DOM 全域物件的名稱檢查衝突。
// 視窗以步驟 ID 表示：from 為 null 表示從帳本起點，to 為視窗的最後一步（含）。
import { normalSign } from '../accounts/chart.ts';
import type { CashFlowActivity } from '../accounts/types.ts';
import { CASH_FLOW_KINDS, type CashFlowKind, type InventoryTag } from '../data/types.ts';
import { isInventoryAccount, isInventoryTag } from '../journal/validate.ts';
import type { JournalLine } from '../journal/types.ts';
import type { Money } from '../money.ts';
import { noNegativeZero, normalBalanceOf } from './ledger.ts';
import { stepIndexOf } from './taccounts.ts';
import type { PostedRun, PostedStep } from './types.ts';

/** 視窗內的步驟（含 from 與 to）；from 為 null 表示從第一步 */
export function stepsInWindow(run: PostedRun, from: string | null, to: string): readonly PostedStep[] {
  const end = stepIndexOf(run, to);
  const start = from === null ? 0 : stepIndexOf(run, from);
  if (start > end) throw new RangeError(`視窗的起點 ${from ?? ''} 在終點 ${to} 之後`);
  return run.steps.slice(start, end + 1);
}

function* linesInWindow(run: PostedRun, from: string | null, to: string): Generator<{ readonly step: PostedStep; readonly line: JournalLine }> {
  for (const step of stepsInWindow(run, from, to)) for (const entry of step.entries) for (const line of entry.lines) yield { step, line };
}

/** 科目在視窗內的借方與貸方合計 */
export function debitCreditTotals(run: PostedRun, from: string | null, to: string, accountId: string): { readonly debit: Money; readonly credit: Money } {
  let debit = 0;
  let credit = 0;
  for (const { line } of linesInWindow(run, from, to)) {
    if (line.account !== accountId) continue;
    if (line.side === 'debit') debit += line.amount;
    else credit += line.amount;
  }
  return { debit, credit };
}

/** 科目在視窗內的發生額（期末減期初），正常餘額表示；損益科目就是本期金額 */
export function activityOf(run: PostedRun, from: string | null, to: string, accountId: string): Money {
  const account = run.finalState.chart.byId.get(accountId);
  if (account === undefined) throw new TypeError(`activityOf：科目不存在 ${accountId}`);
  const { debit, credit } = debitCreditTotals(run, from, to, accountId);
  return noNegativeZero((debit - credit) * normalSign(account));
}

/** 視窗起點之前的餘額（from 那一步的 balancesBefore；from 為 null 時是期初），正常餘額表示 */
export function balanceAtWindowStart(run: PostedRun, from: string | null, accountId: string): Money {
  const { chart, opening } = run.finalState;
  if (from === null) return normalBalanceOf(chart, opening, accountId);
  const step = run.steps[stepIndexOf(run, from)];
  if (step === undefined) throw new RangeError(`run 裡沒有步驟 ${from}`);
  return normalBalanceOf(chart, step.balancesBefore, accountId);
}

/** 某一步之後的餘額，正常餘額表示 */
export function balanceAfterStep(run: PostedRun, stepId: string, accountId: string): Money {
  const step = run.steps[stepIndexOf(run, stepId)];
  if (step === undefined) throw new RangeError(`run 裡沒有步驟 ${stepId}`);
  return normalBalanceOf(run.finalState.chart, step.balancesAfter, accountId);
}

export interface CashByTag {
  /** 每個 kind 的帶號合計：流入為正、流出為負 */
  readonly byKind: Readonly<Record<CashFlowKind, Money>>;
  readonly byActivity: Readonly<Record<CashFlowActivity, Money>>;
  /** 全部現金行的帶號合計，等於現金科目在視窗內的發生額 */
  readonly total: Money;
}

/** 視窗內各現金流量標籤的現金行合計（04 第 11 節的 cash_tag 列） */
export function cashByTag(run: PostedRun, from: string | null, to: string): CashByTag {
  const byKind: Record<string, Money> = {};
  const byActivity: Record<CashFlowActivity, Money> = { operating: 0, investing: 0, financing: 0 };
  for (const activity of Object.keys(CASH_FLOW_KINDS) as CashFlowActivity[]) for (const kind of CASH_FLOW_KINDS[activity]) byKind[kind] = 0;
  let total = 0;
  for (const { line } of linesInWindow(run, from, to)) {
    if (line.cf === undefined) continue;
    const signed = line.side === 'debit' ? line.amount : -line.amount;
    byKind[line.cf.kind] = (byKind[line.cf.kind] ?? 0) + signed;
    byActivity[line.cf.activity] += signed;
    total += signed;
  }
  return { byKind: byKind as Record<CashFlowKind, Money>, byActivity, total };
}

/** 視窗內存貨行各標籤的合計（非負）：purchase 是 R13 本期進貨，count_overage 是盤盈列 */
export function inventoryTagTotals(run: PostedRun, from: string | null, to: string): Readonly<Record<InventoryTag, Money>> {
  const totals: Record<InventoryTag, Money> = { purchase: 0, cost_of_sale: 0, count_overage: 0, count_shortage: 0 };
  const chart = run.finalState.chart;
  for (const { line } of linesInWindow(run, from, to)) {
    const account = chart.byId.get(line.account);
    if (account === undefined || !isInventoryAccount(account) || !isInventoryTag(line.tag)) continue;
    totals[line.tag] += line.amount;
  }
  return totals;
}
