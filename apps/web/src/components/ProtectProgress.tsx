// 設定頁的「保護我的進度」（06 第 4.5 節、02 第 6 節）：按下去呼叫 maybePersist('settings-button')。
// 文案只能寫「降低機率」，不得寫「安裝後就不會被刪」。Firefox 會跳權限提示，按鈕旁先說明；App 內建瀏覽器不顯示整個區塊。
// 外觀（站規 2.9）：Button primary md；已保護時停用，旁邊顯示 CheckIcon 加「已開啟」；按下等待時是 busy。
// 說明句用 Phrased（中文只在詞與詞之間換行，M3 驗收第 6 輪：375 的「定／期匯出備份最保險」）。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { Button, CheckIcon, ShieldIcon } from '@ledgerland/web-ui';
import { Phrased } from '../features/me/Phrased.tsx';
import { isGeckoFirefox, isInAppBrowser } from '../lib/env.ts';
import { maybePersist, refreshPersisted, type PersistOutcome } from '../lib/progress/persist.ts';
import { useStorageStatus } from '../lib/progress/status.ts';

export function ProtectProgress() {
  const { t } = useLingui();
  const persisted = useStorageStatus((s) => s.persisted);
  const [outcome, setOutcome] = useState<PersistOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void refreshPersisted();
  }, []);
  if (isInAppBrowser()) return null;
  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      setOutcome(await maybePersist('settings-button'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ll-settings">
      <h2 className="ll-settings__title">
        <Trans id="settings.protect.title">保護我的進度</Trans>
      </h2>
      <p className="ll-small">
        <Phrased
          text={t({
            id: 'settings.protect.hint',
            message: '加到主畫面，可以降低進度被清除的機率；定期匯出備份最保險。',
            comment: '06 第 4.5 節：只能寫「降低機率」',
          })}
        />
      </p>
      {isGeckoFirefox() && (
        <p className="ll-small ll-muted">
          <Trans id="settings.protect.firefox">按下後瀏覽器會詢問是否允許保留資料。</Trans>
        </p>
      )}
      <div className="ll-row ll-protect">
        <Button variant="primary" icon={<ShieldIcon />} busy={busy} onClick={() => void run()} disabled={persisted === true}>
          <Trans id="settings.protect.button">保護我的進度</Trans>
        </Button>
        <output className={`ll-small${persisted === true ? ' ll-statusline ll-ok' : ''}`} data-testid="persist-result">
          {persisted === true ? (
            <>
              <CheckIcon />
              <span>
                <Trans id="settings.protect.state.enabled" comment="已取得保留許可：按鈕停用，旁邊顯示這句">
                  已開啟，這個瀏覽器同意保留進度。
                </Trans>
              </span>
            </>
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
