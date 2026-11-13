// 每天的練習紀錄（2026-11-13，/exam/history/）：由這台裝置的作答明細（features/exam/db.ts 的 attempts）算每天練了幾題、答對幾題、
// 訂正成功幾題、練到熟練幾題，以及連續練習幾天、近 7 天和前 7 天的比較。純函式，不碰 DOM 與資料庫。
// 「練了幾題」是確認答案的次數：同一題練兩次算兩次，答錯後同一輪再出現的也算；模擬考交卷的題算在交卷那一天。
// 一天的界線是裝置的本地日期（day.ts 的 localDayOf，由呼叫的人傳進來）。
// 訂正與熟練是把作答明細依時間排好、逐筆用 nextState 重播每一題的累計，比較這一筆之前與之後的階段（門檻和站上其他地方是同一份，
// stats.ts 的 stageOf 與 isMastered）。重播只看這台裝置的明細：從備份匯入的累計沒有明細，不算進每天的數字。
import { nextState, type ExamAttempt, type QuestionState } from './db.ts';
import { addDays, type DayOf } from './day.ts';
import { isMastered, stageOf } from './stats.ts';

export interface DayRow {
  /** 本地日期 YYYY-MM-DD */
  day: string;
  /** 確認答案的次數 */
  answered: number;
  correct: number;
  /** 訂正成功：之前停在答錯，這一次答對 */
  fixed: number;
  /** 練到熟練：之前還沒熟練，這一次之後熟練 */
  mastered: number;
}

export type DayTotals = Omit<DayRow, 'day'>;

const emptyRow = (day: string): DayRow => ({ day, answered: 0, correct: 0, fixed: 0, mastered: 0 });

/** 每天的數字，依日期由早到晚；沒練的日子不在裡面。時間不合法的明細略過 */
export function dailyOf(attempts: readonly ExamAttempt[], dayOf: DayOf): DayRow[] {
  const sorted = attempts.filter((a) => dayOf(a.at) !== '').sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const states = new Map<string, QuestionState>();
  const days = new Map<string, DayRow>();
  for (const a of sorted) {
    const day = dayOf(a.at);
    const clock = { today: day, dayOf };
    const row = days.get(day) ?? emptyRow(day);
    const prev = states.get(a.questionId);
    // 答案改版後的第一次作答從頭算（nextState 也是這樣）：之前的階段不算
    const before = prev && prev.answerRev === a.answerRev ? prev : undefined;
    const after = nextState(prev, a.questionId, a.answerRev, a.correct, a.at, a.chosen);
    row.answered++;
    if (a.correct) row.correct++;
    if (a.correct && stageOf(before, clock) === 'fix') row.fixed++;
    if (!isMastered(before, clock) && isMastered(after, clock)) row.mastered++;
    states.set(a.questionId, after);
    days.set(day, row);
  }
  return [...days.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

/** 到 today 為止的最近 n 天，一天一列（沒練的日子是 0），由早到晚 */
export function windowOf(rows: readonly DayRow[], today: string, n: number): DayRow[] {
  const byDay = new Map(rows.map((r) => [r.day, r] as const));
  const out: DayRow[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    out.push(byDay.get(day) ?? emptyRow(day));
  }
  return out;
}

export function totalsOf(rows: readonly DayRow[]): DayTotals {
  const out: DayTotals = { answered: 0, correct: 0, fixed: 0, mastered: 0 };
  for (const r of rows) {
    out.answered += r.answered;
    out.correct += r.correct;
    out.fixed += r.fixed;
    out.mastered += r.mastered;
  }
  return out;
}

/** 答對率 0 到 1；沒練是 null */
export const accuracyOf = (t: Pick<DayTotals, 'answered' | 'correct'>): number | null => (t.answered === 0 ? null : t.correct / t.answered);

/** 連續練習幾天：今天有練從今天往回數，今天還沒練但昨天有就從昨天往回數（今天還有機會接上）；都沒有是 0 */
export function streakOf(rows: readonly DayRow[], today: string): number {
  const active = new Set(rows.filter((r) => r.answered > 0).map((r) => r.day));
  let day = active.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (day !== '' && active.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/** 近 7 天（含今天）與前 7 天的小計 */
export function weekCompare(rows: readonly DayRow[], today: string): { recent: DayTotals; previous: DayTotals } {
  return { recent: totalsOf(windowOf(rows, today, 7)), previous: totalsOf(windowOf(rows, addDays(today, -7), 7)) };
}

const AXIS_TOPS = [2, 4, 10, 20, 40, 60, 100, 200, 400, 600, 1000, 2000, 4000, 10000];

/** 圖表縱軸的頂端：不小於 max 的整齊數字（中間再標一半） */
export const axisTop = (max: number): number => AXIS_TOPS.find((top) => top >= max) ?? Math.ceil(max / 10000) * 10000;
