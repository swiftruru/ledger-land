// 殼層依路徑預先載入的表（tools/lib/preload-table.mjs，06 第 8.2 節、14 第 5.2 節）：由 Vite manifest 與 content-manifest 算出頁面 chunk 的閉包與內容快照的雜湊，
// 再填進 boot 腳本的佔位；格式不符時丟錯讓建置失敗
import { describe, expect, it } from 'vitest';
import { PRELOAD_PLACEHOLDER, buildPreloadTable, injectPreload } from '../lib/preload-table.mjs';

const viteManifest = {
  'index.html': { file: 'assets/index-AAAA.js', isEntry: true, imports: [], dynamicImports: ['src/pages/Level.tsx'] },
  'src/pages/Level.tsx': {
    file: 'assets/Level-BBBB.js',
    isDynamicEntry: true,
    imports: ['_common-CCCC.js', 'index.html', '_session-DDDD.js'],
    css: ['assets/Level-EEEE.css'],
  },
  'src/pages/Play.tsx': { file: 'assets/Play-FFFF.js', isDynamicEntry: true, imports: ['_common-CCCC.js', '_quest-map-GGGG.js'] },
  '_common-CCCC.js': { file: 'assets/common-CCCC.js', imports: ['index.html'] },
  '_session-DDDD.js': { file: 'assets/session-DDDD.js', imports: ['_common-CCCC.js'] },
  '_quest-map-GGGG.js': { file: 'assets/quest-map-GGGG.js', css: ['assets/quest-map-HHHH.css'] },
  '_progress-KKKK.js': { file: 'assets/progress-KKKK.js', imports: ['_session-DDDD.js', 'index.html'] },
  'src/i18n/catalog-zh-TW.ts': { file: 'assets/catalog-zh-TW-IIII.js', isDynamicEntry: true },
  'src/i18n/catalog-en.ts': { file: 'assets/catalog-en-JJJJ.js', isDynamicEntry: true },
};
const contentManifest = {
  locales: { 'zh-TW': { status: 'complete' }, en: { status: 'complete' } },
  chapterIndex: { 'zh-TW': 'content/zh-TW/chapter-index.111111.json', en: 'content/en/chapter-index.222222.json' },
  termIndex: { 'zh-TW': 'content/zh-TW/term-index.333333.json', en: 'content/en/term-index.444444.json' },
  tombstones: 'content/tombstones.555555.json',
  // 關卡在所屬章節的章節包裡（schemaVersion 3）：levels[].files 和 chapters[].files 是同一個檔
  chapters: [{ id: 'ch_c5f8w2', files: { 'zh-TW': 'content/zh-TW/ch_c5f8w2.7825d1.json', en: 'content/en/ch_c5f8w2.fc75c6.json' } }],
  levels: [{ id: 'lv_h2zx7srx', chapterId: 'ch_c5f8w2', files: { 'zh-TW': 'content/zh-TW/ch_c5f8w2.7825d1.json', en: 'content/en/ch_c5f8w2.fc75c6.json' } }],
  termDetails: { 'zh-TW': { '5': 'content/zh-TW/terms-5.c8fd7d.json' }, en: { '5': 'content/en/terms-5.e5755a.json' } },
};
const routes = [
  { pattern: '^/level/([^/]+)/$', module: 'src/pages/Level.tsx', content: ['level', 'termIndex'] },
  { pattern: '^/play/$', module: 'src/pages/Play.tsx', content: ['chapterIndex'] },
];
const catalogs = { 'zh-TW': 'src/i18n/catalog-zh-TW.ts', en: 'src/i18n/catalog-en.ts' };
const chunkModules = {
  'assets/progress-KKKK.js': ['src/lib/progress/runtime.ts', 'src/lib/progress/indexeddb-store.ts'],
  'assets/session-DDDD.js': ['src/store/quiz.ts'],
};
const build = (over: Record<string, unknown> = {}) =>
  buildPreloadTable({ viteManifest, contentManifest, routes, catalogs, locales: ['zh-TW', 'en'], ...over } as Parameters<typeof buildPreloadTable>[0]);

