// navigator.storage.persist() 的呼叫時機（06 第 4.5 節的流程，D10(a)）：launch 只在 App 模式、first-level-complete 只觸發一次、
// settings-button 是 Firefox 的唯一入口；App 內建瀏覽器一律不呼叫。結果寫進 settings 的 persistResult。
// maybePersistWith 是可注入的純流程（測試用）；maybePersist 讀真正的 navigator 與環境。
import type { PersistResult } from '@ledgerland/progress';
import { isAppMode, isGeckoFirefox, isInAppBrowser } from '../env.ts';
import { nowIso } from './app-info.ts';
import { getProgressStore } from './index.ts';
import { storageStatus } from './status.ts';

export type PersistTrigger = PersistResult['trigger'];
export type PersistOutcome = 'unsupported' | 'skipped' | 'already' | 'granted' | 'denied';

export interface PersistDeps {
  readonly storage?: { readonly persist?: () => Promise<boolean>; readonly persisted?: () => Promise<boolean> };
  readonly inAppBrowser: boolean;
  readonly geckoFirefox: boolean;
  readonly appMode: boolean;
  readonly now: () => string;
  readonly getPersistResult: () => Promise<PersistResult | undefined>;
  readonly setPersistResult: (result: PersistResult) => Promise<void>;
}

export async function maybePersistWith(trigger: PersistTrigger, deps: PersistDeps): Promise<PersistOutcome> {
  const storage = deps.storage;
  if (storage?.persist === undefined || storage.persisted === undefined) return 'unsupported';
  if (deps.inAppBrowser) return 'skipped';
  if (await storage.persisted()) return 'already';
  if (deps.geckoFirefox && trigger !== 'settings-button') return 'skipped';
  if (trigger === 'launch' && !deps.appMode) return 'skipped';
  if (trigger === 'first-level-complete') {
    const prev = await deps.getPersistResult();
    if (prev?.trigger === 'first-level-complete') return 'skipped';
  }
  const granted = await storage.persist();
  await deps.setPersistResult({ granted, trigger, at: deps.now() });
  return granted ? 'granted' : 'denied';
}

function browserStorage(): PersistDeps['storage'] {
  const s = navigator.storage as StorageManager | undefined;
  if (s === undefined) return undefined;
  return {
    ...(typeof s.persist === 'function' ? { persist: () => s.persist() } : {}),
    ...(typeof s.persisted === 'function' ? { persisted: () => s.persisted() } : {}),
  };
}

export async function maybePersist(trigger: PersistTrigger): Promise<PersistOutcome> {
  const store = await getProgressStore();
  const outcome = await maybePersistWith(trigger, {
    storage: browserStorage(),
    inAppBrowser: isInAppBrowser(),
    geckoFirefox: isGeckoFirefox(),
    appMode: isAppMode(),
    now: nowIso,
    async getPersistResult() {
      const entry = await store.getSetting('persistResult');
      return entry?.value as PersistResult | undefined;
    },
    async setPersistResult(result) {
      await store.setSetting('persistResult', result, result.at);
    },
  });
  if (outcome === 'already' || outcome === 'granted') storageStatus.set({ persisted: true });
  else if (outcome === 'denied') storageStatus.set({ persisted: false });
  return outcome;
}

/** 讀 persisted() 的現況（設定頁與備份頁顯示）；不支援時回 null */
export async function refreshPersisted(): Promise<boolean | null> {
  const s = browserStorage();
  if (s?.persisted === undefined) return null;
  try {
    const v = await s.persisted();
    storageStatus.set({ persisted: v });
    return v;
  } catch {
    return null;
  }
}
