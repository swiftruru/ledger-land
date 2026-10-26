// 殼層依路徑預先載入的路由表（src/shell/route-preload.json，06 第 8.2 節）要和 src/app/router.tsx 一致：
// 每個 lazy 頁面都有一列、module 相同；pattern 只比對「去掉 /en、轉小寫、補結尾斜線」之後的路徑，各自只命中自己的頁面
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import table from '../src/shell/route-preload.json' with { type: 'json' };

const root = fileURLToPath(new URL('..', import.meta.url));
const router = readFileSync(`${root}src/app/router.tsx`, 'utf8');
const lazyPages = [...router.matchAll(/import\('\.\.\/pages\/([A-Za-z]+)\.tsx'\)/g)].map((m) => `src/pages/${m[1]}.tsx`);
const routes = table.routes as { pattern: string; module: string; content: string[] }[];
const match = (path: string) => routes.find((r) => new RegExp(r.pattern).test(path))?.module;

describe('route-preload.json', () => {
  it('router.tsx 的每個 lazy 頁面都在表裡，表裡沒有多出來的頁面', () => {
    expect(lazyPages.length).toBeGreaterThan(5);
    expect([...new Set(routes.map((r) => r.module))].sort()).toEqual([...new Set(lazyPages)].sort());
  });

  it('pattern 各自命中自己的頁面；首頁（在入口 chunk 裡）與不存在的路徑不預先載入頁面 chunk', () => {
    expect(match('/play/')).toBe('src/pages/Play.tsx');
    expect(match('/level/lv_h2zx7srx/')).toBe('src/pages/Level.tsx');
    expect(match('/terms/')).toBe('src/pages/Terms.tsx');
    expect(match('/terms/tm_r4w8n2qe/')).toBe('src/pages/Term.tsx');
    expect(match('/chapter/ch_c5f8w2/')).toBe('src/pages/Chapter.tsx');
    expect(match('/me/badges/')).toBe('src/pages/Badges.tsx');
    expect(match('/lab/')).toBe('src/pages/Placeholder.tsx');
    expect(match('/')).toBeUndefined();
    expect(match('/me/')).toBe('src/pages/Me.tsx');
    expect(match('/level/lv_h2zx7srx/extra/')).toBeUndefined();
  });

  it('內容種類只用 preload-table.mjs 認得的五種；需要 ID 的種類（level、termDetail）所在的 pattern 有捕捉群組', () => {
    const kinds = new Set(['chapterIndex', 'termIndex', 'tombstones', 'level', 'termDetail']);
    expect(routes.flatMap((r) => r.content).filter((c) => !kinds.has(c))).toEqual([]);
    // 捕捉群組的數量：在 pattern 後面接一個空的分支，空字串一定比對得到，結果陣列長度減一就是群組數
    const withId = routes.filter((r) => r.content.includes('level') || r.content.includes('termDetail'));
    expect(withId.map((r) => new RegExp(`${r.pattern}|`).exec('')!.length - 1)).toEqual(withId.map(() => 1));
  });
});
