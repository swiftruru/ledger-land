// 教材版面三表的推導（04 第 5.2、11 節）：每一列依 kind 從累計量測值算出金額，再依 LayoutOptions 與政策決定顯示；
// 本筆變動是兩張累計報表逐列相減（第 11.5 節），formula 列也是相減，不重算。
import type { Chart } from '../accounts/types.ts';
import { evaluateMoney } from '../expr/evaluate.ts';
import { isInventoryAccount } from '../journal/validate.ts';
import type { InventoryOverageLine, Layout, LayoutLine, StatementId, WorkingCapitalLine } from '../layout/types.ts';
import { STATEMENT_IDS } from '../layout/types.ts';
import type { PostedRun } from '../ledger/types.ts';
import { noNegativeZero } from '../ledger/ledger.ts';
import { type Money, ratFromInt } from '../money.ts';
import { POLICY_SWITCH_KEYS, type PolicyDefinition } from '../policy/types.ts';
import { type CompiledLayout, type CompiledLayoutLine, compiledLayoutOf } from './compile.ts';
import { type CumulativeMeasures, lastStepId, measuresAt, previousStepId } from './measure.ts';
import type { LineId, LineNote, LineValue, StatementNote, StatementRow, StatementWindow, Statements } from './types.ts';

/** 盤盈列是否在這套政策下出現：appliesWhen 列出的每個開關都要含目前的值 */
export function overageLineApplies(line: InventoryOverageLine, policy: PolicyDefinition): boolean {
  for (const key of POLICY_SWITCH_KEYS) {
    const allowed = line.appliesWhen[key] as readonly string[] | undefined;
    if (allowed !== undefined && !allowed.includes(policy.switches[key])) return false;
  }
  return true;
}

const inventoryAccountIds = (chart: Chart): readonly string[] => chart.accounts.filter(isInventoryAccount).map((a) => a.id);

/** 多個科目相加，抵銷科目以負號併入（例如機器設備減累計折舊） */
function sumAccounts(chart: Chart, accounts: readonly string[], measure: (id: string) => Money): Money {
  let total = 0;
  for (const id of accounts) {
    const account = chart.byId.get(id);
    if (account === undefined) throw new TypeError(`版面引用不存在的科目 ${id}`);
    total += account.contraOf === null ? measure(id) : -measure(id);
  }
  return total;
}

function workingCapitalValue(line: WorkingCapitalLine, m: CumulativeMeasures): Money {
  const excluded = new Set(line.excludeAccounts ?? []);
  let delta = 0;
  for (const id of line.accounts) if (!excluded.has(id)) delta += m.balanceEnd(id) - m.balanceStart(id);
  if (line.only === 'increase' && delta <= 0) return 0;
  if (line.only === 'decrease' && delta >= 0) return 0;
  return line.sign === 'change' ? delta : -delta;
}

/** 不引用其他列的「葉」值（kind 的求值規則見 04 第 5.2、11.3、11.4 節）；retained_earnings 的葉部分是帳戶餘額 */
function leafValue(c: CompiledLayoutLine, m: CumulativeMeasures, policy: PolicyDefinition): Money {
  const chart = m.run.finalState.chart;
  const line = c.line;
  switch (line.kind) {
    case 'accounts':
      return sumAccounts(chart, line.accounts, line.measure === 'balance' ? m.balanceEnd : m.activity);
    case 'inventory_opening':
      return sumAccounts(chart, inventoryAccountIds(chart), m.balanceStart);
    case 'inventory_purchases':
      return m.inventory.purchase;
    case 'inventory_closing':
      return sumAccounts(chart, inventoryAccountIds(chart), m.balanceEnd);
    case 'inventory_overage':
      return overageLineApplies(line, policy) ? m.inventory.count_overage : 0;
    case 'working_capital':
      return workingCapitalValue(line, m);
    case 'noncash_addback': {
      const activity = sumAccounts(chart, line.accounts, m.activity);
      return line.sign === 'add' ? activity : -activity;
    }
    case 'cash_tag': {
      // cashByTag 已是帶號合計（流入為正、流出為負），sign 只描述這一列預期的方向
      let total = 0;
      for (const kind of line.cfKinds) total += (m.cash.byKind as Readonly<Record<string, Money>>)[kind] ?? 0;
      return total;
    }
    case 'retained_earnings':
      return m.balanceEnd(line.account);
    case 'balance_begin':
      return m.balanceStart(line.account);
    default:
      return 0;
  }
}

