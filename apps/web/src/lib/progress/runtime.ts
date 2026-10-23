// 進度儲存的執行期（06 第 4.1、4.3、4.4 節）：這個模組連同 idb、@ledgerland/progress 與 zod 都在首次載入之後才動態載入（index.ts 的 getProgressStore），
// 首次載入的 JS 不含它們。init() 開 IndexedDB 並建立 IndexedDBProgressStore；開不了時退到 MemoryProgressStore 並設 degraded 旗標。
// blocked、blocking、terminated 在這裡接上 status 旗標與暫存佇列。
import { DB_SCHEMA_VERSION, MemoryProgressStore, generateDeviceId, type Meta, type ProgressStore } from '@ledgerland/progress';
import { appVersion, getContentVersion, nowIso, secureRandom } from './app-info.ts';
import { openProgressDB, type ProgressDB } from './db.ts';
import { IndexedDBProgressStore } from './indexeddb-store.ts';
import { PendingQueue, replayPending, writeLiteSnapshot, type KeyValueStorage } from './pending.ts';
import { mirrorSetting } from './settings-mirror.ts';
import { storageStatus } from './status.ts';

/** M0b 的獨立錯誤資料庫，M2 起併入 ledgerland 的 errors store；啟動時刪掉舊的 */
const LEGACY_ERROR_DB = 'll-errors';

function localStorageOrNull(): KeyValueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function newMeta(): Meta {
  return {
    deviceId: generateDeviceId(secureRandom),
    createdAt: nowIso(),
    dbSchemaVersion: DB_SCHEMA_VERSION,
    appVersion: appVersion(),
    contentVersion: getContentVersion(),
    importHistory: [],
  };
}

let current: IndexedDBProgressStore | null = null;

function openWithHandlers(): Promise<ProgressDB> {
  return openProgressDB({
    now: nowIso,
    onBlocked() {
      storageStatus.set({ blocked: true });
    },
    onBlocking() {
      // 本分頁是舊版，其他分頁要升級：先 flush、關閉連線，橫幅提示重新整理；之後的寫入進 ll:pending（06 第 4.3 節）
      storageStatus.set({ suspended: true });
      void current?.suspend();
    },
    onTerminated() {
      current?.markTerminated();
    },
  });
}

function cleanupLegacyErrorDb(): void {
  try {
    indexedDB.deleteDatabase(LEGACY_ERROR_DB);
  } catch {
    /* 忽略 */
  }
}

export async function init(): Promise<ProgressStore> {
  const storage = localStorageOrNull();
  const pending = storage === null ? undefined : new PendingQueue(storage);
  try {
    const db = await openWithHandlers();
    const store = new IndexedDBProgressStore(db, {
      now: nowIso,
      createMeta: newMeta,
      reopen: openWithHandlers,
      ...(pending === undefined ? {} : { pending }),
      onQuotaExceeded() {
        storageStatus.set({ quotaExceeded: true });
      },
      onWriteFailed(lite) {
        storageStatus.set({ writeFailed: true });
        if (lite !== undefined && storage !== null) writeLiteSnapshot(storage, lite);
      },
      onSettingChanged(key, value) {
        mirrorSetting(storage, key, value);
      },
    });
    current = store;
    await store.getMeta();
    if (pending !== undefined) await replayPending(store, pending).catch(() => {});
    cleanupLegacyErrorDb();
    return store;
  } catch {
    storageStatus.set({ degraded: true });
    return MemoryProgressStore.empty(newMeta());
  }
}

/** 測試用 */
export function resetRuntime(): void {
  current = null;
}
