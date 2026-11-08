// 報表實驗室（M4a，03 第 3 節、10 第 11.1 節）：首頁、故事步驟列表、步驟頁練習模式的 10 個階段（預測閘門、揭曉、報表、燈號、指標、完成與進度）、
// 練過才有的跳到最後、示範模式（9 個階段、沒有預測、隨時跳到最後、進度只往前、選單換模式）、方向鍵、自由實驗（擋下與可輸入範圍、連動清單、插入與本筆無影響、重設）、勾稽練習（三格、提示三層、完成卡）、
// 指標實驗室（分組、版本切換、N/A 的建議）、英文介面。等待一律用 expect 的自動重試。
import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { waitForApp } from './helpers.ts';

const STORY = 'story_ywv2dy';
const STEP1 = 'st_9htcrg';
const STEP7 = 'st_98tppx';
const STEP6 = 'st_g4h3hx';
const STEP12 = 'st_q5rssq';

function readLabState(page: Page): Promise<unknown[]> {
  return page.evaluate(
    () =>
      new Promise<unknown[]>((resolve) => {
        const req = indexedDB.open('ledgerland');
        req.onerror = () => resolve([]);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('labState')) {
            db.close();
            resolve([]);
            return;
          }
          const r = db.transaction('labState').objectStore('labState').getAll();
          r.onsuccess = () => {
            db.close();
            resolve(r.result as unknown[]);
          };
          r.onerror = () => {
            db.close();
            resolve([]);
          };
        };
      }),
  );
}

/** 替預測面板的每個目標選「增加」或「上升」 */
async function predictAllUp(page: Page): Promise<void> {
  const panel = page.getByTestId('lab-predict');
  await expect(panel).toBeVisible();
  const radios = panel.getByRole('radio', { name: /^(增加|▲ 上升|Increase|▲ Up)$/ });
  const n = await radios.count();
  expect(n).toBeGreaterThanOrEqual(6);
  for (let i = 0; i < n; i++) await radios.nth(i).check();
  await page.getByTestId('lab-predict-submit').click();
}

test.describe('實驗室首頁與故事步驟列表', () => {
  test('首頁：故事卡（綠芽商行、進度 0）、四個入口、授權標示；英文介面', async ({ page }) => {
    await page.goto('/lab/');
    await waitForApp(page);
    const hero = page.getByTestId('lab-hero');
    await expect(hero).toContainText('綠芽商行');
    await expect(hero).toContainText('經陳彥宏老師授權使用');
    // 故事卡在首頁就給兩種走法（2026-11-02）：練習是主按鈕、示範是次要，下方一行說明
    await expect(page.getByTestId('lab-continue')).toHaveText('開始練習');
    await expect(page.getByTestId('lab-continue')).toHaveAttribute('href', `/lab/story/${STORY}/${STEP1}/`);
    await expect(page.getByTestId('lab-demo')).toHaveText('先看示範');
    await expect(page.getByTestId('lab-demo')).toHaveAttribute('href', `/lab/story/${STORY}/${STEP1}/?mode=demo`);
    await expect(page.getByTestId('lab-modes-note')).toContainText('示範沒有預測');
    await expect(page.getByTestId('lab-story-link')).toHaveText('看全部步驟');
    await expect(page.getByRole('link', { name: /^故事/ })).toContainText('每一步都有示範與練習兩種走法');
    await expect(page.getByRole('link', { name: /自由實驗/ })).toHaveAttribute('href', '/lab/sandbox/');
    await expect(page.getByRole('link', { name: /指標實驗室/ })).toHaveAttribute('href', '/lab/ratios/');
    await page.goto('/en/lab/');
    await waitForApp(page);
    await expect(page.getByTestId('lab-hero')).toContainText('Green Bud Trading');
    await expect(page.getByTestId('lab-continue')).toHaveText('Start practising');
    await expect(page.getByTestId('lab-demo')).toHaveText('Watch the demo first');
  });

  test('故事步驟列表：五章、18 步、每步有示範與練習、章末相關關卡', async ({ page }) => {
    await page.goto(`/lab/story/${STORY}/`);
    await waitForApp(page);
    await expect(page.getByTestId('lab-chapter')).toHaveCount(5);
    await expect(page.getByTestId('lab-step-row')).toHaveCount(18);
    await expect(page.getByTestId('lab-step-demo').first()).toHaveAttribute('href', `/lab/story/${STORY}/st_9htcrg/?mode=demo`);
    await expect(page.getByTestId('lab-step-demo').first()).toHaveText('示範');
    await expect(page.getByTestId('lab-step-practice').first()).toHaveAttribute('href', `/lab/story/${STORY}/st_9htcrg/`);
    await expect(page.getByTestId('lab-step-practice').first()).toHaveText('練習');
    await expect(page.getByRole('heading', { name: '相關關卡' }).first()).toBeVisible();
  });

  test('故事步驟列表的排列：同一章的步驟一列一張、由上往下，步驟卡和清單一樣寬', async ({ page }) => {
    // 2026-11-06：另一個元件誤用了同名的 class，600px 以上的螢幕每一章的步驟被排成並排的幾欄、名稱擠成一字一行，
    // 原本的案例只檢查連結與文字、沒有抓到。這裡不比絕對座標，只比同一章裡步驟卡彼此與清單的相對位置
    await page.goto(`/lab/story/${STORY}/`);
    await waitForApp(page);
    await expect(page.getByTestId('lab-step-row')).toHaveCount(18);
    const boxes = await page
      .getByTestId('lab-chapter')
      .first()
      .evaluate((chapter) => {
        const list = chapter.querySelector('ol')!.getBoundingClientRect();
        const rows = [...chapter.querySelectorAll('[data-testid="lab-step-row"]')].map((el) => el.getBoundingClientRect());
        return { list: { left: list.left, width: list.width }, rows: rows.map((r) => ({ top: r.top, bottom: r.bottom, left: r.left, width: r.width })) };
      });
    expect(boxes.rows.length).toBeGreaterThan(1);
    for (let i = 1; i < boxes.rows.length; i++) {
      // 下一張在上一張的下方，左緣對齊（不是並排）
      expect(boxes.rows[i]!.top).toBeGreaterThanOrEqual(boxes.rows[i - 1]!.bottom - 1);
      expect(Math.abs(boxes.rows[i]!.left - boxes.rows[0]!.left)).toBeLessThanOrEqual(1);
    }
    for (const row of boxes.rows) expect(row.width).toBeGreaterThanOrEqual(boxes.list.width - 1);
  });
});

