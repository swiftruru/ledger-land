// 財務指標登錄檔（04 第 12.1 節）：一個指標、多個版本；公式是受控運算式（指標情境），求值與 N/A 判定在核心
import { z } from 'zod';
import { LocalizedText, PendingRef, RATIO_VERSIONS, RatioRef, SemanticId, idSchema } from './common.ts';
import { Expr } from './expr.ts';

export { RatioRef };

export const RatioUnit = z.enum(['percent', 'turnover', 'days', 'multiple', 'currency_per_share', 'currency']).meta({ id: 'RatioUnit' });
export type RatioUnit = z.infer<typeof RatioUnit>;
export const RatioVersionName = z.enum(RATIO_VERSIONS);
export type RatioVersionName = z.infer<typeof RatioVersionName>;
export const RatioCategory = z.enum([
  'financial_structure',
  'solvency',
  'activity',
  'profitability',
  'cash_flow',
  'leverage',
  'dupont',
  'department',
  'market',
  'income_structure',
]);
export const RatioStatus = z.enum(['ok', 'zero', 'na', 'not_meaningful']);
export type RatioStatus = z.infer<typeof RatioStatus>;

export const RatioVersion = z
  .object({
    numerator: Expr.optional(),
    denominator: Expr.optional(),
    expr: Expr.optional(),
    unit: RatioUnit,
    displayDecimals: z.number().int().min(0).max(6),
    excel: z
      .object({ cell: z.string().min(1), formula: z.string().min(1), format: z.string().min(1), iferror: z.string() })
      .strict()
      .optional(),
    naWhen: z.array(z.enum(['denominator_zero', 'chained_source_na_or_zero', 'chained_source_na', 'missing_input'])),
    notMeaningfulWhen: z.array(z.enum(['denominator_negative', 'base_not_positive'])),
    notMeaningfulBase: Expr.optional(),
    flags: z.array(z.enum(['end_of_period_balance', 'single_period_approx', 'excel_approximation', 'website_fix', 'website_definition'])),
    inputs: z
      .record(
        z.string().regex(/^[a-z][a-z0-9_]*$/),
        z.object({ default: z.number().nullable(), label: LocalizedText, pendingRefs: z.array(PendingRef).optional() }).strict(),
      )
      .optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const fraction = v.numerator !== undefined || v.denominator !== undefined;
    if (fraction && (v.numerator === undefined || v.denominator === undefined)) {
      ctx.addIssue({ code: 'custom', path: ['denominator'], message: 'numerator 與 denominator 要一起填' });
    }
    if (fraction === (v.expr !== undefined)) {
      ctx.addIssue({ code: 'custom', path: ['expr'], message: '分數形式（numerator 加 denominator）與 expr 二選一' });
    }
    if (v.notMeaningfulWhen.includes('base_not_positive') && !v.notMeaningfulBase) {
      ctx.addIssue({ code: 'custom', path: ['notMeaningfulBase'], message: 'notMeaningfulWhen 含 base_not_positive 時必須填 notMeaningfulBase' });
    }
  })
  .meta({ id: 'RatioVersion' });
export type RatioVersion = z.infer<typeof RatioVersion>;

const versionsShape = Object.fromEntries(RATIO_VERSIONS.map((v) => [v, RatioVersion.optional()])) as Record<
  RatioVersionName,
  z.ZodOptional<typeof RatioVersion>
>;

export const RatioDefinition = z
  .object({
    id: SemanticId,
    termRef: idSchema('term'),
    category: RatioCategory,
    framework: z.enum(['input', 'transform', 'output']).nullable(),
    versions: z.object(versionsShape).strict(),
    pendingRefs: z.array(PendingRef),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (Object.keys(r.versions).length === 0) ctx.addIssue({ code: 'custom', path: ['versions'], message: '至少要有一個版本' });
  });
export type RatioDefinition = z.infer<typeof RatioDefinition>;
