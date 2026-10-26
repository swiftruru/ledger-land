// apps/web 的建置後檢查（09 第 7.4、11.1、6.8 節；06 第 9.4 節）。在 apps/web 目錄以 `node ../../tools/postbuild.mjs` 執行：
// 1. 計算 dist/index.html 兩段 inline 腳本與一段 inline style 的 sha256，填入 dist/_headers（含 D7 統計網域）；不得殘留角括號
// 2. index.html 不得有 style 屬性；必須含 #root、完整的 #ll-tabbar（五個連結）與緊接在後的殼層在地化腳本；沒有 404.html
// 3. sw.js 存在而且只有一份；manifest 可解析、id 固定為 site config 的值、圖示檔都存在；precache 不含統計腳本
// 4. 建置後的 CSS：每個 backdrop-filter 都有 -webkit-backdrop-filter，且不含 var()
// 5. 站內連結（index.html 與 JS 裡的 href="/..."）都帶結尾斜線（只檢查殼層）
// 6. wrangler.jsonc 的 not_found_handling 與 assets.directory
// 0. 最先做：把依路徑預先載入的表（tools/lib/preload-table.mjs）填進 boot 腳本，index.html 改了之後同步更新 sw.js 裡 index.html 的 precache revision，
//    再刪掉 .vite/manifest.json（只給這一步用，不部署）；之後第 1 步的雜湊就是填好表格的 boot 腳本（06 第 8.2 節、14 第 5.2 節）
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PRELOAD_PLACEHOLDER, buildPreloadTable, injectPreload } from './lib/preload-table.mjs';

const app = resolve(process.cwd());
const dist = join(app, 'dist');
const fail = (msg) => {
  console.error(`postbuild: ${msg}`);
  process.exitCode = 1;
};
const sha = (s) => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;
let html = readFileSync(join(dist, 'index.html'), 'utf8');

