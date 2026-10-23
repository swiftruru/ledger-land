// 名詞卡入口（03 第 4.3 節、07 第 8.3 節）：button，可讀名稱「名詞卡：營業毛利」
import { useLingui } from '@lingui/react/macro';
import type { ButtonHTMLAttributes, Ref } from 'react';
import { BookmarkIcon } from './icons.tsx';

export interface TermChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string;
  /** 名詞的語言與介面語言不同時（例如中文介面顯示 IFRS 英文）設定 lang */
  labelLang?: string;
  /** 給 TermSheet 的 returnFocusTo 用，關閉名詞卡後焦點回到這裡 */
  ref?: Ref<HTMLButtonElement>;
}

export function TermChip({ label, labelLang, className, type = 'button', ...rest }: TermChipProps) {
  const { t } = useLingui();
  return (
    <button
      type={type}
      className={`ll-chip${className ? ` ${className}` : ''}`}
      aria-label={t({ id: 'term.chip', message: `名詞卡：${label}`, comment: '名詞卡 chip 的可讀名稱；label 是名詞' })}
      {...rest}
    >
      <BookmarkIcon size={16} />
      <span lang={labelLang}>{label}</span>
    </button>
  );
}
