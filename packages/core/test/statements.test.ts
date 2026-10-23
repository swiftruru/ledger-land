// oxlint-disable vitest/expect-expect, vitest/valid-expect, vitest/no-conditional-expect -- 逐列對照與不變式檢查寫成 helper 共用；expect 的第二個引數是失敗時指出哪一列的訊息；追蹤的加總只對葉列比對
// 教材版面三表（04 第 5.2、11 節、第 17 節的黃金數字）：青檸文具社的累計與本筆變動、政策與版面選項、不變式、追蹤介面。自編數字。
import { describe, expect, it } from 'vitest';
import {
  type CoreContext,
  type Layout,
  type LayoutLine,
  type PolicyDefinition,
  type PostedRun,
  type StatementWindow,
  type Statements,
  type Story,
  buildStatements,
  checkStatementInvariants,
  compileLayout,
  createCoreContext,
  createLedger,
  lineAccountTraces,
  lineDependencies,
  lineValue,
  measureMap,
  recomputeWithInputs,
  replayStory,
  statementInvariantsHold,
  teacherLayout,
  unwrap,
} from '../src/index.ts';
import { LIME_LEAF_STEP_IDS as S, limeLeafStory } from './fixtures/story-lime-leaf.ts';

const ctx: CoreContext = createCoreContext();
const run = unwrap(replayStory(limeLeafStory, [], ctx));
const cumulative = (to: string | null): StatementWindow => ({ kind: 'cumulative', to });
const transaction = (step: string): StatementWindow => ({ kind: 'transaction', step });
const build = (r: PostedRun, w: StatementWindow, layout: Layout = ctx.layout, policy: PolicyDefinition = ctx.policy): Statements =>
  buildStatements(r, w, layout, policy);
const value = (st: Statements, id: string): number => lineValue(st, id).value;

function expectValues(st: Statements, expected: Readonly<Record<string, number>>): void {
  const actual: Record<string, number> = {};
  for (const id of Object.keys(expected)) actual[id] = value(st, id);
  expect(actual).toEqual(expected);
}

/** 不變式全部成立；失敗時列出不成立的規則 */
function expectInvariants(st: Statements): void {
  const failed = checkStatementInvariants(st).filter((r) => !r.pass);
  expect(failed, JSON.stringify(failed)).toEqual([]);
}

