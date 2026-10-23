// 頂部提示的純規則（02 第 6 節的表、06 第 2.5 節）：哪幾條可以同時出現、安裝提示在什麼條件下出現。
// 沒有 DOM、沒有 React，讓 Banners.tsx 與 InstallPrompt.tsx 的判斷可以用單元測試驗證；真正的環境偵測在 lib/env.ts。
import type { StorageEnvironment } from '@ledgerland/progress';

/** 依優先順序排列的提示種類（02 第 6 節）：錯誤類最優先，其次 Safari 分頁的常駐提示，再來是內建瀏覽器、備份提醒、安裝建議 */
export const BANNER_PRIORITY = ['storage', 'safari-tab', 'in-app', 'backup', 'install'] as const;
export type BannerKind = (typeof BANNER_PRIORITY)[number];

/** 一次最多同時顯示的條數（語言切換提示與更新提示另計，不在這裡） */
export const BANNER_SLOTS = 2;

/** 從符合條件的提示裡依優先順序挑出要顯示的幾條 */
export function pickBannerSlots(eligible: ReadonlySet<BannerKind> | readonly BannerKind[], slots: number = BANNER_SLOTS): BannerKind[] {
  const set = eligible instanceof Set ? eligible : new Set(eligible);
  return BANNER_PRIORITY.filter((k) => set.has(k)).slice(0, Math.max(0, slots));
}

/** 安裝建議可以出現的頁面（02 第 6 節）：首頁與章節頁；關卡結果頁留到之後（結果狀態在作答頁內，路由看不出來） */
export function isInstallRoute(pathWithoutLocale: string): boolean {
  return pathWithoutLocale === '/' || pathWithoutLocale.startsWith('/chapter/');
}

export interface InstallPromptInput {
  readonly environment: StorageEnvironment;
  /** 這次是不是第一次造訪（02 第 6 節：第一次造訪不出現） */
  readonly firstVisit: boolean;
  /** 路由 handle 的 blocksUpdatePrompt（作答中、匯入流程） */
  readonly blockedRoute: boolean;
  readonly onInstallRoute: boolean;
  readonly levelsCompleted: number;
  readonly dismissed: boolean;
  /** Chromium 已送出 beforeinstallprompt */
  readonly installEventAvailable: boolean;
}

/** 安裝提示的做法：Chromium 的按鈕、iOS 的簡易說明，或不顯示（06 第 2.5 節的 InstallStrategy 簡化版） */
export type InstallStrategy = 'bip' | 'ios-guide' | 'none';

export function installPromptStrategy(input: InstallPromptInput): InstallStrategy {
  if (input.environment === 'app' || input.environment === 'in-app-browser') return 'none';
  if (input.firstVisit || input.blockedRoute || !input.onInstallRoute) return 'none';
  if (input.levelsCompleted < 1 || input.dismissed) return 'none';
  if (input.installEventAvailable) return 'bip';
  if (input.environment === 'safari-tab') return 'ios-guide';
  return 'none';
}
