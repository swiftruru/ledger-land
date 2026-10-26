// 關卡 QR 的產生（給老師，維護者 2026-10-26：站內直接做 QR，不必另外找工具）。用掃描端同一套 @zxing/library 的編碼器（深層匯入，只載
// 編碼需要的模組），按下「顯示 QR」才動態載入這個檔案；輸出只有一個布林矩陣，畫成 SVG 或 PNG 都在這裡。
import ErrorCorrectionLevel from '@zxing/library/esm/core/qrcode/decoder/ErrorCorrectionLevel.js';
import Encoder from '@zxing/library/esm/core/qrcode/encoder/Encoder.js';

export interface QrMatrix {
  /** 模組數（每邊） */
  size: number;
  dark: (x: number, y: number) => boolean;
}

/** 靜區（四邊各留的白邊，QR 規格要求至少 4 個模組） */
export const QR_QUIET = 4;

/** 容錯等級 M（15%）：課堂投影或列印在紙上都夠；網址不長，版本不會太大 */
export function encodeQr(text: string): QrMatrix {
  const m = Encoder.encode(text, ErrorCorrectionLevel.M).getMatrix();
  return { size: m.getWidth(), dark: (x, y) => m.get(x, y) === 1 };
}

/** 深色模組的 SVG path（單位是模組，viewBox 要加上靜區） */
export function qrPath(q: QrMatrix): string {
  const parts: string[] = [];
  for (let y = 0; y < q.size; y++) {
    let run = 0;
    for (let x = 0; x <= q.size; x++) {
      const on = x < q.size && q.dark(x, y);
      if (on) run++;
      else if (run > 0) {
        parts.push(`M${x - run + QR_QUIET} ${y + QR_QUIET}h${run}v1h-${run}z`);
        run = 0;
      }
    }
  }
  return parts.join('');
}

/** PNG（給下載）：每個模組 scale px，黑白兩色（QR 要高對比，不跟主題走） */
export function qrPngBlob(q: QrMatrix, scale = 10): Promise<Blob | null> {
  const side = (q.size + QR_QUIET * 2) * scale;
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, side, side);
  ctx.fillStyle = '#000000';
  for (let y = 0; y < q.size; y++)
    for (let x = 0; x < q.size; x++) if (q.dark(x, y)) ctx.fillRect((x + QR_QUIET) * scale, (y + QR_QUIET) * scale, scale, scale);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
