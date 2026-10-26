// 地圖本體（17 第 2、3、7、8 節，圖規第 1 到 4、6 節）：每章一個 <section aria-labelledby>，章節牌是 h2，<ol> 裡 <li><button> 節點，
// 真實 px 的路線 svg（路邊、路面、已走實線、未走圓點），章末拱門與紙籤，第 1 章的起點石，主線與延伸區之間的海峽（棧橋與唯一一張延伸說明卡），角色鈴。
// 幾何全部來自 layout.ts（layoutMap 算好的 px，區帶座標：從視窗左緣量起，含 rail 下方）；區段全幅出血，元件都絕對定位在區段裡。
// DOM 順序第 1 章第 1 關在前；視覺由 CSS column-reverse 反轉。每章 content-visibility: auto，contain-intrinsic-size 等於區段高度。
// 層次（圖規第 3 節）：地景底色與接縫 0、場景物件 1（拱門的地面陰影與棧橋也在這一層，DOM 順序在場景之後）、路線 2、起點小旗與章末 3、節點 4、章節牌 5；
// 角色在地圖容器裡 2（區段之上）。
// 關卡名稱在關卡檔裡，章節進入視窗附近（前後一屏）時才向父層要求載入（onNeedMeta）。
import { useLingui } from '@lingui/react/macro';
import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, type CSSProperties, type Ref } from 'react';
import { localePath, type Locale } from '@ledgerland/i18n';
import { ChapterBanner, ChapterEnd, LevelNode, MapMarker, phrased, useChapterLabels, type MarkerExpression, type MarkerPose } from '@ledgerland/web-ui/map';
import { availableEndLinks, type LevelMeta, type QuestMapData } from './data.ts';
import {
  GROUND,
  markerAt,
  markerTransform,
  MARKER_SIZE,
  PIER,
  PROTECT_PAD,
  sceneGeo,
  type ChapterLayout,
  type MapGeometry,
  type QuestMapLayout,
  type RouteSegment,
  type StraitLayout,
} from './layout.ts';
import { levelStatus } from './ListView.tsx';
import { badgeStateFor, chapterDone, levelDone, starsOf, type MapProgress } from './progress.ts';
import { ChapterScene, sceneFor } from './scenes.tsx';
import { foamPath, isWater, SCENE_TERRAIN, SEAM_DOTS, SEAM_SVG, seamFill, seamMid, seamPaths, seamY, STRAIT_TERRAIN, type Terrain } from './terrain.ts';

export interface QuestMapProps {
  locale: Locale;
  data: QuestMapData;
  layout: QuestMapLayout;
  progress: MapProgress;
  metas: ReadonlyMap<string, LevelMeta>;
  currentId: string | null;
  /** 播放星星點亮時暫時覆蓋顯示的星星數 */
  starsOverride?: { levelId: string; stars: 0 | 1 | 2 | 3 } | null;
  /** 角色目前站的關卡（播放移動時先站在上一關） */
  markerLevelId: string | null;
  /** 角色的姿勢與表情（播放過關回饋時由頁面切換） */
  markerPose?: MarkerPose;
  markerExpression?: MarkerExpression;
  markerRef: Ref<SVGSVGElement>;
  mapRef: Ref<HTMLDivElement>;
  celebratingChapterId: string | null;
  /** 場景不等進入視窗就載入（截圖用） */
  eagerScenes?: boolean;
  onSelectLevel: (levelId: string, el: HTMLButtonElement) => void;
  onNeedMeta: (chapterId: string) => void;
  /**
   * 字級放大時量到的章節牌卡片與紙籤高度（每章，px，取整）：有變化時才呼叫。Play 帶回 layoutMap 收緊章節牌區與章末區（layout.ts 的 fitZones）
   */
  onMeasureCards?: (sizes: ReadonlyMap<string, CardSize>) => void;
}

/** 一章的章節牌卡片與紙籤高度 */
export interface CardSize {
  readonly bannerH?: number;
  readonly plaqueH?: number;
}

/** 一段區段（章節或海峽）在 DOM 裡的樣子：上方那一段的地景（接縫要填它的顏色） */
interface SectionInfo {
  terrain: Terrain;
  above: Terrain | null;
}

const px = (n: number) => `${Math.round(n * 10) / 10}px`;

