// 闖關地圖 /play/（17）：由下往上的關卡路線、頂部統計、右側工具列、關卡介紹表單、清單檢視；?chapter= 捲到該章、?from= 播放過關後的移動與點亮。
// 疊加層（關卡表單、代號輸入、掃描）不是路由，但各加一筆歷史紀錄（02 第 2 節）：表單與代號用 location.state，掃描用 ?scan=1。
import { Trans, useLingui } from '@lingui/react/macro';
import { lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router';
import { formatPercent, localePath } from '@ledgerland/i18n';
import { Banner, EmptyState, ErrorState, Skeleton } from '@ledgerland/web-ui';
import { LevelSheet, MapHud, useChapterLabels, type LevelSheetData } from '@ledgerland/web-ui/map';
import { lightStars, prefersReducedMotion, wait, walkMarker } from '../features/quest-map/animation.ts';
import { contentSource } from '../features/quest-map/data.ts';
import { layoutMap, nodeMapPoint } from '../features/quest-map/layout.ts';
import { LevelCodeOverlay } from '../features/quest-map/LevelCodeOverlay.tsx';
import { ListView } from '../features/quest-map/ListView.tsx';
import { MapToolbar } from '../features/quest-map/MapToolbar.tsx';
import { currentLevelId, previousLevelId, starsOf, totalStars } from '../features/quest-map/progress.ts';
import { parseSiteQr } from '../features/quest-map/qr-url.ts';
import { QuestMap } from '../features/quest-map/QuestMap.tsx';
import { canOfferScan, ScanOverlay } from '../features/quest-map/ScanOverlay.tsx';
import { fixtureRequestFrom, useQuestMap } from '../features/quest-map/useQuestMap.ts';
import { isAppMode, isInAppBrowser } from '../lib/env.ts';
import { readPref, writePref } from '../lib/prefs.ts';
import { useLocale } from '../lib/useLocale.ts';
import { site } from '../../site.config.ts';
import '../styles/quest-map.css';

// 掃描畫面（相機與解碼器）是獨立 chunk，按「開始掃描」才載入（02 第 4.7 節）
const QrScanner = lazy(() => import('../features/quest-map/QrScanner.tsx'));

const VIEW_KEY = 'll:map-view';
const SCROLL_KEY = 'll:map-scroll';

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

export default function Play() {
  const locale = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const navType = useNavigationType();
  const { t } = useLingui();
  const chapterLabels = useChapterLabels();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const req = useMemo(() => fixtureRequestFrom(location.search), [location.search]);
  const { state, metas, needChapterMeta, needLevelMeta } = useQuestMap(locale, req);
  const ready = state.status === 'ready' ? state : null;
  const data = ready?.data ?? null;
  const progress = ready?.progress ?? null;
  const layout = useMemo(
    () => (data ? layoutMap(data.chapters.map((c) => ({ id: c.id, levelIds: c.levels.map((l) => l.id), extension: c.extension }))) : null),
    [data],
  );
  const currentId = data && progress ? currentLevelId(data, progress) : null;

  const [list, setList] = useState(() => readPref(VIEW_KEY) === 'list');
  const toggleList = (v: boolean) => {
    setList(v);
    writePref(VIEW_KEY, v ? 'list' : null);
  };

  const mapRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<SVGSVGElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [markerLevelId, setMarkerLevelId] = useState<string | null>(null);
  const [starsOverride, setStarsOverride] = useState<{ levelId: string; stars: 0 | 1 | 2 | 3 } | null>(null);
  const [celebrating, setCelebrating] = useState<string | null>(null);
  const playedFrom = useRef(false);
  const scrolledOnce = useRef(false);

  // 疊加層狀態：表單與代號用 history state，掃描用 ?scan=1
  const ovState = (location.state ?? null) as OverlayState | null;
  const overlay = ovState?.llOverlay ?? null;
  const sheetLevelId = overlay === 'sheet' ? (ovState?.levelId ?? null) : null;
  const scanOpen = params.get('scan') === '1';
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
  // 課堂 QR（06 第 4.9 節）：只接受正式 origin 或目前 origin 的關卡、章節、故事步驟網址；符合就先 stripLocale 再以目前介面語言導覽並帶 ?via=qr，
  // 不符合回 false（掃描畫面顯示「這不是 LedgerLand 的課堂 QR」），絕不開啟站外網址
  const onScanResult = useCallback(
    (text: string) => {
      const target = parseSiteQr(text, { origin: window.location.origin, allowedOrigins: [site.productionOrigin] });
      if (!target) return false;
      navigate(`${localePath(locale, target.path)}?via=qr`);
      return true;
    },
    [locale, navigate],
  );

  const nodeButton = useCallback((levelId: string) => mapRef.current?.querySelector<HTMLButtonElement>(`[data-level-id="${levelId}"] button`) ?? null, []);
  const scrollToLevel = useCallback(
    (levelId: string, behavior: ScrollBehavior) => nodeButton(levelId)?.scrollIntoView({ block: 'center', behavior }),
    [nodeButton],
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

  // 打開時捲到目前關卡（?chapter= 捲到該章；返回時交給瀏覽器還原）
  useEffect(() => {
    if (!ready || !layout || list || scrolledOnce.current) return;
    scrolledOnce.current = true;
    const chapterId = params.get('chapter');
    if (chapterId && ready.data.chapterById.has(chapterId)) {
      mapRef.current?.querySelector(`[data-chapter-id="${chapterId}"] .qm-ch__banner`)?.scrollIntoView({ block: 'center' });
      return;
    }
    if (params.get('from')) return;
    if (navType === 'POP' && sessionStorage.getItem(SCROLL_KEY)) return;
    if (currentId) scrollToLevel(currentId, 'auto');
  }, [ready, layout, list, params, navType, currentId, scrollToLevel]);

  // 記錄捲動位置（02 第 5 節：返回時還原）
  useEffect(() => {
    const onScroll = () => sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ?from=<levelId>：星星依序點亮、角色沿路走到下一關（跨章先在章末區顯示完成），播完移除參數
  useEffect(() => {
    if (!ready || !layout || list || playedFrom.current) return;
    playedFrom.current = true;
    const fromParam = params.get('from');
    const from = fromParam && ready.data.levelById.has(fromParam) ? fromParam : null;
    if (!from || !currentId) {
      setMarkerLevelId(currentId);
      return;
    }
    let cancelled = false;
    const reduced = prefersReducedMotion();
    const clear = () =>
      navigate({ pathname: location.pathname, search: withParam(location.search, 'from', null) }, { replace: true, state: location.state as unknown });
    (async () => {
      setMarkerLevelId(from);
      const target = starsOf(ready.progress, from);
      setStarsOverride({ levelId: from, stars: 0 });
      scrollToLevel(from, 'auto');
      await wait(reduced ? 0 : 200);
      await new Promise<void>((resolve) => {
        if (target === 0) return resolve();
        lightStars(
          target,
          (n) => {
            setStarsOverride({ levelId: from, stars: n });
            if (n === target) resolve();
          },
          reduced,
        );
      });
      if (cancelled) return;
      await wait(reduced ? 0 : 250);
      const fromChapter = ready.data.levelById.get(from)!.chapterId;
      const toChapter = ready.data.levelById.get(currentId)!.chapterId;
      if (fromChapter !== toChapter) {
        setCelebrating(fromChapter);
        mapRef.current
          ?.querySelector(`[data-chapter-id="${fromChapter}"] .qm-ch__end`)
          ?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
        await wait(reduced ? 0 : 900);
        setCelebrating(null);
      }
      if (cancelled) return;
      const el = markerRef.current;
      const container = mapRef.current;
      if (el && container && from !== currentId) {
        const w = container.clientWidth;
        const a = nodeMapPoint(layout, from, w);
        const b = nodeMapPoint(layout, currentId, w);
        if (a && b) {
          scrollToLevel(currentId, reduced ? 'auto' : 'smooth');
          await walkMarker(el, a, b, reduced);
        }
      }
      if (cancelled) return;
      setStarsOverride(null);
      setMarkerLevelId(currentId);
      nodeButton(currentId)?.focus({ preventScroll: true });
      clear();
    })();
    return () => {
      cancelled = true;
    };
    // playedFrom 擋住重播：之後 location 變化（移除 ?from）不會再進來
  }, [ready, layout, list, currentId, params, navigate, location.pathname, location.search, location.state, scrollToLevel, nodeButton]);

  const locate = () => {
    if (!currentId) return;
    if (list) {
      mapRef.current?.querySelector<HTMLElement>(`[data-level-id="${currentId}"]`)?.scrollIntoView({ block: 'center' });
      return;
    }
    scrollToLevel(currentId, prefersReducedMotion() ? 'auto' : 'smooth');
    nodeButton(currentId)?.focus({ preventScroll: true });
  };

  // 關卡介紹表單的內容
  const sheet: LevelSheetData | null = useMemo(() => {
    if (!data || !progress || !sheetLevelId) return null;
    const l = data.levelById.get(sheetLevelId);
    if (!l) return null;
    const c = data.chapterById.get(l.chapterId)!;
    const meta = metas.get(l.id);
    const objectives = meta ? meta.objectiveIds.map((id) => c.objectives.find((o) => o.id === id)?.statement).filter((s): s is string => !!s) : [];
    const best = progress.levels.get(l.id);
    const prev = previousLevelId(data, l.id);
    const prevUndone = prev !== null && starsOf(progress, prev) === 0;
    const prevTitle = prev ? metas.get(prev)?.title : undefined;
    return {
      levelId: l.id,
      title: meta?.title ?? '',
      subtitle: `${c.extension ? chapterLabels.extChapter(c.chapterNo) : chapterLabels.chapter(c.chapterNo)} ${c.title}`,
      objectives,
      best: best ? { stars: best.stars, accuracyText: formatPercent(best.bestScore, locale, { digits: 0 }) } : undefined,
      startHref: localePath(locale, `/level/${l.id}/`),
      chapterHref: localePath(locale, `/chapter/${c.id}/`),
      suggestedPrevTitle: prevUndone && prevTitle ? prevTitle : undefined,
      loading: !meta,
    };
  }, [data, progress, sheetLevelId, metas, locale, chapterLabels]);

  const showScan = useMemo(() => canOfferScan(isAppMode(), isInAppBrowser()), []);
  const hasLevels = !!data && data.chapters.some((c) => c.levels.length > 0);

  return (
    <div className={`qm-page${list ? ' qm-page--list' : ''}`}>
      <MapHud
        className="qm-hud"
        title={t({ id: 'play.map.title', message: '闖關', comment: '闖關地圖的頁面標題（頂部列中央）' })}
        stars={progress ? totalStars(progress) : 0}
        badges={progress ? progress.badges.size : 0}
        due={progress ? progress.due : 0}
        starsHref={localePath(locale, '/me/')}
        badgesHref={localePath(locale, '/me/')}
        reviewHref={localePath(locale, '/review/')}
        onNavigate={go}
      />
      {hasLevels && (
        <MapToolbar
          list={list}
          onToggleList={toggleList}
          onLocate={locate}
          onCode={() => openOverlay({ llOverlay: 'code' })}
          onScan={openScan}
          showScan={showScan}
        />
      )}
      {state.status === 'loading' && (
        <div aria-busy="true" className="qm-map">
          <p className="ll-muted">
            {t({ id: 'play.loading', message: '鈴正在整理路線，關卡馬上就會出現。', comment: '地圖資料載入中的提示；鈴是吉祥物的名字' })}
          </p>
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      )}
      {state.status === 'error' && (
        <>
          <Banner kind="warning" role="alert">
            <Trans id="content.offlineMissing">這一頁還沒下載到這台裝置。連上網路後再試一次，已下載的內容現在也能繼續使用。</Trans>
          </Banner>
          <ErrorState title={t({ id: 'play.error.title', message: '地圖載入失敗', comment: '闖關地圖讀不到內容時的標題' })} />
        </>
      )}
      {ready && !hasLevels && (
        <EmptyState
          title={t({ id: 'play.empty.title', message: '關卡準備中', comment: '內容快照還沒有關卡時的空狀態標題' })}
          description={t({ id: 'play.empty.body', message: '鈴還在整理路線，關卡發布後就會出現在這裡。', comment: '空狀態說明；鈴是吉祥物的名字' })}
        />
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
            onNavigate={go}
            onNeedMeta={needChapterMeta}
            openChapterId={currentId ? (ready.data.levelById.get(currentId)?.chapterId ?? null) : null}
          />
        </div>
      )}
      {ready && hasLevels && layout && !list && (
        <QuestMap
          locale={locale}
          data={ready.data}
          layout={layout}
          progress={ready.progress}
          metas={metas}
          currentId={currentId}
          starsOverride={starsOverride}
          markerLevelId={markerLevelId}
          markerRef={markerRef}
          mapRef={mapRef}
          celebratingChapterId={celebrating}
          onSelectLevel={selectLevel}
          onNavigate={go}
          onNeedMeta={needChapterMeta}
        />
      )}
      <LevelSheet open={!!sheetLevelId && !!sheet} onClose={closeOverlay} level={sheet} onNavigate={go} returnFocusTo={openerRef} />
      <LevelCodeOverlay
        open={overlay === 'code'}
        onClose={closeOverlay}
        locale={locale}
        data={data}
        source={ready?.source ?? contentSource}
        onNavigate={go}
        retiredChapterOf={progress?.retiredChapterOf}
      />
      <ScanOverlay
        open={scanOpen}
        onClose={closeScan}
        scanner={QrScanner}
        onResult={onScanResult}
        onUseCode={() =>
          navigate(
            { pathname: location.pathname, search: withParam(location.search, 'scan', null) },
            { replace: true, state: { llOverlay: 'code' } satisfies OverlayState },
          )
        }
      />
    </div>
  );
}
