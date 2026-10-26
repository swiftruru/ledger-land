// 只有圖示的按鈕（站規 1.3）：44×44 圓形、圖示 22px。quiet 是透明的（面板與橫幅的關閉、清除搜尋、介紹、移除）；
// chrome 是頁首與 HUD 的平面底色，沒有底邊。label 必填：是 aria-label，也是滑過時的 title。給 href 就經 LinkProvider 成為連結。
import type { AriaAttributes, MouseEventHandler, ReactNode, Ref } from 'react';
import { UiLink } from './link-context.tsx';

export interface IconButtonProps extends Pick<AriaAttributes, 'aria-expanded' | 'aria-controls' | 'aria-haspopup' | 'aria-describedby' | 'aria-current'> {
  icon: ReactNode;
  /** 可讀名稱（必填，不得是空字串） */
  label: string;
  /** 預設 quiet */
  variant?: 'quiet' | 'chrome';
  /** 有 href 是連結（例如 HintBar 的「詳細」） */
  href?: string;
  external?: boolean;
  /** 切換按鈕：輸出 aria-pressed（只對按鈕形式有效） */
  pressed?: boolean;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  /** 不顯示 title 提示（例如旁邊已經有同樣的文字） */
  noTitle?: boolean;
  type?: 'button' | 'submit';
  className?: string;
  id?: string;
  ref?: Ref<HTMLButtonElement>;
  'data-testid'?: string;
}

export function IconButton({
  icon,
  label,
  variant = 'quiet',
  href,
  external,
  pressed,
  disabled,
  onClick,
  noTitle,
  type = 'button',
  className,
  ref,
  ...aria
}: IconButtonProps) {
  if (import.meta.env.DEV && label.trim() === '') throw new Error('IconButton 的 label 不得是空字串（它是按鈕唯一的可讀名稱）');
  const cls = `ll-iconbtn ll-iconbtn--${variant}${className ? ` ${className}` : ''}`;
  const glyph = <span className="ll-iconbtn__glyph">{icon}</span>;
  if (href !== undefined && !disabled) {
    return (
      <UiLink {...aria} href={href} external={external} className={cls} aria-label={label} title={noTitle ? undefined : label} onClick={onClick}>
        {glyph}
      </UiLink>
    );
  }
  return (
    <button
      {...aria}
      ref={ref}
      type={type}
      className={cls}
      aria-label={label}
      title={noTitle ? undefined : label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      {glyph}
    </button>
  );
}
