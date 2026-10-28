// 殼層依路徑預先載入的表（06 第 8.2 節、14 第 5.2 節）：tools/postbuild.mjs 在建置後呼叫，把結果填進 boot 腳本的 /*ll:preload*/null。
// 純函式，不讀檔：輸入 Vite 的 .vite/manifest.json、內容的 content-manifest.json 與 apps/web/src/shell/route-preload.json，
// 輸出 boot 腳本（apps/web/src/shell/boot.js 的 preload 區塊）讀的精簡表格：
//   a：資產檔名（/assets/ 底下）；c：各語言的訊息 catalog（route-preload.json 的 catalogs 指的模組與它的靜態 import）在 a 的索引；
//   r：[pattern, a 的索引, 內容種類]；m：內容快照的路徑或雜湊（ci 章節索引、ti 名詞索引、tb 墓碑、ch 章節 ID 對各語言的章節包雜湊、lv 關卡 ID 對所屬章節 ID、
//   td 各語言的名詞分桶對雜湊）。關卡在所屬章節的章節包裡（schemaVersion 3，08 第 7.3 節），作答頁預先載入的是那一章的章節包。
// 章節包與名詞分桶只存雜湊，路徑由 boot 腳本依固定格式組回；格式不符（例如日後改了檔名規則）或關卡的檔不是所屬章節的章節包時直接丟錯，建置失敗，不會默默預先載入錯的檔案。

/** Vite manifest 裡某個模組的 chunk 與靜態 import（遞迴，不含殼層入口 chunk）；css 一併收集 */
function closure(viteManifest, key, out) {
  const entry = viteManifest[key];
  if (!entry) throw new Error(`preload：Vite manifest 找不到 ${key}`);
  if (entry.isEntry) return;
  if (out.js.has(entry.file)) return;
  out.js.add(entry.file);
  for (const css of entry.css ?? []) out.css.add(css);
  for (const dep of entry.imports ?? []) closure(viteManifest, dep, out);
}

const assetName = (file) => {
  if (!file.startsWith('assets/')) throw new Error(`preload：資產不在 assets/ 底下：${file}`);
  return file.slice('assets/'.length);
};

/**
 * @param {{ viteManifest: Record<string, any>; contentManifest: Record<string, any>; routes: { pattern: string; module: string; content: string[] }[]; catalogs: Record<string, string>; locales: string[]; always?: string[]; chunkModules?: Record<string, string[]> }} input
 */
