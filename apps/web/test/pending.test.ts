// 暫存佇列（06 第 4.3、4.4 節、14 第 5.2 節）：項目有 id、只移除自己那一筆、M2 舊格式就地升級；重放逐筆移除、中途失敗保留剩下的、重放冪等；
// 重放先比對新舊（core-1）：較舊的項目不蓋掉資料庫裡較新的星星、錯題本、設定與實驗室狀態；還活著的分頁（持有 ll:pending:<token> 鎖）的項目留給它自己
import { MemoryProgressStore, type Attempt, type JsonValue, type LabState, type LevelProgress, type ReviewQueueEntry } from '@ledgerland/progress';
import { describe, expect, it } from 'vitest';
import {
  PENDING_KEY,
  PENDING_LOCK_PREFIX,
  PendingQueue,
  liveTokensFrom,
  replayPending,
  type PendingLocks,
  type PendingOp,
} from '../src/lib/progress/pending.ts';
import { MemoryStorage, NOW, attempt, level, meta } from './fixtures.ts';

const add = (n: number): PendingOp => ({ op: 'addAttempt', value: attempt(n) });

describe('PendingQueue', () => {
  it('push 回傳 id，remove 只移除那一筆，其他順序不變', () => {
    const storage = new MemoryStorage();
    const queue = new PendingQueue(storage, PENDING_KEY, 'tab-a');
    const id1 = queue.push(add(1));
    const id2 = queue.push(add(2));
    const id3 = queue.push({ op: 'putLevelProgress', value: level() });
    expect([id1, id2, id3]).toEqual(['tab-a-1', 'tab-a-2', 'tab-a-3']);
    queue.remove(id2);
    expect(queue.entries().map((e) => e.id)).toEqual(['tab-a-1', 'tab-a-3']);
    expect(queue.list().map((o) => o.op)).toEqual(['addAttempt', 'putLevelProgress']);
    queue.remove('不存在');
    expect(queue.size).toBe(2);
    queue.remove(id1);
    queue.remove(id3);
    expect(queue.size).toBe(0);
    // 空了就把鍵拿掉，不留 []
    expect(storage.getItem(PENDING_KEY)).toBeNull();
  });

  it('兩個分頁各自的 id 不會互相移除', () => {
    const storage = new MemoryStorage();
    const a = new PendingQueue(storage, PENDING_KEY, 'tab-a');
    const b = new PendingQueue(storage, PENDING_KEY, 'tab-b');
    const idA = a.push(add(1));
    const idB = b.push(add(2));
    expect(idA).not.toBe(idB);
    a.remove(idA);
    expect(b.entries().map((e) => e.id)).toEqual([idB]);
  });

  it('M2 的舊格式（直接存 PendingOp 陣列）讀得到，並就地換成新格式', () => {
    const storage = new MemoryStorage();
    storage.setItem(PENDING_KEY, JSON.stringify([add(1), add(2)]));
    const queue = new PendingQueue(storage, PENDING_KEY, 'tab-a');
    expect(queue.list().map((o) => (o as { value: Attempt }).value.attemptId)).toEqual(['a_000000000001', 'a_000000000002']);
    const stored = JSON.parse(storage.getItem(PENDING_KEY)!) as { id: string; op: PendingOp }[];
    expect(stored.map((e) => e.id)).toEqual(['legacy-0', 'legacy-1']);
    queue.remove('legacy-0');
    expect(queue.entries().map((e) => e.id)).toEqual(['legacy-1']);
  });

  it('壞掉的內容與非陣列當成空佇列；寫不進 localStorage 不 throw', () => {
    const storage = new MemoryStorage();
    storage.setItem(PENDING_KEY, '{not json');
    const queue = new PendingQueue(storage);
    expect(queue.list()).toEqual([]);
    storage.setItem(PENDING_KEY, JSON.stringify({ op: 'x' }));
    expect(queue.list()).toEqual([]);
    const broken: MemoryStorage = new MemoryStorage();
    broken.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(() => new PendingQueue(broken).push(add(1))).not.toThrow();
  });

  it('沒給 token 時自動產生，且同一個佇列的 id 遞增不重複', () => {
    const queue = new PendingQueue(new MemoryStorage());
    const ids = new Set([queue.push(add(1)), queue.push(add(2)), queue.push(add(3))]);
    expect(ids.size).toBe(3);
  });
});

