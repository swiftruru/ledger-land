// 跨模組導覽（M5，02 第 5.3 節、03 第 4 節、10 第 12 節）：交易影響題答完按「看動畫」開對應的實驗室步驟（?from=），返回膠囊「回到題目」回到同一題、
// 回饋展開、捲動位置還原、焦點回到「看動畫」；預測面板帶入剛剛的答案；步驟下架導到故事頁；章末相關關卡；名詞卡兩邊同一張；離線可用。
// 中英各走一次（語言不變）。Chromium 與 WebKit 都跑；離線那一段只在 Chromium（和 offline.spec 相同）。
import { expect, test, type Page } from '@playwright/test';
import { waitForApp, waitForSw } from './helpers.ts';

/** 第 2 章「填出兩邊的數字」：第 1 題是交易影響題 q_59v8fm8w（賒銷全部商品，五個方向目標），labRef 是正式故事第 10 步 */
const LEVEL = 'lv_gtpyj3s8';
const Q = 'q_59v8fm8w';
const STORY = 'story_ywv2dy';
const STEP = 'st_aw2j4t';

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
    sessionStorage.clear();
  });
}

/** 第 1 題整張畫好 */
async function firstQuestionReady(page: Page, text: RegExp): Promise<void> {
  await expect(page.locator('.ll-page[data-ready="true"]')).toBeVisible();
  await expect(page.getByText(text)).toBeVisible();
  await expect(page.locator('.ll-question-wrap[data-ready="true"]')).toBeVisible();
}

/** 每個目標都選「增加」（賒銷：現金不變、存貨減少，所以會答錯） */
async function answerAllUp(page: Page, up: RegExp, submit: string): Promise<void> {
  const rows = page.locator('.ll-question .ll-impact__row');
  await expect(rows).toHaveCount(5);
  for (let i = 0; i < 5; i++) await rows.nth(i).getByRole('radio', { name: up }).check();
  await page.getByRole('button', { name: submit }).click();
  await expect(page.locator('.ll-feedback__title')).toBeVisible();
}

const CASES = [
  { prefix: '', up: /^增加$/, submit: '確認答案', back: '回到題目', q1: /第 1 題，共 5 題/, wrong: /再想想/ },
  { prefix: '/en', up: /^Increase$/, submit: 'Check answer', back: 'Back to the question', q1: /Question 1 of 5/, wrong: /Think again/ },
] as const;

