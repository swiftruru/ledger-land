// 空狀態與錯誤頁（07 第 9 節）：都有標題、說明與下一步按鈕；插圖純裝飾（aria-hidden）
import type { ReactNode } from 'react';
import { TrayIcon, WarningIcon } from './icons.tsx';

export interface StateProps {
  title: ReactNode;
  description?: ReactNode;
  /** 下一步的按鈕或連結 */
  action?: ReactNode;
  /** 自訂插圖（純裝飾） */
  illustration?: ReactNode;
  titleAs?: 'h1' | 'h2' | 'h3';
  className?: string;
}

export function EmptyState({ title, description, action, illustration, titleAs: Heading = 'h2', className }: StateProps) {
  return (
    <div className={`ll-state ll-state--empty${className ? ` ${className}` : ''}`}>
      <div className="ll-state__art" aria-hidden="true">
        {illustration ?? <TrayIcon size={40} />}
      </div>
      <Heading className="ll-state__title">{title}</Heading>
      {description && <p className="ll-state__desc">{description}</p>}
      {action && <div className="ll-row ll-state__action">{action}</div>}
    </div>
  );
}

export function ErrorState({ title, description, action, illustration, titleAs: Heading = 'h2', className }: StateProps) {
  return (
    <div className={`ll-state ll-state--error${className ? ` ${className}` : ''}`} role="alert">
      <div className="ll-state__art" aria-hidden="true">
        {illustration ?? <WarningIcon size={40} />}
      </div>
      <Heading className="ll-state__title">{title}</Heading>
      {description && <p className="ll-state__desc">{description}</p>}
      {action && <div className="ll-row ll-state__action">{action}</div>}
    </div>
  );
}
