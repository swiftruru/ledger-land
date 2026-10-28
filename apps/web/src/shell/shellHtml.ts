// 建置期產生殼層片段（09 第 3.2 節）：theme-color meta、iOS 啟動圖連結、Tab bar 的完整 nav 與緊接在 nav 之後的殼層在地化腳本。
// 只在 vite.config.ts 中執行（Node），不進用戶端 bundle。
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { THEME_COLOR } from '@ledgerland/tokens';
import { NAV_LABEL, SKIP_LABEL, TABS } from './tabs.ts';

const require = createRequire(import.meta.url);

function phosphor(name: string, weight: 'regular' | 'fill'): string {
  const file = weight === 'regular' ? `${name}.svg` : `${name}-fill.svg`;
  const svg = readFileSync(require.resolve(`@phosphor-icons/core/assets/${weight}/${file}`), 'utf8');
  const inner = svg
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .trim();
  // 不帶 style 屬性（CSP 的 style-src-attr 沿用 style-src），顏色用 currentColor
  return `<svg class="ll-icon ll-icon--${weight}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false">${inner}</svg>`;
}

/** 淺深兩個帶 media 的 theme-color meta（06 第 2.4 節）；手動指定主題時 boot 腳本會改寫 content */
export function buildThemeColorMetas(): string {
  return [
    `<meta name="theme-color" content="${THEME_COLOR.light}" media="(prefers-color-scheme: light)">`,
    `<meta name="theme-color" content="${THEME_COLOR.violet}" media="(prefers-color-scheme: dark)">`,
  ].join('\n    ');
}

export function buildNav(): string {
  const items = TABS.map(
    (t) =>
      `<li><a class="ll-tabbar__link" href="/${t.path}" data-tab="${t.id}">${phosphor(t.icon, 'regular')}${phosphor(t.icon, 'fill')}<span class="ll-tabbar__label">${t.label['zh-TW']}</span></a></li>`,
  ).join('');
  // 選取鏡片（Liquid Glass，07 第 6.2 節）：鏡片裡放一份 Tab 的分身，按住或拖曳時隨鏡片放大成放大鏡。
  // 分身是 span、在 aria-hidden 的膠囊裡並加 inert，不進焦點順序與無障礙樹
  const ghosts = TABS.map(
    (t) =>
      `<span class="ll-lens__item" data-ghost="${t.id}">${phosphor(t.icon, 'regular')}${phosphor(t.icon, 'fill')}<span class="ll-tabbar__label">${t.label['zh-TW']}</span></span>`,
  ).join('');
  const pill = `<span class="ll-tabbar__pill" aria-hidden="true"><span class="ll-lens"><span class="ll-lens__mag"><span class="ll-lens__row" inert>${ghosts}</span></span></span></span>`;
  return `<nav id="ll-tabbar" class="ll-tabbar" aria-label="${NAV_LABEL['zh-TW']}">${pill}<ul class="ll-tabbar__list">${items}</ul></nav>`;
}

/** 殼層在地化腳本：英文網址時改寫標籤、href、aria-label 與跳到主要內容的文字；兩種語系都標出 aria-current 與 data-current */
export function buildShellL10nScript(): string {
  const data = JSON.stringify({
    tabs: TABS.map((t) => ({ p: t.path, a: t.also, en: t.label.en })),
    nav: NAV_LABEL.en,
    skip: SKIP_LABEL.en,
  });
  const body = `(function(){var D=${data};var p=location.pathname;var en=/^\\/en(\\/|$)/i.test(p);var r=(en?p.replace(/^\\/en/i,''):p).replace(/^\\//,'').toLowerCase();var nav=document.getElementById('ll-tabbar');if(!nav)return;var links=nav.querySelectorAll('a[data-tab]');var g=nav.querySelectorAll('.ll-lens__item .ll-tabbar__label');var cur=-1;D.tabs.forEach(function(t,i){var hit=t.p===''?r==='':(r.indexOf(t.p)===0||t.a.some(function(a){return r.indexOf(a)===0;}));if(hit&&cur<0)cur=i;});for(var i=0;i<links.length;i++){var a=links[i];if(en){a.setAttribute('href','/en/'+D.tabs[i].p);a.querySelector('.ll-tabbar__label').textContent=D.tabs[i].en;if(g[i])g[i].textContent=D.tabs[i].en;}if(i===cur)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}if(cur>=0)nav.setAttribute('data-current',String(cur));else nav.removeAttribute('data-current');if(en){nav.setAttribute('aria-label',D.nav);var s=document.querySelector('.ll-skiplink');if(s)s.textContent=D.skip;}})();`;
  return `<script data-ll="shell-l10n">${body}</script>`;
}

