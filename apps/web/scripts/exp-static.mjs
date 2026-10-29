// 實驗（launch-flash-experiments 分支）：從建置好的 index.html 做三個靜態頁，在 iPhone 主畫面比對交接閃一下
// A：最小頁（沒有 JS、只有外部 CSS）；B：我們完整的 head（inline style、boot、入口樣式表）加一段文字；C：B 再加 #ll-launch 停留畫面
import { readFileSync, writeFileSync } from 'node:fs';
const dist = new URL('../dist/', import.meta.url);
const html = readFileSync(new URL('index.html', dist), 'utf8');
const head = /<head>([\s\S]*?)<\/head>/.exec(html)[1];
const splash = (head.match(/<link rel="apple-touch-startup-image"[^>]*>/g) ?? []).join('\n');
const launch = /<div id="ll-launch"[\s\S]*?<\/div><\/div>/.exec(html)[0];
const headNoApp = head.replace(/<script type="module"[^>]*><\/script>/g, '').replace(/<link rel="modulepreload"[^>]*>/g, '');
const css = `html{background:#FCF8F0;color:#292622;font:17px system-ui;margin:0;padding:24px}@media (prefers-color-scheme:dark){html{background:#121018;color:#F8F8F2}}`;
writeFileSync(new URL('exp.css', dist), css);
const a = `<!doctype html>
<html lang="zh-TW">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#FCF8F0" media="(prefers-color-scheme: light)">
    <meta name="theme-color" content="#121018" media="(prefers-color-scheme: dark)">
    <meta name="color-scheme" content="light dark">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="Exp A">
    <title>Exp A</title>
    ${splash}
    <link rel="stylesheet" href="/exp.css">
  </head>
  <body><p>靜態頁 A：沒有 JS、沒有 Service Worker，只有外部 CSS 與啟動圖。</p></body>
</html>`;
const b = `<!doctype html>\n<html lang="zh-TW">\n  <head>${headNoApp}</head>\n  <body><p>靜態頁 B：我們完整的 head（inline style、boot、入口樣式表、啟動圖），沒有 React、沒有 Service Worker。</p></body>\n</html>`;
const c = `<!doctype html>\n<html lang="zh-TW">\n  <head>${headNoApp}</head>\n  <body>${launch}<p>靜態頁 C：B 加上停留畫面（不會消失）。</p></body>\n</html>`;
writeFileSync(new URL('exp-a.html', dist), a);
// 第七輪：D 換成 NekoServe 的啟動圖（跨網域連結）、E 沒有啟動圖、F 和 A 一樣但 _headers 拿掉 CSP 等標頭並改成 no-cache
const neko = JSON.parse(readFileSync(new URL('../scripts/exp-neko-splash.json', import.meta.url), 'utf8')).join('\n');
writeFileSync(new URL('exp-d.html', dist), a.replace(splash, neko).replace('Exp A', 'Exp D').replace('靜態頁 A：沒有 JS、沒有 Service Worker，只有外部 CSS 與啟動圖。', '靜態頁 D：A 換成 NekoServe 的啟動圖。'));
writeFileSync(new URL('exp-e.html', dist), a.replace(splash, '').replace('Exp A', 'Exp E').replace('靜態頁 A：沒有 JS、沒有 Service Worker，只有外部 CSS 與啟動圖。', '靜態頁 E：A 拿掉全部啟動圖。'));
writeFileSync(new URL('exp-f.html', dist), a.replace('Exp A', 'Exp F').replace('靜態頁 A：沒有 JS、沒有 Service Worker，只有外部 CSS 與啟動圖。', '靜態頁 F：A 拿掉 CSP 等標頭、Cache-Control 改 no-cache。'));
// 第八輪：G 是 A 加上寫在 HTML 裡的 manifest 連結（和 NekoServe 一樣在初始 HTML 就有，不是之後用 JS 插的），manifest 有 display_override 與 background_color
const manifest = JSON.parse(readFileSync(new URL('manifest.webmanifest', dist), 'utf8'));
const g = { ...manifest, name: 'Exp G', short_name: 'Exp G', start_url: '/exp-g.html', scope: '/', display: 'standalone', display_override: ['standalone', 'minimal-ui'], orientation: 'any', lang: 'zh-TW' };
writeFileSync(new URL('manifest-exp-g.webmanifest', dist), JSON.stringify(g));
writeFileSync(new URL('exp-g.html', dist), a.replace('<title>Exp A</title>', '<title>Exp G</title>\n    <link rel="manifest" href="/manifest-exp-g.webmanifest">').replace('Exp A', 'Exp G').replace('靜態頁 A：沒有 JS、沒有 Service Worker，只有外部 CSS 與啟動圖。', '靜態頁 G：A 加上寫在 HTML 裡的 manifest 連結。'));
// 第九輪：H 是 NekoServe 正式站的 HTML 原封不動搬到我們的網域（資源連回它的網域；拿掉它的 React 進入點，第一格就是它的樣式表畫出來的空頁；manifest 換成我們這邊的檔）
let nekoHtml = readFileSync(new URL('../scripts/exp-neko.html', import.meta.url), 'utf8');
nekoHtml = nekoHtml.replace(/<script type="module"[^>]*><\/script>/g, '').replace(/<link rel="modulepreload"[^>]*>/g, '');
nekoHtml = nekoHtml.replace(/(href|src)="\/(?!manifest\.webmanifest)/g, '$1="https://nekoserve.swift.moe/');
nekoHtml = nekoHtml.replace('href="/manifest.webmanifest"', 'href="/manifest-exp-h.webmanifest"');
nekoHtml = nekoHtml.replace('<script src="https://nekoserve.swift.moe/theme-init.js"></script>', '<script>try{localStorage.setItem("nekoserve:theme","dark")}catch(e){}</script><script src="https://nekoserve.swift.moe/theme-init.js"></script>');
nekoHtml = nekoHtml.replace('<div id="root"></div>', '<div id="root"><p>靜態頁 H：NekoServe 的 HTML 搬到我們的網域。</p></div>');
writeFileSync(new URL('exp-h.html', dist), nekoHtml);
writeFileSync(new URL('manifest-exp-h.webmanifest', dist), JSON.stringify({ ...g, name: 'Exp H', short_name: 'Exp H', start_url: '/exp-h.html' }));
// 第九輪：I 是 G 但 manifest 的 background_color 與 theme_color 都是夜空色（測那一格白色是不是 manifest 的 background_color）
writeFileSync(new URL('manifest-exp-i.webmanifest', dist), JSON.stringify({ ...g, name: 'Exp I', short_name: 'Exp I', start_url: '/exp-i.html', background_color: '#121018', theme_color: '#121018' }));
writeFileSync(new URL('exp-i.html', dist), readFileSync(new URL('exp-g.html', dist), 'utf8').replace('manifest-exp-g.webmanifest', 'manifest-exp-i.webmanifest').replace('Exp G', 'Exp I').replace('靜態頁 G：A 加上寫在 HTML 裡的 manifest 連結。', '靜態頁 I：G 的 manifest 改成夜空色的 background_color。'));
// 第十輪：J1 body 一開始是空的、1 秒後才用 JS 放文字（像 NekoServe 的 React 晚一點才畫內容）；J2 body 永遠是空的
const emptyBody = (title, body) => a.replace('<title>Exp A</title>', `<title>${title}</title>`).replace('Exp A', title).replace(/<body>[\s\S]*<\/body>/, body);
writeFileSync(new URL('exp-j1.html', dist), emptyBody('Exp J1', '<body><div id="root"></div><script>setTimeout(function(){document.getElementById("root").innerHTML="<p>靜態頁 J1：內容在 1 秒後才出現。</p>"},1000)</script></body>'));
writeFileSync(new URL('exp-j2.html', dist), emptyBody('Exp J2', '<body><div id="root"></div></body>'));
// 第十一輪：K 是 A 加一個最簡單的 Service Worker（第一次開啟時把 exp-k.html 放進快取，之後的導覽都從快取回應）
writeFileSync(new URL('sw-k.js', dist), `self.addEventListener('install', function (e) { e.waitUntil(caches.open('k').then(function (c) { return c.add('/exp-k.html'); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) { if (e.request.mode === 'navigate') e.respondWith(caches.match('/exp-k.html').then(function (r) { return r || fetch(e.request); })); });`);
writeFileSync(new URL('exp-k.html', dist), a.replace('<title>Exp A</title>', '<title>Exp K</title>').replace('Exp A', 'Exp K').replace('靜態頁 A：沒有 JS、沒有 Service Worker，只有外部 CSS 與啟動圖。', '靜態頁 K：A 加上最簡單的 Service Worker，第二次之後的冷啟動由快取回應。').replace('</body>', '<script>if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw-k.js", { scope: "/exp-k" }).then(function (r) { document.body.insertAdjacentHTML("beforeend", "<p>SW: " + (navigator.serviceWorker.controller ? "這一次由快取回應" : "剛註冊，下一次冷啟動才由快取回應") + "</p>"); });</script></body>'));
// 第十二輪：L 是 A 加三張每次都從網路抓的圖（網址帶時間戳，避開快取），把 load 事件往後拖幾百毫秒；畫面上看不到那些圖
writeFileSync(new URL('exp-l.html', dist), a.replace('<title>Exp A</title>', '<title>Exp L</title>').replace('Exp A', 'Exp L').replace('靜態頁 A：沒有 JS、沒有 Service Worker，只有外部 CSS 與啟動圖。', '靜態頁 L：A 加三張每次從網路抓的隱藏圖，讓 load 事件晚幾百毫秒。').replace('</body>', '<script>var t = Date.now(); for (var i = 0; i < 3; i++) document.write(\'<img src="/splash/apple-splash-dark-1206x2622.png?t=\' + t + i + \'" width="1" height="1" alt="">\'); window.addEventListener("load", function () { document.body.insertAdjacentHTML("beforeend", "<p>load 在 " + Math.round(performance.now()) + " ms</p>"); });</script></body>'));
// 第十三輪：H2 是 NekoServe 的 HTML 連同它的 React 進入點一起搬過來（模組腳本連回它的網域），只擋掉 SW 註冊（不然會註冊到我們的 sw.js）
let neko2 = readFileSync(new URL('../scripts/exp-neko.html', import.meta.url), 'utf8');
neko2 = neko2.replace(/(href|src)="\/(?!manifest\.webmanifest)/g, '$1="https://nekoserve.swift.moe/');
neko2 = neko2.replace('href="/manifest.webmanifest"', 'href="/manifest-exp-h2.webmanifest"');
neko2 = neko2.replace('<script src="https://nekoserve.swift.moe/theme-init.js"></script>', '<script>try{localStorage.setItem("nekoserve:theme","dark")}catch(e){};if(navigator.serviceWorker)navigator.serviceWorker.register=function(){return Promise.reject(new Error("exp: no sw"))};history.pushState=function(){};history.replaceState=function(){};</script><script src="https://nekoserve.swift.moe/theme-init.js"></script>');
writeFileSync(new URL('exp-h2.html', dist), neko2);
writeFileSync(new URL('manifest-exp-h2.webmanifest', dist), JSON.stringify({ ...g, name: 'Exp H2', short_name: 'Exp H2', start_url: '/exp-h2.html' }));
// 第十四輪：H4 是 H2 改用 NekoServe 真正的 manifest（圖示與捷徑連回它的網域，start_url 指向這一頁）
const nekoManifest = JSON.parse(readFileSync(new URL('../scripts/exp-neko-manifest.json', import.meta.url), 'utf8'));
const abs = (u) => (typeof u === 'string' && u.startsWith('/') ? 'https://nekoserve.swift.moe' + u : typeof u === 'string' && !/^https?:/.test(u) ? 'https://nekoserve.swift.moe/' + u : u);
const h4m = { ...nekoManifest, start_url: '/exp-h4.html', scope: '/', icons: (nekoManifest.icons ?? []).map((i) => ({ ...i, src: abs(i.src) })), shortcuts: (nekoManifest.shortcuts ?? []).map((sc) => ({ ...sc, url: '/exp-h4.html', icons: (sc.icons ?? []).map((i) => ({ ...i, src: abs(i.src) })) })) };
writeFileSync(new URL('manifest-exp-h4.webmanifest', dist), JSON.stringify(h4m));
writeFileSync(new URL('exp-h4.html', dist), neko2.replace('manifest-exp-h2.webmanifest', 'manifest-exp-h4.webmanifest'));
// 第十五輪：H5 是 NekoServe 的 HTML 原封不動加它真正的 Service Worker，資源全部同網域：建置時把它 precache 清單裡的檔案從 pages.dev 抓到我們的 dist
// 同一路徑（hash 檔名不會撞到我們的），只有 index.html、sw.js、manifest 另外命名（跨網域 precache 會因 cache: reload 觸發 CORS preflight 而失敗）
let sw5 = readFileSync(new URL('../scripts/exp-neko-sw.js', import.meta.url), 'utf8');
const entries = [...sw5.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]);
const skip = new Set(['index.html', 'sw.js', 'manifest.webmanifest', 'favicon.ico']);
const { mkdirSync, existsSync: exists } = await import('node:fs');
let fetched = 0;
for (const u of entries) {
  if (skip.has(u)) continue;
  const target = new URL(u, dist);
  if (exists(target)) { fetched++; continue; }
  const res = await fetch('https://nekoserve.pages.dev/' + u);
  if (!res.ok) throw new Error(`exp-static: 抓不到 ${u} (${res.status})`);
  mkdirSync(new URL('./', target), { recursive: true });
  writeFileSync(target, Buffer.from(await res.arrayBuffer()));
  fetched++;
}
console.log(`exp-static: NekoServe 的資源 ${fetched} 個放進 dist`);
sw5 = sw5.replace('url:"index.html"', 'url:"exp-h5.html"').replace('E="/index.html"', 'E="/exp-h5.html"').replace('/\\.[a-z0-9]+$/i', '/^$/');
if (!sw5.includes('E="/exp-h5.html"') || !sw5.includes('url:"exp-h5.html"')) throw new Error('exp-static: sw-h5 的改寫沒有命中');
writeFileSync(new URL('sw-h5.js', dist), sw5);
let h5 = readFileSync(new URL('../scripts/exp-neko.html', import.meta.url), 'utf8');
h5 = h5.replace('href="/manifest.webmanifest"', 'href="/manifest-exp-h5.webmanifest"');
h5 = h5.replace('<script src="/theme-init.js"></script>', '<script>try{localStorage.setItem("nekoserve:theme","dark")}catch(e){};if(navigator.serviceWorker){var o=navigator.serviceWorker.register.bind(navigator.serviceWorker);navigator.serviceWorker.register=function(){return o("/sw-h5.js",{scope:"/exp-h5"})}};history.pushState=function(){};history.replaceState=function(){};</script><script src="/theme-init.js"></script>');
if (!h5.includes('/sw-h5.js') || !h5.includes('manifest-exp-h5')) throw new Error('exp-static: h5 的改寫沒有命中');
writeFileSync(new URL('exp-h5.html', dist), h5);
writeFileSync(new URL('manifest-exp-h5.webmanifest', dist), JSON.stringify({ ...nekoManifest, start_url: '/exp-h5.html', scope: '/', shortcuts: [] }));
// 第十六輪：NekoServe 一啟動就把網址從 / 換成 /settings（React Router 的 replace），而所有會閃的版本都沒有在第一格之後改網址。
// M1 在 load 後 200 ms 用 replaceState 改網址；M2 在 DOMContentLoaded 時馬上改
const mk = (name, when) => a.replace('<title>Exp A</title>', `<title>${name}</title>`).replace('Exp A', name).replace('靜態頁 A：沒有 JS、沒有 Service Worker，只有外部 CSS 與啟動圖。', `靜態頁 ${name}：A 加上${when === 'load' ? 'load 後 200 ms' : 'DOMContentLoaded 時'}用 replaceState 改網址。`).replace('</body>', `<script>function go(){history.replaceState(null,"",location.pathname+"?s="+Date.now());document.body.insertAdjacentHTML("beforeend","<p>已改網址 "+Math.round(performance.now())+" ms</p>");}${when === 'load' ? 'window.addEventListener("load",function(){setTimeout(go,200)});' : 'document.addEventListener("DOMContentLoaded",go);'}</script></body>`);
writeFileSync(new URL('exp-m1.html', dist), mk('Exp M1', 'load'));
writeFileSync(new URL('exp-m2.html', dist), mk('Exp M2', 'dcl'));
// 第十七輪：H6 把 NekoServe 整個 App 放到這個預覽網域的根路徑（index.html、sw.js、manifest 都換成它的原版，主題不強制），只剩網域不同
// ROOT 決定根路徑放什麼：'neko' 是 H6/H7（NekoServe 整個 App）；'ours-manifest' 是 R1（我們的 App，但 manifest 連結寫在 HTML 裡、不延後插入）
const ROOT = 'ours-r2';
let nekoRoot = readFileSync(new URL('../scripts/exp-neko.html', import.meta.url), 'utf8').replace(/<script>\(function\(\)\{[^<]*cdn-cgi[^<]*<\/script>/, '');
if (ROOT === 'neko') {
  writeFileSync(new URL('index.html', dist), nekoRoot);
  writeFileSync(new URL('sw.js', dist), readFileSync(new URL('../scripts/exp-neko-sw.js', import.meta.url), 'utf8'));
  writeFileSync(new URL('manifest.webmanifest', dist), JSON.stringify(nekoManifest));
} else if (ROOT === 'ours-r2') {
  // R2：R1 再一次改三件事：拿掉 App 內停留畫面、入口樣式表改回擋繪製（連結保留 data-ll，boot 載完照樣標 data-css）、啟動圖連結的 media 改成 NekoServe 的寫法
  let r2 = html.replace('</head>', '    <link rel="manifest" href="/manifest.webmanifest">\n  </head>');
  r2 = r2.replace(/<div id="ll-launch"[\s\S]*?<\/div><\/div>/, '');
  r2 = r2.replace(/<link rel="preload" as="style" crossorigin href="([^"]+)">\s*<link rel="stylesheet" media="print" data-ll="entry-css" crossorigin href="\1">/, '<link rel="stylesheet" data-ll="entry-css" crossorigin href="$1">');
  r2 = r2.replace(/<link rel="apple-touch-startup-image" media="screen and \(device-width: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d+)\) and \(orientation: portrait\) and \(prefers-color-scheme: (light|dark)\)" href="(\/splash\/apple-splash-\3-(\d+)x(\d+)\.png)">/g, (m, w, dpr, scheme, href, pw, ph) => `<link rel="apple-touch-startup-image" media="screen and ${scheme === 'dark' ? '(prefers-color-scheme: dark) and ' : ''}(device-width: ${w}px) and (device-height: ${Number(ph) / Number(dpr)}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)" href="${href}">`);
  if (r2.includes('id="ll-launch"') || !/<link rel="stylesheet" data-ll="entry-css" crossorigin/.test(r2) || /<link rel="stylesheet" media="print"/.test(r2) || !/apple-touch-startup-image" media="screen and \(prefers-color-scheme: dark\) and \(device-width/.test(r2) || !r2.includes('rel="manifest"')) throw new Error('exp-static: R2 的改寫沒有全部命中');
  // R4：manifest 的欄位也改成 NekoServe 的樣子（加 display_override 與 orientation any，拿掉 dir 與 prefer_related_applications）
  const ours = JSON.parse(readFileSync(new URL('manifest.webmanifest', dist), 'utf8'));
  delete ours.dir; delete ours.prefer_related_applications;
  writeFileSync(new URL('manifest.webmanifest', dist), JSON.stringify({ ...ours, display_override: ['standalone', 'minimal-ui'], orientation: 'any', categories: ['education', 'productivity'] }));
  // R6：啟動圖換成 NekoServe 的 80 張（連結與圖都是它的，圖已鏡像到 dist）；R7：再拿掉 inline 樣式與 boot 腳本（VARIANT 決定）
  const VARIANT = process.env.LL_EXP_VARIANT ?? 'r7';
  if (VARIANT === 'r6' || VARIANT === 'r7') {
    const nekoSplash = (nekoRoot.match(/<link rel="apple-touch-startup-image"[^>]*>/g) ?? []).join('\n    ');
    r2 = r2.replace(/<link rel="apple-touch-startup-image"[^>]*>\s*/g, '').replace('</head>', '    ' + nekoSplash + '\n  </head>');
    if ((r2.match(/<link rel="apple-touch-startup-image"/g) ?? []).length !== 80) throw new Error('exp-static: R6 的啟動圖連結不是 80 個');
  }
  if (VARIANT === 'r7') {
    r2 = r2.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<script data-ll="boot">[\s\S]*?<\/script>/, '');
    if (r2.includes('<style>') || r2.includes('data-ll="boot"')) throw new Error('exp-static: R7 沒拿乾淨');
  }
  writeFileSync(new URL('index.html', dist), r2);
  console.log('exp-static: VARIANT ' + VARIANT);
  console.log('exp-static: 根路徑是我們的 App，R2（沒有停留畫面、擋繪製的樣式表、NekoServe 式啟動圖連結、HTML 裡的 manifest）');
} else if (ROOT === 'ours-manifest') {
  const withManifest = html.replace('</head>', '    <link rel="manifest" href="/manifest.webmanifest">\n  </head>');
  if (!withManifest.includes('rel="manifest"')) throw new Error('exp-static: R1 的 manifest 連結沒插進去');
  writeFileSync(new URL('index.html', dist), withManifest);
  console.log('exp-static: 根路徑是我們的 App 加 HTML 裡的 manifest 連結（R1）');
}
// 第十八輪：H7 補上 NekoServe 的 80 張啟動圖（它的 SW 不 precache 這些，所以之前沒抓；H6 在 iPhone 上因此沒有啟動圖，而且不閃）
const splashHrefs = [...nekoRoot.matchAll(/<link rel="apple-touch-startup-image"[^>]*href="\/([^"]+)"/g)].map((m) => m[1]);
let splashFetched = 0;
for (const u of splashHrefs) {
  const target = new URL(u, dist);
  if (!exists(target)) {
    const res = await fetch('https://nekoserve.pages.dev/' + u);
    if (!res.ok) throw new Error(`exp-static: 抓不到啟動圖 ${u} (${res.status})`);
    writeFileSync(target, Buffer.from(await res.arrayBuffer()));
  }
  splashFetched++;
}
console.log(`exp-static: 根路徑換成 NekoServe（H7，啟動圖 ${splashFetched} 張）`);
const headersPath = new URL('_headers', dist);
writeFileSync(headersPath, readFileSync(headersPath, 'utf8') + `\n/exp-f.html\n  ! Content-Security-Policy\n  ! X-Content-Type-Options\n  ! Referrer-Policy\n  ! Permissions-Policy\n  ! Cache-Control\n  Cache-Control: no-cache\n\n/\n  ! Content-Security-Policy\n\n/index.html\n  ! Content-Security-Policy\n\n/settings\n  ! Content-Security-Policy\n\n/exp-m1.html\n  ! Content-Security-Policy\n\n/exp-m2.html\n  ! Content-Security-Policy\n\n/exp-l.html\n  ! Content-Security-Policy\n\n/exp-k.html\n  ! Content-Security-Policy\n\n/exp-j1.html\n  ! Content-Security-Policy\n\n/exp-h5.html\n  ! Content-Security-Policy\n  ! X-Content-Type-Options\n  ! Referrer-Policy\n  ! Permissions-Policy\n\n/exp-h4.html\n  ! Content-Security-Policy\n  ! X-Content-Type-Options\n  ! Referrer-Policy\n  ! Permissions-Policy\n\n/exp-h2.html\n  ! Content-Security-Policy\n  ! X-Content-Type-Options\n  ! Referrer-Policy\n  ! Permissions-Policy\n\n/exp-h.html\n  ! Content-Security-Policy\n  ! X-Content-Type-Options\n  ! Referrer-Policy\n  ! Permissions-Policy\n  ! Cache-Control\n  Cache-Control: no-cache\n`);
writeFileSync(new URL('exp-b.html', dist), b);
writeFileSync(new URL('exp-c.html', dist), c);
console.log('exp-static: a/b/c written; splash links', (splash.match(/<link/g) ?? []).length);
