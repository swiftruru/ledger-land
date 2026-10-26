// 頂部提示與橫幅（02 第 6 節、06 第 2.5、4.5、4.7、4.8 節）：用 userAgent 模擬 LINE 內建瀏覽器與 iPhone Safari 分頁，
// 直接寫 settings 模擬「完成一關」看安裝建議，寫一筆到期的錯題看首頁的「今天要複習 N 題」。在 desktop-chromium 與 iphone-webkit 各跑一次。
// 第 1 輪驗收：橫幅一次只展開一條（banner-rules.ts）、畫在頁首之後；iOS 的安裝建議出現時 Safari 分頁提示不顯示；橫幅裡的 primary 最多一顆。
import { expect, test, type Page } from '@playwright/test';
import { waitForApp, waitForProgressDb } from './helpers.ts';

const DB = 'ledgerland';
// 真機 iOS 26 的 UA：系統版本凍結在 OS 18_6，Safari 的 Version/ 才是 26（finding pages-b-2）
const IOS_LINE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/15.0.0';
const IOS_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';

test.skip(({ browserName }) => browserName === 'firefox', '環境模擬只在 Chromium 與 WebKit 跑');

/** 首次載入的橫幅中文訊息在詞裡的字之間有看不見的 U+2060（components/banner-joined-ids.ts，第 7 輪）：比對文字時容許字之間有它 */
function joinable(text: string): RegExp {
  // 空格也容許是不換行空白（「1 題」的數字和量詞之間是 U+00A0；正規式比對時 Playwright 不把它當成空格）
  return new RegExp([...text].map((ch) => (ch === ' ' ? '[ \u00a0]' : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('\u2060?'));
}

// 相機預覽的暫存情境提示依 storage.estimate 的配額決定（iPhone 的 UA 加上配額小於 1.5 GB 就出現），而且比安裝建議與 Safari 分頁提示優先；
// 執行器的配額不固定，這裡先標記為已關閉，結果才不受環境影響（它自己的情境用 ?ll-banner=ephemeral 測）
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('ll:ephemeral-notice-dismissed', '1');
    } catch {
      /* 沒有 sessionStorage 時照常跑 */
    }
  });
});

/** 橫幅（含收合的膠囊）在頁首的下方：頁首位置不因橫幅改變 */
async function expectBelowHeader(page: Page, selector: string): Promise<void> {
  const gap = await page.evaluate((sel) => {
    const header = document.querySelector('main header.ll-pagehead, main header.ll-topbar');
    const banner = document.querySelector(sel);
    if (!header || !banner) return null;
    return Math.round(banner.getBoundingClientRect().top - header.getBoundingClientRect().bottom);
  }, selector);
  expect(gap, `${selector} 應該在頁首下方`).not.toBeNull();
  expect(gap as number).toBeGreaterThanOrEqual(0);
}

/** 一次只展開一條，橫幅裡的 primary 最多一顆 */
async function expectOneBanner(page: Page, label: string): Promise<void> {
  await expect(page.locator('.ll-banner:visible'), `${label}：展開的橫幅只有一條`).toHaveCount(1);
  expect(await page.locator('.ll-banner .ll-btn--primary:visible').count(), `${label}：橫幅裡的 primary 最多一顆`).toBeLessThanOrEqual(1);
}

/** 直接寫進進度資料庫的某個 object store（結構由 App 啟動時建立；資料全部自編） */
async function put(page: Page, storeName: string, records: unknown[]): Promise<void> {
  await waitForProgressDb(page, [storeName]);
  await page.evaluate(
    ({ db, storeName, records }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(db);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const conn = req.result;
          const tx = conn.transaction([storeName], 'readwrite');
          for (const r of records) tx.objectStore(storeName).put(r);
          tx.oncomplete = () => {
            conn.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { db: DB, storeName, records },
  );
}

async function readSetting(page: Page, key: string): Promise<unknown> {
  await waitForProgressDb(page);
  return page.evaluate(
    ({ db, key }) =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open(db);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const conn = req.result;
          const get = conn.transaction(['settings']).objectStore('settings').get(key);
          get.onsuccess = () => {
            conn.close();
            resolve((get.result as { value?: unknown } | undefined)?.value ?? null);
          };
          get.onerror = () => reject(get.error);
        };
      }),
    { db: DB, key },
  );
}

