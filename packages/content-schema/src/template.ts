// TransactionTemplate 交易範本（04 第 7 節、08 第 3.8 節）。schema 只做結構：名稱唯一、ID 格式、欄位形狀；
// 運算式解析、derived 只能引用前面的 derived、借貸平衡、現金行的 cf 等語意規則由核心的 content:compile 檢查。
import { z } from 'zod';
import { CashFlowActivity, Side } from './account.ts';
import { LocalizedText, Managed, Markup, Name, PendingRef, SemanticId, TemplateId, idSchema } from './common.ts';
import { Expr } from './expr.ts';
import { PolicyWhen } from './policy.ts';

export const CashFlowKind = z
  .enum([
    'receipts_from_customers',
    'payments_to_suppliers',
    'payments_for_operating_expenses',
    'interest_paid',
    'income_tax_paid',
    'other_operating_receipts',
    'capex',
    'loans_advanced',
    'loans_collected',
    'other_investing_payments',
    'disposal_proceeds',
    'st_borrowing_proceeds',
    'st_borrowing_repayment',
    'lt_borrowing_proceeds',
    'lt_borrowing_repayment',
    'share_issue',
    'dividends_paid',
  ])
  .meta({ id: 'CashFlowKind' });
export type CashFlowKind = z.infer<typeof CashFlowKind>;
export const CashFlowTag = z.object({ activity: CashFlowActivity, kind: CashFlowKind }).strict().meta({ id: 'CashFlowTag' });
export type CashFlowTag = z.infer<typeof CashFlowTag>;
export const InventoryTag = z.enum(['purchase', 'cost_of_sale', 'count_overage', 'count_shortage']);
export type InventoryTag = z.infer<typeof InventoryTag>;
export const LineTag = z.enum([...InventoryTag.options, 'dividend', 'reserve_appropriation']);
export type LineTag = z.infer<typeof LineTag>;

export const ParamSpec = z
  .object({
    name: Name,
    type: z.enum(['money', 'count', 'rate', 'years']),
    min: z.number(),
    max: z.number(),
    default: z.number(),
    label: LocalizedText,
    monotonic: z.enum(['increasing', 'decreasing', 'none']).optional(),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.min > p.max) ctx.addIssue({ code: 'custom', path: ['max'], message: 'max 不能小於 min' });
    if (p.default < p.min || p.default > p.max) ctx.addIssue({ code: 'custom', path: ['default'], message: 'default 必須在 min 與 max 之間' });
  });
export type ParamSpec = z.infer<typeof ParamSpec>;

export const DerivedSpec = z.object({ name: Name, type: z.enum(['money', 'number']), expr: Expr, label: LocalizedText }).strict();
export type DerivedSpec = z.infer<typeof DerivedSpec>;

export const Precondition = z.object({ id: SemanticId, expr: Expr, message: LocalizedText }).strict();
export type Precondition = z.infer<typeof Precondition>;

/** 範本行 ID：l 加流水號 */
export const LineSpecId = z.string().regex(/^l[1-9]\d*$/, '範本行 ID 寫成 l1、l2');

export const LineSpec = z
  .object({
    id: LineSpecId,
    account: SemanticId,
    side: Side,
    amount: Expr,
    cf: CashFlowTag.optional(),
    tag: LineTag.optional(),
    policyWhen: PolicyWhen.optional(),
    memo: LocalizedText.optional(),
  })
  .strict()
  .meta({ id: 'LineSpec' });
export type LineSpec = z.infer<typeof LineSpec>;

function uniqueNames(items: { name: string }[], ctx: z.RefinementCtx, field: string) {
  const seen = new Set<string>();
  items.forEach((it, i) => {
    if (seen.has(it.name)) ctx.addIssue({ code: 'custom', path: [field, i, 'name'], message: `${field} 的名稱重複：${it.name}` });
    seen.add(it.name);
  });
}

export const TransactionTemplate = Managed.extend({
  id: TemplateId,
  title: LocalizedText,
  summary: Markup,
  params: z.array(ParamSpec),
  derived: z.array(DerivedSpec),
  preconditions: z.array(Precondition),
  lines: z.array(LineSpec).min(1),
  explanation: Markup,
  termRefs: z.array(idSchema('term')),
  pendingRefs: z.array(PendingRef).optional(),
  entryQuestionBlockedBy: z.array(PendingRef).optional(),
})
  .strict()
  .superRefine((t, ctx) => {
    uniqueNames(t.params, ctx, 'params');
    uniqueNames(t.derived, ctx, 'derived');
    const paramNames = new Set(t.params.map((p) => p.name));
    t.derived.forEach((d, i) => {
      if (paramNames.has(d.name)) ctx.addIssue({ code: 'custom', path: ['derived', i, 'name'], message: `推導值與參數同名：${d.name}` });
    });
    const lineIds = new Set<string>();
    t.lines.forEach((l, i) => {
      if (lineIds.has(l.id)) ctx.addIssue({ code: 'custom', path: ['lines', i, 'id'], message: `範本行 ID 重複：${l.id}` });
      lineIds.add(l.id);
    });
    const preIds = new Set<string>();
    t.preconditions.forEach((p, i) => {
      if (preIds.has(p.id)) ctx.addIssue({ code: 'custom', path: ['preconditions', i, 'id'], message: `前置條件 ID 重複：${p.id}` });
      preIds.add(p.id);
    });
  });
export type TransactionTemplate = z.infer<typeof TransactionTemplate>;
