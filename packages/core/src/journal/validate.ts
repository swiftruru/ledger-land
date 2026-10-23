// 分錄驗證（04 第 6.2 節順序 6 到 11）。回傳所有找到的錯誤，依檢查順序排列；呼叫端通常只看第一個。
// 第 1 到 5 步（參數、推導值、前置條件、政策篩選、移除 0 行）在範本實例化時完成，第 12 步（餘額規則）在過帳時檢查。
import type { Account, Chart, Side } from '../accounts/types.ts';
import { isAccountEnabled } from '../accounts/chart.ts';
import { CASH_FLOW_KINDS, INVENTORY_TAGS, type InventoryTag, type LineTag } from '../data/types.ts';
import { type Money, isMoney } from '../money.ts';
import type { PolicyDefinition } from '../policy/types.ts';
import { type CoreError, type Result, coreError, err, ok } from '../result.ts';
import type { JournalEntry, JournalLine } from './types.ts';

/** 存貨科目的 ID；科目表沒有「存貨」旗標，核心以這個 ID 辨認存貨行 */
export const INVENTORY_ACCOUNT_ID = 'inventory';
/** 版面列的線 ID 前綴：手寫分錄引用到版面的標題列或公式列時回 entry.not_postable（04 第 4.4 節） */
const LINE_ID_PREFIX_RE = /^(is|bs|cf|dc)_/;
/** 借記未分配盈餘時必須標示的用途（04 第 6.1 節） */
export const RETAINED_EARNINGS_DEBIT_TAGS: readonly LineTag[] = ['dividend', 'reserve_appropriation'];
export const RETAINED_EARNINGS_ACCOUNT_ID = 'retained_earnings';

/** 現金科目：間接法規則為 cash 的科目，每條現金行必須帶現金流量標籤 */
export const isCashAccount = (account: Account): boolean => account.cashFlow.indirect === 'cash';
export const isInventoryAccount = (account: Account): boolean => account.id === INVENTORY_ACCOUNT_ID;
export const isInventoryTag = (tag: string | undefined): tag is InventoryTag => tag !== undefined && (INVENTORY_TAGS as readonly string[]).includes(tag);

/** 存貨標籤允許的借貸方向（04 第 5.3 節第 4 條）：purchase 與 count_overage 借方、cost_of_sale 與 count_shortage 貸方 */
export function inventoryTagSide(tag: InventoryTag): Side {
  return tag === 'purchase' || tag === 'count_overage' ? 'debit' : 'credit';
}

/** 現金流量標籤的 kind 是否屬於該 activity */
export function cashFlowKindMatches(activity: string, kind: string): boolean {
  const kinds = activity === 'operating' || activity === 'investing' || activity === 'financing' ? CASH_FLOW_KINDS[activity] : undefined;
  return kinds !== undefined && (kinds as readonly string[]).includes(kind);
}

/** 借方與貸方合計；金額已經是安全整數時才有意義（分錄行數有限，合計不會超過安全範圍，仍以 isMoney 防呆） */
export function entryTotals(lines: readonly JournalLine[]): { readonly debit: Money; readonly credit: Money } {
  let debit = 0;
  let credit = 0;
  for (const l of lines) {
    if (!isMoney(l.amount)) continue;
    if (l.side === 'debit') debit += l.amount;
    else credit += l.amount;
  }
  return { debit, credit };
}

export interface ValidateEntryOptions {
  /** 實驗啟用的延伸科目（04 第 4.5 節） */
  readonly enabledExtensions?: readonly string[];
}

/**
 * 04 第 6.2 節順序 6 到 11：行數、金額、科目、借貸平衡、現金行標籤、存貨行標籤（含借記未分配盈餘的用途標籤）。
 * 回傳的錯誤依檢查順序排列；每個錯誤帶 ref（行）與 account 方便畫面指出位置。
 */
export function validateEntry(
  entry: JournalEntry,
  chart: Chart,
  policy: PolicyDefinition,
  options: ValidateEntryOptions = {},
): Result<JournalEntry, readonly CoreError[]> {
  const errors: CoreError[] = [];
  const { lines } = entry;
  // 6 至少兩行
  if (lines.length < 2) errors.push(coreError('entry.too_few_lines', { eventId: entry.eventId, count: lines.length }));
  // 7 金額為非負安全整數
  for (const l of lines) {
    if (!isMoney(l.amount) || l.amount < 0) errors.push(coreError('entry.amount_invalid', { ref: l.ref, account: l.account, amount: String(l.amount) }));
  }
  // 8 科目存在、可入帳、在目前政策下已啟用
  for (const l of lines) {
    const account = chart.byId.get(l.account);
    if (account === undefined) {
      errors.push(coreError(LINE_ID_PREFIX_RE.test(l.account) ? 'entry.not_postable' : 'entry.unknown_account', { ref: l.ref, account: l.account }));
      continue;
    }
    if (!isAccountEnabled(chart, l.account, policy, options.enabledExtensions))
      errors.push(coreError('entry.account_disabled', { ref: l.ref, account: l.account, policy: policy.id }));
  }
  // 9 借貸相等（附差額：借方減貸方）
  const totals = entryTotals(lines);
  if (totals.debit !== totals.credit)
    errors.push(
      coreError('entry.unbalanced', { eventId: entry.eventId, difference: totals.debit - totals.credit, debit: totals.debit, credit: totals.credit }),
    );
  // 10 現金行標籤
  for (const l of lines) {
    const account = chart.byId.get(l.account);
    if (account === undefined) continue;
    if (isCashAccount(account)) {
      if (l.cf === undefined) errors.push(coreError('entry.cf_tag_missing', { ref: l.ref, account: l.account }));
      else if (!cashFlowKindMatches(l.cf.activity, l.cf.kind))
        errors.push(coreError('entry.cf_tag_mismatch', { ref: l.ref, account: l.account, activity: l.cf.activity, kind: l.cf.kind }));
    } else if (l.cf !== undefined) {
      errors.push(coreError('entry.cf_tag_unexpected', { ref: l.ref, account: l.account }));
    }
  }
  // 11 存貨行標籤與方向；借記未分配盈餘的用途標籤
  for (const l of lines) {
    const account = chart.byId.get(l.account);
    if (account === undefined) continue;
    if (isInventoryAccount(account)) {
      if (!isInventoryTag(l.tag)) errors.push(coreError('entry.inv_tag_missing', { ref: l.ref, account: l.account }));
      else if (inventoryTagSide(l.tag) !== l.side) errors.push(coreError('entry.inv_tag_side', { ref: l.ref, account: l.account, tag: l.tag, side: l.side }));
    } else if (isInventoryTag(l.tag)) {
      errors.push(coreError('entry.inv_tag_side', { ref: l.ref, account: l.account, tag: l.tag, side: l.side, reason: 'not_inventory_account' }));
    } else if (account.id === RETAINED_EARNINGS_ACCOUNT_ID && l.side === 'debit' && (l.tag === undefined || !RETAINED_EARNINGS_DEBIT_TAGS.includes(l.tag))) {
      errors.push(coreError('entry.inv_tag_missing', { ref: l.ref, account: l.account, reason: 'retained_earnings_debit_tag' }));
    }
  }
  return errors.length === 0 ? ok(entry) : err(errors);
}
