// 名詞圖鑑 E2E 的期待值：一律從正在服務的內容快照讀（manifest、名詞索引、名詞完整內容、章節索引），
// 內容改寫（例如名詞定義的 rev 升版）後不必改測試（finding glossary-6）。只給 glossary、glossary-scope、preload、term-detail-offline 用。
import type { APIRequestContext } from '@playwright/test';

export type Locale = 'zh-TW' | 'en';

export interface ManifestChapter {
  id: string;
  order: number;
  scope?: string;
  examScope?: string;
  levelIds?: string[];
}
export interface Manifest {
  chapters: ManifestChapter[];
  levels: { id: string; chapterId: string; order: number; questionIds: string[]; unscored?: boolean; files: Record<string, string> }[];
  termIndex: Record<string, string>;
  termDetails: Record<string, Record<string, string>>;
  chapterIndex: Record<string, string>;
}
export interface TermEntry {
  id: string;
  label: string;
  category: string;
  teacherLabel: string;
  currentTwLabel: string | null;
  ifrsEnglish: string | null;
  aliases?: Partial<Record<Locale, string[]>>;
  otherLabel?: string;
  firstLevel?: { levelId: string; chapterId: string };
  unlock?: { levelId: string };
}
export interface TermDetail extends TermEntry {
  definition: string;
  note?: string;
  formula?: string;
  example?: string;
  misconception?: string;
  ifrsNote?: string;
  related?: string[];
}
export interface ChapterSummary {
  id: string;
  title: string;
  levels?: { id: string; title: string }[];
}

async function json<T>(request: APIRequestContext, path: string): Promise<T> {
  const res = await request.get(path.startsWith('/') ? path : `/${path}`);
  if (!res.ok()) throw new Error(`讀不到 ${path}（${res.status()}）`);
  return (await res.json()) as T;
}

export function manifestOf(request: APIRequestContext): Promise<Manifest> {
  return json<Manifest>(request, '/content/content-manifest.json');
}

export async function termIndexOf(request: APIRequestContext, locale: Locale): Promise<TermEntry[]> {
  const m = await manifestOf(request);
  return json<TermEntry[]>(request, m.termIndex[locale]!);
}

/** 名詞完整內容的分桶（和 apps/web/src/lib/content.ts 的 termDetailBucket 相同）：ID 最後一個字元的字元碼除以 8 的餘數 */
export const TERM_DETAIL_BUCKETS = 8;
export function termDetailBucket(id: string): string {
  return String(id.charCodeAt(id.length - 1) % TERM_DETAIL_BUCKETS);
}

/** 一個名詞的完整內容（讀它所在的桶） */
export async function termDetailOf(request: APIRequestContext, id: string, locale: Locale): Promise<TermDetail> {
  const m = await manifestOf(request);
  const list = await json<TermDetail[]>(request, m.termDetails[locale]![termDetailBucket(id)]!);
  const hit = list.find((t) => t.id === id);
  if (!hit) throw new Error(`快照裡沒有 ${id} 的 ${locale} 內容`);
  return hit;
}

/** 名詞完整內容的分桶檔路徑（/content/zh-TW/terms-<桶>.<hash>.json） */
export async function termBucketPath(request: APIRequestContext, id: string, locale: Locale): Promise<string> {
  const m = await manifestOf(request);
  return `/${m.termDetails[locale]![termDetailBucket(id)]!}`;
}

/** 關卡所在章節的章節包路徑（schemaVersion 3：關卡的檔就是章節包，/content/<語言>/ch_<id>.<hash>.json） */
export async function levelBundlePath(request: APIRequestContext, levelId: string, locale: Locale): Promise<string> {
  const m = await manifestOf(request);
  const entry = m.levels.find((l) => l.id === levelId);
  if (!entry) throw new Error(`manifest 裡沒有關卡 ${levelId}`);
  return `/${entry.files[locale]!}`;
}

export async function chapterIndexOf(request: APIRequestContext, locale: Locale): Promise<ChapterSummary[]> {
  const m = await manifestOf(request);
  return json<ChapterSummary[]>(request, m.chapterIndex[locale]!);
}

/** 地圖的章序：主線與延伸區各自從 1 起算 */
export function chapterNoOf(m: Manifest, chapterId: string): { no: number; extension: boolean } {
  const sorted = [...m.chapters].sort((a, b) => a.order - b.order);
  const target = sorted.find((c) => c.id === chapterId)!;
  const extension = target.scope === 'extension';
  const no = sorted.filter((c) => (c.scope === 'extension') === extension).findIndex((c) => c.id === chapterId) + 1;
  return { no, extension };
}

/** 名詞會遇到的關卡（unlock 優先，否則 firstLevel；和 features/glossary/unlocks.ts 的 meetLevelOf 相同） */
export function meetOf(m: Manifest, t: TermEntry): { levelId: string; chapterId: string } | undefined {
  if (t.unlock) {
    const chapterId = m.chapters.find((c) => c.levelIds?.includes(t.unlock!.levelId))?.id ?? t.firstLevel?.chapterId;
    return chapterId === undefined ? undefined : { levelId: t.unlock.levelId, chapterId };
  }
  return t.firstLevel;
}

export function isReference(t: TermEntry): boolean {
  return t.firstLevel === undefined && t.unlock === undefined;
}

/** 畫面上一定看得到的一段定義：第一段裡第一個佔位符之前的文字，取前 16 個字（不受數字格式化與名詞名稱替換影響） */
export function visibleChunk(text: string): string {
  const first = text.split(/\n[ \t]*\n/)[0]!.trim();
  const before = first.split('{{')[0]!.trim();
  return before.slice(0, 16);
}

/** 搜尋比對（和 features/glossary/unlocks.ts 的 matchesQuery 相同；otherLabel 由測試補上另一語系的名稱） */
export function matches(t: TermEntry, query: string): boolean {
  const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  const q = norm(query);
  const fields = [t.label, t.otherLabel, t.teacherLabel, t.currentTwLabel, t.ifrsEnglish, ...Object.values(t.aliases ?? {}).flat()];
  return fields.some((f) => typeof f === 'string' && norm(f).includes(q));
}

/** 補上另一語系的主名稱 */
export function withOther(terms: TermEntry[], other: TermEntry[]): TermEntry[] {
  const byId = new Map(other.map((t) => [t.id, t.label] as const));
  return terms.map((t) => (t.otherLabel !== undefined ? t : { ...t, otherLabel: byId.get(t.id) }));
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
