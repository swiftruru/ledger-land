// 作答流程（03 第 2.4 到 2.12 節、02 第 5 節、17 第 5.3 節）：用 LL_INCLUDE_DRAFTS=1 建置的快照，純鍵盤走完每種題型、確認後焦點在回饋標題、
// 作答中切換語言保留題目與已選選項與捲動位置、結果頁的星星與 ?from、錯題本出現答錯的題、題目改版顯示「題目已更新」。
// 完成後在結果頁切換語言留在結果頁、不重記完成；離開後再進同一關是新的一輪（quiz-1）。
// 只在 desktop-chromium 跑（鍵盤流程）；iPhone 專案的觸控流程由 axe 與手動清單涵蓋。
import { expect, test, type Locator, type Page } from '@playwright/test';
import { waitForApp, waitForProgressDb, watchCsp } from './helpers.ts';
import { ALL_THEMES, caseByName, caseData, openCase } from './page-states.ts';

/** 第 1 章第 1 關（rev 2）：單選、分類、是非、單選、多正解、單選，共 6 題 */
const LEVEL_1 = 'lv_h2zx7srx';
/** 第 1 章第 2 關：交易影響題兩題、any_correct 多正解題 */
const LEVEL_2 = 'lv_r2ctekx1';
/** 第 2 章第 2 關（rev 2）：選報表開頭，共 8 題 */
const LEVEL_PICK_STATEMENT = 'lv_kfcqkmya';
/** 第 2 章第 3 關（rev 2）：點選報表列開頭、第 8 題是取捨題，共 8 題（計分題 7 題） */
const LEVEL_PICK_LINE = 'lv_z7zx7re1';
/** 延伸章「利害關係人觀點」第 1 關：4 題不計分的取捨題（level.unscored），答完最快 */
const LEVEL_UNSCORED = 'lv_3cqx05m1';
/** 結果頁標題：一顆星以上「完成了！」，沒有星星「這次還沒拿到星星」（M3 驗收第 5 輪）；隨便作答的流程兩種都可能 */
const RESULT_TITLE = /^(完成了！|這次還沒拿到星星)$/;

test.skip(({ browserName }) => browserName !== 'chromium', '鍵盤流程只在 Chromium 專案跑一次');

/** 以鍵盤選取一個原生 radio 或 checkbox：先把焦點放上去再按空白鍵 */
async function pick(locator: Locator): Promise<void> {
  await locator.focus();
  await locator.press('Space');
  await expect(locator).toBeChecked();
}

/** Tab 到「確認答案」並按 Enter，之後焦點要在回饋標題 */
async function submitByKeyboard(page: Page, label = '確認答案'): Promise<void> {
  const button = page.getByRole('button', { name: label });
  await expect(button).toBeEnabled();
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.ll-feedback__title')).toBeFocused();
}

async function nextByKeyboard(page: Page): Promise<void> {
  const next = page.getByRole('button', { name: '下一題' });
  await next.focus();
  await page.keyboard.press('Enter');
}

async function clearProgress(page: Page): Promise<void> {
  await page.goto('/');
  await waitForApp(page);
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    await Promise.all(
      dbs.map(
        (d) =>
          new Promise<void>((resolve) => {
            if (!d.name) return resolve();
            const req = indexedDB.deleteDatabase(d.name);
            req.onsuccess = req.onerror = req.onblocked = () => resolve();
          }),
      ),
    );
    localStorage.clear();
  });
}

function feedbackTitle(page: Page): Locator {
  return page.locator('.ll-feedback__title');
}

/** 題目卡片：選項的 radio 與 checkbox 都在這裡找，避免抓到語言切換開關（它也是 radiogroup） */
function card(page: Page): Locator {
  return page.locator('.ll-question');
}

/** 等某一題整張畫好：整頁的布幕掀開（第一題齊了才 data-ready="true"），換題後作答區齊了題目卡才顯示（.ll-question-wrap），全程沒有骨架 */
async function questionReady(page: Page, index: number, total: number): Promise<void> {
  await expect(page.locator('.ll-page[data-ready="true"]')).toBeVisible();
  await expect(page.getByText(`第 ${index} 題，共 ${total} 題`)).toBeVisible();
  await expect(page.locator('.ll-question-wrap[data-ready="true"]')).toBeVisible();
  await expect(card(page).locator('.ll-skeleton')).toHaveCount(0);
}

