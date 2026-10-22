// 體積預算（06 第 8.2 節、09 第 10.2 節）：首次載入 JS（gzip）中文入口與 /en/ 入口分別計算；CSS；precache 總量（原始大小）。
// 預算在 apps/web/perf/urls.json 的 budgets。QR 解碼器（M2）與 Excel 相關函式庫不得出現在首次載入的 chunk。
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
const cssGz = readdirSync(assets)
  .filter((f) => f.endsWith('.css'))
  .reduce((s, f) => s + gz(join(assets, f)), 0);
// en 入口另外載入 en catalog（動態 import 的 chunk，檔名含 messages 與 en）
const enChunks = readdirSync(assets).filter((f) => /^messages.*\.js$/.test(f) || /en.*messages.*\.js$/.test(f));
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
for (const f of seen) if (/qr|jsqr|zxing|xlsx|sheetjs|read-excel/i.test(f)) fail(`budget：首次載入的 chunk 含 QR 解碼器或 Excel 函式庫：${f}`);
const kb = (n) => (n / 1024).toFixed(1);
const result = {
  initialJsGzipKb: +kb(initialJs),
  initialJsEnGzipKb: +kb(enInitial),
  initialCssGzipKb: +kb(cssGz),
  precacheKb: +kb(precache),
  precacheFiles: urls.length,
  chunks: [...seen],
};
if (initialJs > budgets.initialJsGzipKb * 1024) fail(`budget：中文入口首次載入 JS ${kb(initialJs)} KB 超過預算 ${budgets.initialJsGzipKb} KB`);
if (enInitial > budgets.initialJsGzipKb * 1024) fail(`budget：/en/ 入口首次載入 JS ${kb(enInitial)} KB 超過預算 ${budgets.initialJsGzipKb} KB`);
if (cssGz > budgets.initialCssGzipKb * 1024) fail(`budget：CSS ${kb(cssGz)} KB 超過預算 ${budgets.initialCssGzipKb} KB`);
if (precache > budgets.precacheKb * 1024) fail(`budget：precache ${kb(precache)} KB 超過預算 ${budgets.precacheKb} KB`);
console.log('budget:', JSON.stringify(result));
