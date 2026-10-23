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
  chapters: { id: string; order: number; levelIds?: string[]; files: Record<string, string> }[];
  /** M2 起：每關一檔 { level, questions }，questions 依 questionIds 順序，每題帶 answerRev 與核心算出的 compiled（tools/lib/content-snapshot.mjs） */
  levels?: LevelManifestEntry[];
  terms: Record<string, string>;
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
    expectedEntries?: readonly unknown[];
    ratio?: unknown;
    categories?: Record<string, string>;
    /** pick_line：該報表在交易後（cumulative）的可見列與核心算出的金額，label 已依語系展開；total 是合計或公式列，heading 是群組標題列 */
    lines?: CompiledLine[];
  };
  [field: string]: unknown;
}

export interface CompiledLine {
  id: string;
  label: string;
  value: number;
  level?: number;
  total?: boolean;
  heading?: boolean;
}

export interface TermSnapshot {
  id: string;
  category: string;
  label: string;
  teacherLabel: string;
  currentTwLabel: string | null;
  ifrsEnglish: string | null;
  definition: string;
  note?: string;
  ifrsNote?: string;
  related?: string[];
  flags: string[];
}

export class ContentLoadError extends Error {
  constructor(
    message: string,
    public readonly kind: 'missing' | 'network' | 'invalid',
  ) {
    super(message);
  }
}

const SUPPORTED_SCHEMA = 1;
let manifestPromise: Promise<ContentManifest> | null = null;
const cache = new Map<string, Promise<unknown>>();

async function fetchJson<T>(path: string): Promise<T> {
  let res: Response;
  try {
    // 同源請求用預設的 credentials（殼層的 preload 才會被重用；本站沒有 cookie）
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

export async function loadTerms(locale: Locale): Promise<TermSnapshot[]> {
  const m = await loadManifest();
  const path = m.terms[locale];
  if (!path) throw new ContentLoadError(`沒有 ${locale} 的名詞快照`, 'missing');
  let p = cache.get(path) as Promise<TermSnapshot[]> | undefined;
  if (!p) {
    p = fetchJson<TermSnapshot[]>(`/${path}`);
    cache.set(path, p);
    p.catch(() => cache.delete(path));
  }
  return p;
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
      const terms = await loadTerms(locale);
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
