// 「匯出到 App」做過了沒（維護者 2026-10-28 實機回饋：教學第 1 步按了「匯出到 App」就離開教學頁，回來要接得上第 2 步）：
// 備份頁複製備份碼或存成備份檔成功時記在 sessionStorage，安裝教學把第 1 步畫成已完成、注意力留在加入主畫面的步驟。
// 只記這個分頁的工作階段：下次再開 Safari 分頁，進度可能又有新的，要再匯出一次。
const KEY = 'll:exported-to-app';

export function markExportedToApp(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    /* 寫不進去就只是教學頁不打勾 */
  }
}

export function wasExportedToApp(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}
