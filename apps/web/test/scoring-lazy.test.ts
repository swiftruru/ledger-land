// 判分與紀錄的延後載入（06 第 8.2 節、14 第 5.2 節）：同一個 promise 重複使用；載好的模組有判分、紀錄與星星的函式，且結果與直接 import 相同
import { levelScore } from '@ledgerland/quiz';
import { describe, expect, it, vi } from 'vitest';
import { loadScoring } from '../src/features/quiz/scoring-lazy.ts';
import { scoreSnapshotQuestion } from '../src/features/quiz/scoring.ts';
import { qSingle } from './quiz-fixtures.ts';

// loadScoring 也一起等回饋區（feedback-lazy.tsx）；元件檔用 Lingui 巨集，Node 環境不跑巨集，換成記號（載入時機的測試在 quiz-lazy-loading.test.ts）
vi.mock('../src/features/quiz/FeedbackView.tsx', () => ({ FeedbackView: () => null }));

describe('loadScoring', () => {
  it('回傳同一個 promise；模組含 scoreSnapshotQuestion、recordAttempt、recordGuessed、recordLevelComplete、recordReviewResult 與 levelScore', async () => {
    const first = loadScoring();
    expect(loadScoring()).toBe(first);
    const m = await first;
    for (const name of ['scoreSnapshotQuestion', 'recordAttempt', 'recordGuessed', 'recordLevelComplete', 'recordReviewResult', 'levelScore'] as const)
      expect(typeof m[name]).toBe('function');
    expect(m.scoreSnapshotQuestion(qSingle, 'o_a1b2')).toEqual(scoreSnapshotQuestion(qSingle, 'o_a1b2'));
    expect(m.levelScore([{ scored: true, score: 1 }])).toEqual(levelScore([{ scored: true, score: 1 }]));
  });
});
