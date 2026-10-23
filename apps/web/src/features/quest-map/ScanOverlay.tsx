// 「掃描課堂 QR」疊加層（06 第 4.9 節）：說明卡、按「開始掃描」才載入相機畫面（QrScanner，React.lazy 的獨立 chunk）。
// 這裡不呼叫 getUserMedia；解出的文字交給呼叫端的 onResult 驗證（qr-url.ts）與導覽，回傳 true 代表接受、掃描畫面才會關閉。
import { useLingui } from '@lingui/react/macro';
import { Suspense, useState, type ComponentType } from 'react';
import { Button } from '@ledgerland/web-ui';
import { Overlay } from './Overlay.tsx';

export interface QrScannerProps {
  /** 解出的文字（可能不是網址；由呼叫端依 06 第 4.9 節驗證）。回傳 true 代表接受並已處理，false 代表不是本站的課堂 QR */
  onResult: (text: string) => boolean;
  onCancel: () => void;
  /** 沒有相機權限或沒有相機時改用關卡代號 */
  onUseCode: () => void;
}

export type QrScannerLoader = () => Promise<{ default: ComponentType<QrScannerProps> }>;

export interface ScanOverlayProps {
  open: boolean;
  onClose: () => void;
  /** 改用關卡代號 */
  onUseCode: () => void;
  /** 掃描元件（模組層的 React.lazy(() => import(...))）；沒有時顯示「即將推出」 */
  scanner?: ComponentType<QrScannerProps>;
  /** 回傳 true 代表是本站的課堂 QR 並已導覽；false 時掃描畫面顯示「這不是 LedgerLand 的課堂 QR」並繼續掃描 */
  onResult?: (text: string) => boolean;
}

/** 能不能顯示「掃描課堂 QR」入口：App 模式、不是 App 內建瀏覽器、有 getUserMedia（06 第 4.9 節） */
export function canOfferScan(appMode: boolean, inAppBrowser: boolean): boolean {
  if (!appMode || inAppBrowser) return false;
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';
}

export function ScanOverlay({ open, onClose, onUseCode, scanner: Scanner, onResult }: ScanOverlayProps) {
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
      testId="scan-overlay"
    >
      {Scanner && started ? (
        <Suspense fallback={<p className="ll-muted">{t({ id: 'play.scan.loading', message: '載入掃描器中', comment: '掃描器 chunk 載入中的文字' })}</p>}>
          <Scanner
            onResult={(text) => {
              const accepted = onResult?.(text) ?? false;
              if (accepted) setStarted(false);
              return accepted;
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
          <p>
            {t({
              id: 'play.scan.explain',
              message: '接下來會請你允許使用相機。相機只用來辨識 QR，不會拍照，也不會上傳；影像只在這台裝置上處理。',
              comment: '掃描前的相機說明卡（06 第 4.9 節）',
            })}
          </p>
          <p className="ll-muted ll-small">
            {t({
              id: 'play.scan.reask',
              message: '從主畫面開啟的 App 每次重新開啟時，可能會再問一次。',
              comment: '掃描前的說明卡：預告主畫面 App 每次啟動都可能重新詢問相機權限（WebKit 的已知行為）',
            })}
          </p>
          {!Scanner && (
            <p className="ll-muted" role="status">
              {t({ id: 'play.scan.soon', message: '掃描功能即將推出，可先輸入關卡代號。', comment: '掃描元件還沒接上時的說明' })}
            </p>
          )}
          <div className="ll-row ll-actions">
            {Scanner && (
              <Button variant="primary" onClick={() => setStarted(true)}>
                {t({ id: 'play.scan.start', message: '開始掃描', comment: '說明卡上開始掃描的按鈕' })}
              </Button>
            )}
            <Button variant={Scanner ? 'secondary' : 'primary'} onClick={onUseCode}>
              {t({ id: 'play.scan.useCode', message: '改輸入關卡代號', comment: '掃描疊加層改用代號的按鈕' })}
            </Button>
          </div>
        </>
      )}
    </Overlay>
  );
}
