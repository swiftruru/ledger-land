// ifrs@1 版面的列名要是現行台灣用語（04 第 10.3 節；2026-11-08 的決定，14 第 5.2 節）：可見而且有名詞的列，中文列名要等於名詞的 currentTwLabel
// （沒有現行用語時等於名詞的名稱）；例外逐列列在下面並寫理由，新增的差異要在這裡交代。英文列名不比（版面用 IFRS 英文，名詞的英文另有規則）。
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import ifrsLayout from '../../../packages/core/data/layouts/ifrs@1.json' with { type: 'json' };

type Term = { id: string; label: { 'zh-TW': string }; currentTwLabel: string | null };
const dir = join(import.meta.dirname, '../../../content/terms');
const terms = new Map<string, Term>(
  readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Term)
    .map((t) => [t.id, t]),
);

/** 列名和名詞的現行用語不同的列：鍵是線 ID，值是理由 */
const EXCEPTIONS: Readonly<Record<string, string>> = {
  is_gross_profit: '正式報表的「營業毛利（毛損）」是正負兩用的寫法；教學表用不帶括號的名稱，320px 也放得下',
  is_operating_income: '同上，「營業利益（損失）」',
  is_pretax_income: '同上，「稅前淨利（淨損）」',
  is_net_income: '同上，「本期淨利（淨損）」',
  bs_retained_earnings: '同上，「未分配盈餘（待彌補虧損）」',
  cf_pretax_income: '同上，「稅前淨利（淨損）」',
  is_sga_total: '名詞「銷管費用小計」的現行用語仍是教材口徑的小計名稱；IFRS 對照這一列是營業費用的合計（04 第 10.3 節）',
  is_non_operating_expense_group: '名詞的現行用語是「財務成本、其他利益及損失」兩個項目；版面只有一個營業外費損的分組',
  is_non_operating_expense_total: '同上，分組的合計',
  bs_current_assets: '合計列：名詞「流動資產」是分組名稱，合計列加「合計」',
  bs_current_liabilities: '同上',
  bs_noncurrent_liabilities: '同上',
  bs_machinery_net: '名詞的現行用語「不動產、廠房及設備（機器設備）」是分組加明細的寫法；分組已叫不動產、廠房及設備，明細列只寫機器設備淨額',
  cf_depreciation: '間接法的調整列帶 (+)(-) 提示；名詞的現行用語是不帶提示的科目名',
  cf_interest_expense_addback: '同上',
  cf_receivables_increase: '間接法把增加與減少分成兩列，正式報表的「應收帳款（增加）減少」是合在一列的寫法',
  cf_inventory_increase: '同上，「存貨（增加）減少」',
  cf_receivables_decrease: '同上',
  cf_payables_increase: '同上，「應付帳款增加（減少）」',
  cf_other_liabilities_increase: '同上，「其他營業負債增加（減少）」',
  cf_interest_paid: '帶 (-) 提示的「支付之利息」',
  cf_income_tax_paid: '帶 (-) 提示的「支付之所得稅」',
  cf_loans_advanced: '帶 (-) 提示的「資金貸與」',
  cf_disposal_proceeds: '帶 (+) 提示的「處分不動產、廠房及設備」',
  cf_st_borrowing_proceeds: '帶 (+) 提示的「短期借款增加」',
  cf_st_borrowing_repayment: '帶 (-) 提示的「短期借款減少」',
  cf_share_issue: '帶 (+) 提示的「現金增資」',
  cf_dividends_paid: '帶 (-) 提示的「發放現金股利」',
  cf_lt_borrowing_proceeds: '帶 (+) 提示的「舉借長期借款」',
  cf_lt_borrowing_repayment: '帶 (-) 提示的「償還長期借款」',
  dc_operating_group: '直接法的分組名稱加註「（直接法）」，和間接法區分',
  is_interest_expense: 'IAS 1 的損益表項目是「財務成本」；名詞的現行用語「利息費用」是科目名',
  bs_investments_other: '版面寫「投資及其他資產」，比名詞的「投資其他資產」清楚（兩類資產）',
  bs_deposits_received: '負債側寫「存入保證金」才分得出收到的保證金；名詞的「保證金」兩邊都能指',
  bs_share_subscription_rights: '現行報表的權益項目叫「認股權」；名詞的現行用語沿用教材的「新股預約申購權」',
  cf_capex: '帶 (-) 提示的「取得不動產、廠房及設備」',
  cf_loans_collected: '帶 (+) 提示，而且和「資金貸與(-)」成對寫成「收回資金貸與」；名詞的現行用語是「收回放款(+)」',
};

describe('ifrs@1 版面的列名是現行台灣用語', () => {
  const rows = Object.values(ifrsLayout.statements).flat() as { id: string; label: { 'zh-TW': string }; termRef?: string | null; hidden?: boolean }[];
  const visible = rows.filter((r) => r.hidden !== true && r.termRef);

  it('可見而且有名詞的列：中文列名等於名詞的現行用語，例外都有理由', () => {
    const wrong: string[] = [];
    for (const r of visible) {
      const t = terms.get(r.termRef!);
      if (!t) continue;
      const expected = t.currentTwLabel ?? t.label['zh-TW'];
      if (r.label['zh-TW'] === expected) continue;
      if (r.id in EXCEPTIONS) continue;
      wrong.push(`${r.id}：版面「${r.label['zh-TW']}」，名詞 ${t.id} 的現行用語「${expected}」`);
    }
    expect(wrong).toEqual([]);
  });

  it('例外清單裡的列都真的不同（改成一致之後要把例外拿掉）', () => {
    const stale: string[] = [];
    for (const [id] of Object.entries(EXCEPTIONS)) {
      const r = visible.find((x) => x.id === id);
      const t = r ? terms.get(r.termRef!) : undefined;
      if (!r || !t) {
        stale.push(`${id}：版面沒有這一列或沒有名詞`);
        continue;
      }
      if (r.label['zh-TW'] === (t.currentTwLabel ?? t.label['zh-TW'])) stale.push(`${id}：已經一致`);
    }
    expect(stale).toEqual([]);
  });

  it('開辦費：IFRS 對照的費用列叫開辦費，名詞 tm_hz08w4k5 的現行用語也是開辦費（12 術語表）', () => {
    const row = rows.find((r) => r.id === 'is_organisation_costs_expense');
    expect(row?.label['zh-TW']).toBe('開辦費');
    expect(terms.get('tm_hz08w4k5')?.currentTwLabel).toBe('開辦費');
  });

  it('三種現金流量的合計、直接法與間接法同一條線用同一個名稱', () => {
    const label = (id: string) => rows.find((r) => r.id === id)?.label['zh-TW'];
    expect(label('cf_operating_total')).toBe(label('dc_operating_total'));
    expect(label('cf_investing_total')).toBe(label('dc_investing_total'));
    expect(label('cf_financing_total')).toBe(label('dc_financing_total'));
    expect(label('cf_net_change')).toBe(label('dc_net_change'));
    expect(label('cf_operating_subtotal')).toBe(label('dc_cash_generated_from_operations'));
  });
});
