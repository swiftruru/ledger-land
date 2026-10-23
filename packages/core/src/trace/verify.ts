// 追蹤樹的不變式（04 第 18.1 節「追蹤」）：樹根等於報表列值；formula 節點等於子節點代入公式；
// 其他節點等於科目層 sign 乘 amount 的合計加子節點值加現金行帶號金額；每個科目層 opening 加 sources 帶號合計等於 amount；
// 每個 SourceRef 都指得到 PostedStep.entries 裡的一行。給性質測試與 content:check 使用。
import { evaluateMoney } from '../expr/evaluate.ts';
import type { Layout } from '../layout/types.ts';
import { noNegativeZero } from '../ledger/ledger.ts';
import type { PostedRun } from '../ledger/types.ts';
import type { Money } from '../money.ts';
import { ratFromInt } from '../money.ts';
import { compiledLayoutOf } from '../statements/compile.ts';
import type { Statements } from '../statements/types.ts';
import type { TraceInvariantFailure, TraceNode, TraceVerification } from './types.ts';

export interface VerifyTraceTreeOptions {
  /** 提供時檢查樹根等於報表同一列的值 */
  readonly statements?: Statements;
  /** 提供時檢查每個來源都指得到分錄行（預設取 statements.source.run） */
  readonly run?: PostedRun;
}

function sourceResolves(
  run: PostedRun,
  s: { readonly stepId: string; readonly eventId: string; readonly lineRef: string; readonly side: string; readonly amount: Money },
): boolean {
  const step = run.steps.find((x) => x.stepId === s.stepId);
  const entry = step?.entries.find((e) => e.eventId === s.eventId);
  const line = entry?.lines.find((l) => l.ref === s.lineRef);
  return line !== undefined && line.side === s.side && line.amount === s.amount;
}

/** 公式節點的值：expr 代入各子節點的值 */
function formulaValue(node: TraceNode, layout: Layout): Money {
  const c = compiledLayoutOf(layout).byId.get(node.line);
  if (c === undefined || c.ast === null) throw new RangeError(`版面 ${layout.id} 的 ${node.line} 不是 formula 列`);
  const byLine = new Map(node.children.map((ch) => [ch.line, ch.value]));
  const r = evaluateMoney(c.ast, {
    line: (name) => {
      const v = byLine.get(name);
      if (v === undefined) throw new RangeError(`追蹤樹 ${node.line} 缺少子節點 ${name}`);
      return ratFromInt(v);
    },
  });
  if (!r.ok) throw new RangeError(`版面公式 ${node.line} 求值失敗：${r.error.code}`);
  return r.value.value;
}

/** 非公式節點的值：科目層 sign 乘 amount 的合計、子節點的值、現金行帶號金額 */
export function sumOfParts(node: TraceNode): Money {
  let total = 0;
  for (const a of node.accounts) total += a.sign * a.amount;
  for (const ch of node.children) total += ch.value;
  for (const s of node.sources) total += s.signedAmount;
  return noNegativeZero(total);
}

export function verifyTraceTree(root: TraceNode, layout: Layout, options: VerifyTraceTreeOptions = {}): TraceVerification {
  const failures: TraceInvariantFailure[] = [];
  const run = options.run ?? options.statements?.source.run;
  let nodes = 0;
  const st = options.statements;
  if (st !== undefined) {
    const v = st.lines.get(root.line);
    if (v === undefined) throw new RangeError(`報表 ${st.layoutId} 沒有線 ${root.line}`);
    if (v.value !== root.value) failures.push({ rule: 'root_equals_line', line: root.line, expected: v.value, actual: root.value });
  }
  const visit = (node: TraceNode): void => {
    nodes++;
    const expected = node.rule === 'formula' ? formulaValue(node, layout) : sumOfParts(node);
    if (expected !== node.value)
      failures.push({ rule: node.rule === 'formula' ? 'formula_equals_children' : 'sum_equals_value', line: node.line, expected, actual: node.value });
    for (const a of node.accounts) {
      const sum = noNegativeZero(a.opening + a.sources.reduce((acc, s) => acc + s.signedAmount, 0));
      if (sum !== a.amount) failures.push({ rule: 'account_sources_sum', line: node.line, expected: a.amount, actual: sum, at: a.account });
      if (run !== undefined)
        for (const s of a.sources)
          if (!sourceResolves(run, s))
            failures.push({ rule: 'source_resolves', line: node.line, expected: s.amount, actual: 0, at: `${s.stepId}/${s.lineRef}` });
    }
    if (run !== undefined)
      for (const s of node.sources)
        if (!sourceResolves(run, s)) failures.push({ rule: 'source_resolves', line: node.line, expected: s.amount, actual: 0, at: `${s.stepId}/${s.lineRef}` });
    for (const ch of node.children) visit(ch);
  };
  visit(root);
  return { pass: failures.length === 0, failures, nodes };
}
