// handout:import（08 的講義題庫一節，2026-11-08）：把老師在 iClass 用的 CSV（ee-class 第 4 版測驗匯入檔）匯進講義題庫 content/handout/midterm.json。
// 只在本機跑（CSV 和 pptx 一樣放在本機的講義資料夾，永不 commit；用 --src 指到那個資料夾）。
//
//   node tools/handout-import.mjs [--src <資料夾>] [--dry-run] [--no-check]
//
// 讀 decks.json 裡 source 是 csv 的講義，各自對應資料夾裡的一個 CSV；解析在 lib/handout-csv.mjs，配 ID、算 rev、合併在 lib/handout-bank.mjs。
// pptx 講義的題原樣保留（那是 handout:extract 的事）。任何一列有錯就整個不寫，錯誤報告印成表格並存 .local-reports/handout/import-report.json。
// 沒有 --dry-run 且寫了檔，最後跑 content:check。
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { handoutSourceOf } from '@ledgerland/content-schema';
import { decodeCsvBuffer, parseCsv } from './lib/csv.mjs';
import { ROOT, readJson } from './lib/fs.mjs';
import { assignIds, buildQuestions, diffDeck, mergeBank } from './lib/handout-bank.mjs';
import { EE_CLASS_TYPES, csvQuestionKey, parseEeClassCsv } from './lib/handout-csv.mjs';
import { issue } from './lib/sheet-import.mjs';

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const dryRun = args.includes('--dry-run');
const noCheck = args.includes('--no-check');
const srcDir = argValue('--src') ?? join(ROOT, 'references/handouts');
const dir = join(ROOT, 'content/handout');
const decksPath = join(dir, 'decks.json');
const idsPath = join(dir, 'ids.json');
const bankPath = join(dir, 'midterm.json');
const reportDir = join(ROOT, '.local-reports/handout');

if (!existsSync(decksPath)) throw new Error(`handout:import：找不到 ${decksPath}`);
const decks = readJson(decksPath);
/** @type {Record<string, string>} */
const ids = existsSync(idsPath) ? readJson(idsPath) : {};
const previous = existsSync(bankPath) ? readJson(bankPath) : null;
const previousById = new Map((previous?.questions ?? []).map((q) => [q.id, q]));

const csvDecks = [...decks.decks].filter((d) => handoutSourceOf(d) === 'csv').sort((a, b) => a.order - b.order);
if (csvDecks.length === 0) {
  console.log(
    'handout:import：decks.json 裡沒有 source 是 csv 的講義，沒有事做。要加一份請在 decks.json 新增 { id, order, code, title, file: "….csv", source: "csv", sections: [{ id, title }] }。',
  );
  process.exit(0);
}

/** @type {import('./lib/sheet-import.mjs').SheetIssue[]} */
const issues = [];
/** @type {import('./lib/handout-bank.mjs').Rec[]} */
const records = [];
const perDeck = [];
for (const deck of csvDecks) {
  const path = join(srcDir, deck.file);
  const sheet = basename(deck.file);
  if (!existsSync(path)) throw new Error(`handout:import：找不到 ${deck.id} 的檔案 ${path}（用 --src 指到講義資料夾）`);
  const decoded = decodeCsvBuffer(readFileSync(path));
  if (decoded.encoding === 'big5')
    issues.push(issue('warning', 'csv.encoding', sheet, null, null, null, '檔案是 Big5，已用 Big5 讀取', '建議在 Excel 用「CSV UTF-8（逗號分隔）」另存。'));
  const parsed = parseEeClassCsv(parseCsv(decoded.text), sheet);
  issues.push(...parsed.issues);
  const sectionByTitle = new Map(deck.sections.map((s) => [s.title, s]));
  const deckRecords = [];
  for (const item of parsed.items) {
    let section;
    if (item.category === '') {
      if (deck.sections.length === 1) section = deck.sections[0];
      else
        issues.push(
          issue(
            'error',
            'csv.category',
            sheet,
            item.row,
            null,
            '類別',
            `類別是空的，但講義 ${deck.id} 有 ${deck.sections.length} 段`,
            `類別填其中一段的名稱：${deck.sections.map((s) => s.title).join('、')}。`,
          ),
        );
    } else {
      section = sectionByTitle.get(item.category);
      if (!section)
        issues.push(
          issue(
            'error',
            'csv.category',
            sheet,
            item.row,
            null,
            '類別',
            `類別「${item.category}」不是講義 ${deck.id} 的任何一段`,
            `可以填：${deck.sections.map((s) => s.title).join('、')}；或在 decks.json 加一段。`,
          ),
        );
    }
    if (!section) continue;
    const key = csvQuestionKey(item.scenario, item.question);
    const { row: _row, type: _type, category: _c, ...question } = item;
    deckRecords.push({ deck, slide: item.row, question, idKey: `${deck.id}:${key}`, key, exclusion: null, sectionId: section.id });
  }
  records.push(...deckRecords);
  perDeck.push({ deck, sheet, version: parsed.version, rows: parsed.items.length, skipped: parsed.skipped, records: deckRecords });
}

