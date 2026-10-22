// 共用函式（05 第 2.4 節）：取得登錄檔項目、比對瀏覽器語言、退回鏈、登錄檔自我檢查
import { BASE_LOCALE, LOCALES, PATH_WORDS, type Locale } from './locales.ts';
import type { LocaleDef } from './types.ts';

export function getLocale(code: Locale): LocaleDef {
  const def = LOCALES.find((l) => l.code === code);
  if (!def) throw new Error(`Unknown locale: ${code}`);
  return def;
}

export function isLocale(value: string): value is Locale {
  return LOCALES.some((l) => l.code === value);
}

/** 依 navigator.languages 的順序找第一個符合的語系，都不符合就用基準語系 */
export function matchLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const lower = tag.toLowerCase();
    const hit = LOCALES.find((l) => l.match.some((m) => lower === m.toLowerCase() || lower.startsWith(`${m.toLowerCase()}-`)));
    if (hit) return hit.code;
  }
  return BASE_LOCALE;
}

/** 只用來決定要不要顯示切換提示（05 第 8.3 節第 3 點）：有比對到才回傳語系，否則 null */
export function matchLocaleOrNull(preferred: readonly string[]): Locale | null {
  for (const tag of preferred) {
    const lower = tag.toLowerCase();
    const hit = LOCALES.find((l) => l.match.some((m) => lower === m.toLowerCase() || lower.startsWith(`${m.toLowerCase()}-`)));
    if (hit) return hit.code;
  }
  return null;
}

/** 回傳包含自己在內的退回順序，例如 en 為 ['en', 'zh-TW'] */
export function fallbackChain(code: Locale): Locale[] {
  return [code, ...(getLocale(code).fallback as readonly Locale[])];
}

/** complete 且不是基準語系的語系（CI 的缺字檢查對象） */
export function completeNonBaseLocales(): Locale[] {
  return LOCALES.filter((l) => l.status === 'complete' && l.code !== BASE_LOCALE).map((l) => l.code);
}

/** 登錄檔自我檢查（05 第 2.2 節）：回傳問題清單，空陣列代表通過 */
export function checkRegistry(locales: readonly LocaleDef[] = LOCALES): string[] {
  const problems: string[] = [];
  const codes = locales.map((l) => l.code);
  if (new Set(codes).size !== codes.length) problems.push('語系代號重複');
  const base = locales.find((l) => l.code === BASE_LOCALE);
  if (!base) problems.push(`找不到基準語系 ${BASE_LOCALE}`);
  else {
    if (base.status !== 'complete') problems.push('基準語系必須是 complete');
    if (base.fallback.length !== 0) problems.push('基準語系不能有退回語系');
    if (base.urlSegment !== null) problems.push('基準語系的 urlSegment 必須是 null');
  }
  for (const l of locales) {
    if (l.code !== BASE_LOCALE && l.urlSegment === null) problems.push(`${l.code}：只有基準語系可以不帶網址前綴`);
    if ((l.code === 'zh-TW' || l.code === 'en') && l.status !== 'complete') problems.push(`${l.code} 必須是 complete（beta 只給日後新增的語系）`);
    if (l.code !== BASE_LOCALE) {
      const chain = [l.code, ...l.fallback];
      if (chain[chain.length - 1] !== BASE_LOCALE) problems.push(`${l.code}：退回鏈的最後必須是基準語系`);
      if (new Set(chain).size !== chain.length) problems.push(`${l.code}：退回鏈有循環`);
      for (const f of l.fallback) if (!codes.includes(f)) problems.push(`${l.code}：退回語系 ${f} 不存在`);
    }
    if (l.urlSegment !== null) {
      if (l.urlSegment !== l.urlSegment.toLowerCase()) problems.push(`${l.code}：urlSegment 必須全小寫`);
      if ((PATH_WORDS as readonly string[]).includes(l.urlSegment)) problems.push(`${l.code}：urlSegment 不能與路徑字詞相同`);
    }
    if ([...l.shortLabel].length > 3) problems.push(`${l.code}：shortLabel 不能超過 3 個字元`);
    for (let i = 1; i < l.compact.length; i++) {
      if (l.compact[i]!.factor >= l.compact[i - 1]!.factor) problems.push(`${l.code}：compact 必須依 factor 由大到小排列`);
    }
  }
  const segs = locales.map((l) => l.urlSegment).filter((s): s is string => s !== null);
  if (new Set(segs).size !== segs.length) problems.push('urlSegment 重複');
  return problems;
}