test.describe('故事步驟頁', () => {
  test('練習：第 7 步從頭走到尾，預測閘門、揭曉、三表、燈號、指標、意涵與利害關係人、完成後進度寫入', async ({ page }) => {
    await page.goto(`/lab/story/${STORY}/${STEP7}/`);
    await waitForApp(page);
    await expect(page.getByTestId('lab-stage-title')).toHaveText('階段 1／10：交易卡');
    await expect(page.getByTestId('lab-card')).toContainText('3,000,000');
    await expect(page.getByTestId('lab-inferred')).toBeVisible();
    await expect(page.getByTestId('lab-card-terms').getByRole('button')).toHaveCount(4);
    await page.getByTestId('lab-next').click();
    await expect(page.getByTestId('lab-stage-title')).toHaveText('階段 2／10：預測');
    // 預測沒完成不能前進；第一次練這一步沒有「跳到最後一個階段」（預測完也沒有，要一階段一階段看）
    await expect(page.getByTestId('lab-next')).toBeDisabled();
    await expect(page.getByTestId('lab-skip')).toHaveCount(0);
    await predictAllUp(page);
    await expect(page.getByTestId('lab-next')).toBeEnabled();
    await page.getByRole('button', { name: '階段 2／10：預測' }).click();
    // 第一次練：階段選單只能跳回走過的階段，前面的階段都停用（2026-11-02）
    await expect(page.getByRole('menuitem', { name: '1. 交易卡' })).toBeEnabled();
    await expect(page.getByRole('menuitem', { name: '3. 科目變動' })).toBeDisabled();
    await expect(page.getByRole('menuitem', { name: '10. 管理意涵' })).toBeDisabled();
    await expect(page.getByTestId('lab-skip')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.getByTestId('lab-next').click();
    await expect(page.getByTestId('lab-stage-title')).toHaveText('階段 3／10：科目變動');
    const effects = page.getByTestId('lab-effects');
    await expect(effects.locator('li')).toHaveCount(4);
    await expect(effects.locator('[data-account="cash"]')).toContainText('3,000,000');
    await expect(page.getByTestId('lab-cash-verdict')).toHaveText('你的預測正確');
    // 揭曉卡：第 7 步有 8 個目標（現金、五層利益加故事另訂的兩個），全選「增加」時只有存貨那一個錯
    const reveal = page.getByTestId('lab-reveal');
    await expect(reveal.getByRole('heading')).toHaveText('揭曉：8 個猜對 7 個');
    await expect(reveal.locator('li')).toHaveCount(8);
    await expect(reveal.locator('li[data-correct="false"]')).toHaveCount(1);
    await expect(reveal.locator('li[data-correct="false"]')).toContainText('你猜增加，實際是減少');
    await expect(reveal.locator('li').first()).toContainText('你猜增加，答對了');
    await expect(reveal.locator('li').first()).toContainText('NT$450,000 → NT$3,450,000');
    // 分錄層預設收合，展開後有分錄與 T 字帳
    await expect(page.getByTestId('lab-journal-entry')).toBeHidden();
    await page.locator('.ll-lab-journal summary').click();
    await expect(page.getByTestId('lab-journal-entry')).toBeVisible();
    await expect(page.getByTestId('lab-taccounts').locator('table')).toHaveCount(4);
    await page.getByTestId('lab-next').click();
    await expect(page.getByTestId('lab-scale-verdict')).toHaveText('兩邊相等');
    await page.getByTestId('lab-next').click();
    await expect(page.getByTestId('lab-stage-title')).toHaveText('階段 5／10：損益表');
    await expect(page.getByTestId('lab-summary')).toContainText('本筆變動');
    await expect(page.getByTestId('lab-level-verdicts').locator('li')).toHaveCount(5);
    await expect(page.locator('#ll-lab-table-is .ll-lab-row.is-changed').first()).toBeVisible();
    // 更新動態：沒有減少動態時，變動列有脈衝動畫、變動格的金額會滾動（滾完和交易後的金額一樣）
    await expect(page.locator('.ll-lab-session__content')).toHaveClass(/ll-lab-animate/);
    expect(
      await page
        .locator('#ll-lab-table-is .ll-lab-row.is-changed td')
        .first()
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe('ll-lab-pulse');
    await expect(page.locator('#ll-lab-table-is [data-line="is_revenue"] .ll-lab-roll')).toHaveText('NT$3,000,000');
    await expect(page.locator('#ll-lab-table-is [data-line="is_revenue"] .ll-lab-roll')).not.toHaveAttribute('data-rolling', 'true');
    await page.getByTestId('lab-next').click();
    await expect(page.getByTestId('lab-stage-title')).toHaveText('階段 6／10：現金流量表');
    await page.getByTestId('lab-next').click();
    await expect(page.getByTestId('lab-stage-title')).toHaveText('階段 7／10：資產負債表');
    await page.getByTestId('lab-next').click();
    await expect(page.getByTestId('lab-stage-title')).toHaveText('階段 8／10：勾稽燈號');
    for (const s of [2, 3, 4, 5]) await expect(page.getByTestId(`lab-light-${s}`)).toHaveAttribute('data-state', 'pass');
    await expect(page.getByTestId('lab-live')).toHaveText('四個勾稽點都相符。');
    await page.getByTestId('lab-next').click();
    await expect(page.getByTestId('lab-stage-title')).toHaveText('階段 9／10：指標變化');
    await expect(page.getByTestId('lab-ratios-changed').locator('li').first()).toBeVisible();
    await page.getByTestId('lab-next').click();
    await expect(page.getByTestId('lab-stage-title')).toHaveText('階段 10／10：管理意涵');
    await expect(page.getByTestId('lab-stakeholders').locator('li')).toHaveCount(2);
    await page.getByTestId('lab-next').click();
    const card = page.getByTestId('lab-finished');
    await expect(card).toContainText('這一步走完了');
    await expect(page.getByTestId('lab-finish-score')).toHaveText('這一步的預測猜對 7／8；整個故事到目前 7／8（1 步）');
    await expect(page.getByTestId('lab-next-step')).toHaveAttribute('href', `/lab/story/${STORY}/st_skx6ss/`);
    await expect(card.getByRole('button', { name: '再練一次' })).toBeVisible();
    await expect.poll(() => readLabState(page)).toEqual([expect.objectContaining({ storyId: STORY, stepId: STEP7 })]);
    // 故事列表標記練習過與這一步的成績
    await page.goto(`/lab/story/${STORY}/`);
    await waitForApp(page);
    await expect(page.locator(`[data-step="${STEP7}"]`)).toContainText('練習過，猜對 7／8');
    await page.goto('/lab/');
    await waitForApp(page);
    await expect(page.getByTestId('lab-continue')).toHaveText('練習第 8 步');
    await expect(page.getByTestId('lab-demo')).toHaveText('示範第 8 步');
    await expect(page.getByTestId('lab-demo')).toHaveAttribute('href', /\?mode=demo$/);
  });

  test('核心晚到：交易卡與預測先用快照的數字出現，「下一步」等核心載好才切到階段 3，成績照常存（V24）', async ({ page }) => {
    // 把核心包裝的 chunk 攔下來不回應：畫面掀開後頁面會自己來抓，先讓它等著
    const held: Route[] = [];
    const coreChunk = /\/assets\/lab-core-[^/]+\.js$/;
    await page.route(coreChunk, (route) => {
      held.push(route);
    });
    await page.goto(`/lab/story/${STORY}/${STEP7}/`);
    await waitForApp(page);
    await expect(page.getByTestId('lab-session')).toHaveAttribute('data-core', 'pending');
    await expect(page.getByTestId('lab-equation')).toHaveText('資產總計 NT$4,250,000 ＝ 負債總額 NT$0 ＋ 股東權益總額 NT$4,250,000');
    await expect(page.getByTestId('lab-card')).toContainText('3,000,000');
    await page.getByTestId('lab-next').click();
    await expect(page.getByTestId('lab-stage-title')).toHaveText('階段 2／10：預測');
    await predictAllUp(page);
    await expect.poll(() => held.length).toBeGreaterThan(0);
    await page.getByTestId('lab-next').click();
    // 核心還沒到：停在階段 2，按鈕沒有變成不能按
    await expect(page.getByTestId('lab-stage-title')).toHaveText('階段 2／10：預測');
    await expect(page.getByTestId('lab-next')).toBeEnabled();
    // 放行；之後（故事頁）的核心請求不再攔（unroute 會把還攔著的請求一起處理掉，所以先放行再解除）
    for (const r of held.splice(0)) await r.continue();
    await page.unroute(coreChunk);
    await expect(page.getByTestId('lab-stage-title')).toHaveText('階段 3／10：科目變動');
    await expect(page.getByTestId('lab-session')).toHaveAttribute('data-core', 'ready');
    await expect(page.getByTestId('lab-reveal').getByRole('heading')).toHaveText('揭曉：8 個猜對 7 個');
    // 核心載好以後恆等式的數字沒有變（快照的數字就是同一份核心算的）
    await expect(page.getByTestId('lab-equation')).toContainText('NT$4,250,000');
    // 成績在核心載好之後才算、照常存進進度：第一次練只能用「下一步」一階段一階段走到最後，走完這一步後故事頁顯示預測成績
    for (let i = 3; i < 10; i++) {
      await page.getByTestId('lab-next').click();
      await expect(page.getByTestId('lab-stagebar')).toHaveAttribute('data-stage', String(i));
    }
    await expect(page.getByTestId('lab-stage-title')).toHaveText('階段 10／10：管理意涵');
    await page.getByTestId('lab-next').click();
    await expect(page.getByTestId('lab-finish-score')).toHaveText('這一步的預測猜對 7／8；整個故事到目前 7／8（1 步）');
    await page.goto(`/lab/story/${STORY}/`);
    await waitForApp(page);
    await expect(page.getByTestId('lab-story-score')).toHaveText('預測成績：1 步猜對 7／8');
    // 練過的步驟再回來：階段選單多一項「跳到最後一個階段」，按了直接到階段 10
    await page.goto(`/lab/story/${STORY}/${STEP7}/`);
    await waitForApp(page);
    await page.getByRole('button', { name: '階段 1／10：交易卡' }).click();
    await page.getByTestId('lab-skip').click();
    await expect(page.getByTestId('lab-stage-title')).toHaveText('階段 10／10：管理意涵');
  });

  test('示範：沒有預測的 9 個階段、隨時跳到最後、完成卡；進度只往前；階段選單換成練習', async ({ page }) => {
    await page.goto(`/lab/story/${STORY}/${STEP7}/?mode=demo`);
    await waitForApp(page);
    await expect(page.getByTestId('lab-demo-flag')).toBeVisible();
    // 從中間開始：示範有前情摘要，但沒有「建議先走完前面的步驟」的提示（投影時不該看到）
    await expect(page.getByTestId('lab-recap')).toContainText('到上一步為止');
    await expect(page.locator('.ll-lab-card__suggest')).toHaveCount(0);
    await expect(page.getByTestId('lab-stage-title')).toHaveText('階段 1／9：交易卡');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('lab-stage-title')).toHaveText('階段 2／9：科目變動');
    await expect(page.getByTestId('lab-effects').locator('li')).toHaveCount(4);
    // 沒有預測就沒有揭曉與對錯
    await expect(page.getByTestId('lab-reveal')).toHaveCount(0);
    await expect(page.getByTestId('lab-cash-verdict')).toHaveCount(0);
    // 示範隨時可以跳到最後
    await page.getByRole('button', { name: '階段 2／9：科目變動' }).click();
    await page.getByTestId('lab-skip').click();
    await expect(page.getByTestId('lab-stage-title')).toHaveText('階段 9／9：管理意涵');
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('lab-stage-title')).toHaveText('階段 8／9：指標變化');
    await page.getByTestId('lab-next').click();
    await page.getByTestId('lab-next').click();
    const card = page.getByTestId('lab-finished');
    await expect(card).toContainText('這一步看完了');
    await expect(page.getByTestId('lab-finish-score')).toHaveCount(0);
    await expect(page.getByTestId('lab-next-step')).toHaveAttribute('href', `/lab/story/${STORY}/st_skx6ss/?mode=demo`);
    await expect(card.getByRole('link', { name: '回到故事地圖' })).toHaveAttribute('href', `/lab/story/${STORY}/`);
    await expect(page.getByTestId('lab-practise-now')).toHaveAttribute('href', `/lab/story/${STORY}/${STEP7}/`);
    // 示範也算走完：進度移到第 7 步；故事頁標記看過示範
    await expect.poll(() => readLabState(page)).toEqual([expect.objectContaining({ storyId: STORY, stepId: STEP7 })]);
    await page.goto(`/lab/story/${STORY}/`);
    await waitForApp(page);
    await expect(page.locator(`[data-step="${STEP7}"]`)).toContainText('看過示範');
    // 進度只往前：再示範第 6 步，進度留在第 7 步
    await page.goto(`/lab/story/${STORY}/${STEP6}/?mode=demo`);
    await waitForApp(page);
    await page.getByRole('button', { name: '階段 1／9：交易卡' }).click();
    await page.getByTestId('lab-skip').click();
    // 核心載好才切到最後一個階段，先等它
    await expect(page.getByTestId('lab-stage-title')).toHaveText('階段 9／9：管理意涵');
    await page.getByTestId('lab-next').click();
    await expect(page.getByTestId('lab-finished')).toBeVisible();
    await expect.poll(() => readLabState(page)).toEqual([expect.objectContaining({ storyId: STORY, stepId: STEP7 })]);
    // 階段選單換成練習：回到交易卡、10 個階段、預測必填
    await page.getByRole('button', { name: '階段 9／9：管理意涵' }).click();
    await page.getByTestId('lab-switch-mode').click();
    await expect(page).toHaveURL(new RegExp(`/lab/story/${STORY}/${STEP6}/$`));
    await expect(page.getByTestId('lab-stage-title')).toHaveText('階段 1／10：交易卡');
    await expect(page.getByTestId('lab-demo-flag')).toHaveCount(0);
    await page.getByTestId('lab-next').click();
    await expect(page.getByTestId('lab-stage-title')).toHaveText('階段 2／10：預測');
    await expect(page.getByTestId('lab-next')).toBeDisabled();
    // 再換回示範：帶著 ?mode=demo、9 個階段
    await page.getByRole('button', { name: '階段 2／10：預測' }).click();
    await page.getByTestId('lab-switch-mode').click();
    await expect(page).toHaveURL(/\?mode=demo$/);
    await expect(page.getByTestId('lab-stage-title')).toHaveText('階段 1／9：交易卡');
  });

  test('記下預測之後又改了選項：沒按「更新預測」時揭曉仍是記下的那一份，按了才換；完成卡和揭曉同一個成績', async ({ page }) => {
    await page.goto(`/lab/story/${STORY}/${STEP7}/`);
    await waitForApp(page);
    await page.getByTestId('lab-next').click();
    await predictAllUp(page);
    const note = page.getByTestId('lab-predict-note');
    await expect(note).toHaveText('已記下你的預測。');
    await page.getByTestId('lab-next').click();
    const reveal = page.getByTestId('lab-reveal').getByRole('heading');
    await expect(reveal).toHaveText('揭曉：8 個猜對 7 個');
    // 回到預測改掉現金（第一個目標），不按「更新預測」就往下走：面板提示，揭曉不變
    await page.locator('#ll-lab-prev').click();
    await page
      .getByTestId('lab-predict')
      .getByRole('radio', { name: /^減少$/ })
      .first()
      .check();
    await expect(note).toHaveText('改過的選項要按「更新預測」才算數。');
    await page.getByTestId('lab-next').click();
    await expect(reveal).toHaveText('揭曉：8 個猜對 7 個');
    await expect(page.getByTestId('lab-reveal-recorded')).toHaveCount(0);
    // 按了「更新預測」才換，完成卡和揭曉一致
    await page.locator('#ll-lab-prev').click();
    await page.getByTestId('lab-predict-submit').click();
    await expect(note).toHaveText('已記下你的預測。');
    await page.getByTestId('lab-next').click();
    await expect(reveal).toHaveText('揭曉：8 個猜對 6 個');
    for (let i = 3; i < 10; i++) {
      await page.getByTestId('lab-next').click();
      await expect(page.getByTestId('lab-stagebar')).toHaveAttribute('data-stage', String(i));
    }
    await page.getByTestId('lab-next').click();
    await expect(page.getByTestId('lab-finish-score')).toContainText('這一步的預測猜對 6／8');
  });

  test('英文介面：階段標題與預測面板', async ({ page }) => {
    await page.goto(`/en/lab/story/${STORY}/${STEP7}/`);
    await waitForApp(page);
    await expect(page.getByTestId('lab-stage-title')).toHaveText('Stage 1 of 10: Transaction card');
    await expect(page.getByTestId('lab-card')).toContainText('NT$3,000,000');
    await page.getByTestId('lab-next').click();
    await predictAllUp(page);
    await page.getByTestId('lab-next').click();
    await expect(page.getByTestId('lab-cash-verdict')).toHaveText('Your prediction was right');
  });
});

test.describe('自由實驗', () => {
  test('改金額：被擋下顯示可輸入範圍；上游改小讓下游跟著變；插入一步金額 0 是本筆無影響；重設', async ({ page }) => {
    await page.goto('/lab/sandbox/');
    await waitForApp(page);
    await expect(page.getByTestId('lab-sandbox-step')).toHaveCount(18);
    // 第 12 步收回應收帳款最多 15,000,000（第 10 步賒銷的金額）
    const step12 = page.locator(`[data-step="${STEP12}"]`);
    await step12.getByRole('textbox').fill('99999999999');
    await step12.getByTestId('lab-sandbox-apply').click();
    await expect(step12).toContainText('最多可以輸入 NT$15,000,000');
    await step12.getByRole('textbox').fill('3000000');
    await step12.getByTestId('lab-sandbox-apply').click();
    await expect(step12).not.toContainText('最多可以輸入');
    // 第 6 步進貨改成 1,600,000：第 7 步的成本跟著變
    const step6 = page.locator(`[data-step="${STEP6}"]`);
    await step6.getByRole('textbox').fill('1600000');
    await step6.getByTestId('lab-sandbox-apply').click();
    await expect(page.getByTestId('lab-affected')).toContainText('第 7 步');
    await expect(page.getByTestId('lab-affected')).toContainText('NT$1,500,000 → NT$1,600,000');
    await page.getByTestId('lab-sandbox-reset').click();
    await expect(page.getByTestId('lab-affected')).toHaveCount(0);
    // 從指標實驗室帶 ?insert= 進來：插在最後、金額 0、本筆無影響
    await page.goto('/lab/sandbox/?insert=tpl.borrow_short_term');
    await waitForApp(page);
    await expect(page.getByTestId('lab-sandbox-step')).toHaveCount(19);
    await expect(page.getByTestId('lab-sandbox-noeffect')).toHaveCount(1);
    await expect(page).toHaveURL(/\/lab\/sandbox\/$/);
  });

  test('英文介面：被擋下的訊息帶得到上限與下限，天平的播報有結論（英文 catalog 的佔位符和原始碼一樣）', async ({ page }) => {
    await page.goto('/en/lab/sandbox/');
    await waitForApp(page);
    const step12 = page.locator(`[data-step="${STEP12}"]`);
    await step12.getByRole('textbox').fill('99999999999');
    await step12.getByTestId('lab-sandbox-apply').click();
    await expect(step12).toContainText(/You can enter up to NT\$15,000,000 for this step, and at least NT\$\d/);
    await page.goto(`/en/lab/story/${STORY}/${STEP7}/?mode=demo`);
    await waitForApp(page);
    for (let s = 2; s <= 3; s++) {
      await page.getByTestId('lab-next').click();
      await expect(page.getByTestId('lab-stage-title')).toContainText(`Stage ${s} of 9`);
    }
    await expect(page.getByTestId('lab-scale-summary')).toContainText('The two sides are equal.');
  });

  test('刪除會讓後面算不下去的步驟被擋下並說明原因；刪除可以復原；全部拿掉不會壞掉，可以加第一步或還原', async ({ page }) => {
    await page.goto('/lab/sandbox/');
    await waitForApp(page);
    const steps = page.getByTestId('lab-sandbox-step');
    await expect(steps).toHaveCount(18);
    // 一開始有玩法說明，沒有還原的按鈕（還沒有修改）
    await expect(page.getByTestId('lab-sandbox-guide')).toContainText('可以這樣玩');
    await expect(page.getByTestId('lab-sandbox-status')).toHaveText('現在和故事原本一模一樣。');
    await expect(page.getByTestId('lab-sandbox-reset')).toHaveCount(0);
    // 刪第 1 步（股東出資）：第 2 步會沒有現金，擋下並寫在卡片上，步驟一步都沒少
    const step1 = page.locator(`[data-step="${STEP1}"]`);
    await step1.getByRole('button', { name: '刪除第 1 步' }).click();
    await expect(step1.locator('.ll-lab-sbstep__issue')).toContainText('這一步先留著：刪掉之後，第 2 步');
    await expect(steps).toHaveCount(18);
    await expect(page.getByTestId('lab-sandbox-broken')).toHaveCount(0);
    // 刪最後一步：可以，浮動提示有「復原」
    await steps.last().getByRole('button', { name: '刪除第 18 步' }).click();
    await expect(steps).toHaveCount(17);
    await expect(page.getByTestId('lab-sandbox-status')).toHaveText('目前改了 1 個地方。');
    const toasts = page.getByTestId('lab-sandbox-toasts');
    await expect(toasts).toContainText('已刪除第 18 步');
    await toasts.getByRole('button', { name: '復原' }).click();
    await expect(steps).toHaveCount(18);
    // 從最後一步往前全部拿掉：出空白狀態，報表區收起來，頁面沒有壞掉
    for (let n = 18; n >= 1; n--) {
      await steps
        .last()
        .getByRole('button', { name: `刪除第 ${n} 步` })
        .click();
      await expect(steps).toHaveCount(n - 1);
    }
    const empty = page.getByTestId('lab-sandbox-empty');
    await expect(empty).toContainText('步驟都拿掉了');
    await expect(page.getByTestId('lab-sandbox-result')).toHaveCount(0);
    // 重新整理後還是空白狀態（狀態存在本機），不是錯誤頁
    await page.reload();
    await waitForApp(page);
    await expect(empty).toBeVisible();
    // 選第一步：回到一步，報表回來
    await empty.getByRole('button', { name: '股東出資成立公司' }).click();
    await expect(steps).toHaveCount(1);
    await expect(page.getByTestId('lab-sandbox-result')).toBeVisible();
    // 還原：18 步都回來
    await page.getByTestId('lab-sandbox-reset').click();
    await expect(steps).toHaveCount(18);
    await expect(page.getByTestId('lab-sandbox-status')).toHaveText('現在和故事原本一模一樣。');
  });

  test('以前存下來、已經算不下去的狀態：橫幅說明是哪一步、為什麼，按還原就回到故事原本的樣子', async ({ page }) => {
    await page.goto('/lab/sandbox/');
    await waitForApp(page);
    const steps = page.getByTestId('lab-sandbox-step');
    // 先做一個修改，讓本機有一筆自由實驗的狀態
    const step6 = page.locator(`[data-step="${STEP6}"]`);
    await step6.getByRole('textbox').fill('1600000');
    await step6.getByTestId('lab-sandbox-apply').click();
    await expect(page.getByTestId('lab-sandbox-toasts')).toContainText('已套用');
    // 把它改成舊版會留下的樣子：第 1 步被拿掉，後面的步驟還在
    await expect
      .poll(() =>
        page.evaluate(async (first) => {
          const open = indexedDB.open('ledgerland');
          const db = await new Promise<IDBDatabase>((res, rej) => {
            open.onsuccess = () => res(open.result);
            open.onerror = () => rej(open.error);
          });
          const tx = db.transaction('labSandbox', 'readwrite');
          const store = tx.objectStore('labSandbox');
          const all = await new Promise<{ removed: string[]; overrides: unknown[] }[]>((res) => {
            const r = store.getAll();
            r.onsuccess = () => res(r.result);
          });
          for (const rec of all) store.put({ ...rec, removed: [first], overrides: [] });
          await new Promise((res) => (tx.oncomplete = res));
          db.close();
          return all.length;
        }, STEP1),
      )
      .toBe(1);
    await page.reload();
    await waitForApp(page);
    const broken = page.getByTestId('lab-sandbox-broken');
    await expect(broken).toContainText('這份實驗現在算不下去');
    await expect(broken).toContainText('第 1 步「購買辦公事務用品」做不到');
    await expect(steps).toHaveCount(17);
    await broken.getByRole('button', { name: '還原成故事原本的樣子' }).click();
    await expect(broken).toHaveCount(0);
    await expect(steps).toHaveCount(18);
    await expect(page.getByTestId('lab-sandbox-result')).toBeVisible();
  });
});