/**
 * 會把物件畫過接縫、再照 SceneGeo.seam 蓋回填色的場景（第 10 章的岩坡一路畫到頂端、第 2 章最後一座島伸出區段頂端）：上方是海時，
 * 海岸畫在填色區裡（波浪上方），會被場景蓋回的填色蓋掉，所以在場景之後（同一層、DOM 順序在後）再畫一次海岸，地景層那一份不畫（不疊兩次）。
 * 第 1 章的碼頭場景刻意把接縫鋪成沙地（和第 2 章的沙灘接成一片），不在這裡
 */
const SEAM_REPAINTED: ReadonlySet<string> = new Set(['summit', 'islands']);

/**
 * 頂端接縫（terrain.ts 的 seamFill）：波浪以上填上方那一段的底色；陸地同色時畫一條石緣線，海接同一種海時什麼都不畫（第 5 輪看圖驗收：
 * 延伸各章之間橫跨全幅的浪花線和運河兩岸接成一直線，強化分格感）；最上面那一段填 --ll-bg。
 * 海接另一種深淺的海（seamFill 的 blend）只出現在 fixture 的第 2 章頂端接海峽：兩種海直接以波浪相接、不畫浪花線（開闊海面上的浪花線沒有地理意義），
 * 島不越過接縫、沿波浪收出自己的北岸（scene-islands 的 endIsle），所以也不在 SEAM_REPAINTED 之後重畫海岸；正式內容沒有這種接縫，地景層不另外畫漸層（地圖 chunk 的預算）
 * 海接陸時沿波浪在海那一側畫海岸（淺灘帶加浪花線）；陸接陸時波浪下方是上方那一章底色的圓點（每 12px 一顆的圖樣），三排越往下越淡。
 * over：只畫海岸（場景蓋回接縫之後再畫一次，見 SEAM_REPAINTED）
 */
function Seam({
  bandW,
  seed,
  terrain,
  above,
  over,
  coastOver,
}: {
  bandW: number;
  seed: number;
  terrain: Terrain;
  above: Terrain | null;
  over?: boolean;
  /** 海岸由場景之後的那一份畫（over），這一份不畫 */
  coastOver?: boolean;
}) {
  const shape = seamFill(bandW, seed, terrain, above);
  const pid = `qm-sd${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  // 海接另一種深淺的海（blend）：海面中間不畫浪花線，岸由伸到接縫的島自己收（scene-islands 的 endIsle）
  const coast = shape?.coast &&
    !shape.blend && [<path key="s" className="qm-seam__shallow" d={shape.coast.shallow} />, <path key="f" className="qm-seam__foam" d={shape.coast.foam} />];
  if (!shape && isWater(terrain)) return null;
  return (
    <svg
      className={`qm-seam${over ? ' qm-seam--over' : ''}`}
      width={bandW}
      height={SEAM_SVG}
      viewBox={`0 0 ${bandW} ${SEAM_SVG}`}
      aria-hidden="true"
      focusable="false"
      data-above={above ?? 'top'}
    >
      {over ? (
        coast
      ) : !shape ? (
        <path className="qm-seam__line" d={seamPaths(bandW, seed).line} />
      ) : (
        <>
          {shape.dots.length > 0 && (
            <pattern id={pid} width={SEAM_DOTS.gap} height={SEAM_DOTS.gap} patternUnits="userSpaceOnUse">
              <circle cx={SEAM_DOTS.gap / 2} cy={SEAM_DOTS.gap / 2} r={SEAM_DOTS.r} style={{ fill: shape.fill }} />
            </pattern>
          )}
          {shape.dots.map((d, i) => (
            <path key={i} d={d} fill={`url(#${pid})`} opacity={SEAM_DOTS.rows[i]} />
          ))}
          <path className="qm-seam__fill" d={shape.d} style={{ fill: shape.fill }} />
          {!coastOver && coast}
        </>
      )}
    </svg>
  );
}

/**
 * 路線四層（圖規 4.3）：先畫全部路邊、再畫全部路面，最後是已走實線與未走圓點，就算兩段路碰在一起也只會融成同一條路。
 * 路邊與路面用平頭線帽：區段交界處上下兩半平接，不會在下一章的路面上畫出圓頭的 U 形弧線；兩端是節點的那一頭本來就被蓋住。
 * 路線的起點（第 1 章）與終點（最後一章的拱門中心）另外補圓頭。海峽也畫路邊（第 2 輪看圖驗收：北岸沙灘上的那一截路沒有路邊，像被切斷）。
 * 已走實線與未走圓點在節點端已經裁好（layout.ts 的 line 與 dots），不會畫進圓盤。
 */
