// 延伸區四章（外海小島，圖規 6.4 的 E01 到 E04）與海峽共用的構圖與畫法。底色是深海（sea-deep，地圖組的 .qm-terrain），這一層畫：
// - 每章一座島墊在所有節點、星星籤、拱門腳、紙籤木樁與主角道具下方；外圈一道淺水（sea）與兩條浪花線，島心是草地、外緣是沙灘。
// - 島的外形貼著內容走（scene-kit 的 envelope：節點、星星籤、拱門腳、木樁、路面與主角道具聯集外擴），再用 organic 往外推出不等大的岬角與海灣
//   （第 2 輪看圖驗收：原本是軌道寬的圓角長方形，左右岸是兩條平行直線）；主角道具那一側伸出一塊半島，節點交錯留下的另一側自然內縮。
// - 兩座島之間（第 5 輪看圖驗收：原本這一章的島頂與上一章的南岸都貼著接縫拉平，中間是一條約 25px 的等寬直水道，像人工運河）：
//   上一章的章節牌和這一章的拱門、紙籤是路口的同一組路牌（圖規 4.5），一起立在這座島的北岸（northShore）：拱門上方是水道的南岸，往章節牌那一側陡升成一塊越過交界的沙岬，
//   章節牌的立柱站在沙岬上，卡片後面藏住兩島最近的那一段；遠側有空間時沙岬再收回島的側邊，水道從那裡出海。上一章照同一串控制點畫出越過交界的那一截（headPoly）。
//   上一章的島底不再有南岸（shoreAbove）：岸線離北岸至少 GAP（岸到岸），卡片上方收成一個海灣，水道一端是走廊那一側的海灣（寬）、中間藏在卡片後面（窄）；
//   遠側沒有空間時（手機）島在卡片後面墊到交界上方約 92px、兩島在卡片後面接起來，水道只從走廊那一側出海。
// - 延伸第 1 章的下方是海峽：南岸照舊是越過交界的深岬角（southShore），海峽頂端照同一串控制點畫出那一截（footPoly）。
// - 跨海的那一段路是橋（和第 2 章同一種：橋面 36、兩側欄杆、每 10px 一條木板線、四角橋柱），畫在沙地之上，兩端各伸進沙地 8px；
//   長度由兩岸實際的位置決定，上下兩章各畫自己那一截，木板線以交界對齊。
// - 主角道具：桌面放在入口那一翼（島會往外長出一塊把它墊住），手機放在節點交錯留下的空側；其他物件在島上或海上，交給 scene-kit 的 placeProps。
// 這個模組只被延伸區的場景與海峽 import，不放進 scene-kit（每一章都載 scene-kit，預算 5 KB）；四章與海峽共用，vite 會把它分成一個 shared~scene-… chunk（算進場景的單章與合計預算）。
import type { ReactNode } from 'react';
import type { Point, Rect, SceneGeo } from '../quest-map/layout.ts';
import { hashSeed, inflate, seededRandom, SEAM } from '../quest-map/layout.ts';
import {
  byDepth,
  dayNight,
  envelope,
  FOAM,
  GLOW,
  LEAF,
  LINE,
  MEADOW,
  organic,
  placeProps,
  pointInPoly,
  Prop,
  rectPoly,
  ROCK_DEEP,
  SAND,
  SceneDefs,
  SEA,
  seamWave,
  smoothClosed,
  TerrainRect,
  useSceneIds,
  waveAt,
  WOOD,
  wingSpan,
  type Anchor,
  type Placed,
  type PropSpec,
  type TerrainBlock,
} from './scene-kit.tsx';

// ---------------------------------------------------------------------------------------------
// 島的形狀

/** 島邊離必須墊住的東西多遠（不夠時每次加 8 重算）；淺水帶的寬度 */
const PAD = 28;
const REEF = 22;
/** 最上面那一章的島頂往島內的起伏 0 到 TOP_WAVE（見 outline） */
const TOP_WAVE = 14;
const TOP_CHAMFER = 12;
/** 最上面那一章：淺水外緣離地圖上緣接縫的波浪（含波谷）至少這麼遠；淺水帶在島頂最窄收到 REEF_MIN */
const TOP_GAP = 10;
const REEF_MIN = 12;
/**
 * 最上面那一章（字級 100%、桌面與平板）紙籤墊住的那一段：保護框下緣往上這麼高（卡片下緣在保護框下緣往上 12，卡片最高約 80，
 * 外擴 PAD、島頂往內起伏 TOP_WAVE 之後，島頂仍在卡片上方 12px 以上，再留 2px 給平滑曲線）
 */
const TOP_CARD = 12 + 80 + 12 + TOP_WAVE + 2 - PAD;
/** 草地離岸 BEACH 加減 BEACH_VAR（沿岸起伏，第 5 輪看圖驗收：草地的邊不和岸線平行） */
const BEACH = 22;
const BEACH_VAR = 11;
/** 有北岸的章，草地上緣在交界往下約這麼深（加兩個正弦的起伏）：章節牌的立柱與紙籤木樁一帶是沙灘 */
const MEADOW_TOP = 58;
/** 下方是另一座島的章，草地下緣最低在交界往上約這麼高（加兩個正弦的起伏）：交界上下都是沙灘 */
const MEADOW_END = 22;
/**
 * 南岸（只有下方是海峽的延伸第 1 章，IsleSpec.southDeep）：兩端在交界上方 RISE px 收進島的兩側，中段越過交界 DIP 到 DIP + BULGE（中間最深，38px）。
 * 第 5 輪看圖驗收：只越過交界 9px 的南岸在手機上是一條貼著交界的水平直線，正好壓在海峽頂端的接縫浪花線上方
 */
const RISE = 26;
const DIP = 6;
const BULGE = 32;
const END = 48;
/** 島的凹處（海灣與接合處）最小的圓弧半徑 */
const CLOSE = 68;
/** 北岸：章節牌底下那一塊沙岬的頂（交界往上；卡片下緣在交界往上 16、圓角 20，岬頂藏在卡片後面） */
const CAPE_TOP = -28;
/** 水道南岸（拱門上方、橋的下端）在交界往下 FLOOR 加種子 0 到 FLOOR_VAR；拱心石頂最高在交界往下 58，至少留 16（測試核對） */
const FLOOR = 28;
const FLOOR_VAR = 10;
/** 北岸兩端（垂直切線，接島的側邊）在交界往下多深（加種子 0 到 24） */
const END_DEPTH = 80;
/** 近側：北岸在拱門外框外多遠收進島的側邊（加 0 到 16）；遠側：沙岬在卡片遠緣外多寬才收回（加 0 到 28） */
const NEAR_OUT = 30;
const FAR_OUT = 48;
/**
 * 近側離畫面邊不到 48px（手機）時：走廊兩側 NEAR_FLAT 以內是平的（橋頭），再往畫面邊彎下去，離平段 e 處深 slope × (√(e² + NEAR_BEND²) - NEAR_BEND)，
 * slope 依種子在 NEAR_SLOPE 到 NEAR_SLOPE + NEAR_SLOPE_VAR 之間，最深 NEAR_DROP（畫面外）。375 寬時畫面邊比橋頭深約 30 到 40px；離拱門外緣至少 16px（測試核對）
 */
const NEAR_FLAT = 20;
const NEAR_BEND = 16;
const NEAR_SLOPE = 1.1;
const NEAR_SLOPE_VAR = 0.3;
const NEAR_DROP = 120;
/** 兩島最近的距離（岸到岸；扣掉兩條浪花線，看得到的水面至少 50px） */
const GAP = 56;
/**
 * 上方那一章的島底：入口走廊（交界往上那一段 S 形的路）只墊到交界往上 OPEN_CUT，再往下是橋；遠側沒有空間（兩島在卡片後面接起來）時，
 * 島在卡片後面墊到交界往上 JOIN_CUT（外擴 pad 之後約 64）。岸線最低到交界往上 BOTTOM_MIN（淺水帶不越過交界）
 */
const OPEN_CUT = 112;
/** 卡片上方的海灣：兩端在交界往上 BAY_EDGE，中間再往島內收 BAY（加種子 0 到 24） */
const BAY_EDGE = 118;
const BAY = 40;
const JOIN_CUT = 120;
const BOTTOM_MIN = 28;
/** 橋（第 2 章的 Bridge 同尺寸）：橋面半寬、兩端伸進沙地多少、木板間距 */
const DECK = 18;
const TUCK = 8;
const PLANK = 10;
/** 跨過交界的橋：交界那一端多長的一段切線漸漸換成垂直、越過交界多少（兩截重疊，見 span） */
const SEAM_EASE = 12;
const SEAM_OVER = 2;
/** 海峽頂端那一截棧橋（和地圖組的海峽棧橋同尺寸，layout.ts 的 PIER）：甲板半寬、繩子離中線 */
const PIER_DECK = 20;
const ROPE = 24;

/** 延伸區四章依章序的種子（scenes.tsx 的 EXTENSION_SCENES）：上方那一章用下方那一章的種子畫同一條北岸 */
const ORDER = ['isle-valuation', 'isle-finance', 'isle-stakeholders', 'isle-ledger'];
const belowSeed = (seed: string) => ORDER[(ORDER.indexOf(seed) + ORDER.length - 1) % ORDER.length]!;

export interface Pier {
  readonly x: number;
  readonly y0: number;
  readonly y1: number;
}

