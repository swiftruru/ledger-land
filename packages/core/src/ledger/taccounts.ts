// T 字帳（04 第 6.5 節末）：由同一組分錄行推導，預設只回傳 upToStep 那一步有變動的科目。
import { normalSign } from '../accounts/chart.ts';
import type { Money } from '../money.ts';
import { stableSortBy } from '../util/canonical.ts';
import { noNegativeZero, normalBalanceOf } from './ledger.ts';
import type { PostedRun, TAccount, TAccountLine } from './types.ts';

/** 找步驟在 run 裡的索引；找不到是程式錯誤 */
export function stepIndexOf(run: PostedRun, stepId: string): number {
  const i = run.steps.findIndex((s) => s.stepId === stepId);
  if (i < 0) throw new RangeError(`run 裡沒有步驟 ${stepId}`);
  return i;
}

export function buildTAccounts(run: PostedRun, upToStep: string, accounts?: readonly string[]): TAccount[] {
  const { chart, opening } = run.finalState;
  const upTo = stepIndexOf(run, upToStep);
  const step = run.steps[upTo];
  if (step === undefined) throw new RangeError(`run 裡沒有步驟 ${upToStep}`);
  const wanted = accounts === undefined ? [...new Set(step.entries.flatMap((e) => e.lines.map((l) => l.account)))] : [...new Set(accounts)];
  for (const id of wanted) if (!chart.byId.has(id)) throw new TypeError(`buildTAccounts：科目不存在 ${id}`);
  const sorted = stableSortBy(wanted, (id) => [chart.byId.get(id)?.order ?? Number.MAX_SAFE_INTEGER, id]);
  return sorted.map((id) => {
    const account = chart.byId.get(id);
    if (account === undefined) throw new TypeError(`buildTAccounts：科目不存在 ${id}`);
    const debits: TAccountLine[] = [];
    const credits: TAccountLine[] = [];
    for (let i = 0; i <= upTo; i++) {
      const s = run.steps[i];
      if (s === undefined) continue;
      for (const e of s.entries) {
        for (const l of e.lines) {
          if (l.account !== id) continue;
          (l.side === 'debit' ? debits : credits).push({ stepId: s.stepId, lineRef: l.ref, amount: l.amount });
        }
      }
    }
    const openingNormal: Money = noNegativeZero((opening[id] ?? 0) * normalSign(account));
    return {
      account: id,
      opening: openingNormal,
      debits,
      credits,
      closing: normalBalanceOf(chart, step.balancesAfter, id),
      highlight: step.entries.flatMap((e) => e.lines.filter((l) => l.account === id).map((l) => l.ref)),
    };
  });
}
