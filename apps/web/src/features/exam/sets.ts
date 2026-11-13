// 期中考苦練的題組（M4c）：由 manifest.handouts 的小索引組出來，不必載題庫。
// 題組 ID：all（全部）、wrong（這台裝置上一次答錯的）、unsure（練過但還沒連對兩次的，M4c 第二批）、講義 ID（d1）、段 ID（d1s2）、
// formula:<公式 ID>（一條會計公式的相關講義題，2026-11-07；題目清單來自公式索引，依講義順序）。
// teacher、list、browse、mock 是苦練區其他頁面的路由，不是題組。
import type { FormulaIndexEntry, HandoutDeckEntry, HandoutManifestEntry } from '../../lib/content.ts';

export interface ExamSet {
  id: string;
  kind: 'all' | 'wrong' | 'unsure' | 'deck' | 'section' | 'formula';
  deckIds: string[];
  questionIds: string[];
  /** 講義或段的標題、公式的名稱（all、wrong 與 unsure 由頁面自己翻譯） */
  title?: string;
  deck?: HandoutDeckEntry;
  /** formula 題組：公式 ID（回公式頁用） */
  formulaId?: string;
}

const FORMULA_SET_RE = /^formula:(fm_[0-9a-hjkmnp-tv-z]{8})$/;
export const formulaIdOfSet = (id: string): string | null => FORMULA_SET_RE.exec(id)?.[1] ?? null;
export const isSetId = (id: string): boolean =>
  id === 'all' || id === 'wrong' || id === 'unsure' || /^d[1-9]\d*(s[1-9]\d*)?$/.test(id) || FORMULA_SET_RE.test(id);

/** 會變動的題組：題目是依這台裝置的紀錄挑的（wrong、unsure），每答一題都可能變。這種題組每次進來都重新出題，不沿用存下來的一輪
 *  （2026-11-13：沿用的話，錯題練習裡再答錯的題下次進來會被跳過，或只看到上一輪的總結卡） */
export const isDynamicSet = (id: string): boolean => id === 'wrong' || id === 'unsure';

/** 依這台裝置的紀錄挑出來的兩組題（stats.ts 的 picksOf） */
export interface SetPicks {
  wrongIds: ReadonlySet<string>;
  unsureIds: ReadonlySet<string>;
}

/** 講義順序的全部題目 ID */
export function allQuestionIds(index: HandoutManifestEntry): string[] {
  return [...index.decks].sort((a, b) => a.order - b.order).flatMap((d) => d.sections.flatMap((s) => s.questionIds));
}

/**
 * @param formulas 公式索引（formula 題組才用得到；沒傳時 formula 題組回 null）
 */
export function resolveSet(index: HandoutManifestEntry, setId: string, picks: SetPicks, formulas?: readonly FormulaIndexEntry[]): ExamSet | null {
  const decks = [...index.decks].sort((a, b) => a.order - b.order);
  if (setId === 'all') return { id: setId, kind: 'all', deckIds: decks.map((d) => d.id), questionIds: allQuestionIds(index) };
  const formulaId = formulaIdOfSet(setId);
  if (formulaId !== null) {
    const formula = formulas?.find((f) => f.id === formulaId);
    if (!formula) return null;
    const wanted = new Set(formula.questionIds);
    const ids = allQuestionIds(index).filter((id) => wanted.has(id));
    const deckIds = decks.filter((d) => d.sections.some((s) => s.questionIds.some((id) => wanted.has(id)))).map((d) => d.id);
    return { id: setId, kind: 'formula', deckIds, questionIds: ids, title: formula.label, formulaId };
  }
  if (setId === 'wrong' || setId === 'unsure') {
    const picked = setId === 'wrong' ? picks.wrongIds : picks.unsureIds;
    const ids = allQuestionIds(index).filter((id) => picked.has(id));
    const deckIds = decks.filter((d) => d.sections.some((s) => s.questionIds.some((id) => picked.has(id)))).map((d) => d.id);
    return { id: setId, kind: setId, deckIds, questionIds: ids };
  }
  for (const d of decks) {
    if (d.id === setId) return { id: setId, kind: 'deck', deckIds: [d.id], questionIds: d.sections.flatMap((s) => s.questionIds), title: d.title, deck: d };
    const s = d.sections.find((x) => x.id === setId);
    if (s) return { id: setId, kind: 'section', deckIds: [d.id], questionIds: s.questionIds, title: s.title, deck: d };
  }
  return null;
}
