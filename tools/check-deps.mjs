// 依賴方向檢查（09 第 8.2 節）：各套件 package.json 的 workspace 依賴只能往下、不能循環，packages/ 與 tools/ 永遠不引用 apps/
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, fail, readJson } from './lib/fs.mjs';

/** 允許的內部依賴（09 第 8.2 節）；還沒建立的套件也先寫好，建立時只要照表 */
const ALLOWED = {
  '@ledgerland/tokens': [],
  '@ledgerland/i18n': [],
  '@ledgerland/content-schema': ['@ledgerland/i18n'],
  '@ledgerland/core': ['@ledgerland/content-schema', '@ledgerland/i18n'],
  '@ledgerland/quiz': ['@ledgerland/core', '@ledgerland/content-schema', '@ledgerland/i18n'],
  '@ledgerland/progress': ['@ledgerland/quiz', '@ledgerland/content-schema'],
  '@ledgerland/web-ui': ['@ledgerland/tokens', '@ledgerland/quiz', '@ledgerland/core', '@ledgerland/content-schema', '@ledgerland/i18n'],
  '@ledgerland/web': ['*'],
  '@ledgerland/admin': ['@ledgerland/web-ui', '@ledgerland/quiz', '@ledgerland/core', '@ledgerland/content-schema', '@ledgerland/i18n', '@ledgerland/tokens'],
  '@ledgerland/mobile': [
    '@ledgerland/tokens',
    '@ledgerland/i18n',
    '@ledgerland/content-schema',
    '@ledgerland/core',
    '@ledgerland/quiz',
    '@ledgerland/progress',
  ],
  '@ledgerland/tools': ['@ledgerland/content-schema', '@ledgerland/core', '@ledgerland/quiz', '@ledgerland/i18n', '@ledgerland/tokens'],
};

function subdirs(d) {
  if (!existsSync(d)) return [];
  return readdirSync(d, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => join(d, e.name));
}
const dirs = [...subdirs(join(ROOT, 'apps')), ...subdirs(join(ROOT, 'packages')), join(ROOT, 'tools')];
const pkgs = new Map();
for (const dir of dirs) {
  const p = join(dir, 'package.json');
  if (!existsSync(p)) continue;
  const pkg = readJson(p);
  pkgs.set(pkg.name, { dir, pkg });
}
const isApp = (dir) => dir.startsWith(join(ROOT, 'apps') + '/');

let ok = true;
for (const [name, { dir, pkg }] of pkgs) {
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies }).filter((n) => n.startsWith('@ledgerland/'));
  const allowed = ALLOWED[name];
  if (!allowed) {
    fail(`check:deps：${name}（${dir.replace(ROOT + '/', '')}）不在 09 第 8.2 節的依賴方向表裡，請先補表`);
    ok = false;
    continue;
  }
  for (const dep of deps) {
    const target = pkgs.get(dep);
    if (target && isApp(target.dir) && !isApp(dir)) {
      fail(`check:deps：${name} 引用了 apps/ 底下的 ${dep}（packages/ 與 tools/ 永遠不引用 apps/）`);
      ok = false;
    }
    if (!allowed.includes('*') && !allowed.includes(dep)) {
      fail(`check:deps：${name} 不得依賴 ${dep}（允許：${allowed.join('、') || '無'}）`);
      ok = false;
    }
  }
}
// 循環：以實際的依賴圖做 DFS
const graph = new Map([...pkgs].map(([n, { pkg }]) => [n, Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter((x) => pkgs.has(x))]));
const state = new Map();
const dfs = (n, stack) => {
  if (state.get(n) === 1) {
    fail(`check:deps：循環依賴 ${[...stack, n].join(' -> ')}`);
    ok = false;
    return;
  }
  if (state.get(n) === 2) return;
  state.set(n, 1);
  for (const m of graph.get(n) ?? []) dfs(m, [...stack, n]);
  state.set(n, 2);
};
for (const n of graph.keys()) dfs(n, []);
if (ok) console.log(`check:deps：${pkgs.size} 個套件的依賴方向正確，沒有循環`);
