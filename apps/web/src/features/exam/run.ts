// 期中考苦練的一輪練習（M4c，08 的講義題庫一節）：純函式的狀態機，不碰 DOM 與資料庫；存進 features/exam/db.ts 的 runs，離開再回來可以沿用。
// 一輪 = 一個題組（setId）的題目依講義順序或隨機排好，逐題「選、確認、下一題」；每題記選了哪個字母與對錯。
// 題庫改版（rev 或 answerRev 變了）時那幾題的作答作廢重答（和錯題本的「題目已更新」同一個想法）；題目從題庫消失時整輪重來。
// 模擬考（mode: 'mock'，M4c 第二批）：一律隨機抽題、可以前後移動與改選、作答中不判分；交卷（submitRun）才一次判完，沒選的算錯。
// 限時的場次有 deadlineAt（開始時間加題數乘每題秒數），時間照牆上的鐘走，離開頁面不暫停。
import type { HandoutQuestionSnapshot } from '../../lib/content.ts';

export type ExamOrder = 'handout' | 'random';
export type ExamMode = 'drill' | 'mock';

export interface RunAnswer {
  /** 選了的講義字母 */
  chosen: string | null;
  checked: boolean;
  correct?: boolean;
}

export interface ExamRun {
  /** 題組 ID（runs store 的鍵）：all、wrong、d1、d1s2… */
  key: string;
  /** 這一輪的亂數種子與識別（打亂選項用） */
  runId: string;
  order: ExamOrder;
  bankRev: number;
  /** 作答順序 */
  questionIds: string[];
  /** 開始時每題的版本，還原時比對 */
  revs: Record<string, { rev: number; answerRev: number }>;
  index: number;
  answers: Record<string, RunAnswer>;
  startedAt: string;
  finishedAt?: string;
  /** 沒有這一欄的是練習（第一批存的紀錄） */
  mode?: ExamMode;
  /** 模擬考：每題幾秒（0 不限時）與到期時間（不限時沒有） */
  secondsPerQuestion?: number;
  deadlineAt?: string;
  /** 模擬考開始時的設定（「再考一次」沿用）：scope|count|seconds，格式在 options.ts */
  settings?: string;
}

export interface RunSummary {
  total: number;
  answered: number;
  correct: number;
  wrongIds: string[];
  /** 模擬考交卷時沒選的題數（算錯，但不寫進紀錄）；練習一律 0 */
  unanswered: number;
}

/** 兩個以上的正解就是任一正確（B/C 都對那一題） */
export const isCorrectChoice = (answer: readonly string[], chosen: string | null): boolean => chosen !== null && answer.includes(chosen);

