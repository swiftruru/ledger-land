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
import { ExpirationPlugin } from 'workbox-expiration';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

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
// 講義題庫（M4c，06 第 3.2 節的「選讀的大型內容包」）：一份講義一檔加審核用的一檔，合計約 0.5 MB，不進 precache（vite.config.ts 的 globIgnores）；
// 第一次讀到才快取、之後直接從快取回（檔名帶內容雜湊，永不過期），舊雜湊的檔靠 maxEntries 淘汰。開過苦練首頁之後離線也能練：
// 首頁畫好後會送 PREFETCH_HANDOUT 訊息（features/exam/prefetch.ts），這裡用同一個策略把三份講義檔抓進快取
const HANDOUT_PATH = /^\/content\/[^/]+\/handout_[^/]+\.json$/;
const handoutStrategy = new CacheFirst({ cacheName: 'll-handout', plugins: [new ExpirationPlugin({ maxEntries: 8 })] });
registerRoute(({ url, sameOrigin }) => sameOrigin && HANDOUT_PATH.test(url.pathname), handoutStrategy);
// 會計公式的完整內容檔（2026-11-07）：每個語系一檔、合計約 0.3 MB，同樣不進 precache；公式總覽畫好後送 PREFETCH_FORMULAS 把兩個語系抓進快取（索引檔在 precache）
const FORMULA_PATH = /^\/content\/[^/]+\/formulas\.[^/]+\.json$/;
const formulaStrategy = new CacheFirst({ cacheName: 'll-formulas', plugins: [new ExpirationPlugin({ maxEntries: 4 })] });
registerRoute(({ url, sameOrigin }) => sameOrigin && FORMULA_PATH.test(url.pathname), formulaStrategy);

/** 頁面請 SW 預抓內容檔：只收同源、路徑符合該種檔案樣式的網址（訊息來自頁面，不照單全收）；已在快取的直接命中，抓不到（離線）就略過，不讓訊息處理失敗 */
function prefetchContent(event: ExtendableMessageEvent, urls: unknown, path: RegExp, strategy: CacheFirst): void {
  if (!Array.isArray(urls)) return;
  const requests = urls
    .filter((u): u is string => typeof u === 'string')
    .map((u) => new URL(u, location.href))
    .filter((u) => u.origin === location.origin && path.test(u.pathname))
    .map((u) => new Request(u.href));
  event.waitUntil(Promise.all(requests.map((request) => Promise.all(strategy.handleAll({ request, event })).catch(() => undefined))));
}
// 離線導覽 fallback：中文與 /en/ 開頭的路徑都回同一份殼層 index.html；/assets/ 與 /content/ 找不到檔案時不回殼層，
// Cloudflare 保留的 /cdn-cgi/、sw.js 本身、stub 端點、sitemap.xml 與 robots.txt（給搜尋引擎的檔案，在瀏覽器打開也要看到原檔）一律走網路（06 第 3.1 節）
registerRoute(
  new NavigationRoute(controller.createHandlerBoundToURL('index.html'), {
    denylist: [/^\/assets\//, /^\/content\//, /^\/sw\.js$/, /^\/cdn-cgi\//, /^\/__ll/, /^\/sitemap\.xml$/, /^\/robots\.txt$/],
  }),
);
// prompt 模式：只有頁面按下更新提示、workbox-window 送來 SKIP_WAITING 才切換（06 第 3.3 節）；PREFETCH_HANDOUT 是苦練首頁的預抓，PREFETCH_FORMULAS 是公式總覽的預抓
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') void self.skipWaiting();
  else if (event.data.type === 'PREFETCH_HANDOUT') prefetchContent(event, event.data.urls, HANDOUT_PATH, handoutStrategy);
  else if (event.data.type === 'PREFETCH_FORMULAS') prefetchContent(event, event.data.urls, FORMULA_PATH, formulaStrategy);
});
