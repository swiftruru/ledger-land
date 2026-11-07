// sitemap.xml 與 robots.txt 的產生器（tools/lib/sitemap.mjs，05 第 9.3 節）：每個頁面每個語系一筆，互列 hreflang、x-default 指向中文；
// 路徑與 origin 格式不對時丟錯讓建置失敗
import { describe, expect, it } from 'vitest';
import { buildRobots, buildSitemap, localeUrl, sitemapPages } from '../lib/sitemap.mjs';

const locales = [
  { code: 'zh-TW', hreflang: 'zh-TW', urlSegment: null },
  { code: 'en', hreflang: 'en', urlSegment: 'en' },
] as const;
const origin = 'https://ledgerland.swift.moe';

describe('buildSitemap', () => {
  it('每個頁面每個語系一筆 <url>，每筆列出全部語言版本與 x-default（指向中文）', () => {
    const xml = buildSitemap({ origin, locales, pages: ['/', '/terms/tm_n7v3k8pq/'] });
    expect(
      xml.startsWith(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
      ),
    ).toBe(true);
    expect(xml.match(/<url>/g)).toHaveLength(4);
    expect(xml).toContain('<loc>https://ledgerland.swift.moe/</loc>');
    expect(xml).toContain('<loc>https://ledgerland.swift.moe/en/</loc>');
    expect(xml).toContain('<loc>https://ledgerland.swift.moe/en/terms/tm_n7v3k8pq/</loc>');
    const alternates = [
      '    <xhtml:link rel="alternate" hreflang="zh-TW" href="https://ledgerland.swift.moe/terms/tm_n7v3k8pq/"/>',
      '    <xhtml:link rel="alternate" hreflang="en" href="https://ledgerland.swift.moe/en/terms/tm_n7v3k8pq/"/>',
      '    <xhtml:link rel="alternate" hreflang="x-default" href="https://ledgerland.swift.moe/terms/tm_n7v3k8pq/"/>',
    ].join('\n');
    // 中文與英文那兩筆都帶同一組 alternate
    expect(xml.split(alternates)).toHaveLength(3);
    expect(xml.endsWith('</urlset>\n')).toBe(true);
    expect(xml).not.toContain('lastmod');
  });

  it('localeUrl 與 packages/i18n 的 localePath 同一個規則：基準語系在根路徑，其他加 urlSegment', () => {
    expect(localeUrl(origin, locales[0], '/play/')).toBe('https://ledgerland.swift.moe/play/');
    expect(localeUrl(origin, locales[1], '/play/')).toBe('https://ledgerland.swift.moe/en/play/');
  });

  it('XML 跳脫：& 與引號不會原樣出現在 loc 與 href', () => {
    const xml = buildSitemap({ origin, locales, pages: ['/a&b/'] });
    expect(xml).toContain('<loc>https://ledgerland.swift.moe/a&amp;b/</loc>');
    expect(xml).not.toContain('a&b');
  });

  it('路徑要以 / 開頭與結尾、不能有查詢字串、不能帶語系前綴、不能重複；origin 要是 https 主機、不帶結尾斜線；基準語系剛好一個', () => {
    expect(() => buildSitemap({ origin, locales, pages: ['play/'] })).toThrow(/以 \/ 開頭與結尾/);
    expect(() => buildSitemap({ origin, locales, pages: ['/play'] })).toThrow(/以 \/ 開頭與結尾/);
    expect(() => buildSitemap({ origin, locales, pages: ['/play/?x=1'] })).toThrow(/查詢字串/);
    expect(() => buildSitemap({ origin, locales, pages: ['/en/play/'] })).toThrow(/語系前綴/);
    expect(() => buildSitemap({ origin, locales, pages: ['/en/'] })).toThrow(/語系前綴/);
    expect(() => buildSitemap({ origin, locales, pages: ['/play/', '/play/'] })).toThrow(/重複/);
    expect(() => buildSitemap({ origin: 'https://ledgerland.swift.moe/', locales, pages: ['/'] })).toThrow(/origin/);
    expect(() => buildSitemap({ origin: 'http://ledgerland.swift.moe', locales, pages: ['/'] })).toThrow(/origin/);
    expect(() => buildSitemap({ origin, locales: [locales[1]], pages: ['/'] })).toThrow(/基準語系/);
  });
});

describe('sitemapPages', () => {
  const table = { static: ['/', '/play/'], dynamic: ['chapter', 'term'] };
  const contentManifest = { chapters: [{ id: 'ch_c5f8w2' }, { id: 'ch_m2t7q4' }] };
  const termIndex = [{ id: 'tm_05t9wphy' }, { id: 'tm_r4w8n2qe' }];

  it('固定頁面加章節頁與名詞頁，順序照表', () => {
    expect(sitemapPages({ table, contentManifest, termIndex })).toEqual([
      '/',
      '/play/',
      '/chapter/ch_c5f8w2/',
      '/chapter/ch_m2t7q4/',
      '/terms/tm_05t9wphy/',
      '/terms/tm_r4w8n2qe/',
    ]);
  });

  it('公式頁從公式索引取；沒有公式索引時沒有公式頁', () => {
    const t = { static: ['/formulas/'], dynamic: ['formula'] };
    expect(sitemapPages({ table: t, contentManifest, termIndex, formulaIndex: [{ id: 'fm_0tqaf9qd' }] })).toEqual(['/formulas/', '/formulas/fm_0tqaf9qd/']);
    expect(sitemapPages({ table: t, contentManifest, termIndex })).toEqual(['/formulas/']);
  });

  it('不認得的動態種類與格式不對的內容 ID 都丟錯', () => {
    expect(() => sitemapPages({ table: { static: [], dynamic: ['level'] }, contentManifest, termIndex })).toThrow(/不認得的動態頁面種類 level/);
    expect(
      sitemapPages({ table: { static: [], dynamic: ['story'] }, contentManifest: { ...contentManifest, stories: [{ id: 'story_ywv2dy' }] }, termIndex }),
    ).toEqual(['/lab/story/story_ywv2dy/']);
    expect(() => sitemapPages({ table, contentManifest, termIndex: [{ id: 'tm_x/y' }] })).toThrow(/內容 ID 的格式不對/);
  });
});

describe('buildRobots', () => {
  it('正式站允許全部並指向 sitemap；預覽與本機全部禁止', () => {
    expect(buildRobots({ origin, production: true })).toBe('User-agent: *\nAllow: /\n\nSitemap: https://ledgerland.swift.moe/sitemap.xml\n');
    expect(buildRobots({ origin, production: false })).toBe('User-agent: *\nDisallow: /\n');
    expect(() => buildRobots({ origin: 'ledgerland.swift.moe', production: true })).toThrow(/origin/);
  });
});
