// 範本與指標資料的本地型別宣告（04 第 7 節與第 12.1 節）。範本編譯與指標計算模組完成後，這裡的型別會改由那些模組匯出。
import type { CashFlowActivity, LocalizedText } from '../accounts/types.ts';
import type { PolicyWhen } from '../policy/types.ts';

export type CashFlowKind =
  | 'receipts_from_customers'
  | 'payments_to_suppliers'
  | 'payments_for_operating_expenses'
  | 'interest_paid'
  | 'income_tax_paid'
  | 'other_operating_receipts'
  | 'capex'
  | 'loans_advanced'
  | 'loans_collected'
  | 'other_investing_payments'
  | 'disposal_proceeds'
  | 'st_borrowing_proceeds'
  | 'st_borrowing_repayment'
  | 'lt_borrowing_proceeds'
  | 'lt_borrowing_repayment'
  | 'share_issue'
  | 'dividends_paid';

export const CASH_FLOW_KINDS: { readonly [A in CashFlowActivity]: readonly CashFlowKind[] } = {
  operating: [
    'receipts_from_customers',
    'payments_to_suppliers',
    'payments_for_operating_expenses',
    'interest_paid',
    'income_tax_paid',
    'other_operating_receipts',
  ],
  investing: ['capex', 'loans_advanced', 'loans_collected', 'other_investing_payments', 'disposal_proceeds'],
  financing: ['st_borrowing_proceeds', 'st_borrowing_repayment', 'lt_borrowing_proceeds', 'lt_borrowing_repayment', 'share_issue', 'dividends_paid'],
};

export interface CashFlowTag {
  readonly activity: CashFlowActivity;
  readonly kind: CashFlowKind;
}

export type InventoryTag = 'purchase' | 'cost_of_sale' | 'count_overage' | 'count_shortage';
export const INVENTORY_TAGS: readonly InventoryTag[] = ['purchase', 'cost_of_sale', 'count_overage', 'count_shortage'];

/** 借記未分配盈餘時用 dividend 或 reserve_appropriation */
export type LineTag = InventoryTag | 'dividend' | 'reserve_appropriation';

export interface ParamSpec {
  readonly name: string;
  readonly type: 'money' | 'count' | 'rate' | 'years';
  readonly min: number;
  readonly max: number;
  readonly default: number;
  readonly label: LocalizedText;
  readonly monotonic?: 'increasing' | 'decreasing' | 'none';
}

export interface DerivedSpec {
  readonly name: string;
  readonly type: 'money' | 'number';
  readonly expr: string;
  readonly label: LocalizedText;
}

export interface Precondition {
  readonly id: string;
  readonly expr: string;
  readonly message: LocalizedText;
}

export interface LineSpec {
  readonly id: string;
  readonly account: string;
  readonly side: 'debit' | 'credit';
  readonly amount: string;
  readonly cf?: CashFlowTag;
  readonly tag?: LineTag;
  readonly policyWhen?: PolicyWhen;
  readonly memo?: LocalizedText;
}

export interface TransactionTemplate {
  readonly id: string;
  readonly rev: number;
  readonly revKind: 'text' | 'answer';
  readonly status: 'draft' | 'published' | 'retired';
  readonly title: LocalizedText;
  readonly summary: LocalizedText;
  readonly params: readonly ParamSpec[];
  readonly derived: readonly DerivedSpec[];
  readonly preconditions: readonly Precondition[];
  readonly lines: readonly LineSpec[];
  readonly explanation: LocalizedText;
  readonly termRefs: readonly string[];
  readonly pendingRefs?: readonly string[];
  readonly entryQuestionBlockedBy?: readonly string[];
}

export type RatioUnit = 'percent' | 'turnover' | 'days' | 'multiple' | 'currency_per_share' | 'currency';
export type RatioVersionId = 'excel' | 'slides03' | 'slides02' | 'dupont' | 'slides01';
export const RATIO_VERSION_IDS: readonly RatioVersionId[] = ['excel', 'slides03', 'slides02', 'dupont', 'slides01'];

export interface RatioInput {
  readonly default: number | null;
  readonly label: LocalizedText;
  readonly pendingRefs?: readonly string[];
}

export interface RatioVersion {
  readonly numerator?: string;
  readonly denominator?: string;
  readonly expr?: string;
  readonly unit: RatioUnit;
  readonly displayDecimals: number;
  readonly excel?: { readonly cell: string; readonly formula: string; readonly format: string; readonly iferror: string };
  readonly naWhen: readonly ('denominator_zero' | 'chained_source_na_or_zero' | 'chained_source_na' | 'missing_input')[];
  readonly notMeaningfulWhen: readonly ('denominator_negative' | 'base_not_positive')[];
  readonly notMeaningfulBase?: string;
  readonly flags: readonly ('end_of_period_balance' | 'single_period_approx' | 'excel_approximation' | 'website_fix' | 'website_definition')[];
  readonly inputs?: Readonly<Record<string, RatioInput>>;
}

export type RatioCategory =
  'financial_structure' | 'solvency' | 'activity' | 'profitability' | 'cash_flow' | 'leverage' | 'dupont' | 'department' | 'market' | 'income_structure';

export interface RatioDefinition {
  readonly id: string;
  readonly termRef: string;
  readonly category: RatioCategory;
  readonly framework: 'input' | 'transform' | 'output' | null;
  readonly versions: { readonly [V in RatioVersionId]?: RatioVersion };
  readonly pendingRefs: readonly string[];
}