/** 跨海的橋（一章畫自己那一截，沿路線的中心線）：橋面中心線、兩側欄杆、木板線、橋柱（只畫在岸上那一端），poly 是橋面外擴 2px 的外框 */
export interface Span {
  readonly deck: string;
  readonly rails: string;
  readonly planks: string;
  readonly posts: string;
  readonly poly: readonly Point[];
}

export interface IsleShape {
  /** 沙地：島、越過交界伸進來的沙岬（同一個 path，nonzero 填色等於聯集） */
  readonly land: string;
  /** 淺水：沙地往外 REEF */
  readonly reef: string;
  /** 草地：島往內 BEACH 加減 BEACH_VAR */
  readonly meadow?: string;
  /** 海峽頂端的棧橋（畫在淺水之上、沙地之下） */
  readonly piers?: readonly Pier[];
  /** 島與島之間的橋（畫在沙地之上） */
  readonly bridges?: readonly Span[];
}

export interface IslePlan {
  readonly blocks: readonly TerrainBlock[];
  readonly shape: IsleShape;
  readonly props: readonly Placed[];
}

export type Beside = 'outer' | 'above' | 'below' | 'above-out' | 'below-out';

export interface IsleCtx {
  readonly geo: SceneGeo;
  /** 島（必須墊住的內容）由上到下的比例 t 換成章高的比例 v（物件底線） */
  readonly v: (t: number) => number;
  /** 軌道裡的候選位置：us 是軌道寬的比例、ts 是島內由上到下的比例 */
  readonly spots: (us: readonly number[], ts: readonly number[]) => Anchor[];
  /** 主角道具放在翼上（桌面）；rest 才有值，手機的小東西可以依它決定要不要放 */
  readonly wide?: boolean;
  /** 翼上緊鄰主角道具的候選：外側（底線對齊，dy 往下）、上方或下方（靠軌道那一端對齊；-out 是靠外側那一端） */
  readonly beside: (hero: Placed, w: number, h: number, where: Beside, dy?: number) => Anchor;
}

export interface IsleSpec {
  readonly seed: string;
  /** 主角道具：先放（ground 寫 site，哪裡都行），島再依它長出來 */
  readonly anchored: (c: IsleCtx) => readonly PropSpec[];
  /** 主角道具在翼上時，緊鄰它的陸上物件（棕櫚、燈、牌子）：依主角道具實際的位置放，島一起墊住 */
  readonly around?: (c: IsleCtx, hero: Placed) => readonly PropSpec[];
  /** 其他物件：島上的 ground 寫 isle 或 meadow，海上的寫 ['sea', '!reef'] 加 whole */
  readonly rest: (c: IsleCtx) => readonly PropSpec[];
  /** 這一章下方是海峽（延伸第 1 章）：南岸畫成深的岬角（海峽的 planStrait 用同樣的 footPoly(geo, x)）；其他章下方是上一座島，島底留給水道 */
  readonly southDeep?: boolean;
}

const area = (poly: readonly Point[]) => poly.reduce((s, a, i) => s + a.x * poly[(i + 1) % poly.length]!.y - poly[(i + 1) % poly.length]!.x * a.y, 0) / 2;
/** 統一成正面積的方向（y 向下時是螢幕上的順時針），nonzero 填色時重疊的子路徑才會聯集，外法線是 (dy, -dx) */
const orient = (poly: Point[]) => (area(poly) < 0 ? poly.reverse() : poly);
const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/** 沿外法線把每個控制點往外（負值往內）推 d（可以每點不同）：淺水帶與草地 */
function offset(pts: readonly Point[], d: number | readonly number[]): Point[] {
  return pts.map((p, i) => {
    const a = pts[(i - 1 + pts.length) % pts.length]!;
    const b = pts[(i + 1) % pts.length]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const k = typeof d === 'number' ? d : d[i]!;
    return { x: p.x + ((b.y - a.y) / len) * k, y: p.y - ((b.x - a.x) / len) * k };
  });
}

/** a 到 b 之間（不含兩端）每 24px 補一點：長的直邊在 organic 推出起伏前要有足夠的點，平滑曲線在轉角也不會甩出去 */
function between(a: Point, b: Point): Point[] {
  const n = Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / 24);
  return Array.from({ length: n }, (_, i) => ({ x: a.x + ((b.x - a.x) * (i + 1)) / (n + 1), y: a.y + ((b.y - a.y) * (i + 1)) / (n + 1) }));
}

/**
 * 必須墊住的東西。core：節點外圈、星星籤、拱門的下半（拱門腳）、紙籤木樁，以及兩段走廊直線以外的路面（物件候選的高度比例依它算；出口走廊在拱門腳以下的那一段也算）；
 * land：再加上入口走廊。下方是海峽時（bottom 為 null）入口走廊整段與章節牌都在島上（島的南端就是章節牌沙灘）；下方是上一座島時，章節牌立在那座島的北岸，
 * 路面只墊到交界往上 bottom（再往下是橋）。有出口時，路線在北岸水道南岸（top）以上的那一截跨海（走廊兩端的路是 S 形，不只直線那一段），交給橋；
 * 最後一章沒有出口，走進拱門的那一段算在島上。
 */
function needs(geo: SceneGeo, cut: { readonly bottom: number | null; readonly top: number | null }): { core: Rect[]; land: Rect[] } {
  const core: Rect[] = [];
  const road = geo.protect.filter((p) => p.kind === 'road');
  const cx = (r: Rect) => (r.x0 + r.x1) / 2;
  let a = 0;
  while (a < road.length && Math.abs(cx(road[a]!) - geo.corridor.entry) < 1) a++;
  let b = road.length;
  const exit = geo.corridor.exit;
  if (exit !== null) while (b > a && Math.abs(cx(road[b - 1]!) - exit) < 1) b--;
  // 出口走廊只有拱門腳以上那一段跨海（交給橋）；拱門腳以下到轉彎處的直路在島上
  const arch = geo.protect.find((p) => p.kind === 'arch');
  const foot = arch ? arch.y1 - 0.45 * (arch.y1 - arch.y0) : 0;
  while (b < road.length && (road[b]!.y0 + road[b]!.y1) / 2 > foot + 16) b++;
  const dry = (r: Rect) => {
    const y = (r.y0 + r.y1) / 2;
    return (cut.bottom === null || y < geo.h - cut.bottom) && (cut.top === null || y > cut.top);
  };
  core.push(...road.slice(a, b).filter(dry));
  const extra: Rect[] = road.slice(0, a).filter(dry);
  for (const p of geo.protect) {
    if (p.kind === 'node' || p.kind === 'stars') core.push(p);
    // 木樁只墊腳下 40px：字級放大時紙籤釘在章末區頂端，木樁是一根從紙籤後面一路插到地上的長柱（地圖組第 4 輪），島只要墊住插進地裡的那一截
    else if (p.kind === 'stake') core.push({ ...p, y0: Math.max(p.y0, p.y1 - 40) });
    else if (p.kind === 'arch') core.push({ ...p, y0: p.y1 - 0.45 * (p.y1 - p.y0) });
    else if (p.kind === 'banner' && cut.bottom === null) extra.push(p);
    // 紙籤整張在島上（字級放大時是釘在章末區頂端的高卡片）：上半由北岸的沙岬墊住，下半由島的側邊墊住；
    // 最上面那一章（沒有出口）見 topPlaque（第 6 輪看圖驗收：紙籤左側一截懸在海上）
    else if (p.kind === 'plaque') extra.push(...(cut.top !== null ? [p] : topPlaque(geo, p)));
  }
  const land = [...core, ...extra].map((r) => (r.y1 > geo.h - 2 ? { ...r, y1: geo.h - 2 } : r));
  return { core, land };
}

/** 字級放大時（layout 的 zoomed）紙籤貼齊章頂、木樁是一根從地面立到紙籤後面的長柱：木樁保護框比 100% 時（16 加外擴 24）高很多 */
export function plaqueZoomed(geo: SceneGeo): boolean {
  const stake = geo.protect.find((p) => p.kind === 'stake');
  return !!stake && stake.y1 - stake.y0 > 60;
}

/**
 * 最上面那一章（沒有出口，島頂沒有北岸）的紙籤要墊住的範圍（第 6 輪看圖驗收：紙籤左側一截懸在海上，只有木樁站在沙地上）。保護框左右再外擴 8，島（外擴 PAD 加起伏）的西北角離卡片左緣 48px 以上。
 * - 字級 100%、桌面與平板：保護框是最高的那一張（128），實際的卡片貼著下緣，中文 67、英文最高約 80px；墊住下緣往上 TOP_CARD 的那一段，
 *   島頂（外擴之前）在卡片上方 12px 以上，往上到 SEAM + 24 之間給 organic 推出起伏，島和地圖上緣的接縫之間是海。
 * - 字級放大：卡片貼齊章頂往下 32px，整個保護框都墊住，島越過地圖上緣的接縫（那一段像伸出地圖外的半島），IsleScene 把接縫蓋回去。
 * - 手機，或紙籤與拱門已經從畫面一邊排到另一邊（600 寬左右）：卡片比較高（英文 320 寬約 138px），整個保護框都墊住，另外整排墊到地圖上緣：
 *   島頂越過接縫、鋪滿整個寬度（島本來就貼滿兩側，不在上緣留一條細細的海或一角海）。桌面放大時不這樣做，否則兩翼會多出一條貼著地圖上緣的細長陸地
 */
