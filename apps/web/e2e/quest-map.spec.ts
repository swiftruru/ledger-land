// 闖關地圖（17 第 10 節的 M2 與 M3 驗收、圖規第 11.2 節）：用 ?ll-fixture=quest 的 3 章 13 關 fixture；正式資料另外測一次。
// M3 版面重做：全幅地景、軌道與 HUD 對齊、真實 px 路線（路線不壓字）、章節牌（不含徽章）、拱門與紙籤、海峽與唯一一張延伸說明卡、E1-1 編號、
// 捲動定位、清單檢視的切換定位、頂部統計列收編工具（compact 有「更多」選單）、?from 播放的取消與收尾（finding map-1、map-2、map-5）、場景載入失敗不換錯誤頁（map-6）。
// 截圖存到 .local-reports/quest-map/m3/（不進 repo）。
import { expect, test, type Page } from '@playwright/test';
import { waitForApp, watchCsp } from './helpers.ts';
import { ALL_THEMES, caseByName, caseData, openCase } from './page-states.ts';

const MAP = '/play/?ll-fixture=quest';
const FULL = '/play/?ll-fixture=quest-full';
const CURRENT = 'lv_fx010003';
const SHOTS = '.local-reports/quest-map/m3';
const THEMES: [string, string][] = [
  ['light', 'll-theme=light'],
  ['dark-violet', 'll-theme=dark&ll-flavor=violet'],
  ['dark-berry', 'll-theme=dark&ll-flavor=berry'],
  ['dark-wine', 'll-theme=dark&ll-flavor=wine'],
];

async function openMap(page: Page, url = MAP): Promise<void> {
  await page.goto(url);
  await waitForApp(page);
  await page.getByTestId('quest-map').waitFor();
}

/** HUD 的工具：medium 以上直接排開；compact 收在「更多」選單（menuName 是選單項目的文字） */
async function hudTool(page: Page, testId: string, menuName: string): Promise<void> {
  const inline = page.locator(`.ll-hud__tools [data-testid="${testId}"]:not([role="menuitem"])`);
  if (await inline.count()) {
    await inline.click();
    return;
  }
  await page.getByTestId('map-more').click();
  await page.getByRole('menuitem', { name: menuName }).click();
}

function inViewport(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight;
  }, selector);
}

/** 沿每條路線（.qm-route__line 的 path）每 8px 取一點，換成頁面座標後落在文字類矩形裡的次數（路線一半寬 3px 也算） */
function routeOverText(page: Page) {
  return page.evaluate(() => {
    const rects = [...document.querySelectorAll('.ll-chbanner, .ll-chend__plaque, .ll-node__stars, .qm-strait__card')].map((e) => e.getBoundingClientRect());
    let hits = 0;
    for (const svg of document.querySelectorAll('.qm-route')) {
      const box = svg.getBoundingClientRect();
      for (const p of svg.querySelectorAll<SVGPathElement>('.qm-route__line path')) {
        const L = p.getTotalLength();
        for (let s = 0; s <= L; s += 8) {
          const q = p.getPointAtLength(s);
          const x = box.left + q.x;
          const y = box.top + q.y;
          for (const r of rects) if (x > r.left - 3 && x < r.right + 3 && y > r.top - 3 && y < r.bottom + 3) hits++;
        }
      }
    }
    return hits;
  });
}

