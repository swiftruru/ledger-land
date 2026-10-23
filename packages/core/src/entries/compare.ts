// 分錄比對（04 第 14 節第 1 到 4 點）：別名解析成科目 ID、攤平、合併同科目同方向、移除 0 行，再以 (accountId, side, amount) 的多重集合比對。
// 不看順序，所以一筆複合分錄與拆成多筆的結果相同。計分與回饋文字由 packages/quiz 負責（第 14 節第 5 點）。
import { resolveAccount } from '../accounts/chart.ts';
import type { Account, Chart } from '../accounts/types.ts';
import { MONEY_MAX, isMoney } from '../money.ts';
import { stableSortBy } from '../util/canonical.ts';
import type { EntryComparison, EntryLine, NormaliseEntriesOptions, NormalisedEntries } from './types.ts';

const MONEY_MAX_BIG = BigInt(MONEY_MAX);

interface MergedLine {
  readonly account: Account;
  readonly side: EntryLine['side'];
  amount: bigint;
}

function lineKey(accountId: string, side: string): string {
  return `${accountId}:${side}`;
}

/** 攤平所有分錄的行，解析科目、合併同科目同方向、移除金額為 0 的行；金額不是非負安全整數是程式錯誤 */
export function normaliseEntries(entries: readonly (readonly EntryLine[])[], chart: Chart, options: NormaliseEntriesOptions = {}): NormalisedEntries {
  const allowAliases = options.allowAliases ?? true;
  const merged = new Map<string, MergedLine>();
  const unresolved: string[] = [];
  for (const entry of entries) {
    for (const line of entry) {
      if (line.side !== 'debit' && line.side !== 'credit') throw new TypeError(`normaliseEntries：方向必須是 debit 或 credit，收到 ${String(line.side)}`);
      if (!isMoney(line.amount) || line.amount < 0) throw new TypeError(`normaliseEntries：金額必須是非負安全整數，收到 ${String(line.amount)}`);
      const account = allowAliases ? resolveAccount(chart, line.account) : chart.byId.get(line.account);
      if (account === undefined) {
        if (!unresolved.includes(line.account)) unresolved.push(line.account);
        continue;
      }
      const key = lineKey(account.id, line.side);
      const existing = merged.get(key);
      if (existing === undefined) merged.set(key, { account, side: line.side, amount: BigInt(line.amount) });
      else existing.amount += BigInt(line.amount);
    }
  }
  const lines: { readonly line: EntryLine; readonly order: number }[] = [];
  for (const m of merged.values()) {
    if (m.amount === 0n) continue;
    if (m.amount > MONEY_MAX_BIG) throw new RangeError(`normaliseEntries：${m.account.id} 的合計超過安全整數`);
    lines.push({ line: { account: m.account.id, side: m.side, amount: Number(m.amount) }, order: m.account.order });
  }
  const sorted = stableSortBy(lines, (l) => [l.order, l.line.side === 'debit' ? 0 : 1, l.line.account]).map((l) => l.line);
  return { lines: sorted, unresolved };
}

/** 作答與正解各自正規化後，以 (accountId, side, amount) 比對；同科目同方向但金額不同的行同時列在 missing 與 extra */
export function compareEntries(
  submitted: readonly (readonly EntryLine[])[],
  expected: readonly (readonly EntryLine[])[],
  chart: Chart,
  options: NormaliseEntriesOptions = {},
): EntryComparison {
  const s = normaliseEntries(submitted, chart, options);
  const e = normaliseEntries(expected, chart, options);
  const expectedByKey = new Map(e.lines.map((l) => [lineKey(l.account, l.side), l]));
  const matched = new Set<string>();
  const extra: EntryLine[] = [];
  for (const line of s.lines) {
    const key = lineKey(line.account, line.side);
    const want = expectedByKey.get(key);
    if (want !== undefined && want.amount === line.amount) matched.add(key);
    else extra.push(line);
  }
  const missing = e.lines.filter((l) => !matched.has(lineKey(l.account, l.side)));
  const unresolved = [...s.unresolved, ...e.unresolved.filter((u) => !s.unresolved.includes(u))];
  return { equal: unresolved.length === 0 && missing.length === 0 && extra.length === 0, missing, extra, unresolved };
}
