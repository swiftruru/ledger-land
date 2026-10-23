// 頂部提示的純規則（02 第 6 節、06 第 2.5 節）：優先順序與一次最多兩條、安裝建議的頁面與條件
import { describe, expect, it } from 'vitest';
import { BANNER_PRIORITY, installPromptStrategy, isInstallRoute, pickBannerSlots, type InstallPromptInput } from '../src/components/banner-rules.ts';

describe('pickBannerSlots', () => {
  it('依優先順序挑，最多兩條：錯誤類最優先，再來是 Safari 分頁提示、內建瀏覽器、備份提醒、安裝建議', () => {
    expect(BANNER_PRIORITY).toEqual(['storage', 'safari-tab', 'in-app', 'backup', 'install']);
    expect(pickBannerSlots(['install', 'backup', 'storage'])).toEqual(['storage', 'backup']);
    expect(pickBannerSlots(['install', 'safari-tab', 'backup'])).toEqual(['safari-tab', 'backup']);
    expect(pickBannerSlots(new Set(['in-app', 'install']))).toEqual(['in-app', 'install']);
    expect(pickBannerSlots(['install'])).toEqual(['install']);
    expect(pickBannerSlots([])).toEqual([]);
    expect(pickBannerSlots(['storage', 'backup'], 1)).toEqual(['storage']);
  });
});

describe('isInstallRoute', () => {
  it('只有首頁與章節頁（路徑已去掉語系前綴）', () => {
    expect(isInstallRoute('/')).toBe(true);
    expect(isInstallRoute('/chapter/ch_m2t7q4/')).toBe(true);
    expect(isInstallRoute('/play/')).toBe(false);
    expect(isInstallRoute('/level/lv_k7m2q9xd/')).toBe(false);
    expect(isInstallRoute('/me/backup/')).toBe(false);
  });
});

describe('installPromptStrategy', () => {
  const base: InstallPromptInput = {
    environment: 'browser',
    firstVisit: false,
    blockedRoute: false,
    onInstallRoute: true,
    levelsCompleted: 1,
    dismissed: false,
    installEventAvailable: true,
  };
  it('Chromium 有 beforeinstallprompt 時是按鈕；iOS Safari 分頁是簡易說明；其他瀏覽器不顯示', () => {
    expect(installPromptStrategy(base)).toBe('bip');
    expect(installPromptStrategy({ ...base, environment: 'safari-tab', installEventAvailable: false })).toBe('ios-guide');
    expect(installPromptStrategy({ ...base, installEventAvailable: false })).toBe('none');
  });
  it('App 模式與內建瀏覽器一律不顯示', () => {
    expect(installPromptStrategy({ ...base, environment: 'app' })).toBe('none');
    expect(installPromptStrategy({ ...base, environment: 'in-app-browser' })).toBe('none');
  });
  it('第一次造訪、作答中、不在首頁或章節頁、還沒完成關卡、關閉過：都不顯示', () => {
    expect(installPromptStrategy({ ...base, firstVisit: true })).toBe('none');
    expect(installPromptStrategy({ ...base, blockedRoute: true })).toBe('none');
    expect(installPromptStrategy({ ...base, onInstallRoute: false })).toBe('none');
    expect(installPromptStrategy({ ...base, levelsCompleted: 0 })).toBe('none');
    expect(installPromptStrategy({ ...base, dismissed: true })).toBe('none');
  });
});