function topPlaque(geo: SceneGeo, p: Rect): Rect[] {
  const r = { x0: p.x0 - 8, x1: p.x1 + 8, y0: p.y0 - 4, y1: p.y1 };
  // 紙籤與拱門加起來已經從畫面一邊到另一邊（島頂兩端都推到畫面外）：島頂鋪到地圖上緣，不在上緣留一條細細的海
  const arch = geo.protect.find((k) => k.kind === 'arch') ?? r;
  const wide = Math.min(r.x0, arch.x0) - PAD < 48 && Math.max(r.x1, arch.x1) + PAD > geo.bandW - 48;
  if (geo.bp === 'compact' || wide) return [r, { x0: -60, x1: geo.bandW + 60, y0: -40, y1: Math.min(p.y0, SEAM) }];
  return [plaqueZoomed(geo) ? r : { ...r, y0: Math.max(r.y0, p.y1 - TOP_CARD) }];
}

/**
 * 章節牌卡片的左右範圍（和 layout.ts 的章節牌同一個算法：卡片在走廊 x 的另一側，走廊側內縮 = 走廊內縮 + 路寬一半 + 16，最寬 440、medium 398）。
 * 下方那一段沒有上一章的保護框，只能用走廊 x、軌道與斷點算；測試核對它和每一章實際的章節牌一致
 */
export function bannerSpan(geo: SceneGeo, x: number): { readonly c0: number; readonly c1: number } {
  const { left, right } = geo.track;
  const inset = (geo.bp === 'compact' ? 44 : 56) + 26;
  const maxW = geo.bp === 'compact' ? right - left - inset : geo.bp === 'medium' ? 398 : 440;
  return x < (left + right) / 2 ? { c0: Math.max(left + inset, right - maxW), c1: right } : { c0: left, c1: Math.min(right - inset, left + maxW) };
}

/**
 * 延伸第 1 章（下方是海峽）的南岸：章節牌那一端的岬角，交界座標（y = 0 是上面那一章的下緣，往下為正），x 是那一章的入口走廊。
 * 範圍從走廊外 130 到章節牌遠側外 90（立柱腳下至少 8px 沙地）；離畫面邊不到 48px 時推到畫面外。
 * 形狀：中段越過交界 DIP 到 DIP + BULGE（中間最深），兩端各一段寬 END 的四分之一橢圓收到交界上方 RISE、切線垂直，加一點起伏（相位只依走廊 x）。
 * 只用走廊 x、軌道、區帶寬與斷點算，延伸第 1 章與海峽各算一次結果一樣
 */
export function southShore(geo: SceneGeo, x: number): Point[] {
  const { c0, c1 } = bannerSpan(geo, x);
  const left = x < (geo.track.left + geo.track.right) / 2;
  let e0 = left ? x - 130 : c0 - 90;
  let e1 = left ? c1 + 90 : x + 130;
  if (e0 < 48) e0 = -80;
  if (e1 > geo.bandW - 48) e1 = geo.bandW + 80;
  const m = (e0 + e1) / 2;
  const hw = (e1 - e0) / 2;
  const ph = (x / 53) % 6.28;
  // 兩端的弧取點密一點（4、10、18、28、40），中段每 16px
  const xs = [0, 4, 10, 18, 28, 40];
  const n = Math.max(1, Math.round((e1 - e0 - 2 * END) / 16));
  const at = [
    ...xs.map((d) => e0 + d),
    ...Array.from({ length: n + 1 }, (_, i) => e0 + END + ((e1 - e0 - 2 * END) * i) / n),
    ...[...xs].reverse().map((d) => e1 - d),
  ];
  return at.map((px, i) => {
    const u = (px - m) / hw;
    const v = Math.max(0, 1 - Math.min(px - e0, e1 - px) / END);
    const k = i === 0 || i === at.length - 1 ? 0 : 1;
    return { x: px, y: -RISE + (DIP + BULGE * (1 - u * u) + RISE) * Math.sqrt(Math.max(0, 1 - v * v)) + k * 1.5 * (1 - v) * Math.sin(px / 41 + ph) };
  });
}

/** 延伸第 1 章的南岸越過交界的那一截（海峽的區段座標，交界是 y = 0）；x 是延伸第 1 章的入口走廊 */
export function footPoly(geo: SceneGeo, x: number): Point[] {
  const pts = southShore(geo, x);
  const a = pts[0]!;
  const b = pts[pts.length - 1]!;
  return orient([{ x: a.x, y: -90 }, ...pts, { x: b.x, y: -90 }]);
}

export interface North {
  /** 控制點（交界座標：y = 0 是交界、往下為正；x 由小到大） */
  readonly pts: readonly Point[];
  /** 水道南岸在走廊 x 的深度（橋的下端在它往下 TUCK） */
  readonly floor: number;
  /** 遠側沒有空間（離畫面邊不到 48px）：沙岬一路到畫面外，兩島在卡片後面接起來 */
  readonly joined: boolean;
}

/**
 * 有出口的章的島頂（北岸），交界座標；x 是出口走廊（上一章的入口走廊），seed 是這一章（下面那一章）的種子。u 是從走廊往章節牌那一側的距離：
 * - 近側（u 小於 0）：島的側邊在拱門外框外 NEAR_OUT 到 NEAR_OUT + 16 的地方以垂直切線轉上來（四分之一橢圓，寬 48），到拱門上方是水道的南岸，
 *   深 FLOOR 到 FLOOR + FLOOR_VAR（離拱心石頂至少 16，淺水帶不越過交界），橋從這裡上岸，走廊兩側 20px 內是平的（橋頭不被岸線斜切）；
 * - 走廊外 20 到近側立柱外 8px：平滑地陡升到 CAPE_TOP（越過交界的沙岬，章節牌的兩根立柱站在上面，腳下至少 12px 沙地）；
 * - 卡片後面：CAPE_TOP；
 * - 遠側：遠側立柱外 8px 起用四分之一橢圓收回島的側邊（卡片遠緣外 FAR_OUT 到 FAR_OUT + 28，深 END_DEPTH 到 END_DEPTH + 24）；離畫面邊不到 48px 時沙岬一路到畫面外。
 * 只用走廊 x、軌道、區帶寬、斷點與種子算，上下兩章各算一次結果一樣
 */
export function northShore(geo: SceneGeo, x: number, seed: string): North {
  const rand = seededRandom(hashSeed(`${seed}-north`));
  const sgn = x < (geo.track.left + geo.track.right) / 2 ? 1 : -1;
  const { c0, c1 } = bannerSpan(geo, x);
  const near = sgn > 0 ? c0 - x : x - c1;
  const far = sgn > 0 ? c1 - x : x - c0;
  const floor = FLOOR + FLOOR_VAR * rand();
  const depth = END_DEPTH + 24 * rand();
  const uA = -(48 + NEAR_OUT + 16 * rand());
  const uB = far + FAR_OUT + 28 * rand();
  const slope = NEAR_SLOPE + NEAR_SLOPE_VAR * rand();
  const X = (u: number) => x + sgn * u;
  const off = (u: number) => X(u) < 48 || X(u) > geo.bandW - 48;
  // 區帶邊外 80 的 u（近側為負）
  const edge = (side: 1 | -1) => side * (sgn * side > 0 ? geo.bandW + 80 - x : x + 80);
  const nearCut = off(uA);
  const joined = off(uB);
  const u0 = nearCut ? edge(-1) : uA;
  const u1 = joined ? edge(1) : uB;
  // 陡升：從走廊（橋的中線）到近側立柱外 2px，先一段往上彎的四分之一橢圓（凹角的曲率半徑 20 以上）、再一段收平的四分之一橢圓，接點是垂直切線
  const rise0 = 0;
  const rise1 = near + 22;
  const fall0 = far - 22;
  const ju = rise0 + 0.55 * (rise1 - rise0);
  const jy = (floor + CAPE_TOP) / 2;
  const y = (u: number): number => {
    if (!nearCut && u < u0 + 48) {
      const t = (u0 + 48 - u) / 48;
      return floor + (depth - floor) * (1 - Math.sqrt(Math.max(0, 1 - t * t)));
    }
    // 近側推到畫面外（手機）：橋頭以外往畫面邊彎下去，灣口張開（第 6 輪看圖驗收：原本平平地伸到畫面外，淺水帶在交界下方是一條約 42px 的水平直邊）
    if (nearCut && u < -NEAR_FLAT) {
      const e = -NEAR_FLAT - u;
      return floor + Math.min(NEAR_DROP, slope * (Math.hypot(e, NEAR_BEND) - NEAR_BEND));
    }
    if (u <= rise0) return floor;
    if (u < ju) {
      const t = (u - rise0) / (ju - rise0);
      return floor - (floor - jy) * (1 - Math.sqrt(Math.max(0, 1 - t * t)));
    }
    if (u < rise1) {
      const t = (rise1 - u) / (rise1 - ju);
      return CAPE_TOP + (jy - CAPE_TOP) * (1 - Math.sqrt(Math.max(0, 1 - t * t)));
    }
    if (joined || u <= fall0) return CAPE_TOP;
    const t = Math.min(1, (u - fall0) / (u1 - fall0));
    return CAPE_TOP + (depth - CAPE_TOP) * (1 - Math.sqrt(Math.max(0, 1 - t * t)));
  };
  const us: number[] = [];
  const add = (a: number, b: number, step: number) => {
    const n = Math.max(1, Math.round((b - a) / step));
    for (let i = 0; i < n; i++) us.push(a + ((b - a) * i) / n);
  };
  // 垂直切線的兩端與陡升的那一段取點密一點；近側往下彎的那一段每 6px 一點
  if (nearCut) {
    add(u0, -NEAR_FLAT, 6);
    add(-NEAR_FLAT, rise0, 10);
  } else {
    us.push(...[0, 2, 6, 12, 20, 30, 40].map((d) => u0 + d));
    add(u0 + 48, rise0, 14);
  }
  // 接點附近是垂直切線，取點密一點
  us.push(...[0, 0.3, 0.55, 0.72, 0.84, 0.92, 0.97].map((t) => rise0 + (ju - rise0) * t));
  us.push(...[0, 0.03, 0.08, 0.16, 0.28, 0.45, 0.7].map((t) => ju + (rise1 - ju) * t));
  if (joined) add(rise1, u1, 24);
  else {
    add(rise1, fall0, 24);
    const w = u1 - fall0;
    us.push(...[0, 0.3, 0.5, 0.65, 0.77, 0.86, 0.93, 0.97, 0.99].map((t) => fall0 + w * t));
  }
  us.push(u1);
  const pts = us.map((u) => ({ x: X(u), y: y(u) }));
  return { pts: sgn > 0 ? pts : pts.reverse(), floor, joined };
}

