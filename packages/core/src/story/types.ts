// 故事、步驟與事件的型別以 content-schema 的 Zod schema 為準（04 第 9.1 節）；自由實驗的覆寫與重播結果定義在這裡。
import type { Story, StoryEvent, StoryStep } from '@ledgerland/content-schema';
import type { Money } from '../money.ts';
import type { PostedRun } from '../ledger/types.ts';

export type { Story, StoryEvent, StoryStep };

/** 自由實驗的覆寫：學生改的是 (stepId, eventId, param) 的值，核心從頭重播（04 第 9.2 節） */
export interface ParamOverride {
  readonly stepId: string;
  readonly eventId: string;
  readonly param: string;
  readonly value: number;
}

export interface ParamAddress {
  readonly stepId: string;
  readonly eventId: string;
  readonly param: string;
}

export interface AllowedRange {
  readonly min: Money;
  readonly max: Money;
}

/** 重播成功的結果：每一步的快照、最後狀態、故事本身與採用的政策 ID */
export interface StoryRun extends PostedRun {
  readonly story: Story;
  readonly policy: string;
}
