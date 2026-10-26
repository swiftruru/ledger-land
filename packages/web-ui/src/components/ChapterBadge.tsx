// 章節徽章（03 第 2.10 節、17 第 3.5 節）：一枚原創的獎章圖，三種外觀。未取得是灰階外框；完成是強調色幣面加一顆星；
// 精通是同一枚徽章的進階外觀：星星黃幣面、三顆星、兩側月桂。只是圖，可讀名稱由章節牌或章末區的文字提供（aria-hidden）。
export type ChapterBadgeState = 'locked' | 'done' | 'mastery';

export interface ChapterBadgeProps {
  state: ChapterBadgeState;
  size?: number;
  className?: string;
}

/** 五角星的 path（中心 cx、cy，外半徑 r） */
export function starPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}

export function ChapterBadge({ state, size = 36, className }: ChapterBadgeProps) {
  return (
    <svg
      className={`ll-chbadge ll-chbadge--${state}${className ? ` ${className}` : ''}`}
      width={size}
      height={(size * 56) / 48}
      viewBox="0 0 48 56"
      aria-hidden="true"
      focusable="false"
      data-state={state}
    >
      {/* 緞帶 */}
      <path className="ll-chbadge__ribbon" d="M14 32 l-6 20 l9 -4 l5 7 l5 -21Z" />
      <path className="ll-chbadge__ribbon" d="M34 32 l6 20 l-9 -4 l-5 7 l-5 -21Z" />
      {/* 幣面與內環 */}
      <circle className="ll-chbadge__face" cx="24" cy="22" r="19" />
      <circle className="ll-chbadge__ring" cx="24" cy="22" r="14" />
      {state === 'mastery' ? (
        <>
          <path className="ll-chbadge__laurel" d="M9 28 q0 -16 13 -20" />
          <path className="ll-chbadge__laurel" d="M39 28 q0 -16 -13 -20" />
          <g className="ll-chbadge__leaf">
            <ellipse cx="10" cy="20" rx="1.6" ry="3" />
            <ellipse cx="13" cy="13" rx="1.6" ry="3" transform="rotate(-30 13 13)" />
            <ellipse cx="38" cy="20" rx="1.6" ry="3" />
            <ellipse cx="35" cy="13" rx="1.6" ry="3" transform="rotate(30 35 13)" />
          </g>
          <path className="ll-chbadge__star" d={starPath(24, 21, 7)} />
          <path className="ll-chbadge__star" d={starPath(15.5, 25, 3.6)} />
          <path className="ll-chbadge__star" d={starPath(32.5, 25, 3.6)} />
        </>
      ) : (
        <path className="ll-chbadge__star" d={starPath(24, 22, 8)} />
      )}
    </svg>
  );
}
