// 隱藏的 debug 頁（02 第 8 節、06 第 9.3 節）：版本、語系、顯示模式、儲存、版面量測、媒體查詢、玻璃、SW、數字格式、web-vitals、流量統計、錯誤紀錄
// 外觀（站規 2.15）：TopBar 返回「關於」；動作列是 secondary sm「重新量測」「複製全部結果」與「已複製」的狀態；
// 每一段 h2 加 .ll-json 區塊（太寬時區塊內水平捲動、可用鍵盤捲動，頁面本身不水平捲動；第 4 輪驗收：被切掉的那一側有捲動陰影，看得出還有內容）；
// 清除錯誤紀錄是 danger sm，沒有紀錄時停用並在旁邊寫「目前沒有紀錄」；最後一句的「我的 › 設定」是文中連結。
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import { LOCALES, formatMoney, formatPercent, localeFromPath, localePath } from '@ledgerland/i18n';
import { Button, CheckIcon, RetryIcon, TextLink, TopBar, TrashIcon } from '@ledgerland/web-ui';
import { CopyIcon } from '@ledgerland/web-ui/map';
import { site } from '../../site.config.ts';
import { getTabbar } from '../app/Root.tsx';
import { swState } from '../components/UpdatePrompt.tsx';
import { guessEphemeral } from '../components/EphemeralNotice.tsx';
import { useBackToAbout } from '../components/useBackLabels.ts';
import { analyticsState } from '../lib/analytics.ts';
import { loadManifest } from '../lib/content.ts';
import { clearErrors, listErrors, type ErrorEntry } from '../lib/errors.ts';
import { isAppMode, readPref } from '../lib/prefs.ts';
import { useLocale } from '../lib/useLocale.ts';
import '../styles/info.css';

/** 一段量測結果：h2 加可捲動的 JSON 區塊（aria-label 是這一段的標題，鍵盤 Tab 到區塊後可以用方向鍵捲動） */
function JsonSection({ title, label, value, children }: { title: React.ReactNode; label: string; value: unknown; children?: React.ReactNode }) {
  return (
    <section className="ll-debug__section">
      <h2>{title}</h2>
      {children}
      {/* 可捲動的程式碼區塊要能用鍵盤捲動，所以保留 tabIndex（WCAG 2.1.1） */}
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <pre className="ll-json" tabIndex={0} aria-label={label}>
        {JSON.stringify(value, null, 2)}
      </pre>
    </section>
  );
}

function environmentProbe() {
  const root = document.documentElement;
  const mq = (q: string) => window.matchMedia(q).matches;
  const probe = document.querySelector<HTMLElement>('.ll-safearea-probe');
  const cs = probe ? getComputedStyle(probe) : null;
  const uad = (navigator as Navigator & { userAgentData?: { brands: { brand: string; version: string }[]; mobile: boolean; platform: string } }).userAgentData;
  return {
    userAgent: navigator.userAgent,
    userAgentData: uad ? { brands: uad.brands.map((b) => `${b.brand} ${b.version}`).join(', '), mobile: uad.mobile, platform: uad.platform } : null,
    viewport: `${window.innerWidth} × ${window.innerHeight}`,
    visualViewport: window.visualViewport ? `${Math.round(window.visualViewport.width)} × ${Math.round(window.visualViewport.height)}` : null,
    screen: `${screen.width} × ${screen.height} @${window.devicePixelRatio}x`,
    safeArea: cs ? { top: cs.paddingTop, right: cs.paddingRight, bottom: cs.paddingBottom, left: cs.paddingLeft } : null,
    media: {
      prefersDark: mq('(prefers-color-scheme: dark)'),
      reducedMotion: mq('(prefers-reduced-motion: reduce)'),
      reducedTransparency: mq('(prefers-reduced-transparency: reduce)'),
      contrastMore: mq('(prefers-contrast: more)'),
      forcedColors: mq('(forced-colors: active)'),
    },
    display: {
      ...window.__llBoot?.displayMode,
      navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone ?? null,
      hasManifestLink: !!document.querySelector('link[rel="manifest"]'),
      isAppMode: isAppMode(),
      dataDisplay: root.dataset.display ?? null,
    },
    theme: {
      pref: readPref('ll:theme') ?? 'system',
      flavorPref: readPref('ll:dark-flavor') ?? 'violet',
      dataTheme: root.dataset.theme,
      dataFlavor: root.dataset.flavor,
    },
    glass: {
      dataGlass: root.dataset.glass,
      legacy: root.dataset.glassLegacy,
      transparencyPref: readPref('ll:transparency') ?? 'auto',
      unprefixed: window.__llBoot?.unprefixedBackdrop,
      prefixed: window.__llBoot?.prefixedBackdrop,
    },
    locale: {
      fromPath: localeFromPath(location.pathname),
      htmlLang: root.lang,
      pref: readPref('ll:locale'),
      rootRedirected: window.__llBoot?.rootRedirected ?? false,
      navigatorLanguages: navigator.languages,
      statuses: Object.fromEntries(LOCALES.map((l) => [l.code, l.status])),
    },
    online: navigator.onLine,
    viewTransitions: 'startViewTransition' in document,
    linearEasing: CSS.supports('transition-timing-function', 'linear(0, 1)'),
  };
}

