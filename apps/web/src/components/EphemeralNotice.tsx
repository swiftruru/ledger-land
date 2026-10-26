// 暫存情境偵測（M0a 第 4 節第 12 點，06 第 4.8 節）：iOS 相機掃 QR 開出的網頁面板儲存與 Safari、主畫面 App 分開，而且每次掃描都清空；
// 在 iOS、非 App 模式下，storage 配額低於 1.5 GB 就當作暫存情境（相機面板實測 1 GB）。誤判時只會多一張可關閉的提示。
// 要不要顯示由 useEphemeralNotice 判斷（結果記在模組裡，換頁時 Banners 重新掛載不會再等一次 estimate、也不會閃一下），
// 畫不畫由 Banners.tsx 依優先順序決定（banner-rules.ts：一次只展開一條，相機預覽提示排在儲存層錯誤與更新提示之後）。
// 外觀（站規 2.17，第 1 輪驗收改）：warning 的 Banner，標題加說明，動作 secondary sm「知道了」帶 CheckIcon（只是確認看過，畫面上唯一的 primary 留給頁面主卡）。
import { Trans } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { Banner, Button, CheckIcon } from '@ledgerland/web-ui';
import { isAppMode } from '../lib/prefs.ts';
import { bannerFixture } from './banner-fixture.ts';

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

function dismissedThisSession(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** 這次載入的判斷結果：null 是還沒判斷；pending 讓同時掛載的幾個 hook 共用同一次 estimate */
let decided: boolean | null = null;
let pending: Promise<boolean> | null = null;

function initialShow(): boolean {
  // 截圖與 E2E 用：?ll-banner=ephemeral 直接顯示（只在 fixture 建置有作用，banner-fixture.ts）
  if (bannerFixture() === 'ephemeral') return true;
  if (dismissedThisSession()) return false;
  return decided ?? false;
}

export interface EphemeralNoticeState {
  show: boolean;
  close: () => void;
}

export function useEphemeralNotice(): EphemeralNoticeState {
  const [show, setShow] = useState(initialShow);
  useEffect(() => {
    if (decided !== null || bannerFixture() === 'ephemeral' || dismissedThisSession()) return;
    let alive = true;
    pending ??= guessEphemeral()
      .then(
        (g) => g.ephemeral,
        () => false,
      )
      .then((v) => {
        decided = v;
        return v;
      });
    void pending.then((v) => alive && setShow(v && !dismissedThisSession()));
    return () => {
      alive = false;
    };
  }, []);
  const close = () => {
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {
      /* 寫不進去時只關閉這一次 */
    }
    decided = false;
    setShow(false);
  };
  return { show, close };
}

export function EphemeralNotice({ onClose }: { onClose: () => void }) {
  return (
    <Banner
      kind="warning"
      role="status"
      className="ll-ephemeral-notice"
      title={<Trans id="ephemeral.title">這⁠個畫⁠面關⁠掉後，作⁠答進⁠度不⁠會保⁠留</Trans>}
      actions={
        <Button size="sm" icon={<CheckIcon />} onClick={onClose}>
          <Trans id="common.ok">知道了</Trans>
        </Button>
      }
    >
      <p>
        <Trans id="ephemeral.body">
          你現⁠在是⁠在相⁠機開⁠啟⁠的預⁠覽⁠畫⁠面。請⁠點⁠右⁠下⁠角⁠的指⁠南⁠針圖⁠示，改⁠用 Safari 開⁠啟；如⁠果已⁠經把會⁠計樂⁠園加⁠到⁠主⁠畫⁠面，請⁠改⁠用 App
          裡⁠的「⁠掃⁠描⁠課⁠堂 QR」。
        </Trans>
      </p>
    </Banner>
  );
}
