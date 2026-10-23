// 作答工作階段（02 第 5.2 節、03 第 2.11 節）：放在路由樹之外的 store，切換語言、開名詞卡、跳到實驗室再回來都不遺失。
// 這裡只有型別與純函式（開始、作答、確認、下一題、暫停與繼續）；寫入 IndexedDB 暫存區由 apps/web 的 store 以節流方式處理。
// 計時器不讀時鐘：經過的毫秒數由呼叫端量測後以 tickTimer 傳入。
import { z } from 'zod';
import { idSchema } from '@ledgerland/content-schema';
import { IsoDateTime, JsonValue } from './model.ts';

/** 每題的狀態：已選答案、數字題的原始輸入文字、是否已確認與對錯、是否已展開解說 */
export const QuestionState = z
  .object({
    answer: JsonValue.optional(),
    rawInput: z.string().optional(),
    confirmed: z.boolean(),
    correct: z.boolean().optional(),
    score: z.number().min(0).max(1).optional(),
    explanationOpen: z.boolean(),
  })
  .strict();
export type QuestionState = z.infer<typeof QuestionState>;

export const TimerState = z
  .object({
    enabled: z.boolean(),
    totalMs: z.number().int().min(0),
    remainingMs: z.number().int().min(0),
    paused: z.boolean(),
    /** 時間到不會自動送出（03 第 2.10 節），只記下來讓畫面提示一次 */
    expired: z.boolean(),
  })
  .strict();
export type TimerState = z.infer<typeof TimerState>;

/** 捲動錨點：目前畫面最上方元素的 ID 與偏移量（不用 scrollY，兩種語言的文字高度不同） */
export const ScrollAnchor = z.object({ elementId: z.string().min(1), offset: z.number() }).strict();
export type ScrollAnchor = z.infer<typeof ScrollAnchor>;

export const SessionMode = z.enum(['level', 'review']);
export type SessionMode = z.infer<typeof SessionMode>;

export const QuizSession = z
  .object({
    mode: SessionMode,
    levelId: idSchema('level').optional(),
    levelRev: z.number().int().min(1).optional(),
    questionIds: z.array(idSchema('question')).min(1),
    /** 選項打散用的種子：順序由種子與選項 ID 決定，與文字無關，切換語言後順序不變 */
    shuffleSeed: z.string().min(1),
    currentIndex: z.number().int().min(0),
    questions: z.record(z.string(), QuestionState),
    timer: TimerState,
    startedAt: IsoDateTime,
    scrollAnchor: ScrollAnchor.optional(),
    /** 離開作答畫面去實驗室或名詞卡時的返回目標（只記最近一個來源） */
    returnTo: z.string().optional(),
    completed: z.boolean(),
  })
  .strict()
  .refine((s) => s.currentIndex < s.questionIds.length, 'currentIndex 要在題目範圍內')
  .refine((s) => s.mode !== 'level' || (s.levelId !== undefined && s.levelRev !== undefined), '關卡模式要有 levelId 與 levelRev');
export type QuizSession = z.infer<typeof QuizSession>;

export interface StartSessionInput {
  readonly mode: SessionMode;
  readonly levelId?: string;
  readonly levelRev?: number;
  readonly questionIds: readonly string[];
  readonly shuffleSeed: string;
  readonly startedAt: string;
  /** 開啟計時時的總毫秒數；省略或 0 表示不計時 */
  readonly timerTotalMs?: number;
}

function emptyQuestionState(): QuestionState {
  return { confirmed: false, explanationOpen: false };
}

export function startSession(input: StartSessionInput): QuizSession {
  if (input.questionIds.length === 0) throw new RangeError('作答工作階段至少要有一題');
  const questions: Record<string, QuestionState> = {};
  for (const id of input.questionIds) questions[id] = emptyQuestionState();
  const total = input.timerTotalMs ?? 0;
  const session: QuizSession = {
    mode: input.mode,
    questionIds: [...input.questionIds],
    shuffleSeed: input.shuffleSeed,
    currentIndex: 0,
    questions,
    timer: { enabled: total > 0, totalMs: total, remainingMs: total, paused: false, expired: false },
    startedAt: input.startedAt,
    completed: false,
  };
  return {
    ...session,
    ...(input.levelId === undefined ? {} : { levelId: input.levelId }),
    ...(input.levelRev === undefined ? {} : { levelRev: input.levelRev }),
  };
}