test.describe('跨模組導覽：題目與實驗室', () => {
  for (const c of CASES) {
    test(`${c.prefix || '/'}：看動畫、帶入答案、回到題目（同一題、回饋展開、位置與焦點還原）`, async ({ page }) => {
      await clearProgress(page);
      await page.goto(`${c.prefix}/level/${LEVEL}/`);
      await waitForApp(page);
      await firstQuestionReady(page, c.q1);
      await answerAllUp(page, c.up, c.submit);
      await expect(page.locator('.ll-feedback__title')).toHaveText(c.wrong);

      // 「看動畫」是連結（推一筆瀏覽歷史），帶語系前綴與 ?from=
      const watch = page.getByTestId('feedback-animation');
      await expect(watch).toHaveAttribute('href', `${c.prefix}/lab/story/${STORY}/${STEP}/?from=${Q}`);
      await watch.click();
      await expect(page).toHaveURL(new RegExp(`${c.prefix}/lab/story/${STORY}/${STEP}/\\?from=${Q}$`));
      await expect(page.getByTestId('lab-card')).toBeVisible();
      // 從題目開啟一律教材口徑；交易前的狀態就是這一步的交易卡（恆等式在上方）
      await expect(page.getByTestId('lab-session')).toHaveAttribute('data-policy', 'teacher@1');
      await expect(page.getByTestId('lab-equation')).toBeVisible();
      // 返回膠囊用 store 裡的網址（同一個語系的關卡頁）
      const back = page.getByRole('link', { name: c.back });
      await expect(back).toHaveAttribute('href', `${c.prefix}/level/${LEVEL}/`);
      // 返回目標只放網址、錨點與剛剛的答案（版面列對方向）
      const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('ll:return') ?? 'null') as Record<string, unknown> | null);
      expect(stored).toMatchObject({
        kind: 'level',
        levelId: LEVEL,
        questionId: Q,
        href: `${c.prefix}/level/${LEVEL}/`,
        lineChoices: { bs_cash: 'up', is_gross_profit: 'up', is_net_income: 'up' },
      });
      expect(typeof (stored?.['anchor'] as { elementId?: unknown } | undefined)?.elementId).toBe('string');

      // 預測階段：對得上的目標（現金、毛利、本期淨利）已帶入，營業利益那一列沒有；提示「已帶入你剛剛的答案」
      await page.getByTestId('lab-next').click();
      await expect(page.getByTestId('lab-predict')).toBeVisible();
      await expect(page.getByTestId('lab-predict-prefilled')).toBeVisible();
      const rows = page.getByTestId('lab-predict').locator('.ll-impact__row');
      await expect(rows.nth(0).getByRole('radio', { name: c.up })).toBeChecked();
      await expect(rows.nth(1).getByRole('radio', { name: c.up })).toBeChecked();
      await expect(rows.nth(2).getByRole('radio', { checked: true })).toHaveCount(0);
      await expect(rows.nth(5).getByRole('radio', { name: c.up })).toBeChecked();
      // 沒有自動記下
      await expect(page.getByTestId('lab-predict-note')).toHaveCount(0);

      // 回到題目：同一題、回饋還展開著、「看動畫」在畫面裡而且有焦點；返回目標用過就清掉
      await back.click();
      await expect(page).toHaveURL(new RegExp(`${c.prefix}/level/${LEVEL}/$`));
      await expect(page.getByText(c.q1)).toBeVisible();
      await expect(page.locator('.ll-feedback__title')).toHaveText(c.wrong);
      const again = page.getByTestId('feedback-animation');
      await expect(again).toBeFocused();
      const box = (await again.boundingBox())!;
      const viewport = page.viewportSize()!;
      expect(box.y, '「看動畫」在畫面裡').toBeGreaterThanOrEqual(0);
      expect(box.y + box.height, '「看動畫」在畫面裡').toBeLessThanOrEqual(viewport.height + 0.5);
      expect(await page.evaluate(() => sessionStorage.getItem('ll:return'))).toBeNull();
      // 瀏覽歷史：上一頁回到步驟頁（Android 返回鍵與上一頁一致）
      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`/lab/story/${STORY}/${STEP}/\\?from=${Q}$`));
    });
  }

  test('步驟下架或不存在：?from= 時導到故事頁並說明一次，返回膠囊照樣有；沒有 ?from= 維持找不到頁面', async ({ page }) => {
    await clearProgress(page);
    await page.goto(`/lab/story/${STORY}/st_nothing/?from=${Q}`);
    await waitForApp(page);
    await expect(page).toHaveURL(new RegExp(`/lab/story/${STORY}/\\?from=${Q}&missing=st_nothing$`));
    const hint = page.getByTestId('lab-story-missing');
    await expect(hint).toContainText('這一題對應的步驟已經更新');
    // store 是空的（直接開網址）：依 manifest 找到那一題所在的關卡
    await expect(hint.getByRole('link', { name: '回到題目' })).toHaveAttribute('href', `/level/${LEVEL}/`);
    await expect(page.getByTestId('lab-step-row').first()).toBeVisible();
    await hint.getByRole('button', { name: '關閉提示' }).click();
    await expect(page).toHaveURL(new RegExp(`/lab/story/${STORY}/\\?from=${Q}$`));
    await expect(page.getByTestId('lab-story-missing')).toHaveCount(0);
    // 故事也不存在：到實驗室首頁
    await page.goto(`/lab/story/story_nothing/st_nothing/?from=${Q}`);
    await waitForApp(page);
    await expect(page).toHaveURL(/\/lab\/$/);
    await expect(page.getByTestId('lab-hero')).toBeVisible();
    // 沒有 ?from=：找不到頁面
    await page.goto(`/lab/story/${STORY}/st_nothing/`);
    await waitForApp(page);
    await expect(page.getByTestId('not-found')).toBeVisible();
  });

  test('章末相關關卡連到關卡頁；題目回饋與實驗室開的是同一張名詞卡', async ({ page }) => {
    await clearProgress(page);
    await page.goto(`/lab/story/${STORY}/`);
    await waitForApp(page);
    const related = page.locator('.ll-lab-chapter__links a').first();
    await expect(related).toBeVisible();
    await expect(related).toHaveAttribute('href', /\/(level|chapter)\/[a-z0-9_]+\/$/);

    // 回饋區的第一個名詞 chip（題目與第 10 步的第一個 termRef 都是 tm_r7x2c9fa）
    await page.goto(`/level/${LEVEL}/`);
    await waitForApp(page);
    await firstQuestionReady(page, /第 1 題，共 5 題/);
    await answerAllUp(page, /^增加$/, '確認答案');
    const chip = page.locator('.ll-feedback .ll-chip').first();
    const label = (await chip.textContent())!.trim();
    await chip.click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.locator('.ll-sheet__title')).toHaveText(label);
    const definition = (await sheet.locator('.ll-sheet__section').first().textContent())!.trim();
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    // 實驗室交易卡的同名 chip 開同一張卡（同一個 TermsProvider 的來源）
    await page.getByTestId('feedback-animation').click();
    await expect(page.getByTestId('lab-card')).toBeVisible();
    await page
      .getByTestId('lab-card-terms')
      .getByRole('button', { name: `名詞卡：${label}` })
      .click();
    const labSheet = page.getByRole('dialog');
    await expect(labSheet.locator('.ll-sheet__title')).toHaveText(label);
    expect((await labSheet.locator('.ll-sheet__section').first().textContent())!.trim()).toBe(definition);
  });

  test('離線：Service Worker 接管後，從題目開啟的步驟頁與返回膠囊都能用', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Service Worker 的離線測試只在 Chromium 穩定');
    await page.goto('/');
    await waitForSw(page);
    await context.setOffline(true);
    await page.goto(`/lab/story/${STORY}/${STEP}/?from=${Q}`);
    await expect(page.getByTestId('lab-card')).toBeVisible();
    await expect(page.getByRole('link', { name: '回到題目' })).toHaveAttribute('href', `/level/${LEVEL}/`);
    await page.getByRole('link', { name: '回到題目' }).click();
    await expect(page).toHaveURL(new RegExp(`/level/${LEVEL}/$`));
    await expect(page.getByText(/第 1 題，共 5 題/)).toBeVisible();
    await context.setOffline(false);
  });
});
