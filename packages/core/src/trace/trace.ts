// 追蹤樹（04 第 6.4 節，D10(c) A）：任一報表數字展開成「公式列引用的列、跨表連結、科目層、來源步驟與分錄行」的樹。
// 先用 buildStatements 一次算出全部列值，再用 lineDependencies 與 lineAccountTraces 遞迴展開；
// 同一個 (run、視窗、版面、政策) 的 Statements 與每一條線的節點以 WeakMap 記住，只是省重算，不影響決定性。
import type { AccountNode, AnyAst } from '../expr/ast.ts';
import type { Layout, LayoutLine, WorkingCapitalLine } from '../layout/types.ts';
import { STATEMENT_IDS } from '../layout/types.ts';
import { noNegativeZero } from '../ledger/ledger.ts';
import type { PostedRun } from '../ledger/types.ts';
import type { PolicyDefinition } from '../policy/types.ts';
import { buildStatements } from '../statements/build.ts';
import { type CompiledLayoutLine, compiledLayoutOf } from '../statements/compile.ts';
import { type AccountTrace, type SourceRef, lineAccountTraces } from '../statements/trace.ts';
import type { LineId, StatementWindow, Statements } from '../statements/types.ts';
import type { TraceAccount, TraceNode, TraceNote, TraceRule, TraceSourceRef } from './types.ts';

export interface TraceLineOptions {
  /** 已建好的同一個 (run、視窗、版面、政策) 報表；給了就不再呼叫 buildStatements */
  readonly statements?: Statements;
}

interface TraceContext {
  readonly statements: Statements;
  readonly nodes: Map<LineId, TraceNode>;
}

type WindowCache = Map<string, TraceContext>;
const cache = new WeakMap<PostedRun, WeakMap<Layout, WeakMap<PolicyDefinition, WindowCache>>>();

export function windowKey(win: StatementWindow): string {
  return win.kind === 'cumulative' ? `cumulative:${win.to ?? ''}` : `transaction:${win.step}`;
}

function contextOf(run: PostedRun, win: StatementWindow, layout: Layout, policy: PolicyDefinition, options: TraceLineOptions): TraceContext {
  let byLayout = cache.get(run);
  if (byLayout === undefined) {
    byLayout = new WeakMap();
    cache.set(run, byLayout);
  }
  let byPolicy = byLayout.get(layout);
  if (byPolicy === undefined) {
    byPolicy = new WeakMap();
    byLayout.set(layout, byPolicy);
  }
  let byWindow = byPolicy.get(policy);
  if (byWindow === undefined) {
    byWindow = new Map();
    byPolicy.set(policy, byWindow);
  }
  const key = windowKey(win);
  const hit = byWindow.get(key);
  if (hit !== undefined && (options.statements === undefined || options.statements === hit.statements)) return hit;
  const given = options.statements;
  if (given !== undefined && (given.source.run !== run || given.source.layout !== layout || given.source.policy !== policy || windowKey(given.window) !== key))
    throw new TypeError('traceLine：options.statements 不是同一個 run、視窗、版面與政策的報表');
  const ctx: TraceContext = { statements: given ?? buildStatements(run, win, layout, policy), nodes: new Map() };
  if (hit === undefined) byWindow.set(key, ctx);
  return ctx;
}

/** 版面 kind 對追蹤規則 */
export function traceRuleOf(kind: LayoutLine['kind']): TraceRule {
  switch (kind) {
    case 'inventory_opening':
    case 'inventory_purchases':
    case 'inventory_closing':
    case 'inventory_overage':
      return 'inventory';
    default:
      return kind;
  }
}

/** formula 列引用的線，依運算式出現順序（不重複）；compile 的 valueRefs 是排序過的，畫面要照公式順序 */
export function formulaRefsInOrder(node: AnyAst | AccountNode, out: LineId[] = []): LineId[] {
  switch (node.type) {
    case 'ref':
      if (node.ns === 'line' && !out.includes(node.name)) out.push(node.name);
      return out;
    case 'unary':
      return formulaRefsInOrder(node.operand, out);
    case 'binary':
      formulaRefsInOrder(node.left, out);
      return formulaRefsInOrder(node.right, out);
    case 'call':
      for (const a of node.args) formulaRefsInOrder(a, out);
      return out;
    default:
      return out;
  }
}

