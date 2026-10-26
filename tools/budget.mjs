// 體積預算（06 第 8.2 節、09 第 10.2 節）：首次載入 JS（gzip）中文入口與 /en/ 入口分別計算；首次載入 CSS（index.html 引用的那一份）；全部 CSS 的合計（allCssGzipKb）；precache 總量（原始大小）。
// 預算在 apps/web/perf/urls.json 的 budgets。QR 解碼器（M2）與 Excel 相關函式庫不得出現在首次載入的 chunk。
// mapChunkGzipKb（17 第 8 節）：闖關地圖自己的 chunk（Play 頁與 web-ui 的 quest-map 元件，gzip 加總）不含它們靜態 import 的共用 chunk；urls.json 沒有這個預算時不檢查。
// 場景 SVG 體積檢查（17 第 4、10 節的 M3 驗收，圖規第 9 節）：每個章節場景是依章 lazy 載入的獨立 chunk（assets/scene-<名稱>-<hash>.js，來源 apps/web/src/features/quest-map-scenes/，放在 quest-map 目錄外是為了避開 vite.config.ts 的 quest-map 群組），
// sceneChunkGzipKb 是單一場景的 gzip 上限、sceneChunksTotalGzipKb 是全部場景的 gzip 合計上限；sceneKitGzipKb 是各章共用的 scene-kit（放置器、地形塊、共用小物件，取代 2026-10-24 併在地圖 chunk 的 scene-shared）。
// scene-kit 被每一章靜態 import，Vite 把它放進以「用到它的場景」命名的共用 chunk（shared~scene-…），名稱會被截短，所以用「每個場景 chunk 都 import 它」認出來；
// vite.config.ts 若另外替它開名為 scene-kit 的群組，scene-kit-<hash>.js 也認得。其他只被部分場景共用的 shared~scene-… chunk 算進場景的單章與合計檢查。urls.json 沒有這些預算時不檢查。
import { gzipSync } from 'node:zlib';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, fail } from './lib/fs.mjs';

const app = join(ROOT, 'apps/web');
const dist = join(app, 'dist');
const cfg = JSON.parse(readFileSync(join(app, 'perf/urls.json'), 'utf8'));
const budgets = cfg.budgets;
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const gz = (p) => gzipSync(readFileSync(p)).length;

