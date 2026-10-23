// 地圖上的疊加層（02 第 2 節）：原生 dialog（焦點鎖定、Esc），compact 是底部表單、768px 以上置中；歷史紀錄由 Play 頁管理。
import { useLingui } from '@lingui/react/macro';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { XIcon } from '@ledgerland/web-ui/map';

export interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  testId?: string;
}

export function Overlay({ open, onClose, title, children, testId }: OverlayProps) {
  const { t } = useLingui();
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  // 由 open 變 false 觸發的 d.close() 也會（非同步）發 close 事件；父層已經把 open 設為 false，那一次不再回呼 onClose
  const openRef = useRef(open);
  const titleId = useId();
  useEffect(() => {
    openRef.current = open;
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      d.showModal();
    } else if (!open && d.open) {
      d.close();
      const el = opener.current;
      if (el && el.isConnected && el !== document.body) el.focus({ preventScroll: true });
      opener.current = null;
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="ll-sheet"
      aria-labelledby={titleId}
      aria-modal="true"
      data-testid={testId}
      onClose={() => {
        if (openRef.current) onClose();
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {open && (
        <div className="ll-sheet__body">
          <div className="ll-sheet__head">
            <h2 id={titleId} className="ll-sheet__title">
              {title}
            </h2>
            <button
              type="button"
              className="ll-iconbtn"
              onClick={onClose}
              aria-label={t({ id: 'ui.close', message: '關閉', comment: '對話框關閉按鈕的可讀名稱' })}
            >
              <XIcon />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
