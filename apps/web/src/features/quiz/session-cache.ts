// 作答工作階段的暫存區（02 第 5.1、5.2 節）：store 每次變動以節流方式寫進 IndexedDB，visibilitychange 轉 hidden 與 pagehide 時立即寫；
// 回到關卡（切換語言、開名詞卡、重新整理、App 被回收）時從這裡還原，不重新出題。
// 和進度資料庫（ledgerland）分開放：暫存不是學習紀錄、不進備份，也不受進度資料庫的版本升級影響。IndexedDB 開不了時退到記憶體（只保得住同一頁內的切換）。
import { openDB, type IDBPDatabase } from 'idb';
import type { QuizSession } from '@ledgerland/progress';

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
  /** 計時開啟後實際作答的毫秒數（不含暫停與看回饋的時間，時間到之後繼續累計；結果頁的用時）；舊版暫存沒有 */
  timerUsedMs?: number;
  /** 開始時每題的 answerRev（還原時比對，答案改版的已確認作答作廢）；只存在這個暫存，不進 packages/progress 的 QuizSession；舊版暫存沒有 */
  answerRevs?: Record<string, number>;
  savedAt: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const isInt = (v: unknown, min = 0): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min;
const isRevMap = (v: unknown): v is Record<string, number> => isRecord(v) && Object.values(v).every((n) => isInt(n));

/** 暫存裡的工作階段形狀是否還是現在的 QuizSession（舊版暫存或被改過就當作沒有）。只看結構，不帶 zod：
 *  packages/progress 的 QuizSession schema 會把 zod 拉進作答頁第一波的 chunk（06 第 8.2 節），而這裡的資料是同一個 App 自己寫的。 */
export function isCachedQuizSession(value: unknown): value is QuizSession {
  if (!isRecord(value)) return false;
  if (value['mode'] !== 'level' && value['mode'] !== 'review') return false;
  const ids = value['questionIds'];
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === 'string' && id !== '')) return false;
  if (!isInt(value['currentIndex']) || value['currentIndex'] >= ids.length) return false;
  if (typeof value['shuffleSeed'] !== 'string' || value['shuffleSeed'] === '') return false;
  if (typeof value['startedAt'] !== 'string' || typeof value['completed'] !== 'boolean') return false;
  if (value['mode'] === 'level' && (typeof value['levelId'] !== 'string' || !isInt(value['levelRev'], 1))) return false;
  const questions = value['questions'];
  if (!isRecord(questions)) return false;
  for (const q of Object.values(questions)) {
    if (!isRecord(q) || typeof q['confirmed'] !== 'boolean' || typeof q['explanationOpen'] !== 'boolean') return false;
    if (q['correct'] !== undefined && typeof q['correct'] !== 'boolean') return false;
    if (q['score'] !== undefined && (typeof q['score'] !== 'number' || q['score'] < 0 || q['score'] > 1)) return false;
    if (q['rawInput'] !== undefined && typeof q['rawInput'] !== 'string') return false;
  }
  const timer = value['timer'];
  if (!isRecord(timer)) return false;
  if (typeof timer['enabled'] !== 'boolean' || typeof timer['paused'] !== 'boolean' || typeof timer['expired'] !== 'boolean') return false;
  if (!isInt(timer['totalMs']) || !isInt(timer['remainingMs'])) return false;
  const anchor = value['scrollAnchor'];
  if (anchor !== undefined && (!isRecord(anchor) || typeof anchor['elementId'] !== 'string' || typeof anchor['offset'] !== 'number')) return false;
  if (value['returnTo'] !== undefined && typeof value['returnTo'] !== 'string') return false;
  return true;
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
      if (!isCachedQuizSession(entry.session)) return undefined;
      return {
        key,
        session: entry.session,
        attemptIds: entry.attemptIds ?? {},
        guessed: entry.guessed ?? {},
        ...(isInt(entry.timerUsedMs) ? { timerUsedMs: entry.timerUsedMs } : {}),
        ...(isRevMap(entry.answerRevs) ? { answerRevs: entry.answerRevs } : {}),
        savedAt: entry.savedAt ?? '',
      };
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
