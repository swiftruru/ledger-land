// 闖關地圖的座標樣板（17 第 5.2 節）：純函式，不碰 DOM。
// 每章套一個路線樣板（S 形、之字形、緩弧，依章序輪流），樣板給出每關的水平位置比例（0.15 到 0.85）與垂直間距；
// 章節 ID 當種子加 ±4% 的偏移，讓每章看起來不同但每次打開都一樣。章節牌、章末區與延伸區分隔的高度固定。
// 座標的 y 一律是「從該區塊底部往上」的 px（第 1 關在最下面，17 評估一採 A），畫 SVG 時再換成由上往下。

export type RouteTemplate = 's' | 'zigzag' | 'arc';
export const TEMPLATES: readonly RouteTemplate[] = ['s', 'zigzag', 'arc'];

/** 高度常數（px）：章節牌 120、章末區 160、延伸區分隔 200；相鄰節點垂直距離 112（17 第 2 節的 96 到 128 之間） */
export const BANNER_HEIGHT = 120;
export const END_HEIGHT = 160;
export const EXTENSION_GAP_HEIGHT = 200;
export const NODE_GAP = 112;
/** 第一個與最後一個節點離節點區邊緣的距離，讓節點不壓到章節牌與章末區 */
export const NODE_PAD = 56;
export const X_MIN = 0.15;
export const X_MAX = 0.85;
export const JITTER = 0.04;

export interface LayoutChapterInput {
  readonly id: string;
  readonly levelIds: readonly string[];
  readonly extension?: boolean;
}

export interface LayoutNode {
  readonly levelId: string;
  /** 水平位置比例（0 到 1，相對路線寬度） */
  readonly x: number;
  /** 從節點區底部往上的距離（px） */
  readonly y: number;
}

export interface ChapterLayout {
  readonly chapterId: string;
  readonly template: RouteTemplate;
  readonly extension: boolean;
  readonly nodes: readonly LayoutNode[];
  /** 節點區高度（不含章節牌與章末區） */
  readonly nodesHeight: number;
  /** 整個章節區段的高度 */
  readonly height: number;
  /** 這一章在整張地圖裡的底部位置（從地圖底部往上的 px） */
  readonly offset: number;
  /** 上一章最後一關的 x（第一章為 null）；下一章第一關的 x（最後一章為 null） */
  readonly entryX: number | null;
  readonly exitX: number | null;
}

export interface MapLayout {
  readonly chapters: readonly ChapterLayout[];
  readonly totalHeight: number;
  /** 主線與延伸區之間的分隔（從地圖底部往上的位置）；沒有延伸章時為 null */
  readonly extensionGap: { readonly offset: number; readonly height: number } | null;
}

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

export function templateFor(chapterIndex: number): RouteTemplate {
  return TEMPLATES[((chapterIndex % TEMPLATES.length) + TEMPLATES.length) % TEMPLATES.length]!;
}

