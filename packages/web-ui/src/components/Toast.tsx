// 提示（07 第 9 節）：不搶焦點；可帶一個動作（Button quiet sm）與關閉（IconButton）。
// 播報：事件型的提示（取得徽章、收進名詞）要放在常駐的 ToastRegion 裡。region 從第一次繪製就在 DOM 裡、帶 role="status"，
// 之後插入的 Toast 才會被讀出來（很多讀屏組合不播報「插入時就有內容」的 live region）。在 region 裡的 Toast 本身不帶 role，
// 避免巢狀 live region 唸兩次；單獨使用的 Toast（舊寫法）仍自己帶 role="status"。
import { useLingui } from '@lingui/react/macro';
import { createContext, useContext, useEffect, useRef, type HTMLAttributes, type ReactNode } from 'react';
import { Button } from './Button.tsx';
import { IconButton } from './IconButton.tsx';
import { XIcon } from './icons.tsx';

const InRegion = createContext(false);

export interface ToastRegionProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  /** 焦點或滑鼠停在提示裡時是 true：父層據此暫停自動收起的計時 */
  onHoldChange?: (held: boolean) => void;
  'data-testid'?: string;
}

/** 常駐的播報區：放在不會因為狀態改變而重新掛載的地方，裡面再放 Toast */
export function ToastRegion({ className, children, onHoldChange, ...rest }: ToastRegionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const hold = useRef(onHoldChange);
  useEffect(() => {
    hold.current = onHoldChange;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const state = { focus: false, hover: false, held: false };
    const sync = () => {
      const held = state.focus || state.hover;
      if (held !== state.held) {
        state.held = held;
        hold.current?.(held);
      }
    };
    const onFocusIn = () => {
      state.focus = true;
      sync();
    };
    const onFocusOut = (e: FocusEvent) => {
      state.focus = el.contains(e.relatedTarget as Node | null);
      sync();
    };
    const onEnter = () => {
      state.hover = true;
      sync();
    };
    const onLeave = () => {
      state.hover = false;
      sync();
    };
    el.addEventListener('focusin', onFocusIn);
    el.addEventListener('focusout', onFocusOut);
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('focusin', onFocusIn);
      el.removeEventListener('focusout', onFocusOut);
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, []);
  return (
    <div {...rest} ref={ref} className={`ll-toasts${className ? ` ${className}` : ''}`} role="status" aria-live="polite">
      <InRegion.Provider value={true}>{children}</InRegion.Provider>
    </div>
  );
}

export interface ToastProps {
  /** 內文；有 title 時是第二行（例如徽章名稱） */
  children: ReactNode;
  /** collect 是收集類（取得徽章、收進名詞）：左側星星色條、標題 title-3，media 出現時有一次縮放（減少動態時沒有） */
  kind?: 'info' | 'success' | 'warning' | 'danger' | 'collect';
  /** 選用的標題（第一行，title-3 600），例如「取得精通徽章」 */
  title?: ReactNode;
  /** 選用的 40px 圖像槽（例如 ChapterBadge），裝飾用、aria-hidden：意思要寫在 title 與內文 */
  media?: ReactNode;
  action?: { label: ReactNode; onClick: () => void };
  onDismiss?: () => void;
  className?: string;
}

export function Toast({ children, kind = 'info', title, media, action, onDismiss, className }: ToastProps) {
  const { t } = useLingui();
  const inRegion = useContext(InRegion);
  const hasTitle = title !== undefined && title !== null;
  return (
    <div className={`ll-toast ll-toast--${kind}${media ? ' ll-toast--media' : ''}${className ? ` ${className}` : ''}`} role={inRegion ? undefined : 'status'}>
      {media && (
        <span className="ll-toast__media" aria-hidden="true">
          {media}
        </span>
      )}
      {hasTitle ? (
        <div className="ll-toast__text">
          <p className="ll-toast__title">{title}</p>
          <div className="ll-toast__body">{children}</div>
        </div>
      ) : (
        <div className="ll-toast__text">{children}</div>
      )}
      {action && (
        <Button variant="quiet" size="sm" className="ll-toast__action" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
      {onDismiss && (
        <IconButton icon={<XIcon />} label={t({ id: 'ui.dismiss', message: '關閉提示', comment: 'Toast 關閉按鈕的可讀名稱' })} onClick={onDismiss} noTitle />
      )}
    </div>
  );
}
