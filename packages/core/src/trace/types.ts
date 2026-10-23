// 追蹤樹的型別（04 第 6.4 節，D10(c) A：完整公式樹與來源分錄）。
// 名稱與 04 的對照：TraceNode 相同；04 的 AccountTrace 與 SourceRef 在這裡叫 TraceAccount 與 TraceSourceRef，
// 因為 statements 模組已經以 AccountTrace、SourceRef 匯出它的中間介面（lineAccountTraces），兩者形狀不同，不能同名匯出。
import type { Money } from '../money.ts';

/**
 * 與版面列的 kind 對應：formula、link、accounts、working_capital、cash_tag 同名；
 * inventory_opening、inventory_purchases、inventory_closing、inventory_overage 都是 inventory；
 * 04 的聯集沒有列出的 kind 直接沿用 kind 名稱：total（sum 的線相加）、balance_end（from 的線相加）、
 * retained_earnings（帳戶餘額加本期淨利子節點）、noncash_addback（發生額加回）、balance_begin（期初餘額）、group（標題列，值為 0）。
 */
export type TraceRule =
  | 'formula'
  | 'link'
  | 'accounts'
  | 'working_capital'
  | 'cash_tag'
  | 'inventory'
  | 'total'
  | 'balance_end'
  | 'retained_earnings'
  | 'noncash_addback'
  | 'balance_begin'
  | 'group';

export const TRACE_RULES: readonly TraceRule[] = [
  'formula',
  'link',
  'accounts',
  'working_capital',
  'cash_tag',
  'inventory',
  'total',
  'balance_end',
  'retained_earnings',
  'noncash_addback',
  'balance_begin',
  'group',
];

/** 最底層：來源步驟、事件與分錄行（與 JournalLine.ref 相同） */
export interface TraceSourceRef {
  readonly stepId: string;
  readonly eventId: string;
  /** 'e1.l3' */
  readonly lineRef: string;
  readonly side: 'debit' | 'credit';
  /** 分錄行金額（非負） */
  readonly amount: Money;
  /** 換算成該科目正常餘額表示的帶號金額；現金行（cash_tag 列）則是流入為正、流出為負 */
  readonly signedAmount: Money;
}

/** 這一列直接取用的一個科目 */
export interface TraceAccount {
  readonly account: string;
  /** 以什麼正負號進入這一列，例如 H16 存貨增加(-) 為 -1、抵銷科目為 -1 */
  readonly sign: 1 | -1;
  /**
   * 視窗起點帶進來的餘額（正常餘額表示）：只有累計視窗的餘額型列、且帳本有期初（自訂期初的情境）時不為 0。
   * 04 第 6.4 節沒有這個欄位；加上它之後「opening 加 sources 的帶號合計等於 amount」在自訂期初的情境也成立。
   */
  readonly opening: Money;
  /** 這一列從該科目取用的金額（餘額、發生額、變動量或某種標籤的合計），正常餘額表示 */
  readonly amount: Money;
  /** 視窗內構成 amount 的每一條分錄行 */
  readonly sources: readonly TraceSourceRef[];
}

export interface TraceNote {
  readonly key: 'trace.filled_in_other_line' | 'trace.not_in_policy';
  readonly params: Readonly<Record<string, string>>;
}

export interface TraceNode {
  /** 線 ID */
  readonly line: string;
  /** 老師模板的儲存格；模板沒有的列為 null */
  readonly cell: string | null;
  /** 與 buildStatements 同一列的值相同 */
  readonly value: Money;
  readonly rule: TraceRule;
  /** rule 為 formula 時的版面公式 */
  readonly expr?: string;
  /** 公式、連結、合計引用的列；沒有時為空陣列 */
  readonly children: readonly TraceNode[];
  /** 這一列直接取用的科目；沒有時為空陣列 */
  readonly accounts: readonly TraceAccount[];
  /** 只有 cash_tag 列直接列出現金行；其他為空陣列 */
  readonly sources: readonly TraceSourceRef[];
  /** 例如 H15、H17 擇一時，指向實際填入的列；盤盈列在目前政策下不適用 */
  readonly note?: TraceNote;
}

export type TraceInvariantRule = 'root_equals_line' | 'formula_equals_children' | 'sum_equals_value' | 'account_sources_sum' | 'source_resolves';

export interface TraceInvariantFailure {
  readonly rule: TraceInvariantRule;
  readonly line: string;
  readonly expected: Money;
  readonly actual: Money;
  /** 科目層或來源行的位置（有的話） */
  readonly at?: string;
}

export interface TraceVerification {
  readonly pass: boolean;
  readonly failures: readonly TraceInvariantFailure[];
  /** 走訪過的節點數（含共用的子樹各算一次） */
  readonly nodes: number;
}
