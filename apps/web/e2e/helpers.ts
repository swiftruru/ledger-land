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
  // 頁面布幕（lib/page-ready.tsx）：資料齊了才整頁出現，所以等「h1 已掛上」且「布幕掀開或 0.7 秒後的載入圈出現」（載入中狀態只有載入圈），
  // 再等淡入動畫播完（axe 的對比與焦點外框的檢查不能量到半透明的那幾格）
  await page.locator('main h1').first().waitFor({ state: 'attached' });
  await page.locator('.ll-page[data-ready="true"], .ll-page__wait').first().waitFor({ state: 'attached' });
  // 只等布幕的淡入（ll-page-in）：地圖節點的呼吸、載入圈是無限循環的動畫，finished 永遠不會 resolve
  await page
    .evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a instanceof CSSAnimation && a.animationName === 'll-page-in')
          .map((a) => a.finished.catch(() => undefined)),
      ),
    )
    .catch(() => undefined);
}

/** 等 App 把進度資料庫的結構建好（App 在第一次繪製送出之後約半秒才開啟資料庫，apps/web/src/lib/idle.ts）：
 * 測試要直接讀寫 IndexedDB 之前先等這一步，否則測試自己 open 會建出沒有 object store 的空資料庫，App 之後開到空資料庫就退成記憶體模式。
 * 資料庫還不存在時不 open（避免搶先建立）。注意 page.waitForFunction 不會等 async 函式回傳的 Promise（Promise 物件本身就是 truthy，會立刻結束），
 * 所以這裡用 page.evaluate 輪詢。 */
export async function waitForProgressDb(page: Page, stores: readonly string[] = ['settings']): Promise<void> {
  const deadline = Date.now() + 30_000;
  for (;;) {
    const ok = await page.evaluate(
      async ({ db, stores }) => {
        if (!(await indexedDB.databases()).some((d) => d.name === db)) return false;
        return new Promise<boolean>((resolve) => {
          const req = indexedDB.open(db);
          req.onerror = () => resolve(false);
          req.onblocked = () => resolve(false);
          req.onsuccess = () => {
            const conn = req.result;
            const ok = stores.every((s) => conn.objectStoreNames.contains(s));
            conn.close();
            resolve(ok);
          };
        });
      },
      { db: 'ledgerland', stores: [...stores] },
    );
    if (ok) return;
    if (Date.now() > deadline) throw new Error('waitForProgressDb：30 秒內 App 沒有建好進度資料庫');
    await page.waitForTimeout(50);
  }
}
