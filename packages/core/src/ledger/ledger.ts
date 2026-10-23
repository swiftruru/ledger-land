// 帳本狀態與餘額規則（04 第 6.3、6.4 節）：建立帳本、讀餘額、套用分錄並檢查過帳後的餘額。
import { normalSign } from '../accounts/chart.ts';
import type { Chart } from '../accounts/types.ts';
import type { JournalEntry } from '../journal/types.ts';
import { type Money, isMoney } from '../money.ts';
import { type CoreError, type Result, coreError, err, ok } from '../result.ts';
import type { Balances, LedgerState } from './types.ts';

/** 建立帳本：科目表每個科目的餘額都設為 0 再套上期初；期初引用不存在的科目或不是安全整數是程式錯誤 */
export function createLedger(chart: Chart, opening: Balances = {}): LedgerState {
  const balances: Record<string, Money> = {};
  const costs: Record<string, Money> = {};
  for (const a of chart.accounts) {
    balances[a.id] = 0;
    costs[a.id] = 0;
  }
  for (const [id, value] of Object.entries(opening)) {
    if (!chart.byId.has(id)) throw new TypeError(`createLedger：期初引用不存在的科目 ${id}`);
    if (!isMoney(value)) throw new TypeError(`createLedger：期初 ${id} 不是安全整數`);
    balances[id] = value;
    // 期初的借方餘額視為已取得的成本
    costs[id] = value > 0 ? value : 0;
  }
  return { chart, opening: { ...opening }, balances, costs, steps: [] };
}

/** 借方減貸方 */
export const balanceOf = (state: LedgerState, accountId: string): Money => state.balances[accountId] ?? 0;

/** 正常餘額表示：借方科目乘 1、貸方科目乘 -1；科目不存在是程式錯誤 */
export function normalBalance(state: LedgerState, accountId: string): Money {
  return normalBalanceOf(state.chart, state.balances, accountId);
}

export function normalBalanceOf(chart: Chart, balances: Balances, accountId: string): Money {
  const account = chart.byId.get(accountId);
  if (account === undefined) throw new TypeError(`normalBalance：科目不存在 ${accountId}`);
  return noNegativeZero((balances[accountId] ?? 0) * normalSign(account));
}

/** 乘上 -1 會把 0 變成 -0；餘額一律用 +0，序列化與比對才一致 */
export const noNegativeZero = (n: Money): Money => (n === 0 ? 0 : n);

/** 累計借方合計（取得成本） */
export const costOf = (state: LedgerState, accountId: string): Money => state.costs[accountId] ?? 0;

/**
 * 04 第 6.3 節的餘額規則，只檢查 touched 列出的科目與它們的抵銷關係：
 * allowNegative 為 false 的科目正常餘額不得小於 0（資產、負債、股本與公積；未分配盈餘與損益科目在資料裡是 true）；
 * 抵銷科目的正常餘額不得超過被抵銷科目（機器設備淨額不得為負、累計折舊不超過成本）。
 */
export function checkBalanceRules(chart: Chart, balances: Balances, touched: Iterable<string>): CoreError | undefined {
  const seen = new Set<string>();
  for (const id of touched) {
    const account = chart.byId.get(id);
    if (account === undefined || seen.has(id)) continue;
    seen.add(id);
    const normal = normalBalanceOf(chart, balances, id);
    if (!account.allowNegative && normal < 0)
      return coreError('balance.negative', { account: id, balanceAfter: normal }, { account: id, balanceAfter: normal, rule: 'non_negative' });
  }
  // 抵銷關係：被抵銷科目或抵銷科目任一被動到都要檢查淨額
  for (const id of seen) {
    const account = chart.byId.get(id);
    if (account === undefined) continue;
    const pairs: { readonly parentId: string; readonly contraId: string }[] =
      account.contraOf !== null
        ? [{ parentId: account.contraOf, contraId: id }]
        : chart.accounts.filter((a) => a.contraOf === id).map((a) => ({ parentId: id, contraId: a.id }));
    for (const { parentId, contraId } of pairs) {
      const net = normalBalanceOf(chart, balances, parentId) - normalBalanceOf(chart, balances, contraId);
      if (net < 0)
        return coreError(
          'balance.negative',
          { account: parentId, balanceAfter: net },
          { account: parentId, balanceAfter: net, rule: 'net_of_contra', contra: contraId },
        );
    }
  }
  return undefined;
}

/** 套用一筆已驗證的分錄並檢查餘額規則；回傳新的狀態（balances 只複製一次）與這筆分錄的變動量（借方減貸方） */
export function applyEntry(state: LedgerState, entry: JournalEntry): Result<{ readonly state: LedgerState; readonly delta: Balances }, CoreError> {
  if (entry.lines.length === 0) return ok({ state, delta: {} });
  const delta: Record<string, Money> = {};
  const costDelta: Record<string, Money> = {};
  for (const l of entry.lines) {
    const signed = l.side === 'debit' ? l.amount : -l.amount;
    delta[l.account] = (delta[l.account] ?? 0) + signed;
    if (l.side === 'debit') costDelta[l.account] = (costDelta[l.account] ?? 0) + l.amount;
  }
  const balances: Record<string, Money> = { ...state.balances };
  for (const [id, d] of Object.entries(delta)) {
    const next = (balances[id] ?? 0) + d;
    if (!isMoney(next)) return err(coreError('money.overflow', { account: id, op: 'post' }));
    balances[id] = next;
  }
  const ruleError = checkBalanceRules(state.chart, balances, Object.keys(delta));
  if (ruleError !== undefined) return err(ruleError);
  const costs: Record<string, Money> = { ...state.costs };
  for (const [id, d] of Object.entries(costDelta)) costs[id] = (costs[id] ?? 0) + d;
  return ok({ state: { ...state, balances, costs }, delta });
}
