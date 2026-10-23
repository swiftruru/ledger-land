// 指標登錄檔（04 第 12 節）：由 RatioDefinition 建索引，把每個版本的公式以受控運算式（ratio_formula 情境，04 第 8.2 節）編譯成 TypedAst，
// 記下用到的線、輸入與連鎖來源，並檢查連鎖沒有循環。版面的線 ID 集合由 layoutLineIds 從四張表（含 hidden 列）收集。
// 公式錯誤（解析、型別、未宣告的參照）以 Result 回報；資料形狀不合（版本同時有分數與 expr、連鎖循環、ID 重複）是建置期的程式錯誤，直接 throw。
import { defaultRatios, teacherLayout } from '../data/index.ts';
import { RATIO_VERSION_IDS, type RatioDefinition, type RatioVersion, type RatioVersionId } from '../data/types.ts';
import { type AccountNode, type TypedAst, ratioRefOf } from '../expr/ast.ts';
import { type DeclaredRefs, compileExpr } from '../expr/typecheck.ts';
import { STATEMENT_IDS, type Layout } from '../layout/types.ts';
import { type CoreError, type Result, err, ok, unwrap } from '../result.ts';
import type { CompiledRatioFormula, CompiledRatioVersion, RatioRegistry } from './types.ts';

const RATIO_REF_RE = /^([a-z][a-z0-9_]*)@([a-z][a-z0-9_]*)$/;

export const isRatioVersionId = (s: string): s is RatioVersionId => (RATIO_VERSION_IDS as readonly string[]).includes(s);

/** <id>@<version> */
export function ratioRefString(id: string, version: RatioVersionId): string {
  return `${id}@${version}`;
}

/** 拆開 ratioRef；格式或版本不合法回傳 undefined */
export function parseRatioRef(ratioRef: string): { readonly id: string; readonly version: RatioVersionId } | undefined {
  const m = RATIO_REF_RE.exec(ratioRef);
  if (m === null) return undefined;
  const version = m[2] as string;
  if (!isRatioVersionId(version)) return undefined;
  return { id: m[1] as string, version };
}

/** 版面四張表的所有線 ID（含 hidden 的計算列），供指標公式的 declared.lines 使用 */
export function layoutLineIds(layout: Layout): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const statement of STATEMENT_IDS) for (const line of layout.statements[statement]) ids.add(line.id);
  return ids;
}

function collectRefs(node: TypedAst | AccountNode, lines: Set<string>, inputs: Set<string>, ratios: Set<string>): void {
  switch (node.type) {
    case 'number':
    case 'account':
      return;
    case 'ref':
      if (node.ns === 'line') lines.add(node.name);
      else if (node.ns === 'input') inputs.add(node.name);
      else ratios.add(ratioRefOf(node));
      return;
    case 'unary':
      collectRefs(node.operand, lines, inputs, ratios);
      return;
    case 'binary':
      collectRefs(node.left, lines, inputs, ratios);
      collectRefs(node.right, lines, inputs, ratios);
      return;
    case 'call':
      for (const a of node.args) collectRefs(a, lines, inputs, ratios);
      return;
  }
}

function withRatioContext(error: CoreError, ratioRef: string, part: string): CoreError {
  return { ...error, ratioRef, part };
}