/** 引用其他列的值；leaf 是這一列的葉部分（retained_earnings 用） */
function derivedValue(c: CompiledLayoutLine, values: ReadonlyMap<LineId, Money>, leaf: Money): Money {
  const line = c.line;
  const of = (id: LineId): Money => {
    const v = values.get(id);
    if (v === undefined) throw new RangeError(`線 ${line.id} 引用尚未求值的線 ${id}`);
    return v;
  };
  switch (line.kind) {
    case 'formula': {
      if (c.ast === null) throw new TypeError(`formula 列 ${line.id} 沒有編譯過的運算式`);
      const r = evaluateMoney(c.ast, { line: (name) => ratFromInt(of(name)) });
      if (!r.ok) throw new RangeError(`版面公式 ${line.id} 求值失敗：${r.error.code}`);
      return r.value.value;
    }
    case 'link':
      return of(line.from);
    case 'total':
      return line.sum.reduce((acc, id) => acc + of(id), 0);
    case 'balance_end':
      return line.from.reduce((acc, id) => acc + of(id), 0);
    case 'retained_earnings':
      return leaf + of(line.netIncomeLine);
    default:
      return leaf;
  }
}

export const isDerivedKind = (kind: LayoutLine['kind']): boolean =>
  kind === 'formula' || kind === 'link' || kind === 'total' || kind === 'balance_end' || kind === 'retained_earnings';

/**
 * 依拓撲順序求所有列的值。leafOf 提供每一列的葉部分；overrides 直接取代該列的值（勾稽練習的學生輸入），引用它的列會跟著重算。
 */
export function evaluateLines(compiled: CompiledLayout, leafOf: (c: CompiledLayoutLine) => Money, overrides?: ReadonlyMap<LineId, Money>): Map<LineId, Money> {
  const values = new Map<LineId, Money>();
  for (const id of compiled.order) {
    const c = compiled.byId.get(id);
    if (c === undefined) throw new RangeError(`版面沒有線 ${id}`);
    const override = overrides?.get(id);
    if (override !== undefined) {
      values.set(id, noNegativeZero(override));
      continue;
    }
    const leaf = c.line.kind === 'group' ? 0 : leafOf(c);
    values.set(id, noNegativeZero(isDerivedKind(c.line.kind) ? derivedValue(c, values, leaf) : leaf));
  }
  return values;
}

function cumulativeValues(compiled: CompiledLayout, run: PostedRun, toStep: string | null, policy: PolicyDefinition): Map<LineId, Money> {
  const m = measuresAt(run, toStep);
  return evaluateLines(compiled, (c) => leafValue(c, m, policy));
}

const noteOf = (line: LayoutLine, value: Money): LineNote | undefined => {
  if (line.kind !== 'working_capital' || line.oppositeSignNote === undefined) return undefined;
  const opposite = line.sign === 'negate_change' ? value > 0 : value < 0;
  return opposite ? { key: line.oppositeSignNote, params: { line: line.id } } : undefined;
};

function isExtraordinaryLine(line: LayoutLine, chart: Chart): boolean {
  if (line.kind !== 'accounts' || line.accounts.length === 0) return false;
  return line.accounts.every((id) => {
    const section = chart.byId.get(id)?.section;
    return section === 'extraordinary_gain' || section === 'extraordinary_loss';
  });
}

/** 顯示規則：hidden、延伸列、政策列、經常利益、非常損益列、group 依 children */
function visibleOf(
  c: CompiledLayoutLine,
  value: Money,
  values: ReadonlyMap<LineId, LineValue>,
  layout: Layout,
  policy: PolicyDefinition,
  chart: Chart,
): boolean {
  const line = c.line;
  const { options } = layout;
  if (line.hidden === true) return false;
  if (line.kind === 'inventory_overage') return overageLineApplies(line, policy);
  if (line.extension === true) {
    if (options.showExtensionRows === 'never') return false;
    if (options.showExtensionRows === 'when_nonzero') return value !== 0;
  }
  if (line.kind === 'formula' && line.level === 3 && !options.showOrdinaryIncome) return false;
  if (!options.showExtraordinaryRows && isExtraordinaryLine(line, chart)) return false;
  if (line.kind === 'group' && c.childRefs.length > 0) return c.childRefs.some((id) => values.get(id)?.visible === true);
  return true;
}

/** 把每一列的金額配上顯示與註記（children 先於 group，所以照拓撲順序） */
export function finaliseLines(compiled: CompiledLayout, values: ReadonlyMap<LineId, Money>, policy: PolicyDefinition, chart: Chart): Map<LineId, LineValue> {
  const out = new Map<LineId, LineValue>();
  for (const id of compiled.order) {
    const c = compiled.byId.get(id);
    const value = values.get(id);
    if (c === undefined || value === undefined) throw new RangeError(`版面沒有線 ${id}`);
    const note = noteOf(c.line, value);
    out.set(id, {
      line: id,
      cell: c.line.cell,
      value,
      kind: c.line.kind,
      visible: visibleOf(c, value, out, compiled.layout, policy, chart),
      ...(note === undefined ? {} : { note }),
    });
  }
  return out;
}

