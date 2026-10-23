// oxlint-disable vitest/no-standalone-expect -- 性質測試用 @fast-check/vitest 的 test.prop，expect 在它的回呼裡
// 性質測試：attempts 與 unlocks 的合併可交換；整體合併冪等（merge(n, n) = n，n 是正規化後的資料）；合併後的 wrongCount 與 attempts 一致
import { describe, expect } from 'vitest';
import { fc, test } from '@fast-check/vitest';
import { type Attempt, type ProgressData, type Unlock, mergeAttempts, mergeData, mergeUnlocks, recomputeWrongCount } from '../src/index.ts';
import { DEVICE_A, DEVICE_B, Q1, Q2, Q3, attempt, data, level, review, unlock } from './fixtures.ts';

const iso = fc
  .integer({ min: 0, max: 400 })
  .map((h) => `2026-01-01T${String(h % 24).padStart(2, '0')}:00:00${h % 3 === 0 ? 'Z' : h % 3 === 1 ? '+08:00' : '-03:00'}`);
const qid = fc.constantFrom(Q1, Q2, Q3);
const dev = fc.constantFrom(DEVICE_A, DEVICE_B);
const attemptArb: fc.Arbitrary<Attempt> = fc
  .record({ n: fc.integer({ min: 1, max: 999 }), questionId: qid, rev: fc.integer({ min: 1, max: 2 }), answeredAt: iso, deviceId: dev, correct: fc.boolean() })
  .map(({ n, ...rest }) => attempt({ attemptId: `a_${String(n).padStart(12, '0')}`, ...rest }));
const unlockArb: fc.Arbitrary<Unlock> = fc
  .record({ id: fc.constantFrom('term:tm_5p8k2w9x', 'badge:b1', 'badge:b2'), at: iso })
  .map(({ id, at }) => unlock(id, at));
const dataArb: fc.Arbitrary<ProgressData> = fc
  .record({
    attempts: fc.array(attemptArb, { maxLength: 8 }),
    unlocks: fc.array(unlockArb, { maxLength: 4 }),
    levels: fc.array(fc.record({ stars: fc.constantFrom(0, 1, 2, 3), bestScore: fc.constantFrom(0, 0.5, 1), at: iso }), { maxLength: 3 }),
    reviews: fc.array(fc.record({ questionId: qid, rev: fc.integer({ min: 1, max: 2 }), at: iso }), { maxLength: 3 }),
  })
  .map(({ attempts, unlocks, levels, reviews }) =>
    data({
      attempts,
      unlocks,
      levelProgress: levels.map((l, i) =>
        level({
          levelId: i === 0 ? 'lv_3n8p5w2d' : 'lv_8k2m7q4x',
          stars: l.stars as 0 | 1 | 2 | 3,
          bestScore: l.bestScore,
          firstCompletedAt: l.at,
          lastPlayedAt: l.at,
        }),
      ),
      reviewQueue: reviews.map((r) => review({ questionId: r.questionId, rev: r.rev, lastAnsweredAt: r.at })),
    }),
  );

describe('合併的代數性質', () => {
  test.prop([fc.array(attemptArb, { maxLength: 10 }), fc.array(attemptArb, { maxLength: 10 })])('attempts 合併可交換', (a, b) => {
    expect(mergeAttempts(a, b)).toEqual(mergeAttempts(b, a));
  });
  test.prop([fc.array(unlockArb, { maxLength: 6 }), fc.array(unlockArb, { maxLength: 6 })])('unlocks 合併可交換', (a, b) => {
    expect(mergeUnlocks(a, b)).toEqual(mergeUnlocks(b, a));
  });
  test.prop([dataArb])('合併冪等：merge(n, n) 與 n 相同（n 是與空資料合併後的正規形）', (d) => {
    const n = mergeData(d, data(), { settings: false });
    expect(mergeData(n, n, { settings: false })).toEqual(n);
    expect(mergeData(n, data(), { settings: false })).toEqual(n);
  });
  test.prop([dataArb, dataArb])('合併後的 wrongCount 等於合併後 attempts 的答錯次數，且不受順序影響', (a, b) => {
    const m = mergeData(a, b, { settings: false });
    const wrong = recomputeWrongCount(m.attempts);
    for (const r of m.reviewQueue) expect(r.wrongCount).toBe(wrong.get(r.questionId) ?? 0);
    expect(mergeData(b, a, { settings: false })).toEqual(m);
  });
});
