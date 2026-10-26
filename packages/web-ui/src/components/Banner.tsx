// 提示橫幅（16 第 4.3 節、站規 1.20、2.17）：tint 當底、ink 當文字。版面：左側 20px 圖示（依 kind）、標題（選用，17/600）、
// 內文 body-sm、動作列（gap 8；窄螢幕時主動作在上）；可關閉時右上 IconButton quiet「關閉」。kind 的色系不變。
// 動作只放 Button（主動作 primary sm、次動作 secondary 或 quiet sm）；錯誤與危險橫幅裡不放 TextLink（站規 1.12 規則 5）。
// 舊寫法（只有 children）照樣能用：children 放在內文欄，圖示自動加上；不要圖示時給 icon={false}。
import type { ReactNode } from 'react';
import { IconButton } from './IconButton.tsx';
import { CheckCircleIcon, InfoIcon, WarningIcon, XIcon } from './icons.tsx';
import { useUiLabels } from './ui-labels.ts';

export interface BannerProps {
  kind?: 'info' | 'warning' | 'success' | 'danger';
  /** 內文（舊寫法可以直接放段落與按鈕列） */
  children?: ReactNode;
  /** 標題（選用） */
  title?: ReactNode;
  /** 動作列：Button sm（主動作在前） */
  actions?: ReactNode;
  /** 可關閉時給：右上角的 X */
  onDismiss?: () => void;
  dismissLabel?: string;
  /** 預設依 kind；false 不放 */
  icon?: ReactNode | false;
  role?: 'status' | 'alert' | 'note';
  className?: string;
  lang?: string;
  'data-testid'?: string;
}

function kindIcon(kind: NonNullable<BannerProps['kind']>) {
  if (kind === 'success') return <CheckCircleIcon />;
  if (kind === 'warning' || kind === 'danger') return <WarningIcon />;
  return <InfoIcon />;
}

export function Banner({
  kind = 'info',
  children,
  title,
  actions,
  onDismiss,
  dismissLabel,
  icon,
  role = 'note',
  className,
  lang,
  'data-testid': testId,
}: BannerProps) {
  const labels = useUiLabels();
  const glyph = icon === false ? null : (icon ?? kindIcon(kind));
  return (
    <div
      className={`ll-banner ll-banner--${kind}${glyph ? ' ll-banner--icon' : ''}${onDismiss ? ' ll-banner--dismissible' : ''}${className ? ` ${className}` : ''}`}
      role={role}
      lang={lang}
      data-testid={testId}
    >
      {glyph && (
        <span className="ll-banner__icon" aria-hidden="true">
          {glyph}
        </span>
      )}
      <div className="ll-banner__main">
        {title !== undefined && title !== null && <p className="ll-banner__title">{title}</p>}
        {children !== undefined && children !== null && <div className="ll-banner__body">{children}</div>}
        {actions && <div className="ll-banner__actions">{actions}</div>}
      </div>
      {onDismiss && <IconButton icon={<XIcon />} label={dismissLabel ?? labels.close} onClick={onDismiss} className="ll-banner__close" />}
    </div>
  );
}
