// 小徽章：狀態或計數的短文字，顏色只是輔助，文字本身就是資訊
import type { ReactNode } from 'react';

export interface BadgeProps {
  children: ReactNode;
  kind?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

export function Badge({ children, kind = 'neutral', className }: BadgeProps) {
  return <span className={`ll-badge ll-badge--${kind}${className ? ` ${className}` : ''}`}>{children}</span>;
}
