// 作答頁的計時與收藏（03 第 2.7、2.10 節）：設定頁打開計時後作答頁以文字顯示剩餘時間；按暫停後停住、按繼續再倒數；
// 切到背景（visibilitychange 轉 hidden）自動暫停、回來不自動恢復；離開作答畫面（Tab bar、返回）也自動暫停；切換語言保留計時狀態、照樣倒數；
// 寬鬆加倍在第一次繪製後補上；不計分的關卡不計時。
// 全站沒開計時時可以在關卡開頭單次開啟（不改設定），結果頁顯示這一關的用時；設定裡關閉「剩 1 分鐘」與「時間到」的提醒後不播報。
// 取捨題按「收藏」後出現在「我的」的收藏清單，回到作答頁取消後清單變空。每個測試都是新的瀏覽器 context（沒有舊的進度與設定）。
import { expect, test, type Page } from '@playwright/test';
import { waitForApp, waitForProgressDb, watchCsp } from './helpers.ts';

/** 第 1 章第 1 關：全部是計分題 */
const LEVEL_SCORED = 'lv_h2zx7srx';
/** 延伸章「利害關係人觀點」第 1 關：全部是不計分的取捨題（level.unscored） */
const LEVEL_UNSCORED = 'lv_3cqx05m1';
const LEVEL_UNSCORED_TITLE = '股東與債權人';
/** 全站設定的每題秒數（features/quiz/timer.ts 的 DEFAULT_SECONDS_PER_QUESTION） */
const SECONDS_PER_QUESTION = 75;

/** 倒數文字換成剩餘秒數：「剩 6 分 15 秒」「6 min 15 s left」「剩 42 秒」 */
async function remainingSeconds(page: Page): Promise<number> {
  const text = await page.getByTestId('timer').locator('.ll-timer__value').innerText();
  const nums = (text.match(/\d+/g) ?? []).map(Number);
  if (nums.length === 2) return nums[0]! * 60 + nums[1]!;
  if (nums.length === 1) return nums[0]!;
  throw new Error(`看不懂的倒數文字：${text}`);
}

/** 題目外框頂端「第 1 題，共 N 題」的 N */
async function questionCount(page: Page): Promise<number> {
  const text = await page.getByText(/^第 1 題，共 \d+ 題$/).innerText();
  return Number(/共 (\d+) 題/.exec(text)![1]);
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

/** 等作答暫存（ledgerland-session，store 以節流方式寫入）記下這一題已確認：跳頁會中斷還沒落地的寫入，回來就變成新的一輪 */
async function waitForConfirmedInSessionCache(page: Page, levelId: string, questionId: string): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        ({ key, questionId }) =>
          new Promise<boolean>((resolve) => {
            const req = indexedDB.open('ledgerland-session');
            req.onerror = () => resolve(false);
            req.onsuccess = () => {
              const db = req.result;
              if (!db.objectStoreNames.contains('sessions')) {
                db.close();
                resolve(false);
                return;
              }
              const get = db.transaction('sessions').objectStore('sessions').get(key);
              get.onsuccess = () => {
                db.close();
                const entry = get.result as { session?: { questions?: Record<string, { confirmed?: boolean }> } } | undefined;
                resolve(entry?.session?.questions?.[questionId]?.confirmed === true);
              };
              get.onerror = () => {
                db.close();
                resolve(false);
              };
            };
          }),
        { key: `level:${levelId}`, questionId },
      ),
    )
    .toBe(true);
}

/** 在「我的 › 設定」打開計時（與寬鬆），等設定寫進資料庫、timerEnabled 鏡像到 localStorage（作答頁開始時讀鏡像） */
async function enableTimer(page: Page, { relaxed = false }: { relaxed?: boolean } = {}): Promise<void> {
  await page.goto('/me/settings/');
  await waitForApp(page);
  const enabled = page.getByRole('switch', { name: '作答時計時' });
  // 設定在第一次繪製後才讀到，讀到之前開關是停用的
  await expect(enabled).toBeEnabled();
  await expect(enabled).toHaveAttribute('aria-checked', 'false');
  await enabled.click();
  await expect(enabled).toHaveAttribute('aria-checked', 'true');
  if (relaxed) {
    const relax = page.getByRole('switch', { name: '寬鬆（時間加倍）' });
    await relax.click();
    await expect(relax).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => readSetting(page, 'timerRelaxed')).toBe(true);
  }
  await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem('ll:settings') ?? '{}') as { timerEnabled?: unknown }).timerEnabled)).toBe(true);
}

