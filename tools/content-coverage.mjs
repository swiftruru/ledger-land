// content:coverage（08 第 1.2、5.8 節）：依學習目標與題目資料產生觀念覆蓋表，Markdown 印到 stdout 並寫到 .local-reports/content/coverage.md（gitignored）。
// 預設只是報表，不讓指令失敗；加 --check 時（10 第 10 節 M3 完成標準第一條）任一個學習目標的已發布題數未達 plannedQuestions，
// 或有題目的 objectiveId 不存在，就逐條列出「檔案、JSON 路徑、規則、訊息、建議修正」並以 exit 1 結束。本機與 CI 用同一條指令。
// 結構錯誤的檔案由 content:check 回報，這裡略過。
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadContentFiles } from './lib/content-files.mjs';
import { coverage, coverageMarkdown, coverageShortfalls } from './lib/content-coverage.mjs';
import { parseBundle } from './lib/content-rules.mjs';
import { ROOT, fail } from './lib/fs.mjs';

const check = process.argv.includes('--check');
const parsed = parseBundle(loadContentFiles());
const result = coverage(parsed);
const md = coverageMarkdown(result);
const outDir = join(ROOT, '.local-reports/content');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'coverage.md'), md);
writeFileSync(join(outDir, 'coverage.json'), JSON.stringify(result, null, 2));
console.log(md);
console.log(`content:coverage：${result.rows.length} 個學習目標，報表在 .local-reports/content/coverage.md`);
if (check) {
  const shortfalls = coverageShortfalls(result);
  for (const s of shortfalls) fail(`content:coverage：${s.file} ${s.path}：${s.rule}：${s.message}`);
  if (shortfalls.length > 0) console.error(`content:coverage --check：${shortfalls.length} 個學習目標未達預計題數或題目沒有對應的目標（M3 完成標準第一條）`);
  else console.log(`content:coverage --check：每個學習目標都已發布預計題數（共 ${result.totals.published} 題）`);
}
