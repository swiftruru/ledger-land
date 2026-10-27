// 頂部提示的統整（02 第 6 節的表、第 1 輪驗收）：一次只展開一條，優先順序是儲存層錯誤、更新提示、相機預覽提示、安裝建議、Safari 分頁的常駐提示、
// 內建瀏覽器提醒、備份提醒、語言建議（banner-rules.ts，純函式，有單元測試）。使用者收合過的 Safari 分頁或內建瀏覽器提示是一顆膠囊，最多一顆。
// 更新提示由 UpdatePrompt（掛在 Root，負責註冊 Service Worker）判斷要不要出現，這裡畫；相機預覽提示與語言建議也由這裡畫，Root 不再另外掛。
//
// 位置（第 1 輪驗收：有沒有橫幅，頁首的位置都一樣）：橫幅放在頁面的頁首（PageHeader 或 TopBar）之後、頁面內容之前，和內容間距 12px。
// 頁首是各頁自己畫的（而且頁面是 lazy 載入），所以這裡用 portal 畫進一個自己建立的 div（.ll-banner-slot），再把這個 div 搬到頁首後面：
// 第一次 commit 後（useLayoutEffect，繪製前）放好，之後用 MutationObserver 跟著頁首（頁面載入完成、載入中與完成換了一個頁首）重新放；
// 找不到頁首的頁面（錯誤頁、按鈕狀態板）留在 main 最上方的 .ll-banner-home 裡。React 只會插入與移除自己的節點，這個 div 不會被它動到。
// 頁面可以在任何元素加 data-ll-banner-after 指定「接在這個元素後面」（作答頁的 TopBar 和下面的計時列是同一組 #ll-level-head，它就帶這個屬性）。
//
// 闖關地圖（/play/）：Safari 分頁、備份提醒、安裝建議改成單行的 HintBar（地圖規格 4.9、站規 0.4 第 4 列與 2.2.4），用 portal 放進地圖組在 HUD 下方提供的
// #ll-map-hint-slot；儲存層錯誤、更新提示、相機預覽提示是完整的 Banner，也放進那個位置（sticky，地圖自動捲到目前關卡時也看得到）；
// 內建瀏覽器提醒與語言建議放在 HUD 上方的內容流裡（地圖頁不搬到頁首後面：HUD 是 sticky 的地圖頁首，地圖的第一屏要留給地圖）。
// 地圖頁是 lazy 載入，提示條的位置會晚一點出現：先等它（不先畫 Banner 再搬走，免得版面跳動），等不到才照常顯示一般 Banner。
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router';
import { stripLocale } from '@ledgerland/i18n';
import { environmentKind } from '../lib/env.ts';
import { storageStatus, useStorageStatus } from '../lib/progress/status.ts';
import { BackupHint, BackupReminder, useBackupReminder } from './BackupReminder.tsx';
import { EphemeralNotice, useEphemeralNotice } from './EphemeralNotice.tsx';
import { IN_APP_COLLAPSED_KEY, InAppBrowserBanner } from './InAppBrowserBanner.tsx';
import { InstallPrompt, useInstallPrompt } from './InstallPrompt.tsx';
import { LocaleSuggest, useLocaleSuggest } from './LocaleSuggest.tsx';
import { SAFARI_NOTICE_COLLAPSED_KEY, SafariTabHint, SafariTabNotice } from './SafariTabNotice.tsx';
import { StorageBanners } from './StorageBanners.tsx';
import { UpdateBanner, useUpdateBanner } from './UpdatePrompt.tsx';
import { storageFixture } from './banner-fixture.ts';
import { pickBanners, type BannerKind } from './banner-rules.ts';
import { useSessionFlag } from './useSessionFlag.ts';
import '../styles/notices.css';

/** 地圖組在 HUD 下方提供的提示條位置（地圖規格 4.9） */
export const MAP_HINT_SLOT_ID = 'll-map-hint-slot';
/** 地圖頁等提示條位置出現的時間；超過就照常顯示一般 Banner */
const MAP_HINT_SLOT_WAIT_MS = 2500;
/** 地圖頁改成提示條的種類（其餘維持 Banner）。安裝建議只在首頁與章節頁出現（banner-rules.ts 的 isInstallRoute），地圖頁用不到它的提示條，
 *  所以沒有 InstallHint（第 4 輪驗收時刪掉：首次載入的 JS 與 en catalog 都在預算邊緣）；規則放寬時它會是完整的 Banner */
