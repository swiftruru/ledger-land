// 黃金測試的計算表（04 第 10.3、17 節；M4b 回報第 9 節，2026-11-08 進 repo）：青檸文具社 18 步的期望值，不經過核心，只用加減法。
// 每一步的分錄行寫死在這裡（金額是自編數字，推導值用上一步的餘額算），逐步累計科目餘額與現金標籤，再依 04 第 11 節每一列的規則組成三表、
// 依第 12.2 節表 A 的 excel 版公式與第 12.6 節的狀態順序算指標、依第 13 節算五步驟。teacher@1 與 ifrs@1 只差第 5 步（設立費資本化或費用化）與
// 第 17 步的攤銷（ifrs@1 沒有分錄），以及版面少掉的列。
// 用法：node calc-lime-leaf.mjs --policy teacher@1 [--check]（印出 JSON；--check 和同目錄的黃金資料逐項比對，不同就以非 0 結束）。
// 這支腳本刻意不 import @ledgerland/core，也不讀版面與範本的資料檔；它是黃金資料的獨立依據，核心改了而結果不同時，先想清楚哪一邊對。
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const STORY_ID = 'story_q7m2v9';
export const STEP_IDS = [
  'st_a1b2c3',
  'st_d4e5f6',
  'st_g7h8j9',
  'st_k2m3n4',
  'st_p5q6r7',
  'st_p4n7e2',
  'st_h8q3z6',
  'st_s8t9v2',
  'st_j3v9k2',
  'st_c6w1q4',
  'st_w3x4y5',
  'st_m2x8r5',
  'st_z6a7b8',
  'st_c9d2e3',
  'st_w4r8n2',
  'st_f4g5h6',
  'st_y5c1h8',
  'st_j7k8m9',
];

/** 自編數字（04 第 17 節）；推導值在 entriesOf 裡用餘額算 */
export const AMOUNTS = {
  shares: 2_400_000,
  supplies: 36_000,
  equipment: 360_000,
  outsourcing: 120_000,
  orgCosts: 150_000,
  purchaseCash: 640_000,
  priceCash: 1_120_000,
  borrow: 900_000,
  purchaseCredit: 2_800_000,
  priceCredit: 5_600_000,
  collect: 3_900_000,
  directors: 210_000,
  packing: 380_000,
  interest: 27_000,
  counted: 420_000,
  usefulLifeYears: 4,
  amortiseYears: 5,
  incomeTax: 560_000,
};

/** 借方餘額為正的科目（資產、費用）；其餘（負債、權益、收入）貸方餘額為正 */
const DEBIT_NORMAL = new Set([
  'cash',
  'accounts_receivable',
  'inventory',
  'short_term_loans_receivable',
  'prepaid_expenses',
  'supplies_on_hand',
  'machinery_equipment',
  'office_equipment',
  'intangible_assets',
  'investments_other_assets',
  'deferred_organisation_costs',
  'deferred_development_costs',
  'cost_of_goods_sold',
  'directors_remuneration',
  'outsourcing_expense',
  'packing_freight_expense',
  'office_supplies_expense',
  'depreciation_expense',
  'organisation_costs_expense',
  'research_development_expense',
  'marketing_expense',
  'interest_expense',
  'amortisation_deferred_assets',
  'extraordinary_losses',
  'income_tax_expense',
]);
/** accumulated_depreciation_machinery 是資產的抵減科目：貸方餘額為正 */

/**
 * 每一步的分錄行：{ dr, cr, amount, cf?, purchase? }。cf 是現金那一行的現金流量標籤（kind），inflow 看 dr 是否為 cash。
 * bal 是這一步之前的餘額（依正常餘額方向為正）。
 */
