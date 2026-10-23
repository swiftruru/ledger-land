// ContentAdapter 的 files 實作（08 第 7.2 節）：讀 content/ 的檔案並轉成正規化模型；每筆附來源位置。不做判斷。
// 讀 terms、chapters、templates、stories、questions（M1）與 objectives、levels（M2）。交易範本不在 content/，而是核心的內建資料
// packages/core/data/templates/*.json（04 第 7 節）。題目依章節分資料夾 content/questions/<chapterId>/<questionId>.json（08 第 2.3 節），
// 這裡遞迴讀取 content/questions/**/*.json；學習目標一章一檔 content/objectives/<chapterId>.json，data 是 { chapterId, items }。
// 資料夾不存在時回傳空陣列，仍視為「有這份清單」（validateBundle 會檢查引用）。
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './fs.mjs';

/** 讀一個資料夾裡的所有 JSON；rel 是相對 repo 根目錄的路徑（也是錯誤訊息裡的檔案欄位的前綴） */
function readDir(rel, { recursive = false } = {}) {
  const dir = join(ROOT, rel);
  if (!existsSync(dir)) return [];
  /** @type {{ file: string; data: any; error?: string }[]} */
  const out = [];
  const walk = (relDir) => {
    const abs = join(ROOT, relDir);
    for (const name of readdirSync(abs).sort()) {
      const p = join(abs, name);
      if (statSync(p).isDirectory()) {
        if (recursive) walk(`${relDir}/${name}`);
        continue;
      }
      if (!name.endsWith('.json')) continue;
      const file = `${relDir}/${name}`;
      try {
        out.push({ file, data: JSON.parse(readFileSync(p, 'utf8')) });
      } catch (e) {
        out.push({ file, data: null, error: String(e) });
      }
    }
  };
  walk(rel);
  return out;
}

export const TEMPLATES_DIR = 'packages/core/data/templates';
export const CONTENT_DIRS = {
  terms: 'content/terms',
  chapters: 'content/chapters',
  objectives: 'content/objectives',
  levels: 'content/levels',
  questions: 'content/questions',
  stories: 'content/stories',
};

export function loadContentFiles() {
  const bundle = {
    terms: readDir(CONTENT_DIRS.terms),
    chapters: readDir(CONTENT_DIRS.chapters),
    templates: readDir(TEMPLATES_DIR),
    stories: readDir(CONTENT_DIRS.stories),
    questions: readDir(CONTENT_DIRS.questions, { recursive: true }),
    objectives: readDir(CONTENT_DIRS.objectives),
    levels: readDir(CONTENT_DIRS.levels),
  };
  for (const list of Object.values(bundle)) for (const x of list) if (x.error) console.error(`content：${x.file} 不是合法的 JSON：${x.error}`);
  return bundle;
}
