// M3 獨立 QA 第 1 輪找到的回歸與缺口（2026-10-24），用 LL_INCLUDE_DRAFTS=1 的本機建置跑：
// 1. 名詞定義用空行分段：名詞頁與名詞卡每段各自是段落（以前黏成一段）。
// 2. 延伸章的章號：圖鑑與徽章用地圖的「延伸第 N 章」，不是 order 的「第 11 章」。
// 3. 章節徽章在完成關卡時就寫進進度：不開地圖直接看「我的 › 徽章」與備份也有，地圖照樣顯示 Toast。
// 4. 期中考範圍（T32）：主線章節標「期中考範圍」，並說明範圍以老師公告為準。
// 5. 延伸章的作答頁標「延伸，不列入期中考」，投資相關的延伸章另加「非投資建議」。
// 6. 沒有關卡用到的名詞（參考名詞，規劃者 2026-10-24 的決定）：另列「參考名詞」展開列，不顯示鎖定、不算進「已收進 X／N」，名詞頁不說會收進圖鑑。
// 期待值一律從正在服務的快照算出（manifest、名詞索引、名詞內容），內容調整後不必改測試。
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { waitForApp, waitForProgressDb } from './helpers.ts';

test.skip(({ browserName }) => browserName === 'firefox', '環境模擬只在 Chromium 與 WebKit 跑');

interface ManifestChapter {
  id: string;
  order: number;
  scope?: string;
  examScope?: string;
  levelIds?: string[];
}
interface Manifest {
  chapters: ManifestChapter[];
  levels: { id: string; chapterId: string; order: number; questionIds: string[]; unscored?: boolean }[];
  termIndex: Record<string, string>;
  termDetails: Record<string, Record<string, string>>;
  chapterIndex: Record<string, string>;
}
interface TermEntry {
  id: string;
  label: string;
  firstLevel?: { levelId: string; chapterId: string };
  unlock?: { levelId: string };
}

async function manifestOf(request: APIRequestContext): Promise<Manifest> {
  return (await (await request.get('/content/content-manifest.json')).json()) as Manifest;
}
async function json<T>(request: APIRequestContext, path: string): Promise<T> {
  return (await (await request.get(`/${path}`)).json()) as T;
}
/** 地圖的章序：主線與延伸區各自從 1 起算 */
function chapterNoOf(m: Manifest, chapterId: string): { no: number; extension: boolean } {
  const sorted = [...m.chapters].sort((a, b) => a.order - b.order);
  const target = sorted.find((c) => c.id === chapterId)!;
  const extension = target.scope === 'extension';
  const no = sorted.filter((c) => (c.scope === 'extension') === extension).findIndex((c) => c.id === chapterId) + 1;
  return { no, extension };
}
async function readStore<T>(page: Page, storeName: string): Promise<T[]> {
  await waitForProgressDb(page, [storeName]);
  return page.evaluate(
    (storeName) =>
      new Promise<T[]>((resolve, reject) => {
        const req = indexedDB.open('ledgerland');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const get = db.transaction([storeName]).objectStore(storeName).getAll();
          get.onsuccess = () => {
            db.close();
            resolve(get.result as T[]);
          };
          get.onerror = () => reject(get.error);
        };
      }),
    storeName,
  );
}

