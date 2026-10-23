// 更新提示（06 第 3.3 節）：新版 SW 進入 waiting 時，作答頁不出現提示，列表頁才出現；絕不自動重新載入。
// 模擬新部署：直接改 dist/sw.js 的內容（加一行註解），wrangler dev 從磁碟提供新版本；測試結束後還原。
// Playwright 的 page.route 攔不到 Service Worker 腳本本身的請求，所以不能用攔截的方式。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { waitForSw } from './helpers.ts';

const SW_PATH = fileURLToPath(new URL('../dist/sw.js', import.meta.url));

test.skip(({ browserName }) => browserName !== 'chromium', 'SW 更新流程只在 Chromium 專案測');
test.skip(!!process.env.LL_E2E_BASE_URL, '對遠端預覽網址跑時無法改動 sw.js');

test('作答中不出現更新提示，回到首頁才出現；按稍後不重新載入', async ({ page }) => {
  const original = readFileSync(SW_PATH, 'utf8');
  try {
    await page.goto('/level/lv_h2zx7srx/');
    await waitForSw(page);
    writeFileSync(SW_PATH, `${original}\n// v2 ${Date.now()}\n`);
    await page.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      await r?.update();
    });
    await page.waitForFunction(
      async () => {
        const r = await navigator.serviceWorker.getRegistration();
        return !!r?.waiting;
      },
      null,
      { timeout: 30_000 },
    );
    await page.waitForTimeout(500);
    await expect(page.getByText('有新版本可以使用')).toHaveCount(0);
    await page.getByRole('navigation').getByRole('link', { name: '首頁', exact: true }).click();
    await expect(page.getByText('有新版本可以使用')).toBeVisible();
    let reloaded = false;
    page.once('load', () => {
      reloaded = true;
    });
    await page.getByRole('button', { name: '稍後' }).click();
    await page.waitForTimeout(1500);
    expect(reloaded).toBe(false);
    await expect(page.getByText('有新版本可以使用')).toHaveCount(0);
  } finally {
    writeFileSync(SW_PATH, original);
  }
});
