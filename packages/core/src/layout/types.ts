// 教材版面三表的型別（04 第 10.1 節的 LayoutOptions、第 11 節的三表與第 11.6 節的資料形狀）。
// 資料本體在 packages/core/data/layouts/<id>.json；每一列是 discriminated union，kind 決定怎麼從帳本推導金額。
import type { AccountFlag, CashFlowActivity, LocalizedAliases, LocalizedText } from '../accounts/types.ts';
import type { PolicySwitches } from '../policy/types.ts';

export interface LayoutOptions {
  readonly amortisationSection: 'non_operating' | 'operating';
  readonly amortisationAddBack: 'H14' | 'H12';
  readonly showOrdinaryIncome: boolean;
  readonly showExtraordinaryRows: boolean;
  readonly showExtensionRows: 'when_nonzero' | 'always' | 'never';
  readonly excelExportClosingInventorySign: 'negative';
}

export type StatementId = 'income_statement' | 'balance_sheet' | 'cash_flow_indirect' | 'cash_flow_direct';

export const STATEMENT_IDS: readonly StatementId[] = ['income_statement', 'balance_sheet', 'cash_flow_indirect', 'cash_flow_direct'];

/** 列的旗標沿用科目旗標的名稱（japanese、typo_fixed、not_ifrs_line、not_in_template、extension 等） */
export type LineFlag = AccountFlag;

/** 五步驟檢查的勾稽點（04 第 13 節）：step2 稅前淨利、step3 期末現金 */
export type LineCheck = 'step2' | 'step3';

interface LineBase {
  /** 穩定的線 ID：is_、bs_、cf_（間接法）、dc_（直接法）前綴 */
  readonly id: string;
  /** 老師模板的儲存格；模板沒有這一列時為 null */
  readonly cell: string | null;
  /** 主要顯示（依 D13 A 的網站顯示字） */
  readonly label: LocalizedText;
  /** 教材原字或現行用語等，只供搜尋 */
  readonly aliases: LocalizedAliases;
  readonly termRef?: string;
  readonly pendingRefs?: readonly string[];
  readonly flags?: readonly LineFlag[];
  /** 模板沒有的延伸列，依 showExtensionRows 顯示 */
  readonly extension?: boolean;
  /** 只給指標公式使用、畫面不顯示的計算列 */
  readonly hidden?: boolean;
}

/** 科目的餘額或視窗內發生額；多個科目相加，抵銷科目以負號併入（例如機器設備淨額） */
export interface AccountsLine extends LineBase {
  readonly kind: 'accounts';
  readonly accounts: readonly string[];
  readonly measure: 'balance' | 'activity';
}

/** R12 期初存貨：視窗起點的存貨餘額（04 第 5.2 節） */
export interface InventoryOpeningLine extends LineBase {
  readonly kind: 'inventory_opening';
}

/** R13 本期進貨：視窗內標 purchase 的存貨借方合計 */
export interface InventoryPurchasesLine extends LineBase {
  readonly kind: 'inventory_purchases';
}

/** R14 期末存貨(-)：視窗終點的存貨餘額，正數顯示、在小計中扣除 */
export interface InventoryClosingLine extends LineBase {
  readonly kind: 'inventory_closing';
  readonly display: 'positive_subtracted';
}

/** 存貨盤盈列（04 第 5.2 節）：標 count_overage 的合計；只在 appliesWhen 列出的政策值下有值並顯示，其餘情況為 0 */
export interface InventoryOverageLine extends LineBase {
  readonly kind: 'inventory_overage';
  readonly appliesWhen: { readonly [K in keyof PolicySwitches]?: readonly PolicySwitches[K][] };
}

/** 版面公式列：只能引用 line.*，結果是整數（04 第 8.2 節）；invariant 是每一步都要成立的檢查 */
export interface FormulaLine extends LineBase {
  readonly kind: 'formula';
  readonly expr: string;
  /** 五層利益的層次 */
  readonly level?: 1 | 2 | 3 | 4 | 5;
  readonly invariant?: string;
}

