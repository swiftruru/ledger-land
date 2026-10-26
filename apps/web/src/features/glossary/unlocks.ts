// 名詞圖鑑的純函式（03 第 2.10 節、08 第 7.3 節）：解鎖狀態只看 ProgressStore 的 unlock（id 是 term:<名詞 ID>）；
// 「在哪一關會遇到」優先用名詞自己的 unlock.levelId，否則用快照的 firstLevel；章節與關卡的名稱由頁面從章節快照取。
// 鎖住的只是收藏狀態，不鎖知識：名詞卡在任何狀態都能讀。沒有 DOM、沒有 React，單元測試在 apps/web/test/glossary.test.ts。
import type { Locale } from '@ledgerland/i18n';
import type { Unlock } from '@ledgerland/progress';
import type { TermIndexEntry } from '../../lib/content.ts';

/** 圖鑑只用名詞索引的欄位（08 第 7.3 節）：firstLevel 由建置工具算出，unlock 是作者另設的解鎖關卡，aliases 是兩種語言的別名；
 *  完整內容（TermSnapshot）也是 TermIndexEntry，名詞頁直接傳進來。
 *  otherLabel：另一種語言的主名稱（雙語搜尋用，finding glossary-2）。名詞索引之後由建置工具直接帶這個欄位；
 *  還沒有時由名詞圖鑑一掛載就讀另一語系的索引補上（withOtherLabels；只給搜尋用，不算進頁面的 ready 條件） */
export type GlossaryTerm = TermIndexEntry & { readonly otherLabel?: string };

export const TERM_UNLOCK_PREFIX = 'term:';

export function termUnlockId(termId: string): string {
  return `${TERM_UNLOCK_PREFIX}${termId}`;
}

/** 已收進圖鑑的名詞：名詞 ID 對解鎖時間（ISO） */
export function unlockedTermMap(unlocks: readonly Unlock[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const u of unlocks) {
    if (u.kind !== 'term' || !u.id.startsWith(TERM_UNLOCK_PREFIX)) continue;
    out.set(u.id.slice(TERM_UNLOCK_PREFIX.length), u.unlockedAt);
  }
  return out;
}

/** 名詞會在哪一關遇到：作者另設 unlock.levelId 時以它為準（章節由呼叫端的關卡對照查），否則用 firstLevel；兩者都沒有回 undefined */
export function meetLevelOf(term: GlossaryTerm, chapterOfLevel: ReadonlyMap<string, string>): { levelId: string; chapterId: string } | undefined {
  if (term.unlock) {
    const chapterId = chapterOfLevel.get(term.unlock.levelId) ?? term.firstLevel?.chapterId;
    return chapterId === undefined ? undefined : { levelId: term.unlock.levelId, chapterId };
  }
  return term.firstLevel;
}

/** 參考名詞（規劃者 2026-10-24 的決定，03 第 2.10 節的名詞圖鑑）：沒有任何已發布題目引用（建置工具算不出 firstLevel）、作者也沒有另設 unlock 的名詞。
 *  在圖鑑裡另列「參考名詞」區：隨時可讀、不顯示鎖定、不算進「已收進 X／N」的分母；之後有題目引用，快照有了 firstLevel 就自動回到收集區 */
export function isReferenceTerm(term: GlossaryTerm): boolean {
  return term.firstLevel === undefined && term.unlock === undefined;
}

/** 「已收進圖鑑 done／total」：只算收集區的名詞（參考名詞不算分子也不算分母）；unlocked 還沒讀到（null）時 done 是 null。
 *  傳進已讀到的 Map 時 done 一定是數字（頁面在進度齊了之後才畫，不必再處理 null） */
export function collectionCounts(terms: readonly GlossaryTerm[], unlocked: ReadonlyMap<string, string>): { done: number; total: number };
export function collectionCounts(terms: readonly GlossaryTerm[], unlocked: ReadonlyMap<string, string> | null): { done: number | null; total: number };
export function collectionCounts(terms: readonly GlossaryTerm[], unlocked: ReadonlyMap<string, string> | null): { done: number | null; total: number } {
  const collectible = terms.filter((t) => !isReferenceTerm(t));
  return { done: unlocked === null ? null : collectible.filter((t) => unlocked.has(t.id)).length, total: collectible.length };
}

/** 收集進度卡的百分比（名詞圖鑑，看圖驗收第 2 輪）：0 個是 0、收齊是 1，其餘無條件捨去到 1% 到 99% 之間（還沒收齊不顯示 100%，收了一個也不會是 0%） */
export function collectedRatio(done: number, total: number): number {
  if (total <= 0 || done <= 0) return 0;
  if (done >= total) return 1;
  return Math.min(99, Math.max(1, Math.floor((done / total) * 100))) / 100;
}

export interface ChapterIndexEntry {
  readonly id: string;
  readonly order: number;
  /** 地圖上的章序：主線與延伸區各自從 1 起算（和 quest-map/data.ts 的 buildChapters 同一規則，17 評估四） */
  readonly chapterNo: number;
  readonly extension: boolean;
  readonly levelIds: readonly string[];
}

