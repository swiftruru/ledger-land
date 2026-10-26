// 第一次繪製的資料與預先載入（06 第 8.2 節、08 第 7.3 節、14 第 5.2 節的 LCP 收回）：
// boot 腳本依路徑插入頁面 chunk、訊息 catalog 與內容快照的預先載入（建置後由 tools/postbuild.mjs 填表），CSP 不擋；
// 名詞分兩層：作答頁只讀名詞索引，打開名詞卡才讀那一桶完整內容；名詞頁讀兩種語言的那一桶（定義引用其他名詞或頁尾有相關名詞時，名詞索引也和內容一起等，
// 2026-10-26 起整頁資料齊了才一次出現，不再把相關名詞的名稱延到第一次繪製之後）；報表卡片的一句說明來自完整內容檔。
// 名詞的名稱與定義一律從正在服務的快照讀（glossary-data.ts），內容改寫後不必改測試（finding glossary-6）。
import { expect, test, type Page } from '@playwright/test';
import { waitForApp, watchCsp } from './helpers.ts';
import { escapeRegExp, termBucketPath, termDetailOf, termIndexOf, visibleChunk } from './glossary-data.ts';

const LEVEL_1 = 'lv_h2zx7srx';
const LEVEL_PICK_STATEMENT = 'lv_kfcqkmya';
const TERM_ASSET = 'tm_r4w8n2qe';

/** boot 腳本插入的預先載入：modulepreload 不帶 crossorigin（Vite 動態 import 時自己補的 modulepreload 帶 crossorigin，例如第一次繪製後才載入的進度 runtime，不算） */
async function preloads(page: Page): Promise<{ rel: string; as: string; href: string; crossOrigin: string | null }[]> {
  const all = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLLinkElement>('head link[rel="modulepreload"], head link[rel="preload"]')].map((l) => ({
      rel: l.rel,
      as: l.as,
      href: new URL(l.href).pathname,
      crossOrigin: l.crossOrigin,
    })),
  );
  return all.filter((l) => l.rel !== 'modulepreload' || l.crossOrigin === null);
}

/** 記下所有內容快照的請求路徑 */
function contentRequests(page: Page): string[] {
  const list: string[] = [];
  page.on('request', (r) => {
    const path = new URL(r.url()).pathname;
    if (path.startsWith('/content/')) list.push(path);
  });
  return list;
}

