// Service Worker 原始碼（06 第 3.1、3.2 節）。vite-plugin-pwa 的 injectManifest 先用 Vite 把這個檔打包成 dist/sw.js，
// 再把 precache 清單注入 self.__WB_MANIFEST；其餘邏輯都在這裡，和原本 generateSW 的產物一樣：precache 加路由、cleanupOutdatedCaches、
// 導覽 fallback 與 denylist、SKIP_WAITING 訊息（prompt 模式，絕不自動 skipWaiting）。唯一的差別是 install 並行抓取。
//
// 為什麼不用 precacheAndRoute（2026-10-29）：Workbox 7.4.1 的 PrecacheController.install 對清單逐項 await（它的註解指向 issue #2528），
// 147 個項目在台灣每個約 180 到 190 ms，第一次安裝要 27 到 29 秒才能離線。這裡自己建 PrecacheController，install 改成最多 CONCURRENCY 個同時抓；
// 每一個項目仍然交給 Workbox 自己的 PrecacheStrategy.handleAll，所以 cache key（帶 revision 的項目加 __WB_REVISION__ 查詢參數）、
// cache: 'reload' 繞過 HTTP 快取、狀態碼 400 以上不快取並讓 install 失敗、轉址回應先複製再存，全都是 Workbox 原本的規則，只有順序不同。
// 沒有採用：保留 precacheAndRoute，另外在 install 先並行塞滿快取讓 Workbox 的迴圈命中（PrecacheStrategy._handle 確實先 cacheMatch 才抓網路）。
// 兩個 install 監聽器會同時跑，Workbox 的迴圈從頭跟著抓，開頭的項目會抓兩次，而且可快取的判斷要自己再寫一份；直接用同一個 strategy 並行比較乾淨。
// Workbox 7.4.1 沒有提供並行的選項（PrecacheController.install 寫死逐項）；升版時看它有沒有加，有的話這段可以拿掉。
import { cleanupOutdatedCaches, PrecacheController, PrecacheRoute } from 'workbox-precaching';
import type { PrecacheEntry } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<PrecacheEntry | string> };

/** 同時抓幾個 precache 項目。Cloudflare 走 HTTP/2，一條連線可以同時跑很多個請求；2026-10-29 在 PR 預覽網址用頁面的 fetch 抓整份清單（147 項、cache: 'reload'）實測：
 * 逐項 27.5 秒、8 個 4.4 到 5.4 秒、16 個 1.7 到 2.6 秒、32 個 1.0 到 1.6 秒，狀態碼全是 200。取 16：再往上省不到 1 秒，對行動網路與低階手機的記憶體比較客氣（06 第 3.2 節）。
 * 本機 wrangler dev 是 HTTP/1.1，瀏覽器自己排到 6 條連線 */
const CONCURRENCY = 16;

const controller = new PrecacheController();
const manifest = self.__WB_MANIFEST;
controller.addToCacheList(manifest);
// 帶 revision 的項目 install 時用 cache: 'reload' 繞過 HTTP 快取，雜湊檔名的用 'default'（PrecacheController.addToCacheList 的規則；目前清單裡每一項都帶 revision）
const reloadUrls = new Set(
  manifest.filter((entry): entry is PrecacheEntry => typeof entry !== 'string' && !!entry.revision).map((entry) => new URL(entry.url, location.href).href),
);

/** PrecacheController.install 的並行版本：同一個 strategy、同一組 request 參數，只是同時處理 CONCURRENCY 個；任何一項失敗就讓 install 失敗（Workbox 的規則），
 * 已經存進快取的項目留著，下一次 install 先命中快取、只補沒抓到的 */
async function installInParallel(event: ExtendableEvent): Promise<void> {
  const queue = [...controller.getURLsToCacheKeys()];
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const item = queue[next];
      if (!item) return;
      next += 1;
      const [url, cacheKey] = item;
      const request = new Request(url, {
        integrity: controller.getIntegrityForCacheKey(cacheKey),
        cache: reloadUrls.has(url) ? 'reload' : 'default',
        credentials: 'same-origin',
      });
      await Promise.all(controller.strategy.handleAll({ params: { cacheKey }, request, event }));
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
}

self.addEventListener('install', (event) => {
  event.waitUntil(installInParallel(event));
});
// activate：刪掉快取裡不在這一版清單的項目（PrecacheController.activate 自己會呼叫 waitUntil）
self.addEventListener('activate', (event) => {
  event.waitUntil(controller.activate(event));
});
// 舊版 Workbox 命名的 precache（cache 名稱不同版本）在 activate 時清掉
cleanupOutdatedCaches();
// precache 的路由（precacheAndRoute 的後半：directoryIndex、cleanURLs 與忽略 utm 參數都用 Workbox 的預設）
registerRoute(new PrecacheRoute(controller));
// 離線導覽 fallback：中文與 /en/ 開頭的路徑都回同一份殼層 index.html；/assets/ 與 /content/ 找不到檔案時不回殼層，
// Cloudflare 保留的 /cdn-cgi/、sw.js 本身與 stub 端點一律走網路（06 第 3.1 節）
registerRoute(
  new NavigationRoute(controller.createHandlerBoundToURL('index.html'), {
    denylist: [/^\/assets\//, /^\/content\//, /^\/sw\.js$/, /^\/cdn-cgi\//, /^\/__ll/],
  }),
);
// prompt 模式：只有頁面按下更新提示、workbox-window 送來 SKIP_WAITING 才切換（06 第 3.3 節）
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') void self.skipWaiting();
});
