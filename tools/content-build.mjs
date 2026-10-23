// content:build（08 第 7.3 節）：ContentAdapter（files）到正規化模型，核心算出答案（04 第 15.2 節），再產出 content-manifest.json 與
// 依語系、依章節、依關卡切分的 hashed JSON。快照形狀在 lib/content-snapshot.mjs；這支只讀檔、檢查與寫檔。
// 輸出到 apps/web/public/content/（已被 .gitignore 排除；Vite 會把 public/ 原樣複製進 dist/）。
// 草稿不進快照；已下架項目只以墓碑形式出現；en 檔案不放退回文字（zh-TW 與 en 都是 complete，正式快照要求兩種語言齊全）。
// 例外：環境變數 LL_INCLUDE_DRAFTS=1 時連草稿一起收（manifest 標 includesDrafts，debug 頁會顯示），只給本機開發與 E2E 用；CI 與部署不設。
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { validateBundle } from '@ledgerland/content-schema';
import { loadContentFiles } from './lib/content-files.mjs';
import { hasErrors, parseBundle, runAccountingChecks } from './lib/content-rules.mjs';
import { buildSnapshot } from './lib/content-snapshot.mjs';
import { ROOT, fail, readJson } from './lib/fs.mjs';

const outRoot = join(ROOT, 'apps/web/public/content');
const bundle = loadContentFiles();
const issues = validateBundle(bundle);
if (issues.length) {
  for (const i of issues) fail(`content:build：${i.file} ${i.path}：${i.message}`);
  process.exit(1);
}
const parsed = parseBundle(bundle);
const acct = runAccountingChecks(parsed);
for (const i of acct.issues) if (i.severity === 'error') fail(`content:build：${i.file} ${i.path}：${i.rule}：${i.message}`);
if (hasErrors(acct.issues)) {
  console.error('content:build：內容有會計或答案錯誤，核心算不出完整答案，快照沒有產生');
  process.exit(1);
}
const lockPath = join(ROOT, 'content/published.lock.json');
const lock = existsSync(lockPath) ? readJson(lockPath) : { contentVersion: 1, items: [] };
let gitCommit = 'unknown';
try {
  gitCommit = execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
} catch {
  /* 還沒有 commit */
}
const includeDrafts = process.env.LL_INCLUDE_DRAFTS === '1';
const { manifest, files, counts } = buildSnapshot(parsed, acct.compiled, lock, { gitCommit, includeDrafts });

rmSync(outRoot, { recursive: true, force: true });
for (const [rel, text] of files) {
  const path = join(outRoot, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}
writeFileSync(join(outRoot, 'content-manifest.json'), JSON.stringify(manifest, null, 2));
if (includeDrafts) console.log('content:build：LL_INCLUDE_DRAFTS=1，快照含草稿（只給本機開發與 E2E；manifest 標 includesDrafts）');
console.log(
  `content:build：contentVersion ${manifest.contentVersion}，${counts.chapters} 章、${counts.objectives} 個學習目標、${counts.levels} 個關卡、${counts.questions} 個題目、${counts.terms} 個名詞，輸出到 apps/web/public/content/`,
);
