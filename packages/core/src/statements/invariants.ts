// 三表的不變式（04 第 5.3、11.4、18.1 節）：每一步、每個視窗都要成立，給性質測試與 content:check 用。
// 本筆變動視窗以「該步與前一步的量測值相減」比對，所以累計與本筆變動用同一組規則。
import { isInventoryAccount } from '../journal/validate.ts';
import type { PostedRun } from '../ledger/types.ts';
import type { Money } from '../money.ts';
import { compiledLayoutOf } from './compile.ts';
import { type CumulativeMeasures, lastStepId, measuresAt, previousStepId } from './measure.ts';
import type { InvariantResult, InvariantRule, LineId, Statements } from './types.ts';

/** 視窗的量測值：cumulative 取終點的累計值；transaction 取該步與前一步的差 */
export interface WindowMeasures {
  readonly after: CumulativeMeasures;
  /** 只有 transaction 視窗有 */
  readonly before: CumulativeMeasures | null;
  diff(f: (m: CumulativeMeasures) => Money): Money;
}

export function windowMeasures(st: Statements, run: PostedRun = st.source.run): WindowMeasures {
  const win = st.window;
  const after = measuresAt(run, win.kind === 'cumulative' ? (win.to ?? lastStepId(run)) : win.step);
  const before = win.kind === 'cumulative' ? null : measuresAt(run, previousStepId(run, win.step));
  return { after, before, diff: (f) => (before === null ? f(after) : f(after) - f(before)) };
}

function result(rule: InvariantRule, line: LineId, against: string, left: Money, right: Money): InvariantResult {
  return { rule, line, against, left, right, diff: left - right, pass: left === right };
}

/**
 * 檢查全部不變式：版面列自帶的 invariant（equals_line、equals_account_activity、equals_cash_change）、
 * balance_end 等於科目餘額、R14 與 L14 等於存貨餘額、R13 等於 purchase 合計、N26 符合 W05。
 */
export function checkStatementInvariants(st: Statements, run: PostedRun = st.source.run): InvariantResult[] {
  const compiled = compiledLayoutOf(st.source.layout);
  const chart = run.finalState.chart;
  const wm = windowMeasures(st, run);
  const inventoryIds = chart.accounts.filter(isInventoryAccount).map((a) => a.id);
  const inventoryBalance = (): Money => wm.diff((m) => inventoryIds.reduce((acc, id) => acc + m.balanceEnd(id), 0));
  const valueOf = (id: LineId): Money => {
    const v = st.lines.get(id);
    if (v === undefined) throw new RangeError(`報表 ${st.layoutId} 沒有線 ${id}`);
    return v.value;
  };
  const out: InvariantResult[] = [];
  for (const id of compiled.order) {
    const c = compiled.byId.get(id);
    if (c === undefined) continue;
    const line = c.line;
    const value = valueOf(id);
    if ((line.kind === 'formula' || line.kind === 'total') && line.invariant !== undefined) {
      const [rule, target] = line.invariant.split(':') as [string, string | undefined];
      if (rule === 'equals_line' && target !== undefined) out.push(result('equals_line', id, target, value, valueOf(target)));
      else if (rule === 'equals_account_activity' && target !== undefined) {
        if (!chart.byId.has(target)) throw new TypeError(`線 ${id} 的 invariant 引用不存在的科目 ${target}`);
        out.push(
          result(
            'equals_account_activity',
            id,
            target,
            value,
            wm.diff((m) => m.activity(target)),
          ),
        );
      } else if (rule === 'equals_cash_change')
        out.push(
          result(
            'equals_cash_change',
            id,
            'cash',
            value,
            wm.diff((m) => m.cash.total),
          ),
        );
      else throw new TypeError(`線 ${id} 的 invariant 不認得：${line.invariant}`);
    }
    switch (line.kind) {
      case 'balance_end':
        out.push(
          result(
            'balance_end_equals_account',
            id,
            line.account,
            value,
            wm.diff((m) => m.balanceEnd(line.account)),
          ),
        );
        break;
      case 'inventory_closing':
        out.push(result('closing_inventory_equals_balance', id, 'inventory', value, inventoryBalance()));
        break;
      case 'inventory_purchases':
        out.push(
          result(
            'purchases_equal_tag_total',
            id,
            'purchase',
            value,
            wm.diff((m) => m.inventory.purchase),
          ),
        );
        break;
      case 'accounts':
        if (line.measure === 'balance' && line.accounts.length > 0 && line.accounts.every((a) => inventoryIds.includes(a)))
          out.push(result('inventory_line_equals_balance', id, 'inventory', value, inventoryBalance()));
        break;
      case 'retained_earnings': {
        const start = wm.before === null ? wm.after.balanceStart(line.account) : 0;
        const appropriated = wm.diff((m) => m.equityTags.dividend + m.equityTags.reserve_appropriation);
        out.push(result('retained_earnings_w05', id, line.account, value, start + valueOf(line.netIncomeLine) - appropriated));
        break;
      }
      default:
        break;
    }
  }
  return out;
}

/** 全部不變式都成立 */
export const statementInvariantsHold = (st: Statements, run?: PostedRun): boolean => checkStatementInvariants(st, run).every((r) => r.pass);
