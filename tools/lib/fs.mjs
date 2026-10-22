// tools 共用的小工具：repo 根目錄、讀 JSON、列出檔案
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * 遞迴列出檔案；skip 是要略過的資料夾名稱，ext 是要保留的副檔名
 * @param {string} dir
 * @param {{ skip?: string[]; ext?: string[] }} [options]
 * @returns {string[]}
 */
export function walk(
  dir,
  {
    skip = ['node_modules', '.git', '.pnpm-store', '.cache', 'dist', 'prototypes', 'references', '.wrangler', 'coverage', 'playwright-report', 'test-results'],
    ext,
  } = {},
) {
  const out = [];
  const rec = (d) => {
    for (const name of readdirSync(d)) {
      if (skip.includes(name)) continue;
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) rec(p);
      else if (!ext || ext.some((e) => p.endsWith(e))) out.push(p);
    }
  };
  rec(dir);
  return out;
}

export function fail(msg) {
  console.error(msg);
  process.exitCode = 1;
}
