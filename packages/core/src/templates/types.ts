// 已編譯範本的型別（04 第 7 節）：運算式已是 TypedAst，學習端不需要 parser。
import type { LocalizedText, Side } from '../accounts/types.ts';
import type { CashFlowTag, LineTag, ParamSpec, TransactionTemplate } from '../data/types.ts';
import type { TypedAst } from '../expr/ast.ts';
import type { JournalEntry } from '../journal/types.ts';
import type { Money } from '../money.ts';
import type { PolicyWhen } from '../policy/types.ts';

export interface CompiledDerived {
  readonly name: string;
  readonly type: 'money' | 'number';
  readonly expr: string;
  readonly ast: TypedAst;
  readonly label: LocalizedText;
}

export interface CompiledPrecondition {
  readonly id: string;
  readonly expr: string;
  readonly ast: TypedAst;
  readonly message: LocalizedText;
}

export interface CompiledLine {
  readonly id: string;
  readonly account: string;
  readonly side: Side;
  readonly expr: string;
  readonly ast: TypedAst;
  readonly cf?: CashFlowTag;
  readonly tag?: LineTag;
  readonly policyWhen?: PolicyWhen;
  readonly memo?: LocalizedText;
}

/** 編譯後的範本：文字欄位照抄，運算式換成 TypedAst；source 保留原始資料供工具輸出快照 */
export interface CompiledTemplate {
  readonly id: string;
  readonly rev: number;
  readonly revKind: 'text' | 'answer';
  readonly status: 'draft' | 'published' | 'retired';
  readonly title: LocalizedText;
  readonly summary: LocalizedText;
  readonly explanation: LocalizedText;
  readonly params: readonly ParamSpec[];
  readonly derived: readonly CompiledDerived[];
  readonly preconditions: readonly CompiledPrecondition[];
  readonly lines: readonly CompiledLine[];
  readonly termRefs: readonly string[];
  readonly pendingRefs: readonly string[];
  readonly entryQuestionBlockedBy: readonly string[];
  readonly source: TransactionTemplate;
}

/** 事件給的參數值；缺的用 ParamSpec.default */
export type ParamValues = Readonly<Record<string, number>>;

/** 推導值與參數值的可序列化形狀：整數給 Money，非整數的 number 型推導值給 'num/den' 字串 */
export type DerivedValue = Money | string;

export interface InstantiatedTemplate {
  /** 已移除金額為 0 的行；noEffect 時 lines 為空 */
  readonly entry: JournalEntry;
  /** 實際採用的參數值（含預設值） */
  readonly paramValues: Readonly<Record<string, number>>;
  /** 參數與推導值，鍵是名稱（不含事件 ID；postStep 再加上 'e1.' 前綴） */
  readonly derivedValues: Readonly<Record<string, DerivedValue>>;
  /** 被移除的 0 金額行的 ref */
  readonly removedZeroLines: readonly string[];
  /** 全部行都被移除（政策篩選後或金額皆為 0） */
  readonly noEffect: boolean;
}
