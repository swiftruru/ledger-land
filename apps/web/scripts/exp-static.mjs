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
const headersPath = new URL('_headers', dist);
writeFileSync(headersPath, readFileSync(headersPath, 'utf8') + `\n/exp-f.html\n  ! Content-Security-Policy\n  ! X-Content-Type-Options\n  ! Referrer-Policy\n  ! Permissions-Policy\n  ! Cache-Control\n  Cache-Control: no-cache\n\n/exp-l.html\n  ! Content-Security-Policy\n\n/exp-k.html\n  ! Content-Security-Policy\n\n/exp-j1.html\n  ! Content-Security-Policy\n\n/exp-h.html\n  ! Content-Security-Policy\n  ! X-Content-Type-Options\n  ! Referrer-Policy\n  ! Permissions-Policy\n  ! Cache-Control\n  Cache-Control: no-cache\n`);
writeFileSync(new URL('exp-b.html', dist), b);
writeFileSync(new URL('exp-c.html', dist), c);
console.log('exp-static: a/b/c written; splash links', (splash.match(/<link/g) ?? []).length);
