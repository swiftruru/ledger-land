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

/** 目前時間的 ISO 8601 字串；progress 套件不讀時鐘，所有「現在」都從這裡傳入 */
export function nowIso(): string {
  return new Date().toISOString();
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
