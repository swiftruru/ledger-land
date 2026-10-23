// 分錄型別與驗證（04 第 6.1、6.2 節）
export {
  INVENTORY_ACCOUNT_ID,
  RETAINED_EARNINGS_ACCOUNT_ID,
  RETAINED_EARNINGS_DEBIT_TAGS,
  cashFlowKindMatches,
  entryTotals,
  inventoryTagSide,
  isCashAccount,
  isInventoryAccount,
  isInventoryTag,
  validateEntry,
} from './validate.ts';
export type { ValidateEntryOptions } from './validate.ts';
export type { JournalEntry, JournalLine } from './types.ts';
