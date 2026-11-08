// handout:extract（08 的講義題庫一節，維護者 2026-11-04 的決定）：從老師的講義 pptx 抽出練習題，寫成 content/handout/midterm.json。
// 只在本機跑（pptx 在 references/handouts/，永不 commit；也可用 --src 指到別的資料夾）。這支腳本只讀檔、組資料與寫檔；解析在 lib/handout-pptx.mjs，zip 在 lib/zip-read.mjs，
// 配 ID、算 rev 與合併在 lib/handout-bank.mjs（和 handout-import.mjs 共用，2026-11-08）。
//
//   node tools/handout-extract.mjs [--src <資料夾>] [--dry-run]
//
// 輸入：content/handout/decks.json（講義清單、章節範圍、人工排除）、content/handout/ids.json（投影片到 hq_ ID 的對照表，沒有就建）、
//       上一次的 content/handout/midterm.json（算 rev 與 answerRev 用，沒有就全部 1）。
// 規則：題目逐字照講義；重複（情境、問題、選項都相同、答案也相同）只留講義順序最前面的一題；相同但答案不同的兩題都標 excluded（conflicting_answer）並互相記 related；
//       decks.json 的 exclusions 標 explanation_issue（不收）或 check（收，但請老師確認）；每一題的投影片都要落在某個 section 的範圍內；任何一張題目投影片抽不完整就失敗，不產半套。
//       只重建 source 是 pptx 的講義；CSV 講義的題（handout:import 寫的）原樣保留。
// 輸出：content/handout/midterm.json、content/handout/ids.json（新 ID 只在第一次出現時產生，之後不變）、.local-reports/handout/report.md。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { handoutSourceOf } from '@ledgerland/content-schema';
import { ROOT, readJson } from './lib/fs.mjs';
import { answerKey, assignIds, buildQuestions, mergeBank } from './lib/handout-bank.mjs';
import { dedupeKey, extractQuestion, parseSlide, slideOrder } from './lib/handout-pptx.mjs';
import { readZipTexts } from './lib/zip-read.mjs';

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const dryRun = args.includes('--dry-run');
const srcDir = argValue('--src') ?? join(ROOT, 'references/handouts');
const dir = join(ROOT, 'content/handout');
const decksPath = join(dir, 'decks.json');
const idsPath = join(dir, 'ids.json');
const bankPath = join(dir, 'midterm.json');
const reportDir = join(ROOT, '.local-reports/handout');

if (!existsSync(decksPath)) throw new Error(`handout:extract：找不到 ${decksPath}`);
const decks = readJson(decksPath);
/** @type {Record<string, string>} */
const ids = existsSync(idsPath) ? readJson(idsPath) : {};
const previous = existsSync(bankPath) ? readJson(bankPath) : null;
const previousById = new Map((previous?.questions ?? []).map((q) => [q.id, q]));

/** 讀一份講義：回傳依投影片順序的 { slide, question }（只有題目投影片） */
function readDeck(deck) {
  const path = join(srcDir, deck.file);
  if (!existsSync(path)) throw new Error(`handout:extract：找不到講義 ${path}（用 --src 指到講義資料夾，或把檔案放進 references/handouts/）`);
  const zip = readZipTexts(
    readFileSync(path),
    (n) => n === 'ppt/presentation.xml' || n === 'ppt/_rels/presentation.xml.rels' || /^ppt\/slides\/slide\d+\.xml$/.test(n),
  );
  const order = slideOrder(zip.get('ppt/presentation.xml') ?? '', zip.get('ppt/_rels/presentation.xml.rels') ?? '');
  const out = [];
  const errors = [];
  order.forEach((file, i) => {
    const xml = zip.get(file);
    if (xml === undefined) {
      errors.push(`第 ${i + 1} 張（${file}）在 zip 裡找不到`);
      return;
    }
    try {
      const q = extractQuestion(parseSlide(xml));
      if (q) out.push({ slide: i + 1, question: q });
    } catch (e) {
      errors.push(`第 ${i + 1} 張：${e instanceof Error ? e.message : String(e)}`);
    }
  });
  if (errors.length) throw new Error(`handout:extract：${deck.id}（${deck.file}）有 ${errors.length} 張投影片抽不完整：\n  ${errors.join('\n  ')}`);
  return { deck, slides: order.length, items: out };
}

