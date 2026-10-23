// 數字題比對（04 第 12.5 節）：N/A 規則、容許誤差的預設與覆寫、.5 邊界（遠離 0）、百分點、不同作答單位
import { describe, expect, it } from 'vitest';
import { scoreNumeric } from '../src/index.ts';
import { NA_RESULT, ratioResult } from './fixtures.ts';

const value = (v: number) => ({ kind: 'value', value: v }) as const;
const NA = { kind: 'na' } as const;

describe('N/A', () => {
  it('正解 na 時只有按 N/A 才對（acceptStatus 含 na）', () => {
    expect(scoreNumeric(NA, NA_RESULT, { decimals: 2, answerUnit: 'percent', acceptStatus: ['na'] })).toMatchObject({
      score: 1,
      correct: true,
      detail: { expectedStatus: 'na', expectedValue: null, submitted: null },
    });
    expect(scoreNumeric(value(0), NA_RESULT, { decimals: 2, answerUnit: 'percent', acceptStatus: ['na'] })).toMatchObject({
      score: 0,
      correct: false,
      detail: { submitted: 0, difference: null },
    });
  });
  it('正解是數字時按 N/A 算錯；沒有 acceptStatus 時按 N/A 也算錯', () => {
    expect(scoreNumeric(NA, ratioResult(), { decimals: 2, answerUnit: 'percent', acceptStatus: ['na'] }).correct).toBe(false);
    expect(scoreNumeric(NA, NA_RESULT, { decimals: 2, answerUnit: 'percent' }).correct).toBe(false);
  });
  it('正解是 zero 時填 0 才對、N/A 算錯（N/A 與 0 不同）', () => {
    const zero = ratioResult({ status: 'zero', exact: { num: '0', den: '1' }, value: 0, displayValue: 0 });
    expect(scoreNumeric(value(0), zero, { decimals: 2, answerUnit: 'percent' }).correct).toBe(true);
    expect(scoreNumeric(NA, zero, { decimals: 2, answerUnit: 'percent', acceptStatus: ['na'] }).correct).toBe(false);
  });
  it('正解是 not_meaningful 時數字一律算錯（題目不該出）', () => {
    const nm = ratioResult({ status: 'not_meaningful', exact: { num: '1', den: '8' } });
    expect(scoreNumeric(value(12.5), nm, { decimals: 2, answerUnit: 'percent' }).correct).toBe(false);
  });
});

describe('百分點與單位', () => {
  it('answerUnit 為 percent 時精確值乘 100 再比，容許誤差以百分點計', () => {
    const r = scoreNumeric(value(12.5), ratioResult(), { decimals: 2, answerUnit: 'percent' });
    expect(r).toMatchObject({ correct: true, detail: { expectedValue: 12.5, submitted: 12.5, difference: 0, tolerance: 0.01 } });
    expect(scoreNumeric(value(12.51), ratioResult(), { decimals: 2, answerUnit: 'percent' }).correct).toBe(true);
    expect(scoreNumeric(value(12.52), ratioResult(), { decimals: 2, answerUnit: 'percent' }).correct).toBe(false);
    expect(scoreNumeric(value(0.125), ratioResult(), { decimals: 2, answerUnit: 'percent' }).correct).toBe(false);
  });
  it('以倍數作答時不乘 100（例如流動比率 2.5 倍）', () => {
    const times = ratioResult({ ratioRef: 'current_ratio@excel', exact: { num: '5', den: '2' }, value: 2.5, displayValue: 2.5 });
    expect(scoreNumeric(value(2.5), times, { decimals: 2, answerUnit: 'multiple' })).toMatchObject({ correct: true, detail: { expectedValue: 2.5 } });
    expect(scoreNumeric(value(250), times, { decimals: 2, answerUnit: 'percent' }).correct).toBe(true);
    expect(scoreNumeric(value(250), times, { decimals: 2, answerUnit: 'multiple' }).correct).toBe(false);
  });
});

