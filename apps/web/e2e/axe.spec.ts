// axe（10 第 4 節第 1 項）：固定頁面清單，兩種語系、淺色與深色各一次；沒有 serious 或 critical 問題
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = ['/', '/level/lv_k7m2q9xd/', '/terms/', '/terms/tm_r4w8n2qe/', '/me/', '/me/settings/', '/privacy/', '/about/', '/design/'];
const THEMES = ['light', 'dark'] as const;

test.skip(({ browserName }) => browserName !== 'chromium', 'axe 只在 Chromium 專案跑一次');

for (const theme of THEMES) {
  for (const path of PAGES) {
    for (const prefix of ['', '/en']) {
      const url = `${prefix}${path}?ll-theme=${theme}`;
      test(`axe ${theme} ${prefix || '/zh-TW'} ${path}`, async ({ page }) => {
        await page.goto(url);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
        const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
      });
    }
  }
}
