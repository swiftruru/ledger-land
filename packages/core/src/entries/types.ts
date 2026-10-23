// 分錄比對的型別（04 第 14 節第 1 到 4 點）。作答與正解都是「行的集合」：科目（ID 或別名）、方向、金額。
import type { Side } from '../accounts/types.ts';
import type { Money } from '../money.ts';

export interface EntryLine {
  /** 科目 ID 或別名；normaliseEntries 後一律是科目 ID */
  readonly account: string;
  readonly side: Side;
  /** 非負安全整數 */
  readonly amount: Money;
}

export interface NormaliseEntriesOptions {
  /** 是否接受教材用語、現行用語、IFRS 英文與別名（預設 true）；false 時只接受科目 ID */
  readonly allowAliases?: boolean;
}

export interface NormalisedEntries {
  /** 攤平、合併同科目同方向、移除 0 行之後的行，依科目表 order 排序、借方在前 */
  readonly lines: readonly EntryLine[];
  /** 解析不到科目的原字（去重，依出現順序） */
  readonly unresolved: readonly string[];
}

export interface EntryComparison {
  readonly equal: boolean;
  /** 正解有、作答沒有（或金額不同）的行 */
  readonly missing: readonly EntryLine[];
  /** 作答有、正解沒有（或金額不同）的行 */
  readonly extra: readonly EntryLine[];
  /** 作答或正解裡解析不到的科目 */
  readonly unresolved: readonly string[];
}
