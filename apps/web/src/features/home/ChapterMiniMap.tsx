// 首頁的目前章節小地圖（站規 1.16、map-geometry 第 5 節）：用地圖頁同一套幾何（trackGeometry：沒有 rail 與兩翼），
// 排整張地圖再取目前這一章，入口側與路線樣板才會和地圖頁一樣。只畫地景底色、路線（路邊、路面、已走、未走）、第 1 章的起點石、節點與站在下一關的鈴；
// 章節牌、拱門、紙籤與場景物件不畫（卡片本身就是說明）。整塊 aria-hidden、不可點（點擊由外層 NavCard 的連結處理）。
// 這個模組靠 import() 在第一次繪製之後才載入（useHomeData），地圖的 chunk 不排在首頁的 LCP 前面；寬度改變時重算。
// 取景（minimap-frame.ts，第 1 輪看圖驗收）：節點不切一半；有進度時前一關、目前關、下一關都入鏡，新使用者從起點石開始；
// 放不下時整張縮小（viewBox 放大），節點、鈴與起點石維持固定的 px 大小。軌道左右各留 EDGE，光暈離卡片邊緣至少 16px。
// 卡片比 MINI_TRACK_MAX 寬時軌道置中（svg 的 viewBox 往左平移），兩側只鋪地景。
// 節點的狀態和地圖頁的 LevelNode 同一套（第 2 輪看圖驗收）：完成是實心強調色、下方有三顆星的星星籤；目前關是淡色內圈加強調色外圈、
// 上面站著鈴；還沒過的是 surface 底加 border-strong 邊。星星籤與鈴是疊在 svg 上的 HTML（固定 px，不跟著縮放）。
import { useLingui } from '@lingui/react/macro';
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ProgressBar, StarIcon } from '@ledgerland/web-ui';
import { MapMarker } from '@ledgerland/web-ui/map';
import { layoutMap, trackGeometry, type ChapterLayout, type RouteSegment } from '../quest-map/layout.ts';
import { sceneFor } from '../quest-map/scenes.tsx';
import { SCENE_TERRAIN } from '../quest-map/terrain.ts';
import { PhrasedParts } from '../me/PhrasedParts.tsx';
import { useLevelCodeFormatter } from './codes.ts';
import type { HomeQuest } from './home-quest.ts';
import { LAYOUT_MAX, MINI, frameMiniMap } from './minimap-frame.ts';

/**
 * 小地圖卡的說明（站規 1.16，第 4 輪看圖驗收改）。有進度時是這一章的進度：進度條 sm、「2／3 關」與星星數，和寬版主卡的「這一章的進度」
 * 同一組數字與字串（首頁傳進來，不新增字串；主卡第二行已經寫下一關的關名，這裡不再重複）。螢幕閱讀器念「這一章的進度 2／3 關 這一章的星星 4／9 顆」；
 * 整章不計分（滿星數 0）時不畫星星；1024 起主卡已有同一組進度，home.css 把這段隱藏，卡片只留章名。
 * 新使用者（主卡第二行是介紹）寫第一關的關名（依詞換行，home-quest.ts 切好的 titleParts；第 9 輪：200% 的「誰／的錢」），螢幕閱讀器多念「下一關」；
 * 全部完成時寫「全部關卡都完成了」。
 * 放在這個 lazy 模組裡，首頁首次載入的 JS 不增加。
 */
export function MiniMapDesc({
  quest,
  title,
  levels,
  stars,
  starsLabel,
}: {
  quest: HomeQuest;
  title: string;
  levels: string;
  stars: string;
  starsLabel: string;
}) {
  const { t } = useLingui();
  const { state, progress } = quest;
  if (state === 'allDone') return t({ id: 'home.minimap.allDone', message: '全部關卡都完成了', comment: '首頁章節小地圖卡的說明（所有關卡都完成）' });
  if (state === 'new')
    return (
      <>
        <span className="ll-sr-only">
          {t({ id: 'home.minimap.nextLabel', message: '下一關：', comment: '首頁章節小地圖卡說明前只給螢幕閱讀器的字，後面接關卡名' })}
        </span>
        <PhrasedParts text={quest.next.title} parts={quest.next.titleParts} />
      </>
    );
  return (
    <span className="ll-home-mmprog" data-testid="home-minimap-progress">
      <span className="ll-sr-only">{title}</span>
      <ProgressBar size="sm" value={progress.done} max={progress.total || 1} className="ll-home-mmprog__bar" />
      <span className="ll-home-mmprog__text ll-num">{levels}</span>
      {progress.maxStars > 0 && (
        <span className="ll-home-mmprog__text ll-home-mmprog__stars ll-num">
          <StarIcon filled size={16} />
          <span aria-hidden="true">{stars}</span>
          <span className="ll-sr-only">{starsLabel}</span>
        </span>
      )}
    </span>
  );
}

