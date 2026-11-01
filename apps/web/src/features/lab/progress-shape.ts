// 實驗室進度的形狀與讀取（06 第 4.2 節）：StoryProgress 的欄位、settings 鍵、正規化、整個故事的預測成績、讀一個故事的進度。
// 和寫入分開（progress.ts）是為了 chunk：「我的」頁的實驗室一列（summary.ts）只要讀，這個模組放在 common chunk，
// 寫入與其他實驗室模組在 lab-ui chunk，「我的」頁不必為了一列載整個實驗室（vite.config.ts 的 common 與 lab-ui 群組）。
import { getProgressStore } from '../../lib/progress/index.ts';
import type { LabState } from '@ledgerland/progress';
import type { PredictScore, PredictionRecord } from './predict.ts';

export interface StoryProgress {
  /** 走完的步驟（依走完的先後） */
  readonly done: readonly string[];
  /** 單獨練習過的步驟 */
  readonly practised: readonly string[];
  /** 每一步最後一次的預測 */
  readonly predictions: Readonly<Record<string, PredictionRecord>>;
  /** 每一步最後一次預測的成績（猜對幾個、總共幾個） */
  readonly predictScores: Readonly<Record<string, PredictScore>>;
  /** 勾稽練習：每一步做完了沒、有沒有看過答案 */
  readonly reconciled: Readonly<Record<string, { readonly done: boolean; readonly sawAnswer: readonly string[] }>>;
}

export const EMPTY_PROGRESS: StoryProgress = { done: [], practised: [], predictions: {}, predictScores: {}, reconciled: {} };

export const settingKey = (storyId: string) => `lab:${storyId}`;

function scoresOf(v: unknown): StoryProgress['predictScores'] {
  if (typeof v !== 'object' || v === null) return {};
  const out: Record<string, PredictScore> = {};
  for (const [k, s] of Object.entries(v as Record<string, unknown>)) {
    if (typeof s !== 'object' || s === null) continue;
    const { right, total } = s as Partial<Record<'right' | 'total', unknown>>;
    if (typeof right === 'number' && typeof total === 'number' && Number.isInteger(right) && Number.isInteger(total) && total >= right && right >= 0)
      out[k] = { right, total };
  }
  return out;
}

/** 整個故事的預測成績：有記過預測的步數、猜對幾個、總共幾個 */
export function predictTotals(progress: Pick<StoryProgress, 'predictScores'>): { steps: number; right: number; total: number } {
  let right = 0;
  let total = 0;
  const scores = Object.values(progress.predictScores);
  for (const s of scores) {
    right += s.right;
    total += s.total;
  }
  return { steps: scores.length, right, total };
}

function normalise(v: unknown): StoryProgress {
  if (typeof v !== 'object' || v === null) return EMPTY_PROGRESS;
  const o = v as Partial<Record<keyof StoryProgress, unknown>>;
  const strings = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : []);
  return {
    done: strings(o.done),
    practised: strings(o.practised),
    predictions: typeof o.predictions === 'object' && o.predictions !== null ? (o.predictions as StoryProgress['predictions']) : {},
    predictScores: scoresOf(o.predictScores),
    reconciled: typeof o.reconciled === 'object' && o.reconciled !== null ? (o.reconciled as StoryProgress['reconciled']) : {},
  };
}

export interface LabProgressSnapshot {
  readonly state: LabState | undefined;
  readonly progress: StoryProgress;
}

/** 讀一個故事的進度；讀不到（儲存壞掉）就當作沒有 */
export async function readStoryProgress(storyId: string): Promise<LabProgressSnapshot> {
  try {
    const s = await getProgressStore();
    const [state, setting] = await Promise.all([s.getLabState(storyId), s.getSetting(settingKey(storyId))]);
    return { state, progress: normalise(setting?.value) };
  } catch {
    return { state: undefined, progress: EMPTY_PROGRESS };
  }
}
