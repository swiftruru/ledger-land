// 列入 sitemap 的頁面（src/shell/sitemap-pages.json，05 第 9.3 節）要和 src/app/router.tsx 一致：
// 固定路徑都是沒有 noindex、沒有參數的路由；沒有 noindex 的路由（固定的與帶參數的）都有列到，帶參數的對應到動態種類
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import table from '../src/shell/sitemap-pages.json' with { type: 'json' };

const root = fileURLToPath(new URL('..', import.meta.url));
const router = readFileSync(`${root}src/app/router.tsx`, 'utf8');
// buildRoutes 回傳的陣列：每條路由是一個 4 空格縮排的物件（巢狀 children 目前沒有；有的話這裡要改寫）
const body = router.slice(router.indexOf('  return [\n'), router.indexOf('\n  ];'));
const entries = body.split('\n    {').slice(1);
const routes = entries.map((e) => ({
  path: /\bindex: true/.test(e) ? '/' : `/${/path: '([^']*)'/.exec(e)?.[1] ?? '?'}/`,
  noindex: /noindex: true/.test(e),
}));
/** 帶參數的路由對應的動態種類（sitemap-pages.json 的 dynamic） */
const DYNAMIC: Record<string, string> = { '/chapter/:chapterId/': 'chapter', '/terms/:termId/': 'term', '/lab/story/:storyId/': 'story' };

describe('sitemap-pages.json', () => {
  it('router.tsx 讀得出路由、noindex 與萬用路由', () => {
    expect(routes.length).toBeGreaterThan(10);
    expect(routes.find((r) => r.path === '/*/')?.noindex).toBe(true);
    expect(routes.find((r) => r.path === '/me/')?.noindex).toBe(true);
    expect(routes.find((r) => r.path === '/play/')?.noindex).toBe(false);
  });

  it('固定路徑和沒有 noindex、沒有參數的路由完全一致（兩邊都不能多）', () => {
    const indexable = routes.filter((r) => !r.noindex && !r.path.includes(':') && r.path !== '/*/').map((r) => r.path);
    expect([...table.static].sort()).toEqual([...indexable].sort());
  });

  it('帶參數而且沒有 noindex 的路由都對應到一個動態種類', () => {
    const withParams = routes.filter((r) => !r.noindex && r.path.includes(':')).map((r) => r.path);
    expect(withParams.map((p) => DYNAMIC[p] ?? `沒有對應：${p}`).sort()).toEqual([...table.dynamic].sort());
  });

  it('路徑格式：以 / 開頭與結尾、不帶語系前綴、不重複', () => {
    for (const p of table.static) expect(p).toMatch(/^\/([a-z]+\/)*$/);
    expect(new Set(table.static).size).toBe(table.static.length);
  });
});
