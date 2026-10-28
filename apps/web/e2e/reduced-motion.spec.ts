// 減少動態效果（10 第 4 節第 4 項）：Tab bar 選取指示直接跳到新位置、不收合；M3 的章末慶祝與徽章 Toast 沒有任何動畫或轉場。
// 截圖由 CI 的 artifact 保留供人工比對（像素基準要在 CI 的 Linux 執行器上產生，本機 macOS 的字型與算繪不同，不放基準檔）
// 最後兩組是站規 4.2 第 7 項的減少動態部分（link-style.spec 的滑過與按下）：按鈕、選單列、名詞卡、地圖節點滑過與按下時本身沒有 transform，後代也不動；
// 按鈕狀態板的立體按鈕按下時底邊剩 1px（站規 1.2.3、0.4 的 A1）。換成桌面的滑鼠與視窗才量得到滑過。
import { expect, test, type Page } from '@playwright/test';
import { forEachSample, motionOf, openBoard, release, STATE_CLASSES } from './link-audit.ts';
import { ALL_THEMES, caseByName, caseData, openCase } from './page-states.ts';

test('減少動態：切換 Tab 時鏡片沒有進行中的動畫，捲動時不收合', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: '圖鑑', exact: true }).click();
  await expect(page).toHaveURL(/\/terms\/$/);
  const state = await page.evaluate(() => document.getElementById('ll-tabbar')?.className ?? '');
  expect(state).not.toContain('is-moving');
  expect(state).not.toContain('is-lifted');
  await page.goto('/level/lv_h2zx7srx/');
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(300);
  const collapsed = await page.evaluate(() => document.getElementById('ll-tabbar')?.classList.contains('is-collapsed'));
  expect(collapsed).toBe(false);
  await page.screenshot({ path: 'test-results/reduced-motion-level.png', fullPage: false });
});

/**
 * 從頁面一開始就記下所有動態（finding quiz-12）：CSS 動畫與轉場的開始（一閃而過的也記得到），以及 JS 觸發的動態：
 * Web Animations（Element.prototype.animate，地圖角色沿路線移動用它，播完會 cancel，所以 getAnimations 看不到）、
 * 平滑捲動（scrollIntoView、scrollTo、scrollBy 帶 behavior: 'smooth'）。還記下 ?from 那一關星星籤的星數變化（逐顆點亮會出現 1、2）。
 */
async function installMotionProbe(page: Page, starsLevelId?: string): Promise<void> {
  await page.addInitScript((levelId) => {
    const w = window as unknown as { __motion: string[]; __stars: string[] };
    w.__motion = [];
    w.__stars = [];
    const log = (e: Event) => {
      const t = e.target as Element | null;
      const name = (e as AnimationEvent).animationName ?? (e as TransitionEvent).propertyName;
      w.__motion.push(`${e.type}:${name}:${(t?.getAttribute('class') ?? t?.nodeName ?? '').slice(0, 40)}`);
    };
    document.addEventListener('animationstart', log, true);
    document.addEventListener('transitionstart', log, true);
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, kf: Keyframe[] | PropertyIndexedKeyframes | null, opts?: number | KeyframeAnimationOptions) {
      const d = typeof opts === 'number' ? opts : Number(opts?.duration ?? 0);
      if (d > 0) w.__motion.push(`waapi:${d}:${(this.getAttribute('class') ?? this.nodeName).slice(0, 40)}`);
      return animate.call(this, kf, opts);
    };
    const smooth = (name: string, arg: unknown) => {
      if (arg && typeof arg === 'object' && (arg as { behavior?: string }).behavior === 'smooth') w.__motion.push(`smooth:${name}`);
    };
    const siv = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element, arg?: boolean | ScrollIntoViewOptions) {
      smooth('scrollIntoView', arg);
      return siv.call(this, arg);
    };
    for (const [target, names] of [
      [window, ['scrollTo', 'scrollBy']],
      [Element.prototype, ['scrollTo', 'scrollBy']],
    ] as const) {
      for (const name of names) {
        const orig = (target as unknown as Record<string, (...a: unknown[]) => unknown>)[name]!;
        (target as unknown as Record<string, (...a: unknown[]) => unknown>)[name] = function (this: unknown, ...args: unknown[]) {
          smooth(name, args[0]);
          return orig.apply(this, args);
        };
      }
    }
    if (levelId)
      document.addEventListener('DOMContentLoaded', () => {
        new MutationObserver(() => {
          const v = document.querySelector(`[data-level-id="${levelId}"] .ll-node__stars`)?.getAttribute('data-stars');
          if (v !== undefined && v !== null && w.__stars[w.__stars.length - 1] !== v) w.__stars.push(v);
        }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-stars'] });
      });
  }, starsLevelId);
}