const HINT_KINDS: readonly BannerKind[] = ['safari-tab', 'backup'];
/** 地圖頁放進提示條位置（HUD 下方、sticky）的完整 Banner：資料會遺失或要重新整理的少見狀況，地圖捲到下方（目前關卡）時也要看得到。
 *  內建瀏覽器提醒與語言建議比較常見，仍放在 HUD 上方的內容流裡，不長期佔住地圖的第一屏 */
const MAP_SLOT_BANNERS: readonly BannerKind[] = ['storage', 'update', 'ephemeral'];

/** 頁首：五個頂層頁的 PageHeader 與子頁的 TopBar（web-ui） */
const HEADER_SELECTOR = 'header.ll-pagehead, header.ll-topbar';

// 目前展開的是哪一條（給頁面用：例如首頁在資料會遺失的儲存層橫幅出現時，把主卡的按鈕暫時改成 secondary，畫面上只留一顆 primary）
let expandedNow: BannerKind | null = null;
const expandedListeners = new Set<() => void>();
function setExpandedNow(kind: BannerKind | null): void {
  if (expandedNow === kind) return;
  expandedNow = kind;
  for (const l of expandedListeners) l();
}
/** 目前展開的橫幅種類（沒有就是 null）；地圖頁的提示條也算 */
export function useExpandedBanner(): BannerKind | null {
  return useSyncExternalStore(
    (l) => {
      expandedListeners.add(l);
      return () => expandedListeners.delete(l);
    },
    () => expandedNow,
  );
}

/** 換頁時整組重新掛載（key 是路徑）：各提示在掛載時重讀設定與路由，不必各自追蹤 pathname */
export function Banners() {
  const location = useLocation();
  const path = stripLocale(location.pathname);
  return <BannersForRoute key={location.pathname} onMap={path === '/play/'} onInstallPage={path === '/install/'} />;
}

/** 地圖頁提示條的位置：在 main 裡找 #ll-map-hint-slot（地圖晚一點才掛上，所以觀察 DOM）；waitedOut 是等太久、改顯示 Banner */
function useMapHintSlot(active: boolean): { slot: HTMLElement | null; waitedOut: boolean } {
  const [slot, setSlot] = useState<HTMLElement | null>(() => (active ? document.getElementById(MAP_HINT_SLOT_ID) : null));
  const [waitedOut, setWaitedOut] = useState(false);
  useEffect(() => {
    if (!active) return;
    const check = () => {
      const next = document.getElementById(MAP_HINT_SLOT_ID);
      setSlot((prev) => (prev === next ? prev : next));
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.getElementById('main') ?? document.body, { childList: true, subtree: true });
    const timer = window.setTimeout(() => setWaitedOut(true), MAP_HINT_SLOT_WAIT_MS);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [active]);
  return { slot: active ? slot : null, waitedOut };
}

/** 橫幅要接在哪個元素後面：頁面指定的 data-ll-banner-after（作答頁是整組頁首），否則是第一個頁首；沒有頁首時是 null */
function headerAnchor(main: Element): Element | null {
  return main.querySelector('[data-ll-banner-after]') ?? main.querySelector(HEADER_SELECTOR);
}

/** 橫幅的位置：自己建立的 div，放在頁首之後（followHeader），否則放在 main 最上方的 home 裡 */
function useBannerSlot(followHeader: boolean) {
  const [slot] = useState(() => {
    const el = document.createElement('div');
    el.className = 'll-banner-slot';
    el.dataset.testid = 'banner-slot';
    return el;
  });
  const homeRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const home = homeRef.current;
    if (!home) return;
    const main = home.closest('main') ?? document.body;
    const place = () => {
      const anchor = followHeader ? headerAnchor(main) : null;
      if (anchor?.parentNode) {
        if (anchor.nextSibling !== slot) anchor.after(slot);
      } else if (slot.parentNode !== home) home.append(slot);
    };
    place();
    let observer: MutationObserver | null = null;
    if (followHeader) {
      observer = new MutationObserver(place);
      observer.observe(main, { childList: true, subtree: true });
    }
    return () => {
      observer?.disconnect();
      slot.remove();
    };
  }, [followHeader, slot]);
  return { slot, homeRef };
}