describe('buildPreloadTable', () => {
  it('always：以 chunk-modules 找出含該模組的 chunk，連同靜態 import 的閉包放進 w；找不到就丟錯', () => {
    const t = build({ always: ['src/lib/progress/runtime.ts'], chunkModules });
    expect(t.w.map((i: number) => t.a[i])).toEqual(['progress-KKKK.js', 'session-DDDD.js', 'common-CCCC.js']);
    expect(build().w).toEqual([]);
    expect(() => build({ always: ['src/lib/progress/nothing.ts'], chunkModules })).toThrow(/找不到含/);
  });

  it('頁面 chunk 的靜態 import 閉包（不含殼層入口、不重複）加 CSS；catalog 依語言；資產名稱共用一張表', () => {
    const t = build();
    const names = (list: number[]) => list.map((i) => t.a[i]);
    expect(names(t.r[0]![1])).toEqual(['Level-BBBB.js', 'common-CCCC.js', 'session-DDDD.js', 'Level-EEEE.css']);
    expect(names(t.r[1]![1])).toEqual(['Play-FFFF.js', 'common-CCCC.js', 'quest-map-GGGG.js', 'quest-map-HHHH.css']);
    expect(t.a.filter((x) => x === 'common-CCCC.js')).toHaveLength(1);
    expect(t.a).not.toContain('index-AAAA.js');
    expect(names(t.c['zh-TW']!)).toEqual(['catalog-zh-TW-IIII.js']);
    expect(names(t.c.en!)).toEqual(['catalog-en-JJJJ.js']);
    expect(t.r.map((r) => [r[0], r[2]])).toEqual([
      ['^/level/([^/]+)/$', ['level', 'termIndex']],
      ['^/play/$', ['chapterIndex']],
    ]);
  });

  it('內容只存路徑或雜湊：章節包與名詞分桶依語言列雜湊、關卡只記所屬章節，索引與墓碑是完整路徑', () => {
    const { m } = build();
    expect(m.l).toEqual(['zh-TW', 'en']);
    expect(m.ci['zh-TW']).toBe('content/zh-TW/chapter-index.111111.json');
    expect(m.ti.en).toBe('content/en/term-index.444444.json');
    expect(m.tb).toBe('content/tombstones.555555.json');
    expect(m.ch).toEqual({ ch_c5f8w2: ['7825d1', 'fc75c6'] });
    expect(m.lv).toEqual({ lv_h2zx7srx: 'ch_c5f8w2' });
    expect(m.td).toEqual({ 'zh-TW': { '5': 'c8fd7d' }, en: { '5': 'e5755a' } });
  });

  it('找不到模組、不認得的內容種類、不合法的 pattern、檔名格式不符、少了 catalog 都丟錯（建置失敗）', () => {
    expect(() => build({ routes: [{ pattern: '^/x/$', module: 'src/pages/Nope.tsx', content: [] }] })).toThrow(/找不到 src\/pages\/Nope\.tsx/);
    expect(() => build({ routes: [{ pattern: '^/x/$', module: 'src/pages/Play.tsx', content: ['story'] }] })).toThrow(/不認得的內容種類 story/);
    expect(() => build({ routes: [{ pattern: '^/x/(', module: 'src/pages/Play.tsx', content: [] }] })).toThrow(/不是合法的正規表示式/);
    expect(() => build({ catalogs: { 'zh-TW': 'src/i18n/catalog-zh-TW.ts' } })).toThrow(/catalogs 沒有 en/);
    const renamed = {
      ...contentManifest,
      chapters: [{ id: 'ch_c5f8w2', files: { 'zh-TW': 'content/zh-TW/chapter-ch_c5f8w2.json', en: 'content/en/ch_c5f8w2.fc75c6.json' } }],
    };
    expect(() => build({ contentManifest: renamed })).toThrow(/不是 content\/zh-TW\/ch_c5f8w2<雜湊>\.json 的格式/);
    // 關卡另成檔的舊格式（schemaVersion 2）：關卡的檔不是所屬章節的章節包
    const separate = {
      ...contentManifest,
      levels: [
        { id: 'lv_h2zx7srx', chapterId: 'ch_c5f8w2', files: { 'zh-TW': 'content/zh-TW/lv_h2zx7srx.7825d1.json', en: 'content/en/ch_c5f8w2.fc75c6.json' } },
      ],
    };
    expect(() => build({ contentManifest: separate })).toThrow(/關卡 lv_h2zx7srx 的 zh-TW 檔不是章節 ch_c5f8w2 的章節包/);
    const orphan = { ...contentManifest, levels: [{ ...contentManifest.levels[0]!, chapterId: 'ch_n0where' }] };
    expect(() => build({ contentManifest: orphan })).toThrow(/章節 ch_n0where 不在 content-manifest 的 chapters 裡/);
    expect(() => build({ contentManifest: { ...contentManifest, termIndex: undefined } })).toThrow(/沒有 termIndex\.zh-TW/);
  });
});

describe('injectPreload', () => {
  const html = `<script data-ll="boot">var PRELOAD = ${PRELOAD_PLACEHOLDER};</script>`;

  it('把表格換進唯一的佔位，角括號跳脫', () => {
    const out = injectPreload(html, { a: ['x</script>.js'], c: {}, r: [], m: {} });
    expect(out).not.toContain(PRELOAD_PLACEHOLDER);
    expect(out).toContain('"x\\u003c/script>.js"');
    expect(out.match(/<\/script>/g)).toHaveLength(1);
    const json = out.slice(out.indexOf('= ') + 2, out.lastIndexOf(';'));
    expect(JSON.parse(json)).toEqual({ a: ['x</script>.js'], c: {}, r: [], m: {} });
  });

  it('沒有佔位或佔位不只一個時丟錯', () => {
    expect(() => injectPreload('<html></html>', {})).toThrow(/剛好有一個/);
    expect(() => injectPreload(html + html, {})).toThrow(/實際 2 個/);
  });
});