/** 上方那一章畫的那一截：下方那一章的北岸越過交界的沙岬（這一章的區段座標，交界是 y = geo.h；收尾的點在交界下方，畫不到） */
export function headPoly(geo: SceneGeo, north: North): Point[] {
  const a = north.pts[0]!;
  const b = north.pts[north.pts.length - 1]!;
  return orient([{ x: a.x, y: geo.h + 150 }, ...north.pts.map((p) => ({ x: p.x, y: p.y + geo.h })), { x: b.x, y: geo.h + 150 }]);
}

/**
 * 島的控制點：掃描線取每列的左右極值（envelope，外擴 pad），再用 organic 往外推出不等大的岬角與海灣（振幅 0 到 2 × amp，波長 160 到 220 與 300 到 380）。
 * south（延伸第 1 章）：島的南端換成 southShore，兩側在章底往上 150px 內漸漸靠到南岸的兩端；north（有出口的章）：島頂換成 northShore，兩側在頂端 150px 內靠到北岸的兩端。
 * 兩者的控制點都不推（和另一章畫的那一截是同一串點）。沒有 south 時島底是外擴後的那一列，每 24px 補一點讓 organic 推出起伏。
 * 離畫面邊不到 48px 的岸線推到畫面外：手機上不會在邊緣留下一條細細的海
 */
function outline(
  rects: readonly Rect[],
  pad: number,
  geo: SceneGeo,
  seed: string,
  amp: number,
  edges: { readonly south: readonly Point[] | null; readonly north: readonly Point[] | null },
): Point[] {
  const { south, north } = edges;
  const n0 = north?.[0];
  const n1 = north?.[north.length - 1];
  // 有北岸時，掃描線從北岸兩端再往下 24 開始（北岸兩端在第一列之上，控制點的順序不會折返）
  const top = n0 && n1 ? Math.max(n0.y, n1.y, FLOOR + FLOOR_VAR) + 24 : Math.min(...rects.map((r) => r.y0)) - pad;
  const bottom = south ? geo.h - 60 : Math.max(...rects.map((r) => r.y1)) + pad;
  const env = envelope(rects, pad, top, bottom, 12);
  const snapL = (x: number) => (x < 48 ? -80 : x);
  const snapR = (x: number) => (x > geo.bandW - 48 ? geo.bandW + 80 : x);
  const s0 = south?.[0];
  const s1 = south?.[south.length - 1];
  const wS = (y: number) => smooth((y - (geo.h - 210)) / 150);
  const wN = (y: number) => 1 - smooth((y - top) / 150);
  const side = (xs: readonly number[], end: Point | undefined, near: Point | undefined, out: (a: number, b: number) => number, snap: (x: number) => number) =>
    env.ys.map((y, i) => {
      let v = xs[i]!;
      if (end) v = out(v, v + (end.x - v) * wS(y));
      // 北岸那一端兩個方向都靠過去（北岸是另一章也要畫的同一串點，島的側邊要接上它）
      if (near) v += (near.x - v) * wN(y);
      return snap(v);
    });
  const L0 = side(env.L, s0, n0, Math.min, snapL);
  const R0 = side(env.R, s1, n1, Math.max, snapR);
  // 凹處用半徑 CLOSE 的圓收圓（形態學的閉運算：先往外長 CLOSE、再往內收 CLOSE，只會補上陸地）：海灣是緩的弧，
  // 節點區、章節牌區與半島接合的地方沒有尖角缺口（第 2 輪看圖驗收）；比 CLOSE 窄的小缺口直接補平
  const close = (xs: number[], sgn: number) => {
    // 上下各多 CLOSE 的空列（沒有陸地），閉運算在島頭島尾才不會把頂端拉平
    const k = Math.ceil(CLOSE / 12);
    const step = env.ys.length > 1 ? env.ys[1]! - env.ys[0]! : 12;
    const ys = [
      ...Array.from({ length: k }, (_, i) => env.ys[0]! - step * (k - i)),
      ...env.ys,
      ...Array.from({ length: k }, (_, i) => env.ys[env.ys.length - 1]! + step * (i + 1)),
    ];
    const none = sgn < 0 ? Infinity : -Infinity;
    const v = [...Array<number>(k).fill(none), ...xs, ...Array<number>(k).fill(none)];
    const reach = (arr: number[], i: number, d: number, pick: (a: number, b: number) => number) => {
      let best = arr[i]! + d * CLOSE;
      for (let j = 0; j < ys.length; j++) {
        const dy = Math.abs(ys[j]! - ys[i]!);
        if (j !== i && dy < CLOSE) best = pick(best, arr[j]! + d * Math.sqrt(CLOSE * CLOSE - dy * dy));
      }
      return best;
    };
    const out = sgn < 0 ? Math.min : Math.max;
    const inn = sgn < 0 ? Math.max : Math.min;
    const grown = v.map((_, i) => reach(v, i, sgn, out));
    return grown.map((_, i) => reach(grown, i, -sgn, inn)).slice(k, k + xs.length);
  };
  const Ls = close(L0, -1);
  const Rs = close(R0, 1);
  // 最上面那一章（沒有北岸）：最上面那一列的兩端往內收 TOP_CHAMFER（外擴的那一列和下一列同寬，島頂兩角是直角）
  const cham = (x: number, d: number, i: number) => (i === 0 && !north && x > -40 && x < geo.bandW + 40 ? x + d : x);
  const L = env.ys.map((y, i) => ({ x: cham(Ls[i]!, TOP_CHAMFER, i), y }));
  const R = env.ys.map((y, i) => ({ x: cham(Rs[i]!, -TOP_CHAMFER, i), y }));
  const tail = south ? south.map((p) => ({ x: p.x, y: p.y + geo.h })) : between(L[L.length - 1]!, R[R.length - 1]!);
  // 最上面那一章的島頂（沒有北岸）：外擴之後是一整排同高的點，靠近地圖上緣時 organic 幾乎不推（topMin），紙籤墊在島上之後這一排有好幾百 px 長；
  // 先往島內加一道 0 到 TOP_WAVE 的起伏（主波長約 160、振幅 0.4 × TOP_WAVE，任何 200px 內都高低差 5px 以上），岸線不會拉成一條橫線（紙籤的墊住範圍已經把它算進去，見 TOP_CARD）
  const rand = seededRandom(hashSeed(`${seed}-top`));
  const ph1 = rand() * 6.28;
  const ph2 = rand() * 6.28;
  // 兩端 48px 內漸漸收回 0，和兩側的圓角接得順（不在轉角折出一個岬角）
  const ends = (x: number) => smooth(Math.min(x - L[0]!.x, R[0]!.x - x) / 48);
  const head = north
    ? [...north].reverse()
    : between(R[0]!, L[0]!).map((p) => ({ x: p.x, y: p.y + TOP_WAVE * ends(p.x) * (0.5 + 0.4 * Math.sin(p.x / 26 + ph1) + 0.1 * Math.sin(p.x / 11 + ph2)) }));
  const ctrl = orient([...L, ...tail, ...[...R].reverse(), ...head]);
  const yKeep = geo.h - 36;
  // 最上面那一章的島頂：起伏不推過 SEAM + 24（第 6 輪看圖驗收後紙籤也墊在島上，島頂比較長）；淺水帶離接縫波浪的距離最後另外守住（見 outline 的結尾）
  const topMin = SEAM + 24;
  // 北岸與南岸的點不推；島頂（最上面那一章）在接縫附近收小；北岸下面的側邊從 0 漸漸放開；
  // 沒有南岸的島底（水道的北岸）只推 0.35：岸線跟著路線與星星籤的高低走，卡片上方留得住一道看得到的水面
  // 最上面那一章的島頂（加了往內的起伏的那一排）不推：往外推會把起伏的低處推回去，又拉成一條橫線
  const flatTop = (p: Point) => !north && p.y < top + TOP_WAVE + 0.5 && p.x > L[0]!.x - 1 && p.x < R[0]!.x + 1;
  const keep = (p: Point) =>
    p.x < -40 || p.x > geo.bandW + 40 || (south && p.y > yKeep) || (north && p.y < top) || flatTop(p)
      ? 0
      : Math.min(1, north ? (p.y - top) / 60 : (p.y - topMin) / (2 * amp), south ? (yKeep - p.y) / 60 : 0.35 + 0.65 * smooth((geo.h - 150 - p.y) / 90));
  const pts = organic(ctrl, seed, amp, keep, 24, 160, 300);
  // 往外推之後，凹進去的點再往前後兩點的中點挪一半（只會補上陸地）三次：海灣的底與接合處是圓的，沒有尖角缺口（內角 150 度以上）。
  // 北岸在交界往下 40 以下的那一段（兩端接島的側邊）也一起收：上一章畫的那一截看不到這麼深
  const soft = (p: Point) => keep(p) > 0 || (north !== null && p.y > 40 && p.x > -40 && p.x < geo.bandW + 40);
  for (let it = 0; it < 3; it++)
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i - 1 + pts.length) % pts.length]!;
      const b = pts[i]!;
      const c = pts[(i + 1) % pts.length]!;
      if (!soft(b) || (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) >= 0) continue;
      pts[i] = { x: (b.x + (a.x + c.x) / 2) / 2, y: (b.y + (a.y + c.y) / 2) / 2 };
    }
  // 最上面那一章（島頂在地圖上緣的接縫下方）：淺水外緣（沙地往外 REEF，再加 1.5px 的浪花線）離接縫的波浪至少 TOP_GAP，
  // 每一點看前後 24px 內波浪最低的地方（第 7 輪看圖驗收：topMin 只照接縫的名目位置，波谷處淺水碰到地圖上緣的波浪，深水帶斷掉、島像被壓在頂邊上）。
  // 紙籤卡片上方 12px 仍是沙地（波浪最低在 23，島頂最低約 49，卡片最高的那一張頂端在 72）
  // 淺水帶在島頂可以收窄到 REEF_MIN（topReef），島頂只在連 REEF_MIN 都放不下的地方往下收
  if (!north && top > 0) {
    const low = seamLow(geo);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!;
      const floor = low(p.x) + TOP_GAP + REEF_MIN + 1.5 + 2;
      if (p.y < floor) pts[i] = { x: p.x, y: floor };
    }
  }
  return pts;
}

