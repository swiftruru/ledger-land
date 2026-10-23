// 執行環境偵測（06 第 4.5、4.7、4.8 節）：App 模式、App 內建瀏覽器、Gecko 的 Firefox、iOS 的 Safari 分頁。
// 判斷邏輯是純函式（detectEnvironment），讀 navigator 的包裝在下面；內建瀏覽器的 UA 清單集中在 IN_APP_BROWSER_UA，擴充時只改這裡。
import type { StorageEnvironment } from '@ledgerland/progress';
import { isAppMode } from './prefs.ts';

export { isAppMode };

/** 常見 App 內建瀏覽器的 UA 片段（06 第 4.8 節第 1 點）：LINE、Facebook、Messenger、Instagram */
export const IN_APP_BROWSER_UA: readonly string[] = ['Line/', 'FBAN', 'FBAV', 'Instagram'];

export interface EnvInput {
  readonly userAgent: string;
  readonly maxTouchPoints: number;
  readonly appMode: boolean;
}

export function isInAppBrowserUa(userAgent: string): boolean {
  return IN_APP_BROWSER_UA.some((s) => userAgent.includes(s));
}

/** 只認 Gecko 引擎的 Firefox（電腦與 Android）；iPhone 上的 Firefox 是 WebKit（UA 含 FxiOS），比照 Safari */
export function isGeckoFirefoxUa(userAgent: string): boolean {
  return /\bGecko\/\d/.test(userAgent) && /\bFirefox\/\d/.test(userAgent) && !/\bFxiOS\b/.test(userAgent);
}

/** iOS 與 iPadOS（iPad 的 Safari 預設送桌面版 UA，用觸控點數辨認） */
export function isIosUa(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

export function detectEnvironment(input: EnvInput): StorageEnvironment {
  if (isInAppBrowserUa(input.userAgent)) return 'in-app-browser';
  if (input.appMode) return 'app';
  if (isIosUa(input.userAgent, input.maxTouchPoints)) return 'safari-tab';
  return 'browser';
}

function currentInput(): EnvInput {
  return { userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints, appMode: isAppMode() };
}

export function isInAppBrowser(): boolean {
  return isInAppBrowserUa(navigator.userAgent);
}

export function isGeckoFirefox(): boolean {
  return isGeckoFirefoxUa(navigator.userAgent);
}

/** iOS 且不是 App 模式、也不是 App 內建瀏覽器：進度容易被清除的 Safari 分頁（06 第 4.7 節第 4 步的提示對象） */
export function isIosSafariTab(): boolean {
  return detectEnvironment(currentInput()) === 'safari-tab';
}

export function environmentKind(): StorageEnvironment {
  return detectEnvironment(currentInput());
}

/** 內建瀏覽器橫幅顯示的 App 名稱（06 第 4.8 節第 2 點）；Messenger 的 UA 也是 FBAN、FBAV，歸到 Facebook；認不出來時回 null，由畫面顯示「這個 App」 */
export type InAppBrowserName = 'LINE' | 'Facebook' | 'Instagram';

export function inAppBrowserNameOf(userAgent: string): InAppBrowserName | null {
  if (userAgent.includes('Line/')) return 'LINE';
  if (userAgent.includes('Instagram')) return 'Instagram';
  if (userAgent.includes('FBAN') || userAgent.includes('FBAV')) return 'Facebook';
  return null;
}

export function inAppBrowserName(): InAppBrowserName | null {
  return inAppBrowserNameOf(navigator.userAgent);
}
