// 計時（03 第 2.10 節）：時間上限、寬鬆加倍、剩餘秒數與設定解析
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SECONDS_PER_QUESTION,
  parseTimerSettings,
  remainingSecondsOf,
  splitSeconds,
  timerDisplayValues,
  timerTotalMs,
  usedSecondsOf,
} from '../src/features/quiz/timer.ts';

describe('timerTotalMs', () => {
  it('預設是每題 75 秒乘以計分題題數；寬鬆加倍', () => {
    expect(DEFAULT_SECONDS_PER_QUESTION).toBe(75);
    expect(timerTotalMs({ scoredCount: 6, relaxed: false })).toBe(6 * 75 * 1000);
    expect(timerTotalMs({ scoredCount: 6, relaxed: true })).toBe(6 * 75 * 2 * 1000);
  });
  it('關卡另給 timerSeconds 時以它為準；沒有計分題也沒有建議秒數時是 0', () => {
    expect(timerTotalMs({ scoredCount: 6, levelTimerSeconds: 300, relaxed: false })).toBe(300_000);
    expect(timerTotalMs({ scoredCount: 6, levelTimerSeconds: 300, relaxed: true })).toBe(600_000);
    expect(timerTotalMs({ scoredCount: 0, relaxed: false })).toBe(0);
  });
});

describe('remainingSecondsOf、splitSeconds、timerDisplayValues', () => {
  it('無條件進位到整秒，不會是負數；拆成分與秒', () => {
    expect(remainingSecondsOf(270_000)).toBe(270);
    expect(remainingSecondsOf(269_001)).toBe(270);
    expect(remainingSecondsOf(-5)).toBe(0);
    expect(splitSeconds(270)).toEqual({ minutes: 4, seconds: 30 });
    expect(splitSeconds(59)).toEqual({ minutes: 0, seconds: 59 });
  });
  it('沒有開啟計時時回 null', () => {
    expect(timerDisplayValues({ enabled: false, remainingMs: 1000, paused: false })).toBeNull();
    expect(timerDisplayValues({ enabled: true, remainingMs: 270_000, paused: true })).toEqual({ remainingSeconds: 270, paused: true });
  });
});

describe('parseTimerSettings', () => {
  it('只有 true 才算開啟', () => {
    expect(parseTimerSettings(undefined, undefined)).toEqual({ enabled: false, relaxed: false, announce: true });
    expect(parseTimerSettings(true, 'yes')).toEqual({ enabled: true, relaxed: false, announce: true });
    expect(parseTimerSettings(true, true)).toEqual({ enabled: true, relaxed: true, announce: true });
  });
  it('提醒預設開啟，只有存成 false 才關閉', () => {
    expect(parseTimerSettings(undefined, undefined, false).announce).toBe(false);
    expect(parseTimerSettings(undefined, undefined, 'no').announce).toBe(true);
    expect(parseTimerSettings(undefined, undefined, true).announce).toBe(true);
  });
});

describe('usedSecondsOf', () => {
  it('無條件捨去到整秒，不會是負數', () => {
    expect(usedSecondsOf(0)).toBe(0);
    expect(usedSecondsOf(1999)).toBe(1);
    expect(usedSecondsOf(192_000)).toBe(192);
    expect(usedSecondsOf(-5)).toBe(0);
  });
});
