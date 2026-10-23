// 指標計算（04 第 12 節）：狀態判定順序固定為 na → not_meaningful → zero → ok（第 12.6 節）。
// na：必要輸入缺少；除法型連鎖的來源為 na 或 0、加總與乘積型連鎖的來源為 na；分母恰為 0（精確判定）。
// not_meaningful：來源為 not_meaningful；分母為負（denominator_negative）；基數不為正（base_not_positive，看 notMeaningfulBase）。
// zero：分子精確為 0。excel 版 not_meaningful 仍算出數值（表 B 的 DOL、DFL 行為），其他版本為 null。-0 一律改成 0。
import type { RatioVersionId } from '../data/types.ts';
import { type EvalEnv, evaluateRat } from '../expr/evaluate.ts';
import type { TypedAst } from '../expr/ast.ts';
import {
  type Money,
  type Rat,
  rat,
  ratFromDecimalString,
  ratFromExact,
  ratFromInt,
  ratIsNegative,
  ratIsZero,
  ratMul,
  ratToDisplay,
  ratToExact,
  ratToNumber,
} from '../money.ts';
import type { LocalizedMessage } from '../result.ts';
import { defaultRatioRegistry } from './registry.ts';
import type { CompiledRatioVersion, ComputeRatioOptions, MeasureMap, RatioInputs, RatioRegistry, RatioResult, RatioStatus } from './types.ts';

export type RatioReasonKey =
  'denominator_zero' | 'chained_source_na_or_zero' | 'chained_source_na' | 'chained_source_not_meaningful' | 'negative_base' | 'missing_input';

export const RATIO_REASON_KEYS: readonly RatioReasonKey[] = [
  'denominator_zero',
  'chained_source_na_or_zero',
  'chained_source_na',
  'chained_source_not_meaningful',
  'negative_base',
  'missing_input',
];

const reason = (key: RatioReasonKey, params: Readonly<Record<string, string | number>>): LocalizedMessage => ({ key: `ratio.reason.${key}`, params });

const normaliseZero = (v: number): number => (Object.is(v, -0) ? 0 : v);

const NUMBER_RE = /^(-?\d+(?:\.\d+)?)(?:e([+-]\d+))?$/;

/** 輸入值（number）轉精確有理數：安全整數直接轉，其餘依十進位字面值（含指數寫法）還原；非有限數是程式錯誤 */
export function ratFromNumber(n: number): Rat {
  if (!Number.isFinite(n)) throw new TypeError(`ratFromNumber：不是有限數 ${String(n)}`);
  if (Number.isSafeInteger(n)) return ratFromInt(n);
  const m = NUMBER_RE.exec(String(n));
  if (m === null) throw new TypeError(`ratFromNumber：無法解析 ${String(n)}`);
  const mantissa = ratFromDecimalString(m[1] as string);
  if (m[2] === undefined) return mantissa;
  const exponent = Number(m[2]);
  const scale = 10n ** BigInt(Math.abs(exponent));
  return exponent >= 0 ? ratMul(mantissa, ratFromInt(scale)) : ratMul(mantissa, rat(1n, scale));
}

function measureToRat(id: string, v: Money | Rat): Rat {
  if (typeof v === 'number') return ratFromInt(v);
  if (typeof v === 'object' && v !== null && typeof v.num === 'bigint' && typeof v.den === 'bigint') return rat(v.num, v.den);
  throw new TypeError(`computeRatio：線 ${id} 的值不是 Money 或 Rat`);
}

function measureLookup(measures: MeasureMap): Map<string, Rat> {
  const out = new Map<string, Rat>();
  for (const [id, v] of Object.entries(measures)) out.set(id, measureToRat(id, v));
  return out;
}

interface Context {
  readonly registry: RatioRegistry;
  readonly line: ReadonlyMap<string, Rat>;
  readonly opening: ReadonlyMap<string, Rat> | undefined;
  readonly inputs: ReadonlyMap<string, number | null>;
  readonly memo: Map<string, RatioResult>;
}

