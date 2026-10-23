// 分錄驗證（04 第 6.2 節順序 6 到 11）：每個錯誤碼至少一例、錯誤依檢查順序排列、合法分錄原樣回傳。自編數字。
import { describe, expect, it } from 'vitest';
import {
  type JournalEntry,
  type JournalLine,
  type PolicyDefinition,
  buildChart,
  cashFlowKindMatches,
  defaultAccounts,
  entryTotals,
  getPolicy,
  inventoryTagSide,
  isCashAccount,
  isInventoryAccount,
  isInventoryTag,
  validateEntry,
} from '../src/index.ts';

const chart = buildChart(defaultAccounts);
const teacher = getPolicy('teacher@1') as PolicyDefinition;
const ifrs = getPolicy('ifrs@1') as PolicyDefinition;

const cashIn = (amount: number, ref = 'e1.l1'): JournalLine => ({
  ref,
  account: 'cash',
  side: 'debit',
  amount,
  cf: { activity: 'financing', kind: 'share_issue' },
});
const shares = (amount: number, ref = 'e1.l2'): JournalLine => ({ ref, account: 'share_capital', side: 'credit', amount });
const entry = (lines: JournalLine[]): JournalEntry => ({ eventId: 'e1', template: 'tpl.issue_shares_cash', lines });

function codes(e: JournalEntry, policy = teacher): string[] {
  const r = validateEntry(e, chart, policy);
  return r.ok ? [] : r.error.map((x) => x.code);
}

