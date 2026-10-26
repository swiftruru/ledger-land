// 站規 4.2 的頁面內檢查（link-style.spec 與 reduced-motion.spec 共用）：audit 在頁面裡一次算完第 1 到 6 項、回傳違規清單；
// 另有第 7 項的取樣與放開滑鼠、按鈕狀態板的開啟。違規訊息帶選擇器路徑與文字前 20 字。
import type { Page } from '@playwright/test';
import { waitForApp } from './helpers.ts';
import { settle, themeQuery, type Theme } from './page-states.ts';

/** 核准的連結 class（站規 4.2 第 4 項） */
export const ANCHOR_CLASSES = [
  'll-btn',
  'll-iconbtn',
  'll-navrow',
  'll-termitem',
  'll-termpill',
  'll-link',
  'll-statchip',
  'll-menuitem',
  'll-chbanner__link',
  'll-tabbar__link',
  'll-skiplink',
];
/** 文字色的白名單（站規 4.2 第 2 項），另加所有 --ll-*-ink */
export const COLOR_TOKENS = [
  '--ll-text',
  '--ll-text-2',
  '--ll-text-3',
  '--ll-link',
  '--ll-link-hover',
  '--ll-accent-ink',
  '--ll-accent-contrast',
  '--ll-btn-primary-fg',
  '--ll-btn-secondary-fg',
  '--ll-btn-danger-fg',
  '--ll-btn-disabled-fg',
  // 卡片旁的動作鈕靜止時跟卡片的圖示同色（M3 收尾第 9 輪基礎組決定：收藏卡的垃圾桶在深色三風味不比愛心鮮豔，14-core-nav.css 的 .ll-navcard__aside）
  '--ll-btn-secondary-icon',
];
/** 第 7 項的元件類別 */
export const STATE_CLASSES = [
  '.ll-btn',
  '.ll-iconbtn',
  '.ll-navrow',
  '.ll-termitem',
  '.ll-termpill',
  '.ll-link',
  '.ll-statchip',
  '.ll-menuitem',
  '.ll-disclosure__summary',
  '.ll-chbanner__link',
];

let forbiddenCache: string[] | null = null;
/** 這個瀏覽器實際的預設連結色（about:blank 裡兩個沒有樣式的 <a href>，淺色與深色各一），加上常見的預設值 */
export async function defaultLinkColours(page: Page): Promise<string[]> {
  if (forbiddenCache) return forbiddenCache;
  const fixed = ['rgb(0, 0, 238)', 'rgb(158, 158, 255)', 'rgb(0, 0, 255)', 'rgb(85, 26, 139)', 'rgb(208, 173, 240)'];
  await page.goto('about:blank');
  const measured = await page.evaluate(() =>
    ['light', 'dark'].map((scheme) => {
      const wrap = document.createElement('div');
      wrap.style.colorScheme = scheme;
      const a = document.createElement('a');
      a.href = 'https://example.invalid/';
      a.textContent = 'x';
      wrap.append(a);
      document.body.append(wrap);
      const c = getComputedStyle(a).color;
      wrap.remove();
      return c;
    }),
  );
  forbiddenCache = [...new Set([...fixed, ...measured])];
  return forbiddenCache;
}

export interface AuditOptions {
  forbidden: string[];
  anchorClasses: string[];
  colorTokens: string[];
  /** 只重跑第 1 到 3 項（滑過與按下時） */
  colourOnly?: boolean;
}

export const auditOpts = (forbidden: string[], colourOnly = false): AuditOptions => ({
  forbidden,
  anchorClasses: ANCHOR_CLASSES,
  colorTokens: COLOR_TOKENS,
  colourOnly,
});

