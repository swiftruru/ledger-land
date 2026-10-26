// content:check（08 第 5.8 節）：讀 content/ 與核心內建範本（ContentAdapter 的 files 實作），交給 packages/content-schema 的 validateBundle
// （結構、多語系、引用、佔位符），再跑 tools/lib/content-rules.mjs 的會計與答案規則（08 第 5.4、5.5 節，呼叫核心）與
// tools/lib/content-text.mjs 的文字與結構規則（檔名、關卡題數提醒、字母引用、寫死數字、頁碼樣式與學習端文字的內部編號、題目的名詞佔位符要列在 termRefs），最後比對 content/published.lock.json（08 第 5.6 節的八條 id.* 規則，與 content:lock --check 同一套）。
// 錯誤訊息一律「檔案、JSON 路徑、規則、訊息」；警告不讓指令失敗。這支腳本只負責讀檔與列印，規則都在 lib/。
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateBundle } from '@ledgerland/content-schema';
import { loadContentFiles } from './lib/content-files.mjs';
import { allEntityIds, checkLock, currentLockItems, normaliseLock } from './lib/content-lock.mjs';
import { hasErrors, parseBundle, runAccountingChecks } from './lib/content-rules.mjs';
import { runTextChecks } from './lib/content-text.mjs';
import { ROOT, fail, readJson } from './lib/fs.mjs';

const started = performance.now();
const bundle = loadContentFiles();
const schemaIssues = validateBundle(bundle);
for (const i of schemaIssues) fail(`content:check：${i.file} ${i.path}：${i.rule ? `${i.rule}：` : ''}${i.message}`);

const parsed = parseBundle(bundle);
const acct = runAccountingChecks(parsed);
const text = runTextChecks(parsed);
let warnings = 0;
for (const i of [...text, ...acct.issues]) {
  if (i.severity === 'error') fail(`content:check：${i.file} ${i.path}：${i.rule}：${i.message}`);
  else {
    warnings++;
    console.warn(`content:check 警告：${i.file} ${i.path}：${i.rule}：${i.message}`);
  }
}

// lock（08 第 4.4、5.6 節）：只有結構與會計都沒有錯誤時才比對，否則 answerHash 不完整
const lockPath = join(ROOT, 'content/published.lock.json');
let lockIssues = 0;
if (schemaIssues.length === 0 && !hasErrors(acct.issues) && !hasErrors(text)) {
  if (!existsSync(lockPath)) fail('content:check：content/published.lock.json 不存在，請執行 pnpm content:lock --write');
  else {
    const files = new Map();
    for (const list of Object.values(parsed)) for (const x of list) files.set(x.data.id, x.file);
    const issues = checkLock(normaliseLock(readJson(lockPath)), currentLockItems(parsed, acct.compiled), allEntityIds(parsed), files);
    lockIssues = issues.length;
    for (const i of issues) fail(`content:check：${i.file} ${i.path}：${i.rule}：${i.message}`);
  }
}

const elapsed = ((performance.now() - started) / 1000).toFixed(1);
if (process.exitCode) {
  console.error(
    `content:check：失敗（結構 ${schemaIssues.length}、文字與結構 ${text.filter((i) => i.severity === 'error').length}、會計與答案 ${acct.issues.filter((i) => i.severity === 'error').length}、lock ${lockIssues} 個錯誤；${elapsed} 秒）`,
  );
} else {
  console.log(
    `content:check：${bundle.terms.length} 個名詞、${bundle.chapters.length} 個章節、${parsed.objectives.length} 個學習目標、${bundle.levels.length} 個關卡、` +
      `${acct.stats.templates} 個範本（${acct.stats.combos} 組參數，前置條件不成立跳過 ${acct.stats.skipped} 組）、` +
      `${acct.stats.storiesReplayed} 個故事、${bundle.questions.length} 個題目通過，lock 一致${warnings > 0 ? `，${warnings} 個警告` : ''}（${elapsed} 秒）`,
  );
}
