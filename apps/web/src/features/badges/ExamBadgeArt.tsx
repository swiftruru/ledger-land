// 苦練徽章的圖（features/badges/exam.ts）：和特別徽章一樣是一枚圓形獎章加下方一條橫幅緞帶，沿用章節徽章的 class 與變數
// （web-ui 的 .ll-chbadge，10-map-badges.css），配色與幣面上的圖案跟著三步：讀題是一本打開的書、刷題是一個勾、模擬考是一面旗。
// 要走完的那一枚（tier 2）緞帶上多一顆小星。未取得是灰階外框。只是圖，可讀名稱由旁邊的文字提供（aria-hidden）。
// 不從 @ledgerland/web-ui/map 匯入：那會把整個地圖進入點帶進苦練的 chunk。
import type { ExamBadgeStep } from './exam.ts';
import '../../styles/exam-badges.css';

export interface ExamBadgeArtProps {
  step: ExamBadgeStep;
  tier: 1 | 2;
  state: 'locked' | 'done';
  size?: number;
  className?: string;
}

/** 五角星的路徑（中心與外半徑；內半徑是外半徑的 0.42） */
function star(cx: number, cy: number, r: number): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.42;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${points.join('L')}Z`;
}

const GLYPH: Record<ExamBadgeStep, string> = {
  // 打開的書：左右兩頁
  read: 'M23 15.2c-2.3-1.4-5-1.8-7.6-1.2v11.6c2.6-.6 5.3-.2 7.6 1.2Z M25 15.2c2.3-1.4 5-1.8 7.6-1.2v11.6c-2.6-.6-5.3-.2-7.6 1.2Z',
  // 勾
  practise: 'M15 21.4l3.1-3.1 3.9 3.9 7.9-8.4 3.1 2.9-10.9 11.6Z',
  // 旗：旗桿與旗面
  mock: 'M17.5 12.5h2.4v17h-2.4Z M21 13.6h10.5l-2.8 4.2 2.8 4.2H21Z',
};

const TIER_STAR = star(24, 46, 4.4);

export function ExamBadgeArt({ step, tier, state, size = 36, className }: ExamBadgeArtProps) {
  return (
    <svg
      className={`ll-chbadge ll-chbadge--exam-${step} ll-chbadge--${state}${className ? ` ${className}` : ''}`}
      width={size}
      height={(size * 56) / 48}
      viewBox="0 0 48 56"
      aria-hidden="true"
      focusable="false"
      data-state={state}
    >
      <path className="ll-chbadge__ribbon" d="M6 40 H42 L38.5 46 L42 52 H6 L9.5 46 Z" />
      {tier === 2 && <path className="ll-exam-badge__tier" d={TIER_STAR} />}
      <circle className="ll-chbadge__face" cx="24" cy="21" r="19" />
      <circle className="ll-chbadge__ring" cx="24" cy="21" r="14" />
      <path className="ll-chbadge__star" d={GLYPH[step]} />
    </svg>
  );
}
