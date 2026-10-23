// Result 與進度模組的錯誤（06 第 4.4、4.6 節）。形狀與 @ledgerland/core 的 Result 相同（progress 不依賴 core，所以在這裡另行宣告）；
// 預期內的錯誤（備份檔壞掉、版本太新、備份碼太長）一律以 Result 回傳，只有程式錯誤才 throw。

export type Result<T, E = ProgressError> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** 06 第 4.6 節匯入驗證六步與 4.3 節 migration 規則對應的錯誤碼 */
export type ProgressErrorCode =
  | 'backup.parse'
  | 'backup.format'
  | 'backup.format_version'
  | 'backup.checksum'
  | 'backup.schema_newer'
  | 'backup.invalid'
  | 'backup.too_large'
  | 'backup.code_prefix'
  | 'backup.code_encoding'
  | 'backup.code_corrupt'
  | 'backup.code_too_long'
  | 'migration.backwards'
  | 'migration.unknown_version'
  | 'migration.failed';

export const PROGRESS_ERROR_CODES: readonly ProgressErrorCode[] = [
  'backup.parse',
  'backup.format',
  'backup.format_version',
  'backup.checksum',
  'backup.schema_newer',
  'backup.invalid',
  'backup.too_large',
  'backup.code_prefix',
  'backup.code_encoding',
  'backup.code_corrupt',
  'backup.code_too_long',
  'migration.backwards',
  'migration.unknown_version',
  'migration.failed',
];

/** 帶佔位符的多語文字：只給 i18n key 與參數，字串由 UI 層翻譯 */
export interface LocalizedMessage {
  readonly key: string;
  readonly params?: Readonly<Record<string, string | number>>;
}

export interface ProgressError {
  readonly code: ProgressErrorCode;
  readonly message: LocalizedMessage;
  readonly [k: string]: unknown;
}

/** 訊息 key 的慣例：progress.error.<錯誤碼>；參數同時附在 message.params 與錯誤本體 */
export function progressError(
  code: ProgressErrorCode,
  params?: Readonly<Record<string, string | number>>,
  extra?: Readonly<Record<string, unknown>>,
): ProgressError {
  return {
    ...extra,
    ...params,
    code,
    message: params === undefined ? { key: `progress.error.${code}` } : { key: `progress.error.${code}`, params },
  };
}

export const isOk = <T, E>(r: Result<T, E>): r is { readonly ok: true; readonly value: T } => r.ok;
export const isErr = <T, E>(r: Result<T, E>): r is { readonly ok: false; readonly error: E } => !r.ok;

/** 取出成功值；失敗時 throw，只給測試與「已確定不會失敗」的程式路徑使用 */
export function unwrap<T, E>(r: Result<T, E>): T {
  if (r.ok) return r.value;
  throw new Error(`unwrap：Result 是失敗值 ${JSON.stringify(r.error)}`);
}
