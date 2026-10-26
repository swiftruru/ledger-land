// 進度資料庫暫停時的作答紀錄（quiz-7，06 第 4.3 節）：另一個分頁升級時讀取會丟 StoreSuspendedError、寫入排進暫存佇列。
// 作答紀錄不能因為讀取失敗整筆遺失：deviceId 用先前讀到的值，作答紀錄與名詞解鎖照樣送出（重放冪等），不顯示「收進名詞圖鑑」的提示；
// 要讀舊值才能算的錯題本與關卡成績不盲寫（會蓋掉較新的盒子與星星），交給暫存佇列的重放規則（handoff 給 core 組）。
import { MemoryProgressStore, type ProgressStore } from '@ledgerland/progress';
import { beforeEach, describe, expect, it } from 'vitest';
import { recordAttempt, recordLevelComplete } from '../src/features/quiz/record.ts';
import { scoreSnapshotQuestion } from '../src/features/quiz/scoring.ts';
import { DEVICE, meta } from './fixtures.ts';
import { qSingle } from './quiz-fixtures.ts';

class SuspendedError extends Error {
  constructor() {
    super('網站已在其他分頁更新');
    this.name = 'StoreSuspendedError';
  }
}

/** 可以切成暫停的假 store：暫停時讀取丟 StoreSuspendedError，寫入記進 queued（像 IndexedDBProgressStore 排進 ll:pending） */
function suspendable(base: MemoryProgressStore) {
  const queued: string[] = [];
  let suspended = false;
  const store = Object.create(base) as ProgressStore & { isSuspended: boolean };
  Object.defineProperty(store, 'isSuspended', { get: () => suspended });
  const reads = ['getMeta', 'getReview', 'hasUnlock', 'getLevelProgress', 'listLevelProgress', 'getSetting'] as const;
  for (const name of reads) {
    const original = (base[name] as (...args: unknown[]) => Promise<unknown>).bind(base);
    (store as unknown as Record<string, unknown>)[name] = (...args: unknown[]) => (suspended ? Promise.reject(new SuspendedError()) : original(...args));
  }
  const writes = ['addAttempt', 'putReview', 'addUnlock', 'putLevelProgress', 'setSetting'] as const;
  for (const name of writes) {
    const original = (base[name] as (...args: unknown[]) => Promise<void>).bind(base);
    (store as unknown as Record<string, unknown>)[name] = (...args: unknown[]) => {
      if (!suspended) return original(...args);
      queued.push(name);
      return Promise.resolve();
    };
  }
  return { store, queued, suspend: () => (suspended = true) };
}

let base: MemoryProgressStore;
beforeEach(() => {
  base = MemoryProgressStore.empty(meta());
});

describe('recordAttempt（資料庫暫停中）', () => {
  it('作答紀錄與名詞解鎖照樣排進佇列、deviceId 用先前讀到的；錯題本不盲寫；不回報新解鎖的名詞', async () => {
    const s = suspendable(base);
    const right = scoreSnapshotQuestion(qSingle, 'o_a1b2');
    // 暫停前先作答一次（讀到 meta）
    await recordAttempt({ q: { ...qSingle, termRefs: [] }, answer: right.answer, result: right.result, source: 'play', durationMs: 0 }, s.store);
    s.suspend();
    const wrong = scoreSnapshotQuestion(qSingle, 'o_c3d4');
    const out = await recordAttempt({ q: qSingle, answer: wrong.answer, result: wrong.result, source: 'play', levelId: 'lv_t3st0001', durationMs: 5 }, s.store);
    expect(out.attemptId).toMatch(/^a_/);
    expect(out.unlockedTerms).toEqual([]);
    expect(s.queued).toEqual(['addAttempt', 'addUnlock']);
  });
});

describe('recordLevelComplete（資料庫暫停中）', () => {
  it('讀不到舊成績時不寫（不用空的舊值蓋掉較高的星星），丟出錯誤交給頁面', async () => {
    await recordLevelComplete('lv_t3st0001', [{ scored: true, score: 1 }], base);
    const s = suspendable(base);
    s.suspend();
    await expect(recordLevelComplete('lv_t3st0001', [{ scored: true, score: 0 }], s.store)).rejects.toThrow('網站已在其他分頁更新');
    expect(s.queued).toEqual([]);
    expect((await base.getLevelProgress('lv_t3st0001'))?.stars).toBe(3);
    expect((await base.getMeta()).deviceId).toBe(DEVICE);
  });
});
