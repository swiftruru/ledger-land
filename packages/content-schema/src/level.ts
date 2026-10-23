// Level 關卡（08 第 3.5 節）：一關一檔 content/levels/<levelId>.json。題數規則（5 到 8 題計分題，另可附至多 1 題 judgment）
// 需要題目資料，所以放在 validate.ts，只對 published 的關卡強制；草稿可以先空著 questionIds。
import { z } from 'zod';
import { LocalizedText, Managed, idSchema } from './common.ts';

export const LEVEL_MIN_SCORED = 5;
export const LEVEL_MAX_SCORED = 8;
export const LEVEL_MAX_JUDGMENT = 1;

export const Level = Managed.extend({
  id: idSchema('level'),
  chapterId: idSchema('chapter'),
  order: z.number().int().min(1),
  title: LocalizedText,
  objectiveIds: z.array(idSchema('objective')).optional(),
  /** 作答時依此順序出題，選項另外打散（03 第 2.8 節） */
  questionIds: z.array(idSchema('question')),
  timerSeconds: z.number().int().min(1).max(3600).optional(),
})
  .strict()
  .superRefine((l, ctx) => {
    if (new Set(l.questionIds).size !== l.questionIds.length) ctx.addIssue({ code: 'custom', path: ['questionIds'], message: 'questionIds 不得重複' });
    if (l.objectiveIds && new Set(l.objectiveIds).size !== l.objectiveIds.length)
      ctx.addIssue({ code: 'custom', path: ['objectiveIds'], message: 'objectiveIds 不得重複' });
  });
export type Level = z.infer<typeof Level>;
