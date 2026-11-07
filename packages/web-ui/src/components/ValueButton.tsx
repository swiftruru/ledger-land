// 可追蹤的數字（03 第 3.9 節、站規 1.21，M4b）：報表格子、指標卡與恆等式摘要裡的金額本身是按鈕，按下去開「這個數字從哪裡來」的面板。
// 和行內名詞 chip 一樣是行內例外（WCAG 2.5.8）：不撐開行高、不加底線，用虛線下框表示可點；可讀名稱由呼叫端給完整的句子
// （例如「營業利益 48,000，看這個數字從哪裡來」），數字本身對螢幕閱讀器隱藏，避免唸兩次。屬性逐一列出，不展開任意 props（check:links R6）。
// 樣式：.ll-valuebtn 在 apps/web 的 lab.css（入口 CSS 只剩 0.2 KB 的餘裕，2026-11-07；目前只有實驗室用它，搬進 web-ui 的樣式要先談預算）。
import type { MouseEventHandler, ReactNode, Ref } from 'react';

export interface ValueButtonProps {
  /** 完整的可讀名稱（含數字與動作） */
  label: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
  /** 關閉面板後要把焦點還回來，呼叫端用 ref 記住 */
  ref?: Ref<HTMLButtonElement>;
  /** 只給版面用 */
  className?: string;
  'data-testid'?: string;
  'data-line'?: string;
  children: ReactNode;
}

export function ValueButton({ label, onClick, ref, className, 'data-testid': testId, 'data-line': line, children }: ValueButtonProps) {
  return (
    <button
      ref={ref}
      type="button"
      className={`ll-valuebtn ll-num${className ? ` ${className}` : ''}`}
      aria-label={label}
      onClick={onClick}
      data-testid={testId}
      data-line={line}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
