// ContentAdapter 的 files 實作（08 第 7.2 節）：讀 content/ 的檔案並轉成正規化模型；每筆附來源位置。不做判斷。
// M1 起除了 terms、chapters，也讀 templates、stories、questions。交易範本不在 content/，而是核心的內建資料
// packages/core/data/templates/*.json（04 第 7 節）；content/questions/ 還沒有時回傳空陣列，仍視為「有題目清單」。
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './fs.mjs';

/** 讀一個資料夾裡的所有 JSON；rel 是相對 repo 根目錄的路徑（也是錯誤訊息裡的檔案欄位的前綴） */
function readDir(rel) {
  const dir = join(ROOT, rel);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const file = `${rel}/${f}`;
      try {
        return { file, data: JSON.parse(readFileSync(join(dir, f), 'utf8')) };
      } catch (e) {
        return { file, data: null, error: String(e) };
      }
    });
}

export const TEMPLATES_DIR = 'packages/core/data/templates';

export function loadContentFiles() {
  const bundle = {
    terms: readDir('content/terms'),
    chapters: readDir('content/chapters'),
    templates: readDir(TEMPLATES_DIR),
    stories: readDir('content/stories'),
    questions: readDir('content/questions'),
  };
  for (const list of Object.values(bundle)) for (const x of list) if (x.error) console.error(`content：${x.file} 不是合法的 JSON：${x.error}`);
  return bundle;
}
