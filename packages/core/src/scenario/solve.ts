// 情境求解（04 第 15.1、15.2 節步驟 2 到 4）：期初（重播故事到 afterStep，或驗證自訂期初）、依序套用事件、
// 對 before（期初）與 after 各建累計報表與指標，算出每個 target 的答案。所有答案都是分錄的推導值；錯誤以 Result 回傳。
import { isAccountEnabled, normalSign } from '../accounts/chart.ts';
import { fiveStepCheck } from '../checks/five-step.ts';
import type { EntryLine } from '../entries/types.ts';
import { normaliseEntries } from '../entries/compare.ts';
import { createLedger, noNegativeZero, normalBalanceOf, checkBalanceRules } from '../ledger/ledger.ts';
import { postStep } from '../ledger/post.ts';
import type { Balances, CoreContext, LedgerState, PostedRun, PostedStep } from '../ledger/types.ts';
import { type Money, isMoney, ratEq, ratFromExact, ratToDisplay, ratToNumber } from '../money.ts';
import { ratFromNumber, computeRatio } from '../ratios/compute.ts';
import { defaultRatioRegistry, getRatioVersion } from '../ratios/registry.ts';
import type { MeasureMap, RatioResult } from '../ratios/types.ts';
import { type CoreError, type Result, coreError, err, ok } from '../result.ts';
import { buildStatements, lineValue, measureMap } from '../statements/build.ts';
import type { Statements } from '../statements/types.ts';
import { replayStory, stateAfterStep } from '../story/replay.ts';
import type { DerivedValue } from '../templates/types.ts';
import {
  SCENARIO_STEP_ID,
  type Direction,
  type OpeningInvalidReason,
  type Scenario,
  type ScenarioAnswer,
  type SolveScenarioOptions,
  type Target,
  type TargetAnswer,
} from './types.ts';

interface Opening {
  readonly state: LedgerState;
  readonly stepId: string | null;
}

const invalidAccount = (account: string, reason: OpeningInvalidReason, extra: Readonly<Record<string, unknown>> = {}): CoreError =>
  coreError('scenario.opening_invalid_account', { account, reason }, { account, reason, ...extra });

/** 自訂期初：科目是啟用中的資產負債表科目、金額是安全整數、資產＝負債＋權益（以正常餘額計）、符合第 6.3 節的餘額規則 */
function openingFromBalances(balances: Readonly<Record<string, number>>, ctx: CoreContext): Result<Opening, CoreError> {
  const { chart } = ctx;
  const drCr: Record<string, Money> = {};
  const totals = { asset: 0, liability: 0, equity: 0 };
  for (const id of Object.keys(balances).sort()) {
    const value = balances[id];
    const account = chart.byId.get(id);
    if (account === undefined) return err(invalidAccount(id, 'unknown_account'));
    if (account.element !== 'asset' && account.element !== 'liability' && account.element !== 'equity')
      return err(invalidAccount(id, 'not_balance_sheet', { element: account.element }));
    if (!isAccountEnabled(chart, id, ctx.policy, ctx.enabledExtensions)) return err(invalidAccount(id, 'disabled', { policy: ctx.policy.id }));
    if (value === undefined || !isMoney(value)) return err(invalidAccount(id, 'not_money', { value: String(value) }));
    // 抵銷科目（累計折舊）以自己的正常餘額給，進總額時反號併入被抵銷的那一邊
    const contra = account.contraOf === null ? 1 : -1;
    totals[account.element] += contra * value;
    drCr[id] = noNegativeZero(normalSign(account) * value);
  }
  const diff = totals.asset - totals.liability - totals.equity;
  if (diff !== 0)
    return err(
      coreError(
        'scenario.opening_unbalanced',
        { assets: totals.asset, liabilities: totals.liability, equity: totals.equity, diff },
        { assets: totals.asset, liabilities: totals.liability, equity: totals.equity, diff },
      ),
    );
  const rule = checkBalanceRules(chart, drCr, Object.keys(drCr));
  if (rule !== undefined) return err(invalidAccount(String(rule['account']), 'balance_rule', { cause: rule }));
  return ok({ state: createLedger(chart, drCr), stepId: null });
}

function openingFromStory(storyRef: string, afterStep: string, ctx: CoreContext, options: SolveScenarioOptions): Result<Opening, CoreError> {
  const story = options.stories.get(storyRef);
  if (story === undefined) return err(coreError('scenario.unknown_story', { story: storyRef }, { story: storyRef }));
  if (!story.steps.some((s) => s.id === afterStep))
    return err(coreError('scenario.unknown_step', { story: storyRef, step: afterStep }, { story: storyRef, step: afterStep }));
  const run = replayStory(story, [], ctx);
  if (!run.ok) return run;
  return ok({ state: stateAfterStep(run.value, afterStep), stepId: afterStep });
}

