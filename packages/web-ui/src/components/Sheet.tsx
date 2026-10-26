// 面板（站規 1.10）的固定結構：LevelSheet、TermSheet、地圖疊加層與確認面板共用。原生 <dialog>（showModal 提供焦點鎖定、Esc 與 inert 背景）。
// 頭：選用的 lead（例如關卡節點與星星、類別 Badge）、h2 標題（title-3，tabindex=-1，開啟時的初始焦點）、副標，右上 IconButton quiet「關閉」；
// compact 時頂端有 36×4 的拖曳把手（裝飾）。身：內容。腳：動作列，最後一顆是主動作（primary lg block）；不要再放一顆「關閉」按鈕。
// 關閉後焦點回到開啟它的元素（returnFocusTo 優先，其次是開啟時的焦點元素）；父層在開著的時候直接卸載也一樣（layout effect 清理）。
// 點遮罩（dialog 本身，不是內容）也會關閉。
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { Button } from './Button.tsx';
import { IconButton } from './IconButton.tsx';
import { XIcon } from './icons.tsx';
import { useUiLabels } from './ui-labels.ts';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** 副標（例如另一種語言的名稱、「第 3 章 損益表」） */
  subtitle?: ReactNode;
  subtitleLang?: string;
  /** 標題上方的小區塊（關卡節點與星星、類別 Badge） */
  lead?: ReactNode;
  /** 腳的動作列（最後一顆是主動作） */
  footer?: ReactNode;
  /** 手機上的拖曳把手（裝飾）；預設 true */
  grip?: boolean;
  /** 關閉後要把焦點還給的元素；Safari 點按鈕不會給焦點，不能只靠 document.activeElement */
  returnFocusTo?: RefObject<HTMLElement | null>;
  /** 關閉鈕的可讀名稱，預設「關閉」 */
  closeLabel?: string;
  /** 外層 class（例如 ll-sheet--level），只給版面用 */
  className?: string;
  /** 內容區 class */
  bodyClassName?: string;
  /** 說明文字的 id（確認面板的說明） */
  describedBy?: string;
  'data-testid'?: string;
  children?: ReactNode;
}

function restore(el: HTMLElement | null | undefined, dialog: HTMLDialogElement) {
  if (el && el.isConnected && el !== document.body) el.focus({ preventScroll: true });
  else if (dialog.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
}

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  subtitleLang,
  lead,
  footer,
  grip = true,
  returnFocusTo,
  closeLabel,
  className,
  bodyClassName,
  describedBy,
  'data-testid': testId,
  children,
}: SheetProps) {
  const labels = useUiLabels();
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const returnRef = useRef(returnFocusTo);
  // 由 open 變 false 觸發的 d.close() 也會（非同步）發 close 事件；父層已經把 open 設為 false，那一次不再回呼 onClose
  const openRef = useRef(open);
  const closeRef = useRef(onClose);
  // 按下與放開都在遮罩上才算點遮罩（在內容裡選字、拖到外面放開不算）
  const downOnBackdrop = useRef(false);
  useLayoutEffect(() => {
    returnRef.current = returnFocusTo;
    closeRef.current = onClose;
  });
  const titleId = useId();
  useEffect(() => {
    openRef.current = open;
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      d.showModal();
      // 初始焦點放在標題（不是關閉鈕）：螢幕閱讀器先讀標題；標題不是互動元素，滑鼠與觸控開啟時看不到焦點圈
      heading.current?.focus({ preventScroll: true });
    } else if (!open && d.open) {
      d.close();
      restore(returnFocusTo?.current ?? opener.current, d);
      opener.current = null;
    }
  }, [open, returnFocusTo]);
  // 點遮罩關閉：事件的目標是 dialog 本身（內容都包在 .ll-sheet__body 裡）；按下與放開都在遮罩上才算（在內容裡選字、拖到外面放開不算）。
  // 用原生監聽：dialog 不是互動元素，滑鼠的關閉只是輔助，鍵盤有 Esc 與關閉鈕
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onDown = (e: PointerEvent) => {
      downOnBackdrop.current = e.target === d;
    };
    const onClick = (e: MouseEvent) => {
      if (e.target === d && downOnBackdrop.current) closeRef.current();
      downOnBackdrop.current = false;
    };
    d.addEventListener('pointerdown', onDown);
    d.addEventListener('click', onClick);
    return () => {
      d.removeEventListener('pointerdown', onDown);
      d.removeEventListener('click', onClick);
    };
  }, []);
  // 開著被卸載：只在卸載時執行；d 在 effect 裡取好，清理時 ref.current 已經是 null
  useLayoutEffect(() => {
    const d = ref.current;
    return () => {
      if (!d?.open) return;
      d.close();
      // 刻意讀卸載當下的值（最新的 returnFocusTo 與開啟時記下的元素）
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      const el = returnRef.current?.current ?? opener.current;
      if (el && el.isConnected && el !== document.body) el.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`ll-sheet${className ? ` ${className}` : ''}`}
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      aria-modal="true"
      data-testid={testId}
      onClose={() => {
        if (openRef.current) closeRef.current();
      }}
      onCancel={(e) => {
        e.preventDefault();
        closeRef.current();
      }}
    >
      <div className="ll-sheet__body">
        {grip && <div className="ll-sheet__grip" aria-hidden="true" />}
        <div className="ll-sheet__head">
          <div className="ll-sheet__heading">
            {lead && <div className="ll-sheet__lead">{lead}</div>}
            <h2 ref={heading} id={titleId} className="ll-sheet__title" tabIndex={-1}>
              {title}
            </h2>
            {subtitle !== undefined && subtitle !== null && (
              <p className="ll-sheet__subtitle" lang={subtitleLang}>
                {subtitle}
              </p>
            )}
          </div>
          <IconButton icon={<XIcon />} label={closeLabel ?? labels.close} onClick={onClose} className="ll-sheet__close" />
        </div>
        {children !== undefined && children !== null && <div className={`ll-sheet__content${bodyClassName ? ` ${bodyClassName}` : ''}`}>{children}</div>}
        {footer && <div className="ll-sheet__foot">{footer}</div>}
      </div>
    </dialog>
  );
}

export interface ConfirmSheetProps {
  open: boolean;
  /** 取消、Esc、X、點遮罩 */
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  /** 一段說明：做了會怎樣、能不能復原 */
  description: ReactNode;
  confirmLabel: ReactNode;
  confirmIcon?: ReactNode;
  /** 預設 true：主動作是 danger；false 時是 primary */
  destructive?: boolean;
  /** 預設「取消」 */
  cancelLabel?: ReactNode;
  /** 主動作進行中（例如正在覆蓋）：轉圈、取消仍可按 */
  busy?: boolean;
  returnFocusTo?: RefObject<HTMLElement | null>;
  'data-testid'?: string;
}

/** 確認面板：標題、一段說明，腳的兩顆是「取消」（quiet md，在上）與主動作（破壞性時 danger lg block，在下） */
export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  confirmIcon,
  destructive = true,
  cancelLabel,
  busy,
  returnFocusTo,
  'data-testid': testId,
}: ConfirmSheetProps) {
  const labels = useUiLabels();
  const descId = useId();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      returnFocusTo={returnFocusTo}
      className="ll-sheet--confirm"
      describedBy={descId}
      data-testid={testId}
      footer={
        <>
          <Button variant="quiet" size="md" block onClick={onClose}>
            {cancelLabel ?? labels.cancel}
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} size="lg" block icon={confirmIcon} busy={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p id={descId} className="ll-sheet__desc">
        {description}
      </p>
    </Sheet>
  );
}
