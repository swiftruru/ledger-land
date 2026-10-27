// 簡易版安裝提示（06 第 2.5 節、02 第 6 節與第 9.5 節；完整圖解教學在 M3）：第一次完成關卡後，在首頁與章節頁顯示一張可關閉的提示。
// Chromium 攔下 beforeinstallprompt、按「安裝」才呼叫 prompt()；iOS Safari 分頁顯示簡易說明加「匯出到 App」，圖解可以就地展開。
// 外觀（站規 2.17，第 3 輪驗收改）：Banner（info）；主動作是 secondary sm 加圖示（「安裝」或「匯出到 App」），首頁主卡的「開始闖關」才是畫面上唯一的 primary；
// quiet sm「之後再說」永遠放在動作列最後。iOS 的動作列（Banner 的 actions 槽）依序是：匯出到 App（唯一有外框與底邊的 secondary sm）、
// 看圖解教學（或收起圖解，aria-expanded，quiet sm 加向下或向上的箭頭）、完整教學頁（quiet sm，箭頭在後）、之後再說（第 4 輪驗收：三顆一樣的 secondary
// 看不出主次，橫幅也太重；說明縮成一句，不再和圖解卡片的第 0 步重複）。第 5 輪驗收：動作列和其他橫幅一樣從文字欄開始，
// 四顆排成兩欄的格子（notices.css），quiet 的字對齊同一欄上方的膠囊或箭頭；DOM 順序就是格子的順序，不要調換。
// 三顆 quiet 帶版面用的 ll-install-prompt__quiet（只設外距與寬度上限，頁面 CSS 不直接選 .ll-btn--quiet，check:links R11）。
// 橫幅只有頭部（圖示、標題、說明、動作列），高度不因圖解改變；展開的圖解是橫幅正下方的一張紙卡片（和 /install/ 的 InstallGuide 卡片同一個樣子，
// 在 .ll-banner-slot 裡和橫幅隔 12px），不再整份塞進藍色的橫幅裡。第 0 步說的「匯出到 App」就在卡片上方的橫幅裡，卡片裡不放第二顆。
// iOS 的安裝建議出現時 Safari 分頁的常駐提示不顯示（banner-rules.ts），所以它那句「已經加入主畫面就從圖示開啟」併在這裡的說明裡。
// 圖解的 chunk 還沒到時卡片裡先畫同樣形狀的骨架（站規 2.18 第 1 點）。安裝建議不會出現在地圖頁，所以沒有地圖頁的提示條版本（Banners.tsx 的 HINT_KINDS）。
// 關閉或 appinstalled 後記在 settings 的 installPromptDismissed，不再顯示。條件判斷是 banner-rules.ts 的純函式；可不可以出現由 Banners.tsx 決定。
// 進度裡的兩個設定一掛載就讀、讀到才經 usePageReady 回報（維護者 2026-10-26：橫幅和頁面一起出現）；iOS 的版本只看這兩個設定，所以會和頁面一起出現。
// Chromium 的版本還要等瀏覽器送 beforeinstallprompt（外部事件，時間不由我們決定，常在頁面出現之後才到），這一條維持事件到了才插進來，不讓整頁等一個可能不會來的事件。
// Banners 目前掛在 PageReveal 外面，usePageReady 的回報要等 Root 把 Banners 放進 PageReveal 的範圍才生效（回報裡的 handoff），在那之前是 no-op。
import { Trans, useLingui } from '@lingui/react/macro';
import { Suspense, lazy, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useLocation, useMatches } from 'react-router';
import { localePath, stripLocale } from '@ledgerland/i18n';
import { ArrowRightIcon, Banner, Button, Card, CaretDownIcon, DeviceIcon, ExportIcon } from '@ledgerland/web-ui';
import type { RouteHandle } from '../app/router.tsx';
import { INSTALL_DISMISSED_SETTING, LEVELS_COMPLETED_SETTING, readInstallSettings, type InstallSettings } from '../features/me/progress-reads.ts';
import { environmentKind } from '../lib/env.ts';
import { readPref, writePref } from '../lib/prefs.ts';
import { nowIso } from '../lib/progress/app-info.ts';
import { whenIdle } from '../lib/idle.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { getProgressStore } from '../lib/progress/index.ts';
import { useLocale } from '../lib/useLocale.ts';
import { installPromptStrategy, isInstallRoute, type InstallStrategy } from './banner-rules.ts';
import { installGuideVariant } from '../features/install/ios-version.ts';

