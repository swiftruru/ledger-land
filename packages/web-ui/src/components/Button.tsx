// 遊戲按鈕（站規 1.2）：五個變體（primary、secondary、back、quiet、danger）、三種尺寸（sm、md、lg）。
// primary、secondary、danger 有 4px 立體底邊（--ll-btn-depth，和地圖節點同一組），按下時沉 4px、底邊歸零；back、quiet 是平的。
// 給 href 就經 LinkProvider 渲染成連結（站內是 react-router 的 Link，不會整頁重新載入），否則是 <button>（預設 type="button"）。
// 文字永遠沒有底線；className 只給版面用（例如 margin），不得用來改外觀。
import { useLingui } from '@lingui/react/macro';
import { useLayoutEffect, useRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type MouseEventHandler, type ReactNode } from 'react';
import { ArrowUpRightIcon, CaretLeftIcon } from './icons.tsx';
import { UiLink } from './link-context.tsx';

export type ButtonVariant = 'primary' | 'secondary' | 'back' | 'quiet' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonBaseProps {
  /** 預設 secondary */
  variant?: ButtonVariant;
  /** 預設 md；舊寫法 className="ll-btn--small" 等於 sm（相容到逐頁替換完成） */
  size?: ButtonSize;
  /** 前置圖示 */
  icon?: ReactNode;
  /** 後置圖示（箭頭） */
  iconEnd?: ReactNode;
  /** 撐滿容器 */
  block?: boolean;
  /** action：最小寬 96px，列表右側的動作鈕右緣對齊 */
  minWidth?: 'none' | 'action';
  /** 載入中：前置圖示換成轉圈（沒有前置圖示時蓋在文字上，寬度不變；quiet 沒有前置圖示時轉圈放在文字前面），aria-busy */
  busy?: boolean;
  className?: string;
  children?: ReactNode;
}

type AnchorAttrs = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className' | 'children' | 'onClick' | 'type'>;
type NativeButtonAttrs = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children' | 'type'>;

export type ButtonLinkProps = ButtonBaseProps &
  AnchorAttrs & {
    href: string;
    /** 站外網址：不加 target，自動附外部圖示與視覺隱藏的「（外部網站）」 */
    external?: boolean;
    /** 連結形式停用時渲染成不可聚焦的 span（旁邊必須有文字說明原因） */
    disabled?: boolean;
    /** onClick 裡 preventDefault() 時不導航 */
    onClick?: MouseEventHandler<HTMLAnchorElement>;
    pressed?: never;
    type?: never;
  };

export type ButtonButtonProps = ButtonBaseProps &
  NativeButtonAttrs & {
    href?: undefined;
    external?: never;
    type?: 'button' | 'submit' | 'reset';
    /** 切換按鈕（收藏、計時暫停、正負號、N/A）：輸出 aria-pressed */
    pressed?: boolean;
  };

export type ButtonProps = ButtonLinkProps | ButtonButtonProps;

/** 組出按鈕的 class（給 IconButton、BackButton 與少數需要同樣外觀的 web-ui 元件共用；頁面不要直接用） */
export function buttonClass({
  variant = 'secondary',
  size = 'md',
  block,
  minWidth,
  extra,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  minWidth?: 'none' | 'action';
  extra?: string;
}): string {
  return ['ll-btn', `ll-btn--${variant}`, `ll-btn--${size}`, block && 'll-btn--block', minWidth === 'action' && 'll-btn--action', extra]
    .filter(Boolean)
    .join(' ');
}

/** 舊寫法相容：className 裡的 ll-btn--small 換成 size="sm"，其他 class 照留（只給版面用） */
function splitLegacy(className: string | undefined, size: ButtonSize | undefined): { size: ButtonSize; rest: string | undefined } {
  if (!className) return { size: size ?? 'md', rest: undefined };
  const parts = className.split(/\s+/).filter(Boolean);
  const legacySmall = parts.includes('ll-btn--small');
  const rest = parts.filter((p) => p !== 'll-btn--small').join(' ');
  return { size: size ?? (legacySmall ? 'sm' : 'md'), rest: rest || undefined };
}

function ExternalHint() {
  const { t } = useLingui();
  return (
    <>
      <ArrowUpRightIcon className="ll-btn__ext" />
      <span className="ll-sr-only">{t({ id: 'ui.externalSite', message: '（外部網站）', comment: '連到站外網址的按鈕或連結後面，給螢幕閱讀器的說明' })}</span>
    </>
  );
}

function Spinner({ over }: { over?: boolean }) {
  return (
    <span className={`ll-btn__busy${over ? ' ll-btn__busy--over' : ''}`} aria-hidden="true">
      <span className="ll-btn__spinner" />
      <span className="ll-btn__dots">…</span>
    </span>
  );
}

