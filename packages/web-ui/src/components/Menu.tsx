// 選單（站規 1.9）：HUD 的「更多」（地圖規格 4.8），以後的頁首選單也用它。
// MenuButton 是 IconButton（預設 chrome），aria-haspopup="menu"、aria-expanded；面板 role="menu"，貼在按鈕下方 8px、右緣對齊按鈕。
// 鍵盤：打開時焦點到第一項；上下鍵移動（頭尾相接）、Home、End、Enter 觸發；Esc 或點外面關閉，焦點回到按鈕；Tab 離開時直接關閉。
// MenuItem 是按鈕或連結（role="menuitem"、44px、20px 圖示加文字）；觸發後自動關閉選單。
// 記帳編輯器的科目面板不改互動語意（07 第 9.1 節），只用 menuItemClass() 借外觀。
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { IconButton } from './IconButton.tsx';
import { MoreIcon } from './icons.tsx';
import { UiLink } from './link-context.tsx';
import { useUiLabels } from './ui-labels.ts';

interface MenuCtx {
  close: (returnFocus: boolean) => void;
}
const MenuContext = createContext<MenuCtx | null>(null);

/** 選單項目的 class（給不是 role="menu" 但要同樣外觀的選項按鈕，例如記帳編輯器的科目面板） */
export function menuItemClass(extra?: string): string {
  return `ll-menuitem${extra ? ` ${extra}` : ''}`;
}

export interface MenuButtonProps {
  /** 按鈕的可讀名稱，預設「更多」 */
  label?: string;
  /** 預設 MoreIcon */
  icon?: ReactNode;
  /** 預設 chrome（頁首與 HUD）；quiet 給卡片裡 */
  variant?: 'chrome' | 'quiet';
  /** 面板對齊按鈕的哪一邊，預設 end（右緣對齊） */
  align?: 'start' | 'end';
  /** 只放 MenuItem */
  children: ReactNode;
  onOpenChange?: (open: boolean) => void;
  /** 一掛上就打開（焦點到第一項）：給延後載入的選單，使用者在載入前就按了按鈕時用 */
  defaultOpen?: boolean;
  className?: string;
  'data-testid'?: string;
}

function items(menu: HTMLElement | null): HTMLElement[] {
  if (!menu) return [];
  return Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])'));
}

export function MenuButton({
  label,
  icon,
  variant = 'chrome',
  align = 'end',
  children,
  onOpenChange,
  defaultOpen = false,
  className,
  ...rest
}: MenuButtonProps) {
  const labels = useUiLabels();
  const [open, setOpen] = useState(defaultOpen);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const buttonId = useId();
  const changed = useRef(onOpenChange);
  useEffect(() => {
    changed.current = onOpenChange;
  });

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    changed.current?.(false);
    if (returnFocus) button.current?.focus({ preventScroll: true });
  }, []);

  // 打開後焦點到第一項
  useEffect(() => {
    if (open) items(menu.current)[0]?.focus({ preventScroll: true });
  }, [open]);

  // 點外面關閉（焦點不搶回按鈕：使用者已經點到別的地方）
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [open, close]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    changed.current?.(next);
  };

  // 鍵盤：用原生監聽（容器與面板不是互動元素，check:links R5 不准在它們身上掛 onKeyDown）
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      // 選單按鈕上按上下鍵：打開
      if (e.target === button.current) {
        if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
          e.preventDefault();
          setOpen(true);
          changed.current?.(true);
        }
        return;
      }
      if (!open || !menu.current?.contains(e.target as Node)) return;
      const list = items(menu.current);
      if (list.length === 0) return;
      const i = list.indexOf(document.activeElement as HTMLElement);
      let next = -1;
      if (e.key === 'ArrowDown') next = (i + 1) % list.length;
      else if (e.key === 'ArrowUp') next = (i - 1 + list.length) % list.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = list.length - 1;
      else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close(true);
        return;
      } else if (e.key === 'Tab') {
        close(false);
        return;
      }
      if (next >= 0) {
        e.preventDefault();
        list[next]?.focus();
      }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [open, close]);

  return (
    <div ref={wrap} className={`ll-menu${className ? ` ${className}` : ''}`}>
      <IconButton
        ref={button}
        id={buttonId}
        icon={icon ?? <MoreIcon />}
        label={label ?? labels.more}
        variant={variant}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={toggle}
        data-testid={rest['data-testid']}
      />
      {open && (
        <MenuContext.Provider value={{ close }}>
          <div ref={menu} id={menuId} className={`ll-menu__panel ll-menu__panel--${align}`} role="menu" aria-labelledby={buttonId}>
            {children}
          </div>
        </MenuContext.Provider>
      )}
    </div>
  );
}

export interface MenuItemProps {
  icon?: ReactNode;
  children: ReactNode;
  /** 有 href 是連結（經 LinkProvider） */
  href?: string;
  onClick?: (e: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
  disabled?: boolean;
  /** 觸發後焦點要不要回到選單按鈕（預設 true；項目會開疊加層或換頁時給 false） */
  returnFocus?: boolean;
  lang?: string;
  'data-testid'?: string;
}

export function MenuItem({ icon, children, href, onClick, disabled, returnFocus = true, lang, ...rest }: MenuItemProps) {
  const ctx = useContext(MenuContext);
  const body = (
    <>
      <span className="ll-menuitem__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="ll-menuitem__label">{children}</span>
    </>
  );
  const activate = (e: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    onClick?.(e);
    ctx?.close(href === undefined && returnFocus);
  };
  if (href !== undefined && !disabled) {
    return (
      <UiLink href={href} className="ll-menuitem" role="menuitem" tabIndex={-1} onClick={activate} lang={lang} data-testid={rest['data-testid']}>
        {body}
      </UiLink>
    );
  }
  return (
    <button
      type="button"
      className="ll-menuitem"
      role="menuitem"
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : activate}
      lang={lang}
      data-testid={rest['data-testid']}
    >
      {body}
    </button>
  );
}
