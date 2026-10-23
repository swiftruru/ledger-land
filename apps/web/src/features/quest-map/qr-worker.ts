/// <reference lib="webworker" />
// QR 解碼 Worker（06 第 4.9 節、09 第 6.9 與 11.1 節）：只深層匯入 @zxing/library 的 QR 子集（純 JavaScript，不用 WebAssembly），
// 由 QrScanner 以 new Worker(new URL('./qr-worker.ts', import.meta.url)) 建立，Vite 打成獨立檔案，符合 CSP 的 worker-src 'self'。
// 收主執行緒縮好的影格（RGBA 位元組，buffer 以 transfer 傳入），轉成亮度後解碼，回傳文字或 null。
// 每一格都包在 try/catch：找不到 QR 是常態，不是錯誤；影像不保存、不離開這個 Worker。
import BinaryBitmap from '@zxing/library/esm/core/BinaryBitmap.js';
import HybridBinarizer from '@zxing/library/esm/core/common/HybridBinarizer.js';
import QRCodeReader from '@zxing/library/esm/core/qrcode/QRCodeReader.js';
import RGBLuminanceSource from '@zxing/library/esm/core/RGBLuminanceSource.js';

/** 主執行緒送來的影格：RGBA、每像素 4 個位元組 */
export interface QrFrame {
  id: number;
  width: number;
  height: number;
  data: ArrayBuffer;
}

export interface QrDecoded {
  id: number;
  text: string | null;
}

const reader = new QRCodeReader();

export function decodeRgba(rgba: Uint8ClampedArray, width: number, height: number): string | null {
  const size = width * height;
  const luminance = new Uint8ClampedArray(size);
  // 整數權重的亮度（0.299、0.587、0.114 乘 256）；課堂 QR 都是白底黑碼，不另外嘗試反相
  for (let i = 0, j = 0; i < size; i++, j += 4) luminance[i] = (rgba[j]! * 77 + rgba[j + 1]! * 151 + rgba[j + 2]! * 28) >> 8;
  try {
    const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luminance, width, height)));
    return reader.decode(bitmap).getText();
  } catch {
    return null;
  } finally {
    reader.reset();
  }
}

self.addEventListener('message', (event: MessageEvent<QrFrame>) => {
  const { id, width, height, data } = event.data;
  let text: string | null = null;
  try {
    text = decodeRgba(new Uint8ClampedArray(data), width, height);
  } catch {
    text = null;
  }
  const reply: QrDecoded = { id, text };
  self.postMessage(reply);
});