function entriesOf(index, policy, bal) {
  const A = AMOUNTS;
  const ifrs = policy === 'ifrs@1';
  switch (index) {
    case 0:
      return [{ dr: 'cash', cr: 'share_capital', amount: A.shares, cf: 'share_issue' }];
    case 1:
      return [{ dr: 'office_supplies_expense', cr: 'cash', amount: A.supplies, cf: 'payments_for_operating_expenses' }];
    case 2:
      return [{ dr: 'machinery_equipment', cr: 'cash', amount: A.equipment, cf: 'capex' }];
    case 3:
      return [{ dr: 'outsourcing_expense', cr: 'cash', amount: A.outsourcing, cf: 'payments_for_operating_expenses' }];
    case 4:
      // 設立費：教材資本化（投資活動），IFRS 費用化（營業活動）
      return ifrs
        ? [{ dr: 'organisation_costs_expense', cr: 'cash', amount: A.orgCosts, cf: 'payments_for_operating_expenses' }]
        : [{ dr: 'deferred_organisation_costs', cr: 'cash', amount: A.orgCosts, cf: 'capex' }];
    case 5:
      return [{ dr: 'inventory', cr: 'cash', amount: A.purchaseCash, cf: 'payments_to_suppliers', purchase: true }];
    case 6: {
      const cost = bal.inventory;
      return [
        { dr: 'cash', cr: 'revenue', amount: A.priceCash, cf: 'receipts_from_customers' },
        { dr: 'cost_of_goods_sold', cr: 'inventory', amount: cost },
      ];
    }
    case 7:
      return [{ dr: 'cash', cr: 'short_term_borrowings', amount: A.borrow, cf: 'st_borrowing_proceeds' }];
    case 8:
      return [{ dr: 'inventory', cr: 'accounts_payable', amount: A.purchaseCredit, purchase: true }];
    case 9: {
      const cost = bal.inventory;
      return [
        { dr: 'accounts_receivable', cr: 'revenue', amount: A.priceCredit },
        { dr: 'cost_of_goods_sold', cr: 'inventory', amount: cost },
      ];
    }
    case 10:
      return [{ dr: 'accounts_payable', cr: 'cash', amount: bal.accounts_payable ?? 0, cf: 'payments_to_suppliers' }];
    case 11:
      return [{ dr: 'cash', cr: 'accounts_receivable', amount: A.collect, cf: 'receipts_from_customers' }];
    case 12:
      return [{ dr: 'directors_remuneration', cr: 'cash', amount: A.directors, cf: 'payments_for_operating_expenses' }];
    case 13:
      return [{ dr: 'packing_freight_expense', cr: 'cash', amount: A.packing, cf: 'payments_for_operating_expenses' }];
    case 14:
      return [
        { dr: 'short_term_borrowings', cr: 'cash', amount: bal.short_term_borrowings, cf: 'st_borrowing_repayment' },
        { dr: 'interest_expense', cr: 'cash', amount: A.interest, cf: 'interest_paid' },
      ];
    case 15: {
      // 盤點：帳上少於實際是盤盈（兩套政策都沖減銷貨成本）
      const overage = Math.max(A.counted - bal.inventory, 0);
      const shortage = Math.max(bal.inventory - A.counted, 0);
      return [
        ...(overage > 0 ? [{ dr: 'inventory', cr: 'cost_of_goods_sold', amount: overage, countOverage: true }] : []),
        ...(shortage > 0 ? [{ dr: 'cost_of_goods_sold', cr: 'inventory', amount: shortage }] : []),
      ];
    }
    case 16: {
      const net = (bal.machinery_equipment ?? 0) - (bal.accumulated_depreciation_machinery ?? 0);
      const depreciation = Math.min(Math.round(A.equipment / A.usefulLifeYears), net);
      const amortisation = Math.min(Math.round(A.orgCosts / A.amortiseYears), bal.deferred_organisation_costs ?? 0);
      return [
        { dr: 'depreciation_expense', cr: 'accumulated_depreciation_machinery', amount: depreciation },
        ...(ifrs ? [] : [{ dr: 'amortisation_deferred_assets', cr: 'deferred_organisation_costs', amount: amortisation }]),
      ];
    }
    case 17:
      return [{ dr: 'income_tax_expense', cr: 'cash', amount: A.incomeTax, cf: 'income_tax_paid' }];
    default:
      throw new Error(`沒有第 ${index + 1} 步`);
  }
}

function post(bal, cum, line) {
  const { dr, cr, amount } = line;
  bal[dr] = (bal[dr] ?? 0) + (DEBIT_NORMAL.has(dr) ? amount : -amount);
  bal[cr] = (bal[cr] ?? 0) + (DEBIT_NORMAL.has(cr) ? -amount : amount);
  if (line.cf) cum.cash[line.cf] = (cum.cash[line.cf] ?? 0) + (dr === 'cash' ? amount : -amount);
  if (line.purchase) cum.purchases += amount;
}

