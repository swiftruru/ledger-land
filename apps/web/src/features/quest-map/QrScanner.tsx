// App 內掃描課堂 QR 的相機畫面（06 第 4.9 節、02 第 4.7 節）：由 ScanOverlay 以 React.lazy 載入成獨立 chunk，不計入首次載入 JS。
// 掛載後才呼叫 getUserMedia（後鏡頭）；影格每 200ms 縮到最長邊 640px 後交給 qr-worker 解碼（主執行緒不解碼，保護 INP）；
// 辨識成功、按「取消」、卸載（換頁）、頁面進入背景（visibilitychange 為 hidden）時都對所有 track 呼叫 stop() 並終止 Worker。
// 影像只在這台裝置上處理，不保存、不上傳；解出的文字交給呼叫端驗證（qr-url.ts），這裡不導覽、不開網址。
import { useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@ledgerland/web-ui';
import type { QrDecoded, QrFrame } from './qr-worker.ts';
import type { QrScannerProps } from './scan.ts';
import './QrScanner.css';

const FRAME_INTERVAL_MS = 200;
const MAX_SIDE = 640;

type FailReason = 'denied' | 'noCamera' | 'error';
type Phase = { kind: 'starting' } | { kind: 'scanning' } | { kind: 'failed'; reason: FailReason };

/** getUserMedia 失敗的分類：拒絕權限、沒有相機、其他（例如 App 內建瀏覽器或相機被別的 App 佔用） */
export function failureReason(error: unknown): FailReason {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') return 'noCamera';
  return 'error';
}

export default function QrScanner({ onResult, onCancel, onUseCode }: QrScannerProps) {
  const { t } = useLingui();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'starting' });
  const [rejected, setRejected] = useState(false);
  // 最新的回呼放在 ref，讓只跑一次的相機 effect 不必重建串流
  const callbacks = useRef({ onResult, onCancel });
  useEffect(() => {
    callbacks.current = { onResult, onCancel };
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let stream: MediaStream | null = null;
    let worker: Worker | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let stopped = false;
    let busy = false;
    let frameId = 0;
    let lastRejected: string | null = null;
    const canvas = document.createElement('canvas');

    const stop = () => {
      if (stopped) return;
      stopped = true;
      if (timer !== undefined) clearInterval(timer);
      worker?.terminate();
      worker = null;
      stream?.getTracks().forEach((track) => track.stop());
      video.pause();
    };
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') return;
      stop();
      callbacks.current.onCancel();
    };
    const tick = () => {
      if (stopped || busy || !worker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;
      const scale = Math.min(1, MAX_SIDE / Math.max(vw, vh));
      const w = Math.max(1, Math.round(vw * scale));
      const h = Math.max(1, Math.round(vh * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      const image = ctx.getImageData(0, 0, w, h);
      const frame: QrFrame = { id: ++frameId, width: w, height: h, data: image.data.buffer as ArrayBuffer };
      busy = true;
      worker.postMessage(frame, [frame.data]);
    };
    const onDecoded = (event: MessageEvent<QrDecoded>) => {
      busy = false;
      if (stopped) return;
      const { text } = event.data;
      // 同一個被拒絕的 QR 還在鏡頭前時不重複回報，提示留著；換一個 QR 才再驗證
      if (text === null || text === lastRejected) return;
      if (callbacks.current.onResult(text)) {
        stop();
        return;
      }
      lastRejected = text;
      setRejected(true);
    };

    document.addEventListener('visibilitychange', onVisibility);
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      } catch (error) {
        if (!stopped) setPhase({ kind: 'failed', reason: failureReason(error) });
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        /* 少數情況 play() 會被拒絕，但 autoplay 屬性仍會讓影格進來 */
      }
      if (stopped) return;
      worker = new Worker(new URL('./qr-worker.ts', import.meta.url), { type: 'module' });
      worker.addEventListener('message', onDecoded);
      setPhase({ kind: 'scanning' });
      timer = setInterval(tick, FRAME_INTERVAL_MS);
    })();
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, []);

  const cancelLabel = t({ id: 'play.scan.cancel', message: '取消', comment: '掃描畫面永遠可用的取消按鈕' });
  const useCodeLabel = t({ id: 'play.scan.useCode', message: '改輸入關卡代號', comment: '掃描疊加層改用代號的按鈕' });

  if (phase.kind === 'failed') {
    return (
      <div className="qm-scan" data-testid="qr-scanner">
        <p role="alert">
          {phase.reason === 'noCamera'
            ? t({ id: 'play.scan.noCamera', message: '這台裝置找不到可以用的相機，可以改輸入關卡代號。', comment: '掃描畫面：找不到相機時的提示' })
            : t({
                id: 'play.scan.denied',
                message: '沒有相機權限也沒關係，可以改輸入關卡代號。',
                comment: '掃描畫面：拒絕相機權限或相機打不開時的提示（06 第 4.9 節）',
              })}
        </p>
        <p className="qm-overlay__hint">
          {t({
            id: 'play.scan.deniedHint',
            message: '之後想用相機掃描，可以在系統設定裡找到這個 App（或 Safari）的相機權限，改成允許後再回來。',
            comment: '掃描畫面：如何在系統設定重新允許相機',
          })}
        </p>
        <div className="qm-overlay__actions">
          <Button variant="primary" block onClick={onUseCode}>
            {useCodeLabel}
          </Button>
          <Button variant="quiet" block onClick={onCancel}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="qm-scan" data-testid="qr-scanner">
      <div className="qm-scan__viewport">
        {/* 相機預覽沒有聲音也沒有對白，不放字幕 track */}
        {/* oxlint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          className="qm-scan__video"
          playsInline
          muted
          autoPlay
          aria-label={t({ id: 'play.scan.preview', message: '相機預覽', comment: '掃描畫面：相機預覽的可讀名稱' })}
          data-testid="qr-video"
        />
      </div>
      <p className="qm-overlay__hint" role="status">
        {phase.kind === 'starting'
          ? t({ id: 'play.scan.starting', message: '正在開啟相機。', comment: '掃描畫面：等待相機權限與串流時的文字' })
          : t({ id: 'play.scan.aim', message: '把課堂 QR 對準畫面，辨識後會自動前往。', comment: '掃描畫面：掃描中的說明' })}
      </p>
      {rejected && (
        <p role="alert" data-testid="qr-rejected">
          {t({ id: 'play.scan.notSite', message: '這不是 LedgerLand 的課堂 QR。', comment: '掃描畫面：掃到非本站網址時的提示（絕不開啟）' })}
        </p>
      )}
      <div className="qm-overlay__actions">
        <Button variant="secondary" block onClick={onUseCode}>
          {useCodeLabel}
        </Button>
        <Button variant="quiet" block onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </div>
  );
}
