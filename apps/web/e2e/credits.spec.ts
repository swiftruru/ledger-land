// 幕後頁（02 第 1.1 節的 /credits/）：中英頁面與返回、作者的外部連結列、「我的」的新列；技術棧探索器的選取、搭配高亮、chip 換選取、鍵盤、再按取消；
// 五個彩蛋找齊之後特別徽章寫進進度資料庫、Toast 一次、重新整理後 5／5 不再 Toast；Service Worker 接管後離線也開得了（只在 Chromium）。
// 等待一律用 expect 的 poll／自動重試，不用 requestAnimationFrame 取樣（CI 的 Linux WebKit 只在有畫面更新時才觸發 rAF）。
import { expect, test, type Page } from '@playwright/test';
import { waitForApp, waitForProgressDb, waitForSw } from './helpers.ts';

const BADGE = 'badge:special:credits-eggs';

function readUnlockIds(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const req = indexedDB.open('ledgerland');
        req.onerror = () => resolve([]);
        req.onsuccess = () => {
          const db = req.result;
          const r = db.transaction('unlocks').objectStore('unlocks').getAllKeys();
          r.onsuccess = () => {
            db.close();
            resolve(r.result.map(String));
          };
          r.onerror = () => {
            db.close();
            resolve([]);
          };
        };
      }),
  );
}

function readSetting(page: Page, key: string): Promise<unknown> {
  return page.evaluate(
    (key) =>
      new Promise<unknown>((resolve) => {
        const req = indexedDB.open('ledgerland');
        req.onerror = () => resolve(undefined);
        req.onsuccess = () => {
          const db = req.result;
          const r = db.transaction('settings').objectStore('settings').get(key);
          r.onsuccess = () => {
            db.close();
            resolve((r.result as { value?: unknown } | undefined)?.value);
          };
          r.onerror = () => {
            db.close();
            resolve(undefined);
          };
        };
      }),
    key,
  );
}

