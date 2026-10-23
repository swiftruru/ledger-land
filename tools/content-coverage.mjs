// content:coverage（08 第 1.2、5.8 節）：依學習目標與題目資料產生觀念覆蓋表，Markdown 印到 stdout 並寫到 .local-reports/content/coverage.md（gitignored）。
// 只是報表，不讓指令失敗；結構錯誤的檔案由 content:check 回報，這裡略過。
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadContentFiles } from './lib/content-files.mjs';
import { coverage, coverageMarkdown } from './lib/content-coverage.mjs';
import { parseBundle } from './lib/content-rules.mjs';
import { ROOT } from './lib/fs.mjs';

const parsed = parseBundle(loadContentFiles());
const result = coverage(parsed);
const md = coverageMarkdown(result);
const outDir = join(ROOT, '.local-reports/content');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'coverage.md'), md);
writeFileSync(join(outDir, 'coverage.json'), JSON.stringify(result, null, 2));
console.log(md);
console.log(`content:coverage：${result.rows.length} 個學習目標，報表在 .local-reports/content/coverage.md`);
