// 頁首的返回（站規 1.4）：平面膠囊（--ll-chrome-bg，沒有底邊），左邊 CaretLeftIcon、右邊短字；沒有短字時是 44×44 圓形。
// 目的地固定是上一層（父層以 localePath() 產生，帶結尾斜線），不是 history.back()，深連結進來也回得去。
// 可讀名稱（WCAG 2.5.3）：label 必須包含畫面上的短字，例如畫面「地圖」配「回到闖關地圖」；開發模式會檢查。
import { Button } from './Button.tsx';
import { CaretLeftIcon } from './icons.tsx';

export interface BackButtonProps {
  /** 站內上一層的網址（父層以 localePath() 產生，帶結尾斜線） */
  href?: string;
  /** 疊加層或作答中：沒有網址，由父層處理 */
  onBack?: () => void;
  /** 可讀名稱，例如「回到闖關地圖」 */
  label: string;
  /** 畫面上的短字，例如「地圖」；省略時只顯示圖示 */
  shortLabel?: string;
  className?: string;
}

export function BackButton({ href, onBack, label, shortLabel, className }: BackButtonProps) {
  if (import.meta.env.DEV) {
    if (label.trim() === '') throw new Error('BackButton 的 label 不得是空字串');
    if (shortLabel && !label.includes(shortLabel)) throw new Error(`BackButton 的 label「${label}」必須包含畫面上的短字「${shortLabel}」（WCAG 2.5.3）`);
  }
  const cls = `ll-backbtn${shortLabel ? '' : ' ll-btn--icon-only'}${className ? ` ${className}` : ''}`;
  const icon = <CaretLeftIcon />;
  // 有短字時，畫面上的字就是名稱的一部分；aria-label 給完整的「回到…」
  if (href !== undefined) {
    return (
      <Button variant="back" size="sm" href={href} icon={icon} className={cls} aria-label={label} title={shortLabel ? undefined : label}>
        {shortLabel}
      </Button>
    );
  }
  return (
    <Button variant="back" size="sm" icon={icon} className={cls} aria-label={label} title={shortLabel ? undefined : label} onClick={onBack}>
      {shortLabel}
    </Button>
  );
}
