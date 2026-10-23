// oxlint-disable vitest/no-conditional-expect, vitest/valid-expect, vitest/expect-expect -- 靜態資料檢查依每一列的 kind 與選填欄位分支斷言；expect 的第二個引數是失敗時指出哪一筆資料的訊息；文字規則的斷言在 helpers.ts 裡
// 科目表（04 第 4 節）：資料完整性與 chart 模組。測試只用自編的科目與數字。
import { describe, expect, it } from 'vitest';
import { INDIRECT_RULES, buildChart, isAccountEnabled, normalSign, normaliseName, resolveAccount, type Account } from '../src/accounts/index.ts';
import { defaultAccounts, defaultPolicies, teacherLayout } from '../src/data/index.ts';
import { getPolicy } from '../src/policy/index.ts';
import { expectBritish, expectNoDash, TERM_ID_RE, WRITTEN_TERM_IDS, allStrings } from './helpers.ts';

const chart = buildChart(defaultAccounts);
const teacher = getPolicy('teacher@1')!;
const ifrs = getPolicy('ifrs@1')!;

const ELEMENTS = ['asset', 'liability', 'equity', 'revenue', 'expense'];
const SECTIONS: Record<string, string[]> = {
  asset: ['current_asset', 'noncurrent_asset', 'deferred_asset'],
  liability: ['current_liability', 'noncurrent_liability'],
  equity: ['equity', 'retained_earnings_group'],
  revenue: ['operating_revenue', 'non_operating_income', 'extraordinary_gain'],
  expense: ['cost_of_sales', 'sga_expense', 'non_operating_expense', 'extraordinary_loss', 'income_tax'],
};
const FLAGS = ['japanese', 'old_name', 'typo_fixed', 'unused', 'not_ifrs_line', 'ifrs_treatment_differs', 'not_in_template', 'extension'];

