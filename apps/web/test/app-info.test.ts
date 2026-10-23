// nowIso 要帶本地時區位移，而且前十碼要等於本地日期（錯題本的到期日由 quiz 從前十碼取本地日期，06 第 4.2 節）
import { describe, expect, it } from 'vitest';
import { isIsoDateTime } from '@ledgerland/progress';
import { localDateOf } from '@ledgerland/quiz';
import { nowIso, todayLocal } from '../src/lib/progress/app-info.ts';

describe('nowIso', () => {
  it('前十碼是本地日期，帶時區位移，而且是合法的 ISO 8601', () => {
    const d = new Date(2026, 9, 24, 0, 11, 56, 123); // 本地時間 2026-10-24 00:11:56.123
    const iso = nowIso(d);
    expect(iso.slice(0, 23)).toBe('2026-10-24T00:11:56.123');
    expect(iso).toMatch(/[+-]\d{2}:\d{2}$/);
    expect(localDateOf(iso)).toBe(todayLocal(d));
    expect(isIsoDateTime(iso)).toBe(true);
    expect(new Date(iso).getTime()).toBe(d.getTime());
  });
});
