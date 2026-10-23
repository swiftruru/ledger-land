// 備份與匯入（06 第 4.6 節；10 M2 完成標準）：匯出備份碼、清掉資料後貼上匯入、預覽摘要與合併；
// 兩個分頁同時開啟時觸發一個假升級，舊分頁顯示 versionchange 橫幅、升級不卡住（06 第 4.3 節）。只在 Chromium 跑（剪貼簿與 IndexedDB 行為穩定）。
import { expect, test, type Page } from '@playwright/test';
import { waitForApp, waitForProgressDb } from './helpers.ts';

const DB = 'ledgerland';

/** 直接寫進進度資料庫（結構由 App 啟動時建立）；資料全部自編 */
async function seed(page: Page): Promise<void> {
  await waitForProgressDb(page, ['attempts', 'levelProgress', 'unlocks']);
  await page.evaluate(
    ({ db }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(db);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const conn = req.result;
          const tx = conn.transaction(['attempts', 'levelProgress', 'unlocks'], 'readwrite');
          tx.objectStore('attempts').put({
            attemptId: 'a_e2e000000001',
            questionId: 'q_7f3k2m9x',
            rev: 1,
            levelId: 'lv_k7m2q9xd',
            answer: 'o_b8k2',
            correct: true,
            answeredAt: '2026-10-20T10:00:00.000Z',
            deviceId: 'd_e2e00001',
            source: 'play',
          });
          tx.objectStore('levelProgress').put({
            levelId: 'lv_k7m2q9xd',
            stars: 2,
            bestScore: 0.8,
            firstCompletedAt: '2026-10-20T10:00:00.000Z',
            lastPlayedAt: '2026-10-20T10:00:00.000Z',
          });
          tx.objectStore('unlocks').put({ id: 'badge:first_level', kind: 'badge', unlockedAt: '2026-10-20T10:00:00.000Z' });
          tx.oncomplete = () => {
            conn.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { db: DB },
  );
}

async function deleteDb(page: Page): Promise<void> {
  await page.evaluate(
    ({ db }) =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(db);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      }),
    { db: DB },
  );
}

test.describe('備份與匯入（06 第 4.6 節）', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', '剪貼簿與多分頁的 IndexedDB 測試只在 Chromium 跑');

  test('匯出備份碼、清掉資料後貼上匯入：預覽摘要正確、合併後不重複', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/me/backup/');
    await waitForApp(page);
    await expect(page.getByTestId('backup-stats')).toHaveText('0 筆作答紀錄、0 個關卡的星星、0 個徽章');
    await seed(page);
    await page.reload();
    await waitForApp(page);
    await expect(page.getByTestId('backup-stats')).toHaveText('1 筆作答紀錄、1 個關卡的星星、1 個徽章');

    await page.getByRole('button', { name: '複製備份碼' }).click();
    await expect(page.getByTestId('export-message')).toContainText('已複製');
    const code = await page.getByTestId('backup-code').inputValue();
    expect(code.startsWith('LL1:')).toBe(true);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
    await expect(page.locator('dd').filter({ hasText: /2026/ }).first()).toBeVisible();

    // 清掉這台裝置的資料，模擬換裝置或主畫面 App 第一次啟動
    await page.evaluate(() => localStorage.clear());
    await deleteDb(page);
    await page.goto('/me/backup/?import=code');
    await waitForApp(page);
    await expect(page.getByTestId('backup-stats')).toHaveText('0 筆作答紀錄、0 個關卡的星星、0 個徽章');
    await expect(page.getByTestId('paste-code')).toBeFocused();
    await page.getByTestId('paste-code').fill(code);
    await page.getByRole('button', { name: '檢查備份碼' }).click();
    await expect(page.getByTestId('import-preview')).toHaveText('將匯入 1 筆作答紀錄、1 個關卡的星星、1 個徽章');
    await expect(page.getByText('來源：瀏覽器分頁')).toBeVisible();
    await page.getByTestId('import-confirm').click();
    await expect(page.getByTestId('import-message')).toContainText('已合併');
    await expect(page.getByTestId('backup-stats')).toHaveText('1 筆作答紀錄、1 個關卡的星星、1 個徽章');

    // 再匯入一次：合併是聯集，數量不變
    await page.getByTestId('paste-code').fill(code);
    await page.getByRole('button', { name: '檢查備份碼' }).click();
    await page.getByTestId('import-confirm').click();
    await expect(page.getByTestId('import-message')).toContainText('已合併');
    await expect(page.getByTestId('backup-stats')).toHaveText('1 筆作答紀錄、1 個關卡的星星、1 個徽章');
  });

  test('貼錯或截斷的備份碼：固定文案、不寫入', async ({ page }) => {
    await page.goto('/me/backup/');
    await waitForApp(page);
    await page.getByTestId('paste-code').fill('XX1:not-a-code');
    await page.getByRole('button', { name: '檢查備份碼' }).click();
    await expect(page.getByTestId('import-error')).toHaveText('這不是 LedgerLand 的備份碼。');
    await page.getByTestId('paste-code').fill('LL1:AAAAAAAA');
    await page.getByRole('button', { name: '檢查備份碼' }).click();
    await expect(page.getByTestId('import-error')).toHaveText('檔案不完整，請重新選擇或重新貼上。');
    await expect(page.getByTestId('import-preview')).toHaveCount(0);
  });

  test('兩個分頁：其中一個觸發假升級，另一個分頁顯示 versionchange 橫幅，升級不卡住', async ({ context }) => {
    const a = await context.newPage();
    await a.goto('/');
    await waitForApp(a);
    const b = await context.newPage();
    await b.goto('/me/');
    await waitForApp(b);
    // 分頁 B 以更高的版本重新開啟資料庫（模擬部署了新版的其他分頁）；App 的連線收到 versionchange 後要先關閉，升級才能完成
    await waitForProgressDb(a);
    await waitForProgressDb(b);
    const upgraded = await b.evaluate(
      ({ db }) =>
        new Promise<number>((resolve, reject) => {
          const req = indexedDB.open(db, 99);
          req.onupgradeneeded = () => {
            /* 不改結構，只升版本 */
          };
          req.onsuccess = () => {
            const v = req.result.version;
            req.result.close();
            resolve(v);
          };
          req.onerror = () => reject(req.error);
          setTimeout(() => reject(new Error('升級被舊連線卡住')), 15_000);
        }),
      { db: DB },
    );
    expect(upgraded).toBe(99);
    await expect(a.getByText('網站已在其他分頁更新，重新整理後才能繼續儲存進度。')).toBeVisible();
    await expect(a.getByRole('button', { name: '重新整理' })).toBeVisible();
  });
});
