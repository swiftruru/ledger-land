// 分段控制（語言、外觀、深色風味、玻璃效果）：一組單選按鈕（role="radiogroup"），觸控目標至少 44px（07 第 8.4 節、05 第 8.1 節）。
// 方向鍵在群組內移動並選取，焦點跟著新選的項目（07 第 8.1 節；roving tabindex）；Home、End 到第一個與最後一個。
// 放不下一列時（例如英文的玻璃效果在 320px）改成等寬的格子：四個選項排 2×2，兩欄也放不下就每列一個，不讓整頁變寬（WCAG 1.4.10）。
// 量法：每個選項文字的自然寬度（Range）加左右內距，和外層可用寬度比；外層尺寸或字型改變時重量（ResizeObserver）。
// 量到之前（第一次繪製、沒有 JS）用 flex-wrap 換列當保底，也不會溢出。
// 量的時候先拿掉格子排法：外層寬度由內容決定時（頁首的動作區），排成格子後外層跟著變窄，再量一次又會判定放不下，永遠停在直排。
// 寬度一律用小數（getBoundingClientRect）比，不無條件進位：clientWidth 會四捨五入成整數，進位後兩個 44px 的選項就可能差 1px 被判定放不下。
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** 選項自己的語言（語言切換開關的每個選項用自己的語言寫，05 第 8.1 節） */
  lang?: string;
  ariaLabel?: string;
}

export interface SegmentedProps<T extends string> {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  /** 群組的可讀名稱；或改用 labelledBy 指向外部標籤 */
  label?: string;
  labelledBy?: string;
  /** sm：頁首用的精簡版（仍是 44px 高） */
  size?: 'sm' | 'md';
  className?: string;
}

/** 一列放不下時的欄數：0 表示一列放得下 */
function stackColumns(group: HTMLElement, buttons: HTMLButtonElement[]): number {
  const parent = group.parentElement;
  if (!parent || buttons.length === 0) return 0;
  const ps = getComputedStyle(parent);
  const avail =
    parent.getBoundingClientRect().width -
    parseFloat(ps.paddingLeft) -
    parseFloat(ps.paddingRight) -
    parseFloat(ps.borderLeftWidth) -
    parseFloat(ps.borderRightWidth);
  if (!(avail > 0)) return 0;
  const gs = getComputedStyle(group);
  const gap = parseFloat(gs.columnGap) || 0;
  const frame = parseFloat(gs.paddingLeft) + parseFloat(gs.paddingRight) + parseFloat(gs.borderLeftWidth) + parseFloat(gs.borderRightWidth);
  const widths = buttons.map((b) => {
    const bs = getComputedStyle(b);
    const range = document.createRange();
    range.selectNodeContents(b);
    const text = range.getBoundingClientRect().width;
    return Math.max(parseFloat(bs.minWidth) || 0, text + parseFloat(bs.paddingLeft) + parseFloat(bs.paddingRight));
  });
  const one = widths.reduce((a, w) => a + w, 0) + gap * (widths.length - 1) + frame;
  if (one <= avail + 1) return 0;
  const widest = Math.max(...widths);
  if (buttons.length % 2 === 0 && buttons.length >= 4 && widest * 2 + gap + frame <= avail + 1) return 2;
  return 1;
}

export function Segmented<T extends string>({ value, options, onChange, label, labelledBy, size = 'md', className }: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const group = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(0);
  const n = options.length;
  useLayoutEffect(() => {
    const el = group.current;
    if (!el) return;
    const measure = () => {
      // 先用一列的排法量（見檔頭），量完立刻還原，React 管的 class 不會留下改動
      const stacked = el.classList.contains('ll-seg--stack');
      if (stacked) el.classList.remove('ll-seg--stack');
      const next = stackColumns(
        el,
        refs.current.slice(0, n).filter((b): b is HTMLButtonElement => b !== null),
      );
      if (stacked) el.classList.add('ll-seg--stack');
      setCols(next);
    };
    measure();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (el.parentElement) ro?.observe(el.parentElement);
    void document.fonts?.ready.then(measure);
    return () => ro?.disconnect();
  });
  return (
    <div
      ref={group}
      className={`ll-seg ll-seg--keys${size === 'sm' ? ' ll-seg--sm' : ''}${cols ? ' ll-seg--stack' : ''}${className ? ` ${className}` : ''}`}
      style={cols ? ({ '--ll-seg-cols': cols } as CSSProperties) : undefined}
      role="radiogroup"
      aria-label={label}
      aria-labelledby={labelledBy}
    >
      {options.map((o, idx) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[idx] = el;
          }}
          type="button"
          role="radio"
          className="ll-seg__opt"
          aria-checked={o.value === value}
          lang={o.lang}
          aria-label={o.ariaLabel}
          tabIndex={o.value === value ? 0 : -1}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            const i = options.findIndex((x) => x.value === value);
            const from = i < 0 ? idx : i;
            let next: number | null = null;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (from + 1) % n;
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (from - 1 + n) % n;
            else if (e.key === 'Home') next = 0;
            else if (e.key === 'End') next = n - 1;
            if (next === null) return;
            e.preventDefault();
            // 先移焦點再選取：tabIndex=-1 的按鈕也能用程式聚焦，重新繪製後它的 tabIndex 會變成 0
            refs.current[next]?.focus();
            if (options[next]!.value !== value) onChange(options[next]!.value);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
