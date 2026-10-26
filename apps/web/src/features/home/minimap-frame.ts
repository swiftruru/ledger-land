// 首頁章節小地圖的取景（站規 1.16，第 1 輪看圖驗收的 blocker）：純函式，不碰 DOM，測試在 apps/web/test/minimap-frame.test.ts。
// 規則：
// 1. 節點（圓盤、底邊、目前關的光暈與站在上面的鈴）要嘛完整在框內、離上下緣至少 MARGIN，要嘛完整在框外；不切一半（文字不得被遮住）。
// 2. 一定要入鏡的：有進度時是前一關、目前關、下一關（同一章裡有的才算）；新使用者是起點石、第一關與第二關，視窗下緣對齊起點石。
//    放不下時先把畫面縮小（ZOOMS 由大到小），縮到最小仍放不下才依序少放下一關、前一關。
// 3. 目前關的圓心盡量在由上往下 55% 的位置；為了第 1、2 點要移動時，移最少的距離。
// 4. 視窗盡量不超出這一章的上下緣（超出的地方沒有路線，只有地景底色）。
// 節點、鈴與起點石在畫面上維持固定的 px 大小（不跟著縮小，代號才讀得到）；縮放只改變節點之間的距離與路線的長短。
// 完成的計分關卡下方有星星籤（第 2 輪看圖驗收：和地圖頁一樣看得出拿了幾顆星），它也算在節點的範圍裡，不會被切掉。
// 座標：layout.ts 的章節座標（y 向上，原點是區段左下角）；這裡的計算都換成畫面 px（乘上 zoom），結果再換回章節座標。

/** 畫面上的固定尺寸（px）：圓盤半徑、立體底邊、目前關光暈的外緣、鈴的大小與腳站的高度、起點石半徑、入鏡時離邊緣的最小距離 */
export const MINI = {
  nodeR: 22,
  ledge: 4,
  halo: 6,
  bell: 48,
  /** 鈴的腳底在圓心上方幾 px（MapMarker grounded：鞋底貼齊外框底邊）：離目前關光暈的外緣（nodeR + halo）2px，影子落在光暈上，讀起來是站在節點上。
   *  地圖頁是 4px；小地圖 240 高要放下三關，再高一點最小縮放時就放不下（minimap-frame.test.ts） */
  bellStand: 30,
  /** 鈴外框上緣到帽頂的空白（grounded 的 viewBox 往下移，帽頂約在外框 0.2 的高度）：取景只算看得到的部分 */
  bellTop: 9,
  stoneR: 8,
  margin: 10,
  /** 星星籤（地圖頁 60 × 22 的約 0.7 倍）：寬、高、離底邊的距離與星星大小 */
  starsW: 42,
  starsH: 16,
  starsGap: 3,
  star: 10,
} as const;

/**
 * 縮小後重排的軌道寬上限（排版座標，ChapterMiniMap 用）：左右兩欄的水平差不超過 NODE_GAP ÷ tan 20°（約 330），加左右欄內縮 52 × 2，
 * 和手機地圖的軌道（最寬 440）差不多，縮小時路線和手機上的地圖同一種比例，兩側鋪地景。
 * 第 1 輪修正時的理由是「折返把手斜 20 度、水平差再大時兩關中間的路比兩端平」（TURN_SLOPE 保留在 layout.ts，只給這裡的上下限測試用）。
 * 第 3 輪看圖驗收後地圖的折返改成 30 度（layout.ts 的 switchbackHandle 與 SWITCHBACK），關到關把手的垂直分量最多 54（NODE_GAP 的一半以內），
 * 兩關之間的曲線一定單調上升；小地圖直接沿用 layoutMap 的路段，會自動跟著變，這個上限不必改（2026-10-25 第 3 輪 handoff 確認）。
 * 首頁的小地圖在第 2 輪看圖驗收時已經通過，維持這個上限，不改變小地圖的比例。要放寬時一起改 minimap-frame.test.ts 的上下限。
 */
export const LAYOUT_MAX = 430;

/** 可用的縮放（由大到小）：第一個放得下必要節點的就用它 */
export const ZOOMS: readonly number[] = [0.72, 0.64, 0.58, 0.52, 0.47, 0.42];

/** 目前關的圓心在視窗中由下往上的比例（由上往下 55%） */
export const ANCHOR_FROM_BOTTOM = 0.45;

export interface FrameNode {
  readonly levelId: string;
  /** 圓心，章節座標（y 向上） */
  readonly y: number;
  /** 下方有星星籤（完成的計分關卡） */
  readonly stars?: boolean;
}

export interface FrameInput {
  /** 這一章的節點（依關序，由下往上） */
  readonly nodes: readonly FrameNode[];
  /** 章節區段高度（章節座標） */
  readonly chapterHeight: number;
  /** 起點石的圓心 y（只有第 1 章有）；新使用者時視窗下緣對齊它 */
  readonly stoneY: number | null;
  /** 鈴站的關卡（下一關）；null 時沒有鈴 */
  readonly currentId: string | null;
  /** 新使用者：從起點石開始取景 */
  readonly fromStart: boolean;
  /** 視窗高度（畫面 px） */
  readonly height: number;
  /** 可用的縮放，預設 ZOOMS */
  readonly zooms?: readonly number[];
}

export interface MiniFrame {
  readonly zoom: number;
  /** 視窗下緣與上緣（章節座標） */
  readonly bottom: number;
  readonly top: number;
  /** 一定入鏡的關卡（測試與除錯用） */
  readonly required: readonly string[];
}

