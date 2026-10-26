// 闖關地圖的幾何（圖規第 1、2 節，17 第 5.2 節）：純函式，不碰 DOM。幾何只有這一個來源，輸出全是 px，CSS 只讀算好的值。
// 座標系：章節區段（或海峽）的左下角為原點，x 向右、y 向上，單位 px。x 一律是區帶座標（從視窗內容的左緣量起，含 rail 區與左翼），
// 所以軌道內的元件要減掉 g.trackLeft；畫 SVG 時 ySvg = H - y（RouteSegment.d 已經換好）。
// 整張地圖的座標：x 相同，y 是從地圖底部往上的 px（區段 offset 加區段內的 y），角色用 markerTransform 定位。
// 第 1 章在最下面（17 評估一採 A）；垂直常數三個斷點都一樣，只有水平常數隨斷點改變（字級放大時章節牌區、章末區與海峽依比例加高）。

// ---------------------------------------------------------------------------------------------
// 常數（圖規第 1.2、1.3、2.6、2.7、4.4、4.5、4.6 節）

/** 章節牌區高度：立柱 16、卡片最高 144、上方留 16 */
export const BANNER_ZONE = 176;
/** 章節牌區頂到第一關圓心 */
export const PAD_IN = 72;
/** 相鄰節點的垂直距離（17 第 2 節的 96 到 128 之內） */
export const NODE_GAP = 120;
/** 最後一關圓心到章末區底 */
export const PAD_OUT = 80;
/** 章末區高度：拱門底 24、拱門高 104、紙籤 40 到 168、接縫 24 */
export const END_ZONE = 192;
/** 延伸區海峽的高度 */
export const STRAIT = 240;
/** 頂端接縫的高度（terrain.ts：兩個正弦相加，振幅合計最多 11，中線 12；陸在下、海在上時中線 20） */
export const SEAM = 24;
/** 相鄰節點水平差的下限（第 2.9 節的驗算） */
export const MIN_STEP = 112;
/** 走廊到第一關、最後一關到走廊的水平差下限 */
export const MIN_CORRIDOR_STEP = 104;
/** 節點處水平切線的控制點比例 */
export const ROUTE_K = 0.7;
/**
 * 折返節點（前一點與後一點在同一側，走廊端點也算）的進出切線：進場段從下方、出場段往上方各斜 SWITCHBACK_DEG 度。
 * 第 1 輪看圖驗收用 20 度，第 2 輪關到關改成 S 形後節點那一端只剩約 11 度（桌面）；第 3 輪看圖驗收：前後兩關在同一側時，
 * 兩條 20px 的路面在圓盤外約 25px 處就合併，成為指向節點的「<」尖楔（已走時是兩條紅線夾成 V 字）。
 * 改成 30 度：離圓心 r 時兩條中心線相距 2 × r × sin 30° = r，r 32 時 32px，路面（寬 20）在圓盤外分得開；
 * 30 度時路面在 r 36 的位置約在 (±31, ±18)，碰不到圓心下 36 到 58 的星星籤，也碰不到圓心上 38 起的鈴框。
 */
export const SWITCHBACK_DEG = 30;
/**
 * 折返節點把手的三種情況（kind）：
 * - `pair`：關到關、兩端都是折返節點（左右交錯，|Δx| 172 以上）：水平長 ROUTE_K × |Δx|、斜 30 度，垂直分量最多 54
 *   （超過時整支把手等比例縮短、角度不變；NODE_GAP 120 的一半以內，曲線單調上升，桌面 |Δx| 416 時兩端 30 度、中段約 12 度，是一個緩 S）。
 * - `single`：關到關、另一端是穿越型節點（C 欄，|Δx| 112 到 214；穿越端照舊水平 0.7 × |Δx|）：曲線大半的上升都落在折返這一端，
 *   把手要長一點（0.9 × |Δx|，垂直分量最多 100）。30 度只在 |Δx| 192 以上放得下（再小時路邊會壓到折返節點的星星籤），
 *   所以角度從 |Δx| 112 的 22 度線性升到 192 的 30 度（375 寬約 23 度、768 寬約 28 度、1024 寬以上 30 度）；22 度時 r 32 的兩條中心線仍相距 24px 以上。
 * - `enter`、`exit`：走廊到第一關、最後一關到走廊：水平長 ROUTE_K × |Δx|、斜 30 度，垂直分量最多 48（PAD_IN 72 的三分之二）與 52（PAD_OUT 80 的 0.65），不在走廊口折一下。
 */
export const SWITCHBACK = {
  pair: { k: ROUTE_K, riseMax: 54 },
  single: { k: 0.9, riseMax: 100, minDeg: 22, minDx: MIN_STEP, fullDx: 192 },
  enter: { k: ROUTE_K, riseMax: 48 },
  exit: { k: ROUTE_K, riseMax: 52 },
} as const;
export type SwitchbackKind = keyof typeof SWITCHBACK;
/** 舊版折返角度 20 度：首頁小地圖的軌道寬上限（minimap-frame.ts 的 LAYOUT_MAX）以它為理由，保留這個常數 */
export const TURN_ANGLE_DEG = 20;
export const TURN_SLOPE = Math.tan((TURN_ANGLE_DEG * Math.PI) / 180);

/** 折返節點那一端的切線角度（度） */
export function switchbackDeg(dx: number, kind: SwitchbackKind): number {
  if (kind !== 'single') return SWITCHBACK_DEG;
  const { minDeg, minDx, fullDx } = SWITCHBACK.single;
  const t = Math.max(0, Math.min(1, (Math.abs(dx) - minDx) / (fullDx - minDx)));
  return minDeg + (SWITCHBACK_DEG - minDeg) * t;
}

/** 折返節點的把手：水平長度與上升量（|Δx| 是節點到另一端的水平差） */
export function switchbackHandle(dx: number, kind: SwitchbackKind = 'pair'): { hx: number; rise: number } {
  const slope = Math.tan((switchbackDeg(dx, kind) * Math.PI) / 180);
  const hx = Math.min(SWITCHBACK[kind].k * Math.abs(dx), SWITCHBACK[kind].riseMax / slope);
  return { hx, rise: hx * slope };
}
/**
 * 入口走廊的擺動（第 2 輪看圖驗收：章節交界是一段 300 到 400px 的垂直直線，路線的節奏在交界處停掉）：
 * 入口直線（區段底到章節牌區頂）改成往走廊外側擺出去再回來的一個緩彎（兩段 S 形三次曲線，兩端與最外側的切線都是垂直的），
 * 區段交界的 x 與切線不變（相鄰兩章照樣接在同一個 x）；離章節牌更遠，不會靠近卡片。出口那一段要穿過拱門，維持直線；海峽是棧橋，也是直的。
 * 第 4 輪看圖驗收（拱門經過章節牌旁到第一關仍像一段約 250px 的筆直走廊）：擺幅從 10 加到 14（手機的路邊離軌道邊仍有 20px）。
 * 第 5 輪看圖驗收（交界上下仍是筆直的垂直段）：擺幅 18（路邊離軌道邊 16px），最外側移到全長的 CORRIDOR_PEAK 處；出口在拱頂以上也往另一側擺（EXIT_SWAY），
 * 拱門、交界、章節牌旁連成一條蜿蜒的路，單元測試第 14 項：走廊沒有超過 120px 的直線（拱門開口那一段是直的，不算）。
 */
export const CORRIDOR_SWAY = 18;
/** 字級放大時章節牌區變高，擺幅跟著長度放大（最多 CORRIDOR_SWAY_MAX，320 寬時路邊離軌道邊仍有 8px） */
export const CORRIDOR_SWAY_MAX = 26;
/** 入口擺動最外側的位置（全長的比例）：靠近區段交界，交界以上很快就離開垂直線 */
export const CORRIDOR_PEAK = 0.42;
/**
 * 出口走廊在拱門以上的擺動（第 5 輪看圖驗收：拱門到下一章第一關仍是筆直的垂直段）：路線穿過拱門開口時在走廊中心（直線），
 * 離開拱頂 clear px 之後往走廊內側（紙籤那一側，有 60px 的空間）擺 min(amp, 剩下長度 × perLen) 再垂直回到交界；
 * 剩下不到 min 時維持直線。上方是海峽時不擺（交界處有一段直的棧橋）。
 * 第 6 輪看圖驗收（拱心石正上方多拐一個小鉤，路像在進拱門前抖了一下）：拱頂以上 clear 40px 一律垂直，剩下 72px 以上才擺；
 * 字級 100% 時拱頂到交界只有 64px，不擺，出了拱門直直往上，到下一章再由入口的擺動（CORRIDOR_SWAY）彎出去。字級放大時章末區變高，照樣擺
 */
