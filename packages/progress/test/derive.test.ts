// oxlint-disable vitest/no-standalone-expect -- 性質測試用 @fast-check/vitest 的 test.prop，expect 在它的回呼裡
import { describe, expect, it } from 'vitest';
import { fc, test } from '@fast-check/vitest';
import { starsFor } from '@ledgerland/quiz';
import { DEFAULT_REMINDER_POLICY, deriveLevelProgress, persistReminderDue, recomputeWrongCount } from '../src/index.ts';
import { LV1, LV2, Q1, Q2, Q3, T0, T1, T2, T3, attempt } from './fixtures.ts';

const levels = [
  { levelId: LV1, scoredQuestionIds: [Q1, Q2, Q3] },
  { levelId: LV2, scoredQuestionIds: [Q1] },
];

describe('deriveLevelProgress', () => {
  it('答完整關才算完成；星星與 quiz 的 starsFor 一致；重玩取最佳；lastPlayedAt 取最後', () => {
    const attempts = [
      attempt({ questionId: Q1, answeredAt: T0, correct: true }),
      attempt({ questionId: Q2, answeredAt: T0, correct: false, score: 0 }),
      attempt({ questionId: Q3, answeredAt: T1, correct: false, score: 0.5 }),
      // 第二次闖關：同一題再次出現就是新的一次
      attempt({ questionId: Q1, answeredAt: T2, correct: true }),
      attempt({ questionId: Q2, answeredAt: T2, correct: true }),
      attempt({ questionId: Q3, answeredAt: T3, correct: true }),
    ];
    const [lp] = deriveLevelProgress(attempts, levels);
    expect(lp).toEqual({ levelId: LV1, stars: starsFor(3, 3), bestScore: 1, firstCompletedAt: T1, lastPlayedAt: T3 });
    expect(lp?.stars).toBe(3);
    const firstRunOnly = deriveLevelProgress(attempts.slice(0, 3), levels)[0];
    expect(firstRunOnly?.stars).toBe(starsFor(1.5, 3));
    expect(firstRunOnly?.bestScore).toBe(0.5);
  });
  it('沒答完的關卡列出但沒有 firstCompletedAt；複習與實驗室的作答不算；沒有規格的關卡略過', () => {
    const attempts = [
      attempt({ questionId: Q1, answeredAt: T0 }),
      attempt({ questionId: Q2, answeredAt: T1, source: 'review' }),
      attempt({ questionId: Q3, answeredAt: T1, source: 'lab' }),
      attempt({ questionId: Q1, answeredAt: T2, levelId: 'lv_zzzzzzzz' }),
    ];
    expect(deriveLevelProgress(attempts, levels)).toEqual([{ levelId: LV1, stars: 0, bestScore: 0, lastPlayedAt: T0 }]);
  });
  it('可注入別的星星規則', () => {
    const attempts = [attempt({ questionId: Q1, answeredAt: T0, levelId: LV2 })];
    expect(deriveLevelProgress(attempts, levels, { starsFor: () => 2 })[0]?.stars).toBe(2);
  });
  test.prop([
    fc.array(fc.record({ q: fc.constantFrom(Q1, Q2, Q3), score: fc.constantFrom(0, 0.25, 0.5, 1), h: fc.integer({ min: 0, max: 23 }) }), {
      minLength: 3,
      maxLength: 12,
    }),
  ])('每一次完成的星星都等於 quiz 對同一組得分算出的星星，且 bestScore 在 0 到 1', (items) => {
    const attempts = items.map((it, i) =>
      attempt({
        attemptId: `a_${String(i + 1).padStart(12, '0')}`,
        questionId: it.q,
        answeredAt: `2026-01-01T${String(it.h).padStart(2, '0')}:00:00Z`,
        score: it.score,
        correct: it.score === 1,
      }),
    );
    const lp = deriveLevelProgress(attempts, levels)[0];
    expect(lp).toBeDefined();
    expect(lp!.bestScore).toBeGreaterThanOrEqual(0);
    expect(lp!.bestScore).toBeLessThanOrEqual(1);
    expect(lp!.stars).toBe(lp!.firstCompletedAt === undefined ? 0 : starsFor(lp!.bestScore * 3, 3));
  });
});

describe('recomputeWrongCount', () => {
  it('只數答錯的，不分 rev', () => {
    const wrong = recomputeWrongCount([
      attempt({ questionId: Q1, answeredAt: T0, correct: false }),
      attempt({ questionId: Q1, answeredAt: T1, correct: false, rev: 2 }),
      attempt({ questionId: Q1, answeredAt: T2, correct: true }),
      attempt({ questionId: Q2, answeredAt: T0, correct: true }),
    ]);
    expect(wrong.get(Q1)).toBe(2);
    expect(wrong.get(Q2)).toBeUndefined();
  });
});

describe('persistReminderDue（06 第 4.5 節）', () => {
  const base = { persisted: false, environment: 'browser' as const, levelsCompletedSinceExport: 0 };
  it('沒有 persistent：每完成 3 關提醒', () => {
    expect(persistReminderDue({ ...base, levelsCompletedSinceExport: 2 }, T3)).toEqual({ due: false });
    expect(persistReminderDue({ ...base, levelsCompletedSinceExport: 3 }, T3)).toEqual({ due: true, reason: 'levels' });
  });
  it('沒有 persistent：距上次匯出 7 天提醒（先到者）；從未匯出時以上次提醒起算', () => {
    expect(persistReminderDue({ ...base, lastExportedAt: '2026-03-01T00:00:00Z' }, '2026-03-07T23:59:59Z')).toEqual({ due: false });
    expect(persistReminderDue({ ...base, lastExportedAt: '2026-03-01T00:00:00Z' }, '2026-03-08T00:00:00Z')).toEqual({ due: true, reason: 'days' });
    expect(persistReminderDue({ ...base, lastRemindedAt: '2026-03-01T00:00:00Z' }, '2026-03-09T00:00:00Z')).toEqual({ due: true, reason: 'days' });
    expect(persistReminderDue(base, '2026-12-31T00:00:00Z')).toEqual({ due: false });
  });
  it('Safari 分頁與 App 內建瀏覽器：每完成 1 關就提醒，不論 persist 結果', () => {
    expect(persistReminderDue({ ...base, environment: 'safari-tab', persisted: true, levelsCompletedSinceExport: 1 }, T3)).toEqual({
      due: true,
      reason: 'levels',
    });
    expect(persistReminderDue({ ...base, environment: 'in-app-browser', levelsCompletedSinceExport: 1 }, T3)).toEqual({ due: true, reason: 'levels' });
    expect(persistReminderDue({ ...base, environment: 'in-app-browser', levelsCompletedSinceExport: 0, lastExportedAt: T0 }, '2027-01-01T00:00:00Z')).toEqual({
      due: false,
    });
  });
  it('取得 persistent 後預設不提醒；政策可調', () => {
    expect(persistReminderDue({ ...base, persisted: true, levelsCompletedSinceExport: 9 }, T3)).toEqual({ due: false });
    expect(
      persistReminderDue({ ...base, persisted: true, levelsCompletedSinceExport: 9 }, T3, { ...DEFAULT_REMINDER_POLICY, remindWhenPersisted: true }),
    ).toEqual({ due: true, reason: 'levels' });
  });
});