/** 接縫波浪在 x 前後 24px 內最低的地方（y 最大） */
function seamLow(geo: SceneGeo): (x: number) => number {
  const wave = seamWave(geo);
  return (x) => {
    let w = -Infinity;
    for (let dx = -24; dx <= 24; dx += 4) w = Math.max(w, waveAt(wave, x + dx));
    return w;
  };
}

/**
 * 最上面那一章（島頂在地圖上緣的接縫下方）的淺水寬度：島頂離接縫的波浪不夠遠的地方，淺水帶從 REEF 收窄到 REEF_MIN，
 * 淺水外緣（加 1.5px 的浪花線）離波浪至少 TOP_GAP（第 7 輪看圖驗收：淺水碰到地圖上緣的波浪，深水帶斷掉）；其他章是 null（一律 REEF）
 */
function topReef(geo: SceneGeo, ctrl: readonly Point[]): number[] | null {
  if (geo.corridor.exit !== null || Math.min(...ctrl.map((p) => p.y)) <= 0) return null;
  const low = seamLow(geo);
  return ctrl.map((p) => Math.min(REEF, Math.max(REEF_MIN, p.y - low(p.x) - TOP_GAP - 1.5 - 1)));
}

/**
 * 上方那一章的島底，遠側沒有空間（下方那一章的沙岬一路到畫面外）時：島在卡片後面墊到交界往上 JOIN_CUT，遠側再往下接到沙岬
 * （兩島在卡片後面接起來，交界下方由下面那一章的沙岬蓋住），水道只從走廊那一側出海，卡片上方不會留下一池圍起來的水。
 * 遠側有空間時島底就是內容外擴（卡片後面與上方是水道，章節牌像立在岸邊的路牌）
 */
function under(geo: SceneGeo, below: North): Rect[] {
  const ban = geo.protect.find((p) => p.kind === 'banner');
  if (!ban || !below.joined) return [];
  const x = geo.corridor.entry;
  const left = x < (geo.track.left + geo.track.right) / 2;
  const { c0, c1 } = bannerSpan(geo, x);
  const y0 = ban.y0 + 12;
  const y1 = geo.h - JOIN_CUT;
  return left
    ? [
        { x0: x - 10, x1: geo.bandW + 200, y0, y1 },
        { x0: c1 - 60, x1: geo.bandW + 200, y0, y1: geo.h - 10 },
      ]
    : [
        { x0: -200, x1: x + 10, y0, y1 },
        { x0: -200, x1: c0 + 60, y0, y1: geo.h - 10 },
      ];
}

/**
 * 上方那一章的島底（水道的北岸）：離下方那一章的北岸至少 GAP（岸到岸，圓的包絡），也不低於交界往上 BOTTOM_MIN；
 * 遠側有空間時，卡片上方的岸線再往島內收成一個海灣（中間最深 BAY 加種子 0 到 24，收到路面與星星籤下方 12px 為止），水道在卡片上方一端寬、一端窄，岸線不是一條橫線。
 * 兩島接起來的那一段（遠側沒有空間時）不動
 */
function shoreAbove(pts: readonly Point[], geo: SceneGeo, below: North, must: readonly Rect[], seed: string): Point[] {
  const src = below.pts.map((p) => ({ x: p.x, y: p.y + geo.h }));
  const dense: Point[] = [];
  for (let i = 0; i < src.length - 1; i++) {
    const a = src[i]!;
    const b = src[i + 1]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
    for (let k = 0; k < n; k++) dense.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  const x = geo.corridor.entry;
  const left = x < (geo.track.left + geo.track.right) / 2;
  const { c0, c1 } = bannerSpan(geo, x);
  // 兩島接起來的那一段（under 的第二塊往外 pad）不動，往走廊那一側 48px 內漸漸放開（卡片後面，不留下台階）
  const free = (px: number) => (below.joined ? smooth((left ? c1 - 88 - px : px - (c0 + 88)) / 48) : 1);
  const rand = seededRandom(hashSeed(`${seed}-bay`));
  const depth = BAY + 24 * rand();
  const ph = rand() * 6.28;
  // 海灣從卡片近緣往內 40 開始（走廊那一截陸地旁邊不收），到卡片遠緣
  const b0 = left ? c0 + 40 : c0;
  const b1 = left ? c1 : c1 - 40;
  const bay = (px: number) => {
    const t = (px - b0) / (b1 - b0);
    if (below.joined || t <= 0 || t >= 1) return Infinity;
    const k = Math.sin(Math.PI * t);
    // 海灣的弧上再加一道波長約 150 的起伏（兩端收掉），岸線在卡片上方不會是一段平的弧頂
    return geo.h - BAY_EDGE - depth * k ** 0.8 + 7 * k * Math.sin(px / 24 + ph);
  };
  // 這一點以上一定要是陸地：路面、星星籤等保護框的下緣再往下 3 到 21（沿岸起伏，岸線貼著路走時也不和路平行）
  const need = (px: number) =>
    Math.max(-Infinity, ...must.filter((r) => r.x0 - 16 <= px && px <= r.x1 + 16 && r.y1 < geo.h - 40).map((r) => r.y1 + 12 + 9 * Math.sin(px / 22 + ph)));
  // 要調整的是島底那一段：章節牌卡片（最高的那一張）上方 30px 以下；字級放大時卡片比較高
  const ban = geo.protect.find((p) => p.kind === 'banner');
  const yLow = Math.min(geo.h - 240, (ban?.y0 ?? geo.h) - 30);
  const low = (p: Point) => p.y >= yLow;
  // 從 yLow 往下 48px 內漸漸放開，和上面不調整的岸線接起來沒有折角
  const lw = (p: Point) => smooth((p.y - yLow) / 48);
  // 島底再加一道波長約 210、振幅 14 的起伏（平滑之後約 10；路面是一段直路時，岸線也不會跟著拉成一條直線）
  const wave = (px: number) => 14 * Math.sin(px / 34 + 2 * ph);
  const lims = pts.map((p) => {
    let lim = geo.h - BOTTOM_MIN;
    if (low(p))
      for (const q of dense) {
        const dx = Math.abs(q.x - p.x);
        if (dx < GAP) lim = Math.min(lim, q.y - Math.sqrt(GAP * GAP - dx * dx));
      }
    return lim;
  });
  // 每一點先收到目標（離北岸 GAP、卡片上方的海灣、路面下方 12px），再沿岸線做三次平滑（前後兩點各 1/4），最後守住離北岸 GAP 與路面下方 12px：
  // 海灣與水道的邊是平順的，路線末端那一截陸地的角也不會被收得太尖
  const fix = (q: Point, i: number) => {
    const p = pts[i]!;
    let y = Math.max(q.y, Math.min(p.y, need(q.x)));
    const w = free(q.x);
    if (w > 0) y = Math.min(y, p.y + (lims[i]! - p.y) * w);
    return { x: q.x, y };
  };
  const n = pts.length;
  let cur = pts.map((p, i) => {
    if (!low(p)) return p;
    const y0 = Math.min(p.y + wave(p.x), lims[i]!);
    const y = y0 > bay(p.x) ? Math.min(y0, Math.max(bay(p.x), need(p.x))) : y0;
    return fix({ x: p.x, y: p.y + (y - p.y) * free(p.x) * lw(p) }, i);
  });
  for (let it = 0; it < 3; it++)
    cur = cur.map((q, i) => {
      if (!low(pts[i]!)) return q;
      const a = cur[(i - 1 + n) % n]!;
      const b = cur[(i + 1) % n]!;
      const w = lw(pts[i]!);
      return fix({ x: q.x + ((a.x + 2 * q.x + b.x) / 4 - q.x) * w, y: q.y + ((a.y + 2 * q.y + b.y) / 4 - q.y) * w }, i);
    });
  return cur;
}

function covers(poly: readonly Point[], rects: readonly Rect[]): boolean {
  return rects.every((r) =>
    [
      [r.x0, r.y0],
      [r.x1, r.y0],
      [r.x0, r.y1],
      [r.x1, r.y1],
      [(r.x0 + r.x1) / 2, r.y0],
      [(r.x0 + r.x1) / 2, r.y1],
    ].every(([x, y]) => pointInPoly({ x: x!, y: y! }, poly)),
  );
}

/** 沙地多邊形（控制點）換成畫出來的沙地與淺水 */
export function landAndReef(
  ctrl: readonly Point[][],
  widths: readonly number[] | null = null,
): { land: { d: string; poly: Point[] }[]; reef: { d: string; poly: Point[] }[] } {
  return { land: ctrl.map((c) => smoothClosed(c, 3)), reef: ctrl.map((c, i) => smoothClosed(offset(c, i === 0 && widths ? widths : REEF), 3)) };
}

/** 海峽頂端棧橋的地形塊（甲板加繩柱）：海上的物件不得碰到它 */
export const pierPoly = (p: Pier): Point[] => rectPoly({ x0: p.x - ROPE - 2, y0: p.y0, x1: p.x + ROPE + 2, y1: p.y1 });

const r1 = (n: number) => Math.round(n * 10) / 10;

/** 路線的中心線：道路保護框（layout 每 8px 一點、依路線順序）的中心，相鄰重複的點去掉 */
function routeLine(geo: SceneGeo): Point[] {
  const out: Point[] = [];
  for (const r of geo.protect) {
    if (r.kind !== 'road') continue;
    const p = { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 };
    const q = out[out.length - 1];
    if (!q || Math.hypot(p.x - q.x, p.y - q.y) > 0.5) out.push(p);
  }
  return out;
}

/** 折線的弧長參數化：at(s) 是弧長 s 的位置與單位切線（切線取前後 3px 的弦） */
function arcOf(pts: readonly Point[]) {
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  const total = len[len.length - 1]!;
  const pos = (s: number): Point => {
    const t0 = Math.min(total, Math.max(0, s));
    let i = 1;
    while (i < pts.length - 1 && len[i]! < t0) i++;
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const t = Math.min(1, Math.max(0, (t0 - len[i - 1]!) / Math.max(0.01, len[i]! - len[i - 1]!)));
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  };
  const at = (s: number) => {
    const p = pos(s);
    const a = pos(s - 3);
    const b = pos(s + 3);
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: p.x, y: p.y, tx: (b.x - a.x) / l, ty: (b.y - a.y) / l };
  };
  return { total, at };
}

