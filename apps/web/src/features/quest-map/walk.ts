// 角色沿路線移動（圖規第 2.8 節）：路徑（walkPlan）與時間軸（walkTimeline）是純函式；播放（walkMarkerAlong，Web Animations API 沿路線逐點 transform，
// 減少動態時直接定位）也放在這裡，三個一起延後載入。
// 只有 ?from= 的過關回饋用到，所以和第一次繪製要的幾何（layout.ts）分開：vite.config.ts 的 quest-map 群組排除這個檔案、Play 以 import() 載入，
// 它就會自成一個延後的 chunk（約 1.3 KB gzip）；沒有排除時照樣併在地圖的 chunk 裡，功能相同。
// 時間：章內一段 700ms（--ll-ease-standard），跨章在拱門下停 400ms，總長不超過 2,200ms；減少動態時直接定位（animation.ts）。
import { prefersReducedMotion } from './animation.ts';
import { markerTransform, pointAtLength, polylineLength, type Point, type QuestMapLayout, type RouteSegment } from './layout.ts';

/** 章內一段的時長 */
export const STEP_MS = 700;
/** 跨章時在拱門下停的時間（完成時紙籤與拱心石彈出） */
export const ARCH_PAUSE_MS = 400;
/** 一次移動的總長上限（含停頓） */
export const WALK_MAX_MS = 2200;
/** --ll-ease-standard（packages/tokens 的 motion.ease.standard，測試核對） */
export const EASE_STANDARD: readonly [number, number, number, number] = [0.2, 0, 0, 1];

export interface WalkLeg {
  /** 整張地圖座標（y 從地圖底部往上） */
  readonly points: readonly Point[];
  readonly length: number;
  /** 這一段走完後在拱門下停一下：那一章的 ID；不停時為 null */
  readonly pauseChapterId: string | null;
}

export interface WalkPlan {
  readonly legs: readonly WalkLeg[];
  /** 經過幾段路線（關到關 1 段；跨章是出口、海峽、入口各 1 段）：決定總時長 */
  readonly hops: number;
}

interface WalkTrack {
  readonly points: Point[];
  readonly segOf: number[];
  readonly nodeIndex: Map<string, number>;
  readonly archIndex: Map<number, string>;
}

const tracks = new WeakMap<QuestMapLayout, WalkTrack>();

/** 把整張地圖的路線串成一條折線（地圖座標），記下每個節點與每座拱門中心的位置 */
function walkTrack(map: QuestMapLayout): WalkTrack {
  const cached = tracks.get(map);
  if (cached) return cached;
  const t: WalkTrack = { points: [], segOf: [], nodeIndex: new Map(), archIndex: new Map() };
  let seg = 0;
  const add = (s: RouteSegment, offset: number, arch: { center: Point; chapterId: string } | null) => {
    for (const p of s.samples) {
      // 段與段、章與章的交界是同一點，只留一個（它屬於先走到它的那一段）
      const q = { x: p.x, y: p.y + offset };
      const last = t.points[t.points.length - 1];
      if (!last || Math.abs(last.x - q.x) > 1e-6 || Math.abs(last.y - q.y) > 1e-6) {
        t.points.push(q);
        t.segOf.push(seg);
      }
      if (arch && p.x === arch.center.x && p.y === arch.center.y) t.archIndex.set(t.points.length - 1, arch.chapterId);
    }
    if (s.toLevelId !== null && (s.kind === 'enter' || s.kind === 'step')) t.nodeIndex.set(s.toLevelId, t.points.length - 1);
    seg++;
  };
  for (const c of map.chapters) {
    if (map.strait && map.strait.beforeIndex === c.index) add(map.strait.segment, map.strait.offset, null);
    for (const s of c.segments) add(s, c.offset, s.kind === 'exit' && !c.last ? { center: c.archCenter, chapterId: c.chapterId } : null);
  }
  tracks.set(map, t);
  return t;
}

/**
 * 從一關走到另一關的路徑：往前走時沿路線經過的每一段都走，跨章時在第一座經過的拱門下停一下；往回走時沿路線倒退、不停。
 * 找不到關卡時為 null；同一關時沒有任何一段。
 */
export function walkPlan(map: QuestMapLayout, fromLevelId: string, toLevelId: string): WalkPlan | null {
  const t = walkTrack(map);
  const a = t.nodeIndex.get(fromLevelId);
  const b = t.nodeIndex.get(toLevelId);
  if (a === undefined || b === undefined) return null;
  if (a === b) return { legs: [], hops: 0 };
  const leg = (from: number, to: number, pauseChapterId: string | null): WalkLeg => {
    const pts = from <= to ? t.points.slice(from, to + 1) : t.points.slice(to, from + 1).reverse();
    return { points: pts, length: polylineLength(pts), pauseChapterId };
  };
  const hops = Math.abs(t.segOf[b]! - t.segOf[a]!);
  if (a > b) return { legs: [leg(a, b, null)], hops };
  for (let i = a + 1; i < b; i++) {
    const chapterId = t.archIndex.get(i);
    if (chapterId !== undefined) return { legs: [leg(a, i, chapterId), leg(i, b, null)], hops };
  }
  return { legs: [leg(a, b, null)], hops };
}

