// Objective 學習目標（08 第 1.2、3.4 節）：一章一檔 content/objectives/<chapterId>.json，檔案形狀是 { chapterId, items: Objective[] }。
// 每個目標各自帶管理欄位（rev、status），lock 以目標為單位。迷思 ID（mc_ 加 4 碼）只需在該目標內唯一，干擾選項以 misconceptionId 引用。
import { z } from 'zod';
import { LocalizedText, Managed, PendingRef, idSchema } from './common.ts';
import { QuestionType } from './question.ts';

export const Skill = z.enum(['identify', 'classify', 'compute', 'interpret', 'judge']);
export type Skill = z.infer<typeof Skill>;

export const Misconception = z
  .object({ id: idSchema('misconception'), text: LocalizedText })
  .strict()
  .meta({ id: 'Misconception' });
export type Misconception = z.infer<typeof Misconception>;

export const LabRef = z
  .object({ story: idSchema('story'), step: idSchema('step') })
  .strict()
  .meta({ id: 'LabRef' });
export type LabRef = z.infer<typeof LabRef>;

export const Objective = Managed.extend({
  id: idSchema('objective'),
  chapterId: idSchema('chapter'),
  order: z.number().int().min(1),
  statement: LocalizedText,
  skill: Skill,
  misconceptions: z.array(Misconception).optional(),
  plannedQuestions: z.number().int().min(0),
  suggestedTypes: z.array(QuestionType).optional(),
  termRefs: z.array(idSchema('term')).optional(),
  labRefs: z.array(LabRef).optional(),
  pendingRefs: z.array(PendingRef).optional(),
})
  .strict()
  .superRefine((o, ctx) => {
    const seen = new Set<string>();
    (o.misconceptions ?? []).forEach((m, i) => {
      if (seen.has(m.id)) ctx.addIssue({ code: 'custom', path: ['misconceptions', i, 'id'], message: `迷思 ID 重複：${m.id}` });
      seen.add(m.id);
    });
    if (o.suggestedTypes && new Set(o.suggestedTypes).size !== o.suggestedTypes.length)
      ctx.addIssue({ code: 'custom', path: ['suggestedTypes'], message: 'suggestedTypes 不得重複' });
  });
export type Objective = z.infer<typeof Objective>;

/** 一章一檔的檔案形狀：chapterId 與每個目標的 chapterId 相同；ID 與 order 在檔內不重複 */
export const ObjectiveFile = z
  .object({ chapterId: idSchema('chapter'), items: z.array(Objective) })
  .strict()
  .superRefine((f, ctx) => {
    const ids = new Set<string>();
    const orders = new Set<number>();
    f.items.forEach((o, i) => {
      if (o.chapterId !== f.chapterId)
        ctx.addIssue({ code: 'custom', path: ['items', i, 'chapterId'], message: `目標的 chapterId ${o.chapterId} 與檔案的 ${f.chapterId} 不同` });
      if (ids.has(o.id)) ctx.addIssue({ code: 'custom', path: ['items', i, 'id'], message: `學習目標 ID 重複：${o.id}` });
      ids.add(o.id);
      if (orders.has(o.order)) ctx.addIssue({ code: 'custom', path: ['items', i, 'order'], message: `學習目標的 order 重複：${o.order}` });
      orders.add(o.order);
    });
  });
export type ObjectiveFile = z.infer<typeof ObjectiveFile>;