export const EXIT_SWAY = { amp: 14, perLen: 0.12, min: 72, clear: 40 } as const;
/**
 * 關到關的緩彎（第 4 輪看圖驗收：手機上 zigzag 章的關到關是一條直斜線，節奏偏機械；第 5 輪：桌面也是 230px 以上的直斜線）：
 * 兩端都是折返節點（pair）時一律加緩彎（bowParts：原本的三次曲線沿連線的法線加一段平滑的偏移，兩端的位置與切線方向不變）。
 * 第 6 輪看圖驗收（375 寬以上每段都是同一個「先斜、中段平台、再斜」的 S，一章讀成一排階梯）：形狀依序輪流，從哪一種開始、
 * 每段的鼓起量與頂點前後的位置都由章節種子決定，同一章相鄰兩段不同形。依左右兩欄連線的角度分三組（BOW_SETS，bowStyle）：
 * - 0 窄軌道（比 28 度陡，360 寬以下）：C 形往上方、往下方輪流，離連線是連線長的 0.062 倍（320 寬約 13.6px、360 寬約 16px；離星星籤與鈴框 4px 以上，不變式 2），
 *   偏移集中在中段（指數 6），節點附近幾乎不動。
 * - 1 手機（24 到 28 度，約 410 寬以下）：C 形往上方鼓、S 形（先往下方再往上方，反曲點在連線的 0.3 到 0.45，中段比連線陡，不出現平台）、C 形往下方鼓輪流；
 *   鼓起量是連線長的 0.05 到 0.065 倍（375 寬約 13 到 17px）。
 * - 2 比較平（約 410 寬以上；768 寬約 15 到 22px、桌面約 17 到 26px）：C 形往上方、往下方輪流。30 度的節點把手在平的連線上本來就是一個 S（兩端比連線陡、中段平），
 *   再加 S 會在中段擠出接近水平的平台，所以只用 C。
 * C 形往上方鼓時頂點偏後（離前一關的鈴框遠）、往下方鼓時偏前（離後一關的星星籤遠）；偏移集中在中段的程度是指數（加種子的 0 到第四個數），
 * 太小時折返節點的進出兩段會靠得太近（不變式 11），太大時節點附近的路是直的（不變式 14）。
 * 兩關之間仍單調上升；中段（t = 0.5）的切線斜率至少是連線的 0.7 倍；單元測試第 14 項：沒有超過 120px（或連線長一半）的直線
 */
export const BOW = { parts: 4 } as const;
/** 三組緩彎：[鼓起量下限, 上限（連線長的倍數）, C 形的指數, 指數再加種子的 0 到這個數]，依序是窄軌道、手機、比較平的軌道 */
export const BOW_SETS = [
  [0.062, 0.062, 6, 0],
  [0.05, 0.065, 3, 1],
  [0.04, 0.06, 2.5, 0.5],
] as const;
/** 入口直線短於這個長度時不擺（字級很大或沒有空間時維持直線） */
export const CORRIDOR_SWAY_MIN = 96;

/** 已走實線在節點端離圓心的距離：圓頭 3px 收在 56px 圓盤（半徑 28）底下，任何模式下都不畫進圓盤 */
export const LINE_CLEAR = 30;
/** 未走圓點在節點端離圓心的距離：第一顆與最後一顆圓點正好落在這裡（外圈 34 之外），圓點不會被圓盤切掉一半 */
export const DOT_CLEAR = 40;
/** 未走圓點的週期；每段的 pathLength 是它的倍數 */
export const DOT_PERIOD = 16;
/** 角色鈴的寬高（各斷點相同） */
export const MARKER_SIZE = 60;
/** 路邊寬 20 的一半（路面 18、已走與未走 6 只在 CSS） */
export const ROAD_HALF = 10;
/** 種子抖動的幅度（±6px） */
export const JITTER_PX = 6;
/** 道路保護框與角色移動的取樣間距上限 */
export const SAMPLE_STEP = 8;

/** 節點外圈的半徑（圓盤 56 加外圈，保護框用 ±34） */
export const NODE_RING = 34;
/** 星星籤：寬 60，圓心下方 36 到 58 */
export const STAR_TAG = { halfW: 30, top: 36, bottom: 58 } as const;
/** 鈴：寬 60，腳底在圓心上方 38、頭頂在 98 */
export const BELL = { halfW: 30, foot: 38, head: 98 } as const;
/**
 * 章節牌：卡片下緣在區底往上 20、最高 144；兩根 6 × 16 的立柱，距卡片左右緣 24，柱腳在區底往上 4（各有一個 28 × 6 的地面陰影，
 * 第 2 輪看圖驗收：6 × 12 的淡木柱沒有接地陰影，看起來像兩根牙籤）。卡片上方留 12 到章節牌區頂端
 */
export const BANNER = { bottom: 20, maxH: 144, postW: 6, postH: 16, postInset: 24, shadowW: 28, shadowH: 6 } as const;
/**
 * 拱門外框 96 × 104，底在章末區 y=24；中心（終點）在章末區 y=76。路線上方被石材蓋住的一段（ChapterEnd 的 svg，從拱門頂往下量，含半條描邊）：
 * 拱心石上緣 key（−9.75）到拱圈內緣 inner（17.75）；未走圓點不壓在這兩條邊上（dotCount）
 */
export const ARCH = { halfW: 48, bottom: 24, height: 104, key: -9.75, inner: 17.75 } as const;
/**
 * 紙籤：下緣在章末區 y=40、最高 128、最寬 320，和拱門外框相隔 12（48 + 12 = 60）；木樁 4 × 16 在紙籤水平中心。
 * 字級放大時（第 4 輪看圖驗收：200% 時紙籤和下一章的章節牌相隔約 270px）改成貼齊章末區上緣：頂端離章頂 zoomTop，
 * 木樁換成一根從地面（章末區 y=24）立到紙籤後面的長柱子
 */
export const PLAQUE = { bottom: 40, maxH: 128, maxW: 320, corridorGap: 60, stakeW: 4, stakeH: 16, topGap: 24, zoomTop: 32 } as const;
/** 起點石（只有第 1 章）：直徑 20，圓心在入口走廊 y=24 */
export const START_STONE = { y: 24, r: 10 } as const;
/**
 * 起點的小旗（第 2 輪看圖驗收：起點只是一顆 20px 灰圓點，像沒畫完的線頭）：起點石外側（離路中心 18）立一根 4 × 20 的木樁，
 * 頂端一面 24 × 16 的燕尾旗朝外飄；木樁腳在 y=18，旗面在 y 22 到 38
 */
export const START_FLAG = { offset: 18, stakeW: 4, stakeH: 20, foot: 18, clothW: 24, clothH: 16 } as const;
/** 海峽的棧橋：寬 40，兩側繩柱再外推 4 */
export const PIER = { halfW: 20, ropeW: 4 } as const;

/** 保護框的外擴量（第 2.6 節） */
export const PROTECT_PAD = { node: 12, stars: 12, bell: 8, banner: 12, arch: 8, plaque: 12, strait: 12, road: 8, stone: 8 } as const;

/** 斷點與 rail 寬：和 packages/tokens 的 breakpoints、tabbar.railWidthPx 相同（測試核對；地圖 chunk 不載入整個 tokens 套件） */
export const BP_MEDIUM = 600;
export const BP_EXPANDED = 1024;
export const RAIL_WIDTH = 88;
/** expanded 以上 rail 區的寬度：rail 88 加 32 */
export const RAIL_ZONE = RAIL_WIDTH + 32;
/** 兩翼寬度至少這麼寬才給場景放物件 */
export const WING_MIN = 96;
/** 取不到視窗寬度時用的寬度（圖規第 16 節） */
export const FALLBACK_VIEWPORT = 375;

// ---------------------------------------------------------------------------------------------
// 型別

export type Bp = 'compact' | 'medium' | 'expanded';
export type Side = 'left' | 'right';
export type Column = 'L' | 'C' | 'R';
export type RouteTemplate = 'zigzag' | 'wave' | 'sweep';
export const TEMPLATES: readonly RouteTemplate[] = ['zigzag', 'wave', 'sweep'];

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** 矩形用區間表示（x0 < x1、y0 < y1），不管 y 向上還是向下都不會弄錯哪一邊 */
export interface Rect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export type ProtectKind = 'node' | 'stars' | 'bell' | 'banner' | 'arch' | 'plaque' | 'stake' | 'road' | 'stone' | 'strait' | 'pier';
/** 已外擴的保護框：測試、場景放置器與 E2E 共用（第 2.6 節） */
export interface ProtectRect extends Rect {
  readonly kind: ProtectKind;
}

export interface MapGeometry {
  readonly bp: Bp;
  /** 區帶寬（視窗的內容寬，含 rail 下方） */
  readonly bandW: number;
  /** rail 區寬（expanded 以上 120，其他 0） */
  readonly railZone: number;
  /** 軌道寬 W */
  readonly trackW: number;
  /** 軌道左緣（區帶座標）：在 rail 區右側置中 */
  readonly trackLeft: number;
  /** 走廊中心到軌道邊 */
  readonly corridorInset: number;
  /** 左右欄節點中心到軌道邊 */
  readonly colInset: number;
  /** 章節牌走廊側的內縮：走廊內縮加路寬一半 10 加間隔 16 */
  readonly bannerInset: number;
  /** 章節牌最大寬（compact 是軌道寬減內縮） */
  readonly bannerMaxW: number;
  /** 清單檢視寬：等於軌道寬（第 2 輪看圖驗收：切換檢視時頂部工具不再左右移動） */
  readonly listW: number;
  /** 根字級 ÷ 16，最小 1 */
  readonly fontScale: number;
  /** 章節牌區、章末區、海峽的高度（字級放大時依比例放大，取 16 的倍數向上取整） */
  readonly bannerZone: number;
  readonly endZone: number;
  readonly straitH: number;
  /** 章節牌卡片與紙籤的高度上限（同比例放大） */
  readonly bannerMaxH: number;
  readonly plaqueMaxH: number;
}

export interface LayoutChapterInput {
  readonly id: string;
  readonly levelIds: readonly string[];
  readonly extension?: boolean;
  /**
   * 字級放大時量到的章節牌卡片與紙籤高度（px，QuestMap 量、Play 帶回來；第 5 輪看圖驗收：200% 中文的卡片比保留的最大高度矮很多，
   * 紙籤與下一章的章節牌之間隔一大段空路）。有值時這一章的章節牌區與章末區只留實際需要的高度（fitZones），沒有值或字級 100% 時照最大高度排。
   * 比最大高度高時照量到的高度（第 9 輪：320 寬加 200% 的第 10 章章名排成七行，卡片比 288 高，超出章節區段的部分被 content-visibility 裁掉）
   */
  readonly bannerH?: number;
  readonly plaqueH?: number;
}

