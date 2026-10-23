// 04 第 3 節的單元測試：Money 安全整數、bigint 有理數、四捨五入（.5 遠離 0）、精確值的序列化。全部用自編數字。
import { describe, expect, it } from 'vitest';
import {
  MONEY_MAX,
  MONEY_MIN,
  RAT_ONE,
  RAT_ZERO,
  addMoney,
  isMoney,
  rat,
  ratAdd,
  ratCmp,
  ratDiv,
  ratEq,
  ratFromDecimalString,
  ratFromExact,
  ratFromInt,
  ratIsInteger,
  ratIsNegative,
  ratIsZero,
  ratMax,
  ratMin,
  ratMul,
  ratNeg,
  ratRoundHalfAwayFromZero,
  ratSub,
  ratToDisplay,
  ratToExact,
  ratToMoney,
  ratToNumber,
  subMoney,
  unwrap,
} from '../src/index.ts';

const d = ratFromDecimalString;

describe('Money', () => {
  it('isMoney 只接受安全整數', () => {
    expect(isMoney(0)).toBe(true);
    expect(isMoney(-123456)).toBe(true);
    expect(isMoney(MONEY_MAX)).toBe(true);
    expect(isMoney(MONEY_MAX + 1)).toBe(false);
    expect(isMoney(1.5)).toBe(false);
    expect(isMoney(Number.NaN)).toBe(false);
    expect(isMoney('12')).toBe(false);
    expect(isMoney(12n)).toBe(false);
  });
  it('addMoney 與 subMoney 回傳 Result', () => {
    expect(addMoney(120000, 45000)).toEqual({ ok: true, value: 165000 });
    expect(subMoney(120000, 45000)).toEqual({ ok: true, value: 75000 });
    expect(subMoney(45000, 120000)).toEqual({ ok: true, value: -75000 });
  });
  it('溢位回傳 money.overflow', () => {
    expect(addMoney(MONEY_MAX, 1)).toMatchObject({ ok: false, error: { code: 'money.overflow', message: { key: 'core.error.money.overflow' } } });
    expect(subMoney(MONEY_MIN, 1).ok).toBe(false);
    expect(addMoney(MONEY_MAX, 0).ok).toBe(true);
  });
  it('非安全整數的輸入是程式錯誤', () => {
    expect(() => addMoney(1.5, 1)).toThrow(TypeError);
    expect(() => subMoney(1, MONEY_MAX + 2)).toThrow(TypeError);
  });
});

describe('Rat 建構與化簡', () => {
  it('永遠是最簡分數、分母為正', () => {
    expect(rat(6n, 8n)).toEqual({ num: 3n, den: 4n });
    expect(rat(6n, -8n)).toEqual({ num: -3n, den: 4n });
    expect(rat(-6n, -8n)).toEqual({ num: 3n, den: 4n });
    expect(rat(0n, -5n)).toEqual({ num: 0n, den: 1n });
    expect(rat(7n)).toEqual({ num: 7n, den: 1n });
    expect(() => rat(1n, 0n)).toThrow(RangeError);
  });
  it('ratFromInt 接受安全整數與 bigint', () => {
    expect(ratFromInt(42)).toEqual({ num: 42n, den: 1n });
    expect(ratFromInt(-42n)).toEqual({ num: -42n, den: 1n });
    expect(() => ratFromInt(0.5)).toThrow(TypeError);
    expect(() => ratFromInt(MONEY_MAX + 1)).toThrow(TypeError);
  });
  it('ratFromDecimalString 精確還原字面值', () => {
    expect(d('0.2')).toEqual({ num: 1n, den: 5n });
    expect(d('-12.50')).toEqual({ num: -25n, den: 2n });
    expect(d('007')).toEqual({ num: 7n, den: 1n });
    expect(d('0.000')).toEqual(RAT_ZERO);
    expect(d('1')).toEqual(RAT_ONE);
    for (const bad of ['abc', '1e5', '1.', '.5', '0x1f', '', '1,000', ' 1']) expect(() => d(bad)).toThrow(TypeError);
  });
});

describe('Rat 運算', () => {
  it('0.1 加 0.2 精確等於 0.3', () => {
    expect(ratEq(ratAdd(d('0.1'), d('0.2')), d('0.3'))).toBe(true);
    expect(ratIsZero(ratSub(ratAdd(d('0.1'), d('0.2')), d('0.3')))).toBe(true);
  });
  it('加減乘除', () => {
    expect(ratAdd(rat(1n, 3n), rat(1n, 6n))).toEqual({ num: 1n, den: 2n });
    expect(ratSub(rat(1n, 3n), rat(1n, 2n))).toEqual({ num: -1n, den: 6n });
    expect(ratMul(rat(2n, 3n), rat(9n, 4n))).toEqual({ num: 3n, den: 2n });
    expect(unwrap(ratDiv(rat(2n, 3n), rat(4n, 9n)))).toEqual({ num: 3n, den: 2n });
    expect(ratNeg(rat(5n, 7n))).toEqual({ num: -5n, den: 7n });
  });
  it('除以 0 回傳 expr.division_by_zero', () => {
    expect(ratDiv(ratFromInt(5), RAT_ZERO)).toMatchObject({ ok: false, error: { code: 'expr.division_by_zero' } });
    expect(ratDiv(RAT_ZERO, ratFromInt(5))).toEqual({ ok: true, value: RAT_ZERO });
  });
  it('比較與判定', () => {
    expect(ratCmp(rat(1n, 3n), rat(2n, 6n))).toBe(0);
    expect(ratCmp(rat(-1n, 3n), RAT_ZERO)).toBe(-1);
    expect(ratCmp(rat(5n, 2n), rat(7n, 3n))).toBe(1);
    expect(ratIsNegative(rat(-1n, 9n))).toBe(true);
    expect(ratIsNegative(RAT_ZERO)).toBe(false);
    expect(ratIsInteger(rat(8n, 4n))).toBe(true);
    expect(ratIsInteger(rat(8n, 3n))).toBe(false);
    expect(ratMin(rat(1n, 2n), rat(1n, 3n))).toEqual({ num: 1n, den: 3n });
    expect(ratMax(rat(1n, 2n), rat(1n, 3n))).toEqual({ num: 1n, den: 2n });
  });
});

