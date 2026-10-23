// 故事重播、自由實驗覆寫與可輸入範圍（04 第 9.2、9.3 節、第 6.6 節的錯誤形狀）。
import type { Money } from '../money.ts';
import { createLedger } from '../ledger/ledger.ts';
import { postStep } from '../ledger/post.ts';
import { stepIndexOf } from '../ledger/taccounts.ts';
import type { CoreContext, LedgerState, PostableStep, PostedStep, StepError } from '../ledger/types.ts';
import { type Result, err, ok } from '../result.ts';
import { stableSortBy } from '../util/canonical.ts';
import type { AllowedRange, ParamAddress, ParamOverride, Story, StoryRun, StoryStep } from './types.ts';

/** 依 order 排序的步驟（order 相同時維持原順序） */
export function orderedSteps(story: Story): readonly StoryStep[] {
  return stableSortBy(story.steps, (s) => s.order);
}

/** 把覆寫套進步驟的事件參數；指到不存在的步驟或事件的覆寫沒有作用，指到不存在的參數由實例化回報 param.type */
export function applyOverrides(step: StoryStep, overrides: readonly ParamOverride[]): PostableStep {
  const mine = overrides.filter((o) => o.stepId === step.id);
  if (mine.length === 0) return step;
  return {
    id: step.id,
    events: step.events.map((ev) => {
      const params: Record<string, number> = { ...ev.params };
      for (const o of mine) if (o.eventId === ev.id) params[o.param] = o.value;
      return { id: ev.id, template: ev.template, params };
    }),
  };
}

function replayCore(story: Story, overrides: readonly ParamOverride[], ctx: CoreContext): Result<StoryRun, StepError> {
  let state = createLedger(ctx.chart, story.opening ?? {});
  for (const step of orderedSteps(story)) {
    const r = postStep(state, applyOverrides(step, overrides), ctx);
    if (!r.ok) return r;
    state = r.value.state;
  }
  return ok({ steps: state.steps, finalState: state, story, policy: ctx.policy.id });
}

function findParamSpec(story: Story, target: ParamAddress, ctx: CoreContext) {
  const step = story.steps.find((s) => s.id === target.stepId);
  const event = step?.events.find((e) => e.id === target.eventId);
  if (event === undefined) return undefined;
  const template = ctx.templates.get(event.template);
  const spec = template?.params.find((p) => p.name === target.param);
  return spec === undefined ? undefined : { spec, event };
}

/**
 * 重播整個故事；第一個失敗的步驟回傳 StepError。
 * 有覆寫時，錯誤另附 edited（最後一筆覆寫）與 allowedRange（該參數有 monotonic 時的可輸入範圍；沒有或搜不到時省略）。
 */
export function replayStory(story: Story, overrides: readonly ParamOverride[], ctx: CoreContext): Result<StoryRun, StepError> {
  const r = replayCore(story, overrides, ctx);
  if (r.ok) return r;
  const edited = overrides[overrides.length - 1];
  if (edited === undefined) return r;
  const address: ParamAddress = { stepId: edited.stepId, eventId: edited.eventId, param: edited.param };
  const range = allowedRange(story, overrides, address, ctx);
  return err({ ...r.error, edited: address, ...(range === null ? {} : { allowedRange: range }) });
}

/**
 * 可輸入範圍（04 第 9.3 節）：只對有 monotonic（不是 none）的整數型參數做整數二分搜尋，每次試一個值就重播整個故事。
 * 假設合法值是一段區間：先找一個合法的支點（目前的覆寫值、故事原值、預設值、min、max），再往兩側二分找最小與最大合法值。
 */
export function allowedRange(story: Story, overrides: readonly ParamOverride[], target: ParamAddress, ctx: CoreContext): AllowedRange | null {
  const found = findParamSpec(story, target, ctx);
  if (found === undefined) return null;
  const { spec, event } = found;
  if (spec.monotonic === undefined || spec.monotonic === 'none' || spec.type === 'rate') return null;
  const others = overrides.filter((o) => !(o.stepId === target.stepId && o.eventId === target.eventId && o.param === target.param));
  const isValid = (value: Money): boolean => replayCore(story, [...others, { ...target, value }], ctx).ok;
  const current = overrides.findLast((o) => o.stepId === target.stepId && o.eventId === target.eventId && o.param === target.param)?.value;
  const candidates = [current, event.params[target.param], spec.default, spec.min, spec.max].filter(
    (v): v is number => v !== undefined && Number.isSafeInteger(v) && v >= spec.min && v <= spec.max,
  );
  const pivot = candidates.find((v) => isValid(v));
  if (pivot === undefined) return null;
  // 最小合法值：lo 不合法（或等於 min 且合法）、hi 合法
  let min = spec.min;
  if (!isValid(spec.min)) {
    let lo = spec.min;
    let hi = pivot;
    while (hi - lo > 1) {
      const mid = lo + Math.floor((hi - lo) / 2);
      if (isValid(mid)) hi = mid;
      else lo = mid;
    }
    min = hi;
  }
  let max = spec.max;
  if (!isValid(spec.max)) {
    let lo = pivot;
    let hi = spec.max;
    while (hi - lo > 1) {
      const mid = lo + Math.floor((hi - lo) / 2);
      if (isValid(mid)) lo = mid;
      else hi = mid;
    }
    max = lo;
  }
  return { min, max };
}

/** 某一步之後的帳本狀態（給單獨練習與情境的 opening.afterStep 使用）：costs 由該步之前的借方行重算 */
export function stateAfterStep(run: StoryRun, stepId: string): LedgerState {
  const index = stepIndexOf(run, stepId);
  const steps: readonly PostedStep[] = run.steps.slice(0, index + 1);
  const last = steps[index];
  if (last === undefined) throw new RangeError(`run 裡沒有步驟 ${stepId}`);
  const base = createLedger(run.finalState.chart, run.finalState.opening);
  const costs: Record<string, Money> = { ...base.costs };
  for (const s of steps) for (const e of s.entries) for (const l of e.lines) if (l.side === 'debit') costs[l.account] = (costs[l.account] ?? 0) + l.amount;
  return { ...base, balances: last.balancesAfter, costs, steps };
}
