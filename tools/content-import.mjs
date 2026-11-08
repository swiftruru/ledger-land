// content:import（08 第 10 節，M6，D10(d)）：讀範本（xlsx 或 CSV），驗證、印錯誤報告與差異摘要，確認後寫入 content/。
//
//   pnpm content:import <檔案…>                          只報告，不寫檔；另存 .local-reports/import/import-report.json
//   pnpm content:import <檔案…> --write                  沒有錯誤時寫入 content/；有「修改（答案）」或「下架」時要再加 --accept-answer-changes
//   pnpm content:import <檔案…> --write --accept-answer-changes
//   --verbose 展開每一筆的逐欄差異；--no-check 寫檔後不跑 content:check
//
// 只接受 .xlsx 與 .csv（.xlsm 等含巨集的格式拒絕）；檔案超過 20 MB 或單表超過 5000 列拒絕（08 第 10.7 節）。流程都在 lib/import-run.mjs，這支只讀寫檔與列印。
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { format as prettierFormat } from 'prettier';
import { loadContentFiles } from './lib/content-files.mjs';
import { decodeCsvBuffer, parseCsv } from './lib/csv.mjs';
import { ROOT, readJson } from './lib/fs.mjs';
import { runImport, sheetsFromCsv } from './lib/import-run.mjs';
import { candidateFile } from './lib/sheet-import.mjs';
import { LAST_VALIDATED_ROW } from './lib/sheet-template.mjs';
import { readWorkbook } from './lib/xlsx-read.mjs';

const MAX_BYTES = 20 * 1024 * 1024;
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const files = args.filter((a) => !a.startsWith('--'));
const write = flags.has('--write');
const acceptAnswer = flags.has('--accept-answer-changes');
const verbose = flags.has('--verbose');
const runCheck = !flags.has('--no-check');
const reportDir = join(ROOT, '.local-reports/import');

if (files.length === 0) {
  console.error('用法：pnpm content:import <xlsx 或 csv 檔案…> [--write] [--accept-answer-changes] [--verbose] [--no-check]');
  process.exit(2);
}

