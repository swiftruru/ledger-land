// 給追蹤樹模組的介面（04 第 6.4 節、第 18.1 節的「追蹤」不變式）：每一列引用的線、取用的科目與符號、來源的分錄行與現金行。
// 葉列（accounts、inventory_*、working_capital、noncash_addback、cash_tag、balance_begin 與 retained_earnings 的帳戶部分）
// 的 accounts 與 cashSources 帶號加總等於列值（被 only 或政策門檻歸 0 時 gated 為 true）；其餘列只回 refs。
import { normalSign } from '../accounts/chart.ts';
import { noNegativeZero } from '../ledger/ledger.ts';
import type { Account } from '../accounts/types.ts';
import type { InventoryTag } from '../data/types.ts';
import { isInventoryAccount } from '../journal/validate.ts';
import type { PostedRun, PostedStep } from '../ledger/types.ts';
import type { Money } from '../money.ts';
import { overageLineApplies } from './build.ts';
import { compiledLayoutOf } from './compile.ts';
import { lastStepId } from './measure.ts';
import type { LineId, Statements } from './types.ts';

export interface SourceRef {
  readonly stepId: string;
  readonly eventId: string;
  readonly lineRef: string;
  readonly account: string;
  readonly side: 'debit' | 'credit';
  readonly amount: Money;
  /** 這一行對列值的帶號貢獻 */
  readonly signed: Money;
}

export type TraceMeasure = 'balance' | 'balance_start' | 'activity' | 'delta' | 'tagged';

export interface AccountTrace {
  readonly account: string;
  readonly measure: TraceMeasure;
  /** 1 加入、-1 反號併入（抵銷科目、負號列） */
  readonly sign: 1 | -1;
  /** 視窗起點的餘額對列值的帶號貢獻（balance 與 balance_start 的累計視窗才有） */
  readonly opening: Money;
  /** opening 加 sources 的 signed 合計 */
  readonly amount: Money;
  readonly sources: readonly SourceRef[];
}

export interface LineTrace {
  readonly line: LineId;
  readonly kind: string;
  readonly value: Money;
  /** 值引用的線（formula、link、total、balance_end、retained_earnings 的 netIncomeLine） */
  readonly refs: readonly LineId[];
  readonly accounts: readonly AccountTrace[];
  readonly cashKinds: readonly string[];
  readonly cashSources: readonly SourceRef[];
  readonly inventoryTags: readonly InventoryTag[];
  /** 列值被 only（H15、H17）或政策門檻（盤盈列）歸 0，所以 accounts 的合計不等於列值 */
  readonly gated: boolean;
}

function windowSteps(st: Statements, run: PostedRun): readonly PostedStep[] {
  const win = st.window;
  if (win.kind === 'transaction') return run.steps.filter((s) => s.stepId === win.step);
  const to = win.to ?? lastStepId(run);
  if (to === null) return [];
  const i = run.steps.findIndex((s) => s.stepId === to);
  if (i < 0) throw new RangeError(`run 裡沒有步驟 ${to}`);
  return run.steps.slice(0, i + 1);
}

function accountTrace(
  st: Statements,
  run: PostedRun,
  steps: readonly PostedStep[],
  account: Account,
  measure: TraceMeasure,
  sign: 1 | -1,
  tags: readonly InventoryTag[] = [],
): AccountTrace {
  const normal = normalSign(account);
  const win = st.window;
  const cumulative = win.kind === 'cumulative';
  const openingNormal = (run.finalState.opening[account.id] ?? 0) * normal;
  const opening = cumulative && (measure === 'balance' || measure === 'balance_start') ? noNegativeZero(sign * openingNormal) : 0;
  const sources: SourceRef[] = [];
  if (measure !== 'balance_start') {
    for (const step of steps)
      for (const entry of step.entries)
        for (const l of entry.lines) {
          if (l.account !== account.id) continue;
          if (measure === 'tagged' && (l.tag === undefined || !tags.includes(l.tag as InventoryTag))) continue;
          const signed = sign * (l.side === 'debit' ? l.amount : -l.amount) * normal;
          sources.push({
            stepId: step.stepId,
            eventId: entry.eventId,
            lineRef: l.ref,
            account: l.account,
            side: l.side,
            amount: l.amount,
            signed: signed === 0 ? 0 : signed,
          });
        }
  }
  const amount = opening + sources.reduce((acc, s) => acc + s.signed, 0);
  return { account: account.id, measure, sign, opening, amount: noNegativeZero(amount), sources };
}