test.describe('名詞定義分段', () => {
  test('名詞頁：定義的每一段各自是段落，段與段之間有間距；英文版也一樣', async ({ page, request }) => {
    const m = await manifestOf(request);
    // 找一個定義有兩段以上、沒有佔位符的名詞
    let found: { id: string; paras: string[]; enParas: string[] } | null = null;
    for (const [bucket, path] of Object.entries(m.termDetails['zh-TW']!)) {
      const list = await json<{ id: string; definition: string }[]>(request, path);
      const hit = list.find((t) => /\n[ \t]*\n/.test(t.definition) && !t.definition.includes('{{'));
      if (!hit) continue;
      const en = await json<{ id: string; definition: string }[]>(request, m.termDetails['en']![bucket]!);
      const split = (s: string) =>
        s
          .split(/\n[ \t]*\n/)
          .map((p) => p.trim())
          .filter(Boolean);
      found = { id: hit.id, paras: split(hit.definition), enParas: split(en.find((t) => t.id === hit.id)!.definition) };
      break;
    }
    expect(found, '快照裡應該有分段的定義').not.toBeNull();
    for (const [prefix, paras] of [
      ['', found!.paras],
      ['/en', found!.enParas],
    ] as const) {
      await page.goto(`${prefix}/terms/${found!.id}/`);
      await waitForApp(page);
      const ps = page.getByTestId('term-definition').locator('p');
      await expect(ps).toHaveCount(paras.length);
      expect(await ps.allTextContents()).toEqual(paras);
      const [a, b] = await Promise.all([ps.nth(0).boundingBox(), ps.nth(1).boundingBox()]);
      expect(b!.y).toBeGreaterThan(a!.y + a!.height);
    }
  });

  test('作答頁的名詞卡：分段的定義每段一個段落', async ({ page }) => {
    // 把「資產」的定義換成兩段（只改這次回應），看名詞卡怎麼排
    await page.route('**/content/zh-TW/terms-*.json', async (route) => {
      const res = await route.fetch();
      const list = (await res.json()) as { id: string; definition: string }[];
      for (const t of list) if (t.id === 'tm_r4w8n2qe') t.definition = '第一段：資產是資源。\n\n第二段：它會帶來經濟效益。';
      await route.fulfill({ response: res, json: list });
    });
    await page.goto('/level/lv_h2zx7srx/');
    await waitForApp(page);
    await page.getByRole('radio', { name: /資產：都是店裡擁有/ }).check();
    await page.getByRole('button', { name: '確認答案' }).click();
    await page
      .getByRole('button', { name: /名詞卡：資產/ })
      .first()
      .click();
    const ps = page.getByRole('dialog').locator('.ll-sheet__definition > p');
    await expect(ps).toHaveText(['第一段：資產是資源。', '第二段：它會帶來經濟效益。']);
    const [a, b] = await Promise.all([ps.nth(0).boundingBox(), ps.nth(1).boundingBox()]);
    expect(b!.y).toBeGreaterThan(a!.y + a!.height);
  });
});

test.describe('延伸章的章號和地圖一致', () => {
  test('圖鑑的分組標題與「在哪一關遇到」用延伸區自己的章序，和章節頁相同', async ({ page, request }) => {
    const m = await manifestOf(request);
    const terms = await json<TermEntry[]>(request, m.termIndex['zh-TW']!);
    const ext = new Set(m.chapters.filter((c) => c.scope === 'extension').map((c) => c.id));
    const term = terms.find((t) => t.firstLevel && !t.unlock && ext.has(t.firstLevel.chapterId))!;
    expect(term, '快照裡應該有延伸章才遇到的名詞').toBeTruthy();
    const { no } = chapterNoOf(m, term.firstLevel!.chapterId);
    const levelNo = m.chapters.find((c) => c.id === term.firstLevel!.chapterId)!.levelIds!.indexOf(term.firstLevel!.levelId) + 1;
    const wrongNo = m.chapters.find((c) => c.id === term.firstLevel!.chapterId)!.order;

    await page.goto('/terms/');
    await waitForApp(page);
    // 名詞卡的說明列：「在 E1-2「關卡名」遇到」（代號和章節頁、地圖、首頁同一個，延伸章是 E 開頭；看圖驗收第 3 輪）
    const item = page.locator(`[data-term-id="${term.id}"]`);
    await expect(item.getByRole('link')).toContainText(`在 E${no}-${levelNo}`);
    await expect(item.locator('.ll-termitem__code')).toHaveText(`E${no}-${levelNo}`);
    // 分組標題：畫面上是六角形的「E1」加章名，螢幕閱讀器唸「延伸第 N 章：章名」
    const heading = page.getByRole('heading', { level: 2, name: new RegExp(`^延伸第 ${no} 章：`) });
    await expect(heading).toBeVisible();
    await expect(heading.locator('.ll-glossary__chno--ext')).toHaveText(`E${no}`);
    await expect(page.getByRole('heading', { level: 2, name: new RegExp(`^第 ${wrongNo} 章`) })).toHaveCount(0);

    await page.goto(`/terms/${term.id}/`);
    await expect(page.getByTestId('term-meet')).toHaveText(`在延伸第 ${no} 章第 ${levelNo} 關遇到`);
    await page.goto(`/chapter/${term.firstLevel!.chapterId}/`);
    await waitForApp(page);
    await expect(page.getByTestId('chapter-hero').locator('.ch-hero__eyebrow')).toContainText(`延伸第 ${no} 章`);

    await page.goto(`/en/terms/${term.id}/`);
    await expect(page.getByTestId('term-meet')).toContainText(`extension chapter ${no}, level ${levelNo}`);
  });

  test('「我的 › 徽章」的延伸章也寫「延伸第 N 章」', async ({ page, request }) => {
    const m = await manifestOf(request);
    const first = [...m.chapters].sort((a, b) => a.order - b.order).find((c) => c.scope === 'extension')!;
    await page.goto('/me/badges/');
    await waitForApp(page);
    // 眉標畫面上只寫「延伸第 1 章」，完整的「延伸第 1 章：章名」給螢幕閱讀器（第 1 輪看圖驗收後的徽章格）
    const eyebrow = page.locator(`[data-chapter-id="${first.id}"] .ll-badges__eyebrow`);
    await expect(eyebrow.locator('[aria-hidden="true"]')).toHaveText('延伸第 1 章');
    await expect(eyebrow.locator('.ll-sr-only')).toContainText('延伸第 1 章：');
    await expect(eyebrow).not.toContainText(`第 ${first.order} 章`);
  });
});