/** 小地圖的高度（CSS 的 .ll-minimap 同值；元件以量到的高度為準） */
export const MINI_MAP_HEIGHT = 240;
/** 軌道最寬 420（含左右的 EDGE）：卡片比這個寬時（768 的單欄）軌道置中、兩側只有地景，路線不會散在整條寬帶上 */
export const MINI_TRACK_MAX = 420;
/** 軌道左右各內縮 16：節點的光暈離卡片邊緣至少 16px */
const EDGE = 16;

/** 這一章的地景底色：和地圖頁同一張表（terrain.ts 的 SCENE_TERRAIN，圖規 6.4） */
export function terrainOf(chapterNo: number, extension: boolean): string {
  return SCENE_TERRAIN[sceneFor(chapterNo, extension)];
}

/** 一段路線算不算已走：走到的關卡在建議順序中不晚於目前關卡；最後一段（toLevelId 為 null）在全部完成時才算 */
function walked(seg: RouteSegment, quest: HomeQuest): boolean {
  if (seg.toLevelId === null) return quest.state === 'allDone';
  const to = quest.order.get(seg.toLevelId);
  const cur = quest.order.get(quest.next.levelId);
  return to !== undefined && cur !== undefined && to <= cur;
}

/** 節點下方畫星星籤：完成的計分關卡（不計分關卡沒有星等） */
function hasStars(quest: HomeQuest, levelId: string): boolean {
  return quest.done.has(levelId) && !quest.unscored.has(levelId);
}

function chapterOf(quest: HomeQuest, trackW: number): ChapterLayout | null {
  return layoutMap(quest.chapters, trackGeometry(trackW)).chapters.find((c) => c.chapterId === quest.chapter.id) ?? null;
}

