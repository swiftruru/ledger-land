// 元件用的小圖示：內嵌 SVG、currentColor、一律 aria-hidden（07 第 8.3 節：圖示旁一定有文字）。
// Phosphor 只在 apps/web 的殼層以 SVG 原始檔內嵌，web-ui 不另加依賴，這裡用同樣風格的原創線條畫。
import type { SVGProps } from 'react';

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number };

function Svg({ size = 20, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    />
  );
}

/** 單選未選：圓形 */
export const CircleIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
  </Svg>
);
/** 單選已選：圓形加實心點 */
export const RadioIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
  </Svg>
);
/** 複選未勾：方形 */
export const SquareIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
  </Svg>
);
/** 複選已勾：方形加勾 */
export const CheckSquareIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="m8 12 3 3 5-6" />
  </Svg>
);
/** 答對：圓形加勾（fill 為 true 時是實心版） */
export const CheckCircleIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" fill={filled ? 'currentColor' : 'none'} />
    <path d="m8 12 3 3 5-6" stroke={filled ? 'var(--ll-surface)' : 'currentColor'} />
  </Svg>
);
/** 答錯：圓形加叉 */
export const XCircleIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m9 9 6 6M15 9l-6 6" />
  </Svg>
);
/** 判分提示前的燈泡 */
export const LightbulbIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 18h6M10 21h4M8.5 14.5A6 6 0 1 1 15.5 14.5c-.8.7-1.5 1.5-1.5 2.5h-4c0-1-.7-1.8-1.5-2.5Z" />
  </Svg>
);
/** 取捨題的中性圖示：對話框 */
export const ChatIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5v-7Z" />
  </Svg>
);
/** 返回 */
export const CaretLeftIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m15 5-7 7 7 7" />
  </Svg>
);
/** 關閉 */
export const XIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
/** 星星 */
export const StarIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Svg {...p}>
    <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" fill={filled ? 'currentColor' : 'none'} />
  </Svg>
);
/** 名詞卡 chip 前的書籤 */
export const BookmarkIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 4h12v17l-6-4-6 4V4Z" />
  </Svg>
);
/** 空狀態的小托盤 */
export const TrayIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5h16v14H4V5Zm0 9h5a3 3 0 0 0 6 0h5" />
  </Svg>
);
/** 錯誤狀態的警示三角 */
export const WarningIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4 2.5 20h19L12 4Zm0 6v4m0 3h.01" />
  </Svg>
);
/** 已拿起的卡片 */
export const HandIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 13V6a1.5 1.5 0 0 1 3 0v6M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v7M17 13v-1a1.5 1.5 0 0 1 3 0v3a6 6 0 0 1-6 6h-2a6 6 0 0 1-5-2.7L4.6 15a1.5 1.5 0 0 1 2.5-1.6L8 15" />
  </Svg>
);
