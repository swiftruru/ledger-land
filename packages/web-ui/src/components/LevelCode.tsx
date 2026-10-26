// 關卡代號（07 第 9 節、02 第 4.7 節）：關卡 ID 去掉 lv_ 的 8 個字元，顯示成 4 個一組（k7m2 q9xd），等寬字型；可讀名稱念出完整代號。
// 「複製」是 Button quiet sm（站規 3.2）：用 Clipboard API，成功時圖示換成勾、文字換成「已複製」兩秒；失敗或不支援時只顯示文字讓學生自己選取。
// 格式與字串在 LevelCodeText.tsx（和載入前的佔位共用）。
import { useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'react';
import { Button } from './Button.tsx';
import { CheckIcon } from './icons.tsx';
import { canCopyLevelCode, formatLevelCode, levelCodeOf, useLevelCodeText } from './LevelCodeText.tsx';
import { CopyIcon } from './map-icons.tsx';
import { useUiLabels } from './ui-labels.ts';

export { formatLevelCode, levelCodeOf };

export interface LevelCodeProps {
  /** 關卡 ID（lv_ 開頭）或已去掉前綴的 8 碼 */
  levelId: string;
  className?: string;
}

export function LevelCode({ levelId, className }: LevelCodeProps) {
  const { t } = useLingui();
  const text = useLevelCodeText();
  const ui = useUiLabels();
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
  const canCopy = canCopyLevelCode();
  return (
    <div className={`ll-levelcode${className ? ` ${className}` : ''}`}>
      <span className="ll-levelcode__label">{text.label}</span>
      <code className="ll-levelcode__code ll-num" aria-label={text.a11y(code)}>
        {formatLevelCode(code)}
      </code>
      {canCopy && (
        <Button variant="quiet" size="sm" icon={copied === 'done' ? <CheckIcon /> : <CopyIcon />} onClick={() => void copy()} className="ll-levelcode__copy">
          {copied === 'done' ? ui.copied : text.copy}
        </Button>
      )}
      <span className="ll-sr-only" role="status" aria-live="polite">
        {copied === 'done'
          ? t({ id: 'map.code.copied', message: '已複製關卡代號', comment: '複製成功時的狀態訊息' })
          : copied === 'failed'
            ? t({ id: 'map.code.copyFailed', message: '無法複製，請直接選取代號', comment: '複製失敗時的狀態訊息' })
            : ''}
      </span>
    </div>
  );
}
