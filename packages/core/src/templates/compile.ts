// 範本的建置期編譯（04 第 7 節的建置期檢查、第 8.2 節各位置的可用參照）。
// 回傳第一個錯誤；錯誤帶 template（範本 ID）與 where（params、derived、preconditions、lines）與該項目的名稱或 ID。
import type { Chart } from '../accounts/types.ts';
import type { ParamSpec, TransactionTemplate } from '../data/types.ts';
import type { NumericType } from '../expr/ast.ts';
import { type DeclaredRefs, compileExpr } from '../expr/typecheck.ts';
import {
  RETAINED_EARNINGS_ACCOUNT_ID,
  RETAINED_EARNINGS_DEBIT_TAGS,
  cashFlowKindMatches,
  inventoryTagSide,
  isCashAccount,
  isInventoryAccount,
  isInventoryTag,
} from '../journal/validate.ts';
import { POLICY_SWITCH_KEYS, POLICY_SWITCH_VALUES, type PolicyWhen } from '../policy/types.ts';
import { type CoreError, type Result, coreError, err, ok } from '../result.ts';
import type { CompiledDerived, CompiledLine, CompiledPrecondition, CompiledTemplate } from './types.ts';

/** 參數型別對應的運算式型別：money、count、years 是整數，rate 是有理數 */
export function paramNumericType(type: ParamSpec['type']): NumericType {
  return type === 'rate' ? 'rat' : 'int';
}

function withContext(error: CoreError, template: string, where: string, name: string): CoreError {
  return { ...error, template, where, name };
}

/** policyWhen 的鍵必須是政策開關、值必須是該開關允許的值；回傳第一個不合法的鍵 */
export function invalidPolicyWhenKey(policyWhen: PolicyWhen): string | undefined {
  for (const key of Object.keys(policyWhen)) {
    if (!(POLICY_SWITCH_KEYS as readonly string[]).includes(key)) return key;
    const value = policyWhen[key as keyof PolicyWhen];
    if (value === undefined) continue;
    const allowed = POLICY_SWITCH_VALUES[key as keyof PolicyWhen] as readonly string[];
    if (!allowed.includes(value)) return key;
  }
  return undefined;
}

/**
 * 編譯一個範本：參數規格、推導值（依序、只能引用前面的）、前置條件（布林）、分錄行（整數金額、科目存在、現金與存貨標籤、policyWhen）。
 * 範本 ID 與欄位形狀由 content-schema 檢查；這裡只做語意規則。
 */
