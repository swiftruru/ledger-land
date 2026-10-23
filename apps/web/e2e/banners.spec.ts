// 頂部提示與橫幅（02 第 6 節、06 第 2.5、4.5、4.7、4.8 節）：用 userAgent 模擬 LINE 內建瀏覽器與 iPhone Safari 分頁，
// 直接寫 settings 模擬「完成一關」看安裝建議，寫一筆到期的錯題看首頁的「今天要複習 N 題」。在 desktop-chromium 與 iphone-webkit 各跑一次。
import { expect, test, type Page } from '@playwright/test';
import { waitForApp, waitForProgressDb } from './helpers.ts';

const DB = 'ledgerland';
const IOS_LINE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/15.0.0';
const IOS_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';

test.skip(({ browserName }) => browserName === 'firefox', '環境模擬只在 Chromium 與 WebKit 跑');

/** 直接寫進進度資料庫的某個 object store（結構由 App 啟動時建立；資料全部自編） */
async function put(page: Page, storeName: string, records: unknown[]): Promise<void> {
  await waitForProgressDb(page, [storeName]);
  await page.evaluate(
    ({ db, storeName, records }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(db);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const conn = req.result;
          const tx = conn.transaction([storeName], 'readwrite');
          for (const r of records) tx.objectStore(storeName).put(r);
          tx.oncomplete = () => {
            conn.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { db: DB, storeName, records },
  );
}

async function readSetting(page: Page, key: string): Promise<unknown> {
  await waitForProgressDb(page);
  return page.evaluate(
    ({ db, key }) =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open(db);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const conn = req.result;
          const get = conn.transaction(['settings']).objectStore('settings').get(key);
          get.onsuccess = () => {
            conn.close();
            resolve((get.result as { value?: unknown } | undefined)?.value ?? null);
          };
          get.onerror = () => reject(get.error);
        };
      }),
    { db: DB, key },
  );
}

/** 模擬 Chromium 送出 beforeinstallprompt（Playwright 的 Chromium 不會真的送） */
async function fireBeforeInstallPrompt(page: Page): Promise<void> {
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt?: () => Promise<void>; userChoice?: Promise<unknown> };
    e.prompt = () => Promise.resolve();
    e.userChoice = Promise.resolve({ outcome: 'dismissed' });
    window.dispatchEvent(e);
  });
}

test.describe('LINE 內建瀏覽器（06 第 4.8 節）', () => {
  test.use({ userAgent: IOS_LINE });

  test('所有頁面頂部看到橫幅與 App 名稱、可複製連結、收合後整個工作階段維持收合', async ({ page, context, browserName }) => {
    if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await waitForApp(page);
    const banner = page.locator('.ll-banner.ll-inapp');
    await expect(banner).toContainText('你正在 LINE 裡開啟');
    await page.getByRole('button', { name: '複製連結' }).click();
    const status = page.getByTestId('inapp-copy-status');
    if (browserName === 'chromium') {
      await expect(status).toContainText('已複製連結');
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
    } else {
      await expect(status).toHaveText(/已複製連結|無法自動複製/);
    }
    // 收合：剩下一個小按鈕；重新整理與換頁都維持收合（sessionStorage）
    await page.getByRole('button', { name: '收合提示' }).click();
    await expect(banner).toHaveCount(0);
    await expect(page.getByTestId('inapp-collapsed')).toBeVisible();
    await page.goto('/me/');
    await waitForApp(page);
    await expect(page.getByTestId('inapp-collapsed')).toBeVisible();
    await page.getByRole('button', { name: '在 LINE 裡開啟：顯示提示' }).click();
    await expect(banner).toBeVisible();
    // 內建瀏覽器不顯示安裝建議（06 第 2.5 節）
    await expect(page.locator('.ll-install-prompt')).toHaveCount(0);
  });
});

test.describe('iPhone Safari 分頁（06 第 4.7 節第 4 步）', () => {
  test.use({ userAgent: IOS_SAFARI });

  test('常駐提示可收合成小按鈕但不會消失，附「匯出到 App」；作答頁同時顯示關卡代號', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    const notice = page.locator('.ll-banner.ll-safari-notice');
    await expect(notice).toContainText('如果你已經加入主畫面，請從主畫面圖示開啟');
    await expect(notice.getByRole('link', { name: '匯出到 App' })).toHaveAttribute('href', '/me/backup/');
    await page.getByRole('button', { name: '收合主畫面提示' }).click();
    await expect(notice).toHaveCount(0);
    const expand = page.getByRole('button', { name: '已加入主畫面？顯示提示' });
    await expect(expand).toBeVisible();
    await page.reload();
    await waitForApp(page);
    await expect(expand).toBeVisible();
    await expand.click();
    await expect(notice).toBeVisible();
    await page.goto('/level/lv_h2zx7srx/');
    await waitForApp(page);
    await expect(notice.locator('.ll-levelcode__code')).toHaveText('h2zx 7srx');
    await expect(notice.getByRole('link', { name: '匯出到 App' })).toHaveAttribute('href', '/me/backup/');
  });
});

test.describe('安裝建議（06 第 2.5 節）', () => {
  test('第一次完成關卡後在首頁出現，關閉後記住不再出現；第一次造訪不出現', async ({ page, browserName }) => {
    // 第一次造訪：即使已完成關卡也不出現
    await page.goto('/');
    await waitForApp(page);
    await put(page, 'settings', [{ key: 'levelsCompleted', value: 1, updatedAt: '2026-10-20T10:00:00.000Z' }]);
    const card = page.locator('.ll-install-prompt');
    await expect(page.getByTestId('home-play')).toBeVisible();
    await expect(card).toHaveCount(0);
    await page.reload();
    await waitForApp(page);
    if (browserName === 'chromium') await fireBeforeInstallPrompt(page);
    await expect(card).toBeVisible();
    await expect(card).toContainText('把會計樂園加到主畫面');
    if (browserName === 'chromium') await expect(card.getByRole('button', { name: '安裝', exact: true })).toBeVisible();
    else {
      await expect(card.getByRole('link', { name: '匯出到 App' })).toHaveAttribute('href', '/me/backup/');
      await expect(card.getByRole('listitem')).toHaveCount(3);
    }
    await card.getByRole('button', { name: '關閉安裝建議，之後再說' }).click();
    await expect(card).toHaveCount(0);
    await expect.poll(() => readSetting(page, 'installPromptDismissed')).toMatchObject({ reason: 'later' });
    await page.reload();
    await waitForApp(page);
    if (browserName === 'chromium') await fireBeforeInstallPrompt(page);
    await expect(page.getByTestId('home-play')).toBeVisible();
    await page.waitForTimeout(800);
    await expect(card).toHaveCount(0);
  });
});

test.describe('首頁的待複習數（03 第 2.10 節）', () => {
  test('沒有到期的題目不顯示；有一題到期顯示「今天要複習 1 題」並連到錯題本', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    await expect(page.getByTestId('home-play')).toHaveAttribute('href', '/play/');
    await expect(page.getByTestId('home-due')).toHaveCount(0);
    const today = await page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    await put(page, 'reviewQueue', [
      {
        questionId: 'q_7f3k2m9x',
        rev: 1,
        lastResult: 'wrong',
        lastAnsweredAt: '2026-10-20T10:00:00.000Z',
        box: 1,
        dueAt: today,
        wrongCount: 1,
        status: 'active',
        addedBy: 'auto',
      },
    ]);
    await page.reload();
    await waitForApp(page);
    const due = page.getByTestId('home-due');
    await expect(due).toHaveText('今天要複習 1 題');
    await expect(due).toHaveAttribute('href', '/review/');
  });
});
