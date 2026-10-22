import { expect, test } from '@playwright/test';
import { waitForSw } from './helpers.ts';

test.describe('離線與統計（06 第 3、8.3 節；10 M0b 完成標準）', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Service Worker 的離線測試只在 Chromium 穩定；WebKit 與實機依手動清單');

  test('SW 接管後離線：冷啟動 /en/ 深層連結與名詞頁都能開，離線切換語言正常', async ({ page, context }) => {
    await page.goto('/');
    await waitForSw(page);
    await page.goto('/en/terms/');
    await expect(page.getByTestId('term-list')).toBeVisible();
    await context.setOffline(true);
    await page.goto('/en/terms/tm_h6p2k9wd/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Liabilities');
    // 名詞頁沒有語言切換開關（05 第 8.2 節的位置清單），離線時直接開中文網址
    await page.goto('/terms/tm_h6p2k9wd/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('負債');
    await page.goto('/level/lv_k7m2q9xd/');
    await expect(page.getByRole('button', { name: '確認答案' })).toBeVisible();
    await context.setOffline(false);
  });

  test('統計：非正式 origin 不載入；stub 模式載入腳本但只打 stub 端點；沒有 cookie 與本機儲存的寫入', async ({ page, context }) => {
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    await page.goto('/debug/');
    await page.waitForTimeout(2500);
    expect(requests.some((u) => u.includes('cloudflareinsights.com'))).toBe(false);
    await expect(page.locator('pre').filter({ hasText: '"status": "skipped"' })).toHaveCount(1);
    expect(await context.cookies()).toEqual([]);
    // stub 模式：腳本從統計網域載入（這裡攔截成假腳本，CI 不連外），回報只打同源 stub
    await page.route('https://static.cloudflareinsights.com/beacon.min.js', (route) =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: 'navigator.sendBeacon("https://cloudflareinsights.com/cdn-cgi/rum","{}");' }),
    );
    const beacons: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('rum')) beacons.push(r.url());
    });
    await page.goto('/?ll-analytics=stub');
    await page.waitForTimeout(3000);
    expect(beacons.some((u) => u.startsWith('https://cloudflareinsights.com'))).toBe(false);
    expect(beacons.some((u) => u.includes('/__ll/rum-stub'))).toBe(true);
    expect(await context.cookies()).toEqual([]);
    const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => !k.startsWith('ll:')));
    expect(keys).toEqual([]);
  });

  test('統計腳本被擋下時功能不受影響，也不寫錯誤紀錄', async ({ page }) => {
    await page.route('https://static.cloudflareinsights.com/**', (route) => route.abort());
    await page.goto('/?ll-analytics=stub');
    await page.waitForTimeout(2500);
    await page.getByRole('navigation').getByRole('link', { name: '圖鑑', exact: true }).click();
    await expect(page.getByTestId('term-list')).toBeVisible();
    const errors = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const req = indexedDB.open('ll-errors', 1);
          req.onupgradeneeded = () => req.result.createObjectStore('errors', { autoIncrement: true });
          req.onsuccess = () => {
            const c = req.result.transaction('errors', 'readonly').objectStore('errors').count();
            c.onsuccess = () => resolve(c.result);
            c.onerror = () => resolve(-1);
          };
          req.onerror = () => resolve(-1);
        }),
    );
    expect(errors).toBe(0);
  });
});
