// 可點元素的外觀（站規 4.2、5.1 的按鈕狀態板）：全站不得有瀏覽器預設樣式的連結、帶底線的按鈕或沒設計過的可點元素，占位頁與錯誤頁也一樣。
// 頁面與狀態的矩陣在 page-states.ts（和 axe.spec 共用），頁面內的檢查在 link-audit.ts。每頁一次算完、回傳違規清單，expect(violations).toEqual([])；
// 違規訊息帶主題、寬度、語系、選擇器路徑與文字前 20 字。十一項檢查：
//   1 沒有瀏覽器預設的連結色（about:blank 實測，不寫死）；2 連結與按鈕本身的文字色在 token 白名單內；3 按鈕類與其後代沒有底線（只有 .ll-link 有）；
//   4 每個連結都帶核准的 class、沒有任何裸連結；5 文中連結有底線、偏移至少 2px、顏色是 --ll-link；
//   6 觸控目標至少 44px（文中連結與行內名詞 chip 例外，量元素本身；視覺隱藏的 input 量 label）；
//   7 滑過與按下時重跑 1 到 3（減少動態的位移檢查在 reduced-motion.spec，跑在 reduced-motion 專案）；8 從頁首按 Tab 走一輪：每個焦點都有至少 2px 的外框、
//   不和 Tab bar 相交、不被 overflow 不是 visible 的祖先切到；9 強制色彩下按鈕、選單列、名詞卡本身看得到邊界；
//   10 站內連結不通往找不到頁面（所有 worker 共用一份已檢查清單，同一個網址整輪只開一次）；11 :visited 量不到（瀏覽器為了隱私一律回傳未造訪的樣式），只靠 check:links 的 R11 擋。
// 矩陣：PR 與 main 是 Chromium × 淺色與夜空 × 375 與 1280 × 中文（名詞圖鑑、我的、章節頁另加 768）；第 7、8 項是代表頁 × 淺色，第 9 項是四頁 × 375。
// LL_LINK_STYLE_FULL=1（main 或每日排程）：四種主題 × 375、768、1280 × 兩種語系，每個瀏覽器都跑，第 7 項也跑四種主題。
// 按鈕狀態板（?ll-fixture=buttons）與 ?ll-banner= 的橫幅只在 VITE_LL_FIXTURES=1 的建置存在（apps/web 的 e2e:build:fixtures），正式建置自動跳過。
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { waitForApp } from './helpers.ts';
import { audit, auditOpts, defaultLinkColours, forEachSample, openBoard, release, STATE_CLASSES } from './link-audit.ts';
import { ALL_THEMES, CASES, caseByName, caseData, openCase, pathOf, settle, switchTheme, type PageCase, type Theme } from './page-states.ts';

const FULL = process.env.LL_LINK_STYLE_FULL === '1';
const THEMES: readonly Theme[] = FULL ? ALL_THEMES : ALL_THEMES.slice(0, 2);
const LOCALES = FULL ? ['', '/en'] : [''];
const LIGHT = ALL_THEMES[0]!;

/** 第 7、8 項的代表頁：每一種可點元件至少出現在一頁（「更多」選單只有 compact 有） */
const STATE_PAGES: readonly PageCase[] = [
  caseByName('首頁', '有進度且有到期'),
  caseByName('闖關', '地圖新使用者'),
  caseByName('闖關', '地圖 quest fixture'),
  caseByName('闖關', '「更多」選單（compact）'),
  caseByName('闖關', '關卡介紹面板'),
  caseByName('闖關', '代號輸入：已下架'),
  caseByName('章節頁', '主線有進度'),
  caseByName('作答', '答錯'),
  caseByName('作答', '名詞小卡'),
  caseByName('作答', '結果頁'),
  caseByName('錯題本', '有到期入口'),
  caseByName('名詞圖鑑', '參考名詞展開'),
  caseByName('名詞頁', '已收進'),
  caseByName('我的', '有收藏（含下架題）'),
  caseByName('其他子頁', '設定'),
  caseByName('其他子頁', '備份預覽'),
  caseByName('其他子頁', '安裝教學'),
  caseByName('其他子頁', '關於與授權'),
  caseByName('頂層與錯誤', '找不到頁面'),
  caseByName('橫幅', 'Safari 分頁展開'),
];

