// 實驗室的進度（06 第 4.2 節、03 第 3.1 節）：故事走到哪一步存 ProgressStore 的 labState（只往前不往後）；走完與練過的步驟、每一步的預測、勾稽練習的結果
// 存 settings（鍵 lab:<storyId>，一份 JSON；只在本機、不計分）；完成一步時把 termRefs 的名詞收進圖鑑（addUnlock，和作答一樣，03 第 2.10 節）；
// 自由實驗存 labSandbox。寫不進去（儲存壞掉）時不丟錯，畫面照常。進度的形狀與讀取在 progress-shape.ts（common chunk），這裡只有寫入。
import type { LabSandbox } from '@ledgerland/progress';
import { getProgressStore, nowIso } from '../../lib/progress/index.ts';
import type { PredictScore, PredictionRecord } from './predict.ts';
import type { LabMode } from './stages.ts';
import { readStoryProgress, settingKey, type StoryProgress } from './progress-shape.ts';

export { EMPTY_PROGRESS, predictTotals, readStoryProgress, type LabProgressSnapshot, type StoryProgress } from './progress-shape.ts';

async function writeProgress(storyId: string, next: StoryProgress): Promise<void> {
  try {
    const s = await getProgressStore();
    await s.setSetting(settingKey(storyId), next as unknown as Parameters<typeof s.setSetting>[1], nowIso());
  } catch {
    /* 寫不進去不影響畫面 */
  }
}

// 同一個故事的進度更新（讀、改、寫）排隊依序做：核心晚到時預測成績的儲存可能和「走完一步」只差幾百毫秒（V24），
// 兩邊各自讀舊值再寫會互相蓋掉（E2E 抓到）。失敗的那一筆不影響後面的
const queues = new Map<string, Promise<unknown>>();
function enqueue<T>(storyId: string, task: () => Promise<T>): Promise<T> {
  const prev = queues.get(storyId) ?? Promise.resolve();
  const next = prev.then(task, task);
  queues.set(
    storyId,
    next.catch(() => undefined),
  );
  return next;
}

/** 記下一步的預測（每次預測都存，揭曉用） */
export function savePrediction(storyId: string, stepId: string, record: PredictionRecord, score?: PredictScore): Promise<void> {
  return enqueue(storyId, async () => {
    const { progress } = await readStoryProgress(storyId);
    await writeProgress(storyId, {
      ...progress,
      predictions: { ...progress.predictions, [stepId]: record },
      predictScores: score ? { ...progress.predictScores, [stepId]: score } : progress.predictScores,
    });
  });
}

/**
 * 走完一步（示範或練習都算走完；練習另外記 practised，03 第 3.1 節）。故事進度 labState 只往前不往後：
 * 這一步在目前所在的步驟之後（或還沒有進度）才移過去，回頭看或練前面的步驟不動它；order 是故事步驟 ID 的順序。
 * termRefs 的名詞收進圖鑑。回傳這次新收進的名詞。
 */
export function completeStep(input: {
  storyId: string;
  stepId: string;
  termRefs: readonly string[];
  mode: LabMode;
  order: readonly string[];
}): Promise<{ unlockedTerms: string[] }> {
  return enqueue(input.storyId, () => completeStepNow(input));
}

async function completeStepNow(input: {
  storyId: string;
  stepId: string;
  termRefs: readonly string[];
  mode: LabMode;
  order: readonly string[];
}): Promise<{ unlockedTerms: string[] }> {
  const now = nowIso();
  const { state, progress } = await readStoryProgress(input.storyId);
  const done = progress.done.includes(input.stepId) ? progress.done : [...progress.done, input.stepId];
  const practised = input.mode === 'practice' && !progress.practised.includes(input.stepId) ? [...progress.practised, input.stepId] : progress.practised;
  const next: StoryProgress = { ...progress, done, practised };
  const currentIndex = state ? input.order.indexOf(state.stepId) : -1;
  const advance = currentIndex < 0 || input.order.indexOf(input.stepId) >= currentIndex;
  const unlockedTerms: string[] = [];
  try {
    const s = await getProgressStore();
    const has = await Promise.all(input.termRefs.map((id) => s.hasUnlock(`term:${id}`)));
    const writes: Promise<void>[] = [s.setSetting(settingKey(input.storyId), next as unknown as Parameters<typeof s.setSetting>[1], now)];
    if (advance) writes.push(s.putLabState({ storyId: input.storyId, stepId: input.stepId, updatedAt: now }));
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

export function saveReconcile(storyId: string, stepId: string, result: { done: boolean; sawAnswer: readonly string[] }): Promise<void> {
  return enqueue(storyId, async () => {
    const { progress } = await readStoryProgress(storyId);
    await writeProgress(storyId, { ...progress, reconciled: { ...progress.reconciled, [stepId]: result } });
  });
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