// 首次載入：index.html 引用的 module script 與 modulepreload，加上它們靜態 import 的 chunk（遞迴）
const assets = join(dist, 'assets');
const entry = [...html.matchAll(/<script type="module"[^>]*src="\/assets\/([^"]+)"/g)].map((m) => m[1]);
const preload = [...html.matchAll(/<link rel="modulepreload"[^>]*href="\/assets\/([^"]+)"/g)].map((m) => m[1]);
const seen = new Set();
function collect(file) {
  if (seen.has(file) || !existsSync(join(assets, file))) return;
  seen.add(file);
  const src = readFileSync(join(assets, file), 'utf8');
  for (const m of src.matchAll(/(?:^|[;\n])import[^;'"]*['"]\.\/([^'"]+\.js)['"]/g)) collect(m[1]);
  for (const m of src.matchAll(/from\s*['"]\.\/([^'"]+\.js)['"]/g)) collect(m[1]);
}
for (const f of [...entry, ...preload]) collect(f);
const initialJs = [...seen].reduce((s, f) => s + gz(join(assets, f)), 0);
// 首次載入 CSS：index.html 以 <link rel="stylesheet"> 引用的檔案（擋住第一次繪製的那一份），和首次載入 JS 一樣不含懶載入頁面自己的 CSS
// （地圖、章節頁、名詞圖鑑等頁面的 CSS 隨頁面 chunk 載入；2026-10-25 以前這裡加總 assets 底下所有 CSS，頁面 CSS 拆出去以後已經不是「首次載入」）。
// 全部 CSS 的合計（assets 底下所有 CSS，含懶載入頁面自己的 CSS）另有預算 allCssGzipKb（2026-10-25 起）：首次載入那一項只管開頁速度，
// 這一項防止頁面 CSS 不受控制地長大（urls.json 沒有這個預算時不檢查）
const cssFiles = [...html.matchAll(/<link rel="stylesheet"[^>]*href="\/assets\/([^"]+\.css)"/g)].map((m) => m[1]);
if (cssFiles.length === 0) fail('budget：index.html 沒有引用任何 CSS（<link rel="stylesheet" href="/assets/…css">），無法檢查 initialCssGzipKb');
const cssGz = cssFiles.reduce((s, f) => s + gz(join(assets, f)), 0);
const allCssGz = readdirSync(assets)
  .filter((f) => f.endsWith('.css'))
  .reduce((s, f) => s + gz(join(assets, f)), 0);
// en 入口另外載入 en catalog（動態 import 的 chunk：apps/web/src/i18n/catalog-en.ts 把兩份 catalog 合成 catalog-en-<hash>.js；舊的分開檔名含 messages）
const enChunks = readdirSync(assets).filter((f) => /^catalog-en-[^/]*\.js$/.test(f) || /^messages.*\.js$/.test(f) || /en.*messages.*\.js$/.test(f));
const enCatalogGz = enChunks.length ? Math.max(...enChunks.map((f) => gz(join(assets, f)))) : 0;
const enInitial = initialJs + enCatalogGz;

// precache：從 sw.js 的 precache manifest 取出檔案清單，加總原始大小
const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
const urls = [...sw.matchAll(/"?url"?:"([^"]+)"/g)].map((m) => m[1].split('?')[0]);
let precache = 0;
for (const u of urls) {
  const p = join(dist, u);
  if (existsSync(p)) precache += statSync(p).size;
}
// 只比對 chunk 名稱開頭（Vite 的雜湊可能剛好含 qr 這類字串，例如 index-qrP_ls64.js）
for (const f of seen)
  if (/^(qr-worker|QrScanner|jsqr|zxing|xlsx|sheetjs|read-excel)[-.]/i.test(f)) fail(`budget：首次載入的 chunk 含 QR 解碼器或 Excel 函式庫：${f}`);
const kb = (n) => (n / 1024).toFixed(1);
// 闖關地圖：router 以 import('../pages/Play.tsx') 動態載入，Vite 以模組名命名 chunk（Play-<hash>.js）；web-ui 的地圖元件另成 quest-map-<hash>.js
const mapChunks = readdirSync(assets).filter((f) => /^(Play|quest-map)[.-][^/]*\.js$/.test(f));
const mapChunkGz = mapChunks.reduce((s, f) => s + gz(join(assets, f)), 0);
// 章節場景：每章一個 lazy chunk（scene-<名稱>-<hash>.js）；scene-kit 是每個場景 chunk 都靜態 import 的那個共用 chunk
const sceneEntries = readdirSync(assets)
  .filter((f) => /^scene-[a-z0-9-]+-[^/]*\.js$/.test(f) && !/^scene-(shared|kit)-/.test(f))
  .sort();
const staticImports = (f) => new Set([...readFileSync(join(assets, f), 'utf8').matchAll(/(?:from|import)\s*['"]\.\/([^'"]+\.js)['"]/g)].map((m) => m[1]));
const sceneShared = readdirSync(assets).filter((f) => /^(scene-kit-|shared~scene-)[^/]*\.js$/.test(f));
const sceneImports = sceneEntries.map(staticImports);
const kitChunks = sceneShared.filter((f) => sceneImports.length > 0 && sceneImports.every((s) => s.has(f)));
const sceneChunks = [...sceneEntries, ...sceneShared.filter((f) => !kitChunks.includes(f))];
const sceneSizes = Object.fromEntries(sceneChunks.map((f) => [f, +kb(gz(join(assets, f)))]));
const sceneTotalGz = sceneChunks.reduce((s, f) => s + gz(join(assets, f)), 0);
const kitGz = kitChunks.reduce((s, f) => s + gz(join(assets, f)), 0);
const result = {
  initialJsGzipKb: +kb(initialJs),
  initialJsEnGzipKb: +kb(enInitial),
  initialCssGzipKb: +kb(cssGz),
  initialCssFiles: cssFiles,
  allCssGzipKb: +kb(allCssGz),
  precacheKb: +kb(precache),
  precacheFiles: urls.length,
  chunks: [...seen],
  ...(mapChunks.length ? { mapChunkGzipKb: +kb(mapChunkGz), mapChunks } : {}),
  ...(sceneChunks.length ? { sceneChunksTotalGzipKb: +kb(sceneTotalGz), sceneChunks: sceneSizes } : {}),
  ...(kitChunks.length ? { sceneKitGzipKb: +kb(kitGz), sceneKitChunks: kitChunks } : {}),
};
if (initialJs > budgets.initialJsGzipKb * 1024) fail(`budget：中文入口首次載入 JS ${kb(initialJs)} KB 超過預算 ${budgets.initialJsGzipKb} KB`);
if (enInitial > budgets.initialJsGzipKb * 1024) fail(`budget：/en/ 入口首次載入 JS ${kb(enInitial)} KB 超過預算 ${budgets.initialJsGzipKb} KB`);
if (cssGz > budgets.initialCssGzipKb * 1024) fail(`budget：首次載入 CSS ${kb(cssGz)} KB（${cssFiles.join('、')}）超過預算 ${budgets.initialCssGzipKb} KB`);
if (typeof budgets.allCssGzipKb === 'number' && allCssGz > budgets.allCssGzipKb * 1024)
  fail(`budget：全部 CSS 合計 ${kb(allCssGz)} KB（gzip，含懶載入頁面的 CSS）超過預算 ${budgets.allCssGzipKb} KB`);
if (precache > budgets.precacheKb * 1024) fail(`budget：precache ${kb(precache)} KB 超過預算 ${budgets.precacheKb} KB`);
if (typeof budgets.mapChunkGzipKb === 'number') {
  if (mapChunks.length === 0) fail('budget：找不到闖關地圖的 chunk（assets/Play-*.js 或 quest-map-*.js），無法檢查 mapChunkGzipKb');
  else if (mapChunkGz > budgets.mapChunkGzipKb * 1024)
    fail(`budget：闖關地圖 chunk ${kb(mapChunkGz)} KB（gzip，${mapChunks.join('、')}）超過預算 ${budgets.mapChunkGzipKb} KB`);
}
if (typeof budgets.sceneChunkGzipKb === 'number' || typeof budgets.sceneChunksTotalGzipKb === 'number') {
  if (sceneEntries.length === 0)
    fail(
      'budget：找不到章節場景的 chunk（assets/scene-*.js），場景被併進地圖的 chunk 了。vite.config.ts 的 quest-map 群組只能抓 features/quest-map/ 與 quest-map.css，不能抓 quest-map-scenes/',
    );
  if (typeof budgets.sceneChunkGzipKb === 'number')
    for (const f of sceneChunks) {
      const size = gz(join(assets, f));
      if (size > budgets.sceneChunkGzipKb * 1024) fail(`budget：章節場景 ${f} ${kb(size)} KB（gzip）超過單章預算 ${budgets.sceneChunkGzipKb} KB`);
    }
  if (typeof budgets.sceneChunksTotalGzipKb === 'number' && sceneTotalGz > budgets.sceneChunksTotalGzipKb * 1024)
    fail(`budget：章節場景合計 ${kb(sceneTotalGz)} KB（gzip，${sceneChunks.length} 個）超過預算 ${budgets.sceneChunksTotalGzipKb} KB`);
}
if (typeof budgets.sceneKitGzipKb === 'number' && sceneEntries.length > 0) {
  if (kitChunks.length === 0)
    fail('budget：找不到 scene-kit 的 chunk（每個場景 chunk 都 import 的 shared~scene-…或 scene-kit-…），它可能被併進地圖或某一章的 chunk 了');
  else if (kitGz > budgets.sceneKitGzipKb * 1024)
    fail(`budget：scene-kit ${kb(kitGz)} KB（gzip，${kitChunks.join('、')}）超過預算 ${budgets.sceneKitGzipKb} KB`);
}
console.log('budget:', JSON.stringify(result));
