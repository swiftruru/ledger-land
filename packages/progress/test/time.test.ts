import { describe, expect, it } from 'vitest';
import { MS_PER_DAY, compareIso, diffMs, earliestIso, isLocalDate, isoToEpochMs, latestIso } from '../src/index.ts';

describe('ISO 時間（不用 Date）', () => {
  it('epoch 與 Z、位移、毫秒都正確', () => {
    expect(isoToEpochMs('1970-01-01T00:00:00Z')).toBe(0);
    expect(isoToEpochMs('1970-01-02T00:00:00.500Z')).toBe(MS_PER_DAY + 500);
    expect(isoToEpochMs('2026-03-01T08:00:00+08:00')).toBe(isoToEpochMs('2026-03-01T00:00:00Z'));
    expect(isoToEpochMs('2026-03-01T00:00:00-05:30')).toBe(isoToEpochMs('2026-03-01T05:30:00Z'));
    expect(isoToEpochMs('2000-02-29T12:34:56.7Z')).toBe(951827696700);
  });
  it('格式不合回 undefined；比較跨時區正確', () => {
    expect(isoToEpochMs('2026-03-01')).toBeUndefined();
    expect(isoToEpochMs('2026-13-01T00:00:00Z')).toBeUndefined();
    expect(compareIso('2026-03-01T08:00:00+08:00', '2026-03-01T00:00:00Z')).toBe(0);
    expect(compareIso('2026-03-01T07:00:00+08:00', '2026-03-01T00:00:00Z')).toBe(-1);
    expect(earliestIso('2026-03-02T00:00:00Z', '2026-03-01T23:00:00-02:00')).toBe('2026-03-02T00:00:00Z');
    expect(latestIso('2026-03-02T00:00:00Z', '2026-03-01T23:00:00-02:00')).toBe('2026-03-01T23:00:00-02:00');
    expect(diffMs('2026-03-01T00:00:00Z', '2026-03-08T00:00:00Z')).toBe(7 * MS_PER_DAY);
    expect(() => compareIso('x', '2026-03-01T00:00:00Z')).toThrow(TypeError);
  });
  it('本地日期格式', () => {
    expect(isLocalDate('2026-03-02')).toBe(true);
    expect(isLocalDate('2026-3-2')).toBe(false);
    expect(isLocalDate('2026-03-02T00:00:00Z')).toBe(false);
  });
});
