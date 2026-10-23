// 表達版面（04 第 10.1、11 節）：科目怎麼排進哪一列、列名是什麼。列的種類以 kind 區分，每種的必填欄位在這裡寫死，
// 形狀與核心 packages/core/src/layout/types.ts 一致（資料本體在 packages/core/data/layouts/<id>.json）。
// 公式列與 link 引用的線是否存在、每個科目是否都落在某一列等完整性檢查由核心的 content:compile 負責。
import { z } from 'zod';
import { AccountFlag, CashFlowActivity, TeacherCell } from './account.ts';
import { LineId, LocalizedText, PendingRef, SemanticId, VersionedId, idSchema } from './common.ts';
import { Expr } from './expr.ts';
import { PolicySwitches } from './policy.ts';
import { CashFlowKind } from './template.ts';

export const LayoutOptions = z
  .object({
    amortisationSection: z.enum(['non_operating', 'operating']),
    amortisationAddBack: z.enum(['H14', 'H12']),
    showOrdinaryIncome: z.boolean(),
    showExtraordinaryRows: z.boolean(),
    showExtensionRows: z.enum(['when_nonzero', 'always', 'never']),
    excelExportClosingInventorySign: z.enum(['negative']),
  })
  .strict();
export type LayoutOptions = z.infer<typeof LayoutOptions>;

export const StatementKey = z.enum(['income_statement', 'balance_sheet', 'cash_flow_indirect', 'cash_flow_direct']);
export type StatementKey = z.infer<typeof StatementKey>;
const STATEMENT_PREFIX: Record<StatementKey, string> = { income_statement: 'is_', balance_sheet: 'bs_', cash_flow_indirect: 'cf_', cash_flow_direct: 'dc_' };

/** 中英別名：只供搜尋，兩種語系都必填（可以是空陣列） */
export const LocalizedAliases = z
  .object({ 'zh-TW': z.array(z.string().min(1)), en: z.array(z.string().min(1)) })
  .strict()
  .meta({ id: 'LocalizedAliases' });
export type LocalizedAliases = z.infer<typeof LocalizedAliases>;

/** 五步驟檢查的勾稽點（04 第 13 節）：step2 稅前淨利、step3 期末現金 */
export const LineCheck = z.enum(['step2', 'step3']).meta({ id: 'LineCheck' });
export type LineCheck = z.infer<typeof LineCheck>;

/**
 * 每一步都要成立的不變式（04 第 11 節）：
 * - equals_account_activity:<科目>：等於該科目在視窗內的發生額（例如 is_cogs 對 cost_of_goods_sold）
 * - equals_line:<線 ID>：等於另一條線（例如 N29 對 L29、間接法對直接法的小計）
 * - equals_cash_change：等於現金在視窗內的淨變動
 */
export const LAYOUT_INVARIANT_RE = /^(equals_account_activity:[a-z][a-z0-9_]*|equals_line:(is|bs|cf|dc)_[a-z0-9_]+|equals_cash_change)$/;
export const LayoutInvariant = z
  .string()
  .regex(LAYOUT_INVARIANT_RE, '不變式寫成 equals_account_activity:<科目>、equals_line:<線 ID> 或 equals_cash_change')
  .meta({ id: 'LayoutInvariant' });
export type LayoutInvariant = z.infer<typeof LayoutInvariant>;

/** 盤盈列的 appliesWhen：每個政策開關列出讓這一列有值的值；省略的開關不比對 */
const sw = PolicySwitches.shape;
export const PolicyValuesWhen = z
  .object({
    orgCosts: z.array(sw.orgCosts).min(1).optional(),
    inventoryOverage: z.array(sw.inventoryOverage).min(1).optional(),
    inventoryShortage: z.array(sw.inventoryShortage).min(1).optional(),
    incomeTax: z.array(sw.incomeTax).min(1).optional(),
    interestPaidActivity: z.array(sw.interestPaidActivity).min(1).optional(),
    officeSupplies: z.array(sw.officeSupplies).min(1).optional(),
  })
  .strict()
  .meta({ id: 'PolicyValuesWhen' });
export type PolicyValuesWhen = z.infer<typeof PolicyValuesWhen>;

/** 所有列共用的欄位：cell 是老師模板的儲存格（模板沒有這一列、或 ifrs@1 版面時為 null） */
const lineBase = {
  id: LineId,
  cell: TeacherCell.nullable(),
  /** 主要顯示（依 D13 A 的網站顯示字） */
  label: LocalizedText,
  /** 教材原字或現行用語等，只供搜尋 */
  aliases: LocalizedAliases,
  termRef: idSchema('term').optional(),
  pendingRefs: z.array(PendingRef).optional(),
  flags: z.array(AccountFlag).optional(),
  /** 延伸列：模板沒有，依 showExtensionRows 決定要不要顯示 */
  extension: z.boolean().optional(),
  /** 不顯示的計算列（例如 bs_ppe_gross），只供公式與指標引用 */
  hidden: z.boolean().optional(),
};

