// 子頁的頁首（站規 1.4）：兩列。第一列左邊 BackButton、右邊 actions；第二列是 h1（title-1）。標題不再和返回擠同一列。
// compact：只有一列，左邊圖示版 BackButton、中間標題（title-3）、右邊 actions，給作答頁與錯題複習。
// 站內連結由父層以 localePath() 產生並帶結尾斜線；換頁後焦點移到 h1 由頁面負責（h1 有 tabIndex=-1）。
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import { BackButton } from './BackButton.tsx';

export interface TopBarProps {
  title: ReactNode;
  /** 標題的層級，預設 h1 */
  titleAs?: 'h1' | 'h2';
  titleId?: string;
  /** 返回：給 href 就是連結，給 onBack 就是按鈕 */
  backHref?: string;
  onBack?: () => void;
  /** 返回的可讀名稱，例如「回到闖關地圖」；預設「返回」 */
  backLabel?: string;
  /** 返回在畫面上的短字，例如「地圖」（必須是 backLabel 的一部分）。省略時：一般版沿用 backLabel 的全文（相容舊頁面），compact 版只顯示圖示 */
  backShortLabel?: string;
  /** 精簡：一列 */
  compact?: boolean;
  /** 右側動作：IconButton 或 sm 按鈕 */
  actions?: ReactNode;
  className?: string;
}

export function TopBar({ title, titleAs: Heading = 'h1', titleId, backHref, onBack, backLabel, backShortLabel, compact, actions, className }: TopBarProps) {
  const { t } = useLingui();
  const label = backLabel ?? t({ id: 'ui.back', message: '返回', comment: '頂部列返回按鈕的可讀名稱' });
  const shortLabel = compact ? backShortLabel : (backShortLabel ?? label);
  const hasBack = backHref !== undefined || onBack !== undefined;
  const back = hasBack ? <BackButton href={backHref} onBack={backHref === undefined ? onBack : undefined} label={label} shortLabel={shortLabel} /> : null;
  const heading = (
    <Heading id={titleId} className="ll-topbar__title" tabIndex={Heading === 'h1' ? -1 : undefined}>
      {title}
    </Heading>
  );
  const variant = compact ? 'll-topbar--compact' : 'll-topbar--page';
  return (
    <header className={`ll-topbar ${variant}${className ? ` ${className}` : ''}`}>
      {(back || (!compact && actions)) && (
        <div className="ll-topbar__bar">
          {back}
          {!compact && actions && <div className="ll-topbar__actions">{actions}</div>}
        </div>
      )}
      {heading}
      {compact && actions && <div className="ll-topbar__actions">{actions}</div>}
    </header>
  );
}
