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
    await expect(sgaExpand).toHaveAttribute('aria-label', /銷管費用小計 NT\$250,000，等於 外包費用 NT\$200,000 ＋ 事務用品費 NT\$50,000/);
    await sgaExpand.click();
    await expect(sgaExpand).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('lab-trace-live')).toHaveText('銷管費用小計：外包費用 NT$200,000 ＋ 事務用品費 NT$50,000');
    const second = first.nth(1).locator('.ll-lab-trace__list--2 > li');
    await expect(second).toHaveCount(2);
    await expect(first.nth(1)).toContainText('另有 6 個 0 元的項目');
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
    // 小螢幕一次只顯示一張表：關面板後切到另一張表（損益表）；電腦三表並排，兩張表的列都標出
    await expect(page.locator('#ll-lab-table-is tr[data-line="is_net_income"]')).toHaveClass(/is-marked/);
    if ((await page.locator('#ll-lab-table-bs').count()) > 0)
      await expect(page.locator('#ll-lab-table-bs tr[data-line="bs_retained_earnings"]')).toHaveClass(/is-marked/);
    else await expect(page.getByRole('radio', { name: '損益表' })).toHaveAttribute('aria-checked', 'true');
    // 指標卡
    await toStage(page, 8, 6);
    await page.getByTestId('lab-trace-ratio').first().click();
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId('lab-trace-tree')).toContainText('分子');
    await expect(page.getByTestId('lab-trace-tree')).toContainText('分母');
    await page.getByTestId('lab-trace-drill').first().click();
    await expect(page.getByTestId('lab-trace-focus')).toBeVisible();
    await expect(page.getByTestId('lab-trace-path')).toBeVisible();
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
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(oi).toBeFocused();
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
    await expect(sga).toHaveClass(/is-diff/);
    await expect(sga.getByTestId('lab-row-diff')).toHaveText('與教材口徑不同');
    await expect(sga.getByTestId('lab-row-basis')).toHaveText('教材口徑：NT$250,000');
    await expect(sga.getByTestId('lab-trace-value')).toHaveAttribute('aria-label', /NT\$550,000，看這個數字從哪裡來/);
    await expect(page.locator('#ll-lab-table-is tr[data-line="is_revenue"] [data-testid="lab-row-diff"]')).toHaveCount(0);
    await expect.poll(() => labViewPolicy(page)).toBe('ifrs@1');
    // 來源面板依 ifrs@1 展開，副標帶標記
    await sga.getByTestId('lab-trace-value').click();
    await expect(page.getByTestId('lab-trace')).toBeVisible();
    await expect(page.getByTestId('lab-trace-basis')).toHaveText('IFRS 對照');
    await expect(page.getByTestId('lab-trace').getByRole('heading', { level: 2 })).toContainText('NT$550,000');
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

  test('英文介面：切換、橫幅、caption 與差異標記', async ({ page }) => {
    await page.goto(`/en${DEMO5}`);
    await waitForApp(page);
    for (let s = 2; s <= 4; s++) {
      await page.getByTestId('lab-next').click();
      await expect(page.getByTestId('lab-stage-title')).toContainText(`Stage ${s} of 9`);
    }
    await policyRadio(page, 'IFRS comparison').click();
    await expect(page.getByTestId('lab-basis')).toContainText('IFRS comparison, not scored');
    await expect(page.getByTestId('lab-policy-live')).toHaveText(
      'Switched to the IFRS comparison; not scored. Lines that differ from the course basis are marked.',
    );
    await expect(page.locator('#ll-lab-table-is caption')).toContainText('(IFRS comparison)');
    const sga = page.locator('#ll-lab-table-is tr[data-line="is_sga_total"]');
    await expect(sga.getByTestId('lab-row-diff')).toHaveText('Differs from the course basis');
    await expect(sga.getByTestId('lab-row-basis')).toHaveText('Course basis: NT$250,000');
  });
});
