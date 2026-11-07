// 會計公式總覽的純函式（02 第 1.1 節的 /formulas/，2026-11-07）：分類的順序、搜尋比對、依分類分組。不 import React 或 Lingui；
// 分類的顯示名稱在 useFormulaCategoryLabel.ts。
import type { FormulaIndexEntry } from '../../lib/content.ts';

/** 分類的固定順序：指標登錄檔的分類依講義的六大類與杜邦、部門、市場排，報表關係放最前面（五層利益、恆等式是其他公式的基礎） */
export const FORMULA_CATEGORY_ORDER = [
  'statement',
  'income_structure',
  'profitability',
  'activity',
  'solvency',
  'financial_structure',
  'cash_flow',
  'leverage',
  'dupont',
  'market',
  'department',
] as const;
export type FormulaCategory = (typeof FORMULA_CATEGORY_ORDER)[number];
export const isFormulaCategory = (s: string): s is FormulaCategory => (FORMULA_CATEGORY_ORDER as readonly string[]).includes(s);

/** 搜尋用的正規化：全形英數變半形、空白收成一格、小寫（和背題瀏覽的搜尋同一套想法） */
export const normaliseFormulaQuery = (s: string): string => s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

/** 比名稱、別名、公式一行與另一語系的名稱；空字串每一條都算 */
export function matchesFormulaQuery(entry: FormulaIndexEntry, query: string, altLabel?: string): boolean {
  const q = normaliseFormulaQuery(query);
  if (q === '') return true;
  const fields = [entry.label, entry.formula, altLabel, ...(entry.aliases ?? [])];
  return fields.some((f) => typeof f === 'string' && normaliseFormulaQuery(f).includes(q));
}

export interface FormulaGroup {
  category: FormulaCategory;
  formulas: FormulaIndexEntry[];
}

/** 依分類分組、分類照固定順序、組內照索引的順序（建置時依 ID 排）；不認得的分類併進 statement 之後、空的組不列 */
export function groupFormulas(list: readonly FormulaIndexEntry[], collator: Intl.Collator): FormulaGroup[] {
  const byCategory = new Map<FormulaCategory, FormulaIndexEntry[]>();
  for (const f of list) {
    const c: FormulaCategory = isFormulaCategory(f.category) ? f.category : 'statement';
    if (!byCategory.has(c)) byCategory.set(c, []);
    byCategory.get(c)!.push(f);
  }
  return FORMULA_CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((c) => ({
    category: c,
    formulas: [...byCategory.get(c)!].sort((a, b) => collator.compare(a.label, b.label)),
  }));
}

/** 題目 ID 對相關公式（苦練頁的「相關公式」膠囊用）：順序照公式索引 */
export function formulasOfQuestion(index: readonly FormulaIndexEntry[]): ReadonlyMap<string, FormulaIndexEntry[]> {
  const out = new Map<string, FormulaIndexEntry[]>();
  for (const f of index)
    for (const id of f.questionIds) {
      if (!out.has(id)) out.set(id, []);
      out.get(id)!.push(f);
    }
  return out;
}

/** 總覽頁的返回狀態（條目頁的返回鍵帶回原本的搜尋與分類） */
export interface FormulaReturnState {
  llFormulaSearch?: string;
}
export function formulaReturnSearch(state: unknown): string {
  const s = (state as FormulaReturnState | null)?.llFormulaSearch;
  return typeof s === 'string' ? s : '';
}
export function formulaReturnPath(base: string, search: string): string {
  return search === '' ? base : `${base}?${search}`;
}