function toSourceRef(sign: 1 | -1, s: SourceRef): TraceSourceRef {
  return { stepId: s.stepId, eventId: s.eventId, lineRef: s.lineRef, side: s.side, amount: s.amount, signedAmount: noNegativeZero(sign * s.signed) };
}

/** statements 的 AccountTrace（amount 已含列的符號）換成 04 的形狀：amount 以正常餘額表示，符號留在 sign */
function toTraceAccount(a: AccountTrace): TraceAccount {
  return {
    account: a.account,
    sign: a.sign,
    opening: noNegativeZero(a.sign * a.opening),
    amount: noNegativeZero(a.sign * a.amount),
    sources: a.sources.map((s) => toSourceRef(a.sign, s)),
  };
}

function sameAccounts(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedB = [...b].sort();
  return [...a].sort().every((x, i) => x === sortedB[i]);
}

/** H15 與 H17 擇一：找同一張表裡科目相同、only 相反的營運資金列 */
function counterpartLine(layout: Layout, line: WorkingCapitalLine, statement: CompiledLayoutLine['statement']): LineId | null {
  if (line.only === undefined) return null;
  const other = line.only === 'increase' ? 'decrease' : 'increase';
  for (const l of layout.statements[statement])
    if (l.kind === 'working_capital' && l.id !== line.id && l.only === other && l.sign === line.sign && sameAccounts(l.accounts, line.accounts)) return l.id;
  return null;
}

function buildNode(ctx: TraceContext, lineId: LineId, layout: Layout): TraceNode {
  const hit = ctx.nodes.get(lineId);
  if (hit !== undefined) return hit;
  const st = ctx.statements;
  const compiled = compiledLayoutOf(layout);
  const c = compiled.byId.get(lineId);
  if (c === undefined) throw new RangeError(`版面 ${layout.id} 沒有線 ${lineId}`);
  const t = lineAccountTraces(st, lineId);
  const line = c.line;
  const rule = traceRuleOf(line.kind);
  const refs = line.kind === 'formula' && c.ast !== null ? formulaRefsInOrder(c.ast) : c.valueRefs;
  const children = refs.map((id) => buildNode(ctx, id, layout));
  let accounts: TraceAccount[] = t.accounts.map(toTraceAccount);
  let note: TraceNote | undefined;
  if (t.gated) {
    // 被 only 或政策門檻歸 0 的列：科目層不進樹，註記指向實際填入的列或說明政策不適用
    accounts = [];
    if (line.kind === 'working_capital') {
      const other = counterpartLine(layout, line, c.statement);
      if (other !== null) note = { key: 'trace.filled_in_other_line', params: { line: other } };
    } else note = { key: 'trace.not_in_policy', params: { policy: st.policyId } };
  }
  const sources = t.cashSources.map((s) => toSourceRef(1, s));
  const node: TraceNode = {
    line: lineId,
    cell: line.cell,
    value: t.value,
    rule,
    ...(line.kind === 'formula' ? { expr: line.expr } : {}),
    children,
    accounts,
    sources,
    ...(note === undefined ? {} : { note }),
  };
  ctx.nodes.set(lineId, node);
  return node;
}

/**
 * 某一列的追蹤樹（04 第 6.4 節）。window 為 transaction 時 sources 只列這一步的分錄行、數值是本筆變動（第 11.5 節）。
 * 線不存在或視窗指到不存在的步驟是程式錯誤（RangeError）。
 */
export function traceLine(
  run: PostedRun,
  win: StatementWindow,
  layout: Layout,
  policy: PolicyDefinition,
  lineId: LineId,
  options: TraceLineOptions = {},
): TraceNode {
  return buildNode(contextOf(run, win, layout, policy, options), lineId, layout);
}

/** 版面全部線的追蹤樹（給 content:check 與性質測試），依版面順序 */
export function traceAllLines(run: PostedRun, win: StatementWindow, layout: Layout, policy: PolicyDefinition, options: TraceLineOptions = {}): TraceNode[] {
  const ctx = contextOf(run, win, layout, policy, options);
  const out: TraceNode[] = [];
  for (const s of STATEMENT_IDS) for (const l of layout.statements[s]) out.push(buildNode(ctx, l.id, layout));
  return out;
}
