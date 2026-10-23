// 交易範本（04 第 6.2 節順序 1 到 5、第 7 節建置期檢查）：21 個內建範本的編譯與實例化、每個錯誤碼至少一例、policyWhen 篩選。全部用自編數字。
import { describe, expect, it } from 'vitest';
import {
  type CompiledTemplate,
  type CoreError,
  type CoreErrorCode,
  type LedgerState,
  type PolicyDefinition,
  type Result,
  type TransactionTemplate,
  buildChart,
  compileTemplate,
  compileTemplates,
  createLedger,
  defaultAccounts,
  defaultTemplates,
  entryTotals,
  getPolicy,
  instantiateTemplate,
  invalidPolicyWhenKey,
  paramNumericType,
  paramToRat,
  rat,
  unwrap,
  validateEntry,
} from '../src/index.ts';

const chart = buildChart(defaultAccounts);
const teacher = getPolicy('teacher@1') as PolicyDefinition;
const ifrs = getPolicy('ifrs@1') as PolicyDefinition;
const templates = unwrap(compileTemplates(defaultTemplates, chart));
const tpl = (id: string): CompiledTemplate => {
  const t = templates.get(id);
  if (t === undefined) throw new Error(`沒有範本 ${id}`);
  return t;
};

/** 每個範本的前置條件都成立的帳本：借方減貸方，股本讓期初平衡 */
const richState: LedgerState = createLedger(chart, {
  cash: 10_000_000,
  accounts_receivable: 2_000_000,
  inventory: 500_000,
  machinery_equipment: 400_000,
  deferred_organisation_costs: 100_000,
  accounts_payable: -300_000,
  short_term_borrowings: -200_000,
  income_tax_payable: -50_000,
  share_capital: -12_450_000,
});
const emptyState: LedgerState = createLedger(chart);

function errorOf<T>(r: Result<T, CoreError>): CoreError {
  if (r.ok) throw new Error(`預期失敗，卻成功：${JSON.stringify(r.value)}`);
  return r.error;
}
function codeOf<T>(r: Result<T, CoreError>): CoreErrorCode {
  return errorOf(r).code;
}

const text = { 'zh-TW': '測', en: 'T' };
/** 自編的最小範本，測試建置期檢查時逐項改壞 */
function raw(over: Partial<TransactionTemplate>): TransactionTemplate {
  return {
    id: 'tpl.test_case',
    rev: 1,
    revKind: 'text',
    status: 'draft',
    title: text,
    summary: text,
    explanation: text,
    params: [{ name: 'amount', type: 'money', min: 0, max: 1_000_000, default: 1000, label: text }],
    derived: [],
    preconditions: [],
    lines: [
      { id: 'l1', account: 'cash', side: 'debit', amount: 'param.amount', cf: { activity: 'financing', kind: 'share_issue' } },
      { id: 'l2', account: 'share_capital', side: 'credit', amount: 'param.amount' },
    ],
    termRefs: [],
    ...over,
  };
}

describe('compileTemplates：21 個內建範本', () => {
  it('全部能編譯，Map 以範本 ID 為鍵，運算式變成帶型別的 AST', () => {
    expect(templates.size).toBe(21);
    expect([...templates.keys()].sort()).toEqual(defaultTemplates.map((t) => t.id).sort());
    const sell = tpl('tpl.sell_all_inventory_cash');
    expect(sell.derived.map((d) => [d.name, d.ast.valueType])).toEqual([
      ['costOfAllInventory', 'int'],
      ['grossProfit', 'int'],
    ]);
    expect(sell.preconditions[0]?.ast.valueType).toBe('bool');
    expect(sell.lines.map((l) => l.ast.valueType)).toEqual(['int', 'int', 'int', 'int']);
    expect(sell.pendingRefs).toEqual([]);
    expect(sell.source).toBe(defaultTemplates.find((t) => t.id === sell.id));
  });

  it('內建範本都沒有 entryQuestionBlockedBy（14 的 T 系列決定，2026-10-23）；機制仍在：自編範本帶 T99 會被編譯保留，缺省為空陣列', () => {
    expect([...templates.values()].filter((t) => t.entryQuestionBlockedBy.length > 0).map((t) => t.id)).toEqual([]);
    const blocked = unwrap(compileTemplate(raw({ pendingRefs: ['T99'], entryQuestionBlockedBy: ['T99'] }), chart));
    expect(blocked.entryQuestionBlockedBy).toEqual(['T99']);
    expect(blocked.pendingRefs).toEqual(['T99']);
    const plain = unwrap(compileTemplate(raw({}), chart));
    expect(plain.entryQuestionBlockedBy).toEqual([]);
    expect(plain.pendingRefs).toEqual([]);
  });

  it('每個範本以預設參數在兩套政策下實例化都借貸平衡、通過分錄驗證（或本筆無影響）', () => {
    const checked: string[] = [];
    for (const policy of [teacher, ifrs]) {
      for (const t of templates.values()) {
        const inst = unwrap(instantiateTemplate(t, {}, richState, policy, { eventId: 'e1' }));
        const totals = entryTotals(inst.entry.lines);
        expect(totals.debit, `${t.id} ${policy.id}`).toBe(totals.credit);
        expect(inst.entry.eventId).toBe('e1');
        expect(inst.entry.template).toBe(t.id);
        expect(inst.noEffect ? 'noEffect' : validateEntry(inst.entry, chart, policy).ok ? 'valid' : 'invalid', `${t.id} ${policy.id}`).not.toBe('invalid');
        for (const l of inst.entry.lines) expect(l.ref.startsWith('e1.')).toBe(true);
        checked.push(`${t.id}@${policy.id}`);
      }
    }
    expect(checked.length).toBe(42);
  });

  it('同一個 ID 出現兩次是 template.duplicate_id', () => {
    const r = compileTemplates([raw({}), raw({})], chart);
    expect(codeOf(r)).toBe('template.duplicate_id');
  });
});

