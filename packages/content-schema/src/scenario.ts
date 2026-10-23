// 計算型題目共用的 scenario（04 第 15.1 節、08 第 3.6 節）：期初、事件、政策、版面、視窗與 targets。
// 線是否存在於版面、期初是否平衡、方向是否有歧義等會計語意由核心檢查。
import { z } from 'zod';
import { EventId, LineId, Money, Name, RatioRef, SemanticId, TargetId, TemplateId, idSchema } from './common.ts';
import { RatioStatus } from './ratio.ts';

export const Measure = z.enum(['direction', 'delta', 'value', 'status']);
export type Measure = z.infer<typeof Measure>;
const PlainMeasure = z.enum(['direction', 'delta', 'value']);
export const Direction = z.enum(['up', 'down', 'unchanged', 'becomes_computable', 'becomes_na']).meta({ id: 'Direction' });
export type Direction = z.infer<typeof Direction>;

export const Target = z
  .discriminatedUnion('kind', [
    z.object({ id: TargetId, kind: z.literal('line'), line: LineId, measure: PlainMeasure }).strict(),
    z.object({ id: TargetId, kind: z.literal('account'), account: SemanticId, measure: PlainMeasure }).strict(),
    z.object({ id: TargetId, kind: z.literal('ratio'), ratioRef: RatioRef, measure: Measure }).strict(),
    z
      .object({ id: TargetId, kind: z.literal('check'), step: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]), measure: z.literal('value') })
      .strict(),
  ])
  .meta({ id: 'Target' });
export type Target = z.infer<typeof Target>;

/** target 指向的對象，用來擋「兩個 target 指同一個線、科目或指標」 */
function targetSubject(t: Target): string {
  switch (t.kind) {
    case 'line':
      return `line:${t.line}`;
    case 'account':
      return `account:${t.account}`;
    case 'ratio':
      return `ratio:${t.ratioRef}`;
    case 'check':
      return `check:${t.step}`;
  }
}

/** targets 的共同規則（04 第 15.1 節）：ID 唯一、不得兩個 target 指同一個對象。Scenario 與故事步驟的 predictTargets 共用 */
export function refineTargets(targets: Target[], ctx: z.RefinementCtx, path: (string | number)[]): void {
  const ids = new Set<string>();
  const subjects = new Set<string>();
  targets.forEach((t, i) => {
    if (ids.has(t.id)) ctx.addIssue({ code: 'custom', path: [...path, i, 'id'], message: `target ID 重複：${t.id}` });
    ids.add(t.id);
    const s = targetSubject(t);
    if (subjects.has(s)) ctx.addIssue({ code: 'custom', path: [...path, i], message: `兩個 target 指向同一個對象：${s}` });
    subjects.add(s);
  });
}

export function refineEventIds(events: { id: string }[], ctx: z.RefinementCtx, path: (string | number)[]): void {
  const ids = new Set<string>();
  events.forEach((e, i) => {
    if (ids.has(e.id)) ctx.addIssue({ code: 'custom', path: [...path, i, 'id'], message: `事件 ID 重複：${e.id}` });
    ids.add(e.id);
  });
}

export const ScenarioEvent = z
  .object({ id: EventId, template: TemplateId, params: z.record(Name, z.number()) })
  .strict()
  .meta({ id: 'ScenarioEvent' });
export type ScenarioEvent = z.infer<typeof ScenarioEvent>;

export const TargetAnswer = z
  .object({
    direction: Direction.optional(),
    before: z.number().nullable().optional(),
    after: z.number().nullable().optional(),
    delta: z.number().optional(),
    status: RatioStatus.optional(),
  })
  .strict();
export type TargetAnswer = z.infer<typeof TargetAnswer>;

export const ScenarioOpening = z.union([
  z.object({ storyRef: idSchema('story'), afterStep: idSchema('step') }).strict(),
  z.object({ balances: z.record(SemanticId, Money) }).strict(),
]);
export type ScenarioOpening = z.infer<typeof ScenarioOpening>;

export const Scenario = z
  .object({
    opening: ScenarioOpening,
    events: z.array(ScenarioEvent),
    policy: z.literal('teacher@1'),
    layout: z.literal('teacher@1'),
    window: z.enum(['cumulative', 'transaction']),
    targets: z.array(Target),
    expected: z.record(z.string(), TargetAnswer).optional(),
  })
  .strict()
  .superRefine((s, ctx) => {
    refineEventIds(s.events, ctx, ['events']);
    refineTargets(s.targets, ctx, ['targets']);
    if (s.expected) {
      const ids = new Set(s.targets.map((t) => t.id));
      for (const k of Object.keys(s.expected))
        if (!ids.has(k)) ctx.addIssue({ code: 'custom', path: ['expected', k], message: `expected 的鍵不是任何 target 的 ID：${k}` });
    }
  })
  .meta({ id: 'Scenario' });
export type Scenario = z.infer<typeof Scenario>;
