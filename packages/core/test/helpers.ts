// 資料測試共用的小工具：文字規則（台灣用語、不用破折號、英式拼字）與 ID 格式
import { expect } from 'vitest';

/** 08 第 4.1 節：tm_ 加 8 碼 Crockford Base32 小寫（不含 i、l、o、u） */
export const TERM_ID_RE = /^tm_[0-9abcdefghjkmnpqrstvwxyz]{8}$/;

/** content/terms/ 已存在的名詞卡，科目與指標的 termRef 不得和它們重複 */
export const WRITTEN_TERM_IDS: ReadonlySet<string> = new Set(['tm_h6p2k9wd', 'tm_r4w8n2qe', 'tm_x3n8v5tc']);

const DASH = /[–—―]/;
const US_SPELLING = /\b(organiz|amortiz|capitaliz|recogniz|analyz|color\b|center\b|favorite\b)/i;

export function expectNoDash(s: string): void {
  expect(DASH.test(s), `含破折號：${s}`).toBe(false);
}

export function expectBritish(s: string): void {
  expect(US_SPELLING.test(s), `疑似美式拼字：${s}`).toBe(false);
}

/** 遞迴取出物件裡所有字串值 */
export function allStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(allStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(allStrings);
  return [];
}

/** 受控運算式裡引用的 ns.ident（param.x、derived.y、line.z、ratio.a.b、input.c） */
export function refsOf(expr: string, ns: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`\\b${ns}\\.([a-z][A-Za-z0-9_]*(?:\\.[a-z][a-z0-9_]*)?)`, 'g');
  for (const m of expr.matchAll(re)) out.push(m[1]!);
  return out;
}

/** balance(id)、cost(id) 引用的科目 */
export function accountRefsOf(expr: string): string[] {
  return [...expr.matchAll(/\b(?:balance|cost)\(([a-z][a-z0-9_]*)\)/g)].map((m) => m[1]!);
}
