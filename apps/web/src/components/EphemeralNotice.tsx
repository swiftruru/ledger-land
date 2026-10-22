// 暫存情境偵測（M0a 第 4 節第 12 點，06 第 4.8 節）：iOS 相機掃 QR 開出的網頁面板儲存與 Safari、主畫面 App 分開，而且每次掃描都清空；
// 在 iOS、非 App 模式下，storage 配額低於 1.5 GB 就當作暫存情境（相機面板實測 1 GB）。誤判時只會多一張可關閉的提示。
import { Trans } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { Banner, Button } from '@ledgerland/web-ui';
import { isAppMode } from '../lib/prefs.ts';

const KEY = 'll:ephemeral-notice-dismissed';
export const EPHEMERAL_QUOTA_LIMIT = 1.5 * 1024 ** 3;

export function isIOSWebKit(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export async function guessEphemeral(): Promise<{ ios: boolean; appMode: boolean; quota: number | null; ephemeral: boolean }> {
  const ios = isIOSWebKit();
  const appMode = isAppMode();
  let quota: number | null = null;
  try {
    quota = (await navigator.storage?.estimate?.())?.quota ?? null;
  } catch {
    quota = null;
  }
  return { ios, appMode, quota, ephemeral: ios && !appMode && quota !== null && quota < EPHEMERAL_QUOTA_LIMIT };
}

export function EphemeralNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let alive = true;
    try {
      if (sessionStorage.getItem(KEY) === '1') return;
    } catch {
      /* 讀不到時照常判斷 */
    }
    void guessEphemeral().then((g) => alive && setShow(g.ephemeral));
    return () => {
      alive = false;
    };
  }, []);
  if (!show) return null;
  const close = () => {
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {
      /* 寫不進去時只關閉這一次 */
    }
    setShow(false);
  };
  return (
    <Banner kind="warning" role="status">
      <h2 className="ll-notice__title">
        <Trans id="ephemeral.title">這個畫面關掉後，作答進度不會保留</Trans>
      </h2>
      <p>
        <Trans id="ephemeral.body">
          你現在是在相機開啟的預覽畫面。請點右下角的指南針圖示，改用 Safari 開啟；如果已經把會計樂園加到主畫面，請改用 App 裡的「掃描課堂 QR」。
        </Trans>
      </p>
      <Button onClick={close}>
        <Trans id="common.ok">知道了</Trans>
      </Button>
    </Banner>
  );
}
