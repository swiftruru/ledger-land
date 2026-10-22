// ContentAdapter 的 files 實作（08 第 7.2 節）：讀 content/ 的檔案並轉成正規化模型；每筆附來源位置。不做判斷。
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './fs.mjs';

function readDir(sub) {
  const dir = join(ROOT, 'content', sub);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const file = `content/${sub}/${f}`;
      try {
        return { file, data: JSON.parse(readFileSync(join(dir, f), 'utf8')) };
      } catch (e) {
        return { file, data: null, error: String(e) };
      }
    });
}

export function loadContentFiles() {
  const terms = readDir('terms');
  const chapters = readDir('chapters');
  for (const x of [...terms, ...chapters]) if (x.error) console.error(`content：${x.file} 不是合法的 JSON：${x.error}`);
  return { terms, chapters };
}
