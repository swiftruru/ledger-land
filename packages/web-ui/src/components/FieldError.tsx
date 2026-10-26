// 欄位錯誤訊息（站規 1.2.4）：所有文字輸入共用。欄位加 class ll-input（錯誤時 aria-invalid="true"、aria-describedby 指向這裡），
// 錯誤時邊框 2px --ll-danger-ink、聚焦框也改成同一個顏色（只有一種紅）；訊息在欄位下方 8px，前置 16px WarningIcon、body-sm。
// 用在 LevelCodeInput、備份碼文字框；SearchField 共用同一套欄位外觀（沒有錯誤狀態）。
import type { ReactNode } from 'react';
import { WarningIcon } from './icons.tsx';

export interface FieldErrorProps {
  id: string;
  children: ReactNode;
  className?: string;
}

export function FieldError({ id, children, className }: FieldErrorProps) {
  return (
    <p id={id} className={`ll-fielderror${className ? ` ${className}` : ''}`}>
      <WarningIcon size={16} />
      <span>{children}</span>
    </p>
  );
}
