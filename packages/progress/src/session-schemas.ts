// 作答工作階段的 Zod schema 與由它推導的型別（02 第 5.2 節、03 第 2.11 節）：暫存區（apps/web 的 session-cache）還原時用來驗證。
// 狀態轉移的純函式在 session.ts，對這裡只做 import type，所以作答 store 不會因為用到純函式而載入 zod（06 第 8.2 節、14 第 5.2 節）。
import { z } from 'zod';
import { idSchema } from '@ledgerland/content-schema';
import { IsoDateTime, JsonValue } from './schemas.ts';

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