/** Fisher-Yates 洗牌，random 可注入（測試用） */
export function shuffleIds(ids: readonly string[], random: () => number = Math.random): string[] {
  const out = [...ids];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function newRunId(random: () => number = Math.random): string {
  const alphabet = '0123456789abcdefghjkmnpqrstvwxyz';
  let s = '';
  for (let i = 0; i < 10; i++) s += alphabet[Math.floor(random() * alphabet.length)];
  return s;
}

export function startRun(input: {
  key: string;
  questions: readonly HandoutQuestionSnapshot[];
  order: ExamOrder;
  bankRev: number;
  /** 隨機時最多幾題（「隨機抽 20 題」）；講義順序不限 */
  limit?: number;
  now?: string;
  random?: () => number;
  mode?: ExamMode;
  /** 模擬考每題幾秒；0 或沒給是不限時 */
  secondsPerQuestion?: number;
  settings?: string;
}): ExamRun {
  const random = input.random ?? Math.random;
  const startedAt = input.now ?? new Date().toISOString();
  const seconds = Math.max(0, input.secondsPerQuestion ?? 0);
  let ids = input.questions.map((q) => q.id);
  if (input.order === 'random') {
    ids = shuffleIds(ids, random);
    if (input.limit !== undefined) ids = ids.slice(0, input.limit);
  }
  return {
    key: input.key,
    runId: newRunId(random),
    order: input.order,
    bankRev: input.bankRev,
    questionIds: ids,
    revs: Object.fromEntries(input.questions.map((q) => [q.id, { rev: q.rev, answerRev: q.answerRev }])),
    index: 0,
    answers: {},
    startedAt,
    ...(input.mode === 'mock'
      ? {
          mode: 'mock' as const,
          secondsPerQuestion: seconds,
          ...(seconds > 0 ? { deadlineAt: new Date(Date.parse(startedAt) + ids.length * seconds * 1000).toISOString() } : {}),
          ...(input.settings === undefined ? {} : { settings: input.settings }),
        }
      : {}),
  };
}

export function currentQuestionId(run: ExamRun): string | undefined {
  return run.questionIds[run.index];
}

export function answerOf(run: ExamRun, id: string): RunAnswer {
  return run.answers[id] ?? { chosen: null, checked: false };
}

export function selectAnswer(run: ExamRun, id: string, chosen: string): ExamRun {
  const a = answerOf(run, id);
  if (a.checked) return run;
  return { ...run, answers: { ...run.answers, [id]: { chosen, checked: false } } };
}

export function checkAnswer(run: ExamRun, id: string, correctLetters: readonly string[]): ExamRun {
  const a = answerOf(run, id);
  if (a.checked || a.chosen === null) return run;
  return { ...run, answers: { ...run.answers, [id]: { ...a, checked: true, correct: isCorrectChoice(correctLetters, a.chosen) } } };
}

/** 下一題；最後一題之後標 finishedAt */
export function nextQuestion(run: ExamRun, now: string = new Date().toISOString()): ExamRun {
  const id = currentQuestionId(run);
  if (id === undefined || !answerOf(run, id).checked) return run;
  if (run.index + 1 >= run.questionIds.length) return { ...run, index: run.questionIds.length, finishedAt: now };
  return { ...run, index: run.index + 1 };
}

export const isFinished = (run: ExamRun): boolean => run.finishedAt !== undefined || run.index >= run.questionIds.length;

export function summarise(run: ExamRun): RunSummary {
  const answered = run.questionIds.filter((id) => answerOf(run, id).checked);
  return {
    total: run.questionIds.length,
    answered: answered.length,
    correct: answered.filter((id) => answerOf(run, id).correct === true).length,
    wrongIds: answered.filter((id) => answerOf(run, id).correct !== true),
    unanswered: answered.filter((id) => answerOf(run, id).chosen === null).length,
  };
}

// ---- 模擬考 ----

export const isMock = (run: ExamRun): boolean => run.mode === 'mock';

/** 模擬考可以前後移動；超出範圍就夾在頭尾，交卷後不動 */
export function gotoQuestion(run: ExamRun, index: number): ExamRun {
  if (isFinished(run) || run.questionIds.length === 0) return run;
  const next = Math.max(0, Math.min(run.questionIds.length - 1, index));
  return next === run.index ? run : { ...run, index: next };
}

/** 模擬考的選擇：交卷前隨時可以改，不判分 */
export function selectMock(run: ExamRun, id: string, chosen: string): ExamRun {
  if (isFinished(run) || !run.questionIds.includes(id)) return run;
  return { ...run, answers: { ...run.answers, [id]: { chosen, checked: false } } };
}

/** 模擬考已經選了幾題 */
export const chosenCount = (run: ExamRun): number => run.questionIds.filter((id) => answerOf(run, id).chosen !== null).length;

/** 交卷：每一題一次判完，沒選的算錯（chosen 留 null）；已交卷就不動 */
export function submitRun(
  run: ExamRun,
  questions: ReadonlyMap<string, Pick<HandoutQuestionSnapshot, 'answer'>>,
  now: string = new Date().toISOString(),
): ExamRun {
  if (isFinished(run)) return run;
  const answers: Record<string, RunAnswer> = {};
  for (const id of run.questionIds) {
    const chosen = answerOf(run, id).chosen;
    answers[id] = { chosen, checked: true, correct: isCorrectChoice(questions.get(id)?.answer ?? [], chosen) };
  }
  return { ...run, answers, index: run.questionIds.length, finishedAt: now };
}

/** 限時的場次還剩幾秒（無條件進位，0 是時間到）；不限時回 null */
export function remainingSeconds(run: ExamRun, nowMs: number): number | null {
  if (run.deadlineAt === undefined) return null;
  return Math.max(0, Math.ceil((Date.parse(run.deadlineAt) - nowMs) / 1000));
}

export const isExpired = (run: ExamRun, nowMs: number): boolean => remainingSeconds(run, nowMs) === 0;

/** 用了幾秒（開始到交卷，無條件捨去）；還沒交卷回 null */
export function usedSeconds(run: ExamRun): number | null {
  if (run.finishedAt === undefined) return null;
  return Math.max(0, Math.floor((Date.parse(run.finishedAt) - Date.parse(run.startedAt)) / 1000));
}

/**
 * 還原存起來的一輪：題目不在題庫裡了就回 null（整輪重來）；rev 或 answerRev 變了的題作廢重答，index 退到第一個沒確認的題
 */
export function restoreRun(run: ExamRun, questions: ReadonlyMap<string, HandoutQuestionSnapshot>): { run: ExamRun; revised: string[] } | null {
  if (isFinished(run)) return { run, revised: [] };
  const revised: string[] = [];
  const answers = { ...run.answers };
  const revs = { ...run.revs };
  for (const id of run.questionIds) {
    const q = questions.get(id);
    if (!q) return null;
    const was = run.revs[id];
    if (!was || was.rev !== q.rev || was.answerRev !== q.answerRev) {
      if (answers[id]?.checked || (isMock(run) && answers[id]?.chosen != null)) revised.push(id);
      delete answers[id];
      revs[id] = { rev: q.rev, answerRev: q.answerRev };
    }
  }
  // 模擬考交卷前沒有「確認」這一步，停在原來那一題
  if (isMock(run)) return { run: { ...run, answers, revs, index: Math.min(run.index, run.questionIds.length - 1) }, revised };
  const firstOpen = run.questionIds.findIndex((id) => !answers[id]?.checked);
  const index = firstOpen < 0 ? run.questionIds.length : Math.min(run.index, firstOpen);
  return { run: { ...run, answers, revs, index }, revised };
}
