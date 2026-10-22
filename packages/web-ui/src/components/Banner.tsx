import type { ReactNode } from 'react';

export interface BannerProps {
  kind?: 'info' | 'warning' | 'success' | 'danger';
  children: ReactNode;
  role?: 'status' | 'alert' | 'note';
  className?: string;
}

/** 提示橫幅：tint 當底、ink 當文字（16 第 4.3 節） */
export function Banner({ kind = 'info', children, role = 'note', className }: BannerProps) {
  return (
    <div className={`ll-banner ll-banner--${kind}${className ? ` ${className}` : ''}`} role={role}>
      {children}
    </div>
  );
}