const sum = (lines, ids) => ids.reduce((s, id) => s + lines[id], 0);
const b = (bal, id) => bal[id] ?? 0;

/** 三表的每一列（累計，從期初 0 算起）。回傳 { lines, step1 } */
function statementsOf(policy, bal, cum) {
  const ifrs = policy === 'ifrs@1';
  const L = {};
  // 損益表（04 第 11.2 節）
  L.is_revenue = b(bal, 'revenue');
  L.is_opening_inventory = 0;
  L.is_purchases = cum.purchases;
  L.is_inventory_overage_excluded = 0; // 兩套政策的盤盈都沖減銷貨成本，不另列
  L.is_closing_inventory = b(bal, 'inventory');
  L.is_cogs = L.is_opening_inventory + L.is_purchases + L.is_inventory_overage_excluded - L.is_closing_inventory;
  L.is_gross_profit = L.is_revenue - L.is_cogs;
  L.is_directors_remuneration = b(bal, 'directors_remuneration');
  L.is_outsourcing_expense = b(bal, 'outsourcing_expense');
  L.is_packing_freight_expense = b(bal, 'packing_freight_expense');
  L.is_office_supplies_expense = b(bal, 'office_supplies_expense');
  L.is_depreciation_expense = b(bal, 'depreciation_expense');
  L.is_organisation_costs_expense = b(bal, 'organisation_costs_expense');
  L.is_research_development_expense = b(bal, 'research_development_expense');
  L.is_marketing_expense = b(bal, 'marketing_expense');
  L.is_sga_total = sum(L, [
    'is_directors_remuneration',
    'is_outsourcing_expense',
    'is_packing_freight_expense',
    'is_office_supplies_expense',
    'is_depreciation_expense',
    'is_organisation_costs_expense',
    'is_research_development_expense',
    'is_marketing_expense',
  ]);
  L.is_operating_income = L.is_gross_profit - L.is_sga_total;
  L.is_non_operating_income = b(bal, 'non_operating_income');
  L.is_interest_expense = b(bal, 'interest_expense');
  if (!ifrs) L.is_amortisation = b(bal, 'amortisation_deferred_assets');
  L.is_non_operating_expense_total = L.is_interest_expense + (ifrs ? 0 : L.is_amortisation);
  const ordinary = L.is_operating_income + L.is_non_operating_income - L.is_non_operating_expense_total;
  if (!ifrs) {
    L.is_ordinary_income = ordinary;
    L.is_extraordinary_gains = b(bal, 'extraordinary_gains');
    L.is_extraordinary_losses = b(bal, 'extraordinary_losses');
    L.is_pretax_income = L.is_ordinary_income + L.is_extraordinary_gains - L.is_extraordinary_losses;
  } else {
    L.is_pretax_income = ordinary;
  }
  L.is_income_tax_expense = b(bal, 'income_tax_expense');
  L.is_net_income = L.is_pretax_income - L.is_income_tax_expense;
  // 資產負債表（04 第 11.3 節）
  L.bs_cash = b(bal, 'cash');
  L.bs_accounts_receivable = b(bal, 'accounts_receivable');
  L.bs_inventory = b(bal, 'inventory');
  L.bs_short_term_loans_receivable = b(bal, 'short_term_loans_receivable');
  L.bs_prepaid_expenses = b(bal, 'prepaid_expenses');
  L.bs_supplies_on_hand = b(bal, 'supplies_on_hand');
  L.bs_current_assets = sum(L, [
    'bs_cash',
    'bs_accounts_receivable',
    'bs_inventory',
    'bs_short_term_loans_receivable',
    'bs_prepaid_expenses',
    'bs_supplies_on_hand',
  ]);
  L.bs_machinery_net = b(bal, 'machinery_equipment') - b(bal, 'accumulated_depreciation_machinery');
  L.bs_ppe_gross = b(bal, 'machinery_equipment') + b(bal, 'office_equipment');
  L.bs_office_equipment = b(bal, 'office_equipment');
  L.bs_intangible_assets = b(bal, 'intangible_assets');
  L.bs_investments_other = b(bal, 'investments_other_assets');
  L.bs_deferred_org_costs = b(bal, 'deferred_organisation_costs');
  L.bs_deferred_dev_costs = b(bal, 'deferred_development_costs');
  L.bs_total_assets =
    sum(L, ['bs_current_assets', 'bs_machinery_net', 'bs_office_equipment', 'bs_intangible_assets', 'bs_investments_other']) +
    (ifrs ? 0 : L.bs_deferred_org_costs + L.bs_deferred_dev_costs);
  L.bs_accounts_payable = b(bal, 'accounts_payable');
  L.bs_short_term_borrowings = b(bal, 'short_term_borrowings');
  L.bs_income_tax_payable = b(bal, 'income_tax_payable');
  L.bs_deposits_received = b(bal, 'deposits_received');
  L.bs_interest_payable = b(bal, 'interest_payable');
  L.bs_other_payables = b(bal, 'other_payables');
  L.bs_contract_liabilities = b(bal, 'contract_liabilities');
  L.bs_dividends_payable = b(bal, 'dividends_payable');
  L.bs_current_liabilities = sum(L, [
    'bs_accounts_payable',
    'bs_short_term_borrowings',
    'bs_income_tax_payable',
    'bs_deposits_received',
    'bs_interest_payable',
    'bs_other_payables',
    'bs_contract_liabilities',
    'bs_dividends_payable',
  ]);
  L.bs_long_term_borrowings = b(bal, 'long_term_borrowings');
  L.bs_noncurrent_liabilities = L.bs_long_term_borrowings;
  L.bs_total_liabilities = L.bs_current_liabilities + L.bs_noncurrent_liabilities;
  L.bs_share_capital = b(bal, 'share_capital');
  L.bs_capital_surplus = b(bal, 'capital_surplus');
  L.bs_legal_reserve = b(bal, 'legal_reserve');
  L.bs_special_reserve = b(bal, 'special_reserve');
  L.bs_retained_earnings = b(bal, 'retained_earnings') + L.is_net_income;
  L.bs_valuation_adjustments = b(bal, 'valuation_translation_adjustments');
  L.bs_share_subscription_rights = b(bal, 'share_subscription_rights');
  L.bs_total_equity = sum(L, [
    'bs_share_capital',
    'bs_capital_surplus',
    'bs_legal_reserve',
    'bs_special_reserve',
    'bs_retained_earnings',
    'bs_valuation_adjustments',
    'bs_share_subscription_rights',
  ]);
  L.bs_total_liabilities_equity = L.bs_total_liabilities + L.bs_total_equity;
  // 現金流量表間接法（04 第 11.4 節）：營運資金的變動是從期初 0 到現在的差額
  const cf = (kind) => cum.cash[kind] ?? 0;
  const dAr = b(bal, 'accounts_receivable');
  L.cf_pretax_income = L.is_pretax_income;
  L.cf_depreciation = b(bal, 'depreciation_expense');
  L.cf_interest_expense_addback = b(bal, 'interest_expense');
  if (!ifrs) L.cf_other_noncash_losses = b(bal, 'amortisation_deferred_assets');
  L.cf_receivables_increase = dAr > 0 ? -dAr : 0;
  L.cf_inventory_increase = -b(bal, 'inventory');
  L.cf_receivables_decrease = dAr < 0 ? -dAr : 0;
  L.cf_payables_increase = b(bal, 'accounts_payable');
  L.cf_other_liabilities_increase = b(bal, 'deposits_received') + b(bal, 'other_payables') + b(bal, 'contract_liabilities');
  L.cf_other_operating_assets_increase = -(b(bal, 'prepaid_expenses') + b(bal, 'supplies_on_hand'));
  L.cf_noncash_gains = 0;
  L.cf_operating_subtotal =
    L.cf_pretax_income +
    L.cf_depreciation +
    L.cf_interest_expense_addback +
    (ifrs ? 0 : L.cf_other_noncash_losses) +
    L.cf_receivables_increase +
    L.cf_inventory_increase +
    L.cf_receivables_decrease +
    L.cf_payables_increase +
    L.cf_other_liabilities_increase +
    L.cf_other_operating_assets_increase +
    L.cf_noncash_gains;
  L.cf_interest_paid = cf('interest_paid');
  L.cf_income_tax_paid = cf('income_tax_paid');
  L.cf_operating_total = L.cf_operating_subtotal + L.cf_interest_paid + L.cf_income_tax_paid;
  L.cf_capex = cf('capex');
  L.cf_loans_advanced = cf('loans_advanced');
  L.cf_other_investing = cf('other_investing_payments');
  L.cf_loans_collected = cf('loans_collected');
  L.cf_disposal_proceeds = cf('disposal_proceeds');
  L.cf_investing_total = sum(L, ['cf_capex', 'cf_loans_advanced', 'cf_other_investing', 'cf_loans_collected', 'cf_disposal_proceeds']);
  L.cf_st_borrowing_proceeds = cf('st_borrowing_proceeds');
  L.cf_st_borrowing_repayment = cf('st_borrowing_repayment');
  L.cf_share_issue = cf('share_issue');
  L.cf_dividends_paid = cf('dividends_paid');
  L.cf_lt_borrowing_proceeds = cf('lt_borrowing_proceeds');
  L.cf_lt_borrowing_repayment = cf('lt_borrowing_repayment');
  L.cf_financing_total = sum(L, [
    'cf_st_borrowing_proceeds',
    'cf_st_borrowing_repayment',
    'cf_share_issue',
    'cf_dividends_paid',
    'cf_lt_borrowing_proceeds',
    'cf_lt_borrowing_repayment',
  ]);
  L.cf_net_change = L.cf_operating_total + L.cf_investing_total + L.cf_financing_total;
  L.cf_cash_begin = 0;
  L.cf_cash_end = L.cf_cash_begin + L.cf_net_change;
  // 直接法（04 第 11.5 節）
  L.dc_receipts_from_customers = cf('receipts_from_customers');
  L.dc_payments_to_suppliers = cf('payments_to_suppliers');
  L.dc_payments_for_operating_expenses = cf('payments_for_operating_expenses');
  L.dc_other_operating_receipts = cf('other_operating_receipts');
  L.dc_cash_generated_from_operations = sum(L, [
    'dc_receipts_from_customers',
    'dc_payments_to_suppliers',
    'dc_payments_for_operating_expenses',
    'dc_other_operating_receipts',
  ]);
  L.dc_interest_paid = L.cf_interest_paid;
  L.dc_income_tax_paid = L.cf_income_tax_paid;
  L.dc_operating_total = L.dc_cash_generated_from_operations + L.dc_interest_paid + L.dc_income_tax_paid;
  L.dc_investing_total = L.cf_investing_total;
  L.dc_financing_total = L.cf_financing_total;
  L.dc_net_change = L.dc_operating_total + L.dc_investing_total + L.dc_financing_total;
  L.dc_cash_begin = L.cf_cash_begin;
  L.dc_cash_end = L.cf_cash_end;
  // 分組標題列：版面的 group 列沒有金額，黃金資料記 0；教材版面多兩個分組（銷貨成本的明細、遞延資產）
  for (const g of [
    'is_sga_group',
    'is_non_operating_expense_group',
    'bs_current_assets_group',
    'bs_noncurrent_assets_group',
    'bs_fixed_assets_group',
    'bs_current_liabilities_group',
    'bs_noncurrent_liabilities_group',
    'bs_equity_group',
    'bs_retained_earnings_group',
    'cf_operating_group',
    'cf_investing_group',
    'cf_financing_group',
    'cf_cash_group',
    'dc_operating_group',
    ...(ifrs ? [] : ['is_cogs_group', 'bs_deferred_assets_group']),
  ])
    L[g] = 0;
  const step1 = {
    grossProfit: L.is_gross_profit,
    operatingIncome: L.is_operating_income,
    ordinaryIncome: ifrs ? null : L.is_ordinary_income,
    pretaxIncome: L.is_pretax_income,
    netIncome: L.is_net_income,
  };
  return { lines: L, step1 };
}

