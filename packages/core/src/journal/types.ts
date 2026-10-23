// 分錄的型別（04 第 6.1 節）。分錄是唯一的會計事實；餘額、報表、effects 都由它推導。
import type { Side } from '../accounts/types.ts';
import type { CashFlowTag, LineTag } from '../data/types.ts';
import type { Money } from '../money.ts';

export interface JournalLine {
  /** 事件 ID 加範本行 ID：'e1.l3'，供追蹤與 effects 使用 */
  readonly ref: string;
  readonly account: string;
  readonly side: Side;
  /** 非負整數 */
  readonly amount: Money;
  /** 只有 cash 行有，而且必須有 */
  readonly cf?: CashFlowTag;
  /** inventory 行必須有存貨類標籤；借記未分配盈餘時標示用途 */
  readonly tag?: LineTag;
}

export interface JournalEntry {
  readonly eventId: string;
  readonly template: string;
  readonly lines: readonly JournalLine[];
}