export const LayoutLine = z
  .discriminatedUnion('kind', [
    /** 科目的餘額或視窗內發生額（損益表用 activity、資產負債表用 balance；抵銷科目依 contraOf 反號併入） */
    z.object({ ...lineBase, kind: z.literal('accounts'), accounts: z.array(SemanticId).min(1), measure: z.enum(['balance', 'activity']) }).strict(),
    /** R12 期初存貨：視窗起點的存貨餘額 */
    z.object({ ...lineBase, kind: z.literal('inventory_opening') }).strict(),
    /** R13 本期進貨：視窗內標 purchase 的存貨借方合計 */
    z.object({ ...lineBase, kind: z.literal('inventory_purchases') }).strict(),
    /** R14 期末存貨(-)：正數顯示、在小計中扣除 */
    z.object({ ...lineBase, kind: z.literal('inventory_closing'), display: z.enum(['positive_subtracted']) }).strict(),
    /** 存貨盤盈列：只在 appliesWhen 列出的政策值下有值並顯示 */
    z.object({ ...lineBase, kind: z.literal('inventory_overage'), appliesWhen: PolicyValuesWhen }).strict(),
    /** 公式列：只引用 line.*；level 是五層利益的第幾層；invariant 是每一步都要成立的檢查 */
    z
      .object({ ...lineBase, kind: z.literal('formula'), expr: Expr, level: z.number().int().min(1).max(5).optional(), invariant: LayoutInvariant.optional() })
      .strict(),
    /** 連結列：直接取另一張表的線（例如 H11 取 is_pretax_income），check 是五步驟勾稽的步驟 */
    z.object({ ...lineBase, kind: z.literal('link'), from: LineId, check: LineCheck.optional() }).strict(),
    /**
     * 營運資金列：科目在視窗內的淨變動；sign 為 change 填 ＋Δ（負債）、negate_change 填 －Δ（資產）；
     * only 讓 H15 與 H17 擇一；oppositeSignNote 表示模板沒有反向列；excludeAccounts 記錄必須排除的科目（H19）
     */
    z
      .object({
        ...lineBase,
        kind: z.literal('working_capital'),
        accounts: z.array(SemanticId).min(1),
        sign: z.enum(['change', 'negate_change']),
        only: z.enum(['increase', 'decrease']).optional(),
        oppositeSignNote: z.enum(['template_has_no_decrease_row', 'template_has_no_increase_row']).optional(),
        excludeAccounts: z.array(SemanticId).optional(),
      })
      .strict(),
    /** 非現金損益的加回或減除列：取科目在視窗內的發生額；accounts 可以是空陣列（例如 cf_noncash_gains 這種科目表還沒有對應科目的延伸列） */
    z.object({ ...lineBase, kind: z.literal('noncash_addback'), accounts: z.array(SemanticId), sign: z.enum(['add', 'subtract']) }).strict(),
    /** 由現金行標籤決定的列：Σ 帶這些 kind 的現金行（間接法的 H21、H22、投資與籌資各列；直接法各列） */
    z
      .object({
        ...lineBase,
        kind: z.literal('cash_tag'),
        activity: CashFlowActivity,
        cfKinds: z.array(CashFlowKind).min(1),
        sign: z.enum(['inflow_positive', 'outflow_negative']),
      })
      .strict(),
    /** N26 未分配盈餘：帳戶餘額加上視窗內的本期淨利（W05） */
    z.object({ ...lineBase, kind: z.literal('retained_earnings'), account: SemanticId, netIncomeLine: LineId }).strict(),
    /** 標題列：不可入帳、沒有金額；children 列出底下的線 */
    z.object({ ...lineBase, kind: z.literal('group'), children: z.array(LineId).optional() }).strict(),
    /** 期初餘額列（H40） */
    z.object({ ...lineBase, kind: z.literal('balance_begin'), account: SemanticId }).strict(),
    /** 期末餘額列（H41）：from 的線相加，並檢查等於該科目的期末餘額 */
    z.object({ ...lineBase, kind: z.literal('balance_end'), account: SemanticId, from: z.array(LineId).min(1), check: LineCheck.optional() }).strict(),
    /** 合計列：sum 列出的線相加 */
    z.object({ ...lineBase, kind: z.literal('total'), sum: z.array(LineId).min(1), invariant: LayoutInvariant.optional() }).strict(),
  ])
  .meta({ id: 'LayoutLine' });
export type LayoutLine = z.infer<typeof LayoutLine>;
export type LayoutLineKind = LayoutLine['kind'];

export const Layout = z
  .object({
    id: VersionedId,
    options: LayoutOptions,
    /** 四張表都必填（teacher@1 與 ifrs@1 都是）；文件裡的節錄用 jsonc 區塊，不經 docs:examples 驗證 */
    statements: z
      .object({
        income_statement: z.array(LayoutLine),
        balance_sheet: z.array(LayoutLine),
        cash_flow_indirect: z.array(LayoutLine),
        cash_flow_direct: z.array(LayoutLine),
      })
      .strict(),
  })
  .strict()
  .superRefine((layout, ctx) => {
    // 只做結構：線 ID 唯一、前綴符合所在的報表。link 的 from、公式引用的線是否存在，由核心的 content:compile 連同版面完整性一起檢查
    const ids = new Set<string>();
    for (const key of StatementKey.options) {
      layout.statements[key].forEach((line, i) => {
        if (!line.id.startsWith(STATEMENT_PREFIX[key])) {
          ctx.addIssue({ code: 'custom', path: ['statements', key, i, 'id'], message: `${key} 的線 ID 要以 ${STATEMENT_PREFIX[key]} 開頭` });
        }
        if (ids.has(line.id)) ctx.addIssue({ code: 'custom', path: ['statements', key, i, 'id'], message: `線 ID 重複：${line.id}` });
        ids.add(line.id);
      });
    }
  });
export type Layout = z.infer<typeof Layout>;
