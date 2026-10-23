// 作答流程（03 第 2.4 到 2.12 節、02 第 5 節、17 第 5.3 節）：用 LL_INCLUDE_DRAFTS=1 建置的快照，純鍵盤走完每種題型、確認後焦點在回饋標題、
// 作答中切換語言保留題目與已選選項與捲動位置、結果頁的星星與 ?from、錯題本出現答錯的題、題目改版顯示「題目已更新」。
// 只在 desktop-chromium 跑（鍵盤流程）；iPhone 專案的觸控流程由 axe 與手動清單涵蓋。
import { expect, test, type Locator, type Page } from '@playwright/test';
import { waitForApp, waitForProgressDb, watchCsp } from './helpers.ts';

const LEVEL_1 = 'lv_h2zx7srx';
/** 第 1 章第 2 關：交易影響題兩題、any_correct 多正解題 */
const LEVEL_2 = 'lv_r2ctekx1';
/** 第 2 章第 2 關：選報表 */
const LEVEL_PICK_STATEMENT = 'lv_kfcqkmya';
/** 第 2 章第 3 關：點選報表列、取捨題 */
const LEVEL_PICK_LINE = 'lv_z7zx7re1';

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

/** 等某一題的題型元件載好（需要版面資料的題型先顯示骨架） */
async function questionReady(page: Page, index: number, total: number): Promise<void> {
  await expect(page.getByText(`第 ${index} 題，共 ${total} 題`)).toBeVisible();
  await expect(card(page).locator('.ll-skeleton')).toHaveCount(0);
}

function pageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test.describe('作答流程（純鍵盤）', () => {
  test('第 1 章第 1 關：單選、分類、是非、單選、多正解（all_correct）全對，結果頁三顆星與回到地圖的 ?from', async ({ page }) => {
    const assertCsp = await watchCsp(page);
    await clearProgress(page);
    await page.goto(`/level/${LEVEL_1}/`);
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('誰的東西、誰的錢');
    await questionReady(page, 1, 5);

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
    // 名詞解鎖的提示與名詞 chip
    await expect(page.getByRole('status').filter({ hasText: '收進名詞圖鑑' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /名詞卡：資產/ }).first()).toBeVisible();
    await nextByKeyboard(page);

    // 2 分類：Enter 拿起、方向鍵選格、Enter 放入；分類格順序是資產、負債、股東權益
    await questionReady(page, 2, 5);
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
    await questionReady(page, 3, 5);
    await pick(page.getByRole('radio', { name: '不對' }));
    await submitByKeyboard(page);
    await expect(feedbackTitle(page)).toHaveText(/答對了/);
    await nextByKeyboard(page);

    // 4 單選
    await questionReady(page, 4, 5);
    await pick(page.getByRole('radio', { name: /股東權益：股東投入/ }));
    await submitByKeyboard(page);
    await expect(feedbackTitle(page)).toHaveText(/答對了/);
    await nextByKeyboard(page);

    // 5 多正解 all_correct：核取方塊，legend 是固定提示；全部勾對
    await questionReady(page, 5, 5);
    await expect(page.getByText('選出所有正確答案（可複選）。')).toBeVisible();
    await expect(page.getByRole('button', { name: '確認答案' })).toBeDisabled();
    await pick(page.getByRole('checkbox', { name: /還沒付給豆商的進貨款/ }));
    await pick(page.getByRole('checkbox', { name: /向銀行借、一年內要還的款項/ }));
    await submitByKeyboard(page);
    await expect(feedbackTitle(page)).toHaveText(/答對了/);
    await expect(page.getByText(/正確答案有 2 個/)).toBeVisible();
    await nextByKeyboard(page);

    // 結果頁
    await expect(page.getByTestId('result-title')).toHaveText('完成了！');
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
    await expect(page.getByTestId('result-title')).toHaveText('完成了！');
  });

  test('選報表（報表卡片 radiogroup）', async ({ page }) => {
    await clearProgress(page);
    await page.goto(`/level/${LEVEL_PICK_STATEMENT}/`);
    await waitForApp(page);
    await questionReady(page, 1, 5);
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
    await questionReady(page, 1, 6);
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
    // 走到第 6 題的取捨題：中間四題隨便答
    for (let i = 2; i <= 5; i++) {
      await nextByKeyboard(page);
      await questionReady(page, i, 6);
      const group = card(page).getByRole('radiogroup', { name: /的變動方向$/ });
      if ((await group.count()) > 0) for (let k = 0; k < (await group.count()); k++) await pick(group.nth(k).getByRole('radio').first());
      else if ((await card(page).getByRole('checkbox').count()) > 0) await pick(card(page).getByRole('checkbox').first());
      else await pick(card(page).getByRole('radio').first());
      await submitByKeyboard(page);
    }
    await nextByKeyboard(page);
    await questionReady(page, 6, 6);
    await pick(card(page).getByRole('radio').first());
    await submitByKeyboard(page);
    await expect(feedbackTitle(page)).toHaveText('解說觀點');
    await expect(page.getByText('好處')).toHaveCount(3);
    await expect(page.getByText('這一題不計分，也不進錯題本。')).toBeVisible();
    await nextByKeyboard(page);
    await expect(page.getByTestId('result-title')).toHaveText('完成了！');
    await expect(page.getByTestId('result-ratio')).toContainText('計分題 5 題');
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
    await expect(page.getByText('Question 1 of 5')).toBeVisible();
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
          const entry = get.result as Record<string, unknown>;
          store.put({ ...entry, dueAt: today });
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    });
    await page.route(/\/content\/zh-TW\/lv_h2zx7srx\.[0-9a-f]+\.json$/, async (route) => {
      const res = await route.fetch();
      const json = (await res.json()) as { questions: { id: string; rev: number; revKind: string }[] };
      for (const q of json.questions) if (q.id === 'q_g1ze90s7') Object.assign(q, { rev: 2, revKind: 'answer' });
      await route.fulfill({ response: res, json });
    });
    await page.goto('/review/');
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('錯題本');
    await expect(page.getByText('題目已更新')).toBeVisible();
    await questionReady(page, 1, 1);
    await pick(page.getByRole('radio', { name: /資產：都是店裡擁有/ }));
    await submitByKeyboard(page);
    await expect(feedbackTitle(page)).toHaveText(/答對了/);
    await expect(page.getByText(/現在在盒子 2/)).toBeVisible();
    await nextByKeyboard(page);
    await expect(page.getByRole('heading', { name: '今天的複習完成了' })).toBeVisible();
    await expect(page.getByText(/^答對 1 題，共 1 題。/)).toBeVisible();
    expect(errors).toEqual([]);
  });
});