/** 一個狀態在哪些寬度量：有指定就照指定；768 在 PR 只量 tablet 的頁面 */
function widthsOf(c: PageCase): number[] {
  if (c.widths) return [...c.widths];
  return [375, 768, 1280].filter((w) => w !== 768 || FULL || c.tablet === true);
}
const label = (c: PageCase) => `${c.group}：${c.name}`;

/** 第 10 項：這一頁的站內連結（去重）中還沒有人檢查過的，逐一開啟，確認不是找不到頁面。
 * 已檢查清單是 outputDir 裡的一個檔案（每一輪開始時 Playwright 會清掉 outputDir），所有 worker 共用：先登記再檢查，同一個網址整輪只開一次 */
async function checkInternalLinks(page: Page, info: TestInfo, source: string): Promise<string[]> {
  const hrefs = await page.evaluate(() => [
    ...new Set(
      [...document.querySelectorAll<HTMLAnchorElement>('a[href]')]
        .map((a) => new URL(a.href, location.href))
        // 同一頁的錨點（跳到主要內容的 #main）不算：它指向的就是現在這一頁
        .filter((u) => u.origin === location.origin && !(u.pathname === location.pathname && u.search === location.search))
        .filter((u) => !u.pathname.startsWith('/assets/') && !/\.[a-z0-9]+$/i.test(u.pathname))
        .map((u) => u.pathname + u.search),
    ),
  ]);
  const file = join(info.project.outputDir, '.link-style-checked.txt');
  mkdirSync(info.project.outputDir, { recursive: true });
  let claimed = new Set<string>();
  try {
    claimed = new Set(readFileSync(file, 'utf8').split('\n'));
  } catch {
    /* 第一個檢查的人 */
  }
  const mine = hrefs.filter((h) => !claimed.has(h));
  if (mine.length === 0) return [];
  appendFileSync(file, mine.map((h) => `${h}\n`).join(''));
  const checker = await page.context().newPage();
  const broken: string[] = [];
  try {
    for (const h of mine) {
      await checker.goto(h, { waitUntil: 'domcontentloaded' });
      await waitForApp(checker);
      // 內容讀完才知道是不是找不到（名詞、關卡、章節頁都是讀完資料才決定）：等布幕掀開（資料齊了）且 aria-busy 消失
      await checker
        .waitForFunction(
          () => document.querySelector('.ll-page[data-ready="true"]') !== null && document.querySelector('main [aria-busy="true"]') === null,
          null,
          { timeout: 15_000 },
        )
        .catch(() => checker.waitForLoadState('networkidle'));
      if ((await checker.getByTestId('not-found').count()) > 0) broken.push(`10 站內連結通往找不到頁面：${source} → ${h}`);
    }
  } finally {
    await checker.close();
  }
  return broken;
}

