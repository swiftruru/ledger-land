// 報表實驗室的核心包裝（03 第 3 節、04 第 9 節）：把故事快照交給 @ledgerland/core 重播，替每一步算出交易前、交易後、本筆變動三份報表、
// 五步驟勾稽、指標（全部版本）、科目變動、分錄與 T 字帳。這個模組 import 整個核心，只由 lazy-core.ts 動態載入（06 第 8.2 節），
// 實驗室的頁面 chunk 本身不含核心。每一步的結果要用到才算、算過就留著（18 步乘 43 個指標乘 5 個版本不必一次算完）。
// 畫面上的每個數字都從這裡來（10 第 11.1 節的完成標準），頁面不另外存數字。
import {
  allowedRange,
  buildStatements,
  buildTAccounts,
  computeAllRatios,
  createCoreContext,
  createLedger,
  defaultRatioRegistry,
  defaultRatios,
  defaultTemplates,
  fiveStepCheck,
  measureMap,
  orderedSteps,
  replayStory,
  type AllowedRange,
  type CoreContext,
  type FiveStepResult,
  type ParamAddress,
  type ParamOverride,
  type PostedRun,
  type PostedStep,
  type RatioDefinition,
  type RatioRegistry,
  type RatioResult,
  type Statements,
  type StepError,
  type Story,
  type StoryRun,
  type TAccount,
  type TransactionTemplate,
} from '@ledgerland/core';
import type { StorySnapshot } from '../../lib/content.ts';

export type {
  AllowedRange,
  FiveStepResult,
  ParamAddress,
  ParamOverride,
  PostedStep,
  RatioDefinition,
  RatioResult,
  Statements,
  StepError,
  TAccount,
  TransactionTemplate,
};

export interface LabStep {
  readonly id: string;
  /** 0 起算的位置 */
  readonly index: number;
  readonly order: number;
  /** 交易前的累計報表（第一步是期初） */
  readonly before: Statements;
  /** 交易後的累計報表 */
  readonly after: Statements;
  /** 本筆變動（交易後減交易前，逐列） */
  readonly change: Statements;
  readonly posted: PostedStep;
  /** 交易後累計報表的五步驟檢查（故事與自由實驗一定相符） */
  readonly fiveStep: FiveStepResult;
  /** 全部版本的指標：交易前與交易後 */
  readonly ratiosBefore: readonly RatioResult[];
  readonly ratiosAfter: readonly RatioResult[];
  /** 佔位符的值：'e1.price'（參數）與 'e1.costOfAllInventory'（推導值） */
  readonly values: Readonly<Record<string, number>>;
  readonly tAccounts: readonly TAccount[];
}

export interface LabRun {
  readonly ctx: CoreContext;
  readonly story: Story;
  readonly run: StoryRun;
  readonly stepIds: readonly string[];
  /** 期初（沒有任何步驟）的累計報表 */
  readonly opening: Statements;
  /** 第 index 步的結果（用到才算） */
  step(index: number): LabStep;
  stepById(id: string): LabStep | undefined;
}

export type LabReplay =
  | { readonly ok: true; readonly value: LabRun }
  | { readonly ok: false; readonly error: StepError & { readonly allowedRange?: AllowedRange; readonly edited?: ParamAddress } };

let sharedCtx: CoreContext | null = null;
let sharedRegistry: RatioRegistry | null = null;

/** 核心的執行環境（科目表、範本、teacher@1 政策與版面）：整個 App 共用一份 */
export function labContext(): CoreContext {
  sharedCtx ??= createCoreContext();
  return sharedCtx;
}

export function ratioRegistry(): RatioRegistry {
  sharedRegistry ??= defaultRatioRegistry();
  return sharedRegistry;
}

export const ratioDefinitions: readonly RatioDefinition[] = defaultRatios;
export const templates: readonly TransactionTemplate[] = defaultTemplates;

