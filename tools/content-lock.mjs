// content:lock（08 第 4.4、5.6、5.8 節）：--check 比對 content/published.lock.json 與目前內容（八條 id.* 規則）；
// --write 先跑結構與會計檢查（answerHash 需要核心算出的答案），沒有錯誤才把合併後的新 lock 寫回（保留 contentVersion）。
// 有 id.vanished、id.revNotBumped 這類要作者處理的錯誤時 --write 不寫入，先列出要修的項目。草稿不進 lock。
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateBundle } from '@ledgerland/content-schema';
import { format as prettierFormat } from 'prettier';
import { loadContentFiles } from './lib/content-files.mjs';
import { LOCK_COMMENT, allEntityIds, checkLock, currentLockItems, nextLock, normaliseLock } from './lib/content-lock.mjs';
import { hasErrors, parseBundle, runAccountingChecks } from './lib/content-rules.mjs';
import { ROOT, fail, readJson } from './lib/fs.mjs';

const mode = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : null;
if (mode === null) {
  console.error('用法：pnpm content:lock --check 或 pnpm content:lock --write');
  process.exit(2);
}

const lockPath = join(ROOT, 'content/published.lock.json');
const bundle = loadContentFiles();
const schemaIssues = validateBundle(bundle);
for (const i of schemaIssues) fail(`content:lock：${i.file} ${i.path}：${i.rule ? `${i.rule}：` : ''}${i.message}`);
const parsed = parseBundle(bundle);
const acct = runAccountingChecks(parsed);
for (const i of acct.issues) if (i.severity === 'error') fail(`content:lock：${i.file} ${i.path}：${i.rule}：${i.message}`);
if (schemaIssues.length > 0 || hasErrors(acct.issues)) {
  console.error('content:lock：內容有結構或會計錯誤，answerHash 不完整，請先修正再執行');
  process.exit(1);
}

const prev = existsSync(lockPath) ? normaliseLock(readJson(lockPath)) : normaliseLock(undefined);
const current = currentLockItems(parsed, acct.compiled);
const files = new Map();
for (const list of Object.values(parsed)) for (const x of list) files.set(x.data.id, x.file);
const issues = checkLock(prev, current, allEntityIds(parsed), files);

if (mode === 'check') {
  if (!existsSync(lockPath)) fail('content:lock：content/published.lock.json 不存在，請執行 pnpm content:lock --write');
  for (const i of issues) fail(`content:lock：${i.file} ${i.path}：${i.rule}：${i.message}`);
  if (!process.exitCode) console.log(`content:lock：lock 與內容一致（${current.size} 個已發布或已下架的項目）`);
} else {
  // 只有 id.lockStale 可以由 --write 解決；其餘是作者要處理的（rev、revKind、ID 重用、supersededBy）
  const blocking = issues.filter((i) => i.rule !== 'id.lockStale');
  for (const i of blocking) fail(`content:lock：${i.file} ${i.path}：${i.rule}：${i.message}`);
  if (blocking.length > 0) {
    console.error('content:lock：上面的項目要先處理（例如把 rev 加一並設 revKind 為 answer），lock 沒有寫入');
    process.exit(1);
  }
  const next = { $comment: LOCK_COMMENT, ...nextLock(prev, current) };
  const text = await prettierFormat(JSON.stringify(next, null, 2), { filepath: lockPath });
  writeFileSync(lockPath, text);
  const changed = issues.length;
  console.log(`content:lock：已寫入 content/published.lock.json（${next.items.length} 個項目，${changed} 個更新；contentVersion ${next.contentVersion}）`);
}