describe('accounts.json 的完整性（04 第 4.2、4.3、4.5 節）', () => {
  it('有 45 個科目：35 個教材科目與 10 個延伸科目，id 唯一且為 snake_case', () => {
    expect(defaultAccounts).toHaveLength(45);
    const ids = defaultAccounts.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9_]*$/);
    expect(defaultAccounts.filter((a) => a.flags.includes('extension'))).toHaveLength(10);
  });

  it('每個科目的 termRef 是 tm_ 加 8 碼 Crockford 小寫，彼此不重複，也不和 content/terms 現有名詞重複', () => {
    const refs = defaultAccounts.map((a) => a.termRef);
    expect(new Set(refs).size).toBe(refs.length);
    for (const ref of refs) {
      expect(ref).toMatch(TERM_ID_RE);
      expect(WRITTEN_TERM_IDS.has(ref)).toBe(false);
    }
  });

  it('04 第 17 節表列的名詞 ID 對應到正確的科目', () => {
    const expected: Record<string, string> = {
      cash: 'tm_c4sh8k2p',
      inventory: 'tm_n7v3k8pq',
      accounts_receivable: 'tm_r7x2c9fa',
      accounts_payable: 'tm_a3p9y6kc',
      short_term_borrowings: 'tm_s5b8r3hd',
      revenue: 'tm_v3n8q2ye',
      cost_of_goods_sold: 'tm_g5c2m8tw',
      deferred_organisation_costs: 'tm_d9f3g7cs',
      interest_expense: 'tm_k6t2e9wr',
      depreciation_expense: 'tm_d4p7x2mv',
      accumulated_depreciation_machinery: 'tm_a8d5c1pz',
      amortisation_deferred_assets: 'tm_a2m7z4tf',
    };
    for (const [id, ref] of Object.entries(expected)) expect(chart.byId.get(id)?.termRef).toBe(ref);
  });

  it('欄位值落在 04 第 4.1 節的列舉內，順序每 10 一跳', () => {
    const orders = chart.accounts.map((a) => a.order);
    for (let i = 0; i < orders.length; i++) expect(orders[i]).toBe((i + 1) * 10);
    for (const a of defaultAccounts) {
      expect(ELEMENTS).toContain(a.element);
      expect(SECTIONS[a.element]).toContain(a.section);
      expect(['debit', 'credit']).toContain(a.normalSide);
      expect(INDIRECT_RULES).toContain(a.cashFlow.indirect);
      for (const f of a.flags) expect(FLAGS).toContain(f);
      expect(new Set(a.flags).size).toBe(a.flags.length);
      for (const p of a.pendingRefs) expect(p).toMatch(/^T\d{2}$/);
      if (a.teacherCell !== null) expect(a.teacherCell).toMatch(/^[LNR]\d{2}$/);
    }
  });

  it('流動性：資產與負債是布林，權益與損益科目為 null；正常餘額依要素', () => {
    for (const a of defaultAccounts) {
      if (a.element === 'asset' || a.element === 'liability') expect(typeof a.current).toBe('boolean');
      else expect(a.current).toBeNull();
      if (a.contraOf === null) {
        const expectedSide = a.element === 'asset' || a.element === 'expense' ? 'debit' : 'credit';
        expect(a.normalSide, a.id).toBe(expectedSide);
      }
    }
  });

  it('延伸科目預設停用並帶 extension 旗標；其他科目預設啟用', () => {
    for (const a of defaultAccounts) {
      expect(a.enabledByDefault, a.id).toBe(!a.flags.includes('extension'));
      if (a.flags.includes('extension')) expect(a.teacherCell).toBeNull();
    }
  });

  it('抵銷科目指向存在的科目且方向相反；累計折舊抵銷機器設備', () => {
    for (const a of defaultAccounts) {
      if (a.contraOf === null) continue;
      const target = chart.byId.get(a.contraOf);
      expect(target).toBeDefined();
      expect(target!.normalSide).not.toBe(a.normalSide);
      expect(target!.element).toBe(a.element);
    }
    expect(chart.byId.get('accumulated_depreciation_machinery')?.contraOf).toBe('machinery_equipment');
  });

  it('ifrs_treatment_differs 旗標與 ifrsTreatment 互為充要；帶 not_ifrs_line 的科目沒有 IFRS 英文', () => {
    for (const a of defaultAccounts) {
      expect(a.ifrsTreatment !== null, a.id).toBe(a.flags.includes('ifrs_treatment_differs'));
      if (a.flags.includes('not_ifrs_line')) expect(a.labels.ifrsEn, a.id).toBeNull();
    }
  });

  it('餘額規則（04 第 6.3 節）：資產、負債、股本與公積不得為負；未分配盈餘、評價差額與損益科目可以', () => {
    for (const a of defaultAccounts) {
      const mayBeNegative = a.element === 'revenue' || a.element === 'expense' || a.id === 'retained_earnings' || a.id === 'valuation_translation_adjustments';
      expect(a.allowNegative, a.id).toBe(mayBeNegative);
    }
  });

  it('間接法規則：現金是 cash；損益科目經 H11 或加回列；所得稅費用不經 H11；抵銷科目 none', () => {
    expect(chart.byId.get('cash')?.cashFlow.indirect).toBe('cash');
    expect(chart.byId.get('accumulated_depreciation_machinery')?.cashFlow).toEqual({ indirect: 'none', defaultActivity: null });
    expect(chart.byId.get('income_tax_expense')?.cashFlow.indirect).toBe('none');
    for (const id of ['depreciation_expense', 'interest_expense', 'amortisation_deferred_assets'])
      expect(chart.byId.get(id)?.cashFlow.indirect).toBe('noncash_addback');
    for (const a of defaultAccounts) {
      if (a.element !== 'revenue' && a.element !== 'expense') continue;
      if (a.cashFlow.indirect === 'noncash_addback' || a.cashFlow.indirect === 'none') continue;
      expect(a.cashFlow.indirect, a.id).toBe('profit_or_loss');
      expect(a.cashFlow.defaultActivity, a.id).toBe('operating');
    }
    for (const a of defaultAccounts) {
      if (a.cashFlow.indirect === 'via_cash_tag') expect(a.cashFlow.defaultActivity, a.id).not.toBeNull();
      if (a.cashFlow.indirect === 'equity_transfer') expect(a.cashFlow.defaultActivity, a.id).toBeNull();
    }
  });

  it('建置期完整性（04 第 11.3 節）：每個可入帳的資產、負債與權益科目都落在營運資金列、非現金加回、現金標籤或排除清單；權益內部移轉另計', () => {
    const lines = Object.values(teacherLayout.statements).flat();
    const inWorkingCapital = new Set(lines.flatMap((l) => (l.kind === 'working_capital' ? [...l.accounts] : [])));
    const h19 = lines.find((l) => l.id === 'cf_other_liabilities_increase');
    const excluded = new Set(h19?.kind === 'working_capital' ? h19.excludeAccounts : []);
    for (const need of ['income_tax_payable', 'interest_payable', 'short_term_borrowings', 'long_term_borrowings', 'dividends_payable'])
      expect(excluded.has(need)).toBe(true);
    for (const a of defaultAccounts) {
      if (a.element === 'revenue' || a.element === 'expense' || a.id === 'cash' || a.contraOf !== null) continue;
      switch (a.cashFlow.indirect) {
        case 'working_capital':
          expect(inWorkingCapital.has(a.id), a.id).toBe(true);
          break;
        case 'excluded':
          expect(excluded.has(a.id), a.id).toBe(true);
          break;
        case 'via_cash_tag':
          expect(['investing', 'financing']).toContain(a.cashFlow.defaultActivity);
          break;
        case 'equity_transfer':
          expect(a.element).toBe('equity');
          break;
        default:
          throw new Error(`${a.id} 的間接法規則 ${a.cashFlow.indirect} 不在建置期完整性檢查的類別內`);
      }
    }
  });

  it('D13 A：修正寫法是主要顯示，教材原字收進別名；短期放貨維持原字（T09）', () => {
    expect(chart.byId.get('accounts_payable')?.labels.aliases['zh-TW']).toContain('應付賬款');
    expect(chart.byId.get('accounts_payable')?.labels.teacher['zh-TW']).toBe('應付帳款');
    const loans = chart.byId.get('short_term_loans_receivable')!;
    expect(loans.labels.teacher['zh-TW']).toBe('短期放貨');
    expect(loans.pendingRefs).toContain('T09');
  });

  it('文字規則：沒有破折號，英文用英式拼字', () => {
    for (const a of defaultAccounts) {
      for (const s of allStrings(a)) expectNoDash(s);
      expectBritish(a.labels.teacher.en);
      for (const s of a.labels.aliases.en) expectBritish(s);
      if (a.ifrsTreatment) {
        expectBritish(a.ifrsTreatment.note.en);
        expectBritish(a.ifrsTreatment.amountImpact.en);
      }
    }
  });
});

