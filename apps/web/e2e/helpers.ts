import { expect, type Page } from '@playwright/test';

/** 監聽 CSP 違規（09 第 10.2 節）：頁面建立後立刻掛上，測試結尾斷言為空 */
export async function watchCsp(page: Page): Promise<() => Promise<void>> {
  await page.addInitScript(() => {
    (window as unknown as { __e2eCsp: string[] }).__e2eCsp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { __e2eCsp: string[] }).__e2eCsp.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  return async () => {
    const list = await page.evaluate(() => (window as unknown as { __e2eCsp: string[] }).__e2eCsp ?? []);
    expect(list, 'CSP 違規').toEqual([]);
  };
}

/** 等到 Service Worker 安裝完成並接管頁面（離線測試的前置）：prompt 模式不 clientsClaim，第一次載入的頁面要重新整理一次才受控 */
export async function waitForSw(page: Page): Promise<void> {
  await page.waitForFunction(() => navigator.serviceWorker?.ready.then(() => true), null, { timeout: 30_000 });
  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated', null, { timeout: 30_000 });
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 30_000 });
}

/** 等 React 掛載完成（main 裡出現 h1）。殼層的連結在掛載前是一般連結，按 Enter 會整頁載入，鍵盤測試要先等這一步 */
export async function waitForApp(page: Page): Promise<void> {
  await page.locator('main h1').first().waitFor();
}