describe('容許誤差與四捨五入', () => {
  const third = ratioResult({ exact: { num: '1', den: '3' }, value: 1 / 3, displayValue: 33.33 });
  it('預設是 10 的負 decimals 次方：最後一位 ±1', () => {
    expect(scoreNumeric(value(33.33), third, { decimals: 2, answerUnit: 'percent' })).toMatchObject({
      correct: true,
      detail: { expectedValue: 33.33, tolerance: 0.01 },
    });
    expect(scoreNumeric(value(33.34), third, { decimals: 2, answerUnit: 'percent' }).correct).toBe(true);
    expect(scoreNumeric(value(33.32), third, { decimals: 2, answerUnit: 'percent' }).correct).toBe(true);
    expect(scoreNumeric(value(33.35), third, { decimals: 2, answerUnit: 'percent' }).correct).toBe(false);
    expect(scoreNumeric(value(33), third, { decimals: 0, answerUnit: 'percent' }).correct).toBe(true);
    expect(scoreNumeric(value(35), third, { decimals: 0, answerUnit: 'percent' }).correct).toBe(false);
  });
  it('題目可覆寫 tolerance；0 表示要和四捨五入後的值完全相同', () => {
    expect(scoreNumeric(value(33.4), third, { decimals: 2, tolerance: 0.1, answerUnit: 'percent' }).correct).toBe(true);
    expect(scoreNumeric(value(33.34), third, { decimals: 2, tolerance: 0, answerUnit: 'percent' }).correct).toBe(false);
    expect(scoreNumeric(value(33.33), third, { decimals: 2, tolerance: 0, answerUnit: 'percent' }).correct).toBe(true);
  });
  it('.5 邊界遠離 0：0.125 → 2 位是 12.50，1 位是 12.5，0 位是 13；負數同樣遠離 0', () => {
    expect(scoreNumeric(value(13), ratioResult(), { decimals: 0, answerUnit: 'percent' })).toMatchObject({ correct: true, detail: { expectedValue: 13 } });
    expect(scoreNumeric(value(12), ratioResult(), { decimals: 0, answerUnit: 'percent' }).correct).toBe(true);
    expect(scoreNumeric(value(11), ratioResult(), { decimals: 0, answerUnit: 'percent' }).correct).toBe(false);
    const eighth = ratioResult({ exact: { num: '1', den: '8' } });
    expect(scoreNumeric(value(0.13), eighth, { decimals: 2, answerUnit: 'multiple' })).toMatchObject({ correct: true, detail: { expectedValue: 0.13 } });
    expect(scoreNumeric(value(0.12), eighth, { decimals: 2, answerUnit: 'multiple' }).correct).toBe(true);
    expect(scoreNumeric(value(0.11), eighth, { decimals: 2, answerUnit: 'multiple' }).correct).toBe(false);
    const negative = ratioResult({ exact: { num: '-1', den: '8' }, value: -0.125, displayValue: -12.5 });
    expect(scoreNumeric(value(-13), negative, { decimals: 0, answerUnit: 'percent' })).toMatchObject({ correct: true, detail: { expectedValue: -13 } });
    expect(scoreNumeric(value(-12), negative, { decimals: 0, answerUnit: 'percent' }).correct).toBe(true);
    expect(scoreNumeric(value(-11), negative, { decimals: 0, answerUnit: 'percent' }).correct).toBe(false);
  });
  it('比對在有理數上進行：0.1 加 0.2 這類浮點誤差不影響', () => {
    const r = ratioResult({ exact: { num: '3', den: '10' }, value: 0.3, displayValue: 30 });
    expect(scoreNumeric(value(0.1 + 0.2), r, { decimals: 2, tolerance: 0, answerUnit: 'multiple' }).correct).toBe(false);
    expect(scoreNumeric(value(0.3), r, { decimals: 2, tolerance: 0, answerUnit: 'multiple' }).correct).toBe(true);
    expect(scoreNumeric(value(0.1 + 0.2), r, { decimals: 2, answerUnit: 'multiple' }).correct).toBe(true);
  });
  it('decimals 與 tolerance 不合法是程式錯誤', () => {
    expect(() => scoreNumeric(value(1), ratioResult(), { decimals: -1, answerUnit: 'percent' })).toThrow(RangeError);
    expect(() => scoreNumeric(value(1), ratioResult(), { decimals: 2, tolerance: -0.1, answerUnit: 'percent' })).toThrow(RangeError);
  });
});
