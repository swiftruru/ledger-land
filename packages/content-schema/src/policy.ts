// 認列政策（04 第 10.1 節）：開關決定記哪些科目、金額多少、現金行屬於哪個活動；M1 只實作 teacher@1
import { z } from 'zod';
import { SemanticId, VersionedId } from './common.ts';

export const PolicySwitches = z
  .object({
    orgCosts: z.enum(['capitalise_amortise', 'expense']),
    inventoryOverage: z.enum(['reduce_cogs', 'non_operating_income', 'extraordinary_gain']),
    inventoryShortage: z.enum(['increase_cogs']),
    incomeTax: z.enum(['cash_direct', 'accrue_then_pay']),
    interestPaidActivity: z.enum(['operating', 'financing']),
    officeSupplies: z.enum(['expense_on_purchase', 'asset_then_expense']),
  })
  .strict()
  .meta({ id: 'PolicySwitches' });
export type PolicySwitches = z.infer<typeof PolicySwitches>;

/** 範本分錄行的 policyWhen：只列出要比對的開關 */
export const PolicyWhen = PolicySwitches.partial().strict().meta({ id: 'PolicyWhen' });
export type PolicyWhen = z.infer<typeof PolicyWhen>;

/** 政策 ID 的格式（名稱加 @ 加版號）；已實作的政策只有 teacher@1 與 ifrs@1（M4b） */
export const PolicyId = VersionedId;
export const KNOWN_POLICY_IDS = ['teacher@1', 'ifrs@1'] as const;

export const PolicyDefinition = z
  .object({
    id: z.enum(KNOWN_POLICY_IDS),
    switches: PolicySwitches,
    /** 選填：明確列出啟用的科目；省略時以科目表的 enabledByDefault 為準 */
    enabledAccounts: z.array(SemanticId).optional(),
    /** 這套政策停用的科目，過帳引用時回傳 entry.account_disabled */
    disabledAccounts: z.array(SemanticId),
  })
  .strict()
  .superRefine((p, ctx) => {
    const disabled = new Set(p.disabledAccounts);
    if (disabled.size !== p.disabledAccounts.length) ctx.addIssue({ code: 'custom', path: ['disabledAccounts'], message: '停用科目重複' });
    for (const a of p.enabledAccounts ?? [])
      if (disabled.has(a)) ctx.addIssue({ code: 'custom', path: ['enabledAccounts'], message: `科目 ${a} 同時列在啟用與停用` });
  });
export type PolicyDefinition = z.infer<typeof PolicyDefinition>;