const LAUNCH_FILES = [
  { file: 'launch-illustration.svg', cls: 'll-launch__girl', currentColor: false },
  { file: 'launch-mark.svg', cls: 'll-launch__mark', currentColor: true },
  { file: 'launch-wordmark.svg', cls: 'll-launch__word', currentColor: true },
] as const;

function defaultReadBrand(file: string): string {
  return readFileSync(new URL(`../../brand/${file}`, import.meta.url), 'utf8');
}

/**
 * 啟動畫面（06 第 2.4 節）：App 模式冷啟動時蓋住整頁的一塊，放在 body 的第一個子節點；樣式在 tokens 的 launchScreenStyle()。
 * 三個 SVG 來自 brand/（描圖與字形外框的產物），內嵌時只留 viewBox 與 path：去掉 xml 宣告、註解、title、desc、metadata 與根元素的 width、height；
 * 含 style 屬性、<style>、<script>、<image>、<foreignObject> 或外部 href 就讓建置失敗（CSP 與 postbuild 的規則）。
 * 小 logo 與字樣用 currentColor，顏色跟著覆蓋層的 color；插圖自帶顏色。
 */
export function buildLaunchScreen(read: (file: string) => string = defaultReadBrand): string {
  const parts = LAUNCH_FILES.map(({ file, cls, currentColor }) => {
    let svg = read(file)
      .replace(/<\?xml[\s\S]*?\?>/g, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(title|desc|metadata)\b[\s\S]*?<\/\1>/g, '')
      .trim();
    for (const bad of [/\sstyle=/, /<style\b/, /<script\b/, /<image\b/, /<foreignObject\b/, /href="https?:/, /xlink:href="https?:/]) {
      if (bad.test(svg)) throw new Error(`buildLaunchScreen：${file} 含 ${bad.source}，殼層不接受（改用 fill、stroke 屬性，不內嵌外部資源）`);
    }
    const open = /^<svg\b([^>]*)>/.exec(svg);
    if (!open) throw new Error(`buildLaunchScreen：${file} 不是以 <svg 開頭`);
    const viewBox = /\bviewBox="([^"]+)"/.exec(open[1] ?? '')?.[1];
    if (!viewBox) throw new Error(`buildLaunchScreen：${file} 的 <svg> 沒有 viewBox`);
    const inner = svg.slice(open[0].length).replace(/<\/svg>\s*$/, '');
    const fill = currentColor ? ' fill="currentColor"' : '';
    svg = `<svg class="${cls}" viewBox="${viewBox}"${fill} aria-hidden="true" focusable="false">${inner}</svg>`;
    return svg;
  });
  const [girl, mark, word] = parts as [string, string, string];
  return `<div id="ll-launch" aria-hidden="true"><div class="ll-launch__art">${girl}</div><div class="ll-launch__brand">${mark}${word}</div></div>`;
}

export function buildBootScript(bootSource: string): string {
  return `<script data-ll="boot">${bootSource.trim()}</script>`;
}

/**
 * iOS 啟動圖（06 第 2.4 節，M0a V05 定案）：頁面必須有 apple-mobile-web-app-capable 才會下載啟動圖；
 * media 不測 device-height（WebKit bug 326500）；只做直向 iPhone。
 */
export function buildSplashLinks(): string {
  const cfg = JSON.parse(readFileSync(new URL('./splash-devices.json', import.meta.url), 'utf8')) as { devices: { w: number; h: number; dpr: number }[] };
  const keys = cfg.devices.map((d) => `${d.w}@${d.dpr}`);
  if (new Set(keys).size !== keys.length) throw new Error('splash-devices.json：寬度與像素比的組合重複，啟動圖的 media 會無法區分');
  const links = cfg.devices.flatMap((d) =>
    (['light', 'dark'] as const).map(
      (scheme) =>
        `<link rel="apple-touch-startup-image" media="screen and (device-width: ${d.w}px) and (-webkit-device-pixel-ratio: ${d.dpr}) and (orientation: portrait) and (prefers-color-scheme: ${scheme})" href="/splash/apple-splash-${scheme}-${d.w * d.dpr}x${d.h * d.dpr}.png">`,
    ),
  );
  return ['<meta name="apple-mobile-web-app-capable" content="yes">', '<meta name="mobile-web-app-capable" content="yes">', ...links].join('\n    ');
}