// 讀檔
/** @type {Record<string, unknown[][]>} */
let sheets = {};
const preIssues = [];
const csvFiles = [];
for (const f of files) {
  if (!existsSync(f)) {
    console.error(`content:import：找不到檔案 ${f}`);
    process.exit(1);
  }
  const ext = extname(f).toLowerCase();
  const size = statSync(f).size;
  if (size > MAX_BYTES) {
    console.error(`content:import：${f} 超過 ${MAX_BYTES / 1024 / 1024} MB，拒絕讀取`);
    process.exit(1);
  }
  const buf = readFileSync(f);
  if (ext === '.xlsx') {
    if (files.length > 1) {
      console.error('content:import：xlsx 一次只能傳一個檔案（多個工作表都在裡面）');
      process.exit(1);
    }
    let wb;
    try {
      wb = readWorkbook(buf);
    } catch (e) {
      console.error(`content:import：${f} 讀不出來：${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
    for (const s of wb.sheets) sheets[s.name] = s.rows;
    for (const p of wb.problems)
      preIssues.push({
        severity: 'error',
        code: `xlsx.${p.code}`,
        sheet: p.sheet,
        row: Number(p.ref.replace(/^[A-Z]+/, '')),
        column: p.ref.replace(/\d+$/, ''),
        field: null,
        message: p.message,
        suggestion: '這一格改成一般的文字或數字再存檔。',
      });
  } else if (ext === '.csv') {
    let decoded;
    try {
      decoded = decodeCsvBuffer(buf);
    } catch (e) {
      console.error(`content:import：${f}：${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
    if (decoded.encoding === 'big5')
      console.warn(
        `content:import 警告：${basename(f)} 不是 UTF-8，已用 Big5 讀取；Big5 放不下的字（例如「③」）已經變形，請核對差異摘要，之後改用 .xlsx 或「CSV UTF-8」`,
      );
    try {
      csvFiles.push({ name: basename(f), rows: parseCsv(decoded.text) });
    } catch (e) {
      console.error(`content:import：${f}：${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  } else {
    console.error(`content:import：只接受 .xlsx 與 .csv，不接受 ${ext || '沒有副檔名'}（含巨集的 .xlsm 也不收）`);
    process.exit(1);
  }
}
if (csvFiles.length) {
  const r = sheetsFromCsv(csvFiles);
  sheets = { ...sheets, ...r.sheets };
  preIssues.push(...r.issues);
}
for (const [name, rows] of Object.entries(sheets))
  if (rows.length > LAST_VALIDATED_ROW) {
    console.error(`content:import：工作表「${name}」有 ${rows.length} 列，超過 ${LAST_VALIDATED_ROW} 列的上限`);
    process.exit(1);
  }

// 流程
const bundle = loadContentFiles();
const lockPath = join(ROOT, 'content/published.lock.json');
const lock = existsSync(lockPath) ? readJson(lockPath) : undefined;
const result = runImport({ sheets, bundle, lock, now: new Date().toISOString() });
const issues = [...preIssues, ...result.issues];
const errors = issues.filter((i) => i.severity === 'error').length;

// 報告
mkdirSync(reportDir, { recursive: true });
const report = {
  files: files.map((f) => basename(f)),
  templateVersion: result.templateVersion,
  summary: { ...result.summary, errors, warnings: issues.length - errors },
  issues,
  changes: result.candidates.map((c) => ({
    id: c.id,
    kind: c.kind,
    change: c.change,
    row: c.row,
    rev: c.data.rev,
    revKind: c.data.revKind,
    status: c.data.status,
    changedFields: c.changedFields ?? [],
  })),
};
writeFileSync(join(reportDir, 'import-report.json'), JSON.stringify(report, null, 2) + '\n');

const pad = (s, n) => {
  const str = String(s ?? '');
  let w = 0;
  for (const ch of str) w += /[ᄀ-￿]/.test(ch) ? 2 : 1;
  return str + ' '.repeat(Math.max(0, n - w));
};
if (issues.length) {
  console.log(`\n問題（錯誤 ${errors}、警告 ${issues.length - errors}）：`);
  console.log(`${pad('', 4)}${pad('工作表', 10)}${pad('列', 6)}${pad('欄', 20)}訊息｜建議修正`);
  for (const i of issues) {
    const col = i.column ? `${i.column}${i.field ? `（${i.field}）` : ''}` : (i.field ?? '');
    console.log(
      `${pad(i.severity === 'error' ? '錯誤' : '警告', 4)}${pad(i.sheet, 10)}${pad(i.row ?? '', 6)}${pad(col, 20)}${i.message}${i.suggestion ? `｜${i.suggestion}` : ''}`,
    );
  }
}
const s = result.summary;
console.log('\n差異摘要：');
const label = { new: '新增', text: '修改（文字）', answer: '修改（答案）', retire: '下架', conflict: '衝突', unchanged: '無變動', error: '有錯誤的列' };
for (const k of Object.keys(label)) console.log(`  ${pad(label[k], 14)}${s[k]}`);
if (s.examples) console.log(`  ${pad('範例列略過', 14)}${s.examples}`);
const changed = result.candidates.filter((c) => ['new', 'text', 'answer', 'retire'].includes(c.change));
if (changed.length) {
  console.log('\n每一筆：');
  for (const c of changed) {
    const fields = (c.changedFields ?? []).join('、');
    console.log(
      `  ${label[c.change]}  ${c.kind === 'term' ? '名詞' : '題目'} ${c.id}（${c.sheet} 第 ${c.row} 列）rev ${c.data.rev} ${c.data.revKind} ${c.data.status}${c.isNew ? '' : `：${fields}`}`,
    );
    if (verbose && !c.isNew)
      for (const f of c.changedFields ?? []) console.log(`      ${f}：${JSON.stringify(c.existing.data[f] ?? null)} → ${JSON.stringify(c.data[f] ?? null)}`);
  }
}
const newIds = result.candidates.filter((c) => c.change === 'new').map((c) => c.id);
console.log(`\n報告已存 ${join('.local-reports/import', 'import-report.json')}`);

// 寫檔
if (!write) {
  if (errors) {
    console.log(`content:import：有 ${errors} 個錯誤，修正後再匯入`);
    process.exitCode = 1;
  } else if (changed.length)
    console.log(`content:import：這是預覽；確定要寫入請加 --write${result.needsConfirmation ? ' --accept-answer-changes（有答案改版或下架）' : ''}`);
  else console.log('content:import：沒有要寫入的變動');
} else if (errors) {
  console.error(`content:import：有 ${errors} 個錯誤，不寫入`);
  process.exitCode = 1;
} else if (result.needsConfirmation && !acceptAnswer) {
  console.error('content:import：有「修改（答案）」或「下架」，確定的話請加 --accept-answer-changes（學生的錯題本會顯示「題目已更新」）');
  process.exitCode = 1;
} else if (changed.length === 0) {
  console.log('content:import：沒有要寫入的變動');
} else {
  const written = [];
  for (const c of result.writable) {
    const rel = candidateFile(c);
    const abs = join(ROOT, rel);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, await prettierFormat(JSON.stringify(orderFields(c), null, 2), { filepath: abs }));
    written.push(rel);
    if (c.existing && c.existing.file !== rel && existsSync(join(ROOT, c.existing.file))) {
      unlinkSync(join(ROOT, c.existing.file));
      written.push(`（刪除）${c.existing.file}`);
    }
  }
  console.log(`content:import：已寫入 ${written.length} 個檔案：\n  ${written.join('\n  ')}`);
  if (newIds.length) console.log(`content:import：新產生的 ID：${newIds.join('、')}；請重新執行 pnpm content:template --filled 再繼續編輯`);
  if (changed.some((c) => c.data.status === 'published')) console.log('content:import：有已發布的項目變動，開 PR 前請執行 pnpm content:lock --write');
  if (runCheck) {
    console.log('content:import：接著執行 content:check…');
    const r = spawnSync(process.execPath, [join(ROOT, 'tools/content-check.mjs')], { cwd: ROOT, stdio: 'inherit' });
    if (r.status !== 0) process.exitCode = r.status ?? 1;
  }
}

/** 寫檔時的欄位順序：管理欄位、分類欄位、文字欄位；其餘照原順序排在後面 */
function orderFields(c) {
  const order =
    c.kind === 'term'
      ? [
          'id',
          'rev',
          'revKind',
          'status',
          'supersededBy',
          'retiredNote',
          'category',
          'label',
          'teacherLabel',
          'currentTwLabel',
          'ifrsEnglish',
          'aliases',
          'enUsVariant',
          'flags',
          'confidence',
          'pendingRefs',
          'ifrsBasis',
          'note',
          'definition',
          'example',
          'misconception',
          'formula',
          'ifrsNote',
          'accountRef',
          'ratioRef',
          'related',
          'labRefs',
          'unlock',
          'authorNotes',
          'updatedAt',
        ]
      : [
          'id',
          'rev',
          'revKind',
          'status',
          'supersededBy',
          'retiredNote',
          'type',
          'chapterId',
          'objectiveId',
          'difficulty',
          'tags',
          'termRefs',
          'labRef',
          'scored',
          'pendingRefs',
          'vars',
          'prompt',
          'statement',
          'options',
          'correctOptionId',
          'correctOptionIds',
          'scoringMode',
          'correct',
          'feedbackTrue',
          'feedbackFalse',
          'misconceptionId',
          'dimension',
          'items',
          'correctCategories',
          'ratioRef',
          'ratioTable',
          'distractorExprs',
          'viewpoint',
          'attribution',
          'explanation',
          'hint',
          'display',
          'authorNotes',
          'updatedAt',
        ];
  const out = {};
  for (const k of order) if (c.data[k] !== undefined) out[k] = c.data[k];
  for (const k of Object.keys(c.data)) if (!(k in out)) out[k] = c.data[k];
  return out;
}