describe('compileTemplate：建置期檢查的錯誤碼', () => {
  const cases: { name: string; over: Partial<TransactionTemplate>; code: CoreErrorCode; where: string }[] = [
    {
      name: '分錄行引用不存在的科目',
      over: { lines: [{ id: 'l1', account: 'petty_cash', side: 'debit', amount: 'param.amount' }] },
      code: 'template.unknown_account',
      where: 'lines',
    },
    {
      name: '現金行沒有 cf',
      over: { lines: [{ id: 'l1', account: 'cash', side: 'debit', amount: 'param.amount' }] },
      code: 'template.cf_tag_missing',
      where: 'lines',
    },
    {
      name: '非現金行帶 cf',
      over: {
        lines: [{ id: 'l1', account: 'revenue', side: 'credit', amount: 'param.amount', cf: { activity: 'operating', kind: 'receipts_from_customers' } }],
      },
      code: 'template.cf_tag_unexpected',
      where: 'lines',
    },
    {
      name: 'cf 的 kind 與 activity 不相容',
      over: { lines: [{ id: 'l1', account: 'cash', side: 'debit', amount: 'param.amount', cf: { activity: 'operating', kind: 'capex' } }] },
      code: 'template.cf_tag_mismatch',
      where: 'lines',
    },
    {
      name: '存貨行沒有存貨標籤',
      over: { lines: [{ id: 'l1', account: 'inventory', side: 'debit', amount: 'param.amount' }] },
      code: 'template.inv_tag_missing',
      where: 'lines',
    },
    {
      name: '存貨標籤方向錯：purchase 在貸方',
      over: { lines: [{ id: 'l1', account: 'inventory', side: 'credit', amount: 'param.amount', tag: 'purchase' }] },
      code: 'template.inv_tag_side',
      where: 'lines',
    },
    {
      name: '存貨標籤方向錯：cost_of_sale 在借方',
      over: { lines: [{ id: 'l1', account: 'inventory', side: 'debit', amount: 'param.amount', tag: 'cost_of_sale' }] },
      code: 'template.inv_tag_side',
      where: 'lines',
    },
    {
      name: '非存貨行帶存貨標籤',
      over: { lines: [{ id: 'l1', account: 'revenue', side: 'credit', amount: 'param.amount', tag: 'count_overage' }] },
      code: 'template.inv_tag_unexpected',
      where: 'lines',
    },
    {
      name: '借記未分配盈餘沒有用途標籤',
      over: { lines: [{ id: 'l1', account: 'retained_earnings', side: 'debit', amount: 'param.amount' }] },
      code: 'template.equity_tag_missing',
      where: 'lines',
    },
    {
      name: 'policyWhen 的鍵不是政策開關',
      over: { lines: [{ id: 'l1', account: 'revenue', side: 'credit', amount: 'param.amount', policyWhen: { colour: 'red' } as never }] },
      code: 'template.policy_when_invalid',
      where: 'lines',
    },
    {
      name: 'policyWhen 的值不在允許清單',
      over: { lines: [{ id: 'l1', account: 'revenue', side: 'credit', amount: 'param.amount', policyWhen: { orgCosts: 'defer' } as never }] },
      code: 'template.policy_when_invalid',
      where: 'lines',
    },
    {
      name: '分錄行 ID 重複',
      over: {
        lines: [
          { id: 'l1', account: 'revenue', side: 'credit', amount: 'param.amount' },
          { id: 'l1', account: 'revenue', side: 'debit', amount: 'param.amount' },
        ],
      },
      code: 'template.duplicate_id',
      where: 'lines',
    },
    {
      name: '參數名稱重複',
      over: {
        params: [
          { name: 'a', type: 'money', min: 0, max: 1, default: 0, label: text },
          { name: 'a', type: 'money', min: 0, max: 1, default: 0, label: text },
        ],
      },
      code: 'template.duplicate_id',
      where: 'params',
    },
    {
      name: '參數的 default 不在範圍',
      over: { params: [{ name: 'a', type: 'money', min: 1, max: 5, default: 9, label: text }] },
      code: 'template.param_spec_invalid',
      where: 'params',
    },
    {
      name: '整數型參數的範圍不是整數',
      over: { params: [{ name: 'a', type: 'years', min: 0.5, max: 5, default: 1, label: text }] },
      code: 'template.param_spec_invalid',
      where: 'params',
    },
    {
      name: '推導值與參數同名',
      over: { derived: [{ name: 'amount', type: 'money', expr: '1', label: text }] },
      code: 'template.duplicate_id',
      where: 'derived',
    },
    {
      name: '前置條件 ID 重複',
      over: {
        preconditions: [
          { id: 'p', expr: '1 > 0', message: text },
          { id: 'p', expr: '1 > 0', message: text },
        ],
      },
      code: 'template.duplicate_id',
      where: 'preconditions',
    },
    {
      name: '推導值引用後面的推導值',
      over: {
        derived: [
          { name: 'a', type: 'money', expr: 'derived.b', label: text },
          { name: 'b', type: 'money', expr: '1', label: text },
        ],
      },
      code: 'expr.unknown_ref',
      where: 'derived',
    },
    {
      name: '推導值引用自己',
      over: { derived: [{ name: 'a', type: 'money', expr: 'derived.a + 1', label: text }] },
      code: 'expr.unknown_ref',
      where: 'derived',
    },
    {
      name: 'money 型推導值不是整數',
      over: { derived: [{ name: 'a', type: 'money', expr: 'param.amount / 3', label: text }] },
      code: 'expr.round_required',
      where: 'derived',
    },
    {
      name: '分錄行金額用了 round',
      over: { lines: [{ id: 'l1', account: 'revenue', side: 'credit', amount: 'round(param.amount / 3)' }] },
      code: 'expr.unknown_function',
      where: 'lines',
    },
    {
      name: '分錄行金額是有理數',
      over: { lines: [{ id: 'l1', account: 'revenue', side: 'credit', amount: 'param.amount / 3' }] },
      code: 'expr.round_required',
      where: 'lines',
    },
    { name: '前置條件不是布林', over: { preconditions: [{ id: 'p', expr: 'param.amount', message: text }] }, code: 'expr.type', where: 'preconditions' },
    {
      name: '運算式引用不存在的科目',
      over: { derived: [{ name: 'a', type: 'money', expr: 'balance(petty_cash)', label: text }] },
      code: 'expr.unknown_account',
      where: 'derived',
    },
    { name: '運算式解析失敗', over: { preconditions: [{ id: 'p', expr: 'param.amount >', message: text }] }, code: 'expr.parse', where: 'preconditions' },
  ];
  it.each(cases)('$name', (c) => {
    const e = errorOf(compileTemplate(raw(c.over), chart));
    expect(e.code).toBe(c.code);
    expect(e['template']).toBe('tpl.test_case');
    expect(e['where']).toBe(c.where);
  });

  it('money 型推導值的 round 與 number 型推導值的有理數都合法', () => {
    const t = unwrap(
      compileTemplate(
        raw({
          derived: [
            { name: 'third', type: 'number', expr: 'param.amount / 3', label: text },
            { name: 'rounded', type: 'money', expr: 'round(derived.third)', label: text },
          ],
          lines: [
            { id: 'l1', account: 'cash', side: 'debit', amount: 'derived.rounded', cf: { activity: 'financing', kind: 'share_issue' } },
            { id: 'l2', account: 'share_capital', side: 'credit', amount: 'derived.rounded' },
          ],
        }),
        chart,
      ),
    );
    expect(t.derived.map((d) => d.ast.valueType)).toEqual(['rat', 'int']);
    const inst = unwrap(instantiateTemplate(t, { amount: 1001 }, emptyState, teacher, { eventId: 'e2' }));
    expect(inst.derivedValues).toEqual({ amount: 1001, third: '1001/3', rounded: 334 });
    expect(inst.entry.lines.map((l) => [l.ref, l.amount])).toEqual([
      ['e2.l1', 334],
      ['e2.l2', 334],
    ]);
  });

  it('paramNumericType 與 invalidPolicyWhenKey', () => {
    expect(paramNumericType('money')).toBe('int');
    expect(paramNumericType('count')).toBe('int');
    expect(paramNumericType('years')).toBe('int');
    expect(paramNumericType('rate')).toBe('rat');
    expect(invalidPolicyWhenKey({})).toBeUndefined();
    expect(invalidPolicyWhenKey({ orgCosts: 'expense', incomeTax: 'accrue_then_pay' })).toBeUndefined();
    expect(invalidPolicyWhenKey({ orgCosts: undefined })).toBeUndefined();
    expect(invalidPolicyWhenKey({ orgCosts: 'nope' } as never)).toBe('orgCosts');
  });
});

