// M3 名詞圖鑑、徽章、收藏、計時設定與安裝圖解（03 第 2.7、2.10 節、06 第 2.6 節、10 第 10 節第 5 到 7 項、站規 2.6 與 2.7）：
// 進度資料直接寫進 IndexedDB（結構由 App 啟動時建立，資料全部自編），看頁面怎麼顯示。快照用 LL_INCLUDE_DRAFTS=1 的本機建置。
// 名詞的期待值（名稱、定義、會在哪一關遇到）一律從正在服務的快照算出（glossary-data.ts），內容改寫後不必改測試。
// 一次出現（維護者 2026-10-26）：圖鑑、名詞頁與錯題本在資料齊了之後才由 PageReveal 拉開布幕（.ll-page[data-ready="true"]，lib/page-ready.tsx）；
// 拉開的那一刻計數已是數字、已收進的卡已有印章，沒有「…」與骨架。
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { waitForApp, waitForProgressDb } from './helpers.ts';
import {
  chapterIndexOf,
  chapterNoOf,
  escapeRegExp,
  isReference,
  manifestOf,
  matches,
  meetOf,
  termDetailOf,
  termIndexOf,
  visibleChunk,
  withOther,
  type TermDetail,
  type TermEntry,
} from './glossary-data.ts';

const DB = 'ledgerland';
// iOS 26 的 Safari：UA 裡的系統版本凍結在 18_x，只有 Version/ 是 26（finding pages-b-2；06 第 2.6 節依 Version/ 判斷）
const IOS_SAFARI_26 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const IOS_SAFARI_18 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const IOS_SAFARI_27 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1';
// 第 3 關的取捨題（收藏的測試用）
const JUDGMENT_QUESTION = 'q_ytrpj345';
const JUDGMENT_LEVEL = 'lv_k51ne1k1';
// 另一題取捨題（延伸章「利害關係人觀點」第 1 關；收藏兩筆的鍵盤測試用）
const JUDGMENT_QUESTION_2 = 'q_pxqnresy';

test.skip(({ browserName }) => browserName === 'firefox', '環境模擬只在 Chromium 與 WebKit 跑');

/** 等頁面的布幕拉開（資料齊了、整頁一次出現） */
const revealed = (page: Page) => page.locator('.ll-page[data-ready="true"]');

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

/** 第一個主線章節裡最早會遇到的名詞（收集區的第一張卡），和它在地圖上的位置與名稱 */
async function firstCoreTerm(request: APIRequestContext) {
  const m = await manifestOf(request);
  const [terms, chapters] = await Promise.all([termIndexOf(request, 'zh-TW'), chapterIndexOf(request, 'zh-TW')]);
  const core = [...m.chapters].sort((a, b) => a.order - b.order).filter((c) => c.scope !== 'extension');
  for (const c of core) {
    for (const levelId of c.levelIds ?? []) {
      const term = terms.find((t) => !t.unlock && t.firstLevel?.levelId === levelId);
      if (!term) continue;
      const summary = chapters.find((x) => x.id === c.id);
      return {
        term,
        levelId,
        chapterNo: chapterNoOf(m, c.id).no,
        levelNo: c.levelIds!.indexOf(levelId) + 1,
        chapterTitle: summary?.title ?? '',
        levelTitle: summary?.levels?.find((l) => l.id === levelId)?.title,
      };
    }
  }
  throw new Error('快照裡沒有主線章節用到的名詞');
}

/** 延伸章裡最早會遇到的名詞（meetOf 落在延伸章），和它在地圖上的章序與關序 */
async function firstExtensionTerm(request: APIRequestContext) {
  const m = await manifestOf(request);
  const terms = await termIndexOf(request, 'zh-TW');
  const ext = [...m.chapters].sort((a, b) => a.order - b.order).filter((c) => c.scope === 'extension');
  for (const c of ext) {
    for (const levelId of c.levelIds ?? []) {
      const term = terms.find((t) => !isReference(t) && meetOf(m, t)?.levelId === levelId);
      if (!term) continue;
      return { term, levelId, chapterNo: chapterNoOf(m, c.id).no, levelNo: c.levelIds!.indexOf(levelId) + 1 };
    }
  }
  return undefined;
}

/** 每一桶完整內容裡找第一個符合條件的名詞 */
async function findDetail(request: APIRequestContext, pick: (t: TermDetail) => boolean): Promise<TermDetail | undefined> {
  const m = await manifestOf(request);
  for (const path of Object.values(m.termDetails['zh-TW']!)) {
    const list = (await (await request.get(`/${path}`)).json()) as TermDetail[];
    const hit = list.find(pick);
    if (hit) return hit;
  }
  return undefined;
}

