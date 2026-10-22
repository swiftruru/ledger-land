// 網址的語系片段（05 第 2.4 節、第 7.4 節）：路由、站內連結、語言切換、關卡代號都呼叫這一組函式
import { BASE_LOCALE, LOCALES, type Locale } from './locales.ts';
import { getLocale } from './match.ts';

/** 依路徑的第一段判斷語系：等於某個語系的 urlSegment 就是該語系，否則是基準語系（中文在根路徑） */
export function localeFromPath(pathname: string): Locale {
  const first = pathname.toLowerCase().split('/')[1] ?? '';
  const hit = LOCALES.find((l) => l.urlSegment !== null && l.urlSegment === first);
  return hit ? hit.code : BASE_LOCALE;
}

/** 去掉語系片段，例如 /en/level/lv_k7m2q9xd/ 變成 /level/lv_k7m2q9xd/，/en 與 /en/ 都變成 / */
export function stripLocale(pathname: string): string {
  const seg = getLocale(localeFromPath(pathname)).urlSegment;
  if (seg === null) return pathname;
  const rest = pathname.slice(seg.length + 1);
  return rest === '' ? '/' : rest;
}

/** 替與語系無關的路徑加上語系片段，例如 ('en', '/level/lv_k7m2q9xd/') 變成 /en/level/lv_k7m2q9xd/ */
export function localePath(code: Locale, path: string): string {
  const seg = getLocale(code).urlSegment;
  const p = path.startsWith('/') ? path : `/${path}`;
  return seg === null ? p : `/${seg}${p}`;
}

/** 切換語言時的新網址（05 第 8.5 節）：localePath(新語系, stripLocale(目前路徑)) 再接查詢字串與 hash */
export function switchLocalePath(to: Locale, pathname: string, search = '', hash = ''): string {
  return `${localePath(to, stripLocale(pathname))}${search}${hash}`;
}

/**
 * 05 第 7.4 節第 9 點：大小寫、結尾斜線、猜測的 /zh-tw/、/zh/ 前綴都由用戶端正規化後以 replace 導向。
 * 回傳正規化後的路徑；與輸入相同代表不需要轉址。只處理語系片段與路徑形狀，不驗證路徑是否存在。
 */
export function normalizePath(pathname: string): string {
  let p = pathname;
  p = p.replace(/^\/(zh-tw|zh-hant|zh)(?=\/|$)/i, '');
  if (p === '') p = '/';
  // 路徑字詞與 ID 一律小寫（ID 是 Crockford Base32 小寫）
  p = p.toLowerCase();
  const seg = getLocale(localeFromPath(p)).urlSegment;
  if (seg !== null) p = `/${seg}${stripLocale(p)}`;
  if (!p.endsWith('/')) p = `${p}/`;
  p = p.replace(/\/{2,}/g, '/');
  return p;
}
