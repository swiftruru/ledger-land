// 04 第 12 節的單元測試：登錄檔編譯（43 個指標的全部版本）、表 A 的 23 項 excel 版公式、狀態判定順序與邊界、連鎖、輸入值、顯示精度。全部用自編數字。
import { describe, expect, it } from 'vitest';
import {
  type MeasureMap,
  type Money,
  RATIO_VERSION_IDS,
  type Rat,
  type RatioDefinition,
  type RatioResult,
  type RatioVersion,
  compileRatioRegistry,
  computeAllRatios,
  computeRatio,
  defaultRatioRegistry,
  defaultRatios,
  getRatioVersion,
  layoutLineIds,
  parseRatioRef,
  ratFromNumber,
  ratioRefString,
  teacherLayout,
  unwrap,
} from '../src/index.ts';

const lineIds = layoutLineIds(teacherLayout);
const registry = defaultRatioRegistry();

/** 版面每條線先給 0，再覆蓋自編數字 */
function measures(overrides: Readonly<Record<string, Money | Rat>> = {}): MeasureMap {
  return { ...Object.fromEntries([...lineIds].map((id) => [id, 0])), ...overrides };
}

/** 自編的一期數字（不是教材的金額）：淨利 2,247,000、資產總計 4,647,000 */
const BASE: Readonly<Record<string, Money>> = {
  is_revenue: 6_000_000,
  is_cogs: 2_400_000,
  is_gross_profit: 3_600_000,
  is_sga_total: 700_000,
  is_operating_income: 2_900_000,
  is_interest_expense: 40_000,
  is_pretax_income: 2_808_750,
  is_income_tax_expense: 561_750,
  is_net_income: 2_247_000,
  is_purchases: 3_000_000,
  bs_cash: 2_000_000,
  bs_accounts_receivable: 600_000,
  bs_inventory: 400_000,
  bs_short_term_loans_receivable: 100_000,
  bs_current_assets: 3_100_000,
  bs_machinery_net: 1_200_000,
  bs_office_equipment: 100_000,
  bs_total_assets: 4_647_000,
  bs_accounts_payable: 300_000,
  bs_current_liabilities: 900_000,
  bs_noncurrent_liabilities: 500_000,
  bs_total_liabilities: 1_400_000,
  bs_share_capital: 3_000_000,
  bs_total_equity: 3_247_000,
  cf_operating_total: 1_800_000,
  cf_capex: -250_000,
  cf_inventory_increase: -400_000,
  cf_dividends_paid: -100_000,
};
const base = measures(BASE);

const display = (ratioRef: string, m: MeasureMap = base, inputs = {}): number | null => computeRatio(ratioRef, m, inputs, registry).displayValue;

function version(partial: Partial<RatioVersion>): RatioVersion {
  return { unit: 'multiple', displayDecimals: 2, naWhen: [], notMeaningfulWhen: [], flags: [], ...partial };
}
function definition(id: string, versions: RatioDefinition['versions']): RatioDefinition {
  return { id, termRef: 'tm_test0abc', category: 'department', framework: null, versions, pendingRefs: [] };
}