/** 依 order 排好，主線與延伸區（scope 為 extension）各自編章序；和地圖、清單檢視與章節頁的「第 N 章」「延伸第 N 章」一致 */
export function numberChapters(raw: readonly { id: string; order: number; scope?: string; levelIds?: readonly string[] }[]): ChapterIndexEntry[] {
  let core = 0;
  let ext = 0;
  return [...raw]
    .sort((a, b) => a.order - b.order)
    .map((c) => {
      const extension = c.scope === 'extension';
      return { id: c.id, order: c.order, chapterNo: extension ? ++ext : ++core, extension, levelIds: c.levelIds ?? [] };
    });
}

/** 「第 N 章第 M 關」（延伸章是「延伸第 N 章」）的 N 與 M（1 起算）；關卡不在章節清單裡時 levelNo 為 undefined */
export function levelPosition(
  chapters: readonly ChapterIndexEntry[],
  chapterId: string,
  levelId: string,
): { chapterNo: number; extension: boolean; levelNo: number | undefined } | undefined {
  const c = chapters.find((x) => x.id === chapterId);
  if (!c) return undefined;
  const i = c.levelIds.indexOf(levelId);
  return { chapterNo: c.chapterNo, extension: c.extension, levelNo: i === -1 ? undefined : i + 1 };
}

/** 關卡 ID 對章節 ID 的對照（manifest 的 chapters[].levelIds） */
export function chapterOfLevelMap(chapters: readonly ChapterIndexEntry[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const c of chapters) for (const l of c.levelIds) out.set(l, c.id);
  return out;
}

/** 搜尋：比對兩種語言的名稱（label 與 otherLabel）、教材用語、現行用語、IFRS 英文與別名（兩種語言），不分大小寫、忽略前後空白；
 *  連續的空白當成一個（「current  ratio」也找得到） */
export function matchesQuery(term: GlossaryTerm, query: string): boolean {
  const q = normalizeQuery(query);
  if (q === '') return true;
  const fields = [term.label, term.otherLabel, term.teacherLabel, term.currentTwLabel, term.ifrsEnglish, ...Object.values(term.aliases ?? {}).flat()];
  return fields.some((f) => typeof f === 'string' && normalizeQuery(f).includes(q));
}

/** 搜尋用的正規化：空白收成一格、小寫；彎撇號與彎單引號當成直撇號（內容用 ’，鍵盤打的是 '，例如 owner's equity） */
function normalizeQuery(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .toLowerCase();
}

/** 補上另一種語言的主名稱（雙語搜尋）：other 是另一語系的名詞索引；索引已經帶 otherLabel 的名詞不改 */
export function withOtherLabels(terms: readonly GlossaryTerm[], other: readonly { id: string; label: string }[]): GlossaryTerm[] {
  const byId = new Map(other.map((t) => [t.id, t.label] as const));
  return terms.map((t) => {
    if (t.otherLabel !== undefined) return t;
    const label = byId.get(t.id);
    return label === undefined || label === t.label ? t : { ...t, otherLabel: label };
  });
}

/** 名詞索引是不是已經有另一種語言的名稱（有就不必再讀另一語系的索引） */
export function hasOtherLabels(terms: readonly GlossaryTerm[]): boolean {
  return terms.length > 0 && terms.every((t) => t.otherLabel !== undefined);
}

/** 關卡代號「1-2」，延伸章是「E1-2」（站規 2.3、圖規 4.1）：主線與延伸區各自編章序（levelPosition）；
 *  code 是 features/home/codes.ts 的 useLevelCodeFormatter（共用 home.code 與 home.code.ext），和章節頁、地圖、首頁同一個代號 */
export function levelCode(
  pos: { chapterNo: number; levelNo: number | undefined; extension: boolean },
  code: (chapterNo: number, levelNo: number, extension: boolean) => string,
): string | undefined {
  return pos.levelNo === undefined ? undefined : code(pos.chapterNo, pos.levelNo, pos.extension);
}

/** 蓋章動畫的對象（站規 1.11.2）：上次離開圖鑑時還沒收進、現在已收進的名詞。seen 讀不到（null）時一張都不播 */
export function newlyCollected(seen: readonly string[] | null, unlocked: ReadonlyMap<string, string> | null): Set<string> {
  if (seen === null || unlocked === null) return new Set();
  const before = new Set(seen);
  return new Set([...unlocked.keys()].filter((id) => !before.has(id)));
}

/** 一組名詞裡已收進幾個（章節分組標題右側的「3／7 已收進」）；進度還沒讀到時 done 是 null，傳進已讀到的 Map 時一定是數字 */
export function groupProgress(terms: readonly GlossaryTerm[], unlocked: ReadonlyMap<string, string>): { done: number; total: number };
export function groupProgress(terms: readonly GlossaryTerm[], unlocked: ReadonlyMap<string, string> | null): { done: number | null; total: number };
export function groupProgress(terms: readonly GlossaryTerm[], unlocked: ReadonlyMap<string, string> | null): { done: number | null; total: number } {
  return { done: unlocked === null ? null : terms.filter((t) => unlocked.has(t.id)).length, total: terms.length };
}

