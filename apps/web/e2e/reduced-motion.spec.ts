// 減少動態效果（10 第 4 節第 4 項）：Tab bar 選取指示直接跳到新位置、不收合；截圖由 CI 的 artifact 保留供比對
import { expect, test } from '@playwright/test';

test('減少動態：切換 Tab 時鏡片沒有進行中的動畫，捲動時不收合', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: '圖鑑', exact: true }).click();
  await expect(page).toHaveURL(/\/terms\/$/);
  const state = await page.evaluate(() => document.getElementById('ll-tabbar')?.className ?? '');
  expect(state).not.toContain('is-moving');
  expect(state).not.toContain('is-lifted');
  await page.goto('/level/lv_h2zx7srx/');
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(300);
  const collapsed = await page.evaluate(() => document.getElementById('ll-tabbar')?.classList.contains('is-collapsed'));
  expect(collapsed).toBe(false);
  await page.screenshot({ path: 'test-results/reduced-motion-level.png', fullPage: false });
});
