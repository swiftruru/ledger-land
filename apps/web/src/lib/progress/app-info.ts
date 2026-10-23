// 寫進 meta、errors 與備份檔的 App 版本與內容版本。內容版本在 content-manifest 載入後由 content.ts 設定。
let contentVersion = 0;

export function appVersion(): string {
  return typeof __LL_APP_VERSION__ === 'string' ? __LL_APP_VERSION__ : '0.0.0+test';
}

export function getContentVersion(): number {
  return contentVersion;
}

export function setContentVersion(v: number | null): void {
  contentVersion = v ?? 0;
}

/** 目前時間的 ISO 8601 字串，帶裝置的本地時區位移（例如 2026-10-24T00:11:56.123+08:00）；progress 套件不讀時鐘，所有「現在」都從這裡傳入。
 *  不能用 toISOString() 的 UTC 寫法：quiz 的錯題本用字串前十碼當本地日期算到期日，台灣凌晨 0 點到 8 點答錯的題會被算成「今天就到期」（2026-10-24 由 E2E 抓到） */
export function nowIso(date: Date = new Date()): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** 本地日期 YYYY-MM-DD（錯題本到期與備份檔名用裝置的本地日期） */
export function todayLocal(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** [0, 1) 的亂數，用 crypto.getRandomValues（不用 Math.random） */
export function secureRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! / 2 ** 32;
}
