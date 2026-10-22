// 格式化函式（05 第 10 節）。所有數字格式器一律 signDisplay: 'negative'，只有變動值（sign 選項）改用 exceptJero；格式化前把 -0 改成 0。
import type { Locale } from './locales.ts';
import { getLocale } from './match.ts';

const cache = new Map<string, Intl.NumberFormat>();
const dateCache = new Map<string, Intl.DateTimeFormat>();

function nf(locale: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(opts)}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, { numberingSystem: 'latn', signDisplay: 'negative', ...opts });
    cache.set(key, f);
  }
  return f;
}

export const noNegZero = (v: number): number => (Object.is(v, -0) ? 0 : v);

/** sign 選項：變動值改用 exceptZero（正數帶 +，0 不帶正負號），是 signDisplay: 'negative' 的唯一例外 */
const signOpt = (sign: boolean): Intl.NumberFormatOptions => (sign ? { signDisplay: 'exceptZero' } : {});

export interface MoneyOptions {
  /** 小數位數，TWD 為 0 */
  scale?: number;
  /** 變動值：正數帶 + */
  sign?: boolean;
}

/** 金額：兩種語系都顯示 NT$（只信任 Intl 的數字、千分位與負號，currency 部分換成登錄檔的 symbol） */
export function formatMoney(value: number, code: Locale, { scale = 0, sign = false }: MoneyOptions = {}): string {
  const def = getLocale(code);
  const opts: Intl.NumberFormatOptions = { minimumFractionDigits: scale, maximumFractionDigits: scale, ...signOpt(sign) };
  const parts = nf(def.intlLocale, { style: 'currency', currency: 'TWD', currencyDisplay: 'symbol', ...opts }).formatToParts(noNegZero(value));
  return parts.map((p) => (p.type === 'currency' ? def.money.symbol : p.type === 'literal' ? '' : p.value)).join('');
}

/** 報表、輸入框與一般數值：千分位、固定小數位數 */
export function formatNumber(value: number, code: Locale, { digits, sign = false }: { digits?: number; sign?: boolean } = {}): string {
  const def = getLocale(code);
  const opts: Intl.NumberFormatOptions =
    digits === undefined ? { maximumFractionDigits: 20 } : { minimumFractionDigits: digits, maximumFractionDigits: digits };
  return nf(def.intlLocale, { style: 'decimal', ...opts, ...signOpt(sign) }).format(noNegZero(value));
}

/** 百分比：0.0734 代表 7.34%，預設 2 位小數 */
export function formatPercent(value: number, code: Locale, { digits = 2, sign = false }: { digits?: number; sign?: boolean } = {}): string {
  const def = getLocale(code);
  return nf(def.intlLocale, { style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits, ...signOpt(sign) }).format(noNegZero(value));
}

/** 帶單位的數值（天、倍）：複數判斷用和顯示相同的小數位數（05 第 3.3 節） */
export function formatUnit(value: number, code: Locale, unit: 'day' | 'times', { digits, sign = false }: { digits?: number; sign?: boolean } = {}): string {
  const def = getLocale(code);
  const n = formatNumber(value, code, { digits, sign });
  const pr = new Intl.PluralRules(def.intlLocale, digits === undefined ? {} : { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const pattern = def.units[unit];
  const category = pr.select(Math.abs(noNegZero(value)));
  const chosen = (category === 'one' && pattern.one) || pattern.other;
  return chosen.replace('{n}', n);
}

/** 「萬元 / million」規則（05 第 10.4 節）：找不到能精確表示的級距時擲出錯誤，由內容驗證器攔下 */
export function formatMoneyCompact(value: number, code: Locale): string {
  const def = getLocale(code);
  const v = noNegZero(value);
  const abs = Math.abs(v);
  for (const rule of def.compact) {
    if (abs < rule.minAbs) continue;
    const scaled = abs / rule.factor;
    const rounded = Number(scaled.toFixed(rule.maxFractionDigits));
    if (Math.abs(rounded * rule.factor - abs) > 1e-6) continue;
    // 負號放在整個 pattern 前面（例如 -NT$2.48 million、-248 萬元），不放在數字前
    const n = nf(def.intlLocale, { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: rule.maxFractionDigits }).format(rounded);
    return (v < 0 ? '-' : '') + rule.pattern.replace('{n}', n);
  }
  throw new Error(`金額 ${value} 在 ${code} 沒有能精確表示的 compact 級距`);
}

/** 日曆日（ISO 日期字串），一律以 UTC 解析，避免某些時區顯示成前一天 */
export function formatDate(iso: string, code: Locale, style?: 'long' | 'medium'): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error(`不是 ISO 日期：${iso}`);
  const def = getLocale(code);
  const dateStyle = style ?? def.dateStyle;
  const key = `${def.intlLocale}|${dateStyle}`;
  let f = dateCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(def.intlLocale, { dateStyle, timeZone: 'UTC' });
    dateCache.set(key, f);
  }
  return f.format(new Date(`${iso}T00:00:00Z`));
}

/** formatToParts 往返檢查用（05 第 10.5 節第 4 條）：把 parts 組回數字 */
export function partsToNumber(parts: Intl.NumberFormatPart[]): number {
  let s = '';
  for (const p of parts) {
    if (p.type === 'minusSign') s += '-';
    else if (p.type === 'integer' || p.type === 'fraction') s += p.value;
    else if (p.type === 'decimal') s += '.';
  }
  return Number(s);
}

/** 金額的 parts（給往返檢查） */
export function moneyParts(value: number, code: Locale, scale = 0): Intl.NumberFormatPart[] {
  const def = getLocale(code);
  return nf(def.intlLocale, {
    style: 'currency',
    currency: 'TWD',
    currencyDisplay: 'symbol',
    minimumFractionDigits: scale,
    maximumFractionDigits: scale,
  }).formatToParts(noNegZero(value));
}
