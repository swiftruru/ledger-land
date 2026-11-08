// 台灣用語與破折號掃描（09 第 10.2 節的 lint 工作）：docs、content、兩份 Lingui catalog、README 等。
// 破折號（em dash、en dash、全形「—」）一律不允許；常見的非台灣用語列為錯誤。英文介面字串與內容用英式拼字（D11）。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, fail, walk } from './lib/fs.mjs';
import { DASH_RE as DASH, NON_TW_WORDS as NON_TW, NON_TW_WITH_EXCEPTIONS, isDiscussing } from './lib/tw-style.mjs';

// 用語對照表在 lib/tw-style.mjs（Excel 匯入也用同一份）
const US_SPELLING = [/\bcolor\b/i, /\borganization\b/i, /\banalyze\b/i, /\bcenter\b/i, /\bfavorite\b/i, /\blicense\b(?!d)/];
/** 英式拼字只檢查介面字串的 en catalog 與 content 的 en 欄位；程式碼裡的 color 等屬性名不算 */
const targets = [
  ...walk(join(ROOT, 'docs'), { ext: ['.md'] }).filter((f) => !/01-materials|13-material-questions|15-ai-workflow/.test(f)),
  // 講義題庫 content/handout/（14 第 5.2 節，2026-11-04）：老師授權的講義原文逐字保留，不套站規的用語與破折號；那個資料夾的 README 與設定檔仍照站規
  ...walk(join(ROOT, 'content'), { ext: ['.json', '.md'] }).filter((f) => !/\/content\/handout\/(midterm|ids)\.json$/.test(f)),
  ...walk(join(ROOT, 'packages/core/data'), { ext: ['.json'] }),
  join(ROOT, 'README.md'),
  join(ROOT, 'CONTRIBUTING.md'),
  join(ROOT, 'SECURITY.md'),
  join(ROOT, 'NOTICE'),
  join(ROOT, 'apps/web/src/locales/zh-TW/messages.po'),
  join(ROOT, 'apps/web/src/locales/en/messages.po'),
  join(ROOT, 'apps/web/src/locales/zh-TW/pages.po'),
  join(ROOT, 'apps/web/src/locales/en/pages.po'),
  join(ROOT, 'apps/web/src/locales/zh-TW/lab.po'),
  join(ROOT, 'apps/web/src/locales/en/lab.po'),
  join(ROOT, 'packages/web-ui/src/locales/zh-TW/messages.po'),
  join(ROOT, 'packages/web-ui/src/locales/en/messages.po'),
  ...walk(join(ROOT, 'apps/web/src'), { ext: ['.tsx', '.ts'] }),
  ...walk(join(ROOT, 'packages/web-ui/src'), { ext: ['.tsx', '.ts'] }),
];
let ok = true;
let scanned = 0;
for (const f of targets) {
  let text;
  try {
    text = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  scanned++;
  const rel = f.replace(ROOT + '/', '');
  text.split('\n').forEach((line, i) => {
    if (DASH.test(line)) {
      fail(`check:tw：${rel}:${i + 1} 有破折號`);
      ok = false;
    }
    for (const w of NON_TW)
      if (line.includes(w) && !isDiscussing(line, w)) {
        fail(`check:tw：${rel}:${i + 1} 非台灣用語「${w}」`);
        ok = false;
      }
    for (const { word, allow } of NON_TW_WITH_EXCEPTIONS) {
      let stripped = line;
      for (const a of allow) stripped = stripped.split(a).join('');
      if (stripped.includes(word) && !line.includes('使用者') && !line.includes('中國用語')) {
        fail(`check:tw：${rel}:${i + 1} 非台灣用語「${word}」`);
        ok = false;
      }
    }
    if (/locales\/en\/[a-z]+\.po$/.test(f) && line.startsWith('msgstr')) {
      for (const re of US_SPELLING)
        if (re.test(line)) {
          fail(`check:tw：${rel}:${i + 1} 英文介面字串請用英式拼字：${line.trim()}`);
          ok = false;
        }
    }
    if (/(content|packages\/core\/data)\/.*\.json$/.test(f) && /"en":\s*"/.test(line)) {
      for (const re of US_SPELLING)
        if (re.test(line)) {
          fail(`check:tw：${rel}:${i + 1} 英文內容請用英式拼字：${line.trim().slice(0, 80)}`);
          ok = false;
        }
    }
  });
}
if (ok) console.log(`check:tw：${scanned} 個檔案沒有破折號與非台灣用語`);