/** 從頁面一開始就記下所有動畫、轉場與 JS 動態；回傳的函式取出開始過的與現在執行中的 */
async function recordMotion(page: Page, starsLevelId?: string): Promise<() => Promise<string[]>> {
  await installMotionProbe(page, starsLevelId);
  return async () => {
    const running = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.playState === 'running')
        .map((a) => `running:${(a as CSSAnimation).animationName ?? a.constructor.name}`),
    );
    const started = await page.evaluate(() => (window as unknown as { __motion: string[] }).__motion);
    return [...started, ...running];
  };
}

// M3 的章末慶祝與徽章 Toast（17 第 12 節第 3 項）：減少動態時直接出現在最後的狀態，沒有任何動畫、轉場或 JS 動態；截圖由 CI 的 artifact 保留
test('減少動態：跨章的章末慶祝直接顯示完成，角色直接站到下一章第一關，過程沒有動畫、平滑捲動或逐顆點亮', async ({ page }) => {
  const motion = await recordMotion(page, 'lv_fx010004');
  await page.goto('/play/?ll-fixture=quest&ll-fixture-progress=ch1done&from=lv_fx010004');
  await page.getByTestId('quest-map').waitFor();
  await expect(page).toHaveURL(/ll-fixture-progress=ch1done$/, { timeout: 10_000 });
  await expect(page.locator('[data-chapter-id="ch_fx0001"] [data-testid="chapter-end"]')).toContainText('第 1 章完成');
  await expect(page.locator('[aria-current="step"]')).toHaveAttribute('aria-label', /第 2 章第 1 關/);
  await expect(page.locator('[aria-current="step"]')).toBeFocused();
  // 角色行走（Web Animations）、平滑捲動、CSS 動畫與轉場都沒有
  expect(await motion()).toEqual([]);
  // 星星同時亮：序列裡只有 0 與最後的星數，沒有逐顆點亮的中間值
  const stars = (await page.evaluate(() => (window as unknown as { __stars: string[] }).__stars)).map(Number);
  const final = stars[stars.length - 1]!;
  expect(final).toBeGreaterThan(0);
  expect(stars.filter((n) => n > 0 && n < final)).toEqual([]);
  await page.screenshot({ path: 'test-results/reduced-motion-chapter-end.png', fullPage: false });
});

test('減少動態：取得徽章的 Toast 直接出現，沒有進場動畫，徽章圖也不閃', async ({ page }) => {
  const motion = await recordMotion(page);
  await page.goto('/play/?ll-fixture=quest&ll-fixture-progress=ch1new');
  const toasts = page.getByTestId('badge-toasts');
  // 標題「取得精通徽章」，第二行是徽章名稱（Toast 的 collect 樣式）
  await expect(toasts.locator('.ll-toast__title')).toHaveText('取得精通徽章');
  await expect(toasts.locator('.ll-toast__body')).toHaveText('開店了');
  await page.waitForTimeout(400);
  expect(await motion()).toEqual([]);
  await page.screenshot({ path: 'test-results/reduced-motion-badge-toast.png', fullPage: false });
});

// ───── 完整流程（10 第 4 節第 4 項「以 reducedMotion: 'reduce' 跑完整流程並截圖比對」，QA 第 2 輪）─────
// 地圖與關卡表單、作答（選答、回饋、名詞卡、結果頁）、圖鑑搜尋與名詞頁、設定（外觀、深色風味、計時開關）、「我的」與錯題本都走一次。
// 每一步先等畫面連續兩張截圖逐像素相同（進度與場景是第一次繪製後才載入的資料，不是動畫），再斷言從上一步到這一步沒有任何
// animationstart 或 transitionstart（包括一閃而過的短轉場）、現在也沒有執行中的動畫。截圖比對在同一次執行裡做，不需要基準檔，
// macOS 與 CI 的 Linux 都成立；跨平台的像素基準仍要在 CI 的 Linux 執行器上產生（見檔頭）。截圖存成 test-results/reduced-motion-flow-*.png 給人工看。

