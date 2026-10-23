// 進度儲存的單例入口（06 第 4.1 節）：getProgressStore() 永遠 resolve；第一次呼叫時才動態載入 runtime.ts（idb、@ledgerland/progress、zod），
// 首次載入的 JS 只留這個入口、狀態旗標與設定鏡像（06 第 8.2 節的預算）。
import type { ProgressStore } from '@ledgerland/progress';
import { storageStatus } from './status.ts';

export { useStorageStatus, storageStatus } from './status.ts';
export { nowIso, todayLocal } from './app-info.ts';
export { SETTINGS_MIRROR_KEY, MIRRORED_SETTINGS, mirrorSetting } from './settings-mirror.ts';

let storePromise: Promise<ProgressStore> | null = null;

/** 全站唯一的進度儲存入口；IndexedDB 開不了時是記憶體模式（status.degraded 為 true） */
export function getProgressStore(): Promise<ProgressStore> {
  storePromise ??= import('./runtime.ts').then((m) => m.init());
  return storePromise;
}

/** 資料庫是否還沒有任何學習紀錄（App 第一次啟動的「要從 Safari 匯入進度嗎？」用，06 第 4.7 節第 3 步） */
export async function hasNoProgress(store: ProgressStore): Promise<boolean> {
  const [attempts, levels] = await Promise.all([store.listAttempts(), store.listLevelProgress()]);
  return attempts.length === 0 && levels.length === 0;
}

/** 測試用：丟掉單例，下一次 getProgressStore 重新開啟 */
export async function resetProgressStoreForTests(): Promise<void> {
  if (storePromise !== null) {
    const store = await storePromise;
    await store.close().catch(() => {});
  }
  storePromise = null;
  (await import('./runtime.ts')).resetRuntime();
  storageStatus.set({ degraded: false, blocked: false, suspended: false, quotaExceeded: false, writeFailed: false, persisted: null });
}