test.describe('可點元素的外觀：頁面矩陣（站規 4.2 第 1 到 6、10 項）', () => {
  test.skip(({ browserName }) => !FULL && browserName !== 'chromium', 'PR 與 main 只在 Chromium 跑；LL_LINK_STYLE_FULL=1 才跑每個瀏覽器');

  for (const prefix of LOCALES) {
    for (const c of CASES) {
      for (const width of widthsOf(c)) {
        test(`${label(c)} ${width} ${prefix || 'zh'}`, async ({ page, request, browserName }, info) => {
          test.skip(c.chromiumOnly === true && browserName !== 'chromium', '只有 Chromium 有 beforeinstallprompt');
          // 站內連結的檢查跟著 1280 跑，第一個遇到名詞圖鑑的測試要開一百多頁
          test.setTimeout(width === 1280 && !c.noLinks ? 300_000 : 90_000);
          const forbidden = await defaultLinkColours(page);
          const data = await caseData(request);
          if (c.fixtureOnly) {
            await page.goto('/?ll-fixture=buttons');
            await waitForApp(page);
            test.skip((await page.getByTestId('button-board').count()) === 0, '這個建置沒有 VITE_LL_FIXTURES=1（正式建置不含 ?ll-banner= 的觸發參數）');
          }
          await openCase(page, c, { width, prefix, theme: THEMES[0]!, data });
          const violations: string[] = [];
          for (const [i, t] of THEMES.entries()) {
            if (i > 0) await switchTheme(page, t);
            const found = await page.evaluate(audit, auditOpts(forbidden));
            violations.push(...found.map((v) => `[${t.name} ${width}px ${prefix || 'zh'}] ${v}`));
          }
          if (width === 1280 && !c.noLinks) violations.push(...(await checkInternalLinks(page, info, `${label(c)}（${pathOf(c, data, prefix)}）`)));
          expect(violations, `${label(c)}：${prefix}${pathOf(c, data, prefix)}`).toEqual([]);
        });
      }
    }
  }
});

test.describe('滑過與按下（站規 4.2 第 7 項）', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', '只在 Chromium 跑');

  for (const c of STATE_PAGES) {
    const width = c.widths?.[0] ?? 1280;
    test(`滑過與按下時沒有預設連結色、文字色在白名單、沒有底線：${label(c)}`, async ({ page, request }) => {
      test.setTimeout(180_000);
      const forbidden = await defaultLinkColours(page);
      await openCase(page, c, { width, prefix: '', theme: LIGHT, data: await caseData(request) });
      const violations: string[] = [];
      const counts: string[] = [];
      for (const [ti, t] of (FULL ? ALL_THEMES : [LIGHT]).entries()) {
        if (ti > 0) await switchTheme(page, t);
        for (const sel of STATE_CLASSES) {
          const n = await forEachSample(page, sel, async (i) => {
            await page.locator(`${sel}:visible`).nth(i).hover();
            await settle(page);
            violations.push(...(await page.evaluate(audit, auditOpts(forbidden, true))).map((v) => `[${t.name}] hover ${sel}#${i} ${v}`));
            await page.mouse.down();
            await settle(page);
            violations.push(...(await page.evaluate(audit, auditOpts(forbidden, true))).map((v) => `[${t.name}] active ${sel}#${i} ${v}`));
            await release(page);
          });
          if (ti === 0 && n > 0) counts.push(`${sel} ${n}`);
        }
      }
      test.info().annotations.push({ type: '取樣', description: counts.join('、') });
      expect(counts.length, '至少量到一類元件').toBeGreaterThan(0);
      expect([...new Set(violations)]).toEqual([]);
    });
  }
});

