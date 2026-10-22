import type { ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

/** 按鈕：最小觸控目標 44px；主按鈕是強調色填色加對比文字（16 第 2.2 節） */
export function Button({ variant = 'secondary', className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={`ll-btn${variant === 'primary' ? ' ll-btn--primary' : ''}${className ? ` ${className}` : ''}`} {...rest} />;
}