export function compileTemplate(raw: TransactionTemplate, chart: Chart): Result<CompiledTemplate, CoreError> {
  const tid = raw.id;
  const accounts = new Set(chart.byId.keys());
  const params = new Map<string, NumericType>();
  for (const p of raw.params) {
    if (params.has(p.name)) return err(withContext(coreError('template.duplicate_id', { id: p.name }), tid, 'params', p.name));
    if (!Number.isFinite(p.min) || !Number.isFinite(p.max) || !Number.isFinite(p.default) || p.min > p.max || p.default < p.min || p.default > p.max)
      return err(withContext(coreError('template.param_spec_invalid', { param: p.name, min: p.min, max: p.max, default: p.default }), tid, 'params', p.name));
    if (p.type !== 'rate' && (!Number.isSafeInteger(p.min) || !Number.isSafeInteger(p.max) || !Number.isSafeInteger(p.default)))
      return err(withContext(coreError('template.param_spec_invalid', { param: p.name, reason: 'integer_required', type: p.type }), tid, 'params', p.name));
    params.set(p.name, paramNumericType(p.type));
  }

  const derivedTypes = new Map<string, NumericType>();
  const derived: CompiledDerived[] = [];
  for (const d of raw.derived) {
    if (params.has(d.name) || derivedTypes.has(d.name)) return err(withContext(coreError('template.duplicate_id', { id: d.name }), tid, 'derived', d.name));
    // 只把前面的 derived 放進宣告表，所以引用後面的或自己會得到 expr.unknown_ref
    const declared: DeclaredRefs = { params, derived: new Map(derivedTypes), accounts };
    const ast = compileExpr(d.expr, 'template_derived', declared, d.type === 'money' ? 'int' : 'any');
    if (!ast.ok) return err(withContext(ast.error, tid, 'derived', d.name));
    const type: NumericType = d.type === 'money' ? 'int' : ast.value.valueType === 'bool' ? 'rat' : ast.value.valueType;
    derivedTypes.set(d.name, type);
    derived.push({ name: d.name, type: d.type, expr: d.expr, ast: ast.value, label: d.label });
  }

  const declaredAll: DeclaredRefs = { params, derived: derivedTypes, accounts };
  const preconditions: CompiledPrecondition[] = [];
  const preIds = new Set<string>();
  for (const p of raw.preconditions) {
    if (preIds.has(p.id)) return err(withContext(coreError('template.duplicate_id', { id: p.id }), tid, 'preconditions', p.id));
    preIds.add(p.id);
    const ast = compileExpr(p.expr, 'precondition', declaredAll, 'bool');
    if (!ast.ok) return err(withContext(ast.error, tid, 'preconditions', p.id));
    preconditions.push({ id: p.id, expr: p.expr, ast: ast.value, message: p.message });
  }

  const lines: CompiledLine[] = [];
  const lineIds = new Set<string>();
  for (const l of raw.lines) {
    if (lineIds.has(l.id)) return err(withContext(coreError('template.duplicate_id', { id: l.id }), tid, 'lines', l.id));
    lineIds.add(l.id);
    const account = chart.byId.get(l.account);
    if (account === undefined) return err(withContext(coreError('template.unknown_account', { account: l.account, line: l.id }), tid, 'lines', l.id));
    const ast = compileExpr(l.amount, 'template_line_amount', declaredAll, 'int');
    if (!ast.ok) return err(withContext(ast.error, tid, 'lines', l.id));
    if (isCashAccount(account)) {
      if (l.cf === undefined) return err(withContext(coreError('template.cf_tag_missing', { line: l.id, account: l.account }), tid, 'lines', l.id));
      if (!cashFlowKindMatches(l.cf.activity, l.cf.kind))
        return err(withContext(coreError('template.cf_tag_mismatch', { line: l.id, activity: l.cf.activity, kind: l.cf.kind }), tid, 'lines', l.id));
    } else if (l.cf !== undefined) {
      return err(withContext(coreError('template.cf_tag_unexpected', { line: l.id, account: l.account }), tid, 'lines', l.id));
    }
    if (isInventoryAccount(account)) {
      if (!isInventoryTag(l.tag)) return err(withContext(coreError('template.inv_tag_missing', { line: l.id, account: l.account }), tid, 'lines', l.id));
      if (inventoryTagSide(l.tag) !== l.side)
        return err(withContext(coreError('template.inv_tag_side', { line: l.id, tag: l.tag, side: l.side }), tid, 'lines', l.id));
    } else if (isInventoryTag(l.tag)) {
      return err(withContext(coreError('template.inv_tag_unexpected', { line: l.id, account: l.account, tag: l.tag }), tid, 'lines', l.id));
    } else if (account.id === RETAINED_EARNINGS_ACCOUNT_ID && l.side === 'debit' && (l.tag === undefined || !RETAINED_EARNINGS_DEBIT_TAGS.includes(l.tag))) {
      return err(withContext(coreError('template.equity_tag_missing', { line: l.id, account: l.account }), tid, 'lines', l.id));
    }
    if (l.policyWhen !== undefined) {
      const bad = invalidPolicyWhenKey(l.policyWhen);
      if (bad !== undefined) return err(withContext(coreError('template.policy_when_invalid', { line: l.id, key: bad }), tid, 'lines', l.id));
    }
    const line: CompiledLine = {
      id: l.id,
      account: l.account,
      side: l.side,
      expr: l.amount,
      ast: ast.value,
      ...(l.cf === undefined ? {} : { cf: l.cf }),
      ...(l.tag === undefined ? {} : { tag: l.tag }),
      ...(l.policyWhen === undefined ? {} : { policyWhen: l.policyWhen }),
      ...(l.memo === undefined ? {} : { memo: l.memo }),
    };
    lines.push(line);
  }

  return ok({
    id: raw.id,
    rev: raw.rev,
    revKind: raw.revKind,
    status: raw.status,
    title: raw.title,
    summary: raw.summary,
    explanation: raw.explanation,
    params: raw.params,
    derived,
    preconditions,
    lines,
    termRefs: raw.termRefs,
    pendingRefs: raw.pendingRefs ?? [],
    entryQuestionBlockedBy: raw.entryQuestionBlockedBy ?? [],
    source: raw,
  });
}

/** 編譯一組範本成以 ID 為鍵的 Map；任一範本失敗就回傳該錯誤 */
export function compileTemplates(templates: readonly TransactionTemplate[], chart: Chart): Result<ReadonlyMap<string, CompiledTemplate>, CoreError> {
  const out = new Map<string, CompiledTemplate>();
  for (const raw of templates) {
    if (out.has(raw.id)) return err(coreError('template.duplicate_id', { id: raw.id }, { template: raw.id, where: 'templates', name: raw.id }));
    const compiled = compileTemplate(raw, chart);
    if (!compiled.ok) return compiled;
    out.set(raw.id, compiled.value);
  }
  return ok(out);
}
