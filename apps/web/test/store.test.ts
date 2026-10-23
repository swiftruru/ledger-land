// IndexedDBProgressStore（06 第 4.2、4.4、4.6 節）：環狀錯誤、addAttempt 不覆蓋、importAll 合併、設定鏡像、暫停後寫入進佇列、連線中斷的重試
import { ERRORS_MAX, type ErrorRecord, type JsonValue } from '@ledgerland/progress';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openProgressDB, type ProgressDB } from '../src/lib/progress/db.ts';
import { IndexedDBProgressStore, StoreSuspendedError, type IndexedDBStoreHooks } from '../src/lib/progress/indexeddb-store.ts';
import { PendingQueue, applyPending, replayPending } from '../src/lib/progress/pending.ts';
import { MemoryStorage, NOW, attempt, badge, freshIndexedDB, level, meta } from './fixtures.ts';

const now = () => NOW;
const errorRecord = (n: number): ErrorRecord => ({ at: NOW, route: '/x/', message: `錯誤 ${n}`, appVersion: '0.0.0+test', contentVersion: 0 });

async function makeStore(overrides: Partial<IndexedDBStoreHooks> = {}): Promise<{ store: IndexedDBProgressStore; db: ProgressDB; storage: MemoryStorage }> {
  const db = await openProgressDB({ now });
  const storage = new MemoryStorage();
  const store = new IndexedDBProgressStore(db, {
    now,
    createMeta: () => meta(),
    reopen: () => openProgressDB({ now }),
    pending: new PendingQueue(storage),
    ...overrides,
  });
  return { store, db, storage };
}

