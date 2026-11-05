// 講義題庫的離線保險（M4c 補，06 第 3.2 節）：苦練首頁只讀 manifest 的小索引，講義檔要等第一次練「那一份」才會被 Service Worker 的 CacheFirst 收進 ll-handout；
// 學生只練過 0-1 就斷網，0-2 會開不了。所以開過苦練首頁、頁面畫好之後，在閒置時把三份講義檔的網址送給 SW（PREFETCH_HANDOUT 訊息），
// 由 SW 用同一個策略抓進快取。不走頁面自己的 fetch：prompt 模式第一次安裝不接管頁面，那些請求不會經過 SW，也就不會進快取。
// 離線或開了省流量就不送；沒有 Service Worker（本機 dev、舊瀏覽器）就什麼都不做。
import type { HandoutManifestEntry } from '../../lib/content.ts';
import { afterFirstPaint } from '../../lib/idle.ts';

export const PREFETCH_HANDOUT = 'PREFETCH_HANDOUT';

/** navigator 裡用得到的幾個欄位；connection 只有 Chromium 有，沒有在 lib.dom 裡 */
export interface PrefetchNavigator {
  serviceWorker?: { ready: Promise<{ active: { postMessage(message: unknown): void } | null }> };
  onLine?: boolean;
  connection?: { saveData?: boolean };
}

/** 三份講義檔的網址（依講義順序）；審核檔只有老師會開，不預抓 */
export function handoutPrefetchUrls(index: HandoutManifestEntry): string[] {
  return [...index.decks].sort((a, b) => a.order - b.order).map((d) => `/${d.file}`);
}

export function shouldPrefetch(nav: PrefetchNavigator): boolean {
  if (!nav.serviceWorker) return false;
  if (nav.onLine === false) return false;
  if (nav.connection?.saveData) return false;
  return true;
}

/** 把講義檔的網址送給 SW；等到 SW 註冊並啟用（ready）才送，回傳有沒有送出 */
export async function postHandoutPrefetch(index: HandoutManifestEntry, nav: PrefetchNavigator = navigator as PrefetchNavigator): Promise<boolean> {
  if (!shouldPrefetch(nav)) return false;
  const registration = await nav.serviceWorker!.ready;
  if (!registration.active) return false;
  registration.active.postMessage({ type: PREFETCH_HANDOUT, urls: handoutPrefetchUrls(index) });
  return true;
}

/** 頁面畫好、閒置之後才送（和開進度資料庫一樣不跟首次載入搶）；回傳取消函式給 effect 的清理 */
export function scheduleHandoutPrefetch(index: HandoutManifestEntry): () => void {
  let cancelled = false;
  const cancel = afterFirstPaint(() => {
    if (!cancelled) void postHandoutPrefetch(index).catch(() => undefined);
  });
  return () => {
    cancelled = true;
    cancel();
  };
}