describe('登錄檔（04 第 12.1 節）', () => {
  it('43 個指標的全部版本都能編譯，引用的線都在版面裡，連鎖來源都存在', () => {
    const expectedCount = defaultRatios.reduce((n, d) => n + RATIO_VERSION_IDS.filter((v) => d.versions[v] !== undefined).length, 0);
    expect(defaultRatios).toHaveLength(43);
    expect(registry.versions.size).toBe(expectedCount);
    expect(registry.byId.size).toBe(43);
    for (const cv of registry.versions.values()) {
      for (const id of cv.lineRefs) expect(lineIds.has(id), `${cv.ratioRef} 引用了版面沒有的線 ${id}`).toBe(true);
      for (const ref of cv.ratioRefs) expect(registry.versions.has(ref), `${cv.ratioRef} 的連鎖來源 ${ref} 不存在`).toBe(true);
      for (const name of cv.inputRefs) expect(cv.inputDefaults.has(name), `${cv.ratioRef} 的輸入 ${name} 沒有宣告`).toBe(true);
      expect(cv.definition.id).toBe(cv.id);
      expect(cv.ratioRef).toBe(ratioRefString(cv.id, cv.version));
    }
    expect([...registry.versions.values()].filter((cv) => cv.version === 'excel')).toHaveLength(23);
  });

  it('getRatioVersion、parseRatioRef 與 defaultRatioRegistry 的快取', () => {
    const cv = getRatioVersion(registry, 'days_sales_outstanding@excel');
    expect(cv?.formula.kind).toBe('expr');
    expect(cv?.ratioRefs).toEqual(['ar_turnover@excel']);
    expect(getRatioVersion(registry, 'roa@excel')?.formula.kind).toBe('fraction');
    expect(getRatioVersion(registry, 'roa@slides03')?.inputRefs).toEqual(['tax_rate']);
    expect(getRatioVersion(registry, 'dol@excel')?.base).toBeDefined();
    expect(getRatioVersion(registry, 'nope@excel')).toBeUndefined();
    expect(parseRatioRef('roa@excel')).toEqual({ id: 'roa', version: 'excel' });
    expect(parseRatioRef('roa@nope')).toBeUndefined();
    expect(parseRatioRef('roa.excel')).toBeUndefined();
    expect(defaultRatioRegistry()).toBe(registry);
  });

  it('版面的線 ID 集合含 hidden 列', () => {
    const hidden = [...teacherLayout.statements.income_statement, ...teacherLayout.statements.balance_sheet].filter((l) => l.hidden === true);
    expect(hidden.length).toBeGreaterThan(0);
    for (const l of hidden) expect(lineIds.has(l.id)).toBe(true);
  });

  it('公式錯誤以 Result 回報並附 ratioRef 與 part', () => {
    const bad = compileRatioRegistry([definition('x', { excel: version({ numerator: 'line.is_net_income', denominator: 'line.nope' }) })], lineIds);
    expect(bad).toMatchObject({ ok: false, error: { code: 'expr.unknown_ref', ratioRef: 'x@excel', part: 'denominator' } });
    const badNum = compileRatioRegistry([definition('x', { excel: version({ numerator: 'param.a', denominator: 'line.is_revenue' }) })], lineIds);
    expect(!badNum.ok && badNum.error.part).toBe('numerator');
    const badExpr = compileRatioRegistry([definition('x', { excel: version({ expr: 'ratio.y.excel * 2' }) })], lineIds);
    expect(!badExpr.ok && badExpr.error.part).toBe('expr');
    const badBase = compileRatioRegistry(
      [definition('x', { excel: version({ expr: 'line.is_revenue / 2', notMeaningfulWhen: ['base_not_positive'], notMeaningfulBase: 'line.nope' }) })],
      lineIds,
    );
    expect(!badBase.ok && badBase.error.part).toBe('notMeaningfulBase');
  });

  it('資料形狀不合與連鎖循環是程式錯誤', () => {
    expect(() =>
      compileRatioRegistry([definition('x', { excel: version({ numerator: 'line.is_revenue', denominator: 'line.is_cogs', expr: '1' }) })], lineIds),
    ).toThrow(/恰好/);
    expect(() => compileRatioRegistry([definition('x', { excel: version({}) })], lineIds)).toThrow(/恰好/);
    expect(() => compileRatioRegistry([definition('x', { excel: version({ numerator: 'line.is_revenue' }) })], lineIds)).toThrow(/同時存在/);
    expect(() =>
      compileRatioRegistry([definition('x', { excel: version({ expr: 'line.is_revenue', notMeaningfulWhen: ['base_not_positive'] }) })], lineIds),
    ).toThrow(/notMeaningfulBase/);
    expect(() =>
      compileRatioRegistry([definition('x', { excel: version({ expr: '1' }) }), definition('x', { excel: version({ expr: '2' }) })], lineIds),
    ).toThrow(/重複/);
    const cyclic = [
      definition('a', { slides02: version({ expr: 'ratio.b.slides02 * 2' }) }),
      definition('b', { slides02: version({ expr: 'ratio.c.slides02 + 1' }) }),
      definition('c', { slides02: version({ expr: 'ratio.a.slides02 - 1' }) }),
    ];
    expect(() => compileRatioRegistry(cyclic, lineIds)).toThrow(/a@slides02 -> b@slides02 -> c@slides02 -> a@slides02/);
    expect(() => compileRatioRegistry([definition('a', { excel: version({ expr: 'ratio.a.excel' }) })], lineIds)).toThrow(/循環/);
  });
});