/**
 * 字級放大時依量到的卡片高度收緊這一章的章節牌區與章末區（16 的倍數向上取整，不小於字級 100% 的高度）：
 * 章節牌卡片下緣在 BANNER.bottom、上方至少 12；紙籤頂端離章頂 PLAQUE.zoomTop、下緣離章末區底至少 PLAQUE.bottom。
 * 所以紙籤頂到下一章章節牌的柱腳是 PLAQUE.zoomTop 加 4（36px），和字級 100% 時一樣是上下相鄰的一組路牌
 */
export function fitZones(
  input: Pick<LayoutChapterInput, 'bannerH' | 'plaqueH'>,
  g: MapGeometry,
): { bannerZone: number; endZone: number; bannerH: number; plaqueH: number } {
  const zoomed = g.fontScale > 1;
  const bannerH = zoomed && input.bannerH ? Math.ceil(input.bannerH) : g.bannerMaxH;
  const plaqueH = zoomed && input.plaqueH ? Math.ceil(input.plaqueH) : g.plaqueMaxH;
  const up16 = (n: number) => Math.ceil(n / 16) * 16;
  return {
    bannerZone: zoomed && input.bannerH ? Math.max(BANNER_ZONE, up16(BANNER.bottom + bannerH + BANNER_TOP_GAP)) : g.bannerZone,
    endZone: zoomed && input.plaqueH ? Math.max(END_ZONE, up16(PLAQUE.zoomTop + plaqueH + PLAQUE.bottom)) : g.endZone,
    bannerH,
    plaqueH,
  };
}

export interface LayoutNode {
  readonly levelId: string;
  /** 圓盤中心（區帶座標） */
  readonly x: number;
  /** 圓盤中心，從區段底部往上 */
  readonly y: number;
  readonly col: Column;
}

/** 路線的一段：直線或三次貝茲曲線，座標是區段座標（y 向上） */
export type RoutePart =
  | { readonly kind: 'line'; readonly p0: Point; readonly p1: Point }
  | { readonly kind: 'cubic'; readonly p0: Point; readonly c0: Point; readonly c1: Point; readonly p1: Point };

export interface RouteSegment {
  /** enter：入口直線加走廊到第一關；step：關到關；exit：最後一關到走廊加出口直線；strait：海峽的棧橋 */
  readonly kind: 'enter' | 'step' | 'exit' | 'strait';
  /** SVG path 的 d：原點是區段左上角、y 向下，x 是區帶座標 */
  readonly d: string;
  /** 折線長度取 16 的倍數，寫在 path 的 pathLength 上：圓點在兩端剛好各落一顆 */
  readonly pathLength: number;
  /** 實際的折線長度（px） */
  readonly length: number;
  /** 走這一段會走到的關卡：已走或未走以它的序號切分。exit 與 strait 是下一章的第一關；地圖最後一段為 null */
  readonly toLevelId: string | null;
  /** 已走實線：節點那一端裁到離圓心 LINE_CLEAR（區段交界那一端不裁，上下兩半接得起來） */
  readonly line: { readonly d: string };
  /** 未走圓點：節點那一端裁到離圓心 DOT_CLEAR，pathLength 依裁過的長度重算（16 的倍數），兩端各落一顆圓點 */
  readonly dots: { readonly d: string; readonly pathLength: number };
  readonly parts: readonly RoutePart[];
  /** 沿弧長每 8px 以內一點（含每個 part 的兩端），區段座標 y 向上：保護框與角色移動用 */
  readonly samples: readonly Point[];
}

export interface ChapterLayout {
  readonly chapterId: string;
  /** 章序（主線與延伸區合併計數，0 起） */
  readonly index: number;
  readonly template: RouteTemplate;
  readonly extension: boolean;
  /** 章節 ID 的 FNV-1a 雜湊：接縫相位等裝飾用的種子 */
  readonly seed: number;
  readonly first: boolean;
  readonly last: boolean;
  readonly nodes: readonly LayoutNode[];
  readonly entrySide: Side;
  readonly exitSide: Side;
  /** 入口與出口走廊的中心 x；上一章的 exitX 等於這一章的 entryX */
  readonly entryX: number;
  readonly exitX: number;
  readonly segments: readonly RouteSegment[];
  /** 章節牌卡片（最大高度）與兩根立柱；卡片在入口走廊的另一側 */
  readonly bannerSide: Side;
  readonly bannerRect: Rect;
  readonly bannerPosts: readonly [Rect, Rect];
  /** 拱門外框與中心（最後一章的路線停在中心） */
  readonly archRect: Rect;
  readonly archCenter: Point;
  /** 紙籤（最大高度）與木樁；紙籤在出口走廊的另一側 */
  readonly plaqueSide: Side;
  readonly plaqueRect: Rect;
  readonly stakeRect: Rect;
  /** 起點石（只有第 1 章） */
  readonly startStone: { readonly x: number; readonly y: number; readonly r: number } | null;
  /** 起點的小旗（只有第 1 章）：木樁與旗面（區段座標，y 向上），旗面朝外（side 是旗面在木樁的哪一側） */
  readonly startFlag: { readonly stake: Rect; readonly cloth: Rect; readonly side: Side } | null;
  readonly protect: readonly ProtectRect[];
  /** 這一章的章節牌區與章末區高度（字級放大時會變） */
  readonly bannerZone: number;
  readonly endZone: number;
  /** 區段高度，也是 contain-intrinsic-size 的高度 */
  readonly height: number;
  /** 區段底部離地圖底部的距離 */
  readonly offset: number;
}

export interface StraitLayout {
  readonly offset: number;
  readonly height: number;
  /** 棧橋中心 x，等於上一章的 exitX 與下一章的 entryX */
  readonly x: number;
  readonly side: Side;
  /** 海峽排在第幾章之前（第一個延伸章的 index） */
  readonly beforeIndex: number;
  /** 說明卡（紙籤樣式，最大高度）與木樁，在走廊另一側、垂直置中 */
  readonly plaqueRect: Rect;
  readonly stakeRect: Rect;
  /** 棧橋（含兩側繩柱） */
  readonly pierRect: Rect;
  readonly segment: RouteSegment;
  readonly protect: readonly ProtectRect[];
}

/** 整張地圖（圖規第 1.4 節的 MapLayout；名稱沿用第一段的 QuestMapLayout，和 tokens 的版面 token 不混淆） */
export interface QuestMapLayout {
  readonly geometry: MapGeometry;
  readonly chapters: readonly ChapterLayout[];
  readonly strait: StraitLayout | null;
  readonly totalHeight: number;
}

/** 場景放置器的輸入（第 6.2 節）：區帶座標，y 向下，原點是區段左上角 */
export interface SceneGeo {
  readonly bp: Bp;
  readonly bandW: number;
  readonly h: number;
  readonly track: { readonly left: number; readonly right: number };
  readonly corridor: { readonly entry: number; readonly exit: number | null };
  readonly nodes: readonly Point[];
  readonly protect: readonly ProtectRect[];
  readonly wings: { readonly left: Rect | null; readonly right: Rect | null };
  /**
   * 場景往區段底下延伸的高度（第 1 章是 GROUND，畫到地圖底部的地面上；其他段沒有這個欄位）：h 已經含它，區段的底邊在 h - ground。
   * 場景要在地面上另外放東西時用它；照 h 比例排的構圖會自動跟著延伸
   */
  readonly ground?: number;
  /**
   * 頂端接縫（QuestMap 由 terrain.ts 的 seamFill 帶入）：波浪以上的 path（區帶座標）與上方那一段的底色；上下同地景時是 null（只畫一條線）。
   * 場景要把物件畫到頂端時照抄它（第 10 章的岩坡）。sceneGeo 本身不帶（undefined）：地景屬於地圖組，layout 不認得地景。
   * line 是波浪本身；coast 是海接陸時海那一側的淺灘帶與浪花線（帶狀 path，填 scene-foam，淺灘帶 opacity 0.4），場景蓋回填色之後也要畫它（第 4 輪看圖驗收）
   */
  readonly seam?: {
    readonly d: string;
    readonly fill: string;
    readonly line?: string;
    readonly coast?: { readonly shallow: string; readonly foam: string } | null;
    /** 海接另一種深淺的海（只有 fixture 的第 2 章頂端接海峽）：地景層不畫浪花線；陸地不越過接縫、沿波浪自己收出海岸（terrain.ts 的 SeamShape.blend） */
    readonly blend?: boolean;
  } | null;
}

// ---------------------------------------------------------------------------------------------
// 種子

