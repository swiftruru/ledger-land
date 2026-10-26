// 每條路由的 ErrorBoundary（06 第 9.1 節）：友善訊息、重新整理與回到首頁；動態載入失敗（部署後舊 chunk 不存在）時提示網站已更新，同一個分頁只自動建議一次。
// 外觀（站規 2.16、2.18）：只有一個 ErrorState（鈴托腮），h1 是標題（換頁焦點）；主動作 primary md「重新整理」帶 RetryIcon、secondary md「回到首頁」帶 HouseIcon。
// Root 本身出錯時這裡在 LinkProvider 外面，「回到首頁」退回一般的整頁連結，這時重新載入正好是需要的。
import { Trans } from '@lingui/react/macro';
import { useEffect } from 'react';
import { isRouteErrorResponse, useLocation, useRouteError } from 'react-router';
import { localeFromPath, localePath } from '@ledgerland/i18n';
import { Button, ErrorState, HouseIcon, RetryIcon } from '@ledgerland/web-ui';
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
    <ErrorState
      className="ll-route-error"
      data-testid="route-error"
      titleAs="h1"
      title={
        chunk ? (
          <Trans id="error.updated.title" comment="部署後舊頁面載入已不存在的檔案時的標題">
            網站已更新
          </Trans>
        ) : (
          <Trans id="error.generic.title">出了一點問題</Trans>
        )
      }
      description={
        chunk ? (
          <Trans id="error.updated.hint" comment="網站已更新的說明（標題已經說了「網站已更新」）">
            重⁠新整⁠理一⁠下就能繼⁠續，你⁠的進⁠度已⁠經⁠存⁠好。
          </Trans>
        ) : (
          <Trans id="error.generic.hint" comment="路由錯誤頁的說明；按鈕是「重新整理」與「回到首頁」">
            這一⁠頁暫⁠時無⁠法顯⁠示。可⁠以重⁠新整⁠理再⁠試一⁠次，或先⁠回⁠到首⁠頁；如⁠果一⁠直出⁠現，請⁠把這⁠個畫⁠面⁠截⁠圖⁠回⁠報給我⁠們。
          </Trans>
        )
      }
      action={[
        <Button key="reload" variant="primary" icon={<RetryIcon />} onClick={reload}>
          <Trans id="error.reload">重新整理</Trans>
        </Button>,
        <Button key="home" icon={<HouseIcon />} href={localePath(locale, '/')}>
          <Trans id="error.home">回到首頁</Trans>
        </Button>,
      ]}
    />
  );
}