/** 連到另一張表的同一個值（例如 H11 ＝ is_pretax_income） */
export interface LinkLine extends LineBase {
  readonly kind: 'link';
  readonly from: string;
  readonly check?: LineCheck;
}

/**
 * 營運資金列：科目在視窗內的淨變動（期末減期初，正常餘額）。
 * sign 為 change 時填 ＋Δ（負債），negate_change 時填 －Δ（資產）；only 讓 H15 與 H17 擇一；
 * oppositeSignNote 表示模板沒有反向列，反向時以反號填同列並加註；excludeAccounts 記錄必須排除的科目（H19）。
 */
export interface WorkingCapitalLine extends LineBase {
  readonly kind: 'working_capital';
  readonly accounts: readonly string[];
  readonly sign: 'change' | 'negate_change';
  readonly only?: 'increase' | 'decrease';
  readonly oppositeSignNote?: 'template_has_no_decrease_row' | 'template_has_no_increase_row';
  readonly excludeAccounts?: readonly string[];
}

/** 非現金損益的加回（或減除）列：科目在視窗內的發生額 */
export interface NoncashAddbackLine extends LineBase {
  readonly kind: 'noncash_addback';
  readonly accounts: readonly string[];
  readonly sign: 'add' | 'subtract';
}

/** 由現金行標籤決定的列：Σ 帶這些 kind 的現金行 */
export interface CashTagLine extends LineBase {
  readonly kind: 'cash_tag';
  readonly activity: CashFlowActivity;
  readonly cfKinds: readonly string[];
  readonly sign: 'inflow_positive' | 'outflow_negative';
}

/** N26 未分配盈餘：帳戶餘額加上視窗內的本期淨利（W05） */
export interface RetainedEarningsLine extends LineBase {
  readonly kind: 'retained_earnings';
  readonly account: string;
  readonly netIncomeLine: string;
}

/** 標題列：不可入帳、沒有金額 */
export interface GroupLine extends LineBase {
  readonly kind: 'group';
  readonly children?: readonly string[];
}

/** 期初餘額列（H40） */
export interface BalanceBeginLine extends LineBase {
  readonly kind: 'balance_begin';
  readonly account: string;
}

/** 期末餘額列（H41）：from 的線相加，並檢查等於該科目的期末餘額 */
export interface BalanceEndLine extends LineBase {
  readonly kind: 'balance_end';
  readonly account: string;
  readonly from: readonly string[];
  readonly check?: LineCheck;
}

/** 合計列：sum 列出的線相加 */
export interface TotalLine extends LineBase {
  readonly kind: 'total';
  readonly sum: readonly string[];
  readonly invariant?: string;
}

export type LayoutLine =
  | AccountsLine
  | InventoryOpeningLine
  | InventoryPurchasesLine
  | InventoryClosingLine
  | InventoryOverageLine
  | FormulaLine
  | LinkLine
  | WorkingCapitalLine
  | NoncashAddbackLine
  | CashTagLine
  | RetainedEarningsLine
  | GroupLine
  | BalanceBeginLine
  | BalanceEndLine
  | TotalLine;

export type LayoutLineKind = LayoutLine['kind'];

export const LAYOUT_LINE_KINDS: readonly LayoutLineKind[] = [
  'accounts',
  'inventory_opening',
  'inventory_purchases',
  'inventory_closing',
  'inventory_overage',
  'formula',
  'link',
  'working_capital',
  'noncash_addback',
  'cash_tag',
  'retained_earnings',
  'group',
  'balance_begin',
  'balance_end',
  'total',
];

export interface Layout {
  /** 例如 teacher@1 */
  readonly id: string;
  readonly options: LayoutOptions;
  readonly statements: { readonly [S in StatementId]: readonly LayoutLine[] };
}
