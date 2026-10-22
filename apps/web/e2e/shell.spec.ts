import { expect, test } from '@playwright/test';
import { waitForApp, watchCsp } from './helpers.ts';

test.describe('殼層與深層連結（10 M0b 完成標準）', () => {
  test('中文首頁：殼層、Tab bar、html lang、沒有 CSP 違規', async ({ page }) => {
    const assertCsp = await watchCsp(page);
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
    expect(res?.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res?.headers()['referrer-policy']).toBe('no-referrer');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW');
    await expect(page.getByRole('navigation', { name: '主要導覽' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: '主要導覽' }).getByRole('link')).toHaveCount(5);
    await expect(page.getByRole('link', { name: '首頁' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('LedgerLand');
    await assertCsp();
  });

  test('/en/ 深層連結直接開啟：200、殼層、首次繪製前就是英文', async ({ page }) => {
    const assertCsp = await watchCsp(page);
    const res = await page.goto('/en/terms/tm_r4w8n2qe/');
    expect(res?.status()).toBe(200);
    expect(res?.headers()['content-security-policy']).toBeTruthy();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/en/terms/');
    await expect(nav.getByRole('link', { name: 'Terms' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Assets');
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toHaveCount(1);
    await assertCsp();
  });

  test('大小寫與斜線正規化：/EN/Terms → /en/terms/；/zh-tw/ 前綴去掉', async ({ page }) => {
    await page.goto('/EN/Terms');
    await expect(page).toHaveURL(/\/en\/terms\/$/);
    await page.goto('/zh-tw/terms/tm_r4w8n2qe');
    await expect(page).toHaveURL(/\/terms\/tm_r4w8n2qe\/$/);
  });

  test('不存在的 /assets/ 檔案回 404、no-store（不回殼層）', async ({ request }) => {
    const res = await request.get('/assets/index-doesnotexist.js', { headers: { 'sec-fetch-dest': 'script' } });
    expect(res.status()).toBe(404);
    expect(res.headers()['cache-control']).toBe('no-store');
  });

  test('未知路徑回殼層 200，頁面顯示找不到並加 noindex', async ({ page }) => {
    const res = await page.goto('/no-such-page/');
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('找不到這一頁');
    await expect(page.locator('meta[name="robots"][data-ll]')).toHaveAttribute('content', 'noindex');
  });

  test('sw.js 與 manifest 存在，manifest 的 id 固定', async ({ request }) => {
    const sw = await request.get('/sw.js');
    expect(sw.status()).toBe(200);
    const m = await request.get('/manifest.webmanifest');
    expect(m.status()).toBe(200);
    const json = (await m.json()) as { id: string; start_url: string; scope: string };
    expect(json.id).toBe('/');
    expect(json.start_url).toBe('/');
    expect(json.scope).toBe('/');
  });

  test('index.html 沒有 style 屬性，統計腳本不在殼層裡', async ({ request }) => {
    const html = await (await request.get('/')).text();
    expect(html).not.toMatch(/\sstyle=/);
    expect(html).not.toContain('cloudflareinsights');
    expect((html.match(/<script(?![^>]*src=)/g) ?? []).length).toBe(2);
  });
});

test.describe('純鍵盤操作（10 第 4 節第 2 項）', () => {
  test('Tab 鍵先到跳到主要內容，換頁後焦點移到標題', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit 的 Tab 鍵焦點順序依系統設定，實機清單另外檢查');
    await page.goto('/');
    await waitForApp(page);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: '跳到主要內容' })).toBeFocused();
    await page.getByRole('navigation').getByRole('link', { name: '圖鑑', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/terms\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  });
});
