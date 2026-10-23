// 時間字串的純函式：模組不讀時鐘，所有「現在」都由呼叫端以 ISO 8601 字串傳入；
// 比較與相減不用 Date（不同時區位移的字串不能直接依字典序比較），用 days-from-civil 演算法換成 epoch 毫秒。

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})$/;

export const MS_PER_DAY = 86_400_000;

/** Howard Hinnant 的 days_from_civil：公曆日期到 1970-01-01 的天數 */
function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** ISO 8601（含 Z 或 ±HH:mm 位移）轉成 epoch 毫秒；格式不合時回傳 undefined */
export function isoToEpochMs(iso: string): number | undefined {
  const m = ISO_RE.exec(iso);
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const s = m[6] === undefined ? 0 : Number(m[6]);
  const frac = m[7] === undefined ? 0 : Number((m[7] + '000').slice(0, 3));
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 60) return undefined;
  let offsetMin = 0;
  const tz = m[8]!;
  if (tz !== 'Z') {
    const sign = tz.startsWith('-') ? -1 : 1;
    offsetMin = sign * (Number(tz.slice(1, 3)) * 60 + Number(tz.slice(4, 6)));
  }
  const days = daysFromCivil(y, mo, d);
  return ((days * 24 + h) * 60 + mi - offsetMin) * 60_000 + s * 1000 + frac;
}

export function isIsoDateTime(value: string): boolean {
  return isoToEpochMs(value) !== undefined;
}

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 本地日期 YYYY-MM-DD（只檢查格式與月日範圍） */
export function isLocalDate(value: string): boolean {
  const m = LOCAL_DATE_RE.exec(value);
  if (!m) return false;
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return mo >= 1 && mo <= 12 && d >= 1 && d <= 31;
}

/** 依時間先後比較兩個 ISO 字串；格式不合視為程式錯誤 */
export function compareIso(a: string, b: string): -1 | 0 | 1 {
  const x = epochOrThrow(a);
  const y = epochOrThrow(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** 較早的一個；同一時刻（不同位移寫法）時取字串 code unit 較小者，讓結果與參數順序無關 */
export function earliestIso(a: string, b: string): string {
  const c = compareIso(a, b);
  if (c !== 0) return c < 0 ? a : b;
  return a <= b ? a : b;
}

/** 較晚的一個；同一時刻時取字串 code unit 較小者 */
export function latestIso(a: string, b: string): string {
  const c = compareIso(a, b);
  if (c !== 0) return c > 0 ? a : b;
  return a <= b ? a : b;
}

/** b 減 a 的毫秒數 */
export function diffMs(a: string, b: string): number {
  return epochOrThrow(b) - epochOrThrow(a);
}

function epochOrThrow(iso: string): number {
  const v = isoToEpochMs(iso);
  if (v === undefined) throw new TypeError(`不是合法的 ISO 8601 時間：${iso}`);
  return v;
}
