// 進度儲存的執行期（06 第 4.1、4.3、4.4 節）：這個模組連同 idb 與 @ledgerland/progress 的 runtime（model、store、derive、merge、migrations）
// 都在首次載入之後才動態載入（index.ts 的 getProgressStore），首次載入的 JS 不含它們；zod 與 schema 定義（schemas、backup、session）不在這條路徑上，
// 只有備份匯入與作答暫存的驗證才載入（14 第 5.2 節）。init() 開 IndexedDB 並建立 IndexedDBProgressStore；開不了時退到 MemoryProgressStore 並設 degraded 旗標。
// blocked、blocking、terminated 在這裡接上 status 旗標與暫存佇列；啟動時先 replayPending 把上次沒落地的寫入補回去，再把 store 交給畫面。
// 重放前用 Web Locks 查出還活著的分頁（持有 ll:pending:<token>），跳過它們正在寫的項目（core-1）；沒有 locks API 時只靠 replayPending 的新舊比對。
import { DB_SCHEMA_VERSION, MemoryProgressStore, generateDeviceId, type Meta, type ProgressStore } from '@ledgerland/progress';
import { appVersion, getContentVersion, nowIso, secureRandom } from './app-info.ts';
import { openProgressDB, type ProgressDB } from './db.ts';
import { IndexedDBProgressStore } from './indexeddb-store.ts';
import { PendingQueue, liveTokensFrom, replayPending, writeLiteSnapshot, type KeyValueStorage, type PendingLocks } from './pending.ts';
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

/** navigator.locks；不支援（舊版 Safari）或讀取丟例外時是 null */
function webLocksOrNull(): LockManager | null {
  try {
    return typeof navigator !== 'undefined' && 'locks' in navigator ? navigator.locks : null;
  } catch {
    return null;
  }
}

/** 還活著的分頁的 token（持有 ll:pending:<token> 鎖）；查不到時當作沒有 */
async function liveTokens(locks: LockManager | null): Promise<ReadonlySet<string>> {
  if (locks === null) return new Set();
  try {
    return liveTokensFrom(await locks.query());
  } catch {
    return new Set();
  }
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
  const locks = webLocksOrNull();
  const pendingLocks: PendingLocks | null = locks === null ? null : { request: (name, callback) => locks.request(name, callback) };
  const pending = storage === null ? undefined : new PendingQueue(storage, undefined, undefined, pendingLocks);
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
    if (pending !== undefined) {
      const live = await liveTokens(locks);
      await replayPending(store, pending, { liveTokens: live, onSettingKept: (key, value) => mirrorSetting(storage, key, value) }).catch(() => {});
    }
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
