// 地圖頁的提示條（地圖規格 4.9、站規 1.20）：BackupReminder、InstallPrompt、SafariTabNotice 在地圖頁改成 HUD 下方的單行提示，
// 一次一則（優先序由頁面決定）。min-height 44、--ll-info-tint 底（warning 時 --ll-warning-tint），左右對齊軌道（寬度由外層決定）。
// 左側 20px 圖示、一行 body-sm 文字（文字放大時換行，不截斷）、右側兩顆 44×44 的 IconButton：「詳細」（連結，CaretRightIcon）與「關閉」（XIcon）。
// 其他頁維持完整的 Banner（站規 2.17）。
import type { MouseEventHandler, ReactNode } from 'react';
import { IconButton } from './IconButton.tsx';
import { CaretRightIcon, InfoIcon, WarningIcon, XIcon } from './icons.tsx';
import { useUiLabels } from './ui-labels.ts';

export interface HintBarProps {
  /** 一行文字 */
  children: ReactNode;
  kind?: 'info' | 'warning';
  /** 預設依 kind：info 是 InfoIcon、warning 是 WarningIcon */
  icon?: ReactNode;
  /** 「詳細」前往的頁（父層以 localePath() 產生）；省略時不顯示 */
  detailsHref?: string;
  /** 「詳細」的可讀名稱，預設「詳細」；最好寫清楚去哪裡，例如「詳細：備份」 */
  detailsLabel?: string;
  onDetails?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  /** 「關閉」等於原本的「之後再說」；省略時不顯示 */
  onClose?: () => void;
  /** 預設「關閉提示」 */
  closeLabel?: string;
  /** 播報方式；提示條是頁面上的固定區塊，預設 note（不打斷） */
  role?: 'status' | 'note';
  className?: string;
  'data-testid'?: string;
}

export function HintBar({
  children,
  kind = 'info',
  icon,
  detailsHref,
  detailsLabel,
  onDetails,
  onClose,
  closeLabel,
  role = 'note',
  className,
  'data-testid': testId,
}: HintBarProps) {
  const labels = useUiLabels();
  return (
    <div className={`ll-hintbar ll-hintbar--${kind}${className ? ` ${className}` : ''}`} role={role} data-testid={testId}>
      <span className="ll-hintbar__icon" aria-hidden="true">
        {icon ?? (kind === 'warning' ? <WarningIcon /> : <InfoIcon />)}
      </span>
      <p className="ll-hintbar__text">{children}</p>
      <span className="ll-hintbar__actions">
        {detailsHref !== undefined && <IconButton icon={<CaretRightIcon />} label={detailsLabel ?? labels.details} href={detailsHref} onClick={onDetails} />}
        {onClose && <IconButton icon={<XIcon />} label={closeLabel ?? labels.dismiss} onClick={onClose} />}
      </span>
    </div>
  );
}