describe('表 A：23 項 excel 版（04 第 12.2 節，自編數字）', () => {
  const cases: [string, number][] = [
    ['debt_ratio', 30.13],
    ['long_term_funds_to_ppe', 312.25],
    ['cash_flow_adequacy', 240],
    ['cash_flow_ratio', 200],
    ['cash_reinvestment', 45.37],
    ['ar_turnover', 10],
    ['days_sales_outstanding', 36.5],
    ['ap_turnover', 10],
    ['inventory_turnover', 6],
    ['days_inventory', 60.83],
    ['ppe_turnover', 5],
    ['total_asset_turnover', 1.29],
    ['dol', 1.24],
    ['dfl', 1.01],
    ['roa', 48.35],
    ['pretax_to_paid_in_capital', 93.63],
    ['operating_income_to_paid_in_capital', 96.67],
    ['roe', 69.2],
    ['eps', 7.49],
    ['net_profit_margin', 37.45],
    ['quick_ratio', 3],
    ['current_ratio', 3.44],
    ['interest_coverage', 71.22],
  ];
  it.each(cases)('%s@excel 顯示 %s', (id, expected) => {
    const r = computeRatio(`${id}@excel`, base, {}, registry);
    expect(r.status).toBe('ok');
    expect(r.displayValue).toBe(expected);
    expect(r.reason).toBeNull();
  });

  it('ROA 的精確值、浮點值與用到的輸入', () => {
    const r = computeRatio('roa@excel', base);
    expect(r.exact).toEqual({ num: '749', den: '1549' });
    expect(r.value).toBeCloseTo(2_247_000 / 4_647_000, 12);
    expect(r.displayValue).toBe(48.35);
    expect(r.inputs).toEqual({ 'line.is_net_income': 2_247_000, 'line.bs_total_assets': 4_647_000 });
    expect(r.flags).toEqual(['end_of_period_balance']);
  });

  it('存貨減少時允當比率的分母不把存貨當成負的增加額（表 B 的網站修正）', () => {
    const r = computeRatio('cash_flow_adequacy@excel', measures({ ...BASE, cf_inventory_increase: 150_000 }));
    // 1,800,000 ÷ (250,000 + 0 + 100,000)
    expect(r.exact).toEqual({ num: '36', den: '7' });
    expect(r.displayValue).toBe(514.29);
    expect(r.flags).toContain('single_period_approx');
  });

  it('EPS 的面額預設 10，可覆寫；面額為 0 時分母無法求值，判為 na', () => {
    expect(computeRatio('eps@excel', base).inputs['input.par_value']).toBe(10);
    expect(computeRatio('eps@excel', base, { par_value: 5 }).displayValue).toBe(3.75);
    const zero = computeRatio('eps@excel', base, { par_value: 0 });
    expect(zero.status).toBe('na');
    expect(zero.reason?.key).toBe('ratio.reason.denominator_zero');
  });
});