describe('buildChart 與 resolveAccount', () => {
  const mk = (over: Partial<Account> & { id: string }): Account => ({
    order: 10,
    element: 'asset',
    section: 'current_asset',
    normalSide: 'debit',
    current: true,
    contraOf: null,
    allowNegative: false,
    enabledByDefault: true,
    teacherCell: null,
    labels: { teacher: { 'zh-TW': over.id, en: over.id }, currentTw: null, ifrsEn: null, aliases: { 'zh-TW': [], en: [] } },
    termRef: 'tm_00000000',
    flags: [],
    ifrsTreatment: null,
    cashFlow: { indirect: 'working_capital', defaultActivity: 'operating' },
    pendingRefs: [],
    ...over,
  });

  it('依 order 排序，order 相同時依 id', () => {
    const c = buildChart([mk({ id: 'b', order: 20 }), mk({ id: 'a', order: 20 }), mk({ id: 'c', order: 10 })]);
    expect(c.accounts.map((a) => a.id)).toEqual(['c', 'a', 'b']);
    expect(c.byId.get('a')?.id).toBe('a');
  });

  it('id 重複、contraOf 不存在、contraOf 指向自己、名稱衝突、空白名稱都 throw', () => {
    expect(() => buildChart([mk({ id: 'a' }), mk({ id: 'a' })])).toThrow(/重複/);
    expect(() => buildChart([mk({ id: 'a', contraOf: 'zz' })])).toThrow(/contraOf/);
    expect(() => buildChart([mk({ id: 'a', contraOf: 'a' })])).toThrow(/自己/);
    const clash = mk({ id: 'b', labels: { teacher: { 'zh-TW': 'b', en: 'B' }, currentTw: null, ifrsEn: null, aliases: { 'zh-TW': ['a'], en: [] } } });
    expect(() => buildChart([mk({ id: 'a' }), clash])).toThrow(/同時指向/);
    const blank = mk({ id: 'c', labels: { teacher: { 'zh-TW': 'c', en: 'C' }, currentTw: null, ifrsEn: null, aliases: { 'zh-TW': [' '], en: [] } } });
    expect(() => buildChart([blank])).toThrow(/空白/);
  });

  it('同一個科目的教材用語與別名相同時不算衝突', () => {
    const dup = mk({ id: 'a', labels: { teacher: { 'zh-TW': '甲', en: 'A' }, currentTw: '甲', ifrsEn: 'A', aliases: { 'zh-TW': ['甲'], en: ['a'] } } });
    expect(() => buildChart([dup])).not.toThrow();
  });

  it('解析 ID、教材用語、現行用語、IFRS 英文與別名；英文不分大小寫、容許多餘空白', () => {
    expect(resolveAccount(chart, 'inventory')?.id).toBe('inventory');
    expect(resolveAccount(chart, '存貨')?.id).toBe('inventory');
    expect(resolveAccount(chart, '應收帳款淨額')?.id).toBe('accounts_receivable');
    expect(resolveAccount(chart, 'Accumulated depreciation')?.id).toBe('accumulated_depreciation_machinery');
    expect(resolveAccount(chart, '應付賬款')?.id).toBe('accounts_payable');
    expect(resolveAccount(chart, '  trade   PAYABLES ')?.id).toBe('accounts_payable');
    expect(resolveAccount(chart, '固定資產')?.id).toBe('machinery_equipment');
    expect(resolveAccount(chart, '不存在的科目')).toBeUndefined();
    expect(normaliseName('  Cash  and   Cash ')).toBe('cash and cash');
  });

  it('isAccountEnabled：依政策停用清單、預設啟用與顯式啟用的延伸科目判斷', () => {
    expect(isAccountEnabled(chart, 'cash', teacher)).toBe(true);
    expect(isAccountEnabled(chart, 'organisation_costs_expense', teacher)).toBe(false);
    expect(isAccountEnabled(chart, 'organisation_costs_expense', ifrs)).toBe(true);
    expect(isAccountEnabled(chart, 'deferred_organisation_costs', ifrs)).toBe(false);
    expect(isAccountEnabled(chart, 'supplies_on_hand', teacher)).toBe(false);
    expect(isAccountEnabled(chart, 'supplies_on_hand', teacher, ['supplies_on_hand'])).toBe(true);
    expect(isAccountEnabled(chart, 'nope', teacher)).toBe(false);
    expect(isAccountEnabled(chart, 'organisation_costs_expense', { ...teacher, disabledAccounts: [] })).toBe(false);
  });

  it('normalSign：借 1、貸 -1', () => {
    expect(normalSign(chart.byId.get('cash')!)).toBe(1);
    expect(normalSign(chart.byId.get('accounts_payable')!)).toBe(-1);
    expect(normalSign(chart.byId.get('accumulated_depreciation_machinery')!)).toBe(-1);
  });

  it('defaultPolicies 裡每套政策停用的科目都存在', () => {
    for (const p of defaultPolicies) {
      for (const id of p.disabledAccounts) expect(chart.byId.has(id), id).toBe(true);
      for (const id of p.enabledAccounts ?? []) expect(chart.byId.get(id)?.flags, id).toContain('extension');
    }
  });
});
