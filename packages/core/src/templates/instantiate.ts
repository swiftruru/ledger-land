// 範本實例化（04 第 6.2 節順序 1 到 5）：參數、推導值、前置條件、政策篩選、移除 0 行。
// balance(id) 與 cost(id) 看「這個事件之前」的狀態（04 第 8.2 節）；分錄驗證（順序 6 到 11）與餘額規則（12）由 journal 與 ledger 負責。
import { normalSign } from '../accounts/chart.ts';
import type { ParamSpec } from '../data/types.ts';
import { type EvalEnv, evaluateBool, evaluateMoney, evaluateRat } from '../expr/evaluate.ts';
import type { JournalLine } from '../journal/types.ts';
import type { LedgerState } from '../ledger/types.ts';
import { type Money, type Rat, ratFromDecimalString, ratFromInt, ratIsInteger } from '../money.ts';
import { policyWhenMatches } from '../policy/policies.ts';
import type { PolicyDefinition } from '../policy/types.ts';
import { type CoreError, type Result, coreError, err, ok } from '../result.ts';
import type { CompiledTemplate, DerivedValue, InstantiatedTemplate, ParamValues } from './types.ts';

export interface InstantiateContext {
  /** 事件 ID（e1），分錄行的 ref 寫成 '<eventId>.<lineId>' */
  readonly eventId: string;
}

const DECIMAL_RE = /^-?\d+(?:\.\d+)?$/;

/** 參數值轉有理數：型別（整數型必須是安全整數、rate 必須是有限的十進位數）與範圍 */
export function paramToRat(spec: ParamSpec, value: number): Result<Rat, CoreError> {
  if (typeof value !== 'number' || !Number.isFinite(value)) return err(coreError('param.type', { param: spec.name, type: spec.type, value: String(value) }));
  if (spec.type !== 'rate' && !Number.isSafeInteger(value)) return err(coreError('param.type', { param: spec.name, type: spec.type, value: String(value) }));
  if (value < spec.min || value > spec.max) return err(coreError('param.out_of_range', { param: spec.name, value, min: spec.min, max: spec.max }));
  if (spec.type !== 'rate') return ok(ratFromInt(value));
  const text = String(value);
  if (!DECIMAL_RE.test(text)) return err(coreError('param.type', { param: spec.name, type: spec.type, value: text }));
  return ok(ratFromDecimalString(text));
}

/** 該科目在這個事件之前的正常餘額（借方減貸方乘上正常方向） */
function readBalance(state: LedgerState, id: string): Money | undefined {
  const account = state.chart.byId.get(id);
  if (account === undefined) return undefined;
  const normal = (state.balances[id] ?? 0) * normalSign(account);
  return normal === 0 ? 0 : normal;
}

function toDerivedValue(r: Rat): DerivedValue {
  return ratIsInteger(r) ? Number(r.num) : `${r.num.toString()}/${r.den.toString()}`;
}

/**
 * 依 04 第 6.2 節順序 1 到 5 產生分錄：
 * 1 參數型別與範圍（缺的用 default；多出的參數是 param.type）；2 依序求推導值；3 前置條件；4 依政策篩選 policyWhen、求每行金額；5 移除金額為 0 的行。
 */
export function instantiateTemplate(
  t: CompiledTemplate,
  params: ParamValues,
  state: LedgerState,
  policy: PolicyDefinition,
  ctx: InstantiateContext,
): Result<InstantiatedTemplate, CoreError> {
  const paramRats = new Map<string, Rat>();
  const paramValues: Record<string, number> = {};
  const derivedValues: Record<string, DerivedValue> = {};
  const specNames = new Set(t.params.map((p) => p.name));
  for (const name of Object.keys(params)) {
    if (!specNames.has(name)) return err(coreError('param.type', { param: name, reason: 'not_declared', template: t.id }));
  }
  for (const spec of t.params) {
    const value = Object.hasOwn(params, spec.name) ? (params[spec.name] as number) : spec.default;
    const r = paramToRat(spec, value);
    if (!r.ok) return r;
    paramRats.set(spec.name, r.value);
    paramValues[spec.name] = value;
    derivedValues[spec.name] = toDerivedValue(r.value);
  }

  const derivedRats = new Map<string, Rat>();
  const env: EvalEnv = {
    param: paramRats,
    derived: derivedRats,
    balance: (id) => readBalance(state, id),
    cost: (id) => (state.chart.byId.has(id) ? (state.costs[id] ?? 0) : undefined),
  };
  for (const d of t.derived) {
    if (d.type === 'money') {
      const r = evaluateMoney(d.ast, env);
      if (!r.ok) return err({ ...r.error, derived: d.name, template: t.id });
      derivedRats.set(d.name, ratFromInt(r.value.value));
      derivedValues[d.name] = r.value.value;
    } else {
      const r = evaluateRat(d.ast, env);
      if (!r.ok) return err({ ...r.error, derived: d.name, template: t.id });
      derivedRats.set(d.name, r.value.value);
      derivedValues[d.name] = toDerivedValue(r.value.value);
    }
  }

  for (const p of t.preconditions) {
    const r = evaluateBool(p.ast, env);
    if (!r.ok) return err({ ...r.error, precondition: p.id, template: t.id });
    if (!r.value) return err(coreError('precondition.failed', { precondition: p.id, template: t.id }, { precondition: p.id, preconditionMessage: p.message }));
  }

  const lines: JournalLine[] = [];
  const removedZeroLines: string[] = [];
  for (const l of t.lines) {
    if (!policyWhenMatches(policy.switches, l.policyWhen)) continue;
    const r = evaluateMoney(l.ast, env);
    if (!r.ok) return err({ ...r.error, line: l.id, template: t.id });
    const ref = `${ctx.eventId}.${l.id}`;
    if (r.value.value === 0) {
      removedZeroLines.push(ref);
      continue;
    }
    lines.push({
      ref,
      account: l.account,
      side: l.side,
      amount: r.value.value,
      ...(l.cf === undefined ? {} : { cf: l.cf }),
      ...(l.tag === undefined ? {} : { tag: l.tag }),
    });
  }

  return ok({
    entry: { eventId: ctx.eventId, template: t.id, lines },
    paramValues,
    derivedValues,
    removedZeroLines,
    noEffect: lines.length === 0,
  });
}
