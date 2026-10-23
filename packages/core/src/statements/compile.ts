// 版面的建置期編譯（04 第 8.2、11 節）：解析 formula 列的運算式（scope layout_formula，只能引用 line.*）、
// 收集每一列引用的線並做拓撲排序，讓求值能處理前向引用；引用不存在的線回 expr.unknown_ref，循環引用是資料錯誤，直接 throw。
import type { AccountNode, AnyAst, TypedAst } from '../expr/ast.ts';
import { compileExpr } from '../expr/typecheck.ts';
import type { Layout, LayoutLine, StatementId } from '../layout/types.ts';
import { STATEMENT_IDS } from '../layout/types.ts';
import { type CoreError, type Result, coreError, err, ok } from '../result.ts';
import type { LineId } from './types.ts';

export interface CompiledLayoutLine {
  readonly line: LayoutLine;
  readonly statement: StatementId;
  /** formula 列的 TypedAst */
  readonly ast: TypedAst | null;
  /** 求值時引用的線（formula 的 line.*、link 的 from、total 的 sum、balance_end 的 from、retained_earnings 的 netIncomeLine） */
  readonly valueRefs: readonly LineId[];
  /** group 列的 children：只影響顯示，不影響值 */
  readonly childRefs: readonly LineId[];
}

export interface CompiledLayout {
  readonly layout: Layout;
  readonly byId: ReadonlyMap<LineId, CompiledLayoutLine>;
  /** 拓撲順序：每一列都排在它引用的線之後 */
  readonly order: readonly LineId[];
}

function lineRefsOf(node: AnyAst | AccountNode, out: Set<string>): void {
  switch (node.type) {
    case 'ref':
      if (node.ns === 'line') out.add(node.name);
      return;
    case 'unary':
      lineRefsOf(node.operand, out);
      return;
    case 'binary':
      lineRefsOf(node.left, out);
      lineRefsOf(node.right, out);
      return;
    case 'call':
      for (const a of node.args) lineRefsOf(a, out);
      return;
    default:
      return;
  }
}

/** 一列直接引用的線：值的引用與 group 的 children（給追蹤樹與相依檢查） */
export function lineDependencies(layout: Layout, lineId: LineId): { readonly valueRefs: readonly LineId[]; readonly childRefs: readonly LineId[] } {
  const compiled = compileLayout(layout);
  if (!compiled.ok) throw new TypeError(`lineDependencies：版面 ${layout.id} 編譯失敗 ${JSON.stringify(compiled.error)}`);
  const line = compiled.value.byId.get(lineId);
  if (line === undefined) throw new RangeError(`版面 ${layout.id} 沒有線 ${lineId}`);
  return { valueRefs: line.valueRefs, childRefs: line.childRefs };
}

const cache = new WeakMap<Layout, Result<CompiledLayout, CoreError>>();

/** 編譯版面；同一個版面物件只編譯一次 */
export function compileLayout(layout: Layout): Result<CompiledLayout, CoreError> {
  const hit = cache.get(layout);
  if (hit !== undefined) return hit;
  const r = compileLayoutUncached(layout);
  cache.set(layout, r);
  return r;
}

function compileLayoutUncached(layout: Layout): Result<CompiledLayout, CoreError> {
  const ids = new Set<string>();
  for (const s of STATEMENT_IDS) for (const l of layout.statements[s]) ids.add(l.id);
  const declared = { lines: ids };
  const byId = new Map<LineId, CompiledLayoutLine>();
  for (const statement of STATEMENT_IDS) {
    for (const line of layout.statements[statement]) {
      if (byId.has(line.id)) return err(coreError('template.duplicate_id', { line: line.id, layout: layout.id }));
      let ast: TypedAst | null = null;
      const valueRefs: string[] = [];
      const childRefs: string[] = [];
      switch (line.kind) {
        case 'formula': {
          const c = compileExpr(line.expr, 'layout_formula', declared, 'int');
          if (!c.ok) return err({ ...c.error, line: line.id, layout: layout.id });
          ast = c.value;
          const refs = new Set<string>();
          lineRefsOf(ast, refs);
          valueRefs.push(...[...refs].sort());
          break;
        }
        case 'link':
          valueRefs.push(line.from);
          break;
        case 'total':
          valueRefs.push(...line.sum);
          break;
        case 'balance_end':
          valueRefs.push(...line.from);
          break;
        case 'retained_earnings':
          valueRefs.push(line.netIncomeLine);
          break;
        case 'group':
          childRefs.push(...(line.children ?? []));
          break;
        default:
          break;
      }
      for (const ref of [...valueRefs, ...childRefs])
        if (!ids.has(ref)) return err(coreError('expr.unknown_ref', { line: line.id, ref, layout: layout.id }, { line: line.id, ref }));
      byId.set(line.id, { line, statement, ast, valueRefs, childRefs });
    }
  }
  // 拓撲排序（深度優先）：值的引用與 children 都算相依，循環引用是資料錯誤
  const order: LineId[] = [];
  const state = new Map<LineId, 'visiting' | 'done'>();
  const visit = (id: LineId, path: readonly LineId[]): void => {
    const s = state.get(id);
    if (s === 'done') return;
    if (s === 'visiting') throw new TypeError(`compileLayout：版面 ${layout.id} 的線循環引用 ${[...path, id].join(' -> ')}`);
    state.set(id, 'visiting');
    const c = byId.get(id);
    if (c === undefined) throw new RangeError(`compileLayout：版面 ${layout.id} 沒有線 ${id}`);
    for (const ref of [...c.valueRefs, ...c.childRefs]) visit(ref, [...path, id]);
    state.set(id, 'done');
    order.push(id);
  };
  for (const id of byId.keys()) visit(id, []);
  return ok({ layout, byId, order });
}

/** 取已編譯的版面；編譯失敗是資料錯誤（內建版面在 test/data.test.ts 已檢查），直接 throw */
export function compiledLayoutOf(layout: Layout): CompiledLayout {
  const r = compileLayout(layout);
  if (!r.ok) throw new TypeError(`版面 ${layout.id} 編譯失敗：${JSON.stringify(r.error)}`);
  return r.value;
}
