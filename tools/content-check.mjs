// content:check（08 第 5.8 節的 M0b 子集）：讀 content/ 的檔案（ContentAdapter 的 files 實作），交給 packages/content-schema 的 validateBundle，
// 再比對 published.lock.json（已發布 ID 不得消失、rev 不得倒退）。錯誤訊息一律「檔案、JSON 路徑、訊息」。
import { loadContentFiles } from './lib/content-files.mjs';
import { validateBundle } from '@ledgerland/content-schema';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, fail, readJson } from './lib/fs.mjs';

const bundle = loadContentFiles();
const issues = validateBundle(bundle);
for (const i of issues) fail(`content:check：${i.file} ${i.path}：${i.message}`);

// lock 檢查（08 第 4.4 節的最小版本）
const lockPath = join(ROOT, 'content/published.lock.json');
if (existsSync(lockPath)) {
  const lock = readJson(lockPath);
  const current = { terms: new Map(), chapters: new Map() };
  for (const t of bundle.terms) if (t.data?.status === 'published') current.terms.set(t.data.id, t.data.rev);
  for (const c of bundle.chapters) if (c.data?.status === 'published') current.chapters.set(c.data.id, c.data.rev);
  for (const kind of ['terms', 'chapters']) {
    for (const [id, rev] of Object.entries(lock[kind] ?? {})) {
      const now = current[kind].get(id);
      if (now === undefined) {
        const retired = [...bundle[kind]].some((x) => x.data?.id === id && x.data?.status === 'retired');
        if (!retired) fail(`content:check：published.lock.json 的 ${kind} ${id} 已發布，但現在既不是 published 也不是 retired（已發布的 ID 不得消失）`);
      } else if (now < rev) fail(`content:check：${kind} ${id} 的 rev ${now} 比 lock 的 ${rev} 小（rev 只能遞增）`);
    }
    for (const [id, rev] of current[kind]) {
      if (lock[kind]?.[id] === undefined)
        fail(`content:check：${kind} ${id}（rev ${rev}）是 published 但不在 published.lock.json，請執行 content:lock --write（M1）或手動加入`);
    }
  }
}
if (!process.exitCode) console.log(`content:check：${bundle.terms.length} 個名詞、${bundle.chapters.length} 個章節通過`);