export function currentQuestionId(session: QuizSession): string {
  return session.questionIds[session.currentIndex]!;
}

function requireQuestion(session: QuizSession, questionId: string): QuestionState {
  const q = session.questions[questionId];
  if (q === undefined) throw new RangeError(`題目不在這個工作階段裡：${questionId}`);
  return q;
}

function withQuestion(session: QuizSession, questionId: string, next: QuestionState): QuizSession {
  return { ...session, questions: { ...session.questions, [questionId]: next } };
}

/** 選答案（可重複改，直到確認）；rawInput 是數字題的原始輸入文字。已確認的題目不能再改，回傳原狀態 */
export function selectAnswer(session: QuizSession, questionId: string, answer: JsonValue, rawInput?: string): QuizSession {
  const q = requireQuestion(session, questionId);
  if (q.confirmed) return session;
  const next: QuestionState = { ...q, answer };
  return withQuestion(session, questionId, rawInput === undefined ? next : { ...next, rawInput });
}

/** 按「確認答案」：判分在 quiz，這裡只記錄結果；沒有選答案或已確認時回傳原狀態 */
export function confirmAnswer(session: QuizSession, questionId: string, result: { readonly correct: boolean; readonly score: number }): QuizSession {
  const q = requireQuestion(session, questionId);
  if (q.confirmed || q.answer === undefined) return session;
  return withQuestion(session, questionId, { ...q, confirmed: true, correct: result.correct, score: result.score });
}

export function toggleExplanation(session: QuizSession, questionId: string, open?: boolean): QuizSession {
  const q = requireQuestion(session, questionId);
  return withQuestion(session, questionId, { ...q, explanationOpen: open ?? !q.explanationOpen });
}

/** 下一題：目前這題要先確認；已是最後一題時標記完成 */
export function nextQuestion(session: QuizSession): QuizSession {
  const q = requireQuestion(session, currentQuestionId(session));
  if (!q.confirmed) return session;
  if (session.currentIndex + 1 >= session.questionIds.length) return { ...session, completed: true };
  return { ...session, currentIndex: session.currentIndex + 1 };
}

export function pauseTimer(session: QuizSession): QuizSession {
  if (!session.timer.enabled || session.timer.paused) return session;
  return { ...session, timer: { ...session.timer, paused: true } };
}

export function resumeTimer(session: QuizSession): QuizSession {
  if (!session.timer.enabled || !session.timer.paused) return session;
  return { ...session, timer: { ...session.timer, paused: false } };
}

/** 扣掉經過的毫秒數（呼叫端量測）；暫停中不扣；歸零時標記 expired，但不自動送出 */
export function tickTimer(session: QuizSession, elapsedMs: number): QuizSession {
  if (!Number.isInteger(elapsedMs) || elapsedMs < 0) throw new RangeError('elapsedMs 要是非負整數');
  if (!session.timer.enabled || session.timer.paused || elapsedMs === 0) return session;
  const remaining = Math.max(0, session.timer.remainingMs - elapsedMs);
  return { ...session, timer: { ...session.timer, remainingMs: remaining, expired: remaining === 0 } };
}

export function setScrollAnchor(session: QuizSession, anchor: ScrollAnchor | undefined): QuizSession {
  if (anchor === undefined) {
    const { scrollAnchor: _omit, ...rest } = session;
    return rest;
  }
  return { ...session, scrollAnchor: anchor };
}

/** 離開作答畫面（去實驗室或名詞卡）：計時自動暫停、記下返回目標（02 第 5.3 節） */
export function leaveSession(session: QuizSession, returnTo?: string): QuizSession {
  const paused = pauseTimer(session);
  return returnTo === undefined ? paused : { ...paused, returnTo };
}

/** 已確認的題數與計分（給結果頁與暫存還原用） */
export function sessionSummary(session: QuizSession): { readonly answered: number; readonly total: number; readonly totalScore: number } {
  let answered = 0;
  let totalScore = 0;
  for (const id of session.questionIds) {
    const q = session.questions[id];
    if (q?.confirmed) {
      answered++;
      totalScore += q.score ?? (q.correct ? 1 : 0);
    }
  }
  return { answered, total: session.questionIds.length, totalScore };
}
