// 05 第 3.4 節：對每個 complete 且不是基準語系的語系執行 `lingui check missing --mode catalog --locale <code>`。
// --locale 清單由登錄檔產生，不寫死；beta 語系只產生報表、不讓 CI 失敗。用法：node tools/lingui-missing.mjs <套件目錄>
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { LOCALES, BASE_LOCALE } from '@ledgerland/i18n';
import { ROOT } from './lib/fs.mjs';

const dir = resolve(process.argv[2] ?? '.');
// 直接用套件自己的 node_modules/.bin/lingui（本機的 pnpm 是 shell 函式，spawn 不到）
const bin = [join(dir, 'node_modules/.bin/lingui'), join(ROOT, 'node_modules/.bin/lingui')].find((p) => existsSync(p));
if (!bin) {
  console.error('i18n:check：找不到 lingui，請先 pnpm install');
  process.exit(1);
}
let failed = false;
for (const l of LOCALES) {
  if (l.code === BASE_LOCALE) continue;
  const r = spawnSync(bin, ['check', 'missing', '--mode', 'catalog', '--locale', l.code], { cwd: dir, stdio: 'inherit' });
  if (r.status !== 0) {
    if (l.status === 'complete') {
      console.error(`i18n:check：complete 語系 ${l.code} 有缺字（${dir}）`);
      failed = true;
    } else {
      console.warn(`i18n:check：beta 語系 ${l.code} 有缺字，只記錄不擋（${dir}）`);
    }
  }
}
process.exit(failed ? 1 : 0);