test.describe('勾稽練習', () => {
  test('三格：填錯燈號變紅並提示上游，用提示第三層取得答案，全部相符出完成卡', async ({ page }) => {
    await page.goto(`/lab/reconcile/?step=${STEP7}`);
    await waitForApp(page);
    for (const s of [2, 3, 4, 5]) await expect(page.getByTestId(`lab-light-${s}`)).toHaveAttribute('data-state', 'empty');
    const cells = ['cf_pretax_income', 'bs_cash', 'bs_retained_earnings'];
    await page.getByTestId(`lab-cell-${cells[0]}`).getByRole('textbox').fill('1');
    await page.getByTestId(`lab-cell-${cells[1]}`).getByRole('textbox').fill('1');
    await page.getByTestId(`lab-cell-${cells[2]}`).getByRole('textbox').fill('1');
    await expect(page.getByTestId('lab-light-2')).toHaveAttribute('data-state', 'fail');
    await expect(page.getByText(/先修正步驟 2 用到的格子/)).toBeVisible();
    for (const id of cells) {
      const cell = page.getByTestId(`lab-cell-${id}`);
      const hint = cell.getByRole('button', { name: /^需要提示：/ });
      await hint.click();
      await hint.click();
      await hint.click();
      const text = await cell.getByRole('status').textContent();
      const answer = (text ?? '').replace(/[^0-9-]/g, '');
      await cell.getByRole('textbox').fill(answer);
    }
    for (const s of [2, 3, 4, 5]) await expect(page.getByTestId(`lab-light-${s}`)).toHaveAttribute('data-state', 'pass');
    await expect(page.getByTestId('lab-reconcile-done')).toBeVisible();
  });

  test('選一步：按鈕打開面板，選了就換步驟、焦點回到按鈕；練完的步驟在面板裡標出來，重新載入後還在', async ({ page }) => {
    // 2026-11-06：原生下拉選單換成面板（Sheet 加 NavRow）。看得到的號碼牌是裝飾，可讀名稱用「第 n 步」開頭
    await page.goto(`/lab/reconcile/?step=${STEP7}`);
    await waitForApp(page);
    const trigger = page.getByTestId('lab-reconcile-step');
    const sheet = page.getByTestId('lab-step-sheet');
    await expect(trigger).toHaveAccessibleName(/^第 7 步/);
    await trigger.click();
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('listitem')).toHaveCount(18);
    await expect(page.getByTestId('lab-step-option-7')).toHaveAttribute('aria-current', 'location');
    await expect(page.getByTestId('lab-step-option-7')).toContainText('目前');
    // Esc 關閉，焦點回到按鈕，步驟沒有變
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAccessibleName(/^第 7 步/);
    // 選第 3 步：面板關閉、按鈕換成第 3 步、網址帶著那一步、焦點回到按鈕
    await trigger.click();
    await page.getByTestId('lab-step-option-3').click();
    await expect(sheet).toBeHidden();
    await expect(trigger).toHaveAccessibleName(/^第 3 步/);
    await expect(trigger).toBeFocused();
    await expect(page).toHaveURL(/[?&]step=/);
    await expect(page).not.toHaveURL(new RegExp(`step=${STEP7}`));
    // 用第三層提示填完第 3 步
    for (const id of ['cf_pretax_income', 'bs_cash', 'bs_retained_earnings']) {
      const cell = page.getByTestId(`lab-cell-${id}`);
      const hint = cell.getByRole('button', { name: /提示/ });
      await hint.click();
      await hint.click();
      await hint.click();
      const answer = ((await cell.getByRole('status').textContent()) ?? '').replace(/[^0-9-]/g, '');
      await cell.getByRole('textbox').fill(answer);
    }
    await expect(page.getByTestId('lab-reconcile-done')).toBeVisible();
    // 換到別的步驟再打開：第 3 步標「看過答案」，副標數到 1 步
    await trigger.click();
    await page.getByTestId('lab-step-option-4').click();
    await trigger.click();
    await expect(page.getByTestId('lab-step-option-3')).toContainText('看過答案');
    await expect(sheet).toContainText('已經練過 1／18 步');
    await page.keyboard.press('Escape');
    // 重新載入後從存下來的進度讀回來（寫入是非同步的，還沒寫完就再載入一次）
    await expect
      .poll(
        async () => {
          await page.goto(`/lab/reconcile/?step=${STEP7}`);
          await waitForApp(page);
          await trigger.click();
          const text = (await page.getByTestId('lab-step-option-3').textContent()) ?? '';
          await page.keyboard.press('Escape');
          return text;
        },
        { timeout: 20_000 },
      )
      .toContain('看過答案');
  });

  test('三張表不必左右捲：進階模式開更多格子後，每張表的內容都不比自己的欄位寬，整頁也不橫向捲', async ({ page }) => {
    // 2026-11-06：輸入列原本是「名稱一格、輸入框一格」，把表格撐得比欄位寬，三表並排時每張表都要左右捲才看得到金額
    await page.goto(`/lab/reconcile/?step=${STEP7}`);
    await waitForApp(page);
    await page.getByRole('switch').click();
    await expect(page.locator('[data-testid^="lab-cell-"]')).not.toHaveCount(3);
    // 填一格並按提示：讀到的數字與提示文字也算在寬度裡
    const cell = page.getByTestId('lab-cell-cf_pretax_income');
    await cell.getByRole('textbox').fill('1250000');
    await cell.getByRole('button', { name: /^需要提示：/ }).click();
    await expect(cell.getByRole('status')).toBeVisible();
    const widths = await page.evaluate(() => ({
      tables: [...document.querySelectorAll('.ll-lab-table')].map((el) => el.scrollWidth - el.clientWidth),
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(widths.tables).toHaveLength(3);
    for (const over of widths.tables) expect(over).toBeLessThanOrEqual(1);
    expect(widths.page).toBeLessThanOrEqual(1);
  });
});

test.describe('三張表在寬螢幕', () => {
  // 2026-11-06：視窗 1440 起每張表改成「交易前、交易後、本筆變動」三欄，但內容區最寬 1040px，每張表只有 336px 左右，
  // 現金流量表與資產負債表都要左右捲。改成量表格區的寬度：放不下三欄就維持一欄加「累計／本筆變動」切換。
  for (const width of [1440, 1920]) {
    test(`故事步驟頁 ${width}px：三表並排，每張表都不必左右捲，有「累計／本筆變動」的切換`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop-chromium' && testInfo.project.name !== 'desktop-firefox', '只看電腦寬度');
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/lab/story/${STORY}/${STEP1}/?mode=demo`);
      await waitForApp(page);
      // 一次按一下，等階段標題換了再按下一下（連按時，換階段的途中按下去可能沒有反應）
      for (let stage = 2; stage <= 5; stage++) {
        await page.getByTestId('lab-next').click();
        await expect(page.getByTestId('lab-stage-title')).toContainText(`階段 ${stage}／9`);
      }
      await expect(page.getByTestId('lab-stage-title')).toHaveText('階段 5／9：現金流量表');
      const tables = page.locator('.ll-lab-tables__grid .ll-lab-table');
      await expect(tables).toHaveCount(3);
      await expect(page.getByRole('radio', { name: '本筆變動' })).toBeVisible();
      const over = await page.evaluate(() => ({
        tables: [...document.querySelectorAll('.ll-lab-tables__grid .ll-lab-table')].map((el) => el.scrollWidth - el.clientWidth),
        page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      for (const o of over.tables) expect(o).toBeLessThanOrEqual(1);
      expect(over.page).toBeLessThanOrEqual(1);
    });
  }

  test('自由實驗 1440px：最後的三張表都不必左右捲', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium' && testInfo.project.name !== 'desktop-firefox', '只看電腦寬度');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/lab/sandbox/');
    await waitForApp(page);
    const tables = page.locator('.ll-lab-sandbox__result .ll-lab-table');
    await expect(tables).toHaveCount(3);
    const over = await page.evaluate(() =>
      [...document.querySelectorAll('.ll-lab-sandbox__result .ll-lab-table')].map((el) => el.scrollWidth - el.clientWidth),
    );
    for (const o of over) expect(o).toBeLessThanOrEqual(1);
  });
});

test.describe('報表的篩選', () => {
  test('「只看有變動的列」是設計系統的開關，不是原生核選框；打開後只剩有變動的列與小標', async ({ page }) => {
    await page.goto(`/lab/story/${STORY}/${STEP1}/?mode=demo`);
    await waitForApp(page);
    for (let stage = 2; stage <= 5; stage++) {
      await page.getByTestId('lab-next').click();
      await expect(page.getByTestId('lab-stage-title')).toContainText(`階段 ${stage}／9`);
    }
    await expect(page.locator('.ll-lab-tables input[type="checkbox"]')).toHaveCount(0);
    const only = page.getByRole('switch', { name: '只看有變動的列' });
    await expect(only).toHaveAttribute('aria-checked', 'false');
    const rows = page.locator('.ll-lab-tables__grid tbody tr');
    const all = await rows.count();
    await only.click();
    await expect(only).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => rows.count()).toBeLessThan(all);
    // 第 1 步股東出資：現金及約當現金有變動，還在
    await expect(page.locator('.ll-lab-tables__grid')).toContainText('NT$3,000,000');
    await only.click();
    await expect.poll(() => rows.count()).toBe(all);
  });
});

test.describe('指標實驗室', () => {
  test('分組、版本切換（杜邦）、N/A 的建議連到自由實驗', async ({ page }) => {
    await page.goto('/lab/ratios/');
    await waitForApp(page);
    await expect(page.getByTestId('lab-ratios-context')).toContainText('綠芽商行');
    await expect(page.getByRole('heading', { name: '資產結構' })).toBeVisible();
    await expect(page.locator('.ll-lab-ratio').first()).toBeVisible();
    await expect(page.getByTestId('lab-dupont')).toContainText('＝');
    await page.getByRole('radio', { name: '0-2 投影片' }).click();
    await expect(page.getByRole('heading', { name: '部門指標' })).toBeVisible();
    await expect(page.locator('.ll-lab-ratio[data-ratio="equity_multiplier@slides02"]')).toBeVisible();
    await page.getByRole('radio', { name: 'Excel 版' }).click();
    const na = page.locator('.ll-lab-ratio.is-na').first();
    await expect(na).toBeVisible();
    await expect(na.getByRole('link')).toHaveAttribute('href', /\/lab\/sandbox\//);
  });
});

test.describe('來源面板（M4b，03 第 3.9 節）', () => {
  const DEMO7 = `/lab/story/${STORY}/${STEP7}/?mode=demo`;
  /** 節點自己那一列的按鈕（原地展開之後，子節點的按鈕也在 li 裡面，要限定在直接的那一列） */
  const rowButton = (item: Locator, testId: string) => item.locator(':scope > .ll-lab-trace__row').getByTestId(testId);
  /** 示範模式一次按一下「下一步」到第 n 個階段（示範有 9 個階段，階段 4 是損益表、6 是資產負債表、8 是指標變化） */
  async function toStage(page: Page, n: number, from = 1): Promise<void> {
    for (let s = from + 1; s <= n; s++) {
      await page.getByTestId('lab-next').click();
      await expect(page.getByTestId('lab-stage-title')).toContainText(`階段 ${s}／9`);
    }
  }
  const value = (page: Page, table: 'is' | 'cf' | 'bs', line: string) =>
    page.locator(`#ll-lab-table-${table} [data-line="${line}"] [data-testid="lab-trace-value"]`);

  test('電腦：點營業利益開面板，原地展開兩層到來源步驟，「看分錄」預設收合，Esc 關閉後焦點回到那個數字', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium' && testInfo.project.name !== 'desktop-firefox', '原地展開只在 medium 以上');
    await page.goto(DEMO7);
    await waitForApp(page);
    await toStage(page, 4);
    // 可追蹤的數字：交易後的金額是按鈕，可讀名稱是完整的一句；恆等式摘要的三個合計也是
    const oi = value(page, 'is', 'is_operating_income');
    await expect(oi).toHaveAttribute('aria-label', /營業利益 NT\$1,250,000，看這個數字從哪裡來/);
    await expect(page.getByTestId('lab-equation').getByTestId('lab-trace-value')).toHaveCount(3);
    await oi.click();
    const sheet = page.getByTestId('lab-trace');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('heading', { level: 2 })).toHaveText('營業利益 NT$1,250,000');
    await expect(sheet).toContainText('損益表，累計到第 7 步');
    // 第一層：營業毛利 － 銷管費用小計（核心的公式樹）
    const first = sheet.locator('.ll-lab-trace__list--1 > li');
    await expect(first).toHaveCount(2);
    await expect(first.nth(0)).toContainText('營業毛利');
    await expect(first.nth(0)).toContainText('NT$1,500,000');
    await expect(first.nth(1)).toContainText('銷管費用小計');
    await expect(first.nth(1)).toContainText('NT$250,000');
    // 原地展開銷管費用小計：0 元的科目收在「另有 n 個 0 元的項目」，播報一句
    const sgaExpand = rowButton(first.nth(1), 'lab-trace-expand');
    await expect(sgaExpand).toHaveAttribute('aria-expanded', 'false');
    // 畫面上的「展開」放在可讀名稱的開頭（WCAG 2.5.3），收合之後跟著變
    await expect(sgaExpand).toHaveAttribute('aria-label', /^展開：銷管費用小計 NT\$250,000，等於 外包費用 NT\$200,000 ＋ 事務用品費 NT\$50,000/);
    await sgaExpand.click();
    await expect(sgaExpand).toHaveAttribute('aria-expanded', 'true');
    await expect(sgaExpand).toHaveAttribute('aria-label', /^收合：銷管費用小計/);
    await expect(page.getByTestId('lab-trace-live')).toHaveText('銷管費用小計：外包費用 NT$200,000 ＋ 事務用品費 NT$50,000');
    const second = first.nth(1).locator('.ll-lab-trace__list--2 > li');
    await expect(second).toHaveCount(2);
    // 原地展開的層也看得到是哪幾個 0 元的項目，和聚焦的層同一個展開方式
    const zeros = first.nth(1).getByTestId('lab-trace-zeros');
    await expect(zeros).toContainText('其他 0 元的項目（6）');
    await expect(zeros.locator('li').first()).toBeHidden();
    await zeros.locator('summary').click();
    await expect(zeros.locator('li')).toHaveCount(6);
    await expect(zeros.locator('li').first()).toBeVisible();
    // 收合也播報一句，再展開回來
    await sgaExpand.click();
    await expect(page.getByTestId('lab-trace-live')).toHaveText('已收合銷管費用小計。');
    await sgaExpand.click();
    await expect(page.getByTestId('lab-trace-live')).toHaveText('銷管費用小計：外包費用 NT$200,000 ＋ 事務用品費 NT$50,000');
    // 再展開外包費用（最底層）：來源步驟是第 4 步，分錄層預設收合，展開後是該步的分錄，可以開啟那一步
    await rowButton(second.nth(0), 'lab-trace-expand').click();
    const src = second.nth(0).locator('.ll-lab-src__step');
    await expect(src).toHaveCount(1);
    await expect(src).toHaveAttribute('data-step', 'st_84jzxr');
    await expect(src).toContainText('第 4 步');
    await expect(src).toContainText('增加 NT$200,000');
    await expect(page.getByTestId('lab-trace-entry')).toBeHidden();
    await src.locator('summary').click();
    await expect(page.getByTestId('lab-trace-entry')).toBeVisible();
    await expect(page.getByTestId('lab-trace-entry')).toContainText('外包費用');
    await expect(page.getByTestId('lab-trace-open-step')).toHaveAttribute('href', `/lab/story/${STORY}/st_84jzxr/`);
    // Esc 關閉，焦點回到原本的數字
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(oi).toBeFocused();
  });

  test('320px：往下鑽、路徑可以回去、0 元的項目收起來、整頁沒有橫向捲動', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(DEMO7);
    await waitForApp(page);
    await toStage(page, 4);
    await value(page, 'is', 'is_operating_income').click();
    const sheet = page.getByTestId('lab-trace');
    await expect(sheet).toBeVisible();
    // 小螢幕沒有原地展開，只有往下
    await expect(sheet.getByTestId('lab-trace-expand')).toHaveCount(0);
    const first = sheet.locator('.ll-lab-trace__list--1 > li');
    await rowButton(first.nth(0), 'lab-trace-drill').click();
    await expect(page.getByTestId('lab-trace-focus')).toContainText('營業毛利');
    await expect(page.getByTestId('lab-trace-focus')).toBeFocused();
    await expect(page.getByTestId('lab-trace-path')).toContainText('營業利益');
    await expect(page.getByTestId('lab-trace-live')).toHaveText('營業毛利：營業收入 NT$3,000,000 － 營業成本 NT$1,500,000');
    // 營業成本小計：期初存貨與盤盈排除列是 0 元且沒有來源，收起來；期末存貨是 0 但有第 6、7 步的來源，留著
    await rowButton(sheet.locator('.ll-lab-trace__list--1 > li').nth(1), 'lab-trace-drill').click();
    await expect(page.getByTestId('lab-trace-focus')).toContainText('營業成本');
    await expect(sheet.locator('.ll-lab-trace__list--1 > li')).toHaveCount(2);
    await expect(page.getByTestId('lab-trace-zeros')).toContainText('其他 0 元的項目（2）');
    await rowButton(sheet.locator('.ll-lab-trace__list--1 > li').nth(1), 'lab-trace-drill').click();
    await expect(page.getByTestId('lab-trace-focus')).toContainText('期末存貨');
    const src = sheet.locator('.ll-lab-src__step');
    await expect(src).toHaveCount(2);
    await expect(src.nth(0)).toContainText('第 6 步');
    await expect(src.nth(1)).toContainText('第 7 步');
    // 路徑：回到營業毛利
    await page.getByTestId('lab-trace-path').getByRole('button', { name: '營業毛利' }).click();
    await expect(page.getByTestId('lab-trace-focus')).toContainText('營業毛利');
    await expect(page.getByTestId('lab-trace-focus')).toBeFocused();
    await expect(page.getByTestId('lab-trace-live')).toHaveText('營業毛利：營業收入 NT$3,000,000 － 營業成本 NT$1,500,000');
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(1);
  });

  test('跨表對應：未分配盈餘對損益表的本期淨利（勾稽點④），「在報表上標出」關面板並醒目標示兩張表的列；指標卡的第一層是分子與分母', async ({ page }) => {
    await page.goto(DEMO7);
    await waitForApp(page);
    await toStage(page, 6);
    await value(page, 'bs', 'bs_retained_earnings').click();
    const sheet = page.getByTestId('lab-trace');
    await expect(sheet).toBeVisible();
    const links = page.getByTestId('lab-trace-links');
    await expect(links).toContainText('損益表的本期淨利（勾稽點④）');
    await expect(links).toContainText('NT$1,250,000');
    await page.getByTestId('lab-trace-highlight').click();
    await expect(sheet).toBeHidden();
    // 標了什麼由步驟頁的 live region 說一句，兩邊的報表與列名都有
    await expect(page.getByTestId('lab-live')).toHaveText('已在報表上標出資產負債表的未分配盈餘和損益表的本期淨利。');
    // 小螢幕一次只顯示一張表：關面板後切到另一張表（損益表），原本的數字已卸載，焦點落在標出的那一格；電腦三表並排，兩張表的列都標出，焦點回到原本的數字
    await expect(page.locator('#ll-lab-table-is tr[data-line="is_net_income"]')).toHaveClass(/is-marked/);
    if ((await page.locator('#ll-lab-table-bs').count()) > 0) {
      await expect(page.locator('#ll-lab-table-bs tr[data-line="bs_retained_earnings"]')).toHaveClass(/is-marked/);
      await expect(value(page, 'bs', 'bs_retained_earnings')).toBeFocused();
    } else {
      await expect(page.getByRole('radio', { name: '損益表' })).toHaveAttribute('aria-checked', 'true');
      await expect(value(page, 'is', 'is_net_income')).toBeFocused();
    }
    // 指標卡
    await toStage(page, 8, 6);
    await page.getByTestId('lab-trace-ratio').first().click();
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId('lab-trace-tree')).toContainText('分子');
    await expect(page.getByTestId('lab-trace-tree')).toContainText('分母');
    await expect(page.getByTestId('lab-trace-focus')).toBeVisible();
    await page.getByTestId('lab-trace-drill').first().click();
    await expect(page.getByTestId('lab-trace-focus')).toBeFocused();
    await expect(page.getByTestId('lab-trace-path')).toBeVisible();
  });

  test('這個階段畫面上沒有報表時，跨表對應不放「在報表上標出」', async ({ page }) => {
    await page.goto(DEMO7);
    await waitForApp(page);
    await toStage(page, 8);
    const sheet = page.getByTestId('lab-trace');
    await page
      .locator('[data-ratio^="net_profit_margin@"] [data-testid="lab-trace-ratio"], [data-ratio^="roe@"] [data-testid="lab-trace-ratio"]')
      .first()
      .click();
    await expect(sheet).toBeVisible();
    await sheet.locator('[data-line="is_net_income"]').getByTestId('lab-trace-drill').click();
    await expect(page.getByTestId('lab-trace-links')).toContainText('資產負債表的未分配盈餘');
    await expect(page.getByTestId('lab-trace-highlight')).toHaveCount(0);
  });

  test('電腦：第 3 層往下鑽走得到來源步驟，路徑一路回得去；指標目標也一樣，面板不會空白', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium' && testInfo.project.name !== 'desktop-firefox', '原地展開只在 medium 以上');
    await page.goto(DEMO7);
    await waitForApp(page);
    await toStage(page, 4);
    await value(page, 'is', 'is_operating_income').click();
    const sheet = page.getByTestId('lab-trace');
    await expect(sheet).toBeVisible();
    const row = (line: string) => sheet.locator(`[data-line="${line}"]`);
    await rowButton(row('is_gross_profit'), 'lab-trace-expand').click();
    await rowButton(row('is_cogs'), 'lab-trace-expand').click();
    const down = rowButton(row('is_purchases'), 'lab-trace-drill');
    await expect(down).toHaveAttribute('aria-label', /^往下：本期進貨 NT\$1,500,000，看來源步驟/);
    await down.click();
    const focusLine = page.getByTestId('lab-trace-focus');
    await expect(focusLine).toContainText('本期進貨');
    await expect(focusLine).toBeFocused();
    const path = page.getByTestId('lab-trace-path');
    await expect(path.locator('li')).toHaveCount(4);
    await expect(path.locator('li[aria-current]')).toHaveText('本期進貨');
    await expect(page.getByTestId('lab-trace-live')).toHaveText('本期進貨 NT$1,500,000，列出來源步驟。');
    const src = sheet.locator('.ll-lab-src__step');
    await expect(src).toHaveCount(1);
    await expect(src).toContainText('第 6 步');
    // 本期進貨是由存貨帳推導的列：看分錄旁有說明；一般的列沒有
    await expect(page.getByTestId('lab-trace-derived')).toBeHidden();
    await src.locator('summary').click();
    await expect(page.getByTestId('lab-trace-derived')).toHaveText('報表上的「本期進貨」「期末存貨」不是分錄裡的科目，而是由存貨帳推導出來的列。');
    await path.getByRole('button', { name: '營業毛利' }).click();
    await expect(focusLine).toContainText('營業毛利');
    await expect(focusLine).toBeFocused();
    await expect(path.locator('li')).toHaveCount(2);
    await path.getByRole('button', { name: '營業利益' }).click();
    await expect(focusLine).toContainText('營業利益');
    await expect(path).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    // 指標目標：從本期淨利進去，第 3 層往下鑽之後是公式樹，不會退回分子與分母那一頁
    await toStage(page, 8, 4);
    await page
      .locator('[data-ratio^="net_profit_margin@"] [data-testid="lab-trace-ratio"], [data-ratio^="roe@"] [data-testid="lab-trace-ratio"]')
      .first()
      .click();
    await expect(sheet).toBeVisible();
    await sheet.locator('[data-line="is_net_income"]').getByTestId('lab-trace-drill').click();
    await rowButton(row('is_pretax_income'), 'lab-trace-expand').click();
    await rowButton(row('is_ordinary_income'), 'lab-trace-expand').click();
    await rowButton(row('is_operating_income'), 'lab-trace-drill').click();
    await expect(focusLine).toContainText('營業利益');
    await expect(focusLine).toBeFocused();
    await expect(sheet.locator('.ll-lab-trace__part')).toHaveCount(0);
    await expect(sheet.locator('.ll-lab-trace__list--1 > li')).toHaveCount(2);
  });

  test('連鎖指標：名稱與單位是來源指標自己的，往下是它的分子與分母，路徑回得去；杜邦版與輸入值', async ({ page }) => {
    await page.goto('/lab/ratios/');
    await waitForApp(page);
    const sheet = page.getByTestId('lab-trace');
    const open = (ref: string) => page.locator(`.ll-lab-ratio[data-ratio="${ref}"]`).getByTestId('lab-trace-ratio').click();
    await open('days_sales_outstanding@excel');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.ll-lab-trace__formula')).toContainText('應收款項週轉率');
    const part = sheet.locator('[data-ratio="ar_turnover@excel"]');
    await expect(part).toContainText('應收款項週轉率');
    await expect(part).toContainText('次');
    await expect(part).not.toContainText('天');
    await expect(sheet).not.toContainText('ar_turnover');
    await expect(part.getByTestId('lab-trace-drill')).toHaveAttribute('aria-label', /^往下：應收款項週轉率 .*次，看這個指標怎麼算/);
    await part.getByTestId('lab-trace-drill').click();
    const focusLine = page.getByTestId('lab-trace-focus');
    await expect(focusLine).toContainText('應收款項週轉率');
    await expect(focusLine).toBeFocused();
    await expect(page.getByTestId('lab-trace-tree')).toContainText('分子');
    await expect(page.getByTestId('lab-trace-tree')).toContainText('分母');
    const path = page.getByTestId('lab-trace-path');
    await expect(path.locator('li')).toHaveCount(2);
    // 再往下到分子的報表列，公式樹接得上
    await sheet.locator('.ll-lab-trace__list--1 > li').first().getByTestId('lab-trace-drill').click();
    await expect(path.locator('li')).toHaveCount(3);
    await expect(focusLine).toBeFocused();
    // 路徑回到目標的指標
    await path.getByRole('button', { name: '平均收現日數' }).click();
    await expect(focusLine).toContainText('平均收現日數');
    await expect(focusLine).toBeFocused();
    await expect(page.getByTestId('lab-trace-live')).toContainText('平均收現日數');
    await expect(path).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await open('days_inventory@excel');
    await expect(sheet.locator('[data-ratio="inventory_turnover@excel"]')).toContainText('存貨週轉率');
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    // 每股盈餘的輸入值（每股面額）還在
    await open('eps@excel');
    await expect(sheet.locator('[data-input="par_value"]')).toContainText('每股面額');
    await expect(sheet.locator('[data-input="par_value"]')).toContainText('10');
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    // 杜邦版的 ROE 是三個因子，各有自己的單位
    await page.getByRole('radio', { name: /杜邦/ }).click();
    await open('roe@dupont');
    await expect(sheet.locator('.ll-lab-trace__list--1 > li')).toHaveCount(3);
    await expect(sheet.locator('[data-ratio="net_profit_margin@slides02"]')).toContainText('%');
    await expect(sheet.locator('[data-ratio="total_asset_turnover@slides02"]')).toContainText('次');
    await expect(sheet).not.toContainText('net_profit_margin');
    await sheet.locator('[data-ratio="equity_multiplier@slides02"]').getByTestId('lab-trace-drill').click();
    await expect(page.getByTestId('lab-trace-tree')).toContainText('分母');
  });

  test('只用鍵盤：Tab 到數字按 Enter 開面板、Tab 到節點按 Enter 展開、Esc 關閉', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium' && testInfo.project.name !== 'desktop-firefox', '只在電腦鍵盤上驗');
    await page.goto(DEMO7);
    await waitForApp(page);
    await toStage(page, 4);
    const oi = value(page, 'is', 'is_operating_income');
    await oi.focus();
    await page.keyboard.press('Enter');
    const sheet = page.getByTestId('lab-trace');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('heading', { level: 2 })).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(sheet.getByTestId('lab-trace-expand').first()).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(sheet.getByTestId('lab-trace-expand').first()).toHaveAttribute('aria-expanded', 'true');
    const inDialog = () =>
      page.evaluate(() => document.activeElement?.closest('[data-testid="lab-trace"]') !== null && document.activeElement !== document.body);
    const focusLine = page.getByTestId('lab-trace-focus');
    const row = (line: string) => sheet.locator(`[data-line="${line}"]`);
    // 用鍵盤走到第 3 層的「往下」：焦點移到新的聚焦那一行，不掉到 body
    await rowButton(row('is_cogs'), 'lab-trace-expand').focus();
    await page.keyboard.press('Space');
    await expect(rowButton(row('is_cogs'), 'lab-trace-expand')).toHaveAttribute('aria-expanded', 'true');
    await rowButton(row('is_purchases'), 'lab-trace-drill').focus();
    await page.keyboard.press('Enter');
    await expect(focusLine).toContainText('本期進貨');
    await expect(focusLine).toBeFocused();
    expect(await inDialog()).toBe(true);
    // Tab 繼續往下走，還在面板裡；Shift+Tab 回到路徑，按路徑回去，焦點一樣在聚焦那一行
    await page.keyboard.press('Tab');
    expect(await inDialog()).toBe(true);
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByTestId('lab-trace-path').getByRole('button').last()).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(focusLine).toContainText('營業成本');
    await expect(focusLine).toBeFocused();
    expect(await inDialog()).toBe(true);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(oi).toBeFocused();
  });

  test('本筆變動檢視：點差額開面板，標題與副標是差額、公式樹展開差額、來源步驟只有這一步；沒變的列是「不變」，不是按鈕', async ({ page }) => {
    await page.goto(DEMO7);
    await waitForApp(page);
    await toStage(page, 4);
    await page.getByRole('radio', { name: '本筆變動' }).click();
    // 累計是 NT$1,250,000；這一步只有毛利的 NT$1,500,000，銷管費用這一步沒有變動
    const oi = value(page, 'is', 'is_operating_income');
    await expect(oi).toHaveAttribute('aria-label', /營業利益 NT\$1,500,000，看這個數字從哪裡來/);
    await oi.click();
    const sheet = page.getByTestId('lab-trace');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('heading', { level: 2 })).toHaveText('營業利益 NT$1,500,000');
    await expect(sheet).toContainText('損益表，第 7 步的本筆變動');
    const first = sheet.locator('.ll-lab-trace__list--1 > li');
    await expect(first.nth(0)).toContainText('營業毛利');
    await expect(first.nth(0)).toContainText('NT$1,500,000');
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(oi).toBeFocused();
    // 最底層的列：來源步驟只有目前這一步
    const revenue = value(page, 'is', 'is_revenue');
    await revenue.click();
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('heading', { level: 2 })).toHaveText('營業收入 NT$3,000,000');
    const src = sheet.locator('.ll-lab-src__step');
    await expect(src).toHaveCount(1);
    await expect(src).toHaveAttribute('data-step', STEP7);
    await expect(src).toContainText('第 7 步');
    // 來源就是目前這一步，沒有「開啟那一步」
    await src.locator('summary').click();
    await expect(page.getByTestId('lab-trace-entry')).toBeVisible();
    await expect(page.getByTestId('lab-trace-open-step')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    // 沒變的列寫「不變」，不能點
    const same = page.locator('#ll-lab-table-is tr[data-line="is_interest_expense"]');
    await expect(same).toContainText('不變');
    await expect(same.getByTestId('lab-trace-value')).toHaveCount(0);
  });

  test('開著面板時方向鍵不換背後的階段；關掉之後照常換', async ({ page }) => {
    await page.goto(DEMO7);
    await waitForApp(page);
    await toStage(page, 4);
    await value(page, 'is', 'is_operating_income').click();
    const sheet = page.getByTestId('lab-trace');
    await expect(sheet).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowRight');
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId('lab-stage-title')).toContainText('階段 4／9');
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('lab-stage-title')).toContainText('階段 5／9');
  });

  test('英文介面：面板的標題、副標、公式、來源步驟與可讀名稱都是英文，整個面板沒有中文', async ({ page }) => {
    await page.goto(`/en${DEMO7}`);
    await waitForApp(page);
    for (let s = 2; s <= 4; s++) {
      await page.getByTestId('lab-next').click();
      await expect(page.getByTestId('lab-stage-title')).toContainText(`Stage ${s} of 9`);
    }
    const oi = value(page, 'is', 'is_operating_income');
    await expect(oi).toHaveAttribute('aria-label', /^Operating profit NT\$1,250,000, see where this number comes from/);
    await oi.click();
    const sheet = page.getByTestId('lab-trace');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('heading', { level: 2 })).toHaveText('Operating profit NT$1,250,000');
    await expect(sheet).toContainText('Income statement, cumulative to step 7');
    await expect(sheet.getByRole('heading', { level: 3, name: 'Formula' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Close the source panel' })).toBeVisible();
    const first = sheet.locator('.ll-lab-trace__list--1 > li');
    await expect(first).toHaveCount(2);
    await expect(first.nth(0)).toContainText('Gross profit');
    await expect(first.nth(0)).toContainText('NT$1,500,000');
    // 下一層：medium 以上原地展開，小螢幕往下鑽再從路徑回來
    const cjk = /[\u3400-\u9fff]/;
    const live = page.getByTestId('lab-trace-live');
    if ((page.viewportSize()?.width ?? 0) >= 600) {
      const expand = rowButton(first.nth(1), 'lab-trace-expand');
      await expect(expand).toHaveAttribute('aria-label', /^Expand/);
      await expand.click();
      await expect(expand).toHaveAttribute('aria-expanded', 'true');
      await expect(live).toContainText('NT$200,000');
    } else {
      await rowButton(first.nth(1), 'lab-trace-drill').click();
      await expect(page.getByTestId('lab-trace-focus')).toBeFocused();
      await expect(live).toContainText('NT$200,000');
      const back = page.getByTestId('lab-trace-path').getByRole('button', { name: 'Operating profit' });
      await expect(back).toBeVisible();
      expect(await sheet.innerText()).not.toMatch(cjk);
      await back.click();
      await expect(page.getByTestId('lab-trace-focus')).toContainText('Operating profit');
    }
    expect(await sheet.innerText()).not.toMatch(cjk);
    expect(await live.textContent()).not.toMatch(cjk);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(oi).toBeFocused();
    // 本筆變動視窗的副標與 IFRS 的標記
    await page.getByRole('radio', { name: 'This transaction' }).click();
    await value(page, 'is', 'is_revenue').click();
    await expect(sheet).toContainText('Income statement, change from step 7');
    await expect(sheet.locator('.ll-lab-src__step')).toHaveCount(1);
    await expect(sheet.locator('.ll-lab-src__step')).toContainText('Step 7');
    expect(await sheet.innerText()).not.toMatch(cjk);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await page.getByTestId('lab-policy').getByRole('radio', { name: 'IFRS comparison' }).click();
    await value(page, 'is', 'is_revenue').click();
    await expect(page.getByTestId('lab-trace-basis')).toHaveText('IFRS comparison, not scored');
    expect(await sheet.innerText()).not.toMatch(cjk);
  });

  test('面板第一次繪製就是完整的：標題之外公式樹也在，不會只有標題', async ({ page }) => {
    await page.goto(DEMO7);
    await waitForApp(page);
    await toStage(page, 4);
    await page.evaluate(() => {
      const w = window as unknown as { __traceTitleOnly?: boolean };
      new MutationObserver(() => {
        const dialog = document.querySelector('[data-testid="lab-trace"]');
        if (dialog !== null && dialog.querySelector('[data-testid="lab-trace-tree"]') === null) w.__traceTitleOnly = true;
      }).observe(document.body, { childList: true, subtree: true });
    });
    const sheet = page.getByTestId('lab-trace');
    await value(page, 'is', 'is_operating_income').click();
    await expect(sheet).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    // 第二次開（面板的模組已經載好）：同一個元件換目標
    await value(page, 'is', 'is_revenue').click();
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId('lab-trace-focus')).toContainText('營業收入');
    expect(await page.evaluate(() => (window as unknown as { __traceTitleOnly?: boolean }).__traceTitleOnly ?? false)).toBe(false);
  });

  test('自由實驗：插入發放股利，未分配盈餘的公式對得起來，股利那一步在來源步驟裡', async ({ page }) => {
    await page.goto('/lab/sandbox/?insert=tpl.pay_dividends_cash');
    await waitForApp(page);
    await expect(page.getByTestId('lab-sandbox-step')).toHaveCount(19);
    const inserted = page.getByTestId('lab-sandbox-step').last();
    await inserted.getByRole('textbox').fill('100000');
    await inserted.getByTestId('lab-sandbox-apply').click();
    await expect(page.getByTestId('lab-sandbox-toasts')).toContainText('已套用');
    const result = page.getByTestId('lab-sandbox-result');
    await result.locator('[data-line="bs_retained_earnings"] [data-testid="lab-trace-value"]').first().click();
    const sheet = page.getByTestId('lab-trace');
    await expect(sheet).toBeVisible();
    const list = sheet.locator('.ll-lab-trace__list--1 > li');
    await expect(list).toHaveCount(2);
    await expect(list.nth(0)).toContainText('本期淨利');
    await expect(list.nth(1)).toContainText('未分配盈餘科目');
    await expect(list.nth(1)).toContainText('－');
    await expect(list.nth(1)).toContainText('NT$100,000');
    const src = sheet.locator('.ll-lab-src__step');
    await expect(src).toHaveCount(1);
    await expect(src).toContainText('自由實驗插入的步驟');
    await expect(src).toContainText('減少 NT$100,000');
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    // 上一層原地展開或往下鑽到它，也一樣看得到
    await result.locator('[data-line="bs_total_equity"] [data-testid="lab-trace-value"]').first().click();
    await expect(sheet).toBeVisible();
    const node = sheet.locator('[data-line="bs_retained_earnings"]');
    const nested = (page.viewportSize()?.width ?? 0) >= 600;
    await node
      .getByTestId(nested ? 'lab-trace-expand' : 'lab-trace-drill')
      .first()
      .click();
    await expect(sheet.locator('[data-account="retained_earnings"]')).toContainText('NT$100,000');
    await expect(sheet.locator('.ll-lab-src__step')).toContainText('減少 NT$100,000');
  });

  test('自由實驗與指標實驗室的數字也能追；來源步驟連到故事的那一步', async ({ page }) => {
    await page.goto('/lab/ratios/');
    await waitForApp(page);
    await page.getByTestId('lab-trace-ratio').first().click();
    await expect(page.getByTestId('lab-trace')).toBeVisible();
    await expect(page.getByTestId('lab-trace-tree')).toContainText('分母');
    await page.keyboard.press('Escape');
    await page.goto('/lab/sandbox/');
    await waitForApp(page);
    await page.getByTestId('lab-sandbox-result').getByTestId('lab-trace-value').first().waitFor();
    await page
      .locator(
        '#ll-lab-table-is [data-line="is_revenue"] [data-testid="lab-trace-value"], .ll-lab-sandbox__result [data-line="is_revenue"] [data-testid="lab-trace-value"]',
      )
      .first()
      .click();
    const sheet = page.getByTestId('lab-trace');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('累計到第 18 步');
    // 第 18 步之後的營業收入來自第 7 步與第 10 步；「看分錄」預設收合，展開後可以開啟那一步（故事的步驟才有）
    await expect(sheet.locator('.ll-lab-src__step')).toHaveCount(2);
    await expect(page.getByTestId('lab-trace-open-step').first()).toBeHidden();
    await sheet.locator('.ll-lab-src__step').first().locator('summary').click();
    await expect(page.getByTestId('lab-trace-open-step').first()).toBeVisible();
    await expect(page.getByTestId('lab-trace-open-step').first()).toHaveAttribute('href', `/lab/story/${STORY}/${STEP7}/`);
  });
});

