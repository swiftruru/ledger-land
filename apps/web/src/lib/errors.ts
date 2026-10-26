// 本機錯誤紀錄（06 第 9.2 節）：寫進進度資料庫的 errors store，環狀保留最近 50 筆（由 ProgressStore 實作負責）；
// IndexedDB 不能用時 getProgressStore() 回傳的是記憶體實作，紀錄自然只留在記憶體。沒有任何遠端回報。
// M0b 的獨立 ll-errors 資料庫已併入，啟動時刪除（lib/progress/index.ts）。
import type { ErrorRecord } from '@ledgerland/progress';
import { firstPaintSettled } from './idle.ts';
import { appVersion, getContentVersion, nowIso, setContentVersion } from './progress/app-info.ts';
import { getProgressStore } from './progress/index.ts';

export type ErrorEntry = ErrorRecord;
export { setContentVersion };

const MESSAGE_MAX_LENGTH = 500;
/** 與 @ledgerland/progress 的 ERROR_STACK_MAX_LENGTH 相同；寫成常數是為了不把 progress 套件拉進首次載入的 chunk */
const STACK_MAX_LENGTH = 2000;

export function buildErrorRecord(message: string, stack: string, route: string): ErrorRecord {
  const record: ErrorRecord = {
    at: nowIso(),
    route,
    message: message.slice(0, MESSAGE_MAX_LENGTH),
    appVersion: appVersion(),
    contentVersion: getContentVersion(),
  };
  return stack === '' ? record : { ...record, stack: stack.slice(0, STACK_MAX_LENGTH) };
}

// 第一次載入時發生的錯誤先記在這裡（紀錄的內容與時間在發生當下就定了），等第一次繪製送出後才開進度資料庫寫入（M3 收尾 QA，2026-10-26）：
// 開資料庫會載入進度 runtime 與作答工作階段的 chunk（約 16 KB），在 LCP 之前開就和頁面內容搶頻寬（06 第 8.2 節；idle.ts 的說明）。之後的錯誤 firstPaintSettled 早已 resolve，照常馬上寫
export async function logError(message: string, stack = '', route = location.pathname): Promise<void> {
  const record = buildErrorRecord(message, stack, route);
  try {
    await firstPaintSettled();
    const store = await getProgressStore();
    await store.appendError(record);
  } catch {
    /* 連紀錄都寫不進去時放棄，不能再丟出錯誤造成循環 */
  }
}

export async function listErrors(): Promise<ErrorEntry[]> {
  try {
    return await (await getProgressStore()).listErrors();
  } catch {
    return [];
  }
}

export async function clearErrors(): Promise<void> {
  try {
    await (await getProgressStore()).clearErrors();
  } catch {
    /* 忽略 */
  }
}

/** 瀏覽器在 ResizeObserver 的回呼改到其他觀察中元素的尺寸、這一輪送不完通知時，在 window 上丟的 error 事件（沒有 error 物件，什麼都沒有壞，下一個影格照常通知）。
 *  不是程式錯誤，不寫進紀錄（M3 收尾 QA，2026-10-26：地圖頁偶爾出現，紀錄因此在 LCP 之前開進度資料庫；地圖本身的觸發點也已改掉，見 Play.tsx 的 --qm-sticky-h） */
const BENIGN_ERRORS = /^ResizeObserver loop (completed with undelivered notifications|limit exceeded)/;

/** 全域的錯誤與未處理的 Promise 都寫進紀錄；統計腳本的失敗不在這裡（analytics.ts 自己吞掉） */
export function installErrorLog(): void {
  window.addEventListener('error', (e) => {
    if ((e.target as HTMLElement | null)?.dataset?.ll === 'analytics') return;
    if (!e.error && BENIGN_ERRORS.test(e.message)) return;
    void logError(e.message || 'error', e.error?.stack ?? '');
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as { message?: string; stack?: string } | undefined;
    void logError(r?.message ?? String(e.reason), r?.stack ?? '');
  });
}