/** 整個頁面生命週期的動畫與轉場紀錄（SPA 換頁不重新載入，所以每一步取完就清空） */
async function motionLog(page: Page): Promise<(step: string) => Promise<void>> {
  // 和上面共用同一段記錄（含 JS 的 Web Animations 與平滑捲動），完整流程的地圖步驟也抓得到
  await installMotionProbe(page);
  return async (step: string) => {
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    // 進度資料庫與場景在第一次繪製後才載入（apps/web/src/lib/idle.ts），所以先等畫面連續兩張相同（資料載完），再存截圖
    let prev = await page.screenshot({ animations: 'allow', caret: 'hide' });
    let stable = false;
    for (let i = 0; i < 20 && !stable; i++) {
      await page.waitForTimeout(300);
      const cur = await page.screenshot({ animations: 'allow', caret: 'hide' });
      stable = cur.equals(prev);
      prev = cur;
    }
    expect(stable, `${step}：6 秒內畫面一直在變`).toBe(true);
    await page.screenshot({ path: `test-results/reduced-motion-flow-${step}.png`, animations: 'allow', caret: 'hide' });
    const motion = await page.evaluate(() => {
      const w = window as unknown as { __motion: string[] };
      const started = w.__motion.splice(0);
      const running = document
        .getAnimations()
        .filter((a) => a.playState === 'running')
        .map((a) => `running:${(a as CSSAnimation).animationName ?? a.constructor.name}`);
      return [...started, ...running];
    });
    expect(motion, `${step}：動畫或轉場`).toEqual([]);
  };
}

async function freshProgress(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('main h1').first().waitFor();
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

/** 第 1 章第 1 關只留單選與是非（點第一個選項就能確認），讓流程不依賴題目內容；manifest 與兩種語言的章節包（關卡在裡面，schemaVersion 3）一起改 */
const FLOW_LEVEL = 'lv_h2zx7srx';
type LevelJson = { level: { id: string; questionIds: string[] }; questions: { id: string; type: string }[] };
type BundleJson = { levels: LevelJson[] };
async function onlyChoiceQuestions(page: Page): Promise<void> {
  const manifest = (await (await page.request.get('/content/content-manifest.json')).json()) as {
    levels: { id: string; questionIds: string[]; files: Record<string, string> }[];
  };
  const lv = manifest.levels.find((l) => l.id === FLOW_LEVEL)!;
  const bundle = (await (await page.request.get(`/${lv.files['zh-TW']}`)).json()) as BundleJson;
  const file = bundle.levels.find((l) => l.level.id === FLOW_LEVEL)!;
  const ids = file.questions.filter((q) => q.type === 'single_choice' || q.type === 'true_false').map((q) => q.id);
  expect(ids.length).toBeGreaterThan(1);
  await page.route('**/content/content-manifest.json', async (route) => {
    const res = await route.fetch();
    const json = (await res.json()) as typeof manifest;
    for (const l of json.levels) if (l.id === FLOW_LEVEL) l.questionIds = ids;
    await route.fulfill({ response: res, json });
  });
  for (const locale of ['zh-TW', 'en'])
    await page.route(`**/${lv.files[locale]}`, async (route) => {
      const res = await route.fetch();
      const json = (await res.json()) as BundleJson;
      const target = json.levels.find((l) => l.level.id === FLOW_LEVEL)!;
      target.questions = target.questions.filter((q) => ids.includes(q.id));
      target.level.questionIds = ids;
      await route.fulfill({ response: res, json });
    });
}

test('減少動態（完整流程）：地圖、關卡表單、作答、名詞卡、結果頁', async ({ page }) => {
  test.setTimeout(120_000);
  await freshProgress(page);
  const step = await motionLog(page);
  await onlyChoiceQuestions(page);
  await page.goto('/play/');
  await page.getByTestId('quest-map').waitFor();
  await step('map');
  await page.locator('[aria-current="step"]').click();
  const sheet = page.getByTestId('level-sheet');
  await expect(sheet).toBeVisible();
  await step('level-sheet');
  await sheet.getByRole('link', { name: '開始' }).click();
  await expect(page).toHaveURL(new RegExp(`/level/${FLOW_LEVEL}/$`));
  const card = page.locator('.ll-question');
  // 作答頁沒有骨架：第一題齊了整頁才顯示（lib/page-ready.tsx）
  await expect(page.locator('.ll-page[data-ready="true"]')).toBeVisible();
  await step('question');
  for (let i = 0; ; i++) {
    await card.getByRole('radio').first().check();
    await page.getByRole('button', { name: '確認答案' }).click();
    await expect(page.locator('.ll-feedback__title')).toBeFocused();
    if (i === 0) {
      await step('feedback');
      const chip = page.getByRole('button', { name: /名詞卡：/ }).first();
      await chip.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.locator('.ll-sheet__definition')).toBeVisible();
      await step('term-card');
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    }
    const next = page.getByRole('button', { name: /下一題|看結果/ }).first();
    await next.click();
    if (await page.getByTestId('result-title').isVisible()) break;
    // 換題後作答區齊了題目卡才顯示（.ll-question-wrap），沒有骨架
    await expect(page.locator('.ll-question-wrap[data-ready="true"]')).toBeVisible();
    expect(i, '關卡題數').toBeLessThan(20);
  }
  await expect(page.getByTestId('result-title')).toBeFocused();
  await step('result');
});

