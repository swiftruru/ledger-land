// Account 科目（04 第 4.1 節）：科目表的每一列；labels 與名詞的一致性由 content:compile 逐欄比對，不在這裡
import { z } from 'zod';
import { LocalizedText, PendingRef, SemanticId, idSchema } from './common.ts';

export const Element = z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']);
export type Element = z.infer<typeof Element>;
export const Section = z.enum([
  'current_asset',
  'noncurrent_asset',
  'deferred_asset',
  'current_liability',
  'noncurrent_liability',
  'equity',
  'retained_earnings_group',
  'operating_revenue',
  'non_operating_income',
  'extraordinary_gain',
  'cost_of_sales',
  'sga_expense',
  'non_operating_expense',
  'extraordinary_loss',
  'income_tax',
]);
export type Section = z.infer<typeof Section>;
export const AccountFlag = z
  .enum(['japanese', 'old_name', 'typo_fixed', 'unused', 'not_ifrs_line', 'ifrs_treatment_differs', 'not_in_template', 'extension'])
  .meta({ id: 'AccountFlag' });
export type AccountFlag = z.infer<typeof AccountFlag>;
export const Side = z.enum(['debit', 'credit']).meta({ id: 'Side' });
export type Side = z.infer<typeof Side>;
export const CashFlowActivity = z.enum(['operating', 'investing', 'financing']).meta({ id: 'CashFlowActivity' });
export type CashFlowActivity = z.infer<typeof CashFlowActivity>;

/** 間接法的歸列規則（04 第 11.3 節的四類）：snake_case 的規則名，可帶冒號加參數，例如 via_cash_tag、working_capital:cf_inventory_increase */
export const IndirectRule = z.string().regex(/^[a-z][a-z0-9_]*(:[a-z][a-z0-9_]*)?$/, '間接法規則是 snake_case 名稱，可帶冒號加參數');

/** 老師模板的儲存格，例如 L24 */
export const TeacherCell = z
  .string()
  .regex(/^[A-Z]{1,2}\d{1,3}$/, '儲存格寫成欄字母加列號，例如 L24')
  .meta({ id: 'TeacherCell' });

export const Account = z
  .object({
    id: SemanticId,
    order: z.number().int().min(0),
    element: Element,
    section: Section,
    normalSide: Side,
    current: z.boolean().nullable(),
    contraOf: SemanticId.nullable(),
    allowNegative: z.boolean(),
    enabledByDefault: z.boolean(),
    teacherCell: TeacherCell.nullable(),
    labels: z
      .object({
        teacher: z.object({ 'zh-TW': z.string().min(1), en: z.string().min(1) }).strict(),
        currentTw: z.string().min(1).nullable(),
        ifrsEn: z.string().min(1).nullable(),
        aliases: z.object({ 'zh-TW': z.array(z.string().min(1)), en: z.array(z.string().min(1)) }).strict(),
      })
      .strict(),
    termRef: idSchema('term'),
    flags: z.array(AccountFlag),
    ifrsTreatment: z.object({ note: LocalizedText, amountImpact: LocalizedText }).strict().nullable(),
    cashFlow: z.object({ indirect: IndirectRule, defaultActivity: CashFlowActivity.nullable() }).strict(),
    pendingRefs: z.array(PendingRef),
  })
  .strict()
  .superRefine((a, ctx) => {
    if (a.flags.includes('ifrs_treatment_differs') && a.ifrsTreatment === null) {
      ctx.addIssue({ code: 'custom', path: ['ifrsTreatment'], message: '旗標含 ifrs_treatment_differs 時必須填 ifrsTreatment' });
    }
    const isBalanceSheet = a.element === 'asset' || a.element === 'liability';
    if (isBalanceSheet && a.current === null) ctx.addIssue({ code: 'custom', path: ['current'], message: '資產與負債科目的 current 必須是 true 或 false' });
    if (!isBalanceSheet && a.current !== null) ctx.addIssue({ code: 'custom', path: ['current'], message: '權益與損益科目的 current 必須是 null' });
    if (a.contraOf === a.id) ctx.addIssue({ code: 'custom', path: ['contraOf'], message: '抵銷科目不能指向自己' });
  });
export type Account = z.infer<typeof Account>;