function directionOf(before: number, after: number): Direction {
  if (after > before) return 'up';
  if (after < before) return 'down';
  return 'unchanged';
}

/** 整數值的答案（line、account、check）：transaction 視窗的 before 是 0、after 與 delta 都是本筆變動；direction 一律看累計值 */
function moneyAnswer(before: Money, after: Money, transaction: boolean): TargetAnswer {
  const delta = noNegativeZero(after - before);
  const direction = directionOf(before, after);
  return transaction ? { direction, before: 0, after: delta, delta } : { direction, before, after, delta };
}

/** 能比較的指標：不是 na，而且有顯示值（not_meaningful 只有 excel 版保留數值） */
const computable = (r: RatioResult): r is RatioResult & { readonly displayValue: number } => r.status !== 'na' && r.displayValue !== null;

/** 指標的答案：value 以 displayValue 比較；N/A 變數字是 becomes_computable、數字變 N/A 是 becomes_na */
function ratioAnswer(target: Target & { readonly kind: 'ratio' }, before: RatioResult, after: RatioResult, decimals: number): Result<TargetAnswer, CoreError> {
  const ref = target.ratioRef;
  const base: TargetAnswer = { before: before.displayValue, after: after.displayValue, status: after.status };
  const delta = computable(before) && computable(after) ? ratToDisplay(ratFromNumber(after.displayValue - before.displayValue), decimals) : undefined;
  const withDelta = delta === undefined ? base : { ...base, delta: noNegativeZero(delta) };
  if (target.measure === 'direction' && (before.status === 'not_meaningful' || after.status === 'not_meaningful'))
    return err(coreError('scenario.direction_not_meaningful', { target: target.id, ratioRef: ref }, { target: target.id, ratioRef: ref }));
  let direction: Direction;
  if (!computable(before) && !computable(after)) direction = 'unchanged';
  else if (!computable(before)) direction = 'becomes_computable';
  else if (!computable(after)) direction = 'becomes_na';
  else {
    direction = directionOf(before.displayValue, after.displayValue);
    if (
      direction === 'unchanged' &&
      target.measure === 'direction' &&
      before.exact !== null &&
      after.exact !== null &&
      !ratEq(ratFromExact(before.exact), ratFromExact(after.exact))
    )
      return err(
        coreError('scenario.direction_ambiguous', { target: target.id, ratioRef: ref, displayValue: after.displayValue }, { target: target.id, ratioRef: ref }),
      );
  }
  return ok({ direction, ...withDelta });
}

function derivedToNumber(v: DerivedValue): number {
  if (typeof v === 'number') return v;
  const [num, den] = v.split('/');
  if (num === undefined || den === undefined) throw new TypeError(`推導值不是 num/den 字串：${v}`);
  return ratToNumber(ratFromExact({ num, den }));
}

interface Solved {
  readonly before: Statements;
  readonly after: Statements;
  readonly tx: Statements | null;
  readonly beforeBalances: Balances;
  readonly afterBalances: Balances;
  readonly beforeMeasures: MeasureMap;
  readonly afterMeasures: MeasureMap;
  readonly openingMeasures: MeasureMap;
}

function solveTarget(target: Target, s: Solved, scenario: Scenario, ctx: CoreContext, options: SolveScenarioOptions): Result<TargetAnswer, CoreError> {
  const transaction = scenario.window === 'transaction';
  const registry = options.ratios ?? defaultRatioRegistry();
  switch (target.kind) {
    case 'line': {
      if (!s.after.lines.has(target.line))
        return err(
          coreError('scenario.unknown_line', { target: target.id, line: target.line, layout: ctx.layout.id }, { target: target.id, line: target.line }),
        );
      const before = lineValue(s.before, target.line).value;
      const after = lineValue(s.after, target.line).value;
      const txValue = s.tx === null ? null : lineValue(s.tx, target.line).value;
      const answer = moneyAnswer(before, after, transaction);
      // 本筆變動報表逐列相減（第 11.5 節），和 after 減 before 相同；這裡直接取報表的值以免兩邊算法分歧
      return ok(txValue === null ? answer : { ...answer, after: txValue, delta: txValue });
    }
    case 'account': {
      if (!ctx.chart.byId.has(target.account))
        return err(coreError('scenario.unknown_account', { target: target.id, account: target.account }, { target: target.id, account: target.account }));
      const before = normalBalanceOf(ctx.chart, s.beforeBalances, target.account);
      const after = normalBalanceOf(ctx.chart, s.afterBalances, target.account);
      return ok(moneyAnswer(before, after, transaction));
    }
    case 'ratio': {
      const version = getRatioVersion(registry, target.ratioRef);
      if (version === undefined)
        return err(coreError('scenario.unknown_ratio', { target: target.id, ratioRef: target.ratioRef }, { target: target.id, ratioRef: target.ratioRef }));
      const before = computeRatio(target.ratioRef, s.beforeMeasures, {}, registry, { opening: s.openingMeasures });
      const after = computeRatio(target.ratioRef, s.afterMeasures, {}, registry, { opening: s.openingMeasures });
      return ratioAnswer(target, before, after, version.spec.displayDecimals);
    }
    case 'check': {
      // 勾稽點只對累計報表有意義；視窗不影響
      const diffOf = (st: Statements): Money => {
        const c = fiveStepCheck(st).checks.find((x) => x.step === target.step);
        if (c === undefined) throw new TypeError(`fiveStepCheck 沒有步驟 ${target.step}`);
        return c.diff;
      };
      const before = diffOf(s.before);
      const after = diffOf(s.after);
      return ok({ direction: directionOf(before, after), before, after, delta: noNegativeZero(after - before) });
    }
    default:
      throw new TypeError(`solveScenario：不認得的 target 種類 ${JSON.stringify(target)}`);
  }
}

