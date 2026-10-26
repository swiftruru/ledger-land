// 場景共用工具 scene-kit（圖規第 6.2、6.5 節）：調色盤、地形塊、放置器 placeProps、共用的小物件與夜景燈光。延後載入的共用 chunk（gzip 5 KB 以內；第 2 輪看圖驗收加了接縫海岸、島形掃描線、有機岸線與實邊地塊後約 4.4 KB；第 4 輪把柔邊鋪地換成整章的鋪面 plotArea 與 Plot，見下方實測），
// 由各章場景 import，不在地圖第一波。座標一律是區帶座標（從視窗左緣量起、含 rail 下方），y 向下，原點是區段左上角，和 SceneGeo 與物件層 svg 的 viewBox 相同。
// 規則（6.5）：只用 scene tokens（不用強調色、element tint、highlight-ring）；沒有虛線、點線、文字、數字與圓形大色塊；線條 1.5 到 2px、scene-line；場景沒有動畫。
// 每個放下的物件輸出 data-prop-rect（x0 y0 x1 y1）與 data-prop-ground（允許的地形塊，! 開頭是「不得落在」），地形塊輸出 data-terrain-block，量測腳本（G9）只讀這些屬性。
// 一章的寫法（範本是 scene-dock.tsx）：匯出 geoAware = true；構圖寫成純函式（給測試用）：先宣告地形塊（TerrainBlock，多邊形），
// 再用 PropSpec 宣告物件（主角道具 hero、次要道具 minor、水面短浪這類細節 detail），每個物件有幾種尺寸與依序嘗試的候選位置，交給 placeProps；
// 畫法依 Placed.form 選圖，包在 <Prop> 裡（自動輸出量測屬性、右翼水平翻轉）。只在這一章用到的形狀放在那一章的檔案，第二章也要用時再搬進這裡（scene-kit 預算 5 KB）；
// 不要另開其他共用模組：小於 4 KB 的共用模組會被 vite 併進 scene-kit 的 chunk。
import { useId, type ReactNode } from 'react';
import { SEAM, hashSeed, inflate, rectsIntersect, seededRandom, type Bp, type Point, type Rect, type SceneGeo } from '../quest-map/layout.ts';

// ---------------------------------------------------------------------------------------------
// 調色盤（圖規第 5 節的 scene tokens；深色值由 tokens 依 violet、berry、wine 算好）

export const SEA = 'var(--ll-scene-sea)';
export const SEA_DEEP = 'var(--ll-scene-sea-deep)';
export const FOAM = 'var(--ll-scene-foam)';
export const SAND = 'var(--ll-scene-sand)';
export const MEADOW = 'var(--ll-scene-meadow)';
export const MEADOW_DEEP = 'var(--ll-scene-meadow-deep)';
export const FIELD = 'var(--ll-scene-field)';
export const PLAZA = 'var(--ll-scene-plaza)';
export const ROCK = 'var(--ll-scene-rock)';
export const ROCK_DEEP = 'var(--ll-scene-rock-deep)';
export const WOOD = 'var(--ll-scene-wood)';
export const ROOF = 'var(--ll-scene-roof)';
export const LEAF = 'var(--ll-scene-leaf)';
export const GLOW = 'var(--ll-scene-glow)';
export const LINE = 'var(--ll-scene-line)';
/** 紙、帆布：路面的顏色（淺色近白、深色是 elevated） */
export const PAPER = 'var(--ll-scene-road)';
/** 淺色與深色用不同 token 的填色（例如帆布：白天是路面的近白、夜裡是石色，避免在深色地景上變成一塊暗板）：
 *  style 裡的 light-dark() 依主題區塊的 color-scheme 取值，不支援的瀏覽器用屬性上的淺色值 */
export const dayNight = (day: string, night: string) => ({ fill: day, style: { fill: `light-dark(${day}, ${night})` } });
/** 陰影與背光面（配 opacity 用）：淺色是描線色，深色是頁面底色。深色的描線比地面亮（地圖組第 2 輪的 DARK_GROUND），用它畫影子會變成一塊亮斑 */
const SHADE = `light-dark(${LINE}, var(--ll-bg))`;
export const shadeFill = { fill: LINE, style: { fill: SHADE } } as const;
export const shadeStroke = { stroke: LINE, style: { stroke: SHADE } } as const;
/** 夜景燈光：淺色主題透明、深色主題是 scene-glow（color-scheme 由 tokens 寫在主題區塊）；不支援 light-dark() 的瀏覽器維持屬性上的透明，等於沒有光暈 */
const NIGHT_GLOW = 'light-dark(transparent, var(--ll-scene-glow))';

// ---------------------------------------------------------------------------------------------
// 型別

