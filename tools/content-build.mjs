// content:build（08 第 7.3 節）：ContentAdapter（files）到正規化模型，再產出 content-manifest.json 與依語系、依章節切分的 hashed JSON。
// 輸出到 apps/web/public/content/（已被 .gitignore 排除；Vite 會把 public/ 原樣複製進 dist/）。
// 草稿不進快照；已下架項目只以墓碑形式出現；en 檔案不放退回文字（zh-TW 與 en 都是 complete，正式快照要求兩種語言齊全）。
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES } from '@ledgerland/i18n';
import { validateBundle } from '@ledgerland/content-schema';
import { loadContentFiles } from './lib/content-files.mjs';
import { ROOT, fail, readJson } from './lib/fs.mjs';

const outRoot = join(ROOT, 'apps/web/public/content');
const bundle = loadContentFiles();
const issues = validateBundle(bundle);
if (issues.length) {
  for (const i of issues) fail(`content:build：${i.file} ${i.path}：${i.message}`);
  process.exit(1);
}
const terms = bundle.terms.map((t) => t.data);
const chapters = bundle.chapters.map((c) => c.data);
const lock = existsSync(join(ROOT, 'content/published.lock.json')) ? readJson(join(ROOT, 'content/published.lock.json')) : { contentVersion: 1 };

/** 依語系取出 LocalizedText 的單一文字；正式快照只放已發布的內容，所以 en 一定存在 */
function localize(value, locale) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length && keys.every((k) => LOCALES.some((l) => l.code === k))) return value[locale] ?? value['zh-TW'];
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, localize(v, locale)]));
  }
  if (Array.isArray(value)) return value.map((v) => localize(v, locale));
  return value;
}
const strip = ({ authorNotes: _a, ...rest }) => rest;
const hash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 6);

rmSync(outRoot, { recursive: true, force: true });
for (const l of LOCALES) mkdirSync(join(outRoot, l.code), { recursive: true });
const write = (locale, name, data) => {
  const text = JSON.stringify(data);
  const file = `${name}.${hash(text)}.json`;
  writeFileSync(join(outRoot, locale, file), text);
  return `content/${locale}/${file}`;
};

const published = { terms: terms.filter((t) => t.status === 'published'), chapters: chapters.filter((c) => c.status === 'published') };
const tombstones = [...terms, ...chapters]
  .filter((x) => x.status === 'retired')
  .map((x) => ({ id: x.id, supersededBy: x.supersededBy, retiredNote: x.retiredNote }));
let gitCommit = 'unknown';
try {
  gitCommit = execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
} catch {
  /* 還沒有 commit */
}
const manifest = {
  schemaVersion: 1,
  contentVersion: lock.contentVersion ?? 1,
  builtAt: new Date().toISOString(),
  gitCommit,
  locales: Object.fromEntries(LOCALES.map((l) => [l.code, { status: l.status }])),
  chapters: published.chapters
    .sort((a, b) => a.order - b.order)
    .map((c) => ({ id: c.id, order: c.order, files: Object.fromEntries(LOCALES.map((l) => [l.code, write(l.code, c.id, localize(strip(c), l.code))])) })),
  terms: Object.fromEntries(
    LOCALES.map((l) => [
      l.code,
      write(
        l.code,
        'terms',
        published.terms.map((t) => localize(strip(t), l.code)),
      ),
    ]),
  ),
  templates: {},
  stories: [],
  tombstones: (() => {
    const text = JSON.stringify(tombstones);
    const file = `tombstones.${hash(text)}.json`;
    writeFileSync(join(outRoot, file), text);
    return `content/${file}`;
  })(),
};
writeFileSync(join(outRoot, 'content-manifest.json'), JSON.stringify(manifest, null, 2));
console.log(
  `content:build：contentVersion ${manifest.contentVersion}，${published.chapters.length} 章、${published.terms.length} 個名詞，輸出到 apps/web/public/content/`,
);