describe('replayPending', () => {
  it('逐筆重放並逐筆移除；回傳重放的筆數', async () => {
    const storage = new MemoryStorage();
    const queue = new PendingQueue(storage, PENDING_KEY, 'tab-a');
    queue.push(add(1));
    queue.push({ op: 'setSetting', key: 'timerEnabled', value: true, updatedAt: NOW });
    const store = MemoryProgressStore.empty(meta());
    expect(await replayPending(store, queue)).toBe(2);
    expect(await store.listAttempts()).toHaveLength(1);
    expect((await store.getSetting('timerEnabled'))?.value).toBe(true);
    expect(queue.size).toBe(0);
    expect(await replayPending(store, queue)).toBe(0);
  });

  it('中途失敗：成功的已移除、失敗的與後面的留著，下次再試', async () => {
    const storage = new MemoryStorage();
    const queue = new PendingQueue(storage, PENDING_KEY, 'tab-a');
    queue.push(add(1));
    queue.push(add(2));
    queue.push(add(3));
    const store = MemoryProgressStore.empty(meta());
    let failOnce = true;
    const original = store.addAttempt.bind(store);
    store.addAttempt = async (a: Attempt) => {
      if (failOnce && a.attemptId === 'a_000000000002') {
        failOnce = false;
        throw new Error('IndexedDB server lost');
      }
      return original(a);
    };
    await expect(replayPending(store, queue)).rejects.toThrow('IndexedDB server lost');
    expect(queue.entries().map((e) => e.id)).toEqual(['tab-a-2', 'tab-a-3']);
    expect(await store.listAttempts()).toHaveLength(1);
    expect(await replayPending(store, queue)).toBe(2);
    expect(await store.listAttempts()).toHaveLength(3);
    expect(queue.size).toBe(0);
  });

  it('重放是冪等的：同一筆 attempt 留了兩次、或交易其實已完成，重放後只有一筆', async () => {
    const storage = new MemoryStorage();
    const queue = new PendingQueue(storage, PENDING_KEY, 'tab-a');
    const store = MemoryProgressStore.empty(meta());
    await store.addAttempt(attempt(1));
    await store.putLevelProgress(level('lv_k7m2q9xd', 3));
    queue.push(add(1));
    queue.push(add(1));
    queue.push({ op: 'putLevelProgress', value: level('lv_k7m2q9xd', 3) });
    queue.push({ op: 'removeReview', questionId: 'q_7f3k2m9x' });
    expect(await replayPending(store, queue)).toBe(4);
    expect(await store.listAttempts()).toHaveLength(1);
    expect(await store.listLevelProgress()).toEqual([level('lv_k7m2q9xd', 3)]);
    expect(queue.size).toBe(0);
  });
});

const EARLY = '2026-10-20T08:00:00.000Z';
const LATE = '2026-10-25T08:00:00.000Z';

function review(lastAnsweredAt: string, box: ReviewQueueEntry['box'], rev = 1): ReviewQueueEntry {
  return {
    questionId: 'q_7f3k2m9x',
    rev,
    lastResult: 'wrong',
    lastAnsweredAt,
    box,
    dueAt: '2026-10-26',
    wrongCount: 1,
    status: 'active',
    addedBy: 'auto',
  };
}

