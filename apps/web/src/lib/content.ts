// ContentSource（執行期，唯讀；08 第 7.4 節的 M0b 子集）：讀 content-manifest 與依語系切分的快照。
// 所有載入都經過同一個包裝：檢查 Content-Type（SPA fallback 可能回殼層 HTML），拿到 HTML 視同檔案不存在（06 第 9.1 節）。
import type { Locale } from '@ledgerland/i18n';
import { setContentVersion } from './errors.ts';

export interface ContentManifest {
  schemaVersion: number;
  contentVersion: number;
  builtAt: string;
  gitCommit: string;
  locales: Record<string, { status: 'complete' | 'beta' }>;
  chapters: { id: string; order: number; files: Record<string, string> }[];
  terms: Record<string, string>;
  tombstones: string;
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
