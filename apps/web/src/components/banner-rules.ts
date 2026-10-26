// 頂部提示的純規則（02 第 6 節的表、06 第 2.5 節、第 1 輪驗收）：哪一條展開、收合的膠囊什麼時候出現、安裝提示在什麼條件下出現。
// 沒有 DOM、沒有 React，讓 Banners.tsx 與 InstallPrompt.tsx 的判斷可以用單元測試驗證；真正的環境偵測在 lib/env.ts。
import type { StorageEnvironment } from '@ledgerland/progress';

/**
 * 依優先順序排列的提示種類（第 1 輪驗收的定案）：儲存層的錯誤（五種）最優先，接著是更新提示、相機預覽提示、安裝建議、
 * Safari 分頁的常駐提示、內建瀏覽器提醒、備份提醒、語言建議。安裝建議排在 Safari 分頁提示前面：iOS 的安裝建議已經包含
 * 「已經加入主畫面就從圖示開啟」那一句，兩條同時出現時只留安裝建議。
 */
export const BANNER_PRIORITY = ['storage', 'update', 'ephemeral', 'install', 'safari-tab', 'in-app', 'backup', 'locale'] as const;
export type BannerKind = (typeof BANNER_PRIORITY)[number];

/** 可以收合成一顆膠囊（secondary sm 加警示圖示）的種類：常駐提示不能永久關閉，只能收合 */
export const COLLAPSIBLE_BANNERS: readonly BannerKind[] = ['safari-tab', 'in-app'];

export interface BannerPick {
  /** 這一頁唯一展開的橫幅；沒有就是 null */
  expanded: BannerKind | null;
  /** 使用者收合過的常駐提示（膠囊），最多一顆；只在比它優先的橫幅都沒有出現時才顯示 */
  collapsed: BannerKind | null;
}

/**
 * 一次只展開一條（第 1 輪驗收 blocker：兩條展開的橫幅疊在頁首下、各帶一顆主按鈕）：依優先順序取第一條。
 * 收合過的 Safari 分頁或內建瀏覽器提示不佔展開的位置：它前面的橫幅都沒出現時顯示成膠囊，再接著展開它後面的第一條
 * （例如 Safari 分頁收合後，備份提醒照樣出現）；它前面已經有展開的橫幅時，膠囊也不顯示，畫面上只有一條。
 */
export function pickBanners(
  eligible: ReadonlySet<BannerKind> | readonly BannerKind[],
  collapsed: ReadonlySet<BannerKind> | readonly BannerKind[] = [],
): BannerPick {
  const has = eligible instanceof Set ? eligible : new Set(eligible);
  const folded = collapsed instanceof Set ? collapsed : new Set(collapsed);
  let pill: BannerKind | null = null;
  for (const kind of BANNER_PRIORITY) {
    if (!has.has(kind)) continue;
    if (COLLAPSIBLE_BANNERS.includes(kind) && folded.has(kind)) {
      pill ??= kind;
      continue;
    }
    return { expanded: kind, collapsed: pill };
  }
  return { expanded: null, collapsed: pill };
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