describe('青檸文具社第 18 步累計（04 第 17 節）', () => {
  const st = build(run, cumulative(null));

  it('損益表五層利益與各列', () => {
    expectValues(st, {
      is_revenue: 6_720_000,
      is_opening_inventory: 0,
      is_purchases: 3_440_000,
      is_inventory_overage_excluded: 0,
      is_closing_inventory: 420_000,
      is_cogs: 3_020_000,
      is_gross_profit: 3_700_000,
      is_directors_remuneration: 210_000,
      is_outsourcing_expense: 120_000,
      is_packing_freight_expense: 380_000,
      is_office_supplies_expense: 36_000,
      is_depreciation_expense: 90_000,
      is_sga_total: 836_000,
      is_operating_income: 2_864_000,
      is_non_operating_income: 0,
      is_interest_expense: 27_000,
      is_amortisation: 30_000,
      is_non_operating_expense_total: 57_000,
      is_ordinary_income: 2_807_000,
      is_extraordinary_gains: 0,
      is_extraordinary_losses: 0,
      is_pretax_income: 2_807_000,
      is_income_tax_expense: 560_000,
      is_net_income: 2_247_000,
    });
  });

  it('資產負債表', () => {
    expectValues(st, {
      bs_cash: 2_137_000,
      bs_accounts_receivable: 1_700_000,
      bs_inventory: 420_000,
      bs_current_assets: 4_257_000,
      bs_machinery_net: 270_000,
      bs_ppe_gross: 360_000,
      bs_deferred_org_costs: 120_000,
      bs_total_assets: 4_647_000,
      bs_accounts_payable: 0,
      bs_short_term_borrowings: 0,
      bs_total_liabilities: 0,
      bs_share_capital: 2_400_000,
      bs_retained_earnings: 2_247_000,
      bs_total_equity: 4_647_000,
      bs_total_liabilities_equity: 4_647_000,
    });
  });

  it('間接法 H11 到 H41：H20 ＝ 2,807,000 ＋ 90,000 ＋ 27,000 ＋ 30,000 － 1,700,000 － 420,000', () => {
    expectValues(st, {
      cf_pretax_income: 2_807_000,
      cf_depreciation: 90_000,
      cf_interest_expense_addback: 27_000,
      cf_other_noncash_losses: 30_000,
      cf_receivables_increase: -1_700_000,
      cf_inventory_increase: -420_000,
      cf_receivables_decrease: 0,
      cf_payables_increase: 0,
      cf_other_liabilities_increase: 0,
      cf_other_operating_assets_increase: 0,
      cf_noncash_gains: 0,
      cf_operating_subtotal: 834_000,
      cf_interest_paid: -27_000,
      cf_income_tax_paid: -560_000,
      cf_operating_total: 247_000,
      cf_capex: -510_000,
      cf_investing_total: -510_000,
      cf_st_borrowing_proceeds: 900_000,
      cf_st_borrowing_repayment: -900_000,
      cf_share_issue: 2_400_000,
      cf_dividends_paid: 0,
      cf_financing_total: 2_400_000,
      cf_net_change: 2_137_000,
      cf_cash_begin: 0,
      cf_cash_end: 2_137_000,
    });
  });

  it('直接法：5,020,000 － 3,440,000 － 746,000 ＝ 834,000，營業合計等於 H23，投資與籌資連到間接法', () => {
    expectValues(st, {
      dc_receipts_from_customers: 5_020_000,
      dc_payments_to_suppliers: -3_440_000,
      dc_payments_for_operating_expenses: -746_000,
      dc_other_operating_receipts: 0,
      dc_cash_generated_from_operations: 834_000,
      dc_interest_paid: -27_000,
      dc_income_tax_paid: -560_000,
      dc_operating_total: 247_000,
      dc_investing_total: -510_000,
      dc_financing_total: 2_400_000,
      dc_net_change: 2_137_000,
      dc_cash_begin: 0,
      dc_cash_end: 2_137_000,
    });
  });

  it('不變式全部成立，且包含 04 第 11.4、18.1 節列出的每一條', () => {
    const results = checkStatementInvariants(st);
    expectInvariants(st);
    expect(statementInvariantsHold(st)).toBe(true);
    const rules = results.map((r) => `${r.rule}:${r.line}->${r.against}`);
    expect(rules).toEqual(
      expect.arrayContaining([
        'equals_line:dc_operating_total->cf_operating_total',
        'equals_line:dc_cash_generated_from_operations->cf_operating_subtotal',
        'equals_line:cf_operating_subtotal->dc_cash_generated_from_operations',
        'equals_cash_change:cf_net_change->cash',
        'equals_line:dc_net_change->cf_net_change',
        'balance_end_equals_account:cf_cash_end->cash',
        'equals_line:bs_total_liabilities_equity->bs_total_assets',
        'closing_inventory_equals_balance:is_closing_inventory->inventory',
        'inventory_line_equals_balance:bs_inventory->inventory',
        'equals_account_activity:is_cogs->cost_of_goods_sold',
        'purchases_equal_tag_total:is_purchases->purchase',
        'retained_earnings_w05:bs_retained_earnings->retained_earnings',
      ]),
    );
    expect(results.every((r) => r.diff === r.left - r.right)).toBe(true);
  });

  it('Statements 的形狀：layoutId、policyId、window、四張表的列、notes、source；measureMap 含 hidden 列', () => {
    expect(st.layoutId).toBe('teacher@1');
    expect(st.policyId).toBe('teacher@1');
    expect(st.window).toEqual({ kind: 'cumulative', to: null });
    expect(st.source.run).toBe(run);
    expect(st.statements.income_statement.map((r) => r.id)).toEqual(teacherLayout.statements.income_statement.map((l) => l.id));
    expect(st.lines.size).toBe(Object.values(teacherLayout.statements).reduce((n, lines) => n + lines.length, 0));
    expect(st.notes).toEqual([]);
    const row = st.statements.balance_sheet.find((r) => r.id === 'bs_machinery_net');
    expect(row).toMatchObject({
      statement: 'balance_sheet',
      cell: 'L19',
      kind: 'accounts',
      value: 270_000,
      visible: true,
      level: null,
      extension: false,
      note: null,
    });
    const level = st.statements.income_statement.find((r) => r.id === 'is_gross_profit');
    expect(level).toMatchObject({ level: 1, termRef: expect.any(String), pendingRefs: [], flags: [] });
    const h11 = st.statements.cash_flow_indirect.find((r) => r.id === 'cf_pretax_income');
    expect(h11).toMatchObject({ check: 'step2', cell: 'H11' });
    const map = measureMap(st);
    expect(map['bs_ppe_gross']).toBe(360_000);
    expect(Object.keys(map).length).toBe(st.lines.size);
    expect(lineValue(st, 'bs_ppe_gross')).toMatchObject({ visible: false, kind: 'accounts', cell: null });
    expect(() => lineValue(st, 'nope')).toThrow(RangeError);
  });

  it('顯示規則：hidden 列、when_nonzero 的延伸列與 0 值的 group 不顯示；cumulative(to) 等於 cumulative(null) 到最後一步', () => {
    expect(lineValue(st, 'cf_loans_collected').visible).toBe(false);
    expect(lineValue(st, 'is_organisation_costs_expense').visible).toBe(false);
    expect(lineValue(st, 'is_inventory_overage_excluded').visible).toBe(false);
    expect(lineValue(st, 'bs_current_assets_group').visible).toBe(true);
    expect(lineValue(st, 'is_ordinary_income').visible).toBe(true);
    expect(lineValue(st, 'is_extraordinary_gains').visible).toBe(true);
    expect(measureMap(build(run, cumulative(S.incomeTax)))).toEqual(measureMap(st));
    expect(() => build(run, cumulative('st_nope00'))).toThrow(RangeError);
    expect(() => build(run, transaction('st_nope00'))).toThrow(RangeError);
  });

  it('同一輸入跑兩次結果相同', () => {
    const again = build(run, cumulative(null));
    expect(measureMap(again)).toEqual(measureMap(st));
    expect([...again.lines.values()]).toEqual([...st.lines.values()]);
    expect(again.statements).toEqual(st.statements);
  });
});