test.describe('參考名詞（沒有任何已發布題目用到的名詞）', () => {
  test('放在最後的「參考名詞」展開列：預設收合、數量和快照一致、不顯示鎖定、不算進收集數；搜尋命中時自動展開；名詞頁不說會收進圖鑑', async ({
    page,
    request,
  }) => {
    const m = await manifestOf(request);
    const terms = await json<TermEntry[]>(request, m.termIndex['zh-TW']!);
    const reference = terms.filter((t) => !t.firstLevel && !t.unlock);
    test.skip(reference.length === 0, '快照裡每個名詞都有關卡用到');
    const orphan = reference[0]!;
    await page.goto('/terms/');
    await waitForApp(page);
    // 分母只算收集區；布幕拉開時（資料齊了，lib/page-ready.tsx）分子已是 0
    await expect(page.locator('.ll-page[data-ready="true"]')).toBeVisible();
    const progress = page.getByTestId('terms-progress');
    await expect(progress).toContainText(`已收進 0／${(terms.length - reference.length).toLocaleString('zh-TW')} 個名詞`);
    // 參考名詞在最後一區，預設收合；右側的數字和快照一致
    const section = page.locator('[data-group]').last();
    await expect(section).toHaveAttribute('data-group', 'reference');
    const toggle = page.getByTestId('terms-reference-toggle');
    await expect(toggle).not.toHaveAttribute('open', /.*/);
    await expect(toggle.locator('summary')).toContainText('參考名詞');
    await expect(toggle.locator('summary')).toContainText(reference.length.toLocaleString('zh-TW'));
    await toggle.locator('summary').click();
    await expect(toggle).toHaveAttribute('open', '');
    await expect(page.getByTestId('terms-reference-note')).toContainText('不算在上面「已收進圖鑑」的數量裡');
    const pills = section.locator('[data-term-id]');
    await expect(pills).toHaveCount(reference.length);
    const item = section.locator(`[data-term-id="${orphan.id}"]`);
    await expect(item).toHaveAttribute('data-unlocked', 'reference');
    await expect(item.getByRole('link')).toHaveText(orphan.label);
    await expect(item).not.toContainText('未收進');
    // 依名稱分組時也一樣在最後一區
    await page.getByRole('radio', { name: '依名稱' }).click();
    await expect(page.locator('[data-group]').last()).toHaveAttribute('data-group', 'reference');
    // 搜尋命中參考名詞：自動展開，數字改成命中數；手動收合後同一次搜尋不再自動展開
    await toggle.locator('summary').click();
    await expect(toggle).not.toHaveAttribute('open', /.*/);
    await page.getByTestId('terms-search').fill(orphan.label);
    await expect(toggle).toHaveAttribute('open', '');
    await toggle.locator('summary').click();
    await expect(toggle).not.toHaveAttribute('open', /.*/);
    await page.getByTestId('terms-search').press('End');
    await page.getByTestId('terms-search').pressSequentially(' ');
    await expect(toggle).not.toHaveAttribute('open', /.*/);
    // 名詞頁：隨時可讀、沒有鎖頭、不說會收進圖鑑
    await page.goto(`/terms/${orphan.id}/`);
    const status = page.getByTestId('term-status');
    await expect(status).toHaveAttribute('data-unlocked', 'reference');
    await expect(status).toContainText('參考名詞');
    await expect(status).not.toContainText('未收進');
    await expect(status).not.toContainText('收進圖鑑');
    await expect(page.getByRole('link', { name: '前往這一關' })).toHaveCount(0);
    await expect(page.getByTestId('term-definition')).toBeVisible();
    await page.goto(`/en/terms/${orphan.id}/`);
    await expect(page.getByTestId('term-status')).toContainText('Reference term');
  });
});

