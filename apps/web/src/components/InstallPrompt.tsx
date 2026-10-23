// 簡易版安裝提示（06 第 2.5 節、02 第 6 節與第 9.5 節；完整圖解教學在 M3）：第一次完成關卡後，在首頁與章節頁顯示一張可關閉的卡片。
// Chromium 攔下 beforeinstallprompt、按「安裝」才呼叫 prompt()；iOS Safari 分頁顯示三行簡易說明加「匯出到 App」。
// 關閉或 appinstalled 後記在 settings 的 installPromptDismissed，不再顯示。條件判斷是 banner-rules.ts 的純函式；可不可以出現由 Banners.tsx 決定。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link, useLocation, useMatches } from 'react-router';
import { localePath, stripLocale } from '@ledgerland/i18n';
import { Button, Card } from '@ledgerland/web-ui';
import type { RouteHandle } from '../app/router.tsx';
import { environmentKind } from '../lib/env.ts';
import { readPref, writePref } from '../lib/prefs.ts';
import { nowIso } from '../lib/progress/app-info.ts';
import { afterFirstPaint } from '../lib/idle.ts';
import { getProgressStore } from '../lib/progress/index.ts';
import { useLocale } from '../lib/useLocale.ts';
import { installPromptStrategy, isInstallRoute, type InstallStrategy } from './banner-rules.ts';

export const INSTALL_DISMISSED_SETTING = 'installPromptDismissed';
export const LEVELS_COMPLETED_SETTING = 'levelsCompleted';
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

function useInstallEventAvailable(): boolean {
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

interface InstallSettings {
  levelsCompleted: number;
  dismissed: boolean;
}

/** 安裝提示要用的設定；Banners 換頁時重新掛載，所以每頁都會重讀（完成關卡後回到首頁才會出現） */
function useInstallSettings(): InstallSettings | null {
  const [value, setValue] = useState<InstallSettings | null>(null);
  useEffect(() => {
    let alive = true;
    // 進度資料庫等頁面內容繪製送出後再開（06 第 8.2 節，見 idle.ts），安裝提示晚幾百毫秒出現沒有關係
    const cancel = afterFirstPaint(() => {
      getProgressStore()
        .then(async (s) => {
          const [levels, dismissed] = await Promise.all([s.getSetting(LEVELS_COMPLETED_SETTING), s.getSetting(INSTALL_DISMISSED_SETTING)]);
          return { levelsCompleted: typeof levels?.value === 'number' ? levels.value : 0, dismissed: dismissed !== undefined };
        })
        .then(
          (v) => alive && setValue(v),
          () => alive && setValue({ levelsCompleted: 0, dismissed: false }),
        );
    });
    return () => {
      alive = false;
      cancel();
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
  if (strategy === 'none') return null;
  const install = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') dismiss();
  };
  return (
    <Card as="section" className="ll-install-prompt" aria-labelledby="ll-install-title">
      <h2 id="ll-install-title">
        <Trans id="install.title" comment="安裝建議卡片的標題">
          把會計樂園加到主畫面
        </Trans>
      </h2>
      <p className="ll-small">
        <Trans id="install.body" comment="安裝建議卡片的說明；只說「比較不容易」，不保證">
          開啟更快，進度也比較不容易被清除。
        </Trans>
      </p>
      {strategy === 'ios-guide' && (
        <ol className="ll-small">
          <li>
            <Trans id="install.ios.step1" comment="iOS 簡易說明第一步">
              按 Safari 的「分享」按鈕（新版 Safari 要先按網址列旁的「⋯」）
            </Trans>
          </li>
          <li>
            <Trans id="install.ios.step2" comment="iOS 簡易說明第二步">
              選「加入主畫面」
            </Trans>
          </li>
          <li>
            <Trans id="install.ios.step3" comment="iOS 簡易說明第三步">
              之後都從主畫面的圖示開啟；開啟後可以貼上備份碼把這裡的進度帶過去
            </Trans>
          </li>
        </ol>
      )}
      <div className="ll-row">
        {strategy === 'bip' ? (
          <Button variant="primary" onClick={() => void install()}>
            <Trans id="install.button" comment="Chromium 的安裝按鈕">
              安裝
            </Trans>
          </Button>
        ) : (
          <Link className="ll-btn ll-btn--primary" to={localePath(locale, '/me/backup/')}>
            <Trans id="export.toApp">匯出到 App</Trans>
          </Link>
        )}
        <Button onClick={dismiss} aria-label={t({ id: 'install.laterA11y', message: '關閉安裝建議，之後再說', comment: '「之後再說」按鈕的可讀名稱' })}>
          <Trans id="install.later" comment="關閉安裝建議的按鈕">
            之後再說
          </Trans>
        </Button>
      </div>
    </Card>
  );
}