const errors = issues.filter((i) => i.severity === 'error');
const pad = (s, n) => {
  const str = String(s ?? '');
  let w = 0;
  for (const ch of str) w += /[ᄀ-￿]/.test(ch) ? 2 : 1;
  return str + ' '.repeat(Math.max(0, n - w));
};
if (issues.length) {
  console.log(`問題（錯誤 ${errors.length}、警告 ${issues.length - errors.length}）：`);
  console.log(`${pad('', 4)}${pad('檔案', 28)}${pad('列', 6)}${pad('欄', 14)}訊息｜建議修正`);
  for (const i of issues) {
    const col = i.column ? `${i.column}${i.field ? `（${i.field}）` : ''}` : (i.field ?? '');
    console.log(
      `${pad(i.severity === 'error' ? '錯誤' : '警告', 4)}${pad(i.sheet, 28)}${pad(i.row ?? '', 6)}${pad(col, 14)}${i.message}${i.suggestion ? `｜${i.suggestion}` : ''}`,
    );
  }
  console.log('');
}

// 組題目（有錯也先組，報告才有差異摘要；但有錯就不寫檔）
const newKeys = assignIds(records, ids);
const questions = buildQuestions(records, ids, previousById, (rec) => rec.sectionId ?? '');
const rebuilt = new Set(csvDecks.map((d) => d.id));
const { bank, changed } = mergeBank(previous, decks, rebuilt, questions);

const label = { new: '新增', text: '修改（文字）', answer: '修改（答案）', removed: '移除', unchanged: '無變動' };
const deckReports = perDeck.map((p) => {
  const prevQs = (previous?.questions ?? []).filter((q) => q.deck === p.deck.id);
  const nowQs = questions.filter((q) => q.deck === p.deck.id);
  const diff = diffDeck(prevQs, nowQs);
  return { ...p, diff };
});
console.log('差異摘要：');
for (const p of deckReports) {
  console.log(
    `  ${p.deck.id} ${p.deck.title}（${p.sheet}${p.version !== null ? `，version ${p.version}` : ''}）：讀到 ${p.rows} 題，略過 ${p.skipped.length} 列`,
  );
  for (const k of Object.keys(label)) console.log(`    ${pad(label[k], 14)}${p.diff[k].length}`);
  if (p.skipped.length) {
    const byType = new Map();
    for (const s of p.skipped) byType.set(s.type, [...(byType.get(s.type) ?? []), s.row]);
    for (const [type, rows] of byType) console.log(`    略過 ${EE_CLASS_TYPES[type]}（題型 ${type}）：第 ${rows.join('、')} 列`);
  }
  for (const k of ['new', 'text', 'answer', 'removed'])
    for (const q of p.diff[k]) console.log(`    ${label[k]}  ${q.id}（第 ${q.slide} 列）rev ${q.rev} ${q.revKind}：${q.topic}`);
}
console.log(`  新產生的 ID：${newKeys.length} 個；題庫 rev ${bank.rev}${previous ? `（上一次 ${previous.rev}）` : ''}${changed ? '' : '，整份沒有變'}`);

mkdirSync(reportDir, { recursive: true });
const report = {
  srcDir,
  dryRun,
  summary: { errors: errors.length, warnings: issues.length - errors.length, newIds: newKeys.length, bankRev: bank.rev, changed },
  issues,
  decks: deckReports.map((p) => ({
    deck: p.deck.id,
    file: p.sheet,
    version: p.version,
    rows: p.rows,
    skipped: p.skipped,
    changes: Object.fromEntries(Object.keys(label).map((k) => [k, p.diff[k].map((q) => ({ id: q.id, row: q.slide, rev: q.rev, revKind: q.revKind }))])),
  })),
};
writeFileSync(join(reportDir, 'import-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`報告已存 .local-reports/handout/import-report.json`);

if (errors.length) {
  console.log(`\nhandout:import：有 ${errors.length} 個錯誤，沒有寫檔。`);
  process.exit(1);
}
if (dryRun) {
  console.log('\nhandout:import：--dry-run，沒有寫檔。');
} else {
  writeFileSync(bankPath, JSON.stringify(bank, null, 2) + '\n');
  writeFileSync(idsPath, JSON.stringify(Object.fromEntries(Object.entries(ids).sort(([a], [b]) => a.localeCompare(b))), null, 2) + '\n');
  console.log(`\nhandout:import：已寫入 content/handout/midterm.json 與 ids.json（${questions.length} 題，${csvDecks.length} 份 CSV 講義）。`);
  if (!noCheck) {
    const r = spawnSync(process.execPath, [join(ROOT, 'tools/content-check.mjs')], { cwd: ROOT, stdio: 'inherit' });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
}