type Span = readonly [number, number];

/** 一個物件在畫面上的範圍：圓心 c（px，向上）、往上 up、往下 dn */
interface Item {
  readonly c: number;
  readonly up: number;
  readonly dn: number;
}

function normalise(spans: Span[]): Span[] {
  const s = spans.filter(([a, b]) => a <= b).sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const [a, b] of s) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

function intersect(a: readonly Span[], b: readonly Span[]): Span[] {
  const out: Span[] = [];
  for (const [a0, a1] of a) for (const [b0, b1] of b) if (Math.max(a0, b0) <= Math.min(a1, b1)) out.push([Math.max(a0, b0), Math.min(a1, b1)]);
  return normalise(out);
}

/** 視窗下緣 b 的可行範圍：入鏡（含邊距）或完整在框外 */
function allowed(it: Item, H: number, required: boolean): Span[] {
  const inside: Span = [it.c + it.up + MINI.margin - H, it.c - it.dn - MINI.margin];
  if (required) return normalise([inside]);
  return normalise([[-Infinity, it.c - it.dn - H], inside, [it.c + it.up, Infinity]]);
}

/** spans 裡最接近 want 的值 */
function nearest(spans: readonly Span[], want: number): number {
  let best = Number.NaN;
  for (const [a, b] of spans) {
    const v = Math.min(Math.max(want, a), b);
    if (Number.isNaN(best) || Math.abs(v - want) < Math.abs(best - want)) best = v;
  }
  return best;
}

/** 圓心下方到節點最下緣的距離（px）：底邊，或底邊下方的星星籤 */
export function nodeBelow(stars: boolean | undefined): number {
  return MINI.nodeR + MINI.ledge + (stars ? MINI.starsGap + MINI.starsH : 0);
}

/** 節點在畫面上的範圍：目前關多了光暈與鈴；完成的計分關卡多了星星籤 */
function nodeItem(n: FrameNode, zoom: number, current: boolean): Item {
  const below = nodeBelow(n.stars);
  return current
    ? { c: n.y * zoom, up: Math.max(MINI.nodeR + MINI.halo, MINI.bellStand + MINI.bell - MINI.bellTop), dn: Math.max(below, MINI.nodeR + MINI.halo) }
    : { c: n.y * zoom, up: MINI.nodeR, dn: below };
}

export function frameMiniMap(input: FrameInput): MiniFrame {
  const { nodes, chapterHeight, stoneY, currentId, fromStart, height: H } = input;
  const zooms = input.zooms ?? ZOOMS;
  const ci = currentId === null ? -1 : nodes.findIndex((n) => n.levelId === currentId);
  const cur = ci >= 0 ? nodes[ci] : nodes[0];
  const idx = ci >= 0 ? ci : 0;
  const withStone = fromStart && stoneY !== null;
  const ids = (...k: number[]) => k.filter((i) => i >= 0 && i < nodes.length).map((i) => nodes[i]!.levelId);
  // 必要節點的組合，依偏好排列（越前面越完整）：連續三關（目前關在中間；在章首或章末時往另一邊多放一關，看得出走過或要走的路），
  // 再來是兩關（先放走過的前一關），最後只有目前關
  const three = idx === 0 ? ids(0, 1, 2) : idx === nodes.length - 1 ? ids(idx - 2, idx - 1, idx) : ids(idx - 1, idx, idx + 1);
  const sets: string[][] = withStone ? [ids(idx, idx + 1), ids(idx)] : [three, ids(idx - 1, idx, idx + 1), ids(idx - 1, idx), ids(idx, idx + 1), ids(idx)];
  const uniqueSets = sets.filter((s, i) => sets.findIndex((t) => t.join() === s.join()) === i);

  for (const req of uniqueSets) {
    for (const zoom of zooms) {
      let feasible: Span[] = [[-Infinity, Infinity]];
      for (const n of nodes) {
        const it = nodeItem(n, zoom, currentId !== null && n.levelId === currentId);
        feasible = intersect(feasible, allowed(it, H, req.includes(n.levelId)));
        if (feasible.length === 0) break;
      }
      if (stoneY !== null && feasible.length > 0) {
        const stone: Item = { c: stoneY * zoom, up: MINI.stoneR, dn: MINI.stoneR };
        feasible = intersect(feasible, allowed(stone, H, withStone));
      }
      if (feasible.length === 0) continue;
      // 想要的下緣：新使用者對齊起點石；其他是目前關在 45%（由下往上）
      const want = withStone && stoneY !== null ? stoneY * zoom - MINI.stoneR - MINI.margin : (cur?.y ?? 0) * zoom - ANCHOR_FROM_BOTTOM * H;
      // 盡量不超出章節上下緣（新使用者的下緣可以略低於 0：起點石離區段底只有 24）
      const lo = withStone ? Number.NEGATIVE_INFINITY : 0;
      const hi = chapterHeight * zoom - H;
      const inChapter = intersect(feasible, [[lo, Math.max(lo, hi)]]);
      const b = nearest(inChapter.length > 0 ? inChapter : feasible, want);
      const bottom = b / zoom;
      return { zoom, bottom, top: bottom + H / zoom, required: req };
    }
  }
  // 理論上到不了（只放目前關一定放得下）；保險起見回傳最小縮放、目前關置中
  const zoom = zooms[zooms.length - 1] ?? 1;
  const bottom = ((cur?.y ?? 0) * zoom - H / 2) / zoom;
  return { zoom, bottom, top: bottom + H / zoom, required: ids(idx) };
}