test.describe('依路徑預先載入與兩層名詞快照', () => {
  test('作答頁：預先載入 Level chunk、zh-TW catalog、關卡檔與名詞索引（as=fetch 帶 crossorigin），不讀完整名詞內容；CSP 沒有違規', async ({ page }) => {
    const csp = await watchCsp(page);
    const requests = contentRequests(page);
    await page.goto(`/level/${LEVEL_1}/`);
    await waitForApp(page);
    const links = await preloads(page);
    expect(links.some((l) => l.rel === 'modulepreload' && /^\/assets\/Level-[^/]+\.js$/.test(l.href))).toBe(true);
    expect(links.some((l) => l.rel === 'modulepreload' && /^\/assets\/catalog-zh-TW-[^/]+\.js$/.test(l.href))).toBe(true);
    expect(links.some((l) => l.rel === 'modulepreload' && /catalog-en-/.test(l.href))).toBe(false);
    const level = links.find((l) => l.rel === 'preload' && l.href.startsWith(`/content/zh-TW/${LEVEL_1}.`));
    expect(level).toMatchObject({ as: 'fetch', crossOrigin: 'anonymous' });
    expect(links.some((l) => l.rel === 'preload' && /^\/content\/zh-TW\/term-index\.[0-9a-f]{6}\.json$/.test(l.href))).toBe(true);
    await expect(page.locator('.ll-question__prompt').first()).toBeVisible();
    // 名詞的完整內容在打開名詞卡之前都不讀；章節檔與舊的單一名詞檔也不讀
    expect(requests.filter((p) => /\/terms-[0-9a-z]\.|\/terms\.[0-9a-f]{6}\.json$|\/ch_[0-9a-z]+\./.test(p))).toEqual([]);
    await csp();
  });

  test('作答頁的名詞卡：打開時才讀那一桶完整內容，定義照常顯示', async ({ page, request }) => {
    const asset = await termDetailOf(request, TERM_ASSET, 'zh-TW');
    const bucket = await termBucketPath(request, TERM_ASSET, 'zh-TW');
    const requests = contentRequests(page);
    await page.goto(`/level/${LEVEL_1}/`);
    await waitForApp(page);
    await page.getByRole('radio', { name: /資產：都是店裡擁有/ }).check();
    await page.getByRole('button', { name: '確認答案' }).click();
    const chip = page.getByRole('button', { name: new RegExp(`名詞卡：${escapeRegExp(asset.label)}`) }).first();
    await expect(chip).toBeVisible();
    expect(requests.filter((p) => p.includes('/terms-'))).toEqual([]);
    await chip.click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.ll-sheet__definition')).toContainText(visibleChunk(asset.definition));
    expect(requests.filter((p) => p.includes('/terms-'))).toEqual([bucket]);
  });

  test('名詞頁（英文）：預先載入兩種語言的那一桶與英文章節索引；定義、中文名稱與「會在哪一關遇到」一起出現', async ({ page, request }) => {
    const [en, zh] = await Promise.all([termDetailOf(request, TERM_ASSET, 'en'), termDetailOf(request, TERM_ASSET, 'zh-TW')]);
    const bucket = TERM_ASSET.slice(-1);
    const csp = await watchCsp(page);
    await page.goto(`/en/terms/${TERM_ASSET}/`);
    await waitForApp(page);
    const links = await preloads(page);
    for (const loc of ['zh-TW', 'en'])
      expect(links.some((l) => l.rel === 'preload' && new RegExp(`^/content/${loc}/terms-${bucket}\\.[0-9a-f]{6}\\.json$`).test(l.href))).toBe(true);
    expect(links.some((l) => l.rel === 'preload' && /^\/content\/en\/chapter-index\.[0-9a-f]{6}\.json$/.test(l.href))).toBe(true);
    expect(links.some((l) => l.rel === 'modulepreload' && /^\/assets\/Term-[^/]+\.js$/.test(l.href))).toBe(true);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(en.label);
    await expect(page.getByTestId('term-definition')).toContainText(visibleChunk(en.definition));
    await expect(page.getByTestId('term-alt')).toHaveText(zh.label);
    await expect(page.getByTestId('term-alt')).toHaveAttribute('lang', 'zh-TW');
    await expect(page.getByTestId('term-meet')).toBeVisible();
    await expect(page.getByTestId('term-status')).toHaveAttribute('data-unlocked', 'locked');
    await csp();
  });

  test('報表卡片的一句說明來自完整內容檔（三張報表的名詞）', async ({ page, request }) => {
    // 期待值：報表類名詞的定義（從快照讀，不寫死文字）
    const statements = (await termIndexOf(request, 'zh-TW')).filter((t) => t.category === 'statement');
    await page.goto(`/level/${LEVEL_PICK_STATEMENT}/`);
    await waitForApp(page);
    const cards = page.locator('.ll-pick-statement');
    await expect(cards).toBeVisible();
    const descs = cards.locator('.ll-statement-card__desc');
    await expect(descs.first()).not.toBeEmpty();
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
    const shown = (await descs.allTextContents()).map(norm).filter(Boolean);
    expect(shown.length).toBeGreaterThan(0);
    const definitions = new Set<string>();
    for (const t of statements) definitions.add(norm((await termDetailOf(request, t.id, 'zh-TW')).definition));
    for (const d of shown) expect(definitions.has(d), `報表卡片的說明「${d.slice(0, 20)}…」應該是某個報表名詞的定義`).toBe(true);
  });

  test('首頁不預先載入任何頁面 chunk 或內容快照，只有目前語言的 catalog', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    const links = await preloads(page);
    const modules = links.filter((l) => l.rel === 'modulepreload').map((l) => l.href);
    expect(modules.length).toBeGreaterThan(0);
    // 目前語言的 catalog，加上每一頁都要的進度 runtime（route-preload.json 的 always：進度和頁面一起載入，2026-10-26）；沒有任何頁面 chunk
    expect(modules.every((h) => /^\/assets\/(catalog-zh-TW|progress|session|common|shared)-/.test(h))).toBe(true);
    expect(modules.some((h) => /^\/assets\/progress-/.test(h))).toBe(true);
    expect(links.filter((l) => l.rel === 'preload' && l.href.startsWith('/content/') && !l.href.endsWith('content-manifest.json'))).toEqual([]);
  });
});