/** 直接讀進度資料庫的一個設定值（先 waitForProgressDb，避免測試自己建出空的資料庫） */
async function readSetting(page: Page, key: string): Promise<unknown> {
  await waitForProgressDb(page);
  return page.evaluate(
    (key) =>
      new Promise<unknown>((resolve) => {
        const req = indexedDB.open('ledgerland');
        req.onerror = () => resolve(undefined);
        req.onsuccess = () => {
          const db = req.result;
          const get = db.transaction('settings').objectStore('settings').get(key);
          get.onsuccess = () => {
            db.close();
            resolve((get.result as { value?: unknown } | undefined)?.value);
          };
          get.onerror = () => {
            db.close();
            resolve(undefined);
          };
        };
      }),
    key,
  );
}

function pageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test.describe('作答流程（純鍵盤）', () => {
  test('第 1 章第 1 關：單選、分類、是非、單選、多正解（all_correct）、單選全對，結果頁三顆星與回到地圖的 ?from', async ({ page }) => {
    const assertCsp = await watchCsp(page);
    await clearProgress(page);
    await page.goto(`/level/${LEVEL_1}/`);
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('誰的東西、誰的錢');
    await questionReady(page, 1, 6);

    // 1 單選：方向鍵移動並選取，Tab 到「確認答案」
    await expect(page.getByRole('button', { name: '確認答案' })).toBeDisabled();
    const firstRadio = card(page).getByRole('radio').first();
    await firstRadio.focus();
    const target = page.getByRole('radio', { name: /資產：都是店裡擁有/ });
    // 用方向鍵走到正確選項（最多三個選項）
    for (let i = 0; i < 3 && !(await target.isChecked()); i++) await page.keyboard.press('ArrowDown');
    await expect(target).toBeChecked();
    await submitByKeyboard(page);
    await expect(feedbackTitle(page)).toHaveText(/答對了/);
    await expect(page.getByText('正確答案，你選了')).toBeVisible();
    // 名詞解鎖：不用浮動提示，回饋面板「相關名詞」小標旁的「新收進 N」（role="status"），新收的 chip 可讀名稱加「剛收進圖鑑」（M3 驗收第 2 輪）
    const collected = page
      .locator('.ll-feedback')
      .getByRole('status')
      .filter({ hasText: /新收進 \d+/ });
    await expect(collected).toBeVisible();
    await expect(page.locator('.ll-float-toasts .ll-toast')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /名詞卡：資產，剛收進圖鑑/ }).first()).toBeVisible();
    // 剛收進的 chip 整顆鍍金、最前面是金色勾章：勾章要整個落在 chip 裡面（不再是壓在外框線上的圓點），chip 仍是 44px 高
    // 回饋面板出現時頁面正在平滑捲動，chip 與勾章要在同一次 evaluate 裡量，兩次分開量會差到捲動的位移
    const chipBoxes = await page.evaluate(() =>
      [...document.querySelectorAll('.ll-chip--new')].map((c) => {
        const box = c.getBoundingClientRect();
        const stamp = c.querySelector('.ll-stamp')!.getBoundingClientRect();
        return {
          text: c.textContent,
          box: { x: box.x, y: box.y, width: box.width, height: box.height },
          stamp: { x: stamp.x, y: stamp.y, width: stamp.width, height: stamp.height },
        };
      }),
    );
    expect(chipBoxes.length).toBeGreaterThan(0);
    for (const { text, box, stamp } of chipBoxes) {
      const why = `${text}：chip ${JSON.stringify(box)}，勾章 ${JSON.stringify(stamp)}`;
      expect(Math.round(box.height), why).toBe(44);
      expect(stamp.x, why).toBeGreaterThanOrEqual(box.x + 1);
      expect(stamp.y, why).toBeGreaterThanOrEqual(box.y + 1);
      expect(stamp.x + stamp.width, why).toBeLessThanOrEqual(box.x + box.width - 1);
      expect(stamp.y + stamp.height, why).toBeLessThanOrEqual(box.y + box.height - 1);
    }
    await nextByKeyboard(page);

    // 2 分類：Enter 拿起、方向鍵選格、Enter 放入；分類格順序是資產、負債、股東權益
    await questionReady(page, 2, 6);
    const pool = page.locator('.ll-classify__pool');
    const targets = [0, 0, 0, 1, 1, 2];
    for (const zone of targets) {
      const card = pool.getByRole('button').first();
      await card.focus();
      await page.keyboard.press('Enter');
      await expect(card).toHaveAttribute('aria-pressed', 'true');
      for (let i = 0; i <= zone; i++) await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Enter');
    }
    await expect(page.getByText('全部放好了')).toBeVisible();
    await submitByKeyboard(page, '確認分類');
    await expect(feedbackTitle(page)).toHaveText(/答對了/);
    await expect(page.getByText('你放對了 6 張，共 6 張。')).toBeVisible();
    await nextByKeyboard(page);

    // 3 是非：敘述是錯的，選「不對」
    await questionReady(page, 3, 6);
    await pick(page.getByRole('radio', { name: '不對' }));
    await submitByKeyboard(page);
    await expect(feedbackTitle(page)).toHaveText(/答對了/);
    await nextByKeyboard(page);

    // 4 單選
    await questionReady(page, 4, 6);
    await pick(page.getByRole('radio', { name: /股東權益：股東投入/ }));
    await submitByKeyboard(page);
    await expect(feedbackTitle(page)).toHaveText(/答對了/);
    await nextByKeyboard(page);

    // 5 多正解 all_correct：核取方塊，legend 是固定提示；全部勾對
    await questionReady(page, 5, 6);
    await expect(page.getByText('選出所有正確答案（可複選）。')).toBeVisible();
    await expect(page.getByRole('button', { name: '確認答案' })).toBeDisabled();
    await pick(page.getByRole('checkbox', { name: /還沒付給豆商的進貨款/ }));
    await pick(page.getByRole('checkbox', { name: /向銀行借、一年內要還的款項/ }));
    await submitByKeyboard(page);
    await expect(feedbackTitle(page)).toHaveText(/答對了/);
    await expect(page.getByText(/正確答案有 2 個/)).toBeVisible();
    await nextByKeyboard(page);

    // 6 單選：向銀行借款是資產與負債同時增加
    await questionReady(page, 6, 6);
    await pick(page.getByRole('radio', { name: /現金增加，同時短期借款（負債）增加同樣的金額/ }));
    await submitByKeyboard(page);
    await expect(feedbackTitle(page)).toHaveText(/答對了/);
    await nextByKeyboard(page);

    // 結果頁：星星由延後載入的判分模組算出，畫出來後焦點在結果標題
    await expect(page.getByTestId('result-title')).toHaveText('完成了！');
    await expect(page.getByTestId('result-title')).toBeFocused();
    await expect(page.getByRole('img', { name: '3 顆星中的 3 顆' })).toBeVisible();
    await expect(page.getByTestId('result-ratio')).toContainText('100%');
    await expect(page.getByText('計分題全部答對')).toBeVisible();
    const back = page.getByRole('link', { name: '回到地圖' });
    await expect(back).toHaveAttribute('href', `/play/?from=${LEVEL_1}`);
    await back.focus();
    await page.keyboard.press('Enter');
    // 地圖播完動畫會移除 ?from，只斷言到了 /play/
    await expect(page).toHaveURL(/\/play\//);
    await assertCsp();
  });

  test('作答到一半按返回：不跳確認，地圖顯示「已暫存，可隨時回來繼續」、角色在那一關、不點星星（站規 2.4.1）', async ({ page }) => {
    await clearProgress(page);
    await page.goto(`/level/${LEVEL_1}/`);
    await waitForApp(page);
    await questionReady(page, 1, 6);
    await pick(page.getByRole('radio', { name: /資產：都是店裡擁有/ }));
    await submitByKeyboard(page);
    const back = page.getByRole('link', { name: '離開這一關，回到闖關地圖' });
    await expect(back).toHaveAttribute('href', `/play/?from=${LEVEL_1}`);
    await back.click();
    await expect(page).toHaveURL(/\/play\//);
    await expect(page.getByTestId('map-left-toast')).toContainText('已暫存，可隨時回來繼續');
    await expect(page.getByTestId('badge-toasts')).toHaveCount(0);
    await expect(page).not.toHaveURL(/from=/, { timeout: 10_000 });
    // 角色停在剛離開的那一關（沒有沿路線走），這一關還沒有星星
    const [mx, nx] = await Promise.all([
      page.getByTestId('map-marker').evaluate((el) => el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2),
      page.locator(`[data-level-id="${LEVEL_1}"] .ll-node__disc`).evaluate((el) => el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2),
    ]);
    expect(Math.abs(mx - nx)).toBeLessThan(2);
    await expect(page.locator(`[data-level-id="${LEVEL_1}"] .ll-node__stars .is-on`)).toHaveCount(0);
  });

  test('交易影響題（方向目標的 radiogroup）與 any_correct 多正解題', async ({ page }) => {
    await clearProgress(page);
    await page.goto(`/level/${LEVEL_2}/`);
    await waitForApp(page);
    // 1 是非：先答對一題
    await questionReady(page, 1, 5);
    await pick(card(page).getByRole('radio').first());
    await submitByKeyboard(page);
    await nextByKeyboard(page);
    // 2 交易影響：每個目標一組 radiogroup，名稱是「○○的變動方向」
    await questionReady(page, 2, 5);
    const groups = card(page).getByRole('radiogroup', { name: /的變動方向$/ });
    await expect(groups.first()).toBeVisible();
    const count = await groups.count();
    expect(count).toBeGreaterThanOrEqual(2);
    await expect(page.getByRole('button', { name: '確認答案' })).toBeDisabled();
    for (let i = 0; i < count; i++) await pick(groups.nth(i).getByRole('radio', { name: '增加' }));
    await submitByKeyboard(page);
    await expect(feedbackTitle(page)).toHaveText(/答對了|再想想/);
    await expect(page.getByText(/答對 \d 個目標，共 \d 個。/)).toBeVisible();
    await nextByKeyboard(page);
    // 3 交易影響（第二題）
    await questionReady(page, 3, 5);
    const groups2 = card(page).getByRole('radiogroup', { name: /的變動方向$/ });
    const count2 = await groups2.count();
    for (let i = 0; i < count2; i++) await pick(groups2.nth(i).getByRole('radio', { name: '不變' }));
    await submitByKeyboard(page);
    await nextByKeyboard(page);
    // 4 單選
    await questionReady(page, 4, 5);
    await pick(card(page).getByRole('radio').first());
    await submitByKeyboard(page);
    await nextByKeyboard(page);
    // 5 any_correct：原生單選，legend 是固定提示；確認後其他合理答案以「也是合理答案」或狀態文字標出
    await questionReady(page, 5, 5);
    await expect(page.getByText('這題有不只一個合理答案，選出任一個即可。')).toBeVisible();
    await expect(card(page).getByRole('checkbox')).toHaveCount(0);
    await pick(card(page).getByRole('radio').first());
    await submitByKeyboard(page);
    await expect(feedbackTitle(page)).toHaveText(/答對了|再想想/);
    await expect(page.getByText(/^你選了 /)).toBeVisible();
    await nextByKeyboard(page);
    await expect(page.getByTestId('result-title')).toHaveText(RESULT_TITLE);
  });

  test('選報表（報表卡片 radiogroup）', async ({ page }) => {
    await clearProgress(page);
    await page.goto(`/level/${LEVEL_PICK_STATEMENT}/`);
    await waitForApp(page);
    await questionReady(page, 1, 8);
    const cards = page.locator('.ll-pick-statement');
    await expect(cards).toBeVisible();
    await expect(cards.getByRole('radio')).toHaveCount(3);
    await pick(cards.getByRole('radio', { name: /損益表/ }));
    await submitByKeyboard(page);
    await expect(feedbackTitle(page)).toHaveText(/答對了|再想想/);
    await expect(page.getByText(/正確答案/).first()).toBeVisible();
  });

  test('點選報表列（迷你報表的 table，方向鍵換列、Enter 選取、播報已選）與取捨題的中性回饋', async ({ page }) => {
    await clearProgress(page);
    await page.goto(`/level/${LEVEL_PICK_LINE}/`);
    await waitForApp(page);
    await questionReady(page, 1, 8);
    const table = page.locator('.ll-pick-line table');
    await expect(table).toBeVisible();
    await expect(table.locator('caption')).toHaveText('資產負債表');
    const rows = table.getByRole('button');
    await expect(rows.first()).toBeVisible();
    await rows.first().focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect(rows.first()).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(/^已選：/)).toBeVisible();
    await submitByKeyboard(page);
    await expect(feedbackTitle(page)).toHaveText(/答對了|再想想/);
    // 走到第 8 題的取捨題：中間六題隨便答
    for (let i = 2; i <= 7; i++) {
      await nextByKeyboard(page);
      await questionReady(page, i, 8);
      const group = card(page).getByRole('radiogroup', { name: /的變動方向$/ });
      if ((await group.count()) > 0) for (let k = 0; k < (await group.count()); k++) await pick(group.nth(k).getByRole('radio').first());
      else if ((await card(page).getByRole('checkbox').count()) > 0) await pick(card(page).getByRole('checkbox').first());
      else await pick(card(page).getByRole('radio').first());
      await submitByKeyboard(page);
    }
    await nextByKeyboard(page);
    await questionReady(page, 8, 8);
    await pick(card(page).getByRole('radio').first());
    await submitByKeyboard(page);
    await expect(feedbackTitle(page)).toHaveText('解說觀點');
    await expect(page.getByText('好處')).toHaveCount(3);
    await expect(page.getByText('這一題不計分，也不進錯題本。')).toBeVisible();
    await nextByKeyboard(page);
    await expect(page.getByTestId('result-title')).toHaveText(RESULT_TITLE);
    await expect(page.getByTestId('result-scored')).toContainText('7');
  });

  test('作答中切換語言：題目、已選選項與捲動位置保留（錨點還原），重新整理後從暫存還原', async ({ page }) => {
    await clearProgress(page);
    // 桌面視窗放矮一點，讓作答頁長到可以捲動
    await page.setViewportSize({ width: 1024, height: 420 });
    await page.goto(`/level/${LEVEL_1}/`);
    await waitForApp(page);
    await pick(page.getByRole('radio', { name: /資產：都是店裡擁有/ }));
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(300);
    const scrollBefore = await page.evaluate(() => window.scrollY);
    expect(scrollBefore).toBeGreaterThan(100);
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('.ll-lang [role="radio"][lang="en"]')?.click());
    await expect(page).toHaveURL(new RegExp(`/en/level/${LEVEL_1}/$`));
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Whose things, whose money');
    await expect(page.getByText('Question 1 of 6')).toBeVisible();
    await expect(page.getByRole('radio', { name: /^Assets: / })).toBeChecked();
    await expect(page.getByRole('button', { name: 'Check answer' })).toBeEnabled();
    const scrollAfter = await page.evaluate(() => window.scrollY);
    expect(scrollAfter).toBeGreaterThan(100);
    expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThan(160);
    // 選項順序由種子決定：切換語言前後順序一致（比較選項 ID 的順序）
    const order = await page.locator('.ll-choice__list input').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('.ll-lang [role="radio"][lang="zh-TW"]')?.click());
    await expect(page).toHaveURL(new RegExp(`/level/${LEVEL_1}/$`));
    await expect(page.locator('.ll-choice__list input')).toHaveCount(order.length);
    expect(await page.locator('.ll-choice__list input').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))).toEqual(order);
    // 重新整理：從暫存還原，同一題、同一個已選選項、同一個順序
    await page.waitForTimeout(600);
    await page.reload();
    await waitForApp(page);
    await expect(page.getByRole('radio', { name: /資產：都是店裡擁有/ })).toBeChecked();
    expect(await page.locator('.ll-choice__list input').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))).toEqual(order);
    // 確認後再重新整理：已確認的作答依存下的答案重新判分（判分模組延後載入），回饋與「下一題」都還在，不能再改答案
    await submitByKeyboard(page);
    await expect(feedbackTitle(page)).toHaveText(/答對了/);
    await page.waitForTimeout(600);
    await page.reload();
    await waitForApp(page);
    await expect(feedbackTitle(page)).toHaveText(/答對了/);
    await expect(page.getByRole('button', { name: '下一題' })).toBeVisible();
    await expect(page.getByRole('radio', { name: /資產：都是店裡擁有/ })).toBeChecked();
    await expect(page.getByRole('radio', { name: /資產：都是店裡擁有/ })).toBeDisabled();
  });

  test('答錯的題進錯題本；今天到期時 /review/ 可以複習；題目答案改版顯示「題目已更新」', async ({ page }) => {
    const errors = pageErrors(page);
    await clearProgress(page);
    await page.goto(`/level/${LEVEL_1}/`);
    await waitForApp(page);
    // 答錯第 1 題
    await pick(page.getByRole('radio', { name: /負債：買這些東西都花了錢/ }));
    await submitByKeyboard(page);
    await expect(feedbackTitle(page)).toHaveText('再想想');
    await expect(page.getByText('已放進錯題本')).toBeVisible();
    await expect(page.getByText('正確答案，你沒有選')).toBeVisible();
    // 回饋是先顯示的，寫進錯題本的交易可能還在進行；等那一筆真的在資料庫裡再跳頁，不然導航會中斷交易，下面改到期日時就找不到它
    await waitForProgressDb(page, ['reviewQueue']);
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              new Promise<boolean>((resolve) => {
                const req = indexedDB.open('ledgerland');
                req.onerror = () => resolve(false);
                req.onsuccess = () => {
                  const db = req.result;
                  const get = db.transaction('reviewQueue').objectStore('reviewQueue').get('q_g1ze90s7');
                  get.onsuccess = () => {
                    db.close();
                    resolve(get.result !== undefined);
                  };
                  get.onerror = () => {
                    db.close();
                    resolve(false);
                  };
                };
              }),
          ),
        { timeout: 10_000 },
      )
      .toBe(true);
    // 錯題本：盒子 1 明天才到期，今天是空的
    await page.goto('/review/');
    await waitForApp(page);
    await expect(page.getByRole('heading', { name: '今天沒有要複習的題目' })).toBeVisible();
    // 把到期日改成今天，並把紀錄的 rev 壓成 0；快照把這題改成 rev 2 的答案改版，複習頁要顯示「題目已更新」
    await waitForProgressDb(page, ['reviewQueue']);
    await page.evaluate(async () => {
      const today = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })();
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('ledgerland');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('reviewQueue', 'readwrite');
        const store = tx.objectStore('reviewQueue');
        const get = store.get('q_g1ze90s7');
        get.onsuccess = () => {
          const entry = get.result as Record<string, unknown> | undefined;
          if (entry === undefined) {
            reject(new Error('reviewQueue 裡沒有 q_g1ze90s7'));
            return;
          }
          store.put({ ...entry, dueAt: today });
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
      });
      db.close();
    });
    // 關卡在所屬章節的章節包裡（schemaVersion 3）：改章節包裡 lv_h2zx7srx 那一關的題目
    await page.route(/\/content\/zh-TW\/ch_[0-9a-z]+\.[0-9a-f]+\.json$/, async (route) => {
      const res = await route.fetch();
      const json = (await res.json()) as { levels: { level: { id: string }; questions: { id: string; rev: number; revKind: string }[] }[] };
      const target = json.levels.find((l) => l.level.id === 'lv_h2zx7srx');
      for (const q of target?.questions ?? []) if (q.id === 'q_g1ze90s7') Object.assign(q, { rev: q.rev + 1, revKind: 'answer' });
      await route.fulfill({ response: res, json });
    });
    await page.goto('/review/');
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('錯題本');
    // 入口卡（站規 2.5）：今天要複習 1 題，資訊列標出「題目已更新」；按「開始複習」才進複習中（頁首換成「錯題複習」）
    await expect(page.getByRole('heading', { name: '今天要複習 1 題' })).toBeVisible();
    await expect(page.getByText('題目已更新')).toBeVisible();
    await page.getByRole('button', { name: '開始複習' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('錯題複習');
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    await questionReady(page, 1, 1);
    await pick(page.getByRole('radio', { name: /資產：都是店裡擁有/ }));
    await submitByKeyboard(page);
    await expect(feedbackTitle(page)).toHaveText(/答對了/);
    await expect(page.getByText(/現在在盒子 2/)).toBeVisible();
    await nextByKeyboard(page);
    await expect(page.getByRole('heading', { name: '今天的錯題都複習完了' })).toBeVisible();
    await expect(page.getByText(/^答對 1 題，共 1 題。/)).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('完成後再進同一關（quiz-1）', () => {
  test('結果頁切換語言：留在結果頁、完成只記一次；回到地圖後用返回鍵再進來是新的一輪', async ({ page }) => {
    const errors = pageErrors(page);
    await clearProgress(page);
    await page.goto(`/level/${LEVEL_UNSCORED}/`);
    await waitForApp(page);
    for (let i = 1; i <= 4; i++) {
      await questionReady(page, i, 4);
      await pick(card(page).getByRole('radio').first());
      await submitByKeyboard(page);
      await nextByKeyboard(page);
    }
    await expect(page.getByTestId('result-title')).toHaveText('已讀完這一關');
    await expect.poll(() => readSetting(page, 'levelsCompleted'), { timeout: 10_000 }).toBe(1);

    // 在結果頁切換語言：同一關換一種語言，還是結果頁，不重記完成
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('.ll-lang [role="radio"][lang="en"]')?.click());
    await expect(page).toHaveURL(new RegExp(`/en/level/${LEVEL_UNSCORED}/$`));
    await expect(page.getByTestId('result-title')).toHaveText('You have read this level');
    await page.waitForTimeout(1000);
    expect(await readSetting(page, 'levelsCompleted')).toBe(1);

    // 回到地圖（站內導覽，不重新整理），再用返回鍵回到這一關：開新的一輪，從第 1 題開始，完成次數不變
    await page.getByRole('link', { name: 'Back to the map', exact: true }).click();
    await expect(page).toHaveURL(/\/en\/play\//);
    // 網址先變、畫面後換（startTransition）：等結果頁真的卸載再返回，不然返回會中斷換頁，結果頁根本沒離開
    await expect(page.getByTestId('result-title')).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/en/level/${LEVEL_UNSCORED}/$`));
    await expect(page.getByText('Question 1 of 4')).toBeVisible();
    await expect(page.getByTestId('result-title')).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(await readSetting(page, 'levelsCompleted')).toBe(1);
    expect(errors).toEqual([]);
  });
});

// 結果頁的成績小卡（站規 5.1 的文字放大 200%）：375 與 320 都不能有數字被裁掉、卡片互相蓋住（只看水平捲動抓不到）
test.describe('結果頁的版面', () => {
  test('沒有星星：標題改成「這次還沒拿到星星」，主按鈕是「再挑戰」、「回到地圖」退成次要；說明句的「錯題本」不拆開', async ({ page, request }) => {
    const data = await caseData(request);
    await openCase(page, caseByName('作答', '結果頁（沒有星星）'), { width: 375, prefix: '', theme: ALL_THEMES[0]!, data, height: 812 });
    await expect(page.getByTestId('result-title')).toHaveText('這次還沒拿到星星');
    await expect(page.getByTestId('result-cheer')).toBeVisible();
    // 依名稱找按鈕，不依順序：「再挑戰」是 primary、「回到地圖」是 secondary，主要的在前
    const retry = page.getByRole('button', { name: '再挑戰' });
    const back = page.getByRole('link', { name: '回到地圖' });
    await expect(retry).toHaveClass(/\bll-btn--primary\b/);
    await expect(back).toHaveClass(/\bll-btn--secondary\b/);
    expect((await retry.boundingBox())!.y).toBeLessThan((await back.boundingBox())!.y);
    await expect(page.locator('.ll-result__note').first()).toContainText('錯題本');
  });

  test('文字放大 200% 時成績小卡的數字不溢出、卡片不重疊（375 與 320）', async ({ page, request }) => {
    const data = await caseData(request);
    await openCase(page, caseByName('作答', '結果頁'), { width: 375, prefix: '', theme: ALL_THEMES[0]!, data, height: 812 });
    await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
    const layout = () =>
      page.evaluate(() => {
        const cards = [...document.querySelectorAll<HTMLElement>('.ll-result__stat[data-testid^="result-"]')];
        const overflow = cards
          .filter((c) => {
            const dd = c.querySelector('dd')!;
            return dd.scrollWidth > dd.clientWidth || dd.getBoundingClientRect().right > c.getBoundingClientRect().right + 0.5;
          })
          .map((c) => c.dataset.testid);
        const boxes = cards.map((c) => c.getBoundingClientRect());
        const overlap: string[] = [];
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i]!;
            const b = boxes[j]!;
            if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom)
              overlap.push(`${cards[i]!.dataset.testid}×${cards[j]!.dataset.testid}`);
          }
        return { cards: cards.length, overflow, overlap };
      });
    for (const width of [375, 320]) {
      await page.setViewportSize({ width, height: 812 });
      await expect.poll(layout).toEqual({ cards: expect.any(Number), overflow: [], overlap: [] });
      expect((await layout()).cards).toBeGreaterThanOrEqual(2);
    }
  });
});

test.describe('沒有骨架（維護者 2026-10-26：點進任何一頁都要直接看到完整的資訊）', () => {
  /** 第 2 章第 1 關：交易影響題開頭（作答區要等延後載入的題型元件與核心資料） */
  const LEVEL_EFFECT_FIRST = 'lv_14xjcbk8';

  test('交易影響題開頭的關卡：整頁出現（data-ready）的那一刻作答區已完整，整個過程沒有任何骨架', async ({ page }) => {
    await clearProgress(page);
    // 在 App 的任何程式跑之前裝上觀察器：記下每一次 .ll-page 的 data-ready 變成 true 時作答區的狀態，以及是否曾出現過 .ll-skeleton
    await page.addInitScript(() => {
      const log: { ready: string | null; groups: number; prompt: boolean; skeleton: number }[] = [];
      let everSkeleton = 0;
      const snapshot = () => {
        const pageEl = document.querySelector('.ll-page');
        const skeleton = document.querySelectorAll('.ll-skeleton').length;
        everSkeleton = Math.max(everSkeleton, skeleton);
        return {
          ready: pageEl?.getAttribute('data-ready') ?? null,
          groups: document.querySelectorAll('.ll-question [role="radiogroup"]').length,
          prompt: (document.querySelector('.ll-question__prompt')?.textContent ?? '').trim().length > 0,
          skeleton,
        };
      };
      let last: string | null = null;
      const observer = new MutationObserver(() => {
        const s = snapshot();
        if (s.ready !== last) {
          last = s.ready;
          log.push(s);
        }
      });
      // init script 跑的時候 documentElement 還不存在，觀察 document 本身
      observer.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-ready', 'class'] });
      (window as unknown as { __llReadyLog: () => { log: typeof log; everSkeleton: number } }).__llReadyLog = () => ({ log, everSkeleton });
    });
    await page.goto(`/level/${LEVEL_EFFECT_FIRST}/`);
    await waitForApp(page);
    await expect(page.locator('.ll-page[data-ready="true"]')).toBeVisible();
    // 掀開布幕的那一刻：題幹與每個目標的 radiogroup 都已經在畫面上，而且當時沒有骨架
    const { log, everSkeleton } = await page.evaluate(() =>
      (
        window as unknown as {
          __llReadyLog: () => { log: { ready: string | null; groups: number; prompt: boolean; skeleton: number }[]; everSkeleton: number };
        }
      ).__llReadyLog(),
    );
    const reveals = log.filter((e) => e.ready === 'true');
    expect(reveals.length, 'data-ready 變成 true 至少一次').toBeGreaterThan(0);
    for (const r of reveals) {
      expect(r.prompt, '掀開時題幹已在').toBe(true);
      expect(r.groups, '掀開時每個目標的 radiogroup 都已在').toBeGreaterThanOrEqual(2);
      expect(r.skeleton, '掀開時沒有骨架').toBe(0);
    }
    expect(everSkeleton, '整個過程沒有出現過 .ll-skeleton').toBe(0);
    await expect(
      card(page)
        .getByRole('radiogroup', { name: /的變動方向$/ })
        .first(),
    ).toBeVisible();
    await expect(page.locator('.ll-question-wrap')).toHaveAttribute('data-ready', 'true');
    // 答完第一題換到下一題（也是交易影響題）：題目卡齊了才顯示，過程中一樣沒有骨架
    const groups = card(page).getByRole('radiogroup', { name: /的變動方向$/ });
    const count = await groups.count();
    for (let i = 0; i < count; i++) await pick(groups.nth(i).getByRole('radio').first());
    await submitByKeyboard(page);
    await nextByKeyboard(page);
    await questionReady(page, 2, 6);
    await expect(
      card(page)
        .getByRole('radiogroup', { name: /的變動方向$/ })
        .first(),
    ).toBeVisible();
    expect(await page.evaluate(() => document.querySelectorAll('.ll-skeleton').length), '換題後也沒有骨架').toBe(0);
  });
});