describe('ratToMoney', () => {
  it('整數且在安全範圍內才成功', () => {
    expect(ratToMoney(rat(90000n))).toEqual({ ok: true, value: 90000 });
    expect(ratToMoney(rat(-250n, 5n))).toEqual({ ok: true, value: -50 });
  });
  it('非整數回傳 money.not_integer', () => {
    expect(ratToMoney(d('89999.75'))).toMatchObject({ ok: false, error: { code: 'money.not_integer' } });
  });
  it('超出安全範圍回傳 money.overflow', () => {
    expect(ratToMoney(rat(BigInt(MONEY_MAX) + 1n))).toMatchObject({ ok: false, error: { code: 'money.overflow' } });
    expect(ratToMoney(rat(BigInt(MONEY_MIN) - 1n)).ok).toBe(false);
    expect(ratToMoney(rat(BigInt(MONEY_MIN))).ok).toBe(true);
  });
});

describe('ratRoundHalfAwayFromZero（Excel ROUND）', () => {
  const cases: [string, bigint][] = [
    ['89999.75', 90000n],
    ['89999.5', 90000n],
    ['89999.25', 89999n],
    ['2.5', 3n],
    ['-2.5', -3n],
    ['0.5', 1n],
    ['-0.5', -1n],
    ['0.49999', 0n],
    ['-0.49999', 0n],
    ['1.5', 2n],
    ['-1.5', -2n],
    ['-1.4999', -1n],
    ['1234567.4', 1234567n],
    ['-1234567.6', -1234568n],
    ['42', 42n],
    ['-42', -42n],
  ];
  it.each(cases)('%s 到 %s', (input, expected) => {
    expect(ratRoundHalfAwayFromZero(d(input))).toEqual({ num: expected, den: 1n });
  });
  it('設備成本 359999 除以 4 年先得 89999.75 再四捨五入為 90000', () => {
    const exact = unwrap(ratDiv(ratFromInt(359999), ratFromInt(4)));
    expect(exact).toEqual(d('89999.75'));
    expect(ratToMoney(ratRoundHalfAwayFromZero(exact))).toEqual({ ok: true, value: 90000 });
  });
  it('三分之一這類無窮小數也照規則', () => {
    expect(ratRoundHalfAwayFromZero(rat(1n, 3n))).toEqual({ num: 0n, den: 1n });
    expect(ratRoundHalfAwayFromZero(rat(2n, 3n))).toEqual({ num: 1n, den: 1n });
    expect(ratRoundHalfAwayFromZero(rat(-2n, 3n))).toEqual({ num: -1n, den: 1n });
  });
});

describe('浮點近似與顯示值', () => {
  it('ratToNumber', () => {
    expect(ratToNumber(rat(1n, 4n))).toBe(0.25);
    expect(ratToNumber(rat(-3n, 2n))).toBe(-1.5);
    expect(ratToNumber(RAT_ZERO)).toBe(0);
    // 超過安全範圍的分子分母走放大再縮回的路徑
    const big = rat(10n ** 30n + 1n, 4n * 10n ** 20n);
    expect(ratToNumber(big)).toBeCloseTo(2.5e9, 0);
    const bigDen = rat(1n, 10n ** 20n);
    expect(ratToNumber(bigDen)).toBeCloseTo(1e-20, 25);
  });
  it('ratToDisplay 先在精確值上四捨五入再轉 number', () => {
    expect(ratToDisplay(d('0.125'), 2)).toBe(0.13);
    expect(ratToDisplay(d('-0.125'), 2)).toBe(-0.13);
    expect(ratToDisplay(d('0.124'), 2)).toBe(0.12);
    expect(ratToDisplay(rat(2n, 3n), 4)).toBe(0.6667);
    expect(ratToDisplay(d('2.5'), 0)).toBe(3);
    expect(ratToDisplay(d('-2.5'), 0)).toBe(-3);
    expect(ratToDisplay(rat(1n, 3n), 0)).toBe(0);
    // 百分比以百分點表示時，呼叫端先乘 100 再給 displayDecimals
    expect(ratToDisplay(ratMul(rat(1n, 8n), ratFromInt(100)), 1)).toBe(12.5);
    expect(() => ratToDisplay(RAT_ONE, -1)).toThrow(RangeError);
    expect(() => ratToDisplay(RAT_ONE, 1.5)).toThrow(RangeError);
    expect(() => ratToDisplay(RAT_ONE, 21)).toThrow(RangeError);
  });
  it('ratToExact 與 ratFromExact 互為反函式', () => {
    const x = rat(-123456789012345678901234567891n, 7n);
    expect(ratToExact(x)).toEqual({ num: '-123456789012345678901234567891', den: '7' });
    expect(ratFromExact(ratToExact(x))).toEqual(x);
    expect(ratFromExact({ num: '6', den: '4' })).toEqual({ num: 3n, den: 2n });
    expect(() => ratFromExact({ num: '1.5', den: '1' })).toThrow(TypeError);
    expect(() => ratFromExact({ num: '1', den: '-1' })).toThrow(TypeError);
  });
});
