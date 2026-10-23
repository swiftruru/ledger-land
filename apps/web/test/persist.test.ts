// persist() 的呼叫時機（06 第 4.5 節的表；10 M2 完成標準）：用注入的假 navigator.storage 驗證每一種情境
import type { PersistResult } from '@ledgerland/progress';
import { describe, expect, it, vi } from 'vitest';
import { maybePersistWith, type PersistDeps, type PersistTrigger } from '../src/lib/progress/persist.ts';
import { NOW } from './fixtures.ts';

type PersistFn = () => Promise<boolean>;

function deps(
  overrides: Partial<PersistDeps> & { persisted?: boolean; grant?: boolean },
): PersistDeps & { persist: ReturnType<typeof vi.fn<PersistFn>>; results: PersistResult[] } {
  const results: PersistResult[] = [];
  const persist = vi.fn<PersistFn>(async () => overrides.grant ?? true);
  return {
    storage: { persist, persisted: async () => overrides.persisted ?? false },
    inAppBrowser: false,
    geckoFirefox: false,
    appMode: false,
    now: () => NOW,
    getPersistResult: async () => results.at(-1),
    setPersistResult: async (r) => {
      results.push(r);
    },
    ...overrides,
    persist,
    results,
  };
}

describe('maybePersist', () => {
  it('App 模式啟動：呼叫 persist 並把結果寫進設定', async () => {
    const d = deps({ appMode: true });
    expect(await maybePersistWith('launch', d)).toBe('granted');
    expect(d.persist).toHaveBeenCalledTimes(1);
    expect(d.results).toEqual([{ granted: true, trigger: 'launch', at: NOW }]);
  });

  it('一般瀏覽器分頁啟動：不呼叫', async () => {
    const d = deps({ appMode: false });
    expect(await maybePersistWith('launch', d)).toBe('skipped');
    expect(d.persist).not.toHaveBeenCalled();
  });

  it('第一次完成關卡：一般分頁與 App 模式都呼叫，只觸發一次', async () => {
    const d = deps({ appMode: false, grant: false });
    expect(await maybePersistWith('first-level-complete', d)).toBe('denied');
    expect(d.results[0]).toEqual({ granted: false, trigger: 'first-level-complete', at: NOW });
    expect(await maybePersistWith('first-level-complete', d)).toBe('skipped');
    expect(d.persist).toHaveBeenCalledTimes(1);
  });

  it('Firefox（Gecko）：只在設定頁的按鈕呼叫', async () => {
    const d = deps({ geckoFirefox: true, appMode: true });
    expect(await maybePersistWith('launch', d)).toBe('skipped');
    expect(await maybePersistWith('first-level-complete', d)).toBe('skipped');
    expect(d.persist).not.toHaveBeenCalled();
    expect(await maybePersistWith('settings-button', d)).toBe('granted');
    expect(d.persist).toHaveBeenCalledTimes(1);
  });

  it('App 內建瀏覽器：一律 skipped，連 persisted() 都不問', async () => {
    const persisted = vi.fn<PersistFn>(async () => false);
    const d = deps({ inAppBrowser: true, appMode: true });
    const withSpy: PersistDeps = { ...d, storage: { persist: d.persist, persisted } };
    for (const trigger of ['launch', 'first-level-complete', 'settings-button'] as PersistTrigger[]) {
      expect(await maybePersistWith(trigger, withSpy)).toBe('skipped');
    }
    expect(persisted).not.toHaveBeenCalled();
    expect(d.persist).not.toHaveBeenCalled();
  });

  it('已經是 persistent：回 already，不再呼叫', async () => {
    const d = deps({ persisted: true, appMode: true });
    expect(await maybePersistWith('launch', d)).toBe('already');
    expect(await maybePersistWith('settings-button', d)).toBe('already');
    expect(d.persist).not.toHaveBeenCalled();
  });

  it('沒有 navigator.storage.persist：unsupported', async () => {
    const d = deps({});
    expect(await maybePersistWith('settings-button', { ...d, storage: undefined })).toBe('unsupported');
    expect(await maybePersistWith('settings-button', { ...d, storage: { persisted: async () => false } })).toBe('unsupported');
  });
});
