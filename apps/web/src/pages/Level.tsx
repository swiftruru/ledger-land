// 作答頁（02 第 5 節、03 第 2.4 到 2.12 節）：讀關卡快照與章節標示（延伸章、非投資建議），交給 features/quiz/LevelSession.tsx。
// 頁面 chunk 只留載入與錯誤狀態：它在殼層依路徑預先載入的第一波裡，越小越好（06 第 8.2 節、LevelSession.tsx 開頭的說明）。
// 從 QR 或代號進入（?via=qr、?via=code）時不顯示建議提示（地圖那邊處理）。
// 沒有骨架（維護者 2026-10-26：點進任何一頁都要直接看到完整的資訊）：快照還在讀時只畫頁首並以 usePageReady(false) 讓整頁先不顯示（lib/page-ready.tsx），
// 題目齊了（LevelSession 另外回報）整頁一次淡入。TermsProvider 包在所有狀態外面，名詞索引和關卡快照同時開始讀，不是一個等一個。
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { localePath } from '@ledgerland/i18n';
import { Button, ErrorState, TopBar, useUiLabels } from '@ledgerland/web-ui';
import { MapIcon } from '@ledgerland/web-ui/map';
import { levelNotesOf, type LevelNotes } from '../features/quiz/level-notes.ts';
import { LevelSession, QuizLangSwitch } from '../features/quiz/LevelSession.tsx';
import { phraseModule } from '../features/quiz-phrase/quiz-phrase.ts';
import { TermsProvider } from '../features/quiz/terms.tsx';
import { ContentLoadError, loadChapterIndex, loadLevel, loadManifest, type LevelSnapshot } from '../lib/content.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { useLocale } from '../lib/useLocale.ts';
import { NotFound } from './NotFound.tsx';

type LoadState = { kind: 'loading' } | { kind: 'error'; error: ContentLoadError } | { kind: 'ok'; snapshot: LevelSnapshot; notes: LevelNotes };

export function useLevelSnapshot(levelId: string | undefined, locale: 'zh-TW' | 'en'): LoadState & { retry: () => void } {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  // 讀取（也是「再試一次」）：content.ts 在失敗時已經放掉快取，會重新 fetch。回傳的函式取消這一次（換關、換語言時較慢的舊回應不寫入）
  const load = useCallback(() => {
    let alive = true;
    setState({ kind: 'loading' });
    if (!levelId) {
      setState({ kind: 'error', error: new ContentLoadError('沒有關卡 ID', 'missing') });
      return () => {};
    }
    // manifest 在 loadLevel 裡已經讀過（同一個快取），章節的 scope、examScope 與 notices 和關卡一起到，標示不會晚一步出現把題目往下推
    Promise.all([loadLevel(levelId, locale), loadManifest()]).then(
      ([snapshot, manifest]) =>
        alive &&
        setState({
          kind: 'ok',
          snapshot,
          notes: levelNotesOf(manifest.chapters.find((c) => c.id === snapshot.level.chapterId)),
        }),
      (e: unknown) => alive && setState({ kind: 'error', error: e instanceof ContentLoadError ? e : new ContentLoadError(String(e), 'network') }),
    );
    return () => {
      alive = false;
    };
  }, [levelId, locale]);
  useEffect(() => load(), [load]);
  // 「再試一次」只在讀取失敗時出現（沒有進行中的讀取），不必保留取消函式
  const retry = useCallback(() => void load(), [load]);
  return { ...state, retry };
}

export default function Level() {
  const { levelId } = useParams();
  const locale = useLocale();
  const state = useLevelSnapshot(levelId, locale);
  let content: ReactNode;
  if (state.kind === 'loading') content = <LevelLoading levelId={levelId} />;
  else if (state.kind === 'error') content = state.error.kind === 'missing' ? <NotFound /> : <OfflineError levelId={levelId} onRetry={state.retry} />;
  else content = <LevelSession snapshot={state.snapshot} notes={state.notes} />;
  return (
    <TermsProvider locale={locale} phrase={phraseModule}>
      {content}
    </TermsProvider>
  );
}

/** 關卡快照還在讀：整頁還不顯示（usePageReady(false)），只畫和作答頁同一個結構的頁首（TopBar compact、右側語言切換；h1 裡是視覺隱藏的「載入中」，
 *  換頁焦點有地方落），快照到了換成題目時頁首不跳 */