describe('狀態判定（04 第 12.6 節）', () => {
  it('分母恰為 0 是 na，原因附分母公式', () => {
    const r = computeRatio('debt_ratio@excel', measures({ ...BASE, bs_total_assets: 0 }));
    expect(r.status).toBe('na');
    expect(r.exact).toBeNull();
    expect(r.value).toBeNull();
    expect(r.displayValue).toBeNull();
    expect(r.reason).toEqual({ key: 'ratio.reason.denominator_zero', params: { denominator: 'line.bs_total_assets' } });
  });

  it('營業利益為負時 DOL 是 not_meaningful，excel 版仍有數值，slides03 版沒有', () => {
    const m = measures({ ...BASE, is_operating_income: -500_000 });
    const excel = computeRatio('dol@excel', m);
    expect(excel.status).toBe('not_meaningful');
    expect(excel.exact).toEqual({ num: '-36', den: '5' });
    expect(excel.value).toBe(-7.2);
    expect(excel.displayValue).toBe(-7.2);
    expect(excel.reason).toEqual({ key: 'ratio.reason.negative_base', params: { base: 'line.is_operating_income' } });
    const slides = computeRatio('dol@slides03', m);
    expect(slides.status).toBe('not_meaningful');
    expect(slides.exact).toBeNull();
    expect(slides.value).toBeNull();
    expect(slides.displayValue).toBeNull();
    expect(slides.reason?.key).toBe('ratio.reason.negative_base');
  });

  it('毛利為 0 且營業利益為負：同時符合 zero 與 not_meaningful，依順序判為 not_meaningful（excel 版顯示 0）', () => {
    const r = computeRatio('dol@excel', measures({ ...BASE, is_gross_profit: 0, is_operating_income: -500_000 }));
    expect(r.status).toBe('not_meaningful');
    expect(r.displayValue).toBe(0);
    expect(Object.is(r.displayValue, -0)).toBe(false);
  });

  it('營業利益為 0 時 DOL 先判為 na（分母 0 優先於基數不為正）', () => {
    const r = computeRatio('dol@excel', measures({ ...BASE, is_operating_income: 0 }));
    expect(r.status).toBe('na');
    expect(r.reason?.key).toBe('ratio.reason.denominator_zero');
  });

  it('DFL：分母為負是 not_meaningful；營業利益為正但利息更大時也是；兩者都為 0 是 na', () => {
    const negative = computeRatio('dfl@excel', measures({ ...BASE, is_operating_income: 30_000, is_interest_expense: 40_000 }));
    expect(negative.status).toBe('not_meaningful');
    expect(negative.reason).toEqual({ key: 'ratio.reason.negative_base', params: { base: 'line.is_operating_income - line.is_interest_expense' } });
    expect(negative.displayValue).toBe(-3);
    const na = computeRatio('dfl@slides03', measures({ ...BASE, is_operating_income: 0, is_interest_expense: 0 }));
    expect(na.status).toBe('na');
    const positiveDen = computeRatio('dfl@excel', measures({ ...BASE, is_operating_income: -10_000, is_interest_expense: -40_000 }));
    expect(positiveDen.status).toBe('not_meaningful');
    expect(positiveDen.reason?.params?.base).toBe('line.is_operating_income');
  });

  it('分子恰為 0 是 zero；顯示值為 0 而不是 -0', () => {
    const r = computeRatio('roa@excel', measures({ ...BASE, is_net_income: 0 }));
    expect(r.status).toBe('zero');
    expect(r.exact).toEqual({ num: '0', den: '1' });
    expect(r.value).toBe(0);
    expect(r.displayValue).toBe(0);
    expect(r.reason).toBeNull();
    const negZero = computeRatio('net_profit_margin@slides01', measures({ ...BASE, is_net_income: -0 }));
    expect(negZero.status).toBe('zero');
    expect(Object.is(negZero.value, -0)).toBe(false);
    expect(Object.is(negZero.displayValue, -0)).toBe(false);
    expect(negZero.inputs['line.is_net_income']).toBe(0);
  });

  it('有效稅率在稅前淨利為負時是 not_meaningful（非 excel 版，沒有數值）', () => {
    const r = computeRatio('effective_tax_rate@slides01', measures({ ...BASE, is_pretax_income: -100_000 }));
    expect(r.status).toBe('not_meaningful');
    expect(r.value).toBeNull();
  });

  it('極小的負值四捨五入後顯示 0，不是 -0', () => {
    const r = computeRatio('net_profit_margin@slides01', measures({ ...BASE, is_net_income: -1, is_revenue: 6_000_000 }));
    expect(r.status).toBe('ok');
    expect(Object.is(r.displayValue, -0)).toBe(false);
    expect(r.displayValue).toBe(0);
  });
});

