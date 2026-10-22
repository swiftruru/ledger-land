// 分段控制（語言、外觀、深色風味）：一組單選按鈕（role="radiogroup"），觸控目標至少 44px（07 第 8.4 節、05 第 8.1 節）
import type { ReactNode } from 'react';

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
  className?: string;
}

export function Segmented<T extends string>({ value, options, onChange, label, labelledBy, className }: SegmentedProps<T>) {
  return (
    <div className={`ll-seg${className ? ` ${className}` : ''}`} role="radiogroup" aria-label={label} aria-labelledby={labelledBy}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          lang={o.lang}
          aria-label={o.ariaLabel}
          tabIndex={o.value === value ? 0 : -1}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            // 方向鍵在群組內移動並選取（07 第 8.1 節）
            const i = options.findIndex((x) => x.value === value);
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
              e.preventDefault();
              onChange(options[(i + 1) % options.length]!.value);
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
              e.preventDefault();
              onChange(options[(i - 1 + options.length) % options.length]!.value);
            }
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
