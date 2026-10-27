// 備份與匯入（06 第 4.6 節；10 M2 完成標準；站規 2.10）：匯出備份碼、清掉資料後貼上匯入、預覽摘要（含收藏數）與合併；
// 覆蓋是進階選項裡的 danger 按鈕，先開確認面板（Esc 關閉後焦點回到按鈕），確認後先自動匯出一份目前的進度再覆蓋；
// 選錯檔案的錯誤在「選擇備份檔」下方。兩個分頁同時開啟時觸發一個假升級，舊分頁顯示 versionchange 橫幅、升級不卡住（06 第 4.3 節）。
// 備份頁整頁一次出現（維護者 2026-10-26）：頁面變成看得見的那一刻，三個統計膠囊與「上次匯出」就已經是最後的值，沒有「…」或骨架。
// 只在 Chromium 跑（剪貼簿與 IndexedDB 行為穩定）。
import { expect, test, type Page } from '@playwright/test';
import { waitForApp, waitForProgressDb } from './helpers.ts';

/** 頁面布幕拉開的那一刻（.ll-page[data-ready="true"] 第一次出現）統計膠囊顯示的字與「上次匯出」那一格的 HTML；在布幕拉開前由 MutationObserver 攔下 */
const PAGE_READY = '.ll-page[data-ready="true"]';
async function statsAtReveal(page: Page): Promise<{ chips: string[]; lastExport: string }> {
  return page.evaluate(
    ({ selector }) =>
      new Promise((resolve) => {
        const read = () => ({
          chips: [...document.querySelectorAll('[data-testid^="backup-stat-"] .ll-sr-only')].map((el) => el.textContent ?? ''),
          lastExport: document.querySelector('.ll-backup__dl dd')?.innerHTML ?? '',
        });
        if (document.querySelector(selector)) {
          resolve(read());
          return;
        }
        const mo = new MutationObserver(() => {
          if (!document.querySelector(selector)) return;
          mo.disconnect();
          resolve(read());
        });
        mo.observe(document, { attributes: true, childList: true, subtree: true, attributeFilter: ['data-ready'] });
      }),
    { selector: PAGE_READY },
  );
}

const DB = 'ledgerland';
/** 收藏用的取捨題（第 3 關，glossary.spec.ts 的 JUDGMENT_QUESTION） */
const FAVOURITE_QUESTION = 'q_ytrpj345';

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

