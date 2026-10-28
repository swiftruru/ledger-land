// THIRD_PARTY_NOTICES.md（11 第 4.4 節）：由 `pnpm licenses list --prod --json` 產生，檢查授權白名單；
// 只有會打包進網站的執行期套件（apps/web 的 prod 依賴圖，含 packages/ 的 dependencies）列入 notices；開發套件另有較寬的白名單只檢查不列入。
// 用法：node tools/licenses.mjs --write | --check
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, fail } from './lib/fs.mjs';

const PROD_ALLOW = ['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD', 'CC0-1.0', 'Unlicense', 'MPL-2.0', 'BlueOak-1.0.0'];
const DEV_ALLOW = [
  ...PROD_ALLOW,
  'CC-BY-4.0',
  'CC-BY-3.0',
  'Python-2.0',
  'LGPL-3.0-or-later',
  'MIT-0',
  'Zlib',
  'WTFPL',
  'Artistic-2.0',
  'AFL-2.1',
  'OFL-1.1',
  'W3C-20150513',
  'Unicode-3.0',
  'Unicode-DFS-2016',
  'Apache-2.0 AND MIT',
  'BSD-3-Clause OR MIT',
  'MIT OR Apache-2.0',
  '(MIT OR Apache-2.0)',
  '(MIT OR CC0-1.0)',
  '(MIT AND Zlib)',
  '(BSD-2-Clause OR MIT OR Apache-2.0)',
  '(MPL-2.0 OR Apache-2.0)',
  '(WTFPL OR MIT)',
  'MIT AND ISC',
  '(MIT AND BSD-3-Clause)',
  'LGPL-3.0',
  'CC-BY-SA-4.0',
];
/** 依套件名稱另外允許的執行期授權（非程式碼的資料套件）：caniuse-lite 是瀏覽器支援資料（CC-BY-4.0），經由 @lingui/core 的 babel 工具鏈進入 prod 依賴圖，建置後不會打包進網站 */
const PROD_PACKAGE_ALLOW = { 'caniuse-lite': 'CC-BY-4.0' };
/** 不是 npm 套件的項目：pnpm devEngines 下載的 Node 執行環境 */
const SKIP = ['node'];
/** 手動補上不經套件管理的項目 */
const MANUAL = [
  { name: 'Phosphor Icons（@phosphor-icons/core 的 SVG 原始檔，建置時內嵌進殼層）', version: '2.1.1', license: 'MIT', homepage: 'https://phosphoricons.com/' },
  {
    name: 'jf open 粉圓（justfont；只在產生啟動畫面「LedgerLand」字樣時把字母轉成 SVG 輪廓，字型檔不隨網站散布）',
    version: '2.1',
    license: 'OFL-1.1',
    homepage: 'https://github.com/justfont/open-huninn-font',
  },
];

function run(args) {
  return JSON.parse(execSync(`pnpm licenses list --json ${args}`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
}
/** 把 pnpm 的輸出（{ license: [pkg...] }）攤平 */
function flatten(json) {
  const out = [];
  for (const [license, pkgs] of Object.entries(json))
    for (const p of pkgs)
      out.push({ name: p.name, versions: p.versions ?? [p.version], license, notice: license, homepage: p.homepage ?? '', author: p.author ?? '' });
  return out.toSorted((a, b) => a.name.localeCompare(b.name));
}
/** SPDX 的 OR 表達式（例如 `(Unlicense OR Apache-2.0)`）：任一成員在白名單內就採用該成員（依白名單順序取第一個）；不是 OR 表達式時回傳原字串 */
function chooseLicense(license, allow) {
  const inner = license.trim().replace(/^\((.*)\)$/, '$1');
  if (!/\sOR\s/.test(inner) || /\sAND\s/.test(inner)) return allow.includes(license) ? license : undefined;
  const members = inner.split(/\sOR\s/).map((m) => m.trim());
  return allow.find((a) => members.includes(a));
}
const prod = flatten(run('--prod --filter @ledgerland/web...')).filter((p) => !SKIP.includes(p.name));
const all = flatten(run(''));
let ok = true;
for (const p of prod) {
  const chosen = chooseLicense(p.license, PROD_ALLOW);
  if (chosen === undefined && PROD_PACKAGE_ALLOW[p.name] !== p.license) {
    fail(`licenses：執行期套件 ${p.name}（${p.license}）不在白名單內，請人工審查`);
    ok = false;
  }
  // notices 註明採用哪一個授權（OR 表達式只需遵守其中一個）
  p.notice = chosen !== undefined && chosen !== p.license ? `${p.license}（採用 ${chosen}）` : p.license;
}
for (const p of all) {
  if (p.name.startsWith('@ledgerland/') || p.name === 'ledger-land' || SKIP.includes(p.name)) continue;
  if (chooseLicense(p.license, DEV_ALLOW) === undefined) {
    fail(`licenses：開發套件 ${p.name}（${p.license}）不在白名單內，請人工審查`);
    ok = false;
  }
}
const lines = [
  '# 第三方授權聲明',
  '',
  '由 `pnpm licenses:build`（`pnpm licenses list --prod --filter @ledgerland/web...`）產生，不要手改；CI 以 `pnpm licenses:check` 重新產生並比對。',
  '只列出學習端的執行期依賴圖裡的套件（含建置後被 tree shaking 拿掉的間接依賴）；只在建置與測試時使用的開發套件另外檢查授權白名單，不列在這裡。字型使用系統字型，不隨網站散布。',
  '',
  '| 套件 | 版本 | 授權 | 首頁 |',
  '| --- | --- | --- | --- |',
  ...prod.filter((p) => !p.name.startsWith('@ledgerland/')).map((p) => `| ${p.name} | ${p.versions.join(', ')} | ${p.notice} | ${p.homepage} |`),
  '',
  '## 不經套件管理的項目',
  '',
  '| 項目 | 版本 | 授權 | 首頁 |',
  '| --- | --- | --- | --- |',
  ...MANUAL.map((p) => `| ${p.name} | ${p.version} | ${p.license} | ${p.homepage} |`),
  '',
];
const text = lines.join('\n');
const out = join(ROOT, 'THIRD_PARTY_NOTICES.md');
if (process.argv.includes('--write')) {
  writeFileSync(out, text);
  console.log(`licenses：已寫入 THIRD_PARTY_NOTICES.md（${prod.length} 個執行期套件）`);
} else {
  const current = existsSync(out) ? readFileSync(out, 'utf8') : '';
  if (current !== text) {
    fail('licenses：THIRD_PARTY_NOTICES.md 與目前的相依套件不一致，請執行 pnpm licenses:build 並 commit');
    ok = false;
  }
}
if (ok) console.log(`licenses：${prod.length} 個執行期套件與 ${all.length} 個套件的授權都在白名單內`);
