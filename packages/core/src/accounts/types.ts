// 科目表的型別（04 第 4.1 節）。資料本體在 packages/core/data/accounts.json，程式只讀不寫。

/** 中英雙語文字：核心資料的兩種語系都必填（04 第 16.1 節：published 內容中英齊全） */
export interface LocalizedText {
  readonly 'zh-TW': string;
  readonly en: string;
}

/** 中英別名：供搜尋與解析，不對使用者當主要顯示 */
export interface LocalizedAliases {
  readonly 'zh-TW': readonly string[];
  readonly en: readonly string[];
}

export type Element = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export type Section =
  | 'current_asset'
  | 'noncurrent_asset'
  | 'deferred_asset'
  | 'current_liability'
  | 'noncurrent_liability'
  | 'equity'
  | 'retained_earnings_group'
  | 'operating_revenue'
  | 'non_operating_income'
  | 'extraordinary_gain'
  | 'cost_of_sales'
  | 'sga_expense'
  | 'non_operating_expense'
  | 'extraordinary_loss'
  | 'income_tax';

export type AccountFlag = 'japanese' | 'old_name' | 'typo_fixed' | 'unused' | 'not_ifrs_line' | 'ifrs_treatment_differs' | 'not_in_template' | 'extension';

export type Side = 'debit' | 'credit';

export type CashFlowActivity = 'operating' | 'investing' | 'financing';

/**
 * 間接法的歸屬規則（04 第 11.3 節的「間接法規則」欄與建置期完整性檢查）：
 * - cash：現金本身，每條現金行必須帶現金流量標籤
 * - working_capital：營運資金列（H15 到 H19 與延伸列），以餘額淨變動填入
 * - noncash_addback：非現金損益加回列（H12 到 H14），以發生額加回
 * - via_cash_tag：由現金行的標籤決定投資或籌資列（H26 到 H28、H32 到 H35 與延伸列）
 * - excluded：排除清單（應付所得稅、應付利息、借款、應付股利），變動不進 H19，付現另由 H21、H22 或籌資列表達
 * - equity_transfer：權益內部移轉，不影響現金
 * - profit_or_loss：收入與費用科目，經 H11 的稅前淨利進入間接法；折舊、利息與攤銷另有加回列
 * - none：不直接對應任何列（抵銷科目；所得稅費用不經 H11，付現走 H22）
 */
export type IndirectRule = 'cash' | 'working_capital' | 'noncash_addback' | 'via_cash_tag' | 'excluded' | 'equity_transfer' | 'profit_or_loss' | 'none';

export const INDIRECT_RULES: readonly IndirectRule[] = [
  'cash',
  'working_capital',
  'noncash_addback',
  'via_cash_tag',
  'excluded',
  'equity_transfer',
  'profit_or_loss',
  'none',
];

export interface AccountLabels {
  /** 主要顯示：教材用語與它的英文（12 的英式拼字） */
  readonly teacher: LocalizedText;
  /** 現行台灣用語；與教材相同時為 null */
  readonly currentTw: string | null;
  /** IFRS 英文；IFRS 沒有對應時為 null */
  readonly ifrsEn: string | null;
  readonly aliases: LocalizedAliases;
}

export interface IfrsTreatment {
  readonly note: LocalizedText;
  readonly amountImpact: LocalizedText;
}

export interface AccountCashFlow {
  readonly indirect: IndirectRule;
  /** 只用在分類題的正解推導；抵銷科目與不影響現金的科目為 null */
  readonly defaultActivity: CashFlowActivity | null;
}

export interface Account {
  readonly id: string;
  readonly order: number;
  readonly element: Element;
  readonly section: Section;
  readonly normalSide: Side;
  /** 權益與損益科目為 null */
  readonly current: boolean | null;
  /** 抵銷科目指向被抵銷的科目 */
  readonly contraOf: string | null;
  /** 過帳後是否允許負餘額（04 第 6.3 節） */
  readonly allowNegative: boolean;
  readonly enabledByDefault: boolean;
  /** 老師模板的儲存格；模板沒有這一列時為 null */
  readonly teacherCell: string | null;
  readonly labels: AccountLabels;
  /** 名詞卡 ID（tm_ 前綴） */
  readonly termRef: string;
  readonly flags: readonly AccountFlag[];
  /** 有 ifrs_treatment_differs 旗標時必填 */
  readonly ifrsTreatment: IfrsTreatment | null;
  readonly cashFlow: AccountCashFlow;
  readonly pendingRefs: readonly string[];
}

/** 建好索引的科目表：依 order 排序，id 與名稱都能查 */
export interface Chart {
  /** 依 order 由小到大 */
  readonly accounts: readonly Account[];
  readonly byId: ReadonlyMap<string, Account>;
  /** 正規化後的名稱（ID、教材用語、現行用語、IFRS 英文、別名）對科目 ID */
  readonly byName: ReadonlyMap<string, string>;
}