/**
 * 一座橋（第 2 章的 Bridge）：弧長 a 到 b 的子路徑。橋身沿路線的切線；木板線從 seam（交界那一端的弧長）起每 PLANK 一條，上下兩章畫的那兩截接得起來；
 * 橋柱只畫在岸上那一端（capA、capB）。
 * 交界那一端（第 6 輪看圖驗收：上下兩截之間有一道約 1px 的水色縫，兩側欄杆錯開約 1px）：路線在交界上是垂直的（layout 的走廊兩端），
 * 但每章只拿得到自己那一側的取樣點，取樣弦的切線在交界上斜了幾度，橋頭的平頭與欄杆端點因此一高一低。所以交界那一端 SEAM_EASE 以內的切線漸漸換成垂直
 * （上下兩章算出同一組欄杆 x），再沿垂直方向越過交界 SEAM_OVER（另一章那一側，被區段裁掉），兩截在交界上重疊、沒有縫
 */
function span(A: ReturnType<typeof arcOf>, a: number, b: number, seam: number | null, capA: boolean, capB: boolean): Span {
  const at = (s: number) => {
    const p = A.at(s);
    if (seam === null) return p;
    const w = smooth(1 - Math.abs(s - seam) / SEAM_EASE);
    if (w <= 0) return p;
    const tx = p.tx * (1 - w);
    const ty = p.ty * (1 - w) + (p.ty < 0 ? -w : w);
    const l = Math.hypot(tx, ty) || 1;
    return { ...p, tx: tx / l, ty: ty / l };
  };
  const n = Math.max(2, Math.ceil((b - a) / 4));
  const P = Array.from({ length: n + 1 }, (_, i) => at(a + ((b - a) * i) / n));
  if (seam !== null) {
    // 越過交界的那一點：沿垂直的切線往區段外 SEAM_OVER
    const e = seam === a ? P[0]! : P[P.length - 1]!;
    const d = seam === a ? -SEAM_OVER : SEAM_OVER;
    const q = { ...e, x: e.x + e.tx * d, y: e.y + e.ty * d };
    if (seam === a) P.unshift(q);
    else P.push(q);
  }
  // 法線 (-ty, tx)
  const off = (k: number) => P.map((p) => ({ x: p.x - p.ty * k, y: p.y + p.tx * k }));
  const line = (q: readonly Point[]) => `M${q.map((p) => `${r1(p.x)} ${r1(p.y)}`).join('L')}`;
  const planks: string[] = [];
  const from = seam === null ? a + PLANK / 2 : seam === a ? a + PLANK / 2 : b - PLANK / 2 - Math.floor((b - a - PLANK / 2) / PLANK) * PLANK;
  for (let s = from; s < b - 2; s += PLANK) {
    if (s < a + 2) continue;
    const p = at(s);
    planks.push(`M${r1(p.x + p.ty * DECK)} ${r1(p.y - p.tx * DECK)}L${r1(p.x - p.ty * DECK)} ${r1(p.y + p.tx * DECK)}`);
  }
  const posts: string[] = [];
  for (const s of [...(capA ? [a + 3] : []), ...(capB ? [b - 3] : [])]) {
    const p = at(s);
    for (const k of [-DECK, DECK]) {
      const cx = p.x - p.ty * k;
      const cy = p.y + p.tx * k;
      const q = [
        [3, 3],
        [3, -3],
        [-3, -3],
        [-3, 3],
      ].map(([u, v]) => `${r1(cx + p.tx * u! - p.ty * v!)} ${r1(cy + p.ty * u! + p.tx * v!)}`);
      posts.push(`M${q.join('L')}Z`);
    }
  }
  return {
    deck: line(P),
    rails: `${line(off(-DECK))}${line(off(DECK))}`,
    planks: planks.join(''),
    posts: posts.join(''),
    poly: [...off(-DECK - 2), ...off(DECK + 2).reverse()],
  };
}

/**
 * 路線跨海的每一段各一座橋：沿路線每 2px 檢查在不在沙地上（不到 6px 的擦邊不算）。碰到區段上下緣的那一段是跨過交界的橋（另一截由另一章畫），
 * 那一端不伸出、不畫橋柱；岸上那一端多伸 TUCK
 */
function spans(geo: SceneGeo, land: readonly (readonly Point[])[]): Span[] {
  const road = routeLine(geo);
  if (road.length < 2) return [];
  const A = arcOf(road);
  const wet = (s: number) => {
    const p = A.at(s);
    return !land.some((poly) => pointInPoly(p, poly));
  };
  const out: Span[] = [];
  for (let s = 0; s <= A.total; s += 2) {
    if (!wet(s)) continue;
    let e = s;
    while (e + 2 <= A.total && wet(e + 2)) e += 2;
    const atA = s === 0;
    const atB = e + 2 > A.total;
    if (atA || atB || e - s >= 6) {
      // 取樣間距 2px：離岸與上岸的那一點再往外 2 + TUCK，橋頭至少伸進沙地 TUCK
      const a = atA ? 0 : Math.max(0, s - 2 - TUCK);
      const b = atB ? A.total : Math.min(A.total, e + 2 + TUCK);
      out.push(span(A, a, b, atA ? a : atB ? b : null, !atA, !atB));
    }
    s = e;
  }
  return out;
}

/** 放置用的保護框（見 planIsle）；海峽也用 */
export function guard(geo: SceneGeo): SceneGeo['protect'] {
  return geo.protect.flatMap((p) =>
    p.kind === 'road' ? [inflate(p, 4) as typeof p] : p.kind === 'plaque' || p.kind === 'banner' ? [p, { ...p, y0: p.y1, y1: p.y1 + 16 }] : [p],
  );
}

/**
 * 構圖（純函式，測試也用）：先放主角道具與緊鄰它的物件，依它們與節點、拱門、木樁、路面長出島（有出口的章島頂是北岸，延伸第 1 章的島底是章節牌沙灘的南岸，
 * 其他章島底留給水道），鋪上下方那一章越過交界伸進來的沙岬與跨海的橋，最後放其他物件
 */
