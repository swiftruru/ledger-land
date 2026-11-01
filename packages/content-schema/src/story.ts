// Story 故事與步驟（04 第 9.1 節、08 第 3.9 節）：連續故事為主線，每一步可有多個事件依序過帳
import { z } from 'zod';
import { EventId, LINE_ID_RE, LocalizedText, Managed, Markup, Money, Name, PendingRef, SemanticId, TemplateId, idSchema } from './common.ts';
import { Target, refineEventIds, refineTargets } from './scenario.ts';

export const StoryEvent = z
  .object({ id: EventId, template: TemplateId, params: z.record(Name, z.number()), pendingRefs: z.array(PendingRef).optional() })
  .strict();
export type StoryEvent = z.infer<typeof StoryEvent>;

/** 黃金測試的期望值：ref 是推導值（e1.amount）或線 ID（cf_depreciation） */
export const Checkpoint = z
  .object({
    ref: z.string().refine((s) => /^e[1-9]\d*\.[a-z][A-Za-z0-9_]*$/.test(s) || LINE_ID_RE.test(s), 'checkpoint 的 ref 是「事件 ID.推導值」或線 ID'),
    value: z.number(),
  })
  .strict();
export type Checkpoint = z.infer<typeof Checkpoint>;

export const ChapterLink = z.object({ chapter: idSchema('chapter'), level: idSchema('level').optional() }).strict();
export const Stakeholder = z.object({ role: z.string().regex(/^[a-z][a-z0-9_]*$/), positive: Markup, negative: Markup, advice: Markup }).strict();
export const Verification = z.enum(['excel_verified', 'inferred']);

export const StoryStep = z
  .object({
    id: idSchema('step'),
    order: z.number().int().min(1),
    title: LocalizedText,
    narrative: Markup,
    events: z.array(StoryEvent).min(1),
    termRefs: z.array(idSchema('term')),
    chapterLinks: z.array(ChapterLink).optional(),
    checkpoints: z.array(Checkpoint).optional(),
    /** 08 第 3.9 節建議的欄位：預測面板的目標（畫面固定提供現金與五層利益，這裡列另外加的）、利害關係人卡、本機驗證結果 */
    predictTargets: z.array(Target).optional(),
    stakeholders: z.array(Stakeholder).optional(),
    verification: Verification.optional(),
    /** 階段 10 的管理意涵（03 第 3.3 節；M4a 2026-11-01 加）：每一步一段原創說明；沒有時實驗室只顯示利害關係人卡 */
    insight: Markup.optional(),
  })
  .strict()
  .superRefine((s, ctx) => {
    refineEventIds(s.events, ctx, ['events']);
    if (s.predictTargets) refineTargets(s.predictTargets, ctx, ['predictTargets']);
    const eventIds = new Set(s.events.map((e) => e.id));
    (s.checkpoints ?? []).forEach((c, i) => {
      const ev = c.ref.split('.')[0]!;
      if (c.ref.includes('.') && !eventIds.has(ev))
        ctx.addIssue({ code: 'custom', path: ['checkpoints', i, 'ref'], message: `checkpoint 引用不存在的事件 ${ev}` });
    });
  })
  .meta({ id: 'StoryStep' });
export type StoryStep = z.infer<typeof StoryStep>;

export const StoryOrigin = z.enum(['teacher', 'original']);

/** 故事的章（03 第 3.2 節；M4a 2026-11-01 加）：id 只需在故事內唯一（c1、c2），stepIds 依順序列出該章的步驟 */
export const StoryChapter = z.object({ id: z.string().regex(/^c[1-9]\d*$/), title: LocalizedText, stepIds: z.array(idSchema('step')).min(1) }).strict();
export type StoryChapter = z.infer<typeof StoryChapter>;

export const Story = Managed.extend({
  id: idSchema('story'),
  title: LocalizedText,
  origin: StoryOrigin,
  company: z.object({ name: LocalizedText }).strict(),
  ledger: z.object({ currency: z.literal('TWD'), scale: z.literal(0) }).strict(),
  opening: z.record(SemanticId, Money).optional(),
  policy: z.literal('teacher@1'),
  layout: z.literal('teacher@1'),
  /** 五章的分組（選填）：有時每一步恰好屬於一章，章內的步驟依 order 遞增 */
  chapters: z.array(StoryChapter).optional(),
  steps: z.array(StoryStep).min(1),
})
  .strict()
  .superRefine((story, ctx) => {
    const orders = new Set<number>();
    const stepIds = new Set<string>();
    story.steps.forEach((s, i) => {
      if (orders.has(s.order)) ctx.addIssue({ code: 'custom', path: ['steps', i, 'order'], message: `步驟的 order 重複：${s.order}` });
      orders.add(s.order);
      if (stepIds.has(s.id)) ctx.addIssue({ code: 'custom', path: ['steps', i, 'id'], message: `步驟 ID 重複：${s.id}` });
      stepIds.add(s.id);
      if (story.origin === 'teacher' && s.checkpoints) {
        ctx.addIssue({ code: 'custom', path: ['steps', i, 'checkpoints'], message: 'origin 為 teacher 的正式故事不填 checkpoints（D2，CI 只跑性質測試）' });
      }
      if (story.origin !== 'teacher' && s.verification) {
        ctx.addIssue({ code: 'custom', path: ['steps', i, 'verification'], message: 'verification 只用在 origin 為 teacher 的正式故事' });
      }
    });
    if (story.chapters) {
      const owner = new Map<string, string>();
      const chapterIds = new Set<string>();
      story.chapters.forEach((c, i) => {
        if (chapterIds.has(c.id)) ctx.addIssue({ code: 'custom', path: ['chapters', i, 'id'], message: `章的 ID 重複：${c.id}` });
        chapterIds.add(c.id);
        c.stepIds.forEach((id, j) => {
          if (!stepIds.has(id)) ctx.addIssue({ code: 'custom', path: ['chapters', i, 'stepIds', j], message: `章 ${c.id} 引用不存在的步驟 ${id}` });
          if (owner.has(id))
            ctx.addIssue({ code: 'custom', path: ['chapters', i, 'stepIds', j], message: `步驟 ${id} 同時屬於章 ${owner.get(id)} 與 ${c.id}` });
          owner.set(id, c.id);
        });
      });
      story.steps.forEach((s, i) => {
        if (!owner.has(s.id))
          ctx.addIssue({ code: 'custom', path: ['steps', i, 'id'], message: `步驟 ${s.id} 不屬於任何一章（有 chapters 時每一步都要分章）` });
      });
      // 章內的步驟依 order 遞增，章與章之間也依序
      const orderOf = new Map(story.steps.map((s) => [s.id, s.order]));
      const flat = story.chapters.flatMap((c) => c.stepIds).map((id) => orderOf.get(id) ?? -1);
      for (let k = 1; k < flat.length; k++)
        if (flat[k]! <= flat[k - 1]!) {
          ctx.addIssue({ code: 'custom', path: ['chapters'], message: '章的步驟順序要和 order 一致（章內遞增、章與章之間也依序）' });
          break;
        }
    }
  });
export type Story = z.infer<typeof Story>;