function LevelLoading({ levelId }: { levelId: string | undefined }) {
  const { t } = useLingui();
  const locale = useLocale();
  const labels = useUiLabels();
  usePageReady(false);
  return (
    <div className="ll-level-head">
      <TopBar
        compact
        title={<span className="ll-sr-only">{labels.loading}</span>}
        backHref={localePath(locale, levelId ? `/play/?from=${encodeURIComponent(levelId)}` : '/play/')}
        backLabel={t({ id: 'level.back', message: '離開這一關，回到闖關地圖', comment: '作答頁頁首返回圖示的可讀名稱（不跳確認，作答已暫存）' })}
        actions={<QuizLangSwitch />}
      />
    </div>
  );
}

/** 關卡快照讀不到（離線又沒有快取，站規 2.4.1、2.18）：頁首和載入中、作答中同一個結構（TopBar compact、圖示返回地圖、右側語言切換），
 *  標題是章節索引裡的關卡名稱（章節索引在 precache，通常讀得到；讀不到就用「還沒下載的關卡」），名稱定了整頁才顯示（usePageReady）。下面一個 ErrorState（鈴）：
 *  「再試一次」重讀，另一顆 secondary「回到地圖」（和結果頁、錯題本完成同一種說法）。說明只有一句，不再重複「還沒下載到這台裝置」。
 *  手機在剩下的高度裡置中；600px 以上是一張和錯題本空狀態同一種的卡片，緊接在頁首下方（M3 驗收第 5 輪，版面在 15-quiz-session.css 的 .ll-level-offline）。 */
function OfflineError({ levelId, onRetry }: { levelId: string | undefined; onRetry: () => void }) {
  const { t } = useLingui();
  const locale = useLocale();
  const labels = useUiLabels();
  const levelTitle = useIndexedLevelTitle(levelId, locale);
  usePageReady(levelTitle !== undefined);
  return (
    <>
      <div className="ll-level-head">
        <TopBar
          compact
          title={
            levelTitle === undefined ? (
              <span className="ll-sr-only">{labels.loading}</span>
            ) : (
              (levelTitle ?? t({ id: 'level.unavailable.short', message: '還沒下載的關卡', comment: '關卡讀不到、章節索引也找不到名稱時，作答頁頁首的標題' }))
            )
          }
          backHref={localePath(locale, levelId ? `/play/?from=${encodeURIComponent(levelId)}` : '/play/')}
          backLabel={t({ id: 'level.back', message: '離開這一關，回到闖關地圖', comment: '作答頁頁首返回圖示的可讀名稱（不跳確認，作答已暫存）' })}
          actions={<QuizLangSwitch />}
        />
      </div>
      <ErrorState
        className="ll-level-offline"
        // 標題與說明的詞包成 .ll-nowrap（全站換行規則，M3 驗收第 7 輪）：說明在逗號後換行（不是「已下載／的內容」），文字放大時「下載」不拆開
        title={
          <Trans id="level.unavailable.heading" comment="關卡快照載入失敗時的標題；標籤包住的詞不換行">
            這一關<span className="ll-nowrap">還沒下載</span>到<span className="ll-nowrap">這台裝置</span>
          </Trans>
        }
        description={
          <Trans id="level.unavailable.retryNote" comment="關卡讀不到時的說明（標題已經說了還沒下載，這裡不重複）；標籤包住的詞不換行">
            <span className="ll-nowrap">連上網路後</span>
            <span className="ll-nowrap">再試一次</span>，<span className="ll-nowrap">已下載的內容</span>
            <span className="ll-nowrap">現在也能</span>
            <span className="ll-nowrap">繼續使用</span>。
          </Trans>
        }
        onRetry={onRetry}
        action={
          <Button icon={<MapIcon />} href={localePath(locale, '/play/')}>
            {t({
              id: 'level.unavailable.backToMap',
              message: '回到地圖',
              comment: '關卡讀不到時回到闖關地圖的按鈕（和結果頁、錯題本完成的「回到地圖」同一種說法）',
            })}
          </Button>
        }
      />
    </>
  );
}

/** 從章節索引找關卡名稱：還在讀是 undefined，找不到是 null */
function useIndexedLevelTitle(levelId: string | undefined, locale: 'zh-TW' | 'en'): string | null | undefined {
  const [title, setTitle] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    if (!levelId) {
      setTitle(null);
      return undefined;
    }
    loadChapterIndex(locale).then(
      (chapters) => alive && setTitle(chapters.flatMap((c) => c.levels ?? []).find((l) => l.id === levelId)?.title ?? null),
      () => alive && setTitle(null),
    );
    return () => {
      alive = false;
    };
  }, [levelId, locale]);
  return title;
}
