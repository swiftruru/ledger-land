// 關卡代號（02 第 4.7 節、06 第 4.9 節）：代號就是關卡 ID 去掉 lv_ 的 8 個 Crockford Base32 小寫字元；純函式，不碰 DOM。
import { CROCKFORD } from '@ledgerland/content-schema';

const CODE_RE = new RegExp(`^[${CROCKFORD}]{8}$`);

export type LevelCodeResult = { ok: true; code: string } | { ok: false };

/**
 * 正規化依序是：NFKC（全形轉半形）、小寫、移除空白與連字號、去掉開頭的 lv_（先去前綴再換字，lv_ 的 l 才不會被換掉），
 * 再依 Crockford 的慣例把 o 當 0、i 與 l 當 1。結果必須剛好 8 個字元且都在字元集內（不含 i、l、o、u）。
 */
export function normalizeLevelCode(raw: string): LevelCodeResult {
  let s = raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\-_]+/g, (m) => (m.includes('_') ? '_' : ''));
  s = s.replace(/^lv_/, '').replace(/_/g, '');
  s = s.replace(/o/g, '0').replace(/[il]/g, '1');
  return CODE_RE.test(s) ? { ok: true, code: s } : { ok: false };
}

export function levelIdFromCode(code: string): string {
  return `lv_${code}`;
}

export function codeFromLevelId(levelId: string): string {
  return levelId.replace(/^lv_/, '');
}
