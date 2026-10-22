// Term 名詞（08 第 3.7 節）的最小 schema（M0b）；完整型別以 04 第 16.3 節為準，M1 起補齊
import { z } from 'zod';
import { LocalizedText, Managed, Markup, idSchema } from './common.ts';

export const TermCategory = z.enum(['statement', 'account', 'ratio', 'concept', 'process', 'other']);
export const TermFlag = z.enum(['japanese', 'old_name', 'typo_fixed', 'unused', 'not_ifrs_line', 'ifrs_treatment_differs', 'simplified']);
export const Confidence = z.enum(['high', 'medium', 'pending']);

export const Term = Managed.extend({
  id: idSchema('term'),
  category: TermCategory,
  label: LocalizedText,
  teacherLabel: z.string().min(1),
  currentTwLabel: z.string().min(1).nullable(),
  ifrsEnglish: z.string().min(1).nullable(),
  aliases: z.object({ 'zh-TW': z.array(z.string()), en: z.array(z.string()) }).strict(),
  enUsVariant: z.string().optional(),
  flags: z.array(TermFlag),
  confidence: Confidence,
  pendingRefs: z.array(z.string().regex(/^T\d{2}$/)),
  ifrsBasis: z.string().optional(),
  note: LocalizedText.optional(),
  definition: Markup,
  example: Markup.optional(),
  misconception: Markup.optional(),
  formula: Markup.optional(),
  ifrsNote: Markup.optional(),
  accountRef: z.string().optional(),
  ratioRef: z.string().optional(),
  related: z.array(idSchema('term')).optional(),
  labRefs: z.array(z.object({ story: idSchema('story'), step: idSchema('step') }).strict()).optional(),
  unlock: z
    .object({ levelId: idSchema('level') })
    .strict()
    .optional(),
})
  .strict()
  .superRefine((t, ctx) => {
    if (t.confidence === 'pending' && t.pendingRefs.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['pendingRefs'], message: 'confidence 為 pending 時至少要有一個 T 系列編號' });
    }
    const needsIfrsNote = t.ifrsEnglish === null || t.flags.includes('not_ifrs_line') || t.flags.includes('ifrs_treatment_differs');
    if (needsIfrsNote && !t.ifrsNote) {
      ctx.addIssue({ code: 'custom', path: ['ifrsNote'], message: 'ifrsEnglish 為 null 或旗標含 not_ifrs_line、ifrs_treatment_differs 時必須有 ifrsNote' });
    }
  });
export type Term = z.infer<typeof Term>;
