// 各題型作答（attempts.answer）的型別與 Zod schema（06 第 4.2 節的格式表、03 第 2.12 節的多正解題、04 第 2 節的 NumericAnswer 與 EntryLine[][]）。
// 這裡只管形狀；選項是否存在、target 是否在題目裡，由 score.ts 在判分時處理（不在的選項一律算錯，不 throw）。
import type { QuestionType } from '@ledgerland/content-schema';
import { Direction, LineId, RatioStatus, TargetId, idSchema } from '@ledgerland/content-schema';
import type { EntryLine, Result } from '@ledgerland/core';
import { err, ok } from '@ledgerland/core';
import { z } from 'zod';

const optionId = idSchema('option');

/** 單選類（single_choice、pick_statement、ratio_interpret、judgment）：選中的選項 ID */
export const ChoiceAnswer = optionId;
/** multi_choice：選項 ID 陣列；any_correct 只有一個元素，all_correct 依 ID 排序（parse 時去重並排序） */
export const MultiChoiceAnswer = z
  .array(optionId)
  .min(1)
  .transform((ids) => normaliseMultiChoiceAnswer(ids));
export const TrueFalseAnswer = z.boolean();
export const PickLineAnswer = LineId;
/** classify：項目 ID 對所選分類代號 */
export const ClassifyAnswer = z.record(idSchema('item'), z.string().regex(/^[a-z][a-z0-9_]*$/));
/** transaction_effect：target ID 對方向代號（direction 目標）、數字（delta 與 value 目標）或指標狀態（status 目標） */
export const EffectAnswer = z.record(TargetId, z.union([Direction, RatioStatus, z.number().finite()]));
/** five_step_fill：開放的格子（版面線 ID）對填入的金額 */
export const FiveStepAnswer = z.record(LineId, z.number().finite());
/** ratio_numeric：數值，或按下 N/A（04 第 12.5 節） */
export const NumericAnswer = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('value'), value: z.number().finite() }).strict(),
  z.object({ kind: z.literal('na') }).strict(),
]);
/** journal_entry：每筆分錄的各行；科目可用 ID 或別名，金額是非負安全整數（核心的 EntryLine） */
export const EntryLineAnswer = z
  .object({ account: z.string().min(1), side: z.enum(['debit', 'credit']), amount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) })
  .strict();
export const JournalEntryAnswer = z.array(z.array(EntryLineAnswer));

export type ChoiceAnswer = z.infer<typeof ChoiceAnswer>;
export type MultiChoiceAnswer = z.infer<typeof MultiChoiceAnswer>;
export type TrueFalseAnswer = z.infer<typeof TrueFalseAnswer>;
export type PickLineAnswer = z.infer<typeof PickLineAnswer>;
export type ClassifyAnswer = z.infer<typeof ClassifyAnswer>;
export type EffectAnswer = z.infer<typeof EffectAnswer>;
export type FiveStepAnswer = z.infer<typeof FiveStepAnswer>;
export type NumericAnswer = z.infer<typeof NumericAnswer>;
export type JournalEntryAnswer = readonly (readonly EntryLine[])[];

export interface AnswerByType {
  readonly single_choice: ChoiceAnswer;
  readonly pick_statement: ChoiceAnswer;
  readonly ratio_interpret: ChoiceAnswer;
  readonly judgment: ChoiceAnswer;
  readonly multi_choice: MultiChoiceAnswer;
  readonly true_false: TrueFalseAnswer;
  readonly pick_line: PickLineAnswer;
  readonly classify: ClassifyAnswer;
  readonly transaction_effect: EffectAnswer;
  readonly five_step_fill: FiveStepAnswer;
  readonly ratio_numeric: NumericAnswer;
  readonly journal_entry: JournalEntryAnswer;
}
export type Answer = AnswerByType[QuestionType];

const SCHEMAS: { readonly [T in QuestionType]: z.ZodType<AnswerByType[T], unknown> } = {
  single_choice: ChoiceAnswer,
  pick_statement: ChoiceAnswer,
  ratio_interpret: ChoiceAnswer,
  judgment: ChoiceAnswer,
  multi_choice: MultiChoiceAnswer,
  true_false: TrueFalseAnswer,
  pick_line: PickLineAnswer,
  classify: ClassifyAnswer,
  transaction_effect: EffectAnswer,
  five_step_fill: FiveStepAnswer,
  ratio_numeric: NumericAnswer,
  journal_entry: JournalEntryAnswer,
};

export interface AnswerParseError {
  readonly code: 'answer.invalid';
  readonly type: QuestionType;
  /** Zod 的問題清單，路徑與訊息；給開發與匯入驗證用，介面不直接顯示 */
  readonly issues: readonly { readonly path: string; readonly message: string }[];
}

/** 多正解題的作答正規化（03 第 2.12 節）：去重並依 ID 排序，any_correct 與 all_correct 共用 */
export function normaliseMultiChoiceAnswer(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** 把儲存或介面送來的未知值解析成該題型的作答；形狀不對是預期內的錯誤（例如匯入舊備份），以 Result 回傳 */
export function parseAnswer<T extends QuestionType>(type: T, raw: unknown): Result<AnswerByType[T], AnswerParseError> {
  const schema = SCHEMAS[type] as z.ZodType<AnswerByType[T], unknown>;
  const parsed = schema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);
  return err({ code: 'answer.invalid', type, issues: parsed.error.issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message })) });
}
