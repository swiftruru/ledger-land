// ContentSource（執行期，唯讀；08 第 7.4 節的 M0b 子集）：讀 content-manifest 與依語系切分的快照。
// 所有載入都經過同一個包裝：檢查 Content-Type（SPA fallback 可能回殼層 HTML），拿到 HTML 視同檔案不存在（06 第 9.1 節）。
import type { Locale } from '@ledgerland/i18n';
import { setContentVersion } from './errors.ts';

export interface ContentManifest {
  schemaVersion: number;
  contentVersion: number;
  builtAt: string;
  gitCommit: string;
  /** 只在 LL_INCLUDE_DRAFTS=1 的本機或 E2E 快照出現：快照含草稿（debug 頁顯示） */
  includesDrafts?: boolean;
  locales: Record<string, { status: 'complete' | 'beta' }>;
  /** 章節檔是章節本身加該章已發布的學習目標（objectives）；levelIds 只列已發布的關卡，順序依 chapter.levelIds（M2 起） */
  /** scope（core、extension）與 examScope（midterm、not_in_exam、unconfirmed）是 M3 起才有的欄位（T32；tools/lib/content-snapshot.mjs）；
   *  notices 是章節標記的固定聲明（例如 not_investment_advice，2026-10-24 起），沒有時省略 */
  chapters: { id: string; order: number; scope?: string; examScope?: string; notices?: string[]; levelIds?: string[]; files: Record<string, string> }[];
  /** M2 起：每關一檔 { level, questions }，questions 依 questionIds 順序，每題帶 answerRev 與核心算出的 compiled（tools/lib/content-snapshot.mjs） */
  levels?: LevelManifestEntry[];
  /** 章節索引（schemaVersion 2 起）：每個語系一檔，全部章節的摘要（ChapterSummary），依 order 排列 */
  chapterIndex: Record<string, string>;
  /** 名詞索引（schemaVersion 2 起）：每個語系一檔，只有關卡、名詞 chip 與圖鑑列表要的欄位（tools/lib/content-snapshot.mjs 的 TERM_INDEX_FIELDS） */
  termIndex: Record<string, string>;
  /** 名詞的完整內容：語系 → 分桶（名詞 ID 的最後一個字元，見 termDetailBucket）→ 檔案路徑；只列有名詞的桶 */
  termDetails: Record<string, Record<string, string>>;
  tombstones: string;
}

export interface LevelManifestEntry {
  id: string;
  chapterId: string;
  order: number;
  questionIds: string[];
  files: Record<string, string>;
}

/** 關卡檔的形狀（M2 起）：題目是依語系展開的 Question（LocalizedText 已換成單一字串），加 answerRev 與 compiled；
 * 作者填的 scenario.expected 已移除，答案一律看 compiled（04 第 15.2 節） */
export interface LevelSnapshot {
  level: {
    id: string;
    rev: number;
    chapterId: string;
    order: number;
    title: string;
    objectiveIds?: string[];
    questionIds: string[];
    timerSeconds?: number;
    status?: string;
    /** 整關都是不計分的題目（延伸章的取捨題）：結果頁不算星星、不寫 stars，只記已完成（tools/lib/content-snapshot.mjs 只在 true 時輸出） */
    unscored?: boolean;
  };
  questions: QuestionSnapshot[];
}

/** 章節檔裡已發布關卡的摘要（tools/lib/content-snapshot.mjs）：title 已依語系展開；questionCount 只算已發布的題目 */
export interface ChapterLevelSummary {
  id: string;
  order: number;
  title: string;
  objectiveIds: string[];
  questionCount: number;
}

/** 章節檔（M2 起）：章節本身加該章已發布的學習目標，以及已發布關卡的摘要（levels，順序同 levelIds） */
export interface ChapterSnapshot {
  id: string;
  rev: number;
  order: number;
  title: string;
  summary?: string;
  levelIds: string[];
  levels?: ChapterLevelSummary[];
  objectiveIds?: string[];
  objectives: { id: string; order: number; statement: string; [field: string]: unknown }[];
  badge?: { icon: string; title: string };
  termRefs?: string[];
  [field: string]: unknown;
}

