// 闖關地圖（17 第 10 節的 M2 驗收）：用 ?ll-fixture=quest 的 3 章 12 關 fixture；內容快照目前沒有關卡，正式資料的空狀態另外測。
// 截圖（四個主題加減少動態）存到 .local-reports/quest-map/，只在 iphone-webkit 專案拍。
import { expect, test, type Page } from '@playwright/test';
import { waitForApp, watchCsp } from './helpers.ts';

const MAP = '/play/?ll-fixture=quest';
const CURRENT = 'lv_fx010003';

async function openMap(page: Page, url = MAP): Promise<void> {
  await page.goto(url);
  await waitForApp(page);
  await page.getByTestId('quest-map').waitFor();
}

function inViewport(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight;
  }, selector);
}

test.describe('闖關地圖', () => {
  test('載入後捲到目前關卡，節點有可讀名稱與 aria-current，角色站在節點上，沒有 CSP 違規', async ({ page }) => {
    const assertCsp = await watchCsp(page);
    await openMap(page);
    const current = page.locator('[aria-current="step"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAttribute('aria-label', /第 1 章第 3 關 股東權益.*建議下一關/);
    await expect.poll(() => inViewport(page, '[aria-current="step"]')).toBe(true);
    await expect(page.locator('.ll-node__btn').first()).toHaveAttribute('aria-label', /第 1 章第 1 關 認識資產，3 顆星中的 3 顆/);
    await expect(page.getByTestId('map-marker')).toHaveCSS('visibility', 'visible');
    const transform = await page.getByTestId('map-marker').evaluate((el) => (el as HTMLElement).style.transform);
    expect(transform).toMatch(/translate\(\d+px, -\d+px\)/);
    // DOM 順序第 1 關在前，視覺第 1 章在最下面
    const ys = await page.locator('[data-testid="map-chapter"]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
    expect(ys[0]!).toBeGreaterThan(ys[1]!);
    expect(ys[1]!).toBeGreaterThan(ys[2]!);
    await expect(page.getByTestId('extension-gap')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 2, name: '借貸與分錄' })).toHaveCount(1);
    await assertCsp();
  });

  test('?chapter= 捲到該章的章節牌', async ({ page }) => {
    await openMap(page, `${MAP}&chapter=ch_fx0002`);
    await expect.poll(() => inViewport(page, '[data-chapter-id="ch_fx0002"] .qm-ch__banner')).toBe(true);
  });

  test('鍵盤 Tab 依序走節點與章節牌', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', '鍵盤走訪只在 Chromium 測');
    await openMap(page);
    await page.locator('.ll-node__btn').first().focus();
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveAttribute('aria-label', /第 1 章第 2 關/);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveAttribute('aria-label', /第 1 章第 4 關/);
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveText('三張報表');
  });

  test('關卡表單：開啟後焦點進入、Esc 關閉後焦點回節點、返回也會關閉；建議先完成前一關', async ({ page }) => {
    await openMap(page);
    const node = page.locator('[aria-current="step"]');
    await node.click();
    const sheet = page.getByTestId('level-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('heading', { level: 2 })).toHaveText('股東權益');
    await expect(sheet).toContainText('第 1 章 一家小店的帳');
    await expect(sheet).toContainText('還沒挑戰過');
    await expect(sheet.locator('code')).toHaveText('fx01 0003');
    await expect(sheet.getByRole('link', { name: '開始' })).toHaveAttribute('href', '/level/lv_fx010003/');
    await expect(sheet.getByRole('link', { name: '章節資訊' })).toHaveAttribute('href', '/chapter/ch_fx0001/');
    expect(await sheet.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(node).toBeFocused();
    // 已完成的關卡：最佳成績與「再挑戰」
    await page.locator('.ll-node__btn').nth(1).click();
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('link', { name: '再挑戰' })).toHaveCount(1);
    await expect(sheet.getByRole('img', { name: '3 顆星中的 2 顆' })).toHaveCount(1);
    await page.goBack();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/\/play\//);
    // 前一關還沒完成時有建議
    await page.locator('.ll-node__btn').nth(3).click();
    await expect(sheet).toContainText('建議先完成『股東權益』');
    await sheet.locator('.ll-actions').getByRole('button', { name: '關閉' }).click();
    await expect(sheet).toBeHidden();
  });

  test('清單檢視：切換、記住偏好、每關一列、介紹按鈕開表單', async ({ page }) => {
    await openMap(page);
    await page.getByTestId('map-list-toggle').click();
    await expect(page.getByTestId('map-list')).toBeVisible();
    await expect(page.getByTestId('map-list-toggle')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => localStorage.getItem('ll:map-view'))).toBe('list');
    await expect(page.locator('.ll-levelcard')).toHaveCount(12);
    await expect(page.locator('.ll-levelcard.is-current')).toContainText('股東權益');
    await page.locator('.ll-levelcard.is-current').getByRole('button', { name: '介紹' }).click();
    await expect(page.getByTestId('level-sheet')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.reload();
    await waitForApp(page);
    await expect(page.getByTestId('map-list')).toBeVisible();
    await page.getByTestId('map-list-toggle').click();
    await expect(page.getByTestId('quest-map')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('ll:map-view'))).toBeNull();
  });

  test('關卡代號：格式錯誤、找不到、已下架、找到就導到關卡', async ({ page }) => {
    await openMap(page);
    await page.getByTestId('map-code').click();
    const overlay = page.getByTestId('code-overlay');
    await expect(overlay).toBeVisible();
    const input = overlay.getByRole('textbox');
    await expect(input).toBeFocused();
    await input.fill('zz');
    await input.press('Enter');
    await expect(overlay.getByRole('alert')).toContainText('8 個英文字母或數字');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await input.fill('fx0z 9999');
    await input.press('Enter');
    await expect(overlay.getByRole('alert')).toContainText('找不到這個代號');
    await input.fill('fx0r0001');
    await input.press('Enter');
    await expect(overlay.getByRole('alert')).toContainText('已經下架');
    await expect(overlay.getByRole('link', { name: '前往所屬章節' })).toHaveAttribute('href', '/chapter/ch_fx0001/');
    await input.fill('LV_FXO1-OOO3');
    await input.press('Enter');
    await expect(page).toHaveURL(/\/level\/lv_fx010003\/$/);
  });

  test('掃描課堂 QR：疊加層先顯示相機說明卡（不呼叫相機），可改輸入代號', async ({ page }) => {
    await openMap(page, `${MAP}&scan=1`);
    const scan = page.getByTestId('scan-overlay');
    await expect(scan).toBeVisible();
    await expect(scan).toContainText('相機只用來辨識 QR');
    await expect(scan.getByRole('button', { name: '開始掃描' })).toBeVisible();
    await expect(page.getByTestId('qr-video')).toHaveCount(0);
    await scan.getByRole('button', { name: '改輸入關卡代號' }).click();
    await expect(scan).toBeHidden();
    await expect(page.getByTestId('code-overlay')).toBeVisible();
    await expect(page).not.toHaveURL(/scan=1/);
  });

  test('?from=：星星點亮、角色走到下一關、播完移除參數並把焦點放在目前關卡', async ({ page }) => {
    await openMap(page, `${MAP}&from=lv_fx010002`);
    await expect(page).toHaveURL(/ll-fixture=quest$/, { timeout: 10_000 });
    await expect(page.locator('[aria-current="step"]')).toBeFocused();
    const marker = page.getByTestId('map-marker');
    const [mx, nodeX] = await Promise.all([
      marker.evaluate((el) => el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2),
      page.locator(`[data-level-id="${CURRENT}"] .ll-node__disc`).evaluate((el) => el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2),
    ]);
    expect(Math.abs(mx - nodeX)).toBeLessThan(12);
    await expect(page.locator('[data-level-id="lv_fx010002"]').getByRole('img', { name: '3 顆星中的 2 顆' })).toHaveCount(1);
  });

  test('?from= 跨章：章末區顯示完成，角色到下一章第一關；減少動態時直接出現', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openMap(page, `${MAP}&ll-fixture-progress=ch1done&from=lv_fx010004`);
    await expect(page).toHaveURL(/ll-fixture-progress=ch1done$/, { timeout: 10_000 });
    await expect(page.locator('[data-chapter-id="ch_fx0001"] [data-testid="chapter-end"]')).toContainText('第 1 章完成');
    await expect(page.locator('[aria-current="step"]')).toHaveAttribute('aria-label', /第 2 章第 1 關/);
    const [my, ny] = await Promise.all([
      page.getByTestId('map-marker').evaluate((el) => el.getBoundingClientRect().bottom),
      page.locator('[aria-current="step"] .ll-node__disc').evaluate((el) => el.getBoundingClientRect().top),
    ]);
    expect(Math.abs(my - ny)).toBeLessThan(40);
  });

  test('章節頁：標題、目標、關卡列表、已下架的關卡', async ({ page }) => {
    await page.goto('/chapter/ch_fx0001/?ll-fixture=quest');
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('一家小店的帳');
    await expect(page.getByTestId('chapter-levels').locator('.ll-levelcard')).toHaveCount(4);
    await expect(page.getByTestId('chapter-levels')).toContainText('認識資產');
    await expect(page.getByTestId('chapter-retired')).toContainText('已下架');
    await expect(page.getByRole('link', { name: '回到闖關地圖' })).toHaveAttribute('href', '/play/');
    await page.goto('/en/chapter/ch_fx0001/?ll-fixture=quest');
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A small shop and its books');
    await expect(page.getByRole('heading', { level: 2, name: 'Learning goals' })).toHaveCount(1);
  });

  test('正式內容：有關卡就畫地圖，沒有就顯示空狀態', async ({ page, request }) => {
    const manifest = (await (await request.get('/content/content-manifest.json')).json()) as { levels?: unknown[] };
    await page.goto('/play/');
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('闖關');
    if ((manifest.levels ?? []).length > 0) {
      await expect(page.getByTestId('quest-map')).toBeVisible();
      await expect(page.locator('[aria-current="step"]')).toHaveCount(1);
    } else {
      await expect(page.getByText('關卡準備中')).toBeVisible();
    }
  });

  test('截圖：四個主題與減少動態', async ({ page }, info) => {
    test.skip(info.project.name !== 'iphone-webkit', '截圖只在 iPhone 尺寸拍一次');
    const shots: [string, string][] = [
      ['light', `${MAP}&ll-theme=light`],
      ['dark-violet', `${MAP}&ll-theme=dark&ll-flavor=violet`],
      ['dark-berry', `${MAP}&ll-theme=dark&ll-flavor=berry`],
      ['dark-wine', `${MAP}&ll-theme=dark&ll-flavor=wine`],
    ];
    for (const [name, url] of shots) {
      await openMap(page, url);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `.local-reports/quest-map/${name}.png` });
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openMap(page, `${MAP}&ll-theme=light`);
    await page.screenshot({ path: '.local-reports/quest-map/reduced-motion.png' });
    await page.locator('[aria-current="step"]').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: '.local-reports/quest-map/level-sheet.png' });
    await page.keyboard.press('Escape');
    await page.getByTestId('map-list-toggle').click();
    await page.screenshot({ path: '.local-reports/quest-map/list-view.png' });
    await page.evaluate(() => localStorage.removeItem('ll:map-view'));
  });
});