/** 狀態卡的三個統計膠囊（作答紀錄、有星星的關卡、徽章）：比對膠囊的可讀名稱（畫面上的數字對螢幕閱讀器隱藏） */
async function expectStats(page: Page, n: number): Promise<void> {
  await expect(page.getByTestId('backup-stat-attempts').locator('.ll-sr-only')).toHaveText(`${n} 筆作答紀錄`);
  await expect(page.getByTestId('backup-stat-levels').locator('.ll-sr-only')).toHaveText(`${n} 個有星星的關卡`);
  await expect(page.getByTestId('backup-stat-badges').locator('.ll-sr-only')).toHaveText(`${n} 個徽章`);
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
    await expectStats(page, 0);
    await seed(page);
    await page.reload();
    await waitForApp(page);
    await expectStats(page, 1);

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
    await expectStats(page, 0);
    await expect(page.getByTestId('paste-code')).toBeFocused();
    await page.getByTestId('paste-code').fill(code);
    await page.getByRole('button', { name: '檢查備份碼' }).click();
    await expect(page.getByTestId('import-preview')).toHaveText('將匯入 1 筆作答紀錄、1 個關卡的星星、1 個徽章、0 題收藏');
    await expect(page.getByText('來源：瀏覽器分頁')).toBeVisible();
    // 預覽出現時焦點移到預覽卡的標題；「合併匯入」是這一步唯一的主按鈕，匯出降成 secondary（第 1 輪看圖驗收）
    await expect(page.getByRole('heading', { level: 2, name: '預覽' })).toBeFocused();
    await expect(page.getByTestId('import-confirm')).toHaveClass(/\bll-btn--primary\b/);
    await expect(page.getByRole('button', { name: '存成備份檔' })).toHaveClass(/\bll-btn--secondary\b/);
    await page.getByTestId('import-confirm').click();
    await expect(page.getByTestId('import-message')).toContainText('已合併');
    await expectStats(page, 1);

    // 再匯入一次：合併是聯集，數量不變
    await page.getByTestId('paste-code').fill(code);
    await page.getByRole('button', { name: '檢查備份碼' }).click();
    await page.getByTestId('import-confirm').click();
    await expect(page.getByTestId('import-message')).toContainText('已合併');
    await expectStats(page, 1);
  });

  test('收藏跟著備份走：匯出、清掉資料、用預設選項匯入後，「我的」仍列出收藏的題目（finding core-2）', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/me/backup/');
    await waitForApp(page);
    await waitForProgressDb(page, ['settings']);
    await page.evaluate(
      ({ db, question }) =>
        new Promise<void>((resolve, reject) => {
          const req = indexedDB.open(db);
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const conn = req.result;
            const tx = conn.transaction(['settings'], 'readwrite');
            tx.objectStore('settings').put({ key: 'favourites', value: [question], updatedAt: '2026-10-24T10:00:00.000+08:00' });
            tx.oncomplete = () => {
              conn.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
        }),
      { db: DB, question: FAVOURITE_QUESTION },
    );
    await page.reload();
    await waitForApp(page);
    await page.getByRole('button', { name: '複製備份碼' }).click();
    await expect(page.getByTestId('export-message')).toContainText('已複製');
    const code = await page.getByTestId('backup-code').inputValue();

    await page.evaluate(() => localStorage.clear());
    await deleteDb(page);
    await page.goto('/me/backup/?import=code');
    await waitForApp(page);
    await page.getByTestId('paste-code').fill(code);
    await page.getByRole('button', { name: '檢查備份碼' }).click();
    await expect(page.getByTestId('import-preview')).toContainText('1 題收藏');
    // 預設選項（不勾「也套用語言與計時設定」）：收藏是學習資料，照樣合併
    await page.getByTestId('import-confirm').click();
    await expect(page.getByTestId('import-message')).toContainText('已合併');

    await page.goto('/me/');
    await waitForApp(page);
    await expect(page.getByTestId('favourites').locator(`[data-question-id="${FAVOURITE_QUESTION}"]`)).toBeVisible();
  });

  test('整頁一次出現：布幕拉開時三個統計膠囊已是最後的數字、「上次匯出」不是骨架（有進度的資料庫）', async ({ page }) => {
    await page.goto('/me/backup/');
    await waitForApp(page);
    await seed(page);
    // 重新整理後在 App 掛載前就開始攔：先把觀察器排進去，再等頁面載入（goto 回來時頁面可能已經齊了，statsAtReveal 會直接讀）
    const reveal = page.reload().then(() => statsAtReveal(page));
    const at = await reveal;
    expect(at.chips).toEqual(['1 筆作答紀錄', '1 個有星星的關卡', '1 個徽章']);
    expect(at.chips.join('')).not.toContain('…');
    expect(at.lastExport).not.toContain('ll-skeleton');
    expect(at.lastExport).toContain('還沒備份');
    await expectStats(page, 1);
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

  test('覆蓋現有進度：進階選項裡的 danger 按鈕先開確認面板，確認後先匯出一份目前的進度再覆蓋', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/me/backup/');
    await waitForApp(page);
    await seed(page);
    await page.reload();
    await waitForApp(page);
    await page.getByRole('button', { name: '複製備份碼' }).click();
    await expect(page.getByTestId('export-message')).toContainText('已複製');
    const code = await page.getByTestId('backup-code').inputValue();

    await page.getByTestId('paste-code').fill(code);
    await page.getByRole('button', { name: '檢查備份碼' }).click();
    await expect(page.getByTestId('import-preview')).toBeVisible();
    // 覆蓋收在進階選項裡；按下先開確認面板，Esc 關閉後焦點回到覆蓋按鈕
    await page.getByText('進階選項').click();
    const replace = page.getByTestId('import-replace');
    await replace.click();
    const dialog = page.getByRole('dialog', { name: '要覆蓋現有進度嗎？' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: '要覆蓋現有進度嗎？' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(replace).toBeFocused();

    await replace.click();
    const download = page.waitForEvent('download');
    await dialog.getByRole('button', { name: '覆蓋現有進度' }).click();
    expect((await download).suggestedFilename()).toMatch(/^ledgerland-backup-\d{8}\.json$/);
    await expect(page.getByTestId('import-message')).toContainText('已覆蓋');
    await expect(dialog).toBeHidden();
    await expectStats(page, 1);
  });

  test('選錯檔案：錯誤顯示在「選擇備份檔」下方，不出現預覽', async ({ page }) => {
    await page.goto('/me/backup/?import=file');
    await waitForApp(page);
    await expect(page.getByRole('button', { name: '選擇備份檔' })).toBeFocused();
    await page.getByTestId('import-file').setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
    await expect(page.getByTestId('import-error-file')).toHaveText('格式不是 LedgerLand 備份。');
    await expect(page.getByRole('button', { name: '選擇備份檔' })).toHaveAttribute('aria-describedby', /.+/);
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