/** 在頁面內一次算完第 1 到 6 項，回傳違規清單（page.evaluate(audit, opts)；函式本身在瀏覽器裡執行，不能用外面的變數） */
export function audit(opts: AuditOptions): string[] {
  const out: string[] = [];
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  /** 任何 CSS 顏色字串換成 sRGB 的 r,g,b,a（畫一個像素再讀回來，oklab 與 color-mix 也一樣） */
  const rgba = (c: string): string => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return `${r},${g},${b},${a}`;
  };
  const near = (a: string, b: string) => {
    const x = a.split(',').map(Number);
    const y = b.split(',').map(Number);
    return x.every((v, i) => Math.abs(v - y[i]!) <= 2);
  };
  const forbidden = opts.forbidden.map(rgba);
  const probe = document.createElement('span');
  document.body.append(probe);
  const rootStyle = getComputedStyle(document.documentElement);
  const inkNames = new Set<string>();
  for (const sheet of [...document.styleSheets]) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    const walk = (list: CSSRuleList) => {
      for (const r of [...list]) {
        if ('cssRules' in r && (r as CSSGroupingRule).cssRules) walk((r as CSSGroupingRule).cssRules);
        for (const m of r.cssText.matchAll(/--ll-[\w-]+-ink\b/g)) inkNames.add(m[0]);
      }
    };
    walk(rules);
  }
  const allowed = [...opts.colorTokens, ...inkNames]
    .filter((n) => rootStyle.getPropertyValue(n).trim() !== '')
    .map((n) => {
      probe.style.color = `var(${n})`;
      return rgba(getComputedStyle(probe).color);
    });
  probe.remove();

  const hiddenTree = (el: Element) => el.closest('[aria-hidden="true"], [inert], [hidden]') !== null;
  const visible = (el: Element) => {
    if (hiddenTree(el)) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.contentVisibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const label = (el: Element) => {
    const parts: string[] = [];
    let cur: Element | null = el;
    for (let i = 0; cur && i < 3; i++, cur = cur.parentElement) {
      const cls = [...cur.classList].slice(0, 2).join('.');
      parts.unshift(`${cur.tagName.toLowerCase()}${cur.id ? `#${cur.id}` : ''}${cls ? `.${cls}` : ''}`);
    }
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 20) || el.getAttribute('aria-label')?.slice(0, 20) || '';
    return `${parts.join(' > ')}「${text}」`;
  };
  const isTextLink = (el: Element) => el.classList.contains('ll-link') || el.closest('a')?.classList.contains('ll-link') === true;
  const hasText = (el: Element) => [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '');

  const clickables = [...document.querySelectorAll('a, button, summary, [role="menuitem"]')].filter(visible);
  for (const el of clickables) {
    // 1 沒有瀏覽器預設的連結色（元素本身與含文字的後代）
    for (const node of [el, ...el.querySelectorAll('*')]) {
      if (node !== el && !hasText(node)) continue;
      const c = rgba(getComputedStyle(node).color);
      if (forbidden.some((f) => near(f, c))) out.push(`1 預設連結色 ${getComputedStyle(node).color}：${label(node)}`);
    }
    // 3 按鈕類沒有底線（文中連結除外）
    for (const node of [el, ...el.querySelectorAll('*')]) {
      if (isTextLink(node)) continue;
      if (getComputedStyle(node).textDecorationLine.includes('underline')) out.push(`3 底線：${label(node)}`);
    }
    // 2 連結與按鈕本身的文字色在白名單內（只有圖示的按鈕也算：圖示用 currentColor）
    if (el.tagName === 'A' || el.tagName === 'BUTTON') {
      const c = rgba(getComputedStyle(el).color);
      if (!allowed.some((a) => near(a, c))) out.push(`2 文字色不在白名單 ${getComputedStyle(el).color}：${label(el)}`);
    }
  }
  if (opts.colourOnly) return out;

  // 4 每個連結都帶核准的 class；沒有任何裸連結（包含看不見的）
  const bare = document.querySelectorAll('a:is(:not([class]), [class=""])');
  if (bare.length > 0) out.push(`4 裸連結 ${bare.length} 個：${[...bare].map(label).join('、')}`);
  for (const a of clickables.filter((el) => el.tagName === 'A')) {
    if (![...a.classList].some((c) => opts.anchorClasses.includes(c))) out.push(`4 連結沒有核准的 class（${a.className}）：${label(a)}`);
  }
  // 5 文中連結：有底線、偏移至少 2px、顏色是 --ll-link（滑過時是 --ll-link-hover，這裡在靜止狀態量）
  const linkProbe = document.createElement('span');
  linkProbe.style.color = 'var(--ll-link)';
  document.body.append(linkProbe);
  const linkColour = rgba(getComputedStyle(linkProbe).color);
  linkProbe.remove();
  for (const a of clickables.filter((el) => el.classList.contains('ll-link'))) {
    const cs = getComputedStyle(a);
    if (!cs.textDecorationLine.includes('underline')) out.push(`5 文中連結沒有底線：${label(a)}`);
    const offset = parseFloat(cs.textUnderlineOffset);
    if (!(offset >= 2)) out.push(`5 文中連結的底線偏移 ${cs.textUnderlineOffset}：${label(a)}`);
    if (!near(rgba(cs.color), linkColour) && !a.matches(':hover')) out.push(`5 文中連結的顏色 ${cs.color}：${label(a)}`);
  }
  // 6 觸控目標至少 44px（容差 0.5）
  const targets = [...document.querySelectorAll('a, button, summary, select, input:not([type="hidden"]), [role="menuitem"]')];
  for (const el of targets) {
    if (hiddenTree(el)) continue;
    if (el.matches('.ll-link, .ll-chip--inline')) continue;
    if (el.matches('.ll-skiplink') && document.activeElement !== el) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    let box = el.getBoundingClientRect();
    // 視覺隱藏的 input（開關、選項、檔案選擇）量最近的 label
    if (el.tagName === 'INPUT' && (cs.opacity === '0' || box.width <= 1 || box.height <= 1 || cs.clip !== 'auto' || cs.clipPath !== 'none')) {
      const lab = el.closest('label') ?? (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null);
      if (!lab) {
        out.push(`6 視覺隱藏的 input 沒有 label：${label(el)}`);
        continue;
      }
      box = lab.getBoundingClientRect();
    }
    // 收合的 <details> 裡的元素沒有方框（不在畫面上）
    if (box.width === 0 && box.height === 0) continue;
    if (box.width < 43.5 || box.height < 43.5) out.push(`6 觸控目標 ${Math.round(box.width)}×${Math.round(box.height)}：${label(el)}`);
  }
  return out;
}