export default function ChapterMiniMap({ quest }: { quest: HomeQuest }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: MINI_MAP_HEIGHT });
  const code = useLevelCodeFormatter();
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: Math.round(el.clientWidth), h: Math.round(el.clientHeight) || MINI_MAP_HEIGHT });
    measure();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  const { w: width, h: H } = size;
  const trackPx = Math.min(width, MINI_TRACK_MAX) - 2 * EDGE;
  const view = useMemo(() => {
    if (trackPx <= 0) return null;
    // 節點的 y 只由垂直常數決定（和軌道寬無關）：先用原寬排一次求取景，縮小時再用「軌道寬 ÷ 縮放」（最多 LAYOUT_MAX）排一次，縮小後路線仍盡量撐滿軌道
    const base = chapterOf(quest, trackPx);
    if (!base) return null;
    const frame = frameMiniMap({
      nodes: base.nodes.map((n) => ({ levelId: n.levelId, y: n.y, stars: hasStars(quest, n.levelId) })),
      chapterHeight: base.height,
      stoneY: base.startStone?.y ?? null,
      currentId: quest.next.levelId,
      fromStart: quest.state === 'new',
      height: H,
    });
    const layoutW = frame.zoom === 1 ? trackPx : Math.max(trackPx, Math.min(trackPx / frame.zoom, LAYOUT_MAX));
    const ch = layoutW === trackPx ? base : chapterOf(quest, layoutW);
    return ch ? { ch, frame, layoutW } : null;
  }, [trackPx, H, quest]);
  const levelNoOf = (id: string) => quest.chapters.find((c) => c.id === quest.chapter.id)?.levelIds.indexOf(id) ?? -1;
  const terrain = terrainOf(quest.chapter.chapterNo, quest.chapter.extension);
  if (!view)
    return (
      <div
        ref={box}
        className="ll-minimap"
        data-terrain={terrain}
        style={{ '--mm-ground': `var(--ll-scene-${terrain})` } as CSSProperties}
        data-testid="home-minimap-art"
      />
    );
  const { ch, frame, layoutW } = view;
  const z = frame.zoom;
  /** 軌道左緣在卡片中的 px（縮小後的軌道置中） */
  const dx = (width - layoutW * z) / 2;
  /** 畫面 px 換成 svg 的使用者單位（viewBox 縮放 z） */
  const u = (px: number) => px / z;
  const current = ch.nodes.find((n) => n.levelId === quest.next.levelId);
  const end = ch.last ? ch.archCenter : null;
  return (
    <div
      ref={box}
      className="ll-minimap"
      data-terrain={terrain}
      style={{ '--mm-ground': `var(--ll-scene-${terrain})` } as CSSProperties}
      data-testid="home-minimap-art"
      data-zoom={z}
    >
      <svg
        className="ll-minimap__svg"
        width={width}
        height={H}
        viewBox={`${-u(dx)} ${ch.height - frame.top} ${u(width)} ${u(H)}`}
        style={{ '--mm-z': z } as CSSProperties}
        aria-hidden="true"
        focusable="false"
      >
        {/* 路邊與路面是平頭（區段交界上下兩半平接，和地圖頁一樣）；最後一章在拱門中心補圓頭。
            已走實線用完整的 d（端點收在不透明的圓盤底下，小地圖的圓盤比地圖小，用裁過的 line.d 會在圓盤外留一段空白）；
            未走圓點用裁過的 dots.d，圓點不會畫進圓盤（pathLength 多 0.01，終點那一顆才不會被略過） */}
        <g className={`ll-minimap__route${z < 0.6 ? ' is-far' : ''}`}>
          {ch.segments.map((s, i) => (
            <path key={`e${i}`} className="ll-minimap__edge" d={s.d} />
          ))}
          {end && <circle className="ll-minimap__edge" cx={end.x} cy={ch.height - end.y} r={u(8)} />}
          {ch.segments.map((s, i) => (
            <path key={`r${i}`} className="ll-minimap__road" d={s.d} />
          ))}
          {end && <circle className="ll-minimap__road" cx={end.x} cy={ch.height - end.y} r={u(7)} />}
          {ch.segments.map((s, i) =>
            walked(s, quest) ? (
              <path key={`w${i}`} className="ll-minimap__walked" d={s.d} />
            ) : (
              <path key={`w${i}`} className="ll-minimap__ahead" d={s.dots.d} pathLength={s.dots.pathLength + 0.01} />
            ),
          )}
        </g>
        {ch.startStone && <circle className="ll-minimap__stone" cx={ch.startStone.x} cy={ch.height - ch.startStone.y} r={u(MINI.stoneR)} />}
        {ch.nodes.map((n) => {
          const state = n.levelId === quest.next.levelId && quest.state !== 'allDone' ? 'current' : quest.done.has(n.levelId) ? 'done' : 'todo';
          const cy = ch.height - n.y;
          return (
            <g key={n.levelId} className={`ll-minimap__node is-${state}`} data-level-id={n.levelId}>
              {state === 'current' && (
                <>
                  {/* 外圈以「圓盤加底邊」這塊實體為中心（往下半個底邊），圓盤才不會看起來偏在外圈下方；地圖頁的節點同一個做法（2026-10-26） */}
                  <circle className="ll-minimap__ring" cx={n.x} cy={cy + u(MINI.ledge) / 2} r={u(MINI.nodeR + MINI.halo - 1)} />
                  <circle className="ll-minimap__halo" cx={n.x} cy={cy + u(MINI.ledge) / 2} r={u(MINI.nodeR + 2)} />
                </>
              )}
              <circle className="ll-minimap__ledge" cx={n.x} cy={cy + u(MINI.ledge)} r={u(MINI.nodeR)} />
              <circle className="ll-minimap__disc" cx={n.x} cy={cy} r={u(MINI.nodeR)} />
              <text className="ll-minimap__num" x={n.x} y={cy}>
                {code(quest.chapter.chapterNo, levelNoOf(n.levelId) + 1, quest.chapter.extension)}
              </text>
            </g>
          );
        })}
      </svg>
      {ch.nodes
        .filter((n) => hasStars(quest, n.levelId))
        .map((n) => {
          const got = quest.stars.get(n.levelId) ?? 0;
          return (
            <span
              key={n.levelId}
              className="ll-minimap__stars"
              data-stars={got}
              style={{
                left: Math.round(dx + n.x * z - MINI.starsW / 2),
                top: Math.round((frame.top - n.y) * z + MINI.nodeR + MINI.ledge + MINI.starsGap),
              }}
            >
              {[0, 1, 2].map((i) => (
                <StarIcon key={i} size={MINI.star} filled={i < got} className={i < got ? 'is-on' : 'is-off'} />
              ))}
            </span>
          );
        })}
      {current && (
        <MapMarker
          pose="wave"
          size={MINI.bell}
          grounded
          className="ll-minimap__bell"
          style={{
            left: Math.round(dx + current.x * z - MINI.bell / 2),
            top: Math.round((frame.top - current.y) * z - MINI.bellStand - MINI.bell),
          }}
        />
      )}
    </div>
  );
}