/** 樣板在 t（0 到 1）處的水平位置比例；三種樣板的值域都在 X_MIN 到 X_MAX 之間 */
export function templateX(template: RouteTemplate, t: number): number {
  const mid = (X_MIN + X_MAX) / 2;
  const amp = (X_MAX - X_MIN) / 2;
  switch (template) {
    case 's':
      // 一個完整的正弦波：中、右、中、左、中
      return mid + amp * Math.sin(t * Math.PI * 2);
    case 'zigzag': {
      // 兩個三角波：左、右、左、右、左
      const phase = (t * 4) % 4;
      const tri = phase < 1 ? phase : phase < 2 ? 2 - phase : phase < 3 ? -(phase - 2) : -(4 - phase);
      return mid + amp * tri * -1;
    }
    case 'arc':
      // 緩弧：從左下緩緩彎到右上
      return mid - amp * Math.cos(t * Math.PI);
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 單一章節的節點座標；節點數不同時樣板依比例取點 */
export function layoutChapter(input: LayoutChapterInput, chapterIndex: number): Omit<ChapterLayout, 'offset' | 'entryX' | 'exitX'> {
  const template = templateFor(chapterIndex);
  const rand = seededRandom(hashSeed(input.id));
  const n = input.levelIds.length;
  const nodes: LayoutNode[] = input.levelIds.map((levelId, i) => {
    const t = n <= 1 ? 0.5 : i / (n - 1);
    const jitter = (rand() * 2 - 1) * JITTER;
    return { levelId, x: clamp(templateX(template, t) + jitter, X_MIN, X_MAX), y: NODE_PAD + i * NODE_GAP };
  });
  const nodesHeight = n === 0 ? 0 : NODE_PAD * 2 + (n - 1) * NODE_GAP;
  return { chapterId: input.id, template, extension: input.extension === true, nodes, nodesHeight, height: BANNER_HEIGHT + nodesHeight + END_HEIGHT };
}

/** 整張地圖：章節依傳入順序由下往上排列；延伸章之前插入分隔區 */
export function layoutMap(chapters: readonly LayoutChapterInput[]): MapLayout {
  const partial = chapters.map((c, i) => layoutChapter(c, i));
  let offset = 0;
  let extensionGap: MapLayout['extensionGap'] = null;
  const out: ChapterLayout[] = [];
  for (let i = 0; i < partial.length; i++) {
    const p = partial[i]!;
    if (p.extension && extensionGap === null && (i === 0 || !partial[i - 1]!.extension)) {
      extensionGap = { offset, height: EXTENSION_GAP_HEIGHT };
      offset += EXTENSION_GAP_HEIGHT;
    }
    const prev = partial[i - 1];
    const next = partial[i + 1];
    out.push({
      ...p,
      offset,
      entryX: prev && prev.nodes.length > 0 ? prev.nodes[prev.nodes.length - 1]!.x : null,
      exitX: next && next.nodes.length > 0 ? next.nodes[0]!.x : null,
    });
    offset += p.height;
  }
  return { chapters: out, totalHeight: offset, extensionGap };
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** 三次貝茲曲線在 t 的點 */
export function cubicPoint(p0: Point, c0: Point, c1: Point, p1: Point, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return { x: a * p0.x + b * c0.x + c * c1.x + d * p1.x, y: a * p0.y + b * c0.y + c * c1.y + d * p1.y };
}

/** 兩點之間的控制點：垂直方向各取一半的距離，水平不動，路線就是平滑的 S 形 */
export function controlPoints(p0: Point, p1: Point): [Point, Point] {
  const my = (p0.y + p1.y) / 2;
  return [
    { x: p0.x, y: my },
    { x: p1.x, y: my },
  ];
}

export function cubicPath(p0: Point, p1: Point): string {
  const [c0, c1] = controlPoints(p0, p1);
  const f = (n: number) => Number(n.toFixed(1));
  return `M${f(p0.x)} ${f(p0.y)} C${f(c0.x)} ${f(c0.y)} ${f(c1.x)} ${f(c1.y)} ${f(p1.x)} ${f(p1.y)}`;
}

/** 沿貝茲曲線取 samples 個點（含起點與終點），給角色移動用 */
export function sampleCubic(p0: Point, p1: Point, samples = 24): Point[] {
  const [c0, c1] = controlPoints(p0, p1);
  const out: Point[] = [];
  for (let i = 0; i <= samples; i++) out.push(cubicPoint(p0, c0, c1, p1, i / samples));
  return out;
}

export interface RouteSegment {
  /** SVG path 的 d（座標原點是章節區段的左上角，y 向下） */
  readonly d: string;
  /** 這一段走到的關卡（進入章節的第一段也算到第一關；離開章節的最後一段為 null） */
  readonly toLevelId: string | null;
}

/** 節點在章節區段 SVG 座標系的位置（左上角為原點） */
export function nodeSvgPoint(layout: ChapterLayout, node: LayoutNode, width: number): Point {
  return { x: node.x * width, y: layout.height - BANNER_HEIGHT - node.y };
}

/** 一章的路線：進入段（上一章最後一關的 x 從底邊接到第一關）、節點之間、離開段（最後一關接到頂邊） */
export function routeSegments(layout: ChapterLayout, width: number): RouteSegment[] {
  const pts = layout.nodes.map((n) => nodeSvgPoint(layout, n, width));
  const segs: RouteSegment[] = [];
  if (pts.length === 0) return segs;
  if (layout.entryX !== null) segs.push({ d: cubicPath({ x: layout.entryX * width, y: layout.height }, pts[0]!), toLevelId: layout.nodes[0]!.levelId });
  for (let i = 1; i < pts.length; i++) segs.push({ d: cubicPath(pts[i - 1]!, pts[i]!), toLevelId: layout.nodes[i]!.levelId });
  if (layout.exitX !== null) segs.push({ d: cubicPath(pts[pts.length - 1]!, { x: layout.exitX * width, y: 0 }), toLevelId: null });
  return segs;
}

/** 節點在整張地圖座標系的位置：x 是 px、y 是從地圖底部往上的 px */
export function nodeMapPoint(map: MapLayout, levelId: string, width: number): Point | null {
  for (const c of map.chapters) {
    const n = c.nodes.find((x) => x.levelId === levelId);
    if (n) return { x: n.x * width, y: c.offset + BANNER_HEIGHT + n.y };
  }
  return null;
}
