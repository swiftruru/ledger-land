// 啟動畫面（06 第 2.4 節；shell/launch-screen.ts）：App 模式冷啟動時殼層的 #ll-launch 蓋住整頁，至少停到 1.5 秒、第一頁掀開後淡出；
// 瀏覽器模式永遠不顯示。App 模式用 navigator.standalone 模擬（helpers.ts 的 emulateAppMode）。
// 時間用頁面裡的觀察器記錄（第一次看到、離場、移除的時刻），再從紀錄斷言：測試程式自己的等待快慢（慢的執行器、兩個 worker）不影響結果。
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { emulateAppMode, waitForApp, watchCsp } from './helpers.ts';

interface LaunchLog {
  seenAt: number | null;
  displayAtFirst: string | null;
  transitionAtFirst: string | null;
  leave: boolean;
  removedAt: number | null;
  transitions: number;
}

/** 在 init script 階段 document.documentElement 還不存在，觀察 document 本身 */
async function logLaunch(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log: LaunchLog = { seenAt: null, displayAtFirst: null, transitionAtFirst: null, leave: false, removedAt: null, transitions: 0 };
    (window as unknown as { __launch: LaunchLog }).__launch = log;
    document.addEventListener('transitionstart', (e) => {
      if ((e.target as Element | null)?.id === 'll-launch') log.transitions++;
    });
    new MutationObserver(() => {
      const el = document.getElementById('ll-launch');
      if (el) {
        if (log.seenAt === null) {
          log.seenAt = performance.now();
          const cs = getComputedStyle(el);
          log.displayAtFirst = cs.display;
          log.transitionAtFirst = cs.transitionDuration;
        }
        if (el.dataset.leave !== undefined) log.leave = true;
      } else if (log.seenAt !== null && log.removedAt === null) log.removedAt = performance.now();
    }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-leave'] });
  });
}

const readLog = (page: Page) => page.evaluate(() => (window as unknown as { __launch: LaunchLog }).__launch);

test.describe('啟動畫面：App 模式', () => {
  test('從第一次繪製就蓋住整頁含 Tab bar，至少 1.5 秒後淡出並移除，底下的頁面已經掀開', async ({ page }) => {
    const assertCsp = await watchCsp(page);
    await emulateAppMode(page);
    await logLaunch(page);
    await page.goto('/', { waitUntil: 'commit' });
    const launch = page.locator('#ll-launch');
    await expect(launch).toBeVisible();
    await expect(launch).toHaveAttribute('aria-hidden', 'true');
    // 還在、還沒離場的時候，畫面中央與底部中央（Tab bar 的位置；樣式表還沒載入時 nav 的外框不可靠，所以用視窗座標）按到的都是啟動畫面
    //（離場中 pointer-events 是 none，就不量）
    const covers = await page.evaluate(() => {
      const el = document.getElementById('ll-launch');
      if (!el || el.dataset.leave !== undefined) return 'gone';
      const points: [number, number][] = [
        [innerWidth / 2, innerHeight / 2],
        [innerWidth / 2, innerHeight - 24],
      ];
      for (const [x, y] of points) {
        const hit = document.elementFromPoint(x, y);
        if (!hit?.closest('#ll-launch')) return `exposed at ${x},${y}: ${hit ? `${hit.tagName}#${hit.id}` : 'null'}`;
      }
      return 'covers';
    });
    expect(covers === 'covers' || covers === 'gone', covers).toBe(true);
    await expect(launch).toHaveCount(0, { timeout: 8000 });
    const log = await readLog(page);
    expect(log.displayAtFirst).toBe('block');
    expect(log.leave).toBe(true);
    expect(log.removedAt).not.toBeNull();
    expect(log.removedAt!).toBeGreaterThanOrEqual(1500);
    expect(log.removedAt!).toBeLessThan(6000);
    await expect(page.locator('main h1').first()).toBeVisible();
    await expect(page.locator('.ll-page[data-ready="true"]')).toHaveCount(1);
    await assertCsp();
  });

  test('React 還沒載入時啟動畫面不消失；固定定位、在最上層、底色依主題與風味；axe 沒有問題', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'route 延遲在 Chromium 上最穩');
    await emulateAppMode(page);
    // 把 App 的進入點延後 3 秒：這段時間只有殼層，啟動畫面要一直在（goto 只等 commit，不然會等到模組腳本載完）
    await page.route('**/assets/index-*.js', async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.continue();
    });
    await page.goto('/?ll-theme=dark&ll-flavor=berry', { waitUntil: 'commit' });
    const launch = page.locator('#ll-launch');
    await expect(launch).toBeVisible();
    await page.waitForTimeout(1800);
    await expect(launch).toBeVisible();
    const style = await launch.evaluate((el) => {
      const s = getComputedStyle(el);
      return { position: s.position, z: s.zIndex, bg: s.backgroundColor, color: s.color, leave: el.dataset.leave };
    });
    expect(style.position).toBe('fixed');
    expect(style.z).toBe('200');
    expect(style.bg).toBe('rgb(23, 16, 24)');
    expect(style.color).toBe('rgb(248, 248, 242)');
    expect(style.leave).toBeUndefined();
    // React 還沒掛載，整頁沒有 main 與 h1，只檢查啟動畫面這一塊（整頁的 axe 在 axe.spec）
    const axe = await new AxeBuilder({ page }).include('#ll-launch').analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    await expect(launch).toHaveCount(0, { timeout: 10_000 });
    await page.goto('/?ll-theme=light', { waitUntil: 'commit' });
    await expect(page.locator('#ll-launch')).toHaveCSS('background-color', 'rgb(252, 248, 240)');
    await expect(page.locator('#ll-launch')).toHaveCSS('color', 'rgb(41, 38, 34)');
  });
});

test.describe('啟動畫面：瀏覽器模式', () => {
  test('標記在 HTML 裡但 display 是 none，App 掛載時就移除', async ({ page, request }) => {
    const html = await (await request.get('/')).text();
    expect(html).toContain('<div id="ll-launch" aria-hidden="true">');
    await logLaunch(page);
    await page.goto('/');
    await waitForApp(page);
    const log = await readLog(page);
    expect(log.seenAt).not.toBeNull();
    expect(log.displayAtFirst).toBe('none');
    expect(log.leave).toBe(false);
    expect(log.removedAt).not.toBeNull();
    await expect(page.locator('#ll-launch')).toHaveCount(0);
  });
});

test.describe('啟動畫面：減少動態', () => {
  test.use({ reducedMotion: 'reduce' });

  test('沒有轉場，到時間直接移除', async ({ page }) => {
    await emulateAppMode(page);
    await logLaunch(page);
    await page.goto('/', { waitUntil: 'commit' });
    await expect(page.locator('#ll-launch')).toHaveCount(0, { timeout: 8000 });
    const log = await readLog(page);
    expect(log.displayAtFirst).toBe('block');
    expect(log.transitionAtFirst).toBe('0s');
    expect(log.leave).toBe(false);
    expect(log.transitions).toBe(0);
    expect(log.removedAt!).toBeGreaterThanOrEqual(1500);
  });
});