test.describe('IFRS 對照（M4b，03 第 3.13 節）', () => {
  const STEP5 = 'st_yj3yex';
  const DEMO5 = `/lab/story/${STORY}/${STEP5}/?mode=demo`;
  /** 示範模式一次按一下「下一步」到第 n 個階段（示範有 9 個階段：2 是科目變動、4 是損益表、7 是勾稽燈號） */
  async function toStage(page: Page, n: number, from = 1): Promise<void> {
    for (let s = from + 1; s <= n; s++) {
      await page.getByTestId('lab-next').click();
      await expect(page.getByTestId('lab-stage-title')).toContainText(`階段 ${s}／9`);
    }
  }
  /** 用階段選單跳到某個階段（示範隨時可跳） */
  async function jumpTo(page: Page, current: string, item: string): Promise<void> {
    await page.getByRole('button', { name: current }).click();
    await page.getByRole('menuitem', { name: item }).click();
  }
  const policyRadio = (scope: Locator | Page, name: string) => scope.getByTestId('lab-policy').getByRole('radio', { name });

  test('版面：選到 IFRS 對照後口徑切換仍是同一列，金額和箭頭也在同一行', async ({ page }) => {
    await page.goto(`/lab/story/${STORY}/st_yj3yex/?mode=demo`);
    await waitForApp(page);
    for (let s = 2; s <= 4; s++) {
      await page.getByTestId('lab-next').click();
      await expect(page.getByTestId('lab-stage-title')).toContainText(`${s}／9`);
    }
    await policyRadio(page, 'IFRS 對照').click();
    const options = await page
      .getByTestId('lab-policy')
      .getByRole('radio')
      .evaluateAll((els) => els.map((el) => el.closest('label')?.getBoundingClientRect().top ?? el.getBoundingClientRect().top));
    expect(Math.abs(options[0]! - options[1]!)).toBeLessThanOrEqual(2);
    // 本筆變動：箭頭、減號和金額在同一行
    await page.getByRole('radio', { name: '本筆變動' }).first().click();
    for (const delta of await page.locator('#ll-lab-table-is .ll-lab-delta[data-dir]').all()) {
      const height = await delta.evaluate((el) => el.getBoundingClientRect().height);
      const line = await delta.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
      expect(height).toBeLessThan(line * 1.5);
    }
    await page.getByRole('radio', { name: '累計' }).first().click();
    // 欄位最窄的是寬螢幕的三欄：有差異標記的列，箭頭不掉到金額下一行
    for (const cell of await page.locator('#ll-lab-table-is tr.is-diff td:has(.ll-lab-row__mark)').all()) {
      const gap = await cell.evaluate((td) => {
        const mark = td.querySelector('.ll-lab-row__mark')!.getBoundingClientRect();
        const value = td.querySelector('button')!.getBoundingClientRect();
        return Math.abs(mark.top + mark.height / 2 - (value.top + value.height / 2));
      });
      expect(gap).toBeLessThan(10);
    }
  });
  /** ledgerland 資料庫某個 store 的全部紀錄（settings、attempts、reviewQueue） */
  function readStore(page: Page, store: string): Promise<unknown[]> {
    return page.evaluate(
      (name) =>
        new Promise<unknown[]>((resolve) => {
          const req = indexedDB.open('ledgerland');
          req.onerror = () => resolve([]);
          req.onsuccess = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(name)) {
              db.close();
              resolve([]);
              return;
            }
            const r = db.transaction(name).objectStore(name).getAll();
            r.onsuccess = () => {
              db.close();
              resolve(r.result as unknown[]);
            };
            r.onerror = () => {
              db.close();
              resolve([]);
            };
          };
        }),
      store,
    );
  }
  const labViewPolicy = async (page: Page): Promise<unknown> => {
    const settings = (await readStore(page, 'settings')) as { key: string; value: { policy?: unknown } }[];
    return settings.find((s) => s.key === 'labView')?.value.policy;
  };

  test('步驟頁：切到 IFRS 對照後橫幅、caption、差異標記與播報；分錄是設立費費用化；交易卡有標記；五層利益四列；切回教材全部還原；設定有寫入、計分的 store 不動', async ({
    page,
  }) => {
    await page.goto(DEMO5);
    await waitForApp(page);
    await toStage(page, 4);
    const session = page.getByTestId('lab-session');
    const attemptsBefore = (await readStore(page, 'attempts')).length;
    const reviewBefore = (await readStore(page, 'reviewQueue')).length;
    await expect(session).toHaveAttribute('data-policy', 'teacher@1');
    await expect(page.getByTestId('lab-basis')).toHaveCount(0);
    await expect(page.locator('#ll-lab-table-is tr[data-line="is_ordinary_income"]')).toHaveCount(1);
    await expect(page.locator('#ll-lab-table-is caption')).toHaveText('損益表');
    await policyRadio(page, 'IFRS 對照').click();
    await expect(session).toHaveAttribute('data-policy', 'ifrs@1');
    await expect(page.getByTestId('lab-basis')).toContainText('IFRS 對照，不計分');
    await expect(page.getByTestId('lab-policy-live')).toHaveText('已切換到 IFRS 對照，不計分。和教材口徑不同的列已加上標記。');
    await expect(page.locator('#ll-lab-table-is caption')).toHaveText('損益表（IFRS 對照）');
    // ifrs@1 的版面：沒有經常利益；第 5 步設立費 300,000 費用化，營業費用 550,000 和教材口徑的 250,000 不同
    await expect(page.locator('#ll-lab-table-is tr[data-line="is_ordinary_income"]')).toHaveCount(0);
    const sga = page.locator('#ll-lab-table-is tr[data-line="is_sga_total"]');
    // 列名是 ifrs@1 版面自己的（現行用語），不是名詞的教材用語
    await expect(sga.locator('th')).toContainText('營業費用合計');
    await expect(page.locator('#ll-lab-table-is tr[data-line="is_interest_expense"] th')).toContainText('財務成本');
    await expect(sga).toHaveClass(/is-diff/);
    await expect(sga.getByTestId('lab-row-diff')).toHaveText('與教材口徑不同');
    await expect(sga.getByTestId('lab-row-basis')).toHaveText('教材口徑：NT$250,000');
    await expect(sga.getByTestId('lab-trace-value')).toHaveAttribute('aria-label', /NT\$550,000，看這個數字從哪裡來/);
    await expect(page.locator('#ll-lab-table-is tr[data-line="is_revenue"] [data-testid="lab-row-diff"]')).toHaveCount(0);
    await expect.poll(() => labViewPolicy(page)).toBe('ifrs@1');
    // 來源面板依 ifrs@1 展開，副標帶標記
    await sga.getByTestId('lab-trace-value').click();
    await expect(page.getByTestId('lab-trace')).toBeVisible();
    await expect(page.getByTestId('lab-trace-basis')).toHaveText('IFRS 對照，不計分');
    await expect(page.getByTestId('lab-trace').getByRole('heading', { level: 2 })).toContainText('營業費用合計 NT$550,000');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('lab-trace')).toBeHidden();
    // 階段 2 科目變動：ifrs@1 的分錄是設立費（費用化），沒有遞延的設立費
    await jumpTo(page, '階段 4／9：損益表', '2. 科目變動');
    await expect(page.getByTestId('lab-effects').locator('[data-account="organisation_costs_expense"]')).toBeVisible();
    await expect(page.getByTestId('lab-effects').locator('[data-account="deferred_organisation_costs"]')).toHaveCount(0);
    await expect(page.getByTestId('lab-basis')).toBeVisible();
    // 交易卡：這一步的範本在 IFRS 下的處理不同
    await jumpTo(page, '階段 2／9：科目變動', '1. 交易卡');
    await expect(page.getByTestId('lab-policy-differs')).toHaveText('IFRS 下的處理不同');
    // 勾稽燈號：五層利益只有四列（沒有經常利益），四個燈仍相符
    await jumpTo(page, '階段 1／9：交易卡', '7. 勾稽燈號');
    await expect(page.locator('.ll-lab-levels tbody tr')).toHaveCount(4);
    await expect(page.locator('.ll-lab-levels caption')).toHaveText('步驟①：各層利益');
    for (const s of [2, 3, 4, 5]) await expect(page.getByTestId(`lab-light-${s}`)).toHaveAttribute('data-state', 'pass');
    // 切回教材：全部還原
    await jumpTo(page, '階段 7／9：勾稽燈號', '4. 損益表');
    await policyRadio(page, '教材').click();
    await expect(session).toHaveAttribute('data-policy', 'teacher@1');
    await expect(page.getByTestId('lab-policy-live')).toHaveText('已切換回教材口徑。');
    await expect(page.getByTestId('lab-basis')).toHaveCount(0);
    await expect(page.locator('#ll-lab-table-is caption')).toHaveText('損益表');
    await expect(page.locator('#ll-lab-table-is tr[data-line="is_ordinary_income"]')).toHaveCount(1);
    await expect(page.getByTestId('lab-row-diff')).toHaveCount(0);
    await expect.poll(() => labViewPolicy(page)).toBe('teacher@1');
    // 切換不碰作答紀錄與錯題
    expect((await readStore(page, 'attempts')).length).toBe(attemptsBefore);
    expect((await readStore(page, 'reviewQueue')).length).toBe(reviewBefore);
    await jumpTo(page, '階段 4／9：損益表', '7. 勾稽燈號');
    await expect(page.locator('.ll-lab-levels tbody tr')).toHaveCount(5);
    await expect(page.locator('.ll-lab-levels caption')).toHaveText('步驟①：五層利益');
  });

  test('只用鍵盤切換口徑：方向鍵到 IFRS 對照，橫幅、播報與標記出現，焦點留在群組裡、階段不動；方向鍵回教材全部還原', async ({ page }, testInfo) => {
    await page.goto(DEMO5);
    await waitForApp(page);
    // 走到損益表也只用鍵盤
    for (let s = 2; s <= 4; s++) {
      await page.getByTestId('lab-next').focus();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('lab-stage-title')).toContainText(`階段 ${s}／9`);
    }
    const teacher = policyRadio(page, '教材');
    const ifrs = policyRadio(page, 'IFRS 對照');
    const stage = page.getByTestId('lab-stage-title');
    const session = page.getByTestId('lab-session');
    const live = page.getByTestId('lab-policy-live');
    const stageLive = page.getByTestId('lab-live');
    await expect(stageLive).toContainText('本期淨利');
    // 群組內只有選到的那一項在 Tab 順序裡
    await expect(teacher).toHaveAttribute('tabindex', '0');
    await expect(ifrs).toHaveAttribute('tabindex', '-1');
    if (testInfo.project.name.startsWith('desktop')) {
      // 摘要列的按鈕緊接在切換後面：Shift+Tab 一下就回到選到的那一項
      await page.getByTestId('lab-summary').focus();
      await page.keyboard.press('Shift+Tab');
      await expect(teacher).toBeFocused();
    } else {
      await teacher.focus();
    }
    await page.keyboard.press('ArrowRight');
    await expect(ifrs).toBeFocused();
    await expect(ifrs).toHaveAttribute('aria-checked', 'true');
    await expect(ifrs).toHaveAttribute('tabindex', '0');
    await expect(session).toHaveAttribute('data-policy', 'ifrs@1');
    await expect(page.getByTestId('lab-basis')).toContainText('IFRS 對照，不計分');
    await expect(live).toHaveText('已切換到 IFRS 對照，不計分。和教材口徑不同的列已加上標記。');
    // 切換只播報這一句：階段摘要不跟著重唸，也不留著上一種口徑的數字
    await expect(stageLive).toHaveText('');
    await expect(page.locator('#ll-lab-table-is caption')).toHaveText('損益表（IFRS 對照）');
    await expect(page.locator('#ll-lab-table-is tr[data-line="is_sga_total"]').getByTestId('lab-row-diff')).toHaveText('與教材口徑不同');
    // 方向鍵是給群組用的，不能同時換階段（03 第 3.11 節的方向鍵只在焦點不在元件上時）
    await expect(stage).toContainText('階段 4／9');
    await page.keyboard.press('ArrowLeft');
    await expect(teacher).toBeFocused();
    await expect(teacher).toHaveAttribute('aria-checked', 'true');
    await expect(session).toHaveAttribute('data-policy', 'teacher@1');
    await expect(live).toHaveText('已切換回教材口徑。');
    await expect(stageLive).toHaveText('');
    await expect(page.getByTestId('lab-basis')).toHaveCount(0);
    await expect(page.getByTestId('lab-row-diff')).toHaveCount(0);
    await expect(page.locator('#ll-lab-table-is caption')).toHaveText('損益表');
    await expect(page.locator('#ll-lab-table-is tr[data-line="is_ordinary_income"]')).toHaveCount(1);
    await expect(stage).toContainText('階段 4／9');
    // 另外三個按鍵：下、上、End 與 Home 都會循環切換，階段一樣不動
    await page.keyboard.press('End');
    await expect(session).toHaveAttribute('data-policy', 'ifrs@1');
    await expect(ifrs).toBeFocused();
    await page.keyboard.press('Home');
    await expect(session).toHaveAttribute('data-policy', 'teacher@1');
    await page.keyboard.press('ArrowDown');
    await expect(session).toHaveAttribute('data-policy', 'ifrs@1');
    await page.keyboard.press('ArrowUp');
    await expect(session).toHaveAttribute('data-policy', 'teacher@1');
    await expect(teacher).toBeFocused();
    await expect(stage).toContainText('階段 4／9');
    // 換階段才有下一句階段播報
    await page.getByTestId('lab-next').click();
    await expect(stage).toContainText('階段 5／9');
    await expect(stageLive).not.toHaveText('');
  });

  test('交易卡的敘述兩種口徑相同：第 17 步在 IFRS 對照仍是教材的攤銷金額，另有「IFRS 下的處理不同」的標記', async ({ page }) => {
    await page.goto(`/lab/story/${STORY}/st_j6185k/?mode=demo`);
    await waitForApp(page);
    const card = page.getByTestId('lab-card');
    await expect(card).toContainText('NT$60,000');
    await toStage(page, 4);
    await policyRadio(page, 'IFRS 對照').click();
    await expect(page.getByTestId('lab-session')).toHaveAttribute('data-policy', 'ifrs@1');
    await jumpTo(page, '階段 4／9：損益表', '1. 交易卡');
    await expect(card).toContainText('NT$60,000');
    await expect(page.getByTestId('lab-policy-differs')).toHaveText('IFRS 下的處理不同');
  });

  test('來源面板不提 IFRS 畫面上沒有的列：存貨沒有指向期末存貨的跨表對應；現金再投資比率沒有設立費與開發費；公式的輸入值是語系名稱', async ({ page }) => {
    await page.goto(`/lab/story/${STORY}/${STEP6}/?mode=demo`);
    await waitForApp(page);
    await toStage(page, 4);
    await policyRadio(page, 'IFRS 對照').click();
    await expect(page.getByTestId('lab-session')).toHaveAttribute('data-policy', 'ifrs@1');
    await toStage(page, 6, 4);
    const inventory = page.locator('#ll-lab-table-bs [data-line="bs_inventory"] [data-testid="lab-trace-value"]');
    await inventory.click();
    const sheet = page.getByTestId('lab-trace');
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId('lab-trace-tree')).toBeVisible();
    await expect(page.getByTestId('lab-trace-links')).toHaveCount(0);
    await page.keyboard.press('Escape');

    await page.goto('/lab/ratios/');
    await waitForApp(page);
    await policyRadio(page, 'IFRS 對照').click();
    await page.getByTestId('lab-policy').getByRole('radio', { name: 'IFRS 對照' }).waitFor();
    await page.getByRole('radio', { name: '0-3 投影片' }).click();
    const card = page.locator('[data-ratio="cash_reinvestment@slides03"]');
    await expect(card.locator('.ll-lab-ratio__formula')).not.toContainText('設立費');
    await expect(page.locator('[data-ratio="roa@slides03"] .ll-lab-ratio__formula')).toContainText('(1 - 稅率)');
    await card.getByTestId('lab-trace-ratio').click();
    await expect(sheet).toBeVisible();
    const tree = page.getByTestId('lab-trace-tree');
    await expect(tree).toContainText('分母');
    await expect(tree).not.toContainText('設立費');
    await expect(tree).not.toContainText('開發費');
    await expect(tree.locator('[data-line="bs_deferred_org_costs"]')).toHaveCount(0);
    await expect(tree.locator('[data-line="bs_ppe_gross"]')).toHaveCount(1);
    // 教材照舊
    await page.keyboard.press('Escape');
    await policyRadio(page, '教材').click();
    await expect(card.locator('.ll-lab-ratio__formula')).toContainText('設立費');
  });

  test('本筆變動檢視切到 IFRS 對照：差額的差異標記與教材口徑，點差額開的面板是 ifrs@1 的差額', async ({ page }) => {
    await page.goto(DEMO5);
    await waitForApp(page);
    await toStage(page, 4);
    await page.getByRole('radio', { name: '本筆變動' }).click();
    await policyRadio(page, 'IFRS 對照').click();
    await expect(page.getByTestId('lab-basis')).toBeVisible();
    const sga = page.locator('#ll-lab-table-is tr[data-line="is_sga_total"]');
    await expect(sga).toHaveClass(/is-changed/);
    await expect(sga).toHaveClass(/is-diff/);
    await expect(sga.getByTestId('lab-row-diff')).toHaveText('與教材口徑不同');
    await sga.getByTestId('lab-trace-value').click();
    const sheet = page.getByTestId('lab-trace');
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId('lab-trace-basis')).toHaveText('IFRS 對照，不計分');
    await expect(sheet.getByRole('heading', { level: 2 })).toHaveText('營業費用合計 NT$300,000');
    await expect(sheet).toContainText('損益表，第 5 步的本筆變動');
  });

  test('口徑的記憶：同一次使用中換到別的步驟仍是 IFRS 對照；重新載入回到教材；從題目開啟一律教材', async ({ page }) => {
    await page.goto(DEMO5);
    await waitForApp(page);
    await toStage(page, 4);
    await policyRadio(page, 'IFRS 對照').click();
    await expect(page.getByTestId('lab-basis')).toBeVisible();
    // 走完這一步，從完成卡到第 6 步（同一個 document）
    await toStage(page, 9, 4);
    await page.getByTestId('lab-next').click();
    await page.getByTestId('lab-next-step').click();
    await expect(page.getByTestId('lab-stage-title')).toHaveText('階段 1／9：交易卡');
    await expect(page.getByTestId('lab-card')).toBeVisible();
    await expect(page.getByTestId('lab-session')).toHaveAttribute('data-policy', 'ifrs@1');
    await expect(page.getByTestId('lab-basis')).toBeVisible();
    // 第 6 步的範本兩套口徑一樣，交易卡沒有標記
    await expect(page.getByTestId('lab-policy-differs')).toHaveCount(0);
    // 重新載入：回到教材（設定仍記著 ifrs@1，備份照常）
    await page.reload();
    await waitForApp(page);
    await expect(page.getByTestId('lab-card')).toBeVisible();
    await expect(page.getByTestId('lab-session')).toHaveAttribute('data-policy', 'teacher@1');
    await expect(page.getByTestId('lab-basis')).toHaveCount(0);
    await expect.poll(() => labViewPolicy(page)).toBe('ifrs@1');
    // 從題目開啟：一律教材
    await page.goto(`${DEMO5}&from=hq_nothing`);
    await waitForApp(page);
    await expect(page.getByTestId('lab-card')).toBeVisible();
    await expect(page.getByTestId('lab-session')).toHaveAttribute('data-policy', 'teacher@1');
  });

  test('自由實驗與指標實驗室：切換只重算報表區與指標，結果不同的卡列出教材口徑；修改仍照教材口徑擋下', async ({ page }) => {
    await page.goto('/lab/sandbox/');
    await waitForApp(page);
    const result = page.getByTestId('lab-sandbox-result');
    await expect(result).toHaveAttribute('data-policy', 'teacher@1');
    await policyRadio(result, 'IFRS 對照').click();
    await expect(result).toHaveAttribute('data-policy', 'ifrs@1');
    await expect(page.getByTestId('lab-basis')).toContainText('IFRS 對照，不計分');
    await expect(result.locator('caption').first()).toContainText('（IFRS 對照）');
    await expect(result.getByTestId('lab-row-diff').first()).toBeVisible();
    await expect(result.getByTestId('lab-ratio-basis').first()).toBeVisible();
    await expect(result.locator('#ll-lab-table-is, table').first()).toBeVisible();
    // 修改仍照教材口徑擋下與算範圍
    const step12 = page.locator(`[data-step="${STEP12}"]`);
    await step12.getByRole('textbox').fill('99999999999');
    await step12.getByTestId('lab-sandbox-apply').click();
    await expect(step12).toContainText('最多可以輸入 NT$15,000,000');
    await expect(result).toHaveAttribute('data-policy', 'ifrs@1');
    // 指標實驗室：重新載入回到教材；切換後結果不同的卡有教材口徑
    await page.goto('/lab/ratios/');
    await waitForApp(page);
    await expect(page.getByTestId('lab-basis')).toHaveCount(0);
    await policyRadio(page, 'IFRS 對照').click();
    await expect(page.getByTestId('lab-basis')).toBeVisible();
    await expect(page.getByTestId('lab-ratio-basis').first()).toBeVisible();
    await expect(page.getByTestId('lab-ratios-context')).toContainText('綠芽商行');
    await expect(page.getByTestId('lab-dupont')).toContainText('＝');
    await policyRadio(page, '教材').click();
    await expect(page.getByTestId('lab-basis')).toHaveCount(0);
    await expect(page.getByTestId('lab-ratio-basis')).toHaveCount(0);
  });

  /** 預測面板的每個線目標都選「減少」，記下預測 */
  async function predictAllDown(page: Page, expected: number): Promise<void> {
    const panel = page.getByTestId('lab-predict');
    const radios = panel.getByRole('radio', { name: '減少' });
    await expect(radios).toHaveCount(expected);
    for (let i = 0; i < expected; i++) await radios.nth(i).check();
    await page.getByTestId('lab-predict-submit').click();
  }
  /** 從示範的損益表階段切到 IFRS 對照，再用階段選單換成練習（同一個 document，口徑沿用），停在第 2 階段 */
  async function practiseInIfrs(page: Page): Promise<void> {
    await page.goto(DEMO5);
    await waitForApp(page);
    await toStage(page, 4);
    await policyRadio(page, 'IFRS 對照').click();
    await expect(page.getByTestId('lab-basis')).toBeVisible();
    await page.getByRole('button', { name: /^階段 4／9/ }).click();
    await page.getByTestId('lab-switch-mode').click();
    await expect(page.getByTestId('lab-stage-title')).toHaveText('階段 1／10：交易卡');
    await expect(page.getByTestId('lab-session')).toHaveAttribute('data-policy', 'ifrs@1');
    await page.getByTestId('lab-next').click();
    await expect(page.getByTestId('lab-stage-title')).toHaveText('階段 2／10：預測');
  }
  /** 本機進度（settings 的 lab:<storyId>） */
  const storyProgress = async (page: Page): Promise<Record<string, Record<string, unknown>>> => {
    const settings = (await readStore(page, 'settings')) as { key: string; value: Record<string, Record<string, unknown>> }[];
    return settings.find((s) => s.key === `lab:${STORY}`)?.value ?? {};
  };
  const nextStage = async (page: Page, title: string) => {
    await page.getByTestId('lab-next').click();
    await expect(page.getByTestId('lab-stage-title')).toHaveText(title);
  };
  const noRawIds = async (scope: Locator) => {
    await expect(scope).not.toContainText('is_ordinary_income');
    await expect(scope).not.toContainText('bs_deferred_org_costs');
  };

  test('IFRS 對照下走練習：預測只有畫面上的列，沒有原始 ID；揭曉、對錯清單與成績總數都是六個；換回教材不卡關、紀錄的口徑不變', async ({ page }) => {
    await practiseInIfrs(page);
    const panel = page.getByTestId('lab-predict');
    await expect(panel).toBeVisible();
    await noRawIds(panel);
    await expect(panel).not.toContainText('經常利益');
    await expect(panel).not.toContainText('設立費');
    await predictAllDown(page, 6);
    await expect.poll(async () => (await storyProgress(page)).predictScores?.[STEP5]).toEqual({ right: 5, total: 6 });
    const saved = await storyProgress(page);
    expect(saved.predictBasis?.[STEP5]).toBe('ifrs@1');
    expect(Object.keys((saved.predictions?.[STEP5] ?? {}) as object).sort()).toEqual(['cash', 'l1', 'l2', 'l4', 'l5', 'x-t2'].sort());
    await nextStage(page, '階段 3／10：科目變動');
    const reveal = page.getByTestId('lab-reveal');
    await expect(reveal.getByRole('heading')).toHaveText('揭曉：6 個猜對 5 個');
    await expect(reveal.locator('li')).toHaveCount(6);
    await noRawIds(reveal);
    await expect(page.getByTestId('lab-reveal-basis')).toHaveText('依 IFRS 對照揭曉，不計分。');
    await expect(page.getByTestId('lab-reveal-recorded')).toHaveCount(0);
    await nextStage(page, '階段 4／10：恆等式天平');
    await nextStage(page, '階段 5／10：損益表');
    const verdicts = page.getByTestId('lab-level-verdicts');
    await expect(verdicts.locator('li')).toHaveCount(4);
    await noRawIds(verdicts);
    // 換回教材：畫面依教材數字重新揭曉，只算猜過的六個（經常利益不算沒選），加註紀錄的成績不變；下一步照常可以按
    await policyRadio(page, '教材').click();
    await expect(verdicts.locator('li')).toHaveCount(4);
    await page.locator('#ll-lab-prev').click();
    await page.locator('#ll-lab-prev').click();
    await expect(page.getByTestId('lab-stage-title')).toHaveText('階段 3／10：科目變動');
    await expect(reveal.getByRole('heading')).toHaveText('揭曉：6 個猜對 1 個');
    await expect(reveal.locator('li')).toHaveCount(6);
    await expect(reveal).not.toContainText('沒有選');
    await expect(page.getByTestId('lab-reveal-basis')).toHaveCount(0);
    await expect(page.getByTestId('lab-reveal-recorded')).toContainText('存下來的成績不變');
    await expect(page.getByTestId('lab-next')).toBeEnabled();
    for (let s = 4; s <= 10; s++) {
      await page.getByTestId('lab-next').click();
      await expect(page.getByTestId('lab-stage-title')).toContainText(`階段 ${s}／10`);
    }
    await page.getByTestId('lab-next').click();
    // 完成卡與進度都是記下時的成績與口徑
    await expect(page.getByTestId('lab-finish-score')).toContainText('這一步的預測猜對 5／6');
    await expect(page.getByTestId('lab-finish-basis')).toHaveText('IFRS 對照，不計分');
    const after = await storyProgress(page);
    expect(after.predictScores?.[STEP5]).toEqual({ right: 5, total: 6 });
    expect(after.predictBasis?.[STEP5]).toBe('ifrs@1');
  });

  test('IFRS 對照下換到還沒練過的下一步：預測階段等核心到了才出現，一開始就沒有經常利益', async ({ page }) => {
    await practiseInIfrs(page);
    await predictAllDown(page, 6);
    for (let s = 3; s <= 10; s++) {
      await page.getByTestId('lab-next').click();
      await expect(page.getByTestId('lab-stage-title')).toContainText(`階段 ${s}／10`);
    }
    await page.getByTestId('lab-next').click();
    await page.getByTestId('lab-next-step').click();
    await expect(page.getByTestId('lab-session')).toHaveAttribute('data-policy', 'ifrs@1');
    await page.getByTestId('lab-next').click();
    const panel = page.getByTestId('lab-predict');
    await expect(panel).toBeVisible();
    await expect(panel).not.toContainText('經常利益');
    await noRawIds(panel);
    await expect(panel.getByRole('radio', { name: '減少' })).toHaveCount(7);
  });

  test('教材記下的預測換到 IFRS 對照：揭曉只算畫面上的目標，紀錄維持教材的八個', async ({ page }) => {
    await page.goto(`/lab/story/${STORY}/${STEP5}/`);
    await waitForApp(page);
    await page.getByTestId('lab-next').click();
    await predictAllDown(page, 8);
    await expect.poll(async () => (await storyProgress(page)).predictScores?.[STEP5]).toEqual({ right: 1, total: 8 });
    await nextStage(page, '階段 3／10：科目變動');
    await nextStage(page, '階段 4／10：恆等式天平');
    await nextStage(page, '階段 5／10：損益表');
    await policyRadio(page, 'IFRS 對照').click();
    await expect(page.getByTestId('lab-level-verdicts').locator('li')).toHaveCount(4);
    await page.locator('#ll-lab-prev').click();
    await page.locator('#ll-lab-prev').click();
    const reveal = page.getByTestId('lab-reveal');
    await expect(reveal.getByRole('heading')).toHaveText('揭曉：6 個猜對 5 個');
    await noRawIds(reveal);
    await expect(page.getByTestId('lab-reveal-basis')).toBeVisible();
    await expect(page.getByTestId('lab-reveal-recorded')).toBeVisible();
    const saved = await storyProgress(page);
    expect(saved.predictScores?.[STEP5]).toEqual({ right: 1, total: 8 });
    expect(saved.predictBasis?.[STEP5]).toBeUndefined();
    expect(Object.keys((saved.predictions?.[STEP5] ?? {}) as object)).toHaveLength(8);
  });

  test('橫幅不被捲走：自由實驗的報表區與指標實驗室捲到中間仍貼在視窗頂端、320 寬沒有橫向捲動；標示依據的準則版本', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    const stuckTop = (banner: Locator) => banner.evaluate((el) => Math.round(el.getBoundingClientRect().top));
    const noSideScroll = () => expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.goto('/lab/sandbox/');
    await waitForApp(page);
    const result = page.getByTestId('lab-sandbox-result');
    await policyRadio(result, 'IFRS 對照').click();
    const banner = page.getByTestId('lab-basis');
    await expect(page.getByTestId('lab-basis-version')).toHaveText('依現行 IAS 1 與 IAS 7，不是 IFRS 18。');
    await result.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + el.getBoundingClientRect().height / 2));
    await expect.poll(() => stuckTop(banner)).toBe(0);
    await expect(banner).toBeInViewport();
    // 固定的只有一列：320 寬不能蓋掉一大塊畫面
    expect(await banner.evaluate((el) => el.getBoundingClientRect().height)).toBeLessThan(64);
    await noSideScroll();
    await page.goto('/lab/ratios/');
    await waitForApp(page);
    await policyRadio(page, 'IFRS 對照').click();
    await expect(banner).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
    await expect.poll(() => stuckTop(banner)).toBe(0);
    await expect(banner).toBeInViewport();
    await noSideScroll();
  });

  test('只有 IFRS 算得下去（舊存檔）：報表照樣標示 IFRS 對照，橫幅不說有差異標記；還原後回到兩套都算得下去', async ({ page }) => {
    await page.goto('/lab/sandbox/');
    await waitForApp(page);
    const result = page.getByTestId('lab-sandbox-result');
    await policyRadio(result, 'IFRS 對照').click();
    await expect(result).toHaveAttribute('data-policy', 'ifrs@1');
    const step6 = page.locator(`[data-step="${STEP6}"]`);
    await step6.getByRole('textbox').fill('1600000');
    await step6.getByTestId('lab-sandbox-apply').click();
    await expect(page.getByTestId('lab-sandbox-toasts')).toContainText('已套用');
    // 舊版會留下的樣子：第 5 步設立費被拿掉，第 17 步的攤銷在教材口徑算不下去；IFRS 沒有這筆攤銷
    await expect
      .poll(() =>
        page.evaluate(async (removed) => {
          const open = indexedDB.open('ledgerland');
          const db = await new Promise<IDBDatabase>((res, rej) => {
            open.onsuccess = () => res(open.result);
            open.onerror = () => rej(open.error);
          });
          const tx = db.transaction('labSandbox', 'readwrite');
          const store = tx.objectStore('labSandbox');
          const all = await new Promise<{ removed: string[]; overrides: unknown[] }[]>((res) => {
            const r = store.getAll();
            r.onsuccess = () => res(r.result);
          });
          for (const rec of all) store.put({ ...rec, removed: [removed], overrides: [] });
          await new Promise((res) => (tx.oncomplete = res));
          db.close();
          return all.length;
        }, STEP5),
      )
      .toBe(1);
    // 同一個 document 換頁再回來：口徑沿用
    await page.locator('.ll-topbar a[href="/lab/"]').click();
    await expect(page.getByTestId('lab-hero')).toBeVisible();
    await page.locator('a[href="/lab/sandbox/"]').first().click();
    await expect(page.getByTestId('lab-sandbox-broken')).toContainText('這份實驗現在算不下去');
    await expect(result).toHaveAttribute('data-policy', 'ifrs@1');
    await expect(result.locator('caption').first()).toContainText('（IFRS 對照）');
    await expect(page.getByTestId('lab-basis')).toContainText('IFRS 對照，不計分');
    await expect(page.getByTestId('lab-basis-note')).toContainText('教材口徑算不下去');
    await expect(page.getByTestId('lab-basis-note')).not.toContainText('有標記');
    await expect(result.getByTestId('lab-row-diff')).toHaveCount(0);
    // 用鍵盤切回教材：這一套算不下去，報表收起來，但切換留著，焦點與播報都在
    await policyRadio(result, 'IFRS 對照').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(policyRadio(result, '教材')).toBeFocused();
    await expect(policyRadio(result, '教材')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('lab-policy-live')).toHaveText('已切換回教材口徑。');
    await expect(result.getByRole('heading', { level: 2 })).toHaveText('這組修改算不出報表');
    await expect(result.locator('table')).toHaveCount(0);
    // 重新載入回到教材口徑，切換一樣在，算得下去的那一套到得了
    await page.reload();
    await waitForApp(page);
    await expect(page.getByTestId('lab-sandbox-broken')).toBeVisible();
    await policyRadio(result, 'IFRS 對照').click();
    await expect(result).toHaveAttribute('data-policy', 'ifrs@1');
    await expect(result.locator('caption').first()).toContainText('（IFRS 對照）');
    await page.getByTestId('lab-sandbox-broken').getByRole('button', { name: '還原成故事原本的樣子' }).click();
    await expect(page.getByTestId('lab-sandbox-broken')).toHaveCount(0);
    await expect(page.getByTestId('lab-basis-note')).toContainText('和教材口徑不同的列有標記');
    await expect(result.getByTestId('lab-row-diff').first()).toBeVisible();
  });

  test('英文介面：切換、橫幅、caption 與差異標記', async ({ page }) => {
    await page.goto(`/en${DEMO5}`);
    await waitForApp(page);
    for (let s = 2; s <= 4; s++) {
      await page.getByTestId('lab-next').click();
      await expect(page.getByTestId('lab-stage-title')).toContainText(`Stage ${s} of 9`);
    }
    await policyRadio(page, 'IFRS comparison').click();
    await expect(page.getByTestId('lab-basis')).toContainText('IFRS comparison, not scored');
    await expect(page.getByTestId('lab-basis-version')).toHaveText('Follows the current IAS 1 and IAS 7, not IFRS 18.');
    await expect(page.getByTestId('lab-policy-live')).toHaveText(
      'Switched to the IFRS comparison; not scored. Lines that differ from the course basis are marked.',
    );
    await expect(page.locator('#ll-lab-table-is caption')).toContainText('(IFRS comparison)');
    const sga = page.locator('#ll-lab-table-is tr[data-line="is_sga_total"]');
    await expect(sga.getByTestId('lab-row-diff')).toHaveText('Differs from the course basis');
    await expect(sga.getByTestId('lab-row-basis')).toHaveText('Course basis: NT$250,000');
  });

  test('標記是按鈕：「與教材口徑不同」開這一列的名詞卡、「非 IFRS 項目」直接開到「IFRS 怎麼處理」段落，關閉後焦點回到標記', async ({ page }) => {
    await page.goto(DEMO5);
    await waitForApp(page);
    await toStage(page, 4);
    // 教材口徑：經常利益是非 IFRS 項目，標記按下去開到 IFRS 段落（段落標題取得焦點）
    const notIfrs = page.locator('#ll-lab-table-is tr[data-line="is_ordinary_income"] .ll-notetag--btn');
    await expect(notIfrs).toHaveAttribute('aria-label', /非 IFRS 項目：經常利益。查看 IFRS 怎麼處理/);
    await notIfrs.click();
    const dialog = page.locator('dialog[open]');
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('term-ifrs-section')).toBeVisible();
    await expect(page.getByTestId('term-ifrs-section').getByRole('heading', { level: 3 })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(notIfrs).toBeFocused();
    // IFRS 對照：開辦費那一列和教材不同，標記開名詞卡（這個名詞沒有 IFRS 段落，開到頂端）
    await policyRadio(page, 'IFRS 對照').click();
    const diff = page.locator('#ll-lab-table-is tr[data-line="is_organisation_costs_expense"] [data-testid="lab-row-diff"]');
    await expect(diff).toHaveAttribute('aria-label', '與教材口徑不同：開辦費。看名詞卡');
    await diff.click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('開辦費');
    await expect(dialog.getByRole('heading', { level: 2 })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(diff).toBeFocused();
    // 沒有名詞的列只是標籤，不是按鈕
    await expect(page.locator('#ll-lab-table-is tr[data-line="is_sga_total"] [data-testid="lab-row-diff"]')).toHaveAttribute(
      'aria-label',
      /與教材口徑不同：營業費用合計。看名詞卡/,
    );
  });

  test('ifrs@1 的列名是現行用語：開辦費、營業費用合計、現金流量表的現金增資與營業活動之淨現金流入（流出）', async ({ page }) => {
    await page.goto(DEMO5);
    await waitForApp(page);
    await toStage(page, 4);
    await policyRadio(page, 'IFRS 對照').click();
    await expect(page.locator('#ll-lab-table-is tr[data-line="is_organisation_costs_expense"] th')).toContainText('開辦費');
    await expect(page.locator('#ll-lab-table-is tr[data-line="is_sga_total"] th')).toContainText('營業費用合計');
    await toStage(page, 5, 4);
    await expect(page.locator('#ll-lab-table-cf tr[data-line="cf_share_issue"] th')).toContainText('現金增資(+)');
    await expect(page.locator('#ll-lab-table-cf tr[data-line="cf_operating_total"] th')).toContainText('營業活動之淨現金流入（流出）');
    await expect(page.locator('#ll-lab-table-cf tr[data-line="cf_net_change"] th')).toContainText('本期現金及約當現金增加（減少）數');
  });

  test('累計或本筆變動記在 labView.window：切到本筆變動後重新載入仍是本筆變動；選到哪張表不記', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop-chromium' || testInfo.project.name === 'desktop-firefox', '電腦版三表並排，沒有累計／本筆變動的切換');
    await page.goto(DEMO5);
    await waitForApp(page);
    await toStage(page, 4);
    await page.getByRole('radio', { name: '本筆變動' }).click();
    await expect(page.locator('#ll-lab-table-is thead')).toContainText('本筆變動');
    await expect
      .poll(async () => {
        const settings = (await readStore(page, 'settings')) as { key: string; value: { window?: unknown } }[];
        return settings.find((s) => s.key === 'labView')?.value.window;
      })
      .toBe('transaction');
    await page.getByRole('radio', { name: '資產負債表' }).click();
    await page.reload();
    await waitForApp(page);
    await toStage(page, 4);
    await expect(page.getByRole('radio', { name: '本筆變動' })).toBeChecked();
    await expect(page.locator('#ll-lab-table-is thead')).toContainText('本筆變動');
    await expect(page.getByRole('radio', { name: '損益表' })).toBeChecked();
  });
});

