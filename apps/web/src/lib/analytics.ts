// 流量統計（D7：Cloudflare Web Analytics，JS Snippet 手動安裝；06 第 8.3 節、09 第 11.3 節）。
// 規則：不寫在殼層 HTML；App 掛載完成、load 事件之後，用 requestIdleCallback 插入 async 腳本；離線不插入；
// 只有正式 origin 送到正式端點；CI 的效能量測帶 ?ll-analytics=stub 時照正式方式載入腳本，但把送出目的地改到同源的 stub 端點；
// 失敗一律略過：不重試、不顯示、不寫錯誤紀錄。SW 不 precache 它（generateSW 不處理跨來源）。
import { site } from '../../site.config.ts';

export type AnalyticsState = {
  status: 'loaded' | 'skipped' | 'failed' | 'pending';
  reason?: string;
  mode: 'production' | 'stub' | 'off';
  sentTo: string | null;
};

const state: AnalyticsState = { status: 'pending', mode: 'off', sentTo: null };
export const analyticsState = (): AnalyticsState => ({ ...state });

function decideMode(): AnalyticsState['mode'] {
  const q = new URLSearchParams(location.search).get('ll-analytics');
  if (q === 'stub') return 'stub';
  if (location.origin === site.productionOrigin) return 'production';
  return 'off';
}

function skip(reason: string) {
  state.status = 'skipped';
  state.reason = reason;
}

/** stub 模式：把 beacon 送往統計回報網域的請求改到同源的 stub 端點（不送出真實資料，但腳本的成本照算） */
function installStub() {
  const target = `${site.analytics.reportOrigin}${site.analytics.reportPath}`;
  const stub = '/__ll/rum-stub';
  const origBeacon = navigator.sendBeacon?.bind(navigator);
  if (origBeacon) {
    navigator.sendBeacon = (url, data) => origBeacon(String(url).startsWith(target) ? stub : url, data);
  }
  const origFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return origFetch(url.startsWith(target) ? stub : input, init);
  };
  state.sentTo = stub;
}

export function loadAnalytics(): void {
  if (state.status !== 'pending') return;
  const mode = decideMode();
  state.mode = mode;
  if (mode === 'off') return skip('non-production-origin');
  if (!site.analytics.token && mode === 'production') return skip('no-token');
  if (!navigator.onLine) return skip('offline');
  const insert = () => {
    if (!navigator.onLine) return skip('offline');
    if (mode === 'stub') installStub();
    else state.sentTo = `${site.analytics.reportOrigin}${site.analytics.reportPath}`;
    const s = document.createElement('script');
    s.src = `${site.analytics.scriptOrigin}${site.analytics.scriptPath}`;
    s.async = true;
    s.defer = true;
    s.dataset.cfBeacon = JSON.stringify({ token: site.analytics.token || '00000000000000000000000000000000', spa: true });
    s.dataset.ll = 'analytics';
    s.onload = () => {
      state.status = 'loaded';
    };
    s.onerror = () => {
      state.status = 'failed';
      state.reason = 'script-error';
    };
    document.head.appendChild(s);
  };
  const idle = () => (typeof requestIdleCallback === 'function' ? requestIdleCallback(insert, { timeout: 4000 }) : setTimeout(insert, 1500));
  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', idle, { once: true });
}