/**
 * 求解情境（04 第 15.2 節步驟 2 到 4）。ctx 的政策與版面必須就是 scenario 指定的（題目只用 teacher@1），不是的話是程式錯誤。
 * 步驟錯誤（範本不存在、前置條件、餘額規則）原樣透傳，附 at.stepId 為 SCENARIO_STEP_ID。
 */
export function solveScenario(scenario: Scenario, ctx: CoreContext, options: SolveScenarioOptions): Result<ScenarioAnswer, CoreError> {
  if (ctx.policy.id !== scenario.policy) throw new TypeError(`solveScenario：ctx 的政策是 ${ctx.policy.id}，題目要求 ${scenario.policy}`);
  if (ctx.layout.id !== scenario.layout) throw new TypeError(`solveScenario：ctx 的版面是 ${ctx.layout.id}，題目要求 ${scenario.layout}`);
  const opening =
    'storyRef' in scenario.opening
      ? openingFromStory(scenario.opening.storyRef, scenario.opening.afterStep, ctx, options)
      : openingFromBalances(scenario.opening.balances, ctx);
  if (!opening.ok) return opening;
  const posted = postStep(opening.value.state, { id: SCENARIO_STEP_ID, events: scenario.events }, ctx);
  if (!posted.ok) return posted;
  const finalState = posted.value.state;
  const run: PostedRun = { steps: finalState.steps, finalState };
  const { layout, policy } = ctx;
  // 帳本起點：沒有步驟的 run 的累計報表就是期初（cumulative 的 to 為 null 是「最後一步」，不能用它表示起點）
  const startRun: PostedRun = { steps: [], finalState: createLedger(ctx.chart, opening.value.state.opening) };
  const start = buildStatements(startRun, { kind: 'cumulative', to: null }, layout, policy);
  const before = opening.value.stepId === null ? start : buildStatements(run, { kind: 'cumulative', to: opening.value.stepId }, layout, policy);
  const after = buildStatements(run, { kind: 'cumulative', to: SCENARIO_STEP_ID }, layout, policy);
  const tx = scenario.window === 'transaction' ? buildStatements(run, { kind: 'transaction', step: SCENARIO_STEP_ID }, layout, policy) : null;
  const solved: Solved = {
    before,
    after,
    tx,
    beforeBalances: opening.value.state.balances,
    afterBalances: finalState.balances,
    beforeMeasures: measureMap(before),
    afterMeasures: measureMap(after),
    openingMeasures: measureMap(start),
  };
  const expected: Record<string, TargetAnswer> = {};
  for (const target of scenario.targets) {
    const r = solveTarget(target, solved, scenario, ctx, options);
    if (!r.ok) return r;
    expected[target.id] = r.value;
  }
  const values: Record<string, number> = {};
  const step: PostedStep = posted.value.posted;
  for (const key of Object.keys(step.derivedValues).sort()) {
    const v = step.derivedValues[key];
    if (v !== undefined) values[key] = derivedToNumber(v);
  }
  return ok({ values, expected, steps: [step], run, openingStepId: opening.value.stepId });
}

/** 分錄題的正解（04 第 15.2 節第 8 點）：情境每個事件的分錄合併同科目同方向、移除 0 行，依科目表 order 排序 */
export function expectedJournalEntries(answer: ScenarioAnswer): readonly EntryLine[] {
  const entries: EntryLine[][] = [];
  for (const step of answer.steps) for (const e of step.entries) entries.push(e.lines.map((l) => ({ account: l.account, side: l.side, amount: l.amount })));
  return normaliseEntries(entries, answer.run.finalState.chart, { allowAliases: false }).lines;
}
