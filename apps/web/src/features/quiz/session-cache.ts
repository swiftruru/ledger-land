// 作答工作階段的暫存區（02 第 5.1、5.2 節）：store 每次變動以節流方式寫進 IndexedDB，visibilitychange 轉 hidden 與 pagehide 時立即寫；
// 回到關卡（切換語言、開名詞卡、重新整理、App 被回收）時從這裡還原，不重新出題。
// 和進度資料庫（ledgerland）分開放：暫存不是學習紀錄、不進備份，也不受進度資料庫的版本升級影響。IndexedDB 開不了時退到記憶體（只保得住同一頁內的切換）。
import { openDB, type IDBPDatabase } from 'idb';
import { QuizSession } from '@ledgerland/progress';

export const SESSION_DB = 'ledgerland-session';
const STORE = 'sessions';

export interface CachedSession {
  /** 'level:<levelId>' 或 'review' */
  key: string;
  session: QuizSession;
  /** 已寫入作答紀錄的題目與各自的 attemptId（避免重新整理後重複寫） */
  attemptIds: Record<string, string>;
  /** 答對後按了「我是猜的」的題目 */
  guessed: Record<string, true>;
  savedAt: string;
}

export interface SessionCache {
  read(key: string): Promise<CachedSession | undefined>;
  write(entry: CachedSession): Promise<void>;
  remove(key: string): Promise<void>;
}

export function memorySessionCache(): SessionCache {
  const map = new Map<string, CachedSession>();
  return {
    async read(key) {
      return map.get(key);
    },
    async write(entry) {
      map.set(entry.key, entry);
    },
    async remove(key) {
      map.delete(key);
    },
  };
}

export function indexedDbSessionCache(name: string = SESSION_DB): SessionCache {
  let dbPromise: Promise<IDBPDatabase> | null = null;
  const db = () => {
    dbPromise ??= openDB(name, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'key' });
      },
    });
    return dbPromise;
  };
  return {
    async read(key) {
      const raw = (await (await db()).get(STORE, key)) as unknown;
      if (raw === null || typeof raw !== 'object') return undefined;
      const entry = raw as CachedSession;
      // 形狀不對（舊版暫存）就當作沒有
      const parsed = QuizSession.safeParse(entry.session);
      if (!parsed.success) return undefined;
      return { key, session: parsed.data, attemptIds: entry.attemptIds ?? {}, guessed: entry.guessed ?? {}, savedAt: entry.savedAt ?? '' };
    },
    async write(entry) {
      await (await db()).put(STORE, entry);
    },
    async remove(key) {
      await (await db()).delete(STORE, key);
    },
  };
}

let current: SessionCache | null = null;

/** 全站共用的暫存區；IndexedDB 開不了（私密瀏覽、配額）時退到記憶體 */
export function getSessionCache(): SessionCache {
  if (current) return current;
  const idb = typeof indexedDB === 'undefined' ? null : indexedDbSessionCache();
  if (idb === null) {
    current = memorySessionCache();
    return current;
  }
  const memory = memorySessionCache();
  let broken = false;
  const guard = async <T>(run: () => Promise<T>, fallback: () => Promise<T>): Promise<T> => {
    if (broken) return fallback();
    try {
      return await run();
    } catch {
      broken = true;
      return fallback();
    }
  };
  current = {
    read: (key) =>
      guard(
        () => idb.read(key),
        () => memory.read(key),
      ),
    write: (entry) =>
      guard(
        () => idb.write(entry),
        () => memory.write(entry),
      ),
    remove: (key) =>
      guard(
        () => idb.remove(key),
        () => memory.remove(key),
      ),
  };
  return current;
}

export function setSessionCacheForTests(cache: SessionCache | null): void {
  current = cache;
}
