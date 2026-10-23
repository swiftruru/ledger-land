// 五步驟檢查（04 第 13 節）：步驟①只回傳五層利益；②到⑤是四個勾稽點，左右兩邊都是版面的線。
// 勾稽練習：learnerInputs 的值取代對應的列並讓引用它的列重算（和 Excel 一樣，錯一格可能讓後面的點也不平）。
import type { Money } from '../money.ts';
import { lineValue, recomputeWithInputs } from '../statements/build.ts';
import { compiledLayoutOf } from '../statements/compile.ts';
import { lastStepId, measuresAt } from '../statements/measure.ts';
import type { LineId, Statements } from '../statements/types.ts';

export type CheckStep = 2 | 3 | 4 | 5;
export type CheckAlias = 'A' | 'B' | 'C' | 'D';

export interface CheckSide {
  readonly line: LineId;
  readonly cell: string | null;
  readonly value: Money;
  readonly source: 'core' | 'learner';
}

export interface CheckResult {
  readonly step: CheckStep;
  /** 只當顯示別名【待確認 T13】 */
  readonly alias: CheckAlias;
  readonly left: CheckSide;
  readonly right: CheckSide;
  /** left 減 right */
  readonly diff: Money;
  readonly pass: boolean;
}

export interface FiveStepResult {
  readonly step1: {
    readonly grossProfit: Money;
    readonly operatingIncome: Money;
    /** 版面沒有經常利益（ifrs@1）或不顯示時為 null */
    readonly ordinaryIncome: Money | null;
    readonly pretaxIncome: Money;
    readonly netIncome: Money;
  };
  readonly checks: readonly CheckResult[];
  readonly firstFailedStep: CheckStep | null;
}

/** 步驟④左邊「期初未分配盈餘 ＋ 本期淨利 － 股利 － 提列公積」不是版面的列，用這個線 ID、cell 為 null */
export const RE_EXPECTED_LINE: LineId = 're_expected';

const ALIASES: { readonly [S in CheckStep]: CheckAlias } = { 2: 'A', 3: 'C', 4: 'B', 5: 'D' };

/** 學生可填的格子（預設三格；進階模式由題目的 openCells 再開放） */
export const DEFAULT_OPEN_CELLS: readonly LineId[] = ['cf_pretax_income', 'bs_cash', 'bs_retained_earnings'];

function levelLine(st: Statements, level: 1 | 2 | 3 | 4 | 5): LineId | null {
  for (const line of st.source.layout.statements.income_statement) if (line.kind === 'formula' && line.level === level) return line.id;
  return null;
}

function requireLevel(st: Statements, level: 1 | 2 | 3 | 4 | 5): Money {
  const id = levelLine(st, level);
  if (id === null) throw new TypeError(`版面 ${st.layoutId} 沒有第 ${level} 層利益的 formula 列`);
  return lineValue(st, id).value;
}

export function fiveStepCheck(st: Statements, learnerInputs?: Partial<Record<LineId, Money>>): FiveStepResult {
  const win = st.window;
  if (win.kind !== 'cumulative') throw new RangeError('fiveStepCheck：只對累計報表檢查');
  const inputs = new Map<LineId, Money>();
  for (const [id, value] of Object.entries(learnerInputs ?? {})) if (value !== undefined) inputs.set(id, value);
  const recomputed = inputs.size === 0 ? st : recomputeWithInputs(st, inputs);
  const { layout } = st.source;
  const compiled = compiledLayoutOf(layout);
  const side = (id: LineId): CheckSide => {
    const v = lineValue(recomputed, id);
    return { line: id, cell: v.cell, value: v.value, source: inputs.has(id) ? 'learner' : 'core' };
  };
  const check = (step: CheckStep, left: CheckSide, right: CheckSide): CheckResult => ({
    step,
    alias: ALIASES[step],
    left,
    right,
    diff: left.value - right.value,
    pass: left.value === right.value,
  });

  // ②：帶 check step2 的 link 列（H11）對它的 from（R33）
  const step2 = layout.statements.cash_flow_indirect.find((l) => l.kind === 'link' && l.check === 'step2');
  if (step2 === undefined || step2.kind !== 'link') throw new TypeError(`版面 ${layout.id} 沒有 check 為 step2 的 link 列`);
  // ③：帶 check step3 的 balance_end 列（H41）對資產負債表同一科目的餘額列（L12）
  const step3 = layout.statements.cash_flow_indirect.find((l) => l.kind === 'balance_end' && l.check === 'step3');
  if (step3 === undefined || step3.kind !== 'balance_end') throw new TypeError(`版面 ${layout.id} 沒有 check 為 step3 的 balance_end 列`);
  const cashLine = layout.statements.balance_sheet.find(
    (l) => l.kind === 'accounts' && l.measure === 'balance' && l.accounts.length === 1 && l.accounts[0] === step3.account,
  );
  if (cashLine === undefined) throw new TypeError(`版面 ${layout.id} 的資產負債表沒有 ${step3.account} 的餘額列`);
  // ④：W05 的完整公式對 retained_earnings 列（N26）
  const reLine = layout.statements.balance_sheet.find((l) => l.kind === 'retained_earnings');
  if (reLine === undefined || reLine.kind !== 'retained_earnings') throw new TypeError(`版面 ${layout.id} 沒有 retained_earnings 列`);
  const m = measuresAt(st.source.run, win.to ?? lastStepId(st.source.run));
  const reExpected =
    m.balanceStart(reLine.account) + lineValue(recomputed, reLine.netIncomeLine).value - m.equityTags.dividend - m.equityTags.reserve_appropriation;
  // ⑤：資產負債表帶 equals_line 的 total 列（N29）對它的目標（L29）
  const step5 = layout.statements.balance_sheet.find((l) => l.kind === 'total' && l.invariant?.startsWith('equals_line:') === true);
  if (step5 === undefined || step5.kind !== 'total' || step5.invariant === undefined)
    throw new TypeError(`版面 ${layout.id} 的資產負債表沒有 equals_line 的 total 列`);
  const assetsLine = step5.invariant.slice('equals_line:'.length);
  if (!compiled.byId.has(assetsLine)) throw new TypeError(`版面 ${layout.id} 沒有線 ${assetsLine}`);

  const checks: CheckResult[] = [
    check(2, side(step2.from), side(step2.id)),
    check(3, side(step3.id), side(cashLine.id)),
    check(4, { line: RE_EXPECTED_LINE, cell: null, value: reExpected, source: 'core' }, side(reLine.id)),
    check(5, side(assetsLine), side(step5.id)),
  ];
  const ordinary = levelLine(recomputed, 3);
  return {
    step1: {
      grossProfit: requireLevel(recomputed, 1),
      operatingIncome: requireLevel(recomputed, 2),
      ordinaryIncome: ordinary === null || !layout.options.showOrdinaryIncome ? null : lineValue(recomputed, ordinary).value,
      pretaxIncome: requireLevel(recomputed, 4),
      netIncome: requireLevel(recomputed, 5),
    },
    checks,
    firstFailedStep: checks.find((c) => !c.pass)?.step ?? null,
  };
}
