// 本機錯誤紀錄（06 第 9.2 節）：寫進進度資料庫的 errors store，環狀保留最近 50 筆（由 ProgressStore 實作負責）；
// IndexedDB 不能用時 getProgressStore() 回傳的是記憶體實作，紀錄自然只留在記憶體。沒有任何遠端回報。
// M0b 的獨立 ll-errors 資料庫已併入，啟動時刪除（lib/progress/index.ts）。
import type { ErrorRecord } from '@ledgerland/progress';
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

export async function logError(message: string, stack = '', route = location.pathname): Promise<void> {
  try {
    const store = await getProgressStore();
    await store.appendError(buildErrorRecord(message, stack, route));
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

/** 全域的錯誤與未處理的 Promise 都寫進紀錄；統計腳本的失敗不在這裡（analytics.ts 自己吞掉） */
export function installErrorLog(): void {
  window.addEventListener('error', (e) => {
    if ((e.target as HTMLElement | null)?.dataset?.ll === 'analytics') return;
    void logError(e.message || 'error', e.error?.stack ?? '');
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as { message?: string; stack?: string } | undefined;
    void logError(r?.message ?? String(e.reason), r?.stack ?? '');
  });
}