describe('IndexedDBProgressStore', () => {
  beforeEach(freshIndexedDB);

  it('meta 第一次讀取時建立，之後讀到同一筆', async () => {
    const { store } = await makeStore();
    const m = await store.getMeta();
    expect(m.deviceId).toBe('d_9k2m7q4x');
    await store.putMeta({ ...m, contentVersion: 9 });
    expect((await store.getMeta()).contentVersion).toBe(9);
    await store.close();
  });

  it('errors 環狀保留最近 50 筆', async () => {
    const { store } = await makeStore();
    for (let i = 1; i <= ERRORS_MAX + 5; i++) await store.appendError(errorRecord(i));
    const list = await store.listErrors();
    expect(list).toHaveLength(ERRORS_MAX);
    expect(list[0]!.message).toBe('錯誤 6');
    expect(list[ERRORS_MAX - 1]!.message).toBe(`錯誤 ${ERRORS_MAX + 5}`);
    await store.clearErrors();
    expect(await store.listErrors()).toEqual([]);
    await store.close();
  });

  it('addAttempt 只增不改：同一個 attemptId 再寫一次不覆蓋', async () => {
    const { store } = await makeStore();
    await store.addAttempt(attempt(1, { correct: false }));
    await store.addAttempt(attempt(1, { correct: true }));
    const list = await store.listAttempts();
    expect(list).toHaveLength(1);
    expect(list[0]!.correct).toBe(false);
    await store.close();
  });

  it('listAttempts 依查詢篩選並依時間排序', async () => {
    const { store } = await makeStore();
    await store.addAttempt(attempt(3, { questionId: 'q_7f3k2m9x', rev: 2 }));
    await store.addAttempt(attempt(1, { questionId: 'q_7f3k2m9x', rev: 1 }));
    await store.addAttempt(attempt(2, { questionId: 'q_a1b2c3d4', source: 'review' }));
    expect((await store.listAttempts()).map((a) => a.attemptId)).toEqual(['a_000000000001', 'a_000000000002', 'a_000000000003']);
    expect(await store.listAttempts({ questionId: 'q_7f3k2m9x' })).toHaveLength(2);
    expect(await store.listAttempts({ questionId: 'q_7f3k2m9x', rev: 2 })).toHaveLength(1);
    expect(await store.listAttempts({ source: 'review' })).toHaveLength(1);
    expect(await store.listAttempts({ from: '2026-10-22T00:00:00Z', to: '2026-10-22T23:59:59Z' })).toHaveLength(1);
    await store.close();
  });

  it('unlock 保留較早的 unlockedAt；levelProgress、review、labState、labSandbox 的 put 與 get', async () => {
    const { store } = await makeStore();
    await store.addUnlock(badge());
    await store.addUnlock({ ...badge(), unlockedAt: '2026-10-01T00:00:00Z' });
    await store.addUnlock({ ...badge(), unlockedAt: '2026-12-01T00:00:00Z' });
    expect((await store.listUnlocks('badge'))[0]!.unlockedAt).toBe('2026-10-01T00:00:00Z');
    expect(await store.hasUnlock('badge:first_level')).toBe(true);
    expect(await store.hasUnlock('badge:none')).toBe(false);
    await store.putLevelProgress(level());
    expect((await store.getLevelProgress('lv_k7m2q9xd'))?.stars).toBe(2);
    await store.putReview({
      questionId: 'q_7f3k2m9x',
      rev: 1,
      lastResult: 'wrong',
      lastAnsweredAt: NOW,
      box: 1,
      dueAt: '2026-10-24',
      wrongCount: 1,
      status: 'active',
      addedBy: 'auto',
    });
    expect(await store.listDueReviews('2026-10-23')).toHaveLength(0);
    expect(await store.listDueReviews('2026-10-24')).toHaveLength(1);
    await store.removeReview('q_7f3k2m9x');
    expect(await store.listReviews()).toEqual([]);
    await store.putLabState({ storyId: 'story_k8p3x6', stepId: 'st_r2x9k4', updatedAt: NOW });
    expect((await store.getLabState('story_k8p3x6'))?.stepId).toBe('st_r2x9k4');
    expect(await store.listLabState()).toHaveLength(1);
    await store.close();
  });

  it('setSetting 寫入後呼叫 onSettingChanged（localStorage 鏡像）', async () => {
    const changed: [string, JsonValue][] = [];
    const { store } = await makeStore({ onSettingChanged: (k, v) => changed.push([k, v]) });
    await store.setSetting('locale', 'en', NOW);
    await store.setSetting('timerEnabled', true, NOW);
    expect(changed).toEqual([
      ['locale', 'en'],
      ['timerEnabled', true],
    ]);
    expect((await store.getSetting('locale'))?.value).toBe('en');
    expect((await store.allSettings()).map((s) => s.key)).toEqual(['locale', 'timerEnabled']);
    await store.close();
  });

  it('importAll 預設合併：作答紀錄取聯集去重、星星取最大值、徽章只會變多、importHistory 加一筆', async () => {
    const { store } = await makeStore();
    await store.addAttempt(attempt(1));
    await store.putLevelProgress(level('lv_k7m2q9xd', 1));
    await store.setSetting('locale', 'zh-TW', NOW);
    const incoming = {
      attempts: [attempt(1, { attemptId: 'a_zzzzzzzzzzzz' }), attempt(2)],
      levelProgress: [level('lv_k7m2q9xd', 3)],
      reviewQueue: [],
      unlocks: [badge()],
      labState: [],
      labSandbox: [],
      settings: [{ key: 'locale', value: 'en', updatedAt: NOW }],
    };
    const result = await store.importAll(incoming, {
      mode: 'merge',
      settings: false,
      importedAt: NOW,
      source: { deviceId: 'd_abcdefgh', origin: 'https://example.test', mode: 'browser' },
    });
    expect(result.attempts).toHaveLength(2);
    expect(result.levelProgress[0]!.stars).toBe(3);
    expect(result.unlocks).toHaveLength(1);
    expect(result.settings.find((s) => s.key === 'locale')?.value).toBe('zh-TW');
    expect(result.meta.importHistory).toHaveLength(1);
    expect(result.meta.deviceId).toBe('d_9k2m7q4x');
    // 寫回之後再讀一次，和回傳值一致
    const exported = await store.exportAll();
    expect(exported.attempts.map((a) => a.attemptId)).toEqual(result.attempts.map((a) => a.attemptId));
    expect(exported.levelProgress).toEqual(result.levelProgress);
    expect(exported.meta.importHistory).toHaveLength(1);
    // 再匯入一次，結果不變（冪等）
    const again = await store.importAll(incoming, { mode: 'merge', settings: true, importedAt: NOW, source: { deviceId: 'd_abcdefgh' } });
    expect(again.attempts).toHaveLength(2);
    expect(again.settings.find((s) => s.key === 'locale')?.value).toBe('en');
    await store.close();
  });

  it('rebuildLevelProgress 由 attempts 重新推導並寫回', async () => {
    const { store } = await makeStore();
    await store.addAttempt(attempt(2, { questionId: 'q_a1a1a1a1', correct: true, answeredAt: '2026-10-20T10:00:00Z' }));
    await store.addAttempt(attempt(4, { questionId: 'q_b2b2b2b2', correct: true, answeredAt: '2026-10-20T10:01:00Z' }));
    await store.putLevelProgress(level('lv_old00000', 1));
    const derived = await store.rebuildLevelProgress([{ levelId: 'lv_k7m2q9xd', scoredQuestionIds: ['q_a1a1a1a1', 'q_b2b2b2b2'] }]);
    expect(derived).toHaveLength(1);
    expect(derived[0]!.stars).toBe(3);
    expect((await store.listLevelProgress()).map((l) => l.levelId)).toEqual(['lv_k7m2q9xd']);
    await store.close();
  });

  it('suspend（其他分頁升級）後：寫入進 ll:pending、讀取 throw StoreSuspendedError；重放後資料落地', async () => {
    const { store, storage } = await makeStore();
    await store.addAttempt(attempt(1));
    await store.suspend();
    expect(store.isSuspended).toBe(true);
    await store.addAttempt(attempt(2));
    await store.setSetting('timerEnabled', true, NOW);
    await expect(store.listAttempts()).rejects.toBeInstanceOf(StoreSuspendedError);
    const queue = new PendingQueue(storage);
    expect(queue.list().map((op) => op.op)).toEqual(['addAttempt', 'setSetting']);
    // 「重新整理」後：新的 store 重放佇列
    const { store: fresh } = await makeStore();
    expect(await replayPending(fresh, queue)).toBe(2);
    expect(await fresh.listAttempts()).toHaveLength(2);
    expect((await fresh.getSetting('timerEnabled'))?.value).toBe(true);
    expect(queue.size).toBe(0);
    await fresh.close();
  });

  it('applyPending 涵蓋每一種操作', async () => {
    const { store } = await makeStore();
    await applyPending(store, {
      op: 'putReview',
      value: {
        questionId: 'q_7f3k2m9x',
        rev: 1,
        lastResult: 'wrong',
        lastAnsweredAt: NOW,
        box: 1,
        dueAt: '2026-10-24',
        wrongCount: 1,
        status: 'active',
        addedBy: 'auto',
      },
    });
    await applyPending(store, { op: 'removeReview', questionId: 'q_7f3k2m9x' });
    await applyPending(store, { op: 'addUnlock', value: badge() });
    await applyPending(store, { op: 'putLevelProgress', value: level() });
    await applyPending(store, { op: 'putLabState', value: { storyId: 'story_k8p3x6', stepId: 'st_r2x9k4', updatedAt: NOW } });
    await applyPending(store, { op: 'appendError', value: errorRecord(1) });
    expect(await store.listReviews()).toEqual([]);
    expect(await store.listUnlocks()).toHaveLength(1);
    expect(await store.listLevelProgress()).toHaveLength(1);
    expect(await store.listErrors()).toHaveLength(1);
    await store.close();
  });

  it('連線中斷（terminated）：下一次操作重開一次就繼續', async () => {
    const reopen = vi.fn<() => Promise<ProgressDB>>(() => openProgressDB({ now }));
    const { store } = await makeStore({ reopen });
    await store.addAttempt(attempt(1));
    store.markTerminated();
    expect(await store.listAttempts()).toHaveLength(1);
    expect(reopen).toHaveBeenCalledTimes(1);
    await store.close();
  });

  it('重開也失敗：寫入進佇列、呼叫 onWriteFailed，不 throw；讀取 throw', async () => {
    const onWriteFailed = vi.fn<IndexedDBStoreHooks['onWriteFailed'] & object>();
    const { store, storage } = await makeStore({ reopen: () => Promise.reject(new Error('IndexedDB server lost')), onWriteFailed });
    store.markTerminated();
    await store.addAttempt(attempt(1));
    expect(onWriteFailed).toHaveBeenCalledTimes(1);
    expect(new PendingQueue(storage).list()).toHaveLength(1);
    await expect(store.listAttempts()).rejects.toThrow('IndexedDB server lost');
  });

  it('QuotaExceededError：通知畫面、寫入進佇列，不重開連線', async () => {
    const onQuotaExceeded = vi.fn<() => void>();
    const reopen = vi.fn<() => Promise<ProgressDB>>(() => openProgressDB({ now }));
    const { store, db, storage } = await makeStore({ reopen, onQuotaExceeded });
    const quota = new Error('quota');
    quota.name = 'QuotaExceededError';
    vi.spyOn(db, 'transaction').mockImplementationOnce(() => {
      throw quota;
    });
    await store.addAttempt(attempt(1));
    expect(onQuotaExceeded).toHaveBeenCalledTimes(1);
    expect(reopen).not.toHaveBeenCalled();
    expect(new PendingQueue(storage).list()).toHaveLength(1);
    await store.close();
  });
});
