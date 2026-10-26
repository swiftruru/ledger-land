// INP（10 第 4 節第 5 項：Playwright 實際操作量 INP ≤ 200ms）：以 Event Timing API 記下每一個互動（有 interactionId 的事件）的持續時間，
// Chromium、CPU 降速 4 倍（和 Lighthouse 行動版同一個倍數），在作答頁（選選項、確認答案、下一題、指標題輸入）、闖關地圖（開關卡表單、關閉）
// 與名詞圖鑑（搜尋輸入）實際操作，取最長的一次。每一段的數字寫進 annotations，CI 的報告看得到。
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { waitForApp } from './helpers.ts';

test.skip(({ browserName }) => browserName !== 'chromium', 'CPU 降速要用 Chromium 的 CDP');
test.setTimeout(180_000);

const INP_BUDGET_MS = 200;

interface Entry {
  name: string;
  duration: number;
  target: string;
}

async function observe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __inp: { name: string; duration: number; target: string }[]; __firstInput: boolean };
    w.__inp = [];
    w.__firstInput = false;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as (PerformanceEntry & { interactionId?: number; target?: Element | null })[])
        if (e.interactionId) w.__inp.push({ name: e.name, duration: e.duration, target: (e.target?.getAttribute('class') ?? '').slice(0, 40) });
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
    new PerformanceObserver(() => {
      w.__firstInput = true;
    }).observe({ type: 'first-input', buffered: true });
  });
}

/** 取出並清空目前記到的互動 */
async function take(page: Page): Promise<Entry[]> {
  return page.evaluate(() => {
    const w = window as unknown as { __inp: Entry[] };
    const out = w.__inp;
    w.__inp = [];
    return out;
  });
}

/** 找一個有指標計算題（ratio_numeric）的關卡：回傳關卡與那一題之前的題數 */
async function ratioLevel(request: APIRequestContext): Promise<{ levelId: string; before: number } | null> {
  const m = (await (await request.get('/content/content-manifest.json')).json()) as { levels: { id: string; files: Record<string, string> }[] };
  for (const l of m.levels) {
    const snap = (await (await request.get(`/${l.files['zh-TW']}`)).json()) as { questions: { type: string }[] };
    const i = snap.questions.findIndex((q) => q.type === 'ratio_numeric');
    // 前面的題目都要能用「選第一個選項」帶過
    if (i >= 0 && snap.questions.slice(0, i).every((q) => ['single_choice', 'true_false', 'ratio_interpret', 'judgment'].includes(q.type)))
      return { levelId: l.id, before: i };
  }
  return null;
}

test('INP：CPU 降速 4 倍，作答頁、地圖與圖鑑的互動都在 200ms 內', async ({ page, request }) => {
  const ratio = await ratioLevel(request);
  await observe(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const results: { label: string; max: number; count: number }[] = [];
  const log = async (label: string) => {
    // 等下一次繪製送出，事件的持續時間才算完整
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))));
    await page.waitForTimeout(300);
    const list = await take(page);
    results.push({ label, max: list.reduce((m, e) => Math.max(m, e.duration), 0), count: list.length });
  };
  const settle = async () => {
    await page.waitForTimeout(1200);
    await take(page);
  };

  // 作答頁：選選項、確認答案（第一次按下時才載入判分）、下一題
  await page.goto('/level/lv_h2zx7srx/');
  await waitForApp(page);
  const card = page.locator('.ll-question');
  await card.getByRole('radio').first().waitFor();
  await settle();
  await card.getByRole('radio').first().click();
  await log('作答頁：選選項');
  await page.getByRole('button', { name: '確認答案' }).click();
  await page.locator('.ll-feedback__title').waitFor();
  await log('作答頁：確認答案');
  await page.getByRole('button', { name: '下一題' }).click();
  await page.getByText('第 2 題，共').waitFor();
  await log('作答頁：下一題');

  // 指標計算題：輸入數字
  if (ratio) {
    await page.goto(`/level/${ratio.levelId}/`);
    await waitForApp(page);
    await card.waitFor();
    for (let i = 0; i < ratio.before; i++) {
      await card.getByRole('radio').first().check();
      await page.getByRole('button', { name: '確認答案' }).click();
      await page.locator('.ll-feedback__title').waitFor();
      await page.getByRole('button', { name: '下一題' }).click();
      await page.getByText(`第 ${i + 2} 題，共`).waitFor();
    }
    const input = card.getByRole('textbox').first();
    await input.waitFor();
    await settle();
    await input.click();
    await page.keyboard.type('3.5');
    await log('作答頁：指標題輸入');
  }

  // 闖關地圖：開關卡表單、關閉
  await page.goto('/play/');
  await waitForApp(page);
  await page.locator('[aria-current="step"]').waitFor();
  await settle();
  await page.locator('[aria-current="step"]').click();
  await page.getByRole('dialog').waitFor();
  await log('地圖：開關卡表單');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await log('地圖：關閉表單');

  // 名詞圖鑑：搜尋輸入
  await page.goto('/terms/');
  await waitForApp(page);
  await page.locator('[data-term-id]').first().waitFor();
  await settle();
  await page.getByTestId('terms-search').click();
  await page.keyboard.type('現金');
  await expect(page).toHaveURL(/q=/);
  await log('圖鑑：搜尋輸入');

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const firstInput = await page.evaluate(() => (window as unknown as { __firstInput: boolean }).__firstInput);
  for (const r of results)
    test.info().annotations.push({ type: 'INP', description: `${r.label}：最長 ${Math.round(r.max)}ms（${r.count} 個超過 16ms 的事件）` });
  const worst = Math.max(...results.map((r) => r.max));
  test.info().annotations.push({ type: 'INP', description: `最長互動 ${Math.round(worst)}ms（門檻 ${INP_BUDGET_MS}ms）` });
  // 量測本身有在運作：最後一頁至少記到 first-input（不論多快都會記）
  expect(firstInput).toBe(true);
  expect(results.length).toBeGreaterThanOrEqual(6);
  expect(results.filter((r) => r.max > INP_BUDGET_MS).map((r) => `${r.label} ${Math.round(r.max)}ms`)).toEqual([]);
});
