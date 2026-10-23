// 作答後寫進進度儲存（06 第 4.2 節、03 第 2.10 節）：作答紀錄、錯題本進盒子 1、「我是猜的」、名詞解鎖只一次、關卡成績取最大、第一次完成的判定
import { MemoryProgressStore } from '@ledgerland/progress';
import { beforeEach, describe, expect, it } from 'vitest';
import { recordAttempt, recordGuessed, recordLevelComplete, recordReviewResult } from '../src/features/quiz/record.ts';
import { scoreSnapshotQuestion } from '../src/features/quiz/scoring.ts';
import { meta } from './fixtures.ts';
import { qJudgment, qSingle } from './quiz-fixtures.ts';

let store: MemoryProgressStore;
beforeEach(() => {
  store = MemoryProgressStore.empty(meta());
});

describe('recordAttempt', () => {
  it('答錯：寫一筆作答紀錄、進錯題本盒子 1、解鎖 termRefs 的名詞（第二次不再解鎖）', async () => {
    const wrong = scoreSnapshotQuestion(qSingle, 'o_c3d4');
    const out = await recordAttempt(
      { q: qSingle, answer: wrong.answer, result: wrong.result, source: 'play', levelId: 'lv_t3st0001', durationMs: 1234.6 },
      store,
    );
    expect(out.attemptId).toMatch(/^a_[0-9a-hjkmnp-tv-z]{12}$/);
    expect(out.unlockedTerms).toEqual(['tm_t3st0001']);
    const attempts = await store.listAttempts();
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      questionId: qSingle.id,
      rev: 1,
      levelId: 'lv_t3st0001',
      answer: 'o_c3d4',
      correct: false,
      score: 0,
      durationMs: 1235,
      source: 'play',
    });
    const review = await store.getReview(qSingle.id);
    expect(review).toMatchObject({ box: 1, addedBy: 'auto', wrongCount: 1, status: 'active' });
    const again = await recordAttempt(
      { q: qSingle, answer: wrong.answer, result: wrong.result, source: 'play', levelId: 'lv_t3st0001', durationMs: 10 },
      store,
    );
    expect(again.unlockedTerms).toEqual([]);
    expect((await store.getReview(qSingle.id))?.wrongCount).toBe(2);
    expect(await store.listUnlocks('term')).toHaveLength(1);
  });

  it('答對不進錯題本；按「我是猜的」才進盒子 1；取捨題不計分也不進錯題本', async () => {
    const right = scoreSnapshotQuestion(qSingle, 'o_a1b2');
    await recordAttempt({ q: qSingle, answer: right.answer, result: right.result, source: 'play', levelId: 'lv_t3st0001', durationMs: 0 }, store);
    expect(await store.getReview(qSingle.id)).toBeUndefined();
    await recordGuessed(qSingle, store);
    expect(await store.getReview(qSingle.id)).toMatchObject({ box: 1, addedBy: 'guessed', wrongCount: 0 });
    const j = scoreSnapshotQuestion(qJudgment, 'o_j1a1');
    await recordAttempt({ q: qJudgment, answer: j.answer, result: j.result, source: 'play', levelId: 'lv_t3st0001', durationMs: 0 }, store);
    expect(await store.getReview(qJudgment.id)).toBeUndefined();
    expect((await store.listAttempts({ questionId: qJudgment.id }))[0]?.score).toBe(0);
  });

  it('複習作答：答對升一盒、答錯回盒子 1；複習答錯不會另外建一筆錯題', async () => {
    const wrong = scoreSnapshotQuestion(qSingle, 'o_c3d4');
    await recordAttempt({ q: qSingle, answer: wrong.answer, result: wrong.result, source: 'play', levelId: 'lv_t3st0001', durationMs: 0 }, store);
    const entry = (await store.getReview(qSingle.id))!;
    const up = await recordReviewResult(entry, true, store);
    expect(up.box).toBe(2);
    const down = await recordReviewResult(up, false, store);
    expect(down).toMatchObject({ box: 1, wrongCount: 2 });
    await recordAttempt({ q: qSingle, answer: wrong.answer, result: wrong.result, source: 'review', durationMs: 0 }, store);
    expect((await store.getReview(qSingle.id))?.wrongCount).toBe(2);
  });
});

describe('recordLevelComplete', () => {
  it('第一次完成任何關卡 firstEver 為 true；星星與最佳成績取最大，firstCompletedAt 只記第一次', async () => {
    const first = await recordLevelComplete(
      'lv_t3st0001',
      [
        { scored: true, score: 1 },
        { scored: true, score: 0 },
        { scored: false, score: 0 },
      ],
      store,
    );
    expect(first.firstEver).toBe(true);
    expect(first.previousStars).toBeUndefined();
    expect(first.progress).toMatchObject({ levelId: 'lv_t3st0001', stars: 0, bestScore: 0.5 });
    const firstAt = first.progress.firstCompletedAt;
    const second = await recordLevelComplete(
      'lv_t3st0001',
      [
        { scored: true, score: 1 },
        { scored: true, score: 1 },
      ],
      store,
    );
    expect(second.firstEver).toBe(false);
    expect(second.previousStars).toBe(0);
    expect(second.progress).toMatchObject({ stars: 3, bestScore: 1, firstCompletedAt: firstAt });
    const third = await recordLevelComplete(
      'lv_t3st0001',
      [
        { scored: true, score: 0 },
        { scored: true, score: 1 },
      ],
      store,
    );
    expect(third.progress).toMatchObject({ stars: 3, bestScore: 1 });
    const other = await recordLevelComplete('lv_t3st0002', [{ scored: true, score: 1 }], store);
    expect(other.firstEver).toBe(false);
  });
});