/** 章節索引的一筆（08 第 7.3 節）：地圖、章節頁、名詞圖鑑與徽章只用這些欄位；學習目標只有 id、order、statement */
export interface ChapterSummary {
  id: string;
  order: number;
  scope?: string;
  examScope?: string;
  kind?: string;
  /** 章節的固定聲明（例如 not_investment_advice），沒有時省略 */
  notices?: string[];
  title: string;
  summary?: string;
  levelIds: string[];
  badge?: { icon: string; title: string };
  levels?: (ChapterLevelSummary & { unscored?: boolean })[];
  objectives: { id: string; order: number; statement: string }[];
  chapterEndLinks?: { kind: 'lab'; story: string; step: string }[];
}

/** 已下架項目的墓碑（08 第 7.3 節）：supersededBy 指向替代項目 */
export interface Tombstone {
  kind: 'term' | 'chapter' | 'objective' | 'level' | 'question' | 'story';
  id: string;
  supersededBy?: string;
  retiredNote?: Record<string, string>;
}

/** resolveId 的結果：active 代表快照裡找得到；retired 代表已下架（有替代項目時給 supersededBy）；unknown 代表完全不認識這個 ID */
export type ResolvedId =
  | { status: 'active'; kind: Tombstone['kind'] }
  | { status: 'retired'; kind: Tombstone['kind']; supersededBy?: string; retiredNote?: string }
  | { status: 'unknown' };

export interface QuestionSnapshot {
  id: string;
  type: string;
  chapterId: string;
  objectiveId: string;
  difficulty: 1 | 2 | 3;
  scored: boolean;
  rev: number;
  revKind: 'text' | 'answer';
  answerRev: number;
  termRefs: string[];
  vars?: Record<string, number>;
  compiled?: {
    expected?: Record<string, unknown>;
    values?: Record<string, number>;
    /** journal_entry：核心 expectedJournalEntries 的正解行（已攤平、合併同科目同方向；科目是 ID） */
    expectedEntries?: readonly CompiledEntryLine[];
    /** ratio_numeric：核心依 compute.ratioRef 算出的指標（tools/lib/content-rules.mjs 的 ratioAnswer） */
    ratio?: CompiledRatio;
    /** ratio_interpret：畫面上指標小表格的數字（快照目前還沒有這個欄位，由工具補上；見 M3 回報） */
    ratios?: readonly CompiledRatio[];
    categories?: Record<string, string>;
    /** pick_line：該報表在交易後（cumulative）的可見列與核心算出的金額，label 已依語系展開；total 是合計或公式列，heading 是群組標題列 */
    lines?: CompiledLine[];
    /** five_step_fill：開放格子（openCells 的版面線 ID）對核心算出的金額（判分的 expectedCells；快照目前還沒有這個欄位，由工具補上） */
    cells?: Record<string, number>;
  };
  [field: string]: unknown;
}

/** 分錄題正解的一行（核心 EntryLine 的 JSON 形狀） */
export interface CompiledEntryLine {
  account: string;
  side: 'debit' | 'credit';
  amount: number;
}

/** 核心 RatioResult 進快照的子集（04 第 12.1 節）：exact 是精確分數、displayValue 已依 displayDecimals 四捨五入（percent 以百分點表示） */
export interface CompiledRatio {
  ratioRef: string;
  status: 'ok' | 'zero' | 'na' | 'not_meaningful';
  exact: { num: string; den: string } | null;
  displayValue: number | null;
}

export interface CompiledLine {
  id: string;
  label: string;
  value: number;
  level?: number;
  total?: boolean;
  heading?: boolean;
}

/** 名詞類別（packages/content-schema 的 TermCategory；名詞卡的類別徽記與說明列用） */
export type TermCategory = 'statement' | 'account' | 'ratio' | 'concept' | 'process' | 'other';
/** 會計要素（核心科目表的 element）：科目類名詞的要素徽記 */
export type TermElement = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

/** 名詞索引的一筆（08 第 7.3 節）：作答頁的名詞 chip 與科目、指標名稱，圖鑑的列表、分組與搜尋，名詞卡的標題列、類別與要素徽記都只用這些欄位 */
export interface TermIndexEntry {
  id: string;
  category: TermCategory;
  label: string;
  teacherLabel: string;
  currentTwLabel: string | null;
  ifrsEnglish: string | null;
  /** 兩種語言的別名（圖鑑搜尋兩種都比對） */
  aliases?: Partial<Record<Locale, string[]>>;
  flags: string[];
  accountRef?: string;
  /** 科目類名詞的會計要素（站規 1.11.4）：建置工具由 accountRef 查核心科目表算出；不是科目類或查不到時省略，名詞卡退回中性的類別徽記 */
  element?: TermElement;
  ratioRef?: string;
  /** 第一個用到這個名詞的已發布關卡（建置工具算出；沒有關卡用到時省略） */
  firstLevel?: { levelId: string; chapterId: string };
  /** 作者另設的解鎖關卡 */
  unlock?: { levelId: string };
}

