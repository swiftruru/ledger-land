// 章節徽章的讀取端（03 第 2.10 節）：由 unlock 算狀態與取得日期
import { describe, expect, it } from 'vitest';
import { badgeStatusOf, badgeUnlockId, isoDatePart, masteryUnlockId } from '../src/features/badges/badges.ts';

describe('badgeStatusOf', () => {
  const unlocks = new Map([
    [badgeUnlockId('ch_000001'), '2026-10-20T21:30:00.000+08:00'],
    [badgeUnlockId('ch_000002'), '2026-10-21T08:00:00.000+08:00'],
    [masteryUnlockId('ch_000002'), '2026-10-22T08:00:00.000+08:00'],
    [masteryUnlockId('ch_000003'), '2026-10-23T08:00:00.000+08:00'],
  ]);
  it('沒有 unlock 是 locked；只有完成是 done；有精通就是 mastery（即使缺完成那一筆）', () => {
    expect(badgeStatusOf(unlocks, 'ch_000009')).toEqual({ state: 'locked' });
    expect(badgeStatusOf(unlocks, 'ch_000001')).toEqual({ state: 'done', doneAt: '2026-10-20T21:30:00.000+08:00' });
    expect(badgeStatusOf(unlocks, 'ch_000002')).toEqual({
      state: 'mastery',
      doneAt: '2026-10-21T08:00:00.000+08:00',
      masteryAt: '2026-10-22T08:00:00.000+08:00',
    });
    expect(badgeStatusOf(unlocks, 'ch_000003').state).toBe('mastery');
  });
  it('日期取 ISO 前十碼（nowIso 帶本地時區位移，就是裝置的本地日期）', () => {
    expect(isoDatePart('2026-10-20T21:30:00.000+08:00')).toBe('2026-10-20');
  });
});
