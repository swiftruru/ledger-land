// 闖關地圖元件用的小圖示（17）：內嵌 SVG、currentColor、一律 aria-hidden，旁邊一定有文字或可讀名稱（07 第 8.3 節）
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

/** 輸入關卡代號：鍵盤 */
export const KeyboardIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" />
  </Svg>
);
/** 掃描課堂 QR */
export const QrIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" />
    <rect x="8" y="8" width="3" height="3" />
    <rect x="13" y="8" width="3" height="3" />
    <rect x="8" y="13" width="3" height="3" />
    <path d="M13 13h3v3" />
  </Svg>
);
/** 跳到目前關卡：準星 */
export const LocateIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="6" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </Svg>
);
/** 清單檢視 */
export const ListIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 6h12M8 12h12M8 18h12" />
    <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
    <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
  </Svg>
);
/** 地圖檢視 */
export const MapIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20Z" />
    <path d="M9 4v13.5M15 6.5V20" />
  </Svg>
);
/** 複製 */
export const CopyIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </Svg>
);
/** 下載（給老師的關卡 QR） */
export const DownloadIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4v11m0 0 4-4m-4 4-4-4" />
    <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
  </Svg>
);
/** 連結（複製這一關的網址） */
export const LinkIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5" />
  </Svg>
);
/** 徽章：獎章 */
export const MedalIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="9" r="5" />
    <path d="m8.5 13-2 7 5.5-3 5.5 3-2-7" />
  </Svg>
);
/** 錯題本：書籤 */
export const ReviewIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 4h12v17l-6-4-6 4Z" />
  </Svg>
);
/** 章末的旗幟 */
export const FlagIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 21V4M5 4h12l-2.5 4L17 12H5" />
  </Svg>
);