test.describe('鍵盤焦點（站規 4.2 第 8 項）', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', '只在 Chromium 跑');

  for (const c of STATE_PAGES) {
    for (const width of c.widths ? [...c.widths] : [375, 1280]) {
      test(`從頁首按 Tab 走一輪：外框至少 2px、不碰 Tab bar、不被 overflow 切到：${label(c)} ${width}`, async ({ page, request }) => {
        test.setTimeout(180_000);
        await openCase(page, c, { width, prefix: '', theme: LIGHT, data: await caseData(request) });
        await page.evaluate(() => {
          (document.activeElement as HTMLElement | null)?.blur();
          window.scrollTo(0, 0);
        });
        const seen = new Set<string>();
        let first: string | null = null;
        const violations: string[] = [];
        for (let i = 0; i < 400; i++) {
          await page.keyboard.press('Tab');
          const info = await page.evaluate(() => {
            const el = document.activeElement as HTMLElement | null;
            if (!el || el === document.body || el === document.documentElement) return null;
            const w = window as unknown as { __e2eFocus?: number };
            if (!el.dataset.e2eFocus) el.dataset.e2eFocus = String((w.__e2eFocus = (w.__e2eFocus ?? 0) + 1));
            // 外框可以畫在元素本身，或畫在它看得見的那一塊（例如地圖節點的圓盤，按鈕本身 outline: none）
            const ringed = (n: Element) => {
              const s = getComputedStyle(n);
              return s.outlineStyle !== 'none' && (parseFloat(s.outlineWidth) || 0) >= 2;
            };
            const target = ringed(el) ? el : ([...el.querySelectorAll('*')].find(ringed) ?? el);
            const cs = getComputedStyle(target);
            const r = target.getBoundingClientRect();
            const ow = parseFloat(cs.outlineWidth) || 0;
            const grow = Math.max(0, ow + (parseFloat(cs.outlineOffset) || 0));
            const ring = { left: r.left - grow, top: r.top - grow, right: r.right + grow, bottom: r.bottom + grow };
            const name = `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join('.')}「${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20)}」`;
            const problems: string[] = [];
            if (cs.outlineStyle === 'none' || ow < 2) problems.push(`沒有焦點外框（${cs.outlineStyle} ${ow}px）`);
            // 和 Tab bar 相交（元素本身在 Tab bar 裡除外）：相交的那一塊裡取 9 點，只要有一點最上層是 Tab bar 就算被蓋住。
            // 原生 <dialog> 的 showModal 在 top layer、畫在 Tab bar 上面，面板裡的按鈕和 Tab bar 的矩形重疊也不會被蓋住
            const bar = document.querySelector('.ll-tabbar');
            if (bar && !bar.contains(el)) {
              const b = bar.getBoundingClientRect();
              const ix = {
                left: Math.max(ring.left, b.left),
                right: Math.min(ring.right, b.right),
                top: Math.max(ring.top, b.top),
                bottom: Math.min(ring.bottom, b.bottom),
              };
              if (ix.left < ix.right && ix.top < ix.bottom) {
                const covered = [0.1, 0.5, 0.9].some((fx) =>
                  [0.1, 0.5, 0.9].some((fy) => {
                    const hit = document.elementFromPoint(ix.left + (ix.right - ix.left) * fx, ix.top + (ix.bottom - ix.top) * fy);
                    return hit !== null && bar.contains(hit);
                  }),
                );
                if (covered)
                  problems.push(`焦點外框被 Tab bar 蓋住（外框 ${Math.round(ring.top)} 到 ${Math.round(ring.bottom)}、Tab bar 從 ${Math.round(b.top)}）`);
              }
            }
            // 被 overflow 不是 visible 的祖先切到（以祖先的 padding box 為界，容差 1px）
            for (let p = target.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
              const ps = getComputedStyle(p);
              const clipX = ps.overflowX !== 'visible';
              const clipY = ps.overflowY !== 'visible';
              if (!clipX && !clipY) continue;
              const pr = p.getBoundingClientRect();
              const box = {
                left: pr.left + (parseFloat(ps.borderLeftWidth) || 0),
                right: pr.right - (parseFloat(ps.borderRightWidth) || 0),
                top: pr.top + (parseFloat(ps.borderTopWidth) || 0),
                bottom: pr.bottom - (parseFloat(ps.borderBottomWidth) || 0),
              };
              const cutX = clipX && (ring.left < box.left - 1 || ring.right > box.right + 1);
              const cutY = clipY && (ring.top < box.top - 1 || ring.bottom > box.bottom + 1);
              if (cutX || cutY) {
                problems.push(
                  `焦點外框被 ${p.tagName.toLowerCase()}.${[...p.classList].slice(0, 2).join('.')}（overflow ${ps.overflowX} ${ps.overflowY}）切到`,
                );
                break;
              }
            }
            return { id: el.dataset.e2eFocus, name, problems };
          });
          if (!info) continue;
          if (first === null) first = info.id!;
          else if (info.id === first) break;
          if (seen.has(info.id!)) continue;
          seen.add(info.id!);
          violations.push(...info.problems.map((p) => `${p}：${info.name}`));
        }
        expect(seen.size).toBeGreaterThan(0);
        expect(violations).toEqual([]);
      });
    }
  }
});