const pptxDecks = [...decks.decks].filter((d) => handoutSourceOf(d) === 'pptx').sort((a, b) => a.order - b.order);
const csvDecks = decks.decks.filter((d) => handoutSourceOf(d) === 'csv');
const read = pptxDecks.map(readDeck);

// 章節範圍：每一題都要落在所屬講義的某個 section
const sectionOf = (deck, slide) => deck.sections.find((s) => s.slides && slide >= s.slides[0] && slide <= s.slides[1]);
const outOfSection = [];
for (const { deck, items } of read)
  for (const it of items) if (!sectionOf(deck, it.slide)) outOfSection.push(`${deck.id} 第 ${it.slide} 張（${it.question.topic}）`);
if (outOfSection.length) throw new Error(`handout:extract：這些題目不在 decks.json 任何 section 的範圍內：\n  ${outOfSection.join('\n  ')}`);

// 去重與衝突（講義順序：deck.order 再 slide）
/** @typedef {import('./lib/handout-bank.mjs').Rec} Rec */
/** @type {Map<string, Rec>} */
const byKey = new Map();
/** @type {{ keep: Rec; drop: { deck: any; slide: number; question: any } }[]} */
const duplicates = [];
/** @type {[Rec, Rec][]} */
const conflicts = [];
/** @type {Rec[]} */
const records = [];
for (const { deck, items } of read) {
  for (const it of items) {
    const key = dedupeKey(it.question);
    const seen = byKey.get(key);
    if (seen && answerKey(seen.question) === answerKey(it.question)) {
      duplicates.push({ keep: seen, drop: { deck, ...it } });
      continue;
    }
    /** @type {Rec} */
    const rec = { deck, slide: it.slide, question: it.question, idKey: `${deck.id}:${it.slide}`, exclusion: null };
    if (seen) {
      conflicts.push([seen, rec]);
      seen.exclusion = { reason: 'conflicting_answer', relatedKeys: [rec.idKey] };
      rec.exclusion = { reason: 'conflicting_answer', relatedKeys: [seen.idKey] };
    } else byKey.set(key, rec);
    records.push(rec);
  }
}

// 人工排除（只對 pptx 講義；CSV 講義的 exclusions 會被 schema 擋下）
const manual = decks.exclusions ?? [];
const unmatched = [];
for (const ex of manual) {
  const rec = records.find((r) => r.deck.id === ex.deck && r.slide === ex.slide);
  if (!rec) {
    unmatched.push(`${ex.deck} 第 ${ex.slide} 張`);
    continue;
  }
  const related = (ex.related ?? []).map((r) => `${r.deck}:${r.slide}`);
  if (rec.exclusion && rec.exclusion.reason === 'conflicting_answer' && ex.reason !== 'conflicting_answer') {
    // 自動偵測到答案衝突的題，人工再給別的原因時以衝突為主，note 與相關題保留
    rec.exclusion.note = ex.note;
    rec.exclusion.relatedKeys.push(...related);
    continue;
  }
  rec.exclusion = { reason: ex.reason, note: ex.note, relatedKeys: [...(rec.exclusion?.relatedKeys ?? []), ...related] };
}
if (unmatched.length) throw new Error(`handout:extract：decks.json 的 exclusions 指到的投影片不是題目：${unmatched.join('、')}`);
for (const rec of records) {
  if (!rec.exclusion) continue;
  const missing = rec.exclusion.relatedKeys.filter((k) => !records.some((r) => r.idKey === k));
  if (missing.length) throw new Error(`handout:extract：${rec.deck.id} 第 ${rec.slide} 張的相關題指到不是題目的投影片：${missing.join('、')}`);
}

