// 期中考苦練的一輪練習（M4c，08 的講義題庫一節）：純函式的狀態機，不碰 DOM 與資料庫；存進 features/exam/db.ts 的 runs，離開再回來可以沿用。
// 一輪 = 一個題組（setId）的題目依講義順序或隨機排好，逐題「選、確認、下一題」；每題記選了哪個字母與對錯。
// 題庫改版（rev 或 answerRev 變了）時那幾題的作答作廢重答（和錯題本的「題目已更新」同一個想法）；題目從題庫消失時整輪重來。
// 模擬考（mode: 'mock'，M4c 第二批）：一律隨機抽題、可以前後移動與改選、作答中不判分；交卷（submitRun）才一次判完，沒選的算錯。
// 限時的場次有 deadlineAt（開始時間加題數乘每題秒數），時間照牆上的鐘走，離開頁面不暫停。
// 答錯的題排回同一輪（2026-11-13，維護者的決定）：練習中答錯的題隔 RETRY_GAP 題再出一次，同一題一輪最多再出 RETRY_MAX 次；模擬考不排。
// 所以 questionIds 是「作答的格子」：第一次出現的格子就是題目 ID（之前存的一輪照樣能讀），再出現的是 <題目 ID>~<第幾次>；answers 以格子為鍵。
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
  /** 作答順序的格子：第一次出現的是題目 ID，答錯後再出現的是 <題目 ID>~2、~3（questionOf 取回題目 ID） */
  questionIds: string[];
  /** 開始時每題的版本，還原時比對 */
  revs: Record<string, { rev: number; answerRev: number }>;
  index: number;
  /** 以格子為鍵 */
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

/** 模擬考那一輪在 runs 裡的鍵（同時只有一輪；pages/ExamMock.tsx 寫、苦練首頁讀） */
export const MOCK_KEY = 'mock';

/** 成績以題為單位：再出現的那幾次不算進 total 與 correct */
export interface RunSummary {
  /** 這一輪不重複的題數 */
  total: number;
  /** 作答過的題數 */
  answered: number;
  /** 第一次就答對的題數 */
  correct: number;
  /** 第一次答錯的題 */
  wrongIds: string[];
  /** 模擬考交卷時沒選的題數（算錯，但不寫進紀錄）；練習一律 0 */
  unanswered: number;
  /** 加練幾次（答錯後再出現、而且確認過的格子數）；模擬考一律 0 */
  retried: number;
  /** 第一次答錯、這一輪再出現時答對的題 */
  fixedIds: string[];
}

/** 答錯的題隔幾題再出現（後面不夠就排在最後）：不讓人只靠剛看過的答案作答 */
export const RETRY_GAP = 3;
/** 同一題在同一輪最多再出現幾次 */
export const RETRY_MAX = 2;

const SLOT_SEP = '~';

/** 格子是哪一題 */
export const questionOf = (slot: string): string => {
  const i = slot.indexOf(SLOT_SEP);
  return i < 0 ? slot : slot.slice(0, i);
};

/** 是不是答錯後再出現的格子 */
export const isRetrySlot = (slot: string): boolean => slot.includes(SLOT_SEP);

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

/** 現在這一格 */
export function currentSlot(run: ExamRun): string | undefined {
  return run.questionIds[run.index];
}

export function currentQuestionId(run: ExamRun): string | undefined {
  const slot = currentSlot(run);
  return slot === undefined ? undefined : questionOf(slot);
}

/** id 是格子（第一次出現的格子就是題目 ID，所以傳題目 ID 拿到的是第一次的作答） */
export function answerOf(run: ExamRun, id: string): RunAnswer {
  return run.answers[id] ?? { chosen: null, checked: false };
}

/** 這一題在這一輪後面還會不會再出現 */
export const comesAgain = (run: ExamRun, questionId: string): boolean => run.questionIds.slice(run.index + 1).some((s) => questionOf(s) === questionId);