test.describe('強制色彩（站規 4.2 第 9 項）', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', '只在 Chromium 跑');
  const PAGES = [caseByName('我的', '有收藏（含下架題）'), caseByName('章節頁', '主線有進度'), caseByName('名詞圖鑑', '依章節'), caseByName('作答', '題目')];
  for (const c of PAGES) {
    test(`按鈕、選單列、名詞卡本身看得到邊界：${label(c)}`, async ({ page, request }) => {
      await page.emulateMedia({ forcedColors: 'active' });
      await openCase(page, c, { width: 375, prefix: '', theme: LIGHT, data: await caseData(request) });
      const violations = await page.evaluate(() =>
        [...document.querySelectorAll('.ll-btn, .ll-navrow, .ll-termitem')]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && el.closest('[aria-hidden="true"], [inert], [hidden]') === null;
          })
          .flatMap((el) => {
            const cs = getComputedStyle(el);
            const border = cs.borderTopStyle === 'none' ? 0 : parseFloat(cs.borderTopWidth) || 0;
            const outline = cs.outlineStyle === 'none' ? 0 : parseFloat(cs.outlineWidth) || 0;
            return Math.max(border, outline) >= 1
              ? []
              : [`${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join('.')}「${(el.textContent ?? '').trim().slice(0, 20)}」`];
          }),
      );
      expect(violations).toEqual([]);
    });
  }

  // 主按鈕的字（M3 驗收第 1 輪的 blocker：Chromium 在強制色彩下會在 HighlightText 的字後面畫一塊 Canvas 底板，字就讀不到）：
  // 截下文字那一格，最多的顏色是底，至少要有另一種顏色（字）和它的對比 4.5:1 以上。人工抽樣是 #37336D 對 #FFFFFF，11.3:1
  const PRIMARY_LABELS: readonly { c: PageCase; selector: string }[] = [
    { c: caseByName('章節頁', '主線新'), selector: '[data-testid="chapter-start"] .ll-btn__label' },
    { c: caseByName('作答', '答對'), selector: '.ll-feedback__next .ll-btn--primary .ll-btn__label' },
  ];
  for (const { c, selector } of PRIMARY_LABELS) {
    test(`主按鈕的字和底色對比 4.5:1 以上：${label(c)}`, async ({ page, request }) => {
      await page.emulateMedia({ forcedColors: 'active' });
      await openCase(page, c, { width: 375, prefix: '', theme: LIGHT, data: await caseData(request) });
      const el = page.locator(selector).first();
      await expect(el).toBeVisible();
      const png = await el.screenshot({ animations: 'disabled', caret: 'hide' });
      // 在頁面裡解碼（createImageBitmap 讀 Blob，不經過 CSP 的 img-src），回傳出現最多的 16 種顏色與總像素
      const { total, top } = await page.evaluate(async (b64: string) => {
        const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
        const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
        const canvas = new OffscreenCanvas(bmp.width, bmp.height);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(bmp, 0, 0);
        const d = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
        const counts = new Map<number, number>();
        for (let i = 0; i < d.length; i += 4) {
          const k = (d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!;
          counts.set(k, (counts.get(k) ?? 0) + 1);
        }
        const sorted = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 16);
        return { total: bmp.width * bmp.height, top: sorted.map(([k, n]) => ({ rgb: [(k >> 16) & 255, (k >> 8) & 255, k & 255] as Rgb, n })) };
      }, png.toString('base64'));
      const [bg, ...rest] = top;
      expect(bg, '截圖是空的').toBeDefined();
      // 字的實心像素至少占文字格的 0.5%（反鋸齒的中間色不算）
      const ink = rest.filter((x) => x.n >= total * 0.005).map((x) => ({ ...x, ratio: contrast(bg!.rgb, x.rgb) }));
      const best = Math.max(0, ...ink.map((x) => x.ratio));
      expect(
        best,
        `底 rgb(${bg!.rgb.join(' ')})，其他顏色 ${ink.map((x) => `rgb(${x.rgb.join(' ')}) ${x.ratio.toFixed(1)}:1`).join('、')}`,
      ).toBeGreaterThanOrEqual(4.5);
    });
  }
});

