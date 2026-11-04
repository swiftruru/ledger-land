// 講義題庫的讀檔（08 的講義題庫一節）：只讀 content/handout/ 的三個 JSON，和 content-files.mjs 的 loadContentFiles 分開，
// 原創內容的 validateBundle、lock、coverage 與原創性檢查都不會看到它。資料夾不存在時回 null（還沒抽題的 repo 也能建置）。
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateHandout } from '@ledgerland/content-schema';
import { ROOT, readJson } from './fs.mjs';

export const HANDOUT_DIR = 'content/handout';

/**
 * @returns {{ decks: any; ids: any; bank: any } | null}
 */
export function loadHandoutFiles() {
  const dir = join(ROOT, HANDOUT_DIR);
  const paths = { decks: join(dir, 'decks.json'), ids: join(dir, 'ids.json'), bank: join(dir, 'midterm.json') };
  if (!existsSync(paths.decks) && !existsSync(paths.bank)) return null;
  for (const [name, p] of Object.entries(paths)) if (!existsSync(p)) throw new Error(`${HANDOUT_DIR}/ 少了 ${name === 'bank' ? 'midterm' : name}.json`);
  return { decks: readJson(paths.decks), ids: readJson(paths.ids), bank: readJson(paths.bank) };
}

/**
 * 讀檔加驗證；有錯就回 issues（和 validateBundle 同一種形狀），沒有講義題庫時 handout 是 null
 * @returns {{ handout: { decks: any; ids: any; bank: any } | null; issues: import('@ledgerland/content-schema').ContentIssue[] }}
 */
export function loadHandout() {
  const handout = loadHandoutFiles();
  if (!handout) return { handout: null, issues: [] };
  return { handout, issues: validateHandout(handout.decks, handout.ids, handout.bank) };
}
