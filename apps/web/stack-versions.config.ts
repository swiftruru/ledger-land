// 幕後頁技術棧的版本號（02 第 1.1 節的 /credits/）：建置時從套件清單抄，不手寫，才不會像規劃文件那樣過期。
// 只給 Vite 設定（Node）與 vitest 設定用；用戶端經 define 的 __LL_STACK_VERSIONS__ 拿到一份純資料。
// 清單裡的套件找不到就讓建置失敗：換掉或拿掉某個套件時，幕後頁的節點要跟著改（features/credits/stack.ts）。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** 要列在幕後頁的套件；pnpm 從 packageManager 讀，node 從 devEngines 讀 */
export const STACK_PACKAGES = [
  'react',
  'react-router',
  '@lingui/core',
  'zustand',
  'idb',
  'zod',
  'workbox-window',
  '@zxing/library',
  '@phosphor-icons/core',
  'vite',
  'vite-plugin-pwa',
  'lightningcss',
  'wrangler',
  'typescript',
  'vitest',
  '@playwright/test',
  'lighthouse',
  'oxlint',
  'prettier',
] as const;

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  packageManager?: string;
  devEngines?: { runtime?: { name?: string; version?: string } };
};

function readJson(url: URL): PackageJson {
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as PackageJson;
}

/** 釘版的版本字串去掉範圍符號（專案一律釘死，這裡只是保險） */
function bare(v: string): string {
  return v.replace(/^[\^~=v]+/, '');
}

export function readStackVersions(): Record<string, string> {
  const app = readJson(new URL('./package.json', import.meta.url));
  const root = readJson(new URL('../../package.json', import.meta.url));
  const all: Record<string, string> = { ...root.devDependencies, ...root.dependencies, ...app.devDependencies, ...app.dependencies };
  const out: Record<string, string> = {};
  for (const name of STACK_PACKAGES) {
    const v = all[name];
    if (v === undefined) throw new Error(`stack-versions：套件清單裡找不到 ${name}，幕後頁的技術棧（features/credits/stack.ts）要跟著更新`);
    out[name] = bare(v);
  }
  const pm = root.packageManager ?? '';
  if (!pm.startsWith('pnpm@')) throw new Error('stack-versions：根 package.json 的 packageManager 不是 pnpm@<版本>');
  out['pnpm'] = pm.slice('pnpm@'.length);
  const node = root.devEngines?.runtime?.name === 'node' ? root.devEngines.runtime.version : undefined;
  if (node === undefined) throw new Error('stack-versions：根 package.json 的 devEngines 沒有 node 的版本');
  out['node'] = node;
  return out;
}
