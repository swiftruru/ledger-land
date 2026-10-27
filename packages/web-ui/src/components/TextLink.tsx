// 文中連結（站規 1.12）：只用在句子裡提到的頁面。顏色加底線（不只靠顏色，WCAG 1.4.1）；中文的底線位置比英文高一點。
// 站內連結經 LinkProvider；外部連結結尾加 ArrowUpRightIcon（和最後一個字綁在一起）與視覺隱藏的「（外部網站）」。
// 錯誤與危險區塊裡不要用（紙質的強調色和錯誤色太接近），改用 Button sm。按鈕、選單列、名詞卡都不要用它。
import { useLingui } from '@lingui/react/macro';
import type { MouseEventHandler, ReactNode } from 'react';
import { ArrowUpRightIcon } from './icons.tsx';
import { UiLink } from './link-context.tsx';

export interface TextLinkProps {
  href: string;
  external?: boolean;
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  lang?: string;
  className?: string;
}

function External() {
  const { t } = useLingui();
  return (
    <span className="ll-link__ext">
      {'⁠'}
      <ArrowUpRightIcon />
      <span className="ll-sr-only">
        {t({ id: 'ui.externalSite', message: '（外部網站，另開分頁）', comment: '連到站外網址的按鈕或連結後面，給螢幕閱讀器的說明（會另開分頁）' })}
      </span>
    </span>
  );
}

export function TextLink({ href, external, children, onClick, lang, className }: TextLinkProps) {
  return (
    <UiLink href={href} external={external} onClick={onClick} lang={lang} className={`ll-link${className ? ` ${className}` : ''}`}>
      {children}
      {external && <External />}
    </UiLink>
  );
}
