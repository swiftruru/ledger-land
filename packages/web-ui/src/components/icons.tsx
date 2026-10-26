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
/** 收藏（題目）：愛心；filled 是已收藏的實心版。星星只代表關卡成績（第 2 輪看圖驗收） */
export const HeartIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Svg {...p}>
    <path d="M12 20.2S3.2 15.3 3.2 9.4A4.6 4.6 0 0 1 12 7.3a4.6 4.6 0 0 1 8.8 2.1c0 5.9-8.8 10.8-8.8 10.8Z" fill={filled ? 'currentColor' : 'none'} />
  </Svg>
);
/** 名詞卡 chip 前的書籤；filled 是切換按鈕已按下時的實心版 */
export const BookmarkIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Svg {...p}>
    <path d="M6 4h12v17l-6-4-6 4V4Z" fill={filled ? 'currentColor' : 'none'} />
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

// ---- 站規 1.18 新增的原創圖示：24 格、2px 線、圓頭、currentColor、aria-hidden ----
/** 前往（選單列與章名連結結尾的箭頭） */
export const CaretRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 5 7 7-7 7" />
  </Svg>
);
/** 展開列的箭頭 */
export const CaretDownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 9 7 7 7-7" />
  </Svg>
);
/** 前往下一處（按鈕的後置圖示） */
export const ArrowRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 12h15M13 5.5l6.5 6.5-6.5 6.5" />
  </Svg>
);
/** 外部網站 */
export const ArrowUpRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 17 17 7M8.5 7H17v8.5" />
  </Svg>
);
/** 開始（實心三角） */
export const PlayIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 5.6v12.8a1 1 0 0 0 1.5.9l10-6.4a1 1 0 0 0 0-1.7l-10-6.4A1 1 0 0 0 8 5.6Z" fill="currentColor" />
  </Svg>
);
/** 再挑戰、再試一次 */
export const RetryIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v5h-5" />
  </Svg>
);
/** 說明、介紹 */
export const InfoIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5" />
    <circle cx="12" cy="7.75" r="1.1" fill="currentColor" stroke="none" />
  </Svg>
);
/** 還沒開放 */
export const LockIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </Svg>
);
/** 完成、已複製 */
export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);
/** 搜尋 */
export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 4.5 4.5" />
  </Svg>
);
/** 移除 */
export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l.9 12.1a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7M10.5 11v5.5M13.5 11v5.5" />
  </Svg>
);
/** 新增 */
export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
/** 設定：齒輪（圓心加八根短齒） */
export const GearIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2.25" />
    <path d="M12 2.5V6M12 18v3.5M2.5 12H6M18 12h3.5M5.3 5.3l2.5 2.5M16.2 16.2l2.5 2.5M5.3 18.7l2.5-2.5M16.2 7.8l2.5-2.5" />
  </Svg>
);
/** 匯出、備份 */
export const ExportIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 14.5V3.5M7.5 8 12 3.5 16.5 8M5 12.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5.5" />
  </Svg>
);
/** 檔案 */
export const FileIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
    <path d="M14 3v5h5" />
  </Svg>
);
/** 這台裝置、安裝 */
export const DeviceIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
    <path d="M10.5 18.5h3" />
  </Svg>
);
/** 隱私 */
export const ShieldIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 5 5.8v5.7c0 4.2 2.9 7.7 7 9.5 4.1-1.8 7-5.3 7-9.5V5.8L12 3Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Svg>
);
/** 系統設計 */
export const CompassIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
  </Svg>
);
/** 實驗室 */
export const FlaskIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 3h6M10 3v6.2L5.2 17.6A2.3 2.3 0 0 0 7.2 21h9.6a2.3 2.3 0 0 0 2-3.4L14 9.2V3M7.4 15h9.2" />
  </Svg>
);
/** 名詞圖鑑：兩張疊起來的卡 */
export const CardsIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="7" width="12" height="14" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2" />
  </Svg>
);
/** 首頁 */
export const HouseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 11 12 4l8.5 7M6 9v10a1 1 0 0 0 1 1h3.5v-5h3v5H17a1 1 0 0 0 1-1V9" />
  </Svg>
);
/** 參考名詞、看書 */
export const BookIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 6.5C10.4 5 8 4.5 3.5 4.5v13c4.5 0 6.9.5 8.5 2 1.6-1.5 4-2 8.5-2v-13c-4.5 0-6.9.5-8.5 2ZM12 6.5v13" />
  </Svg>
);
/** 原始碼（不用任何品牌圖形） */
export const CodeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m8.5 7-5 5 5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15" />
  </Svg>
);
/** 語言 */
export const TranslateIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 5.5h9M8 3.5v2M10.5 5.5c-.8 3.6-3 6.4-6.5 8M5.8 9c1.2 2 2.9 3.4 4.7 4.3M12.5 20.5l4-9 4 9M13.9 17.5h5.2" />
  </Svg>
);
/** 計時 */
export const TimerIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="13.5" r="7.5" />
    <path d="M12 13.5V9.5M10 2.5h4M18.3 6.7l1.4-1.4" />
  </Svg>
);
/** 暫停 */
export const PauseIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6.5" y="5" width="3.5" height="14" rx="1" />
    <rect x="14" y="5" width="3.5" height="14" rx="1" />
  </Svg>
);
/** 更多（三個點） */
export const MoreIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
  </Svg>
);
/** 診斷資訊：心電圖折線（齒輪只給設定，第 2 輪驗收；pages-b 加） */
export const PulseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 12.5h4l2.2-5.5 4.3 11 2.4-6.5 1.6 1h4.5" />
  </Svg>
);
/** 顏色、主題：調色盤（關於系統設計的「顏色」一節；pages-b 加） */
export const PaletteIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.1 0 1.8-.7 1.8-1.6 0-.5-.2-.9-.5-1.2-.3-.4-.5-.8-.5-1.2 0-.9.8-1.7 1.7-1.7H16a4.5 4.5 0 0 0 4.5-4.5c0-3.8-3.8-6.8-8.5-6.8Z" />
    <circle cx="7.6" cy="11.2" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="10.4" cy="7.4" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="7.9" r="1.2" fill="currentColor" stroke="none" />
  </Svg>
);

