// IndexedDBProgressStore（06 第 4.2、4.4、4.6 節、14 第 5.2 節）：環狀錯誤、addAttempt 不覆蓋、importAll 合併、設定鏡像、暫停後寫入進佇列、連線中斷的重試、
// 寫入先留底再開交易（交易沒完成頁面就關閉時留在佇列、下次啟動重放且不重複）
import { ERRORS_MAX, type ErrorRecord, type JsonValue } from '@ledgerland/progress';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openProgressDB, type ProgressDB } from '../src/lib/progress/db.ts';
import { IndexedDBProgressStore, StoreSuspendedError, type IndexedDBStoreHooks } from '../src/lib/progress/indexeddb-store.ts';
import { PendingQueue, applyPending, replayPending } from '../src/lib/progress/pending.ts';
import { listFavourites, toggleFavourite } from '../src/features/quiz/favourites.ts';
import { MemoryStorage, NOW, attempt, badge, freshIndexedDB, level, meta } from './fixtures.ts';

const now = () => NOW;
const errorRecord = (n: number): ErrorRecord => ({ at: NOW, route: '/x/', message: `錯誤 ${n}`, appVersion: '0.0.0+test', contentVersion: 0 });

/** 讓下一個交易永遠不完成：模擬頁面在交易 complete 前就被關閉（作答後馬上整頁跳轉、pagehide 後被回收） */
function hangNextTransaction(db: ProgressDB): void {
  const never = () => new Promise<never>(() => {});
  const tx = { store: { getKey: never, get: never, put: never, add: never, delete: never, count: never }, done: never(), objectStore: () => tx.store };
  vi.spyOn(db, 'transaction').mockImplementationOnce(() => tx as never);
}