test.describe('名詞圖鑑（03 第 2.10 節、站規 2.6）', () => {
  test('未收進：卡片是虛線空位並寫在哪一關遇到；名詞頁有解鎖任務卡與 primary「前往這一關」，定義照樣顯示', async ({ page, request }) => {
    const f = await firstCoreTerm(request);
    await page.goto('/terms/');
    await waitForApp(page);
    const item = page.locator(`[data-term-id="${f.term.id}"]`);
    await expect(item).toHaveAttribute('data-unlocked', 'locked');
    const card = item.getByRole('link');
    await expect(card).toContainText(f.term.label);
    const code = `${f.chapterNo}-${f.levelNo}`;
    // 依章節分組：章名已在分組標題上，畫面只寫「在 1-1 遇到」（類別的下一行）；可讀名稱仍帶關卡名
    await expect(card.locator('.ll-termitem__meet')).toHaveText(`在 ${code} 遇到`);
    await expect(card).toContainText(f.levelTitle ? `在 ${code}「${f.levelTitle}」遇到` : `在 ${code} 遇到`);
    // 狀態同時用形狀（虛線空位、沒有印章）與文字（給螢幕閱讀器的「未收進」）表達
    await expect(card).toContainText('未收進');
    await expect(item.locator('.ll-termemblem--locked')).toHaveCount(1);
    await expect(item.locator('.ll-stamp')).toHaveCount(0);
    // 名詞卡不是普通超連結：沒有底線
    expect(await card.evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe('none');
    await expect(page.getByTestId('terms-progress')).toContainText('已收進 0／');
    // 收集進度卡的大數字是百分比：「0／N」只寫在頁首的統計膠囊，不在同一個畫面重複（看圖驗收第 2 輪）
    await expect(page.getByTestId('terms-progress-pct')).toHaveText('0%');
    // 代號是小膠囊
    await expect(card.locator('.ll-termitem__code')).toHaveText(code);
    await expect(page.getByRole('heading', { level: 2, name: new RegExp(`^第 ${f.chapterNo} 章：${escapeRegExp(f.chapterTitle)}`) })).toBeVisible();
    if (f.levelTitle) {
      // 依名稱：畫面是「[1-1] 關卡名」兩部分（代號不會單獨留在一行），「在…遇到」的整句只給螢幕閱讀器
      await page.getByRole('radio', { name: '依名稱' }).click();
      await expect(page).toHaveURL(/group=name/);
      const shown = card.locator('.ll-termitem__meet');
      await expect(shown).toHaveAttribute('aria-hidden', 'true');
      await expect(shown.locator('.ll-termitem__code')).toHaveText(code);
      await expect(shown.locator('.ll-termitem__ltitle')).toHaveText(f.levelTitle);
      await expect(card).toContainText(`在 ${code}「${f.levelTitle}」遇到`);
      const [chip, title] = await Promise.all([
        shown.locator('.ll-termitem__code').boundingBox(),
        shown.locator('.ll-termitem__ltitle').evaluate((el) => {
          const r = el.getClientRects()[0]!;
          return { y: r.y, height: r.height };
        }),
      ]);
      expect(Math.abs(chip!.y + chip!.height / 2 - (title.y + title.height / 2))).toBeLessThan(8);
      await page.getByRole('radio', { name: '依章節' }).click();
      await expect(page).not.toHaveURL(/group=name/);
    }

    await card.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(f.term.label);
    const status = page.getByTestId('term-status');
    await expect(status).toHaveAttribute('data-unlocked', 'locked');
    await expect(status.getByTestId('term-meet')).toHaveText(`在第 ${f.chapterNo} 章第 ${f.levelNo} 關遇到`);
    const go = status.getByRole('link', { name: '前往這一關' });
    await expect(go).toHaveAttribute('href', `/level/${f.levelId}/`);
    await expect(go).toHaveClass(/ll-btn--primary/);
    // 鎖住的只是收藏狀態：定義照樣顯示（finding glossary-5：驗定義本身，期待值來自快照）
    const def = page.getByTestId('term-definition');
    await expect(def.locator('p').first()).not.toBeEmpty();
    const chunk = visibleChunk((await termDetailOf(request, f.term.id, 'zh-TW')).definition);
    if (chunk !== '') await expect(def).toContainText(chunk);
    // 頁首返回（畫面上是「圖鑑」）與頁尾的次要按鈕
    await expect(page.getByRole('link', { name: '回到名詞圖鑑' })).toHaveCount(2);
    await expect(page.getByRole('link', { name: '回到名詞圖鑑' }).first()).toContainText('圖鑑');
    await expect(page.getByTestId('term-back')).toHaveClass(/ll-btn--secondary/);
    // 頁尾的返回是次要動作：和主動作「前往這一關」一樣是 md，不靠尺寸搶過主動作
    await expect(page.getByTestId('term-back')).toHaveClass(/ll-btn--md/);
    await expect(go).toHaveClass(/ll-btn--md/);
  });

  test('布幕拉開時（.ll-page[data-ready="true"]）右上角的收集數、進度卡的百分比與分組的計數都已是數字，已收進的卡已有印章；拉開之前整頁看不見', async ({
    page,
    request,
  }) => {
    const f = await firstCoreTerm(request);
    const terms = await termIndexOf(request, 'zh-TW');
    const total = terms.filter((t) => !isReference(t)).length;
    // 先開一次讓 App 建好資料庫、寫進一筆收進的名詞，再重新整理：這次從冷啟動就是「有進度」
    await page.goto('/terms/');
    await waitForApp(page);
    await put(page, 'unlocks', [{ id: `term:${f.term.id}`, kind: 'term', unlockedAt: '2026-10-20T21:30:00.000+08:00' }]);
    // 布幕拉開的那一次繪製就把要檢查的東西抄下來（不等後續的更新）：MutationObserver 在 data-ready 變成 true 的當下讀 DOM
    await page.addInitScript(() => {
      type Snap = { stat: string | null; pct: string | null; groupCounts: string[]; unlockedCards: number; unlockedStamps: number; skeletons: number };
      const snap = (el: Element): Snap => ({
        stat: el.querySelector('[data-testid="terms-stat"]')?.textContent ?? null,
        pct: el.querySelector('[data-testid="terms-progress-pct"]')?.textContent ?? null,
        groupCounts: [...el.querySelectorAll('[data-testid="terms-group-count"]')].map((x) => x.textContent ?? ''),
        unlockedCards: el.querySelectorAll('[data-unlocked="unlocked"]').length,
        unlockedStamps: el.querySelectorAll('[data-unlocked="unlocked"] .ll-stamp').length,
        skeletons: el.querySelectorAll('.ll-skeleton').length,
      });
      const w = window as unknown as { __llReveal: { hiddenBefore: boolean | null; at?: Snap } };
      w.__llReveal = { hiddenBefore: null };
      const obs = new MutationObserver(() => {
        const el = document.querySelector('.ll-page');
        if (!el) return;
        const ready = el.getAttribute('data-ready');
        if (ready === 'false' && w.__llReveal.hiddenBefore === null) w.__llReveal.hiddenBefore = getComputedStyle(el).visibility === 'hidden';
        if (ready === 'true' && w.__llReveal.at === undefined) {
          w.__llReveal.at = snap(el);
          obs.disconnect();
        }
      });
      // childList 抓到 .ll-page 被插入（一開始就是 data-ready="false"），attributeFilter 抓到之後換成 true
      // init script 跑的時候 documentElement 還不存在，觀察 document 本身
      obs.observe(document, { childList: true, subtree: true, attributeFilter: ['data-ready'] });
    });
    await page.reload();
    await expect(revealed(page)).toBeVisible();
    const got = await page.evaluate(() => (window as unknown as { __llReveal: { hiddenBefore: boolean | null; at?: unknown } }).__llReveal);
    expect(got.at).toMatchObject({
      stat: expect.stringMatching(new RegExp(`^1／${total.toLocaleString('zh-TW')}`)),
      pct: `${Math.max(1, Math.floor((1 / total) * 100))}%`,
      unlockedCards: 1,
      unlockedStamps: 1,
      skeletons: 0,
    });
    const counts = (got.at as { groupCounts: string[] }).groupCounts;
    expect(counts.length).toBeGreaterThan(0);
    for (const c of counts) expect(c).toMatch(/^\d[\d,]*／\d[\d,]* 已收進$/);
    // 拉開之前整頁看不見（有攔到 data-ready="false" 的瞬間才檢查；資料比 React 的第一次 commit 還快時可能直接是 true）
    if (got.hiddenBefore !== null) expect(got.hiddenBefore).toBe(true);
    // 拉開之後畫面上沒有「…」
    expect(await page.locator('main').textContent()).not.toContain('…');
  });

  test('延伸章的關卡代號和章節頁、地圖、首頁一樣是 E4-1：膠囊與說明列不寫「延伸 4-1」；名詞頁解鎖卡仍寫「延伸第 N 章第 M 關」（看圖驗收第 3 輪）', async ({
    page,
    request,
  }) => {
    const f = await firstExtensionTerm(request);
    test.skip(!f, '快照裡沒有延伸章用到的名詞');
    const { term, chapterNo, levelNo } = f!;
    const code = `E${chapterNo}-${levelNo}`;
    await page.goto('/terms/');
    await waitForApp(page);
    const card = page.locator(`[data-term-id="${term.id}"]`).getByRole('link');
    // 依章節分組：「在 E4-1 遇到」，句子和主線相同
    const meetCode = card.locator('.ll-termitem__code');
    await expect(meetCode).toHaveText(/^E\d+-\d+$/);
    await expect(meetCode).toHaveText(code);
    await expect(card.locator('.ll-termitem__meet')).toHaveText(`在 ${code} 遇到`);
    await expect(card).not.toContainText('延伸 ');
    // 依名稱：膠囊同樣是 E4-1
    await page.getByRole('radio', { name: '依名稱' }).click();
    await expect(page).toHaveURL(/group=name/);
    await expect(meetCode).toHaveText(/^E\d+-\d+$/);
    await expect(meetCode).toHaveText(code);
    await expect(card).not.toContainText('延伸 ');
    // 名詞頁的解鎖任務卡保留長句
    await card.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(term.label);
    await expect(page.getByTestId('term-status').getByTestId('term-meet')).toHaveText(`在延伸第 ${chapterNo} 章第 ${levelNo} 關遇到`);
  });

  test('收進後：卡片蓋金色印章，第一次出現時播一次蓋章動畫；名詞頁顯示收進日期；英文版也一樣', async ({ page, request }) => {
    const f = await firstCoreTerm(request);
    await page.goto('/terms/');
    await waitForApp(page);
    // 第一次進圖鑑：記下目前（一個都還沒收進）的清單，之後才知道哪些是新收進的
    await expect(revealed(page)).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('ll:terms-seen'))).toBe('[]');
    await put(page, 'unlocks', [{ id: `term:${f.term.id}`, kind: 'term', unlockedAt: '2026-10-20T21:30:00.000+08:00' }]);
    await page.reload();
    await waitForApp(page);
    const item = page.locator(`[data-term-id="${f.term.id}"]`);
    await expect(item).toHaveAttribute('data-unlocked', 'unlocked');
    await expect(item.locator('.ll-stamp')).toHaveCount(1);
    await expect(item.locator('.ll-stamp.is-stamping')).toHaveCount(1);
    // 蓋章動畫在布幕拉開之後才開始（不是整頁還看不見時就播完）：拉開後印章的動畫還在跑或剛結束，而且是從布幕拉開之後起算
    const stampStarted = await item.locator('.ll-stamp.is-stamping').evaluate((el) => {
      const anims = el.getAnimations();
      return anims.length === 0 ? null : anims.map((a) => a.startTime);
    });
    const pageStarted = await revealed(page).evaluate((el) => el.getAnimations().map((a) => a.startTime));
    // 減少動態時兩邊都沒有動畫（null 或空陣列），有動畫時印章不早於整頁的淡入開始
    if (stampStarted !== null && stampStarted.length > 0 && pageStarted.length > 0)
      for (const t of stampStarted) expect(Number(t)).toBeGreaterThanOrEqual(Number(pageStarted[0]) - 20);
    // 卡片上的印章是 32px（看圖驗收第 2 輪：不讀字也分得出收進了幾張）
    await expect(item.locator('.ll-stamp')).toHaveClass(/ll-stamp--s32/);
    await expect(item.getByRole('link')).toContainText('已收進');
    await expect(item.getByRole('link')).not.toContainText('遇到');
    await expect(page.getByTestId('terms-progress')).toContainText('已收進 1／');
    // 再進一次：已經看過，不再播
    await page.reload();
    await waitForApp(page);
    await expect(item).toHaveAttribute('data-unlocked', 'unlocked');
    await expect(item.locator('.ll-stamp')).toHaveCount(1);
    await expect(item.locator('.ll-stamp.is-stamping')).toHaveCount(0);

    await page.goto(`/terms/${f.term.id}/`);
    const status = page.getByTestId('term-status');
    await expect(status).toHaveAttribute('data-unlocked', 'unlocked');
    await expect(status).toContainText('已收進圖鑑');
    await expect(status).toContainText('2026');
    await expect(status.locator('.ll-stamp')).toHaveCount(1);
    await expect(page.getByRole('link', { name: '前往這一關' })).toHaveCount(0);
    await page.goto(`/en/terms/${f.term.id}/`);
    await expect(page.getByTestId('term-status')).toContainText('Added to the glossary on');
  });

  test('搜尋與分組寫在查詢字串；結果和快照的比對一致；沒有結果時有「清除搜尋」，焦點回到搜尋框', async ({ page, request }) => {
    const [zh, en] = await Promise.all([termIndexOf(request, 'zh-TW'), termIndexOf(request, 'en')]);
    const terms = withOther(zh, en);
    const sample = terms.find((t) => !isReference(t) && t.label.length >= 2)!;
    const query = sample.label.slice(0, 2);
    const expected = terms
      .filter((t) => matches(t, query))
      .map((t) => t.id)
      .sort();
    await page.goto('/terms/');
    await waitForApp(page);
    await page.locator('[data-term-id]').first().waitFor();
    const total = await page.locator('[data-term-id]').count();
    expect(total).toBe(terms.length);
    const input = page.getByTestId('terms-search');
    await input.fill(query);
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(query);
    await expect
      .poll(async () => (await page.locator('[data-term-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-term-id') ?? ''))).sort())
      .toEqual(expected);
    // 參考名詞有命中時，參考名詞的展開列自動展開
    if (expected.some((id) => isReference(terms.find((t) => t.id === id)!)))
      await expect(page.getByTestId('terms-reference-toggle')).toHaveAttribute('open', '');
    // 搜尋時不分章節：收集區的命中排成一個「搜尋結果」格（寬版不會每章一張卡、右邊空白），參考名詞仍在最後
    const collectHits = expected.filter((id) => !isReference(terms.find((t) => t.id === id)!));
    if (collectHits.length > 0) {
      await expect(page.getByRole('heading', { level: 2, name: '搜尋結果' })).toBeVisible();
      await expect(page.getByTestId('term-list')).toHaveCount(1);
      await expect(page.locator('[data-group="search"] [data-term-id]')).toHaveCount(collectHits.length);
    }
    await expect(page.locator('[data-group]:not([data-group="search"]):not([data-group="reference"])')).toHaveCount(0);
    await page.getByRole('radio', { name: '依名稱' }).click();
    await expect(page).toHaveURL(/group=name/);
    if (collectHits.length > 0) await expect(page.getByRole('heading', { level: 2, name: '搜尋結果' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: '全部名詞' })).toHaveCount(0);
    await expect(input).toHaveValue(query);

    await input.fill('這個名詞不存在');
    const empty = page.getByTestId('terms-empty');
    await expect(empty).toBeVisible();
    await expect(empty.getByRole('heading')).toHaveText('找不到「這個名詞不存在」');
    await empty.getByRole('button', { name: '清除搜尋' }).click();
    await expect(input).toHaveValue('');
    await expect(input).toBeFocused();
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBeNull();
    await expect(page).toHaveURL(/group=name/);
    // 清除搜尋後回到依名稱的「全部名詞」：只有一個 h2，收集數已在頁首與進度卡，不再寫第三次
    await expect(page.getByRole('heading', { level: 2, name: '全部名詞' })).toBeVisible();
    await expect(page.locator('[data-group="all"]').getByTestId('terms-group-count')).toHaveCount(0);
  });

  test('邊打字邊寫回網址：字不回彈、游標不跳到結尾；注音組字中不被打斷（finding glossary-1）', async ({ page, browserName }) => {
    await page.goto('/terms/');
    await waitForApp(page);
    await page.locator('[data-term-id]').first().waitFor();
    const input = page.getByTestId('terms-search');
    await input.click();
    await input.pressSequentially('accounts', { delay: 20 });
    await expect(input).toHaveValue('accounts');
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('accounts');
    // 游標移到中間插一個字：值正確、游標停在插入點後面
    for (let i = 0; i < 4; i++) await input.press('ArrowLeft');
    await input.pressSequentially('X');
    await expect(input).toHaveValue('accoXunts');
    expect(await input.evaluate((el: HTMLInputElement) => el.selectionStart)).toBe(5);
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('accoXunts');
    // 輸入法組字只能用 Chromium 的 CDP 模擬
    if (browserName !== 'chromium') return;
    // 注音組字：組字中不寫回網址、框裡的注音不被換掉；組完才寫回
    await input.fill('');
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBeNull();
    const cdp = await page.context().newCDPSession(page);
    await input.focus();
    await cdp.send('Input.imeSetComposition', { text: 'ㄍ', selectionStart: 1, selectionEnd: 1 });
    await cdp.send('Input.imeSetComposition', { text: 'ㄍㄨˇ', selectionStart: 3, selectionEnd: 3 });
    await expect(input).toHaveValue('ㄍㄨˇ');
    await page.waitForTimeout(300);
    expect(new URL(page.url()).searchParams.get('q')).toBeNull();
    await expect(input).toHaveValue('ㄍㄨˇ');
    await cdp.send('Input.insertText', { text: '股' });
    await expect(input).toHaveValue('股');
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('股');
  });

  test('雙語搜尋：中文介面找得到英文名稱，英文介面找得到中文名稱（finding glossary-2）', async ({ page, request }) => {
    const [zh, en] = await Promise.all([termIndexOf(request, 'zh-TW'), termIndexOf(request, 'en')]);
    const enById = new Map(en.map((t) => [t.id, t] as const));
    const zhById = new Map(zh.map((t) => [t.id, t] as const));
    // 只有靠另一種語言的主名稱才找得到的名詞（別名與 IFRS 英文都沒有它）
    const onlyByOther = (mine: TermEntry, other: TermEntry | undefined) =>
      other !== undefined && other.label.trim().length >= 2 && !matches({ ...mine, otherLabel: undefined }, other.label);
    const zhSide = zh.find((t) => onlyByOther(t, enById.get(t.id)));
    const enSide = en.find((t) => onlyByOther(t, zhById.get(t.id)));
    test.skip(!zhSide && !enSide, '快照裡每個名詞的另一種語言名稱都已經在別名裡');
    if (zhSide) {
      await page.goto(`/terms/?q=${encodeURIComponent(enById.get(zhSide.id)!.label)}`);
      await waitForApp(page);
      await expect(page.locator(`[data-term-id="${zhSide.id}"]`)).toHaveCount(1);
    }
    if (enSide) {
      await page.goto(`/en/terms/?q=${encodeURIComponent(zhById.get(enSide.id)!.label)}`);
      await waitForApp(page);
      await expect(page.locator(`[data-term-id="${enSide.id}"]`)).toHaveCount(1);
    }
  });

  test('從圖鑑點進名詞頁再按返回：搜尋字與分組都還在；直接開名詞頁時返回乾淨的圖鑑（finding glossary-4）', async ({ page, request }) => {
    const zh = await termIndexOf(request, 'zh-TW');
    const sample = zh.find((t) => !isReference(t))!;
    await page.goto('/terms/');
    await waitForApp(page);
    const input = page.getByTestId('terms-search');
    await input.fill(sample.label);
    await page.getByRole('radio', { name: '依名稱' }).click();
    await expect(page).toHaveURL(/group=name/);
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(sample.label);
    await page.locator(`[data-term-id="${sample.id}"]`).getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`/terms/${sample.id}/$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(sample.label);
    const back = page.getByRole('link', { name: '回到名詞圖鑑' }).first();
    await expect(back).toContainText('圖鑑');
    await back.click();
    await expect(page).toHaveURL(/\/terms\/\?/);
    expect(new URL(page.url()).searchParams.get('group')).toBe('name');
    expect(new URL(page.url()).searchParams.get('q')).toBe(sample.label);
    await expect(page.getByTestId('terms-search')).toHaveValue(sample.label);
    // 直接開名詞頁（從作答頁的名詞卡、QR 或書籤）：返回是乾淨的 /terms/
    await page.goto(`/terms/${sample.id}/`);
    await waitForApp(page);
    await expect(page.getByTestId('term-back')).toHaveAttribute('href', '/terms/');
  });
});

test.describe('名詞頁（03 第 4.3 節、站規 2.7）', () => {
  test('定義之後依序是用語說明、公式、例子、常見誤解、IFRS 怎麼處理，各在自己的標題底下；相關名詞是膠囊', async ({ page, request }) => {
    const target = await findDetail(request, (t) => Boolean(t.note && t.formula && t.example && t.misconception && t.ifrsNote));
    test.skip(!target, '快照裡沒有五個欄位都有的名詞');
    await page.goto(`/terms/${target!.id}/`);
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(target!.label);
    await expect(page.getByTestId('term-definition')).toBeVisible();
    const sections = page.locator('.ll-term-section');
    await expect(sections.locator('h2')).toHaveText(['用語說明', '公式', '例子', '常見誤解', 'IFRS 怎麼處理']);
    for (const id of ['term-note', 'term-formula', 'term-example', 'term-misconception', 'term-ifrsNote'])
      await expect(page.getByTestId(id).locator('p').first()).not.toBeEmpty();
    // 佔位符都換成文字，不露出 {{ }} 或 tm_ ID
    await expect(page.locator('main')).not.toContainText('{{');
    await expect(page.locator('main')).not.toContainText(/tm_[0-9a-z]{8}/);
    const note = await page.getByTestId('term-note').innerText();
    await expect(page.getByTestId('term-example')).not.toContainText(note.split('\n').pop()!.trim());
    // 相關名詞：每個都是連到名詞頁的膠囊（不是普通超連結）
    if ((target!.related?.length ?? 0) > 0) {
      const pills = page.getByTestId('term-related').getByRole('link');
      await expect(pills.first()).toBeVisible();
      await expect(pills.first()).toHaveAttribute('href', /^\/terms\/tm_[0-9a-z]+\/$/);
      expect(await pills.first().evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe('none');
    }
  });

  test('教材用語與現行用語相同時合併成一列', async ({ page, request }) => {
    const same = await findDetail(request, (t) => t.currentTwLabel !== null && t.currentTwLabel === t.teacherLabel);
    test.skip(!same, '快照裡沒有兩種用語相同的名詞');
    await page.goto(`/terms/${same!.id}/`);
    await waitForApp(page);
    const names = page.getByTestId('term-names');
    await expect(names.locator('dt').first()).toHaveText('教材與現行用語');
    await expect(names.getByText('現行用語', { exact: true })).toHaveCount(0);
  });

  test('「舊稱」等註記標籤和名詞卡一樣出現在頁首：類別膠囊、註記標籤、另一種語言的名稱；內容管理用的旗標不顯示（看圖驗收第 5 輪）', async ({
    page,
    request,
  }) => {
    const zh = (await termIndexOf(request, 'zh-TW')) as (TermEntry & { flags?: string[] })[];
    const old = zh.find((t) => t.flags?.includes('old_name'));
    test.skip(!old, '快照裡沒有帶「舊稱」旗標的名詞');
    await page.goto(`/terms/${old!.id}/`);
    await waitForApp(page);
    const tags = page.getByTestId('term-tags');
    await expect(tags.locator('.ll-notetag--old-name')).toHaveText('舊稱');
    // 順序：類別膠囊在前、註記標籤在後，整組在另一種語言的名稱前面
    await expect(tags.locator(':scope > *').first()).toHaveClass(/ll-termpage__cat/);
    await expect(page.locator('.ll-termpage__meta > *').first()).toHaveAttribute('data-testid', 'term-tags');
    // 純文字標籤，不是可以點的元素
    await expect(tags.getByRole('button')).toHaveCount(0);
    await page.goto(`/en/terms/${old!.id}/`);
    await expect(page.getByTestId('term-tags').locator('.ll-notetag--old-name')).toHaveText('Former name');
    // 只有日式用語、筆誤等內容管理旗標的名詞：頁首沒有註記標籤
    const plain = zh.find(
      (t) => (t.flags?.length ?? 0) > 0 && t.flags!.every((f) => ['japanese', 'typo_fixed', 'unused', 'ifrs_treatment_differs'].includes(f)),
    );
    if (plain) {
      await page.goto(`/terms/${plain.id}/`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(plain.label);
      await expect(page.getByTestId('term-tags').locator('.ll-notetag')).toHaveCount(0);
    }
  });

  test('名詞頁讀不到內容時仍有 h1、焦點在 h1；按「再試一次」讀到後顯示名詞（finding glossary-3）', async ({ page, request }) => {
    const zh = await termIndexOf(request, 'zh-TW');
    const sample = zh.find((t) => !isReference(t))!;
    await page.goto('/terms/');
    await waitForApp(page);
    await page.route('**/content/zh-TW/terms-*.json', (route) => route.abort());
    await page.locator(`[data-term-id="${sample.id}"]`).getByRole('link').click();
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toHaveText('這個名詞讀不到');
    await expect(h1).toBeFocused();
    await expect(page.getByTestId('term-error')).toBeVisible();
    await expect(page.getByRole('link', { name: '回到名詞圖鑑' }).first()).toBeVisible();
    await page.unroute('**/content/zh-TW/terms-*.json');
    await page.getByRole('button', { name: '再試一次' }).click();
    await expect(h1).toHaveText(sample.label);
    await expect(page.getByTestId('term-definition')).toBeVisible();
  });
});

test.describe('徽章與收藏（「我的」頁，03 第 2.7、2.10 節）', () => {
  test('徽章：「我的」是摘要卡（連到徽章頁）；/me/badges/ 已取得顯示日期，精通是進階外觀，未取得寫取得條件', async ({ page }) => {
    await page.goto('/me/');
    await waitForApp(page);
    await put(page, 'unlocks', [
      { id: 'badge:ch_c5f8w2', kind: 'badge', unlockedAt: '2026-10-20T10:00:00.000+08:00' },
      { id: 'badge:ch_m2t7q4', kind: 'badge', unlockedAt: '2026-10-21T10:00:00.000+08:00' },
      { id: 'badge:ch_m2t7q4:mastery', kind: 'badge', unlockedAt: '2026-10-22T10:00:00.000+08:00' },
    ]);
    await page.reload();
    await waitForApp(page);
    // 「我的」不再列出整份徽章，只有摘要卡（站規 2.8）
    const summary = page.getByTestId('badge-summary');
    await expect(summary).toBeVisible();
    await expect(page.getByTestId('badges')).toHaveCount(0);
    // 摘要卡本身就是連到徽章頁的連結（NavCard）
    await expect(summary).toHaveAttribute('href', '/me/badges/');
    await summary.click();
    await expect(page).toHaveURL(/\/me\/badges\/$/);
    await expect(page.getByRole('heading', { level: 1, name: '徽章' })).toBeVisible();
    const badges = page.getByTestId('badges');
    const done = badges.locator('[data-chapter-id="ch_c5f8w2"]');
    await expect(done).toHaveAttribute('data-state', 'done');
    await expect(done).toContainText('開店了');
    // 徽章格不再有取得條件那一行：狀態膠囊加取得日期（「2026年10月20日 取得」），未取得的只有狀態
    await expect(done).toContainText('完成');
    await expect(done).toContainText('2026');
    const mastery = badges.locator('[data-chapter-id="ch_m2t7q4"]');
    await expect(mastery).toHaveAttribute('data-state', 'mastery');
    await expect(mastery).toContainText('精通');
    const locked = badges.locator('[data-chapter-id="ch_s0525x"]');
    await expect(locked).toHaveAttribute('data-state', 'locked');
    await expect(locked).toContainText('未取得');
    await expect(locked).not.toContainText('2026');
    // 每一格都有徽章圖：章節徽章加特別徽章（2026-10-27 起徽章頁多了「特別徽章」一區，SpecialBadge 也是 svg.ll-chbadge）
    await expect(badges.locator('svg.ll-chbadge')).toHaveCount(await badges.locator('[data-chapter-id], [data-special-badge]').count());
    await expect(badges.locator('[data-special-badge] svg.ll-chbadge--special')).toHaveCount(1);
  });

  test('收藏的取捨題：每筆連到關卡，可移除並寫回 settings', async ({ page }) => {
    await page.goto('/me/');
    await waitForApp(page);
    await put(page, 'settings', [{ key: 'favourites', value: [JUDGMENT_QUESTION], updatedAt: '2026-10-24T10:00:00.000+08:00' }]);
    await page.reload();
    await waitForApp(page);
    const fav = page.getByTestId('favourites');
    const item = fav.locator(`[data-question-id="${JUDGMENT_QUESTION}"]`);
    await expect(item.getByRole('link')).toHaveAttribute('href', `/level/${JUDGMENT_LEVEL}/`);
    await expect(item.locator('.ll-favourites__excerpt')).not.toBeEmpty();
    // 移除鈕在連結外面（NavCard 的 aside），可讀名稱是「移除收藏：」加題目摘錄
    const remove = item.getByTestId('favourite-remove');
    await expect(remove).toHaveAccessibleName(/^移除收藏：/);
    await remove.click();
    await expect(fav.getByTestId('favourites-empty')).toBeVisible();
    await expect.poll(() => readSetting(page, 'favourites')).toEqual([]);
  });

  test('用鍵盤移除兩筆收藏的第一筆：焦點移到剩下那張的移除鈕，並播報「已移除收藏」（finding pages-a-2）', async ({ page }) => {
    await page.goto('/me/');
    await waitForApp(page);
    await put(page, 'settings', [{ key: 'favourites', value: [JUDGMENT_QUESTION, JUDGMENT_QUESTION_2], updatedAt: '2026-10-24T10:00:00.000+08:00' }]);
    await page.reload();
    await waitForApp(page);
    const fav = page.getByTestId('favourites');
    const items = fav.locator('.ll-favourites__item');
    await expect(items).toHaveCount(2);
    const firstId = await items.nth(0).getAttribute('data-question-id');
    const restId = await items.nth(1).getAttribute('data-question-id');
    await items.nth(0).getByTestId('favourite-remove').focus();
    await page.keyboard.press('Enter');
    await expect(items).toHaveCount(1);
    await expect(fav.locator(`[data-question-id="${restId}"]`).getByTestId('favourite-remove')).toBeFocused();
    await expect(fav.locator('[role="status"]')).toContainText('已移除收藏：');
    await expect.poll(() => readSetting(page, 'favourites')).toEqual([restId]);
    expect(firstId).not.toBe(restId);
  });
});

test.describe('計時設定（03 第 2.10 節）', () => {
  test('預設關閉；開啟與寬鬆各寫一個 setting，重新整理後維持', async ({ page }) => {
    await page.goto('/me/settings/');
    await waitForApp(page);
    const enabled = page.getByRole('switch', { name: '作答時計時' });
    const relaxed = page.getByRole('switch', { name: '寬鬆（時間加倍）' });
    await expect(enabled).toBeEnabled();
    await expect(enabled).toHaveAttribute('aria-checked', 'false');
    await enabled.click();
    await expect(enabled).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => readSetting(page, 'timerEnabled')).toBe(true);
    await relaxed.click();
    await expect.poll(() => readSetting(page, 'timerRelaxed')).toBe(true);
    await page.reload();
    await waitForApp(page);
    await expect(page.getByRole('switch', { name: '作答時計時' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('switch', { name: '寬鬆（時間加倍）' })).toHaveAttribute('aria-checked', 'true');
  });
  test('剩 1 分鐘與時間到的提醒預設開啟，可以關閉並寫進 timerAnnounce', async ({ page }) => {
    await page.goto('/me/settings/');
    await waitForApp(page);
    const announce = page.getByRole('switch', { name: '剩 1 分鐘與時間到時提醒' });
    await expect(announce).toBeEnabled();
    await expect(announce).toHaveAttribute('aria-checked', 'true');
    await announce.click();
    await expect(announce).toHaveAttribute('aria-checked', 'false');
    await expect.poll(() => readSetting(page, 'timerAnnounce')).toBe(false);
    await page.reload();
    await waitForApp(page);
    await expect(page.getByRole('switch', { name: '剩 1 分鐘與時間到時提醒' })).toHaveAttribute('aria-checked', 'false');
  });
});

test.describe('安裝圖解：iOS 26（06 第 2.6 節）', () => {
  test.use({ userAgent: IOS_SAFARI_26 });

  test('安裝建議卡可展開完整圖解；兩種分頁列版面可切換並記在設定', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ll:visited', '1');
      // iPhone 15 的 WebKit 配額約 1 GB，會被判定成相機預覽的暫存情境；那條提示比安裝建議優先（一次只展開一條），先標成已關閉
      sessionStorage.setItem('ll:ephemeral-notice-dismissed', '1');
    });
    await page.goto('/');
    await waitForApp(page);
    await put(page, 'settings', [{ key: 'levelsCompleted', value: 1, updatedAt: '2026-10-24T10:00:00.000+08:00' }]);
    await page.reload();
    await waitForApp(page);
    const toggle = page.getByTestId('install-guide-toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const guide = page.getByTestId('install-guide');
    await expect(guide).toHaveAttribute('data-variant', 'ios-modern');
    await expect(guide).toHaveAttribute('data-layout', 'compact');
    // 第 1 步是「匯出到 App」（接在安裝建議下方時橫幅上已經有那顆按鈕，這裡沒有第二顆），接著四步加入主畫面
    await expect(guide.locator('.ll-guide__step')).toHaveCount(5);
    await expect(guide.locator('.ll-guide__step').first()).toHaveAttribute('data-step', 'export');
    await expect(guide.getByTestId('install-guide-export')).toHaveCount(0);
    await expect(guide.locator('.ll-guide__step[data-step="compact-more"] svg')).toBeVisible();
    await expect(guide.getByText('點網址列旁的「⋯」（更多）。')).toBeVisible();
    await guide.getByRole('radio', { name: '完整的工具列' }).click();
    await expect(guide).toHaveAttribute('data-layout', 'bar');
    await expect(guide.locator('.ll-guide__step')).toHaveCount(4);
    await expect(guide.getByText('點工具列上的「分享」按鈕。')).toBeVisible();
    await expect.poll(() => readSetting(page, 'installGuideLayout')).toBe('bar');
    // 獨立的教學頁沿用記住的版面
    await page.getByRole('link', { name: '完整教學頁' }).click();
    await expect(page).toHaveURL(/\/install\/$/);
    await expect(page.getByRole('heading', { level: 1, name: '安裝教學' })).toBeVisible();
    await expect(page.getByTestId('install-guide')).toHaveAttribute('data-layout', 'bar');
  });
});

test.describe('安裝圖解：iOS 27 的新選單（06 第 2.6 節，2026-10-28 實機截圖）', () => {
  test.use({ userAgent: IOS_SAFARI_27 });

  test('縮小網址列那一套是左邊的選單按鈕、彈出選單與新的分享表單；完整工具列那一套也用新的分享表單', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('ll:safari-notice-collapsed', '1'));
    await page.goto('/install/');
    await waitForApp(page);
    const guide = page.getByTestId('install-guide');
    await expect(guide).toHaveAttribute('data-variant', 'ios-modern');
    const steps = guide.locator('.ll-guide__step');
    await expect(steps).toHaveCount(5);
    await expect(steps.nth(0)).toHaveAttribute('data-step', 'export');
    await expect(steps.nth(1)).toHaveAttribute('data-step', 'compact-menu');
    await expect(steps.nth(2)).toHaveAttribute('data-step', 'menu-share');
    await expect(steps.nth(3)).toHaveAttribute('data-step', 'share-row');
    await expect(guide.getByText('點網址列左邊的選單按鈕（三條線）。')).toBeVisible();
    await guide.getByRole('radio', { name: '完整的工具列' }).click();
    await expect(steps).toHaveCount(4);
    await expect(steps.nth(1)).toHaveAttribute('data-step', 'bar-share');
    await expect(steps.nth(2)).toHaveAttribute('data-step', 'share-row');
  });
});

test.describe('安裝圖解：iOS 18 只用 Top／Bottom 那一套（06 第 1 節）', () => {
  test.use({ userAgent: IOS_SAFARI_18 });

  test('教學頁沒有版面選擇，說明沒有 Compact 分頁列與「以 Web App 打開」', async ({ page }) => {
    await page.goto('/install/');
    await waitForApp(page);
    const guide = page.getByTestId('install-guide');
    await expect(guide).toHaveAttribute('data-variant', 'ios-legacy');
    await expect(guide).toHaveAttribute('data-layout', 'bar');
    await expect(guide.getByRole('radiogroup')).toHaveCount(0);
    await expect(guide.getByText(/沒有縮小的網址列/)).toBeVisible();
    await expect(guide.locator('.ll-guide__step')).toHaveCount(4);
    await expect(guide.locator('.ll-guide__step').nth(2)).toHaveAttribute('data-step', 'add-row');
  });
});

test.describe('安裝教學頁：非 iOS', () => {
  test('Chromium 給安裝說明，另附 iPhone 的做法；從「我的」與設定頁都能進', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Playwright 的 WebKit 專案是 iPhone 裝置，上面那組已涵蓋');
    await page.goto('/me/');
    await waitForApp(page);
    await page.getByRole('link', { name: '安裝教學' }).click();
    await expect(page).toHaveURL(/\/install\/$/);
    const guide = page.getByTestId('install-guide').first();
    await expect(guide).toHaveAttribute('data-variant', 'chromium');
    const details = page.getByTestId('install-ios-details');
    await details.locator('summary').click();
    await expect(details.locator('[data-testid="install-guide"]')).toHaveAttribute('data-variant', 'ios-modern');
    await page.goto('/me/settings/');
    await waitForApp(page);
    await expect(page.getByRole('link', { name: /安裝教學/ })).toHaveAttribute('href', '/install/');
  });
});