export type Side = 'left' | 'right';
/** near 是入口走廊那一側的翼、far 是另一側 */
export type WingRef = 'near' | 'far' | Side;
export type Region = Side | 'track';
export type Tier = 'hero' | 'minor' | 'detail';

/**
 * 候選位置（圖規 6.2）：
 * - 翼：u 是「離軌道多遠」的比例，0 貼著軌道（間隔 24）、1 到外側極限（離軌道 400 或區帶邊）；v 是物件底線在區段高度的比例。
 * - 軌道：u 是物件中心在軌道寬的比例，v 是底線比例。
 * - 節點：放在節點交錯留下的空側（節點在左半時放右半中間，反之亦然），垂直置中在節點上，dv 是往下的位移（px）。
 */
export type Anchor =
  | { readonly wing: WingRef; readonly u: number; readonly v: number }
  | { readonly track: true; readonly u: number; readonly v: number }
  | { readonly node: number; readonly dv?: number };

/** 一種尺寸：依序試，第一個放得下的就用；bps 限定斷點；form 讓場景知道要畫哪一種圖（例如桌面是棧橋、手機是地圖） */
export interface Variant {
  readonly w: number;
  readonly h: number;
  readonly anchors: readonly Anchor[];
  readonly bps?: readonly Bp[];
  readonly form?: string;
  /** 覆寫物件的 ground */
  readonly ground?: readonly string[];
}

export interface PropSpec {
  readonly id: string;
  /** hero 是主角道具：所有候選都不行時在區域內掃描最近的空位，一定放得下（只要區域裝得下）；detail 是水面短浪這類細節，不佔「組」的名額 */
  readonly tier: Tier;
  /** 允許的地形塊 ID；! 開頭表示整個物件不得碰到那一塊（例如沙灘上的東西不得落在海裡） */
  readonly ground: readonly string[];
  /** 高物件（樹、燈塔）可以伸出地形塊上緣超過自身高度的 70% */
  readonly tall?: boolean;
  /** 整個物件都要在地形塊內（船要整艘在水裡） */
  readonly whole?: boolean;
  /** 同一組的物件（例如棧橋旁的浮標、帆船上方的海鷗）只佔一組的名額；預設自成一組 */
  readonly group?: string;
  readonly variants: readonly Variant[];
}

export interface Placed extends Rect {
  readonly id: string;
  readonly tier: Tier;
  readonly form: string;
  readonly region: Region;
  /** 物件的圖以「往左是外側」畫；放在右翼時水平翻轉 */
  readonly flip: boolean;
  readonly ground: readonly string[];
  readonly tall: boolean;
  readonly whole: boolean;
  readonly group: string;
}

/** 地形塊：多邊形（區帶座標）；畫出來的 path 與放置器檢查的是同一組點 */
export interface TerrainBlock {
  readonly id: string;
  readonly poly: readonly Point[];
}

// ---------------------------------------------------------------------------------------------
// 幾何小工具

/** 物件與軌道邊、物件與物件之間的最小間隔 */
export const WING_GAP = 24;
export const PROP_GAP = 8;
/** 兩翼的物件只放在離軌道 400px 以內（圖規 6.2、6.6） */
export const WING_REACH = 400;

const r1 = (n: number) => Math.round(n * 10) / 10;

export function nearSide(geo: SceneGeo): Side {
  return geo.corridor.entry < (geo.track.left + geo.track.right) / 2 ? 'left' : 'right';
}

export function wingSide(ref: WingRef, geo: SceneGeo): Side {
  if (ref === 'left' || ref === 'right') return ref;
  const near = nearSide(geo);
  return ref === 'near' ? near : near === 'left' ? 'right' : 'left';
}

/** 一翼可放物件的水平範圍：inner 是貼軌道的那一邊（間隔 24），outer 是外側極限（離區帶邊至少 16，不在 rail 底下）；沒有翼時 null */
export function wingSpan(side: Side, geo: SceneGeo): { readonly inner: number; readonly outer: number } | null {
  const w = side === 'left' ? geo.wings.left : geo.wings.right;
  if (!w) return null;
  if (side === 'left') return { inner: geo.track.left - WING_GAP, outer: Math.max(w.x0, 16, geo.track.left - WING_REACH) };
  return { inner: geo.track.right + WING_GAP, outer: Math.min(geo.bandW - 16, geo.track.right + WING_REACH) };
}

