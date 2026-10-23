// 只在本機執行的相似度檢查（08 第 1.5 節）：用 n-gram 比對 content/ 的題幹、選項、解說等文字與教材文字。輔助人工判斷，不是自動放行或擋下。
// 用法：node tools/local/originality-check.mjs [--materials <txt>] [--threshold 0.2] [--no-pdf]
// 教材文字的來源（依序）：--materials 指定的純文字檔；否則環境有 pdftotext 時把 references/ 底下的 PDF 文字層擷取到
// .local-reports/originality/source/*.txt；否則讀 .local-reports/originality/materials.txt（由人工先放入）。references/ 與
// materials.txt 都不存在時直接結束並說明原因。CI 不執行這支腳本；輸出只寫到 .local-reports/originality/（gitignored），
// 教材文字與重疊片段只出現在 report.json，stdout 只印分數與位置。
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { loadContentFiles } from '../lib/content-files.mjs';
import { ROOT } from '../lib/fs.mjs';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const threshold = Number(opt('threshold') ?? '0.2');
const outDir = join(ROOT, '.local-reports/originality');
const sourceDir = join(outDir, 'source');
const referencesDir = process.env.LL_REFERENCES_DIR ?? join(ROOT, 'references');
mkdirSync(sourceDir, { recursive: true });

/** 正規化（08 第 1.5 節）：NFKC、去空白與標點、數字換成同一個記號 */
export function normalise(text) {
  return text
    .normalize('NFKC')
    .replace(/\d+(?:[.,]\d+)*/g, '#')
    .replace(/[\s\p{P}\p{S}]+/gu, '')
    .toLowerCase();
}
const isCjk = (ch) => /\p{Script=Han}/u.test(ch);
export const CJK_N = 8;
export const WORD_N = 6;

