// 提示（07 第 9 節）：role="status"，不搶焦點；可帶一個動作按鈕與關閉
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import { XIcon } from './icons.tsx';

export interface ToastProps {
  children: ReactNode;
  kind?: 'info' | 'success' | 'warning' | 'danger';
  action?: { label: ReactNode; onClick: () => void };
  onDismiss?: () => void;
  className?: string;
}

export function Toast({ children, kind = 'info', action, onDismiss, className }: ToastProps) {
  const { t } = useLingui();
  return (
    <div className={`ll-toast ll-toast--${kind}${className ? ` ${className}` : ''}`} role="status">
      <div className="ll-toast__text">{children}</div>
      {action && (
        <button type="button" className="ll-toast__action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          className="ll-iconbtn"
          onClick={onDismiss}
          aria-label={t({ id: 'ui.dismiss', message: '關閉提示', comment: 'Toast 關閉按鈕的可讀名稱' })}
        >
          <XIcon size={18} />
        </button>
      )}
    </div>
  );
}