/** 四捨五入到兩位（顯示值）；百分比以百分點表示 */
const round2 = (v) => {
  const r = Math.round((Math.abs(v) + 1e-9) * 100) / 100;
  return Object.is(v, -0) || v === 0 ? 0 : v < 0 ? -r : r;
};

/** 23 項 excel 版指標（04 第 12.2 節表 A、第 12.6 節）：na → not_meaningful → zero → ok */
function ratiosOf(L) {
  const PAR_VALUE = 10;
  const defs = {
    debt_ratio: { num: L.bs_total_liabilities, den: L.bs_total_assets, unit: 'percent' },
    long_term_funds_to_ppe: { num: L.bs_noncurrent_liabilities + L.bs_total_equity, den: L.bs_machinery_net, unit: 'percent' },
    cash_flow_adequacy: {
      num: L.cf_operating_total,
      den: -L.cf_capex + Math.max(-L.cf_inventory_increase, 0) - L.cf_dividends_paid,
      unit: 'percent',
      notMeaningful: (d) => d < 0,
    },
    cash_flow_ratio: { num: L.cf_operating_total, den: L.bs_current_liabilities, unit: 'percent' },
    cash_reinvestment: {
      num: L.cf_operating_total + L.cf_dividends_paid,
      den: L.bs_total_assets - L.bs_current_liabilities,
      unit: 'percent',
      notMeaningful: (d) => d < 0,
    },
    ar_turnover: { num: L.is_revenue, den: L.bs_accounts_receivable, unit: 'turnover' },
    days_sales_outstanding: { chained: 'ar_turnover' },
    ap_turnover: { num: L.is_purchases, den: L.bs_accounts_payable, unit: 'turnover' },
    inventory_turnover: { num: L.is_cogs, den: L.bs_inventory, unit: 'turnover' },
    days_inventory: { chained: 'inventory_turnover' },
    ppe_turnover: { num: L.is_revenue, den: L.bs_machinery_net, unit: 'turnover' },
    total_asset_turnover: { num: L.is_revenue, den: L.bs_total_assets, unit: 'turnover' },
    dol: { num: L.is_gross_profit, den: L.is_operating_income, unit: 'multiple', notMeaningful: () => L.is_operating_income < 0 },
    dfl: {
      num: L.is_operating_income,
      den: L.is_operating_income - L.is_interest_expense,
      unit: 'multiple',
      notMeaningful: (d) => L.is_operating_income <= 0 || d < 0,
    },
    roa: { num: L.is_net_income, den: L.bs_total_assets, unit: 'percent' },
    pretax_to_paid_in_capital: { num: L.is_pretax_income, den: L.bs_share_capital, unit: 'percent' },
    operating_income_to_paid_in_capital: { num: L.is_operating_income, den: L.bs_share_capital, unit: 'percent' },
    roe: { num: L.is_net_income, den: L.bs_total_equity, unit: 'percent', notMeaningful: (d) => d < 0 },
    eps: { num: L.is_net_income, den: L.bs_share_capital / PAR_VALUE, unit: 'currency_per_share' },
    net_profit_margin: { num: L.is_net_income, den: L.is_revenue, unit: 'percent' },
    quick_ratio: { num: L.bs_cash + L.bs_accounts_receivable + L.bs_short_term_loans_receivable, den: L.bs_current_liabilities, unit: 'multiple' },
    current_ratio: { num: L.bs_current_assets, den: L.bs_current_liabilities, unit: 'multiple' },
    interest_coverage: { num: L.is_pretax_income + L.is_interest_expense, den: L.is_interest_expense, unit: 'multiple' },
  };
  const out = {};
  const raw = {};
  const judge = (d) => {
    if (d.den === 0) return { status: 'na', value: null };
    const value = d.num / d.den;
    if (d.notMeaningful?.(d.den)) return { status: 'not_meaningful', value };
    if (d.num === 0) return { status: 'zero', value: 0 };
    return { status: 'ok', value };
  };
  for (const [id, d] of Object.entries(defs)) {
    if (d.chained) continue;
    const r = judge(d);
    raw[id] = r;
    out[id] = { status: r.status, displayValue: r.value === null ? null : round2(d.unit === 'percent' ? r.value * 100 : r.value) };
  }
  for (const [id, d] of Object.entries(defs)) {
    if (!d.chained) continue;
    const src = raw[d.chained];
    // 除法型連鎖指標：來源 na 或 0 都是 na（04 第 12.6 節第 1 點）
    out[id] =
      src.status === 'na' || src.status === 'zero' || src.value === 0
        ? { status: 'na', displayValue: null }
        : { status: 'ok', displayValue: round2(365 / src.value) };
  }
  return out;
}