test.describe('來源面板載入失敗或還沒好（M4b）', () => {
  test.use({ serviceWorkers: 'block' });
  const TRACE_CHUNK = /\/assets\/lab-trace-[^/]+\.js$/;
  const CORE_CHUNK = /\/assets\/(lab-core|core-data)-[^/]+\.js$/;
  const DEMO7 = `/lab/story/${STORY}/${STEP7}/?mode=demo`;
  /** 攔下符合的 chunk，回傳放行的函式；不用 unroute，動態 import 的重試要走得到放行之後的路 */
  async function failUntilReleased(page: Page, chunk: RegExp): Promise<() => void> {
    let blocked = true;
    await page.route(chunk, (route) => (blocked ? route.abort() : route.continue()));
    return () => {
      blocked = false;
    };
  }
  /** 有提示；放行之後再試一次：Chromium 就開了。WebKit 把失敗的動態 import 記在模組表裡、不會再發請求，所以提示換成重新載入，載入之後整頁正常 */
  async function expectToastThenRetry(page: Page, toasts: string, release: () => void, browserName: string): Promise<void> {
    const region = page.getByTestId(toasts);
    await expect(region).toContainText('讀不到這個數字的來源，可能是離線了。');
    await expect(page.getByTestId('lab-trace')).toHaveCount(0);
    release();
    await region.getByRole('button', { name: '再試一次' }).click();
    if (browserName === 'webkit') {
      await expect(region).toContainText('還是讀不到這個數字的來源');
      await expect(page.getByTestId('lab-trace')).toHaveCount(0);
      await region.getByRole('button', { name: '重新載入' }).click();
      await expect(region).toHaveText('');
      await waitForApp(page);
      return;
    }
    await expect(page.getByTestId('lab-trace')).toBeVisible();
    await expect(region).not.toContainText('讀不到這個數字的來源');
  }

  test('步驟頁：面板的模組載不到時有提示，再試一次就開', async ({ page, browserName }) => {
    const release = await failUntilReleased(page, TRACE_CHUNK);
    await page.goto(DEMO7);
    await waitForApp(page);
    for (let s = 2; s <= 4; s++) {
      await page.getByTestId('lab-next').click();
      await expect(page.getByTestId('lab-stage-title')).toContainText(`階段 ${s}／9`);
    }
    await page.locator('#ll-lab-table-is [data-line="is_revenue"] [data-testid="lab-trace-value"]').click();
    await expectToastThenRetry(page, 'lab-toasts', release, browserName);
  });

  test('指標實驗室：面板的模組載不到時有提示，再試一次就開', async ({ page, browserName }) => {
    const release = await failUntilReleased(page, TRACE_CHUNK);
    await page.goto('/lab/ratios/');
    await waitForApp(page);
    await page.getByTestId('lab-trace-ratio').first().click();
    await expectToastThenRetry(page, 'lab-ratios-toasts', release, browserName);
  });

  test('自由實驗：面板的模組載不到時有提示，再試一次就開', async ({ page, browserName }) => {
    const release = await failUntilReleased(page, TRACE_CHUNK);
    await page.goto('/lab/sandbox/');
    await waitForApp(page);
    await page.getByTestId('lab-sandbox-result').getByTestId('lab-trace-value').first().click();
    await expectToastThenRetry(page, 'lab-sandbox-toasts', release, browserName);
  });

  test('核心載不到時點恆等式的數字：有提示，之後核心載好面板也不會自己彈出來', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit 不會重新請求失敗的動態 import：同一份文件裡核心不會再載好，所以面板也不可能自己彈出來');
    const release = await failUntilReleased(page, CORE_CHUNK);
    await page.goto(DEMO7);
    await waitForApp(page);
    await expect(page.getByTestId('lab-session')).toHaveAttribute('data-core', 'pending');
    await page.getByTestId('lab-equation').getByTestId('lab-trace-value').first().click();
    const region = page.getByTestId('lab-toasts');
    await expect(region).toContainText('讀不到這個數字的來源');
    await expect(page.getByTestId('lab-trace')).toHaveCount(0);
    release();
    await page.getByTestId('lab-next').click();
    await expect(page.getByTestId('lab-stage-title')).toContainText('階段 2／9');
    await expect(page.getByTestId('lab-session')).toHaveAttribute('data-core', 'ready');
    await expect(page.getByTestId('lab-trace')).toHaveCount(0);
    await expect(region).not.toContainText('讀不到這個數字的來源');
  });

  test('核心載不到時點恆等式的數字：提示裡的再試一次載好核心就開', async ({ page, browserName }) => {
    const release = await failUntilReleased(page, CORE_CHUNK);
    await page.goto(DEMO7);
    await waitForApp(page);
    await page.getByTestId('lab-equation').getByTestId('lab-trace-value').first().click();
    await expectToastThenRetry(page, 'lab-toasts', release, browserName);
  });

  test('名詞索引還沒好時點恆等式的數字：面板等名稱齊了才開，不會出現原始線 ID', async ({ page }) => {
    const held: Route[] = [];
    const termIndex = /\/content\/[^/]+\/term-index\.[^/]+\.json$/;
    await page.route(termIndex, (route) => {
      held.push(route);
    });
    await page.goto(DEMO7);
    await waitForApp(page);
    const session = page.getByTestId('lab-session');
    await expect(session).toHaveAttribute('data-core', 'ready');
    await expect(session).toHaveAttribute('data-terms', 'pending');
    await page.getByTestId('lab-equation').getByTestId('lab-trace-value').first().click();
    await expect.poll(() => held.length).toBeGreaterThan(0);
    await expect(page.getByTestId('lab-trace')).toHaveCount(0);
    for (const r of held.splice(0)) await r.continue();
    await page.unroute(termIndex);
    const sheet = page.getByTestId('lab-trace');
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId('lab-trace-tree')).toContainText('流動資產');
    await expect(sheet).not.toContainText('bs_');
  });
});
