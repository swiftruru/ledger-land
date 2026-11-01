// 數字滾動：端點、單調、到時間等於 to，時長和 tokens 的 --ll-dur-lab 一致
import { describe, expect, it } from 'vitest';
import { motion } from '@ledgerland/tokens';
import { LAB_ROLL_MS, easeOut, rollingValue } from '../src/features/lab/rolling.ts';

describe('rollingValue', () => {
  it('時長和 tokens 的 motion.duration.lab 相同', () => {
    expect(`${LAB_ROLL_MS}ms`).toBe(motion.duration.lab.normal);
    expect(motion.duration.lab.reduced).toBe('0ms');
  });
  it('0 毫秒是 from，到時間與超過都是 to；時長 0 直接是 to', () => {
    expect(rollingValue(450_000, 3_450_000, 0)).toBe(450_000);
    expect(rollingValue(450_000, 3_450_000, LAB_ROLL_MS)).toBe(3_450_000);
    expect(rollingValue(450_000, 3_450_000, 9_999)).toBe(3_450_000);
    expect(rollingValue(450_000, 3_450_000, 10, 0)).toBe(3_450_000);
  });
  it('增加時單調不減、減少時單調不增，而且都是整數', () => {
    let prev = rollingValue(0, 1_500_000, 0);
    for (let ms = 0; ms <= LAB_ROLL_MS; ms += 15) {
      const v = rollingValue(0, 1_500_000, ms);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(Number.isInteger(v)).toBe(true);
      prev = v;
    }
    prev = rollingValue(1_500_000, 0, 0);
    for (let ms = 0; ms <= LAB_ROLL_MS; ms += 15) {
      const v = rollingValue(1_500_000, 0, ms);
      expect(v).toBeLessThanOrEqual(prev);
      prev = v;
    }
  });
  it('曲線是先快後慢：一半時間已經走超過一半', () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(0.5)).toBeGreaterThan(0.8);
    expect(rollingValue(0, 1000, LAB_ROLL_MS / 2)).toBeGreaterThan(800);
  });
});