// 完整圖解（06 第 2.6 節）不進首次載入的 chunk：iOS 的安裝建議出現後閒置時先預載，按「看圖解教學」時通常已經到了
const loadGuide = () => import('../features/install/InstallGuide.tsx');
const InstallGuide = lazy(loadGuide);

export { INSTALL_DISMISSED_SETTING, LEVELS_COMPLETED_SETTING };
const VISITED_PREF = 'll:visited';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** 這次載入是不是第一次造訪：讀 localStorage 的標記，沒有就寫上（每次載入只判斷一次） */
const firstVisit = ((): boolean => {
  const seen = readPref(VISITED_PREF);
  if (seen === null) writePref(VISITED_PREF, '1');
  return seen === null;
})();

// beforeinstallprompt 可能在 React 掛載前就送出，所以監聽器在模組載入時就掛上
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => {
  for (const l of listeners) l();
};
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as BeforeInstallPromptEvent;
  notify();
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  notify();
  void markDismissed('installed');
});

export function useInstallEventAvailable(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => deferred !== null,
  );
}

export async function promptInstall(): Promise<'unavailable' | 'accepted' | 'dismissed'> {
  if (!deferred) return 'unavailable';
  const ev = deferred;
  deferred = null;
  notify();
  await ev.prompt();
  const { outcome } = await ev.userChoice;
  return outcome;
}

async function markDismissed(reason: 'later' | 'installed'): Promise<void> {
  const store = await getProgressStore();
  await store.setSetting(INSTALL_DISMISSED_SETTING, { reason, at: nowIso() }, nowIso());
}

/** 安裝提示要用的設定；Banners 換頁時重新掛載，所以每頁都會重讀（完成關卡後回到首頁才會出現）。
 *  一掛載就讀（進度資料庫從 main.tsx 起就在開了）；null 代表還在讀，useInstallPrompt 把它算進 usePageReady 的條件 */
function useInstallSettings(): InstallSettings | null {
  const [value, setValue] = useState<InstallSettings | null>(null);
  useEffect(() => {
    let alive = true;
    getProgressStore()
      .then(readInstallSettings)
      .then(
        (v) => alive && setValue(v),
        () => alive && setValue({ levelsCompleted: 0, dismissed: false }),
      );
    return () => {
      alive = false;
    };
  }, []);
  return value;
}

export interface InstallPromptState {
  strategy: InstallStrategy;
  dismiss: () => void;
}

export function useInstallPrompt(): InstallPromptState {
  const location = useLocation();
  const matches = useMatches();
  const blockedRoute = matches.some((m) => (m.handle as RouteHandle | undefined)?.blocksUpdatePrompt);
  const settings = useInstallSettings();
  // 作答頁與匯入流程（blockedRoute）和不是首頁、章節頁的路由一律不顯示，不必等設定；其餘等進度裡的兩個設定讀到
  usePageReady(settings !== null || blockedRoute || !isInstallRoute(stripLocale(location.pathname)));
  const installEventAvailable = useInstallEventAvailable();
  const [dismissedNow, setDismissedNow] = useState(false);
  const strategy =
    settings === null
      ? 'none'
      : installPromptStrategy({
          environment: environmentKind(),
          firstVisit,
          blockedRoute,
          onInstallRoute: isInstallRoute(stripLocale(location.pathname)),
          levelsCompleted: settings.levelsCompleted,
          dismissed: settings.dismissed || dismissedNow,
          installEventAvailable,
        });
  const dismiss = () => {
    setDismissedNow(true);
    void markDismissed('later');
  };
  return { strategy, dismiss };
}

