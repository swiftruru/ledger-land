// MemoryProgressStore：介面行為（查詢、環狀 50 筆錯誤、importAll、rebuildLevelProgress、關閉後不可用）
import { describe, expect, it } from 'vitest';
import { ERRORS_MAX, MemoryProgressStore } from '../src/index.ts';
import { DEVICE_B, LV1, Q1, Q2, Q3, T0, T1, T2, T3, attempt, data, labState, meta, populatedSnapshot, review, sandbox, unlock } from './fixtures.ts';

describe('MemoryProgressStore', () => {
  it('attempts 只增不改、依條件查詢並排序', async () => {
    const store = MemoryProgressStore.empty(meta());
    const a1 = attempt({ attemptId: 'a_000000000201', questionId: Q1, answeredAt: T1 });
    const a2 = attempt({ attemptId: 'a_000000000202', questionId: Q2, answeredAt: T0, rev: 2, source: 'review', levelId: undefined });
    const a3 = attempt({ attemptId: 'a_000000000203', questionId: Q1, answeredAt: T2, rev: 2 });
    await store.addAttempt(a1);
    await store.addAttempt(a2);
    await store.addAttempt(a3);
    await store.addAttempt({ ...a1, correct: false });
    expect((await store.listAttempts()).map((a) => a.attemptId)).toEqual(['a_000000000202', 'a_000000000201', 'a_000000000203']);
    expect((await store.listAttempts({ questionId: Q1 })).map((a) => a.attemptId)).toEqual(['a_000000000201', 'a_000000000203']);
    expect((await store.listAttempts({ questionId: Q1, rev: 2 })).map((a) => a.attemptId)).toEqual(['a_000000000203']);
    expect((await store.listAttempts({ from: T1, to: T1 })).map((a) => a.attemptId)).toEqual(['a_000000000201']);
    expect((await store.listAttempts({ source: 'review' })).map((a) => a.attemptId)).toEqual(['a_000000000202']);
    expect((await store.listAttempts({ levelId: LV1 })).map((a) => a.attemptId)).toEqual(['a_000000000201', 'a_000000000203']);
    expect((await store.listAttempts())[0]?.correct).toBe(true);
  });
  it('回傳的是複本', async () => {
    const store = new MemoryProgressStore(populatedSnapshot());
    const s = await store.getLabSandbox('sandbox-default');
    s!.overrides.push({ stepId: 'st_7h4n2q', eventId: 'e2', param: 'amount', value: 1 });
    expect((await store.getLabSandbox('sandbox-default'))!.overrides).toHaveLength(1);
  });
  it('levelProgress、reviewQueue、unlocks、labState、labSandbox、settings 的讀寫', async () => {
    const store = MemoryProgressStore.empty(meta());
    await store.putLevelProgress({ levelId: LV1, stars: 1, bestScore: 0.6, lastPlayedAt: T1 });
    await store.putLevelProgress({ levelId: LV1, stars: 2, bestScore: 0.8, lastPlayedAt: T2 });
    expect(await store.getLevelProgress(LV1)).toMatchObject({ stars: 2 });
    expect(await store.listLevelProgress()).toHaveLength(1);

    await store.putReview(review({ questionId: Q1, dueAt: '2026-03-02' }));
    await store.putReview(review({ questionId: Q2, dueAt: '2026-03-05', status: 'mastered' }));
    await store.putReview(review({ questionId: Q3, dueAt: '2026-03-01', status: 'question_updated' }));
    expect((await store.listDueReviews('2026-03-02')).map((r) => r.questionId)).toEqual([Q3, Q1]);
    expect((await store.listDueReviews('2026-03-02', 1)).map((r) => r.questionId)).toEqual([Q3]);
    expect((await store.listDueReviews('2026-12-31')).map((r) => r.questionId)).toEqual([Q3, Q1]);
    await store.removeReview(Q1);
    expect(await store.getReview(Q1)).toBeUndefined();
    expect(await store.listReviews()).toHaveLength(2);

    await store.addUnlock(unlock('badge:b1', T2));
    await store.addUnlock(unlock('badge:b1', T1));
    await store.addUnlock(unlock('badge:b1', T3));
    await store.addUnlock(unlock('term:tm_5p8k2w9x', T0));
    expect(await store.hasUnlock('badge:b1')).toBe(true);
    expect(await store.listUnlocks('badge')).toEqual([unlock('badge:b1', T1)]);
    expect(await store.listUnlocks()).toHaveLength(2);

    await store.putLabState(labState());
    expect(await store.getLabState('story_8k3p6t')).toEqual(labState());
    expect(await store.listLabState()).toHaveLength(1);
    await store.putLabSandbox(sandbox());
    await store.removeLabSandbox('sandbox-default');
    expect(await store.getLabSandbox('sandbox-default')).toBeUndefined();

    await store.setSetting('locale', 'en', T1);
    await store.setSetting('locale', 'zh-TW', T2);
    await store.setSetting('timerEnabled', true, T2);
    expect(await store.getSetting('locale')).toEqual({ key: 'locale', value: 'zh-TW', updatedAt: T2 });
    expect((await store.allSettings()).map((s) => s.key)).toEqual(['locale', 'timerEnabled']);
  });
  it('errors 環狀保留最近 50 筆；snapshots 可增可列', async () => {
    const store = MemoryProgressStore.empty(meta());
    for (let i = 1; i <= ERRORS_MAX + 7; i++) await store.appendError({ at: T0, route: '/', message: `e${i}`, appVersion: '0.2.0', contentVersion: 3 });
    const errors = await store.listErrors();
    expect(errors).toHaveLength(ERRORS_MAX);
    expect(errors[0]?.message).toBe('e8');
    expect(errors.at(-1)?.message).toBe(`e${ERRORS_MAX + 7}`);
    await store.clearErrors();
    expect(await store.listErrors()).toEqual([]);
    await store.addSnapshot({ fromVersion: 1, createdAt: T0, payload: { attempts: [] } });
    expect(await store.listSnapshots()).toHaveLength(1);
  });
  it('exportAll、importAll（合併與覆蓋）、rebuildLevelProgress、meta', async () => {
    const store = new MemoryProgressStore(populatedSnapshot());
    const incoming = data({
      attempts: [attempt({ attemptId: 'a_000000000301', questionId: Q3, answeredAt: T2, deviceId: DEVICE_B })],
      unlocks: [unlock('badge:b9', T2)],
    });
    const merged = await store.importAll(incoming, { mode: 'merge', settings: false, importedAt: T3, source: { deviceId: DEVICE_B } });
    expect(merged.attempts).toHaveLength(3);
    expect(merged.unlocks).toHaveLength(3);
    expect((await store.getMeta()).importHistory).toHaveLength(1);
    const replaced = await store.importAll(incoming, { mode: 'replace', settings: false, importedAt: T3, source: { deviceId: DEVICE_B } });
    expect(replaced.attempts).toHaveLength(1);
    expect(replaced.settings).toHaveLength(3);
    const rebuilt = await store.rebuildLevelProgress([{ levelId: LV1, scoredQuestionIds: [Q3] }]);
    expect(rebuilt).toEqual([{ levelId: LV1, stars: 3, bestScore: 1, firstCompletedAt: T2, lastPlayedAt: T2 }]);
    expect((await store.exportAll()).levelProgress).toEqual(rebuilt);
    await store.putMeta({ ...(await store.getMeta()), appVersion: '0.3.0' });
    expect((await store.getMeta()).appVersion).toBe('0.3.0');
    expect(store.schemaVersion).toBe(1);
    await store.flush();
    await store.close();
    await expect(store.getMeta()).rejects.toThrow('已關閉');
  });
});