/** 某一列取用的科目、分錄行與現金行；線不存在是程式錯誤 */
export function lineAccountTraces(st: Statements, lineId: LineId): LineTrace {
  const run = st.source.run;
  const chart = run.finalState.chart;
  const compiled = compiledLayoutOf(st.source.layout);
  const c = compiled.byId.get(lineId);
  const v = st.lines.get(lineId);
  if (c === undefined || v === undefined) throw new RangeError(`報表 ${st.layoutId} 沒有線 ${lineId}`);
  const steps = windowSteps(st, run);
  const line = c.line;
  const accountOf = (id: string): Account => {
    const a = chart.byId.get(id);
    if (a === undefined) throw new TypeError(`版面引用不存在的科目 ${id}`);
    return a;
  };
  const contraSign = (a: Account): 1 | -1 => (a.contraOf === null ? 1 : -1);
  const inventory = chart.accounts.filter(isInventoryAccount);
  const base = { line: lineId, kind: line.kind, value: v.value, refs: c.valueRefs, cashKinds: [], cashSources: [], inventoryTags: [], gated: false } as const;
  switch (line.kind) {
    case 'accounts':
      return { ...base, accounts: line.accounts.map((id) => accountTrace(st, run, steps, accountOf(id), line.measure, contraSign(accountOf(id)))) };
    case 'inventory_opening':
      return { ...base, accounts: inventory.map((a) => accountTrace(st, run, steps, a, 'balance_start', 1)) };
    case 'inventory_closing':
      return { ...base, accounts: inventory.map((a) => accountTrace(st, run, steps, a, 'balance', 1)) };
    case 'inventory_purchases':
      return { ...base, inventoryTags: ['purchase'], accounts: inventory.map((a) => accountTrace(st, run, steps, a, 'tagged', 1, ['purchase'])) };
    case 'inventory_overage':
      return {
        ...base,
        inventoryTags: ['count_overage'],
        gated: !overageLineApplies(line, st.source.policy),
        accounts: inventory.map((a) => accountTrace(st, run, steps, a, 'tagged', 1, ['count_overage'])),
      };
    case 'working_capital': {
      const excluded = new Set(line.excludeAccounts ?? []);
      const sign: 1 | -1 = line.sign === 'change' ? 1 : -1;
      const accounts = line.accounts.filter((id) => !excluded.has(id)).map((id) => accountTrace(st, run, steps, accountOf(id), 'delta', sign));
      const sum = accounts.reduce((acc, a) => acc + a.amount, 0);
      return { ...base, accounts, gated: sum !== v.value };
    }
    case 'noncash_addback': {
      const sign: 1 | -1 = line.sign === 'add' ? 1 : -1;
      return { ...base, accounts: line.accounts.map((id) => accountTrace(st, run, steps, accountOf(id), 'activity', sign)) };
    }
    case 'cash_tag': {
      const cashSources: SourceRef[] = [];
      for (const step of steps)
        for (const entry of step.entries)
          for (const l of entry.lines) {
            if (l.cf === undefined || !line.cfKinds.includes(l.cf.kind)) continue;
            cashSources.push({
              stepId: step.stepId,
              eventId: entry.eventId,
              lineRef: l.ref,
              account: l.account,
              side: l.side,
              amount: l.amount,
              signed: l.side === 'debit' ? l.amount : -l.amount,
            });
          }
      return { ...base, accounts: [], cashKinds: line.cfKinds, cashSources };
    }
    case 'retained_earnings':
      return { ...base, accounts: [accountTrace(st, run, steps, accountOf(line.account), 'balance', 1)] };
    case 'balance_begin':
      return { ...base, accounts: [accountTrace(st, run, steps, accountOf(line.account), 'balance_start', 1)] };
    default:
      return { ...base, accounts: [] };
  }
}
