// 本機錯誤紀錄（06 第 9.2 節）：IndexedDB 的 errors store 環狀保留最近 50 筆；IndexedDB 不能用時改存在記憶體。沒有任何遠端回報。
// 完整的 IndexedDB 儲存層（進度、設定）在 M2 以 idb 加入；這裡先用原生 API 開一個獨立的小資料庫。
const DB = 'll-errors';
const STORE = 'errors';
const LIMIT = 50;

export interface ErrorEntry {
  at: string;
  route: string;
  message: string;
  stack: string;
  appVersion: string;
  contentVersion: number | null;
}

const memory: ErrorEntry[] = [];
let dbPromise: Promise<IDBDatabase | null> | null = null;
let contentVersion: number | null = null;
export const setContentVersion = (v: number | null) => {
  contentVersion = v;
};

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { autoIncrement: true });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

export async function logError(message: string, stack = '', route = location.pathname): Promise<void> {
  const entry: ErrorEntry = {
    at: new Date().toISOString(),
    route,
    message: message.slice(0, 500),
    stack: stack.slice(0, 2000),
    appVersion: __LL_APP_VERSION__,
    contentVersion,
  };
  const db = await open();
  if (!db) {
    memory.push(entry);
    if (memory.length > LIMIT) memory.splice(0, memory.length - LIMIT);
    return;
  }
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.add(entry);
      const countReq = store.count();
      countReq.onsuccess = () => {
        const extra = countReq.result - LIMIT;
        if (extra > 0) {
          const cursor = store.openCursor();
          let removed = 0;
          cursor.onsuccess = () => {
            const c = cursor.result;
            if (c && removed < extra) {
              c.delete();
              removed++;
              c.continue();
            }
          };
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function listErrors(): Promise<ErrorEntry[]> {
  const db = await open();
  if (!db) return [...memory];
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result as ErrorEntry[]);
      req.onerror = () => resolve([...memory]);
    } catch {
      resolve([...memory]);
    }
  });
}

export async function clearErrors(): Promise<void> {
  memory.length = 0;
  const db = await open();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
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