/** 模擬 Chromium 送出 beforeinstallprompt（Playwright 的 Chromium 不會真的送） */
async function fireBeforeInstallPrompt(page: Page): Promise<void> {
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt?: () => Promise<void>; userChoice?: Promise<unknown> };
    e.prompt = () => Promise.resolve();
    e.userChoice = Promise.resolve({ outcome: 'dismissed' });
    window.dispatchEvent(e);
  });
}

test.describe('LINE 內建瀏覽器（06 第 4.8 節）', () => {
  test.use({ userAgent: IOS_LINE });

  test('所有頁面頂部看到橫幅與 App 名稱、可複製連結、收合後整個工作階段維持收合', async ({ page, context, browserName }) => {
    if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await waitForApp(page);
    const banner = page.locator('.ll-banner.ll-inapp');
    await expect(banner).toContainText('在 LINE 裡開啟');
    await expectOneBanner(page, '內建瀏覽器');
    await expectBelowHeader(page, '.ll-banner.ll-inapp');
    // 主動作是 secondary（畫面上唯一的 primary 留給首頁主卡）
    await expect(banner.locator('.ll-btn--primary')).toHaveCount(0);
    await page.getByRole('button', { name: '複製連結' }).click();
    const status = page.getByTestId('inapp-copy-status');
    if (browserName === 'chromium') {
      await expect(status).toContainText('已複製連結');
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
    } else {
      await expect(status).toHaveText(/已複製連結|無法自動複製/);
    }
    // 收合（站規 2.17）：剩下一顆有圖示的次要按鈕；重新整理與換頁都維持收合（sessionStorage）
    await page.getByRole('button', { name: '收合提示' }).click();
    await expect(banner).toHaveCount(0);
    await expect(page.getByTestId('inapp-collapsed')).toBeVisible();
    await expectBelowHeader(page, '[data-testid="inapp-collapsed"]');
    await page.goto('/me/');
    await waitForApp(page);
    await expect(page.getByTestId('inapp-collapsed')).toBeVisible();
    await page.getByRole('button', { name: '在 LINE 裡開啟：顯示提示' }).click();
    await expect(banner).toBeVisible();
    // 內建瀏覽器不顯示安裝建議（06 第 2.5 節）
    await expect(page.locator('.ll-install-prompt')).toHaveCount(0);
  });
});