/** FNV-1a 32 位元雜湊：章節 ID 轉成種子 */
export function hashSeed(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32：決定性的偽亂數（0 到 1） */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------------------------
// 斷點與水平常數（第 1.2 節）

const INSETS: Record<Bp, { readonly corridor: number; readonly col: number }> = {
  compact: { corridor: 44, col: 52 },
  medium: { corridor: 56, col: 64 },
  expanded: { corridor: 56, col: 72 },
};
/** 章節牌走廊側內縮 = 走廊內縮 + 路寬一半 + 16 */
const BANNER_GAP = ROAD_HALF + 16;
const COMPACT_TRACK_MAX = 440;
const COMPACT_GUTTER = 16;
/** 軌道寬的下限：左右兩欄至少差 MIN_STEP（320 以下的視窗才會碰到） */
const TRACK_MIN = 2 * INSETS.compact.col + MIN_STEP;

export function bpFor(viewportW: number): Bp {
  return viewportW < BP_MEDIUM ? 'compact' : viewportW < BP_EXPANDED ? 'medium' : 'expanded';
}

/** 字級放大時的垂直區高度：依比例放大，取 16 的倍數向上取整 */
export function scaleZone(px: number, fontScale: number): number {
  return fontScale <= 1 ? px : Math.ceil((px * fontScale) / 16) * 16;
}

/** 章節牌卡片上緣到章節牌區頂端的空白 */
const BANNER_TOP_GAP = 12;

function verticals(fontScale: number) {
  return {
    // 字級放大時只有卡片跟著放大（柱腳 4、立柱 16、上方 12 不變），取 16 的倍數：200% 時 320（第 2 輪看圖驗收：
    // 原本整區照比例放大成 352，320 × 568 時第一關與整張章節牌放不進同一屏）
    bannerZone: fontScale <= 1 ? BANNER_ZONE : Math.max(BANNER_ZONE, Math.ceil((BANNER.bottom + BANNER.maxH * fontScale + BANNER_TOP_GAP) / 16) * 16),
    endZone: scaleZone(END_ZONE, fontScale),
    straitH: scaleZone(STRAIT, fontScale),
    bannerMaxH: BANNER.maxH * fontScale,
    plaqueMaxH: PLAQUE.maxH * fontScale,
  };
}

function fontScaleOf(rootFontPx: number): number {
  return Number.isFinite(rootFontPx) && rootFontPx > 16 ? rootFontPx / 16 : 1;
}

/**
 * 地圖頁的幾何：viewportW 是 document.documentElement.clientWidth，rootFontPx 是根元素的字級（px）。
 * 依第 1.2 節的表：compact 軌道 min(vw - 32, 440)、medium 480、expanded 以上 560；軌道在 rail 區右側置中。
 */
export function geometryFor(viewportW: number, rootFontPx = 16): MapGeometry {
  const vw = Number.isFinite(viewportW) && viewportW > 0 ? viewportW : FALLBACK_VIEWPORT;
  const bp = bpFor(vw);
  const railZone = bp === 'expanded' ? RAIL_ZONE : 0;
  const trackW = bp === 'compact' ? Math.max(TRACK_MIN, Math.min(vw - 2 * COMPACT_GUTTER, COMPACT_TRACK_MAX)) : bp === 'medium' ? 480 : 560;
  const { corridor, col } = INSETS[bp];
  const bannerInset = corridor + BANNER_GAP;
  const fontScale = fontScaleOf(rootFontPx);
  return {
    bp,
    bandW: vw,
    railZone,
    trackW,
    trackLeft: Math.round(railZone + (vw - railZone - trackW) / 2),
    corridorInset: corridor,
    colInset: col,
    bannerInset,
    bannerMaxW: bp === 'compact' ? trackW - bannerInset : bp === 'medium' ? 398 : 440,
    listW: trackW,
    fontScale,
    ...verticals(fontScale),
  };
}

/**
 * 只有軌道、沒有兩翼的幾何：首頁的章節小地圖（站規第 1.16 節）用，軌道寬等於卡片寬、左緣是 0。
 * 內縮依軌道寬選：小於 480 用 compact、小於 560 用 medium、其他用 expanded。
 */
export function trackGeometry(trackW: number, rootFontPx = 16): MapGeometry {
  const w = Math.max(TRACK_MIN, Number.isFinite(trackW) ? trackW : FALLBACK_VIEWPORT - 2 * COMPACT_GUTTER);
  const bp: Bp = w < 480 ? 'compact' : w < 560 ? 'medium' : 'expanded';
  const { corridor, col } = INSETS[bp];
  const bannerInset = corridor + BANNER_GAP;
  const fontScale = fontScaleOf(rootFontPx);
  return {
    bp,
    bandW: w,
    railZone: 0,
    trackW: w,
    trackLeft: 0,
    corridorInset: corridor,
    colInset: col,
    bannerInset,
    bannerMaxW: Math.min(w - bannerInset, bp === 'compact' ? Infinity : bp === 'medium' ? 398 : 440),
    listW: w,
    fontScale,
    ...verticals(fontScale),
  };
}

/** 三個欄位的中心 x（區帶座標）：L = COL、C = W / 2、R = W - COL，以軌道左緣為原點 */
export function columnX(col: Column, g: MapGeometry): number {
  return col === 'L' ? g.trackLeft + g.colInset : col === 'R' ? g.trackLeft + g.trackW - g.colInset : g.trackLeft + g.trackW / 2;
}

/** C 欄只有在和左右欄的水平差不小於 MIN_STEP 時才能用（W >= 328） */
export function centreColumnUsable(g: MapGeometry): boolean {
  return g.trackW / 2 - g.colInset >= MIN_STEP;
}

/** 走廊中心 x */
export function corridorX(side: Side, g: MapGeometry): number {
  return side === 'left' ? g.trackLeft + g.corridorInset : g.trackLeft + g.trackW - g.corridorInset;
}

/** 區段高度：章節牌區 + PAD_IN + (n - 1) × NODE_GAP + PAD_OUT + 章末區；沒有關卡的章和一關的章一樣高 */
export function chapterHeight(levelCount: number, g: Pick<MapGeometry, 'bannerZone' | 'endZone'>): number {
  return g.bannerZone + PAD_IN + Math.max(0, levelCount - 1) * NODE_GAP + PAD_OUT + g.endZone;
}

export function templateFor(chapterIndex: number): RouteTemplate {
  return TEMPLATES[((chapterIndex % TEMPLATES.length) + TEMPLATES.length) % TEMPLATES.length]!;
}

// ---------------------------------------------------------------------------------------------
// 欄位樣板（第 2.1、2.2 節）

type Token = 'F' | 'N' | 'C';
/** N 是與入口同側的欄，F 是另一側 */
const TEMPLATE_TOKENS: Record<RouteTemplate, readonly Token[]> = {
  zigzag: ['F', 'N'],
  wave: ['C', 'F', 'C', 'N'],
  sweep: ['F', 'C', 'N', 'C'],
};

const sideCol = (side: Side): Column => (side === 'left' ? 'L' : 'R');
const otherSide = (side: Side): Side => (side === 'left' ? 'right' : 'left');

/** 與前一個節點相反的那一側；前一個在 C 時取再前一個的反側，都沒有就取 F */
function awayFrom(prev: Column | undefined, prevPrev: Column | undefined, far: Column): Column {
  if (prev === 'L') return 'R';
  if (prev === 'R') return 'L';
  if (prevPrev === 'L') return 'R';
  if (prevPrev === 'R') return 'L';
  return far;
}

/**
 * 依樣板決定每關的欄位，依序檢查：1. 第一關不得在 N；2. C 欄不能用時改成與前一個節點相反的那一側（第一關改 F）；
 * 3. 與前一個節點的水平差小於 MIN_STEP 時改到與前一個節點相反的那一側。
 */
export function resolveColumns(levelCount: number, template: RouteTemplate, entrySide: Side, g: MapGeometry): Column[] {
  const near = sideCol(entrySide);
  const far = sideCol(otherSide(entrySide));
  const centreOk = centreColumnUsable(g);
  const tokens = TEMPLATE_TOKENS[template];
  const cols: Column[] = [];
  for (let i = 0; i < levelCount; i++) {
    const tok = tokens[i % tokens.length]!;
    let col: Column = tok === 'F' ? far : tok === 'N' ? near : 'C';
    const prev = cols[i - 1];
    if (i === 0 && col === near) col = far;
    if (col === 'C' && !centreOk) col = prev === undefined ? far : awayFrom(prev, cols[i - 2], far);
    if (prev !== undefined && Math.abs(columnX(col, g) - columnX(prev, g)) < MIN_STEP) col = awayFrom(prev, cols[i - 2], far);
    cols.push(col);
  }
  return cols;
}

/** 出口：最後一關在 L 出口在右、在 R 出口在左；在 C 時在倒數第二關的反側；只有一關時在那一關的反側（在 C 就取入口的反側）；沒有關卡時沿用入口 */
export function exitSideFor(cols: readonly Column[], entrySide: Side): Side {
  const last = cols[cols.length - 1];
  if (last === undefined) return entrySide;
  if (last === 'L') return 'right';
  if (last === 'R') return 'left';
  const prev = cols[cols.length - 2];
  if (prev === 'L') return 'right';
  if (prev === 'R') return 'left';
  return otherSide(entrySide);
}

// ---------------------------------------------------------------------------------------------
// 曲線與取樣（第 2.4、2.5 節）

/** 三次貝茲曲線在 t 的點 */
export function cubicPoint(p0: Point, c0: Point, c1: Point, p1: Point, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return { x: a * p0.x + b * c0.x + c * c1.x + d * p1.x, y: a * p0.y + b * c0.y + c * c1.y + d * p1.y };
}

/** 沿貝茲曲線依參數取 samples + 1 個點（含起點與終點） */
export function sampleCubic(p0: Point, c0: Point, c1: Point, p1: Point, samples = 64): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= samples; i++) out.push(cubicPoint(p0, c0, c1, p1, i / samples));
  return out;
}

/** 折線長度 */
export function polylineLength(points: readonly Point[]): number {
  let l = 0;
  for (let i = 1; i < points.length; i++) l += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  return l;
}

/** 每段的 pathLength：16 × max(1, round(L / 16)) */
export function pathLengthFor(length: number): number {
  return DOT_PERIOD * Math.max(1, Math.round(length / DOT_PERIOD));
}