/** 名詞的完整內容（完整內容檔的一筆）：索引欄位加上定義、例子與 IFRS 說明等長文 */
export interface TermSnapshot extends TermIndexEntry {
  definition: string;
  note?: string;
  example?: string;
  misconception?: string;
  formula?: string;
  ifrsNote?: string;
  related?: string[];
}

export class ContentLoadError extends Error {
  constructor(
    message: string,
    public readonly kind: 'missing' | 'network' | 'invalid',
  ) {
    super(message);
  }
}

/** 2：名詞分成索引與分桶的完整內容（2026-10-24） */
const SUPPORTED_SCHEMA = 2;
let manifestPromise: Promise<ContentManifest> | null = null;
const cache = new Map<string, Promise<unknown>>();

async function fetchJson<T>(path: string): Promise<T> {
  let res: Response;
  try {
    // 同源請求用預設的 mode（cors）與 credentials（same-origin）；殼層的 preload 要帶 crossorigin 才會是同一組設定而被重用，
    // 少了它瀏覽器會再發一次請求（2026-10-24 在 Lighthouse 的請求清單看到 manifest 讀兩次）
    res = await fetch(path);
  } catch (e) {
    throw new ContentLoadError(`無法載入 ${path}：${String(e)}`, 'network');
  }
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || !type.includes('json')) throw new ContentLoadError(`${path} 不存在或已更新（${res.status} ${type}）`, 'missing');
  try {
    return (await res.json()) as T;
  } catch {
    throw new ContentLoadError(`${path} 不是合法的 JSON`, 'invalid');
  }
}

export function loadManifest(): Promise<ContentManifest> {
  manifestPromise ??= fetchJson<ContentManifest>('/content/content-manifest.json').then((m) => {
    if (m.schemaVersion !== SUPPORTED_SCHEMA) throw new ContentLoadError(`不支援的內容快照版本 ${m.schemaVersion}`, 'invalid');
    setContentVersion(m.contentVersion);
    return m;
  });
  manifestPromise.catch(() => {
    manifestPromise = null;
  });
  return manifestPromise;
}

/** 完整內容檔的分桶：名詞 ID 的最後一個字元（必須和 tools/lib/content-snapshot.mjs 的 termDetailBucket 一致）。
 *  由 ID 直接算出桶，名詞頁與名詞卡不必先讀索引就能讀完整內容（06 第 8.2 節） */
export function termDetailBucket(id: string): string {
  return id.slice(-1);
}

/** 名詞索引（每個語系一檔，約 10 KB gzip）：作答頁、名詞列表、收藏與 resolveId 都只讀它 */
export async function loadTermIndex(locale: Locale): Promise<TermIndexEntry[]> {
  const m = await loadManifest();
  const path = m.termIndex?.[locale];
  if (!path) throw new ContentLoadError(`沒有 ${locale} 的名詞索引`, 'missing');
  return cached<TermIndexEntry[]>(path);
}

/** 一個名詞的完整內容：讀它所在的桶（約 5 個名詞）；快照裡沒有這個名詞時回傳 undefined，檔案讀不到時丟 ContentLoadError */
export async function loadTermDetail(id: string, locale: Locale): Promise<TermSnapshot | undefined> {
  const m = await loadManifest();
  const byBucket = m.termDetails?.[locale];
  if (!byBucket) throw new ContentLoadError(`沒有 ${locale} 的名詞內容`, 'missing');
  const path = byBucket[termDetailBucket(id)];
  if (!path) return undefined;
  const list = await cached<TermSnapshot[]>(path);
  return list.find((t) => t.id === id);
}

function cached<T>(path: string): Promise<T> {
  let p = cache.get(path) as Promise<T> | undefined;
  if (!p) {
    p = fetchJson<T>(`/${path}`);
    cache.set(path, p);
    p.catch(() => cache.delete(path));
  }
  return p;
}

