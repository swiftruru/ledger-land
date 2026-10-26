// 「掃描課堂 QR」疊加層（06 第 4.9 節）：說明卡、按「開始掃描」才載入相機畫面（QrScanner，React.lazy 的獨立 chunk）。
// 這裡不呼叫 getUserMedia；解出的文字在這裡用 qr-url.ts 驗證（只接受目前與正式 origin 的關卡、章節、故事步驟網址），是本站的課堂 QR 才交給呼叫端的 onTarget 導覽、掃描畫面關閉。
// 驗證放在這個延後載入的 chunk（2026-10-26，M3 收尾 QA）：qr-url.ts 是地圖第一波唯一用到 content-schema ID 規則的模組，放在 Play 時地圖第一波要為它多載一個 chunk。
// 放在 quest-map 資料夾外（第 5 輪看圖驗收後的體積調整）：不進地圖的共用 chunk，Play 在地圖畫好 1.5 秒後（或 ?scan=1）才載入；
// 入口判斷（canOfferScan）與掃描元件的型別在 quest-map/scan.ts
import { useLingui } from '@lingui/react/macro';
import { Suspense, useState, type ComponentType, type RefObject } from 'react';
import { Button } from '@ledgerland/web-ui';
import { KeyboardIcon, QrIcon } from '@ledgerland/web-ui/map';
import { site } from '../../../site.config.ts';
import { Overlay } from '../quest-map/Overlay.tsx';
import { parseSiteQr } from '../quest-map/qr-url.ts';
import type { QrScannerProps } from '../quest-map/scan.ts';

export interface ScanOverlayProps {
  open: boolean;
  onClose: () => void;
  /** 改用關卡代號 */
  onUseCode: () => void;
  /** 掃描元件（模組層的 React.lazy(() => import(...))）；沒有時顯示「即將推出」 */
  scanner?: ComponentType<QrScannerProps>;
  /** 掃到本站的課堂 QR：path 已去掉語系片段、帶結尾斜線（qr-url.ts），呼叫端以目前介面語言導覽。不是本站的 QR 時不呼叫，掃描畫面顯示「這不是 LedgerLand 的課堂 QR」並繼續掃描 */
  onTarget?: (path: string) => void;
  /** 關閉後焦點要回到的元素 */
  returnFocusTo?: RefObject<HTMLElement | null>;
}

export function ScanOverlay({ open, onClose, onUseCode, scanner: Scanner, onTarget, returnFocusTo }: ScanOverlayProps) {
  const { t } = useLingui();
  const [started, setStarted] = useState(false);
  return (
    <Overlay
      open={open}
      onClose={() => {
        setStarted(false);
        onClose();
      }}
      title={t({ id: 'play.scan.title', message: '掃描課堂 QR', comment: '掃描疊加層的標題' })}
      returnFocusTo={returnFocusTo}
      testId="scan-overlay"
    >
      {Scanner && started ? (
        <Suspense
          fallback={<p className="qm-overlay__hint">{t({ id: 'play.scan.loading', message: '載入掃描器中', comment: '掃描器 chunk 載入中的文字' })}</p>}
        >
          <Scanner
            onResult={(text) => {
              const target = onTarget ? parseSiteQr(text, { origin: window.location.origin, allowedOrigins: [site.productionOrigin] }) : null;
              if (!target) return false;
              onTarget?.(target.path);
              setStarted(false);
              return true;
            }}
            onCancel={() => setStarted(false)}
            onUseCode={() => {
              setStarted(false);
              onUseCode();
            }}
          />
        </Suspense>
      ) : (
        <>
          <ScanArt />
          <p className="qm-overlay__text">
            {t({
              id: 'play.scan.explain',
              message: '接下來會請你允許使用相機。相機只用來辨識 QR，不會拍照，也不會上傳；影像只在這台裝置上處理。',
              comment: '掃描前的相機說明卡（06 第 4.9 節）',
            })}
          </p>
          <p className="qm-overlay__hint">
            {t({
              id: 'play.scan.reask',
              message: '從主畫面開啟的 App 每次重新開啟時，可能會再問一次。',
              comment: '掃描前的說明卡：預告主畫面 App 每次啟動都可能重新詢問相機權限（WebKit 的已知行為）',
            })}
          </p>
          {!Scanner && (
            <p className="qm-overlay__hint" role="status">
              {t({ id: 'play.scan.soon', message: '掃描功能即將推出，可先輸入關卡代號。', comment: '掃描元件還沒接上時的說明' })}
            </p>
          )}
          <div className="qm-overlay__actions">
            {Scanner && (
              <Button variant="primary" block icon={<QrIcon />} onClick={() => setStarted(true)}>
                {t({ id: 'play.scan.start', message: '開始掃描', comment: '說明卡上開始掃描的按鈕' })}
              </Button>
            )}
            <Button variant={Scanner ? 'secondary' : 'primary'} block icon={<KeyboardIcon />} onClick={onUseCode}>
              {t({ id: 'play.scan.useCode', message: '改輸入關卡代號', comment: '掃描疊加層改用代號的按鈕' })}
            </Button>
          </div>
        </>
      )}
    </Overlay>
  );
}

/** 掃描說明的小插圖（站規 2.2.5，原創）：手機往左疊在課堂 QR 上 12px，相機框裡一條強調色的掃描線；純裝飾 */
function ScanArt() {
  return (
    <svg className="qm-scanart" width="120" height="72" viewBox="0 0 120 72" aria-hidden="true" focusable="false">
      <rect className="qm-scanart__card" x="18" y="14" width="44" height="44" rx="6" />
      <g className="qm-scanart__code">
        <rect x="26" y="22" width="10" height="10" rx="1.5" />
        <rect x="44" y="22" width="10" height="10" rx="1.5" />
        <rect x="26" y="40" width="10" height="10" rx="1.5" />
        <path d="M44 40h4v4h-4zM50 46h4v4h-4zM44 48h3v2h-3z" />
      </g>
      <rect className="qm-scanart__phone" x="50" y="4" width="44" height="64" rx="9" />
      <path className="qm-scanart__frame" d="M58 22v-6h6M86 22v-6h-6M58 50v6h6M86 50v6h-6" />
      <path className="qm-scanart__beam" d="M58 36h28" />
    </svg>
  );
}