// 0. 依路徑預先載入的表
let preloadSummary = null;
const viteManifestPath = join(dist, '.vite', 'manifest.json');
if (html.includes(PRELOAD_PLACEHOLDER)) {
  if (!existsSync(viteManifestPath)) fail('找不到 .vite/manifest.json（vite.config.ts 的 build.manifest 要開著），無法填入依路徑預先載入的表');
  else {
    try {
      const contentManifest = JSON.parse(readFileSync(join(dist, 'content', 'content-manifest.json'), 'utf8'));
      const routeTable = JSON.parse(readFileSync(join(app, 'src', 'shell', 'route-preload.json'), 'utf8'));
      const table = buildPreloadTable({
        viteManifest: JSON.parse(readFileSync(viteManifestPath, 'utf8')),
        contentManifest,
        routes: routeTable.routes,
        catalogs: routeTable.catalogs,
        always: routeTable.always ?? [],
        chunkModules: existsSync(join(dist, '.vite', 'chunk-modules.json')) ? JSON.parse(readFileSync(join(dist, '.vite', 'chunk-modules.json'), 'utf8')) : {},
        locales: Object.keys(contentManifest.locales),
      });
      const before = html;
      html = injectPreload(html, table);
      writeFileSync(join(dist, 'index.html'), html);
      // sw.js 的 precache 是在 vite build 時依原本的 index.html 算 revision（md5），內容改了就要跟著改，否則 revision 不反映殼層內容
      const swPath = join(dist, 'sw.js');
      const md5 = (t) => createHash('md5').update(t, 'utf8').digest('hex');
      const swText = readFileSync(swPath, 'utf8');
      const oldRev = `{url:"index.html",revision:"${md5(before)}"}`;
      if (!swText.includes(oldRev)) fail('sw.js 找不到 index.html 的 precache revision（格式改了？），無法同步更新');
      else writeFileSync(swPath, swText.replace(oldRev, `{url:"index.html",revision:"${md5(html)}"}`));
      preloadSummary = { assets: table.a.length, routes: table.r.length, bytes: JSON.stringify(table).length };
    } catch (e) {
      fail(`依路徑預先載入的表：${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
rmSync(join(dist, '.vite'), { recursive: true, force: true });
if (html.includes(PRELOAD_PLACEHOLDER)) fail('index.html 仍有依路徑預先載入的佔位');
const site = JSON.parse(readFileSync(join(dist, 'site-config.json'), 'utf8'));

const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)].filter(
  (m) => !/type="module"/.test(m[1]) || m[2].trim() !== '',
);
const inlineStyles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)];
const boot = inlineScripts.find((m) => m[1].includes('data-ll="boot"'));
const l10n = inlineScripts.find((m) => m[1].includes('data-ll="shell-l10n"'));
if (!boot) fail('找不到 boot 腳本');
if (!l10n) fail('找不到殼層在地化腳本');
const others = inlineScripts.filter((m) => m !== boot && m !== l10n);
if (others.length) fail(`有未預期的 inline 腳本 ${others.length} 段`);
if (inlineStyles.length !== 1) fail(`inline style 應該只有 1 段，實際 ${inlineStyles.length} 段`);
if (/\sstyle=/.test(html)) fail('index.html 有 style 屬性（CSP 不允許）');
if (!/<div id="root">/.test(html)) fail('index.html 沒有 #root');
const navMatch = html.match(/<nav id="ll-tabbar"[\s\S]*?<\/nav>\s*<script data-ll="shell-l10n">/);
if (!navMatch) fail('index.html 沒有完整的 #ll-tabbar，或殼層在地化腳本沒有緊接在 nav 之後');
else {
  const links = (navMatch[0].match(/<a class="ll-tabbar__link"/g) ?? []).length;
  if (links !== 5) fail(`Tab bar 應該有 5 個連結，實際 ${links}`);
}
for (const m of html.matchAll(/href="(\/[^"#?]*)"/g)) {
  const h = m[1];
  if (/\.[a-z0-9]+$/i.test(h)) continue; // 檔案
  if (!h.endsWith('/')) fail(`站內連結沒有結尾斜線：${h}`);
}
if (existsSync(join(dist, '404.html'))) fail('建置產物不應有 404.html');

// _headers：填入雜湊與統計網域
const extraPath = join(app, 'csp-extra.json');
const extra = existsSync(extraPath) ? JSON.parse(readFileSync(extraPath, 'utf8')) : { 'style-src': [] };
let headers = readFileSync(join(dist, '_headers'), 'utf8');
headers = headers
  .replace("'<boot 腳本的雜湊>'", sha(boot?.[2] ?? ''))
  .replace("'<殼層在地化腳本的雜湊>'", sha(l10n?.[2] ?? ''))
  .replace("'<首次繪製 style 的雜湊>'", [sha(inlineStyles[0]?.[1] ?? ''), ...extra['style-src'].map((e) => `'${e.hash}'`)].join(' '))
  .replace('<統計腳本網域>', site.analytics.scriptOrigin)
  .replace('<統計回報網域>', site.analytics.reportOrigin);
if (/[<>]/.test(headers)) fail('_headers 仍有角括號佔位');
if (/__LL_[A-Z_]+__/.test(html)) fail('index.html 仍有未替換的 __LL_ 佔位（殼層腳本會在執行期拋錯）');
const cspLine = headers.split('\n').find((l) => l.includes('Content-Security-Policy'));
if (!cspLine || !cspLine.includes("frame-ancestors 'none'")) fail("_headers 的 CSP 沒有 frame-ancestors 'none'");
writeFileSync(join(dist, '_headers'), headers);

// sw.js、manifest、precache
if (!existsSync(join(dist, 'sw.js'))) fail('沒有 sw.js');
const swFiles = readdirSync(dist).filter((f) => /^sw.*\.js$/.test(f));
if (swFiles.length !== 1) fail(`sw.js 應該只有一份，實際：${swFiles.join(', ')}`);
const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
if (sw.includes(site.analytics.scriptOrigin.replace('https://', ''))) fail('precache 含統計腳本');
if (!sw.includes('index.html')) fail('precache 不含殼層 index.html');
const manifest = JSON.parse(readFileSync(join(dist, 'manifest.webmanifest'), 'utf8'));
if (manifest.id !== site.manifestId) fail(`manifest 的 id 是 ${manifest.id}，應為 ${site.manifestId}`);
if (manifest.start_url !== site.base || manifest.scope !== site.base) fail('manifest 的 start_url 或 scope 與 site config 不一致');
for (const icon of manifest.icons) if (!existsSync(join(dist, icon.src))) fail(`manifest 的圖示不存在：${icon.src}`);

// CSS 前綴
const cssFiles = readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.css'));
let backdropRules = 0;
for (const f of cssFiles) {
  const css = readFileSync(join(dist, 'assets', f), 'utf8');
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const body = rule[2];
    const plain = [...body.matchAll(/(?:^|;)\s*backdrop-filter:\s*([^;]+)/g)].map((m) => m[1].trim());
    const webkit = [...body.matchAll(/-webkit-backdrop-filter:\s*([^;]+)/g)].map((m) => m[1].trim());
    if (!plain.length && !webkit.length) continue;
    backdropRules++;
    const sel = rule[1].trim().slice(0, 80);
    const isRefract = plain.some((v) => v.includes('url('));
    if (!isRefract && plain.length && !webkit.length) fail(`${f}: ${sel} 缺少 -webkit-backdrop-filter`);
    for (const v of [...plain, ...webkit]) if (v.includes('var(')) fail(`${f}: ${sel} 的 backdrop-filter 含 var()`);
  }
}
if (backdropRules === 0) fail('建置後的 CSS 沒有任何 backdrop-filter（Tab bar 的玻璃不見了）');

// wrangler.jsonc
const wrangler = readFileSync(join(app, 'wrangler.jsonc'), 'utf8').replace(/\/\/[^\n]*/g, '');
if (!/"not_found_handling":\s*"single-page-application"/.test(wrangler)) fail('wrangler.jsonc 的 not_found_handling 不是 single-page-application');
if (!/"directory":\s*"\.\/dist"/.test(wrangler)) fail('wrangler.jsonc 的 assets.directory 不是 ./dist');

const report = {
  bootHash: sha(boot?.[2] ?? ''),
  shellL10nHash: sha(l10n?.[2] ?? ''),
  styleHash: sha(inlineStyles[0]?.[1] ?? ''),
  cssFiles,
  backdropRules,
  swFiles,
  manifestId: manifest.id,
  preload: preloadSummary,
};
writeFileSync(join(dist, 'build-report.json'), JSON.stringify(report, null, 2));
console.log('postbuild:', JSON.stringify(report));