test.describe('iPhone Safari 分頁（06 第 4.7 節第 4 步）', () => {
  test.use({ userAgent: IOS_SAFARI });

  test('常駐提示可收合成小按鈕但不會消失，附「匯出到 App」；作答頁同時顯示關卡代號', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    const notice = page.locator('.ll-banner.ll-safari-notice');
    await expect(notice).toContainText(joinable('如果你已經加入主畫面，請從主畫面圖示開啟'));
    await expect(notice.getByRole('link', { name: '匯出到 App' })).toHaveAttribute('href', '/me/backup/');
    await page.getByRole('button', { name: '收合主畫面提示' }).click();
    await expect(notice).toHaveCount(0);
    const expand = page.getByRole('button', { name: 'Safari 分頁：顯示提示' });
    await expect(expand).toHaveAttribute('aria-expanded', 'false');
    await expect(expand).toBeVisible();
    await page.reload();
    await waitForApp(page);
    await expect(expand).toBeVisible();
    await expand.click();
    await expect(notice).toBeVisible();
    await page.goto('/level/lv_h2zx7srx/');
    await waitForApp(page);
    await expect(notice.locator('.ll-levelcode__code')).toHaveText('h2zx 7srx');
    await expect(notice.getByRole('link', { name: '匯出到 App' })).toHaveAttribute('href', '/me/backup/');
  });

  // 第 1 輪驗收的 blocker：Safari 分頁提示與 iOS 安裝建議同時展開，「匯出到 App」出現兩次、英文版把第一屏佔滿。
  // 現在安裝建議比 Safari 分頁提示優先，而且已經包含「已經加入主畫面就從圖示開啟」那一句；圖解展開後先有骨架、接著是 iOS 的圖解，不會留下一條空白膠囊
  test('iOS 的安裝建議出現時 Safari 分頁提示不顯示，只有一條橫幅；展開圖解看得到 iOS 的步驟', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    await put(page, 'settings', [{ key: 'levelsCompleted', value: 1, updatedAt: '2026-10-20T10:00:00.000Z' }]);
    await page.reload();
    await waitForApp(page);
    const card = page.locator('.ll-install-prompt');
    await expect(card).toBeVisible();
    await expect(card).toContainText(joinable('已經加入就從主畫面圖示開啟'));
    await expect(page.locator('.ll-safari-notice')).toHaveCount(0);
    await expectOneBanner(page, 'Safari 分頁加安裝建議');
    await expect(card.getByRole('link', { name: '匯出到 App' })).toHaveCount(1);
    await expect(card.locator('.ll-btn--primary')).toHaveCount(0);
    await expectBelowHeader(page, '.ll-install-prompt');
    // 第 4 輪驗收：只有「匯出到 App」是 secondary sm（有外框與底邊）；「看圖解教學」「完整教學頁」「之後再說」是 quiet，「之後再說」排在動作列最後
    const actions = card.locator('.ll-banner__actions > .ll-btn');
    await expect(actions).toHaveCount(4);
    await expect(actions.nth(1)).toHaveAttribute('data-testid', 'install-guide-toggle');
    await expect(actions.nth(2)).toHaveText('完整教學頁');
    await expect(actions.nth(0)).toHaveClass(/ll-btn--secondary/);
    for (const i of [1, 2, 3]) await expect(actions.nth(i)).toHaveClass(/ll-btn--quiet/);
    await expect(actions.nth(3)).toHaveText('之後再說');
    // 第 5 輪驗收：四顆排成兩欄的格子。quiet 看得到的是字（或箭頭），所以量內容的左緣：「完整教學頁」對齊上方膠囊、「之後再說」對齊上方的箭頭；
    // 窄的橫幅（手機）動作列從文字欄開始，膠囊左緣等於標題左緣（寬的橫幅動作列在文字右側）
    const visibleLeft = (i: number) =>
      actions.nth(i).evaluate((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return el.classList.contains('ll-btn--quiet') ? r.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth) : r.left;
      });
    expect(Math.abs((await visibleLeft(2)) - (await visibleLeft(0))), '完整教學頁的字對齊上方的膠囊').toBeLessThan(1);
    expect(Math.abs((await visibleLeft(3)) - (await visibleLeft(1))), '之後再說對齊上方的箭頭').toBeLessThan(1);
    if ((await card.evaluate((el) => el.clientWidth)) < 720) {
      const titleLeft = await card.locator('.ll-banner__title').evaluate((el) => el.getBoundingClientRect().left);
      expect(Math.abs((await visibleLeft(0)) - titleLeft), '動作列從文字欄開始').toBeLessThan(1);
    }
    const bannerBefore = await card.boundingBox();
    await card.getByTestId('install-guide-toggle').click();
    const guide = page.getByTestId('install-guide');
    await expect(guide).toHaveAttribute('data-variant', /^ios-/);
    await expect(guide.locator('.ll-guide__step').first()).toBeVisible();
    // 圖解是橫幅正下方的一張卡片（不在藍色的橫幅裡）：橫幅高度不變，卡片和橫幅隔 12px
    await expect(card.getByTestId('install-guide')).toHaveCount(0);
    const guideCard = page.locator('.ll-card.ll-install-prompt__guide');
    const box = await guideCard.boundingBox();
    expect(box?.height ?? 0, '展開的圖解有內容').toBeGreaterThan(200);
    const bannerAfter = await card.boundingBox();
    expect(Math.round(bannerAfter?.height ?? 0), '展開圖解後橫幅高度不變').toBe(Math.round(bannerBefore?.height ?? -1));
    expect(Math.round((box?.y ?? 0) - ((bannerAfter?.y ?? 0) + (bannerAfter?.height ?? 0))), '圖解卡片在橫幅下方 12px').toBe(12);
    // 第 0 步說的「匯出到 App」在圖解上方的橫幅裡，不在整份圖解的最下面
    const exportBox = await card.getByRole('link', { name: '匯出到 App' }).boundingBox();
    expect(exportBox?.y ?? Infinity, '匯出到 App 在展開的圖解上方').toBeLessThan(box?.y ?? 0);
  });

  // 安裝教學的第 0 步（站規 2.13，finding pages-b-1、pages-b-3、pages-b-4）：「匯出到 App」是獨立一行的按鈕、連到備份頁的匯出區（不帶 ?import）、
  // 至少 44px 高；按「我已加入主畫面」之後焦點移到結果訊息，不會掉到 body
  test('安裝教學：「匯出到 App」連到 /me/backup/ 而且至少 44px；按「我已加入主畫面」後焦點在結果訊息', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('ll:safari-notice-collapsed', '1'));
    await page.goto('/install/');
    await waitForApp(page);
    const guide = page.getByTestId('install-guide');
    await expect(guide).toHaveAttribute('data-variant', 'ios-modern');
    const exportLink = guide.getByTestId('install-guide-export');
    await expect(exportLink).toHaveAttribute('href', '/me/backup/');
    const box = await exportLink.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    await guide.getByRole('button', { name: '我已加入主畫面' }).click();
    const done = page.getByTestId('install-guide-seen');
    await expect(done).toBeVisible();
    await expect(done).toBeFocused();
  });

  // 2026-10-24 回報：作答頁的關卡代號列在第一次繪製約 200ms 後才插入，題目與「確認答案」往下移 36px，學生點到的已經是別的東西。
  // 現在第一次繪製就畫同尺寸的佔位（web-ui 的 LevelCodePlaceholder）。頁面裡每個動畫影格記下題目卡片的文件座標（加上 scrollY，捲動不算位移）：
  // 冷啟動後 1.2 秒內不操作，卡片位置不能變（50ms 內與 1 秒後一樣）；重新整理後卡片一出現就點選項、再按確認答案，按下確認前位置不能變，之後要看到回饋。
  // 按下確認之後的「收進名詞圖鑑」提示會插在卡片上方，那是使用者操作後的變化，不在這裡量。只在 iphone-webkit 跑（觸控與 WebKit 的版面）
  test('作答頁冷啟動時關卡代號先有同尺寸佔位，題目卡片位置不變，載入後立刻點選項與確認答案都成功', async ({ page, browserName, isMobile }) => {
    test.skip(browserName !== 'webkit' || !isMobile, '只在 iphone-webkit 專案跑');
    type Rec = { t0?: number; stop?: boolean; codeRowAtStart?: boolean; tops: [number, number][] };
    await page.addInitScript(() => {
      const rec: { t0?: number; stop?: boolean; codeRowAtStart?: boolean; tops: [number, number][] } = { tops: [] };
      (window as unknown as { __llShift: typeof rec }).__llShift = rec;
      const tick = () => {
        if (rec.stop) return;
        const card = document.querySelector('[id^="ll-q-"]');
        if (card) {
          const now = performance.now();
          if (rec.t0 === undefined) {
            rec.t0 = now;
            rec.codeRowAtStart = document.querySelector('.ll-safari-notice .ll-levelcode') !== null;
          }
          rec.tops.push([Math.round(now - rec.t0), Math.round((card.getBoundingClientRect().top + window.scrollY) * 10) / 10]);
          if (now - rec.t0 > 1200) return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const read = () => page.evaluate(() => (window as unknown as { __llShift: Rec }).__llShift);
    const spread = (tops: [number, number][]) => Math.max(...tops.map(([, y]) => y)) - Math.min(...tops.map(([, y]) => y));
    const card = page.locator('[id^="ll-q-"]');

    // 冷啟動、不操作
    await page.goto('/level/lv_h2zx7srx/', { waitUntil: 'commit' });
    await card.waitFor();
    await page.waitForTimeout(1300);
    const cold = await read();
    expect(cold.codeRowAtStart, '卡片第一次出現時代號列（佔位或完整元件）已經在提示裡').toBe(true);
    const within50 = cold.tops.filter(([t]) => t <= 50).map(([, y]) => y);
    const after1s = cold.tops.filter(([t]) => t >= 1000).map(([, y]) => y);
    expect(within50.length, '50ms 內至少量到一次').toBeGreaterThan(0);
    expect(after1s.length, '1 秒後至少量到一次').toBeGreaterThan(0);
    expect(after1s[after1s.length - 1], '1 秒後的位置和 50ms 內相同').toBe(within50[0]);
    expect(spread(cold.tops), `卡片位置變動：${JSON.stringify(cold.tops.slice(0, 40))}`).toBeLessThanOrEqual(0.5);
    await expect(page.locator('.ll-safari-notice .ll-levelcode__code')).toHaveText('h2zx 7srx');
    await expect(page.getByTestId('level-code-placeholder')).toHaveCount(0);

    // 重新整理後一出現就點選項、按確認答案
    await page.reload({ waitUntil: 'commit' });
    await card.waitFor();
    await page.locator('.ll-option').first().tap();
    await expect(page.locator('.ll-option.is-chosen')).toHaveCount(1);
    await page.evaluate(() => {
      (window as unknown as { __llShift: Rec }).__llShift.stop = true;
    });
    const beforeConfirm = await read();
    expect(beforeConfirm.codeRowAtStart).toBe(true);
    expect(spread(beforeConfirm.tops), `按下確認前卡片位置變動：${JSON.stringify(beforeConfirm.tops.slice(0, 40))}`).toBeLessThanOrEqual(0.5);
    await page.getByRole('button', { name: '確認答案' }).tap();
    await expect(page.locator('.ll-feedback__title')).toBeVisible();
  });
});

test.describe('安裝建議（06 第 2.5 節）', () => {
  test('第一次完成關卡後在首頁出現，關閉後記住不再出現；第一次造訪不出現', async ({ page, browserName }) => {
    // 第一次造訪：即使已完成關卡也不出現
    await page.goto('/');
    await waitForApp(page);
    await put(page, 'settings', [{ key: 'levelsCompleted', value: 1, updatedAt: '2026-10-20T10:00:00.000Z' }]);
    const card = page.locator('.ll-install-prompt');
    await expect(page.getByTestId('home-play')).toBeVisible();
    await expect(card).toHaveCount(0);
    await page.reload();
    await waitForApp(page);
    if (browserName === 'chromium') await fireBeforeInstallPrompt(page);
    await expect(card).toBeVisible();
    await expect(card).toContainText('把會計樂園加到主畫面');
    if (browserName === 'chromium') await expect(card.getByRole('button', { name: '安裝', exact: true })).toBeVisible();
    else {
      await expect(card.getByRole('link', { name: '匯出到 App' })).toHaveAttribute('href', '/me/backup/');
      // 一句話說明加「看圖解教學」與「完整教學頁」（圖解內容另見 glossary.spec 的安裝圖解測試）；
      // 第 5 輪起說明是「已經加入就從主畫面圖示開啟，進度存在那裡；還沒加入就看圖解。」
      await expect(card).toContainText(joinable('已經加入就從主畫面圖示開啟'));
      await expect(card.getByTestId('install-guide-toggle')).toHaveText('看圖解教學');
      await expect(card.getByRole('link', { name: '完整教學頁' })).toHaveAttribute('href', '/install/');
    }
    await card.getByRole('button', { name: '關閉安裝建議，之後再說' }).click();
    await expect(card).toHaveCount(0);
    await expect.poll(() => readSetting(page, 'installPromptDismissed')).toMatchObject({ reason: 'later' });
    await page.reload();
    await waitForApp(page);
    if (browserName === 'chromium') await fireBeforeInstallPrompt(page);
    await expect(page.getByTestId('home-play')).toBeVisible();
    await page.waitForTimeout(800);
    await expect(card).toHaveCount(0);
  });
});

// 安裝教學頁的 Chromium 版（站規 2.13，第 4 輪驗收：原本只有一句話，整頁太空）：有標題的卡片、兩步（選單、確認視窗）加收尾按鈕；
// 有安裝事件時只有一步，收尾是 primary「安裝」。iPhone 的做法是參考用：1024 以上預設展開，不放這台裝置的動作按鈕
test.describe('安裝教學頁：Chromium（第 4 輪驗收）', () => {
  test('兩步加「我已安裝」，按下後記住不再跳出安裝建議；iPhone 的做法在寬版預設展開、沒有這台裝置的動作', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', '只有 Chromium 看得到這一版的教學');
    await page.goto('/install/');
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 2, name: '用這個瀏覽器安裝' })).toBeVisible();
    const guide = page.getByTestId('install-guide').first();
    await expect(guide).toHaveAttribute('data-variant', 'chromium');
    await expect(guide.locator('.ll-guide__step')).toHaveCount(2);
    const details = page.getByTestId('install-ios-details');
    await expect(details).toHaveJSProperty('open', (page.viewportSize()?.width ?? 0) >= 1024);
    await expect(details.getByTestId('install-guide-export')).toHaveCount(0);
    await expect(details.getByRole('button', { name: '我已加入主畫面' })).toHaveCount(0);
    const done = guide.getByRole('button', { name: /^我已安裝/ });
    await expect(done).toHaveClass(/ll-btn--secondary/);
    await done.click();
    const msg = page.getByTestId('install-guide-seen');
    await expect(msg).toBeFocused();
    await expect.poll(() => readSetting(page, 'installPromptDismissed')).toMatchObject({ reason: 'installed' });
  });

  test('有安裝事件時只有一步，收尾是 primary「安裝」', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', '只有 Chromium 有 beforeinstallprompt');
    await page.goto('/install/');
    await waitForApp(page);
    await fireBeforeInstallPrompt(page);
    const guide = page.getByTestId('install-guide').first();
    const install = guide.getByRole('button', { name: '安裝', exact: true });
    await expect(install).toHaveClass(/ll-btn--primary/);
    await expect(guide.locator('.ll-guide__step')).toHaveCount(1);
    await expect(guide.getByRole('button', { name: /^我已安裝/ })).toHaveCount(0);
  });
});

