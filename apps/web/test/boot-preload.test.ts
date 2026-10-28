// boot 腳本的依路徑預先載入（src/shell/boot.js，06 第 8.2 節、14 第 5.2 節）：在 node:vm 裡用假的 DOM 執行整段 boot 腳本，
// 看它依網址加了哪些 <link>；表格的形狀與 tools/lib/preload-table.mjs 相同。另外確認 catalog 模組與 lingui.ts 一致
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import table from '../src/shell/route-preload.json' with { type: 'json' };

const root = fileURLToPath(new URL('..', import.meta.url));
const boot = readFileSync(`${root}src/shell/boot.js`, 'utf8');

const PRELOAD = {
  a: ['catalog-zh-TW-1.js', 'catalog-en-2.js', 'Level-3.js', 'common-4.js', 'Play-5.js', 'quest-map-6.css', 'Term-7.js'],
  c: { 'zh-TW': [0], en: [1] },
  r: [
    ['^/level/([^/]+)/$', [2, 3], ['level', 'termIndex']],
    ['^/play/$', [4, 3, 5], ['chapterIndex']],
    ['^/terms/([^/]+)/$', [6], ['termDetail', 'chapterIndex']],
  ],
  m: {
    l: ['zh-TW', 'en'],
    ci: { 'zh-TW': 'content/zh-TW/chapter-index.111111.json', en: 'content/en/chapter-index.222222.json' },
    ti: { 'zh-TW': 'content/zh-TW/term-index.333333.json', en: 'content/en/term-index.444444.json' },
    tb: 'content/tombstones.555555.json',
    // 關卡在所屬章節的章節包裡：lv 是關卡 ID 對章節 ID，ch 是章節 ID 對各語言的雜湊；名詞分桶是 ID 末字元的字元碼除以 8 的餘數（'e' 是 5）
    ch: { ch_c5f8w2: ['7825d1', 'fc75c6'] },
    lv: { lv_h2zx7srx: 'ch_c5f8w2' },
    td: { 'zh-TW': { '5': 'c8fd7d' }, en: { '5': 'e5755a' } },
  },
};

interface FakeLink {
  rel?: string;
  as?: string;
  href?: string;
  crossOrigin?: string;
}

