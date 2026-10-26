// 小徽章：狀態或計數的短文字，顏色只是輔助，文字本身就是資訊。
// star 是收集類（新收進的名詞、取得的徽章）：淡淡的星星色底加一圈金色細框，可以在最前面放一枚小勾章（.ll-stamp.ll-stamp--inline）
import type { ReactNode } from 'react';

export interface BadgeProps {
  children: ReactNode;
  kind?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'star';
  className?: string;
}

export function Badge({ children, kind = 'neutral', className }: BadgeProps) {
  return <span className={`ll-badge ll-badge--${kind}${className ? ` ${className}` : ''}`}>{children}</span>;
}
