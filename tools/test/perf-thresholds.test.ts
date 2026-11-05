// Lighthouse 門檻依執行器速度的校正（tools/lib/perf-thresholds.mjs，06 第 8.1 節）：參考速度以上不放寬，慢的執行器 TBT 最多 2 倍、
// 效能分數的下限最多讓 slack
import { describe, expect, it } from 'vitest';
import { performanceMinOf, tbtFactorOf } from '../lib/perf-thresholds.mjs';

describe('tbtFactorOf', () => {
  it('參考速度以上是 1', () => {
    expect(tbtFactorOf(3000, 3000)).toBe(1);
    expect(tbtFactorOf(3000, 4119)).toBe(1);
  });
  it('慢的執行器是 (參考 / 實測) 的平方，最多 2', () => {
    expect(tbtFactorOf(3000, 2500)).toBeCloseTo(1.44, 5);
    expect(tbtFactorOf(3000, 2006)).toBe(2);
    expect(tbtFactorOf(3000, 500)).toBe(2);
  });
  it('沒有參考值或量不到 benchmarkIndex 時不校正', () => {
    expect(tbtFactorOf(null, 2000)).toBe(1);
    expect(tbtFactorOf(undefined, 2000)).toBe(1);
    expect(tbtFactorOf(3000, 0)).toBe(1);
    expect(tbtFactorOf(3000, Number.NaN)).toBe(1);
  });
});

describe('performanceMinOf', () => {
  it('參考速度（倍數 1）下限不動', () => {
    expect(performanceMinOf(0.9, 0.05, 1)).toBe(0.9);
    expect(performanceMinOf(0.9, 0.05, tbtFactorOf(3000, 3200))).toBe(0.9);
  });
  it('最慢（倍數 2）讓整個 slack，中間照比例', () => {
    expect(performanceMinOf(0.9, 0.05, 2)).toBe(0.85);
    expect(performanceMinOf(0.9, 0.05, tbtFactorOf(3000, 2500))).toBe(0.878);
    expect(performanceMinOf(0.9, 0.05, 1.5)).toBe(0.875);
  });
  it('倍數超過 2 也只讓到 slack', () => {
    expect(performanceMinOf(0.9, 0.05, 5)).toBe(0.85);
  });
  it('沒有設定 slack 時不校正', () => {
    expect(performanceMinOf(0.9, 0, 2)).toBe(0.9);
    expect(performanceMinOf(0.9, Number.NaN, 2)).toBe(0.9);
  });
  it('2026-11-05 的實際數字：慢的執行器上 0.89 過關，參考速度的機器上 0.89 仍然不過', () => {
    const slow = performanceMinOf(0.9, 0.05, tbtFactorOf(3000, 2006));
    expect(0.89 >= slow).toBe(true);
    expect(0.84 >= slow).toBe(false);
    expect(0.89 >= performanceMinOf(0.9, 0.05, tbtFactorOf(3000, 3000))).toBe(false);
  });
});