describe('第 7 步之後的累計（04 第 13 節的範例數字）', () => {
  const st = build(run, cumulative(S.sellCash));
  it('營業毛利 480,000、營業利益 324,000、現金 2,214,000、L29 ＝ N29 ＝ 2,724,000', () => {
    expectValues(st, {
      is_gross_profit: 480_000,
      is_operating_income: 324_000,
      is_pretax_income: 324_000,
      bs_cash: 2_214_000,
      cf_cash_end: 2_214_000,
      bs_total_assets: 2_724_000,
      bs_total_liabilities_equity: 2_724_000,
      cf_inventory_increase: 0,
      is_closing_inventory: 0,
    });
    expectInvariants(st);
  });
});

describe('本筆變動（04 第 11.5 節）', () => {
  it('第 7 步賣出存貨：H16 本筆變動為正 640,000 並加註「模板無此列」', () => {
    const st = build(run, transaction(S.sellCash));
    expect(st.window).toEqual({ kind: 'transaction', step: S.sellCash });
    expect(lineValue(st, 'cf_inventory_increase')).toMatchObject({
      value: 640_000,
      note: { key: 'template_has_no_decrease_row', params: { line: 'cf_inventory_increase' } },
    });
    expect(st.notes).toEqual([{ line: 'cf_inventory_increase', note: { key: 'template_has_no_decrease_row', params: { line: 'cf_inventory_increase' } } }]);
    expect(st.statements.cash_flow_indirect.find((r) => r.id === 'cf_inventory_increase')?.note).toEqual({
      key: 'template_has_no_decrease_row',
      params: { line: 'cf_inventory_increase' },
    });
    expectValues(st, {
      is_revenue: 1_120_000,
      is_cogs: 640_000,
      is_closing_inventory: -640_000,
      cf_pretax_income: 480_000,
      cf_net_change: 1_120_000,
      dc_receipts_from_customers: 1_120_000,
    });
    expectInvariants(st);
  });

  it('第 12 步收回帳款：H15 的本筆變動為正、H17 維持 0，不改成「應收帳款減少」', () => {
    const st = build(run, transaction(S.collect));
    expectValues(st, {
      cf_receivables_increase: 3_900_000,
      cf_receivables_decrease: 0,
      bs_accounts_receivable: -3_900_000,
      bs_cash: 3_900_000,
      cf_net_change: 3_900_000,
    });
    expect(lineValue(st, 'cf_receivables_increase').note).toBeUndefined();
    expectInvariants(st);
  });

  it('第 17 步折舊與攤銷：H11 減 120,000、H12 加 90,000、H14 加 30,000，現金不變', () => {
    const st = build(run, transaction(S.yearEnd));
    expect(st.notes).toEqual([]);
    expectValues(st, {
      cf_pretax_income: -120_000,
      cf_depreciation: 90_000,
      cf_other_noncash_losses: 30_000,
      cf_operating_subtotal: 0,
      cf_net_change: 0,
      bs_machinery_net: -90_000,
    });
    expectInvariants(st);
  });

  it('第 1 步的前一步是帳本起點；每一步本筆變動逐列加總等於累計報表', () => {
    const first = build(run, transaction(S.issueShares));
    expectValues(first, { bs_cash: 2_400_000, cf_share_issue: 2_400_000, cf_cash_begin: 0, cf_cash_end: 2_400_000 });
    const total = new Map<string, number>();
    for (const step of run.steps) {
      const st = build(run, transaction(step.stepId));
      expectInvariants(st);
      for (const [id, v] of st.lines) total.set(id, (total.get(id) ?? 0) + v.value);
    }
    expect(Object.fromEntries(total)).toEqual(measureMap(build(run, cumulative(null))));
  });
});

