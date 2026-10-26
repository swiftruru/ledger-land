// 判分遇到快照缺少 compiled（不該發生，但內容建置出錯時可能）不丟出例外（quiz-4 第 4 點）：回傳不計分的結果，畫面照樣有回饋與「下一題」
import { describe, expect, it, vi } from 'vitest';
import { scoreSnapshotQuestion } from '../src/features/quiz/scoring.ts';
import { qClassify, qFiveStep, qRatioNumeric } from './quiz-fixtures.ts';

vi.mock('../src/lib/errors.ts', () => ({ logError: vi.fn<() => Promise<void>>(async () => {}) }));

describe('scoreSnapshotQuestion', () => {
  it('分類題、五步驟與指標題缺少 compiled 時不丟出，回傳 0 分', () => {
    for (const q of [qClassify, qFiveStep, qRatioNumeric]) {
      const { compiled: _omit, ...rest } = q;
      const broken = { ...rest } as typeof q;
      expect(() => scoreSnapshotQuestion(broken, {})).not.toThrow();
      expect(scoreSnapshotQuestion(broken, {}).result.score).toBe(0);
    }
  });
});