/** 圓點中心離拱圈內緣至少這麼遠（圓點半徑 3 加 1px）；拱心石上緣只要不露出半顆（半徑 3） */
export const DOT_AVOID = 4;

/**
 * 未走圓點的個數（第 7 輪看圖驗收：出口拱頂以上改成垂直之後，一顆圓點的圓心剛好壓在拱圈內緣，下半顆從門洞頂端垂下來，像一滴水珠）。
 * avoid 是拱心石上緣與拱圈內緣離路徑終點的距離。圓點從終點往回每隔 L / n 一顆（終點那一顆是跨章交界的半顆，不能移），所以只能調間距：
 * 在 round(L / 16) 前後 3 個之內（間距 14 到 18），依序找內緣離 5.5（圓點上緣和拱圈之間空 2.5px，看得出是兩樣東西）、內緣離 4、兩邊都離 3（相切）以上，
 * 上緣都要離 3 以上；同一級取間距最接近 16 的，都沒有就取離邊最遠的。量的長度和瀏覽器差一點，各留 0.1。
 * 字級 100% 時拱門中心到交界都是 116px，出口的間距是 14.6 到 15.3（比 16 密一點，看不出來）；字級放大時出口很長，少數只能做到相切
 */
export function dotCount(length: number, avoid: readonly number[] = []): number {
  const n0 = Math.max(1, Math.round(length / DOT_PERIOD));
  const off = (n: number) => Math.abs(length / n - DOT_PERIOD);
  const score = (n: number) => {
    const [key = 9, inner = 9] = avoid.map((a) => Math.abs(a - (length / n) * Math.round((a * n) / length)));
    const m = Math.min(key, inner);
    return m < DOT_AVOID - 0.9 ? m : inner < DOT_AVOID + 0.1 ? 7 : inner < DOT_AVOID + 1.6 ? 8 : 9;
  };
  const ns = [0, 1, -1, 2, -2, 3, -3]
    .map((d) => n0 + d)
    .filter((n) => n > 0 && off(n) < 2)
    .sort((a, b) => off(a) - off(b));
  return avoid.length ? ns.reduce((b, n) => (score(n) > score(b) ? n : b), ns[0] ?? n0) : n0;
}

/** part 的密集折線（直線是兩端點，曲線依參數取 64 段） */
export function partPoints(part: RoutePart, samples = 64): Point[] {
  return part.kind === 'line' ? [part.p0, part.p1] : sampleCubic(part.p0, part.c0, part.c1, part.p1, samples);
}

/** 沿折線的弧長 s 處的點（s 超出範圍時取端點） */
export function pointAtLength(points: readonly Point[], s: number): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (s <= 0) return points[0]!;
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (acc + l >= s && l > 0) {
      const k = (s - acc) / l;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    acc += l;
  }
  return points[points.length - 1]!;
}

/** 依弧長平均重新取樣，間距不超過 step，含兩端 */
function resample(points: readonly Point[], step: number): Point[] {
  const total = polylineLength(points);
  const n = Math.max(1, Math.ceil(total / step));
  const out: Point[] = [];
  for (let i = 0; i <= n; i++) out.push(i === n ? points[points.length - 1]! : pointAtLength(points, (total * i) / n));
  return out;
}

const fmt = (n: number) => String(Number(n.toFixed(1)));

const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** 三次貝茲曲線在參數 [ta, tb] 之間的那一段（de Casteljau 分割，仍是三次曲線） */
export function subCubic(p0: Point, c0: Point, c1: Point, p1: Point, ta: number, tb: number): { p0: Point; c0: Point; c1: Point; p1: Point } {
  // 先在 tb 切開取左半，再在 ta / tb 切開取右半
  const ab = lerp(p0, c0, tb);
  const bc = lerp(c0, c1, tb);
  const cd = lerp(c1, p1, tb);
  const abc = lerp(ab, bc, tb);
  const bcd = lerp(bc, cd, tb);
  const end = lerp(abc, bcd, tb);
  const L = { p0, c0: ab, c1: abc, p1: end };
  if (ta <= 0) return L;
  const u = tb > 0 ? ta / tb : 0;
  const ab2 = lerp(L.p0, L.c0, u);
  const bc2 = lerp(L.c0, L.c1, u);
  const cd2 = lerp(L.c1, L.p1, u);
  const abc2 = lerp(ab2, bc2, u);
  const bcd2 = lerp(bc2, cd2, u);
  return { p0: lerp(abc2, bcd2, u), c0: bcd2, c1: cd2, p1: L.p1 };
}

/** 曲線上離 center 剛好 r 的參數：從 from（0 或 1）往另一端找第一個離開半徑 r 的點（二分法；曲線在節點附近遠離圓心） */
function paramAtRadius(part: RoutePart & { kind: 'cubic' }, center: Point, r: number, from: 0 | 1): number {
  const dist = (t: number) => {
    const p = cubicPoint(part.p0, part.c0, part.c1, part.p1, t);
    return Math.hypot(p.x - center.x, p.y - center.y);
  };
  // 粗掃描找到第一個超過 r 的取樣，再二分
  const N = 64;
  let inside: number = from;
  let outside: number | null = null;
  for (let i = 1; i <= N; i++) {
    const t = from === 0 ? i / N : 1 - i / N;
    if (dist(t) >= r) {
      outside = t;
      break;
    }
    inside = t;
  }
  if (outside === null) return from === 0 ? 1 : 0;
  let a = inside;
  let b = outside;
  for (let k = 0; k < 30; k++) {
    const m = (a + b) / 2;
    if (dist(m) >= r) b = m;
    else a = m;
  }
  return b;
}

/** 節點那一端裁掉離圓心 r 以內的部分（只有曲線段會接到節點）；回傳新的 part 清單 */
function trimParts(parts: readonly RoutePart[], r: number, start: boolean, end: boolean): RoutePart[] {
  const out = parts.slice();
  const first = out[0]!;
  const lastIdx = out.length - 1;
  if (out.length === 1 && first.kind === 'cubic' && (start || end)) {
    const ta = start ? paramAtRadius(first, first.p0, r, 0) : 0;
    const tb = end ? paramAtRadius(first, first.p1, r, 1) : 1;
    out[0] = ta < tb ? { kind: 'cubic', ...subCubic(first.p0, first.c0, first.c1, first.p1, ta, tb) } : first;
    return out;
  }
  if (start && first.kind === 'cubic') {
    const ta = paramAtRadius(first, first.p0, r, 0);
    out[0] = { kind: 'cubic', ...subCubic(first.p0, first.c0, first.c1, first.p1, ta, 1) };
  }
  const last = out[lastIdx]!;
  if (end && last.kind === 'cubic') {
    const tb = paramAtRadius(last, last.p1, r, 1);
    out[lastIdx] = { kind: 'cubic', ...subCubic(last.p0, last.c0, last.c1, last.p1, 0, tb) };
  }
  return out;
}

function pathOf(parts: readonly RoutePart[], height: number): { d: string; length: number } {
  const sv = (p: Point) => `${fmt(p.x)} ${fmt(height - p.y)}`;
  let d = `M${sv(parts[0]!.p0)}`;
  let length = 0;
  for (const part of parts) {
    d += part.kind === 'line' ? ` L${sv(part.p1)}` : ` C${sv(part.c0)} ${sv(part.c1)} ${sv(part.p1)}`;
    length += polylineLength(partPoints(part));
  }
  return { d, length };
}

/** trim：這一段的起點、終點是不是節點圓心（已走實線與未走圓點在那一端要裁掉）；avoid：圓點要避開的位置離終點的距離（dotCount） */
function buildSegment(
  kind: RouteSegment['kind'],
  parts: readonly RoutePart[],
  height: number,
  toLevelId: string | null,
  trim: { readonly start: boolean; readonly end: boolean } = { start: false, end: false },
  avoid?: readonly number[],
): RouteSegment {
  const { d, length } = pathOf(parts, height);
  const samples: Point[] = [];
  for (const part of parts) {
    const pts = resample(partPoints(part), SAMPLE_STEP);
    samples.push(...(samples.length > 0 ? pts.slice(1) : pts));
  }
  const line = trim.start || trim.end ? pathOf(trimParts(parts, LINE_CLEAR, trim.start, trim.end), height) : { d, length };
  const dots = trim.start || trim.end ? pathOf(trimParts(parts, DOT_CLEAR, trim.start, trim.end), height) : { d, length };
  return {
    kind,
    d,
    pathLength: pathLengthFor(length),
    length,
    toLevelId,
    line: { d: line.d },
    dots: { d: dots.d, pathLength: DOT_PERIOD * dotCount(dots.length, avoid) },
    parts,
    samples,
  };
}

// ---------------------------------------------------------------------------------------------
// 矩形

export const rect = (x0: number, y0: number, x1: number, y1: number): Rect => ({
  x0: Math.min(x0, x1),
  y0: Math.min(y0, y1),
  x1: Math.max(x0, x1),
  y1: Math.max(y0, y1),
});

export function inflate(r: Rect, pad: number): Rect {
  return { x0: r.x0 - pad, y0: r.y0 - pad, x1: r.x1 + pad, y1: r.y1 + pad };
}

/** 兩個矩形有沒有面積重疊（只碰到邊不算） */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

/** 點到矩形的距離（在矩形內為 0） */
export function pointRectDistance(p: Point, r: Rect): number {
  const dx = Math.max(r.x0 - p.x, 0, p.x - r.x1);
  const dy = Math.max(r.y0 - p.y, 0, p.y - r.y1);
  return Math.hypot(dx, dy);
}

