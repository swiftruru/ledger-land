// 背題瀏覽的已讀紀錄（2026-11-06）：哪一題讀完了、讀的時候答案是哪一版、什麼時候讀的。
// 自己一個 IndexedDB 資料庫 ledgerland-exam-read，不放進 ledgerland-exam：那個資料庫沒有處理「另一個分頁還開著舊版」的升版，
// 加一個 store 要升版本，舊分頁沒關時新分頁會一直等。另開一個資料庫就沒有這個風險（features/quiz/session-cache.ts 也是這樣）。
// 以題目 ID 為鍵，全站只有這一份：「全部」與各份講義的已讀數都由它當場算出來（reading.ts），不另外存。
// 目前只存在這台裝置，還不隨備份。開不了（私密瀏覽、配額）時退到記憶體。
import { openDB, type IDBPDatabase } from 'idb';

export const EXAM_READ_DB = 'ledgerland-exam-read';
const STORE = 'marks';

export interface ReadMark {
  questionId: string;
  /** 讀的時候題庫的 answerRev；答案改版後這一題回到未讀（reading.ts 的 readSetOf） */
  answerRev: number;
  at: string;
}

export interface ExamReadDb {
  all(): Promise<ReadMark[]>;
  /** 標成已讀；也用來復原剛才的重設 */
  put(marks: readonly ReadMark[]): Promise<void>;
  /** 改回未讀 */
  remove(questionIds: readonly string[]): Promise<void>;
}

const isMark = (v: unknown): v is ReadMark =>
  v !== null &&
  typeof v === 'object' &&
  typeof (v as ReadMark).questionId === 'string' &&
  Number.isInteger((v as ReadMark).answerRev) &&
  typeof (v as ReadMark).at === 'string';

export function memoryExamReadDb(): ExamReadDb {
  const marks = new Map<string, ReadMark>();
  return {
    async all() {
      return [...marks.values()];
    },
    async put(list) {
      for (const m of list) marks.set(m.questionId, m);
    },
    async remove(ids) {
      for (const id of ids) marks.delete(id);
    },
  };
}

export function indexedDbExamReadDb(name: string = EXAM_READ_DB): ExamReadDb {
  let dbPromise: Promise<IDBPDatabase> | null = null;
  const db = () => {
    dbPromise ??= openDB(name, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'questionId' });
      },
    });
    return dbPromise;
  };
  return {
    async all() {
      return ((await (await db()).getAll(STORE)) as unknown[]).filter(isMark);
    },
    async put(list) {
      // 同一個交易：復原一整份講義時要嘛都寫進去、要嘛都不動
      const tx = (await db()).transaction(STORE, 'readwrite');
      for (const m of list) await tx.store.put(m);
      await tx.done;
    },
    async remove(ids) {
      const tx = (await db()).transaction(STORE, 'readwrite');
      for (const id of ids) await tx.store.delete(id);
      await tx.done;
    },
  };
}

let current: ExamReadDb | null = null;

/** 全站共用；IndexedDB 第一次失敗後整個退到記憶體（這次開啟的已讀不會存起來，但頁面照常能讀） */
export function getExamReadDb(): ExamReadDb {
  if (current) return current;
  if (typeof indexedDB === 'undefined') {
    current = memoryExamReadDb();
    return current;
  }
  const idb = indexedDbExamReadDb();
  const memory = memoryExamReadDb();
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
    all: () =>
      guard(
        () => idb.all(),
        () => memory.all(),
      ),
    put: (list) =>
      guard(
        () => idb.put(list),
        () => memory.put(list),
      ),
    remove: (ids) =>
      guard(
        () => idb.remove(ids),
        () => memory.remove(ids),
      ),
  };
  return current;
}

export function setExamReadDbForTests(db: ExamReadDb | null): void {
  current = db;
}