function compileVersion(
  definition: RatioDefinition,
  version: RatioVersionId,
  spec: RatioVersion,
  declaredLines: ReadonlySet<string>,
  allRefs: ReadonlySet<string>,
): Result<CompiledRatioVersion, CoreError> {
  const ratioRef = ratioRefString(definition.id, version);
  const declared: DeclaredRefs = { lines: declaredLines, inputs: new Set(Object.keys(spec.inputs ?? {})), ratios: allRefs };
  const compile = (source: string, part: string): Result<TypedAst, CoreError> => {
    const r = compileExpr(source, 'ratio_formula', declared, 'rat');
    return r.ok ? r : err(withRatioContext(r.error, ratioRef, part));
  };

  const hasFraction = spec.numerator !== undefined || spec.denominator !== undefined;
  if (hasFraction === (spec.expr !== undefined))
    throw new TypeError(`compileRatioRegistry：${ratioRef} 必須恰好是分數（numerator 與 denominator）或 expr 其中一種`);
  if (hasFraction && (spec.numerator === undefined || spec.denominator === undefined))
    throw new TypeError(`compileRatioRegistry：${ratioRef} 的 numerator 與 denominator 必須同時存在`);

  let formula: CompiledRatioFormula;
  if (spec.numerator !== undefined && spec.denominator !== undefined) {
    const numerator = compile(spec.numerator, 'numerator');
    if (!numerator.ok) return numerator;
    const denominator = compile(spec.denominator, 'denominator');
    if (!denominator.ok) return denominator;
    formula = { kind: 'fraction', numerator: numerator.value, denominator: denominator.value, denominatorSource: spec.denominator };
  } else {
    const expr = compile(spec.expr as string, 'expr');
    if (!expr.ok) return expr;
    formula = { kind: 'expr', expr: expr.value, source: spec.expr as string };
  }

  let base: TypedAst | undefined;
  if (spec.notMeaningfulWhen.includes('base_not_positive')) {
    if (spec.notMeaningfulBase === undefined)
      throw new TypeError(`compileRatioRegistry：${ratioRef} 的 notMeaningfulWhen 含 base_not_positive，但沒有 notMeaningfulBase`);
    const compiled = compile(spec.notMeaningfulBase, 'notMeaningfulBase');
    if (!compiled.ok) return compiled;
    base = compiled.value;
  }

  const lines = new Set<string>();
  const inputs = new Set<string>();
  const ratios = new Set<string>();
  if (formula.kind === 'fraction') {
    collectRefs(formula.numerator, lines, inputs, ratios);
    collectRefs(formula.denominator, lines, inputs, ratios);
  } else {
    collectRefs(formula.expr, lines, inputs, ratios);
  }
  if (base !== undefined) collectRefs(base, lines, inputs, ratios);

  const inputDefaults = new Map<string, number | null>();
  for (const [name, input] of Object.entries(spec.inputs ?? {})) inputDefaults.set(name, input.default);

  return ok({
    ratioRef,
    id: definition.id,
    version,
    definition,
    spec,
    formula,
    ...(base === undefined ? {} : { base }),
    lineRefs: [...lines],
    inputRefs: [...inputs],
    ratioRefs: [...ratios],
    inputDefaults,
  });
}

/** 深度優先找連鎖循環；有循環是資料錯誤，直接 throw 並列出路徑 */
function assertAcyclic(versions: ReadonlyMap<string, CompiledRatioVersion>): void {
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];
  const visit = (ref: string): void => {
    const s = state.get(ref);
    if (s === 'done') return;
    if (s === 'visiting') throw new Error(`compileRatioRegistry：連鎖指標循環 ${[...stack.slice(stack.indexOf(ref)), ref].join(' -> ')}`);
    state.set(ref, 'visiting');
    stack.push(ref);
    for (const source of versions.get(ref)!.ratioRefs) visit(source);
    stack.pop();
    state.set(ref, 'done');
  };
  for (const ref of versions.keys()) visit(ref);
}

/**
 * 建立指標登錄檔：declaredLines 是版面的線 ID 集合（layoutLineIds）；每個版本的 declared.inputs 是該版本的 inputs 鍵，declared.ratios 是全部 ratioRef。
 * 公式錯誤回傳 Result 失敗值（附 ratioRef 與 part）；資料形狀不合或連鎖循環 throw。
 */
export function compileRatioRegistry(definitions: readonly RatioDefinition[], declaredLines: ReadonlySet<string>): Result<RatioRegistry, CoreError> {
  const byId = new Map<string, RatioDefinition>();
  const allRefs = new Set<string>();
  for (const definition of definitions) {
    if (byId.has(definition.id)) throw new Error(`compileRatioRegistry：指標 ID 重複 ${definition.id}`);
    byId.set(definition.id, definition);
    for (const version of RATIO_VERSION_IDS) if (definition.versions[version] !== undefined) allRefs.add(ratioRefString(definition.id, version));
  }
  const versions = new Map<string, CompiledRatioVersion>();
  for (const definition of definitions) {
    for (const version of RATIO_VERSION_IDS) {
      const spec = definition.versions[version];
      if (spec === undefined) continue;
      const compiled = compileVersion(definition, version, spec, declaredLines, allRefs);
      if (!compiled.ok) return compiled;
      versions.set(compiled.value.ratioRef, compiled.value);
    }
  }
  assertAcyclic(versions);
  return ok({ definitions, byId, versions });
}

/** 以 ratioRef 取編譯後的版本；沒有這個版本回傳 undefined */
export function getRatioVersion(registry: RatioRegistry, ratioRef: string): CompiledRatioVersion | undefined {
  return registry.versions.get(ratioRef);
}

let cachedDefault: RatioRegistry | undefined;

/** 內建資料（data/ratios.json 與 teacher@1 版面）的登錄檔；第一次呼叫時編譯，之後共用 */
export function defaultRatioRegistry(): RatioRegistry {
  cachedDefault ??= unwrap(compileRatioRegistry(defaultRatios, layoutLineIds(teacherLayout)));
  return cachedDefault;
}