/** 關卡檔：{ level, questions }，題目依 questionIds 順序並帶 compiled；找不到關卡（草稿、下架或打錯）丟 missing */
export async function loadLevel(levelId: string, locale: Locale): Promise<LevelSnapshot> {
  const m = await loadManifest();
  const entry = (m.levels ?? []).find((l) => l.id === levelId);
  const path = entry?.files[locale];
  if (!entry || !path) throw new ContentLoadError(`沒有關卡 ${levelId} 的 ${locale} 快照`, 'missing');
  return cached<LevelSnapshot>(path);
}

export async function loadChapter(chapterId: string, locale: Locale): Promise<ChapterSnapshot> {
  const m = await loadManifest();
  const entry = m.chapters.find((c) => c.id === chapterId);
  const path = entry?.files[locale];
  if (!entry || !path) throw new ContentLoadError(`沒有章節 ${chapterId} 的 ${locale} 快照`, 'missing');
  return cached<ChapterSnapshot>(path);
}

/** 章節索引（每個語系一檔，約 8 KB gzip）：地圖與名詞圖鑑第一次繪製只讀它，不必逐章讀章節檔 */
export async function loadChapterIndex(locale: Locale): Promise<ChapterSummary[]> {
  const m = await loadManifest();
  const path = m.chapterIndex?.[locale];
  if (!path) throw new ContentLoadError(`沒有 ${locale} 的章節索引`, 'missing');
  return cached<ChapterSummary[]>(path);
}

export async function loadTombstones(): Promise<Tombstone[]> {
  const m = await loadManifest();
  return cached<Tombstone[]>(m.tombstones);
}

/** 題目所在的關卡（manifest 的 levels[].questionIds）；一題只屬於一關（08 第 3.5 節） */
export async function findLevelOfQuestion(questionId: string): Promise<LevelManifestEntry | undefined> {
  const m = await loadManifest();
  return (m.levels ?? []).find((l) => l.questionIds.includes(questionId));
}

/** 錯題本用：依題目 ID 找回題目與所屬關卡；題目不在任何關卡（下架或草稿）時回傳 undefined，由呼叫端再查 resolveId */
export async function loadQuestion(questionId: string, locale: Locale): Promise<{ question: QuestionSnapshot; level: LevelSnapshot['level'] } | undefined> {
  const entry = await findLevelOfQuestion(questionId);
  if (!entry) return undefined;
  const snapshot = await loadLevel(entry.id, locale);
  const question = snapshot.questions.find((q) => q.id === questionId);
  return question ? { question, level: snapshot.level } : undefined;
}

/** ID 的墓碑處理（08 第 7.3 節）：快照裡找得到就是 active；只在墓碑檔裡的是 retired（可能有替代項目）；都沒有就是 unknown */
export async function resolveId(id: string, locale: Locale = 'zh-TW'): Promise<ResolvedId> {
  const m = await loadManifest();
  const kind = kindOfId(id);
  if (kind !== undefined) {
    const active =
      kind === 'term'
        ? false
        : kind === 'chapter'
          ? m.chapters.some((c) => c.id === id)
          : kind === 'level'
            ? (m.levels ?? []).some((l) => l.id === id)
            : kind === 'question'
              ? (m.levels ?? []).some((l) => l.questionIds.includes(id))
              : false;
    if (active) return { status: 'active', kind };
    if (kind === 'term') {
      const terms = await loadTermIndex(locale);
      if (terms.some((t) => t.id === id)) return { status: 'active', kind };
    }
  }
  const tombstones = await loadTombstones();
  const t = tombstones.find((x) => x.id === id);
  if (t) {
    const note = t.retiredNote?.[locale] ?? t.retiredNote?.['zh-TW'];
    return {
      status: 'retired',
      kind: t.kind,
      ...(t.supersededBy === undefined ? {} : { supersededBy: t.supersededBy }),
      ...(note === undefined ? {} : { retiredNote: note }),
    };
  }
  return { status: 'unknown' };
}

function kindOfId(id: string): Tombstone['kind'] | undefined {
  const prefix = id.slice(0, id.indexOf('_'));
  switch (prefix) {
    case 'tm':
      return 'term';
    case 'ch':
      return 'chapter';
    case 'obj':
      return 'objective';
    case 'lv':
      return 'level';
    case 'q':
      return 'question';
    case 'st':
      return 'story';
    default:
      return undefined;
  }
}