export default function Debug() {
  const { t } = useLingui();
  const locale = useLocale();
  const back = useBackToAbout();
  const [env, setEnv] = useState(() => environmentProbe());
  const [storage, setStorage] = useState<unknown>(null);
  const [vitals, setVitals] = useState<Record<string, number>>({});
  const [sw, setSw] = useState<unknown>(null);
  const [content, setContent] = useState<unknown>(null);
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    setEnv(environmentProbe());
    const s = navigator.storage;
    setStorage({
      persisted: s?.persisted ? await s.persisted() : null,
      estimate: s?.estimate ? await s.estimate().then((e) => ({ usage: e.usage, quota: e.quota })) : null,
      ephemeral: await guessEphemeral(),
    });
    const reg = await navigator.serviceWorker?.getRegistration();
    setSw({
      controller: navigator.serviceWorker?.controller?.scriptURL ?? null,
      active: reg?.active?.state ?? null,
      waiting: reg?.waiting?.state ?? null,
      installing: reg?.installing?.state ?? null,
      lastCheck: swState.lastCheck,
      error: swState.error,
      offlineReady: swState.offlineReady,
      tabbar: getTabbar()?.state() ?? null,
    });
    setContent(
      await loadManifest().then(
        (m) => ({
          contentVersion: m.contentVersion,
          builtAt: m.builtAt,
          gitCommit: m.gitCommit,
          includesDrafts: m.includesDrafts === true,
          locales: m.locales,
        }),
        (e: unknown) => ({ error: String(e) }),
      ),
    );
    setErrors(await listErrors());
  }, []);

  useEffect(() => {
    void refresh();
    // web-vitals 只在 debug 頁載入（09 第 1 節）
    void import('web-vitals').then(({ onLCP, onINP, onCLS, onFCP, onTTFB }) => {
      const put = (m: { name: string; value: number }) => setVitals((v) => ({ ...v, [m.name]: Math.round(m.value * 1000) / 1000 }));
      onLCP(put, { reportAllChanges: true });
      onINP(put, { reportAllChanges: true });
      onCLS(put, { reportAllChanges: true });
      onFCP(put);
      onTTFB(put);
    });
  }, [refresh]);

  const numbers = Object.fromEntries(
    LOCALES.map((l) => [
      l.code,
      { money: [1234567, -1234567, 0, -0].map((v) => formatMoney(v, l.code)), percent: [0.0734, -0.0000004].map((v) => formatPercent(v, l.code)) },
    ]),
  );
  const report = {
    at: new Date().toISOString(),
    version: { app: __LL_APP_VERSION__, builtAt: __LL_BUILT_AT__, content },
    env,
    storage,
    sw,
    vitals,
    numbers,
    analytics: { service: site.analytics.service, ...analyticsState(), online: navigator.onLine },
    cspViolations: window.__llCsp ?? [],
    errors,
  };

  const copy = () =>
    void navigator.clipboard?.writeText(JSON.stringify(report, null, 2)).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  const label = {
    version: t({ id: 'debug.version', message: '版本' }),
    env: t({ id: 'debug.env', message: '裝置與環境' }),
    storage: t({ id: 'debug.storage', message: '儲存' }),
    numbers: t({ id: 'debug.numbers', message: '數字格式' }),
    analytics: t({ id: 'debug.analytics', message: '流量統計' }),
    errors: t({ id: 'debug.errors', message: '錯誤紀錄（最近 50 筆）' }),
  };

  return (
    <>
      <TopBar
        title={t({ id: 'debug.title', message: '診斷資訊' })}
        backHref={localePath(locale, '/about/')}
        backLabel={back.label}
        backShortLabel={back.short}
      />
      <p className="ll-muted ll-footnote">
        <Trans id="debug.hint">這一頁只在本機顯示資訊，不會送出任何資料；「複製全部結果」由你自己決定要不要貼給別人。</Trans>
      </p>
      <div className="ll-row ll-debug__actions">
        <Button size="sm" icon={<RetryIcon />} onClick={() => void refresh()}>
          <Trans id="debug.refresh">重新量測</Trans>
        </Button>
        <Button size="sm" icon={<CopyIcon />} onClick={copy}>
          <Trans id="debug.copy">複製全部結果</Trans>
        </Button>
        <output className="ll-statusline ll-ok" aria-live="polite">
          {copied && (
            <>
              <CheckIcon />
              <span>
                <Trans id="debug.copied">已複製</Trans>
              </span>
            </>
          )}
        </output>
      </div>
      <JsonSection title={label.version} label={label.version} value={report.version} />
      <JsonSection title={label.env} label={label.env} value={env} />
      <JsonSection title={label.storage} label={label.storage} value={storage} />
      <JsonSection title="Service Worker" label="Service Worker" value={sw} />
      <JsonSection title="Web Vitals" label="Web Vitals" value={vitals} />
      <JsonSection title={label.numbers} label={label.numbers} value={numbers} />
      <JsonSection title={label.analytics} label={label.analytics} value={report.analytics}>
        <p className="ll-small ll-muted">
          {/* 「被擋下時略過」整塊不斷（第 8 輪驗收：375 斷成「離線或被擋下」換行「時略過。」） */}
          <Trans id="debug.analytics.note" comment="診斷資訊的流量統計說明；<0> 是不換行的片語">
            服務：Cloudflare Web Analytics。不用 cookie、不含作答資料；只在正式網址啟用，離線或<span className="ll-nowrap">被擋下時略過</span>。
          </Trans>
        </p>
      </JsonSection>
      <JsonSection title="CSP" label="CSP" value={report.cspViolations} />
      <JsonSection title={label.errors} label={label.errors} value={errors}>
        <div className="ll-row ll-debug__actions">
          <Button
            variant="danger"
            size="sm"
            icon={<TrashIcon />}
            disabled={errors.length === 0}
            aria-describedby={errors.length === 0 ? 'll-debug-errors-empty' : undefined}
            onClick={() => void clearErrors().then(refresh)}
          >
            <Trans id="debug.errors.clear">清除</Trans>
          </Button>
          {errors.length === 0 && (
            <span id="ll-debug-errors-empty" className="ll-small ll-muted">
              <Trans id="debug.errors.empty" comment="診斷資訊：錯誤紀錄是空的時候，停用的「清除」旁邊的說明">
                目前沒有紀錄
              </Trans>
            </span>
          )}
        </div>
      </JsonSection>
      <p className="ll-small ll-muted ll-debug__foot">
        <Trans id="debug.settingsLink" comment="「我的 › 設定」是文中連結">
          外觀、深色風味與玻璃效果在
          <TextLink href={localePath(locale, '/me/settings/')} className="ll-keep">
            我的 › 設定
          </TextLink>
          調整。
        </Trans>
      </p>
    </>
  );
}
