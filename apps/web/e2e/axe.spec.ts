// axe（10 第 4 節第 1 項）：固定頁面清單，兩種語系、淺色與深色各一次；沒有 serious 或 critical 問題。
// 站規 4.2：清單同步加入備份、診斷、實驗室占位頁、主線與延伸章的章節頁，以及要操作才出現的狀態（錯題本有到期、複習中、下架題，
// 地圖清單、關卡面板、代號錯誤，作答回饋、名詞小卡、結果頁，參考名詞展開，收藏，備份預覽與錯誤，找不到頁面、路由錯誤，橫幅與匯入提示）。
// 狀態的開法和 link-style.spec 共用 page-states.ts。
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ALL_THEMES, caseByName, caseData, openCase, type PageCase } from './page-states.ts';
import { waitForApp } from './helpers.ts';

const PAGES = [
  '/',
  '/play/',
  '/play/?ll-fixture=quest',
  '/chapter/ch_fx0001/?ll-fixture=quest',
  '/chapter/ch_c5f8w2/',
  '/chapter/ch_155y47/',
  '/level/lv_h2zx7srx/',
  '/review/',
  '/terms/',
  '/terms/tm_r4w8n2qe/',
  '/me/',
  '/me/settings/',
  '/me/backup/',
  '/me/badges/',
  '/install/',
  '/privacy/',
  '/about/',
  '/design/',
  '/debug/',
  '/lab/',
];
const STATES: readonly PageCase[] = [
  caseByName('首頁', '匯入提示卡'),
  caseByName('闖關', '清單檢視'),
  caseByName('闖關', '關卡介紹面板'),
  caseByName('闖關', '代號輸入：已下架'),
  caseByName('闖關', '提示條'),
  caseByName('作答', '答錯'),
  caseByName('作答', '名詞小卡'),
  caseByName('作答', '結果頁'),
  caseByName('錯題本', '有到期入口'),
  caseByName('錯題本', '複習中'),
  caseByName('錯題本', '有下架題'),
  caseByName('名詞圖鑑', '參考名詞展開'),
  caseByName('名詞頁', '參考'),
  caseByName('我的', '有收藏（含下架題）'),
  caseByName('其他子頁', '備份預覽'),
  caseByName('其他子頁', '備份錯誤'),
  caseByName('頂層與錯誤', '找不到頁面'),
  caseByName('頂層與錯誤', '路由錯誤'),
  caseByName('橫幅', 'Safari 分頁展開'),
  caseByName('橫幅', '內建瀏覽器展開'),
];
const THEMES = ['light', 'dark'] as const;

test.skip(({ browserName }) => browserName !== 'chromium', 'axe 只在 Chromium 專案跑一次');

async function analyse(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  return bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

for (const theme of THEMES) {
  for (const prefix of ['', '/en']) {
    for (const path of PAGES) {
      const url = `${prefix}${path}${path.includes('?') ? '&' : '?'}ll-theme=${theme}`;
      test(`axe ${theme} ${prefix || '/zh-TW'} ${path}`, async ({ page }) => {
        await page.goto(url);
        // 布幕掀開且淡入播完才量（半透明那幾格會被 axe 算成對比不足）
        await waitForApp(page);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        expect(await analyse(page)).toEqual([]);
      });
    }
    for (const c of STATES) {
      test(`axe ${theme} ${prefix || '/zh-TW'} ${c.group}：${c.name}`, async ({ page, request }) => {
        test.setTimeout(90_000);
        await openCase(page, c, { width: 1280, prefix, theme: ALL_THEMES[theme === 'light' ? 0 : 1]!, data: await caseData(request) });
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
        expect(await analyse(page)).toEqual([]);
      });
    }
  }
}
