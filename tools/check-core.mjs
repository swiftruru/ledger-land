// check:core（10 第 8 節 M1 完成標準）：packages/core 的原始碼不得含 eval、new Function、動態程式碼執行，
// 也不得使用 Date、Math.random、Intl、setTimeout 等讓結果不決定或依環境的 API（04 第 1 節的純函式原則）。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, fail, walk } from './lib/fs.mjs';

const srcDir = join(ROOT, 'packages/core/src');
/** @type {{ re: RegExp; name: string }[]} */
const RULES = [
  { re: /\beval\s*\(/, name: 'eval' },
  { re: /\bnew\s+Function\b/, name: 'new Function' },
  { re: /\bFunction\s*\(/, name: 'Function()' },
  { re: /\bnew\s+Date\b|\bDate\.now\b/, name: 'Date' },
  { re: /\bMath\.random\b/, name: 'Math.random' },
  { re: /\bIntl\./, name: 'Intl' },
  { re: /\bsetTimeout\b|\bsetInterval\b|\bqueueMicrotask\b/, name: '計時器' },
  { re: /\bimport\s*\(/, name: '動態 import' },
];
let ok = true;
let files = 0;
for (const f of walk(srcDir, { ext: ['.ts'] })) {
  files++;
  // 去掉註解後再比對，說明文字裡提到這些字不算
  const text = readFileSync(f, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"])\/\/[^\n]*/g, '$1');
  for (const { re, name } of RULES) {
    if (re.test(text)) {
      fail(`check:core：${f.replace(ROOT + '/', '')} 使用了 ${name}（核心必須是純函式，04 第 1 節）`);
      ok = false;
    }
  }
}
if (ok) console.log(`check:core：packages/core/src 的 ${files} 個檔案沒有 eval、new Function、Date、Math.random、Intl 或計時器`);