/** 不計分章的每一關：每題選第一個選項，送出、下一題，直到結果頁 */
async function readThrough(page: Page, levelId: string): Promise<void> {
  await page.goto(`/level/${levelId}/`);
  await waitForApp(page);
  const result = page.getByTestId('result-title');
  for (let i = 0; i < 20 && !(await result.isVisible()); i++) {
    await page.locator('.ll-question').getByRole('radio').first().check();
    await page.getByRole('button', { name: '確認答案' }).click();
    await page.locator('.ll-feedback__title').waitFor();
    await page.getByRole('button', { name: '下一題' }).click();
    await Promise.race([result.waitFor(), page.locator('.ll-question').getByRole('radio').first().waitFor()]);
  }
  await expect(result).toHaveText('已讀完這一關');
}

test.describe('章節徽章在完成關卡時寫進進度（03 第 2.10 節）', () => {
  test('讀完整章後不開地圖：「我的 › 徽章」與備份頁都有這枚徽章，取得時間是最後一關完成的時間', async ({ page, request }) => {
    const m = await manifestOf(request);
    const chapter = m.chapters.find((c) => c.scope === 'extension' && m.levels.filter((l) => l.chapterId === c.id).every((l) => l.unscored))!;
    expect(chapter, '快照裡應該有整章不計分的延伸章').toBeTruthy();
    const levels = m.levels.filter((l) => l.chapterId === chapter.id).sort((a, b) => a.order - b.order);
    for (const l of levels) await readThrough(page, l.id);
    // 徽章在結果頁之後非同步寫入：等它出現在進度裡（不經過 /play/）
    await expect
      .poll(async () => (await readStore<{ id: string }>(page, 'unlocks')).map((u) => u.id).filter((id) => id.startsWith('badge:')))
      .toEqual([`badge:${chapter.id}`]);
    const unlocks = await readStore<{ id: string; unlockedAt: string }>(page, 'unlocks');
    const progress = await readStore<{ levelId: string; lastPlayedAt: string }>(page, 'levelProgress');
    const last = progress.filter((p) => levels.some((l) => l.id === p.levelId)).sort((a, b) => (a.lastPlayedAt < b.lastPlayedAt ? 1 : -1))[0]!;
    expect(unlocks.find((u) => u.id === `badge:${chapter.id}`)!.unlockedAt).toBe(last.lastPlayedAt);
    await page.goto('/me/badges/');
    await waitForApp(page);
    await expect(page.locator(`[data-chapter-id="${chapter.id}"]`)).toHaveAttribute('data-state', 'done');
    await expect(page.getByTestId('badges')).toContainText('已取得 1／');
    await page.goto('/me/backup/');
    await waitForApp(page);
    // 狀態卡的學習紀錄是三個統計膠囊（第 3 輪）：只看徽章那一個的完整名稱（畫面上的數字對螢幕閱讀器隱藏，名稱在 .ll-sr-only）
    await expect(page.getByTestId('backup-stat-badges').locator('.ll-sr-only')).toHaveText('1 個徽章');
  });

  test('做完最後一關按「回到地圖」：地圖照樣顯示取得徽章的 Toast', async ({ page, request }) => {
    const m = await manifestOf(request);
    const chapter = m.chapters.find((c) => c.scope === 'extension' && m.levels.filter((l) => l.chapterId === c.id).every((l) => l.unscored))!;
    const levels = m.levels.filter((l) => l.chapterId === chapter.id).sort((a, b) => a.order - b.order);
    for (const l of levels) await readThrough(page, l.id);
    // 等徽章寫好再回地圖：地圖讀到的進度已經有它，Toast 要靠作答頁記下的待慶祝徽章
    await expect.poll(async () => (await readStore<{ id: string }>(page, 'unlocks')).some((u) => u.id === `badge:${chapter.id}`)).toBe(true);
    await page.getByRole('link', { name: '回到地圖' }).click();
    await expect(page).toHaveURL(/\/play\//);
    const toasts = page.getByTestId('badge-toasts');
    await expect(toasts).toContainText('取得徽章', { timeout: 15_000 });
  });
});

test.describe('期中考範圍（T32）', () => {
  test('地圖章節牌與清單檢視：主線標「期中考範圍」、延伸章不放標籤（不列入期中考只在海峽說明卡與清單的延伸區說明一次），並說明範圍以老師公告為準', async ({
    page,
    request,
  }) => {
    const m = await manifestOf(request);
    const midterm = m.chapters.filter((c) => c.scope !== 'extension' && c.examScope === 'midterm');
    const extension = m.chapters.filter((c) => c.scope === 'extension');
    await page.goto('/play/');
    await waitForApp(page);
    await page.getByTestId('quest-map').waitFor();
    for (const c of midterm) await expect(page.locator(`[data-chapter-id="${c.id}"] .ll-chbanner .ll-notetag--midterm`)).toHaveText('期中考範圍');
    // 站規 0.4 第 2 項：延伸章的章節牌不放「延伸，不列入期中考」標籤，也不標期中考範圍
    for (const c of extension) {
      await expect(page.locator(`[data-chapter-id="${c.id}"] .ll-chbanner .ll-notetag`)).toHaveCount(0);
      await expect(page.locator(`[data-chapter-id="${c.id}"] .ll-notetag--midterm`)).toHaveCount(0);
    }
    await expect(page.getByTestId('extension-gap').getByTestId('exam-scope-note')).toHaveText('期中考範圍以老師公告為準。');
    // 清單檢視的切換：medium 以上是 HUD 的圖示按鈕，compact 在「更多」選單裡
    const inline = page.locator('.ll-hud__tools [data-testid="map-list-toggle"]:not([role="menuitem"])');
    if (await inline.count()) await inline.click();
    else {
      await page.getByTestId('map-more').click();
      await page.getByRole('menuitem', { name: '清單檢視' }).click();
    }
    const list = page.getByTestId('map-list');
    await expect(list.getByTestId('exam-scope-note')).toHaveText('期中考範圍以老師公告為準。');
    await expect(list.locator('summary .ll-notetag--midterm')).toHaveCount(midterm.length);
    await expect(list.locator('summary .ll-notetag--extension')).toHaveCount(0);
    await expect(list.getByTestId('list-extension')).toBeVisible();
  });

  test('章節頁：主線章節標期中考範圍與老師公告；延伸章不標；英文版也有', async ({ page, request }) => {
    const m = await manifestOf(request);
    const core = [...m.chapters].sort((a, b) => a.order - b.order).find((c) => c.examScope === 'midterm')!;
    const ext = m.chapters.find((c) => c.scope === 'extension')!;
    await page.goto(`/chapter/${core.id}/`);
    await waitForApp(page);
    await expect(page.locator('[data-testid="chapter-hero"] .ll-notetag--midterm')).toHaveText('期中考範圍');
    await expect(page.getByTestId('exam-scope-note')).toHaveText('期中考範圍以老師公告為準。');
    await page.goto(`/en/chapter/${core.id}/`);
    await waitForApp(page);
    await expect(page.locator('[data-testid="chapter-hero"] .ll-notetag--midterm')).toHaveText('Midterm scope');
    await expect(page.getByTestId('exam-scope-note')).toHaveText('Check your teacher’s announcement for the exact midterm scope.');
    await page.goto(`/chapter/${ext.id}/`);
    await waitForApp(page);
    await expect(page.locator('.ll-notetag--midterm')).toHaveCount(0);
    await expect(page.getByTestId('exam-scope-note')).toHaveCount(0);
    await expect(page.getByTestId('chapter-extension')).toBeVisible();
  });
});

test.describe('作答頁的範圍標示（10 第 10 節第 3 項）', () => {
  test('延伸章的關卡標「延伸，不列入期中考」；本益比與融資的關卡另加非投資建議；主線關卡都不標', async ({ page, request }) => {
    const m = await manifestOf(request);
    const levelOf = (chapterId: string) => m.levels.filter((l) => l.chapterId === chapterId).sort((a, b) => a.order - b.order)[0]!.id;
    const valuation = levelOf('ch_155y47');
    const margin = levelOf('ch_x09nq2');
    const stakeholders = levelOf('ch_k9548t');

    await page.goto(`/level/${valuation}/`);
    await waitForApp(page);
    const notes = page.getByTestId('level-notes');
    await expect(notes.locator('.ll-notetag--extension')).toHaveText('延伸，不列入期中考');
    await expect(notes.getByTestId('level-not-advice')).toHaveText('教學用途，不構成投資建議。');

    await page.goto(`/en/level/${margin}/`);
    await waitForApp(page);
    await expect(page.getByTestId('level-notes').locator('.ll-notetag--extension')).toHaveText('Extension, not in the midterm');
    await expect(page.getByTestId('level-not-advice')).toHaveText('For learning only; this is not investment advice.');

    await page.goto(`/level/${stakeholders}/`);
    await waitForApp(page);
    await expect(page.getByTestId('level-notes').locator('.ll-notetag--extension')).toHaveCount(1);
    await expect(page.getByTestId('level-not-advice')).toHaveCount(0);

    await page.goto('/level/lv_h2zx7srx/');
    await waitForApp(page);
    await expect(page.locator('.ll-question__prompt').first()).toBeVisible();
    await expect(page.getByTestId('level-notes')).toHaveCount(0);
  });
});
