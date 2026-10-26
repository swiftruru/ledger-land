// 兩層名詞快照的離線（06 第 3.2 節、08 第 7.3 節）：名詞索引與每一桶完整內容、章節索引都在 precache，
// SW 接管後離線也能開沒看過的名詞頁、在作答頁打開名詞卡讀到定義。
// 名詞的名稱與定義一律從正在服務的快照讀（glossary-data.ts），內容改寫後不必改測試（finding glossary-6）。
import { expect, test } from '@playwright/test';
import { waitForApp, waitForSw } from './helpers.ts';
import { escapeRegExp, termDetailOf, visibleChunk } from './glossary-data.ts';

// 沒有開過的名詞（權責發生制）與作答頁第 1 章第 1 關的名詞卡（資產）；名稱與定義從快照讀
const TERM_UNSEEN = 'tm_05t9wphy';
const TERM_ASSET = 'tm_r4w8n2qe';

test.describe('離線的名詞內容（兩層名詞快照）', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Service Worker 的離線測試只在 Chromium 穩定（offline.spec.ts 同樣的理由）');

  test('離線開沒看過的名詞頁（兩種語言）與作答頁的名詞卡，定義都讀得到', async ({ page, context, request }) => {
    // 期待值在離線之前先讀好
    const [zh, en, asset] = await Promise.all([
      termDetailOf(request, TERM_UNSEEN, 'zh-TW'),
      termDetailOf(request, TERM_UNSEEN, 'en'),
      termDetailOf(request, TERM_ASSET, 'zh-TW'),
    ]);
    await page.goto('/');
    await waitForSw(page);
    await context.setOffline(true);
    // 沒有開過的名詞：內容只可能來自 precache 的分桶檔
    await page.goto(`/terms/${TERM_UNSEEN}/`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(zh.label);
    await expect(page.getByTestId('term-definition')).toContainText(visibleChunk(zh.definition));
    await expect(page.getByTestId('term-alt')).toHaveText(en.label);
    await expect(page.getByTestId('term-alt')).toHaveAttribute('lang', 'en');
    await page.goto(`/en/terms/${TERM_UNSEEN}/`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(en.label);
    await expect(page.getByTestId('term-definition')).toContainText(visibleChunk(en.definition));
    await page.goto('/level/lv_h2zx7srx/');
    await waitForApp(page);
    await page.getByRole('radio', { name: /資產：都是店裡擁有/ }).check();
    await page.getByRole('button', { name: '確認答案' }).click();
    await page
      .getByRole('button', { name: new RegExp(`名詞卡：${escapeRegExp(asset.label)}`) })
      .first()
      .click();
    await expect(page.getByRole('dialog').locator('.ll-sheet__definition')).toContainText(visibleChunk(asset.definition));
    await context.setOffline(false);
  });
});
