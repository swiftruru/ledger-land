// 設定頁「保護我的進度」被拒時的下一步（06 第 4.5 節，2026-10-27 維護者實測：一般分頁被拒後只說「沒有同意」就停住，使用者不知所措）：
// 一般分頁 persist() 回 false 時，結果句要說加到主畫面再試，旁邊有「看安裝教學」的按鈕連到安裝教學頁；切回分頁時重新問 persisted()。
import { expect, test } from '@playwright/test';
import { waitForApp } from './helpers.ts';

test('一般分頁被拒：說明加到主畫面再試，附安裝教學的按鈕；切回分頁後重新問 persisted()', async ({ page, browserName }) => {
  // 覆寫要放在 StorageManager.prototype 上：WebKit 的 navigator.storage 包裝物件沒有人引用時會被回收，直接掛在實例上的覆寫會跟著消失
  // （2026-10-27 實測：按下按鈕後的 persisted() 已經不是覆寫的版本）。呼叫次數記在 sessionStorage，整頁重載也留得住
  await page.addInitScript(() => {
    if (typeof StorageManager === 'undefined') return;
    Object.defineProperty(StorageManager.prototype, 'persist', { value: async () => false, configurable: true });
    Object.defineProperty(StorageManager.prototype, 'persisted', {
      value: async () => {
        sessionStorage.setItem('__persistedCalls', String(Number(sessionStorage.getItem('__persistedCalls') ?? '0') + 1));
        return false;
      },
      configurable: true,
    });
  });
  await page.goto('/me/settings/');
  await waitForApp(page);
  await expect(page.getByTestId('persist-result')).toHaveText('尚未取得保留許可。');
  const calls = () => page.evaluate(() => Number(sessionStorage.getItem('__persistedCalls') ?? '0'));
  const before = await calls();
  await page.getByRole('button', { name: '保護我的進度' }).click();
  await expect(page.getByTestId('persist-result')).toContainText('加到主畫面');
  const link = page.getByTestId('protect-install-link');
  await expect(link).toHaveAttribute('href', '/install/');
  // 切到背景再切回來：重新問一次 persisted()。假造 document.visibilityState 只在 Chromium 做得到（WebKit 的屬性不可改），
  // WebKit 改驗「離開設定頁再回來」也重新問（元件重新掛載）
  if (browserName === 'chromium') {
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(calls).toBeGreaterThan(before);
  }
  await link.click();
  await expect(page).toHaveURL(/\/install\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('安裝教學');
  const afterLeave = await calls();
  await page.goBack();
  await expect(page.getByRole('button', { name: '保護我的進度' })).toBeVisible();
  await expect.poll(calls).toBeGreaterThan(afterLeave);
});
