// 認列政策的型別（04 第 10.1、10.2 節）。資料本體在 packages/core/data/policies.json。

export interface PolicySwitches {
  readonly orgCosts: 'capitalise_amortise' | 'expense';
  readonly inventoryOverage: 'reduce_cogs' | 'non_operating_income' | 'extraordinary_gain';
  readonly inventoryShortage: 'increase_cogs';
  readonly incomeTax: 'cash_direct' | 'accrue_then_pay';
  readonly interestPaidActivity: 'operating' | 'financing';
  readonly officeSupplies: 'expense_on_purchase' | 'asset_then_expense';
}

export type PolicySwitchKey = keyof PolicySwitches;

/** 每個開關允許的值；範本 policyWhen 與政策資料都用它檢查 */
export const POLICY_SWITCH_VALUES: { readonly [K in PolicySwitchKey]: readonly PolicySwitches[K][] } = {
  orgCosts: ['capitalise_amortise', 'expense'],
  inventoryOverage: ['reduce_cogs', 'non_operating_income', 'extraordinary_gain'],
  inventoryShortage: ['increase_cogs'],
  incomeTax: ['cash_direct', 'accrue_then_pay'],
  interestPaidActivity: ['operating', 'financing'],
  officeSupplies: ['expense_on_purchase', 'asset_then_expense'],
};

export const POLICY_SWITCH_KEYS: readonly PolicySwitchKey[] = [
  'orgCosts',
  'inventoryOverage',
  'inventoryShortage',
  'incomeTax',
  'interestPaidActivity',
  'officeSupplies',
];

/** 範本分錄行的 policyWhen：只在所有列出的開關都相符時產生這一行 */
export type PolicyWhen = Partial<PolicySwitches>;

export interface PolicyDefinition {
  /** 例如 teacher@1、ifrs@1 */
  readonly id: string;
  readonly switches: PolicySwitches;
  /** 這套政策下停用的科目；過帳引用時回傳 entry.account_disabled */
  readonly disabledAccounts: readonly string[];
  /** 這套政策下額外啟用的延伸科目（例如 ifrs@1 的 organisation_costs_expense，04 第 4.5 節） */
  readonly enabledAccounts?: readonly string[];
}