/** 兩個矩形之間的距離（重疊為 0） */
export function rectDistance(a: Rect, b: Rect): number {
  const dx = Math.max(b.x0 - a.x1, 0, a.x0 - b.x1);
  const dy = Math.max(b.y0 - a.y1, 0, a.y0 - b.y1);
  return Math.hypot(dx, dy);
}

/** y 向上的區段座標換成 y 向下（高度 h） */
export function flipRect<R extends Rect>(r: R, h: number): R {
  return { ...r, y0: h - r.y1, y1: h - r.y0 };
}

/** 節點外圈的框（圓心 ±34） */
export function ringRect(n: Point): Rect {
  return rect(n.x - NODE_RING, n.y - NODE_RING, n.x + NODE_RING, n.y + NODE_RING);
}

/** 星星籤的框：寬 60、圓心下方 36 到 58 */
export function starTagRect(n: Point): Rect {
  return rect(n.x - STAR_TAG.halfW, n.y - STAR_TAG.bottom, n.x + STAR_TAG.halfW, n.y - STAR_TAG.top);
}

/** 鈴的框：寬 60、圓心上方 38 到 98（每個節點都算，不只目前關卡） */
export function bellRect(n: Point): Rect {
  return rect(n.x - BELL.halfW, n.y + BELL.foot, n.x + BELL.halfW, n.y + BELL.head);
}

const tag = (kind: ProtectKind, r: Rect, pad: number): ProtectRect => ({ kind, ...inflate(r, pad) });

function roadProtect(seg: RouteSegment): ProtectRect[] {
  return seg.samples.map((p) => tag('road', rect(p.x - ROAD_HALF, p.y - ROAD_HALF, p.x + ROAD_HALF, p.y + ROAD_HALF), PROTECT_PAD.road));
}

/**
 * 走廊另一側的紙籤（章末紙籤與海峽說明卡共用）：從遠側軌道邊到走廊 ∓ 60，最寬 320（超過時貼齊遠側的軌道邊）。
 * 回傳水平範圍與所在的一側。
 */
function plaqueSpan(corridorSide: Side, corridor: number, g: MapGeometry): { x0: number; x1: number; side: Side } {
  const trackRight = g.trackLeft + g.trackW;
  if (corridorSide === 'left') {
    const x1 = trackRight;
    return { x0: Math.max(corridor + PLAQUE.corridorGap, x1 - PLAQUE.maxW), x1, side: 'right' };
  }
  const x0 = g.trackLeft;
  return { x0, x1: Math.min(corridor - PLAQUE.corridorGap, x0 + PLAQUE.maxW), side: 'left' };
}

function stakeUnder(x0: number, x1: number, bottom: number): Rect {
  const cx = (x0 + x1) / 2;
  return rect(cx - PLAQUE.stakeW / 2, bottom - PLAQUE.stakeH, cx + PLAQUE.stakeW / 2, bottom);
}

// ---------------------------------------------------------------------------------------------
// 章節與整張地圖（第 2.1 到 2.6 節）

export interface ChapterContext {
  /** 章序（決定樣板） */
  readonly index: number;
  readonly entrySide: Side;
  /** 第 1 章：入口有起點石 */
  readonly first: boolean;
  /** 最後一章：路線停在拱門中心 */
  readonly last: boolean;
  /** 出口那一段走到的關卡（下一章的第一關；沒有時為 null） */
  readonly nextLevelId: string | null;
  readonly offset: number;
  /** 上方是海峽：出口走廊接棧橋（PierStub 在這一章頂端畫一段直的棧橋），拱門以上不擺 */
  readonly pier?: boolean;
}

/**
 * 每個節點是不是折返節點：前一點（第一關是入口走廊）與後一點（最後一關是出口走廊）在同一側。
 * 折返節點的進場段與出場段若都水平，兩條路會貼著同一條水平線靠近節點、疊成雙排圓點（第 1 輪看圖驗收）。
 */
export function turnBackFlags(xs: readonly number[], entryX: number, exitX: number): boolean[] {
  return xs.map((x, i) => {
    const s = Math.sign((i === 0 ? entryX : xs[i - 1]!) - x);
    return s !== 0 && Math.sign((i === xs.length - 1 ? exitX : xs[i + 1]!) - x) === s;
  });
}

/**
 * 走廊上的擺動：從 from 垂直出發，往 side 那一側擺 amp 再垂直回到 to（兩端的 x 與垂直切線不變）。最外側在全長的 peak 處，
 * 兩段三次曲線的把手是各自長度的 0.4 倍（第 5 輪看圖驗收：原本 0.5 倍、最外側在正中間，交界上下各有一段看起來還是垂直的）
 */
function sway(from: Point, to: Point, side: Side, amp: number, peak = 0.5): RoutePart[] {
  const len = to.y - from.y;
  const x = from.x + (side === 'left' ? -1 : 1) * amp;
  const mid: Point = { x, y: from.y + len * peak };
  const d0 = (mid.y - from.y) * 0.4;
  const d1 = (to.y - mid.y) * 0.4;
  return [
    { kind: 'cubic', p0: from, c0: { x: from.x, y: from.y + d0 }, c1: { x, y: mid.y - d0 }, p1: mid },
    { kind: 'cubic', p0: mid, c0: { x, y: mid.y + d1 }, c1: { x: to.x, y: to.y - d1 }, p1: to },
  ];
}

/** 入口直線：夠長時往走廊外側（入口在左就往左）擺 CORRIDOR_SWAY 再回來（最外側在 CORRIDOR_PEAK 處），否則是直線 */
function corridorSway(from: Point, to: Point, side: Side): RoutePart[] {
  const len = to.y - from.y;
  if (len < CORRIDOR_SWAY_MIN) return [{ kind: 'line', p0: from, p1: to }];
  return sway(from, to, side, Math.min(CORRIDOR_SWAY_MAX, Math.max(CORRIDOR_SWAY, (CORRIDOR_SWAY * len) / BANNER_ZONE)), CORRIDOR_PEAK);
}

/**
 * 關到關的緩彎：原本的三次曲線 a→c0→c1→b 沿連線的法線（往上方，y 大的那一側）加偏移 amp·φ(t)/max|φ|，φ(t) = t^al·(1 − t)^be·(p + q·t)。
 * al、be 至少 2：φ 與 φ′ 在兩端都是 0，節點的位置與切線方向不變（把手方向照舊 30 度，只是第一段與最後一段的把手跟著分段變短）；
 * al 比 be 大時頂點偏後、反之偏前。p + q·t 在 0 到 1 之間不變號時是 C 形（正往上方鼓），變號時是 S 形（反曲點 t = −p/q）。
 * 分成 BOW.parts 段三次曲線，接點的位置照公式算、切線用中央差分（Hermite 轉貝茲：把手是切線 ÷ 3n）；段內和公式最多差約 1px，
 * 畫出來的就是這幾段（一階導數連續的平滑曲線），單元測試的不變式量的也是這一條
 */
function bowParts(a: Point, c0: Point, c1: Point, b: Point, amp: number, al: number, be: number, p: number, q: number): RoutePart[] {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const L = Math.hypot(vx, vy);
  const f = (t: number) => t ** al * (1 - t) ** be * (p + q * t);
  let m = 0;
  for (let i = 1; i < 64; i++) m = Math.max(m, Math.abs(f(i / 64)));
  // 往上方的單位法線乘上 amp / max|φ|
  const nx = ((vx > 0 ? -vy : vy) / L) * (amp / m);
  const ny = (Math.abs(vx) / L) * (amp / m);
  const at = (t: number): Point => {
    const c = cubicPoint(a, c0, c1, b, t);
    return { x: c.x + nx * f(t), y: c.y + ny * f(t) };
  };
  const n = BOW.parts;
  const parts: RoutePart[] = [];
  let p0 = a;
  // 兩端的把手方向不變，長度是原本的 1/n
  let h0: Point = { x: a.x + (c0.x - a.x) / n, y: a.y + (c0.y - a.y) / n };
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const p1 = i < n ? at(t) : b;
    const u = at(t + 1e-4);
    const v = at(t - 1e-4);
    const d = i < n ? { x: (u.x - v.x) / (6e-4 * n), y: (u.y - v.y) / (6e-4 * n) } : { x: (b.x - c1.x) / n, y: (b.y - c1.y) / n };
    parts.push({ kind: 'cubic', p0, c0: h0, c1: { x: p1.x - d.x, y: p1.y - d.y }, p1 });
    p0 = p1;
    h0 = { x: p1.x + d.x, y: p1.y + d.y };
  }
  return parts;
}

/**
 * 兩端都折返的關到關用哪一組緩彎看軌道（左右兩欄連線的角度；同一張地圖都一樣，不看種子抖動）：
 * 0 是窄軌道（360 寬以下）的 C 形上下交錯，1 是手機的 C、S、C 輪流，2 是比較平的軌道（約 410 寬以上）的 C 形上下輪流
 */
export function bowStyle(g: MapGeometry): 0 | 1 | 2 {
  // tan 28° 與 tan 24°
  const slope = NODE_GAP / (g.trackW - 2 * g.colInset);
  return slope >= 0.5317 ? 0 : slope >= 0.4452 ? 1 : 2;
}

