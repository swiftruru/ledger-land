// oxlint-disable vitest/no-standalone-expect -- test.prop 的本體不是 it 區塊，expect 寫在性質裡
// 判分的性質測試（fast-check）：任何作答的得分都在 0 到 1；多正解題只有 0 或 1；分類題得分等於答對比例；星星隨得分單調
import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';
import { scoreMultiChoice, scoreQuestion, starsFor } from '../src/index.ts';
import { classify, effect, effectExpected } from './fixtures.ts';

const OPTION_IDS = ['o_a1b2', 'o_c3d4', 'o_e5f6', 'o_g7h8', 'o_k9m2'];
const CATEGORIES = ['asset', 'liability', 'profitability', 'not_in_books'];
const classifyKey = (item: { account?: string; ratio?: string }) =>
  item.account === 'cash' ? 'asset' : item.account ? 'liability' : item.ratio ? 'profitability' : undefined;

describe('性質', () => {
  test.prop([
    fc.subarray(OPTION_IDS, { minLength: 1 }),
    fc.subarray(OPTION_IDS, { minLength: 2, maxLength: 4 }),
    fc.constantFrom('any_correct', 'all_correct'),
  ])('multi_choice 的得分只有 0 或 1，而且 correct 與得分一致', (selected, correctOptionIds, scoringMode) => {
    const r = scoreMultiChoice(selected, { optionIds: OPTION_IDS, correctOptionIds, scoringMode });
    expect([0, 1]).toContain(r.score);
    expect(r.correct).toBe(r.score === 1);
    if (r.detail.kind === 'multi_choice') {
      expect(r.detail.options.map((o) => o.id)).toEqual(OPTION_IDS);
      const any = scoringMode === 'any_correct';
      for (const o of r.detail.options) {
        const isCorrect = correctOptionIds.includes(o.id);
        const isSelected = selected.includes(o.id);
        expect(o.status).toBe(
          isCorrect
            ? isSelected
              ? 'correct_selected'
              : any
                ? 'also_reasonable'
                : 'correct_not_selected'
            : isSelected
              ? 'wrong_selected'
              : 'wrong_not_selected',
        );
      }
    }
  });

  test.prop([fc.dictionary(fc.constantFrom('it_2k4m', 'it_3n5p', 'it_4q6r', 'it_5s7t'), fc.constantFrom(...CATEGORIES))])(
    'classify 的得分是答對比例，介於 0 到 1',
    (answer) => {
      const r = scoreQuestion(classify, answer, { classifyKey });
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
      if (r.detail.kind === 'classify') {
        expect(r.score).toBe(r.detail.correctCount / r.detail.total);
        expect(r.correct).toBe(r.detail.correctCount === r.detail.total);
      }
    },
  );

  test.prop([
    fc.dictionary(fc.constantFrom('t1', 't2', 't3'), fc.oneof(fc.constantFrom('up', 'down', 'unchanged'), fc.integer({ min: -100000, max: 100000 }))),
    fc.constantFrom('allOrNothing', 'perTarget'),
  ])('transaction_effect 的得分在 0 到 1，allOrNothing 只有 0 或 1，perTarget 不低於 allOrNothing', (answer, effectScoring) => {
    const r = scoreQuestion(effect, answer, { expected: effectExpected, effectScoring });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(1);
    if (effectScoring === 'allOrNothing') expect([0, 1]).toContain(r.score);
    const other = scoreQuestion(effect, answer, { expected: effectExpected, effectScoring: 'perTarget' });
    expect(other.score).toBeGreaterThanOrEqual(r.score);
    expect(other.correct).toBe(r.correct);
  });

  test.prop([fc.integer({ min: 1, max: 12 }), fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true })])(
    '星星隨得分單調不減，且在 0 到 3',
    (n, a, b) => {
      const lo = Math.min(a, b) * n;
      const hi = Math.max(a, b) * n;
      expect(starsFor(lo, n)).toBeLessThanOrEqual(starsFor(hi, n));
      expect([0, 1, 2, 3]).toContain(starsFor(hi, n));
      expect(starsFor(n, n)).toBe(3);
    },
  );
});
