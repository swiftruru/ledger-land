// Result 與核心錯誤（04 第 1 節「錯誤是值」、第 6.2 節與第 8 節的錯誤碼）。
// 預期內的錯誤一律以 Result 回傳；只有程式錯誤（例如傳進不合法的型別）才 throw。

export type Result<T, E = CoreError> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** 04 第 6.2 節（驗證順序）與第 8 節（受控運算式）列出的錯誤碼，加上 parser 與型別檢查用的 expr.*、範本建置期檢查的 template.*（04 第 7 節）、故事重播的 story.* 與情境求解的 scenario.*（04 第 15 節） */
export type CoreErrorCode =
  | 'param.out_of_range'
  | 'param.type'
  | 'expr.division_by_zero'
  | 'money.not_integer'
  | 'money.overflow'
  | 'precondition.failed'
  | 'entry.too_few_lines'
  | 'entry.amount_invalid'
  | 'entry.unknown_account'
  | 'entry.not_postable'
  | 'entry.account_disabled'
  | 'entry.unbalanced'
  | 'entry.cf_tag_missing'
  | 'entry.cf_tag_unexpected'
  | 'entry.cf_tag_mismatch'
  | 'entry.inv_tag_missing'
  | 'entry.inv_tag_side'
  | 'balance.negative'
  | 'expr.round_required'
  | 'expr.parse'
  | 'expr.type'
  | 'expr.limit'
  | 'expr.unknown_ref'
  | 'expr.unknown_account'
  | 'expr.unknown_function'
  | 'template.unknown_account'
  | 'template.cf_tag_missing'
  | 'template.cf_tag_unexpected'
  | 'template.cf_tag_mismatch'
  | 'template.inv_tag_missing'
  | 'template.inv_tag_side'
  | 'template.inv_tag_unexpected'
  | 'template.equity_tag_missing'
  | 'template.policy_when_invalid'
  | 'template.duplicate_id'
  | 'template.param_spec_invalid'
  | 'story.unknown_template'
  | 'scenario.unknown_story'
  | 'scenario.unknown_step'
  | 'scenario.opening_unbalanced'
  | 'scenario.opening_invalid_account'
  | 'scenario.unknown_line'
  | 'scenario.unknown_account'
  | 'scenario.unknown_ratio'
  | 'scenario.direction_not_meaningful'
  | 'scenario.direction_ambiguous';

export const CORE_ERROR_CODES: readonly CoreErrorCode[] = [
  'param.out_of_range',
  'param.type',
  'expr.division_by_zero',
  'money.not_integer',
  'money.overflow',
  'precondition.failed',
  'entry.too_few_lines',
  'entry.amount_invalid',
  'entry.unknown_account',
  'entry.not_postable',
  'entry.account_disabled',
  'entry.unbalanced',
  'entry.cf_tag_missing',
  'entry.cf_tag_unexpected',
  'entry.cf_tag_mismatch',
  'entry.inv_tag_missing',
  'entry.inv_tag_side',
  'balance.negative',
  'expr.round_required',
  'expr.parse',
  'expr.type',
  'expr.limit',
  'expr.unknown_ref',
  'expr.unknown_account',
  'expr.unknown_function',
  'template.unknown_account',
  'template.cf_tag_missing',
  'template.cf_tag_unexpected',
  'template.cf_tag_mismatch',
  'template.inv_tag_missing',
  'template.inv_tag_side',
  'template.inv_tag_unexpected',
  'template.equity_tag_missing',
  'template.policy_when_invalid',
  'template.duplicate_id',
  'template.param_spec_invalid',
  'story.unknown_template',
  'scenario.unknown_story',
  'scenario.unknown_step',
  'scenario.opening_unbalanced',
  'scenario.opening_invalid_account',
  'scenario.unknown_line',
  'scenario.unknown_account',
  'scenario.unknown_ratio',
  'scenario.direction_not_meaningful',
  'scenario.direction_ambiguous',
];

/** 帶佔位符的多語文字：核心只給 i18n key 與參數，字串由 UI 層依 05 翻譯與格式化 */
export interface LocalizedMessage {
  readonly key: string;
  readonly params?: Readonly<Record<string, string | number>>;
}

/** 核心錯誤的共用形狀：錯誤碼、訊息 key，其餘欄位（差額、科目、位置）由各錯誤自行附加 */
export interface CoreError {
  readonly code: CoreErrorCode;
  readonly message: LocalizedMessage;
  readonly [k: string]: unknown;
}

/** 訊息 key 的慣例：core.error.<錯誤碼>，參數同時附在 message.params 與錯誤本體，方便 UI 顯示與測試比對 */
export function coreError(code: CoreErrorCode, params?: Readonly<Record<string, string | number>>, extra?: Readonly<Record<string, unknown>>): CoreError {
  return {
    ...extra,
    code,
    message: params === undefined ? { key: `core.error.${code}` } : { key: `core.error.${code}`, params },
  };
}

export const isOk = <T, E>(r: Result<T, E>): r is { readonly ok: true; readonly value: T } => r.ok;
export const isErr = <T, E>(r: Result<T, E>): r is { readonly ok: false; readonly error: E } => !r.ok;

/** 取出成功值；失敗時 throw，只給測試與「已確定不會失敗」的程式路徑使用 */
export function unwrap<T, E>(r: Result<T, E>): T {
  if (r.ok) return r.value;
  throw new Error(`unwrap：Result 是失敗值 ${JSON.stringify(r.error)}`);
}

export function mapResult<T, U, E>(r: Result<T, E>, f: (value: T) => U): Result<U, E> {
  return r.ok ? ok(f(r.value)) : r;
}
