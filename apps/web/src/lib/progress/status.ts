// 儲存層的狀態旗標（06 第 4.3、4.4 節、第 9.1 節的固定提示）：頂部橫幅依這些旗標顯示；由 index.ts 與 indexeddb-store.ts 設定。
import { create } from 'zustand';

export interface StorageStatus {
  /** IndexedDB 完全無法開啟，改用記憶體模式：常駐提示「這台裝置目前無法儲存進度，請匯出備份」 */
  degraded: boolean;
  /** 本分頁要升級資料庫，但其他分頁還開著舊連線：「請關閉其他 LedgerLand 分頁，再重新整理」 */
  blocked: boolean;
  /** 其他分頁已升級，本分頁的連線已關閉：「網站已在其他分頁更新，重新整理後才能繼續儲存進度」 */
  suspended: boolean;
  /** QuotaExceededError：「儲存空間不足」加「立即匯出」 */
  quotaExceeded: boolean;
  /** 連線中斷且重試失敗：「進度暫時無法儲存。重要進度已先暫存起來」 */
  writeFailed: boolean;
  /** navigator.storage.persisted() 的最新結果（設定頁與備份頁顯示） */
  persisted: boolean | null;
  set(patch: Partial<Omit<StorageStatus, 'set'>>): void;
}

export const useStorageStatus = create<StorageStatus>()((set) => ({
  degraded: false,
  blocked: false,
  suspended: false,
  quotaExceeded: false,
  writeFailed: false,
  persisted: null,
  set(patch) {
    set(patch);
  },
}));

export const storageStatus = {
  get: () => useStorageStatus.getState(),
  set: (patch: Partial<Omit<StorageStatus, 'set'>>) => useStorageStatus.getState().set(patch),
};