test.describe('闖關地圖', () => {
  test.beforeEach(async ({ page }) => {
    // 每個測試都從地圖檢視開始（檢視不再記住，只清捲動位置）
    await page.addInitScript(() => {
      try {
        if (!sessionStorage.getItem('ll:e2e-init')) {
          sessionStorage.removeItem('ll:map-scroll');
          sessionStorage.setItem('ll:e2e-init', '1');
        }
      } catch {
        /* 無痕模式 */
      }
    });
  });

  test('載入後捲到目前關卡，節點有可讀名稱與 aria-current，角色站在節點上，沒有 CSP 違規', async ({ page }) => {
    const assertCsp = await watchCsp(page);
    await openMap(page);
    const current = page.locator('[aria-current="step"]');
    await expect(current).toHaveCount(1);
    // 關卡名稱來自各章快照，CI 的 Firefox 曾超過預設的 5 秒才載到
    await expect(current).toHaveAttribute('aria-label', /第 1 章第 3 關 股東權益.*建議下一關/, { timeout: 15_000 });
    await expect.poll(() => inViewport(page, '[aria-current="step"]'), { timeout: 15_000 }).toBe(true);
    await expect(page.locator('.ll-node__btn').first()).toHaveAttribute('aria-label', /第 1 章第 1 關 認識資產，3 顆星中的 3 顆/);
    await expect(page.getByTestId('map-marker')).toHaveCSS('visibility', 'visible');
    const transform = await page.getByTestId('map-marker').evaluate((el) => (el as unknown as HTMLElement).style.transform);
    expect(transform).toMatch(/translate\(\d+px, -\d+px\)/);
    // 角色 60px，水平置中在目前關卡上、腳在圓盤上方（圖規 2.7）
    const [m, d] = await Promise.all([
      page.getByTestId('map-marker').evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect),
      current.locator('.ll-node__disc').evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect),
    ]);
    expect(m.width).toBe(60);
    expect(Math.abs(m.left + m.width / 2 - (d.left + d.width / 2))).toBeLessThan(1.5);
    expect(m.bottom).toBeLessThanOrEqual(d.top);
    // DOM 順序第 1 關在前，視覺第 1 章在最下面
    const ys = await page.locator('[data-testid="map-chapter"]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
    expect(ys[0]!).toBeGreaterThan(ys[1]!);
    expect(ys[1]!).toBeGreaterThan(ys[2]!);
    await expect(page.getByTestId('extension-gap')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 2, name: '借貸與分錄' })).toHaveCount(1);
    // 角色是定稿的金幣少女：預設托腮、微笑
    await expect(page.getByTestId('map-marker')).toHaveAttribute('data-pose', 'cheek');
    await expect(page.getByTestId('map-marker')).toHaveAttribute('data-expression', 'smile');
    // 第 1 章的起點是木樁加燕尾旗（第 2 輪看圖驗收）；沒有右下浮動的工具列
    await expect(page.locator('[data-chapter-id="ch_fx0001"] [data-testid="map-start"] .qm-stone__flag')).toHaveCount(1);
    await expect(page.locator('.qm-toolbar, .ll-maptool')).toHaveCount(0);
    await assertCsp();
  });

  test('幾何：路線不經過章節牌、紙籤、星星籤與延伸說明卡；相鄰章節的路線接在同一個 x；沒有水平捲動', async ({ page }) => {
    await openMap(page);
    // 所有章節都畫出來再量（content-visibility: auto 之下離視窗遠的章節沒有版面）
    await page.evaluate(() => {
      for (const s of document.querySelectorAll<HTMLElement>('.qm-ch, .qm-strait')) s.style.contentVisibility = 'visible';
    });
    expect(await routeOverText(page)).toBe(0);
    const joins = await page.evaluate(() => {
      const ends: { start: DOMPoint; end: DOMPoint }[] = [];
      for (const svg of document.querySelectorAll('.qm-route')) {
        const box = svg.getBoundingClientRect();
        const paths = [...svg.querySelectorAll<SVGPathElement>('.qm-route__line path')];
        const a = paths[0]!.getPointAtLength(0);
        const last = paths[paths.length - 1]!;
        const b = last.getPointAtLength(last.getTotalLength());
        ends.push({ start: new DOMPoint(box.left + a.x, box.top + a.y), end: new DOMPoint(box.left + b.x, box.top + b.y) });
      }
      return ends.slice(1).map((e, i) => Math.abs(e.start.x - ends[i]!.end.x));
    });
    for (const dx of joins) expect(dx).toBeLessThanOrEqual(0.5);
    // 未走圓點的 pathLength 是 16 的倍數再多 0.01（圓點兩端各落一顆，終點那一顆不會被瀏覽器略過）；已走實線不需要 pathLength
    const lengths = await page.locator('.qm-route__ahead').evaluateAll((els) => els.map((e) => Number(e.getAttribute('pathLength'))));
    expect(lengths.length).toBeGreaterThan(0);
    expect(lengths.every((n) => n > 16 && Math.abs((n - 0.01) / 16 - Math.round((n - 0.01) / 16)) < 1e-6)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test('寬螢幕：地景鋪滿視窗寬、HUD 內層與軌道同一條左緣、清單和軌道同寬；切換檢視時工具按鈕不移動', async ({ page }, info) => {
    test.skip(info.project.name === 'iphone-webkit', '寬螢幕版面在桌面專案測');
    await page.setViewportSize({ width: 1280, height: 900 });
    await openMap(page);
    const vw = await page.evaluate(() => document.documentElement.clientWidth);
    const terrain = await page.locator('[data-chapter-id="ch_fx0001"] .qm-terrain').evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);
    expect(terrain.left).toBeLessThanOrEqual(0.5);
    expect(terrain.right).toBeGreaterThanOrEqual(vw - 0.5);
    const trackLeft = await page.locator('.qm-page').evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue('--qm-track-left')));
    const trackW = await page.locator('.qm-page').evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue('--qm-track-w')));
    expect(trackLeft).toBe(420);
    const hud = await page.locator('.qm-hud .ll-pagehead__inner').evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);
    expect(Math.abs(hud.left - trackLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs(hud.right - (trackLeft + trackW))).toBeLessThanOrEqual(1);
    // HUD 的底線橫跨全寬；medium 以上四個工具（沒有掃描時三個）直接排開，沒有「更多」
    const sticky = await page.locator('.qm-sticky').evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);
    expect(sticky.left).toBe(0);
    expect(sticky.width).toBe(vw);
    await expect(page.getByTestId('map-more')).toHaveCount(0);
    await expect(page.locator('.ll-hud__tools .ll-iconbtn--chrome')).toHaveCount(3);
    const toggle = page.locator('.ll-hud__tools [data-testid="map-list-toggle"]');
    const before = await toggle.evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);
    await hudTool(page, 'map-list-toggle', '清單檢視');
    const list = await page.getByTestId('map-list').evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);
    expect(list.width).toBe(trackW);
    expect(Math.abs(list.left - trackLeft)).toBeLessThanOrEqual(1);
    // 第 2 輪看圖驗收：切到清單時 HUD 內層不再變寬，三顆工具留在原處，滑鼠不動再按一次就切回地圖
    const after = await toggle.evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);
    expect(Math.abs(after.left - before.left)).toBeLessThanOrEqual(0.5);
    const hudList = await page.locator('.qm-hud .ll-pagehead__inner').evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);
    expect(Math.abs(hudList.left - hud.left)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(hudList.width - hud.width)).toBeLessThanOrEqual(0.5);
  });

  test('捲動定位：目前關卡與它的星星籤在可用區內（sticky 區塊之下、Tab bar 之上）；本章第一關時章節牌也整張露出', async ({ page }) => {
    // iPhone 15 的 WebKit 配額約 1 GB，會被判定成相機預覽的暫存情境，完整的提示放進 sticky 區塊（375 時約 260px），
    // 視窗高 659 時可用區放不下第一關加章節牌；這裡只驗定位規則，先把提示標成已關閉（環境不同結果才一樣）
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('ll:ephemeral-notice-dismissed', '1');
      } catch {
        /* 沒有 sessionStorage 時照常跑 */
      }
    });
    await openMap(page, `${MAP}&ll-fixture-progress=none`);
    const first = page.locator('[data-level-id="lv_fx010001"]');
    await expect(first.locator('button')).toHaveAttribute('aria-current', 'step');
    await expect
      .poll(() =>
        page.evaluate(() => {
          const top = document.querySelector('.qm-sticky')!.getBoundingClientRect().bottom;
          const bar = document.querySelector('.ll-tabbar');
          const bottom =
            bar && getComputedStyle(bar).display !== 'none' && bar.getBoundingClientRect().top > innerHeight / 2
              ? bar.getBoundingClientRect().top
              : innerHeight;
          const node = document.querySelector('[data-level-id="lv_fx010001"] .ll-node__btn')!.getBoundingClientRect();
          const tag = document.querySelector('[data-level-id="lv_fx010001"] .ll-node__stars')!.getBoundingClientRect();
          const banner = document.querySelector('[data-chapter-id="ch_fx0001"] .ll-chbanner')!.getBoundingClientRect();
          return node.top >= top && tag.bottom <= bottom && banner.bottom <= bottom && banner.top >= top;
        }),
      )
      .toBe(true);
  });

  test('延伸區：海峽的棧橋把主線接到延伸章，「不列入期中考」整頁只說一次；節點是六邊形、編號 E1-1；清單檢視開頭有同一張說明卡', async ({ page }) => {
    await openMap(page);
    const gap = page.getByTestId('extension-gap');
    await expect(gap.locator('.qm-strait__card')).toContainText('延伸區：不列入期中考，想多學再來');
    await expect(gap.getByTestId('exam-scope-note')).toHaveText('期中考範圍以老師公告為準。');
    await expect(gap.locator('.qm-strait__deck')).toHaveCount(1);
    await expect(gap.locator('.ll-notetag')).toHaveCount(0);
    // 整頁（地圖檢視）只有海峽說明卡寫「不列入期中考」；章節牌不再放延伸標籤
    expect(await page.evaluate(() => (document.querySelector('main')!.textContent!.match(/不列入期中考/g) ?? []).length)).toBe(1);
    await expect(page.locator('.qm-ch__banner .ll-notetag--extension')).toHaveCount(0);
    // 分隔在最後一個主線章之上、延伸章之下（視覺由下往上）
    const [gapTop, ch2Top, extTop] = await Promise.all([
      gap.evaluate((el) => el.getBoundingClientRect().top),
      page.locator('[data-chapter-id="ch_fx0002"]').evaluate((el) => el.getBoundingClientRect().top),
      page.locator('[data-chapter-id="ch_fx00e1"]').evaluate((el) => el.getBoundingClientRect().top),
    ]);
    expect(gapTop).toBeLessThan(ch2Top);
    expect(extTop).toBeLessThan(gapTop);
    const extSection = page.locator('[data-chapter-id="ch_fx00e1"]');
    await expect(extSection.locator('.qm-ch__banner')).toContainText('延伸第 1 章');
    await expect(extSection.locator('.ll-node--ext')).toHaveCount(4);
    await expect(extSection.locator('.ll-node__no').first()).toHaveText('E1-1');
    // 不計分關卡：沒有星等，可讀名稱與星星籤是「尚未讀」；章末沒有實驗室按鈕（故事步驟的路由還不存在）
    const unscored = extSection.locator('[data-level-id="lv_fx0e0004"]');
    await extSection.scrollIntoViewIfNeeded();
    await expect(unscored.locator('button')).toHaveAttribute('aria-label', /^延伸第 1 章第 4 關 四種觀點，尚未讀$/, { timeout: 15_000 });
    await expect(unscored.locator('.ll-node__read')).toHaveText('尚未讀');
    await expect(unscored.locator('.ll-node__stars svg')).toHaveCount(0);
    await expect(page.getByTestId('chapter-end-lab')).toHaveCount(0);
    await unscored.locator('button').click();
    const sheet = page.getByTestId('level-sheet');
    await expect(sheet.getByTestId('sheet-read-state')).toHaveText('尚未讀');
    await expect(sheet).toContainText('閱讀狀態');
    await expect(sheet.getByRole('link', { name: '開始' })).toHaveCount(1);
    await page.keyboard.press('Escape');
    // 清單檢視：延伸區開頭一張說明卡（同文字），各延伸章不放標籤；延伸章的關卡列編號也是 E1-1
    await hudTool(page, 'map-list-toggle', '清單檢視');
    const ext = page.getByTestId('list-extension');
    await expect(ext).toContainText('延伸區：不列入期中考，想多學再來');
    await expect(page.locator('.qm-list__chapter')).toHaveCount(3);
    await expect(page.locator('[data-chapter-id="ch_fx00e1"] .ll-notetag')).toHaveCount(0);
    expect(
      await page.evaluate(() => {
        const ext = document.querySelector('[data-testid="list-extension"]')!;
        const items = [...document.querySelectorAll('.qm-list__item')];
        return items.indexOf(ext.nextElementSibling as Element);
      }),
    ).toBe(2);
  });

  test('章節牌與章末（圖規 4.4、4.5）：章節牌不含徽章；徽章在章末紙籤，三種外觀；拱門依完成與精通換彩帶；頂部徽章數每章一枚', async ({ page }) => {
    await openMap(page);
    await expect(page.locator('.ll-chbanner .ll-chbadge')).toHaveCount(0);
    const end1 = page.locator('[data-chapter-id="ch_fx0001"] [data-testid="chapter-end"]');
    await expect(end1).toHaveAttribute('data-badge-state', 'locked');
    await expect(end1).toContainText('第 1 章終點');
    await expect(end1).toContainText('可獲得徽章「開店了」');
    await expect(end1.locator('.ll-chend__ribbon')).toHaveCount(0);
    await openMap(page, `${MAP}&ll-fixture-progress=ch1done`);
    await expect(end1).toHaveAttribute('data-badge-state', 'done');
    await expect(end1).toContainText('第 1 章完成');
    await expect(end1).toContainText('徽章：開店了');
    await expect(end1.locator('.ll-chbadge--done')).toHaveCount(1);
    await expect(end1.locator('.ll-chend__ribbon')).toHaveCount(1);
    await expect(page.getByRole('link', { name: '徽章 1 個，看我的徽章' })).toHaveAttribute('href', '/me/badges/');
    await openMap(page, `${MAP}&ll-fixture-progress=all`);
    await expect(end1).toHaveAttribute('data-badge-state', 'mastery');
    await expect(end1.locator('.ll-chend__keystar')).toHaveCount(1);
    // 精通的紙籤標題：淺色與深色都是 warning-ink，不是「完成」的顏色（第 2 輪看圖驗收：深色曾被答對綠蓋過）
    const titleColour = () =>
      end1.locator('.ll-chend__text').evaluate((el) => {
        const probe = document.createElement('span');
        el.append(probe);
        const read = (v: string) => {
          probe.style.color = `var(${v})`;
          return getComputedStyle(probe).color;
        };
        const out = {
          title: getComputedStyle(el).color,
          warning: read('--ll-warning-ink'),
          success: read('--ll-success-ink'),
          accent: read('--ll-accent-ink'),
        };
        probe.remove();
        return out;
      });
    const light = await titleColour();
    expect(light.title).toBe(light.warning);
    expect(light.title).not.toBe(light.accent);
    await openMap(page, `${MAP}&ll-fixture-progress=all&ll-theme=dark&ll-flavor=violet`);
    await expect(end1).toHaveAttribute('data-badge-state', 'mastery');
    const dark = await titleColour();
    expect(dark.title).toBe(dark.warning);
    expect(dark.title).not.toBe(dark.success);
    await openMap(page, `${MAP}&ll-fixture-progress=all`);
    await expect(page.locator('[data-chapter-id="ch_fx00e1"] [data-testid="chapter-end"]')).toContainText('精通徽章：記帳員');
    // 最後一章：拱心石換成終點旗
    await expect(page.locator('[data-chapter-id="ch_fx00e1"] .ll-chend__flag')).toHaveCount(1);
    // 不計分關卡在全部完成時是「已讀完」，徽章判定跳過它；它也是最後一次挑戰的關卡，所以是目前關卡（17 第 5.1 節）
    await expect(page.locator('[data-level-id="lv_fx0e0004"] button')).toHaveAttribute('aria-label', /四種觀點，已讀完，建議下一關$/, { timeout: 15_000 });
    await expect(page.locator('[data-level-id="lv_fx0e0004"] .ll-node__read')).toHaveText('已讀完');
    // 精通不另外計數：3 章 3 枚
    await expect(page.getByRole('link', { name: '徽章 3 個，看我的徽章' })).toHaveCount(1);
    await expect(page.getByTestId('badge-toasts')).toHaveCount(0);
  });

  test('取得徽章：一則不打斷的 Toast「取得徽章」，在 sticky 區塊下方，可以關閉；fixture 不寫進度', async ({ page }) => {
    await openMap(page, `${MAP}&ll-fixture-progress=ch1new`);
    const toasts = page.getByTestId('badge-toasts');
    // 標題「取得精通徽章」，第二行是徽章名稱（Toast 的 collect 樣式）
    await expect(toasts.locator('.ll-toast__title')).toHaveText('取得精通徽章');
    await expect(toasts.locator('.ll-toast__body')).toHaveText('開店了');
    await expect(toasts.locator('.ll-chbadge--mastery')).toHaveCount(1);
    // 常駐的 ToastRegion 帶 role="status"；不搶焦點
    await expect(toasts).toHaveAttribute('role', 'status');
    expect(await toasts.evaluate((el) => el.contains(document.activeElement))).toBe(false);
    const [t, s] = await Promise.all([
      toasts.evaluate((el) => el.getBoundingClientRect().top),
      page.locator('.qm-sticky').evaluate((el) => el.getBoundingClientRect().bottom),
    ]);
    expect(t).toBeGreaterThanOrEqual(s);
    await expect(page.locator('[data-chapter-id="ch_fx0001"] [data-testid="chapter-end"]')).toHaveAttribute('data-badge-state', 'mastery');
    await toasts.getByRole('button', { name: '關閉提示' }).click();
    await expect(page.locator('.qm-toasts .ll-toast')).toHaveCount(0);
    // 真正的進度資料庫沒有被 fixture 寫入徽章
    const stored = await page.evaluate(
      () =>
        new Promise<string[]>((resolve) => {
          const req = indexedDB.open('ledgerland');
          req.onerror = () => resolve([]);
          req.onsuccess = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('unlocks')) {
              db.close();
              return resolve([]);
            }
            const r = db.transaction('unlocks').objectStore('unlocks').getAllKeys();
            r.onsuccess = () => {
              db.close();
              resolve((r.result as IDBValidKey[]).map(String));
            };
            r.onerror = () => resolve([]);
          };
        }),
    );
    expect(stored.filter((k) => k.includes('ch_fx'))).toEqual([]);
  });

  test('?from= 的回饋：播放中角色笑眼揮手、頂部星星總數依序滾到新值；播完回到托腮（finding map-5）', async ({ page }) => {
    // 記下播放過程中角色的姿勢與表情、頂部星星的數字（joy 只出現 1 到 2 秒，慢的 CI 來不及在播放中檢查）
    await page.addInitScript(() => {
      const w = window as unknown as { __llLook: string[]; __llHud: string[] };
      w.__llLook = [];
      w.__llHud = [];
      const record = () => {
        const mk = document.querySelector('[data-testid="map-marker"]');
        if (mk) w.__llLook.push(`${mk.getAttribute('data-pose')}/${mk.getAttribute('data-expression')}`);
        const hud = document.querySelector('[data-testid="hud-stars"] .ll-rollnum');
        if (hud) w.__llHud.push(hud.textContent ?? '');
      };
      new MutationObserver(record).observe(document, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['data-pose', 'data-expression', 'data-value'],
      });
    });
    await openMap(page, `${MAP}&from=lv_fx010002`);
    await expect(page).toHaveURL(/ll-fixture=quest$/, { timeout: 10_000 });
    const marker = page.getByTestId('map-marker');
    await expect(marker).toHaveAttribute('data-pose', 'cheek');
    await expect(marker).toHaveAttribute('data-expression', 'smile');
    // 星星總數：fixture default 是 3 + 2 加已下架關卡的 2 = 7
    await expect.poll(() => page.locator('[data-testid="hud-stars"] .ll-rollnum').textContent(), { timeout: 5000 }).toBe('7');
    const look = await page.evaluate(() => (window as unknown as { __llLook: string[] }).__llLook);
    expect(look).toContain('wave/joy');
    const hud = await page.evaluate(() => (window as unknown as { __llHud: string[] }).__llHud.map(Number));
    // 星星點亮前先扣掉這一關的 2 顆（5），再滾到 7：滾動中的數字只增不減、不超過 7。中間的 6 不一定畫得到：
    // Linux 的 WebKit（CI）只在有畫面更新時跑 rAF，600ms 的滾動可能只有兩三個影格（2026-10-26 實測）
    expect(hud).toContain(5);
    expect(hud.indexOf(5)).toBeLessThan(hud.lastIndexOf(7));
    const rolling = hud.slice(hud.indexOf(5), hud.lastIndexOf(7) + 1);
    expect(rolling.every((v, i) => i === 0 || (v >= rolling[i - 1]! && v <= 7))).toBe(true);
  });

  test('?from= 播放中途打開關卡面板或切到清單：角色仍到目前關卡、恢復托腮、徽章 Toast 出現、網址移除 from（finding map-1）', async ({ page }) => {
    // ch1new：第 1 章全部三星但徽章還沒寫入，播完（或被打斷）後才判定新的精通徽章（ch1done 的徽章已經寫入，不會有 Toast）
    await openMap(page, `${MAP}&ll-fixture-progress=ch1new&from=lv_fx010004`);
    // 跨章播放約 2 秒：在 900ms 內點目前關卡（下一章第一關），再用 Escape 關掉面板
    await page.waitForTimeout(300);
    await page.locator('[data-level-id="lv_fx020001"] button').click();
    await expect(page.getByTestId('level-sheet')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page).not.toHaveURL(/from=/, { timeout: 10_000 });
    const marker = page.getByTestId('map-marker');
    await expect(marker).toHaveAttribute('data-pose', 'cheek');
    const [mx, nx] = await Promise.all([
      marker.evaluate((el) => el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2),
      page.locator('[data-level-id="lv_fx020001"] .ll-node__disc').evaluate((el) => el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2),
    ]);
    expect(Math.abs(mx - nx)).toBeLessThan(2);
    await expect(page.getByTestId('badge-toasts')).toContainText('開店了');
    // 播放中切到清單再切回來：角色在目前關卡
    await openMap(page, `${MAP}&ll-fixture-progress=ch1done&from=lv_fx010004`);
    await page.waitForTimeout(300);
    await hudTool(page, 'map-list-toggle', '清單檢視');
    await expect(page.getByTestId('map-list')).toBeVisible();
    await expect(page).not.toHaveURL(/from=/, { timeout: 10_000 });
    await hudTool(page, 'map-list-toggle', '地圖檢視');
    await expect(page.getByTestId('quest-map')).toBeVisible();
    const [mx2, nx2] = await Promise.all([
      page.getByTestId('map-marker').evaluate((el) => el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2),
      page.locator('[data-level-id="lv_fx020001"] .ll-node__disc').evaluate((el) => el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2),
    ]);
    expect(Math.abs(mx2 - nx2)).toBeLessThan(2);
  });

  test('清單檢視下的 ?from= 與 ?chapter=：徽章 Toast 照樣出現、from 移除；?chapter= 展開並捲到那一章（finding map-2）', async ({ page }) => {
    await page.goto(`${MAP}&view=list&ll-fixture-progress=ch1new&from=lv_fx010004`);
    await waitForApp(page);
    await expect(page.getByTestId('map-list')).toBeVisible();
    await expect(page.getByTestId('badge-toasts')).toContainText('開店了');
    await expect(page).not.toHaveURL(/from=/, { timeout: 10_000 });
    // 清單也看得到徽章狀態（可讀名稱）
    await expect(page.locator('[data-chapter-id="ch_fx0001"] .qm-sum__badge')).toContainText('精通徽章「開店了」');
    await page.goto(`${MAP}&view=list&chapter=ch_fx0002`);
    await waitForApp(page);
    const details = page.locator('[data-chapter-id="ch_fx0002"] details');
    await expect(details).toHaveAttribute('open', '');
    await expect.poll(() => inViewport(page, '[data-chapter-id="ch_fx0002"] summary'), { timeout: 10_000 }).toBe(true);
  });

  test('切到清單：捲到目前章節、展開它，焦點在它的 summary；切回地圖時焦點回到目前關卡', async ({ page }) => {
    await openMap(page);
    await hudTool(page, 'map-list-toggle', '清單檢視');
    const summary = page.locator('[data-chapter-id="ch_fx0001"] summary');
    await expect(summary).toBeFocused();
    await expect(page.locator('[data-chapter-id="ch_fx0001"] details')).toHaveAttribute('open', '');
    await expect.poll(() => inViewport(page, '[data-chapter-id="ch_fx0001"] summary')).toBe(true);
    // 切換後 sticky 區塊仍在視窗頂端（焦點不帶動捲動），清單檢視的工具按鈕叫「地圖檢視」、沒有 aria-pressed（站規 2.2.1）
    expect(await page.locator('.qm-sticky').evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBe(0);
    const toggle = page.locator('.ll-hud__tools [data-testid="map-list-toggle"]:not([role="menuitem"])');
    if (await toggle.count()) {
      await expect(toggle).toHaveAttribute('aria-label', '地圖檢視');
      await expect(toggle).not.toHaveAttribute('aria-pressed', /.*/);
    }
    // summary 的章序不換行（圖規 4.11 的 grid）
    const noLines = await page
      .locator('.qm-sum__no')
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)));
    expect(noLines.every((n) => n < 1.5)).toBe(true);
    await hudTool(page, 'map-list-toggle', '地圖檢視');
    await expect(page.locator('[aria-current="step"]')).toBeFocused();
  });

  test('鍵盤：從第一個章節牌 Tab 走完整張地圖，含延伸區的章節牌與六邊形節點', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', '鍵盤走訪只在 Chromium 測');
    await openMap(page);
    await page.locator('[data-chapter-id="ch_fx0001"] .ll-chbanner__link').focus();
    const visited: string[] = [];
    for (let i = 0; i < 16; i++) {
      visited.push(await page.evaluate(() => (document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent ?? '').trim()));
      await page.keyboard.press('Tab');
    }
    expect(visited[0]).toBe('一家小店的帳');
    expect(visited[1]).toMatch(/^第 1 章第 1 關/);
    expect(visited[5]).toBe('三張報表');
    expect(visited[11]).toBe('借貸與分錄');
    expect(visited[12]).toMatch(/^延伸第 1 章第 1 關/);
    expect(visited[14]).toMatch(/^延伸第 1 章第 3 關/);
    expect(visited[15]).toMatch(/^延伸第 1 章第 4 關.*尚未讀/);
    // 焦點可見：六邊形節點聚焦時 outline 在圓盤上
    await page.locator('[data-chapter-id="ch_fx00e1"] .ll-node__btn').last().focus();
    const outline = await page
      .locator('[data-chapter-id="ch_fx00e1"] .ll-node__btn')
      .last()
      .locator('.ll-node__disc')
      .evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).toBe('solid');
  });

  test('節點按下的語言和按鈕相同（站規 0.4 的 A1）：圓盤有 4px 底邊，按下時沉 4px、底邊歸零', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', '滑鼠按住只在 Chromium 測');
    await openMap(page);
    const btn = page.locator('[data-level-id="lv_fx010002"] .ll-node__btn');
    const disc = btn.locator('.ll-node__disc');
    expect(await disc.evaluate((el) => getComputedStyle(el).getPropertyValue('--_d').trim())).toBe('4px');
    const box = (await btn.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect.poll(() => disc.evaluate((el) => getComputedStyle(el).translate)).toMatch(/4px/);
    expect(await disc.evaluate((el) => getComputedStyle(el).getPropertyValue('--_d').trim())).toBe('0px');
    await page.mouse.up();
    await page.keyboard.press('Escape');
  });

  test('?chapter= 讓該章的章節牌完整露出', async ({ page }) => {
    await openMap(page, `${MAP}&chapter=ch_fx0002`);
    await expect.poll(() => inViewport(page, '[data-chapter-id="ch_fx0002"] .qm-ch__banner'), { timeout: 15_000 }).toBe(true);
  });

  test('關卡面板：開啟後焦點在標題、Esc 關閉後焦點回節點、返回也會關閉；只有一顆主按鈕在最下方，沒有「關閉」按鈕', async ({ page }) => {
    await openMap(page);
    const node = page.locator('[aria-current="step"]');
    // 開面板會推一筆歷史紀錄：頁面不得因此重新掛載（布幕只在換路徑時重新掛載），關閉後地圖要停在原本的捲動位置（維護者 2026-10-26）
    const scrollBefore = await page.evaluate(() => window.scrollY);
    const pageEl = await page.evaluateHandle(() => document.querySelector('.ll-page'));
    await node.click();
    const sheet = page.getByTestId('level-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('heading', { level: 2 })).toHaveText('股東權益');
    await expect(sheet.getByRole('heading', { level: 2 })).toBeFocused();
    await expect(sheet).toContainText('第 1 章 一家小店的帳');
    await expect(sheet).toContainText('還沒挑戰過');
    await expect(sheet.locator('code')).toHaveText('fx01 0003');
    await expect(sheet.getByRole('link', { name: '開始' })).toHaveAttribute('href', '/level/lv_fx010003/');
    await expect(sheet.getByRole('link', { name: '章節資訊' })).toHaveAttribute('href', '/chapter/ch_fx0001/');
    // 頭部三欄：圓章、標題與章名、關閉鈕；星星只在「最佳成績」那一行（第 4 輪看圖驗收：頂端的星星和最佳成績重複）
    await expect(sheet.locator('.ll-levelsheet__node')).toHaveCount(1);
    await expect(sheet.locator('.ll-sheet__head').getByRole('img')).toHaveCount(0);
    await expect(sheet.locator('.ll-btn--primary')).toHaveCount(1);
    await expect(sheet.getByRole('button', { name: '關閉', exact: true })).toHaveCount(1);
    expect(await sheet.locator('.ll-sheet__foot > :last-child').textContent()).toContain('開始');
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(node).toBeFocused();
    expect(await page.evaluate((el) => el === document.querySelector('.ll-page'), pageEl)).toBe(true);
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrollBefore)).toBeLessThanOrEqual(2);
    // 已完成的關卡：最佳成績與「再挑戰」
    await page.locator('.ll-node__btn').nth(1).click();
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('link', { name: '再挑戰' })).toHaveCount(1);
    await expect(sheet.locator('.ll-levelsheet__best').getByRole('img', { name: '3 顆星中的 2 顆' })).toHaveCount(1);
    await page.goBack();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/\/play\//);
    // 前一關還沒完成時有建議；右上的 X 關閉
    await page.locator('.ll-node__btn').nth(3).click();
    await expect(sheet).toContainText('建議先完成「股東權益」');
    await sheet.getByRole('button', { name: '關閉', exact: true }).click();
    await expect(sheet).toBeHidden();
  });

  test('清單檢視：切換、不記住偏好（重新整理回到地圖）、每關一列、介紹按鈕開面板、只有建議的下一關是主按鈕', async ({ page }) => {
    await openMap(page);
    await hudTool(page, 'map-list-toggle', '清單檢視');
    await expect(page.getByTestId('map-list')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('ll:map-view'))).toBeNull();
    // 全部章節展開後數關卡列
    // 每展開一章，「還沒展開」的清單就少一個：每次都點第一個，直到全部展開
    const closed = page.locator('.qm-list__chapter:not([open]) summary');
    while ((await closed.count()) > 0) await closed.first().click();
    await expect(page.locator('.ll-levelcard')).toHaveCount(13);
    await expect(page.locator('.ll-levelcard.is-current')).toContainText('股東權益');
    await expect(page.locator('.ll-levelcard .ll-btn--primary')).toHaveCount(1);
    await page
      .locator('.ll-levelcard.is-current')
      .getByRole('button', { name: /^介紹：1-3 股東權益/ })
      .click();
    await expect(page.getByTestId('level-sheet')).toBeVisible();
    await page.keyboard.press('Escape');
    // 「章節資訊」是每章關卡清單最後一列（NavRow）
    await expect(page.locator('[data-chapter-id="ch_fx0001"] .qm-list__info').getByRole('link', { name: /章節資訊/ })).toHaveAttribute(
      'href',
      '/chapter/ch_fx0001/',
    );
    // 檢視不記住（維護者 2026-10-26）：重新整理回到地圖
    await page.reload();
    await waitForApp(page);
    await expect(page.getByTestId('quest-map')).toBeVisible();
    await expect(page.getByTestId('map-list')).toHaveCount(0);
  });

  test('給老師的關卡 QR（維護者 2026-10-26）：面板裡「顯示 QR」畫出這一關正式網址的 QR，下載的 PNG 用掃描端同一套解碼器讀回同一個網址', async ({
    page,
    request,
  }) => {
    await openMap(page);
    await page.locator('[aria-current="step"]').click();
    const sheet = page.getByTestId('level-sheet');
    await expect(sheet).toBeVisible();
    await sheet.getByText('給老師：關卡代號').click();
    await expect(sheet.getByText('或按「顯示 QR」做成 QR')).toBeVisible();
    await sheet.getByRole('button', { name: '顯示 QR' }).click();
    const svg = sheet.locator('.ll-levelqr__svg');
    await expect(svg.locator('path')).toHaveCount(1);
    const url = 'https://ledgerland.swift.moe/level/lv_fx010003/?via=qr';
    await expect(sheet.locator('.ll-levelqr__url')).toHaveText(url);
    const download = page.waitForEvent('download');
    await sheet.getByRole('button', { name: '下載圖片' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('ledgerland-fx010003.png');
    const png = (await import('node:fs')).readFileSync((await file.path())!).toString('base64');
    // 掃描端的解碼器就是 qr-worker 這個 chunk（precache 清單裡找得到檔名），直接拿它解 PNG
    const sw = await (await request.get('/sw.js')).text();
    const worker = /qr-worker-[^"' ]+\.js/.exec(sw)?.[0];
    expect(worker).toBeTruthy();
    const decoded = await page.evaluate(
      async ({ png, worker }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${png}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, c.width, c.height);
        const w = new Worker(`/assets/${worker}`, { type: 'module' });
        return await new Promise<string | null>((resolve) => {
          w.onmessage = (e: MessageEvent<{ text: string | null }>) => resolve(e.data.text);
          w.onerror = () => resolve(null);
          w.postMessage({ id: 1, width: c.width, height: c.height, data: data.data.buffer }, [data.data.buffer]);
          setTimeout(() => resolve(null), 10_000);
        });
      },
      { png, worker },
    );
    expect(decoded).toBe(url);
    await sheet.getByRole('button', { name: '收起 QR' }).click();
    await expect(svg).toHaveCount(0);
  });

  test('關卡代號：格式錯誤、找不到、已下架、找到就導到關卡', async ({ page }) => {
    await openMap(page);
    await hudTool(page, 'map-code', '輸入關卡代號');
    const overlay = page.getByTestId('code-overlay');
    await expect(overlay).toBeVisible();
    const input = overlay.getByRole('textbox', { name: '關卡代號' });
    await expect(input).toBeFocused();
    await input.fill('zz');
    await input.press('Enter');
    await expect(overlay.getByRole('alert')).toContainText('8 個英文字母或數字');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await input.fill('fx0z 9999');
    await input.press('Enter');
    await expect(overlay.getByRole('alert')).toContainText('找不到這個代號');
    await input.fill('fx0r0001');
    await input.press('Enter');
    await expect(overlay.getByRole('alert')).toContainText('已經下架');
    // 已下架（站規 2.2.5）：錯誤句下一行是 secondary sm「前往所屬章節」，送出鈕維持 primary、可以按（第 4 輪看圖驗收：不用停用的虛線框）
    const goChapter = overlay.getByRole('link', { name: '前往所屬章節' });
    await expect(goChapter).toHaveAttribute('href', '/chapter/ch_fx0001/');
    await expect(goChapter).toHaveClass(/ll-btn--secondary/);
    await expect(overlay.getByRole('button', { name: '前往', exact: true })).toBeEnabled();
    await expect(overlay.getByRole('button', { name: '前往', exact: true })).toHaveClass(/ll-btn--primary/);
    await input.fill('LV_FXO1-OOO3');
    await input.press('Enter');
    await expect(page).toHaveURL(/\/level\/lv_fx010003\/$/);
  });

  test('掃描課堂 QR：疊加層先顯示相機說明卡（不呼叫相機），可改輸入代號', async ({ page }) => {
    await openMap(page, `${MAP}&scan=1`);
    const scan = page.getByTestId('scan-overlay');
    await expect(scan).toBeVisible();
    await expect(scan).toContainText('相機只用來辨識 QR');
    await expect(scan.getByRole('button', { name: '開始掃描' })).toBeVisible();
    await expect(page.getByTestId('qr-video')).toHaveCount(0);
    await scan.getByRole('button', { name: '改輸入關卡代號' }).click();
    await expect(scan).toBeHidden();
    await expect(page.getByTestId('code-overlay')).toBeVisible();
    await expect(page).not.toHaveURL(/scan=1/);
  });

  test('?from=：星星點亮、角色走到下一關、播完移除參數並把焦點放在目前關卡', async ({ page }) => {
    await openMap(page, `${MAP}&from=lv_fx010002`);
    await expect(page).toHaveURL(/ll-fixture=quest$/, { timeout: 10_000 });
    await expect(page.locator('[aria-current="step"]')).toBeFocused();
    const marker = page.getByTestId('map-marker');
    const [mx, nodeX] = await Promise.all([
      marker.evaluate((el) => el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2),
      page.locator(`[data-level-id="${CURRENT}"] .ll-node__disc`).evaluate((el) => el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2),
    ]);
    expect(Math.abs(mx - nodeX)).toBeLessThan(2);
    await expect(page.locator('[data-level-id="lv_fx010002"] .ll-node__stars')).toHaveAttribute('data-stars', '2');
  });

  test('?from= 跨章：章末紙籤顯示完成，角色到下一章第一關；減少動態時直接出現', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openMap(page, `${MAP}&ll-fixture-progress=ch1done&from=lv_fx010004`);
    await expect(page).toHaveURL(/ll-fixture-progress=ch1done$/, { timeout: 10_000 });
    await expect(page.locator('[data-chapter-id="ch_fx0001"] [data-testid="chapter-end"]')).toContainText('第 1 章完成');
    await expect(page.locator('[aria-current="step"]')).toHaveAttribute('aria-label', /第 2 章第 1 關/);
    const [my, ny] = await Promise.all([
      page.getByTestId('map-marker').evaluate((el) => el.getBoundingClientRect().bottom),
      page.locator('[aria-current="step"] .ll-node__disc').evaluate((el) => el.getBoundingClientRect().top),
    ]);
    expect(ny - my).toBeGreaterThanOrEqual(0);
    expect(ny - my).toBeLessThan(20);
  });

  test('場景載入失敗：地圖照常可用，不換成錯誤頁（finding map-6）', async ({ page }, info) => {
    test.skip(info.project.name === 'iphone-webkit', '手機沒有兩翼，舊場景不畫，也不載入場景的 chunk');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route('**/assets/scene-*.js', (r) => r.abort());
    await openMap(page, FULL);
    for (const id of ['ch_fu0005', 'ch_fu0008', 'ch_fu0012']) {
      await page.evaluate((id) => document.querySelector(`[data-chapter-id="${id}"]`)?.scrollIntoView({ block: 'center' }), id);
      await page.waitForTimeout(300);
    }
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('闖關');
    await expect(page.locator('.ll-node__btn').first()).toBeAttached();
    await expect(page.getByText('網站已更新')).toHaveCount(0);
  });

  test('章節頁：標題、關卡列表、已下架的關卡、回到地圖', async ({ page }) => {
    await page.goto('/chapter/ch_fx0001/?ll-fixture=quest');
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('一家小店的帳');
    await expect(page.getByTestId('chapter-levels').locator('.ll-levelcard')).toHaveCount(4);
    await expect(page.getByTestId('chapter-levels')).toContainText('認識資產');
    await expect(page.getByTestId('chapter-retired')).toContainText('已下架');
    await expect(page.getByRole('link', { name: /回到闖關地圖/ })).toHaveAttribute('href', /^\/play\//);
    await page.goto('/en/chapter/ch_fx0001/?ll-fixture=quest');
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A small shop and its books');
  });

  // 布幕（維護者 2026-10-26，lib/page-ready.tsx）：點進任何一頁都要直接看到完整的資訊。.ll-page 的 data-ready 翻成 true 的那一刻，
  // 用 MutationObserver 把畫面上的數字與狀態記下來（不是掀開之後才讀，否則補上的資料會混進來）
  const recordReveal = (page: Page) =>
    page.addInitScript(() => {
      const w = window as unknown as { __llReveal: Record<string, unknown> | null };
      w.__llReveal = null;
      const snap = () => {
        const near = (el: Element) => {
          const r = (el.parentElement ?? el).getBoundingClientRect();
          return r.bottom > -innerHeight && r.top < 2 * innerHeight;
        };
        const scenes = [...document.querySelectorAll('svg.qm-scene')];
        w.__llReveal = {
          hud: [...document.querySelectorAll('[data-testid^="hud-"] .ll-rollnum')].map((e) => e.textContent ?? ''),
          hudText: document.querySelector('.ll-hud__stats')?.textContent ?? '',
          skeletons: document.querySelectorAll('.ll-skeleton, [data-testid="map-loading"]').length,
          nearScenes: scenes.filter(near).length,
          nearLoaded: scenes.filter((e) => near(e) && e.getAttribute('data-loaded') === 'true').length,
          stars: document.querySelectorAll('.ll-node__stars').length,
          listTitles: [...document.querySelectorAll('[data-testid="map-list"] .ll-levelcard__title')].map((e) => e.textContent ?? ''),
          h1: document.querySelector('main h1')?.textContent ?? '',
          thumbLoaded: document.querySelector('.ch-thumb__svg')?.getAttribute('data-loaded') ?? null,
          chapterStart: !!document.querySelector('[data-testid="chapter-start"]'),
          chapterLevels: document.querySelector('[data-testid="chapter-levels"]')?.textContent ?? '',
          chapterRetired: !!document.querySelector('[data-testid="chapter-retired"]'),
        };
      };
      new MutationObserver((muts) => {
        if (w.__llReveal) return;
        for (const m of muts) {
          const t = m.target as Element;
          if (t.classList?.contains('ll-page') && t.getAttribute('data-ready') === 'true') {
            snap();
            return;
          }
        }
      }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-ready'] });
    });
  const reveal = async (page: Page) => {
    await page.waitForSelector('.ll-page[data-ready="true"]', { state: 'attached', timeout: 20_000 });
    return page.evaluate(() => (window as unknown as { __llReveal: Record<string, unknown> | null }).__llReveal);
  };

  test('布幕：地圖頁掀開的那一刻 HUD 三個數字已是數字（沒有「…」）、星星籤與第一屏附近的場景都在、沒有骨架', async ({ page }) => {
    await recordReveal(page);
    await page.goto(MAP);
    const r = (await reveal(page)) as { hud: string[]; hudText: string; skeletons: number; nearScenes: number; nearLoaded: number; stars: number };
    expect(r).not.toBeNull();
    // fixture default 的星星總數是 7（3 + 2 加已下架關卡的 2），掀開時就是 7，不是先 0 再滾到 7
    expect(r.hud).toEqual(['7', expect.stringMatching(/^\d+$/), expect.stringMatching(/^\d+$/)]);
    expect(r.hudText).not.toContain('…');
    expect(r.skeletons).toBe(0);
    expect(r.stars).toBeGreaterThan(0);
    expect(r.nearScenes).toBeGreaterThan(0);
    expect(r.nearLoaded).toBe(r.nearScenes);
    await expect(page.locator('[aria-current="step"]')).toHaveCount(1);
    // 正式內容的新使用者：三個數字都是 0，不是「…」
    await page.goto('/play/');
    const real = (await reveal(page)) as { hud: string[]; hudText: string };
    for (const v of real.hud) expect(v).toMatch(/^\d+$/);
    expect(real.hudText).not.toContain('…');
  });

  test('布幕：清單檢視第一次就有關卡名稱，不是先灰底再補字', async ({ page }) => {
    await recordReveal(page);
    await page.goto(`${MAP}&view=list`);
    const r = (await reveal(page)) as { listTitles: string[]; hud: string[]; skeletons: number };
    expect(r.listTitles.length).toBeGreaterThan(0);
    expect(r.listTitles.some((t) => t.includes('認識資產'))).toBe(true);
    expect(r.listTitles.filter((t) => /^第 \d+ 關$/.test(t))).toEqual([]);
    expect(r.hud[0]).toBe('7');
    expect(r.skeletons).toBe(0);
    await expect(page.getByTestId('map-list')).toBeVisible();
  });

  test('布幕：章節頁掀開時標題、進度、主按鈕、關卡名稱、已下架的關卡與場景縮圖都在', async ({ page }) => {
    await recordReveal(page);
    await page.goto('/chapter/ch_fx0001/?ll-fixture=quest');
    const r = (await reveal(page)) as {
      h1: string;
      thumbLoaded: string | null;
      chapterStart: boolean;
      chapterLevels: string;
      chapterRetired: boolean;
      skeletons: number;
    };
    expect(r.h1).toBe('一家小店的帳');
    expect(r.thumbLoaded).toBe('true');
    expect(r.chapterStart).toBe(true);
    expect(r.chapterLevels).toContain('認識資產');
    expect(r.chapterRetired).toBe(true);
    expect(r.skeletons).toBe(0);
    await expect(page.getByTestId('chapter-page')).toBeVisible();
    await expect(page.getByTestId('chapter-progress')).toContainText('關');
  });

  // 第 6 輪看圖驗收：英文 320 寬加 200% 字級時，關卡列的「Suggested next level」膠囊不換行，字伸出膠囊與卡片外框，章節頁與清單檢視水平捲動 14 到 18px（站規 5.1）
  test('文字放大 200%（英文 320 寬）：章節頁三種狀態與清單檢視沒有水平捲動，關卡列的狀態與膠囊都在卡片裡', async ({ page, request }) => {
    const data = await caseData(request);
    await page.addInitScript(() => {
      try {
        localStorage.setItem('ll:locale', 'en');
      } catch {
        /* 無痕模式 */
      }
    });
    for (const [group, name] of [
      ['章節頁', '主線新'],
      ['章節頁', '主線有進度'],
      ['章節頁', '延伸'],
      ['闖關', '清單檢視'],
    ] as const) {
      await openCase(page, caseByName(group, name), { width: 320, prefix: '/en', theme: ALL_THEMES[0]!, data });
      await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), { message: `${group}／${name}` })
        .toBeLessThanOrEqual(0);
      const outside = await page.evaluate(() =>
        [...document.querySelectorAll('.ll-levelcard')].flatMap((card) => {
          const r = card.getBoundingClientRect();
          return [...card.querySelectorAll('.ll-levelcard__title, .ll-levelcard__meta > *')]
            .filter((e) => e.getBoundingClientRect().right > r.right + 0.5)
            .map((e) => e.textContent);
        }),
      );
      expect(outside, `${group}／${name}`).toEqual([]);
    }
  });

  test('正式內容：有關卡就畫地圖，沒有就顯示空狀態', async ({ page, request }) => {
    const manifest = (await (await request.get('/content/content-manifest.json')).json()) as { levels?: unknown[] };
    await page.goto('/play/');
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('闖關');
    if ((manifest.levels ?? []).length > 0) {
      await expect(page.getByTestId('quest-map')).toBeVisible();
      await expect(page.locator('[aria-current="step"]')).toHaveCount(1);
      // 延伸章的章名沒有「延伸：」前綴（眉標已經說明）
      expect(await page.locator('.ll-chbanner__title').allTextContents()).not.toContainEqual(expect.stringContaining('延伸：'));
    } else {
      await expect(page.getByText('關卡準備中')).toBeVisible();
    }
  });

  test('截圖：四個主題與減少動態、海峽、徽章、Toast、清單檢視、關卡面板', async ({ page }, info) => {
    test.skip(info.project.name !== 'iphone-webkit', '截圖只在 iPhone 尺寸拍一次');
    for (const [name, query] of THEMES) {
      await openMap(page, `${MAP}&${query}`);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${SHOTS}/${name}.png` });
      await page.getByTestId('extension-gap').scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${SHOTS}/${name}-extension.png` });
    }
    await openMap(page, `${MAP}&ll-fixture-progress=all&ll-theme=light`);
    await page.locator('[data-chapter-id="ch_fx0001"] [data-testid="chapter-end"] .ll-chend__plaque').scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${SHOTS}/badges-mastery.png` });
    await openMap(page, `${MAP}&ll-fixture-progress=ch1new&ll-theme=dark&ll-flavor=wine`);
    await expect(page.getByTestId('badge-toasts')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/badge-toast.png` });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openMap(page, `${MAP}&ll-theme=light`);
    await page.screenshot({ path: `${SHOTS}/reduced-motion.png` });
    await page.locator('[aria-current="step"]').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/level-sheet.png` });
    await page.keyboard.press('Escape');
    await hudTool(page, 'map-list-toggle', '清單檢視');
    await page.getByTestId('list-extension').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/list-view.png` });
    await openMap(page, `${FULL}&ll-theme=light`);
    await page.screenshot({ path: `${SHOTS}/full-fixture.png` });
  });
});