function Route({
  bandW,
  h,
  segments,
  walked,
  roundEnds,
}: {
  bandW: number;
  h: number;
  segments: readonly RouteSegment[];
  walked: (s: RouteSegment) => boolean;
  /** 路線在區段裡開始或結束的點（第 1 章的起點、最後一章的拱門中心，y 向上）：補圓頭 */
  roundEnds?: readonly { x: number; y: number }[];
}) {
  return (
    <svg className="qm-route" width={bandW} height={h} viewBox={`0 0 ${bandW} ${h}`} aria-hidden="true" focusable="false">
      <g className="qm-route__edge">
        {segments.map((s, i) => (
          <path key={i} d={s.d} />
        ))}
        {roundEnds?.map((p, i) => (
          <circle key={i} cx={p.x} cy={h - p.y} r={10} />
        ))}
      </g>
      <g className="qm-route__road">
        {segments.map((s, i) => (
          <path key={i} d={s.d} />
        ))}
        {roundEnds?.map((p, i) => (
          <circle key={i} cx={p.x} cy={h - p.y} r={9} />
        ))}
      </g>
      <g className="qm-route__line">
        {segments.map((s, i) => {
          const w = walked(s);
          return w ? (
            <path key={i} d={s.line.d} className="qm-route__walked" data-walked="true" />
          ) : (
            // pathLength 多 0.01：最後一顆圓點落在路徑終點前一點點，瀏覽器才不會把剛好在終點的零長度圓點略過（海峽頂端少半顆圓點）
            <path key={i} d={s.dots.d} pathLength={s.dots.pathLength + 0.01} className="qm-route__ahead" data-walked="false" />
          );
        })}
      </g>
    </svg>
  );
}

/**
 * 第 1 章的起點（第 2 輪看圖驗收）：路線從圓頭開始，旁邊（入口走廊外側）立一根 4 × 20 的木樁，頂端一面 24 × 16 的燕尾旗朝外飄，腳下一小片影子。
 * 和章末的三角旗同一套顏色（scene-wood、scene-roof、scene-line）。
 */
function StartFlag({ bandW, h, flag }: { bandW: number; h: number; flag: NonNullable<ChapterLayout['startFlag']> }) {
  const { stake, cloth, side } = flag;
  const sx = (stake.x0 + stake.x1) / 2;
  const top = h - cloth.y1;
  const notch = 5;
  // 旗面：從木樁那一側開始，遠端是燕尾缺口
  const near = side === 'left' ? cloth.x1 : cloth.x0;
  const far = side === 'left' ? cloth.x0 : cloth.x1;
  const dir = side === 'left' ? 1 : -1;
  const d = `M${near} ${top}H${far}l${dir * notch} ${(cloth.y1 - cloth.y0) / 2}l${-dir * notch} ${(cloth.y1 - cloth.y0) / 2}H${near}Z`;
  return (
    <svg className="qm-stone" width={bandW} height={h} viewBox={`0 0 ${bandW} ${h}`} aria-hidden="true" focusable="false" data-testid="map-start">
      <ellipse className="qm-stone__shadow" cx={sx} cy={h - stake.y0} rx={8} ry={2.5} />
      <rect className="qm-stone__stake" x={stake.x0} y={h - stake.y1} width={stake.x1 - stake.x0} height={stake.y1 - stake.y0} rx={1} />
      <path className="qm-stone__flag" d={d} />
    </svg>
  );
}

/**
 * 海峽南端的棧橋延伸（畫在海峽下面那一章的頂端，越過接縫的水面與海岸再多 8px），木板與繩索接續海峽裡的棧橋，末端一對繩柱。
 * 長度是接縫波浪在棧橋 x 的高度（terrain.ts 的 seamY，和 Seam 同一個種子與中線）再多 8px：上端從沙岸開始（場景畫），
 * 兩端都只壓進陸地 8px（第 5 輪：原本固定到波浪最低處 + 8，波谷處會伸進陸地約 28px）。
 * 甲板、繩索與木板線的 x 和海峽的棧橋相同，甲板是直角（第 6 輪看圖驗收：原本的 2px 圓角在和海峽棧橋接合的那一列兩側各缺一角）
 */