// ---- 按鈕狀態板（站規 5.1）：五變體 × 三尺寸 × 靜止、滑過、按下、切換已按下、焦點、停用、載入中，加 IconButton、StatChip、NavRow、Disclosure、GlossaryItem ----

/** 板上用真的滑鼠與鍵盤觸發的格子：data-force 是 hover、active、focus-visible；其他元件用 data-testid 標狀態 */
const BOARD_STATE_TARGETS = [
  '[data-force="hover"]',
  '[data-force="active"]',
  '[data-force="focus-visible"]',
  '[data-testid="nav-hover"]',
  '[data-testid="nav-active"]',
  '[data-testid="nav-focus"]',
  '[data-testid="disc-hover"] summary',
  '[data-testid="disc-active"] summary',
  '[data-testid="disc-focus"] summary',
  '[data-testid="gi-hover"]',
  '[data-testid="gi-active"]',
  '[data-testid="gi-focus"]',
  '[data-testid="pill-hover"]',
];

type Rgb = [number, number, number];

/** 板上每顆立體按鈕（primary、secondary、danger）的面、底邊、字色與外框，換成 sRGB 後在 Node 這邊比 */
function boardColours() {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const rgb = (c: string): [number, number, number] => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return [r!, g!, b!];
  };
  /** box-shadow 裡往下偏移、不是 inset 的那一層的顏色（底邊） */
  const ledgeOf = (shadow: string): string | null => {
    if (shadow === 'none') return null;
    for (const part of shadow.split(/,(?![^(]*\))/)) {
      if (/inset/.test(part)) continue;
      const colour = part.match(/(rgba?|oklab|oklch|color)\([^)]*\)|#[0-9a-f]+/i)?.[0];
      const nums = part
        .replace(colour ?? '', '')
        .trim()
        .split(/\s+/)
        .map((s) => parseFloat(s));
      if (colour && (nums[1] ?? 0) > 0) return colour;
    }
    return null;
  };
  return [...document.querySelectorAll<HTMLElement>('[data-board]')]
    .filter((el) => /^(primary|secondary|danger)-(sm|md|lg)-(rest|disabled)$|^(secondary|quiet)-(sm|md|lg)-pressed$/.test(el.dataset.board ?? ''))
    .map((el) => {
      const cs = getComputedStyle(el);
      const ledge = ledgeOf(cs.boxShadow);
      return {
        key: el.dataset.board!,
        face: rgb(cs.backgroundColor),
        fg: rgb(cs.color),
        ledge: ledge ? rgb(ledge) : null,
        borderStyle: cs.borderTopStyle,
        pressed: el.getAttribute('aria-pressed'),
      };
    });
}

const lum = ([r, g, b]: Rgb) => {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};
const contrast = (a: Rgb, b: Rgb) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m) as [number, number];
  return (x + 0.05) / (y + 0.05);
};