/** 模擬切到背景或回到前景：改寫 document.visibilityState 再派發 visibilitychange */
async function setVisibility(page: Page, state: 'hidden' | 'visible'): Promise<void> {
  await page.evaluate((state) => {
    if (state === 'hidden') {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    } else {
      Reflect.deleteProperty(document, 'visibilityState');
      Reflect.deleteProperty(document, 'hidden');
    }
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
}

test.describe('作答頁的計時', () => {
  test('預設關閉：沒有打開計時時作答頁不顯示剩餘時間', async ({ page }) => {
    await page.goto(`/level/${LEVEL_SCORED}/`);
    await waitForApp(page);
    await expect(page.getByText(/^第 1 題，共 \d+ 題$/)).toBeVisible();
    await expect(page.getByTestId('timer')).toHaveCount(0);
  });

  test('打開後顯示剩餘時間；暫停後停住、繼續再倒數；切到背景自動暫停、回來不自動恢復；切換語言保留計時狀態', async ({ page }) => {
    const assertCsp = await watchCsp(page);
    await enableTimer(page);
    await page.goto(`/level/${LEVEL_SCORED}/`);
    await waitForApp(page);
    const timer = page.getByTestId('timer');
    await expect(timer).toBeVisible();
    await expect(timer.locator('.ll-timer__value')).toHaveText(/^剩 \d+ 分 \d+ 秒$/);
    await expect(timer).toHaveAttribute('data-paused', 'false');
    // 上限＝每題秒數 × 計分題題數（這一關都是計分題）
    const limit = (await questionCount(page)) * SECONDS_PER_QUESTION;
    const start = await remainingSeconds(page);
    expect(start).toBeLessThanOrEqual(limit);
    expect(start).toBeGreaterThan(limit - 15);
    await expect.poll(() => remainingSeconds(page), { timeout: 5000 }).toBeLessThan(start);

    // 暫停：文字停住、顯示「已暫停」
    await page.getByRole('button', { name: '暫停', exact: true }).click();
    await expect(timer).toHaveAttribute('data-paused', 'true');
    await expect(timer.getByText('已暫停')).toBeVisible();
    const paused = await remainingSeconds(page);
    await page.waitForTimeout(2500);
    expect(await remainingSeconds(page)).toBe(paused);

    // 繼續：再倒數
    await page.getByRole('button', { name: '繼續', exact: true }).click();
    await expect(timer).toHaveAttribute('data-paused', 'false');
    await expect.poll(() => remainingSeconds(page), { timeout: 5000 }).toBeLessThan(paused);

    // 切到背景自動暫停；回到前景不自動恢復，要學生自己按「繼續」
    await setVisibility(page, 'hidden');
    await expect(timer).toHaveAttribute('data-paused', 'true');
    const hidden = await remainingSeconds(page);
    await setVisibility(page, 'visible');
    await page.waitForTimeout(2000);
    await expect(timer).toHaveAttribute('data-paused', 'true');
    expect(await remainingSeconds(page)).toBe(hidden);

    // 切換語言：計時在工作階段裡，剩餘時間與暫停狀態都保留
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('.ll-lang [role="radio"][lang="en"]')?.click());
    await expect(page).toHaveURL(new RegExp(`/en/level/${LEVEL_SCORED}/$`));
    await expect(timer.locator('.ll-timer__value')).toHaveText(/^\d+ min \d+ s left$/);
    await expect(timer).toHaveAttribute('data-paused', 'true');
    expect(await remainingSeconds(page)).toBe(hidden);
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(timer).toHaveAttribute('data-paused', 'false');
    await expect.poll(() => remainingSeconds(page), { timeout: 5000 }).toBeLessThan(hidden);
    await assertCsp();
  });

  test('離開作答畫面（Tab bar 的「我的」）時自動暫停，返回後不自動繼續；切換語言不算離開，照樣倒數', async ({ page }) => {
    await enableTimer(page);
    await page.goto(`/level/${LEVEL_SCORED}/`);
    await waitForApp(page);
    const timer = page.getByTestId('timer');
    await expect(timer).toHaveAttribute('data-paused', 'false');
    const start = await remainingSeconds(page);
    // 切換語言：同一關的另一種語言網址，計時照樣走
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('.ll-lang [role="radio"][lang="en"]')?.click());
    await expect(page).toHaveURL(new RegExp(`/en/level/${LEVEL_SCORED}/$`));
    await expect(timer).toHaveAttribute('data-paused', 'false');
    await expect.poll(() => remainingSeconds(page), { timeout: 5000 }).toBeLessThan(start);
    // Tab bar 的「我的」是站內導覽：作答頁卸載時暫停並寫進暫存
    await page.locator('#ll-tabbar a[data-tab="me"]').click();
    await expect(page).toHaveURL(/\/en\/me\/$/);
    // 網址先變、畫面後換（startTransition）：等作答頁真的卸載再返回，不然返回會中斷換頁，作答頁根本沒離開
    await expect(timer).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/en/level/${LEVEL_SCORED}/$`));
    await expect(timer).toHaveAttribute('data-paused', 'true');
    const paused = await remainingSeconds(page);
    await page.waitForTimeout(2000);
    expect(await remainingSeconds(page)).toBe(paused);
    await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  });

  test('寬鬆加倍：第一次繪製後讀到設定再補上時間；不計分的關卡不計時', async ({ page }) => {
    await enableTimer(page, { relaxed: true });
    await page.goto(`/level/${LEVEL_SCORED}/`);
    await waitForApp(page);
    await expect(page.getByTestId('timer')).toBeVisible();
    const limit = (await questionCount(page)) * SECONDS_PER_QUESTION;
    await expect.poll(() => remainingSeconds(page), { timeout: 10_000 }).toBeGreaterThan(limit);
    expect(await remainingSeconds(page)).toBeLessThanOrEqual(limit * 2);

    await page.goto(`/level/${LEVEL_UNSCORED}/`);
    await waitForApp(page);
    await expect(page.getByText(/^第 1 題，共 \d+ 題$/)).toBeVisible();
    await expect(page.getByTestId('timer')).toHaveCount(0);
  });
});

// 單次計時與提醒用的自編關卡（形狀同 tools/lib/content-snapshot.mjs，數字與文字都是自編的）：一題單選；timerSeconds 62 秒，兩秒後就到「剩 1 分鐘」。
// 選項 ID 要符合 o_ 加 4 碼的規則（content-schema 的 ID_RULES），否則作答解析失敗、一律判錯，結果頁會是「這次還沒拿到星星」（M3 驗收第 5 輪起沒有星星時標題不同）
const TIMED_LEVEL_ID = 'lv_e2etime1';
const TIMED_FILE = 'lv_e2etime1.e2e.json';
const TIMED_LEVEL = {
  level: {
    id: TIMED_LEVEL_ID,
    rev: 1,
    chapterId: 'ch_e2e001',
    order: 1,
    title: '計時測試關',
    questionIds: ['q_e2etime1'],
    status: 'published',
    timerSeconds: 62,
  },
  questions: [
    {
      id: 'q_e2etime1',
      chapterId: 'ch_e2e001',
      objectiveId: 'obj_e2e01',
      difficulty: 1,
      rev: 1,
      revKind: 'text',
      answerRev: 1,
      termRefs: [],
      tags: [],
      status: 'published',
      type: 'single_choice',
      scored: true,
      prompt: '店向銀行借錢，這筆錢是哪一類？',
      options: [
        { id: 'o_e2t1', text: '負債', feedback: '要還的錢是負債。' },
        { id: 'o_e2t2', text: '收入', feedback: '借錢不是賺來的。' },
        { id: 'o_e2t3', text: '股東權益', feedback: '股東權益不用還。' },
      ],
      correctOptionId: 'o_e2t1',
      explanation: '要還的錢是負債。',
    },
  ],
};

async function installTimedLevel(page: Page): Promise<void> {
  await page.route('**/content/content-manifest.json', async (route) => {
    const res = await route.fetch();
    const json = (await res.json()) as { levels?: unknown[] };
    json.levels = [
      ...(json.levels ?? []),
      {
        id: TIMED_LEVEL_ID,
        chapterId: 'ch_e2e001',
        order: 97,
        questionIds: TIMED_LEVEL.level.questionIds,
        files: { 'zh-TW': `content/zh-TW/${TIMED_FILE}`, en: `content/en/${TIMED_FILE}` },
      },
    ];
    await route.fulfill({ response: res, json });
  });
  // 關卡的檔是章節包 { levels: [{ level, questions }] }（schemaVersion 3）
  await page.route(`**/content/*/${TIMED_FILE}`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ levels: [TIMED_LEVEL] }) }),
  );
}

test.describe('單次計時、結果頁的用時與提醒設定（03 第 2.10 節）', () => {
  // 這段用 page.route 換掉 manifest；page.route 攔不到 Service Worker 處理的請求，第二次整頁導覽可能拿到 precache 裡的 manifest（quiz-13）
  test.use({ serviceWorkers: 'block' });
  test('全站沒開計時：關卡開頭按「這一關計時」單次開啟，不改設定；剩 1 分鐘時播報；結果頁顯示用時；再挑戰回到不計時', async ({ page }) => {
    const assertCsp = await watchCsp(page);
    await installTimedLevel(page);
    await page.goto(`/level/${TIMED_LEVEL_ID}/`);
    await waitForApp(page);
    await expect(page.getByText('第 1 題，共 1 題')).toBeVisible();
    const once = page.getByRole('button', { name: '這一關計時' });
    await expect(once).toBeVisible();
    await expect(page.getByTestId('timer')).toHaveCount(0);
    await once.click();
    const timer = page.getByTestId('timer');
    await expect(timer).toBeVisible();
    await expect(once).toHaveCount(0);
    // 開啟後焦點移到暫停按鈕（原本的按鈕已經不在）
    await expect(page.getByRole('button', { name: '暫停', exact: true })).toBeFocused();
    expect(await remainingSeconds(page)).toBeLessThanOrEqual(62);
    // 提醒預設開啟：剩 1 分鐘時在 status 區播報一次
    await expect(timer.getByRole('status')).toHaveText('剩 1 分鐘', { timeout: 10_000 });
    // 沒有改全站設定：鏡像裡的 timerEnabled 不是 true
    expect(await page.evaluate(() => (JSON.parse(localStorage.getItem('ll:settings') ?? '{}') as { timerEnabled?: unknown }).timerEnabled)).not.toBe(true);
    await page.locator('.ll-question').getByRole('radio', { name: '負債' }).check();
    await page.getByRole('button', { name: '確認答案' }).click();
    await expect(page.locator('.ll-feedback__title')).toBeFocused();
    await page.getByRole('button', { name: '下一題' }).click();
    await expect(page.getByTestId('result-title')).toHaveText('完成了！');
    // 成績小卡「用時」：數字放大、單位小字；下面的說明寫「計時不影響星星」
    await expect(page.getByTestId('result-time').locator('dd')).toHaveText(/^\d+ 秒$/);
    await expect(page.getByText(/計時不影響星星。/)).toBeVisible();
    const used = Number(/(\d+) 秒/.exec(await page.getByTestId('result-time').innerText())![1]);
    expect(used).toBeGreaterThanOrEqual(2);
    // 再挑戰：單次開啟只算這一輪，回到全站設定（關閉）
    await page.getByRole('button', { name: '再挑戰' }).click();
    await expect(page.getByText('第 1 題，共 1 題')).toBeVisible();
    await expect(page.getByTestId('timer')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '這一關計時' })).toBeVisible();
    await assertCsp();
  });

  test('沒有計時的關卡結果頁不顯示用時；設定關閉提醒後，剩 1 分鐘不播報', async ({ page }) => {
    await installTimedLevel(page);
    await page.goto(`/level/${TIMED_LEVEL_ID}/`);
    await waitForApp(page);
    await page.locator('.ll-question').getByRole('radio', { name: '負債' }).check();
    await page.getByRole('button', { name: '確認答案' }).click();
    // 第一題確認之後就不再提供單次開啟
    await expect(page.getByRole('button', { name: '這一關計時' })).toHaveCount(0);
    await page.getByRole('button', { name: '下一題' }).click();
    await expect(page.getByTestId('result-title')).toHaveText('完成了！');
    await expect(page.getByTestId('result-time')).toHaveCount(0);

    await page.goto('/me/settings/');
    await waitForApp(page);
    const announce = page.getByRole('switch', { name: '剩 1 分鐘與時間到時提醒' });
    await expect(announce).toBeEnabled();
    await announce.click();
    await expect.poll(() => readSetting(page, 'timerAnnounce')).toBe(false);
    await page.goto(`/level/${TIMED_LEVEL_ID}/`);
    await waitForApp(page);
    await page.getByRole('button', { name: '這一關計時' }).click();
    const timer = page.getByTestId('timer');
    await expect(timer).toBeVisible();
    await expect.poll(() => remainingSeconds(page), { timeout: 10_000 }).toBeLessThanOrEqual(58);
    await expect(timer.getByRole('status')).toHaveText('');
  });
});

test.describe('取捨題的收藏', () => {
  test('按「收藏」後出現在「我的」的收藏清單；回到作答頁取消後清單變空', async ({ page }) => {
    const assertCsp = await watchCsp(page);
    await page.goto(`/level/${LEVEL_UNSCORED}/`);
    await waitForApp(page);
    await expect(page.getByText(/^第 1 題，共 \d+ 題$/)).toBeVisible();
    const anchorId = await page.locator('[id^="ll-q-"]').first().getAttribute('id');
    const questionId = anchorId!.slice('ll-q-'.length);
    await page.locator('.ll-question').getByRole('radio').first().check();
    await page.getByRole('button', { name: '確認答案' }).click();
    await expect(page.locator('.ll-feedback__title')).toHaveText('解說觀點');

    // 收藏是切換按鈕（站規 2.4.1）：文字固定「收藏」，狀態看 aria-pressed
    const favourite = page.getByRole('button', { name: '收藏', exact: true });
    await expect(favourite).toHaveAttribute('aria-pressed', 'false');
    await favourite.click();
    await expect(favourite).toHaveAttribute('aria-pressed', 'true');
    // 等收藏與作答暫存都寫進資料庫再跳頁（跳頁會中斷還沒完成的交易）
    await expect.poll(() => readSetting(page, 'favourites')).toEqual([questionId]);
    await waitForConfirmedInSessionCache(page, LEVEL_UNSCORED, questionId);

    await page.goto('/me/');
    await waitForApp(page);
    const item = page.getByTestId('favourites').locator(`[data-question-id="${questionId}"]`);
    await expect(item).toBeVisible();
    await expect(item.getByRole('link', { name: LEVEL_UNSCORED_TITLE })).toHaveAttribute('href', `/level/${LEVEL_UNSCORED}/`);

    // 回到作答頁：已確認的作答從暫存還原，收藏狀態在第一次繪製後讀到；再按一次取消
    await page.goto(`/level/${LEVEL_UNSCORED}/`);
    await waitForApp(page);
    await expect(favourite).toHaveAttribute('aria-pressed', 'true');
    await favourite.click();
    await expect(favourite).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => readSetting(page, 'favourites')).toEqual([]);

    await page.goto('/me/');
    await waitForApp(page);
    await expect(page.getByTestId('favourites-empty')).toBeVisible();
    await expect(page.locator(`[data-question-id="${questionId}"]`)).toHaveCount(0);
    await assertCsp();
  });
});
