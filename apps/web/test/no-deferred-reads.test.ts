// 首頁、「我的」這一組頁面與相關橫幅的原始碼守門（維護者 2026-10-26：點進任何一頁都要直接看到完整的資訊，不可以先畫版面、數字「…」或骨架再補上）：
// 這些檔案不得再把進度延到第一次繪製之後才讀（afterFirstPaint、whenIdle、firstPaintSettled）、不得畫「…」或 Skeleton 占位、
// 每一頁（或它的主體元件）都要經 usePageReady 回報資料齊了沒。單元測試沒有 DOM，所以直接檢查原始碼；條件放寬時這裡會先擋下。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
/** 去掉註解（// 與 /* *\/）與 JSX 註解，只留程式；註解裡可以提到「…」與以前的做法 */
const code = (p: string) =>
  src(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\s*\/\/.*$/gm, '');

const PAGES = ['pages/Home.tsx', 'pages/Me.tsx', 'pages/Badges.tsx', 'pages/Backup.tsx', 'pages/Settings.tsx'];
const HOOKS_AND_PARTS = [
  'features/home/useHomeData.ts',
  'features/home/ChapterMiniMap.tsx',
  'features/me/usePlayerStats.ts',
  'features/me/PlayerCard.tsx',
  'features/me/progress-reads.ts',
  'features/badges/BadgesSection.tsx',
  'features/quiz/useDueCount.ts',
  'features/quiz/FavouritesSection.tsx',
  'components/BackupReminder.tsx',
  'components/ImportPromptCard.tsx',
  'components/InstallPrompt.tsx',
  'components/SafariTabNotice.tsx',
  'components/TimerSetting.tsx',
];
const ALL = [...PAGES, ...HOOKS_AND_PARTS];

/** InstallPrompt 另外看：只准用 whenIdle 預載圖解的 chunk；圖解的骨架只在使用者按「看圖解教學」之後才出現，不在第一屏 */
const INSTALL = 'components/InstallPrompt.tsx';
const STRICT = ALL.filter((p) => p !== INSTALL);

describe('首頁、我的與相關頁：不延後讀進度、沒有占位', () => {
  it.each(ALL)('%s 不用 afterFirstPaint 或 firstPaintSettled 延後讀資料', (p) => {
    const c = code(p);
    expect(c).not.toMatch(/\bafterFirstPaint\b/);
    expect(c).not.toMatch(/\bfirstPaintSettled\b/);
  });

  it.each(STRICT)('%s 不用 whenIdle、程式裡沒有「…」占位、Skeleton 與 .ll-line-ph', (p) => {
    const c = code(p);
    expect(c).not.toMatch(/\bwhenIdle\b/);
    expect(c).not.toMatch(/'…'|"…"|`…`/);
    expect(c).not.toMatch(/\bSkeleton\b/);
    expect(c).not.toMatch(/ll-line-ph/);
  });

  it('InstallPrompt：設定一掛載就讀（不經 afterFirstPaint），whenIdle 只用來預載圖解的 chunk；沒有「…」', () => {
    const c = code(INSTALL);
    expect(c).not.toMatch(/'…'|"…"|`…`/);
    expect(c.match(/whenIdle\(/g) ?? []).toHaveLength(1);
    expect(c).toMatch(/whenIdle\(\(\) => void loadGuide\(\)/);
  });

  it.each(['pages/Home.tsx', 'pages/Me.tsx', 'pages/Backup.tsx', 'pages/Settings.tsx', 'features/badges/BadgesSection.tsx', 'components/TimerSetting.tsx'])(
    '%s 經 usePageReady 回報資料齊了沒（徽章頁由 BadgesSection 回報、設定頁另由 TimerSetting 回報計時的設定）',
    (p) => {
      expect(code(p)).toMatch(/usePageReady\(/);
    },
  );

  it('徽章頁的主體是 BadgesSection', () => {
    expect(code('pages/Badges.tsx')).toMatch(/<BadgesSection\b/);
  });

  it.each(['components/BackupReminder.tsx', 'components/InstallPrompt.tsx', 'components/SafariTabNotice.tsx'])(
    '%s 的 hook 也回報 usePageReady（Banners 放進 PageReveal 的範圍後才生效）',
    (p) => {
      expect(code(p)).toMatch(/usePageReady\(/);
    },
  );

  it('安裝建議只等進度裡的設定，不等 beforeinstallprompt（外部事件，頁面不為它等）', () => {
    const install = code(INSTALL);
    expect(install).toMatch(/usePageReady\(settings !== null/);
    expect(install).not.toMatch(/usePageReady\([^)]*installEventAvailable/);
  });

  it('首頁的小地圖與「我的」的徽章橫排不再經 React.lazy 加 Suspense 在頁面出現後才補上', () => {
    expect(code('pages/Home.tsx')).not.toMatch(/\blazy\(|<Suspense\b/);
    expect(code('pages/Me.tsx')).not.toMatch(/lazy\(\(\) => import\('\.\.\/features\/me\/BadgeRow\.tsx'\)\)/);
  });

  it('me.css 不再有 .ll-line-ph 占位的樣式', () => {
    expect(src('styles/me.css')).not.toMatch(/ll-line-ph/);
  });
});
