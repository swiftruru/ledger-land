import { useLingui } from '@lingui/react/macro';
import { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation, useMatches, useNavigate } from 'react-router';
import { getLocale, localeFromPath, normalizePath } from '@ledgerland/i18n';
import { site } from '../../site.config.ts';
import { EphemeralNotice } from '../components/EphemeralNotice.tsx';
import { LocaleSuggest } from '../components/LocaleSuggest.tsx';
import { RefractFilter } from '../components/RefractFilter.tsx';
import { UpdatePrompt } from '../components/UpdatePrompt.tsx';
import { activateLocale } from '../i18n/lingui.ts';
import { loadAnalytics } from '../lib/analytics.ts';
import { attachTabbar, type TabbarHandle } from '../shell/tabbar.ts';
import type { RouteHandle } from './router.tsx';

let tabbar: TabbarHandle | null = null;
export const getTabbar = () => tabbar;

export function Root() {
  const location = useLocation();
  const navigate = useNavigate();
  const matches = useMatches();
  const { t } = useLingui();
  const locale = localeFromPath(location.pathname);
  const lastPath = useRef<string | null>(null);

  // Tab bar：只掛一次；以 ref 取得殼層裡的 nav，不建立也不替換（07 第 6.1 節）
  useEffect(() => {
    tabbar = attachTabbar((to, opts) => navigate(to, opts));
    return () => {
      tabbar?.destroy();
      tabbar = null;
    };
  }, [navigate]);

  useEffect(() => {
    tabbar?.update(location.pathname);
  }, [location.pathname]);

  // 語系由網址決定；切換時更新 html lang 與 Lingui（05 第 9.1 節）
  useEffect(() => {
    document.documentElement.lang = getLocale(locale).htmlLang;
    void activateLocale(locale);
  }, [locale]);

  // 頁面標題依語系（M0a 發現第 9 點）；noindex 的頁面由用戶端加 meta（05 第 9.3 節）；canonical 與 hreflang 輔助用
  useEffect(() => {
    document.title = site.name;
    const noindex = matches.some((m) => (m.handle as RouteHandle | undefined)?.noindex);
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"][data-ll]');
    if (noindex && !meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      meta.content = 'noindex';
      meta.dataset.ll = 'route';
      document.head.appendChild(meta);
    } else if (!noindex && meta) meta.remove();
  }, [matches]);

  // 換頁後焦點移到頁面標題（07 第 8.2 節）；首次載入不搶焦點
  useEffect(() => {
    // 首次載入與同一路徑的重新繪製（例如語系切換後的 re-render）都不搶焦點
    if (lastPath.current === null) {
      lastPath.current = location.pathname;
      return;
    }
    if (lastPath.current === location.pathname) return;
    lastPath.current = location.pathname;
    const h1 = document.querySelector<HTMLElement>('main h1');
    if (h1) {
      h1.tabIndex = -1;
      h1.focus({ preventScroll: true });
    }
  }, [location.pathname]);

  // 統計（D7，06 第 8.3 節）：App 掛載完成、load 之後、idle 時才插入，只在正式 origin
  useEffect(() => {
    loadAnalytics();
  }, []);

  const normalized = normalizePath(location.pathname);
  if (normalized !== location.pathname) {
    return <Navigate replace to={`${normalized}${location.search}${location.hash}`} />;
  }

  return (
    <>
      <div className="ll-topbar" />
      <main id="main" tabIndex={-1} aria-label={t({ id: 'shell.main', message: '主要內容' })}>
        <EphemeralNotice />
        <LocaleSuggest />
        <Outlet />
      </main>
      <UpdatePrompt />
      <RefractFilter />
      <div className="ll-safearea-probe" aria-hidden="true" />
    </>
  );
}
