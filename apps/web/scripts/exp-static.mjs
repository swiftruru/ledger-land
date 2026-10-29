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
const headersPath = new URL('_headers', dist);
writeFileSync(headersPath, readFileSync(headersPath, 'utf8') + `\n/exp-f.html\n  ! Content-Security-Policy\n  ! X-Content-Type-Options\n  ! Referrer-Policy\n  ! Permissions-Policy\n  ! Cache-Control\n  Cache-Control: no-cache\n`);
writeFileSync(new URL('exp-b.html', dist), b);
writeFileSync(new URL('exp-c.html', dist), c);
console.log('exp-static: a/b/c written; splash links', (splash.match(/<link/g) ?? []).length);
