// 關卡代號（07 第 9 節、02 第 4.7 節）：關卡 ID 去掉 lv_ 的 8 個字元，顯示成 4 個一組（k7m2 q9xd），等寬字型；可讀名稱念出完整代號。
// 「複製」用 Clipboard API；失敗或不支援時只顯示文字讓學生自己選取。
import { useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'react';
import { CopyIcon } from './map-icons.tsx';

export interface LevelCodeProps {
  /** 關卡 ID（lv_ 開頭）或已去掉前綴的 8 碼 */
  levelId: string;
  className?: string;
}

export function levelCodeOf(levelId: string): string {
  return levelId.replace(/^lv_/, '');
}

export function formatLevelCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)} ${code.slice(4)}` : code;
}

export function LevelCode({ levelId, className }: LevelCodeProps) {
  const { t } = useLingui();
  const code = levelCodeOf(levelId);
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied('done');
    } catch {
      setCopied('failed');
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied('idle'), 2000);
  };
  const canCopy = typeof navigator !== 'undefined' && !!navigator.clipboard;
  return (
    <div className={`ll-levelcode${className ? ` ${className}` : ''}`}>
      <span className="ll-levelcode__label">{t({ id: 'map.code.label', message: '關卡代號', comment: '關卡介紹表單裡代號的欄位標題' })}</span>
      <code
        className="ll-levelcode__code ll-num"
        aria-label={t({ id: 'map.code.a11y', message: `關卡代號 ${code}`, comment: '代號的可讀名稱；code 是 8 碼代號' })}
      >
        {formatLevelCode(code)}
      </code>
      {canCopy && (
        <button type="button" className="ll-btn ll-btn--small ll-levelcode__copy" onClick={copy}>
          <CopyIcon size={16} />
          {t({ id: 'map.code.copy', message: '複製', comment: '複製關卡代號的按鈕' })}
        </button>
      )}
      <span className="ll-sr-only" role="status" aria-live="polite">
        {copied === 'done'
          ? t({ id: 'map.code.copied', message: '已複製關卡代號', comment: '複製成功時的狀態訊息' })
          : copied === 'failed'
            ? t({ id: 'map.code.copyFailed', message: '無法複製，請直接選取代號', comment: '複製失敗時的狀態訊息' })
            : ''}
      </span>
      {copied === 'done' && (
        <span className="ll-levelcode__hint" aria-hidden="true">
          {t({ id: 'map.code.copiedShort', message: '已複製', comment: '複製成功時按鈕旁的短提示' })}
        </span>
      )}
    </div>
  );
}