describe('政策與版面選項', () => {
  const altPolicy: PolicyDefinition = {
    ...ctx.policy,
    id: 'teacher-overage-noi@1',
    switches: { ...ctx.policy.switches, inventoryOverage: 'non_operating_income' },
  };
  const altCtx = createCoreContext({ policy: altPolicy });
  const altRun = unwrap(replayStory(limeLeafStory, [], altCtx));

  it('盤盈改列營業外收入：版面多一列存貨盤盈 420,000，營業成本 3,440,000、毛利少 420,000、稅前淨利不變（04 第 5.4 節末）', () => {
    const st = build(altRun, cumulative(null), altCtx.layout, altPolicy);
    expect(st.policyId).toBe('teacher-overage-noi@1');
    expect(lineValue(st, 'is_inventory_overage_excluded')).toMatchObject({ value: 420_000, visible: true });
    expectValues(st, {
      is_purchases: 3_440_000,
      is_closing_inventory: 420_000,
      is_cogs: 3_440_000,
      is_gross_profit: 3_280_000,
      is_non_operating_income: 420_000,
      is_pretax_income: 2_807_000,
      is_net_income: 2_247_000,
    });
    expectInvariants(st);
    // 同一本帳換成預設政策看：盤盈列仍是 0 且不顯示（政策列只依 policy 的開關）
    const wrong = build(altRun, cumulative(null), altCtx.layout, ctx.policy);
    expect(lineValue(wrong, 'is_inventory_overage_excluded')).toMatchObject({ value: 0, visible: false });
    expect(statementInvariantsHold(wrong)).toBe(false);
  });

  it('延伸列：when_nonzero 只在非 0 顯示（ifrs@1 政策下設立費改列費用）、always 一律顯示、never 一律不顯示', () => {
    const ifrsCtx = createCoreContext({ policy: 'ifrs@1' });
    const ifrsRun = unwrap(replayStory(limeLeafStory, [], ifrsCtx));
    const st = build(ifrsRun, cumulative(null), ifrsCtx.layout, ifrsCtx.policy);
    expect(lineValue(st, 'is_organisation_costs_expense')).toMatchObject({ value: 150_000, visible: true });
    expect(lineValue(st, 'cf_loans_collected').visible).toBe(false);
    expect(lineValue(st, 'is_amortisation').value).toBe(0);
    expectInvariants(st);
    const always: Layout = { ...teacherLayout, options: { ...teacherLayout.options, showExtensionRows: 'always' } };
    expect(lineValue(build(run, cumulative(null), always), 'cf_loans_collected').visible).toBe(true);
    const never: Layout = { ...teacherLayout, options: { ...teacherLayout.options, showExtensionRows: 'never' } };
    const stNever = build(ifrsRun, cumulative(null), never, ifrsCtx.policy);
    expect(lineValue(stNever, 'is_organisation_costs_expense')).toMatchObject({ value: 150_000, visible: false });
  });

  it('showOrdinaryIncome 與 showExtraordinaryRows 關掉時對應列不顯示，值照算', () => {
    const layout: Layout = { ...teacherLayout, options: { ...teacherLayout.options, showOrdinaryIncome: false, showExtraordinaryRows: false } };
    const st = build(run, cumulative(null), layout);
    expect(lineValue(st, 'is_ordinary_income')).toMatchObject({ value: 2_807_000, visible: false });
    expect(lineValue(st, 'is_extraordinary_gains').visible).toBe(false);
    expect(lineValue(st, 'is_extraordinary_losses').visible).toBe(false);
    expect(lineValue(st, 'is_pretax_income').visible).toBe(true);
  });
});