export function planIsle(geo: SceneGeo, spec: IsleSpec): IslePlan {
  const deep = spec.southDeep === true;
  const ban = geo.protect.find((p) => p.kind === 'banner');
  const exit = geo.corridor.exit;
  const entry = geo.corridor.entry;
  // 這一章的島頂（有出口時）；下方那一座島的北岸越過交界伸進這一章的那一截（下方是海峽時沒有，南岸照舊是章節牌沙灘）
  const north = exit !== null ? northShore(geo, exit, spec.seed) : null;
  const below = !deep && ban ? northShore(geo, entry, belowSeed(spec.seed)) : null;
  // 路面在水道南岸往下 20 以內的那一截（保護框上緣會伸進水裡）也交給島頂的北岸，不算進必須墊住的東西
  const need = needs(geo, { bottom: below ? (below.joined ? JOIN_CUT : OPEN_CUT) : null, top: north ? north.floor + 20 : null });
  const core = need.core.filter((r) => r.y1 > 0 && r.y0 < geo.h);
  const top = Math.min(...core.map((r) => r.y0));
  const bottom = Math.max(...core.map((r) => r.y1));
  const ctx: IsleCtx = {
    geo,
    v: (t) => (top + t * (bottom - top)) / geo.h,
    spots: (us, ts) => ts.flatMap((t) => us.map((u) => ({ track: true as const, u, v: (top + t * (bottom - top)) / geo.h }))),
    beside: (hero, w, h, where, dy = 0) => {
      const side = hero.region === 'right' ? 'right' : 'left';
      const span = wingSpan(side, geo);
      const left = side === 'left';
      const out = where.endsWith('-out');
      const x0 = where === 'outer' ? (left ? hero.x0 - 10 - w : hero.x1 + 10) : left === out ? hero.x0 : hero.x1 - w;
      const y1 = (where.startsWith('above') ? hero.y0 - 8 : where.startsWith('below') ? hero.y1 + 8 + h : hero.y1) + dy;
      if (!span) return { wing: side, u: 0, v: y1 / geo.h };
      const off = left ? span.inner - (x0 + w) : x0 - span.inner;
      return { wing: side, u: off / Math.max(1, Math.abs(span.inner - span.outer) - w), v: y1 / geo.h };
    },
  };
  const site: TerrainBlock = { id: 'site', poly: rectPoly({ x0: -1, y0: -1, x1: geo.bandW + 1, y1: geo.h + 1 }) };
  // 量測 G9 的保護框比 geo.protect 稍大：紙籤與章節牌正下方整排（木樁與立柱附近）都不放東西；路面沿畫出來的路每 8px 取樣，轉彎處會比 layout 的取樣多出幾 px，路面再外擴 4
  const placeGeo: SceneGeo = { ...geo, protect: guard(geo) };
  const first = placeProps(spec.anchored(ctx), placeGeo, { blocks: [site] });
  const lead = first.find((p) => p.tier === 'hero');
  const anchored = [
    ...first,
    ...(lead && lead.region !== 'track' && spec.around ? placeProps(spec.around(ctx, lead), placeGeo, { blocks: [site], taken: first }) : []),
  ];
  const must = [...need.land.filter((r) => r.y1 > 0 && r.y0 < geo.h), ...anchored];
  const south = deep && ban ? southShore(geo, entry) : null;
  // 岬角與海灣的振幅：有兩翼時 16（0 到 32），手機 10
  const amp = geo.wings.left && geo.wings.right ? 16 : 10;
  const shapeRects = [...must, ...(below ? under(geo, below) : [])];

  // 島：墊不住就加寬重算
  let pad = PAD;
  let ctrl: Point[] = [];
  let island: { d: string; poly: Point[] } = { d: '', poly: [] };
  for (; pad <= PAD + 40; pad += 8) {
    const pts = outline(shapeRects, pad, geo, `${spec.seed}-isle`, amp, { south, north: north?.pts ?? null });
    ctrl = orient(below ? shoreAbove(pts, geo, below, must, spec.seed) : pts);
    island = smoothClosed(ctrl, 3);
    if (covers(island.poly, must)) break;
  }
  // 草地：島往內 BEACH 加減 BEACH_VAR（沿岸起伏）；章節牌那一帶留給沙灘：延伸第 1 章是卡片上方 20px 以下，有北岸的章是交界往下約 MEADOW_TOP 以上
  const rand = seededRandom(hashSeed(`${spec.seed}-meadow`));
  const ph1 = rand() * 6.28;
  const ph2 = rand() * 6.28;
  const widths: number[] = [];
  let s = 0;
  for (let i = 0; i < ctrl.length; i++) {
    widths.push(BEACH + BEACH_VAR * (0.7 * Math.sin(s / 27 + ph1) + 0.3 * Math.sin(s / 11 + ph2)));
    const a = ctrl[i]!;
    const b = ctrl[(i + 1) % ctrl.length]!;
    s += Math.hypot(b.x - a.x, b.y - a.y);
  }
  const cut = south && ban ? ban.y0 - 20 : null;
  const mTop = (x: number) => MEADOW_TOP + 7 * Math.sin(x / 43 + ph1) + 4 * Math.sin(x / 19 + ph2);
  const mEnd = (x: number) => MEADOW_END + 6 * Math.sin(x / 37 + ph2) + 3 * Math.sin(x / 17 + ph1);
  const grass: Point[] = [];
  // 只留離岸至少 10px 的點（平滑後的曲線不會跑出沙地）
  const inside = (q: Point) =>
    [q, { x: q.x + 10, y: q.y }, { x: q.x - 10, y: q.y }, { x: q.x, y: q.y + 10 }, { x: q.x, y: q.y - 10 }].every((t) => pointInPoly(t, island.poly));
  for (const p of offset(
    ctrl,
    widths.map((w) => -w),
  )) {
    let q = cut !== null && p.y > cut ? { x: p.x, y: cut + 5 * Math.sin(p.x / 37) } : p;
    if (north && q.y < mTop(q.x)) q = { x: q.x, y: mTop(q.x) };
    // 下方那一座島的沙岬在交界上是沙灘（它的草地從交界往下約 MEADOW_TOP 才開始）：這一章的草地也在交界往上約 MEADOW_END 收掉，
    // 交界上不會是一條草地接沙地的水平直邊（第 6 輪自查：手機兩島在卡片後面接起來時，草地被區段裁在交界上）
    if (below && q.y > geo.h - mEnd(q.x)) q = { x: q.x, y: geo.h - mEnd(q.x) };
    const last = grass[grass.length - 1];
    if (inside(q) && (!last || Math.hypot(q.x - last.x, q.y - last.y) > 6)) grass.push(q);
  }
  const meadow = smoothClosed(grass, 3);
  // 放置器用的草地往內收 2px（草地的邊起伏比較密，取樣的多邊形和畫出來的曲線在岸邊差不到 1px；量測 G9 用的是畫出來的曲線）
  const meadowPoly = smoothClosed(offset(grass, -2), 6).poly;

  // 下方那一座島的沙岬越過交界伸進來的那一截；延伸第 1 章以外，上方那一章不再伸下來（北岸是這一章自己的島頂）
  const ctrls = [ctrl, ...(below ? [headPoly(geo, below)] : [])];
  const { land, reef } = landAndReef(ctrls, topReef(geo, ctrl));

  // 跨海的橋：路線離開沙地的那一段（出口那一端到交界、交界到入口那一端），岸上那一端多伸 TUCK
  const bridges = spans(
    geo,
    land.map((q) => q.poly),
  );

  const blocks: TerrainBlock[] = [
    { id: 'sea', poly: site.poly },
    ...land.map((q) => ({ id: 'isle', poly: q.poly })),
    ...reef.map((q) => ({ id: 'reef', poly: q.poly })),
    { id: 'meadow', poly: meadowPoly },
    ...bridges.map((b) => ({ id: 'pier', poly: b.poly })),
  ];
  const hero = anchored.map((p) => ({ ...p, ground: ['isle'] }));
  const wide = anchored.some((p) => p.tier === 'hero' && p.region !== 'track');
  const props = [...hero, ...placeProps(spec.rest({ ...ctx, wide }), placeGeo, { blocks, taken: hero })];
  return {
    blocks,
    shape: {
      land: land.map((q) => q.d).join(''),
      reef: reef.map((q) => q.d).join(''),
      meadow: meadow.d,
      bridges,
    },
    props,
  };
}

// ---------------------------------------------------------------------------------------------
// 常用的候選

/** 海上的小東西（帆船、小島剪影、礁石、浮標）：整個在水裡、不碰淺水帶與棧橋 */
export const AT_SEA = ['sea', '!reef', '!pier'] as const;

/** 遠方的小島剪影（海上）：大的放不下時換小一號 */
export function isletSpec(id: string, anchors: readonly Anchor[]): PropSpec {
  return {
    id,
    tier: 'minor',
    ground: AT_SEA,
    whole: true,
    variants: [
      { w: 96, h: 44, form: 'islet', anchors },
      { w: 72, h: 36, form: 'islet', anchors },
    ],
  };
}

/** 水面短浪與亮點（細節，不佔組的名額）：每個給三個候選 */
export function sparkles(list: readonly (readonly [string, 'near' | 'far', number, number])[], form: 'ripple' | 'glint'): PropSpec[] {
  return list.map(([id, wing, u, v]) => ({
    id,
    tier: 'detail',
    ground: AT_SEA,
    whole: true,
    variants: [
      {
        w: form === 'ripple' ? 30 : 22,
        h: form === 'ripple' ? 10 : 14,
        form,
        anchors: [
          { wing, u, v },
          { wing, u: u * 0.6, v: v + 0.05 },
          { wing, u: Math.min(1, u + 0.25), v: v - 0.06 },
        ],
      },
    ],
  }));
}