// ---- 名詞類別與會計要素（站規 1.11.5）：名詞卡的徽記；原創造型，和 07 第 12 節同語意 ----
/** 類別：報表（表格） */
export const StatementIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <path d="M3.5 9h17M3.5 14.25h17M9.5 9v10.5" />
  </Svg>
);
/** 類別：科目（帳本標籤） */
export const AccountIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 5.5v5.2a2 2 0 0 0 .6 1.4l7.8 7.8a2 2 0 0 0 2.8 0l5.2-5.2a2 2 0 0 0 0-2.8l-7.8-7.8a2 2 0 0 0-1.4-.6H5.5a2 2 0 0 0-2 2Z" />
    <circle cx="8.25" cy="8.25" r="1.5" />
  </Svg>
);
/** 類別：指標（百分比） */
export const RatioIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M18.5 5.5 5.5 18.5" />
    <circle cx="7.25" cy="7.25" r="2.5" />
    <circle cx="16.75" cy="16.75" r="2.5" />
  </Svg>
);
/** 類別：觀念（沿用燈泡） */
export const ConceptIcon = (p: IconProps) => <LightbulbIcon {...p} />;
/** 類別：流程（循環箭頭） */
export const ProcessIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19.2 9.5A7.75 7.75 0 0 0 5.6 7.2M4.8 14.5a7.75 7.75 0 0 0 13.6 2.3" />
    <path d="M5 3.5v4h4M19 20.5v-4h-4" />
  </Svg>
);
/** 類別：其他（三個點） */
export const OtherIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="6" cy="12" r="1.75" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.75" fill="currentColor" stroke="none" />
    <circle cx="18" cy="12" r="1.75" fill="currentColor" stroke="none" />
  </Svg>
);
/** 要素：資產（錢包） */
export const WalletIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.5 7.5V6.5a2 2 0 0 1 2-2H16v3" />
    <rect x="3.5" y="7.5" width="17" height="12" rx="2.5" />
    <path d="M20.5 11.5h-3.75a1.75 1.75 0 0 0 0 3.5h3.75" />
  </Svg>
);
/** 要素：負債（借據：有簽名的單據） */
export const IouIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M8.5 7.5h7M8.5 11h5M8.5 16.5c.9-1.4 1.7-1.4 2.2 0 .5 1.4 1.3 1.4 2.1 0 .6-1 1.4-1 2.7 0" />
  </Svg>
);
/** 要素：權益（握手） */
export const HandshakeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 10.5 6 7l3 1" />
    <path d="M21.5 10.5 18 7l-4.5 1.2-3.9 3.6a1.4 1.4 0 0 0 1.9 2.1l2.3-2 4.7 4.6" />
    <path d="M5.5 12.5l4 4a1.4 1.4 0 0 0 2 0M10.5 17.5l.4.4a1.4 1.4 0 0 0 2 0l3.1-3.1" />
  </Svg>
);
/** 要素：收入（一疊錢幣） */
export const CoinsIcon = (p: IconProps) => (
  <Svg {...p}>
    <ellipse cx="12" cy="6.5" rx="7" ry="3" />
    <path d="M5 6.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
    <path d="M5 11.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
  </Svg>
);
/** 要素：費用（收據，下緣鋸齒） */
export const ReceiptIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21V3Z" />
    <path d="M9 8h6M9 11.5h6M9 15h3.5" />
  </Svg>
);
