import type { ReactNode } from 'react';

/** 卡片：靠髮絲線與淡影浮起，不用實線邊框（16 第 1 節） */
export function Card({
  children,
  className,
  as: Tag = 'div',
  ...rest
}: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' | 'form' } & Record<string, unknown>) {
  return (
    <Tag className={`ll-card${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </Tag>
  );
}
