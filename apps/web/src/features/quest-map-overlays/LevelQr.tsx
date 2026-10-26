// 給老師的關卡 QR（維護者 2026-10-26：老師問怎麼把關卡做成 QR，站內直接提供）：放在關卡介紹面板「給老師：關卡代號」的展開列裡。
// 按「顯示 QR」才動態載入編碼器（qr-encode.ts），畫成 SVG（黑白，QR 要高對比，不跟主題走）；下面是這一關的正式網址、「下載圖片」（PNG）
// 與「複製連結」。網址用正式 origin 加 ?via=qr，和課堂 QR 的格式一樣（qr-url.ts），學生用相機或 App 內掃描都直接進這一關。
import { useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'react';
import { localePath, type Locale } from '@ledgerland/i18n';
import { Button, CheckIcon } from '@ledgerland/web-ui';
import { DownloadIcon, LinkIcon, QrIcon } from '@ledgerland/web-ui/map';
import { site } from '../../../site.config.ts';
import type { QrMatrix } from './qr-encode.ts';
import './level-qr.css';

export function levelQrUrl(locale: Locale, levelId: string): string {
  return `${site.productionOrigin}${localePath(locale, `/level/${levelId}/`)}?via=qr`;
}

export function LevelQr({ levelId, locale }: { levelId: string; locale: Locale }) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ id: string; qr: QrMatrix; path: string } | 'failed' | null>(null);
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const url = levelQrUrl(locale, levelId);
  const code = levelId.replace(/^lv_/, '');
  useEffect(() => {
    if (!open) return;
    let alive = true;
    import('./qr-encode.ts').then(
      (m) => {
        if (!alive) return;
        const qr = m.encodeQr(url);
        setState({ id: levelId, qr, path: m.qrPath(qr) });
      },
      () => alive && setState('failed'),
    );
    return () => {
      alive = false;
    };
  }, [open, url, levelId]);
  const download = async () => {
    if (state === null || state === 'failed') return;
    const m = await import('./qr-encode.ts');
    const blob = await m.qrPngBlob(state.qr);
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ledgerland-${code}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied('done');
    } catch {
      setCopied('failed');
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied('idle'), 2000);
  };
  const ready = state !== null && state !== 'failed' && state.id === levelId;
  const side = ready ? state.qr.size + 8 : 0;
  return (
    <div className="ll-levelqr">
      <Button variant="quiet" size="sm" icon={<QrIcon />} aria-expanded={open} aria-controls="ll-levelqr-panel" onClick={() => setOpen((v) => !v)}>
        {open
          ? t({ id: 'map.qr.hide', message: '收起 QR', comment: '關卡介紹面板「給老師」區收起關卡 QR 的按鈕' })
          : t({ id: 'map.qr.show', message: '顯示 QR', comment: '關卡介紹面板「給老師」區顯示關卡 QR 的按鈕（產生這一關網址的 QR 圖）' })}
      </Button>
      {open && (
        <div id="ll-levelqr-panel" className="ll-levelqr__panel">
          {state === 'failed' ? (
            <p className="ll-levelqr__hint ll-muted">
              {t({ id: 'map.qr.failed', message: '這次沒辦法產生 QR，請改用「複製連結」。', comment: 'QR 編碼器載入失敗時的說明' })}
            </p>
          ) : ready ? (
            <svg
              className="ll-levelqr__svg"
              viewBox={`0 0 ${side} ${side}`}
              width={200}
              height={200}
              role="img"
              aria-label={t({ id: 'map.qr.alt', message: '這一關的 QR', comment: 'QR 圖的可讀名稱（網址另外列在圖下方）' })}
              shapeRendering="crispEdges"
            >
              <rect width={side} height={side} fill="#fff" />
              <path d={state.path} fill="#000" />
            </svg>
          ) : (
            <div className="ll-levelqr__svg" aria-hidden="true" />
          )}
          <code className="ll-levelqr__url ll-num">{url}</code>
          <div className="ll-levelqr__actions">
            <Button variant="secondary" size="sm" icon={<DownloadIcon />} disabled={!ready} onClick={() => void download()}>
              {t({ id: 'map.qr.download', message: '下載圖片', comment: '下載關卡 QR 的 PNG' })}
            </Button>
            <Button variant="quiet" size="sm" icon={copied === 'done' ? <CheckIcon /> : <LinkIcon />} onClick={() => void copy()}>
              {copied === 'done'
                ? t({ id: 'map.qr.copied', message: '已複製', comment: '複製關卡連結成功' })
                : t({ id: 'map.qr.copyLink', message: '複製連結', comment: '複製這一關網址的按鈕' })}
            </Button>
          </div>
          <span className="ll-sr-only" role="status" aria-live="polite">
            {copied === 'failed' ? t({ id: 'map.qr.copyFailed', message: '無法複製，請直接選取網址', comment: '複製關卡連結失敗' }) : ''}
          </span>
        </div>
      )}
    </div>
  );
}
