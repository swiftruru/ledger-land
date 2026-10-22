// prompt 模式的更新提示（06 第 3.3 節）：絕不自動 skipWaiting；作答頁不顯示提示，只記下「有更新」；第一次可以離線時提示一次（06 第 3.2 節）
import { Trans } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { useMatches } from 'react-router';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button, Card } from '@ledgerland/web-ui';
import type { RouteHandle } from '../app/router.tsx';

const HOUR = 60 * 60 * 1000;
const VISIBLE_THROTTLE = 30 * 60 * 1000;

export const swState: { registration: ServiceWorkerRegistration | null; swUrl: string | null; lastCheck: number | null; error: string | null } = {
  registration: null,
  swUrl: null,
  lastCheck: null,
  error: null,
};

export function UpdatePrompt() {
  const [dismissed, setDismissed] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(e) {
      swState.error = String(e);
    },
    onRegisteredSW(swUrl, r) {
      swState.registration = r ?? null;
      swState.swUrl = swUrl;
      if (!r) return;
      const started = Date.now();
      // 先確認在線上而且 sw.js 可取得，才呼叫 update()；註冊後 1 分鐘內不重複觸發
      const check = async () => {
        if (Date.now() - started < 60_000) return;
        if (!navigator.onLine) return;
        const res = await fetch(swUrl, { cache: 'no-store' }).catch(() => null);
        if (res?.status !== 200) return;
        swState.lastCheck = Date.now();
        await r.update();
      };
      setInterval(check, HOUR);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && Date.now() - (swState.lastCheck ?? started) > VISIBLE_THROTTLE) void check();
      });
    },
  });
  const matches = useMatches();
  const blocked = matches.some((m) => (m.handle as RouteHandle | undefined)?.blocksUpdatePrompt);

  useEffect(() => {
    if (!needRefresh) setDismissed(false);
  }, [needRefresh]);

  if (offlineReady && !needRefresh && !blocked) {
    return (
      <Card className="ll-update" role="status">
        <p>
          <Trans id="sw.offlineReady" comment="第一次快取完成、可以離線使用時的一次性提示">
            已經可以離線使用了。
          </Trans>
        </p>
        <div className="ll-row">
          <Button onClick={() => setOfflineReady(false)}>
            <Trans id="common.ok">知道了</Trans>
          </Button>
        </div>
      </Card>
    );
  }
  if (!needRefresh || blocked || dismissed) return null;
  return (
    <Card className="ll-update" role="status">
      <p>
        <Trans id="sw.updateAvailable">有新版本可以使用。你的進度已經存好，按「更新」就會重新載入。</Trans>
      </p>
      <div className="ll-row">
        <Button variant="primary" onClick={() => void updateServiceWorker(true)}>
          <Trans id="sw.update">更新</Trans>
        </Button>
        <Button
          onClick={() => {
            setDismissed(true);
            setNeedRefresh(false);
          }}
        >
          <Trans id="sw.later">稍後</Trans>
        </Button>
      </div>
    </Card>
  );
}
