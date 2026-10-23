// 儲存層的固定提示（06 第 4.3、4.4 節與第 9.1 節的表）：依 useStorageStatus 的旗標顯示，文案固定，「立即匯出」連到備份頁。
// versionchange 的橫幅不等回到列表頁才顯示（這時已經不能儲存）；記憶體模式的提示常駐、不能關閉。
import { Trans } from '@lingui/react/macro';
import { Link } from 'react-router';
import { localePath } from '@ledgerland/i18n';
import { Banner, Button } from '@ledgerland/web-ui';
import { useStorageStatus } from '../lib/progress/status.ts';
import { useLocale } from '../lib/useLocale.ts';

function ExportLink() {
  const locale = useLocale();
  return (
    <Link className="ll-btn ll-btn--primary" to={localePath(locale, '/me/backup/')}>
      <Trans id="storage.exportNow" comment="儲存失敗提示裡的按鈕">
        立即匯出
      </Trans>
    </Link>
  );
}

export function StorageBanners() {
  const status = useStorageStatus();
  const reload = () => window.location.reload();
  return (
    <>
      {status.suspended && (
        <Banner kind="warning" role="alert" className="ll-storage-banner">
          <p>
            <Trans id="storage.suspended">網站已在其他分頁更新，重新整理後才能繼續儲存進度。</Trans>
          </p>
          <Button variant="primary" onClick={reload}>
            <Trans id="storage.reload">重新整理</Trans>
          </Button>
        </Banner>
      )}
      {status.blocked && !status.suspended && (
        <Banner kind="warning" role="alert" className="ll-storage-banner">
          <p>
            <Trans id="storage.blocked">請關閉其他 LedgerLand 分頁，再重新整理。</Trans>
          </p>
          <Button variant="primary" onClick={reload}>
            <Trans id="storage.reload">重新整理</Trans>
          </Button>
        </Banner>
      )}
      {status.degraded && (
        <Banner kind="danger" role="alert" className="ll-storage-banner">
          <p>
            <Trans id="storage.degraded">這台裝置目前無法儲存進度。你可以繼續練習，但請先匯出備份。</Trans>
          </p>
          <ExportLink />
        </Banner>
      )}
      {status.quotaExceeded && !status.degraded && (
        <Banner kind="warning" role="alert" className="ll-storage-banner">
          <p>
            <Trans id="storage.quota">這台裝置的儲存空間不太夠，進度可能存不進去。建議你先匯出備份。</Trans>
          </p>
          <ExportLink />
        </Banner>
      )}
      {status.writeFailed && !status.degraded && !status.quotaExceeded && !status.suspended && (
        <Banner kind="warning" role="alert" className="ll-storage-banner">
          <p>
            <Trans id="storage.writeFailed">進度暫時無法儲存。重要進度已先暫存起來，建議你現在匯出備份。</Trans>
          </p>
          <div className="ll-row">
            <ExportLink />
            <Button onClick={reload}>
              <Trans id="storage.reload">重新整理</Trans>
            </Button>
          </div>
        </Banner>
      )}
    </>
  );
}
