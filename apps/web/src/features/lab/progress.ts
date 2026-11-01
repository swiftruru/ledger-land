// 實驗室的進度（06 第 4.2 節、03 第 3.1 節）：故事走到哪一步存 ProgressStore 的 labState；走完與練習過的步驟、每一步的預測、勾稽練習的結果
// 存 settings（鍵 lab:<storyId>，一份 JSON；只在本機、不計分）；完成一步時把 termRefs 的名詞收進圖鑑（addUnlock，和作答一樣，03 第 2.10 節）；
// 自由實驗存 labSandbox。寫不進去（儲存壞掉）時不丟錯，畫面照常。
import type { LabSandbox, LabState } from '@ledgerland/progress';
import { getProgressStore, nowIso } from '../../lib/progress/index.ts';
import type { PredictionRecord } from './predict.ts';

export interface StoryProgress {
  /** 走完的步驟（依走完的先後） */
  readonly done: readonly string[];
  /** 單獨練習過的步驟 */
  readonly practised: readonly string[];
  /** 每一步最後一次的預測 */
  readonly predictions: Readonly<Record<string, PredictionRecord>>;
  /** 勾稽練習：每一步做完了沒、有沒有看過答案 */
  readonly reconciled: Readonly<Record<string, { readonly done: boolean; readonly sawAnswer: readonly string[] }>>;
}

export const EMPTY_PROGRESS: StoryProgress = { done: [], practised: [], predictions: {}, reconciled: {} };

const settingKey = (storyId: string) => `lab:${storyId}`;

function normalise(v: unknown): StoryProgress {
  if (typeof v !== 'object' || v === null) return EMPTY_PROGRESS;
  const o = v as Partial<Record<keyof StoryProgress, unknown>>;
  const strings = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : []);
  return {
    done: strings(o.done),
    practised: strings(o.practised),
    predictions: typeof o.predictions === 'object' && o.predictions !== null ? (o.predictions as StoryProgress['predictions']) : {},
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

async function writeProgress(storyId: string, next: StoryProgress): Promise<void> {
  try {
    const s = await getProgressStore();
    await s.setSetting(settingKey(storyId), next as unknown as Parameters<typeof s.setSetting>[1], nowIso());
  } catch {
    /* 寫不進去不影響畫面 */
  }
}

/** 記下一步的預測（每次預測都存，揭曉用） */
export async function savePrediction(storyId: string, stepId: string, record: PredictionRecord): Promise<void> {
  const { progress } = await readStoryProgress(storyId);
  await writeProgress(storyId, { ...progress, predictions: { ...progress.predictions, [stepId]: record } });
}

/**
 * 走完一步：故事模式更新 labState（目前走到的步驟）與 done；單獨練習只記 practised、不動 labState（03 第 3.1 節）。
 * termRefs 的名詞收進圖鑑。回傳這次新收進的名詞。
 */
export async function completeStep(input: {
  storyId: string;
  stepId: string;
  termRefs: readonly string[];
  mode: 'story' | 'practice';
}): Promise<{ unlockedTerms: string[] }> {
  const now = nowIso();
  const { progress } = await readStoryProgress(input.storyId);
  const next: StoryProgress =
    input.mode === 'story'
      ? { ...progress, done: progress.done.includes(input.stepId) ? progress.done : [...progress.done, input.stepId] }
      : { ...progress, practised: progress.practised.includes(input.stepId) ? progress.practised : [...progress.practised, input.stepId] };
  const unlockedTerms: string[] = [];
  try {
    const s = await getProgressStore();
    const has = await Promise.all(input.termRefs.map((id) => s.hasUnlock(`term:${id}`)));
    const writes: Promise<void>[] = [s.setSetting(settingKey(input.storyId), next as unknown as Parameters<typeof s.setSetting>[1], now)];
    if (input.mode === 'story') writes.push(s.putLabState({ storyId: input.storyId, stepId: input.stepId, updatedAt: now }));
    input.termRefs.forEach((id, i) => {
      if (has[i]) return;
      unlockedTerms.push(id);
      writes.push(s.addUnlock({ id: `term:${id}`, kind: 'term', unlockedAt: now }));
    });
    await Promise.all(writes);
  } catch {
    /* 寫不進去不影響畫面 */
  }
  return { unlockedTerms };
}

/** 「從這一步接著走故事」：把故事進度移到這一步（單獨練習完成卡的第三個按鈕） */
export async function moveStoryTo(storyId: string, stepId: string): Promise<void> {
  try {
    const s = await getProgressStore();
    await s.putLabState({ storyId, stepId, updatedAt: nowIso() });
  } catch {
    /* 寫不進去不影響畫面 */
  }
}

export async function saveReconcile(storyId: string, stepId: string, result: { done: boolean; sawAnswer: readonly string[] }): Promise<void> {
  const { progress } = await readStoryProgress(storyId);
  await writeProgress(storyId, { ...progress, reconciled: { ...progress.reconciled, [stepId]: result } });
}

export async function readSandbox(id: string): Promise<LabSandbox | undefined> {
  try {
    return await (await getProgressStore()).getLabSandbox(id);
  } catch {
    return undefined;
  }
}

export async function writeSandbox(sandbox: LabSandbox): Promise<void> {
  try {
    await (await getProgressStore()).putLabSandbox(sandbox);
  } catch {
    /* 寫不進去不影響畫面 */
  }
}

export async function clearSandbox(id: string): Promise<void> {
  try {
    await (await getProgressStore()).removeLabSandbox(id);
  } catch {
    /* 寫不進去不影響畫面 */
  }
}