function BannersForRoute({ onMap, onInstallPage }: { onMap: boolean; onInstallPage: boolean }) {
  const status = useStorageStatus();
  const storageError = status.degraded || status.blocked || status.suspended || status.quotaExceeded || status.writeFailed;
  const environment = useMemo(() => environmentKind(), []);
  const update = useUpdateBanner();
  const ephemeral = useEphemeralNotice();
  const install = useInstallPrompt();
  const backup = useBackupReminder();
  const locale = useLocaleSuggest();
  const [safariCollapsed, setSafariCollapsed] = useSessionFlag(SAFARI_NOTICE_COLLAPSED_KEY);
  const [inAppCollapsed, setInAppCollapsed] = useSessionFlag(IN_APP_COLLAPSED_KEY);
  const { slot: mapSlot, waitedOut } = useMapHintSlot(onMap);
  const { slot, homeRef } = useBannerSlot(!onMap);

  // 截圖與 E2E 用：?ll-banner=storage-* 直接打開儲存層的旗標（只在 fixture 建置有作用，banner-fixture.ts）
  useEffect(() => {
    const flag = storageFixture();
    if (flag) storageStatus.set({ [flag]: true });
  }, []);

  // 地圖頁：Safari 分頁的提示條「關閉」等於收合，這個工作階段在地圖頁不再出現（也不顯示膠囊），接著顯示下一條
  const asHint = onMap && (mapSlot !== null || !waitedOut);
  const eligible: BannerKind[] = [];
  if (storageError) eligible.push('storage');
  if (update.visible) eligible.push('update');
  if (ephemeral.show) eligible.push('ephemeral');
  if (install.strategy !== 'none') eligible.push('install');
  // 安裝教學頁本身不顯示 Safari 分頁的提示（提示就是在引導人來這一頁；2026-10-27）
  if (environment === 'safari-tab' && !onInstallPage && !(asHint && safariCollapsed === '1')) eligible.push('safari-tab');
  if (environment === 'in-app-browser') eligible.push('in-app');
  if (backup.due) eligible.push('backup');
  if (locale.target !== null) eligible.push('locale');
  const collapsed: BannerKind[] = [];
  if (safariCollapsed === '1' && !onInstallPage) collapsed.push('safari-tab');
  if (inAppCollapsed === '1') collapsed.push('in-app');
  const pick = pickBanners(eligible, collapsed);

  // 地圖頁：提示條（與少見的完整 Banner）放進 HUD 下方的位置；位置還沒出現時先不畫（等不到才改畫在內容流裡，asHint 會變成 false）
  const expanded = pick.expanded;
  const inMapSlot = asHint && expanded !== null && (HINT_KINDS.includes(expanded) || MAP_SLOT_BANNERS.includes(expanded));
  const hint = inMapSlot && HINT_KINDS.includes(expanded) ? expanded : null;
  const mapBanner = inMapSlot && !HINT_KINDS.includes(expanded) ? expanded : null;
  const banner = inMapSlot ? null : expanded;

  useEffect(() => {
    setExpandedNow(pick.expanded);
  }, [pick.expanded]);
  useEffect(() => () => setExpandedNow(null), []);

  const bannerFor = (kind: BannerKind | null) => {
    switch (kind) {
      case 'storage':
        return <StorageBanners />;
      case 'update':
        return <UpdateBanner state={update} />;
      case 'ephemeral':
        return <EphemeralNotice onClose={ephemeral.close} />;
      case 'install':
        return <InstallPrompt strategy={install.strategy} dismiss={install.dismiss} />;
      case 'safari-tab':
        return <SafariTabNotice collapsed={false} onCollapse={() => setSafariCollapsed('1')} onExpand={() => setSafariCollapsed(null)} />;
      case 'in-app':
        return <InAppBrowserBanner collapsed={false} onCollapse={() => setInAppCollapsed('1')} onExpand={() => setInAppCollapsed(null)} />;
      case 'backup':
        return <BackupReminder dismiss={backup.dismiss} />;
      case 'locale':
        return locale.target !== null ? <LocaleSuggest {...locale} target={locale.target} /> : null;
      default:
        return null;
    }
  };
  const hintFor = (kind: BannerKind) =>
    kind === 'safari-tab' ? <SafariTabHint collapse={() => setSafariCollapsed('1')} /> : <BackupHint dismiss={backup.dismiss} />;

  const content = (
    <>
      {pick.collapsed === 'safari-tab' && <SafariTabNotice collapsed onCollapse={() => setSafariCollapsed('1')} onExpand={() => setSafariCollapsed(null)} />}
      {pick.collapsed === 'in-app' && <InAppBrowserBanner collapsed onCollapse={() => setInAppCollapsed('1')} onExpand={() => setInAppCollapsed(null)} />}
      {bannerFor(banner)}
    </>
  );

  return (
    <>
      <div className="ll-banner-home" ref={homeRef} />
      {createPortal(content, slot)}
      {mapSlot !== null && hint !== null && createPortal(hintFor(hint), mapSlot)}
      {mapSlot !== null && mapBanner !== null && createPortal(<div className="ll-map-banner">{bannerFor(mapBanner)}</div>, mapSlot)}
    </>
  );
}