/** 名詞圖鑑的搜尋與分組：從圖鑑點進名詞頁時放在 history state，名詞頁的返回帶回 ?q 與 ?group（finding glossary-4） */
export interface GlossaryReturnState {
  readonly llGlossarySearch: string;
}

export function glossaryReturnSearch(state: unknown): string | undefined {
  if (typeof state !== 'object' || state === null) return undefined;
  const v = (state as Partial<GlossaryReturnState>).llGlossarySearch;
  return typeof v === 'string' ? v : undefined;
}

/** 返回名詞圖鑑的網址：有從圖鑑帶來的查詢字串就接上（只留 q 與 group），否則是乾淨的 /terms/ */
export function glossaryReturnPath(base: string, search: string | undefined): string {
  if (!search) return base;
  const from = new URLSearchParams(search);
  const next = new URLSearchParams();
  for (const key of ['q', 'group']) {
    const v = from.get(key);
    if (v) next.set(key, v);
  }
  const qs = next.toString();
  return qs ? `${base}?${qs}` : base;
}

export type GlossaryGrouping = 'chapter' | 'name';

export interface GlossaryGroup {
  /** 章節 ID、'none'（關卡找不到章節）、'reference'（參考名詞）或名稱模式的首字 */
  readonly key: string;
  readonly chapterId?: string;
  readonly terms: readonly GlossaryTerm[];
}

/** 依章節分組：章節依 order，章內依在該章第一次遇到的關卡順序再依名稱；沒有關卡用到的名詞放最後一組（key 'none'） */
export function groupByChapter(terms: readonly GlossaryTerm[], chapters: readonly ChapterIndexEntry[], collator: Intl.Collator): GlossaryGroup[] {
  const chapterOfLevel = chapterOfLevelMap(chapters);
  const buckets = new Map<string, GlossaryTerm[]>();
  for (const t of terms) {
    const meet = meetLevelOf(t, chapterOfLevel);
    const key = meet?.chapterId ?? 'none';
    const list = buckets.get(key);
    if (list) list.push(t);
    else buckets.set(key, [t]);
  }
  const ordered = [...chapters].sort((a, b) => a.order - b.order);
  const out: GlossaryGroup[] = [];
  for (const c of ordered) {
    const list = buckets.get(c.id);
    if (!list) continue;
    list.sort((a, b) => {
      const la = c.levelIds.indexOf(meetLevelOf(a, chapterOfLevel)?.levelId ?? '');
      const lb = c.levelIds.indexOf(meetLevelOf(b, chapterOfLevel)?.levelId ?? '');
      return la - lb || collator.compare(a.label, b.label);
    });
    out.push({ key: c.id, chapterId: c.id, terms: list });
    buckets.delete(c.id);
  }
  // 快照裡找不到的章節（理論上不會發生）併入「其他」
  const rest = [...buckets.values()].flat().sort((a, b) => collator.compare(a.label, b.label));
  if (rest.length > 0) out.push({ key: 'none', terms: rest });
  return out;
}

/** 依名稱排序：英文依首字母分組，中文（沒有字母順序可言）只排序、單一組 */
export function groupByName(terms: readonly GlossaryTerm[], locale: Locale, collator: Intl.Collator): GlossaryGroup[] {
  const sorted = [...terms].sort((a, b) => collator.compare(a.label, b.label));
  if (locale !== 'en') return sorted.length === 0 ? [] : [{ key: 'all', terms: sorted }];
  const out: GlossaryGroup[] = [];
  for (const t of sorted) {
    const first = t.label.trim().charAt(0).toUpperCase();
    const key = /[A-Z]/.test(first) ? first : '#';
    const last = out[out.length - 1];
    if (last && last.key === key) (last.terms as GlossaryTerm[]).push(t);
    else out.push({ key, terms: [t] });
  }
  return out;
}

/** 圖鑑列表的分組：收集區依章節或名稱分組，參考名詞（isReferenceTerm）一律放在最後的 'reference' 組、依名稱排序 */
export function groupGlossary(
  terms: readonly GlossaryTerm[],
  grouping: GlossaryGrouping,
  chapters: readonly ChapterIndexEntry[],
  locale: Locale,
  collator: Intl.Collator,
): GlossaryGroup[] {
  const collectible = terms.filter((t) => !isReferenceTerm(t));
  const reference = terms.filter(isReferenceTerm).sort((a, b) => collator.compare(a.label, b.label));
  const groups = grouping === 'chapter' ? groupByChapter(collectible, chapters, collator) : groupByName(collectible, locale, collator);
  return reference.length === 0 ? groups : [...groups, { key: 'reference', terms: reference }];
}
