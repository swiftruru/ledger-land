// 頂部提示的純規則（02 第 6 節、06 第 2.5 節、第 1 輪驗收）：一次只展開一條、收合的膠囊最多一顆、安裝建議的頁面與條件
import { describe, expect, it } from 'vitest';
import { BANNER_PRIORITY, installPromptStrategy, isInstallRoute, pickBanners, type InstallPromptInput } from '../src/components/banner-rules.ts';

describe('pickBanners', () => {
  it('優先順序：儲存層 > 更新 > 相機預覽 > 安裝建議 > Safari 分頁 > 內建瀏覽器 > 備份提醒 > 語言建議', () => {
    expect(BANNER_PRIORITY).toEqual(['storage', 'update', 'ephemeral', 'install', 'safari-tab', 'in-app', 'backup', 'locale']);
  });

  it('一次只展開一條：依優先順序取第一條，其他不顯示', () => {
    expect(pickBanners(['install', 'backup', 'storage'])).toEqual({ expanded: 'storage', collapsed: null });
    expect(pickBanners(new Set(['backup', 'update', 'locale'] as const))).toEqual({ expanded: 'update', collapsed: null });
    expect(pickBanners(['locale'])).toEqual({ expanded: 'locale', collapsed: null });
    expect(pickBanners([])).toEqual({ expanded: null, collapsed: null });
  });

  it('iOS 的安裝建議出現時，Safari 分頁提示不論展開或收合都不顯示（安裝建議已經包含那一句）', () => {
    expect(pickBanners(['safari-tab', 'install'])).toEqual({ expanded: 'install', collapsed: null });
    expect(pickBanners(['safari-tab', 'install'], ['safari-tab'])).toEqual({ expanded: 'install', collapsed: null });
  });

  it('相機預覽提示比 Safari 分頁提示優先', () => {
    expect(pickBanners(['safari-tab', 'ephemeral', 'backup'])).toEqual({ expanded: 'ephemeral', collapsed: null });
  });

  it('收合過的常駐提示是一顆膠囊，不佔展開的位置：後面的第一條照樣展開', () => {
    expect(pickBanners(['safari-tab', 'backup', 'locale'], ['safari-tab'])).toEqual({ expanded: 'backup', collapsed: 'safari-tab' });
    expect(pickBanners(['in-app'], new Set(['in-app'] as const))).toEqual({ expanded: null, collapsed: 'in-app' });
    expect(pickBanners(['in-app', 'locale'], ['in-app'])).toEqual({ expanded: 'locale', collapsed: 'in-app' });
  });

  it('比膠囊優先的橫幅已經展開時，膠囊也不顯示', () => {
    expect(pickBanners(['storage', 'safari-tab'], ['safari-tab'])).toEqual({ expanded: 'storage', collapsed: null });
    expect(pickBanners(['update', 'in-app', 'backup'], ['in-app'])).toEqual({ expanded: 'update', collapsed: null });
  });

  it('不能收合的種類就算出現在收合清單裡也照常展開', () => {
    expect(pickBanners(['backup'], ['backup'])).toEqual({ expanded: 'backup', collapsed: null });
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