function rowOf(statement: StatementId, line: LayoutLine, v: LineValue): StatementRow {
  return {
    id: line.id,
    statement,
    cell: line.cell,
    kind: line.kind,
    label: line.label,
    aliases: line.aliases,
    termRef: line.termRef ?? null,
    level: line.kind === 'formula' ? (line.level ?? null) : null,
    extension: line.extension === true,
    hidden: line.hidden === true,
    pendingRefs: line.pendingRefs ?? [],
    flags: line.flags ?? [],
    check: line.kind === 'link' || line.kind === 'balance_end' ? (line.check ?? null) : null,
    value: v.value,
    visible: v.visible,
    note: v.note ?? null,
  };
}

/** 由列值組成 Statements（建立與勾稽練習的重算共用） */
export function assembleStatements(
  compiled: CompiledLayout,
  lines: ReadonlyMap<LineId, LineValue>,
  window: StatementWindow,
  source: Statements['source'],
): Statements {
  const { layout } = compiled;
  const statements = {} as { [S in StatementId]: StatementRow[] };
  const notes: StatementNote[] = [];
  for (const s of STATEMENT_IDS) {
    statements[s] = layout.statements[s].map((line) => {
      const v = lines.get(line.id);
      if (v === undefined) throw new RangeError(`版面沒有線 ${line.id}`);
      if (v.note !== undefined) notes.push({ line: line.id, note: v.note });
      return rowOf(s, line, v);
    });
  }
  return { layoutId: layout.id, policyId: source.policy.id, window, lines, statements, notes, source };
}

/**
 * 從已過帳的 run 推導三表。cumulative：帳本起點到 to（null 為最後一步）；transaction：該步與前一步的累計報表逐列相減。
 * 視窗指到不存在的步驟是程式錯誤（RangeError）。
 */
export function buildStatements(run: PostedRun, win: StatementWindow, layout: Layout, policy: PolicyDefinition): Statements {
  const compiled = compiledLayoutOf(layout);
  const chart = run.finalState.chart;
  let values: Map<LineId, Money>;
  if (win.kind === 'cumulative') {
    const toStep = win.to ?? lastStepId(run);
    if (toStep !== null && !run.steps.some((s) => s.stepId === toStep)) throw new RangeError(`run 裡沒有步驟 ${toStep}`);
    values = cumulativeValues(compiled, run, toStep, policy);
  } else {
    const after = cumulativeValues(compiled, run, win.step, policy);
    const before = cumulativeValues(compiled, run, previousStepId(run, win.step), policy);
    values = new Map<LineId, Money>();
    for (const [id, v] of after) values.set(id, noNegativeZero(v - (before.get(id) ?? 0)));
  }
  return assembleStatements(compiled, finaliseLines(compiled, values, policy, chart), win, { run, layout, policy });
}

/** 某一列的值；線不存在是程式錯誤 */
export function lineValue(st: Statements, lineId: LineId): LineValue {
  const v = st.lines.get(lineId);
  if (v === undefined) throw new RangeError(`報表 ${st.layoutId} 沒有線 ${lineId}`);
  return v;
}

/** 全部列的金額（含 hidden 列），給指標模組的 line.* 查值 */
export function measureMap(st: Statements): Record<LineId, Money> {
  const out: Record<LineId, Money> = {};
  for (const [id, v] of st.lines) out[id] = v.value;
  return out;
}

/**
 * 以學生輸入取代某些列後重算（04 第 13 節的勾稽練習）：被取代的列用輸入值，引用它的列跟著重算，其餘列維持原值。
 * 只支援累計視窗；本筆變動的差額報表沒有勾稽練習。
 */
export function recomputeWithInputs(st: Statements, inputs: ReadonlyMap<LineId, Money>): Statements {
  const win = st.window;
  if (win.kind !== 'cumulative') throw new RangeError('recomputeWithInputs：只支援累計視窗');
  const compiled = compiledLayoutOf(st.source.layout);
  for (const id of inputs.keys()) if (!compiled.byId.has(id)) throw new RangeError(`報表 ${st.layoutId} 沒有線 ${id}`);
  const original = (id: LineId): Money => lineValue(st, id).value;
  const leafOf = (c: CompiledLayoutLine): Money =>
    c.line.kind === 'retained_earnings' ? original(c.line.id) - original(c.line.netIncomeLine) : original(c.line.id);
  const values = evaluateLines(compiled, leafOf, inputs);
  return assembleStatements(compiled, finaliseLines(compiled, values, st.source.policy, st.source.run.finalState.chart), win, st.source);
}
