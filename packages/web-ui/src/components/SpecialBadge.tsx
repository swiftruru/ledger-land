// 特別徽章（03 第 2.10 節）：不屬於任何章的探索獎勵（例如「幕後」找齊彩蛋），一枚圓形獎章加下方一條橫幅緞帶，兩種外觀。
// 未取得是灰階外框（和 ChapterBadge 的 locked 同一組變數）；已取得是星星金幣面、一顆強調色的星。只是圖，可讀名稱由旁邊的文字提供（aria-hidden）。
// 重用 ChapterBadge 的 class（ll-chbadge、ll-chbadge__face 等）與 10-map-badges.css 的變數，只多一條 special 的配色；也可當 Toast 的 media。
import { starPath } from './ChapterBadge.tsx';

export type SpecialBadgeState = 'locked' | 'done';

export interface SpecialBadgeProps {
  state: SpecialBadgeState;
  size?: number;
  className?: string;
}

export function SpecialBadge({ state, size = 36, className }: SpecialBadgeProps) {
  return (
    <svg
      className={`ll-chbadge ll-chbadge--special ll-chbadge--${state}${className ? ` ${className}` : ''}`}
      width={size}
      height={(size * 56) / 48}
      viewBox="0 0 48 56"
      aria-hidden="true"
      focusable="false"
      data-state={state}
    >
      {/* 橫幅緞帶：兩端燕尾，上緣藏在幣面後面 */}
      <path className="ll-chbadge__ribbon" d="M6 40 H42 L38.5 46 L42 52 H6 L9.5 46 Z" />
      {/* 幣面與內環 */}
      <circle className="ll-chbadge__face" cx="24" cy="21" r="19" />
      <circle className="ll-chbadge__ring" cx="24" cy="21" r="14" />
      <path className="ll-chbadge__star" d={starPath(24, 21, 9)} />
    </svg>
  );
}
