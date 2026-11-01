// 實驗室頁面共用的載入：故事快照（目前語系）、核心（lab-core.ts，延後載入）與進度一起開始讀，全部到齊才回傳；
// 頁面用它當 usePageReady 的條件，整頁一次出現（lib/page-ready.tsx）。讀不到故事是 missing（找不到頁面）或 network（離線，可重試）。
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Locale } from '@ledgerland/i18n';
import { ContentLoadError, loadStory, type StorySnapshot } from '../../lib/content.ts';
import { labCoreNow, loadLabCore, type LabCore } from './lazy-core.ts';
import { readStoryProgress, type LabProgressSnapshot } from './progress.ts';

export type LabLoad =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly error: ContentLoadError }
  | { readonly kind: 'ok'; readonly story: StorySnapshot; readonly core: LabCore; readonly progress: LabProgressSnapshot };

export function useLabStory(storyId: string | undefined, locale: Locale): LabLoad & { retry: () => void; refreshProgress: () => void } {
  const [state, setState] = useState<LabLoad>({ kind: 'loading' });
  const load = useCallback(() => {
    let alive = true;
    // 還不知道故事 ID（子頁先讀 manifest）：停在 loading
    if (!storyId) {
      setState({ kind: 'loading' });
      return () => {};
    }
    setState((s) => (s.kind === 'ok' && s.story.id === storyId ? s : { kind: 'loading' }));
    Promise.all([loadStory(storyId, locale), labCoreNow() ?? loadLabCore(), readStoryProgress(storyId)]).then(
      ([story, core, progress]) => alive && setState({ kind: 'ok', story, core, progress }),
      (e: unknown) => alive && setState({ kind: 'error', error: e instanceof ContentLoadError ? e : new ContentLoadError(String(e), 'network') }),
    );
    return () => {
      alive = false;
    };
  }, [storyId, locale]);
  useEffect(() => load(), [load]);
  // 「再試一次」只在讀取失敗時出現（沒有進行中的讀取），不必保留取消函式
  const retry = useCallback(() => void load(), [load]);
  const refreshProgress = useCallback(() => {
    if (!storyId) return;
    void readStoryProgress(storyId).then((progress) => setState((s) => (s.kind === 'ok' && s.story.id === storyId ? { ...s, progress } : s)));
  }, [storyId]);
  return useMemo(() => ({ ...state, retry, refreshProgress }), [state, retry, refreshProgress]);
}

/** 只要核心（指標實驗室、自由實驗讀範本清單時也要故事，所以通常用 useLabStory） */
export function useLabCore(): { core: LabCore | null; error: unknown } {
  const [state, setState] = useState<{ core: LabCore | null; error: unknown }>(() => ({ core: labCoreNow(), error: undefined }));
  useEffect(() => {
    if (state.core !== null || state.error !== undefined) return;
    let alive = true;
    loadLabCore().then(
      (core) => alive && setState({ core, error: undefined }),
      (error: unknown) => alive && setState({ core: null, error }),
    );
    return () => {
      alive = false;
    };
  }, [state]);
  return state;
}