describe('instantiateTemplate：順序 1 到 5 與執行期錯誤碼', () => {
  const sell = tpl('tpl.sell_all_inventory_cash');
  const count = tpl('tpl.inventory_count');

  it('1 參數：缺的用預設值；超出範圍 param.out_of_range；型別不對、多出的參數是 param.type', () => {
    const byDefault = unwrap(instantiateTemplate(sell, {}, richState, teacher, { eventId: 'e1' }));
    expect(byDefault.paramValues).toEqual({ price: 1_000_000 });
    expect(errorOf(instantiateTemplate(sell, { price: -1 }, richState, teacher, { eventId: 'e1' }))).toMatchObject({
      code: 'param.out_of_range',
      message: { params: { param: 'price', value: -1, min: 0, max: 999_999_999_999 } },
    });
    expect(codeOf(instantiateTemplate(sell, { price: 1_000_000_000_000 }, richState, teacher, { eventId: 'e1' }))).toBe('param.out_of_range');
    expect(codeOf(instantiateTemplate(sell, { price: 1.5 }, richState, teacher, { eventId: 'e1' }))).toBe('param.type');
    expect(codeOf(instantiateTemplate(sell, { price: Number.NaN }, richState, teacher, { eventId: 'e1' }))).toBe('param.type');
    expect(codeOf(instantiateTemplate(sell, { price: 'many' as never }, richState, teacher, { eventId: 'e1' }))).toBe('param.type');
    expect(errorOf(instantiateTemplate(sell, { price: 100, discount: 1 }, richState, teacher, { eventId: 'e1' }))).toMatchObject({
      code: 'param.type',
      message: { params: { param: 'discount', reason: 'not_declared' } },
    });
  });

  it('paramToRat：rate 型接受十進位、拒絕科學記號；整數型拒絕小數', () => {
    const rate = { name: 'r', type: 'rate' as const, min: 0, max: 1, default: 0.1, label: text };
    expect(unwrap(paramToRat(rate, 0.25))).toEqual(rat(1n, 4n));
    expect(unwrap(paramToRat(rate, 1))).toEqual(rat(1n));
    expect(codeOf(paramToRat(rate, 1e-7))).toBe('param.type');
    expect(codeOf(paramToRat(rate, 2))).toBe('param.out_of_range');
    expect(codeOf(paramToRat({ ...rate, type: 'count' }, 0.5))).toBe('param.type');
  });

  it('2 推導值依序求值，看得到「這個事件之前」的 balance 與 cost；錯誤碼透傳', () => {
    const inst = unwrap(instantiateTemplate(sell, { price: 800_000 }, richState, teacher, { eventId: 'e1' }));
    expect(inst.derivedValues).toEqual({ price: 800_000, costOfAllInventory: 500_000, grossProfit: 300_000 });
    const divide = unwrap(
      compileTemplate(
        raw({
          params: [
            { name: 'a', type: 'money', min: 0, max: 999_999_999_999, default: 10, label: text },
            { name: 'b', type: 'count', min: 0, max: 10, default: 0, label: text },
          ],
          derived: [{ name: 'q', type: 'money', expr: 'round(param.a / param.b)', label: text }],
          lines: [
            { id: 'l1', account: 'cash', side: 'debit', amount: 'derived.q', cf: { activity: 'financing', kind: 'share_issue' } },
            { id: 'l2', account: 'share_capital', side: 'credit', amount: 'derived.q' },
          ],
        }),
        chart,
      ),
    );
    expect(errorOf(instantiateTemplate(divide, { a: 10, b: 0 }, emptyState, teacher, { eventId: 'e1' }))).toMatchObject({
      code: 'expr.division_by_zero',
      derived: 'q',
    });
    const overflow = unwrap(
      compileTemplate(
        raw({
          params: [{ name: 'a', type: 'money', min: 0, max: 999_999_999_999, default: 10, label: text }],
          derived: [{ name: 'big', type: 'money', expr: 'param.a * param.a', label: text }],
          lines: [
            { id: 'l1', account: 'cash', side: 'debit', amount: 'derived.big', cf: { activity: 'financing', kind: 'share_issue' } },
            { id: 'l2', account: 'share_capital', side: 'credit', amount: 'derived.big' },
          ],
        }),
        chart,
      ),
    );
    expect(codeOf(instantiateTemplate(overflow, { a: 999_999_999_999 }, emptyState, teacher, { eventId: 'e1' }))).toBe('money.overflow');
    expect(unwrap(instantiateTemplate(overflow, { a: 3 }, emptyState, teacher, { eventId: 'e1' })).derivedValues['big']).toBe(9);
  });

  it('3 前置條件失敗回 precondition.failed，附條件 ID 與說明', () => {
    const e = errorOf(instantiateTemplate(sell, { price: 100 }, emptyState, teacher, { eventId: 'e1' }));
    expect(e.code).toBe('precondition.failed');
    expect(e['precondition']).toBe('has_inventory');
    expect(e['preconditionMessage']).toEqual(sell.preconditions[0]?.message);
    // 分錄行金額求值失敗也透傳（分錄行本身的除以 0 要用 number 型推導值繞過 round，這裡用前置條件的除法）
    const pre = unwrap(
      compileTemplate(
        raw({
          params: [
            { name: 'amount', type: 'money', min: 0, max: 1_000_000, default: 1000, label: text },
            { name: 'b', type: 'count', min: 0, max: 10, default: 0, label: text },
          ],
          preconditions: [{ id: 'ratio_ok', expr: '10 / param.b > 1', message: text }],
        }),
        chart,
      ),
    );
    expect(errorOf(instantiateTemplate(pre, { b: 0 }, emptyState, teacher, { eventId: 'e1' }))).toMatchObject({
      code: 'expr.division_by_zero',
      precondition: 'ratio_ok',
    });
    expect(unwrap(instantiateTemplate(pre, { b: 2 }, emptyState, teacher, { eventId: 'e1' })).entry.lines.length).toBe(2);
  });

  it('4 與 5：移除金額為 0 的行並記錄；全部移除時 noEffect', () => {
    const zeroPrice = unwrap(instantiateTemplate(sell, { price: 0 }, richState, teacher, { eventId: 'e1' }));
    expect(zeroPrice.removedZeroLines).toEqual(['e1.l1', 'e1.l2']);
    expect(zeroPrice.entry.lines.map((l) => l.ref)).toEqual(['e1.l3', 'e1.l4']);
    expect(zeroPrice.noEffect).toBe(false);
    const nothing = unwrap(instantiateTemplate(tpl('tpl.borrow_short_term'), { amount: 0 }, emptyState, teacher, { eventId: 'e1' }));
    expect(nothing.noEffect).toBe(true);
    expect(nothing.entry.lines).toEqual([]);
    expect(nothing.removedZeroLines).toEqual(['e1.l1', 'e1.l2']);
  });

  it('分錄行帶 cf 與 tag 原樣進入分錄', () => {
    const inst = unwrap(instantiateTemplate(tpl('tpl.purchase_inventory_cash'), { amount: 5000 }, richState, teacher, { eventId: 'e3' }));
    expect(inst.entry.lines).toEqual([
      { ref: 'e3.l1', account: 'inventory', side: 'debit', amount: 5000, tag: 'purchase' },
      { ref: 'e3.l2', account: 'cash', side: 'credit', amount: 5000, cf: { activity: 'operating', kind: 'payments_to_suppliers' } },
    ]);
  });

  describe('policyWhen 篩選', () => {
    it('pay_org_costs：teacher@1 資本化為設立費（投資活動），ifrs@1 直接費用化（營業活動）', () => {
      const t = tpl('tpl.pay_org_costs');
      const a = unwrap(instantiateTemplate(t, { amount: 7000 }, richState, teacher, { eventId: 'e1' }));
      expect(a.entry.lines.map((l) => [l.ref, l.account, l.cf?.activity])).toEqual([
        ['e1.l1', 'deferred_organisation_costs', undefined],
        ['e1.l2', 'cash', 'investing'],
      ]);
      const b = unwrap(instantiateTemplate(t, { amount: 7000 }, richState, ifrs, { eventId: 'e1' }));
      expect(b.entry.lines.map((l) => [l.ref, l.account, l.cf?.activity])).toEqual([
        ['e1.l3', 'organisation_costs_expense', undefined],
        ['e1.l4', 'cash', 'operating'],
      ]);
      expect(validateEntry(b.entry, chart, ifrs).ok).toBe(true);
      expect(validateEntry(b.entry, chart, teacher).ok).toBe(false);
    });

    it('amortise_org_costs：teacher@1 攤銷，ifrs@1 兩行都被篩掉成本筆無影響（不算 0 行）', () => {
      const t = tpl('tpl.amortise_org_costs');
      const a = unwrap(instantiateTemplate(t, { years: 5 }, richState, teacher, { eventId: 'e2' }));
      expect(a.entry.lines.map((l) => [l.account, l.side, l.amount])).toEqual([
        ['amortisation_deferred_assets', 'debit', 20_000],
        ['deferred_organisation_costs', 'credit', 20_000],
      ]);
      const b = unwrap(instantiateTemplate(t, { years: 5 }, richState, ifrs, { eventId: 'e2' }));
      expect(b.noEffect).toBe(true);
      expect(b.removedZeroLines).toEqual([]);
      expect(b.derivedValues).toEqual({ years: 5, amount: 20_000 });
    });

    it('inventory_count：盤盈在三種 inventoryOverage 下貸記不同科目，盤損一律借營業成本', () => {
      const variants: PolicyDefinition['switches']['inventoryOverage'][] = ['reduce_cogs', 'non_operating_income', 'extraordinary_gain'];
      const credited = variants.map((inventoryOverage) => {
        const policy: PolicyDefinition = { ...teacher, id: `test@${inventoryOverage}`, switches: { ...teacher.switches, inventoryOverage } };
        const inst = unwrap(instantiateTemplate(count, { countedAmount: 620_000 }, richState, policy, { eventId: 'e1' }));
        expect(inst.derivedValues).toEqual({ countedAmount: 620_000, overage: 120_000, shortage: 0 });
        expect(inst.removedZeroLines).toEqual(['e1.l5', 'e1.l6']);
        expect(inst.entry.lines[0]).toEqual({ ref: 'e1.l1', account: 'inventory', side: 'debit', amount: 120_000, tag: 'count_overage' });
        return inst.entry.lines[1]?.account;
      });
      expect(credited).toEqual(['cost_of_goods_sold', 'non_operating_income', 'extraordinary_gains']);
      const shortage = unwrap(instantiateTemplate(count, { countedAmount: 380_000 }, richState, teacher, { eventId: 'e1' }));
      expect(shortage.entry.lines).toEqual([
        { ref: 'e1.l5', account: 'cost_of_goods_sold', side: 'debit', amount: 120_000 },
        { ref: 'e1.l6', account: 'inventory', side: 'credit', amount: 120_000, tag: 'count_shortage' },
      ]);
      const exact = unwrap(instantiateTemplate(count, { countedAmount: 500_000 }, richState, teacher, { eventId: 'e1' }));
      expect(exact.noEffect).toBe(true);
      expect(exact.removedZeroLines).toEqual(['e1.l1', 'e1.l2', 'e1.l5', 'e1.l6']);
    });

    it('pay_income_tax_cash 在 accrue_then_pay 下改貸應付所得稅', () => {
      const policy: PolicyDefinition = { ...teacher, id: 'test@accrue', switches: { ...teacher.switches, incomeTax: 'accrue_then_pay' } };
      const inst = unwrap(instantiateTemplate(tpl('tpl.pay_income_tax_cash'), { amount: 9000 }, richState, policy, { eventId: 'e1' }));
      expect(inst.entry.lines.map((l) => [l.ref, l.account])).toEqual([
        ['e1.l3', 'income_tax_expense'],
        ['e1.l4', 'income_tax_payable'],
      ]);
    });
  });
});
