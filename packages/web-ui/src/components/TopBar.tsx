// 頁面標題與返回（07 第 9 節）：返回按鈕有可讀名稱；站內連結由父層以 localePath() 產生並帶結尾斜線
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import { CaretLeftIcon } from './icons.tsx';

export interface TopBarProps {
  title: ReactNode;
  /** 標題的層級；換頁後焦點移到 h1 由頁面負責，預設 h1 */
  titleAs?: 'h1' | 'h2';
  titleId?: string;
  /** 返回：給 href 就是連結（由父層用 localePath 產生），給 onBack 就是按鈕 */
  backHref?: string;
  onBack?: () => void;
  /** 返回按鈕的可讀名稱，預設「返回」；有目的地時給「回到題目」這類文字 */
  backLabel?: string;
  /** 精簡：只有返回與標題，沒有右側動作 */
  compact?: boolean;
  actions?: ReactNode;
  className?: string;
}

export function TopBar({ title, titleAs: Heading = 'h1', titleId, backHref, onBack, backLabel, compact, actions, className }: TopBarProps) {
  const { t } = useLingui();
  const label = backLabel ?? t({ id: 'ui.back', message: '返回', comment: '頂部列返回按鈕的可讀名稱' });
  const back = backHref ? (
    <a className="ll-topbar__back" href={backHref} aria-label={label}>
      <CaretLeftIcon />
      <span className="ll-topbar__back-text">{label}</span>
    </a>
  ) : onBack ? (
    <button type="button" className="ll-topbar__back" onClick={onBack} aria-label={label}>
      <CaretLeftIcon />
      <span className="ll-topbar__back-text">{label}</span>
    </button>
  ) : null;
  return (
    <header className={`ll-topbar${compact ? ' ll-topbar--compact' : ''}${className ? ` ${className}` : ''}`}>
      {back}
      <Heading id={titleId} className="ll-topbar__title" tabIndex={Heading === 'h1' ? -1 : undefined}>
        {title}
      </Heading>
      {!compact && actions && <div className="ll-topbar__actions">{actions}</div>}
    </header>
  );
}
