// 名詞卡入口（03 第 4.3 節、07 第 8.3 節、站規 1.19）：button，可讀名稱「名詞卡：營業毛利」。
// 獨立的 chip（回饋區「相關名詞」、名詞卡的相關名詞）是 44px 的膠囊；嵌在句子裡的行內 chip（inline）依 WCAG 2.5.8 的行內例外維持行高，
// 不加底線，用 accent-ink 的虛線下框表示可點（樣式在 04-quiz-types.css）。屬性逐一列出，不把任意 props 展開到 button 上（check:links R6）。
// 獨立 chip 的圖示是圖鑑卡片（CardsIcon，和 Tab bar 的「圖鑑」同一個）：書籤留給錯題本，同一塊回饋區裡一個圖示只代表一件事。
// isNew：這一題剛收進圖鑑的名詞，整顆 chip 鍍金（淡金底、金框，樣式在 15-quiz-session.css），最前面的卡片圖示換成金色勾章（.ll-stamp--inline，
// 和名詞圖鑑「已收進」的印章同一種，回饋區的「新收進 N」前面也是它）；可讀名稱加「剛收進圖鑑」，不只靠顏色。標記都畫在 chip 裡面，不壓外框線
// （M3 驗收後維護者的要求：原本右上角的 8px 圓點騎在膠囊外框上，看起來像跑版）。
import { useLingui } from '@lingui/react/macro';
import type { MouseEventHandler, Ref } from 'react';
import { CardsIcon, CheckIcon } from './icons.tsx';

export interface TermChipProps {
  label: string;
  /** 名詞的語言與介面語言不同時（例如中文介面顯示 IFRS 英文）設定 lang */
  labelLang?: string;
  /** 嵌在句子裡（行內例外，不撐開行距） */
  inline?: boolean;
  /** 這一題剛收進圖鑑（只給獨立的 chip） */
  isNew?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  id?: string;
  /** 只給版面用；舊寫法 ll-chip--inline 等於 inline */
  className?: string;
  /** 給 TermSheet 的 returnFocusTo 用，關閉名詞卡後焦點回到這裡 */
  ref?: Ref<HTMLButtonElement>;
  'data-testid'?: string;
}

export function TermChip({ label, labelLang, inline, isNew, onClick, disabled, id, className, ref, 'data-testid': testId }: TermChipProps) {
  const { t } = useLingui();
  const showNew = isNew === true && !inline;
  const cls = ['ll-chip', inline && 'll-chip--inline', showNew && 'll-chip--new', className].filter(Boolean).join(' ');
  return (
    <button
      ref={ref}
      type="button"
      id={id}
      className={cls}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      aria-label={
        showNew
          ? t({
              id: 'term.chipNew',
              message: `名詞卡：${label}，剛收進圖鑑`,
              comment: '這一題剛收進圖鑑的名詞 chip 的可讀名稱（最前面是金色勾章，和名詞圖鑑已收進的印章同一種）；label 是名詞',
            })
          : t({ id: 'term.chip', message: `名詞卡：${label}`, comment: '名詞卡 chip 的可讀名稱；label 是名詞' })
      }
    >
      {!inline &&
        !className?.includes('ll-chip--inline') &&
        (showNew ? (
          <span className="ll-stamp ll-stamp--inline" aria-hidden="true">
            <CheckIcon size={12} strokeWidth={3} />
          </span>
        ) : (
          <CardsIcon size={16} />
        ))}
      <span lang={labelLang}>{label}</span>
    </button>
  );
}
