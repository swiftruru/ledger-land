import { expect, test } from '@playwright/test';
import { watchCsp } from './helpers.ts';

test.describe('語言切換（05 第 7.5、8 節；10 M0b 完成標準）', () => {
  test('作答中切換語言：題目、已選選項、計時與捲動位置都保留，網址以 replace 切換，重新整理後記住偏好', async ({ page }) => {
    // 這個測試只看語言切換；相機預覽的暫存情境提示要等 storage.estimate 才插入、只在儲存空間小的 iPhone 出現，先標記為已關閉，
    // 讓結果不受執行器環境影響。提示晚插入時題目位置是否保留，由下面的專門測試驗證
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('ll:ephemeral-notice-dismissed', '1');
      } catch {
        /* 沒有 sessionStorage 時照常跑 */
      }
    });
    const assertCsp = await watchCsp(page);
    // 視窗放矮一點，讓作答頁長到可以捲動（桌面視窗下一題就放得下）
    const viewport = page.viewportSize();
    await page.setViewportSize({ width: viewport?.width ?? 1024, height: 420 });
    await page.goto('/level/lv_h2zx7srx/');
    await expect(page.getByRole('button', { name: '確認答案' })).toBeDisabled();
    await page.getByRole('radio', { name: /資產：都是店裡擁有/ }).check();
    await expect(page.getByRole('button', { name: '確認答案' })).toBeEnabled();
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(300);
    const scrollBefore = await page.evaluate(() => window.scrollY);
    expect(scrollBefore).toBeGreaterThan(100);
    // 記下畫面最上方的錨點元素與它在視窗裡的位置（useScrollAnchor 就是這樣還原的）。不能只比 scrollY：上方的提示（例如相機預覽的暫存情境提示
    // 要等 storage.estimate 才插入）可能在切換前後才出現，這時題目留在畫面同一個位置，scrollY 卻會多出提示的高度（CI 的 WebKit 曾差 600 到 740px）
    const anchorBefore = await page.evaluate(() => {
      const top = document.querySelector('.ll-topbar')?.getBoundingClientRect().bottom ?? 0;
      const el = Array.from(document.querySelectorAll<HTMLElement>('[data-ll-anchor]')).find((e) => e.id !== '' && e.getBoundingClientRect().bottom > top);
      return el ? { id: el.id, top: el.getBoundingClientRect().top } : null;
    });
    expect(anchorBefore).not.toBeNull();
    // 用 DOM 的 click 觸發切換：Playwright 的 click 會先把按鈕捲進畫面，捲動位置的斷言就不準（切換開關在頁面上方，捲動 300px 後已在畫面外）
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('.ll-lang [role="radio"][lang="en"]')?.click());
    await expect(page).toHaveURL(/\/en\/level\/lv_h2zx7srx\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('button', { name: 'Check answer' })).toBeEnabled();
    await expect(page.getByRole('radio', { name: /^Assets: / })).toBeChecked();
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Quest' })).toHaveAttribute('href', '/en/play/');
    // M2 起以錨點還原（05 第 8.5 節）：同一個錨點元素留在畫面裡差不多的位置（兩種語言的文字高度不同，容許一段文字的差距），而且沒有被重設到頂端
    const scrollAfter = await page.evaluate(() => window.scrollY);
    expect(scrollAfter).toBeGreaterThan(100);
    const anchorAfterTop = await page.evaluate((id) => document.getElementById(id)?.getBoundingClientRect().top ?? null, anchorBefore!.id);
    expect(anchorAfterTop).not.toBeNull();
    // 失敗時附上診斷：捲動量、各提示的高度、記錄的錨點（CI 的 WebKit 曾差 483px，本機重現不了時靠這個判斷）
    const diag = await page.evaluate(() => ({
      scrollY: window.scrollY,
      banners: Array.from(document.querySelectorAll('main > .ll-banner, main > .ll-safari-notice, main [role="status"], main [role="note"]')).map(
        (el) => `${el.className || el.getAttribute('role')}:${Math.round(el.getBoundingClientRect().height)}`,
      ),
      anchors: Array.from(document.querySelectorAll<HTMLElement>('[data-ll-anchor]')).map((el) => `${el.id}:${Math.round(el.getBoundingClientRect().top)}`),
      session: Object.keys(sessionStorage).filter((k) => k.startsWith('ll')),
    }));
    expect(Math.abs((anchorAfterTop as number) - anchorBefore!.top), `before=${JSON.stringify(anchorBefore)} after=${JSON.stringify(diag)}`).toBeLessThan(160);
    // replace：沒有多一筆瀏覽紀錄
    const historyLength = await page.evaluate(() => history.length);
    expect(historyLength).toBeLessThanOrEqual(2);
    // 偏好：重新整理後仍是英文；根路徑依偏好轉到 /en/
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.goto('/');
    await expect(page).toHaveURL(/\/en\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    // 其他網址不依偏好轉址
    await page.goto('/terms/');
    await expect(page).toHaveURL(/\/terms\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW');
    await assertCsp();
  });

  test('沒有偏好時根路徑維持中文；英文瀏覽器開中文網址只出現一次切換提示', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'en-GB' });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW');
    const suggest = page.getByRole('status').filter({ hasText: 'Prefer English?' });
    await expect(suggest).toBeVisible();
    await suggest.getByRole('button', { name: 'Dismiss' }).click();
    await page.goto('/terms/');
    await expect(page.getByRole('status').filter({ hasText: 'Prefer English?' })).toHaveCount(0);
    await context.close();
  });

  test('作答後回饋面板取得焦點，狀態以文字標示', async ({ page }) => {
    await page.goto('/en/level/lv_h2zx7srx/');
    await page.getByRole('radio', { name: /^Liabilities: / }).check();
    await page.getByRole('button', { name: 'Check answer' }).click();
    await expect(page.getByRole('heading', { name: /Think again/ })).toBeFocused();
    await expect(page.getByText('Correct answer, not selected')).toBeVisible();
    await expect(page.getByText('Not a correct answer, but selected')).toBeVisible();
  });
});