/** 單一章節的幾何；layoutMap 依序呼叫，入口側等於上一章的出口側 */
export function layoutChapter(input: LayoutChapterInput, ctx: ChapterContext, g: MapGeometry): ChapterLayout {
  const template = templateFor(ctx.index);
  const seed = hashSeed(input.id);
  const rand = seededRandom(seed);
  const n = input.levelIds.length;
  const zones = fitZones(input, g);
  const H = chapterHeight(n, zones);
  const yE = H - zones.endZone;
  const entrySide = ctx.entrySide;
  const entryX = corridorX(entrySide, g);
  const cols = resolveColumns(n, template, entrySide, g);
  const exitSide = n === 0 ? entrySide : exitSideFor(cols, entrySide);
  const exitX = corridorX(exitSide, g);

  // 種子抖動 ±6px：加完後與前一關、下一關（尚未抖動）、走廊的水平差仍要達到下限，否則這一關不抖動
  const base = cols.map((c) => columnX(c, g));
  const xs: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = (rand() * 2 - 1) * JITTER_PX;
    const x = base[i]! + j;
    const ok =
      (i === 0 ? Math.abs(x - entryX) >= MIN_CORRIDOR_STEP : Math.abs(x - xs[i - 1]!) >= MIN_STEP) &&
      (i === n - 1 ? Math.abs(x - exitX) >= MIN_CORRIDOR_STEP : Math.abs(x - base[i + 1]!) >= MIN_STEP);
    xs.push(ok ? x : base[i]!);
  }
  const nodes: LayoutNode[] = input.levelIds.map((levelId, i) => ({ levelId, x: xs[i]!, y: zones.bannerZone + PAD_IN + i * NODE_GAP, col: cols[i]! }));

  // 路線
  const startStone = ctx.first ? { x: entryX, y: START_STONE.y, r: START_STONE.r } : null;
  // 起點小旗：在起點石的外側（入口在左時旗子在左），旗面朝外
  const flagSide: Side = entrySide;
  const fx = entryX + (flagSide === 'left' ? -1 : 1) * START_FLAG.offset;
  const flagTop = START_FLAG.foot + START_FLAG.stakeH;
  const startFlag = ctx.first
    ? {
        stake: rect(fx - START_FLAG.stakeW / 2, START_FLAG.foot, fx + START_FLAG.stakeW / 2, flagTop),
        cloth:
          flagSide === 'left'
            ? rect(fx - START_FLAG.stakeW / 2 - START_FLAG.clothW, flagTop - START_FLAG.clothH, fx - START_FLAG.stakeW / 2, flagTop)
            : rect(fx + START_FLAG.stakeW / 2, flagTop - START_FLAG.clothH, fx + START_FLAG.stakeW / 2 + START_FLAG.clothW, flagTop),
        side: flagSide,
      }
    : null;
  const archCenter: Point = { x: exitX, y: yE + ARCH.bottom + ARCH.height / 2 };
  const top: Point = ctx.last ? archCenter : { x: exitX, y: H };
  const start: Point = { x: entryX, y: startStone ? startStone.y : 0 };
  const archTop: Point = { x: exitX, y: archCenter.y + ARCH.height / 2 + EXIT_SWAY.clear };
  const exitLen = H - archTop.y;
  // 拱門中心以上：經過拱門中心時分成兩段，角色移動才能在拱門下停一下（第 2.8 節）；最後一章停在拱門中心
  const exitTail: RoutePart[] = ctx.last
    ? []
    : ctx.pier || exitLen < EXIT_SWAY.min
      ? [{ kind: 'line', p0: archCenter, p1: top }]
      : [{ kind: 'line', p0: archCenter, p1: archTop }, ...sway(archTop, top, otherSide(exitSide), Math.min(EXIT_SWAY.amp, exitLen * EXIT_SWAY.perLen))];
  const exitStraight = (from: Point): RoutePart[] => [{ kind: 'line', p0: from, p1: archCenter }, ...exitTail];
  // 拱心石上緣與拱圈內緣離終點的距離（拱門中心以上是垂直線）：未走圓點不壓在石材的邊上
  const tailLen = exitTail.reduce((l, p) => l + polylineLength(partPoints(p)), -ARCH.height / 2);
  const exitAvoid = exitTail.length ? [tailLen + ARCH.key, tailLen + ARCH.inner] : [];
  const segments: RouteSegment[] = [];
  if (n === 0) {
    segments.push(buildSegment('exit', exitStraight(start), H, ctx.nextLevelId, undefined, exitAvoid));
  } else {
    // part 只放純座標（不帶節點的 levelId 與 col）
    const at = (i: number): Point => ({ x: nodes[i]!.x, y: nodes[i]!.y });
    const turn = turnBackFlags(xs, entryX, exitX);
    // 節點那一端的控制點：穿越型節點水平（0.7 × |Δx|）；折返節點進場段在下方、出場段在上方（switchbackHandle，垂直分量有上限）。
    // 關到關看另一端：也是折返節點用 pair（30 度），是穿越型節點用 single（22 到 30 度）
    const handle = (p: Point, towardX: number, i: number, dir: 'in' | 'out', kind: 'step' | 'enter' | 'exit', other = -1): Point => {
      const dx = Math.abs(towardX - p.x);
      const s = Math.sign(towardX - p.x);
      if (!turn[i]) return { x: p.x + s * ROUTE_K * dx, y: p.y };
      const h = switchbackHandle(dx, kind === 'step' ? (turn[other] ? 'pair' : 'single') : kind);
      return { x: p.x + s * h.hx, y: p.y + (dir === 'out' ? 1 : -1) * h.rise };
    };
    const p0 = at(0);
    const corridorTop: Point = { x: entryX, y: zones.bannerZone };
    segments.push(
      buildSegment(
        'enter',
        [
          ...corridorSway(start, corridorTop, entrySide),
          { kind: 'cubic', p0: corridorTop, c0: { x: entryX, y: zones.bannerZone + ROUTE_K * PAD_IN }, c1: handle(p0, entryX, 0, 'in', 'enter'), p1: p0 },
        ],
        H,
        nodes[0]!.levelId,
        { start: false, end: true },
      ),
    );
    const style = bowStyle(g);
    const [a0, a1, ce, cs] = BOW_SETS[style];
    // 緩彎的鼓起量與頂點位置用另一串亂數（不動節點的抖動）；形狀依序輪流，從第幾種開始看種子
    const bowRand = seededRandom(seed ^ 0x9e3779b9);
    let turnNo = seed;
    for (let i = 1; i < n; i++) {
      const a = at(i - 1);
      const b = at(i);
      const c0 = handle(a, b.x, i - 1, 'out', 'step', i);
      const c1 = handle(b, a.x, i, 'in', 'step', i - 1);
      const bow = turn[i - 1] && turn[i];
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      const amp = L * (a0 + (a1 - a0) * bowRand());
      const r = bowRand();
      // 0 是 C 形往上方（頂點偏後）、1 是 S 形、2 是 C 形往下方（頂點偏前）；只有手機那一組有 S 形
      const kind = style === 1 ? turnNo % 3 : (turnNo % 2) * 2;
      if (bow) turnNo++;
      segments.push(
        buildSegment(
          'step',
          !bow
            ? [{ kind: 'cubic', p0: a, c0, c1, p1: b }]
            : kind === 1
              ? bowParts(a, c0, c1, b, amp, 2, 2, -0.3 - 0.15 * r, 1)
              : bowParts(a, c0, c1, b, amp, ce + (kind ? 0 : cs * r), ce + (kind ? cs * r : 0), 1 - kind, 0),
          H,
          nodes[i]!.levelId,
          {
            start: true,
            end: true,
          },
        ),
      );
    }
    const pl = at(n - 1);
    const corridorBottom: Point = { x: exitX, y: yE };
    segments.push(
      buildSegment(
        'exit',
        [
          { kind: 'cubic', p0: pl, c0: handle(pl, exitX, n - 1, 'out', 'exit'), c1: { x: exitX, y: yE - ROUTE_K * PAD_OUT }, p1: corridorBottom },
          ...exitStraight(corridorBottom),
        ],
        H,
        ctx.nextLevelId,
        { start: true, end: false },
        exitAvoid,
      ),
    );
  }

  // 章節牌：入口走廊的另一側，走廊側內縮 BI、另一側貼齊軌道邊；超過最大寬時貼齊遠側的軌道邊
  const trackRight = g.trackLeft + g.trackW;
  const bannerSide = otherSide(entrySide);
  const bx0 = bannerSide === 'right' ? Math.max(g.trackLeft + g.bannerInset, trackRight - g.bannerMaxW) : g.trackLeft;
  const bx1 = bannerSide === 'right' ? trackRight : Math.min(trackRight - g.bannerInset, g.trackLeft + g.bannerMaxW);
  const bannerRect = rect(bx0, BANNER.bottom, bx1, BANNER.bottom + zones.bannerH);
  const postY0 = BANNER.bottom - BANNER.postH;
  const bannerPosts: [Rect, Rect] = [
    rect(bx0 + BANNER.postInset, postY0, bx0 + BANNER.postInset + BANNER.postW, BANNER.bottom),
    rect(bx1 - BANNER.postInset - BANNER.postW, postY0, bx1 - BANNER.postInset, BANNER.bottom),
  ];

  // 拱門跨在出口走廊上；紙籤在出口走廊的另一側
  const archRect = rect(exitX - ARCH.halfW, yE + ARCH.bottom, exitX + ARCH.halfW, yE + ARCH.bottom + ARCH.height);
  const span = plaqueSpan(exitSide, exitX, g);
  const zoomed = g.fontScale > 1;
  const plaqueRect = zoomed
    ? rect(span.x0, H - PLAQUE.zoomTop - zones.plaqueH, span.x1, H - PLAQUE.zoomTop)
    : rect(span.x0, yE + PLAQUE.bottom, span.x1, yE + PLAQUE.bottom + zones.plaqueH);
  const stakeCx = (span.x0 + span.x1) / 2;
  const stakeRect = zoomed
    ? rect(stakeCx - PLAQUE.stakeW / 2, yE + PLAQUE.bottom - PLAQUE.stakeH, stakeCx + PLAQUE.stakeW / 2, H - PLAQUE.zoomTop - 24)
    : stakeUnder(span.x0, span.x1, yE + PLAQUE.bottom);

  const protect: ProtectRect[] = [];
  for (const nd of nodes) {
    protect.push(tag('node', ringRect(nd), PROTECT_PAD.node), tag('stars', starTagRect(nd), PROTECT_PAD.stars), tag('bell', bellRect(nd), PROTECT_PAD.bell));
  }
  protect.push(tag('banner', rect(bx0, postY0, bx1, bannerRect.y1), PROTECT_PAD.banner));
  protect.push(tag('arch', archRect, PROTECT_PAD.arch));
  protect.push(tag('plaque', plaqueRect, PROTECT_PAD.plaque), tag('stake', stakeRect, PROTECT_PAD.plaque));
  if (startStone)
    protect.push(
      tag('stone', rect(startStone.x - startStone.r, startStone.y - startStone.r, startStone.x + startStone.r, startStone.y + startStone.r), PROTECT_PAD.stone),
    );
  if (startFlag)
    protect.push(
      tag(
        'stone',
        rect(Math.min(startFlag.cloth.x0, startFlag.stake.x0), startFlag.stake.y0 - 2, Math.max(startFlag.cloth.x1, startFlag.stake.x1), startFlag.cloth.y1),
        PROTECT_PAD.stone,
      ),
    );
  for (const s of segments) protect.push(...roadProtect(s));

  return {
    chapterId: input.id,
    index: ctx.index,
    template,
    extension: input.extension === true,
    seed,
    first: ctx.first,
    last: ctx.last,
    nodes,
    entrySide,
    exitSide,
    entryX,
    exitX,
    segments,
    bannerSide,
    bannerRect,
    bannerPosts,
    archRect,
    archCenter,
    plaqueSide: span.side,
    plaqueRect,
    stakeRect,
    startStone,
    startFlag,
    protect,
    bannerZone: zones.bannerZone,
    endZone: zones.endZone,
    height: H,
    offset: ctx.offset,
  };
}