test('減少動態（完整流程）：圖鑑搜尋、名詞頁、設定、「我的」與錯題本', async ({ page }) => {
  test.setTimeout(120_000);
  await freshProgress(page);
  const step = await motionLog(page);
  await page.goto('/terms/');
  await page.locator('[data-term-id]').first().waitFor();
  await step('terms');
  await page.getByTestId('terms-search').fill('資產');
  await expect(page).toHaveURL(/q=/);
  await step('terms-search');
  await page.locator('[data-term-id] a').first().click();
  await expect(page).toHaveURL(/\/terms\/tm_[a-z0-9]+\/$/);
  await page.locator('main h1').waitFor();
  await step('term');
  await page.goto('/me/settings/');
  await page.getByRole('radio', { name: '深色' }).waitFor();
  await step('settings');
  await page.getByRole('radio', { name: '深色' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await step('settings-dark');
  await page.getByRole('radio', { name: '莓果' }).click();
  await step('settings-berry');
  await page.getByRole('switch', { name: '作答時計時' }).click();
  await expect(page.getByRole('switch', { name: '作答時計時' })).toHaveAttribute('aria-checked', 'true');
  await step('settings-timer');
  await page.getByRole('navigation').getByRole('link', { name: '我的', exact: true }).click();
  await expect(page).toHaveURL(/\/me\/$/);
  await page.locator('main h1').waitFor();
  await step('me');
  await page.goto('/review/');
  await page.locator('main h1').waitFor();
  await step('review');
});

test.describe('減少動態：滑過與按下沒有位移（站規 4.2 第 7 項、1.2.3、0.4 的 A1）', () => {
  test.use({ isMobile: false, hasTouch: false, viewport: { width: 1280, height: 900 } });
  const PAGES = [
    caseByName('章節頁', '主線有進度'),
    caseByName('名詞圖鑑', '參考名詞展開'),
    caseByName('闖關', '地圖 quest fixture'),
    caseByName('作答', '答錯'),
    caseByName('我的', '有收藏（含下架題）'),
  ];
  for (const c of PAGES) {
    test(`本身沒有 transform、translate、scale，後代和靜止時一樣：${c.group}：${c.name}`, async ({ page, request }) => {
      test.setTimeout(180_000);
      await openCase(page, c, { width: 1280, prefix: '', theme: ALL_THEMES[0]!, data: await caseData(request) });
      expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
      const violations: string[] = [];
      let sampled = 0;
      for (const sel of [...STATE_CLASSES, '.ll-node__btn']) {
        sampled += await forEachSample(page, sel, async (i) => {
          const el = page.locator(`${sel}:visible`).nth(i);
          await page.mouse.move(1, 1);
          const rest = await el.evaluate(motionOf);
          const check = async (phase: string) => {
            const now = await el.evaluate(motionOf);
            const [transform, translate, scale] = now[0]!.split('|');
            if (transform !== 'none' || translate !== 'none' || scale !== 'none') violations.push(`${phase} ${sel}#${i} 本身位移 ${now[0]}`);
            if (now.length === rest.length)
              now.forEach((m, k) => k > 0 && m !== rest[k] && violations.push(`${phase} ${sel}#${i} 第 ${k} 個後代位移 ${rest[k]} → ${m}`));
          };
          await el.hover();
          await check('hover');
          await page.mouse.down();
          await check('active');
          await release(page);
        });
      }
      expect(sampled, '至少量到一個元件').toBeGreaterThan(0);
      expect([...new Set(violations)]).toEqual([]);
    });
  }

  test('按鈕狀態板：立體按鈕滑過與按下不位移，按下時底邊剩 1px（只在 VITE_LL_FIXTURES=1 的建置）', async ({ page }) => {
    test.skip(!(await openBoard(page, ALL_THEMES[0]!, 1280)), '這個建置沒有 VITE_LL_FIXTURES=1（正式建置不含按鈕狀態板）');
    const violations: string[] = [];
    for (const v of ['primary', 'secondary', 'danger']) {
      for (const s of ['sm', 'md', 'lg']) {
        const el = page.locator(`[data-board="${v}-${s}-rest"]`);
        await el.scrollIntoViewIfNeeded();
        await el.hover();
        const hover = await el.evaluate((n) => getComputedStyle(n).transform);
        if (hover !== 'none') violations.push(`hover ${v}-${s} 位移 ${hover}`);
        await page.mouse.down();
        const active = await el.evaluate((n) => ({ transform: getComputedStyle(n).transform, shadow: getComputedStyle(n).boxShadow }));
        if (active.transform !== 'none') violations.push(`active ${v}-${s} 位移 ${active.transform}`);
        if (!/ 0px 1px 0px/.test(active.shadow)) violations.push(`active ${v}-${s} 底邊不是 1px（${active.shadow}）`);
        await release(page);
      }
    }
    expect(violations).toEqual([]);
  });
});