// ---------------------------------------------------------------------------------------------
// 畫法

/** 海峽頂端的棧橋（和地圖組的海峽棧橋同一種畫法）：甲板、每 12px 一條木板線、兩條繩子與每 48px 一對繩柱 */
export function PierDeck({ p }: { p: Pier }) {
  const planks: string[] = [];
  for (let y = p.y0 + 6; y < p.y1; y += 12) planks.push(`M${p.x - PIER_DECK} ${y}h${PIER_DECK * 2}`);
  const posts: string[] = [];
  for (let y = p.y0 + 24; y < p.y1 - 8; y += 48) posts.push(`M${p.x - ROPE - 2} ${y - 5}h4v10h-4ZM${p.x + ROPE - 2} ${y - 5}h4v10h-4Z`);
  return (
    <g>
      <rect data-terrain-block="pier" x={p.x - PIER_DECK} y={p.y0} width={PIER_DECK * 2} height={p.y1 - p.y0} fill={WOOD} />
      <path d={planks.join('')} stroke={LINE} strokeWidth="1" />
      <path d={`M${p.x - ROPE} ${p.y0}V${p.y1}M${p.x + ROPE} ${p.y0}V${p.y1}`} fill="none" stroke={LINE} strokeWidth="1.5" />
      {posts.length > 0 && <path d={posts.join('')} fill={ROCK_DEEP} stroke={LINE} strokeWidth="1" />}
    </g>
  );
}

/**
 * 島與島之間的橋（第 5 輪看圖驗收：和第 2 章同一種有欄杆的橋，取代原本只有一小截的直棧橋）：橋面 36 的 scene-wood 沿路線（路面 20 置中，兩側各露出 8px 木板），
 * 兩側 1.5px 的欄杆，每 10px 一條垂直於切線的木板線，岸上那一端兩根橋柱
 */
export function BridgeSpan({ b }: { b: Span }) {
  return (
    <g>
      <path data-terrain-block="pier" d={`M${b.poly.map((p) => `${r1(p.x)} ${r1(p.y)}`).join('L')}Z`} fill="none" />
      <path d={b.deck} fill="none" stroke={WOOD} strokeWidth={DECK * 2} strokeLinejoin="round" />
      <path d={b.planks} stroke={LINE} strokeWidth="1" />
      <path d={b.rails} fill="none" stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      {b.posts && <path d={b.posts} fill={ROCK_DEEP} stroke={LINE} strokeWidth="1" />}
    </g>
  );
}

/** 島：淺水（外緣一條細浪花線）、海峽頂端的棧橋、沙地（外緣一條浪花線）、草地、島與島之間的橋。外緣的線先畫、填色後畫，重疊的子路徑之間不會留下線 */
export function IsleLand({ shape }: { shape: IsleShape }) {
  return (
    <>
      <path d={shape.reef} fill="none" stroke={FOAM} strokeWidth="3" strokeOpacity="0.8" />
      <path data-terrain-block="reef" d={shape.reef} fill={SEA} />
      {shape.piers?.map((p) => (
        <PierDeck key={p.x} p={p} />
      ))}
      <path d={shape.land} fill="none" stroke={FOAM} strokeWidth="6" />
      <path data-terrain-block="isle" d={shape.land} fill={SAND} />
      {shape.meadow && <path data-terrain-block="meadow" d={shape.meadow} fill={MEADOW} />}
      {shape.bridges?.map((b) => (
        <BridgeSpan key={b.deck.slice(0, 24)} b={b} />
      ))}
    </>
  );
}

/** 一章的物件層：地紋定義、看不見的整章海面（量測用）、島、依底線排序的物件 */
export function IsleScene({ geo, plan, art }: { geo: SceneGeo; plan: IslePlan; art: (p: Placed, gid: string) => ReactNode }) {
  const ids = useSceneIds();
  return (
    <>
      <SceneDefs ids={ids} />
      <TerrainRect id="sea" r={{ x0: 0, y0: 0, x1: geo.bandW, y1: geo.h }} />
      <IsleLand shape={plan.shape} />
      {/* 最上面那一章：島可能越過地圖上緣的接縫（字級放大時墊住紙籤），照 geo.seam 把接縫蓋回去（和第 2、10 章同一種做法） */}
      {geo.corridor.exit === null && geo.seam && !geo.seam.blend && <path d={geo.seam.d} style={{ fill: geo.seam.fill }} />}
      {[...plan.props].sort(byDepth).map((p) => (
        <Prop key={p.id} p={p}>
          {art(p, ids.glow)}
        </Prop>
      ))}
    </>
  );
}

/** 棕櫚 w × h（高物件）：彎的樹幹與六片葉 */
export function Palm({ w, h }: { w: number; h: number }) {
  const tx = w * 0.6;
  const ty = h * 0.3;
  const bx = w * 0.42;
  // 一片葉：從樹冠到葉尖，上緣往上拱 a、下緣少拱 b（葉子的厚度）
  const leaf = (dx: number, dy: number) => {
    const a = 10 + Math.abs(dx) * 0.2;
    const mx = tx + dx / 2;
    const my = ty + dy / 2;
    return `M${tx} ${ty}Q${mx} ${my - a} ${tx + dx} ${ty + dy}Q${mx} ${my - a + 13} ${tx} ${ty}Z`;
  };
  return (
    <>
      <path
        d={`M${bx - 3} ${h - 2}Q${bx - 2} ${h * 0.62} ${tx - 2} ${ty + 2}L${tx + 2} ${ty + 3}Q${bx + 3} ${h * 0.64} ${bx + 3} ${h - 2}Z`}
        fill={WOOD}
        stroke={LINE}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d={[
          leaf(-w * 0.58, h * 0.14),
          leaf(-w * 0.34, -h * 0.16),
          leaf(w * 0.02, -h * 0.28),
          leaf(w * 0.38, -h * 0.06),
          leaf(w * 0.4, h * 0.2),
          leaf(-w * 0.12, h * 0.26),
        ].join('')}
        fill={LEAF}
        stroke={LINE}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </>
  );
}

/** 遠方的小島剪影 w × h：一圈浪花、沙丘、兩棵小棕櫚 */
export function Islet({ w, h }: { w: number; h: number }) {
  const b = h - 4;
  return (
    <>
      <path d={`M2 ${b + 1}q${w * 0.25} 4 ${w * 0.5} 0t${w * 0.5 - 4} 0`} fill="none" stroke={FOAM} strokeWidth="2.2" strokeLinecap="round" />
      <path
        d={`M6 ${b}C${w * 0.22} ${h * 0.5} ${w * 0.4} ${h * 0.42} ${w * 0.56} ${h * 0.55}C${w * 0.72} ${h * 0.46} ${w * 0.86} ${h * 0.6} ${w - 6} ${b}Z`}
        fill={SAND}
        stroke={LINE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d={`M${w * 0.38} ${h * 0.5}q-1-${h * 0.2} 3-${h * 0.36}M${w * 0.62} ${h * 0.52}q1-${h * 0.16} -2-${h * 0.28}`}
        fill="none"
        stroke={WOOD}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d={`M${w * 0.41} ${h * 0.14}q-8-3-13 4q7-2 13-4q6-6 12-1q-7 0-12 1ZM${w * 0.6} ${h * 0.24}q-7-3-11 3q6-2 11-3q5-5 10-1q-6 0-10 1Z`}
        fill={LEAF}
        stroke={LINE}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </>
  );
}

/** 礁石 w × h：幾塊石頭，水線一道浪花 */
export function Reef({ w, h }: { w: number; h: number }) {
  const b = h - 4;
  return (
    <>
      <path
        d={`M3 ${b}q1-${h * 0.6} ${w * 0.22}-${h * 0.62}q${w * 0.2} 0 ${w * 0.24} ${h * 0.62}ZM${w * 0.42} ${b}q${w * 0.06}-${h * 0.9} ${w * 0.26}-${h * 0.9}q${w * 0.2} 0 ${w * 0.24} ${h * 0.9}ZM${w * 0.74} ${b}q0-${h * 0.36} ${w * 0.1}-${h * 0.36}q${w * 0.12} 0 ${w * 0.14} ${h * 0.36}Z`}
        fill={ROCK_DEEP}
        stroke={LINE}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d={`M1 ${h - 2}q${w / 4} -4 ${w / 2} 0t${w / 2 - 2} 0`} fill="none" stroke={FOAM} strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

/** 水面短浪 30 × 10 */
export function Ripple() {
  return <path d="M1 8q7-7 14 0t14 0" fill="none" stroke={FOAM} strokeWidth="2" strokeLinecap="round" />;
}

/** 水面亮點 22 × 14：一顆四角星加一道短浪；白天是浪花色、夜裡是燈光色 */
export function Glint() {
  return (
    <>
      <path d="M8 1q1 5 6 6q-5 1-6 6q-1-5-6-6q5-1 6-6Z" {...dayNight(FOAM, GLOW)} />
      <path d="M13 12q4-3 8 0" fill="none" stroke={FOAM} strokeWidth="1.8" strokeLinecap="round" />
    </>
  );
}
