// 期中考苦練的題組（M4c）：由 manifest.handouts 的小索引組出來，不必載題庫。
// 題組 ID：all（全部）、wrong（這台裝置上一次答錯的）、講義 ID（d1）、段 ID（d1s2）。teacher 保留給老師審核頁的路由，不是題組。
import type { HandoutDeckEntry, HandoutManifestEntry } from '../../lib/content.ts';

export interface ExamSet {
  id: string;
  kind: 'all' | 'wrong' | 'deck' | 'section';
  deckIds: string[];
  questionIds: string[];
  /** 講義或段的標題（all 與 wrong 由頁面自己翻譯） */
  title?: string;
  deck?: HandoutDeckEntry;
}

export const isSetId = (id: string): boolean => id === 'all' || id === 'wrong' || /^d[1-9]\d*(s[1-9]\d*)?$/.test(id);

/** 講義順序的全部題目 ID */
export function allQuestionIds(index: HandoutManifestEntry): string[] {
  return [...index.decks].sort((a, b) => a.order - b.order).flatMap((d) => d.sections.flatMap((s) => s.questionIds));
}

export function resolveSet(index: HandoutManifestEntry, setId: string, wrongIds: ReadonlySet<string>): ExamSet | null {
  const decks = [...index.decks].sort((a, b) => a.order - b.order);
  if (setId === 'all') return { id: setId, kind: 'all', deckIds: decks.map((d) => d.id), questionIds: allQuestionIds(index) };
  if (setId === 'wrong') {
    const ids = allQuestionIds(index).filter((id) => wrongIds.has(id));
    const deckIds = decks.filter((d) => d.sections.some((s) => s.questionIds.some((id) => wrongIds.has(id)))).map((d) => d.id);
    return { id: setId, kind: 'wrong', deckIds, questionIds: ids };
  }
  for (const d of decks) {
    if (d.id === setId) return { id: setId, kind: 'deck', deckIds: [d.id], questionIds: d.sections.flatMap((s) => s.questionIds), title: d.title, deck: d };
    const s = d.sections.find((x) => x.id === setId);
    if (s) return { id: setId, kind: 'section', deckIds: [d.id], questionIds: s.questionIds, title: s.title, deck: d };
  }
  return null;
}
