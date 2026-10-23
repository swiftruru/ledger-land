// 執行環境偵測（06 第 4.5、4.8 節）：內建瀏覽器的 UA 清單、Gecko 的 Firefox（FxiOS 不算）、iOS 的 Safari 分頁
import { describe, expect, it } from 'vitest';
import { IN_APP_BROWSER_UA, detectEnvironment, inAppBrowserNameOf, isGeckoFirefoxUa, isInAppBrowserUa, isIosUa } from '../src/lib/env.ts';

const IOS_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const IOS_LINE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/15.0.0';
const IOS_FIREFOX = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/140.0 Mobile/15E148 Safari/605.1.15';
const DESKTOP_FIREFOX = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:140.0) Gecko/20100101 Firefox/140.0';
const ANDROID_FIREFOX = 'Mozilla/5.0 (Android 15; Mobile; rv:140.0) Gecko/140.0 Firefox/140.0';
const DESKTOP_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const ANDROID_FB =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 [FBAN/FB4A;FBAV/500.0.0.0;]';
const IPAD_DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';

describe('env', () => {
  it('內建瀏覽器的 UA 清單集中在設定檔', () => {
    expect(IN_APP_BROWSER_UA).toEqual(['Line/', 'FBAN', 'FBAV', 'Instagram']);
    expect(isInAppBrowserUa(IOS_LINE)).toBe(true);
    expect(isInAppBrowserUa(ANDROID_FB)).toBe(true);
    expect(isInAppBrowserUa(`${DESKTOP_CHROME} Instagram 300.0`)).toBe(true);
    expect(isInAppBrowserUa(IOS_SAFARI)).toBe(false);
    expect(isInAppBrowserUa(DESKTOP_CHROME)).toBe(false);
  });

  it('isGeckoFirefox 只認 Gecko：電腦與 Android 的 Firefox 算，FxiOS 與 Chrome 的「like Gecko」不算', () => {
    expect(isGeckoFirefoxUa(DESKTOP_FIREFOX)).toBe(true);
    expect(isGeckoFirefoxUa(ANDROID_FIREFOX)).toBe(true);
    expect(isGeckoFirefoxUa(IOS_FIREFOX)).toBe(false);
    expect(isGeckoFirefoxUa(DESKTOP_CHROME)).toBe(false);
    expect(isGeckoFirefoxUa(IOS_SAFARI)).toBe(false);
  });

  it('iOS：iPhone 的 UA，或 iPad 送桌面版 UA 但有多點觸控', () => {
    expect(isIosUa(IOS_SAFARI, 5)).toBe(true);
    expect(isIosUa(IPAD_DESKTOP_UA, 5)).toBe(true);
    expect(isIosUa(IPAD_DESKTOP_UA, 0)).toBe(false);
    expect(isIosUa(DESKTOP_CHROME, 0)).toBe(false);
  });

  it('environmentKind：內建瀏覽器優先，再看 App 模式，iOS 非 App 是 safari-tab，其他是 browser', () => {
    expect(detectEnvironment({ userAgent: IOS_LINE, maxTouchPoints: 5, appMode: true })).toBe('in-app-browser');
    expect(detectEnvironment({ userAgent: IOS_SAFARI, maxTouchPoints: 5, appMode: true })).toBe('app');
    expect(detectEnvironment({ userAgent: IOS_SAFARI, maxTouchPoints: 5, appMode: false })).toBe('safari-tab');
    expect(detectEnvironment({ userAgent: IOS_FIREFOX, maxTouchPoints: 5, appMode: false })).toBe('safari-tab');
    expect(detectEnvironment({ userAgent: DESKTOP_CHROME, maxTouchPoints: 0, appMode: false })).toBe('browser');
    expect(detectEnvironment({ userAgent: DESKTOP_CHROME, maxTouchPoints: 0, appMode: true })).toBe('app');
  });
});

describe('inAppBrowserNameOf（06 第 4.8 節的橫幅文案）', () => {
  it('LINE、Facebook（含 Messenger 的 FBAN、FBAV）、Instagram；一般瀏覽器回 null', () => {
    expect(inAppBrowserNameOf(IOS_LINE)).toBe('LINE');
    expect(inAppBrowserNameOf(ANDROID_FB)).toBe('Facebook');
    expect(inAppBrowserNameOf(`${DESKTOP_CHROME} [FBAN/MessengerForiOS;FBAV/400.0]`)).toBe('Facebook');
    expect(inAppBrowserNameOf(`${DESKTOP_CHROME} Instagram 300.0`)).toBe('Instagram');
    expect(inAppBrowserNameOf(IOS_SAFARI)).toBeNull();
    expect(inAppBrowserNameOf(DESKTOP_FIREFOX)).toBeNull();
  });
});