/** 頂端接縫的波浪（geo.seam.line，每 8px 一點的折線）的點；沒有接縫時是空陣列 */
export function seamWave(geo: SceneGeo): Point[] {
  const nums = (geo.seam?.line ?? '').match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const out: Point[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push({ x: nums[i]!, y: nums[i + 1]! });
  return out;
}

/** 波浪在 x 的高度（折線內插）；沒有波浪時是 SEAM - 1（波浪最低的位置） */
export function waveAt(wave: readonly Point[], x: number): number {
  for (let i = 1; i < wave.length; i++) {
    const a = wave[i - 1]!;
    const b = wave[i]!;
    if (x <= b.x) return a.y + ((b.y - a.y) * Math.max(0, x - a.x)) / Math.max(1e-6, b.x - a.x);
  }
  return wave.at(-1)?.y ?? SEAM - 1;
}

/**
 * 第 1 章與第 2 章交界的陸地範圍（圖規 6.3、12.3：交界沒有直線切口）：有兩翼時陸地是軌道左緣外 46 到右緣外 54，兩側是海；
 * 沒有兩翼時整條是沙地（推到畫面外）。只用軌道與區帶寬算，上下兩章各算一次結果一樣：第 1 章頂端的兩條海岸與第 2 章章節牌沙灘的底端從同一組 x 起筆。
 * 外 46、54 讓章節牌（卡片加立柱外擴 12，再留 24）與入口走廊的路面都在沙上，不管章節牌在哪一側。
 */
export function seamCoast(geo: SceneGeo): { readonly xa: number; readonly xb: number } {
  return geo.wings.left && geo.wings.right ? { xa: geo.track.left - 46, xb: geo.track.right + 54 } : { xa: -80, xb: geo.bandW + 80 };
}

/**
 * 一群框的聯集外擴 pad 之後，每一列（每 step px）的左右極值：框的上下端用圓的輪廓（離框上下緣 dy 時只外擴 √(pad² − dy²)），
 * 島與沙灘的外形貼著內容走，節點交錯留下的空側自然成為海灣；沒有框的列用上下相鄰的列內插
 */
export function envelope(rects: readonly Rect[], pad: number, y0: number, y1: number, step = 12): { ys: number[]; L: number[]; R: number[] } {
  const n = Math.max(2, Math.round((y1 - y0) / step));
  const ys = Array.from({ length: n + 1 }, (_, i) => y0 + ((y1 - y0) * i) / n);
  const L: (number | null)[] = [];
  const R: (number | null)[] = [];
  for (const y of ys) {
    let l = Infinity;
    let r = -Infinity;
    for (const b of rects) {
      const dy = Math.max(0, b.y0 - y, y - b.y1);
      if (dy >= pad) continue;
      const e = Math.sqrt(pad * pad - dy * dy);
      l = Math.min(l, b.x0 - e);
      r = Math.max(r, b.x1 + e);
    }
    L.push(l < Infinity ? l : null);
    R.push(r > -Infinity ? r : null);
  }
  const fill = (xs: (number | null)[]) =>
    xs.map((x, i) => {
      if (x !== null) return x;
      let p = i;
      while (p > 0 && xs[p] === null) p--;
      let q = i;
      while (q < xs.length - 1 && xs[q] === null) q++;
      const a = xs[p] ?? xs[q] ?? 0;
      const b = xs[q] ?? a;
      return a + ((b - a) * (i - p)) / Math.max(1, q - p);
    });
  return { ys, L: fill(L), R: fill(R) };
}

/**
 * 有機的岸線（圖規 6.5、12.3：沒有硬邊、沒有長直線）：沿多邊形每 step px 取一點，往外法線推 amp × (1 + 0.6 sin + 0.4 sin)，
 * 也就是 0 到 2 × amp，兩個波長由種子在 w1 到 w1 + 60 與 w2 到 w2 + 80 之間選（預設 80 到 140、150 到 230），再加一個波長 60、0 到 3.2px 的小起伏（兩個大波都在谷底時岸線也不會有一長段直的）；
 * 只往外推，原本蓋住的東西仍蓋得住。
 * keep(p) 是 0 到 1 的權重：0 的地方不推、也不重新取點（例如要和上下一章對齊的接縫那一段，那幾個點原樣保留）
 */
export function organic(poly: readonly Point[], seed: string, amp: number, keep: (p: Point) => number = () => 1, step = 18, w1 = 80, w2 = 150): Point[] {
  const rand = seededRandom(hashSeed(seed));
  const l1 = w1 + 60 * rand();
  const l2 = w2 + 80 * rand();
  const p1 = rand() * 6.28;
  const p2 = rand() * 6.28;
  const n = poly.length;
  let area = 0;
  for (let i = 0; i < n; i++) area += poly[i]!.x * poly[(i + 1) % n]!.y - poly[(i + 1) % n]!.x * poly[i]!.y;
  const sgn = area > 0 ? 1 : -1;
  // 先重新取點（keep 為 0 的那一段原樣保留），再沿「前後各兩點」的弦的法線推：法線平順，凹處不會推出交叉的圈
  const pts: { p: Point; s: number; k: number }[] = [];
  let s = 0;
  for (let i = 0; i < n; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % n]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const m = keep(a) <= 0 && keep(b) <= 0 ? 1 : Math.max(1, Math.round(len / step));
    for (let j = 0; j < m; j++) {
      const p = { x: a.x + ((b.x - a.x) * j) / m, y: a.y + ((b.y - a.y) * j) / m };
      pts.push({ p, s: s + (len * j) / m, k: Math.max(0, Math.min(1, keep(p))) });
    }
    s += len;
  }
  const N = pts.length;
  return pts.map(({ p, s: t, k }, i) => {
    if (k <= 0) return p;
    const a = pts[(i - 2 + N) % N]!.p;
    const b = pts[(i + 2) % N]!.p;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const d = (amp * (1 + 0.6 * Math.sin((t / l1) * 6.28 + p1) + 0.4 * Math.sin((t / l2) * 6.28 + p2)) + 1.6 * (1 + Math.sin((t / 60) * 6.28))) * k;
    return { x: p.x + ((sgn * (b.y - a.y)) / len) * d, y: p.y - ((sgn * (b.x - a.x)) / len) * d };
  });
}

