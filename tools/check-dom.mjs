// 純 TypeScript 套件的 DOM 禁用檢查（09 第 8.3 節）：web-ui 以外的 packages/* 的 tsconfig lib 不列 DOM，src 也不匯入 react、react-dom、vite、node:*
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, fail, walk } from './lib/fs.mjs';

const pkgsDir = join(ROOT, 'packages');
const pure = readdirSync(pkgsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== 'web-ui')
  .map((e) => e.name);
let ok = true;
for (const name of pure) {
  const tsconfigPath = join(pkgsDir, name, 'tsconfig.json');
  if (!existsSync(tsconfigPath)) continue;
  const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf8'));
  const lib = tsconfig.compilerOptions?.lib ?? [];
  if (lib.some((l) => /^dom/i.test(l))) {
    fail(`check:dom：packages/${name} 的 tsconfig lib 含 DOM：${lib.join(', ')}`);
    ok = false;
  }
  if (tsconfig.compilerOptions?.jsx) {
    fail(`check:dom：packages/${name} 的 tsconfig 設了 jsx`);
    ok = false;
  }
  const srcDir = join(pkgsDir, name, 'src');
  if (!existsSync(srcDir)) continue;
  for (const f of walk(srcDir, { ext: ['.ts', '.tsx'] })) {
    // 先去掉註解（JSDoc 裡提到 navigator.languages 之類的說明不算使用）
    const text = readFileSync(f, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:'"])\/\/[^\n]*/g, '$1');
    for (const m of text.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const spec = m[1];
      if (/^(react|react-dom|vite)(\/|$)/.test(spec) || spec.startsWith('node:')) {
        fail(`check:dom：${f.replace(ROOT + '/', '')} 匯入了 ${spec}`);
        ok = false;
      }
    }
    if (/\b(document|window|localStorage|navigator)\b\s*\./.test(text)) {
      fail(`check:dom：${f.replace(ROOT + '/', '')} 直接使用 DOM 全域物件`);
      ok = false;
    }
  }
}
if (ok) console.log(`check:dom：純 TypeScript 套件（${pure.join('、')}）沒有 DOM、React、Vite 或 Node 專屬 API`);