async function makeStore(
  overrides: Partial<IndexedDBStoreHooks> = {},
  storage: MemoryStorage = new MemoryStorage(),
): Promise<{ store: IndexedDBProgressStore; db: ProgressDB; storage: MemoryStorage }> {
  const db = await openProgressDB({ now });
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

  it('收藏進備份（core-2）：有收藏的資料匯出後在空的資料庫以預設選項（不套用設定）匯入，收藏都在；與本機收藏取聯集', async () => {
    const { store: source } = await makeStore();
    await toggleFavourite('q_a1a1a1a1', source, NOW);
    await toggleFavourite('q_b2b2b2b2', source, NOW);
    const exported = await source.exportAll();
    await source.close();
    freshIndexedDB();
    const { store: target } = await makeStore();
    await toggleFavourite('q_c3c3c3c3', target, NOW);
    const options = { mode: 'merge' as const, settings: false, importedAt: NOW, source: { deviceId: 'd_abcdefgh' } };
    await target.importAll(exported, options);
    expect(await listFavourites(target)).toEqual(['q_c3c3c3c3', 'q_a1a1a1a1', 'q_b2b2b2b2']);
    // 覆蓋模式：收藏改成備份的清單
    await target.importAll(exported, { ...options, mode: 'replace' });
    expect(await listFavourites(target)).toEqual(['q_a1a1a1a1', 'q_b2b2b2b2']);
    await target.close();
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

  it('寫入在開交易前就同步進 ll:pending，交易 complete 後移除', async () => {
    const { store, storage } = await makeStore();
    const queue = new PendingQueue(storage);
    const writing = store.addAttempt(attempt(1));
    expect(queue.list().map((o) => o.op)).toEqual(['addAttempt']);
    await writing;
    expect(queue.size).toBe(0);
    const setting = store.setSetting('timerEnabled', true, NOW);
    expect(queue.list().map((o) => o.op)).toEqual(['setSetting']);
    await setting;
    expect(queue.size).toBe(0);
    expect(await store.listAttempts()).toHaveLength(1);
    await store.close();
  });

  it('交易還沒 complete 頁面就關閉：這一筆留在佇列，下次啟動重放一次就落地，再重放也不重複', async () => {
    const storage = new MemoryStorage();
    const { store, db } = await makeStore({}, storage);
    hangNextTransaction(db);
    void store.addAttempt(attempt(1));
    hangNextTransaction(db);
    void store.putReview({
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
    const queue = new PendingQueue(storage);
    expect(queue.list().map((o) => o.op)).toEqual(['addAttempt', 'putReview']);
    // 「下次啟動」：同一個 localStorage、新的連線與 store
    const { store: next } = await makeStore({}, storage);
    expect(await next.listAttempts()).toHaveLength(0);
    expect(await replayPending(next, queue)).toBe(2);
    expect(await next.listAttempts()).toHaveLength(1);
    expect(await next.listDueReviews('2026-10-24')).toHaveLength(1);
    expect(queue.size).toBe(0);
    // 重放到一半又被關閉的情況：同樣的項目再重放一次，結果相同
    queue.push({ op: 'addAttempt', value: attempt(1) });
    expect(await replayPending(next, queue)).toBe(1);
    expect(await next.listAttempts()).toHaveLength(1);
    await next.close();
  });

  it('交易其實已完成但來不及移除：重放不會多一筆', async () => {
    const storage = new MemoryStorage();
    const { store } = await makeStore({}, storage);
    await store.addAttempt(attempt(1));
    await store.addUnlock(badge());
    await store.close();
    const queue = new PendingQueue(storage);
    queue.push({ op: 'addAttempt', value: attempt(1) });
    queue.push({ op: 'addUnlock', value: badge() });
    const { store: next } = await makeStore({}, storage);
    expect(await replayPending(next, queue)).toBe(2);
    expect(await next.listAttempts()).toHaveLength(1);
    expect(await next.listUnlocks()).toHaveLength(1);
    await next.close();
  });

  it('進行中的寫入持有 ll:pending:<token> 鎖、記下排入時間；完成或失敗留底後都放掉鎖（失敗的項目給下次啟動的任何分頁重放）', async () => {
    const held = new Map<string, number>();
    const locks = {
      request(name: string, callback: () => Promise<void>) {
        held.set(name, (held.get(name) ?? 0) + 1);
        return callback().finally(() => held.set(name, held.get(name)! - 1));
      },
    };
    const storage = new MemoryStorage();
    const queue = new PendingQueue(storage, undefined, 'tab-a', locks);
    const settle = () => new Promise((r) => setTimeout(r, 0));
    const ok = await makeStore({ pending: queue }, storage);
    const writing = ok.store.addAttempt(attempt(1));
    expect(queue.entries()[0]!.at).toBe(NOW);
    expect(held.get('ll:pending:tab-a')).toBe(1);
    await writing;
    await settle();
    expect(held.get('ll:pending:tab-a')).toBe(0);
    await ok.store.close();
    const failing = await makeStore({ pending: queue, reopen: () => Promise.reject(new Error('IndexedDB server lost')) }, storage);
    failing.store.markTerminated();
    await failing.store.addAttempt(attempt(2));
    await settle();
    expect(queue.size).toBe(1);
    expect(held.get('ll:pending:tab-a')).toBe(0);
  });

  it('appendError 不先留底（重放會多一筆），只在失敗時進佇列', async () => {
    const { store, db, storage } = await makeStore();
    hangNextTransaction(db);
    void store.appendError(errorRecord(1));
    expect(new PendingQueue(storage).size).toBe(0);
  });

  it('沒有佇列（hooks.pending 省略）時行為不變：成功寫入，失敗 throw', async () => {
    const db = await openProgressDB({ now });
    const store = new IndexedDBProgressStore(db, { now, createMeta: () => meta(), reopen: () => Promise.reject(new Error('IndexedDB server lost')) });
    await store.addAttempt(attempt(1));
    expect(await store.listAttempts()).toHaveLength(1);
    store.markTerminated();
    await expect(store.addAttempt(attempt(2))).rejects.toThrow('IndexedDB server lost');
  });
});