function PierStub({ bandW, x, seed, mid }: { bandW: number; x: number; seed: number; mid: number }) {
  const h = Math.ceil(seamY(x, seed, mid) + 8);
  const ropeL = x - PIER.halfW - PIER.ropeW + 2;
  const ropeR = x + PIER.halfW + PIER.ropeW - 2;
  return (
    <svg className="qm-strait__pier qm-pierstub" width={bandW} height={h} viewBox={`0 0 ${bandW} ${h}`} aria-hidden="true" focusable="false">
      <rect className="qm-strait__deck" x={x - PIER.halfW} y={0} width={PIER.halfW * 2} height={h} />
      {Array.from({ length: Math.ceil((h - 4) / 12) }, (_, i) => 6 + 12 * i).map((y) => (
        <path key={y} className="qm-strait__plank" d={`M${x - PIER.halfW} ${y}h${PIER.halfW * 2}`} />
      ))}
      <path className="qm-strait__rope" d={`M${ropeL - PIER.ropeW / 2} 0V${h - 6}M${ropeR + PIER.ropeW / 2} 0V${h - 6}`} />
      <g className="qm-strait__post">
        <rect x={ropeL - PIER.ropeW} y={h - 12} width={PIER.ropeW} height={10} rx={1.5} />
        <rect x={ropeR} y={h - 12} width={PIER.ropeW} height={10} rx={1.5} />
      </g>
    </svg>
  );
}

function Strait({
  strait,
  g,
  above,
  walked,
  currentId,
  eager,
}: {
  strait: StraitLayout;
  g: MapGeometry;
  above: Terrain | null;
  walked: (s: RouteSegment) => boolean;
  currentId: string | null;
  eager?: boolean;
}) {
  const bandW = g.bandW;
  const { t } = useLingui();
  const labels = useChapterLabels();
  const h = strait.height;
  const pier = strait.pierRect;
  // 兩條浪線，避開棧橋與說明卡（保護框）
  const card = strait.plaqueRect;
  const foam = [Math.round(h * 0.3), Math.round(h * 0.7)].map((yUp) => {
    const holes = [
      [pier.x0 - PROTECT_PAD.strait, pier.x1 + PROTECT_PAD.strait],
      ...(yUp > card.y0 - PROTECT_PAD.strait && yUp < card.y1 + PROTECT_PAD.strait ? [[card.x0 - PROTECT_PAD.strait, card.x1 + PROTECT_PAD.strait]] : []),
    ].sort((a, b) => a[0]! - b[0]!);
    const spans: [number, number][] = [];
    let x = 0;
    for (const [a, b] of holes) {
      if (a! > x) spans.push([x, a!]);
      x = Math.max(x, b!);
    }
    if (x < bandW) spans.push([x, bandW]);
    return spans.map(([a, b]) => foamPath(a, b, h - yUp, strait.offset)).join(' ');
  });
  const planks: number[] = [];
  for (let y = 6; y < h; y += 12) planks.push(y);
  const posts: number[] = [];
  for (let y = 24; y < h - 8; y += 48) posts.push(y);
  const ropeL = pier.x0 + 2;
  const ropeR = pier.x1 - 2;
  return (
    <div
      className="qm-strait"
      data-testid="extension-gap"
      data-terrain={STRAIT_TERRAIN}
      style={{ height: h, containIntrinsicSize: `auto ${h}px` } as CSSProperties}
    >
      <div className="qm-terrain" aria-hidden="true">
        <Seam bandW={bandW} seed={strait.offset} terrain={STRAIT_TERRAIN} above={above} />
        <svg className="qm-strait__sea" width={bandW} height={h} viewBox={`0 0 ${bandW} ${h}`} aria-hidden="true" focusable="false">
          {foam.map((d, i) => (d ? <path key={i} className="qm-strait__foam" d={d} /> : null))}
        </svg>
      </div>
      <svg className="qm-strait__pier" width={bandW} height={h} viewBox={`0 0 ${bandW} ${h}`} aria-hidden="true" focusable="false">
        <rect className="qm-strait__deck" x={strait.x - PIER.halfW} y={0} width={PIER.halfW * 2} height={h} />
        {planks.map((y) => (
          <path key={y} className="qm-strait__plank" d={`M${strait.x - PIER.halfW} ${y}h${PIER.halfW * 2}`} />
        ))}
        <path className="qm-strait__rope" d={`M${ropeL - PIER.ropeW / 2} 0V${h}M${ropeR + PIER.ropeW / 2} 0V${h}`} />
        {posts.map((y) => (
          <g key={y} className="qm-strait__post">
            <rect x={ropeL - PIER.ropeW} y={y - 5} width={PIER.ropeW} height={10} rx={1.5} />
            <rect x={ropeR} y={y - 5} width={PIER.ropeW} height={10} rx={1.5} />
          </g>
        ))}
      </svg>
      {/* 海峽的物件層（兩翼的帆船、礁石、浮標與海面亮點，quest-map-scenes/scene-strait.tsx）：畫在棧橋之後（同一層，DOM 順序在後），
          延伸第 1 章的沙灘與淺灘會蓋住棧橋的上端，和延伸章之間的棧橋一樣；海面物件不會碰到棧橋（保護框多 12），保護框與兩翼由 sceneGeo 給 */}
      <ChapterScene
        kind="strait"
        geo={{ ...sceneGeo(strait, g), seam: seamFill(bandW, strait.offset, STRAIT_TERRAIN, above) }}
        currentLevelId={currentId}
        eager={eager}
      />
      <Route bandW={bandW} h={h} segments={[strait.segment]} walked={walked} />
      <div className="qm-strait__card" style={{ left: px(card.x0), bottom: px(card.y0), width: px(card.x1 - card.x0) }}>
        {/* 標題依詞換行（phrased 加 .ll-phrased，全站換行規則）；說明句照全站規則（窄卡片時縮成 caption 字級，一行放得下） */}
        <p className="qm-strait__title ll-phrased">
          {phrased(t({ id: 'play.extensionGap', message: '延伸區：不列入期中考，想多學再來', comment: '主線與延伸區之間的分隔文字' }))}
        </p>
        <p className="qm-strait__note" data-testid="exam-scope-note">
          {labels.examScopeNote}
        </p>
      </div>
    </div>
  );
}