/**
 * 答錯的題排回這一輪後面：這一格確認後是答錯、是這一題目前最後一次出現、還沒到上限時，在隔 RETRY_GAP 格的位置插入下一次
 * （後面不夠就排在最後）。模擬考、已經練完的一輪、答對的格子都原樣回傳；重複呼叫不會多排。
 */
export function requeueWrong(run: ExamRun, slot: string): ExamRun {
  if (isMock(run) || isFinished(run)) return run;
  const a = answerOf(run, slot);
  if (!a.checked || a.correct !== false) return run;
  const at = run.questionIds.indexOf(slot);
  if (at < 0) return run;
  const id = questionOf(slot);
  const seen = run.questionIds.filter((s) => questionOf(s) === id);
  if (seen[seen.length - 1] !== slot || seen.length >= 1 + RETRY_MAX) return run;
  const questionIds = [...run.questionIds];
  questionIds.splice(Math.min(at + 1 + RETRY_GAP, questionIds.length), 0, `${id}${SLOT_SEP}${seen.length + 1}`);
  return { ...run, questionIds };
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
  const slot = currentSlot(run);
  if (slot === undefined || !answerOf(run, slot).checked) return run;
  if (run.index + 1 >= run.questionIds.length) return { ...run, index: run.questionIds.length, finishedAt: now };
  return { ...run, index: run.index + 1 };
}

export const isFinished = (run: ExamRun): boolean => run.finishedAt !== undefined || run.index >= run.questionIds.length;

export function summarise(run: ExamRun): RunSummary {
  const first = run.questionIds.filter((slot) => !isRetrySlot(slot));
  const again = run.questionIds.filter((slot) => isRetrySlot(slot) && answerOf(run, slot).checked);
  const answered = first.filter((id) => answerOf(run, id).checked);
  const wrongIds = answered.filter((id) => answerOf(run, id).correct !== true);
  const fixed = new Set(again.filter((slot) => answerOf(run, slot).correct === true).map(questionOf));
  return {
    total: first.length,
    answered: answered.length,
    correct: answered.filter((id) => answerOf(run, id).correct === true).length,
    wrongIds,
    unanswered: answered.filter((id) => answerOf(run, id).chosen === null).length,
    retried: again.length,
    fixedIds: wrongIds.filter((id) => fixed.has(id)),
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
 * 還原存起來的一輪：題目不在題庫裡了就回 null（整輪重來）；rev 或 answerRev 變了的題作廢重答，index 退到第一個沒確認的題。
 * 改版的題連它再出現的格子一起拿掉（重新作答第一次，答錯再排）
 */
export function restoreRun(run: ExamRun, questions: ReadonlyMap<string, HandoutQuestionSnapshot>): { run: ExamRun; revised: string[] } | null {
  if (isFinished(run)) return { run, revised: [] };
  const revised: string[] = [];
  const changed = new Set<string>();
  const answers = { ...run.answers };
  const revs = { ...run.revs };
  for (const slot of run.questionIds) {
    const id = questionOf(slot);
    const q = questions.get(id);
    if (!q) return null;
    const was = run.revs[id];
    if (changed.has(id) || !was || was.rev !== q.rev || was.answerRev !== q.answerRev) {
      if (!changed.has(id) && (answers[slot]?.checked || (isMock(run) && answers[slot]?.chosen != null))) revised.push(id);
      changed.add(id);
      delete answers[slot];
      revs[id] = { rev: q.rev, answerRev: q.answerRev };
    }
  }
  const questionIds = changed.size === 0 ? run.questionIds : run.questionIds.filter((slot) => !(isRetrySlot(slot) && changed.has(questionOf(slot))));
  // 模擬考交卷前沒有「確認」這一步，停在原來那一題
  if (isMock(run)) return { run: { ...run, answers, revs, index: Math.min(run.index, run.questionIds.length - 1) }, revised };
  const firstOpen = questionIds.findIndex((slot) => !answers[slot]?.checked);
  const index = firstOpen < 0 ? questionIds.length : Math.min(run.index, firstOpen);
  return { run: { ...run, questionIds, answers, revs, index }, revised };
}