test.describe('按鈕狀態板（站規 5.1，只在 VITE_LL_FIXTURES=1 的建置）', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', '只在 Chromium 跑');

  for (const theme of ALL_THEMES) {
    for (const width of FULL ? [375, 768, 1280] : [375, 1280]) {
      test(`${theme.name} ${width}：第 1 到 6 項、滑過按下焦點、底邊比面暗、停用讀得到`, async ({ page }) => {
        test.setTimeout(180_000);
        const forbidden = await defaultLinkColours(page);
        test.skip(!(await openBoard(page, theme, width)), '這個建置沒有 VITE_LL_FIXTURES=1（正式建置不含按鈕狀態板）');
        const where = `[${theme.name} ${width}px]`;
        const violations = (await page.evaluate(audit, auditOpts(forbidden))).map((v) => `${where} ${v}`);

        // 底邊比面暗（站規 5.1 的通過條件）：四個主題的每一種立體按鈕都要。M3 驗收第 4 輪規劃者定案 (a) 以後，深色的次要與危險按鈕
        // 也是面調亮、底邊調暗（不再是比面亮的加厚外框），規則和 tokens 的 contrast.test.ts 同一條：底邊比面暗，次要和面至少 1.3:1、
        // 危險至少 1.2:1 才看得出厚度（tokens 實際值：深色次要 1.33、危險 1.26 以上，紙質都更高）
        const ledgeMin: Record<string, number> = { secondary: 1.3, danger: 1.2 };
        const boards = await page.evaluate(boardColours);
        expect(boards.length, '板上的立體按鈕').toBeGreaterThan(20);
        for (const b of boards) {
          if (b.key.endsWith('-rest')) {
            if (!b.ledge) {
              violations.push(`${where} 底邊：${b.key} 沒有往下的外陰影`);
              continue;
            }
            if (!(lum(b.ledge) < lum(b.face))) violations.push(`${where} 底邊比面亮：${b.key}（底邊 ${b.ledge.join(',')}、面 ${b.face.join(',')}）`);
            const min = ledgeMin[b.key.slice(0, b.key.indexOf('-'))];
            if (min !== undefined && contrast(b.ledge, b.face) < min)
              violations.push(`${where} 底邊和面分不出來：${b.key}（${contrast(b.ledge, b.face).toFixed(2)}:1，至少 ${min}:1）`);
          }
          // 停用讀得到：字對底至少 3:1（站規 1.1.2：目標 4.5、最低 3），虛線外框、沒有底邊
          if (b.key.endsWith('-disabled')) {
            const r = contrast(b.fg, b.face);
            if (r < 3) violations.push(`${where} 停用讀不到：${b.key}（${r.toFixed(2)}:1）`);
            if (b.borderStyle !== 'dashed') violations.push(`${where} 停用沒有虛線外框：${b.key}（${b.borderStyle}）`);
            if (b.ledge) violations.push(`${where} 停用仍有底邊：${b.key}`);
          }
          if (b.key.endsWith('-pressed') && b.pressed !== 'true') violations.push(`${where} 切換已按下沒有 aria-pressed：${b.key}`);
        }

        // 滑過、按下：用真的滑鼠觸發，重跑第 1 到 3 項；焦點：鍵盤聚焦後要是 :focus-visible、有至少 2px 的外框
        for (const sel of BOARD_STATE_TARGETS) {
          const all = page.locator(sel);
          const n = await all.count();
          for (let i = 0; i < n; i++) {
            const el = all.nth(i);
            if (!(await el.isVisible())) continue;
            const force = (await el.getAttribute('data-force')) ?? (/hover/.test(sel) ? 'hover' : /active/.test(sel) ? 'active' : 'focus-visible');
            const name = `${sel}#${i}`;
            await el.scrollIntoViewIfNeeded();
            if (force === 'focus-visible') {
              // 先讓鍵盤成為最後的輸入方式（:focus-visible 的啟發式），再用程式聚焦
              await page.keyboard.press('Shift');
              await el.focus();
              const ring = await el.evaluate((n) => {
                const s = getComputedStyle(n);
                return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) || 0, visible: n.matches(':focus-visible') };
              });
              if (!ring.visible || ring.style === 'none' || ring.width < 2) violations.push(`${where} 焦點外框 ${ring.style} ${ring.width}px：${name}`);
            } else {
              await el.hover();
              if (force === 'active') await page.mouse.down();
              await settle(page);
            }
            violations.push(...(await page.evaluate(audit, auditOpts(forbidden, true))).map((v) => `${where} ${force} ${name} ${v}`));
            if (force === 'active') await release(page);
            await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
          }
        }
        expect([...new Set(violations)]).toEqual([]);
      });
    }
  }
});
