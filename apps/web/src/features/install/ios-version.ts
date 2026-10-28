// 安裝圖解要用哪一套（06 第 1 節、第 2.6 節、10 第 10 節第 7 項）：iOS 26 以上有 Compact 與 Top／Bottom 兩種分頁列，給使用者自己選；
// iOS 17、18 沒有 Compact，只用 Top／Bottom 那一套；Chromium 系用 beforeinstallprompt 的按鈕；其他瀏覽器給文字說明。純函式，真正的 navigator 讀取在呼叫端。
// Safari 26 起 UA 裡的系統版本凍結在 26 之前的最後一版（OS 18_6、18_6_2、18_7），真正的版本要看 Version/（Safari 的版本跟著 iOS 主版本走，沒有凍結）。
// 沒有 Version/ 的第三方瀏覽器（CriOS、FxiOS、EdgiOS）才退回看 OS；OS 18 可能是凍結值，不當作確定的舊版，交給使用者選版面。
import { isIosUa } from '../../lib/env.ts';

export type InstallGuideVariant = 'ios-modern' | 'ios-legacy' | 'chromium' | 'generic';
export type SafariLayout = 'compact' | 'bar';

export const INSTALL_GUIDE_LAYOUT_SETTING = 'installGuideLayout';
export const IOS_COMPACT_SINCE = 26;
/** UA 的系統版本從這一版開始凍結，讀到它不能當作真正的版本 */
const IOS_UA_FROZEN_AT = 18;

const SAFARI_VERSION = /\bVersion\/(\d+)/;
const IOS_OS_VERSION = /(?:iPhone|iPad|iPod)[^)]*?\bOS (\d+)_/;

/** UA 裡的 iOS 主版本：先看 Version/（Safari 與 iPad 的桌面版 UA），沒有才看 OS；認不出來回 null */
export function iosMajorVersion(userAgent: string, maxTouchPoints = 0): number | null {
  if (!isIosUa(userAgent, maxTouchPoints)) return null;
  const v = SAFARI_VERSION.exec(userAgent);
  if (v) return Number(v[1]);
  const os = IOS_OS_VERSION.exec(userAgent);
  return os ? Number(os[1]) : null;
}

export function isChromiumUa(userAgent: string): boolean {
  return /\b(?:Chrome|Chromium|CriOS|Edg|EdgA|SamsungBrowser)\//.test(userAgent) && !/\bFirefox\//.test(userAgent);
}

export function installGuideVariant(userAgent: string, maxTouchPoints = 0): InstallGuideVariant {
  if (isIosUa(userAgent, maxTouchPoints)) {
    const v = SAFARI_VERSION.exec(userAgent);
    if (v) return Number(v[1]) < IOS_COMPACT_SINCE ? 'ios-legacy' : 'ios-modern';
    // 沒有 Version/：只有確定比凍結值舊的才是舊版；18（可能是凍結值）與認不出來的都讓使用者自己選
    const os = IOS_OS_VERSION.exec(userAgent);
    return os && Number(os[1]) < IOS_UA_FROZEN_AT ? 'ios-legacy' : 'ios-modern';
  }
  return isChromiumUa(userAgent) ? 'chromium' : 'generic';
}

/** Safari 的選單長相（2026-10-28 維護者 iOS 27 實機截圖）：iOS 27 的縮小網址列左邊是三條線的選單按鈕，點開是帶圖示的彈出選單（翻譯網站、分享、加入書籤⋯），
 *  分享表單上方有 App 圖示與一排圓形動作、「加入主畫面」在清單第一組的最後；iOS 26 是網址列右邊的「⋯」加一張有 Aa 的面板。 */
export type IosMenuStyle = 'ios26' | 'ios27';
export const IOS_MENU_SINCE = 27;

/** Version/ 27 以上是新選單；26 以下（含 17、18 的分享表單）是舊的；沒有 Version/ 的第三方瀏覽器認不出版本，給最新的 */
export function iosMenuStyle(userAgent: string, maxTouchPoints = 0): IosMenuStyle {
  if (!isIosUa(userAgent, maxTouchPoints)) return 'ios27';
  const v = SAFARI_VERSION.exec(userAgent);
  return v && Number(v[1]) < IOS_MENU_SINCE ? 'ios26' : 'ios27';
}

export function parseSafariLayout(value: unknown, fallback: SafariLayout = 'compact'): SafariLayout {
  return value === 'compact' || value === 'bar' ? value : fallback;
}