describe('連鎖指標', () => {
  it('除法型：來源為 0 或 na 都是 na', () => {
    const zeroSource = computeRatio('days_sales_outstanding@excel', measures({ ...BASE, is_revenue: 0 }));
    expect(zeroSource.status).toBe('na');
    expect(zeroSource.reason).toEqual({ key: 'ratio.reason.chained_source_na_or_zero', params: { source: 'ar_turnover@excel' } });
    expect(zeroSource.inputs).toEqual({ 'ratio.ar_turnover.excel': 0 });
    const naSource = computeRatio('days_inventory@excel', measures({ ...BASE, bs_inventory: 0 }));
    expect(naSource.status).toBe('na');
    expect(naSource.reason?.key).toBe('ratio.reason.chained_source_na_or_zero');
    expect(naSource.inputs['ratio.inventory_turnover.excel']).toBeNull();
  });

  it('乘積型（roa@dupont）：來源為 zero 時乘積為 zero，來源為 na 時為 na，而 roa@slides02 仍算得出來', () => {
    const zero = computeRatio('roa@dupont', measures({ ...BASE, is_net_income: 0 }));
    expect(zero.status).toBe('zero');
    expect(zero.displayValue).toBe(0);
    const na = computeRatio('roa@dupont', measures({ ...BASE, is_revenue: 0 }));
    expect(na.status).toBe('na');
    expect(na.reason).toEqual({ key: 'ratio.reason.chained_source_na', params: { source: 'net_profit_margin@slides02' } });
    expect(computeRatio('roa@slides02', measures({ ...BASE, is_revenue: 0 })).status).toBe('ok');
    const ok = computeRatio('roa@dupont', base);
    expect(ok.status).toBe('ok');
    expect(ok.exact).toEqual(computeRatio('roa@slides02', base).exact);
    expect(ok.displayValue).toBe(48.35);
  });

  it('roe@dupont 三個因子相乘等於 roe@slides02', () => {
    expect(computeRatio('roe@dupont', base).exact).toEqual(computeRatio('roe@slides02', base).exact);
    expect(computeRatio('roe@dupont', base).inputs).toEqual({
      'ratio.net_profit_margin.slides02': 2_247_000 / 6_000_000,
      'ratio.total_asset_turnover.slides02': 6_000_000 / 4_647_000,
      'ratio.equity_multiplier.slides02': 4_647_000 / 3_247_000,
    });
  });

  it('加總型：營業週期與現金轉換循環；來源的單期近似旗標一併帶上', () => {
    const cycle = computeRatio('operating_cycle@slides03', base);
    expect(cycle.status).toBe('ok');
    expect(cycle.displayValue).toBe(97.33);
    expect(cycle.flags).toEqual(['single_period_approx']);
    const ccc = computeRatio('cash_conversion_cycle@slides03', base);
    // 365 ÷ (2,400,000 ÷ 300,000) = 45.625
    expect(ccc.displayValue).toBe(51.71);
    expect(ccc.flags).toEqual(['website_definition', 'single_period_approx']);
    const na = computeRatio('cash_conversion_cycle@slides03', measures({ ...BASE, bs_accounts_payable: 0 }));
    expect(na.status).toBe('na');
    expect(na.reason).toEqual({ key: 'ratio.reason.chained_source_na', params: { source: 'days_payable@slides03' } });
  });

  it('來源為 not_meaningful 時整體槓桿度也是 not_meaningful（非 excel 版沒有數值）', () => {
    const r = computeRatio('total_leverage@slides03', measures({ ...BASE, is_operating_income: -500_000 }));
    expect(r.status).toBe('not_meaningful');
    expect(r.exact).toBeNull();
    expect(r.reason).toEqual({ key: 'ratio.reason.chained_source_not_meaningful', params: { source: 'dol@slides03' } });
    expect(computeRatio('total_leverage@slides03', base).displayValue).toBe(1.26);
  });

  it('本益比：缺股價是 na、EPS 為 0 是 na、EPS 為負是 not_meaningful', () => {
    expect(computeRatio('pe_ratio@slides02', base).status).toBe('na');
    expect(computeRatio('pe_ratio@slides02', base).reason).toEqual({ key: 'ratio.reason.missing_input', params: { input: 'share_price' } });
    const ok = computeRatio('pe_ratio@slides02', base, { share_price: 149.8 });
    expect(ok.status).toBe('ok');
    expect(ok.displayValue).toBe(20);
    expect(ok.inputs['ratio.eps.excel']).toBe(7.49);
    const zero = computeRatio('pe_ratio@slides02', measures({ ...BASE, is_net_income: 0 }), { share_price: 100 });
    expect(zero.status).toBe('na');
    expect(zero.reason?.key).toBe('ratio.reason.chained_source_na_or_zero');
    const negative = computeRatio('pe_ratio@slides02', measures({ ...BASE, is_net_income: -300_000 }), { share_price: 100 });
    expect(negative.status).toBe('not_meaningful');
    expect(negative.reason?.key).toBe('ratio.reason.negative_base');
  });

  it('自訂登錄檔：excel 版的運算式型在基數不為正時仍保留數值；來源為 0 的除法在只有 chained_source_na 時判為 na', () => {
    const defs = [
      definition('src', { excel: version({ numerator: 'line.is_gross_profit', denominator: 'line.is_revenue' }) }),
      definition('twice', {
        excel: version({
          expr: 'ratio.src.excel * 2',
          naWhen: ['chained_source_na'],
          notMeaningfulWhen: ['base_not_positive'],
          notMeaningfulBase: 'line.is_operating_income',
        }),
      }),
      definition('inverse', { slides02: version({ expr: '1 / ratio.src.excel', naWhen: ['chained_source_na'] }) }),
    ];
    const custom = unwrap(compileRatioRegistry(defs, lineIds));
    const nm = computeRatio('twice@excel', measures({ ...BASE, is_operating_income: -1 }), {}, custom);
    expect(nm.status).toBe('not_meaningful');
    expect(nm.displayValue).toBe(1.2);
    expect(computeRatio('twice@excel', base, {}, custom).status).toBe('ok');
    expect(computeRatio('twice@excel', measures({ ...BASE, is_gross_profit: 0 }), {}, custom).status).toBe('zero');
    const divided = computeRatio('inverse@slides02', measures({ ...BASE, is_gross_profit: 0 }), {}, custom);
    expect(divided.status).toBe('na');
    expect(divided.reason).toEqual({ key: 'ratio.reason.denominator_zero', params: { denominator: '1 / ratio.src.excel' } });
  });
});

