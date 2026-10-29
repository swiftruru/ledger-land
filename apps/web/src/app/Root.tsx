import { useLingui } from '@lingui/react/macro';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation, useMatches, useNavigate } from 'react-router';
import { getLocale, localeFromPath, normalizePath } from '@ledgerland/i18n';
import { LinkProvider } from '@ledgerland/web-ui';
import { site } from '../../site.config.ts';
import { Banners } from '../components/Banners.tsx';
import { RouterLink } from '../components/RouterLink.tsx';
import { RefractFilter } from '../components/RefractFilter.tsx';
import { UpdatePrompt } from '../components/UpdatePrompt.tsx';
import { activateLocale } from '../i18n/lingui.ts';
import { loadAnalytics } from '../lib/analytics.ts';
import { afterFirstPaint } from '../lib/idle.ts';
import { PageReveal } from '../lib/page-ready.tsx';
import { attachTabbar, type TabbarHandle } from '../shell/tabbar.ts';
import { attachManifestLink } from './manifest-link.ts';
import type { RouteHandle } from './router.tsx';

let tabbar: TabbarHandle | null = null;
export const getTabbar = () => tabbar;

// 按鈕狀態板（站規 5.1，?ll-fixture=buttons）：E2E 與截圖用，動態載入。只在開發伺服器與帶 VITE_LL_FIXTURES=1 的建置存在；
// 正式建置時條件是常數 false，整段（含動態 import）被拿掉，bundle 與 precache 都沒有這個 chunk
const BUTTON_BOARD = import.meta.env.DEV || import.meta.env.VITE_LL_FIXTURES === '1';
const ButtonBoard = BUTTON_BOARD ? lazy(() => import('../features/design-system/ButtonBoard.tsx')) : null;

// 開發模式標示（站規 1.12 規則 4）：沒有 class 的裸連結加紅色虛線外框；正式建置時條件是常數 false，dev.css 不進 bundle
if (import.meta.env.DEV && typeof document !== 'undefined') {
  document.documentElement.dataset.dev = '';
  void import('../styles/dev.css');
}

export function Root() {
  const location = useLocation();
  const navigate = useNavigate();
  const matches = useMatches();
  const { t } = useLingui();
  const locale = localeFromPath(location.pathname);

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

  // 換頁後焦點移到頁面標題（07 第 8.2 節）：在 PageReveal 裡，布幕掀開那一刻才移（隱形的元素拿不到焦點）；首次載入不搶焦點

  // 統計（D7，06 第 8.3 節）：App 掛載完成、load 之後、第一次繪製送出且閒置時才插入，只在正式 origin
  useEffect(() => {
    loadAnalytics();
  }, []);

  // Service Worker 的註冊（UpdatePrompt 裡的 useRegisterSW 會動態載入 workbox-window）在第一次繪製送出後才開始，
  // 不讓它的 chunk 排在 LCP 前面（06 第 8.2 節）；更新提示本來就只在偵測到新版之後才出現。UpdatePrompt 本身不畫東西，橫幅由 Banners 畫。
  // manifest 連結也在這時才插入（manifest-link.ts）：瀏覽器抓 manifest 與安裝圖示的兩個請求不排在 LCP 前面
  const [swReady, setSwReady] = useState(false);
  useEffect(
    () =>
      afterFirstPaint(() => {
        attachManifestLink();
        setSwReady(true);
      }),
    [],
  );

  const normalized = normalizePath(location.pathname);
  if (normalized !== location.pathname) {
    return <Navigate replace to={`${normalized}${location.search}${location.hash}`} />;
  }

  // 內容寬（站規 2.0）：最深一層有 layout 的路由決定，只改 main 的屬性（base.css 依 data-layout 放寬），不碰 Tab bar
  const layout = matches.reduce<RouteHandle['layout']>((found, m) => (m.handle as RouteHandle | undefined)?.layout ?? found, undefined);

  // web-ui 元件的站內連結經 RouterLink 交給 react-router（站規 1.17），不整頁重新載入
  return (
    <LinkProvider component={RouterLink}>
      <div className="ll-topbar" />
      <main
        id="main"
        tabIndex={-1}
        aria-label={t({ id: 'shell.main', message: '主要內容' })}
        data-layout={layout}
        // 闖關地圖全幅出血（圖規第 7 節）：max-width none、內距 0，地景鋪到視窗左右邊緣與 rail 下方（規則在 quest-map.css）
        className={layout === 'map' ? 'll-main--map' : undefined}
      >
        {ButtonBoard && new URLSearchParams(location.search).get('ll-fixture') === 'buttons' ? (
          <Suspense fallback={null}>
            <ButtonBoard />
          </Suspense>
        ) : (
          <PageReveal>
            {/* 頂部提示一次只展開一條，畫在頁首之後（相機預覽提示、語言建議、更新提示的橫幅也由 Banners 依優先順序畫）；
                和頁面一起在布幕裡：橫幅要讀的進度齊了才連同頁面一起出現，不會在頁面出現後才把內容往下推 */}
            <Banners />
            <Outlet />
          </PageReveal>
        )}
      </main>
      {swReady && !(window as unknown as { __llExp?: string[] }).__llExp?.includes('nosw') && <UpdatePrompt />}
      <RefractFilter />
      <div className="ll-safearea-probe" aria-hidden="true" />
    </LinkProvider>
  );
}