/** 快照裡的故事（LocalizedText 已依語系攤平）當成核心的 Story：重播只讀 id、order、events、opening、policy，文字欄位不看 */
export function asCoreStory(snapshot: Omit<StorySnapshot, 'steps'> & { readonly steps: readonly object[] }): Story {
  return snapshot as unknown as Story;
}

function valuesOf(posted: PostedStep, step: Story['steps'][number]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ev of step.events) for (const [k, v] of Object.entries(ev.params)) out[`${ev.id}.${k}`] = v;
  for (const [k, v] of Object.entries(posted.derivedValues)) if (typeof v === 'number') out[k] = v;
  return out;
}

/** 重播整個故事（可帶自由實驗的覆寫）；失敗時把核心附上的可輸入範圍一起回傳 */
export function replayLab(story: Story, overrides: readonly ParamOverride[] = []): LabReplay {
  const ctx = labContext();
  const r = replayStory(story, overrides, ctx);
  if (!r.ok) return { ok: false, error: r.error as LabReplay extends { ok: false; error: infer E } ? E : never };
  const run = r.value;
  const steps = orderedSteps(story);
  const stepIds = steps.map((s) => s.id);
  const { layout, policy } = ctx;
  const startRun: PostedRun = { steps: [], finalState: createLedger(ctx.chart, run.finalState.opening) };
  const opening = buildStatements(startRun, { kind: 'cumulative', to: null }, layout, policy);
  const registry = ratioRegistry();
  const cache = new Map<number, LabStep>();
  const cumulative = new Map<number, Statements>();
  const cumulativeAt = (index: number): Statements => {
    if (index < 0) return opening;
    let st = cumulative.get(index);
    if (st === undefined) {
      st = buildStatements(run, { kind: 'cumulative', to: stepIds[index]! }, layout, policy);
      cumulative.set(index, st);
    }
    return st;
  };
  const ratiosAt = new Map<number, readonly RatioResult[]>();
  const ratiosFor = (index: number): readonly RatioResult[] => {
    let r2 = ratiosAt.get(index);
    if (r2 === undefined) {
      r2 = computeAllRatios(measureMap(cumulativeAt(index)), {}, undefined, registry);
      ratiosAt.set(index, r2);
    }
    return r2;
  };
  const step = (index: number): LabStep => {
    let s = cache.get(index);
    if (s !== undefined) return s;
    const id = stepIds[index];
    const posted = run.steps[index];
    const spec = steps[index];
    if (id === undefined || posted === undefined || spec === undefined) throw new RangeError(`故事沒有第 ${index + 1} 步`);
    const after = cumulativeAt(index);
    s = {
      id,
      index,
      order: spec.order,
      before: cumulativeAt(index - 1),
      after,
      change: buildStatements(run, { kind: 'transaction', step: id }, layout, policy),
      posted,
      fiveStep: fiveStepCheck(after),
      ratiosBefore: ratiosFor(index - 1),
      ratiosAfter: ratiosFor(index),
      values: valuesOf(posted, spec),
      tAccounts: buildTAccounts(run, id),
    };
    cache.set(index, s);
    return s;
  };
  return {
    ok: true,
    value: {
      ctx,
      story,
      run,
      stepIds,
      opening,
      step,
      stepById: (sid) => {
        const i = stepIds.indexOf(sid);
        return i < 0 ? undefined : step(i);
      },
    },
  };
}

/** 自由實驗：某個參數的可輸入範圍（04 第 9.3 節）；不能搜尋的參數是 null */
export function labAllowedRange(story: Story, overrides: readonly ParamOverride[], target: ParamAddress): AllowedRange | null {
  return allowedRange(story, overrides, target, labContext());
}

/** 勾稽練習：學習者填的格子代進累計報表後的五步驟檢查 */
export function reconcileCheck(after: Statements, inputs: Readonly<Record<string, number>>): FiveStepResult {
  return fiveStepCheck(after, inputs);
}