/**
 * 有前置圖示的標籤換行時（文字放大 200%、窄欄），標籤盒子撐滿剩下的寬度、字靠圖示那一側（01-core-base.css），
 * 空白全在另一側，圖示加文字整組偏一邊（M3 驗收第 8 輪：「在地圖上看／這一章」左邊 24px、右邊 74px）。
 * 量最長一行的右緣（Range.getClientRects），圖示和標籤一起往中間移空白的一半。用 transform 移，不改版面：
 * 量的時候不必先還原，也不會再觸發一次 ResizeObserver；標籤盒子的大小變了（欄寬、字級、文字、字型載入）才重量。
 * 一行時盒子本來就貼著字，不移
 */
function useCentredLabel(on: boolean) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const label = ref.current;
    const icon = label?.previousElementSibling as HTMLElement | null | undefined;
    if (!on || !label || !icon || typeof ResizeObserver !== 'function') return;
    let live = true;
    const fit = () => {
      if (!live) return;
      const box = label.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(label);
      let right = box.left;
      for (const r of range.getClientRects()) right = Math.max(right, r.right);
      // 祖先在縮放（面板進場）時，量到的是縮放後的 px：換回元件自己的 px
      const shift = box.width ? Math.round((((box.right - right) / 2) * label.offsetWidth) / box.width) : 0;
      icon.style.transform = label.style.transform = shift > 0 ? `translateX(${shift}px)` : '';
    };
    const ro = new ResizeObserver(fit);
    ro.observe(label);
    // 字型載入完成再量一次：loadingdone 事件而不是 document.fonts.ready（後者的 getter 會強制同步排版，見 Segmented.tsx）
    const fonts = document.fonts;
    fonts?.addEventListener('loadingdone', fit);
    return () => {
      live = false;
      ro.disconnect();
      fonts?.removeEventListener('loadingdone', fit);
      icon.style.transform = label.style.transform = '';
    };
  }, [on]);
  return ref;
}

export function Button(props: ButtonProps) {
  const { variant = 'secondary', size: sizeProp, icon, iconEnd, block, minWidth, busy, className, children } = props;
  const { size, rest: layoutClass } = splitLegacy(className, sizeProp);
  const lead = icon ?? (variant === 'back' ? <CaretLeftIcon /> : null);
  // quiet 是平的：把字藏起來只剩一個轉圈，看不出那裡有按鈕（M3 驗收第 2 輪），所以轉圈放在文字前面、字留著
  const busyLead = Boolean(busy && (lead || variant === 'quiet'));
  const busyOver = Boolean(busy && !busyLead);
  const cls = buttonClass({ variant, size, block, minWidth, extra: [busyOver && 'is-busy-over', layoutClass].filter(Boolean).join(' ') || undefined });
  const hasLabel = children !== undefined && children !== null && children !== false;
  const labelRef = useCentredLabel(Boolean(lead && !busyLead && hasLabel));
  const content = (
    <>
      {busyLead ? <Spinner /> : lead ? <span className="ll-btn__icon">{lead}</span> : null}
      {hasLabel && (
        <span ref={labelRef} className="ll-btn__label">
          {children}
        </span>
      )}
      {props.href !== undefined && props.external && <ExternalHint />}
      {iconEnd && <span className="ll-btn__icon ll-btn__icon--end">{iconEnd}</span>}
      {busyOver && <Spinner over />}
    </>
  );

  if (props.href !== undefined) {
    const {
      variant: _v,
      size: _s,
      icon: _i,
      iconEnd: _ie,
      block: _b,
      minWidth: _m,
      busy: _bu,
      className: _c,
      children: _ch,
      href,
      external,
      disabled,
      onClick,
      ...anchor
    } = props;
    if (disabled) {
      // 停用的連結形式（站規 1.2.1）：不可聚焦的 span，不設 role（站規 4.1 R5），旁邊必須有文字說明原因
      const { 'data-testid': testId, 'data-board': board } = anchor as { 'data-testid'?: string; 'data-board'?: string };
      return (
        <span className={`${cls} is-disabled`} aria-disabled="true" data-testid={testId} data-board={board}>
          {content}
        </span>
      );
    }
    return (
      <UiLink {...anchor} href={href} external={external} className={cls} onClick={onClick} aria-busy={busy || undefined}>
        {content}
      </UiLink>
    );
  }

  const {
    variant: _v,
    size: _s,
    icon: _i,
    iconEnd: _ie,
    block: _b,
    minWidth: _m,
    busy: _bu,
    className: _c,
    children: _ch,
    href: _h,
    external: _e,
    type = 'button',
    pressed,
    ...native
  } = props;
  return (
    <button {...native} type={type} className={cls} aria-pressed={pressed ?? native['aria-pressed']} aria-busy={busy || native['aria-busy'] || undefined}>
      {content}
    </button>
  );
}
