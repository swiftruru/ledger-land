// content:template（08 第 10.2 節，M6，D10(d)）：由欄位定義與目前的內容產生 Excel 範本（帶下拉清單）或一組 CSV。
//
//   pnpm content:template                       空範本加範例列 → .local-reports/import/ledgerland-content.xlsx
//   pnpm content:template --filled              帶目前全部文字型題目與名詞（baseRev 填好），給「匯出、編輯、匯入」來回用
//   pnpm content:template --filled --chapter ch_xxxxxx   只帶一章的題目（名詞仍全帶）
//   pnpm content:template --csv                 改輸出 .local-reports/import/csv/<工作表>.csv（UTF-8 加 BOM）
//   pnpm content:template --out <路徑>           指定輸出檔（xlsx）或資料夾（csv）
//
// .xlsx 不能 commit（check:hygiene），所以範本一律現場產生到 .local-reports/（已被 .gitignore 排除）。
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadContentFiles } from './lib/content-files.mjs';
import { csvBuffer } from './lib/csv.mjs';
import { ROOT } from './lib/fs.mjs';
import { SHEET, buildTemplate } from './lib/sheet-template.mjs';
import { writeWorkbook } from './lib/xlsx-write.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const filled = flag('filled');
const csv = flag('csv');
const chapterId = opt('chapter');
const outArg = opt('out');

const bundle = loadContentFiles();
const data = (list) => list.map((e) => e.data).filter((d) => d && typeof d === 'object');
const content = {
  chapters: data(bundle.chapters),
  objectives: bundle.objectives.flatMap((f) => (Array.isArray(f.data?.items) ? f.data.items : [])),
  questions: data(bundle.questions),
  terms: data(bundle.terms),
};
if (chapterId && !content.chapters.some((c) => c.id === chapterId)) {
  console.error(`content:template：章節 ${chapterId} 不存在`);
  process.exit(1);
}
let contentCommit = '';
try {
  contentCommit = execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
} catch {
  // 沒有 git 也能產生範本
}
const workbook = buildTemplate(content, { filled, chapterId, generatedAt: new Date().toISOString(), contentCommit });

const defaultDir = join(ROOT, '.local-reports/import');
if (csv) {
  const dir = outArg ?? join(defaultDir, 'csv');
  mkdirSync(dir, { recursive: true });
  for (const s of workbook.sheets) {
    if (s.name === SHEET.lists) continue; // 清單只給下拉選單用，CSV 不需要
    writeFileSync(join(dir, `${s.name}.csv`), csvBuffer(s.rows));
  }
  console.log(`content:template：已寫出 ${workbook.sheets.length - 1} 個 CSV 到 ${dir}（${filled ? '含目前內容' : '空範本加範例列'}）`);
} else {
  const out = outArg ?? join(defaultDir, filled ? `ledgerland-content-${chapterId ?? 'all'}.xlsx` : 'ledgerland-template.xlsx');
  mkdirSync(join(out, '..'), { recursive: true });
  writeFileSync(out, writeWorkbook(workbook));
  const rowsOf = (name) => (workbook.sheets.find((s) => s.name === name)?.rows.length ?? 2) - 2;
  console.log(`content:template：已寫出 ${out}（題目 ${rowsOf(SHEET.questions)} 列、名詞 ${rowsOf(SHEET.terms)} 列${filled ? '' : '，都是範例'}）`);
}