/** 在假的瀏覽器環境執行 boot 腳本，回傳加進 head 的 link（rel、as、href、crossOrigin） */
function runBoot(pathname: string, preload: unknown = PRELOAD): FakeLink[] {
  const links: FakeLink[] = [];
  const mql = { matches: false, addEventListener() {} };
  const documentElement = { dataset: {} as Record<string, string>, style: {} as Record<string, string>, lang: '' };
  const context = {
    document: {
      documentElement,
      head: { appendChild: (l: FakeLink) => links.push(l) },
      createElement: () => ({}) as FakeLink,
      addEventListener() {},
      querySelectorAll: () => [],
    },
    window: { matchMedia: () => mql } as Record<string, unknown>,
    location: { pathname, search: '', hash: '' },
    history: { state: null, replaceState() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    navigator: {},
    CSS: { supports: () => true },
    URLSearchParams,
    RegExp,
    String,
    JSON,
  };
  const source = boot
    .replaceAll('__LL_THEME_COLOR__', '{"light":"#fff","violet":"#000","berry":"#000","wine":"#000"}')
    .replaceAll('__LL_PRELOAD__', JSON.stringify(preload));
  runInNewContext(source, context);
  return links.map((l) => ({ rel: l.rel, as: l.as, href: l.href, crossOrigin: l.crossOrigin }));
}

describe('boot 腳本的依路徑預先載入', () => {
  it('作答頁：目前語言的 catalog、頁面 chunk 用 modulepreload；所屬章節的章節包與名詞索引用 preload as=fetch 加 crossorigin', () => {
    expect(runBoot('/level/lv_h2zx7srx/')).toEqual([
      { rel: 'modulepreload', as: undefined, href: '/assets/catalog-zh-TW-1.js', crossOrigin: undefined },
      { rel: 'modulepreload', as: undefined, href: '/assets/Level-3.js', crossOrigin: undefined },
      { rel: 'modulepreload', as: undefined, href: '/assets/common-4.js', crossOrigin: undefined },
      { rel: 'preload', as: 'fetch', href: '/content/zh-TW/ch_c5f8w2.7825d1.json', crossOrigin: 'anonymous' },
      { rel: 'preload', as: 'fetch', href: '/content/zh-TW/term-index.333333.json', crossOrigin: 'anonymous' },
    ]);
  });

  it('英文網址用英文的 catalog 與快照；大寫與少了結尾斜線也比對得到；CSS 用 preload as=style', () => {
    const en = runBoot('/EN/Level/LV_H2ZX7SRX');
    expect(en.map((l) => l.href)).toEqual([
      '/assets/catalog-en-2.js',
      '/assets/Level-3.js',
      '/assets/common-4.js',
      '/content/en/ch_c5f8w2.fc75c6.json',
      '/content/en/term-index.444444.json',
    ]);
    const play = runBoot('/en/play/');
    expect(play.find((l) => l.href === '/assets/quest-map-6.css')).toEqual({
      rel: 'preload',
      as: 'style',
      href: '/assets/quest-map-6.css',
      crossOrigin: undefined,
    });
    expect(play.at(-1)?.href).toBe('/content/en/chapter-index.222222.json');
  });

  it('名詞頁：兩種語言的這個名詞所在的分桶都預先載入；表裡沒有的關卡、章節或分桶不加', () => {
    expect(runBoot('/terms/tm_r4w8n2qe/').map((l) => l.href)).toEqual([
      '/assets/catalog-zh-TW-1.js',
      '/assets/Term-7.js',
      '/content/zh-TW/terms-5.c8fd7d.json',
      '/content/en/terms-5.e5755a.json',
      '/content/zh-TW/chapter-index.111111.json',
    ]);
    expect(runBoot('/terms/tm_r4w8n2qa/').map((l) => l.href)).toEqual([
      '/assets/catalog-zh-TW-1.js',
      '/assets/Term-7.js',
      '/content/zh-TW/chapter-index.111111.json',
    ]);
    expect(runBoot('/level/lv_n0tthere/').map((l) => l.href)).toEqual([
      '/assets/catalog-zh-TW-1.js',
      '/assets/Level-3.js',
      '/assets/common-4.js',
      '/content/zh-TW/term-index.333333.json',
    ]);
    // 關卡有列但章節包的雜湊缺了：不組出錯的路徑
    const noChapter = { ...PRELOAD, m: { ...PRELOAD.m, ch: {} } };
    expect(runBoot('/level/lv_h2zx7srx/', noChapter).map((l) => l.href)).not.toContainEqual(expect.stringContaining('ch_c5f8w2'));
  });

  it('首頁只預先載入 catalog；開發模式（表格是 null）與壞掉的表格什麼都不加、也不丟錯', () => {
    expect(runBoot('/').map((l) => l.href)).toEqual(['/assets/catalog-zh-TW-1.js']);
    expect(runBoot('/level/lv_h2zx7srx/', null)).toEqual([]);
    expect(() => runBoot('/level/lv_h2zx7srx/', { a: [] })).not.toThrow();
  });

  it('route-preload.json 的 catalog 模組存在，而且就是 lingui.ts 動態載入的模組', () => {
    const lingui = readFileSync(`${root}src/i18n/lingui.ts`, 'utf8');
    for (const [locale, module] of Object.entries(table.catalogs)) {
      expect(module).toBe(`src/i18n/catalog-${locale}.ts`);
      expect(lingui).toContain(`import('./catalog-${locale}.ts')`);
      const source = readFileSync(`${root}${module}`, 'utf8');
      expect(source).toContain(`@ledgerland/web-ui/locales/${locale}/messages.po`);
      expect(source).toContain(`../locales/${locale}/messages.po`);
    }
  });
});
