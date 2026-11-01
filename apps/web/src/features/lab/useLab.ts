// 實驗室頁面共用的載入：故事快照（目前語系）、核心（lab-core.ts，延後載入）與進度一起開始讀，全部到齊才回傳；
// 頁面用它當 usePageReady 的條件，整頁一次出現（lib/page-ready.tsx）。讀不到故事是 missing（找不到頁面）或 network（離線，可重試）。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

/** 步驟頁的載入（V24，06 第 8.2 節）：故事快照與進度齊了就回 ok，核心不在裡面；交易卡、恆等式與預測先用快照的 firstPaint 畫，
 *  核心由頁面在畫面掀開之後（或使用者要往階段 3 走時）用 loadCore 載入，載好以後 core 不再是 null。從故事頁換頁過來時核心早就載好（labCoreNow）。
 *  核心載入失敗時 coreError 有值，頁面在使用者要用到核心的地方顯示錯誤與重試（再呼叫 loadCore）。 */
export type LabStepLoad =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly error: ContentLoadError }
  | { readonly kind: 'ok'; readonly story: StorySnapshot; readonly progress: LabProgressSnapshot };

export function useLabStepLoad(
  storyId: string | undefined,
  locale: Locale,
): LabStepLoad & { core: LabCore | null; coreError: unknown; loadCore: () => void; retry: () => void; refreshProgress: () => void } {
  const [state, setState] = useState<LabStepLoad>({ kind: 'loading' });
  const [coreState, setCoreState] = useState<{ core: LabCore | null; error: unknown }>(() => ({ core: labCoreNow(), error: undefined }));
  const load = useCallback(() => {
    let alive = true;
    if (!storyId) {
      setState({ kind: 'loading' });
      return () => {};
    }
    setState((s) => (s.kind === 'ok' && s.story.id === storyId ? s : { kind: 'loading' }));
    Promise.all([loadStory(storyId, locale), readStoryProgress(storyId)]).then(
      ([story, progress]) => alive && setState({ kind: 'ok', story, progress }),
      (e: unknown) => alive && setState({ kind: 'error', error: e instanceof ContentLoadError ? e : new ContentLoadError(String(e), 'network') }),
    );
    return () => {
      alive = false;
    };
  }, [storyId, locale]);
  useEffect(() => load(), [load]);
  const retry = useCallback(() => void load(), [load]);
  const refreshProgress = useCallback(() => {
    if (!storyId) return;
    void readStoryProgress(storyId).then((progress) => setState((s) => (s.kind === 'ok' && s.story.id === storyId ? { ...s, progress } : s)));
  }, [storyId]);
  // 載入核心（冪等）：已經載好或正在載就不再發；失敗後再呼叫會重新 import（lazy-core.ts 不留著被拒絕的 Promise）
  const loading = useRef(false);
  const loadCore = useCallback(() => {
    const now = labCoreNow();
    if (now !== null) {
      setCoreState((s) => (s.core === now ? s : { core: now, error: undefined }));
      return;
    }
    if (loading.current) return;
    loading.current = true;
    loadLabCore().then(
      (core) => {
        loading.current = false;
        setCoreState({ core, error: undefined });
      },
      (error: unknown) => {
        loading.current = false;
        setCoreState({ core: null, error });
      },
    );
  }, []);
  return useMemo(
    () => ({ ...state, core: coreState.core, coreError: coreState.error, loadCore, retry, refreshProgress }),
    [state, coreState, loadCore, retry, refreshProgress],
  );
}