// ID 先全部配好（相關題可能在後面的講義），再組題目、合併（CSV 講義的題原樣保留）
const newIds = assignIds(records, ids);
const questions = buildQuestions(records, ids, previousById, (rec) => sectionOf(rec.deck, rec.slide).id);
const { bank } = mergeBank(previous, decks, new Set(pptxDecks.map((d) => d.id)), questions);

// 報告
const included = questions.filter((q) => q.status === 'included');
const excluded = questions.filter((q) => q.status === 'excluded');
const checks = questions.filter((q) => q.status === 'included' && q.exclusion);
const keptCsv = bank.questions.filter((q) => csvDecks.some((d) => d.id === q.deck));
const lines = [
  '# 講義題庫抽題報告',
  '',
  `- 來源資料夾：${srcDir}`,
  `- 題目投影片：${questions.length + duplicates.length} 張；收錄 ${included.length} 題（其中請老師確認 ${checks.length} 題）、不收 ${excluded.length} 題、合併重複 ${duplicates.length} 題`,
  `- 新產生的 ID：${newIds.length} 個；題庫 rev ${bank.rev}${previous ? `（上一次 ${previous.rev}）` : ''}`,
  ...(csvDecks.length ? [`- CSV 講義（${csvDecks.map((d) => d.id).join('、')}）的 ${keptCsv.length} 題原樣保留，要更新請跑 handout:import`] : []),
  '',
  '## 各講義',
  '',
  ...read.map(({ deck, slides, items }) => `- ${deck.id} ${deck.title}：${slides} 張投影片、${items.length} 題`),
  '',
  '## 各段',
  '',
  ...read.flatMap(({ deck }) =>
    deck.sections.map((s) => {
      const n = questions.filter((q) => q.deck === deck.id && q.section === s.id).length;
      return `- ${deck.id} ${s.id} ${s.title}（第 ${s.slides[0]} 到 ${s.slides[1]} 張）：${n} 題`;
    }),
  ),
  '',
  '## 合併的重複題',
  '',
  ...(duplicates.length
    ? duplicates.map(
        (d) => `- ${d.drop.deck.id} 第 ${d.drop.slide} 張 和 ${d.keep.deck.id} 第 ${d.keep.slide} 張相同（${d.keep.question.topic}），留前者以外的那一題`,
      )
    : ['- 沒有']),
  '',
  '## 答案不同的同一題（都不收）',
  '',
  ...(conflicts.length
    ? conflicts.map(
        ([a, b]) =>
          `- ${a.deck.id} 第 ${a.slide} 張答 ${answerKey(a.question)}，${b.deck.id} 第 ${b.slide} 張答 ${answerKey(b.question)}（${a.question.topic}）`,
      )
    : ['- 沒有']),
  '',
  '## 人工排除與請老師確認',
  '',
  ...(manual.length ? manual.map((ex) => `- ${ex.deck} 第 ${ex.slide} 張：${ex.reason}，${ex.note ?? ''}`) : ['- 沒有']),
  '',
  '## 各題的主題（講義順序）',
  '',
  ...questions.map(
    (q) =>
      `- ${q.deck} 第 ${q.slide} 張（${q.section}）${q.status === 'excluded' ? '【不收】' : q.exclusion ? '【請老師確認】' : ''}：${q.topic}，解答 ${q.answer.join('/')}`,
  ),
  '',
];

if (dryRun) {
  console.log(lines.join('\n'));
} else {
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(join(reportDir, 'report.md'), lines.join('\n'));
  writeFileSync(bankPath, JSON.stringify(bank, null, 2) + '\n');
  writeFileSync(idsPath, JSON.stringify(Object.fromEntries(Object.entries(ids).sort(([a], [b]) => a.localeCompare(b))), null, 2) + '\n');
  console.log(
    `handout:extract：收錄 ${included.length} 題（請老師確認 ${checks.length}）、不收 ${excluded.length} 題、合併重複 ${duplicates.length} 題；${newIds.length} 個新 ID；報告在 .local-reports/handout/report.md`,
  );
}