describe('validateEntry', () => {
  it('合法分錄原樣回傳', () => {
    const e = entry([cashIn(5000), shares(5000)]);
    const r = validateEntry(e, chart, teacher);
    expect(r.ok && r.value).toBe(e);
  });

  it('6 至少兩行：entry.too_few_lines', () => {
    expect(codes(entry([cashIn(1)]))).toContain('entry.too_few_lines');
    expect(codes(entry([]))).toEqual(['entry.too_few_lines']);
  });

  it('7 金額為非負安全整數：entry.amount_invalid（負數、小數、NaN、超出安全範圍）', () => {
    expect(codes(entry([cashIn(-5), shares(-5)]))).toEqual(['entry.amount_invalid', 'entry.amount_invalid']);
    expect(codes(entry([cashIn(1.5), shares(1.5)]))).toEqual(['entry.amount_invalid', 'entry.amount_invalid']);
    expect(codes(entry([cashIn(Number.NaN), shares(0)]))).toContain('entry.amount_invalid');
    expect(codes(entry([cashIn(2 ** 53), shares(0)]))).toContain('entry.amount_invalid');
    // 0 合法（範本實例化時才移除）
    expect(codes(entry([cashIn(0), shares(0)]))).toEqual([]);
  });

  it('8 科目：entry.unknown_account、entry.not_postable（版面的線 ID）、entry.account_disabled（政策停用或延伸科目未啟用）', () => {
    expect(codes(entry([cashIn(10), { ref: 'e1.l2', account: 'petty_cash', side: 'credit', amount: 10 }]))).toEqual(['entry.unknown_account']);
    expect(codes(entry([cashIn(10), { ref: 'e1.l2', account: 'is_revenue', side: 'credit', amount: 10 }]))).toEqual(['entry.not_postable']);
    const orgExpense: JournalLine = { ref: 'e1.l2', account: 'organisation_costs_expense', side: 'debit', amount: 10 };
    const cashOut: JournalLine = {
      ref: 'e1.l1',
      account: 'cash',
      side: 'credit',
      amount: 10,
      cf: { activity: 'operating', kind: 'payments_for_operating_expenses' },
    };
    expect(codes(entry([orgExpense, cashOut]))).toEqual(['entry.account_disabled']);
    expect(codes(entry([orgExpense, cashOut]), ifrs)).toEqual([]);
    const deferred: JournalLine = { ref: 'e1.l2', account: 'deferred_organisation_costs', side: 'debit', amount: 10 };
    expect(codes(entry([deferred, { ...cashOut, cf: { activity: 'investing', kind: 'capex' } }]), ifrs)).toEqual(['entry.account_disabled']);
    const extension: JournalLine = { ref: 'e1.l2', account: 'marketing_expense', side: 'debit', amount: 10 };
    expect(codes(entry([extension, cashOut]))).toEqual(['entry.account_disabled']);
    expect(validateEntry(entry([extension, cashOut]), chart, teacher, { enabledExtensions: ['marketing_expense'] }).ok).toBe(true);
  });

  it('9 借貸相等：entry.unbalanced 附差額（借方減貸方）', () => {
    const r = validateEntry(entry([cashIn(5000), shares(4200)]), chart, teacher);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error[0]).toMatchObject({ code: 'entry.unbalanced', message: { params: { difference: 800, debit: 5000, credit: 4200 } } });
    expect(entryTotals([cashIn(5000), shares(4200)])).toEqual({ debit: 5000, credit: 4200 });
  });

  it('10 現金行標籤：entry.cf_tag_missing、entry.cf_tag_unexpected、entry.cf_tag_mismatch', () => {
    expect(codes(entry([{ ref: 'e1.l1', account: 'cash', side: 'debit', amount: 10 }, shares(10)]))).toEqual(['entry.cf_tag_missing']);
    expect(codes(entry([cashIn(10), { ...shares(10), cf: { activity: 'financing', kind: 'share_issue' } }]))).toEqual(['entry.cf_tag_unexpected']);
    expect(codes(entry([{ ...cashIn(10), cf: { activity: 'operating', kind: 'capex' } }, shares(10)]))).toEqual(['entry.cf_tag_mismatch']);
    expect(cashFlowKindMatches('investing', 'capex')).toBe(true);
    expect(cashFlowKindMatches('operating', 'capex')).toBe(false);
    expect(cashFlowKindMatches('somewhere', 'capex')).toBe(false);
  });

  it('11 存貨行標籤：entry.inv_tag_missing、entry.inv_tag_side；非存貨行帶存貨標籤也是 inv_tag_side', () => {
    const cashOut: JournalLine = { ref: 'e1.l2', account: 'cash', side: 'credit', amount: 10, cf: { activity: 'operating', kind: 'payments_to_suppliers' } };
    expect(codes(entry([{ ref: 'e1.l1', account: 'inventory', side: 'debit', amount: 10 }, cashOut]))).toEqual(['entry.inv_tag_missing']);
    expect(codes(entry([{ ref: 'e1.l1', account: 'inventory', side: 'debit', amount: 10, tag: 'cost_of_sale' }, cashOut]))).toEqual(['entry.inv_tag_side']);
    expect(codes(entry([{ ref: 'e1.l1', account: 'inventory', side: 'debit', amount: 10, tag: 'purchase' }, cashOut]))).toEqual([]);
    expect(codes(entry([{ ref: 'e1.l1', account: 'inventory', side: 'debit', amount: 10, tag: 'dividend' }, cashOut]))).toEqual(['entry.inv_tag_missing']);
    const r = validateEntry(entry([{ ref: 'e1.l1', account: 'outsourcing_expense', side: 'debit', amount: 10, tag: 'purchase' }, cashOut]), chart, teacher);
    expect(!r.ok && r.error[0]).toMatchObject({ code: 'entry.inv_tag_side', message: { params: { reason: 'not_inventory_account' } } });
  });

  it('11 借記未分配盈餘必須標 dividend 或 reserve_appropriation', () => {
    const cashOut: JournalLine = { ref: 'e1.l2', account: 'cash', side: 'credit', amount: 10, cf: { activity: 'financing', kind: 'dividends_paid' } };
    const r = validateEntry(entry([{ ref: 'e1.l1', account: 'retained_earnings', side: 'debit', amount: 10 }, cashOut]), chart, teacher);
    expect(!r.ok && r.error[0]).toMatchObject({ code: 'entry.inv_tag_missing', message: { params: { reason: 'retained_earnings_debit_tag' } } });
    expect(codes(entry([{ ref: 'e1.l1', account: 'retained_earnings', side: 'debit', amount: 10, tag: 'dividend' }, cashOut]))).toEqual([]);
    expect(
      codes(
        entry([
          { ref: 'e1.l1', account: 'retained_earnings', side: 'debit', amount: 10, tag: 'reserve_appropriation' },
          { ref: 'e1.l2', account: 'legal_reserve', side: 'credit', amount: 10 },
        ]),
      ),
    ).toEqual([]);
    // 貸記未分配盈餘不需要標籤
    expect(codes(entry([cashIn(10), { ref: 'e1.l2', account: 'retained_earnings', side: 'credit', amount: 10 }]))).toEqual([]);
  });

  it('錯誤依檢查順序排列，一次回報全部', () => {
    const e = entry([
      { ref: 'e1.l1', account: 'cash', side: 'debit', amount: -3 },
      { ref: 'e1.l2', account: 'nowhere', side: 'credit', amount: 5 },
      { ref: 'e1.l3', account: 'inventory', side: 'credit', amount: 1 },
    ]);
    expect(codes(e)).toEqual(['entry.amount_invalid', 'entry.unknown_account', 'entry.unbalanced', 'entry.cf_tag_missing', 'entry.inv_tag_missing']);
  });

  it('輔助判斷：現金科目、存貨科目、存貨標籤與方向', () => {
    const cash = chart.byId.get('cash');
    const inventory = chart.byId.get('inventory');
    const revenue = chart.byId.get('revenue');
    expect(cash !== undefined && isCashAccount(cash)).toBe(true);
    expect(revenue !== undefined && isCashAccount(revenue)).toBe(false);
    expect(inventory !== undefined && isInventoryAccount(inventory)).toBe(true);
    expect(cash !== undefined && isInventoryAccount(cash)).toBe(false);
    expect(isInventoryTag('purchase')).toBe(true);
    expect(isInventoryTag('dividend')).toBe(false);
    expect(isInventoryTag(undefined)).toBe(false);
    expect(['purchase', 'cost_of_sale', 'count_overage', 'count_shortage'].map((t) => inventoryTagSide(t as never))).toEqual([
      'debit',
      'credit',
      'debit',
      'credit',
    ]);
  });
});