export function QuestMap(p: QuestMapProps) {
  const { data, layout, progress, metas, currentId, onNeedMeta, markerLevelId, mapRef, markerRef } = p;
  const g = layout.geometry;
  const sectionRefs = useRef(new Map<string, HTMLElement>());

  // 字級放大時量每章章節牌與紙籤的實際高度（第 5 輪看圖驗收：200% 中文的紙籤和下一章章節牌之間隔約 140px 的空路）。
  // 區段有 content-visibility，畫面外的那幾章靠 getBoundingClientRect 強迫排版（只在字級放大時、排版變了才量）；量不到（0）時那一章照最大高度排
  const reported = useRef('');
  const { onMeasureCards } = p;
  useLayoutEffect(() => {
    if (g.fontScale <= 1 || !onMeasureCards) return;
    const sizes = new Map<string, CardSize>();
    for (const { chapterId: id } of layout.chapters) {
      const h = (sel: string) => {
        const r = sectionRefs.current.get(id)?.querySelector<HTMLElement>(sel)?.getBoundingClientRect().height ?? 0;
        return r > 0 ? Math.ceil(r) : undefined;
      };
      sizes.set(id, { bannerH: h('.qm-ch__banner'), plaqueH: h('.ll-chend__plaque') });
    }
    const key = JSON.stringify([...sizes]);
    if (key === reported.current) return;
    reported.current = key;
    onMeasureCards(sizes);
  }, [layout, g.fontScale, onMeasureCards]);

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

  // 建議順序中的全域序號：路線「已走」與「未走」以目前關卡的序號切分；toLevelId 是 null 的最後一段在全部完成時才算已走
  const { orderOf, currentIndex, allDone } = useMemo(() => {
    const orderOf = new Map<string, number>();
    let i = 0;
    let all = true;
    for (const c of data.chapters)
      for (const l of c.levels) {
        orderOf.set(l.id, i++);
        if (!levelDone(progress, l)) all = false;
      }
    return { orderOf, currentIndex: currentId ? (orderOf.get(currentId) ?? -1) : -1, allDone: all && i > 0 };
  }, [data, progress, currentId]);
  const walked = (s: RouteSegment) => {
    if (allDone) return true;
    if (currentIndex < 0 || s.toLevelId === null) return false;
    const k = orderOf.get(s.toLevelId);
    return k !== undefined && k <= currentIndex;
  };

  // 每一段的地景與上方那一段的地景（DOM 順序是由下往上；海峽插在第一個延伸章之前）
  const kinds = layout.chapters.map((cl) => {
    const c = data.chapterById.get(cl.chapterId)!;
    return sceneFor(c.chapterNo, c.extension);
  });
  const info = new Map<string, SectionInfo>();
  const order: Terrain[] = [];
  layout.chapters.forEach((cl, i) => {
    if (layout.strait && layout.strait.beforeIndex === i) order.push(STRAIT_TERRAIN);
    order.push(SCENE_TERRAIN[kinds[i]!]);
  });
  {
    let k = 0;
    layout.chapters.forEach((cl, i) => {
      if (layout.strait && layout.strait.beforeIndex === i) k++;
      info.set(cl.chapterId, { terrain: order[k]!, above: order[k + 1] ?? null });
      k++;
    });
  }
  const straitAbove = layout.strait ? (info.get(layout.chapters[layout.strait.beforeIndex]!.chapterId)?.terrain ?? null) : null;

  const marker = markerLevelId ? markerAt(layout, markerLevelId) : null;
  const ext = data.chapters.some((c) => c.extension);

  // 第 1 章的地景往下延伸成地圖底部的地面（起點石與章節牌立柱站在地上，Tab bar 底下也是地景，不是直線切口加紙色）
  const groundTerrain = layout.chapters[0] ? (info.get(layout.chapters[0].chapterId)?.terrain ?? null) : null;
  // 第 1 章的場景也往下延伸 GROUND（第 3 輪看圖驗收：起點下方 184px 是一條什麼都沒有的沙地）：同一份構圖畫成兩張 svg，
  // 區段裡畫 0 到區段高，地面裡畫剩下的 GROUND（區段有 content-visibility 的繪製裁切，一張 svg 畫不出區段）
  const sceneGeoOf = (cl: ChapterLayout, i: number) => {
    const si = info.get(cl.chapterId)!;
    return { ...sceneGeo(cl, g, i === 0 && groundTerrain ? GROUND : 0), seam: seamFill(g.bandW, cl.seed, si.terrain, si.above) };
  };
  const first = layout.chapters[0];
  const groundScene = first && groundTerrain ? { kind: kinds[0]!, geo: sceneGeoOf(first, 0), y: first.height } : null;

  return (
    <>
      <div className="qm-map" ref={mapRef} style={{ height: layout.totalHeight }} data-testid="quest-map" data-bp={g.bp}>
        {layout.chapters.map((cl, i) => {
          const c = data.chapterById.get(cl.chapterId)!;
          const headingId = `qm-h-${c.id}`;
          const { done, total } = chapterDone(data, progress, c.id);
          const badgeState = badgeStateFor(data, progress, c.id);
          const si = info.get(c.id)!;
          const kind = kinds[i]!;
          // 場景拿得到同一條接縫（scene-summit 的岩坡要照抄，不必讀 DOM）；第 1 章的場景延伸到地面，這裡只畫區段裡的那一段
          const geo = sceneGeoOf(cl, i);
          const coastOver = SEAM_REPAINTED.has(kind) && !!geo.seam?.coast && !geo.seam.blend && si.above !== null && isWater(si.above);
          const yE = cl.height - cl.endZone;
          return (
            <Fragment key={c.id}>
              <section
                className={`qm-ch qm-ch--${cl.template}`}
                aria-labelledby={headingId}
                style={{ height: cl.height, containIntrinsicSize: `auto ${cl.height}px` }}
                data-chapter-id={c.id}
                data-terrain={si.terrain}
                data-testid="map-chapter"
                ref={(el) => {
                  if (el) sectionRefs.current.set(c.id, el);
                  else sectionRefs.current.delete(c.id);
                }}
              >
                <div className="qm-terrain" aria-hidden="true">
                  <Seam bandW={g.bandW} seed={cl.seed} terrain={si.terrain} above={si.above} coastOver={coastOver} />
                </div>
                <ChapterScene
                  kind={kind}
                  geo={geo}
                  view={geo.h > cl.height ? { y: 0, h: cl.height } : undefined}
                  currentLevelId={currentId}
                  eager={p.eagerScenes}
                />
                {coastOver && <Seam bandW={g.bandW} seed={cl.seed} terrain={si.terrain} above={si.above} over />}
                {/* 海峽正下方那一章：棧橋越過這一章頂端的接縫（水面）再延伸 8px，南端落在地上（第 2 輪看圖驗收） */}
                {layout.strait && ext && layout.strait.beforeIndex === i + 1 && (
                  <PierStub bandW={g.bandW} x={layout.strait.x} seed={cl.seed} mid={seamMid(si.terrain, si.above)} />
                )}
                <Route
                  bandW={g.bandW}
                  h={cl.height}
                  segments={cl.segments}
                  walked={walked}
                  roundEnds={[...(cl.startStone ? [cl.startStone] : []), ...(cl.last ? [cl.archCenter] : [])]}
                />
                {cl.startFlag && <StartFlag bandW={g.bandW} h={cl.height} flag={cl.startFlag} />}
                <ChapterBanner
                  className="qm-ch__banner"
                  chapterId={c.id}
                  chapterNo={c.chapterNo}
                  title={c.title}
                  done={done}
                  total={total}
                  extension={c.extension}
                  inExam={c.inExam}
                  href={localePath(p.locale, `/chapter/${c.id}/`)}
                  headingId={headingId}
                  compact={g.bp === 'compact'}
                  // 字級放大時卡片比保留的最大高度矮很多：改成貼齊章節牌區的上緣（空白留在卡片下方的地上），第一關與整張章節牌才放得進同一屏
                  style={
                    g.fontScale > 1
                      ? { left: px(cl.bannerRect.x0), top: px(cl.height - cl.bannerRect.y1), width: px(cl.bannerRect.x1 - cl.bannerRect.x0) }
                      : { left: px(cl.bannerRect.x0), bottom: px(cl.bannerRect.y0), width: px(cl.bannerRect.x1 - cl.bannerRect.x0) }
                  }
                />
                <ol className="qm-ch__nodes">
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
                        status={levelStatus(l.id, levelDone(progress, l), currentId)}
                        extension={c.extension}
                        unscored={l.unscored}
                        read={levelDone(progress, l)}
                        onSelect={p.onSelectLevel}
                        style={{ left: px(n.x), bottom: px(n.y) }}
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
                  badgeState={badgeState}
                  last={cl.last}
                  celebrating={p.celebratingChapterId === c.id}
                  labLinks={availableEndLinks(data, c).map((l) => ({ href: localePath(p.locale, `/lab/story/${l.story}/${l.step}/`) }))}
                  style={{ height: cl.endZone }}
                  archStyle={{ left: px(cl.archRect.x0), bottom: px(cl.archRect.y0 - yE) }}
                  // 字級放大時紙籤貼齊章末區上緣（layout 的 plaqueRect 已改成貼頂的最大範圍），下面一根立在地上的長柱子（stakeRect）：
                  // 紙籤和下一章的章節牌仍是上下相鄰的一組路牌（第 4 輪看圖驗收：200% 時兩者相隔約 270px）
                  plaqueStyle={
                    g.fontScale > 1
                      ? { left: px(cl.plaqueRect.x0), top: px(cl.height - cl.plaqueRect.y1), width: px(cl.plaqueRect.x1 - cl.plaqueRect.x0) }
                      : { left: px(cl.plaqueRect.x0), bottom: px(cl.plaqueRect.y0 - yE), width: px(cl.plaqueRect.x1 - cl.plaqueRect.x0) }
                  }
                  postStyle={
                    g.fontScale > 1 ? { left: px(cl.stakeRect.x0), bottom: px(cl.stakeRect.y0 - yE), top: px(cl.height - cl.stakeRect.y1) } : undefined
                  }
                />
              </section>
              {/* 海峽在 DOM 裡排在主線最後一章之後（column-reverse 後在它上方） */}
              {layout.strait && ext && layout.strait.beforeIndex === i + 1 && (
                <Strait strait={layout.strait} g={g} above={straitAbove} walked={walked} currentId={currentId} eager={p.eagerScenes} />
              )}
            </Fragment>
          );
        })}
        <MapMarker
          ref={markerRef}
          className={`qm-marker${marker ? '' : ' is-hidden'}`}
          pose={p.markerPose}
          expression={p.markerExpression}
          size={MARKER_SIZE}
          grounded
          style={{ transform: marker ? markerTransform(marker) : undefined }}
        />
      </div>
      {groundTerrain && (
        <div className="qm-ground" data-terrain={groundTerrain} aria-hidden="true" data-testid="map-ground">
          {groundScene && (
            <ChapterScene
              kind={groundScene.kind}
              geo={groundScene.geo}
              view={{ y: groundScene.y, h: GROUND }}
              currentLevelId={currentId}
              eager={p.eagerScenes}
            />
          )}
        </div>
      )}
    </>
  );
}
