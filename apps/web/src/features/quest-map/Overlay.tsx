// 地圖上的疊加層（02 第 2 節、站規 1.10 與 2.2.5）：共用的 Sheet（原生 dialog、焦點鎖定、Esc、X、點遮罩關閉，開啟時焦點在標題），
// compact 是滿寬的底部面板、768px 以上置中；歷史紀錄由 Play 頁管理。按鈕放在內容裡（代號輸入的送出屬於表單），不另放「關閉」。
import type { ReactNode, RefObject } from 'react';
import { Sheet } from '@ledgerland/web-ui';

export interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** 關閉後焦點要回到的元素（例如 HUD 的「更多」或工具按鈕） */
  returnFocusTo?: RefObject<HTMLElement | null>;
  testId?: string;
}

export function Overlay({ open, onClose, title, children, returnFocusTo, testId }: OverlayProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title} returnFocusTo={returnFocusTo} className="qm-overlay" data-testid={testId}>
      {open ? children : null}
    </Sheet>
  );
}