describe('輸入值與平均', () => {
  it('slides03 的 ROA：稅率缺少（null）是 na，預設 0.2 可用，也可覆寫', () => {
    const na = computeRatio('roa@slides03', base, { tax_rate: null });
    expect(na.status).toBe('na');
    expect(na.reason).toEqual({ key: 'ratio.reason.missing_input', params: { input: 'tax_rate' } });
    expect(na.inputs['input.tax_rate']).toBeNull();
    const byDefault = computeRatio('roa@slides03', base);
    // (2,247,000 + 40,000 × 0.8) ÷ 4,647,000
    expect(byDefault.status).toBe('ok');
    expect(byDefault.exact).toEqual({ num: '2279', den: '4647' });
    expect(byDefault.displayValue).toBe(49.04);
    expect(byDefault.inputs['input.tax_rate']).toBe(0.2);
    expect(computeRatio('roa@slides03', base, { tax_rate: 0.25 }).exact).toEqual({ num: '759', den: '1549' });
  });

  it('avg 在單期時以期末代替並加 single_period_approx；提供期初值時取平均且沒有旗標', () => {
    const single = computeRatio('ar_turnover@slides03', base);
    expect(single.displayValue).toBe(10);
    expect(single.flags).toEqual(['single_period_approx']);
    const averaged = computeRatio('ar_turnover@slides03', base, {}, registry, { opening: measures({ bs_accounts_receivable: 400_000 }) });
    expect(averaged.displayValue).toBe(12);
    expect(averaged.flags).toEqual([]);
    expect(computeRatio('ar_turnover@excel', base).flags).toEqual(['end_of_period_balance']);
  });

  it('輸入值的小數與指數寫法轉成精確值；非有限數是程式錯誤', () => {
    expect(ratFromNumber(0.2)).toEqual({ num: 1n, den: 5n });
    expect(ratFromNumber(-12.5)).toEqual({ num: -25n, den: 2n });
    expect(ratFromNumber(10)).toEqual({ num: 10n, den: 1n });
    expect(ratFromNumber(5e-7)).toEqual({ num: 1n, den: 2_000_000n });
    expect(ratFromNumber(1e21)).toEqual({ num: 10n ** 21n, den: 1n });
    expect(ratFromNumber(1.5e21)).toEqual({ num: 15n * 10n ** 20n, den: 1n });
    expect(() => ratFromNumber(Number.NaN)).toThrow(TypeError);
    expect(() => ratFromNumber(Number.POSITIVE_INFINITY)).toThrow(TypeError);
    const r = computeRatio('margin_maintenance@slides02', base, { collateral_value: 5e-7, loan_amount: 1e-7 });
    expect(r.exact).toEqual({ num: '5', den: '1' });
    expect(r.displayValue).toBe(500);
  });

  it('人均營收：員工數缺少是 na、為 0 是 na、整數單位顯示 0 位小數', () => {
    expect(computeRatio('revenue_per_employee@slides02', base).status).toBe('na');
    expect(computeRatio('revenue_per_employee@slides02', base, { employees: 0 }).status).toBe('na');
    const r = computeRatio('revenue_per_employee@slides02', base, { employees: 7 });
    expect(r.status).toBe('ok');
    expect(r.displayValue).toBe(857_143);
  });

  it('measures 可以是 Rat；不是 Money 或 Rat、或缺少公式需要的線，是程式錯誤', () => {
    const r = computeRatio('net_profit_margin@slides01', measures({ ...BASE, is_net_income: { num: 3_000_000n, den: 2n } }));
    expect(r.exact).toEqual({ num: '1', den: '4' });
    expect(() => computeRatio('roa@excel', measures({ ...BASE, is_net_income: 1.5 }))).toThrow(TypeError);
    expect(() => computeRatio('roa@excel', { ...base, bs_total_assets: 'x' as unknown as Money })).toThrow(TypeError);
    expect(() => computeRatio('roa@excel', { is_net_income: 1 })).toThrow(/bs_total_assets/);
    expect(() => computeRatio('nope@excel', base)).toThrow(/nope@excel/);
  });
});