/** 延伸區海峽：棧橋沿上一章的出口走廊直走；說明卡在走廊另一側、木樁加卡片垂直置中 */
export function layoutStrait(side: Side, beforeIndex: number, offset: number, toLevelId: string | null, g: MapGeometry): StraitLayout {
  const height = g.straitH;
  const x = corridorX(side, g);
  const segment = buildSegment(
    'strait',
    [
      {
        kind: 'line',
        p0: { x, y: 0 },
        p1: { x, y: height },
      },
    ],
    height,
    toLevelId,
  );
  const span = plaqueSpan(side, x, g);
  const bottom = Math.round((height - PLAQUE.stakeH - g.plaqueMaxH) / 2) + PLAQUE.stakeH;
  const plaqueRect = rect(span.x0, bottom, span.x1, bottom + g.plaqueMaxH);
  const stakeRect = stakeUnder(span.x0, span.x1, bottom);
  const half = PIER.halfW + PIER.ropeW;
  const pierRect = rect(x - half, 0, x + half, height);
  const protect: ProtectRect[] = [
    tag('strait', plaqueRect, PROTECT_PAD.strait),
    tag('stake', stakeRect, PROTECT_PAD.strait),
    tag('pier', pierRect, PROTECT_PAD.strait),
    ...roadProtect(segment),
  ];
  return { offset, height, x, side, beforeIndex, plaqueRect, stakeRect, pierRect, segment, protect };
}

function layoutQuestMap(chapters: readonly LayoutChapterInput[], g: MapGeometry): QuestMapLayout {
  // 每一章出口那一段走到的關卡：之後第一個有關卡的章的第一關
  const nextLevel: (string | null)[] = new Array<string | null>(chapters.length).fill(null);
  let upcoming: string | null = null;
  for (let i = chapters.length - 1; i >= 0; i--) {
    nextLevel[i] = upcoming;
    upcoming = chapters[i]!.levelIds[0] ?? upcoming;
  }
  const out: ChapterLayout[] = [];
  let strait: StraitLayout | null = null;
  let entrySide: Side = 'left';
  let offset = 0;
  for (let i = 0; i < chapters.length; i++) {
    const c = chapters[i]!;
    // 主線與延伸區之間插一段海峽（只插一次；第一章就是延伸章時不插）
    if (c.extension && strait === null && i > 0 && !chapters[i - 1]!.extension) {
      strait = layoutStrait(entrySide, i, offset, nextLevel[i - 1] ?? null, g);
      offset += strait.height;
    }
    const pier = !c.extension && chapters[i + 1]?.extension === true;
    const ch = layoutChapter(c, { index: i, entrySide, first: i === 0, last: i === chapters.length - 1, nextLevelId: nextLevel[i] ?? null, offset, pier }, g);
    out.push(ch);
    entrySide = ch.exitSide;
    offset += ch.height;
  }
  return { geometry: g, chapters: out, strait, totalHeight: offset };
}

/** 整張地圖：章節依傳入順序由下往上排列，第一個延伸章之前插入海峽 */
export function layoutMap(chapters: readonly LayoutChapterInput[], g: MapGeometry): QuestMapLayout {
  return layoutQuestMap(chapters, g);
}

/** 節點圓盤中心在整張地圖座標系的位置（x 是區帶座標，y 從地圖底部往上）；找不到時為 null */
export function markerAt(map: QuestMapLayout, levelId: string): Point | null {
  for (const c of map.chapters) {
    const n = c.nodes.find((x) => x.levelId === levelId);
    if (n) return { x: n.x, y: c.offset + n.y };
  }
  return null;
}

/**
 * 角色鈴的 transform（第 2.7 節）：鈴（60 × 60，放在地圖容器的左下角）水平置中在節點上、腳底在圓心上方 38px。
 * p 是 markerAt 的結果（或移動時沿路線取樣的點）。
 */
export function markerTransform(p: Point): string {
  const x = Math.round(p.x - MARKER_SIZE / 2);
  const y = Math.round(p.y + BELL.foot);
  return `translate(${x}px, ${-y}px)`;
}

// ---------------------------------------------------------------------------------------------
// 場景放置器的輸入（第 6.2 節）

/**
 * 地圖底部的地面（QuestMap 的 .qm-ground）在 Tab bar 以外的高度：quest-map.css 的 160px 加 24px（expanded 的 --qm-bottom-safe 是 24；
 * 手機與平板另外加上 Tab bar 與安全區，那一段在浮動的 Tab bar 後面）。第 1 章的場景往下延伸這麼多（sceneGeo 的 below），
 * 地面上也有地景物件，不是一條空白的沙地（第 3 輪看圖驗收：1440 × 900 起點下方 184px 什麼都沒有）。
 */
export const GROUND = 184;
/** 延伸到地面時，起點正下方保留的走廊（半寬）：路線從起點石開始，下面不放東西，不會像路通進某個物件裡 */
export const GROUND_APRON = 36;

/**
 * 區段（章節或海峽）換成場景的座標：y 向下；兩翼寬度至少 96 才有（左翼從 rail 區右側算起）。
 * below：場景往區段底下延伸的高度（只有第 1 章用 GROUND，畫到地圖底部的地面上）。區段裡的座標不變（y 仍從區段頂端量起），
 * 只是 h 多了 below、兩翼與構圖可以用到區段下方；延伸時起點正下方加一個保護框（GROUND_APRON）。
 */
export function sceneGeo(section: ChapterLayout | StraitLayout, g: MapGeometry, below = 0): SceneGeo {
  const sh = section.height;
  const h = sh + below;
  const isChapter = 'nodes' in section;
  const left = g.trackLeft - g.railZone >= WING_MIN ? rect(g.railZone, 0, g.trackLeft, h) : null;
  const right = g.bandW - (g.trackLeft + g.trackW) >= WING_MIN ? rect(g.trackLeft + g.trackW, 0, g.bandW, h) : null;
  const apron: ProtectRect[] =
    below > 0 && isChapter && section.startStone
      ? [{ kind: 'stone', ...rect(section.startStone.x - GROUND_APRON, sh, section.startStone.x + GROUND_APRON, h) }]
      : [];
  return {
    bp: g.bp,
    bandW: g.bandW,
    h,
    track: { left: g.trackLeft, right: g.trackLeft + g.trackW },
    corridor: isChapter ? { entry: section.entryX, exit: section.last ? null : section.exitX } : { entry: section.x, exit: section.x },
    nodes: isChapter ? section.nodes.map((n) => ({ x: n.x, y: sh - n.y })) : [],
    protect: [...section.protect.map((r) => flipRect(r, sh)), ...apron],
    wings: { left, right },
    ...(below > 0 ? { ground: below } : {}),
  };
}

// ---------------------------------------------------------------------------------------------
// 首頁的章節小地圖（站規第 1.16 節）

/**
 * 小地圖要露出的垂直範圍（區段座標，y 向上）：下一關的圓心放在視窗下方 40% 處（星星籤與鈴都看得到）；
 * 沒有下一關（全新使用者）時從區段底部開始，露出起點石與入口。
 */
export function miniMapWindow(ch: ChapterLayout, levelId: string | null, height = 200): { readonly bottom: number; readonly top: number } {
  const n = levelId ? ch.nodes.find((x) => x.levelId === levelId) : undefined;
  const want = n ? n.y - 0.4 * height : 0;
  const bottom = Math.max(0, Math.min(ch.height - height, want));
  return { bottom, top: bottom + height };
}
