// 儲存層的固定提示（06 第 4.3、4.4 節與第 9.1 節的表）：依 useStorageStatus 的旗標顯示，文案固定，「立即匯出」連到備份頁。
// versionchange 的橫幅不等回到列表頁才顯示（這時已經不能儲存）；記憶體模式的提示常駐、不能關閉。
// 外觀（站規 2.17）：Banner（warning 或 danger，role=alert）；動作都是補救動作，所以在 danger 橫幅裡也用 primary sm（不用 danger 按鈕）：
// 「重新整理」帶 RetryIcon、「立即匯出」帶 ExportIcon；暫時寫入失敗時另有 secondary sm「重新整理」。
// 第 1 輪驗收：橫幅一次只展開一條，儲存層的五種也只顯示最要緊的一種（順序：其他分頁已更新、被其他分頁擋住、無法儲存、空間不足、暫時寫入失敗）；
// 只有這五種（資料會遺失）保留 primary，其他橫幅的主動作都是 secondary。
// 第 4 輪驗收：每條橫幅都有一行標題（全部 15 種狀態同一個結構：標題、內文、動作）。
import { Trans } from '@lingui/react/macro';
import { localePath } from '@ledgerland/i18n';
import { Banner, Button, ExportIcon, RetryIcon } from '@ledgerland/web-ui';
import { useStorageStatus, type StorageStatus } from '../lib/progress/status.ts';
import { useLocale } from '../lib/useLocale.ts';

const reload = () => window.location.reload();

function ExportButton() {
  const locale = useLocale();
  return (
    <Button variant="primary" size="sm" icon={<ExportIcon />} href={localePath(locale, '/me/backup/')}>
      <Trans id="storage.exportNow" comment="儲存失敗提示裡的按鈕，連到備份頁">
        立即匯出
      </Trans>
    </Button>
  );
}

function ReloadButton({ variant }: { variant: 'primary' | 'secondary' }) {
  return (
    <Button variant={variant} size="sm" icon={<RetryIcon />} onClick={reload}>
      <Trans id="storage.reload" comment="儲存提示裡重新整理頁面的按鈕">
        重新整理
      </Trans>
    </Button>
  );
}

/** 目前要顯示哪一種；沒有錯誤時是 null */
export type StorageBannerKind = 'suspended' | 'blocked' | 'degraded' | 'quotaExceeded' | 'writeFailed';

export function storageBannerKind(status: Pick<StorageStatus, StorageBannerKind>): StorageBannerKind | null {
  if (status.suspended) return 'suspended';
  if (status.blocked) return 'blocked';
  if (status.degraded) return 'degraded';
  if (status.quotaExceeded) return 'quotaExceeded';
  if (status.writeFailed) return 'writeFailed';
  return null;
}

export function StorageBanners() {
  const status = useStorageStatus();
  const kind = storageBannerKind(status);
  return (
    <>
      {kind === 'suspended' && (
        <Banner
          kind="warning"
          role="alert"
          className="ll-storage-banner"
          data-testid="storage-suspended"
          title={
            <Trans id="storage.suspended.title" comment="儲存層橫幅的標題">
              進度暫停儲存
            </Trans>
          }
          actions={<ReloadButton variant="primary" />}
        >
          <p>
            <Trans id="storage.suspended">網站已在其他分頁更新，重新整理後才能繼續儲存進度。</Trans>
          </p>
        </Banner>
      )}
      {kind === 'blocked' && (
        <Banner
          kind="warning"
          role="alert"
          className="ll-storage-banner"
          data-testid="storage-blocked"
          title={
            <Trans id="storage.blocked.title" comment="儲存層橫幅的標題">
              其他分頁擋住了儲存
            </Trans>
          }
          actions={<ReloadButton variant="primary" />}
        >
          <p>
            <Trans id="storage.blocked">請⁠關⁠閉其⁠他 LedgerLand 分⁠頁，再重⁠新整⁠理。</Trans>
          </p>
        </Banner>
      )}
      {kind === 'degraded' && (
        <Banner
          kind="danger"
          role="alert"
          className="ll-storage-banner"
          data-testid="storage-degraded"
          title={
            <Trans id="storage.degraded.title" comment="儲存層橫幅的標題">
              無法儲存進度
            </Trans>
          }
          actions={<ExportButton />}
        >
          <p>
            <Trans id="storage.degraded">這台⁠裝⁠置目⁠前無⁠法儲⁠存進⁠度。你可⁠以繼⁠續練⁠習，但請⁠先匯⁠出備⁠份。</Trans>
          </p>
        </Banner>
      )}
      {kind === 'quotaExceeded' && (
        <Banner
          kind="warning"
          role="alert"
          className="ll-storage-banner"
          data-testid="storage-quota"
          title={
            <Trans id="storage.quota.title" comment="儲存層橫幅的標題">
              儲存空間不足
            </Trans>
          }
          actions={<ExportButton />}
        >
          <p>
            <Trans id="storage.quota">這台⁠裝⁠置⁠的儲⁠存空⁠間不⁠太⁠夠，進⁠度可⁠能⁠存⁠不⁠進⁠去。建⁠議你先⁠匯⁠出備⁠份。</Trans>
          </p>
        </Banner>
      )}
      {kind === 'writeFailed' && (
        <Banner
          kind="warning"
          role="alert"
          className="ll-storage-banner"
          data-testid="storage-writeFailed"
          title={
            <Trans id="storage.writeFailed.title" comment="儲存層橫幅的標題">
              儲存暫時失敗
            </Trans>
          }
          actions={
            <>
              <ExportButton />
              <ReloadButton variant="secondary" />
            </>
          }
        >
          <p>
            <Trans id="storage.writeFailed">進⁠度暫⁠時無⁠法儲⁠存。重⁠要進⁠度⁠已⁠先⁠暫⁠存起⁠來，建⁠議你現⁠在匯⁠出備⁠份。</Trans>
          </p>
        </Banner>
      )}
    </>
  );
}
