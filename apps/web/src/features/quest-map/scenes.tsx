// 章節場景（17 第 4、6、8 節，圖規第 6 節）：主線 10 章各一個場景、延伸區 4 章各一座外海小島，另加延伸區海峽的海面層；全部用 scene tokens 上色、沒有文字、純裝飾（aria-hidden）。
// 每個場景是 features/quest-map-scenes/ 底下自己的模組，章節區段進入視窗前後一屏時才 import()（17 第 8 節：場景 SVG 依章 lazy 載入）；
// 放在 quest-map 的隔壁目錄是因為 vite.config.ts 的 quest-map 群組會把 features/quest-map/ 底下的模組全部併成地圖的 chunk，場景要各自成 chunk 才能依章載入。
// 離線時全部在 precache。體積由 tools/budget.mjs 的 sceneChunkGzipKb、sceneChunksTotalGzipKb 與 sceneKitGzipKb 檢查。強制色彩下整個隱藏（quest-map.css）。
// 物件層（圖規第 6.1、6.2 節）：外層 svg 是真實 px（viewBox 0 0 bandW h，不用 slice），場景元件收到 SceneGeo（layout.ts 的 sceneGeo：
// 區帶座標、y 向下、已外擴的保護框與兩翼），直接畫在這個座標系裡。
// 全部改寫完成（2026-10-25）：主線第 1 到 10 章（scene-dock、islands、market、scale、river、lighthouse、gears、farm、bakery、summit）、
// 延伸區四座小島（scene-isle-*，共用 scene-isle-kit）與海峽（scene-strait）。各章共用的放置器、地形塊與小物件在 quest-map-scenes/scene-kit.tsx
// （延後載入的共用 chunk，預算 sceneKitGzipKb）；改寫一章的範本是 scene-dock.tsx（構圖純函式 planX 加畫法）。
// 場景 chunk 載入失敗時改成什麼都不畫（finding map-6）：純裝飾的東西不該讓地圖被錯誤頁取代。
// 第一屏的場景和地圖一起到（維護者 2026-10-26：點進任何一頁都要直接看到完整的資訊）：Play 在第一次捲動定位之後量出視窗附近的區段，
// 用 SceneReadyProvider 的 eager 要求那幾章立刻載入，場景畫好時由 onLoaded 回報，全部到齊才讓布幕掀開；其他章仍等進入視窗前後一屏才載入。
import { createContext, memo, useContext, useEffect, useRef, useState, type ComponentType } from 'react';
import type { SceneGeo } from './layout.ts';

export type SceneKind =
  | 'dock'
  | 'islands'
  | 'market'
  | 'scale'
  | 'river'
  | 'lighthouse'
  | 'gears'
  | 'farm'
  | 'bakery'
  | 'summit'
  | 'isle-valuation'
  | 'isle-finance'
  | 'isle-stakeholders'
  | 'isle-ledger';

/** 主線第 1 到 10 章的場景，依 03 第 2.2 節的章節草案順序 */
export const CORE_SCENES: readonly SceneKind[] = ['dock', 'islands', 'market', 'scale', 'river', 'lighthouse', 'gears', 'farm', 'bakery', 'summit'];
/** 延伸區 E01 到 E04 的小島 */
export const EXTENSION_SCENES: readonly SceneKind[] = ['isle-valuation', 'isle-finance', 'isle-stakeholders', 'isle-ledger'];
export const ALL_SCENES: readonly SceneKind[] = [...CORE_SCENES, ...EXTENSION_SCENES];
/** 物件層的種類：章節場景加上延伸區海峽的海面層（海峽不是章節，sceneFor 不會選到它，地景底色另見 terrain.ts 的 STRAIT_TERRAIN） */
export type SceneLayerKind = SceneKind | 'strait';

/** 依章序（主線與延伸區各自從 1 起算）與延伸旗標選場景；章數超過設定時輪流使用 */
export function sceneFor(chapterNo: number, extension: boolean): SceneKind {
  const list = extension ? EXTENSION_SCENES : CORE_SCENES;
  const i = Math.max(0, Math.floor(chapterNo) - 1) % list.length;
  return list[i]!;
}

/** 場景元件收到的 props：照 geo 畫 */
export interface SceneProps {
  geo: SceneGeo;
}
type SceneModule = { default: ComponentType<SceneProps>; geoAware?: boolean };
const LOADERS: Record<SceneLayerKind, () => Promise<SceneModule>> = {
  dock: () => import('../quest-map-scenes/scene-dock.tsx'),
  islands: () => import('../quest-map-scenes/scene-islands.tsx'),
  market: () => import('../quest-map-scenes/scene-market.tsx'),
  scale: () => import('../quest-map-scenes/scene-scale.tsx'),
  river: () => import('../quest-map-scenes/scene-river.tsx'),
  lighthouse: () => import('../quest-map-scenes/scene-lighthouse.tsx'),
  gears: () => import('../quest-map-scenes/scene-gears.tsx'),
  farm: () => import('../quest-map-scenes/scene-farm.tsx'),
  bakery: () => import('../quest-map-scenes/scene-bakery.tsx'),
  summit: () => import('../quest-map-scenes/scene-summit.tsx'),
  'isle-valuation': () => import('../quest-map-scenes/scene-isle-valuation.tsx'),
  'isle-finance': () => import('../quest-map-scenes/scene-isle-finance.tsx'),
  'isle-stakeholders': () => import('../quest-map-scenes/scene-isle-stakeholders.tsx'),
  'isle-ledger': () => import('../quest-map-scenes/scene-isle-ledger.tsx'),
  strait: () => import('../quest-map-scenes/scene-strait.tsx'),
};