/** CSS cubic-bezier(x1, y1, x2, y2) 的時間函式：輸入時間比例 0 到 1，輸出進度比例 */
export function cubicBezierEasing(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const bez = (a: number, b: number, s: number) => 3 * (1 - s) * (1 - s) * s * a + 3 * (1 - s) * s * s * b + s * s * s;
  const dBez = (a: number, b: number, s: number) => 3 * (1 - s) * (1 - s) * a + 6 * (1 - s) * s * (b - a) + 3 * s * s * (1 - b);
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    // 先用牛頓法解 x(s) = t，不收斂時改用二分法
    let s = t;
    for (let i = 0; i < 8; i++) {
      const err = bez(x1, x2, s) - t;
      if (Math.abs(err) < 1e-6) return bez(y1, y2, s);
      const d = dBez(x1, x2, s);
      if (Math.abs(d) < 1e-6) break;
      s -= err / d;
    }
    let lo = 0;
    let hi = 1;
    s = t;
    for (let i = 0; i < 40; i++) {
      const x = bez(x1, x2, s);
      if (Math.abs(x - t) < 1e-6) break;
      if (x < t) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return bez(y1, y2, s);
  };
}

const easeStandard = cubicBezierEasing(...EASE_STANDARD);

export interface WalkFrame {
  readonly transform: string;
  readonly offset: number;
}

export interface WalkTimeline {
  /** 線性播放的關鍵影格（緩動已經算進位置裡，每一段各自緩入緩出） */
  readonly frames: readonly WalkFrame[];
  readonly duration: number;
  /** 停頓開始的時間點（ms）與那一章的 ID：頁面在這時候播紙籤與拱心石的慶祝 */
  readonly pauses: readonly { readonly at: number; readonly chapterId: string }[];
  /** 終點（地圖座標）；沒有任何一段時為 null */
  readonly end: Point | null;
}

/**
 * 依路徑分配時間：移動時間 = min(700ms × 經過的段數, 2,200ms - 停頓)，依弧長分給各段；每段套 --ll-ease-standard。
 * 跨相鄰兩章（出口、入口兩段加停頓）是 1,800ms；更遠的移動壓在 2,200ms 以內。
 */
export function walkTimeline(plan: WalkPlan): WalkTimeline {
  const legs = plan.legs.filter((l) => l.points.length > 0);
  const last = legs[legs.length - 1];
  const end = last ? last.points[last.points.length - 1]! : null;
  if (legs.length === 0) return { frames: [], duration: 0, pauses: [], end };
  const pauseTotal = legs.filter((l) => l.pauseChapterId !== null).length * ARCH_PAUSE_MS;
  const moving = Math.max(STEP_MS, Math.min(STEP_MS * Math.max(1, plan.hops), WALK_MAX_MS - pauseTotal));
  const totalLength = legs.reduce((s, l) => s + l.length, 0);
  const duration = moving + pauseTotal;
  const frames: { transform: string; time: number }[] = [];
  const pauses: { at: number; chapterId: string }[] = [];
  let time = 0;
  for (const leg of legs) {
    const legMs = totalLength > 0 ? (moving * leg.length) / totalLength : moving / legs.length;
    const steps = Math.min(120, Math.max(8, Math.ceil(legMs / 16)));
    for (let k = frames.length === 0 ? 0 : 1; k <= steps; k++) {
      const t = k / steps;
      frames.push({ transform: markerTransform(pointAtLength(leg.points, easeStandard(t) * leg.length)), time: time + t * legMs });
    }
    time += legMs;
    if (leg.pauseChapterId !== null) {
      pauses.push({ at: time, chapterId: leg.pauseChapterId });
      time += ARCH_PAUSE_MS;
      frames.push({ transform: frames[frames.length - 1]!.transform, time });
    }
  }
  return { frames: frames.map((f) => ({ transform: f.transform, offset: Math.min(1, f.time / duration) })), duration, pauses, end };
}

export interface WalkOptions {
  readonly reduced?: boolean;
  /** 取消時直接定位到終點（頁面離開、半途打開表單或切換檢視） */
  readonly signal?: AbortSignal;
  /** 到拱門下開始停頓時呼叫；減少動態或已取消時，定位前立刻依序呼叫 */
  readonly onPause?: (chapterId: string) => void;
}

/** 沿 walkTimeline 的關鍵影格移動角色；減少動態、沒有 Web Animations 或已取消時直接定位到終點 */
export async function walkMarkerAlong(el: HTMLElement | SVGElement, tl: WalkTimeline, opts: WalkOptions = {}): Promise<void> {
  const endTransform = tl.frames[tl.frames.length - 1]?.transform;
  if (!endTransform) return;
  const reduced = opts.reduced ?? prefersReducedMotion();
  if (reduced || typeof el.animate !== 'function' || opts.signal?.aborted) {
    for (const p of tl.pauses) opts.onPause?.(p.chapterId);
    el.style.transform = endTransform;
    return;
  }
  const anim = el.animate(
    tl.frames.map((f) => ({ transform: f.transform, offset: f.offset })),
    { duration: tl.duration, easing: 'linear', fill: 'forwards' },
  );
  const timers = tl.pauses.map((p) => setTimeout(() => opts.onPause?.(p.chapterId), p.at));
  const abort = () => anim.cancel();
  opts.signal?.addEventListener('abort', abort, { once: true });
  try {
    await anim.finished;
  } catch {
    /* 被取消時直接定位 */
  }
  timers.forEach(clearTimeout);
  opts.signal?.removeEventListener('abort', abort);
  anim.cancel();
  el.style.transform = endTransform;
}