// 沒有真實觸發方式的狀態（儲存層五種、更新提示、相機預覽提示）用 ?ll-banner=，只在 VITE_LL_FIXTURES=1 的建置存在（banner-fixture.ts），正式建置自動跳過
test.describe('橫幅 fixture：一次只展開一條（第 1 輪驗收）', () => {
  test('每一種狀態只有一條展開的橫幅、橫幅裡的 primary 最多一顆、畫在頁首下方', async ({ page }) => {
    await page.goto('/me/?ll-fixture=buttons');
    await waitForApp(page);
    test.skip((await page.getByTestId('button-board').count()) === 0, '這個建置沒有 VITE_LL_FIXTURES=1（正式建置不含 ?ll-banner= 的觸發參數）');
    const states: [string, string][] = [
      ...(['suspended', 'blocked', 'degraded', 'quota', 'writeFailed'] as const).map((s): [string, string] => [`storage-${s}`, `[data-testid="storage-${s}"]`]),
      ['update', '.ll-updatebar'],
      ['ephemeral', '.ll-ephemeral-notice'],
    ];
    for (const [state, selector] of states) {
      await page.goto(`/me/?ll-banner=${state}`);
      await waitForApp(page);
      await expect(page.locator(selector), state).toBeVisible();
      await expectOneBanner(page, state);
      await expectBelowHeader(page, selector);
    }
  });
});

test.describe('首頁的待複習數（03 第 2.10 節）', () => {
  test('沒有到期的題目不顯示；有一題到期顯示「今天要複習 1 題」並連到錯題本', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    await expect(page.getByTestId('home-play')).toHaveAttribute('href', '/play/');
    await expect(page.getByTestId('home-due')).toHaveCount(0);
    const today = await page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    await put(page, 'reviewQueue', [
      {
        questionId: 'q_7f3k2m9x',
        rev: 1,
        lastResult: 'wrong',
        lastAnsweredAt: '2026-10-20T10:00:00.000Z',
        box: 1,
        dueAt: today,
        wrongCount: 1,
        status: 'active',
        addedBy: 'auto',
      },
    ]);
    await page.reload();
    await waitForApp(page);
    // 首頁的今日複習是 NavRow（站規 2.1）：標題「錯題本」、說明「今天要複習 1 題」、右側數字 Badge
    const due = page.getByTestId('home-due');
    // 說明的「今天」「複習」字之間有 U+2060（第 9 輪），比對時容許
    await expect(due).toContainText(joinable('今天要複習 1 題'));
    await expect(due).toHaveAttribute('href', '/review/');
  });
});
