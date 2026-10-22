// 產生 generated/tokens.css（pnpm tokens:build）；--check 時只比對，不一致就以 exit 1 結束（CI）
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateTokensCss } from '../src/css.ts';

const out = fileURLToPath(new URL('../generated/tokens.css', import.meta.url));
const css = generateTokensCss();
if (process.argv.includes('--check')) {
  const current = existsSync(out) ? readFileSync(out, 'utf8') : '';
  if (current !== css) {
    console.error('tokens:check：generated/tokens.css 與 src 不一致，請執行 pnpm tokens:build 並 commit');
    process.exit(1);
  }
  console.log('tokens:check：一致');
} else {
  mkdirSync(fileURLToPath(new URL('../generated/', import.meta.url)), { recursive: true });
  writeFileSync(out, css);
  console.log(`tokens:build：已寫入 ${out}（${css.length} 字元）`);
}
