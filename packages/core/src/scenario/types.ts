// 情境求解的型別（04 第 15.1、15.2 節）。Scenario、Target、TargetAnswer、Direction 以 content-schema 的 Zod schema 為準。
import type { Direction, Scenario, ScenarioEvent, ScenarioOpening, Target, TargetAnswer } from '@ledgerland/content-schema';
import type { PostedRun, PostedStep } from '../ledger/types.ts';
import type { RatioRegistry } from '../ratios/types.ts';
import type { Story } from '../story/types.ts';

export type { Direction, Scenario, ScenarioEvent, ScenarioOpening, Target, TargetAnswer };

/** 情境事件過帳成的那一步的 ID；不是 st_ 格式，所以不會和故事的步驟 ID 衝突 */
export const SCENARIO_STEP_ID = 'scenario';

export interface SolveScenarioOptions {
  /** opening.storyRef 能引用的故事，鍵是故事 ID */
  readonly stories: ReadonlyMap<string, Story>;
  /** 指標登錄檔；預設內建登錄檔 */
  readonly ratios?: RatioRegistry;
}

export interface ScenarioAnswer {
  /** 事件參數與推導值：'e1.price'、'e1.costOfAllInventory'；非整數的推導值以浮點近似 */
  readonly values: Readonly<Record<string, number>>;
  /** 以 target 的 id 為鍵 */
  readonly expected: Readonly<Record<string, TargetAnswer>>;
  /** 情境事件過帳成的步驟（只有一步，ID 為 SCENARIO_STEP_ID） */
  readonly steps: readonly PostedStep[];
  /** 期初（故事到 afterStep 的各步、或自訂期初）加上情境那一步的完整 run，給 traceLine 與 buildTAccounts 使用 */
  readonly run: PostedRun;
  /** 期初狀態對應的步驟 ID：故事的 afterStep；自訂期初為 null（帳本起點） */
  readonly openingStepId: string | null;
}

/** 自訂期初不合法的原因（錯誤 scenario.opening_invalid_account 的 reason 欄位） */
export type OpeningInvalidReason = 'unknown_account' | 'not_balance_sheet' | 'disabled' | 'not_money' | 'balance_rule';
