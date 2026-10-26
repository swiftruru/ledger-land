// 掃描課堂 QR（06 第 4.9 節）的入口判斷與掃描元件的型別：Play（顯示入口）、ScanOverlay（說明卡，延後載入）與 QrScanner（相機畫面，延後載入）共用
export interface QrScannerProps {
  /** 解出的文字（可能不是網址；由呼叫端依 06 第 4.9 節驗證）。回傳 true 代表接受並已處理，false 代表不是本站的課堂 QR */
  onResult: (text: string) => boolean;
  onCancel: () => void;
  /** 沒有相機權限或沒有相機時改用關卡代號 */
  onUseCode: () => void;
}

/** 能不能顯示「掃描課堂 QR」入口：App 模式、不是 App 內建瀏覽器、有 getUserMedia（06 第 4.9 節） */
export function canOfferScan(appMode: boolean, inAppBrowser: boolean): boolean {
  if (!appMode || inAppBrowser) return false;
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';
}