describe('顯示精度（04 第 12.5 節）', () => {
  it('.5 邊界遠離 0：93.625 顯示 93.63，-93.625 顯示 -93.63', () => {
    expect(display('pretax_to_paid_in_capital@excel')).toBe(93.63);
    expect(display('pretax_to_paid_in_capital@excel', measures({ ...BASE, is_pretax_income: -2_808_750 }))).toBe(-93.63);
  });

  it('percent 以百分點顯示，value 仍是比率；其他單位不乘 100', () => {
    const roa = computeRatio('roa@excel', base);
    expect(roa.value).toBeCloseTo(0.4835, 4);
    expect(roa.displayValue).toBe(48.35);
    const turnover = computeRatio('ar_turnover@excel', base);
    expect(turnover.value).toBe(10);
    expect(turnover.displayValue).toBe(10);
    expect(computeRatio('days_inventory@excel', base).value).toBeCloseTo(60.8333, 4);
  });

  it('displayDecimals 依版本（人均營收 0 位、其餘 2 位）', () => {
    expect(getRatioVersion(registry, 'revenue_per_employee@slides02')?.spec.displayDecimals).toBe(0);
    expect(computeRatio('current_ratio@excel', measures({ ...BASE, bs_current_assets: 3_100_005 })).displayValue).toBe(3.44);
  });
});

describe('computeAllRatios', () => {
  it('不過濾時算出全部版本，依登錄檔順序；過濾 excel 得 23 項', () => {
    const all = computeAllRatios(base);
    expect(all.map((r) => r.ratioRef)).toEqual([...registry.versions.keys()]);
    const excel = computeAllRatios(base, {}, ['excel']);
    expect(excel).toHaveLength(23);
    expect(excel.every((r) => r.ratioRef.endsWith('@excel'))).toBe(true);
    expect(excel.every((r) => r.status === 'ok')).toBe(true);
    const byRef = new Map(all.map((r) => [r.ratioRef, r]));
    expect(byRef.get('roa@excel')).toEqual(computeRatio('roa@excel', base));
    expect(byRef.get('revenue_per_employee@slides02')?.status).toBe('na');
  });

  it('相同輸入得到相同輸出，而且輸入不被修改', () => {
    const frozen = Object.freeze(measures(BASE));
    const a: readonly RatioResult[] = computeAllRatios(frozen, Object.freeze({ share_price: 100 }), undefined, registry, {
      opening: Object.freeze(measures()),
    });
    const b = computeAllRatios(frozen, { share_price: 100 }, undefined, registry, { opening: measures() });
    expect(a).toEqual(b);
  });
});
