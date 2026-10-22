// 每條路由的 ErrorBoundary（06 第 9.1 節）：友善訊息、回到首頁；動態載入失敗（部署後舊 chunk 不存在）時提示重新整理，同一個分頁只自動建議一次。
import { Trans } from '@lingui/react/macro';
import { useEffect } from 'react';
import { Link, isRouteErrorResponse, useLocation, useRouteError } from 'react-router';
import { localeFromPath, localePath } from '@ledgerland/i18n';
import { Banner, Button } from '@ledgerland/web-ui';
import { ContentLoadError } from '../lib/content.ts';
import { logError } from '../lib/errors.ts';

const isChunkError = (e: unknown) =>
  (e instanceof ContentLoadError && e.kind === 'missing') ||
  (e instanceof Error &&
    /(Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Load failed)/i.test(e.message));

export function RouteError() {
  const error = useRouteError();
  const location = useLocation();
  const locale = localeFromPath(location.pathname);
  const chunk = isChunkError(error);
  useEffect(() => {
    const e = error as { message?: string; stack?: string; status?: number } | undefined;
    void logError(isRouteErrorResponse(error) ? `route ${error.status}` : (e?.message ?? String(error)), e?.stack ?? '');
  }, [error]);
  const reload = () => {
    try {
      sessionStorage.setItem('ll:reloaded-once', '1');
    } catch {
      /* 忽略 */
    }
    window.location.reload();
  };
  return (
    <>
      <h1>
        {chunk ? (
          <Trans id="error.updated.title" comment="部署後舊頁面載入已不存在的檔案時的標題">
            網站已更新
          </Trans>
        ) : (
          <Trans id="error.generic.title">出了一點問題</Trans>
        )}
      </h1>
      <Banner kind="warning" role="alert">
        {chunk ? (
          <Trans id="error.updated.body">網站已更新，重新整理即可繼續。你的進度已經存好。</Trans>
        ) : (
          <Trans id="error.generic.body">這一頁暫時無法顯示。你可以回到首頁，或先把這個畫面截圖回報給我們。</Trans>
        )}
      </Banner>
      <div className="ll-row">
        {chunk && (
          <Button variant="primary" onClick={reload}>
            <Trans id="error.reload">重新整理</Trans>
          </Button>
        )}
        <Link className="ll-btn" to={localePath(locale, '/')}>
          <Trans id="error.home">回到首頁</Trans>
        </Link>
      </div>
    </>
  );
}
