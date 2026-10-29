// 實驗（launch-flash-fix-variants 分支，不合併）：修正版（App 模式先不開玻璃）在實機還是閃，R13 不閃；兩者差在 R1 到 R6 累積的改動。
// 這裡在建置後把其中一項加回修正版：VARIANT=block 入口樣式表改回擋繪製（連結保留 data-ll，boot 載完照樣標 data-css）
import { readFileSync, writeFileSync } from 'node:fs';
const VARIANT = process.env.LL_EXP_VARIANT ?? 'none';
const dist = new URL('../dist/', import.meta.url);
let html = readFileSync(new URL('index.html', dist), 'utf8');
if (VARIANT === 'block') {
  const before = html;
  html = html.replace(/<link rel="preload" as="style" crossorigin href="([^"]+)">\s*<link rel="stylesheet" media="print" data-ll="entry-css" crossorigin href="\1">/, '<link rel="stylesheet" data-ll="entry-css" crossorigin href="$1">');
  if (html === before) throw new Error('exp-fix: 樣式表連結沒換到');
}
writeFileSync(new URL('index.html', dist), html);
console.log('exp-fix: VARIANT ' + VARIANT);
