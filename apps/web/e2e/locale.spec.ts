import { expect, test } from '@playwright/test';
import { watchCsp } from './helpers.ts';

test.describe('語言切換（05 第 7.5、8 節；10 M0b 完成標準）', () => {
  test('作答中切換語言：題目、已選選項、計時與捲動位置都保留，網址以 replace 切換，重新整理後記住偏好', async ({ page }) => {
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
    // 用 DOM 的 click 觸發切換：Playwright 的 click 會先把按鈕捲進畫面，捲動位置的斷言就不準（切換開關在頁面上方，捲動 300px 後已在畫面外）
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('.ll-lang [role="radio"][lang="en"]')?.click());
    await expect(page).toHaveURL(/\/en\/level\/lv_h2zx7srx\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('button', { name: 'Check answer' })).toBeEnabled();
    await expect(page.getByRole('radio', { name: /^Assets: / })).toBeChecked();
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Quest' })).toHaveAttribute('href', '/en/play/');
    // M2 起以錨點還原（05 第 8.5 節）；兩種語言的文字高度不同，只斷言沒有被重設到頂端且差距在一段文字內
    const scrollAfter = await page.evaluate(() => window.scrollY);
    expect(scrollAfter).toBeGreaterThan(100);
    expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThan(160);
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
