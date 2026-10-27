// 闖關地圖 /play/（17、圖規、站規 2.2）：由下往上的關卡路線、頂部統計列（收編地圖工具）、提示條的位置、關卡介紹面板、清單檢視；
// ?chapter= 讓該章章節牌完整露出，?from= 播放過關後的星星點亮與沿路線的移動（跨章在拱門下停一下）。
// 幾何只有一個來源（features/quest-map/layout.ts）：第一次 render 前讀視窗內容寬與根字級算好，寫成 --qm-* 變數給 CSS；視窗改變時重算並保住目前關卡的位置。
// 疊加層（關卡面板、代號輸入、掃描）不是路由，但各加一筆歷史紀錄（02 第 2 節）：面板與代號用 location.state，掃描用 ?scan=1。
// 章節徽章（03 第 2.10 節、17 第 12 節第 3 項）：完成關卡時作答頁就寫進進度（features/badges/award.ts）；地圖載入後（有 ?from 時等回饋播完）
// 取回那些待慶祝的徽章，加上地圖自己判定的新徽章（補寫走 awardChapterBadges，取得日期用關卡的完成時間），顯示一則不打斷的 Toast；fixture 模式只顯示不寫入。
// 布幕（維護者 2026-10-26，lib/page-ready.tsx）：章節快照、進度、HUD 的三個數字、清單檢視的關卡名稱與第一屏附近的章節場景全部到齊才掀開，
// 沒有載入中的骨架路線、沒有「…」；真的讀不到內容才顯示 ErrorState。
import { Trans, useLingui } from '@lingui/react/macro';
import { Fragment, lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router';
import { formatPercent, localePath } from '@ledgerland/i18n';
import { Button, CardsIcon, EmptyState, ErrorState, Toast, ToastRegion } from '@ledgerland/web-ui';
import {
  ChapterBadge,
  KeyboardIcon,
  LevelSheet,
  ListIcon,
  LocateIcon,
  MapHud,
  MapIcon,
  QrIcon,
  useChapterLabels,
  useMapListLabels,
  type LevelSheetData,
  type MapHudTool,
  type MarkerExpression,
  type MarkerPose,
} from '@ledgerland/web-ui/map';
import { lightStars, prefersReducedMotion, wait } from '../features/quest-map/animation.ts';
import { awardChapterBadges, mergeCelebrations, takeCelebrations } from '../features/badges/award.ts';
import { contentSource } from '../features/quest-map/data.ts';
import { BANNER, geometryFor, layoutMap, markerAt, type MapGeometry } from '../features/quest-map/layout.ts';
import { levelStatus, ListView } from '../features/quest-map/ListView.tsx';
// 給老師的關卡 QR：面板開啟時才載入（不進地圖的 chunk；編碼器再按「顯示 QR」才載）
const LevelQr = lazy(() => import('../features/quest-map-overlays/LevelQr.tsx').then((m) => ({ default: m.LevelQr })));
import {
  badgeCount,
  currentLevelId,
  earnedBadges,
  levelDone,
  levelRead,
  previousLevelId,
  starsOf,
  totalStars,
  withBadges,
  type EarnedBadge,
} from '../features/quest-map/progress.ts';
import { QuestMap, type CardSize } from '../features/quest-map/QuestMap.tsx';
import { canOfferScan } from '../features/quest-map/scan.ts';
import { SceneReadyProvider, type SceneLayerKind, type SceneReadyState } from '../features/quest-map/scenes.tsx';
import { fixtureRequestFrom, useQuestMap } from '../features/quest-map/useQuestMap.ts';
import { isAppMode, isInAppBrowser } from '../lib/env.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { takeLeftUnfinished } from '../lib/level-exit.ts';
import { useLocale } from '../lib/useLocale.ts';
import '../styles/quest-map.css';

// 掃描畫面（相機與解碼器）是獨立 chunk，按「開始掃描」才載入（02 第 4.7 節）
const QrScanner = lazy(() => import('../features/quest-map/QrScanner.tsx'));
// 關卡代號與掃描說明的疊加層也是獨立 chunk（第 5 輪看圖驗收後的體積調整：地圖 chunk 28 KB 的預算）：地圖畫好 1.5 秒後載入、掛上（關著），
// 使用者在那之前就打開（或網址帶 ?scan=1、返回到代號疊加層）時立刻載入
const LevelCodeOverlay = lazy(() => import('../features/quest-map-overlays/LevelCodeOverlay.tsx').then((m) => ({ default: m.LevelCodeOverlay })));
const ScanOverlay = lazy(() => import('../features/quest-map-overlays/ScanOverlay.tsx').then((m) => ({ default: m.ScanOverlay })));
// 關卡面板的學習目標照全站規則換行（07 第 3.5 節，2026-10-27 起不再切詞；原本第一次打開面板才載入的切詞 chunk 已拿掉）

const SCROLL_KEY = 'll:map-scroll';
/** 徽章 Toast 自動收起的時間（ms）；焦點或滑鼠停在提示裡時暫停；也可以手動關閉 */
const BADGE_TOAST_MS = 8000;
/** 底部 Tab bar 的高度（tokens 的 tabbar.heightPx）與它上方留的空間（圖規 4.10） */
const TABBAR_H = 64;
const TABBAR_GAP = 16;
/** 自動定位後目前關卡圓心可以落在可用區的範圍（地標避讓時用；第 2 輪看圖驗收） */
const CURRENT_LO = 0.5;
const CURRENT_HI = 0.72;
/** 第一關時圓心不得高於可用區上緣往下這麼多（鈴的頭頂仍要露出，圖規 4.10）；字級放大時放寬到 96（鈴的帽頂可以淡進 HUD 下緣的漸層，
 *  320 × 568 的 200% 才放得下第一關加整張章節牌，第 2 輪看圖驗收） */
const FIRST_LEVEL_MIN_TOP = 112;
const FIRST_LEVEL_MIN_TOP_ZOOMED = 96;

interface BadgeToast {
  id: string;
  state: 'done' | 'mastery';
  title: string;
}

interface OverlayState {
  llOverlay?: 'sheet' | 'code';
  levelId?: string;
  llPushed?: boolean;
}

function withParam(search: string, key: string, value: string | null): string {
  const p = new URLSearchParams(search);
  if (value === null) p.delete(key);
  else p.set(key, value);
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** 視窗內容寬與根字級（取不到時 geometryFor 用 375） */
function readGeometry(): MapGeometry {
  if (typeof document === 'undefined') return geometryFor(Number.NaN);
  const root = document.documentElement;
  return geometryFor(root.clientWidth, parseFloat(getComputedStyle(root).fontSize));
}

/** 底部 safe area（殼層的 .ll-safearea-probe 用 padding 讀 env()） */
function safeAreaBottom(): number {
  const probe = document.querySelector<HTMLElement>('.ll-safearea-probe');
  return probe ? parseFloat(getComputedStyle(probe).paddingBottom) || 0 : 0;
}

export default function Play() {
  const locale = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const navType = useNavigationType();
  const { t } = useLingui();
  const chapterLabels = useChapterLabels();
  const listLabels = useMapListLabels();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const req = useMemo(() => fixtureRequestFrom(location.search), [location.search]);
  const { state, metas, metaDone, needChapterMeta, needLevelMeta, retry } = useQuestMap(locale, req);
  const ready = state.status === 'ready' ? state : null;
  const data = ready?.data ?? null;
  // 本次打開地圖新取得的徽章先併進畫面上的進度（寫入 store 是非同步的）。進度和章節快照一起到（useQuestMap）：ready 之前 progress 是 null
  const [sessionBadges, setSessionBadges] = useState<readonly string[]>([]);
  const progress = useMemo(() => (ready ? (sessionBadges.length ? withBadges(ready.progress, sessionBadges) : ready.progress) : null), [ready, sessionBadges]);

  // 幾何（圖規 1.4）：第一次 render 前就算好；視窗或根字級改變時用 rAF 節流重算，重算前記下目前關卡在畫面上的位置，重算後還原
  const [geo, setGeo] = useState<MapGeometry>(readGeometry);
  const anchor = useRef<{ levelId: string; top: number } | null>(null);
  const currentIdRef = useRef<string | null>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const next = readGeometry();
        setGeo((prev) => {
          if (prev.bandW === next.bandW && prev.fontScale === next.fontScale) return prev;
          const id = currentIdRef.current;
          const el = id ? document.querySelector(`[data-level-id="${id}"] button`) : null;
          anchor.current = id && el ? { levelId: id, top: el.getBoundingClientRect().top } : null;
          return next;
        });
      });
    };
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    ro?.observe(document.documentElement);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);
  // 字級放大時 QuestMap 量到的章節牌與紙籤高度（layout.ts 的 fitZones）：先記在 ref，等這一次 commit 的捲動定位做完（下面「量到的卡片高度」那個 effect）
  // 才記下目前關卡在畫面上的位置、換成新的排版，再由上面的 anchor 還原，畫面不跳
  const [cardSizes, setCardSizes] = useState<ReadonlyMap<string, CardSize> | null>(null);
  const pendingCardSizes = useRef<ReadonlyMap<string, CardSize> | null>(null);
  const onMeasureCards = useCallback((m: ReadonlyMap<string, CardSize>) => {
    pendingCardSizes.current = m;
  }, []);
  const zoomedCards = geo.fontScale > 1 ? cardSizes : null;
  const chapterInputs = useMemo(
    () =>
      data ? data.chapters.map((c) => ({ id: c.id, levelIds: c.levels.map((l) => l.id), extension: c.extension, ...(zoomedCards?.get(c.id) ?? {}) })) : null,
    [data, zoomedCards],
  );
  const layout = useMemo(() => (chapterInputs ? layoutMap(chapterInputs, geo) : null), [chapterInputs, geo]);
  const currentId = data && progress ? currentLevelId(data, progress) : null;
  currentIdRef.current = currentId;
  useLayoutEffect(() => {
    const a = anchor.current;
    if (!a) return;
    anchor.current = null;
    const el = document.querySelector(`[data-level-id="${a.levelId}"] button`);
    if (el) window.scrollBy(0, el.getBoundingClientRect().top - a.top);
  }, [layout]);

  // 每次進闖關都是地圖（維護者 2026-10-26：不因為上次切到清單就再進清單），偏好不存；?view=list 只給測試與站內連結用
  const [list, setList] = useState(() => params.get('view') === 'list');
  /** 使用者自己切換了檢視（切到清單時焦點才移到目前章節的 summary） */
  const viewSwitchedByUser = useRef(false);
  const toggleList = (v: boolean) => {
    viewSwitchedByUser.current = true;
    setList(v);
  };

  const mapRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<SVGSVGElement | null>(null);
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const overlayReturn = useRef<HTMLElement | null>(null);
  const [markerLevelId, setMarkerLevelId] = useState<string | null>(null);
  const [markerLook, setMarkerLook] = useState<{ pose: MarkerPose; expression: MarkerExpression }>({ pose: 'cheek', expression: 'smile' });
  const [starsOverride, setStarsOverride] = useState<{ levelId: string; stars: 0 | 1 | 2 | 3 } | null>(null);
  const [celebrating, setCelebrating] = useState<string | null>(null);
  /** ?from 的回饋播完（或沒有 ?from、清單檢視、半途取消）之後才判定徽章與顯示 Toast */
  const [fromDone, setFromDone] = useState(false);
  const [badgeToasts, setBadgeToasts] = useState<BadgeToast[]>([]);
  /** 作答頁還沒做完就按返回：只顯示「已暫存，可隨時回來繼續」（站規 2.4.1） */
  const [leftToast, setLeftToast] = useState(false);
  const [toastHeld, setToastHeld] = useState(false);
  const playedFrom = useRef(false);
  const badgesChecked = useRef(false);
  const scrolledOnce = useRef(false);
  /** 最近一次自動捲到目前關卡的位置：使用者還沒捲動前 sticky 區塊長高（提示位置晚一步放進完整的 Banner）時，依新的可用區重新定位 */
  const autoScroll = useRef<{ levelId: string; y: number } | null>(null);
  const onStickyResize = useRef<() => void>(() => {});

  // 疊加層狀態：面板與代號用 history state，掃描用 ?scan=1
  const ovState = (location.state ?? null) as OverlayState | null;
  const overlay = ovState?.llOverlay ?? null;
  const sheetLevelId = overlay === 'sheet' ? (ovState?.levelId ?? null) : null;
  const scanOpen = params.get('scan') === '1';
  // 疊加層（代號、掃描）的 chunk：地圖畫好 1.5 秒後掛上；在那之前打開時立刻掛
  const [overlaysIdle, setOverlaysIdle] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setOverlaysIdle(true), 1500);
    return () => window.clearTimeout(id);
  }, []);
  const overlaysMounted = overlaysIdle || overlay === 'code' || scanOpen;
  const openOverlay = useCallback(
    (s: OverlayState) => navigate({ pathname: location.pathname, search: location.search }, { state: s }),
    [navigate, location.pathname, location.search],
  );
  const closeOverlay = () => {
    if (overlay) navigate(-1);
  };
  const openScan = () =>
    navigate({ pathname: location.pathname, search: withParam(location.search, 'scan', '1') }, { state: { llPushed: true } satisfies OverlayState });
  const closeScan = () => {
    if (ovState?.llPushed) navigate(-1);
    else navigate({ pathname: location.pathname, search: withParam(location.search, 'scan', null) }, { replace: true });
  };
  const go = useCallback((href: string) => navigate(href), [navigate]);
  // 課堂 QR（06 第 4.9 節）：掃描疊加層只接受正式 origin 或目前 origin 的關卡、章節、故事步驟網址（qr-url.ts），已先 stripLocale；
  // 這裡以目前介面語言導覽並帶 ?via=qr。不是本站的 QR 時疊加層顯示「這不是 LedgerLand 的課堂 QR」，絕不開啟站外網址
  const onScanTarget = useCallback((path: string) => navigate(`${localePath(locale, path)}?via=qr`), [locale, navigate]);

  const nodeButton = useCallback((levelId: string) => mapRef.current?.querySelector<HTMLButtonElement>(`[data-level-id="${levelId}"] button`) ?? null, []);

  /** 可用區（圖規 4.10）：上緣是 sticky 區塊（頂部統計列加提示條）的下緣，下緣避開底部 Tab bar（expanded 以上沒有底部 Tab bar） */
  // Toast 的位置在 sticky 區塊下緣加 8px（圖規第 3 節）：提示條出現或消失時跟著變
  const pageRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = stickyRef.current;
    const page = pageRef.current;
    if (!el || !page || typeof ResizeObserver === 'undefined') return;
    let h = el.offsetHeight;
    // 先同步寫一次，之後的變化延到下一個影格才寫（M3 收尾 QA，2026-10-26）：--qm-sticky-h 決定地圖內容的 min-height（quest-map.css），
    // 在 ResizeObserver 的回呼裡直接改，同一輪已經送出的 documentElement 觀察（上面量幾何的 update）就收不到這次的尺寸變化，
    // 瀏覽器在 window 丟出「ResizeObserver loop completed with undelivered notifications」，錯誤紀錄因此在 LCP 之前開進度資料庫
    page.style.setProperty('--qm-sticky-h', `${h}px`);
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        page.style.setProperty('--qm-sticky-h', `${el.offsetHeight}px`);
        if (el.offsetHeight !== h) {
          h = el.offsetHeight;
          onStickyResize.current();
        }
      });
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);
  const usable = useCallback(() => {
    const top = stickyRef.current?.offsetHeight ?? 0;
    const bottom = geo.bp === 'expanded' ? window.innerHeight - 24 : window.innerHeight - (TABBAR_H + safeAreaBottom() + TABBAR_GAP);
    return { top, bottom: Math.max(top + 120, bottom) };
  }, [geo.bp]);
  /** 地圖底部在頁面上的 y（整張地圖的 y 從底部往上，頁面 y = 地圖底部 − 地圖 y） */
  const mapBottomY = useCallback(() => {
    const el = mapRef.current;
    if (!el || !layout) return null;
    return el.getBoundingClientRect().top + window.scrollY + layout.totalHeight;
  }, [layout]);
  /**
   * 目前關卡圓心落在可用區 60% 處；本章第一關時讓章節牌（含立柱）下緣在可用區下緣 8px 以上（圓心不高於上緣 112）。
   * 章節牌下緣用實際量到的位置（字級放大時卡片比保留的最大高度矮，第 2 輪看圖驗收的 200%），量不到時才用幾何的值。
   * 算好之後再避開地標（第 2 輪看圖驗收：HUD 下緣切到半張章節牌、半個拱門或兩根懸空的立柱）：附近的章節牌、紙籤、拱門與海峽說明卡
   * 只要有一張跨過可用區上緣，就在「整張藏到 HUD 後面」與「整張露出」之間選位移較小、而且目前關卡仍在可用區 50% 到 72% 的那個。
   */
  const scrollTopForLevel = useCallback(
    (levelId: string): number | null => {
      if (!layout) return null;
      const base = mapBottomY();
      const p = markerAt(layout, levelId);
      if (base === null || !p) return null;
      const { top, bottom } = usable();
      const span = bottom - top;
      const centre = base - p.y;
      let target = top + 0.6 * span;
      const ch = layout.chapters.find((c) => c.nodes[0]?.levelId === levelId);
      const minTop = layout.geometry.fontScale > 1 ? FIRST_LEVEL_MIN_TOP_ZOOMED : FIRST_LEVEL_MIN_TOP;
      const root = mapRef.current;
      /** 章節牌（含立柱與陰影）在頁面上的下緣；第 1 章字級 100% 時用區段底邊（起點與立柱站在地上） */
      let bannerBottom: number | null = null;
      if (ch) {
        const el = root?.querySelector<HTMLElement>(`[data-chapter-id="${ch.chapterId}"] .qm-ch__banner`);
        const r = el?.getBoundingClientRect();
        const measured = r && r.height > 0 ? r.bottom + window.scrollY + BANNER.postH + BANNER.shadowH / 2 : null;
        const fromLayout = centre + (ch.first ? ch.nodes[0]!.y : ch.nodes[0]!.y - BANNER.bottom + BANNER.postH);
        bannerBottom = ch.first && layout.geometry.fontScale <= 1 ? fromLayout : (measured ?? fromLayout);
        const over = target + (bannerBottom - centre) - (bottom - 8);
        if (over > 0) target = Math.max(top + minTop, target - over);
      }
      const y0 = Math.max(0, centre - target);
      // 地標避讓：只量目標位置上下各一屏內的區段（其他區段還是 content-visibility 跳過的狀態，不強迫排版）
      if (!root) return y0;
      const near: HTMLElement[] = [];
      for (const sec of root.querySelectorAll<HTMLElement>('.qm-ch, .qm-strait')) {
        const r = sec.getBoundingClientRect();
        const pageTop = r.top + window.scrollY;
        if (pageTop < y0 + window.innerHeight + span && pageTop + r.height > y0 - span) near.push(sec);
      }
      const marks: { top: number; bottom: number }[] = [];
      for (const sec of near)
        for (const el of sec.querySelectorAll<HTMLElement>('.qm-ch__banner, .ll-chend__plaque, .ll-chend__arch, .qm-strait__card')) {
          const r = el.getBoundingClientRect();
          if (r.height === 0) continue;
          // 章節牌下方的立柱與陰影、紙籤與說明卡的木樁、拱門上方的三角旗與拱心石也算在地標裡
          const below = el.classList.contains('qm-ch__banner') ? BANNER.postH + BANNER.shadowH / 2 : el.classList.contains('ll-chend__arch') ? 0 : 16;
          const above = el.classList.contains('ll-chend__arch') ? 26 : 0;
          marks.push({ top: r.top + window.scrollY - above, bottom: r.bottom + window.scrollY + below });
        }
      const lo = ch ? Math.min(CURRENT_LO, minTop / span) : CURRENT_LO;
      // 捲不到的位置（超過頁尾）不算：瀏覽器會把它夾回最大捲動量
      const maxY = document.documentElement.scrollHeight - window.innerHeight;
      const valid = (y: number) => {
        const f = (centre - y - top) / span;
        if (y < 0 || y > maxY || f < lo - 1e-6 || f > CURRENT_HI + 1e-6) return false;
        return bannerBottom === null || bannerBottom - y <= Math.max(bottom - 8, bannerBottom - y0);
      };
      const crossing = (y: number) => marks.filter((m) => m.top - y < top + 8 && m.bottom - y > top);
      let y = y0;
      for (let i = 0; i < 4; i++) {
        const cut = crossing(y);
        if (cut.length === 0) break;
        const cands: number[] = [];
        for (const m of cut) cands.push(m.bottom - top + 4, m.top - top - 8);
        const best = cands
          .filter(valid)
          .map((c) => ({ c, bad: crossing(c).length }))
          .sort((a, b) => a.bad - b.bad || Math.abs(a.c - y0) - Math.abs(b.c - y0))[0];
        if (!best || best.c === y) break;
        y = best.c;
        if (best.bad === 0) break;
      }
      return crossing(y).length <= crossing(y0).length ? y : y0;
    },
    [layout, mapBottomY, usable],
  );
  const scrollToLevel = useCallback(
    (levelId: string, behavior: ScrollBehavior) => {
      const y = scrollTopForLevel(levelId);
      if (y !== null) window.scrollTo({ top: y, behavior });
    },
    [scrollTopForLevel],
  );
  /** ?chapter=：該章章節牌完整露出，卡片中心放在可用區 70% 處 */
  const scrollToBanner = useCallback(
    (chapterId: string, behavior: ScrollBehavior) => {
      const el = mapRef.current?.querySelector<HTMLElement>(`[data-chapter-id="${chapterId}"] .qm-ch__banner`);
      if (!el) return;
      const { top, bottom } = usable();
      const r = el.getBoundingClientRect();
      const centre = r.top + window.scrollY + r.height / 2;
      window.scrollTo({ top: Math.max(0, centre - (top + 0.7 * (bottom - top))), behavior });
    },
    [usable],
  );
  /** 清單：該章的 summary 放在可用區上緣往下 16px，焦點移到 summary（圖規 4.11） */
  const scrollToListChapter = useCallback(
    (chapterId: string, focus: boolean) => {
      const summary = mapRef.current?.querySelector<HTMLElement>(`[data-chapter-id="${chapterId}"] summary`);
      if (!summary) return;
      // 先移焦點（不捲動），再用 scrollTo 定位：焦點不會把頁面或 sticky 區塊帶走（第 1 輪看圖驗收的 320 英文清單）
      if (focus) summary.focus({ preventScroll: true });
      const { top } = usable();
      window.scrollTo({ top: Math.max(0, summary.getBoundingClientRect().top + window.scrollY - (top + 16)), behavior: 'auto' });
    },
    [usable],
  );

  const selectLevel = useCallback(
    (levelId: string, el: HTMLButtonElement) => {
      openerRef.current = el;
      needLevelMeta(levelId);
      const prev = data ? previousLevelId(data, levelId) : null;
      if (prev) needLevelMeta(prev);
      openOverlay({ llOverlay: 'sheet', levelId });
    },
    [data, needLevelMeta, openOverlay],
  );

  // 打開時捲到目前關卡（?chapter= 讓該章章節牌露出；返回時交給瀏覽器還原）。進度和快照一起到，第一次就捲到真正的目前關卡；
  // ?from 先捲到剛做完的那一關（回饋從那裡開始播）
  const chapterParam = params.get('chapter');
  const listChapterId = chapterParam && data?.chapterById.has(chapterParam) ? chapterParam : null;
  useLayoutEffect(() => {
    if (!ready || !layout || list || scrolledOnce.current) return;
    scrolledOnce.current = true;
    if (listChapterId) {
      scrollToBanner(listChapterId, 'auto');
      return;
    }
    const fromParam = params.get('from');
    if (fromParam) {
      if (ready.data.levelById.has(fromParam)) scrollToLevel(fromParam, 'auto');
      return;
    }
    if (navType === 'POP' && sessionStorage.getItem(SCROLL_KEY)) return;
    const target = currentLevelId(ready.data, ready.progress);
    if (!target) return;
    scrollToLevel(target, 'auto');
    autoScroll.current = { levelId: target, y: window.scrollY };
  }, [ready, layout, list, params, navType, scrollToLevel, scrollToBanner, listChapterId]);
  // 第一屏附近的場景（維護者 2026-10-26）：第一次捲動定位之後量出視窗上下各一屏內的區段（和 ChapterScene 觀察器的範圍相同），
  // 透過 SceneReadyProvider 要求它們立刻載入；全部畫好才掀開布幕。只量一次：之後進入視窗的章由各自的觀察器載入。清單檢視沒有場景。
  // 返回（POP）時瀏覽器稍後才還原捲動位置：以記下的位置換算
  const [sceneEager, setSceneEager] = useState<ReadonlySet<SceneLayerKind> | null>(null);
  const [sceneLoaded, setSceneLoaded] = useState<ReadonlySet<SceneLayerKind>>(() => new Set());
  const onSceneLoaded = useCallback((kind: SceneLayerKind) => setSceneLoaded((s) => (s.has(kind) ? s : new Set(s).add(kind))), []);
  const sceneCtx = useMemo<SceneReadyState>(() => ({ eager: sceneEager, onLoaded: onSceneLoaded }), [sceneEager, onSceneLoaded]);
  useLayoutEffect(() => {
    if (!ready || !layout || sceneEager !== null) return;
    const set = new Set<SceneLayerKind>();
    if (!list) {
      const h = window.innerHeight;
      // 沒有記下位置時 getItem 是 null（Number(null) 是 0，不能直接轉）
      const saved = navType === 'POP' ? sessionStorage.getItem(SCROLL_KEY) : null;
      const shift = saved !== null && Number.isFinite(Number(saved)) ? Number(saved) - window.scrollY : 0;
      for (const svg of pageRef.current?.querySelectorAll<SVGSVGElement>('svg.qm-scene') ?? []) {
        const r = (svg.parentElement ?? svg).getBoundingClientRect();
        if (r.bottom - shift > -h && r.top - shift < 2 * h) set.add(svg.dataset['scene'] as SceneLayerKind);
      }
    }
    setSceneEager(set);
  }, [ready, layout, list, navType, sceneEager]);
  // 字級放大時 QuestMap 量到的卡片高度（宣告在第一次捲動定位之後：同一次 commit 裡先捲好，再換排版）。
  // 使用者還沒捲動（停在自動捲到的位置）時，換好排版後依新的幾何重新定位（下一個 effect）；捲動過了就記下目前關卡的位置、由 anchor 還原
  const cardRescroll = useRef<{ levelId: string; layout: typeof layout } | null>(null);
  useLayoutEffect(() => {
    const m = pendingCardSizes.current;
    if (!m) return;
    pendingCardSizes.current = null;
    const a = autoScroll.current;
    cardRescroll.current = a && Math.abs(window.scrollY - a.y) < 2 ? { levelId: a.levelId, layout } : null;
    if (!cardRescroll.current) {
      const id = currentIdRef.current;
      const el = id ? document.querySelector(`[data-level-id="${id}"] button`) : null;
      anchor.current = id && el ? { levelId: id, top: el.getBoundingClientRect().top } : null;
    }
    setCardSizes(m);
  }, [layout, ready]);
  useLayoutEffect(() => {
    const r = cardRescroll.current;
    // 換好排版之後的那一次 commit 才定位（同一次 commit 裡的這個 effect 還是舊排版）
    if (!r || r.layout === layout || list) return;
    cardRescroll.current = null;
    const id = r.levelId;
    scrollToLevel(id, 'auto');
    autoScroll.current = { levelId: id, y: window.scrollY };
  }, [layout, list, scrollToLevel]);
  // sticky 區塊的高度變了（地圖提示位置晚一步放進儲存層、更新或相機預覽的完整 Banner，375 時約 150px）：使用者還沒捲動、仍在地圖檢視時，
  // 依新的可用區（圖規 4.10，上緣是 sticky 區塊的實際下緣）重新定位，目前關卡與第一關的章節牌不會被長高的 sticky 區塊蓋住
  useEffect(() => {
    onStickyResize.current = () => {
      const a = autoScroll.current;
      if (!a) return;
      if (list || Math.abs(window.scrollY - a.y) >= 2) {
        autoScroll.current = null;
        return;
      }
      scrollToLevel(a.levelId, 'auto');
      autoScroll.current = { levelId: a.levelId, y: window.scrollY };
    };
  }, [list, scrollToLevel]);

  // 切換檢視（圖規 4.11）：切到清單時捲到目前章節（或 ?chapter=）並把焦點放在它的 summary；切回地圖時依 4.10 定位。第一次繪製就是清單時也一樣
  const listChapter = listChapterId ?? (currentId && data ? (data.levelById.get(currentId)?.chapterId ?? null) : (data?.chapters[0]?.id ?? null));
  const viewSwitched = useRef<boolean | null>(null);
  const listPositioned = useRef(false);
  useEffect(() => {
    if (!ready || !layout) return;
    const prev = viewSwitched.current;
    viewSwitched.current = list;
    if (list) {
      if (prev !== true) listPositioned.current = false;
      if (listPositioned.current) return;
      listPositioned.current = true;
      const focus = prev === false || viewSwitchedByUser.current;
      if (listChapter) requestAnimationFrame(() => scrollToListChapter(listChapter, focus));
    } else if (prev === true && currentId) {
      requestAnimationFrame(() => {
        scrollToLevel(currentId, 'auto');
        nodeButton(currentId)?.focus({ preventScroll: true });
      });
    }
  }, [list, ready, layout, listChapter, listChapterId, currentId, scrollToListChapter, scrollToLevel, nodeButton]);

  // 布幕：章節快照與進度（ready）、HUD 的數字（同一份進度）、清單檢視時全部關卡的名稱請求都結束、地圖檢視時第一屏附近的場景都畫好。
  // 錯誤與空狀態本身就是完整畫面。掀開之後不再放下（切到清單時名稱還沒到也不會整頁消失）
  const hasLevels = !!data && data.chapters.some((c) => c.levels.length > 0);
  const listReady = !!data && data.chapters.every((c) => c.levels.every((l) => metaDone.has(l.id)));
  const scenesReady = sceneEager !== null && [...sceneEager].every((k) => sceneLoaded.has(k));
  const readyNow = state.status === 'error' || (!!ready && (!hasLevels || (list ? listReady : scenesReady)));
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (readyNow) setRevealed(true);
  }, [readyNow]);
  usePageReady(revealed || readyNow);

  // 記錄捲動位置（02 第 5 節：返回時還原）
  useEffect(() => {
    const onScroll = () => sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ?from=<levelId>：星星依序點亮、角色沿路線走到下一關（跨章在拱門下停一下、紙籤與拱心石彈出）。布幕掀開之後才開始播，回饋不會在看不見時播掉一半。
  // 播放中途被取消（換頁、切到清單、視窗改寬、依賴改變）時：角色直接跳到終點、收尾照樣做（finding map-1）；清單檢視不播，直接收尾（finding map-2）
  useEffect(() => {
    if (!ready || !revealed || !layout || playedFrom.current) return;
    playedFrom.current = true;
    const fromParam = new URLSearchParams(window.location.search).get('from');
    const from = fromParam && ready.data.levelById.has(fromParam) ? fromParam : null;
    if (!from || !currentId || list) {
      setMarkerLevelId(currentId);
      setFromDone(true);
      return;
    }
    // 還沒做完就離開（lib/level-exit.ts）：角色與捲動放在那一關，顯示「已暫存」，不點星星、不播走路
    if (takeLeftUnfinished(from)) {
      setMarkerLevelId(from);
      scrollToLevel(from, 'auto');
      setLeftToast(true);
      setFromDone(true);
      return;
    }
    const ac = new AbortController();
    const reduced = prefersReducedMotion();
    const finish = (focus: boolean) => {
      setStarsOverride(null);
      setCelebrating(null);
      setMarkerLevelId(currentId);
      setMarkerLook({ pose: 'cheek', expression: 'smile' });
      setFromDone(true);
      if (focus) nodeButton(currentId)?.focus({ preventScroll: true });
    };
    (async () => {
      setMarkerLevelId(from);
      const target = starsOf(ready.progress, from);
      setStarsOverride({ levelId: from, stars: 0 });
      // 答對有星星時笑眼加星光、小小揮手；減少動態時表情不動（星光的閃爍由 CSS 停止）
      if (target > 0) setMarkerLook({ pose: 'wave', expression: 'joy' });
      scrollToLevel(from, 'auto');
      await wait(reduced ? 0 : 200);
      if (ac.signal.aborted) return finish(false);
      await new Promise<void>((resolve) => {
        if (target === 0) return resolve();
        const cancel = lightStars(
          target,
          (n) => {
            setStarsOverride({ levelId: from, stars: n });
            if (n === target) resolve();
          },
          reduced,
        );
        ac.signal.addEventListener(
          'abort',
          () => {
            cancel();
            resolve();
          },
          { once: true },
        );
      });
      if (ac.signal.aborted) return finish(false);
      await wait(reduced ? 0 : 250);
      if (ac.signal.aborted) return finish(false);
      const el = markerRef.current;
      if (el && from !== currentId) {
        const { walkPlan, walkTimeline, walkMarkerAlong } = await import('../features/quest-map/walk.ts');
        const plan = walkPlan(layout, from, currentId);
        if (plan && plan.legs.length > 0) {
          const timeline = walkTimeline(plan);
          const crosses = timeline.pauses.length > 0;
          const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth';
          // 跨章：先看著拱門，停頓時再捲到下一關；章內直接捲到下一關
          if (crosses) {
            const fromChapter = ready.data.levelById.get(from)!.chapterId;
            mapRef.current?.querySelector(`[data-chapter-id="${fromChapter}"] .ll-chend__arch`)?.scrollIntoView({ block: 'center', behavior });
          } else scrollToLevel(currentId, behavior);
          await walkMarkerAlong(el, timeline, {
            reduced,
            signal: ac.signal,
            onPause: (chapterId) => {
              setCelebrating(chapterId);
              setMarkerLook({ pose: 'clasp', expression: 'joy' });
              scrollToLevel(currentId, behavior);
            },
          });
        }
      }
      finish(!ac.signal.aborted);
    })();
    // 卸載、切換檢視、目前關卡或幾何改變時取消：角色直接到終點，await 正常結束，收尾照樣做（之後不再重播，playedFrom）
    return () => ac.abort();
    // 依賴故意不含 location 等會在播放中變的值（打開面板、移除 ?from 不取消播放）
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, revealed, layout, list, currentId]);
  // 播完（或取消、清單檢視）之後移除 ?from，保留當下的 location.state（半途打開的面板不會被關掉）
  useEffect(() => {
    if (!fromDone || !params.has('from')) return;
    navigate({ pathname: location.pathname, search: withParam(location.search, 'from', null) }, { replace: true, state: location.state as unknown });
  }, [fromDone, params, navigate, location.pathname, location.search, location.state]);

  // 徽章：依星星判定新取得的徽章（純函式），寫進進度（fixture 模式只顯示不寫入），顯示 Toast「取得徽章：○○」
  useEffect(() => {
    if (!ready || !fromDone || badgesChecked.current) return;
    badgesChecked.current = true;
    // 作答頁完成關卡時已經寫進進度的徽章（features/badges/award.ts）由 takeCelebrations 取回，照樣顯示 Toast；fixture 模式不取
    const isContent = ready.source === contentSource;
    const earned: EarnedBadge[] = mergeCelebrations(ready.data, earnedBadges(ready.data, ready.progress), isContent ? takeCelebrations() : []);
    if (earned.length === 0) return;
    setSessionBadges(earned.flatMap((e) => e.unlockIds));
    setBadgeToasts(
      earned.map((e) => ({
        id: e.chapterId,
        state: e.state,
        title: ready.data.chapterById.get(e.chapterId)?.badgeTitle ?? ready.data.chapterById.get(e.chapterId)?.title ?? '',
      })),
    );
    // 補寫一律走 awardChapterBadges：取得日期是關卡完成的時間，不是打開地圖的時間（finding map-3）
    if (isContent) void awardChapterBadges(locale);
  }, [ready, fromDone, locale]);
  // 提示被移除前，焦點如果在提示裡（按了關閉，或停在提示上後自動收起），先移回目前關卡的節點，不掉到 body（finding foundation-2 第 4 步）
  const releaseToastFocus = useCallback(() => {
    if (!(document.activeElement instanceof HTMLElement) || !document.activeElement.closest('.qm-toasts')) return;
    const id = currentIdRef.current;
    const target = id ? nodeButton(id) : null;
    if (target) target.focus({ preventScroll: true });
    else document.activeElement.blur();
  }, [nodeButton]);
  useEffect(() => {
    if ((badgeToasts.length === 0 && !leftToast) || toastHeld) return;
    const timer = setTimeout(() => {
      releaseToastFocus();
      setBadgeToasts([]);
      setLeftToast(false);
    }, BADGE_TOAST_MS);
    return () => clearTimeout(timer);
  }, [badgeToasts, leftToast, toastHeld, releaseToastFocus]);

  const locate = () => {
    if (!currentId) return;
    if (list) {
      const chapterId = data?.levelById.get(currentId)?.chapterId;
      if (chapterId) scrollToListChapter(chapterId, false);
      mapRef.current?.querySelector<HTMLElement>(`[data-level-id="${currentId}"] a, [data-level-id="${currentId}"] button`)?.focus({ preventScroll: true });
      return;
    }
    scrollToLevel(currentId, prefersReducedMotion() ? 'auto' : 'smooth');
    nodeButton(currentId)?.focus({ preventScroll: true });
  };
  // 從 HUD 打開的疊加層：關閉後焦點回到觸發它的按鈕（compact 是「更多」）
  const hudOpener = (id: string) => {
    const hud = stickyRef.current;
    overlayReturn.current =
      hud?.querySelector<HTMLElement>(`[data-testid="${id}"]:not([role="menuitem"])`) ?? hud?.querySelector<HTMLElement>('[data-testid="map-more"]') ?? null;
  };

  // 關卡介紹面板的內容
  const sheet: LevelSheetData | null = useMemo(() => {
    if (!data || !progress || !sheetLevelId) return null;
    const l = data.levelById.get(sheetLevelId);
    if (!l) return null;
    const c = data.chapterById.get(l.chapterId)!;
    const meta = metas.get(l.id);
    const objectives = meta ? meta.objectiveIds.map((id) => c.objectives.find((o) => o.id === id)?.statement).filter((s): s is string => !!s) : [];
    const best = progress.levels.get(l.id);
    const prev = previousLevelId(data, l.id);
    const prevLevel = prev ? data.levelById.get(prev) : undefined;
    const prevUndone = prevLevel !== undefined && !levelDone(progress, prevLevel);
    const prevTitle = prev ? metas.get(prev)?.title : undefined;
    return {
      levelId: l.id,
      title: meta?.title ?? '',
      subtitle: `${c.extension ? chapterLabels.extChapter(c.chapterNo) : chapterLabels.chapter(c.chapterNo)} ${c.title}`,
      chapterNo: c.chapterNo,
      levelNo: l.levelNo,
      extension: c.extension,
      status: levelStatus(l.id, levelDone(progress, l), currentId),
      objectives: objectives.map((o) => <Fragment key={o}>{o}</Fragment>),
      best: best && !l.unscored ? { stars: best.stars, accuracyText: formatPercent(best.bestScore, locale, { digits: 0 }) } : undefined,
      unscored: l.unscored,
      read: l.unscored ? levelRead(progress, l.id) : undefined,
      startHref: localePath(locale, `/level/${l.id}/`),
      chapterHref: localePath(locale, `/chapter/${c.id}/`),
      suggestedPrevTitle: prevUndone && prevTitle ? prevTitle : undefined,
      loading: !meta,
    };
  }, [data, progress, sheetLevelId, metas, locale, chapterLabels, currentId]);

  const showScan = useMemo(() => canOfferScan(isAppMode(), isInAppBrowser()), []);
  // 頂部的星星總數：?from 的星星還沒點亮之前先不算，點亮一顆加一顆，數字才會滾動（17 第 3.4 節）
  const hudStars = useMemo(() => {
    if (!progress) return 0;
    let n = totalStars(progress);
    const fromParam = params.get('from');
    if (starsOverride) n += starsOverride.stars - starsOf(progress, starsOverride.levelId);
    else if (!fromDone && fromParam && !list && progress.levels.has(fromParam)) n -= starsOf(progress, fromParam);
    return n;
  }, [progress, starsOverride, fromDone, params, list]);

  const toolList: MapHudTool[] = [
    {
      id: 'locate',
      icon: <LocateIcon />,
      label: t({ id: 'play.tool.locate', message: '跳到目前關卡', comment: '頂部工具：捲到目前關卡的按鈕' }),
      onClick: locate,
      'data-testid': 'map-locate',
    },
    {
      id: 'code',
      icon: <KeyboardIcon />,
      label: t({ id: 'play.tool.code', message: '輸入關卡代號', comment: '頂部工具：開啟關卡代號輸入的按鈕' }),
      onClick: () => {
        hudOpener('map-code');
        openOverlay({ llOverlay: 'code' });
      },
      opensOverlay: true,
      'data-testid': 'map-code',
    },
    ...(showScan
      ? [
          {
            id: 'scan',
            icon: <QrIcon />,
            label: t({ id: 'play.tool.scan', message: '掃描課堂 QR', comment: '頂部工具：開啟課堂 QR 掃描的按鈕' }),
            onClick: () => {
              hudOpener('map-scan');
              openScan();
            },
            opensOverlay: true,
            'data-testid': 'map-scan',
          } satisfies MapHudTool,
        ]
      : []),
    // 切換檢視是動作按鈕，不是切換鈕：在清單裡叫「地圖檢視」、畫地圖圖示；在地圖上叫「清單檢視」、畫清單圖示。不輸出 aria-pressed、不畫已按下外框（站規 2.2.1）
    {
      id: 'list',
      icon: list ? <MapIcon /> : <ListIcon />,
      label: list ? listLabels.map : listLabels.list,
      onClick: () => toggleList(!list),
      'data-testid': 'map-list-toggle',
    },
  ];
  // 錯誤與空狀態沒有工具（載入中整頁在布幕後面）
  const tools: MapHudTool[] = hasLevels ? toolList : [];

  // compact 時「跳到目前關卡」直接排開（圖規 4.8），三個統計膠囊加兩顆 44px 按鈕放不下時才收進「更多」：量統計膠囊的實際寬度
  // （數字變長時會變寬），加上格線間距與兩顆按鈕，和軌道寬比較。360 寬一定放得下；320 寬在數字很長時才收
  const [inlineTools, setInlineTools] = useState(1);
  useLayoutEffect(() => {
    const stats = stickyRef.current?.querySelector<HTMLElement>('.ll-hud__stats');
    const inner = stats?.closest<HTMLElement>('.ll-pagehead__inner');
    if (!stats || !inner || geo.bp !== 'compact') {
      setInlineTools(1);
      return;
    }
    const check = () => {
      const gap = parseFloat(getComputedStyle(inner).columnGap) || 8;
      const need = stats.getBoundingClientRect().width + 2 * gap + 2 * 44 + 4;
      setInlineTools(need <= geo.trackW + 0.5 ? 1 : 0);
    };
    check();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(check);
    ro?.observe(stats);
    return () => ro?.disconnect();
  }, [geo.bp, geo.trackW, ready]);

  const pageStyle = {
    '--qm-band-w': `${geo.bandW}px`,
    '--qm-track-w': `${geo.trackW}px`,
    '--qm-track-left': `${geo.trackLeft}px`,
    '--qm-list-w': `${geo.listW}px`,
  } as CSSProperties;

  return (
    <div ref={pageRef} className={`qm-page${list ? ' qm-page--list' : ''}`} style={pageStyle} data-bp={geo.bp}>
      {/* sticky 區塊（圖規 4.8、4.9）：頂部統計列加提示條。提示條由殼層的橫幅以 portal 放進 #ll-map-hint-slot（只有地圖頁有），一次一則 */}
      <div className="qm-sticky" ref={stickyRef}>
        <MapHud
          className="qm-hud"
          title={t({ id: 'play.map.title', message: '闖關', comment: '闖關地圖的頁面標題（頂部列中央）' })}
          stars={hudStars}
          badges={progress ? badgeCount(progress) : 0}
          due={progress?.due ?? 0}
          badgesHref={localePath(locale, '/me/badges/')}
          reviewHref={localePath(locale, '/review/')}
          // 布幕掀開之前數字直接換（HUD 在載入中就掛著，進度到了從 0 換成總數不是變化）；掀開之後的變化（?from 點亮星星、新徽章）才滾動
          animate={revealed}
          compact={geo.bp === 'compact'}
          inlineTools={inlineTools}
          tools={tools}
        />
        <div id="ll-map-hint-slot" className="qm-hint-slot" />
      </div>
      {state.status === 'error' && (
        <div className="qm-state">
          <ErrorState
            title={t({ id: 'play.error.title', message: '地圖載入失敗', comment: '闖關地圖讀不到內容時的標題' })}
            description={<Trans id="content.offlineMissing">這一頁還沒下載到這台裝置。連上網路後再試一次，已下載的內容現在也能繼續使用。</Trans>}
            onRetry={retry}
            action={
              <Button icon={<CardsIcon />} href={localePath(locale, '/terms/')}>
                {t({ id: 'play.toTerms', message: '先看名詞圖鑑', comment: '地圖載入失敗或還沒有關卡時，到名詞圖鑑的按鈕' })}
              </Button>
            }
          />
        </div>
      )}
      {ready && !hasLevels && (
        <div className="qm-state">
          <EmptyState
            title={t({ id: 'play.empty.title', message: '關卡準備中', comment: '內容快照還沒有關卡時的空狀態標題' })}
            description={
              // 「發布」整塊不斷（第 7 輪 handoff：320 與 375 斷成「發／布」）；EmptyState 不切詞，Phrased 會把切詞帶進地圖的 chunk
              <Trans id="play.empty.body" comment="空狀態說明；鈴是吉祥物的名字；<0> 是不換行的詞">
                鈴還在整理路線，關卡<span className="ll-nowrap">發布</span>後就會出現在這裡。
              </Trans>
            }
            action={
              <Button icon={<CardsIcon />} href={localePath(locale, '/terms/')}>
                {t({ id: 'play.toTerms', message: '先看名詞圖鑑', comment: '地圖載入失敗或還沒有關卡時，到名詞圖鑑的按鈕' })}
              </Button>
            }
          />
        </div>
      )}
      {ready && hasLevels && layout && list && (
        <div ref={mapRef}>
          <ListView
            locale={locale}
            data={ready.data}
            progress={ready.progress}
            metas={metas}
            currentId={currentId}
            onSelectLevel={selectLevel}
            onNeedMeta={needChapterMeta}
            openChapterId={listChapter}
            compact={geo.bp === 'compact'}
          />
        </div>
      )}
      {ready && hasLevels && layout && !list && (
        <SceneReadyProvider value={sceneCtx}>
          <QuestMap
            locale={locale}
            data={ready.data}
            layout={layout}
            progress={ready.progress}
            metas={metas}
            currentId={currentId}
            starsOverride={starsOverride}
            markerLevelId={markerLevelId}
            markerPose={markerLook.pose}
            markerExpression={markerLook.expression}
            markerRef={markerRef}
            mapRef={mapRef}
            celebratingChapterId={celebrating}
            onSelectLevel={selectLevel}
            onNeedMeta={needChapterMeta}
            onMeasureCards={onMeasureCards}
          />
        </SceneReadyProvider>
      )}
      {/* 取得徽章的提示：常駐的 ToastRegion（第一次繪製就在 DOM），位置在 sticky 區塊下方 8px */}
      <ToastRegion
        className="qm-toasts"
        data-testid={badgeToasts.length > 0 ? 'badge-toasts' : leftToast ? 'map-left-toast' : undefined}
        onHoldChange={setToastHeld}
      >
        {leftToast && (
          <Toast
            kind="info"
            onDismiss={() => {
              releaseToastFocus();
              setLeftToast(false);
            }}
          >
            {t({ id: 'level.leftToast', message: '已暫存，可隨時回來繼續', comment: '作答到一半按返回回到地圖時的提示（作答狀態已暫存，站規 2.4.1）' })}
          </Toast>
        )}
        {badgeToasts.map((item) => (
          <Toast
            key={item.id}
            kind="collect"
            media={<ChapterBadge state={item.state} size={34} />}
            title={
              item.state === 'mastery'
                ? t({ id: 'play.badge.masteryTitle', message: '取得精通徽章', comment: '章內每關三星時的提示標題；第二行是徽章名稱' })
                : t({ id: 'play.badge.gotTitle', message: '取得徽章', comment: '章內每關至少一星時的提示標題；第二行是徽章名稱' })
            }
            onDismiss={() => {
              releaseToastFocus();
              setBadgeToasts((list) => list.filter((x) => x.id !== item.id));
            }}
          >
            {item.title}
          </Toast>
        ))}
      </ToastRegion>
      <LevelSheet
        open={!!sheetLevelId && !!sheet}
        onClose={closeOverlay}
        level={sheet}
        returnFocusTo={openerRef}
        teacherExtra={
          sheetLevelId ? (
            <Suspense fallback={null}>
              <LevelQr levelId={sheetLevelId} locale={locale} />
            </Suspense>
          ) : null
        }
      />
      {overlaysMounted && (
        <Suspense fallback={null}>
          <LevelCodeOverlay
            open={overlay === 'code'}
            onClose={closeOverlay}
            locale={locale}
            data={data}
            source={ready?.source ?? contentSource}
            onNavigate={go}
            retiredChapterOf={progress?.retiredChapterOf}
            returnFocusTo={overlayReturn}
          />
          <ScanOverlay
            open={scanOpen}
            onClose={closeScan}
            scanner={QrScanner}
            onTarget={onScanTarget}
            returnFocusTo={overlayReturn}
            onUseCode={() =>
              navigate(
                { pathname: location.pathname, search: withParam(location.search, 'scan', null) },
                { replace: true, state: { llOverlay: 'code' } satisfies OverlayState },
              )
            }
          />
        </Suspense>
      )}
    </div>
  );
}