describe('自訂期初與沒有步驟的帳本', () => {
  const { chart } = ctx;

  it('沒有步驟：全部為 0 或期初；期初現金與存貨進 H40、R12、L12、L14，不變式成立', () => {
    const empty: PostedRun = { steps: [], finalState: createLedger(chart) };
    const st0 = build(empty, cumulative(null));
    expect([...st0.lines.values()].every((v) => v.value === 0)).toBe(true);
    expectInvariants(st0);
    const opened: PostedRun = { steps: [], finalState: createLedger(chart, { cash: 500_000, inventory: 80_000, share_capital: -580_000 }) };
    const st = build(opened, cumulative(null));
    expectValues(st, {
      bs_cash: 500_000,
      cf_cash_begin: 500_000,
      cf_cash_end: 500_000,
      cf_net_change: 0,
      is_opening_inventory: 80_000,
      is_closing_inventory: 80_000,
      bs_inventory: 80_000,
      is_cogs: 0,
      cf_inventory_increase: 0,
      bs_total_assets: 580_000,
      bs_total_liabilities_equity: 580_000,
    });
    expectInvariants(st);
  });

  it('自訂期初的故事：應付帳款減少以負數填 H18 並加註；股利使 N26 ＝ 期初 ＋ 淨利 － 股利', () => {
    const story: Story = {
      ...limeLeafStory,
      id: 'story_0p3n1n',
      opening: { cash: 1_000_000, accounts_payable: -300_000, retained_earnings: -200_000, share_capital: -500_000 },
      steps: [
        { ...(limeLeafStory.steps[10] as Story['steps'][number]), id: 'st_0pay00', order: 1 },
        {
          id: 'st_0div00',
          order: 2,
          title: { 'zh-TW': '發股利', en: 'Dividend' },
          narrative: { 'zh-TW': '發放現金股利。', en: 'A cash dividend is paid.' },
          events: [{ id: 'e1', template: 'tpl.pay_dividends_cash', params: { amount: 50_000 } }],
          termRefs: [],
        },
      ],
    };
    const r = unwrap(replayStory(story, [], ctx));
    const st = build(r, cumulative(null));
    expect(lineValue(st, 'cf_payables_increase')).toMatchObject({ value: -300_000, note: { key: 'template_has_no_decrease_row' } });
    expectValues(st, {
      bs_cash: 650_000,
      cf_cash_begin: 1_000_000,
      cf_cash_end: 650_000,
      cf_dividends_paid: -50_000,
      bs_retained_earnings: 150_000,
      bs_accounts_payable: 0,
      bs_total_assets: 650_000,
      bs_total_liabilities_equity: 650_000,
    });
    expectInvariants(st);
    const tx = build(r, transaction('st_0div00'));
    expectValues(tx, { bs_retained_earnings: -50_000, cf_dividends_paid: -50_000, cf_payables_increase: 0 });
    expectInvariants(tx);
    // 本筆變動視窗中 H18 的減少也加註
    expect(lineValue(build(r, transaction('st_0pay00')), 'cf_payables_increase')).toMatchObject({
      value: -300_000,
      note: { key: 'template_has_no_decrease_row' },
    });
  });
});

