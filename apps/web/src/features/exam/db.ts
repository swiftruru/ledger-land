// 期中考苦練的紀錄（M4c，06 第 4.2 節）：自己一個 IndexedDB 資料庫 ledgerland-exam，和學習進度的 ledgerland 分開，不進備份、不碰錯題本與星星。
// 三個 store：attempts（每一次確認答案）、questionState（每題的累計：看過幾次、對幾次、最近一次對不對）、runs（進行中或剛完成的一輪，鍵是題組 ID）。
// 開不了（私密瀏覽、配額）時退到記憶體，和 features/quiz/session-cache.ts 同一套做法。
import { openDB, type IDBPDatabase } from 'idb';
import type { ExamRun } from './run.ts';

export const EXAM_DB = 'ledgerland-exam';
const STORES = { attempts: 'attempts', states: 'questionState', runs: 'runs' } as const;

export interface ExamAttempt {
  id: string;
  questionId: string;
  rev: number;
  answerRev: number;
  setId: string;
  chosen: string;
  correct: boolean;
  at: string;
}

export interface QuestionState {
  questionId: string;
  /** 累計時題庫的 answerRev；答案改版後的第一次作答把對錯歸零 */
  answerRev: number;
  seen: number;
  correct: number;
  wrong: number;
  lastCorrect: boolean;
  lastAt: string;
}

export interface ExamDb {
  getRun(key: string): Promise<ExamRun | undefined>;
  putRun(run: ExamRun): Promise<void>;
  deleteRun(key: string): Promise<void>;
  allStates(): Promise<QuestionState[]>;
  putState(state: QuestionState): Promise<void>;
  addAttempt(attempt: ExamAttempt): Promise<void>;
  countAttempts(): Promise<number>;
}

export function memoryExamDb(): ExamDb {
  const runs = new Map<string, ExamRun>();
  const states = new Map<string, QuestionState>();
  const attempts: ExamAttempt[] = [];
  return {
    async getRun(key) {
      return runs.get(key);
    },
    async putRun(run) {
      runs.set(run.key, run);
    },
    async deleteRun(key) {
      runs.delete(key);
    },
    async allStates() {
      return [...states.values()];
    },
    async putState(state) {
      states.set(state.questionId, state);
    },
    async addAttempt(a) {
      attempts.push(a);
    },
    async countAttempts() {
      return attempts.length;
    },
  };
}

export function indexedDbExamDb(name: string = EXAM_DB): ExamDb {
  let dbPromise: Promise<IDBPDatabase> | null = null;
  const db = () => {
    dbPromise ??= openDB(name, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORES.attempts)) d.createObjectStore(STORES.attempts, { keyPath: 'id' }).createIndex('byQuestion', 'questionId');
        if (!d.objectStoreNames.contains(STORES.states)) d.createObjectStore(STORES.states, { keyPath: 'questionId' });
        if (!d.objectStoreNames.contains(STORES.runs)) d.createObjectStore(STORES.runs, { keyPath: 'key' });
      },
    });
    return dbPromise;
  };
  return {
    async getRun(key) {
      const raw = (await (await db()).get(STORES.runs, key)) as unknown;
      return raw && typeof raw === 'object' && Array.isArray((raw as ExamRun).questionIds) ? (raw as ExamRun) : undefined;
    },
    async putRun(run) {
      await (await db()).put(STORES.runs, run);
    },
    async deleteRun(key) {
      await (await db()).delete(STORES.runs, key);
    },
    async allStates() {
      return (await (await db()).getAll(STORES.states)) as QuestionState[];
    },
    async putState(state) {
      await (await db()).put(STORES.states, state);
    },
    async addAttempt(a) {
      await (await db()).put(STORES.attempts, a);
    },
    async countAttempts() {
      return (await db()).count(STORES.attempts);
    },
  };
}

let current: ExamDb | null = null;

/** 全站共用的苦練紀錄；IndexedDB 第一次失敗後整個退到記憶體（這次開啟的紀錄不會存起來，但頁面照常能練） */
export function getExamDb(): ExamDb {
  if (current) return current;
  if (typeof indexedDB === 'undefined') {
    current = memoryExamDb();
    return current;
  }
  const idb = indexedDbExamDb();
  const memory = memoryExamDb();
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
    getRun: (key) =>
      guard(
        () => idb.getRun(key),
        () => memory.getRun(key),
      ),
    putRun: (run) =>
      guard(
        () => idb.putRun(run),
        () => memory.putRun(run),
      ),
    deleteRun: (key) =>
      guard(
        () => idb.deleteRun(key),
        () => memory.deleteRun(key),
      ),
    allStates: () =>
      guard(
        () => idb.allStates(),
        () => memory.allStates(),
      ),
    putState: (s) =>
      guard(
        () => idb.putState(s),
        () => memory.putState(s),
      ),
    addAttempt: (a) =>
      guard(
        () => idb.addAttempt(a),
        () => memory.addAttempt(a),
      ),
    countAttempts: () =>
      guard(
        () => idb.countAttempts(),
        () => memory.countAttempts(),
      ),
  };
  return current;
}

export function setExamDbForTests(db: ExamDb | null): void {
  current = db;
}

/** 確認答案後更新累計：answerRev 變了就從頭算 */
export function nextState(prev: QuestionState | undefined, questionId: string, answerRev: number, correct: boolean, at: string): QuestionState {
  const base = prev && prev.answerRev === answerRev ? prev : { questionId, answerRev, seen: 0, correct: 0, wrong: 0, lastCorrect: false, lastAt: at };
  return {
    ...base,
    seen: base.seen + 1,
    correct: base.correct + (correct ? 1 : 0),
    wrong: base.wrong + (correct ? 0 : 1),
    lastCorrect: correct,
    lastAt: at,
  };
}
