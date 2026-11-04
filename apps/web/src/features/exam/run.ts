// 期中考苦練的一輪練習（M4c，08 的講義題庫一節）：純函式的狀態機，不碰 DOM 與資料庫；存進 features/exam/db.ts 的 runs，離開再回來可以沿用。
// 一輪 = 一個題組（setId）的題目依講義順序或隨機排好，逐題「選、確認、下一題」；每題記選了哪個字母與對錯。
// 題庫改版（rev 或 answerRev 變了）時那幾題的作答作廢重答（和錯題本的「題目已更新」同一個想法）；題目從題庫消失時整輪重來。
import type { HandoutQuestionSnapshot } from '../../lib/content.ts';

export type ExamOrder = 'handout' | 'random';

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
}

export interface RunSummary {
  total: number;
  answered: number;
  correct: number;
  wrongIds: string[];
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
}): ExamRun {
  const random = input.random ?? Math.random;
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
    startedAt: input.now ?? new Date().toISOString(),
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
  };
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
      if (answers[id]?.checked) revised.push(id);
      delete answers[id];
      revs[id] = { rev: q.rev, answerRev: q.answerRev };
    }
  }
  const firstOpen = run.questionIds.findIndex((id) => !answers[id]?.checked);
  const index = firstOpen < 0 ? run.questionIds.length : Math.min(run.index, firstOpen);
  return { run: { ...run, answers, revs, index }, revised };
}
