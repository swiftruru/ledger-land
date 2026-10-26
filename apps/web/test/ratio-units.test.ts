// 天數題（answerUnit: days，quiz-14）：輸入「36.50天」「36.5日」「36.5 days」都讀得懂，判分與「系統讀到」用同一個規則；別的單位字樣照樣讀不懂
import { describe, expect, it } from 'vitest';
import { toQuizAnswer } from '../src/features/quiz/answers.ts';
import { normalizeRatioInput, numericUnitOf } from '../src/features/quiz/ratio-units.ts';
import { qRatioNumeric } from './quiz-fixtures.ts';

describe('numericUnitOf 與 normalizeRatioInput', () => {
  it('days 對到天數單位；其他單位不變', () => {
    expect(numericUnitOf('days')).toBe('days');
    expect(numericUnitOf('turnover')).toBe('turns');
    expect(numericUnitOf('multiple')).toBe('times');
    expect(numericUnitOf(undefined)).toBe('plain');
  });

  it.each([
    ['36.50天', { ok: true, value: 36.5 }],
    ['36.5日', { ok: true, value: 36.5 }],
    ['36.5 days', { ok: true, value: 36.5 }],
    ['1 day', { ok: true, value: 1 }],
    ['３６．５ 天', { ok: true, value: 36.5 }],
    ['1.5次', { ok: false, reason: 'invalid' }],
    ['天', { ok: false, reason: 'invalid' }],
  ])('%s', (raw, expected) => {
    expect(normalizeRatioInput(raw, 'days')).toEqual(expected);
  });

  it('非天數單位交給 normalizeNumericInput（百分比照樣讀「12.5%」）', () => {
    expect(normalizeRatioInput('12.5%', 'percent')).toEqual({ ok: true, value: 12.5 });
    expect(normalizeRatioInput('36.5天', 'plain')).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('toQuizAnswer（天數題）', () => {
  it('「36.50天」判分時讀成 36.5，不是讀不懂的極大值', () => {
    const q = { ...qRatioNumeric, answerUnit: 'days' };
    expect(toQuizAnswer(q, { raw: '36.50天' })).toEqual({ kind: 'value', value: 36.5 });
  });
});