/** 中文字元 n-gram 與英文詞 n-gram 的集合 */
export function ngrams(text) {
  const out = new Set();
  const norm = normalise(text);
  const cjk = [...norm].filter(isCjk).join('');
  for (let i = 0; i + CJK_N <= cjk.length; i++) out.add(`c:${cjk.slice(i, i + CJK_N)}`);
  const words = text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\d+(?:[.,]\d+)*/g, '#')
    .split(/[^a-z#']+/)
    .filter(Boolean);
  for (let i = 0; i + WORD_N <= words.length; i++) out.add(`w:${words.slice(i, i + WORD_N).join(' ')}`);
  return out;
}

/** 題目文字被教材覆蓋的比例；另找出最長的連續重疊（從命中的 n-gram 往後延伸） */
export function compare(text, materialGrams, materialNorm) {
  const grams = ngrams(text);
  if (grams.size === 0) return { ngrams: 0, matched: 0, coverage: 0, longestRun: '', fragments: [] };
  const hits = [...grams].filter((g) => materialGrams.has(g));
  const fragments = [];
  let longestRun = '';
  const cjk = [...normalise(text)].filter(isCjk).join('');
  for (let i = 0; i + CJK_N <= cjk.length; i++) {
    const seed = cjk.slice(i, i + CJK_N);
    if (!materialGrams.has(`c:${seed}`)) continue;
    let j = i + CJK_N;
    while (j < cjk.length && materialNorm.includes(cjk.slice(i, j + 1))) j++;
    const run = cjk.slice(i, j);
    if (run.length > longestRun.length) longestRun = run;
    if (fragments.length < 5 && !fragments.some((f) => f.includes(run))) fragments.push(run);
    i = j - CJK_N;
  }
  return {
    ngrams: grams.size,
    matched: hits.length,
    coverage: hits.length / grams.size,
    longestRun,
    fragments: [...fragments, ...hits.filter((h) => h.startsWith('w:')).slice(0, 5)],
  };
}

function loadMaterials() {
  const explicit = opt('materials');
  if (explicit) return { label: explicit, text: readFileSync(explicit, 'utf8') };
  const noPdf = args.includes('--no-pdf');
  if (!noPdf && existsSync(referencesDir)) {
    let pdftotext = null;
    try {
      execFileSync('pdftotext', ['-v'], { stdio: 'ignore' });
      pdftotext = 'pdftotext';
    } catch {
      /* 沒有 poppler */
    }
    if (pdftotext) {
      const pdfs = [];
      const walk = (d) => {
        for (const name of readdirSync(d)) {
          const p = join(d, name);
          if (statSync(p).isDirectory()) walk(p);
          else if (name.toLowerCase().endsWith('.pdf')) pdfs.push(p);
        }
      };
      walk(referencesDir);
      const parts = [];
      for (const pdf of pdfs) {
        const txt = join(sourceDir, `${basename(pdf, '.pdf')}.txt`);
        if (!existsSync(txt) || statSync(txt).mtimeMs < statSync(pdf).mtimeMs) execFileSync(pdftotext, ['-layout', pdf, txt], { stdio: 'ignore' });
        parts.push(readFileSync(txt, 'utf8'));
      }
      if (parts.length > 0)
        return { label: `${referencesDir} 的 ${pdfs.length} 份 PDF（文字層擷取在 .local-reports/originality/source/）`, text: parts.join('\n') };
    }
  }
  const fallback = join(outDir, 'materials.txt');
  if (existsSync(fallback)) return { label: fallback, text: readFileSync(fallback, 'utf8') };
  return null;
}

/** content/ 裡給學生看的文字：題幹、敘述、選項、回饋、解說、提示、觀點；名詞的定義、範例、迷思；故事敘述 */
function contentTexts(bundle) {
  const out = [];
  const push = (file, path, lt) => {
    if (!lt || typeof lt !== 'object') return;
    for (const [locale, text] of Object.entries(lt)) if (typeof text === 'string') out.push({ file, path: `${path}.${locale}`, text });
  };
  for (const q of bundle.questions) {
    const d = q.data;
    if (!d) continue;
    for (const k of ['prompt', 'statement', 'explanation', 'hint', 'viewpoint', 'feedbackTrue', 'feedbackFalse'])
      if (d[k] && typeof d[k] === 'object') push(q.file, k, d[k]);
    (d.options ?? []).forEach((o, i) => {
      for (const k of ['text', 'short', 'feedback', 'upside', 'downside']) push(q.file, `options.${i}.${k}`, o[k]);
    });
    (d.items ?? []).forEach((it, i) => push(q.file, `items.${i}.text`, it.text));
  }
  for (const t of bundle.terms) for (const k of ['definition', 'example', 'misconception', 'note']) push(t.file, k, t.data?.[k]);
  for (const f of bundle.objectives) (f.data?.items ?? []).forEach((o, i) => push(f.file, `items.${i}.statement`, o.statement));
  for (const s of bundle.stories) (s.data?.steps ?? []).forEach((st, i) => push(s.file, `steps.${i}.narrative`, st.narrative));
  for (const c of bundle.chapters) push(c.file, 'summary', c.data?.summary);
  return out;
}

const materials = loadMaterials();
if (materials === null) {
  console.log('originality-check：找不到教材文字（references/ 不存在或沒有 pdftotext，且 .local-reports/originality/materials.txt 不存在），結束');
  process.exit(0);
}
const materialGrams = ngrams(materials.text);
const materialNorm = normalise(materials.text);
const bundle = loadContentFiles();
const items = contentTexts(bundle).map((t) => ({ ...t, ...compare(t.text, materialGrams, materialNorm) }));
items.sort((a, b) => b.coverage - a.coverage || b.longestRun.length - a.longestRun.length);
const flagged = items.filter((i) => i.coverage >= threshold || i.longestRun.length >= 12);
const report = {
  generatedAt: new Date().toISOString(),
  materials: materials.label,
  method: {
    cjkCharNgram: CJK_N,
    enWordNgram: WORD_N,
    threshold,
    note: '覆蓋比例 = 內容文字的 n-gram 有多少比例出現在教材；fragments 與 longestRun 是教材文字，只留在本機',
  },
  summary: { texts: items.length, flagged: flagged.length, materialNgrams: materialGrams.size },
  flagged,
  all: items.map(({ fragments: _f, ...rest }) => rest),
};
writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(`originality-check：教材來源 ${materials.label}`);
console.log(
  `originality-check：比對 ${items.length} 段文字，${flagged.length} 段超過門檻（覆蓋 ${threshold} 或連續重疊 12 字），報表在 .local-reports/originality/report.json`,
);
for (const i of flagged.slice(0, 20)) console.log(`  ${i.file} ${i.path}：覆蓋 ${(i.coverage * 100).toFixed(0)}%，最長連續重疊 ${i.longestRun.length} 字`);
