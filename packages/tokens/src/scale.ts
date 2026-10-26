// 字級、間距、圓角、陰影以外的尺寸、層級、動態、斷點（07 第 3、4 節；02 第 3.1 節）。數值以 px 標示，字級輸出時換成 rem。

export const BASE_FONT_PX = 16;
const rem = (px: number) => `${Number((px / BASE_FONT_PX).toFixed(4))}rem`;

export const fontFamily = {
  /**
   * 中文：Latin 系統字在前、中文字型在後（M3 驗收第 4 輪）。PingFang TC 的 ASCII 連字號寬 0.6em（比數字還寬），
   * 「1-3」「E1-1」看起來像破折號；系統字的連字號約 0.43em，和英文版、.ll-num 的代號同一個字面。
   * 中文字與全形標點（（）「」，。－）系統字沒有，逐字退到 PingFang TC 等中文字型，字面不變（CDP getPlatformFontsForNode 核對過）
   */
  zh: 'system-ui, -apple-system, "Segoe UI", Roboto, "PingFang TC", "Noto Sans TC", "Noto Sans CJK TC", "Microsoft JhengHei", sans-serif',
  en: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif',
  num: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  /** 等寬：備份碼、診斷資訊、設計頁的色碼。Chromium 不認得 ui-monospace，要列出各平台的等寬字，不然會落到 Courier 襯線字 */
  mono: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Roboto Mono", "Liberation Mono", monospace',
} as const;

/** 字級：size 與 lineHeight 為 px，weight 為字重（07 第 3.3 節） */
export const type = {
  caption: { size: 12, lineHeight: 16, weight: 600 },
  footnote: { size: 13, lineHeight: 18, weight: 400 },
  'body-sm': { size: 15, lineHeight: 24, weight: 400 },
  body: { size: 17, lineHeight: 28, weight: 400 },
  input: { size: 17, lineHeight: 24, weight: 400 },
  callout: { size: 16, lineHeight: 24, weight: 600 },
  'title-3': { size: 20, lineHeight: 28, weight: 600 },
  'title-2': { size: 22, lineHeight: 30, weight: 700 },
  'title-1': { size: 28, lineHeight: 36, weight: 700 },
  'number-lg': { size: 28, lineHeight: 34, weight: 700 },
} as const;
export const typeDisplay = { size: `clamp(${rem(28)}, 6vw, ${rem(40)})`, lineHeight: '1.2', weight: 700 } as const;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;
export const TARGET_MIN_PX = 44;

/** 可點元件的尺寸（站規 1.1.3，和 --ll-target-min 同一區）：按鈕面高（不含底邊）、唯一的立體厚度、選單列高、進度條兩種、寬版內容最大寬 */
export const control = {
  'btn-h-sm': 44,
  'btn-h-md': 48,
  'btn-h-lg': 56,
  'btn-depth': 4,
  'navrow-h': 56,
  'progress-h-sm': 6,
  'progress-h-md': 10,
  'layout-wide': 1040,
} as const;

export const radius = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, full: 999 } as const;

export const z = { sticky: 10, tabbar: 50, sheet: 60, toast: 70, skiplink: 100 } as const;

/** Tab bar 的尺寸（07 第 6.1 節；鏡片的放大倍數與膠囊寬度比例在 apps/web 的 tabbar.css） */
export const tabbar = { heightPx: 64, maxWidthPx: 480, sideInsetPx: 21, railWidthPx: 88 } as const;

/** 動態（07 第 4.5 節；鏡片的史萊姆回彈見 07 第 6.2 節）。reduced 是減少動態效果時的值 */
export const motion = {
  duration: {
    fast: { normal: '120ms', reduced: '0ms' },
    base: { normal: '200ms', reduced: '120ms' },
    slow: { normal: '320ms', reduced: '0ms' },
    lab: { normal: '450ms', reduced: '0ms' },
    lift: { normal: '620ms', reduced: '0ms' },
  },
  liftLag: { normal: '70ms', reduced: '0ms' },
  ease: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    enter: 'cubic-bezier(0, 0, 0.2, 1)',
    exit: 'cubic-bezier(0.4, 0, 1, 1)',
  },
  /** 彈簧曲線：linear() 由阻尼彈簧公式取樣；不支援時退回 cubic-bezier */
  spring: {
    snappy: {
      fallback: 'cubic-bezier(0.3, 1.35, 0.5, 1)',
      linear: 'linear(0, 0.125, 0.373, 0.619, 0.81, 0.935, 1.004, 1.033, 1.038, 1.032, 1.022, 1.013, 1.006, 1.002, 1, 0.999, 1)',
    },
    gentle: {
      fallback: 'cubic-bezier(0.22, 1.2, 0.36, 1)',
      linear: 'linear(0, 0.103, 0.309, 0.521, 0.697, 0.826, 0.912, 0.964, 0.993, 1.006, 1.011, 1.011, 1.009, 1.006, 1.004, 1.003, 1)',
    },
    lift: {
      fallback: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      linear:
        'linear(0, 0.042 2.1%, 0.152 4.2%, 0.307 6.2%, 0.486 8.3%, 0.670 10.4%, 0.843 12.5%, 0.993 14.6%, 1.113 16.7%, 1.199 18.8%, 1.252 20.8%, 1.274 22.9%, 1.269 25.0%, 1.244 27.1%, 1.204 29.2%, 1.156 31.2%, 1.106 33.3%, 1.057 35.4%, 1.013 37.5%, 0.978 39.6%, 0.951 41.7%, 0.934 43.8%, 0.926 45.8%, 0.925 47.9%, 0.930 50.0%, 0.940 52.1%, 0.953 54.2%, 0.967 56.2%, 0.980 58.3%, 0.993 60.4%, 1.003 62.5%, 1.011 64.6%, 1.017 66.7%, 1.020 68.8%, 1.021 70.8%, 1.020 72.9%, 1.017 75.0%, 1.014 77.1%, 1.010 79.2%, 1.006 81.2%, 1.003 83.3%, 1.000 85.4%, 0.997 87.5%, 0.996 89.6%, 0.995 91.7%, 0.995 93.8%, 0.997 95.8%, 0.999 97.9%, 1)',
    },
  },
} as const;

/** 斷點（02 第 3.1 節）：媒體查詢裡不能用 var()，CSS 與 TS 共用這一份 */
export const breakpoints = { medium: 600, expanded: 1024, wide: 1440 } as const;

export { rem };
