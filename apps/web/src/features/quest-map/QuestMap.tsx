// 地圖本體（17 第 2、3、7、8 節）：每章一個 <section aria-labelledby>，章節牌是 h2，<ol> 裡 <li><button> 節點，SVG 路線，幾何場景，角色標記。
// DOM 順序第 1 章第 1 關在前；視覺由 CSS column-reverse 反轉。每章 content-visibility: auto，contain-intrinsic-size 用座標樣板算出的固定高度。
// 關卡名稱在關卡檔裡，章節進入視窗附近（前後一屏）時才向父層要求載入（onNeedMeta）。
import { useLingui } from '@lingui/react/macro';
import { useEffect, useRef, type CSSProperties, type RefObject } from 'react';
import { localePath, type Locale } from '@ledgerland/i18n';
import { ChapterBanner, ChapterEnd, LevelNode, MapMarker } from '@ledgerland/web-ui/map';
import { markerTransform, MARKER_SIZE } from './animation.ts';
import type { LevelMeta, QuestMapData } from './data.ts';
import { BANNER_HEIGHT, nodeMapPoint, routeSegments, type MapLayout } from './layout.ts';
import { levelStatus } from './ListView.tsx';
import { badgeUnlockId, chapterDone, starsOf, type MapProgress } from './progress.ts';
import { ChapterScene, sceneFor } from './scenes.tsx';

/** 路線 SVG 的虛擬寬度：x 比例乘上它，preserveAspectRatio="none" 加 non-scaling-stroke 讓線寬不隨寬度縮放 */
const VW = 1000;

export interface QuestMapProps {
  locale: Locale;
  data: QuestMapData;
  layout: MapLayout;
  progress: MapProgress;
  metas: ReadonlyMap<string, LevelMeta>;
  currentId: string | null;
  /** 播放星星點亮時暫時覆蓋顯示的星星數 */
  starsOverride?: { levelId: string; stars: 0 | 1 | 2 | 3 } | null;
  /** 角色目前站的關卡（播放移動時先站在上一關） */
  markerLevelId: string | null;
  markerRef: RefObject<SVGSVGElement | null>;
  mapRef: RefObject<HTMLDivElement | null>;
  celebratingChapterId: string | null;
  onSelectLevel: (levelId: string, el: HTMLButtonElement) => void;
  onNavigate: (href: string) => void;
  onNeedMeta: (chapterId: string) => void;
}

