// getProgressStore 單例（06 第 4.4 節）：IndexedDB 可用時是 IndexedDB 實作並建立 meta；開不了時退到記憶體模式並設 degraded；設定的 localStorage 鏡像
import { DB_SCHEMA_VERSION, MemoryProgressStore } from '@ledgerland/progress';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SETTINGS_MIRROR_KEY, getProgressStore, hasNoProgress, mirrorSetting, resetProgressStoreForTests, storageStatus } from '../src/lib/progress/index.ts';
import { IndexedDBProgressStore } from '../src/lib/progress/indexeddb-store.ts';
import { MemoryStorage, attempt, freshIndexedDB } from './fixtures.ts';

describe('getProgressStore', () => {
  beforeEach(async () => {
    freshIndexedDB();
    await resetProgressStoreForTests();
  });
  afterEach(async () => {
    await resetProgressStoreForTests();
  });

  it('IndexedDB 可用：回傳 IndexedDB 實作、單例、meta 已建立', async () => {
    const store = await getProgressStore();
    expect(store).toBeInstanceOf(IndexedDBProgressStore);
    expect(await getProgressStore()).toBe(store);
    const m = await store.getMeta();
    expect(m.deviceId).toMatch(/^d_[0-9a-hjkmnp-tv-z]{8}$/);
    expect(m.dbSchemaVersion).toBe(DB_SCHEMA_VERSION);
    expect(m.appVersion).toBe('0.0.0+test');
    expect(storageStatus.get().degraded).toBe(false);
    expect(await hasNoProgress(store)).toBe(true);
    await store.addAttempt(attempt(1));
    expect(await hasNoProgress(store)).toBe(false);
  });

  it('IndexedDB 開不了：退到 MemoryProgressStore 並設 degraded', async () => {
    const broken = {
      open: () => {
        throw new Error('InvalidStateError');
      },
    } as unknown as IDBFactory;
    globalThis.indexedDB = broken;
    const store = await getProgressStore();
    expect(store).toBeInstanceOf(MemoryProgressStore);
    expect(storageStatus.get().degraded).toBe(true);
    await store.addAttempt(attempt(1));
    expect(await store.listAttempts()).toHaveLength(1);
  });
});

describe('mirrorSetting', () => {
  it('只鏡像學習設定到 ll:settings；locale 另外寫 ll:locale 給 boot 腳本', () => {
    const storage = new MemoryStorage();
    mirrorSetting(storage, 'locale', 'en');
    mirrorSetting(storage, 'timerEnabled', true);
    mirrorSetting(storage, 'labView', { policy: 'teacher@1' });
    expect(JSON.parse(storage.getItem(SETTINGS_MIRROR_KEY)!)).toEqual({ locale: 'en', timerEnabled: true });
    expect(storage.getItem('ll:locale')).toBe('en');
    mirrorSetting(null, 'locale', 'zh-TW');
    expect(storage.getItem('ll:locale')).toBe('en');
  });
});
