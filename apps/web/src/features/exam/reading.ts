// 背題瀏覽的閱讀進度（2026-11-06）：已讀、上一題與下一題、接著讀要去哪一題、上次停的位置。純函式，不碰儲存。
// 範圍（scope）：all 是全部，其餘是講義 ID（d1）。已讀只有一份、以題目 ID 為鍵，任何範圍的數字都由它算出來，所以「全部」與各份講義一定對得起來。
// 位置跟著題目走：在哪一個範圍讀到一題，更新的都是「那一題所屬講義的位置」與「整體最後的位置」。
import type { HandoutManifestEntry } from '../../lib/content.ts';
import type { ReadMark } from './read-db.ts';

export const ALL_SCOPE = 'all';

export type ShowFilter = 'all' | 'unread' | 'read';
export const parseShow = (v: string | null): ShowFilter => (v === 'unread' || v === 'read' ? v : 'all');

/** 背題瀏覽網址的查詢字串：範圍（全部不寫）、篩選（全部不寫）、關鍵字（空的不寫）、只看某條公式的相關題（沒有不寫）、閱讀頁的題目（清單不寫） */
export function browseParams({
  scope,
  show = 'all',
  find = '',
  formula = null,
  q = null,
}: {
  scope: string;
  show?: ShowFilter;
  find?: string;
  formula?: string | null;
  q?: string | null;
}): Record<string, string> {
  return {
    ...(scope === ALL_SCOPE ? {} : { deck: scope }),
    ...(show === 'all' ? {} : { show }),
    ...(find.trim() === '' ? {} : { find }),
    ...(formula === null || formula === '' ? {} : { formula }),
    ...(q === null ? {} : { q }),
  };
}

const sortedDecks = (index: HandoutManifestEntry) => [...index.decks].sort((a, b) => a.order - b.order);

/** 網址給的範圍不是現有的講義時當作全部 */
export const scopeOf = (index: HandoutManifestEntry, wanted: string | null): string =>
  wanted !== null && index.decks.some((d) => d.id === wanted) ? wanted : ALL_SCOPE;

/** 範圍內依講義順序的題目 ID */
export function orderOf(index: HandoutManifestEntry, scope: string): string[] {
  return sortedDecks(index)
    .filter((d) => scope === ALL_SCOPE || d.id === scope)
    .flatMap((d) => d.sections.flatMap((s) => s.questionIds));
}

/** 已讀的題：紀錄裡的答案版本和現在的題庫一樣才算（答案改過的題回到未讀）；題庫裡沒有的題不算 */
export function readSetOf(marks: readonly ReadMark[], answerRevOf: (questionId: string) => number | undefined): Set<string> {
  const read = new Set<string>();
  for (const m of marks) if (answerRevOf(m.questionId) === m.answerRev) read.add(m.questionId);
  return read;
}

export function readCountOf(questionIds: readonly string[], read: ReadonlySet<string>): number {
  let count = 0;
  for (const id of questionIds) if (read.has(id)) count++;
  return count;
}

const matches = (id: string, read: ReadonlySet<string>, show: ShowFilter): boolean => show === 'all' || read.has(id) === (show === 'read');

/** 清單上要列出來的題 */
export const visibleIds = (questionIds: readonly string[], read: ReadonlySet<string>, show: ShowFilter): string[] =>
  questionIds.filter((id) => matches(id, read, show));

/** 上一題與下一題：篩選「未讀」時跳過已讀的題（「已讀」時相反）；目前這一題不在範圍裡時兩邊都沒有 */
export function neighbours(order: readonly string[], id: string, read: ReadonlySet<string>, show: ShowFilter): { prev: string | null; next: string | null } {
  const at = order.indexOf(id);
  if (at < 0) return { prev: null, next: null };
  let prev: string | null = null;
  for (let i = at - 1; i >= 0 && prev === null; i--) if (matches(order[i]!, read, show)) prev = order[i]!;
  let next: string | null = null;
  for (let i = at + 1; i < order.length && next === null; i++) if (matches(order[i]!, read, show)) next = order[i]!;
  return { prev, next };
}

export interface ResumeTarget {
  /** start：還沒開始；resume：接著讀；done：這個範圍都讀完了 */
  kind: 'start' | 'resume' | 'done';
  id: string;
}