test.describe('幕後頁', () => {
  test('從「我的」進入；中英標題；外部連結列；返回「我的」', async ({ page }) => {
    await page.goto('/me/');
    await waitForApp(page);
    await page.getByTestId('me-about').getByRole('link', { name: /幕後/ }).click();
    await expect(page).toHaveURL(/\/credits\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('幕後');
    const links = page.getByTestId('credits-links');
    const site = links.getByRole('link', { name: /個人網站/ });
    await expect(site).toHaveAttribute('href', 'https://swift.moe');
    await expect(site).toContainText('（外部網站）');
    await expect(links.getByRole('link', { name: /GitHub/ })).toHaveAttribute('href', 'https://github.com/swiftruru');
    await expect(page.getByTestId('stack-panel')).toHaveText('點一個方塊，看看它負責什麼。');
    await page.getByRole('link', { name: '回到我的' }).click();
    await expect(page).toHaveURL(/\/me\/$/);
    await page.goto('/en/credits/');
    await waitForApp(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Behind the scenes');
    await expect(page.getByTestId('stack-panel')).toHaveText('Tap a block to see what it does.');
    await expect(page.getByTestId('credits-more').getByRole('link', { name: /About and licences/ })).toHaveAttribute('href', '/en/about/');
  });

  test('探索器：選取、搭配高亮與清單、chip 換選取、鍵盤 Enter、再按取消', async ({ page }) => {
    await page.goto('/credits/');
    await waitForApp(page);
    const panel = page.getByTestId('stack-panel');
    const react = page.getByTestId('stack-node-react');
    await expect(react).toHaveAttribute('aria-pressed', 'false');
    await expect(react).toHaveAttribute('aria-controls', 'll-stack-panel');
    await react.click();
    await expect(react).toHaveAttribute('aria-pressed', 'true');
    await expect(panel.getByRole('heading', { level: 3 })).toContainText('React');
    await expect(panel.getByRole('heading', { level: 3 })).toContainText(/\d+\.\d+\.\d+/);
    // React 的搭配：React Router、Lingui、web-ui、Zustand（雙向算過也是這四個）
    await expect(page.locator('.ll-stack__item[data-related="true"]')).toHaveCount(4);
    await expect(panel.getByTestId('stack-related').getByRole('button')).toHaveCount(4);
    await panel.getByTestId('stack-chip-router').click();
    await expect(page.getByTestId('stack-node-router')).toHaveAttribute('aria-pressed', 'true');
    await expect(react).toHaveAttribute('aria-pressed', 'false');
    await expect(panel.getByRole('heading', { level: 3 })).toContainText('React Router');
    // 鍵盤：原生按鈕，Enter 選取、再按一次取消
    const vite = page.getByTestId('stack-node-vite');
    await vite.focus();
    await page.keyboard.press('Enter');
    await expect(vite).toHaveAttribute('aria-pressed', 'true');
    await expect(panel.getByRole('heading', { level: 3 })).toContainText('Vite');
    await page.keyboard.press('Enter');
    await expect(vite).toHaveAttribute('aria-pressed', 'false');
    await expect(panel).toHaveText('點一個方塊，看看它負責什麼。');
    await expect(page.locator('.ll-stack__item[data-related="true"]')).toHaveCount(0);
  });

  test('五個彩蛋：找齊寫入特別徽章與設定、Toast 一次；重新整理後 5／5 不再 Toast', async ({ page }) => {
    await page.goto('/credits/');
    await waitForApp(page);
    const progress = page.getByTestId('eggs-progress');
    await expect(progress).toContainText('彩蛋 0／5');
    // 1 鈴
    await page.getByTestId('egg-mascot-button').click();
    await expect(page.getByTestId('egg-mascot-text')).toHaveText('鈴：嗨！謝謝你跑來看幕後。');
    await expect(page.getByTestId('egg-mascot').locator('[data-pose="wave"][data-expression="joy"]')).toBeVisible();
    await expect(progress).toContainText('彩蛋 1／5');
    // 2 版本號
    await page.getByTestId('egg-version').click();
    await expect(page.getByTestId('egg-version-text')).toContainText('git commit');
    await expect(progress).toContainText('彩蛋 2／5');
    // 3 三種口味都看過
    await page.getByTestId('stack-node-tokens').click();
    const flavours = page.getByTestId('egg-flavours');
    await flavours.getByText('莓果').click();
    await expect(page.locator('.ll-credits-sample')).toHaveAttribute('data-flavor', 'berry');
    await expect(progress).toContainText('彩蛋 2／5');
    await flavours.getByText('紅酒').click();
    await expect(page.locator('.ll-credits-sample')).toHaveAttribute('data-flavor', 'wine');
    await expect(progress).toContainText('彩蛋 3／5');
    // 4 離線
    await page.getByTestId('stack-node-pwa').click();
    await page.getByTestId('egg-offline').getByRole('button').click();
    await expect(page.getByTestId('egg-offline-result')).toBeVisible();
    await expect(progress).toContainText('彩蛋 4／5');
    await expect(page.getByTestId('credits-toasts')).toBeEmpty();
    // 5 最後一行
    await page.getByTestId('egg-dedication').locator('summary').click();
    await expect(page.getByTestId('egg-dedication')).toHaveAttribute('open', '');
    await expect(progress).toContainText('彩蛋 5／5');
    await expect(progress).toContainText('全部找到了');
    const toasts = page.getByTestId('credits-toasts');
    await expect(toasts).toContainText('取得特別徽章');
    await expect(toasts).toContainText('幕後偵探');
    await waitForProgressDb(page, ['settings', 'unlocks']);
    await expect.poll(() => readUnlockIds(page)).toContain(BADGE);
    await expect.poll(() => readSetting(page, 'creditsEggs')).toEqual(['mascot', 'version', 'flavours', 'offline', 'dedication']);
    // 關掉提示；重新整理：5／5、鈴還在揮手、沒有 Toast
    await toasts.getByRole('button', { name: '關閉提示' }).click();
    await expect(toasts).toBeEmpty();
    await page.reload();
    await waitForApp(page);
    await expect(progress).toContainText('彩蛋 5／5');
    await expect(page.getByTestId('egg-mascot-text')).toBeVisible();
    await expect(page.getByTestId('credits-toasts')).toBeEmpty();
    expect(await readUnlockIds(page)).toContain(BADGE);
  });

  test('Service Worker 接管後離線也開得了，離線彩蛋回「可以」', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Service Worker 的離線測試只在 Chromium 穩定');
    await page.goto('/credits/');
    await waitForSw(page);
    await waitForApp(page);
    await context.setOffline(true);
    await page.goto('/credits/');
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('幕後');
    await page.getByTestId('stack-node-pwa').click();
    await page.getByTestId('egg-offline').getByRole('button').click();
    await expect(page.getByTestId('egg-offline-result')).toContainText('可以');
    await context.setOffline(false);
  });
});
