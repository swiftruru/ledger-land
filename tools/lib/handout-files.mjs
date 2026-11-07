// 講義題庫的讀檔（08 的講義題庫一節）：只讀 content/handout/ 的三個 JSON，和 content-files.mjs 的 loadContentFiles 分開，
// 原創內容的 validateBundle、lock、coverage 與原創性檢查都不會看到它。資料夾不存在時回 null（還沒抽題的 repo 也能建置）。
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { FormulaLinks, HandoutBank, HandoutDecks, HandoutIds, resolveFormulaLinks, validateFormulaLinks, validateHandout } from '@ledgerland/content-schema';
import { ROOT, readJson } from './fs.mjs';

export const HANDOUT_DIR = 'content/handout';

/**
 * @returns {{ decks: any; ids: any; bank: any; links: any } | null} links：講義對照檔 formula-links.json（2026-11-07），沒有時是空的 { links: [] }
 */
export function loadHandoutFiles() {
  const dir = join(ROOT, HANDOUT_DIR);
  const paths = { decks: join(dir, 'decks.json'), ids: join(dir, 'ids.json'), bank: join(dir, 'midterm.json') };
  if (!existsSync(paths.decks) && !existsSync(paths.bank)) return null;
  for (const [name, p] of Object.entries(paths)) if (!existsSync(p)) throw new Error(`${HANDOUT_DIR}/ 少了 ${name === 'bank' ? 'midterm' : name}.json`);
  const linksPath = join(dir, 'formula-links.json');
  return {
    decks: readJson(paths.decks),
    ids: readJson(paths.ids),
    bank: readJson(paths.bank),
    links: existsSync(linksPath) ? readJson(linksPath) : { links: [] },
  };
}

/**
 * 讀檔加驗證；有錯就回 issues（和 validateBundle 同一種形狀），沒有講義題庫時 handout 是 null。
 * formulaIds 是 content/formulas/ 的全部 ID（含草稿），有給才檢查對照檔；三個主檔有錯時不檢查對照檔。
 * 通過時 handout.resolvedLinks 是換成 hq_ ID 的對照（建置用）。
 * @param {{ formulaIds?: ReadonlySet<string> }} [options]
 * @returns {{ handout: { decks: any; ids: any; bank: any; links: any; resolvedLinks: import('@ledgerland/content-schema').ResolvedFormulaLink[] } | null; issues: import('@ledgerland/content-schema').ContentIssue[] }}
 */
export function loadHandout(options = {}) {
  const files = loadHandoutFiles();
  if (!files) return { handout: null, issues: [] };
  const issues = validateHandout(files.decks, files.ids, files.bank);
  /** @type {import('@ledgerland/content-schema').ResolvedFormulaLink[]} */
  let resolvedLinks = [];
  if (issues.length === 0) {
    const decks = HandoutDecks.parse(files.decks);
    const ids = HandoutIds.parse(files.ids);
    const bank = HandoutBank.parse(files.bank);
    issues.push(...validateFormulaLinks(files.links, decks, ids, bank, options.formulaIds ?? new Set()));
    if (issues.length === 0) resolvedLinks = resolveFormulaLinks(FormulaLinks.parse(files.links), decks, ids, bank);
  }
  return { handout: { ...files, resolvedLinks }, issues };
}