export function InstallPrompt({ strategy, dismiss }: InstallPromptState) {
  const { t } = useLingui();
  const locale = useLocale();
  const [guideOpen, setGuideOpen] = useState(false);
  // iOS 26 以上兩套可選、iOS 17 與 18 用 Top／Bottom 那一套（06 第 1 節）；依 UA 的版本號判斷。
  // 這張建議只在 iOS Safari 分頁出現，認不出版本（例如 iPad 的桌面版 UA）時也給 iOS 的圖解，不會落到 Chromium 或其他瀏覽器的版本
  const variant = useMemo(() => {
    const v = installGuideVariant(navigator.userAgent, navigator.maxTouchPoints);
    return v === 'ios-modern' || v === 'ios-legacy' ? v : 'ios-modern';
  }, []);
  useEffect(() => {
    if (strategy !== 'ios-guide') return;
    return whenIdle(() => void loadGuide().catch(() => {}));
  }, [strategy]);
  if (strategy === 'none') return null;
  const install = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') dismiss();
  };
  const later = (
    <Button
      variant="quiet"
      size="sm"
      className="ll-install-prompt__quiet"
      onClick={dismiss}
      aria-label={t({ id: 'install.laterA11y', message: '關閉安裝建議，之後再說', comment: '「之後再說」按鈕的可讀名稱' })}
    >
      <Trans id="install.later" comment="關閉安裝建議的按鈕">
        之後再說
      </Trans>
    </Button>
  );
  const title = (
    <Trans id="install.title" comment="安裝建議的標題">
      把會計樂園加到主畫面
    </Trans>
  );
  if (strategy === 'bip')
    return (
      <Banner
        className="ll-install-prompt"
        data-testid="install-prompt"
        title={title}
        actions={
          <>
            <Button size="sm" icon={<DeviceIcon />} onClick={() => void install()}>
              <Trans id="install.button" comment="Chromium 的安裝按鈕">
                安裝
              </Trans>
            </Button>
            {later}
          </>
        }
      >
        <p>
          <Trans id="install.body" comment="安裝建議的說明；只說「比較不容易」，不保證">
            開啟更快，進度也比較不容易被清除。
          </Trans>
        </p>
      </Banner>
    );
  return (
    <>
      <Banner
        className="ll-install-prompt ll-install-prompt--ios"
        data-testid="install-prompt"
        title={title}
        actions={
          <>
            <Button size="sm" icon={<ExportIcon />} href={localePath(locale, '/me/backup/')}>
              <Trans id="export.toApp">匯出到 App</Trans>
            </Button>
            <Button
              variant="quiet"
              size="sm"
              className="ll-install-prompt__quiet"
              icon={<CaretDownIcon className={guideOpen ? 'll-icon-flip' : undefined} />}
              aria-expanded={guideOpen}
              aria-controls="ll-install-guide"
              onClick={() => setGuideOpen((v) => !v)}
              data-testid="install-guide-toggle"
            >
              {guideOpen
                ? t({ id: 'install.guide.hide', message: '收起圖解', comment: '收起內嵌的安裝圖解' })
                : t({ id: 'install.guide.show', message: '看圖解教學', comment: '展開內嵌的安裝圖解' })}
            </Button>
            <Button variant="quiet" size="sm" className="ll-install-prompt__quiet" iconEnd={<ArrowRightIcon />} href={localePath(locale, '/install/')}>
              <Trans id="install.guide.fullPage" comment="連到獨立的安裝教學頁">
                完整教學頁
              </Trans>
            </Button>
            {later}
          </>
        }
      >
        <p>
          <Trans
            id="install.ios.short"
            comment="iOS 安裝建議的說明，併入 Safari 分頁常駐提示的那一句（兩條不會同時出現）；375 寬最多兩行，步驟在按「看圖解教學」展開的卡片裡"
          >
            已經加入就從主畫面圖示開啟，進度存在那裡；還沒加入就看圖解。
          </Trans>
        </p>
      </Banner>
      {/* 圖解卡片：收起時保留空的元素（hidden）給 aria-controls 指向；卡片的上下間距由 .ll-banner-slot 的 gap 負責（notices.css） */}
      <Card id="ll-install-guide" className="ll-install-prompt__guide" hidden={!guideOpen}>
        {guideOpen && (
          <Suspense fallback={null}>
            <InstallGuide variant={variant} embedded />
          </Suspense>
        )}
      </Card>
    </>
  );
}