function makeContext(registry: RatioRegistry, measures: MeasureMap, inputs: RatioInputs, options: ComputeRatioOptions): Context {
  return {
    registry,
    line: measureLookup(measures),
    opening: options.opening === undefined ? undefined : measureLookup(options.opening),
    inputs: new Map(Object.entries(inputs)),
    memo: new Map(),
  };
}

/** 求值；唯一的預期錯誤是 expr.division_by_zero，回傳 undefined 由呼叫端判為 na */
function evalPart(ast: TypedAst, env: EvalEnv, flags: Set<string>): Rat | undefined {
  const r = evaluateRat(ast, env);
  if (!r.ok) return undefined;
  for (const f of r.value.flags) flags.add(f);
  return r.value.value;
}

function makeResult(
  cv: CompiledRatioVersion,
  status: RatioStatus,
  exact: Rat | null,
  why: LocalizedMessage | null,
  flags: ReadonlySet<string>,
  inputs: Readonly<Record<string, number | null>>,
): RatioResult {
  const displayBase = exact === null ? null : cv.spec.unit === 'percent' ? ratMul(exact, ratFromInt(100)) : exact;
  return {
    ratioRef: cv.ratioRef,
    status,
    exact: exact === null ? null : ratToExact(exact),
    value: exact === null ? null : normaliseZero(ratToNumber(exact)),
    displayValue: displayBase === null ? null : normaliseZero(ratToDisplay(displayBase, cv.spec.displayDecimals)),
    reason: why,
    flags: [...flags],
    inputs,
  };
}

function notMeaningfulReason(
  cv: CompiledRatioVersion,
  den: Rat | undefined,
  env: EvalEnv,
  flags: Set<string>,
  sourceNm: RatioResult | undefined,
): LocalizedMessage | null {
  if (sourceNm !== undefined) return reason('chained_source_not_meaningful', { source: sourceNm.ratioRef });
  if (den !== undefined && cv.spec.notMeaningfulWhen.includes('denominator_negative') && ratIsNegative(den))
    return reason('negative_base', { base: cv.formula.kind === 'fraction' ? cv.formula.denominatorSource : cv.formula.source });
  if (cv.base !== undefined) {
    const base = evalPart(cv.base, env, flags);
    if (base === undefined || base.num <= 0n) return reason('negative_base', { base: cv.spec.notMeaningfulBase as string });
  }
  return null;
}

