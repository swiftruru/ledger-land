// prompt 模式的更新提示（06 第 3.3 節）：絕不自動 skipWaiting；作答頁不顯示提示，只記下「有更新」。第一次可以離線時不再跳提示（使用者 2026-10-23 決定，06 第 3.2 節），離線就緒的狀態只在 debug 頁顯示
// 分兩半（第 1 輪驗收：一次只展開一條，更新提示不再另外浮在 Tab bar 上方）：UpdatePrompt 掛在 Root、只負責註冊 Service Worker 與判斷要不要提示，
// 結果放進這個檔案的小 store；橫幅本身（UpdateBanner）由 Banners.tsx 依優先順序畫在頁首下方的橫幅位置（banner-rules.ts：儲存層錯誤之後就是它）。
// 外觀（站規 2.17，第 1 輪驗收改）：Banner（info），主動作 secondary sm「重新整理」帶 RetryIcon（畫面上唯一的 primary 留給頁面主卡）、quiet sm「稍後」
import { Trans } from '@lingui/react/macro';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useMatches } from 'react-router';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Banner, Button, RetryIcon } from '@ledgerland/web-ui';
import type { RouteHandle } from '../app/router.tsx';
import { bannerFixture } from './banner-fixture.ts';

const HOUR = 60 * 60 * 1000;
const VISIBLE_THROTTLE = 30 * 60 * 1000;

export const swState: {
  registration: ServiceWorkerRegistration | null;
  swUrl: string | null;
  lastCheck: number | null;
  error: string | null;
  offlineReady: boolean;
} = {
  registration: null,
  swUrl: null,
  lastCheck: null,
  error: null,
  offlineReady: false,
};

/** 更新提示要不要出現，以及兩顆按鈕的動作（UpdatePrompt 寫、Banners 讀） */
export interface UpdateBannerState {
  visible: boolean;
  reload: () => void;
  later: () => void;
}

const HIDDEN: UpdateBannerState = { visible: false, reload: () => {}, later: () => {} };
let current: UpdateBannerState = HIDDEN;
const listeners = new Set<() => void>();

function publish(next: UpdateBannerState | null): void {
  current = next ?? HIDDEN;
  for (const l of listeners) l();
}

export function useUpdateBanner(): UpdateBannerState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

/** 註冊 Service Worker、偵測新版本；畫面上什麼都不畫（橫幅由 Banners 依優先順序畫） */
export function UpdatePrompt() {
  const [dismissed, setDismissed] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady],
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
  useEffect(() => {
    swState.offlineReady = offlineReady;
  }, [offlineReady]);

  // 截圖與 E2E 用：?ll-banner=update 直接顯示（只在 fixture 建置有作用，banner-fixture.ts）
  const forced = bannerFixture() === 'update';
  const visible = (needRefresh || forced) && !blocked && !dismissed;
  useEffect(() => {
    if (!visible) return;
    publish({
      visible: true,
      reload: () => void updateServiceWorker(true),
      later: () => {
        setDismissed(true);
        setNeedRefresh(false);
      },
    });
    return () => publish(null);
  }, [visible, updateServiceWorker, setNeedRefresh]);
  return null;
}

/** 更新提示的橫幅（Banners 畫在頁首下方）；class 沿用 ll-updatebar，E2E 與截圖用它找 */
export function UpdateBanner({ state }: { state: UpdateBannerState }) {
  return (
    <Banner
      role="status"
      className="ll-updatebar"
      title={
        <Trans id="sw.updateTitle" comment="更新提示的標題">
          有新版本可以使用
        </Trans>
      }
      actions={
        <>
          <Button size="sm" icon={<RetryIcon />} onClick={state.reload}>
            <Trans id="sw.reload" comment="更新提示的主按鈕：換成新版本並重新載入">
              重新整理
            </Trans>
          </Button>
          <Button variant="quiet" size="sm" onClick={state.later}>
            <Trans id="sw.later">稍後</Trans>
          </Button>
        </>
      }
    >
      <p>
        <Trans id="sw.updateBody" comment="更新提示的說明">
          你⁠的進⁠度已⁠經⁠存⁠好，按「⁠重⁠新⁠整⁠理⁠」就⁠會換⁠成⁠新⁠版⁠本。
        </Trans>
      </p>
    </Banner>
  );
}
