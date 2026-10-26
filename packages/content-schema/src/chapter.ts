// Chapter 章節（08 第 3.3 節）。單筆就能判斷的一致性放在這裡（延伸章一律不在期中考範圍、kind: journal 只能是延伸章）；
// 要看狀態或全站的規則（已發布章節不得 unconfirmed、全站只有一章 kind: journal、journal_entry 只能放在這一章）在 validate.ts。
import { z } from 'zod';
import { LocalizedText, Managed, Markup, idSchema } from './common.ts';

export const ChapterScope = z.enum(['core', 'extension']);
/** 期中考範圍（T32 已決定，2026-10-23）：主線章節 midterm、延伸章 not_in_exam；unconfirmed 只給還沒決定的草稿，M3 起已發布章節不得使用 */
export const ExamScope = z.enum(['midterm', 'not_in_exam', 'unconfirmed']);
/** 延伸章的種類：journal 是「借貸與分錄」延伸章（E04，D1），全站只有一章，journal_entry 只能放在這一章（08 第 5.5 節 ans.journalScope） */
export const ChapterKind = z.enum(['journal']);
export type ChapterKind = z.infer<typeof ChapterKind>;
/** 章節層級的固定聲明（11 第 1 節、2026-10-24 決定 4）：not_investment_advice 是涉及投資的延伸章（本益比與估價、融資與資本公積）的「非投資建議」聲明。
 *  內容在章節檔標記，快照的章節檔、章節索引與 manifest 的章節摘要都帶這個欄位，介面從快照讀，不在前端寫死章節清單 */
export const ChapterNotice = z.enum(['not_investment_advice']);
export type ChapterNotice = z.infer<typeof ChapterNotice>;

export const Chapter = Managed.extend({
  id: idSchema('chapter'),
  order: z.number().int().min(1),
  scope: ChapterScope,
  examScope: ExamScope,
  kind: ChapterKind.optional(),
  notices: z
    .array(ChapterNotice)
    .min(1)
    .refine((xs) => new Set(xs).size === xs.length, '同一個聲明只能列一次')
    .optional(),
  title: LocalizedText,
  summary: Markup,
  objectiveIds: z.array(idSchema('objective')),
  levelIds: z.array(idSchema('level')),
  prerequisites: z.array(idSchema('chapter')).optional(),
  badge: z
    .object({ icon: z.string().min(1), title: LocalizedText })
    .strict()
    .optional(),
  chapterEndLinks: z.array(z.object({ kind: z.literal('lab'), story: idSchema('story'), step: idSchema('step') }).strict()).optional(),
  /** M0b 的最小 schema：名詞的引用（08 第 5.3 節的引用檢查用） */
  termRefs: z.array(idSchema('term')).optional(),
})
  .strict()
  .superRefine((c, ctx) => {
    if (c.scope === 'extension' && c.examScope !== 'not_in_exam')
      ctx.addIssue({ code: 'custom', path: ['examScope'], message: `延伸章（scope: extension）的 examScope 一律是 not_in_exam，現在是 ${c.examScope}（T32）` });
    if (c.kind === 'journal' && c.scope !== 'extension')
      ctx.addIssue({ code: 'custom', path: ['kind'], message: '「借貸與分錄」章（kind: journal）必須是延伸章（scope: extension，D1）' });
  });
export type Chapter = z.infer<typeof Chapter>;
