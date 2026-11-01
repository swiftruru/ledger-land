// sitemap.xml 與 robots.txt（05 第 9.3 節、02 第 1.3 節）：tools/postbuild.mjs 在正式建置（LL_DEPLOY_TARGET=production）時呼叫。
// 純函式，不讀檔：輸入 origin、語系登錄檔（@ledgerland/i18n 的 LOCALES）、要列的頁面路徑（apps/web/src/shell/sitemap-pages.json 的固定頁面
// 加 content-manifest 的章節與名詞），輸出 XML 字串。每個頁面每個語系一筆 <url>，每筆都列出全部語言版本的 xhtml:link 加 x-default（指向中文，
// 也就是 urlSegment 為 null 的基準語系）。網址由語系的 urlSegment 組出來，和 packages/i18n 的 localePath() 同一個規則，所以 sitemap 和用戶端寫的連結不會不一致。
// 不預先產生 HTML、所有頁面都是同一份殼層，所以沒有 lastmod（殼層每次部署都變，寫了也沒有意義）、沒有 priority 與 changefreq（搜尋引擎不看）。

const escapeXml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

/** 路徑的檢查：以 / 開頭與結尾（站規：站內連結都帶結尾斜線）、沒有查詢字串與 hash、沒有語系前綴（由這裡依語系加上） */
function checkPath(path, locales) {
  if (typeof path !== 'string') throw new Error(`sitemap：路徑要是字串：${String(path)}`);
  if (/[?#\s]/.test(path)) throw new Error(`sitemap：路徑不能有查詢字串、hash 或空白：${path}`);
  if (!path.startsWith('/') || !path.endsWith('/')) throw new Error(`sitemap：路徑要以 / 開頭與結尾：${path}`);
  for (const l of locales)
    if (l.urlSegment !== null && (path === `/${l.urlSegment}/` || path.startsWith(`/${l.urlSegment}/`)))
      throw new Error(`sitemap：路徑不能帶語系前綴（由產生器依語系加上）：${path}`);
}

function checkOrigin(origin) {
  if (typeof origin !== 'string' || !/^https:\/\/[a-z0-9.-]+$/i.test(origin))
    throw new Error(`sitemap：origin 要是 https:// 加主機名稱、不帶結尾斜線：${origin}`);
}

/** 某個語系的完整網址：urlSegment 為 null 的語系在根路徑，其他加 /<urlSegment> 前綴（packages/i18n 的 localePath 同一個規則） */
export function localeUrl(origin, locale, path) {
  return `${origin}${locale.urlSegment === null ? '' : `/${locale.urlSegment}`}${path}`;
}

/**
 * @param {{ origin: string; locales: readonly { code: string; hreflang: string; urlSegment: string | null }[]; pages: readonly string[] }} input
 * @returns {string} sitemap.xml 的內容
 */
export function buildSitemap({ origin, locales, pages }) {
  checkOrigin(origin);
  const base = locales.filter((l) => l.urlSegment === null);
  if (base.length !== 1) throw new Error(`sitemap：要剛好有一個 urlSegment 為 null 的基準語系（x-default 指向它），實際 ${base.length} 個`);
  const unique = [...new Set(pages)];
  if (unique.length !== pages.length) throw new Error('sitemap：頁面路徑有重複');
  for (const p of unique) checkPath(p, locales);
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ];
  for (const path of unique) {
    const alternates = [
      ...locales.map((l) => `    <xhtml:link rel="alternate" hreflang="${escapeXml(l.hreflang)}" href="${escapeXml(localeUrl(origin, l, path))}"/>`),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(localeUrl(origin, base[0], path))}"/>`,
    ];
    for (const l of locales) lines.push('  <url>', `    <loc>${escapeXml(localeUrl(origin, l, path))}</loc>`, ...alternates, '  </url>');
  }
  lines.push('</urlset>');
  return `${lines.join('\n')}\n`;
}

/**
 * 要列進 sitemap 的頁面路徑（不含語系前綴）：固定頁面加 content-manifest 裡已發布的章節與名詞（02 第 1.1 節「列入 sitemap」的頁面）。
 * 名詞 ID 從名詞索引（termIndex 的內容，陣列）取；章節從 manifest 的 chapters；故事步驟列表從 manifest 的 stories（M4a）。關卡、錯題本、我的底下的子頁、debug、故事步驟頁、自由實驗、勾稽練習都不列（設 noindex）。
 * @param {{ table: { static: readonly string[]; dynamic: readonly string[] }; contentManifest: { chapters?: { id: string }[]; stories?: { id: string }[] }; termIndex: { id: string }[] }} input
 */
export function sitemapPages({ table, contentManifest, termIndex }) {
  const kinds = {
    chapter: () => (contentManifest.chapters ?? []).map((c) => `/chapter/${c.id}/`),
    term: () => termIndex.map((t) => `/terms/${t.id}/`),
    story: () => (contentManifest.stories ?? []).map((s) => `/lab/story/${s.id}/`),
  };
  const pages = [...table.static];
  for (const kind of table.dynamic) {
    const make = kinds[kind];
    if (!make) throw new Error(`sitemap：不認得的動態頁面種類 ${kind}（只認得 ${Object.keys(kinds).join('、')}）`);
    const list = make();
    for (const p of list) if (!/^(\/[a-z]+)+\/[a-z0-9_]+\/$/.test(p)) throw new Error(`sitemap：內容 ID 的格式不對：${p}`);
    pages.push(...list);
  }
  return pages;
}

/** robots.txt：正式站允許全部並指向 sitemap；預覽與本機全部禁止（預覽網址不該被收錄，殼層另外有 noindex） */
export function buildRobots({ origin, production }) {
  if (!production) return 'User-agent: *\nDisallow: /\n';
  checkOrigin(origin);
  return `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
}
