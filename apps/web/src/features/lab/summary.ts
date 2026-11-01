// 「我的」頁的實驗室一列：第一個故事走到哪、預測猜對幾個（manifest 的第一個故事加 settings 的 lab:<storyId>）。
// undefined 代表還在讀，null 代表沒有故事或讀不到。只 import progress-shape.ts（common chunk），不碰實驗室其他模組（lab-ui chunk）
import { useEffect, useState } from 'react';
import { loadManifest } from '../../lib/content.ts';
import { predictTotals, readStoryProgress } from './progress-shape.ts';

export interface LabSummary {
  readonly storyId: string;
  readonly stepsDone: number;
  readonly steps: number;
  readonly right: number;
  readonly total: number;
}

export async function readLabSummary(): Promise<LabSummary | null> {
  const m = await loadManifest();
  const story = (m.stories ?? [])[0];
  if (!story) return null;
  const { progress } = await readStoryProgress(story.id);
  const totals = predictTotals(progress);
  return { storyId: story.id, stepsDone: progress.done.length, steps: story.stepIds.length, right: totals.right, total: totals.total };
}

export function useLabSummary(): LabSummary | null | undefined {
  const [s, setS] = useState<LabSummary | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    readLabSummary().then(
      (v) => alive && setS(v),
      () => alive && setS(null),
    );
    return () => {
      alive = false;
    };
  }, []);
  return s;
}
