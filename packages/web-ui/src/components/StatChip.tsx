// 統計膠囊（站規 1.6）：闖關 HUD、PageHeader、玩家卡共用。高 44、圓角 full、--ll-chrome-bg，平的（沒有底邊）。
// 圖示 20px 實心彩色（依 tone），數字 17/700 等寬。有 href 是連結（滑過、按下換底色，焦點 outline），沒有 href 是不可聚焦的 span。
// label 必填：完整的可讀名稱（例如「星星 12 顆」「徽章 2／14 枚」），數字由 packages/i18n 格式化後當 ICU 參數；畫面上的數字對螢幕閱讀器隱藏。
import type { MouseEventHandler, ReactNode } from 'react';
import { UiLink } from './link-context.tsx';

export type StatChipTone = 'star' | 'badge' | 'review' | 'terms' | 'neutral';

export interface StatChipProps {
  icon: ReactNode;
  /** 畫面上的數字或短字（例如「12」「2／14」） */
  value: ReactNode;
  /** 完整的可讀名稱 */
  label: string;
  /** 圖示顏色：star 星星黃、badge 徽章金、review 錯題紅、terms 圖鑑綠 */
  tone?: StatChipTone;
  href?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  /** 右上角的小紅點（例如有到期的錯題），只是輔助，label 要說清楚 */
  dot?: boolean;
  className?: string;
  'data-testid'?: string;
}

export function StatChip({ icon, value, label, tone = 'neutral', href, onClick, dot, className, ...rest }: StatChipProps) {
  const cls = `ll-statchip ll-statchip--${tone}${className ? ` ${className}` : ''}`;
  const body = (
    <>
      <span className="ll-statchip__icon">{icon}</span>
      <span className="ll-statchip__value ll-num" aria-hidden="true">
        {value}
      </span>
      <span className="ll-sr-only">{label}</span>
      {dot && <span className="ll-statchip__dot" aria-hidden="true" />}
    </>
  );
  if (href !== undefined) {
    return (
      <UiLink {...rest} href={href} className={cls} onClick={onClick}>
        {body}
      </UiLink>
    );
  }
  return (
    <span {...rest} className={cls}>
      {body}
    </span>
  );
}
