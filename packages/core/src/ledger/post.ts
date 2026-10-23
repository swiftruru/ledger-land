// 過帳一步（04 第 6.4 節）：依事件順序實例化範本、驗證、套用；同一步的後一個事件看得到前一個事件的結果。
// 每一步產生不可變的快照：balancesBefore 是上一步的 balancesAfter（同一個物件），balancesAfter 只複製一次。
import type { Money } from '../money.ts';
import { validateEntry } from '../journal/validate.ts';
import type { JournalEntry } from '../journal/types.ts';
import { type CoreError, type Result, coreError, err, ok } from '../result.ts';
import { instantiateTemplate } from '../templates/instantiate.ts';
import type { DerivedValue } from '../templates/types.ts';
import { buildEffects } from './effects.ts';
import { applyEntry } from './ledger.ts';
import type { Balances, CoreContext, LedgerState, PostableStep, PostedStep, StepError } from './types.ts';

/** 把核心錯誤加上位置；message.params 也補上 stepId 與 eventId 方便畫面顯示 */
export function toStepError(error: CoreError, stepId: string, eventId: string): StepError {
  const params = { ...(error.message.params ?? {}), stepId, eventId };
  return { ...error, at: { stepId, eventId }, message: { key: error.message.key, params } };
}

export interface PostStepResult {
  readonly posted: PostedStep;
  readonly state: LedgerState;
}

/** 過帳一步；失敗時回傳第一個失敗事件的錯誤，狀態不變 */
export function postStep(state: LedgerState, step: PostableStep, ctx: CoreContext): Result<PostStepResult, StepError> {
  let cur = state;
  const entries: JournalEntry[] = [];
  const removedZeroLines: string[] = [];
  const derivedValues: Record<string, DerivedValue> = {};
  const seenEvents = new Set<string>();
  for (const ev of step.events) {
    if (seenEvents.has(ev.id)) throw new TypeError(`postStep：步驟 ${step.id} 的事件 ID 重複 ${ev.id}`);
    seenEvents.add(ev.id);
    const template = ctx.templates.get(ev.template);
    if (template === undefined) return err(toStepError(coreError('story.unknown_template', { template: ev.template }), step.id, ev.id));
    const inst = instantiateTemplate(template, ev.params, cur, ctx.policy, { eventId: ev.id });
    if (!inst.ok) return err(toStepError(inst.error, step.id, ev.id));
    for (const [name, value] of Object.entries(inst.value.derivedValues)) derivedValues[`${ev.id}.${name}`] = value;
    removedZeroLines.push(...inst.value.removedZeroLines);
    entries.push(inst.value.entry);
    if (inst.value.noEffect) continue;
    const valid = validateEntry(inst.value.entry, ctx.chart, ctx.policy, { enabledExtensions: ctx.enabledExtensions });
    if (!valid.ok) return err(toStepError(valid.error[0] as CoreError, step.id, ev.id));
    const applied = applyEntry(cur, inst.value.entry);
    if (!applied.ok) return err(toStepError(applied.error, step.id, ev.id));
    cur = applied.value.state;
  }
  const delta: Record<string, Money> = {};
  for (const id of Object.keys(cur.balances)) {
    const d = (cur.balances[id] ?? 0) - (state.balances[id] ?? 0);
    if (d !== 0) delta[id] = d;
  }
  const balancesAfter: Balances = cur === state ? state.balances : cur.balances;
  const posted: PostedStep = {
    stepId: step.id,
    entries,
    removedZeroLines,
    balancesBefore: state.balances,
    balancesAfter,
    delta,
    effects: buildEffects(entries, ctx.chart, ctx.effectPhrases),
    noEffect: entries.every((e) => e.lines.length === 0),
    derivedValues,
  };
  return ok({ posted, state: { ...cur, steps: [...state.steps, posted] } });
}
