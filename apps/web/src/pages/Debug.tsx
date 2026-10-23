// 隱藏的 debug 頁（02 第 8 節、06 第 9.3 節）：版本、語系、顯示模式、儲存、版面量測、媒體查詢、玻璃、SW、數字格式、web-vitals、流量統計、錯誤紀錄
import { Trans } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import { LOCALES, formatMoney, formatPercent, localeFromPath } from '@ledgerland/i18n';
import { Button, Card } from '@ledgerland/web-ui';
import { site } from '../../site.config.ts';
import { getTabbar } from '../app/Root.tsx';
import { swState } from '../components/UpdatePrompt.tsx';
import { guessEphemeral } from '../components/EphemeralNotice.tsx';
import { analyticsState } from '../lib/analytics.ts';
import { loadManifest } from '../lib/content.ts';
import { clearErrors, listErrors, type ErrorEntry } from '../lib/errors.ts';
import { isAppMode, readPref } from '../lib/prefs.ts';

function Json({ value }: { value: unknown }) {
  return (
    // 可捲動的程式碼區塊要能用鍵盤捲動，所以保留 tabIndex（WCAG 2.1.1）
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <pre className="ll-small" tabIndex={0}>
      {JSON.stringify(value, null, 2)}
    </pre>
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

  return (
    <>
      <h1>
        <Trans id="debug.title">診斷資訊</Trans>
      </h1>
      <p className="ll-muted ll-small">
        <Trans id="debug.hint">這一頁只在本機顯示資訊，不會送出任何資料；「複製全部結果」由你自己決定要不要貼給別人。</Trans>
      </p>
      <div className="ll-row">
        <Button onClick={() => void refresh()}>
          <Trans id="debug.refresh">重新量測</Trans>
        </Button>
        <Button
          onClick={() =>
            void navigator.clipboard?.writeText(JSON.stringify(report, null, 2)).then(
              () => setCopied(true),
              () => setCopied(false),
            )
          }
        >
          <Trans id="debug.copy">複製全部結果</Trans>
        </Button>
        {copied && (
          <output className="ll-ok">
            <Trans id="debug.copied">已複製</Trans>
          </output>
        )}
      </div>
      <h2>
        <Trans id="debug.version">版本</Trans>
      </h2>
      <Json value={report.version} />
      <h2>
        <Trans id="debug.env">裝置與環境</Trans>
      </h2>
      <Json value={env} />
      <h2>
        <Trans id="debug.storage">儲存</Trans>
      </h2>
      <Json value={storage} />
      <h2>Service Worker</h2>
      <Json value={sw} />
      <h2>Web Vitals</h2>
      <Json value={vitals} />
      <h2>
        <Trans id="debug.numbers">數字格式</Trans>
      </h2>
      <Json value={numbers} />
      <h2>
        <Trans id="debug.analytics">流量統計</Trans>
      </h2>
      <p className="ll-small">
        <Trans id="debug.analytics.note">服務：Cloudflare Web Analytics。不用 cookie、不含作答資料；只在正式網址啟用，離線或被擋下時略過。</Trans>
      </p>
      <Json value={report.analytics} />
      <h2>CSP</h2>
      <Json value={report.cspViolations} />
      <h2>
        <Trans id="debug.errors">錯誤紀錄（最近 50 筆）</Trans>
      </h2>
      <div className="ll-row">
        <Button onClick={() => void clearErrors().then(refresh)}>
          <Trans id="debug.errors.clear">清除</Trans>
        </Button>
      </div>
      <Json value={errors} />
      <Card>
        <p className="ll-small ll-muted">
          <Trans id="debug.appearanceLink">外觀、深色風味與玻璃效果在「我的 › 設定」調整。</Trans>
        </p>
      </Card>
    </>
  );
}