/** 射線法：點是否在多邊形內 */
export function pointInPoly(p: Point, poly: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function rectPoly(r: Rect): Point[] {
  return [
    { x: r.x0, y: r.y0 },
    { x: r.x1, y: r.y0 },
    { x: r.x1, y: r.y1 },
    { x: r.x0, y: r.y1 },
  ];
}

function steps(a: number, b: number, step: number): number[] {
  const n = Math.max(1, Math.ceil((b - a) / step));
  return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
}

/** 著地檢查（圖規 6.2）：底線上每 8px 一點都在允許的地形塊內；不是高物件時，底線往上 30% 高的那一排也要在內（等於伸出上緣不超過 70%）；
 *  whole 時整個物件都要在內；! 開頭的地形塊整個物件（外擴 4px）都不得碰到 */
export function grounded(r: Rect, ground: readonly string[], blocks: readonly TerrainBlock[], opts: { tall?: boolean; whole?: boolean } = {}): boolean {
  const pos = blocks.filter((b) => ground.includes(b.id));
  const neg = blocks.filter((b) => ground.includes(`!${b.id}`));
  const h = r.y1 - r.y0;
  const xs = steps(r.x0 + 1, r.x1 - 1, 8);
  const ys = opts.whole ? steps(r.y0 + 1, r.y1 - 1, 8) : opts.tall ? [r.y1 - 1] : [r.y1 - 1, r.y1 - 0.3 * h];
  if (pos.length === 0) return false;
  for (const x of xs) for (const y of ys) if (!pos.some((b) => pointInPoly({ x, y }, b.poly))) return false;
  if (neg.length) {
    const o = inflate(r, 4);
    for (const x of steps(o.x0, o.x1, 8)) for (const y of steps(o.y0, o.y1, 8)) if (neg.some((b) => pointInPoly({ x, y }, b.poly))) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------------------------
// 放置器（圖規 6.2）：依序試每個尺寸的主位置與替代位置，和保護框、已放下的物件相交或沒有著地就換下一個；結果是決定性的

/** 軌道內最多幾個次要道具；每翼每 160px 章高最多 1 組物件（主角道具不算在軌道的上限內） */
export const TRACK_MAX = 2;
export const WING_ROW = 160;

const NUDGES: readonly (readonly [number, number])[] = [
  [0, 0],
  [0, -16],
  [0, 16],
  [-16, 0],
  [16, 0],
  [0, -32],
  [0, 32],
  [-32, 0],
  [32, 0],
  [-24, -24],
  [24, 24],
  [24, -24],
  [-24, 24],
];

interface Try {
  readonly r: Rect;
  readonly region: Region;
}

function anchorRect(a: Anchor, w: number, h: number, geo: SceneGeo): Try | null {
  const clampY = (y1: number) => Math.min(geo.h, Math.max(SEAM + h, y1));
  if ('wing' in a) {
    const side = wingSide(a.wing, geo);
    const span = wingSpan(side, geo);
    if (!span) return null;
    const depth = Math.abs(span.inner - span.outer);
    if (depth < w) return null;
    const off = Math.min(1, Math.max(0, a.u)) * (depth - w);
    const y1 = clampY(a.v * geo.h);
    const x0 = side === 'left' ? span.inner - off - w : span.inner + off;
    return { r: { x0, y0: y1 - h, x1: x0 + w, y1 }, region: side };
  }
  if ('track' in a) {
    const cx = geo.track.left + a.u * (geo.track.right - geo.track.left);
    const y1 = clampY(a.v * geo.h);
    return { r: { x0: cx - w / 2, y0: y1 - h, x1: cx + w / 2, y1 }, region: 'track' };
  }
  const n = geo.nodes[a.node];
  if (!n) return null;
  const mid = (geo.track.left + geo.track.right) / 2;
  const cx = n.x < mid ? (mid + geo.track.right) / 2 : (geo.track.left + mid) / 2;
  const cy = n.y + (a.dv ?? 0);
  return { r: { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 }, region: 'track' };
}

function inRegion(r: Rect, region: Region, geo: SceneGeo): boolean {
  if (r.y0 < SEAM - 0.01 || r.y1 > geo.h + 0.01 || r.x0 < 16 || r.x1 > geo.bandW - 16) return false;
  if (region === 'track') return r.x0 >= geo.track.left + 4 && r.x1 <= geo.track.right - 4;
  const span = wingSpan(region, geo);
  if (!span) return false;
  return region === 'left' ? r.x0 >= span.outer - 0.01 && r.x1 <= span.inner + 0.01 : r.x0 >= span.inner - 0.01 && r.x1 <= span.outer + 0.01;
}

export interface PlaceOptions {
  readonly blocks: readonly TerrainBlock[];
  /** 已經放下的物件（例如先放主角道具、依它畫出地形，再放次要道具） */
  readonly taken?: readonly Placed[];
}

export function placeProps(specs: readonly PropSpec[], geo: SceneGeo, opts: PlaceOptions): Placed[] {
  const taken: Placed[] = [...(opts.taken ?? [])];
  const out: Placed[] = [];
  const ordered = [...specs.filter((s) => s.tier === 'hero'), ...specs.filter((s) => s.tier !== 'hero')];
  const wingMax = Math.max(2, Math.floor(geo.h / WING_ROW));
  // 每一區已用掉幾組（同組的物件只算一次；軌道的上限不含主角道具）
  const count = (region: Region, group: string) => {
    const groups = new Set(taken.filter((t) => t.region === region && t.tier !== 'detail' && (region !== 'track' || t.tier !== 'hero')).map((t) => t.group));
    return groups.has(group) ? 0 : groups.size;
  };
  const ok = (t: Try, s: PropSpec, ground: readonly string[]) =>
    inRegion(t.r, t.region, geo) &&
    !geo.protect.some((p) => rectsIntersect(t.r, p)) &&
    !taken.some((p) => rectsIntersect(t.r, inflate(p, PROP_GAP))) &&
    grounded(t.r, ground, opts.blocks, s);
  for (const s of ordered) {
    const variants = s.variants.filter((v) => !v.bps || v.bps.includes(geo.bp));
    let hit: { t: Try; v: Variant } | null = null;
    for (const v of variants) {
      const ground = v.ground ?? s.ground;
      for (const a of v.anchors) {
        const base = anchorRect(a, v.w, v.h, geo);
        if (!base) continue;
        const group = s.group ?? s.id;
        if (s.tier === 'minor' && (base.region === 'track' ? count('track', group) >= TRACK_MAX : count(base.region, group) >= wingMax)) continue;
        for (const [dx, dy] of NUDGES) {
          const t = { r: { x0: base.r.x0 + dx, y0: base.r.y0 + dy, x1: base.r.x1 + dx, y1: base.r.y1 + dy }, region: base.region };
          if (ok(t, s, ground)) {
            hit = { t, v };
            break;
          }
        }
        if (hit) break;
      }
      if (hit) break;
    }
    // 主角道具：候選都不行時，在最後一個尺寸的第一個候選區域裡，從主位置由近到遠掃描空位（每 8px）
    if (!hit && s.tier === 'hero') {
      const v = variants[variants.length - 1];
      const base = v?.anchors.map((a) => anchorRect(a, v.w, v.h, geo)).find((t): t is Try => !!t);
      if (v && base) {
        const ground = v.ground ?? s.ground;
        const box =
          base.region === 'track'
            ? { x0: geo.track.left + 4, x1: geo.track.right - 4 }
            : (() => {
                const span = wingSpan(base.region, geo)!;
                return { x0: Math.min(span.inner, span.outer), x1: Math.max(span.inner, span.outer) };
              })();
        const cx = (base.r.x0 + base.r.x1) / 2;
        const cy = (base.r.y0 + base.r.y1) / 2;
        const cands: Try[] = [];
        for (let y0 = SEAM; y0 + v.h <= geo.h; y0 += 8)
          for (let x0 = box.x0; x0 + v.w <= box.x1; x0 += 8) cands.push({ r: { x0, y0, x1: x0 + v.w, y1: y0 + v.h }, region: base.region });
        const d = (t: Try) => Math.hypot((t.r.x0 + t.r.x1) / 2 - cx, (t.r.y0 + t.r.y1) / 2 - cy);
        cands.sort((a, b) => d(a) - d(b));
        const t = cands.find((c) => ok(c, s, ground));
        if (t) hit = { t, v };
      }
    }
    if (!hit) continue;
    const p: Placed = {
      ...hit.t.r,
      id: s.id,
      tier: s.tier,
      form: hit.v.form ?? s.id,
      region: hit.t.region,
      flip: hit.t.region === 'right',
      ground: hit.v.ground ?? s.ground,
      tall: !!s.tall,
      whole: !!s.whole,
      group: s.group ?? s.id,
    };
    taken.push(p);
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// 地形塊的形狀

/** 經過控制點的平滑閉合曲線（Catmull-Rom 轉三次貝茲），同時輸出取樣後的多邊形（放置器與測試用） */
export function smoothClosed(points: readonly Point[], samples = 6): { d: string; poly: Point[] } {
  const n = points.length;
  const P = (i: number) => points[(i + n) % n]!;
  let d = `M${r1(P(0).x)} ${r1(P(0).y)}`;
  const poly: Point[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = P(i - 1);
    const p1 = P(i);
    const p2 = P(i + 1);
    const p3 = P(i + 2);
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${r1(c1.x)} ${r1(c1.y)} ${r1(c2.x)} ${r1(c2.y)} ${r1(p2.x)} ${r1(p2.y)}`;
    for (let k = 0; k < samples; k++) {
      const t = k / samples;
      const u = 1 - t;
      poly.push({
        x: u * u * u * p1.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p2.x,
        y: u * u * u * p1.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p2.y,
      });
    }
  }
  return { d: `${d}Z`, poly };
}

/**
 * 一章的鋪面（第 3 章鋪石、第 4 章方磚、第 7 章木地板、第 9 章磚院子；第 4 輪看圖驗收：原本只在主角道具底下墊一塊羽化邊的圓角方，像沒對焦的貼紙，
 * 方塊以外整章是素色）：涵蓋軌道與入口那一翼（到放物件的外側極限；沒有翼時軌道外 32px）的一大塊地，另一側只多軌道邊 8px（另一翼留給那一翼的建築與田），
 * 上下在章高的 y0 到 y1 之間；
 * 外形是圓角方（超橢圓，指數 4）經 organic 推出 0 到 2 × amp + 3 的起伏，邊緣清楚（畫法見 Plot）。離畫面邊不到 48px 的那一側推到畫面外
 */
export function plotArea(geo: SceneGeo, seed: string, y0 = 0.08, y1 = 0.86, amp = 14): { d: string; poly: Point[] } {
  const near = nearSide(geo);
  const span = wingSpan(near, geo);
  const reach = span ? span.outer : near === 'left' ? geo.track.left - 32 : geo.track.right + 32;
  let x0 = near === 'left' ? reach : geo.track.left - 8;
  let x1 = near === 'left' ? geo.track.right + 8 : reach;
  if (x0 < 48) x0 = -80;
  if (x1 > geo.bandW - 48) x1 = geo.bandW + 80;
  const a = (x1 - x0) / 2;
  const b = ((y1 - y0) * geo.h) / 2;
  const cy = ((y0 + y1) * geo.h) / 2;
  const pts = Array.from({ length: 48 }, (_, i) => {
    const t = (i / 48) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    return { x: x0 + a + a * Math.sign(c) * Math.sqrt(Math.abs(c)), y: cy + b * Math.sign(s) * Math.sqrt(Math.abs(s)) };
  });
  return smoothClosed(
    organic(pts, seed, amp, (p) => (p.x < -40 || p.x > geo.bandW + 40 ? 0 : 1), 32),
    3,
  );
}

/** 鋪面的畫法：地形塊（淡淡的填色，night 是深色主題的填色）、紋理（pattern 的 ID）與 1.5px 的 scene-line 外框（opacity 0.4），沒有遮罩、沒有模糊 */
export function Plot({ id, d, fill, night, opacity, pattern }: { id: string; d: string; fill: string; night: string; opacity: number; pattern: string }) {
  return (
    <g>
      <path data-terrain-block={id} d={d} fill={fill} opacity={opacity} style={{ fill: `light-dark(${fill}, ${night})` }} />
      <path d={d} fill={`url(#${pattern})`} />
      <path d={d} fill="none" stroke={LINE} strokeWidth="1.5" strokeOpacity="0.4" strokeLinejoin="round" />
    </g>
  );
}

/** 在相鄰控制點之間插入一個往法線方向偏移的點，讓岸線不規則（種子決定，同寬同結果） */
export function roughen(points: readonly Point[], seed: string, amp: number, skip: (a: Point, b: Point) => boolean = () => false): Point[] {
  const rand = seededRandom(hashSeed(seed));
  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    out.push(a);
    if (skip(a, b)) continue;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 48) continue;
    const k = (rand() * 2 - 1) * amp;
    out.push({ x: (a.x + b.x) / 2 + (-(b.y - a.y) / len) * k, y: (a.y + b.y) / 2 + ((b.x - a.x) / len) * k });
  }
  return out;
}

/** 把多邊形裁到半平面 x <= limit（keepLeft）或 x >= limit：超寬螢幕的地紋只畫在離軌道 400px 以外（6.6） */
export function clipPolyX(poly: readonly Point[], limit: number, keepLeft: boolean): Point[] {
  const inside = (p: Point) => (keepLeft ? p.x <= limit : p.x >= limit);
  const out: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    if (inside(a)) out.push(a);
    if (inside(a) !== inside(b)) {
      const t = (limit - a.x) / (b.x - a.x);
      out.push({ x: limit, y: a.y + t * (b.y - a.y) });
    }
  }
  return out;
}

export function polyPath(poly: readonly Point[]): string {
  return poly.length > 2 ? `M${poly.map((p) => `${r1(p.x)} ${r1(p.y)}`).join(' L')}Z` : '';
}

// ---------------------------------------------------------------------------------------------
// 繪製的外殼

/** 每個場景一組 defs：夜景光暈的漸層與水面地紋（ID 依實例產生，同一頁有很多章也不會撞） */
export function useSceneIds(): { glow: string; ripple: string } {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return { glow: `${id}g`, ripple: `${id}r` };
}

export function SceneDefs({ ids }: { ids: { glow: string; ripple: string } }) {
  return (
    <defs>
      <radialGradient id={ids.glow}>
        <stop offset="0" stopColor="transparent" stopOpacity={0.7} style={{ stopColor: NIGHT_GLOW }} />
        <stop offset="1" stopColor="transparent" stopOpacity={0} style={{ stopColor: NIGHT_GLOW }} />
      </radialGradient>
      {/* 和 quest-map.css 的海類地紋同一種：128 × 72 裡三個位置不規則的「～」小浪（6.5 不畫一排排短槓） */}
      <pattern id={ids.ripple} width="128" height="72" patternUnits="userSpaceOnUse">
        <path
          d="M12 18q3.5-4 7 0t7 0M78 38q3.5-4 7 0t7 0t7 0M38 60q3.5-4 7 0t7 0"
          fill="none"
          stroke={FOAM}
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.55"
        />
      </pattern>
    </defs>
  );
}

/** 水面地紋的內緣：離軌道 240px 以內不畫，240 到 400（WING_REACH）之間漸隱，和 quest-map.css 的超寬地紋同一條邊（6.6） */
const TEXTURE_CLEAR = 240;

/** 一塊水面的地紋範圍：離軌道 400px 以外至少 160px 寬才畫（否則空字串），範圍往內延到 240px 給漸隱用 */
export function waterTexture(geo: SceneGeo, side: Side, poly: readonly Point[]): string {
  const left = side === 'left';
  const at = (d: number) => (left ? geo.track.left - d : geo.track.right + d);
  const xs = clipPolyX(poly, at(WING_REACH), left).map((p) => p.x);
  return xs.length && Math.max(...xs) - Math.min(...xs) >= 160 ? polyPath(clipPolyX(poly, at(TEXTURE_CLEAR), left)) : '';
}

/** 畫水面地紋（d 由 waterTexture 算）：線性 alpha 遮罩讓內緣在 400 到 240px 之間淡出，不在固定的 x 一刀切齊；同一個場景畫好幾塊時用 k 區分 ID。
 *  stop 的 offset 超出 0 到 1 時瀏覽器會自己夾住（SVG 規格），不必再算 */
export function WaterTexture({ ids, geo, d, k = '' }: { ids: { ripple: string }; geo: SceneGeo; d: string; k?: string }) {
  if (!d) return null;
  const id = `${ids.ripple}x${k}`;
  const W = geo.bandW;
  const stops = [geo.track.left - WING_REACH, geo.track.left - TEXTURE_CLEAR, geo.track.right + TEXTURE_CLEAR, geo.track.right + WING_REACH];
  return (
    <>
      <linearGradient id={`${id}g`} gradientUnits="userSpaceOnUse" x2={W}>
        {stops.map((x, i) => (
          <stop key={i} offset={x / W} stopColor={LINE} stopOpacity={i % 3 ? 0 : 1} />
        ))}
      </linearGradient>
      <mask id={id} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={geo.h} style={{ maskType: 'alpha' }}>
        <rect width={W} height={geo.h} fill={`url(#${id}g)`} />
      </mask>
      <path d={d} fill={`url(#${ids.ripple})`} mask={`url(#${id})`} />
    </>
  );
}

/** 地形塊：畫出來的 path 帶著 data-terrain-block，量測腳本用 isPointInFill 判斷著地 */
export function Terrain({ id, d, fill, children }: { id: string; d: string; fill: string; children?: ReactNode }) {
  return (
    <g>
      <path data-terrain-block={id} d={d} fill={fill} />
      {children}
    </g>
  );
}

/** 不畫出來的地形塊（例如整章的沙地），只給量測與放置器用 */
export function TerrainRect({ id, r }: { id: string; r: Rect }) {
  return <rect data-terrain-block={id} x={r.x0} y={r.y0} width={r.x1 - r.x0} height={r.y1 - r.y0} fill="none" />;
}

/** 放下的物件：子元素畫在 0..w × 0..h 的區域裡，往左是外側；右翼時水平翻轉 */
export function Prop({ p, children }: { p: Placed; children: ReactNode }) {
  const t = p.flip ? `translate(${r1(p.x1)} ${r1(p.y0)}) scale(-1 1)` : `translate(${r1(p.x0)} ${r1(p.y0)})`;
  return (
    <g
      data-prop={p.id}
      data-prop-rect={`${r1(p.x0)} ${r1(p.y0)} ${r1(p.x1)} ${r1(p.y1)}`}
      data-prop-ground={p.ground.join(' ')}
      data-prop-tall={p.tall ? 'true' : undefined}
      data-prop-whole={p.whole ? 'true' : undefined}
      transform={t}
    >
      {children}
    </g>
  );
}

/** 依底線由上往下排序（下方的物件蓋住上方的物件） */
export function byDepth(a: Placed, b: Placed): number {
  return a.y1 - b.y1;
}

// ---------------------------------------------------------------------------------------------
// 共用小物件（各自畫在自己的框裡，尺寸就是 PropSpec 的 w × h）

/** 夜景光暈：淺色主題看不到 */
export function Glow({ x, y, r, gid }: { x: number; y: number; r: number; gid: string }) {
  return <circle cx={x} cy={y} r={r} fill={`url(#${gid})`} />;
}

/** 帆船 48 × 56：船身、兩片帆、桅杆與船尾的浪花 */
export function Sailboat() {
  return (
    <>
      <path d="M6 53q9 4 18 0t18 0" fill="none" stroke={FOAM} strokeWidth="2" strokeLinecap="round" />
      <path d="M4 42h40l-7 9H11Z" fill={WOOD} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M26 8 41 38H26ZM22 14 9 38h13Z" {...dayNight(PAPER, ROCK_DEEP)} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M24 42V5" stroke={LINE} strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

/** 兩隻海鷗 36 × 14 */
export function Gulls() {
  return <path d="M1 12q4-6 8 0q4-6 8 0M19 6q4-5 8 0q4-5 8 0" fill="none" stroke={LINE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />;
}

/** 一叢草 w × h（往上彎的幾筆） */
export function Grass({ w = 28, h = 18 }: { w?: number; h?: number }) {
  const b = h - 1;
  return (
    <path
      d={`M${w * 0.22} ${b}q-1-${h * 0.45}-${w * 0.18}-${h * 0.7}M${w * 0.38} ${b}q0-${h * 0.6} ${w * 0.06}-${h * 0.9}M${w * 0.55} ${b}q1-${h * 0.45} ${w * 0.22}-${h * 0.66}M${w * 0.7} ${b}q2-${h * 0.3} ${w * 0.26}-${h * 0.4}`}
      fill="none"
      stroke={LEAF}
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  );
}

/** 燈柱（可以一次畫好幾盞）：底在 (x, y)、高 h；燈罩是 scene-glow，深色主題多一圈光暈。燈柱與燈罩各合成一個 path */
export function Lamps({ at, gid }: { at: readonly { readonly x: number; readonly y: number; readonly h: number }[]; gid: string }) {
  return (
    <>
      {at.map((l) => (
        <Glow key={`${l.x} ${l.y}`} x={l.x} y={l.y - l.h + 3} r={22} gid={gid} />
      ))}
      <path d={at.map((l) => `M${l.x} ${l.y}V${l.y - l.h + 6}M${l.x - 5} ${l.y - l.h - 2}h10`).join('')} stroke={LINE} strokeWidth="2" strokeLinecap="round" />
      <path d={at.map((l) => `M${l.x - 4} ${l.y - l.h - 1}h8v9h-8Z`).join('')} fill={GLOW} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
    </>
  );
}
