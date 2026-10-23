// 內建資料（packages/core/data，MIT）：科目表、交易範本（原始、未編譯）、認列政策、教材版面與指標登錄檔。
// JSON 匯入後的型別是寬鬆的字串，這裡以本模組的型別宣告收斂；資料的靜態檢查在 test/data.test.ts。
import accountsJson from '../../data/accounts.json' with { type: 'json' };
import teacherLayoutJson from '../../data/layouts/teacher@1.json' with { type: 'json' };
import policiesJson from '../../data/policies.json' with { type: 'json' };
import ratiosJson from '../../data/ratios.json' with { type: 'json' };
import amortiseOrgCosts from '../../data/templates/amortise_org_costs.json' with { type: 'json' };
import borrowShortTerm from '../../data/templates/borrow_short_term.json' with { type: 'json' };
import buyEquipmentCash from '../../data/templates/buy_equipment_cash.json' with { type: 'json' };
import buyOfficeSuppliesCash from '../../data/templates/buy_office_supplies_cash.json' with { type: 'json' };
import collectReceivables from '../../data/templates/collect_receivables.json' with { type: 'json' };
import depreciationStraightLine from '../../data/templates/depreciation_straight_line.json' with { type: 'json' };
import inventoryCount from '../../data/templates/inventory_count.json' with { type: 'json' };
import issueSharesCash from '../../data/templates/issue_shares_cash.json' with { type: 'json' };
import payAllPayables from '../../data/templates/pay_all_payables.json' with { type: 'json' };
import payDirectorsRemunerationCash from '../../data/templates/pay_directors_remuneration_cash.json' with { type: 'json' };
import payDividendsCash from '../../data/templates/pay_dividends_cash.json' with { type: 'json' };
import payIncomeTaxCash from '../../data/templates/pay_income_tax_cash.json' with { type: 'json' };
import payIncomeTaxPayable from '../../data/templates/pay_income_tax_payable.json' with { type: 'json' };
import payOrgCosts from '../../data/templates/pay_org_costs.json' with { type: 'json' };
import payOutsourcingCash from '../../data/templates/pay_outsourcing_cash.json' with { type: 'json' };
import payPackingFreightCash from '../../data/templates/pay_packing_freight_cash.json' with { type: 'json' };
import purchaseInventoryCash from '../../data/templates/purchase_inventory_cash.json' with { type: 'json' };
import purchaseInventoryCredit from '../../data/templates/purchase_inventory_credit.json' with { type: 'json' };
import repayAllShortTermLoansWithInterest from '../../data/templates/repay_all_short_term_loans_with_interest.json' with { type: 'json' };
import sellAllInventoryCash from '../../data/templates/sell_all_inventory_cash.json' with { type: 'json' };
import sellAllInventoryCredit from '../../data/templates/sell_all_inventory_credit.json' with { type: 'json' };
import type { Account } from '../accounts/types.ts';
import type { Layout } from '../layout/types.ts';
import type { PolicyDefinition } from '../policy/types.ts';
import type { RatioDefinition, TransactionTemplate } from './types.ts';

export const defaultAccounts: readonly Account[] = accountsJson as unknown as readonly Account[];

/** 教材故事 18 種交易與黃金測試需要的範本，依故事順序；原始資料，尚未編譯 */
export const defaultTemplates: readonly TransactionTemplate[] = [
  issueSharesCash,
  buyOfficeSuppliesCash,
  buyEquipmentCash,
  payOutsourcingCash,
  payOrgCosts,
  purchaseInventoryCash,
  sellAllInventoryCash,
  borrowShortTerm,
  purchaseInventoryCredit,
  sellAllInventoryCredit,
  payAllPayables,
  collectReceivables,
  payDirectorsRemunerationCash,
  payPackingFreightCash,
  repayAllShortTermLoansWithInterest,
  inventoryCount,
  depreciationStraightLine,
  amortiseOrgCosts,
  payIncomeTaxCash,
  payIncomeTaxPayable,
  payDividendsCash,
] as unknown as readonly TransactionTemplate[];

export const defaultPolicies: readonly PolicyDefinition[] = policiesJson as unknown as readonly PolicyDefinition[];

export const teacherLayout: Layout = teacherLayoutJson as unknown as Layout;

export const defaultRatios: readonly RatioDefinition[] = ratiosJson as unknown as readonly RatioDefinition[];

export { CASH_FLOW_KINDS, INVENTORY_TAGS, RATIO_VERSION_IDS } from './types.ts';
export type {
  CashFlowKind,
  CashFlowTag,
  DerivedSpec,
  InventoryTag,
  LineSpec,
  LineTag,
  ParamSpec,
  Precondition,
  RatioCategory,
  RatioDefinition,
  RatioInput,
  RatioUnit,
  RatioVersion,
  RatioVersionId,
  TransactionTemplate,
} from './types.ts';