function fiveStepOf(L, step1) {
  const check = (step, left, right) => ({ step, left, right, diff: left - right });
  return {
    step1,
    checks: [
      check(2, L.cf_pretax_income, L.is_pretax_income),
      check(3, L.cf_cash_end, L.bs_cash),
      check(4, L.is_net_income, L.bs_retained_earnings),
      check(5, L.bs_total_assets, L.bs_total_liabilities_equity),
    ],
  };
}

/** 整份黃金資料（不含 $comment） */
export function compute(policy) {
  if (policy !== 'teacher@1' && policy !== 'ifrs@1') throw new Error(`不認識的政策：${policy}`);
  const bal = {};
  const cum = { cash: {}, purchases: 0 };
  const steps = [];
  for (let i = 0; i < STEP_IDS.length; i++) {
    for (const line of entriesOf(i, policy, { ...bal })) post(bal, cum, line);
    const { lines, step1 } = statementsOf(policy, bal, cum);
    steps.push({ stepId: STEP_IDS[i], order: i + 1, lines, ratios: ratiosOf(lines), fiveStep: fiveStepOf(lines, step1) });
  }
  return { story: STORY_ID, policy, layout: policy, steps };
}

/** 和黃金資料逐項比對；回傳差異的描述（空陣列就是相同） */
export function diffAgainst(golden, computed) {
  const out = [];
  if (golden.story !== computed.story) out.push(`story：${golden.story} 對 ${computed.story}`);
  if (golden.policy !== computed.policy) out.push(`policy：${golden.policy} 對 ${computed.policy}`);
  if (golden.layout !== computed.layout) out.push(`layout：${golden.layout} 對 ${computed.layout}`);
  if (golden.steps.length !== computed.steps.length) out.push(`步數：${golden.steps.length} 對 ${computed.steps.length}`);
  for (let i = 0; i < Math.min(golden.steps.length, computed.steps.length); i++) {
    const g = golden.steps[i];
    const c = computed.steps[i];
    const at = `第 ${i + 1} 步`;
    if (g.stepId !== c.stepId) out.push(`${at} stepId：${g.stepId} 對 ${c.stepId}`);
    const gKeys = Object.keys(g.lines).sort();
    const cKeys = Object.keys(c.lines).sort();
    for (const k of gKeys) if (!(k in c.lines)) out.push(`${at} 計算表沒有 ${k}`);
    for (const k of cKeys) if (!(k in g.lines)) out.push(`${at} 黃金資料沒有 ${k}`);
    for (const k of gKeys) if (k in c.lines && g.lines[k] !== c.lines[k]) out.push(`${at} ${k}：黃金 ${g.lines[k]}，計算表 ${c.lines[k]}`);
    for (const k of Object.keys(g.ratios)) {
      const a = g.ratios[k];
      const b2 = c.ratios[k];
      if (!b2) out.push(`${at} 計算表沒有指標 ${k}`);
      else if (a.status !== b2.status || a.displayValue !== b2.displayValue)
        out.push(`${at} ${k}：黃金 ${a.status} ${a.displayValue}，計算表 ${b2.status} ${b2.displayValue}`);
    }
    if (JSON.stringify(g.fiveStep) !== JSON.stringify(c.fiveStep))
      out.push(`${at} 五步驟：黃金 ${JSON.stringify(g.fiveStep)}，計算表 ${JSON.stringify(c.fiveStep)}`);
  }
  return out;
}

export function goldenPath(policy) {
  return join(dirname(fileURLToPath(import.meta.url)), `lime-leaf.${policy}.json`);
}

const isMain = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const args = process.argv.slice(2);
  const policy = args[args.indexOf('--policy') + 1] ?? 'teacher@1';
  const computed = compute(policy);
  if (args.includes('--check')) {
    const golden = JSON.parse(readFileSync(goldenPath(policy), 'utf8'));
    const diffs = diffAgainst(golden, computed);
    if (diffs.length > 0) {
      console.error(`calc-lime-leaf：${policy} 有 ${diffs.length} 項和黃金資料不同`);
      for (const d of diffs.slice(0, 40)) console.error('  ' + d);
      process.exit(1);
    }
    console.log(`calc-lime-leaf：${policy} 的 18 步三表、23 項指標與五步驟都和黃金資料相同`);
  } else {
    process.stdout.write(JSON.stringify(computed, null, 2) + '\n');
  }
}
