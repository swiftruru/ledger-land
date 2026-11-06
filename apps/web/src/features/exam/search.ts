// 背題瀏覽的關鍵字搜尋（2026-11-06）：比對題目的標題、情境、問題、三個選項與解析；純函式。
// 正規化：NFKC（全形英數與標點變半形，「ＲＯＥ」找得到「ROE」）、小寫、空白收成一格。用空白隔開的幾個詞要全部都有才算（「現金 存貨」）。
// 題目只有中文，所以不做斷詞：整段文字裡有沒有這幾個字。
import type { HandoutQuestionSnapshot } from '../../lib/content.ts';

export function normaliseText(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** 把輸入拆成要找的詞（已正規化）；空的輸入沒有詞，代表不搜尋 */
export function searchTerms(query: string): string[] {
  return [...new Set(normaliseText(query).split(' ').filter(Boolean))];
}

/** 每一題拿來比對的整段文字（已正規化），以題目 ID 為鍵 */
export type SearchIndex = ReadonlyMap<string, string>;

const fieldsOf = (q: HandoutQuestionSnapshot): string[] => [q.topic, q.scenario, q.question, ...q.options.map((o) => o.text), q.explanation];

export function buildSearchIndex(questions: Iterable<HandoutQuestionSnapshot>): Map<string, string> {
  const index = new Map<string, string>();
  // 欄位之間用換行隔開：一個詞不會跨兩個欄位比中
  for (const q of questions) index.set(q.id, fieldsOf(q).map(normaliseText).join('\n'));
  return index;
}

/** 這一題有沒有全部的詞；沒有詞（不搜尋）時每一題都算 */
export function matchesTerms(index: SearchIndex, questionId: string, terms: readonly string[]): boolean {
  if (terms.length === 0) return true;
  const text = index.get(questionId);
  return text !== undefined && terms.every((term) => text.includes(term));
}

export const matchingIds = (questionIds: readonly string[], index: SearchIndex, terms: readonly string[]): string[] =>
  terms.length === 0 ? [...questionIds] : questionIds.filter((id) => matchesTerms(index, id, terms));

/** 一段文字切成「前面、比中的字、後面」，給畫面把比中的字標出來 */
export interface Highlight {
  before: string;
  hit: string;
  after: string;
}

/** 在原文裡找第一個比中的詞（不分大小寫）。原文和正規化後的字數可能不一樣（全形字），所以直接在原文的小寫裡找；找不到回 null */
export function highlightOf(text: string, terms: readonly string[]): Highlight | null {
  const lower = text.toLowerCase();
  let at = -1;
  let length = 0;
  for (const term of terms) {
    const i = lower.indexOf(term);
    if (i >= 0 && (at < 0 || i < at)) {
      at = i;
      length = term.length;
    }
  }
  if (at < 0) return null;
  return { before: text.slice(0, at), hit: text.slice(at, at + length), after: text.slice(at + length) };
}

const EXCERPT_BEFORE = 10;
const EXCERPT_AFTER = 28;

/** 標題以外第一個比中的地方的摘錄（情境、問題、選項、解析依序找），前後各留幾個字；標題以外沒有比中時回 null */
export function excerptOf(q: HandoutQuestionSnapshot, terms: readonly string[]): Highlight | null {
  for (const field of fieldsOf(q).slice(1)) {
    const h = highlightOf(field, terms);
    if (!h) continue;
    const cutBefore = h.before.length > EXCERPT_BEFORE;
    const cutAfter = h.after.length > EXCERPT_AFTER;
    return {
      before: (cutBefore ? '…' : '') + h.before.slice(-EXCERPT_BEFORE),
      hit: h.hit,
      after: h.after.slice(0, EXCERPT_AFTER) + (cutAfter ? '…' : ''),
    };
  }
  return null;
}
