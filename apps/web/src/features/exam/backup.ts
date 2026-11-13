// 期中考苦練的紀錄跟著備份走（2026-11-05，維護者的決定；06 第 4.6 節）：備份檔與備份碼的 extensions.exam（packages/progress 的 backup.ts
// 只負責帶著走，內容由這裡定義與驗證）。帶走的是每題的累計（questionState：練過幾次、對幾次、最近一次對不對、連對幾次、最近選的字母），
// 這是「練過幾題、錯過的題、熟練」的來源。不帶：每一次作答的明細（attempts，只增不減，量大又只用來數筆數）與做到一半的一輪（runs，換裝置就重開）。
// 合併規則：同一題以「最近練的那一次」為準（lastAt 較晚的那一筆整筆留下；一樣晚就留練得多的）。兩台裝置各自累計的次數不相加：
// 相加的話同一份備份匯入兩次就會重複計算，而進度的合併規則是「匯入幾次結果都一樣」。題庫的答案改版過（answerRev 不同）時留版本新的。
// 這個檔只給備份頁用，驗證用手寫的（不引 zod，苦練各頁的 chunk 不必多載它）。
import type { ExamDb, QuestionState } from './db.ts';

/** extensions 裡的鍵 */
export const EXAM_BACKUP_KEY = 'exam';
/** 這一塊自己的格式版本 */
export const EXAM_BACKUP_VERSION = 1;

/**
 * 備份檔裡的樣子（純 JSON）。每題一列、欄位照固定的順序排，不寫欄位名稱：備份碼有長度上限（8000 個字），
 * 300 題都練過時用物件寫，光這一塊就超過；寫成一列一列大約少三分之一（約 5400 個字）。
 * 一列是：[題目 ID 去掉 hq_ 的 8 個字, answerRev, 練過幾次, 對幾次, 連對幾次, 最近一次對不對（1 或 0）, 最近一次的時間（Unix 秒）, 最近選的字母（沒有是空字串）]。
 * 錯幾次不寫（練過減對的）；時間只到秒，合併時只拿來比先後。
 */
export type ExamBackupRow = [
  id: string,
  answerRev: number,
  seen: number,
  correct: number,
  streak: number,
  lastCorrect: 0 | 1,
  lastAt: number,
  lastChosen: string,
];
export interface ExamBackup {
  v: typeof EXAM_BACKUP_VERSION;
  q: ExamBackupRow[];
}

const ID_PREFIX = 'hq_';

function toRow(s: QuestionState): ExamBackupRow {
  return [
    s.questionId.slice(ID_PREFIX.length),
    s.answerRev,
    s.seen,
    s.correct,
    s.streak,
    s.lastCorrect ? 1 : 0,
    Math.floor(Date.parse(s.lastAt) / 1000),
    s.lastChosen ?? '',
  ];
}

/** 這台裝置的苦練紀錄轉成備份用的 JSON；一題都沒練過回 null（備份就不帶 extensions.exam）。列依題目 ID 排序，同一份紀錄永遠得到同一串文字 */
export async function exportExamBackup(db: ExamDb): Promise<ExamBackup | null> {
  const states = (await db.allStates()).filter((s) => s.seen > 0 && s.questionId.startsWith(ID_PREFIX) && !Number.isNaN(Date.parse(s.lastAt)));
  if (states.length === 0) return null;
  return { v: EXAM_BACKUP_VERSION, q: states.map(toRow).sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0)) };
}

const isCount = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0;

function fromRow(raw: unknown): QuestionState | null {
  if (!Array.isArray(raw) || raw.length !== 8) return null;
  const [id, answerRev, seen, correct, streak, lastCorrect, lastAt, lastChosen] = raw as unknown[];
  if (typeof id !== 'string' || !/^[0-9a-z]{8}$/.test(id)) return null;
  if (!isCount(answerRev) || answerRev < 1 || !isCount(seen) || seen < 1 || !isCount(correct) || correct > seen) return null;
  if (!isCount(streak) || streak > correct || (lastCorrect !== 0 && lastCorrect !== 1)) return null;
  // 最近一次答錯時連對一定是 0，答對時至少是 1
  if ((lastCorrect === 0) !== (streak === 0)) return null;
  if (!isCount(lastAt) || lastAt === 0 || typeof lastChosen !== 'string' || !/^[A-E]?$/.test(lastChosen)) return null;
  return {
    questionId: `${ID_PREFIX}${id}`,
    answerRev,
    seen,
    correct,
    wrong: seen - correct,
    lastCorrect: lastCorrect === 1,
    lastAt: new Date(lastAt * 1000).toISOString(),
    streak,
    ...(lastChosen === '' ? {} : { lastChosen }),
  };
}

/** 驗證備份裡的 extensions.exam，轉回每題的累計；不是這個格式（或版本比較新、讀不懂）回 null，匯入時就當作沒有苦練的紀錄。
 *  壞掉的單列略過，其餘照收；同一題出現兩次留後面那一列 */
export function parseExamBackup(raw: unknown): QuestionState[] | null {
  if (raw === null || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r['v'] !== EXAM_BACKUP_VERSION || !Array.isArray(r['q'])) return null;
  const byId = new Map<string, QuestionState>();
  for (const row of r['q']) {
    const s = fromRow(row);
    if (s) byId.set(s.questionId, s);
  }
  return [...byId.values()];
}

/** 同一題兩筆累計留哪一筆：答案版本新的；同版本留最近練的；一樣晚留練得多的；再一樣就留本機的 */
export function pickState(local: QuestionState, incoming: QuestionState): QuestionState {
  if (incoming.answerRev !== local.answerRev) return incoming.answerRev > local.answerRev ? incoming : local;
  const a = Date.parse(local.lastAt);
  const b = Date.parse(incoming.lastAt);
  if (a !== b) return b > a ? incoming : local;
  return incoming.seen > local.seen ? incoming : local;
}

/** 合併：兩邊的題都留，同一題用 pickState；同一份備份合併幾次結果都一樣 */
export function mergeExamStates(local: readonly QuestionState[], incoming: readonly QuestionState[]): QuestionState[] {
  const out = new Map(local.map((s) => [s.questionId, s] as const));
  for (const s of incoming) {
    const mine = out.get(s.questionId);
    out.set(s.questionId, mine ? pickState(mine, s) : s);
  }
  return [...out.values()];
}

/** 把備份裡的苦練紀錄寫進這台裝置：merge 是合併，replace 是清掉本機的再寫入 */
export async function importExamBackup(db: ExamDb, states: readonly QuestionState[], mode: 'merge' | 'replace'): Promise<void> {
  if (mode === 'replace') {
    await db.writeStates(states, true);
    return;
  }
  const local = await db.allStates();
  await db.writeStates(mergeExamStates(local, states), false);
}