/** 第 7 項的取樣：每一類最多 8 個，平均分布在頁面前中後段；先捲到畫面中央，確認滑鼠點得到（沒有被面板或遮罩蓋住、沒有停用）才交給 fn。回傳實際量了幾個 */
export async function forEachSample(page: Page, sel: string, fn: (i: number) => Promise<void>): Promise<number> {
  const all = page.locator(`${sel}:visible`);
  const n = await all.count();
  let done = 0;
  const picks = n <= 8 ? [...Array(n).keys()] : [...new Set(Array.from({ length: 8 }, (_, i) => Math.round((i * (n - 1)) / 7)))];
  for (const i of picks) {
    const hittable = await all
      .nth(i)
      .evaluate((node) => {
        if (node.closest('[aria-hidden="true"], [inert]') || (node as HTMLButtonElement).disabled || node.getAttribute('aria-disabled') === 'true')
          return false;
        node.scrollIntoView({ block: 'center', inline: 'center' });
        const r = node.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return hit !== null && (node === hit || node.contains(hit));
      })
      .catch(() => false);
    if (!hittable) continue;
    await fn(i);
    done++;
  }
  return done;
}

/** 按下後把滑鼠移到頁面角落再放開：不觸發點按（不跳頁、不打開東西） */
export async function release(page: Page): Promise<void> {
  await page.mouse.move(1, 1);
  await page.mouse.up();
  await page.mouse.move(1, 1);
}

/** 打開按鈕狀態板（?ll-fixture=buttons）；這個建置沒有 VITE_LL_FIXTURES=1 時回 false */
export async function openBoard(page: Page, theme: Theme, width: number): Promise<boolean> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/?ll-fixture=buttons&${themeQuery(theme)}`);
  await waitForApp(page);
  if ((await page.getByTestId('button-board').count()) === 0) return false;
  await page.waitForLoadState('networkidle');
  await settle(page);
  return true;
}

/** 元素本身與所有後代的 transform、translate、scale、rotate（減少動態的位移檢查：和靜止時比） */
export function motionOf(el: Element): string[] {
  return [el, ...el.querySelectorAll('*')].map((n) => {
    const cs = getComputedStyle(n);
    return `${cs.transform}|${cs.translate}|${cs.scale}|${cs.rotate}`;
  });
}