describe('版面編譯', () => {
  const text = { 'zh-TW': 'x', en: 'x' };
  const aliases = { 'zh-TW': [], en: [] };
  const base = { cell: null, label: text, aliases };
  const tiny = (lines: readonly LayoutLine[], cf: readonly LayoutLine[] = []): Layout => ({
    id: 'tiny@1',
    options: teacherLayout.options,
    statements: { income_statement: lines, balance_sheet: [], cash_flow_indirect: cf, cash_flow_direct: [] },
  });

  it('前向引用與拓撲順序：formula 可以引用後面才定義的列；lineDependencies 回傳引用', () => {
    const layout = tiny([
      { ...base, id: 'is_a', kind: 'formula', expr: 'line.is_b * 2' },
      { ...base, id: 'is_b', kind: 'accounts', accounts: ['cash'], measure: 'balance' },
      { ...base, id: 'is_g', kind: 'group', children: ['is_a', 'is_b'] },
    ]);
    const compiled = unwrap(compileLayout(layout));
    expect(compiled.order.indexOf('is_b')).toBeLessThan(compiled.order.indexOf('is_a'));
    expect(compileLayout(layout)).toBe(compileLayout(layout));
    expect(lineDependencies(layout, 'is_a')).toEqual({ valueRefs: ['is_b'], childRefs: [] });
    expect(lineDependencies(layout, 'is_g')).toEqual({ valueRefs: [], childRefs: ['is_a', 'is_b'] });
    expect(lineDependencies(teacherLayout, 'bs_retained_earnings').valueRefs).toEqual(['is_net_income']);
    expect(lineDependencies(teacherLayout, 'cf_cash_end').valueRefs).toEqual(['cf_net_change', 'cf_cash_begin']);
    expect(() => lineDependencies(layout, 'is_zz')).toThrow(RangeError);
    const st = build(run, cumulative(null), layout);
    expectValues(st, { is_a: 4_274_000, is_b: 2_137_000 });
  });

  it('引用不存在的線回 expr.unknown_ref；重複 ID 回 template.duplicate_id；運算式錯誤附上線 ID；循環引用是資料錯誤', () => {
    expect(compileLayout(tiny([{ ...base, id: 'is_a', kind: 'link', from: 'is_zz' }]))).toMatchObject({
      ok: false,
      error: { code: 'expr.unknown_ref', line: 'is_a', ref: 'is_zz' },
    });
    expect(compileLayout(tiny([{ ...base, id: 'is_a', kind: 'total', sum: ['is_zz'] }]))).toMatchObject({ ok: false, error: { code: 'expr.unknown_ref' } });
    expect(compileLayout(tiny([{ ...base, id: 'is_a', kind: 'group', children: ['is_zz'] }]))).toMatchObject({
      ok: false,
      error: { code: 'expr.unknown_ref' },
    });
    expect(compileLayout(tiny([{ ...base, id: 'is_a', kind: 'formula', expr: 'line.is_zz' }]))).toMatchObject({
      ok: false,
      error: { code: 'expr.unknown_ref', line: 'is_a' },
    });
    expect(compileLayout(tiny([{ ...base, id: 'is_a', kind: 'formula', expr: 'line.is_a / 2' }]))).toMatchObject({ ok: false, error: { line: 'is_a' } });
    const dup = tiny([
      { ...base, id: 'is_a', kind: 'accounts', accounts: ['cash'], measure: 'balance' },
      { ...base, id: 'is_a', kind: 'accounts', accounts: ['cash'], measure: 'balance' },
    ]);
    expect(compileLayout(dup)).toMatchObject({ ok: false, error: { code: 'template.duplicate_id' } });
    const cyclic = tiny([
      { ...base, id: 'is_a', kind: 'formula', expr: 'line.is_b + 1' },
      { ...base, id: 'is_b', kind: 'link', from: 'is_a' },
    ]);
    expect(() => compileLayout(cyclic)).toThrow(/循環引用/);
    expect(() => build(run, cumulative(null), tiny([{ ...base, id: 'is_a', kind: 'link', from: 'is_zz' }]))).toThrow(/編譯失敗/);
    expect(() => lineDependencies(tiny([{ ...base, id: 'is_a', kind: 'link', from: 'is_zz' }]), 'is_a')).toThrow(/編譯失敗/);
  });

  it('group 的 children 全是 0 的延伸列時不顯示；沒有 children 的 group 一律顯示；引用不存在的科目是程式錯誤', () => {
    const layout = tiny([
      { ...base, id: 'is_g', kind: 'group', children: ['is_x'] },
      { ...base, id: 'is_x', kind: 'accounts', accounts: ['marketing_expense'], measure: 'activity', extension: true },
      { ...base, id: 'is_h', kind: 'group' },
    ]);
    const st = build(run, cumulative(null), layout);
    expect(lineValue(st, 'is_g').visible).toBe(false);
    expect(lineValue(st, 'is_h').visible).toBe(true);
    expect(() => build(run, cumulative(null), tiny([{ ...base, id: 'is_x', kind: 'accounts', accounts: ['nope'], measure: 'balance' }]))).toThrow(TypeError);
  });

  it('不認得的 invariant 字串或引用不存在科目的 invariant 是程式錯誤', () => {
    const bad = tiny([{ ...base, id: 'is_a', kind: 'formula', expr: '1', invariant: 'whatever' }]);
    expect(() => checkStatementInvariants(build(run, cumulative(null), bad))).toThrow(/不認得/);
    const badAcc = tiny([{ ...base, id: 'is_a', kind: 'formula', expr: '1', invariant: 'equals_account_activity:nope' }]);
    expect(() => checkStatementInvariants(build(run, cumulative(null), badAcc))).toThrow(/不存在的科目/);
  });
});