// 上方提示在切換語言之後才插入（06 第 8.2 節）：用 iPhone Safari 的 UA 加上注入的 storage.estimate
// 讓相機預覽的暫存情境提示在每個瀏覽器都穩定地「晚一步」出現（延遲 4 秒、quota 1 GB）；useScrollAnchor 要在使用者捲動前用原錨點再還原，題目留在畫面同一個位置
test.describe('切換語言後上方提示才插入', () => {
  test.use({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  });
  test.skip(({ browserName }) => browserName === 'firefox', '環境模擬只在 Chromium 與 WebKit 跑');

  test('暫存情境提示晚一步插入時，題目仍留在畫面同一個位置', async ({ page }) => {
    await page.addInitScript(() => {
      // WebKit 在初始化腳本階段還沒有 navigator.storage，改從 Navigator.prototype 覆寫 getter 才攔得到
      const slow = () => new Promise<StorageEstimate>((resolve) => setTimeout(() => resolve({ quota: 1024 ** 3, usage: 0 }), 4000));
      Object.defineProperty(Navigator.prototype, 'storage', { configurable: true, get: () => ({ estimate: slow }) });
    });
    const viewport = page.viewportSize();
    await page.setViewportSize({ width: viewport?.width ?? 1024, height: 420 });
    await page.goto('/level/lv_h2zx7srx/');
    await page.getByRole('radio', { name: /資產：都是店裡擁有/ }).check();
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(300);
    const before = await page.evaluate(() => {
      const top = document.querySelector('.ll-topbar')?.getBoundingClientRect().bottom ?? 0;
      const el = Array.from(document.querySelectorAll<HTMLElement>('[data-ll-anchor]')).find((e) => e.id !== '' && e.getBoundingClientRect().bottom > top);
      return el ? { id: el.id, top: el.getBoundingClientRect().top, notice: document.querySelector('.ll-ephemeral-notice') !== null } : null;
    });
    expect(before).not.toBeNull();
    // 切換前提示還沒出現，測的才是「切換之後才插入」
    expect(before!.notice).toBe(false);
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('.ll-lang [role="radio"][lang="en"]')?.click());
    await expect(page).toHaveURL(/\/en\/level\/lv_h2zx7srx\/$/);
    await expect(page.getByRole('button', { name: 'Check answer' })).toBeEnabled();
    // 提示在這之後才出現，等它插入後再量
    await expect(page.locator('.ll-ephemeral-notice')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(200);
    const afterTop = await page.evaluate((id) => document.getElementById(id)?.getBoundingClientRect().top ?? null, before!.id);
    expect(afterTop).not.toBeNull();
    // 本機的 macOS WebKit 與 Chromium 有 scroll anchoring，瀏覽器自己就會補償；CI 的 Linux WebKit 沒有，靠 useScrollAnchor 在使用者捲動前再還原
    expect(
      Math.abs((afterTop as number) - before!.top),
      `before=${JSON.stringify(before)} after=${afterTop} scrollY=${await page.evaluate(() => window.scrollY)}`,
    ).toBeLessThan(160);
  });
});
