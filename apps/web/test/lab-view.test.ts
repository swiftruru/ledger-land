// 實驗室的檢視設定（features/lab/lab-view.ts，03 第 3.13 節、06 第 4.2 節）：口徑的記憶規則（預設教材；這次使用中切換過才照設定；重新載入或從題目開啟一律教材）、
// 設定值的整理、讀寫時其他欄位保留（schema 是 strict 的四個欄位）。用 MemoryProgressStore 驗讀寫。
import { MemoryProgressStore } from '@ledgerland/progress';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_LAB_VIEW,
  LAB_VIEW_SETTING,
  labViewSwitched,
  normaliseLabView,
  policyToShow,
  readLabView,
  resetLabViewForTests,
  writeLabView,
} from '../src/features/lab/lab-view.ts';
import { meta } from './fixtures.ts';

const NOW = '2026-11-07T10:00:00.000Z';
let store: MemoryProgressStore;
beforeEach(() => {
  store = MemoryProgressStore.empty(meta());
  resetLabViewForTests();
});

describe('policyToShow（口徑的記憶規則）', () => {
  it('這次使用中沒切換過：不管設定存什麼都是教材（重新載入或直接開網址回到教材）', () => {
    expect(policyToShow('ifrs@1', { switched: false, fromQuestion: false })).toBe('teacher@1');
    expect(policyToShow('teacher@1', { switched: false, fromQuestion: false })).toBe('teacher@1');
  });
  it('切換過就照設定（換步驟、換頁都沿用）', () => {
    expect(policyToShow('ifrs@1', { switched: true, fromQuestion: false })).toBe('ifrs@1');
    expect(policyToShow('teacher@1', { switched: true, fromQuestion: false })).toBe('teacher@1');
  });
  it('從題目開啟（?from=）一律先用教材，切換過也一樣', () => {
    expect(policyToShow('ifrs@1', { switched: true, fromQuestion: true })).toBe('teacher@1');
  });
  it('旗標一開始是沒切換過，測試用的重設會歸零', () => {
    expect(labViewSwitched()).toBe(false);
  });
});

describe('normaliseLabView', () => {
  it('壞掉或缺欄位用預設；只認兩套口徑', () => {
    expect(normaliseLabView(undefined)).toEqual(DEFAULT_LAB_VIEW);
    expect(normaliseLabView('x')).toEqual(DEFAULT_LAB_VIEW);
    expect(normaliseLabView({ policy: 'ifrs@1', journalLayerOpen: true })).toEqual({ policy: 'ifrs@1', journalLayerOpen: true });
    expect(normaliseLabView({ policy: 'ifrs@2', journalLayerOpen: 'yes' })).toEqual(DEFAULT_LAB_VIEW);
  });
});

describe('readLabView 與 writeLabView', () => {
  it('空的資料庫讀到預設；寫入口徑時補齊 schema 要的四個欄位；再寫分錄層時口徑保留', async () => {
    expect(await readLabView(store)).toEqual(DEFAULT_LAB_VIEW);
    await writeLabView(store, { policy: 'ifrs@1' }, NOW);
    expect((await store.getSetting(LAB_VIEW_SETTING))?.value).toEqual({ policy: 'ifrs@1', window: 'cumulative', statement: 'is', journalLayerOpen: false });
    await writeLabView(store, { journalLayerOpen: true }, NOW);
    expect(await readLabView(store)).toEqual({ policy: 'ifrs@1', journalLayerOpen: true });
  });
  it('既有的 window 與 statement 保留；壞掉的口徑寫回時改成教材', async () => {
    await store.setSetting(LAB_VIEW_SETTING, { policy: 'nope', window: 'transaction', statement: 'bs', journalLayerOpen: true }, NOW);
    await writeLabView(store, { journalLayerOpen: false }, NOW);
    expect((await store.getSetting(LAB_VIEW_SETTING))?.value).toEqual({ policy: 'teacher@1', window: 'transaction', statement: 'bs', journalLayerOpen: false });
  });
  it('讀寫失敗不丟錯', async () => {
    const broken = {
      getSetting: () => Promise.reject(new Error('boom')),
      setSetting: () => Promise.reject(new Error('boom')),
    };
    expect(await readLabView(broken)).toEqual(DEFAULT_LAB_VIEW);
    await expect(writeLabView(broken, { policy: 'ifrs@1' }, NOW)).resolves.toBeUndefined();
  });
});