describe('replayPending 先比對新舊（core-1）', () => {
  it('push 記下排入的時間 at（給了就用給的）', () => {
    const queue = new PendingQueue(new MemoryStorage(), PENDING_KEY, 'tab-a');
    queue.push(add(1), EARLY);
    queue.push(add(2));
    const [first, second] = queue.entries();
    expect(first!.at).toBe(EARLY);
    expect(typeof second!.at).toBe('string');
  });

  it('levelProgress：資料庫是 3 星、較晚，佇列留 1 星、較早的項目；重放後仍是 3 星，firstCompletedAt 取較早、lastPlayedAt 取較晚', async () => {
    const store = MemoryProgressStore.empty(meta());
    const newer: LevelProgress = { levelId: 'lv_k7m2q9xd', stars: 3, bestScore: 1, firstCompletedAt: NOW, lastPlayedAt: LATE };
    await store.putLevelProgress(newer);
    const queue = new PendingQueue(new MemoryStorage(), PENDING_KEY, 'tab-old');
    queue.push({ op: 'putLevelProgress', value: { levelId: 'lv_k7m2q9xd', stars: 1, bestScore: 0.4, firstCompletedAt: EARLY, lastPlayedAt: EARLY } }, EARLY);
    expect(await replayPending(store, queue)).toBe(1);
    expect(await store.getLevelProgress('lv_k7m2q9xd')).toEqual({
      levelId: 'lv_k7m2q9xd',
      stars: 3,
      bestScore: 1,
      firstCompletedAt: EARLY,
      lastPlayedAt: LATE,
    });
    expect(queue.size).toBe(0);
  });

  it('資料庫的設定、錯題本與實驗室狀態比佇列裡的項目新：重放後保留資料庫的值；略過的設定交給 onSettingKept 重寫鏡像', async () => {
    const store = MemoryProgressStore.empty(meta());
    await store.setSetting('favourites', ['q_new00001', 'q_new00002'], LATE);
    await store.setSetting('timerEnabled', false, LATE);
    await store.putReview(review(LATE, 3));
    const lab: LabState = { storyId: 'story_q7m2v9', stepId: 'step_c4k8m2', updatedAt: LATE };
    await store.putLabState(lab);
    const queue = new PendingQueue(new MemoryStorage(), PENDING_KEY, 'tab-old');
    queue.push({ op: 'setSetting', key: 'favourites', value: ['q_old00001'], updatedAt: EARLY }, EARLY);
    queue.push({ op: 'setSetting', key: 'timerEnabled', value: true, updatedAt: EARLY }, EARLY);
    queue.push({ op: 'putReview', value: review(EARLY, 1) }, EARLY);
    queue.push({ op: 'putLabState', value: { storyId: 'story_q7m2v9', stepId: 'step_a1b2c3', updatedAt: EARLY } }, EARLY);
    const kept: [string, JsonValue][] = [];
    expect(await replayPending(store, queue, { onSettingKept: (key, value) => kept.push([key, value]) })).toBe(4);
    expect((await store.getSetting('favourites'))?.value).toEqual(['q_new00001', 'q_new00002']);
    expect((await store.getSetting('timerEnabled'))?.value).toBe(false);
    expect((await store.getReview('q_7f3k2m9x'))?.box).toBe(3);
    expect(await store.getLabState('story_q7m2v9')).toEqual(lab);
    expect(kept).toEqual([
      ['favourites', ['q_new00001', 'q_new00002']],
      ['timerEnabled', false],
    ]);
    expect(queue.size).toBe(0);
  });

  it('佇列的項目比資料庫新時照常寫入（設定、錯題本、實驗室狀態）', async () => {
    const store = MemoryProgressStore.empty(meta());
    await store.setSetting('timerEnabled', false, EARLY);
    await store.putReview(review(EARLY, 1));
    const queue = new PendingQueue(new MemoryStorage(), PENDING_KEY, 'tab-old');
    queue.push({ op: 'setSetting', key: 'timerEnabled', value: true, updatedAt: LATE }, LATE);
    queue.push({ op: 'putReview', value: review(LATE, 2) }, LATE);
    queue.push({ op: 'putLabState', value: { storyId: 'story_q7m2v9', stepId: 'step_a1b2c3', updatedAt: LATE } }, LATE);
    await replayPending(store, queue);
    expect((await store.getSetting('timerEnabled'))?.value).toBe(true);
    expect((await store.getReview('q_7f3k2m9x'))?.box).toBe(2);
    expect((await store.getLabState('story_q7m2v9'))?.stepId).toBe('step_a1b2c3');
  });

  it('removeReview：移除之後又答錯（資料庫的 lastAnsweredAt 較晚）就不刪；較早的才刪；舊格式沒有 at 時照舊刪', async () => {
    const store = MemoryProgressStore.empty(meta());
    await store.putReview(review(LATE, 1));
    const queue = new PendingQueue(new MemoryStorage(), PENDING_KEY, 'tab-old');
    queue.push({ op: 'removeReview', questionId: 'q_7f3k2m9x' }, EARLY);
    await replayPending(store, queue);
    expect(await store.getReview('q_7f3k2m9x')).toBeDefined();
    queue.push({ op: 'removeReview', questionId: 'q_7f3k2m9x' }, '2026-10-26T08:00:00.000Z');
    await replayPending(store, queue);
    expect(await store.getReview('q_7f3k2m9x')).toBeUndefined();
    await store.putReview(review(LATE, 1));
    const storage = new MemoryStorage();
    storage.setItem(PENDING_KEY, JSON.stringify([{ op: 'removeReview', questionId: 'q_7f3k2m9x' }]));
    await replayPending(store, new PendingQueue(storage, PENDING_KEY, 'tab-new'));
    expect(await store.getReview('q_7f3k2m9x')).toBeUndefined();
  });

  it('removeLabSandbox：資料庫的沙盒在移除之後又更新過就不刪', async () => {
    const store = MemoryProgressStore.empty(meta());
    const sandbox = {
      id: 'sb_1',
      basedOn: { story: 'story_q7m2v9', storyRev: 1, throughStep: 'step_c4k8m2' },
      policy: 'teacher@1',
      layout: 'teacher@1',
      overrides: [],
      inserted: [],
      removed: [],
      updatedAt: LATE,
    } as const;
    await store.putLabSandbox({ ...sandbox, overrides: [], inserted: [], removed: [] });
    const queue = new PendingQueue(new MemoryStorage(), PENDING_KEY, 'tab-old');
    queue.push({ op: 'removeLabSandbox', id: 'sb_1' }, EARLY);
    queue.push({ op: 'putLabSandbox', value: { ...sandbox, overrides: [], inserted: [], removed: [], updatedAt: EARLY, policy: 'ifrs@1' } }, EARLY);
    await replayPending(store, queue);
    expect((await store.getLabSandbox('sb_1'))?.policy).toBe('teacher@1');
  });

  it('還活著的分頁（liveTokens）的項目不重放、留在佇列給它自己移除；其他分頁的照常重放', async () => {
    const storage = new MemoryStorage();
    const alive = new PendingQueue(storage, PENDING_KEY, 'tab-alive');
    const dead = new PendingQueue(storage, PENDING_KEY, 'tab-dead');
    alive.push(add(1));
    dead.push(add(2));
    const store = MemoryProgressStore.empty(meta());
    const me = new PendingQueue(storage, PENDING_KEY, 'tab-me');
    expect(await replayPending(store, me, { liveTokens: new Set(['tab-alive']) })).toBe(1);
    expect((await store.listAttempts()).map((a) => a.attemptId)).toEqual(['a_000000000002']);
    expect(me.entries().map((e) => e.id)).toEqual(['tab-alive-1']);
  });

  it('liveTokensFrom：只取 ll:pending: 開頭的鎖名稱', () => {
    expect(
      liveTokensFrom({ held: [{ name: `${PENDING_LOCK_PREFIX}tab-a` }, { name: 'other-lock' }, {}], pending: [{ name: `${PENDING_LOCK_PREFIX}tab-b` }] }),
    ).toEqual(new Set(['tab-a']));
    expect(liveTokensFrom({})).toEqual(new Set());
  });

  it('有 locks 時：佇列裡有自己的項目就持有 ll:pending:<token> 鎖，自己的項目都移除後才放掉', async () => {
    const held = new Set<string>();
    const requests: string[] = [];
    const locks: PendingLocks = {
      request(name, callback) {
        requests.push(name);
        held.add(name);
        return callback().then(() => {
          held.delete(name);
        });
      },
    };
    const queue = new PendingQueue(new MemoryStorage(), PENDING_KEY, 'tab-a', locks);
    expect(queue.token).toBe('tab-a');
    const id1 = queue.push(add(1));
    const id2 = queue.push(add(2));
    expect(requests).toEqual([`${PENDING_LOCK_PREFIX}tab-a`]);
    expect(held.has(`${PENDING_LOCK_PREFIX}tab-a`)).toBe(true);
    queue.remove(id1);
    await Promise.resolve();
    expect(held.has(`${PENDING_LOCK_PREFIX}tab-a`)).toBe(true);
    queue.remove(id2);
    await new Promise((r) => setTimeout(r, 0));
    expect(held.has(`${PENDING_LOCK_PREFIX}tab-a`)).toBe(false);
    // 再排一筆會重新取鎖
    queue.push(add(3));
    expect(requests).toHaveLength(2);
  });
});
