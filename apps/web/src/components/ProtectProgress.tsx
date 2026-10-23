// 設定頁的「保護我的進度」（06 第 4.5 節、02 第 6 節）：按下去呼叫 maybePersist('settings-button')。
// 文案只能寫「降低機率」，不得寫「安裝後就不會被刪」。Firefox 會跳權限提示，按鈕旁先說明；App 內建瀏覽器不顯示整個區塊。
import { Trans } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { Button } from '@ledgerland/web-ui';
import { isGeckoFirefox, isInAppBrowser } from '../lib/env.ts';
import { maybePersist, refreshPersisted, type PersistOutcome } from '../lib/progress/persist.ts';
import { useStorageStatus } from '../lib/progress/status.ts';

export function ProtectProgress() {
  const persisted = useStorageStatus((s) => s.persisted);
  const [outcome, setOutcome] = useState<PersistOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void refreshPersisted();
  }, []);
  if (isInAppBrowser()) return null;
  const run = async () => {
    setBusy(true);
    try {
      setOutcome(await maybePersist('settings-button'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ll-settings">
      <h2 className="ll-small ll-muted">
        <Trans id="settings.protect.title">保護我的進度</Trans>
      </h2>
      <p className="ll-small">
        <Trans id="settings.protect.hint" comment="06 第 4.5 節：只能寫「降低機率」">
          加到主畫面，可以降低進度被清除的機率；定期匯出備份最保險。
        </Trans>
      </p>
      {isGeckoFirefox() && (
        <p className="ll-small ll-muted">
          <Trans id="settings.protect.firefox">按下後瀏覽器會詢問是否允許保留資料。</Trans>
        </p>
      )}
      <div className="ll-row">
        <Button variant="primary" onClick={() => void run()} disabled={busy || persisted === true}>
          <Trans id="settings.protect.button">保護我的進度</Trans>
        </Button>
        <output className="ll-small" data-testid="persist-result">
          {persisted === true ? (
            <Trans id="settings.protect.state.on">這個瀏覽器已同意保留進度。</Trans>
          ) : outcome === 'denied' ? (
            <Trans id="settings.protect.state.denied">瀏覽器沒有同意，請定期匯出備份。</Trans>
          ) : outcome === 'unsupported' ? (
            <Trans id="settings.protect.state.unsupported">這個瀏覽器不支援這項設定，請定期匯出備份。</Trans>
          ) : outcome === 'skipped' ? (
            <Trans id="settings.protect.state.skipped">這個環境不適用，請定期匯出備份。</Trans>
          ) : persisted === false ? (
            <Trans id="settings.protect.state.off">尚未取得保留許可。</Trans>
          ) : null}
        </output>
      </div>
    </div>
  );
}