export function QuestMap(p: QuestMapProps) {
  const { t } = useLingui();
  const { data, layout, progress, metas, currentId, onNeedMeta, markerLevelId, markerRef, mapRef } = p;
  const sectionRefs = useRef(new Map<string, HTMLElement>());

  // 章節進入視窗前後一屏時載入關卡名稱（17 第 8 節）
  useEffect(() => {
    const sections = data.chapters.map((c) => sectionRefs.current.get(c.id)).filter((el): el is HTMLElement => !!el);
    if (typeof IntersectionObserver === 'undefined') {
      for (const el of sections) onNeedMeta(el.dataset.chapterId!);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) onNeedMeta((e.target as HTMLElement).dataset.chapterId!);
      },
      { rootMargin: '100% 0px 100% 0px' },
    );
    for (const el of sections) io.observe(el);
    return () => io.disconnect();
  }, [data, onNeedMeta]);

  // 角色的初始位置（沒有動畫時）：依地圖目前的寬度定位；寬度改變時重算
  useEffect(() => {
    const el = markerRef.current;
    const container = mapRef.current;
    if (!el || !container) return;
    const place = () => {
      if (!markerLevelId) return;
      const pt = nodeMapPoint(layout, markerLevelId, container.clientWidth);
      if (pt) el.style.transform = markerTransform(pt);
    };
    place();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    ro?.observe(container);
    return () => ro?.disconnect();
  }, [layout, markerLevelId, markerRef, mapRef]);

  // 建議順序中的全域序號：路線「已走」與「未走」以目前關卡的序號切分
  const firstIndexOf = new Map<string, number>();
  let currentIndex = -1;
  {
    let i = 0;
    for (const c of data.chapters) {
      firstIndexOf.set(c.id, i);
      for (const l of c.levels) {
        if (l.id === currentId) currentIndex = i;
        i++;
      }
    }
  }

  return (
    <div className="qm-map" ref={mapRef} style={{ height: layout.totalHeight }} data-testid="quest-map">
      {layout.chapters.map((cl) => {
        const c = data.chapterById.get(cl.chapterId)!;
        const headingId = `qm-h-${c.id}`;
        const { done, total } = chapterDone(data, progress, c.id);
        const segs = routeSegments(cl, VW);
        const firstIndex = firstIndexOf.get(c.id)!;
        const style: CSSProperties = { height: cl.height, containIntrinsicSize: `auto ${cl.height}px` };
        const gap =
          layout.extensionGap && layout.extensionGap.offset === cl.offset + cl.height ? (
            <div className="qm-gap" key={`gap-${c.id}`} data-testid="extension-gap">
              <svg className="qm-gap__sea" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <path d="M0 60 q50 -20 100 0 t100 0 t100 0 t100 0 V200 H0Z" fill="var(--ll-element-asset-tint)" />
                <rect x="150" y="40" width="100" height="16" rx="8" fill="var(--ll-element-expense-tint)" />
              </svg>
              <p className="qm-gap__text">
                {t({ id: 'play.extensionGap', message: '延伸區：不列入期中考，想多學再來', comment: '主線與延伸區之間的分隔文字' })}
              </p>
            </div>
          ) : null;
        return (
          <FragmentWithGap key={c.id} gap={gap}>
            <section
              className={`qm-ch qm-ch--${cl.template}`}
              aria-labelledby={headingId}
              style={style}
              data-chapter-id={c.id}
              data-testid="map-chapter"
              ref={(el) => {
                if (el) sectionRefs.current.set(c.id, el);
                else sectionRefs.current.delete(c.id);
              }}
            >
              <ChapterScene kind={sceneFor(c.chapterNo, c.extension)} />
              <svg className="qm-route" viewBox={`0 0 ${VW} ${cl.height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
                {segs.map((s, i) => {
                  const toIndex = s.toLevelId === null ? firstIndex + c.levels.length : firstIndex + c.levels.findIndex((l) => l.id === s.toLevelId);
                  const walked = currentIndex >= 0 && toIndex <= currentIndex;
                  return <path key={i} className={`qm-route__seg ${walked ? 'qm-route__seg--walked' : 'qm-route__seg--ahead'}`} d={s.d} />;
                })}
              </svg>
              <ChapterBanner
                className="qm-ch__banner"
                chapterId={c.id}
                chapterNo={c.chapterNo}
                title={c.title}
                done={done}
                total={total}
                extension={c.extension}
                badgeTitle={c.badgeTitle}
                badgeUnlocked={progress.badges.has(badgeUnlockId(c.id))}
                href={localePath(p.locale, `/chapter/${c.id}/`)}
                onNavigate={p.onNavigate}
                headingId={headingId}
              />
              <ol className="qm-ch__nodes" style={{ height: cl.nodesHeight }}>
                {cl.nodes.map((n) => {
                  const l = data.levelById.get(n.levelId)!;
                  const stars = p.starsOverride?.levelId === l.id ? p.starsOverride.stars : starsOf(progress, l.id);
                  return (
                    <LevelNode
                      key={l.id}
                      levelId={l.id}
                      chapterNo={c.chapterNo}
                      levelNo={l.levelNo}
                      title={metas.get(l.id)?.title}
                      stars={stars}
                      status={levelStatus(l.id, starsOf(progress, l.id), currentId)}
                      extension={c.extension}
                      onSelect={p.onSelectLevel}
                      style={{ left: `${n.x * 100}%`, bottom: n.y }}
                    />
                  );
                })}
              </ol>
              <ChapterEnd
                className="qm-ch__end"
                chapterNo={c.chapterNo}
                extension={c.extension}
                completed={total > 0 && done === total}
                badgeTitle={c.badgeTitle}
                celebrating={p.celebratingChapterId === c.id}
              />
            </section>
          </FragmentWithGap>
        );
      })}
      <MapMarker className={`qm-marker${markerLevelId ? '' : ' is-hidden'}`} size={MARKER_SIZE} style={{ transform: `translate(0px, ${-BANNER_HEIGHT}px)` }} />
      <MarkerRefBridge markerRef={markerRef} mapRef={mapRef} />
    </div>
  );
}

/** 章節區段之後接延伸區分隔（DOM 順序在該章之後，column-reverse 後視覺在它上方） */
function FragmentWithGap({ children, gap }: { children: React.ReactNode; gap: React.ReactNode }) {
  return (
    <>
      {children}
      {gap}
    </>
  );
}

/** MapMarker 不收 ref，所以掛載後從容器找出角色元素交給父層 */
function MarkerRefBridge({ markerRef, mapRef }: { markerRef: RefObject<SVGSVGElement | null>; mapRef: RefObject<HTMLDivElement | null> }) {
  useEffect(() => {
    markerRef.current = mapRef.current?.querySelector<SVGSVGElement>('.qm-marker') ?? null;
  });
  return null;
}