/** 開始卡要帶去哪一題：上次停的那一題還沒讀就是它；讀了就是它之後第一題未讀（找到最後再從頭找）；都讀完了回到上次停的那一題（沒有就是第一題） */
export function resumeTarget(order: readonly string[], lastId: string | null, read: ReadonlySet<string>): ResumeTarget | null {
  if (order.length === 0) return null;
  const at = lastId === null ? -1 : order.indexOf(lastId);
  const readCount = readCountOf(order, read);
  if (readCount === order.length) return { kind: 'done', id: at >= 0 ? order[at]! : order[0]! };
  if (at < 0 && readCount === 0) return { kind: 'start', id: order[0]! };
  for (let step = 0; step < order.length; step++) {
    const id = order[(Math.max(at, 0) + step) % order.length]!;
    if (!read.has(id)) return { kind: 'resume', id };
  }
  return { kind: 'resume', id: order[0]! };
}

/** 上次停的位置（這台裝置的偏好，prefs.ts 存 localStorage） */
export interface BrowsePos {
  /** 上次所在的範圍 */
  scope: string;
  /** 每份講義最後停的題 */
  decks: Readonly<Record<string, string>>;
  /** 整體最後停的題（「全部」的接著讀） */
  last: string | null;
}

export const EMPTY_POS: BrowsePos = { scope: ALL_SCOPE, decks: {}, last: null };

const QUESTION_ID = /^hq_[a-z0-9]+$/;
const SCOPE_ID = /^(all|d[1-9]\d*)$/;

export function parseBrowsePos(raw: string | null): BrowsePos {
  if (raw === null) return EMPTY_POS;
  try {
    const v = JSON.parse(raw) as unknown;
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return EMPTY_POS;
    const o = v as Record<string, unknown>;
    const decks: Record<string, string> = {};
    if (o.decks !== null && typeof o.decks === 'object' && !Array.isArray(o.decks))
      for (const [deck, id] of Object.entries(o.decks))
        if (SCOPE_ID.test(deck) && deck !== ALL_SCOPE && typeof id === 'string' && QUESTION_ID.test(id)) decks[deck] = id;
    return {
      scope: typeof o.scope === 'string' && SCOPE_ID.test(o.scope) ? o.scope : ALL_SCOPE,
      decks,
      last: typeof o.last === 'string' && QUESTION_ID.test(o.last) ? o.last : null,
    };
  } catch {
    return EMPTY_POS;
  }
}

/** 和一開始一樣（沒有位置、範圍是全部）時回 null：不寫鍵 */
export function encodeBrowsePos(pos: BrowsePos): string | null {
  if (pos.scope === ALL_SCOPE && pos.last === null && Object.keys(pos.decks).length === 0) return null;
  return JSON.stringify({ scope: pos.scope, decks: pos.decks, last: pos.last });
}

/** 某個範圍上次停的題：全部看整體最後的位置，講義看它自己的 */
export const lastIn = (pos: BrowsePos, scope: string): string | null => (scope === ALL_SCOPE ? pos.last : (pos.decks[scope] ?? null));

/** 在閱讀頁打開一題：記下範圍、那一題所屬講義的位置與整體的位置 */
export function withVisited(pos: BrowsePos, scope: string, deckId: string, questionId: string): BrowsePos {
  if (pos.scope === scope && pos.last === questionId && pos.decks[deckId] === questionId) return pos;
  return { scope, decks: { ...pos.decks, [deckId]: questionId }, last: questionId };
}

export const withScope = (pos: BrowsePos, scope: string): BrowsePos => (pos.scope === scope ? pos : { ...pos, scope });

/** 重設某個範圍的已讀時一起清掉位置：那幾份講義的位置拿掉；整體的位置如果落在被重設的題裡也拿掉 */
export function withoutPositions(pos: BrowsePos, deckIds: readonly string[], questionIds: ReadonlySet<string>): BrowsePos {
  const decks = Object.fromEntries(Object.entries(pos.decks).filter(([deck]) => !deckIds.includes(deck)));
  return { scope: pos.scope, decks, last: pos.last !== null && questionIds.has(pos.last) ? null : pos.last };
}
