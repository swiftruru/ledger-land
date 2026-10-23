// 教材版面三表的推導結果（04 第 11 節）：視窗、每一列的值、給畫面的列與不變式結果。
// 報表是推導值：唯一的會計事實是分錄，這裡沒有「寫入報表」的 API。
import type { LocalizedAliases, LocalizedText } from '../accounts/types.ts';
import type { Layout, LayoutLineKind, LineCheck, LineFlag, StatementId } from '../layout/types.ts';
import type { PostedRun } from '../ledger/types.ts';
import type { Money } from '../money.ts';
import type { PolicyDefinition } from '../policy/types.ts';

export type LineId = string;

/**
 * 視窗（04 第 11.5 節）：
 * cumulative 從帳本起點累計到 to（null 表示到最後一步；run 沒有步驟時就是期初）；
 * transaction 是「本筆變動」：step 的累計報表減前一步的累計報表，逐列相減，不另編期間報表。
 */
export type StatementWindow = { readonly kind: 'cumulative'; readonly to: string | null } | { readonly kind: 'transaction'; readonly step: string };

/** 列旁的註記：鍵是 i18n 的訊息鍵，由 UI 翻譯；目前只有營運資金列的「模板無此列，以反號填入」 */
export interface LineNote {
  readonly key: 'template_has_no_decrease_row' | 'template_has_no_increase_row';
  readonly params: Readonly<Record<string, string | number>>;
}

export interface LineValue {
  readonly line: LineId;
  readonly cell: string | null;
  readonly value: Money;
  readonly kind: LayoutLineKind;
  /** hidden 列、showExtensionRows 為 never 的延伸列、未啟用的政策列等都算值但不顯示 */
  readonly visible: boolean;
  readonly note?: LineNote;
}

/** 給畫面的一列：版面的顯示欄位加上這個視窗的值 */
export interface StatementRow {
  readonly id: LineId;
  readonly statement: StatementId;
  readonly cell: string | null;
  readonly kind: LayoutLineKind;
  readonly label: LocalizedText;
  readonly aliases: LocalizedAliases;
  readonly termRef: string | null;
  /** 五層利益的層次（formula 列） */
  readonly level: 1 | 2 | 3 | 4 | 5 | null;
  readonly extension: boolean;
  readonly hidden: boolean;
  readonly pendingRefs: readonly string[];
  readonly flags: readonly LineFlag[];
  readonly check: LineCheck | null;
  readonly value: Money;
  readonly visible: boolean;
  readonly note: LineNote | null;
}

export interface StatementNote {
  readonly line: LineId;
  readonly note: LineNote;
}

/** 建立報表時用到的來源；五步驟檢查與追蹤樹由這裡取回 run、版面與政策，不必再傳一次 */
export interface StatementSource {
  readonly run: PostedRun;
  readonly layout: Layout;
  readonly policy: PolicyDefinition;
}

export interface Statements {
  readonly layoutId: string;
  readonly policyId: string;
  readonly window: StatementWindow;
  /** 每一列（含 hidden 與不顯示的列）的值 */
  readonly lines: ReadonlyMap<LineId, LineValue>;
  readonly statements: { readonly [S in StatementId]: readonly StatementRow[] };
  readonly notes: readonly StatementNote[];
  readonly source: StatementSource;
}

/** 不變式的規則名稱（04 第 11.4、18.1 節） */
export type InvariantRule =
  | 'equals_line'
  | 'equals_account_activity'
  | 'equals_cash_change'
  | 'balance_end_equals_account'
  | 'closing_inventory_equals_balance'
  | 'inventory_line_equals_balance'
  | 'purchases_equal_tag_total'
  | 'retained_earnings_w05';

export interface InvariantResult {
  readonly rule: InvariantRule;
  /** 被檢查的列 */
  readonly line: LineId;
  /** 比對對象：另一列、科目或 cash */
  readonly against: string;
  readonly left: Money;
  readonly right: Money;
  /** left 減 right */
  readonly diff: Money;
  readonly pass: boolean;
}