export function buildPreloadTable({ viteManifest, contentManifest, routes, catalogs: catalogModules, locales, always = [], chunkModules = {} }) {
  // always 列的是原始碼模組（例如 src/lib/progress/runtime.ts）；它被 codeSplitting.groups 併進沒有原始碼鍵的 chunk，所以先用 chunk-modules.json
  // 找出含它的 chunk 檔名，再對回 manifest 的鍵（manifest 以 file 欄位對應）
  const keyOfModule = (mod) => {
    if (viteManifest[mod]) return mod;
    const file = Object.entries(chunkModules).find(([, mods]) => mods.includes(mod))?.[0];
    const key = file && Object.entries(viteManifest).find(([, e]) => e.file === file)?.[0];
    if (!key) throw new Error(`preload：找不到含 ${mod} 的 chunk（.vite/chunk-modules.json 與 manifest）`);
    return key;
  };
  /** @type {string[]} */
  const assets = [];
  const indexOf = (name) => {
    let i = assets.indexOf(name);
    if (i === -1) {
      assets.push(name);
      i = assets.length - 1;
    }
    return i;
  };
  const filesOf = (keys) => {
    const out = { js: new Set(), css: new Set() };
    for (const k of keys) closure(viteManifest, k, out);
    return [...out.js, ...out.css].map((f) => indexOf(assetName(f)));
  };
  const catalogs = Object.fromEntries(
    locales.map((loc) => {
      const key = catalogModules[loc];
      if (key === undefined) throw new Error(`preload：route-preload.json 的 catalogs 沒有 ${loc}`);
      return [loc, filesOf([key])];
    }),
  );
  // 每一頁都要的 chunk（進度 runtime）：w，和 catalog 一樣不分路由
  const w = filesOf(always.map(keyOfModule));
  const kinds = new Set(['chapterIndex', 'termIndex', 'tombstones', 'level', 'termDetail']);
  const r = routes.map((route) => {
    // 不合法的 pattern 在建置時就失敗，不要等到使用者的瀏覽器才在 boot 腳本裡丟錯
    try {
      RegExp(route.pattern);
    } catch {
      throw new Error(`preload：pattern 不是合法的正規表示式：${route.pattern}`);
    }
    for (const c of route.content) if (!kinds.has(c)) throw new Error(`preload：不認得的內容種類 ${c}（${route.pattern}）`);
    return [route.pattern, filesOf([route.module]), route.content];
  });

  const m = contentManifest;
  const perLocale = (field) => Object.fromEntries(locales.map((loc) => [loc, required(m[field]?.[loc], `${field}.${loc}`)]));
  const required = (v, name) => {
    if (typeof v !== 'string' || !v.startsWith('content/')) throw new Error(`preload：content-manifest 沒有 ${name}`);
    return v;
  };
  // 章節包：content/<語言>/<章節 ID>.<雜湊>.json；名詞分桶：content/<語言>/terms-<桶>.<雜湊>.json
  const hashOf = (path, prefix) => {
    const match = path.startsWith(prefix) ? /^\.([0-9a-f]+)\.json$/.exec(path.slice(prefix.length)) : null;
    if (!match) throw new Error(`preload：${path} 不是 ${prefix}<雜湊>.json 的格式`);
    return match[1];
  };
  const chapters = new Map((m.chapters ?? []).map((c) => [c.id, c]));
  const ch = Object.fromEntries(
    [...chapters.values()].map((c) => [c.id, locales.map((loc) => hashOf(required(c.files?.[loc], `chapters.${c.id}.${loc}`), `content/${loc}/${c.id}`))]),
  );
  // 關卡只記所屬章節；關卡的檔必須就是那一章的章節包（關卡另成檔的舊格式會在這裡失敗）
  const lv = Object.fromEntries(
    (m.levels ?? []).map((l) => {
      const chapter = chapters.get(l.chapterId);
      if (!chapter) throw new Error(`preload：關卡 ${l.id} 的章節 ${l.chapterId} 不在 content-manifest 的 chapters 裡`);
      for (const loc of locales)
        if (l.files?.[loc] !== chapter.files?.[loc]) throw new Error(`preload：關卡 ${l.id} 的 ${loc} 檔不是章節 ${l.chapterId} 的章節包（${l.files?.[loc]}）`);
      return [l.id, l.chapterId];
    }),
  );
  const td = Object.fromEntries(
    locales.map((loc) => [
      loc,
      Object.fromEntries(
        Object.entries(m.termDetails?.[loc] ?? {}).map(([b, path]) => [b, hashOf(required(path, `termDetails.${loc}.${b}`), `content/${loc}/terms-${b}`)]),
      ),
    ]),
  );
  return {
    a: assets,
    c: catalogs,
    w,
    r,
    m: { l: locales, ci: perLocale('chapterIndex'), ti: perLocale('termIndex'), tb: required(m.tombstones, 'tombstones'), ch, lv, td },
  };
}

export const PRELOAD_PLACEHOLDER = '/*ll:preload*/null';

/** 把表格填進 index.html 的 boot 腳本；找不到佔位（或不只一個）就丟錯 */
export function injectPreload(html, table) {
  const parts = html.split(PRELOAD_PLACEHOLDER);
  if (parts.length !== 2) throw new Error(`preload：index.html 應該剛好有一個 ${PRELOAD_PLACEHOLDER}，實際 ${parts.length - 1} 個`);
  // JSON 放進 inline script：</script> 與 <!-- 不可能出現在檔名與雜湊裡，仍保險地跳脫角括號
  return parts[0] + JSON.stringify(table).replace(/</g, '\\u003c') + parts[1];
}
