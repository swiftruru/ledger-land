// Chapter 章節（08 第 3.3 節）的最小 schema（M0b）
import { z } from 'zod';
import { LocalizedText, Managed, Markup, idSchema } from './common.ts';

export const ChapterScope = z.enum(['core', 'extension']);
export const ExamScope = z.enum(['midterm', 'not_in_exam', 'unconfirmed']);

export const Chapter = Managed.extend({
  id: idSchema('chapter'),
  order: z.number().int().min(1),
  scope: ChapterScope,
  examScope: ExamScope,
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
}).strict();
export type Chapter = z.infer<typeof Chapter>;
