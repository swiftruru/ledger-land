// 安裝圖解要用哪一套（06 第 1 節、第 2.6 節）：UA 的 iOS 版本、Chromium 判斷、分頁列版面設定值。
// Safari 26 起 UA 的系統版本凍結在 OS 18_6、18_6_2 或 18_7，真正的版本在 Version/（finding pages-b-2）
import { describe, expect, it } from 'vitest';
import { installGuideVariant, iosMajorVersion, isChromiumUa, parseSafariLayout } from '../src/features/install/ios-version.ts';

// 真機 iOS 26 Safari 的 UA：OS 凍結在 18_6，Version/ 才是 26
const IOS26 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const IOS26_2 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Mobile/15E148 Safari/604.1';
const IOS27 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1';
// 第三方瀏覽器沒有 Version/：OS 18_6 可能是凍結值，交給使用者選
const FXIOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/140.0 Mobile/15E148 Safari/605.1.15';
const FXIOS_17 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/140.0 Mobile/15E148 Safari/605.1.15';
const IOS18 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const IOS17 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.7 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const DESKTOP_FIREFOX = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0';
const DESKTOP_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15';
const CRIOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1';

describe('iosMajorVersion', () => {
  it('先看 Version/（Safari 26 的 OS 凍結在 18），沒有才看 OS；iPad 桌面版 UA 看 Version/；其他回 null', () => {
    expect(iosMajorVersion(IOS26)).toBe(26);
    expect(iosMajorVersion(IOS27)).toBe(27);
    expect(iosMajorVersion(FXIOS)).toBe(18);
    expect(iosMajorVersion(IOS18)).toBe(18);
    expect(iosMajorVersion(IPAD_DESKTOP, 5)).toBe(18);
    expect(iosMajorVersion(DESKTOP_SAFARI, 0)).toBeNull();
    expect(iosMajorVersion(ANDROID_CHROME)).toBeNull();
  });
});

describe('installGuideVariant', () => {
  it('iOS 26 以上兩套可選；iOS 17、18 只用 Top／Bottom 那一套；iPhone 上的 Chrome 也是 WebKit，比照 Safari', () => {
    expect(installGuideVariant(IOS26)).toBe('ios-modern');
    expect(installGuideVariant(IOS26_2)).toBe('ios-modern');
    expect(installGuideVariant(IOS27)).toBe('ios-modern');
    expect(installGuideVariant(IOS18)).toBe('ios-legacy');
    expect(installGuideVariant(IOS17)).toBe('ios-legacy');
    expect(installGuideVariant(IPAD_DESKTOP, 5)).toBe('ios-legacy');
    expect(installGuideVariant(CRIOS)).toBe('ios-modern');
  });
  it('沒有 Version/ 的第三方瀏覽器：OS 18（可能是凍結值）讓使用者選，比 18 舊的才確定是舊版', () => {
    expect(installGuideVariant(FXIOS)).toBe('ios-modern');
    expect(installGuideVariant(FXIOS_17)).toBe('ios-legacy');
  });
  it('Chromium 系用安裝按鈕，其他瀏覽器給文字', () => {
    expect(isChromiumUa(ANDROID_CHROME)).toBe(true);
    expect(installGuideVariant(ANDROID_CHROME)).toBe('chromium');
    expect(installGuideVariant(DESKTOP_FIREFOX)).toBe('generic');
    expect(installGuideVariant(DESKTOP_SAFARI)).toBe('generic');
  });
});

describe('parseSafariLayout', () => {
  it('只認 compact 與 bar，其他回預設', () => {
    expect(parseSafariLayout('bar')).toBe('bar');
    expect(parseSafariLayout('compact')).toBe('compact');
    expect(parseSafariLayout(42)).toBe('compact');
    expect(parseSafariLayout(undefined, 'bar')).toBe('bar');
  });
});