const EmptyScene: ComponentType<SceneProps> = () => null;

/** 載好的場景元件（模組層級的快取：同一種場景第二次掛載時同步畫出，不再等） */
const loadedScenes = new Map<SceneLayerKind, ComponentType<SceneProps>>();
const loadingScenes = new Map<SceneLayerKind, Promise<ComponentType<SceneProps>>>();

/** 載入一種場景的模組；失敗時記一筆錯誤、改成空場景（之後不再重試，這一次瀏覽就是沒有裝飾） */
export function loadScene(kind: SceneLayerKind): Promise<ComponentType<SceneProps>> {
  let p = loadingScenes.get(kind);
  if (!p) {
    p = LOADERS[kind]().then(
      (m) => m.default,
      (e: unknown) => {
        void import('../../lib/errors.ts')
          .then((x) => x.logError(`scene ${kind}: ${(e as Error)?.message ?? String(e)}`, (e as Error)?.stack ?? ''))
          .catch(() => {});
        return EmptyScene;
      },
    );
    p.then((C) => loadedScenes.set(kind, C));
    loadingScenes.set(kind, p);
  }
  return p;
}

export interface SceneReadyState {
  /** 不等進入視窗就要載入的場景（第一屏附近的那幾章）；null 表示還沒量 */
  readonly eager: ReadonlySet<SceneLayerKind> | null;
  /** 某一種場景畫出來了（含載入失敗改成空場景） */
  readonly onLoaded: (kind: SceneLayerKind) => void;
}
const SceneReadyCtx = createContext<SceneReadyState | null>(null);
/** 地圖頁提供：第一屏要先到的場景與回報 */
export const SceneReadyProvider = SceneReadyCtx.Provider;

export interface ChapterSceneProps {
  kind: SceneLayerKind;
  /** 這一段（章節或海峽）的場景座標（layout.ts 的 sceneGeo） */
  geo: SceneGeo;
  /** 目前關卡（圖規 6.2 的 memo 鍵；保護框裡每個節點都有鈴框，所以其實不隨它變） */
  currentLevelId?: string | null;
  /** 不等進入視窗就載入（測試或截圖用） */
  eager?: boolean;
  /**
   * 只畫場景的一段（場景座標，y 向下）：第 1 章的場景延伸到地圖底部的地面（sceneGeo 的 below），
   * 區段裡畫 0 到區段高、地面（.qm-ground）裡畫剩下的部分，兩張 svg 上下接齊。預設整段（0 到 geo.h）
   */
  view?: { readonly y: number; readonly h: number };
}

/** 章節區段的物件層：svg 一開始是空的，所屬區段進入視窗前後一屏（或頁面點名 eager）時載入場景模組並畫出來；已載過的場景第一次 render 就畫 */
function ChapterSceneImpl({ kind, geo, eager = false, view }: ChapterSceneProps) {
  const ref = useRef<SVGSVGElement>(null);
  const ctx = useContext(SceneReadyCtx);
  const wanted = eager || ctx?.eager?.has(kind) === true;
  const [near, setNear] = useState(wanted);
  const [Body, setBody] = useState<ComponentType<SceneProps> | null>(() => (wanted ? (loadedScenes.get(kind) ?? null) : null));
  useEffect(() => {
    if (near || wanted) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    // 觀察所屬的章節區段（content-visibility: auto 之下，區段本身的交集最可靠）
    const target = el.parentElement ?? el;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: '100% 0px 100% 0px' },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [near, wanted]);
  const onLoaded = ctx?.onLoaded;
  useEffect(() => {
    if (!near && !wanted) return;
    let alive = true;
    void loadScene(kind).then((C) => {
      if (!alive) return;
      setBody(() => C);
      onLoaded?.(kind);
    });
    return () => {
      alive = false;
    };
  }, [near, wanted, kind, onLoaded]);
  const vy = view?.y ?? 0;
  const vh = view?.h ?? geo.h;
  return (
    <svg
      ref={ref}
      className={`qm-scene qm-scene--${kind}`}
      width={geo.bandW}
      height={vh}
      viewBox={`0 ${vy} ${geo.bandW} ${vh}`}
      aria-hidden="true"
      focusable="false"
      data-scene={kind}
      data-loaded={Body ? 'true' : undefined}
      data-part={vy > 0 ? 'ground' : undefined}
    >
      {Body && <Body geo={geo} />}
    </svg>
  );
}

/** memo 鍵（圖規 6.2）：場景種類、區帶寬、軌道寬、區段高、畫的那一段與目前關卡；其他父層重繪不重畫場景 */
export const ChapterScene = memo(
  ChapterSceneImpl,
  (a, b) =>
    a.kind === b.kind &&
    a.eager === b.eager &&
    a.currentLevelId === b.currentLevelId &&
    a.geo.bandW === b.geo.bandW &&
    a.geo.h === b.geo.h &&
    a.view?.y === b.view?.y &&
    a.view?.h === b.view?.h &&
    a.geo.track.left === b.geo.track.left &&
    a.geo.track.right === b.geo.track.right,
);
