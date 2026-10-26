// 學習設定的 localStorage 鏡像（06 第 4.1 節）：locale、timerEnabled 在 setSetting 時同步寫到 ll:settings，讓 boot 腳本在第一次繪製前讀取；
// 作答頁開始工作階段時也從這裡讀 timerEnabled（readMirroredSetting），不必搶在 LCP 前開進度資料庫。
// 不依賴 @ledgerland/progress 的執行期程式，可以留在首次載入的 chunk。
import type { JsonValue } from '@ledgerland/progress';
import type { KeyValueStorage } from './pending.ts';

export const SETTINGS_MIRROR_KEY = 'll:settings';
/** 要鏡像到 localStorage 的學習設定 */
export const MIRRORED_SETTINGS: readonly string[] = ['locale', 'timerEnabled'];

export function mirrorSetting(storage: KeyValueStorage | null, key: string, value: JsonValue): void {
  if (storage === null || !MIRRORED_SETTINGS.includes(key)) return;
  try {
    const raw = storage.getItem(SETTINGS_MIRROR_KEY);
    const current = raw === null ? {} : (JSON.parse(raw) as Record<string, JsonValue>);
    storage.setItem(SETTINGS_MIRROR_KEY, JSON.stringify({ ...current, [key]: value }));
    // boot 腳本只認 ll:locale（05 第 7.4 節第 3 點），語系另外寫一份
    if (key === 'locale' && typeof value === 'string') storage.setItem('ll:locale', value);
  } catch {
    /* 鏡像寫不進去只影響第一次繪製前的預設 */
  }
}

/** 讀鏡像裡的一個學習設定：第一次繪製前就要的值（作答頁要不要計時）從這裡拿，不開進度資料庫（06 第 8.2 節）。
 *  沒有鏡像、內容壞掉、讀不到 localStorage 或不是鏡像的鍵一律回 undefined */
export function readMirroredSetting(storage: Pick<KeyValueStorage, 'getItem'> | null, key: string): JsonValue | undefined {
  if (storage === null || !MIRRORED_SETTINGS.includes(key)) return undefined;
  try {
    const raw = storage.getItem(SETTINGS_MIRROR_KEY);
    if (raw === null) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    return (parsed as Record<string, JsonValue>)[key];
  } catch {
    return undefined;
  }
}

/** 瀏覽器的 localStorage；隱私模式或被停用而丟出例外時是 null */
export function browserStorageOrNull(): KeyValueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