function computeVersion(ctx: Context, cv: CompiledRatioVersion): RatioResult {
  const used: [string, number | null][] = [];
  const flags = new Set<string>(cv.spec.flags);

  for (const id of cv.lineRefs) {
    const v = ctx.line.get(id);
    if (v === undefined) throw new Error(`computeRatio：${cv.ratioRef} 需要線 ${id}，但 measures 沒有提供`);
    used.push([`line.${id}`, ratToNumber(v)]);
  }

  const inputEnv = new Map<string, Rat>();
  const missing: string[] = [];
  for (const name of cv.inputRefs) {
    const raw = (ctx.inputs.has(name) ? ctx.inputs.get(name) : cv.inputDefaults.get(name)) ?? null;
    used.push([`input.${name}`, raw]);
    if (raw === null) missing.push(name);
    else inputEnv.set(name, ratFromNumber(raw));
  }

  const sources = cv.ratioRefs.map((ref) => computeIn(ctx, ref));
  const ratioEnv = new Map<string, Rat>();
  for (const s of sources) {
    used.push([`ratio.${s.ratioRef.replace('@', '.')}`, s.value]);
    for (const f of s.flags) flags.add(f);
    if (s.exact !== null) ratioEnv.set(s.ratioRef, ratFromExact(s.exact));
  }
  const inputs: Readonly<Record<string, number | null>> = Object.fromEntries(used);
  const finish = (status: RatioStatus, exact: Rat | null, why: LocalizedMessage | null): RatioResult => makeResult(cv, status, exact, why, flags, inputs);

  // na
  if (missing.length > 0) return finish('na', null, reason('missing_input', { input: missing.join(', ') }));
  const naOrZero = cv.spec.naWhen.includes('chained_source_na_or_zero');
  for (const s of sources) {
    if (s.status === 'na') return finish('na', null, reason(naOrZero ? 'chained_source_na_or_zero' : 'chained_source_na', { source: s.ratioRef }));
    if (naOrZero && s.status === 'zero') return finish('na', null, reason('chained_source_na_or_zero', { source: s.ratioRef }));
  }
  // 來源是 not_meaningful 又沒有數值（非 excel 版）時無法求值，直接判為 not_meaningful
  const sourceNm = sources.find((s) => s.status === 'not_meaningful');
  if (sourceNm !== undefined && sources.some((s) => s.exact === null))
    return finish('not_meaningful', null, notMeaningfulReason(cv, undefined, {}, flags, sourceNm));

  const env: EvalEnv = { line: ctx.line, lineOpening: ctx.opening, input: inputEnv, ratio: ratioEnv };
  let num: Rat;
  let den: Rat | undefined;
  if (cv.formula.kind === 'fraction') {
    const n = evalPart(cv.formula.numerator, env, flags);
    const d = evalPart(cv.formula.denominator, env, flags);
    if (n === undefined || d === undefined || ratIsZero(d))
      return finish('na', null, reason('denominator_zero', { denominator: cv.formula.denominatorSource }));
    num = n;
    den = d;
  } else {
    const v = evalPart(cv.formula.expr, env, flags);
    if (v === undefined) return finish('na', null, reason('denominator_zero', { denominator: cv.formula.source }));
    num = v;
  }
  const exact = den === undefined ? num : ratMul(num, rat(den.den, den.num));

  // not_meaningful
  const nm = notMeaningfulReason(cv, den, env, flags, sourceNm);
  if (nm !== null) return finish('not_meaningful', cv.version === 'excel' ? exact : null, nm);

  // zero 與 ok
  return ratIsZero(num) ? finish('zero', exact, null) : finish('ok', exact, null);
}

function computeIn(ctx: Context, ratioRef: string): RatioResult {
  const memo = ctx.memo.get(ratioRef);
  if (memo !== undefined) return memo;
  const cv = ctx.registry.versions.get(ratioRef);
  if (cv === undefined) throw new Error(`computeRatio：登錄檔沒有 ${ratioRef}`);
  const result = computeVersion(ctx, cv);
  ctx.memo.set(ratioRef, result);
  return result;
}

/**
 * 計算一個指標版本。measures 的鍵是線 ID、值是期末值；inputs 沒給的鍵用版本預設值；連鎖來源遞迴計算，狀態與旗標往上傳。
 * ratioRef 不在登錄檔、或公式需要的線不在 measures 裡，是程式錯誤（throw）。
 */
export function computeRatio(
  ratioRef: string,
  measures: MeasureMap,
  inputs: RatioInputs = {},
  registry: RatioRegistry = defaultRatioRegistry(),
  options: ComputeRatioOptions = {},
): RatioResult {
  return computeIn(makeContext(registry, measures, inputs, options), ratioRef);
}

/** 計算登錄檔裡的所有版本（可用 versionFilter 只取某些版本），順序同登錄檔；連鎖來源只算一次 */
export function computeAllRatios(
  measures: MeasureMap,
  inputs: RatioInputs = {},
  versionFilter?: readonly RatioVersionId[],
  registry: RatioRegistry = defaultRatioRegistry(),
  options: ComputeRatioOptions = {},
): readonly RatioResult[] {
  const ctx = makeContext(registry, measures, inputs, options);
  const filter = versionFilter === undefined ? undefined : new Set<RatioVersionId>(versionFilter);
  const out: RatioResult[] = [];
  for (const cv of registry.versions.values()) if (filter === undefined || filter.has(cv.version)) out.push(computeIn(ctx, cv.ratioRef));
  return out;
}
