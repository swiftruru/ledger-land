// 一次性工具：替 packages/core/data 裡還沒有名詞卡 ID 的科目、版面列與指標產生 tm_ ID（08 第 4.1 節的格式）。
// 用固定種子的 mulberry32 搭配 @ledgerland/content-schema 的 generateId，所以重跑結果相同；
// 產出的 ID 已寫死在 data/*.json 裡，這支腳本只用來重現與核對，不在建置流程中執行。
// 執行：node packages/core/scripts/gen-term-ids.mjs
import { generateId } from '@ledgerland/content-schema';

/** 已存在、不得重複的 ID：content/terms/ 現有的名詞卡，以及 04 第 17 節表列、資料已沿用的 ID */
const RESERVED = [
  'tm_h6p2k9wd',
  'tm_r4w8n2qe',
  'tm_x3n8v5tc',
  'tm_c4sh8k2p',
  'tm_n7v3k8pq',
  'tm_r7x2c9fa',
  'tm_a3p9y6kc',
  'tm_s5b8r3hd',
  'tm_v3n8q2ye',
  'tm_g5c2m8tw',
  'tm_g8p4w1rz',
  'tm_b6s3k9hn',
  'tm_n4e8t2jy',
  'tm_p2a7c5vk',
  'tm_t7a3s6wb',
  'tm_f9a4c6md',
  'tm_c2y9b5ex',
  'tm_r0a5t3kq',
  'tm_c8r1t4zm',
  'tm_n9s2t7ak',
  'tm_h3c7v1xe',
  'tm_d4p7x2mv',
  'tm_a8d5c1pz',
  'tm_a2m7z4tf',
  'tm_x5c9e3nb',
  'tm_m8d3n6qa',
  'tm_k6t2e9wr',
  'tm_d9f3g7cs',
  'tm_w2j8d5ky',
  'tm_v6j2k8sr',
  'tm_p7h3c5xq',
  'tm_q4k9v2nd',
];

/** 需要新 ID 的鍵（順序固定；新增只能加在最後，否則前面的 ID 會改變） */
const KEYS = [
  // 科目（04 第 4.2、4.5 節）
  'account:short_term_loans_receivable',
  'account:machinery_equipment',
  'account:intangible_assets',
  'account:investments_other_assets',
  'account:deferred_development_costs',
  'account:income_tax_payable',
  'account:deposits_received',
  'account:long_term_borrowings',
  'account:share_capital',
  'account:capital_surplus',
  'account:legal_reserve',
  'account:special_reserve',
  'account:retained_earnings',
  'account:valuation_translation_adjustments',
  'account:share_subscription_rights',
  'account:non_operating_income',
  'account:extraordinary_gains',
  'account:directors_remuneration',
  'account:outsourcing_expense',
  'account:packing_freight_expense',
  'account:office_supplies_expense',
  'account:extraordinary_losses',
  'account:income_tax_expense',
  'account:prepaid_expenses',
  'account:supplies_on_hand',
  'account:organisation_costs_expense',
  'account:interest_payable',
  'account:other_payables',
  'account:contract_liabilities',
  'account:dividends_payable',
  'account:research_development_expense',
  'account:marketing_expense',
  'account:office_equipment',
  // 版面列（04 第 11 節）
  'line:is_sga_total',
  'line:is_operating_income',
  'line:is_non_operating_expense_total',
  'line:is_ordinary_income',
  'line:is_pretax_income',
  'line:is_sga_group',
  'line:is_non_operating_expense_group',
  'line:bs_current_assets_group',
  'line:bs_noncurrent_assets_group',
  'line:bs_fixed_assets_group',
  'line:bs_ppe_gross',
  'line:bs_deferred_assets_group',
  'line:bs_noncurrent_liabilities_group',
  'line:bs_total_liabilities',
  'line:bs_equity_group',
  'line:bs_retained_earnings_group',
  'line:bs_total_equity',
  'line:bs_total_liabilities_equity',
  'line:cf_depreciation',
  'line:cf_interest_expense_addback',
  'line:cf_other_noncash_losses',
  'line:cf_receivables_increase',
  'line:cf_inventory_increase',
  'line:cf_receivables_decrease',
  'line:cf_payables_increase',
  'line:cf_other_liabilities_increase',
  'line:cf_operating_subtotal',
  'line:cf_interest_paid',
  'line:cf_income_tax_paid',
  'line:cf_operating_total',
  'line:cf_capex',
  'line:cf_loans_advanced',
  'line:cf_other_investing',
  'line:cf_investing_total',
  'line:cf_st_borrowing_proceeds',
  'line:cf_st_borrowing_repayment',
  'line:cf_share_issue',
  'line:cf_dividends_paid',
  'line:cf_financing_total',
  'line:cf_cash_group',
  'line:cf_net_change',
  'line:cf_cash_begin',
  'line:cf_cash_end',
  'line:cf_loans_collected',
  'line:cf_disposal_proceeds',
  'line:cf_lt_borrowing_proceeds',
  'line:cf_lt_borrowing_repayment',
  'line:cf_investing_group',
  // 指標（04 第 12 節）
  'ratio:debt_ratio',
  'ratio:long_term_funds_to_ppe',
  'ratio:cash_flow_adequacy',
  'ratio:cash_flow_ratio',
  'ratio:cash_reinvestment',
  'ratio:ar_turnover',
  'ratio:days_sales_outstanding',
  'ratio:ap_turnover',
  'ratio:inventory_turnover',
  'ratio:days_inventory',
  'ratio:ppe_turnover',
  'ratio:total_asset_turnover',
  'ratio:dol',
  'ratio:dfl',
  'ratio:pretax_to_paid_in_capital',
  'ratio:operating_income_to_paid_in_capital',
  'ratio:roe',
  'ratio:eps',
  'ratio:net_profit_margin',
  'ratio:quick_ratio',
  'ratio:equity_multiplier',
  'ratio:revenue_per_employee',
  'ratio:rd_intensity',
  'ratio:rd_leverage',
  'ratio:ce_intensity',
  'ratio:ce_turnover',
  'ratio:me_intensity',
  'ratio:me_leverage',
  'ratio:pe_ratio',
  'ratio:margin_maintenance',
  'ratio:capital_surplus_to_share_capital',
  'ratio:gross_margin',
  'ratio:operating_margin',
  'ratio:cost_ratio',
  'ratio:sga_ratio',
  'ratio:effective_tax_rate',
  'ratio:days_payable',
  'ratio:operating_cycle',
  'ratio:cash_conversion_cycle',
  'ratio:total_leverage',
];

/** mulberry32：固定種子的簡單 PRNG，回傳 [0, 1) */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 20261023;
const random = mulberry32(SEED);
const used = new Set(RESERVED);
const out = {};
for (const key of KEYS) {
  let id = generateId('term', random);
  while (used.has(id)) id = generateId('term', random);
  used.add(id);
  out[key] = id;
}
process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