describe('學生輸入的重算（recomputeWithInputs）', () => {
  it('取代某列後引用它的列跟著重算，其餘列維持原值；只支援累計視窗；未知的線是程式錯誤', () => {
    const st = build(run, cumulative(S.sellCash));
    const re = recomputeWithInputs(st, new Map([['bs_retained_earnings', 480_000]]));
    expectValues(re, {
      bs_retained_earnings: 480_000,
      bs_total_equity: 2_880_000,
      bs_total_liabilities_equity: 2_880_000,
      bs_total_assets: 2_724_000,
      is_net_income: 324_000,
    });
    expect(re.window).toEqual(st.window);
    const ni = recomputeWithInputs(st, new Map([['is_net_income', 1_000_000]]));
    expectValues(ni, { bs_retained_earnings: 1_000_000, is_pretax_income: 324_000 });
    expect(() => recomputeWithInputs(st, new Map([['nope', 1]]))).toThrow(RangeError);
    expect(() => recomputeWithInputs(build(run, transaction(S.sellCash)), new Map())).toThrow(RangeError);
  });
});

describe('追蹤介面（lineAccountTraces）', () => {
  const st = build(run, cumulative(null));
  const sumOf = (id: string, s: Statements = st): number => {
    const t = lineAccountTraces(s, id);
    return t.accounts.reduce((a, x) => a + x.amount, 0) + t.cashSources.reduce((a, x) => a + x.signed, 0);
  };

  it('葉列的科目層與現金行帶號加總等於列值（累計與本筆變動）；每個來源指得到分錄行', () => {
    const windows: StatementWindow[] = [cumulative(null), cumulative(S.sellCash), transaction(S.sellCash), transaction(S.collect), transaction(S.count)];
    for (const w of windows) {
      const s = build(run, w);
      for (const [id, v] of s.lines) {
        const t = lineAccountTraces(s, id);
        expect(t.value).toBe(v.value);
        const leaf = t.accounts.length > 0 || t.cashSources.length > 0 || t.kind === 'cash_tag';
        if (leaf && !t.gated && t.kind !== 'retained_earnings') expect(sumOf(id, s), `${JSON.stringify(w)} ${id}`).toBe(v.value);
        for (const a of t.accounts) {
          expect(a.opening + a.sources.reduce((acc, x) => acc + x.signed, 0)).toBe(a.amount);
          for (const src of a.sources) {
            const step = run.steps.find((x) => x.stepId === src.stepId);
            const line = step?.entries.find((e) => e.eventId === src.eventId)?.lines.find((l) => l.ref === src.lineRef);
            expect(line).toMatchObject({ account: src.account, side: src.side, amount: src.amount });
          }
        }
      }
    }
  });

  it('各種列的追蹤形狀', () => {
    expect(lineAccountTraces(st, 'bs_machinery_net').accounts.map((a) => [a.account, a.sign, a.measure, a.amount])).toEqual([
      ['machinery_equipment', 1, 'balance', 360_000],
      ['accumulated_depreciation_machinery', -1, 'balance', -90_000],
    ]);
    expect(lineAccountTraces(st, 'is_purchases')).toMatchObject({
      inventoryTags: ['purchase'],
      accounts: [{ account: 'inventory', measure: 'tagged', amount: 3_440_000 }],
    });
    expect(lineAccountTraces(st, 'is_purchases').accounts[0]?.sources.length).toBe(2);
    expect(lineAccountTraces(st, 'is_inventory_overage_excluded')).toMatchObject({ gated: true, accounts: [{ amount: 420_000 }] });
    expect(lineAccountTraces(st, 'is_opening_inventory')).toMatchObject({ accounts: [{ measure: 'balance_start', amount: 0, sources: [] }] });
    expect(lineAccountTraces(st, 'cf_receivables_decrease')).toMatchObject({
      gated: true,
      accounts: [{ account: 'accounts_receivable', sign: -1, measure: 'delta', amount: -1_700_000 }],
    });
    expect(lineAccountTraces(st, 'cf_receivables_increase')).toMatchObject({ gated: false });
    expect(lineAccountTraces(st, 'cf_depreciation')).toMatchObject({
      accounts: [{ account: 'depreciation_expense', sign: 1, measure: 'activity', amount: 90_000 }],
    });
    const cash = lineAccountTraces(st, 'cf_capex');
    expect(cash).toMatchObject({ cashKinds: ['capex'], accounts: [], value: -510_000 });
    expect(cash.cashSources.map((s) => s.signed)).toEqual([-360_000, -150_000]);
    expect(lineAccountTraces(st, 'bs_retained_earnings')).toMatchObject({
      refs: ['is_net_income'],
      accounts: [{ account: 'retained_earnings', measure: 'balance', amount: 0 }],
    });
    expect(lineAccountTraces(st, 'cf_cash_begin')).toMatchObject({ accounts: [{ account: 'cash', measure: 'balance_start', amount: 0 }] });
    expect(lineAccountTraces(st, 'is_gross_profit')).toMatchObject({ refs: ['is_cogs', 'is_revenue'], accounts: [], cashSources: [] });
    expect(lineAccountTraces(st, 'is_cogs_group')).toMatchObject({ refs: [], accounts: [] });
    expect(() => lineAccountTraces(st, 'nope')).toThrow(RangeError);
  });

  it('自訂期初與沒有步驟時 opening 進科目層；excludeAccounts 不列入', () => {
    const opened: PostedRun = { steps: [], finalState: createLedger(ctx.chart, { cash: 500_000, share_capital: -500_000 }) };
    const s = build(opened, cumulative(null));
    expect(lineAccountTraces(s, 'bs_cash')).toMatchObject({ accounts: [{ opening: 500_000, amount: 500_000, sources: [] }] });
    expect(lineAccountTraces(s, 'cf_cash_begin')).toMatchObject({ accounts: [{ opening: 500_000, amount: 500_000 }] });
    expect(lineAccountTraces(st, 'cf_other_liabilities_increase').accounts.map((a) => a.account)).toEqual([
      'deposits_received',
      'other_payables',
      'contract_liabilities',
    ]);
  });
});
