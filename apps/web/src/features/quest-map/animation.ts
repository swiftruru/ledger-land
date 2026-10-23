// 角色移動與星星點亮（17 第 3.6 節）：Web Animations API 沿貝茲曲線逐點 transform，600 到 900ms；減少動態時直接出現。
import { sampleCubic, type Point } from './layout.ts';

export const MARKER_SIZE = 76;

/** 系統的減少動態，或 App 內的開關（tokens.css 的 html[data-motion="reduced"]） */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  if (document.documentElement.dataset.motion === 'reduced') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 角色站在節點上的 transform：水平置中在節點上，鞋子踩在節點（直徑 56px）的上緣 */
export function markerTransform(p: Point): string {
  const x = Math.round(p.x - MARKER_SIZE / 2);
  const y = Math.round(p.y + 30);
  return `translate(${x}px, ${-y}px)`;
}

/** 依距離決定時長：相鄰節點 600ms，跨越多格最多 900ms */
export function walkDuration(from: Point, to: Point): number {
  const d = Math.hypot(to.x - from.x, to.y - from.y);
  return Math.round(Math.min(900, Math.max(600, 600 + (d - 112) * 1.2)));
}

export async function walkMarker(el: HTMLElement | SVGElement, from: Point, to: Point, reduced = prefersReducedMotion()): Promise<void> {
  const end = markerTransform(to);
  if (reduced || typeof el.animate !== 'function') {
    el.style.transform = end;
    return;
  }
  const frames = sampleCubic(from, to, 24).map((p) => ({ transform: markerTransform(p) }));
  const anim = el.animate(frames, { duration: walkDuration(from, to), easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'forwards' });
  try {
    await anim.finished;
  } catch {
    /* 被取消時直接定位 */
  }
  anim.cancel();
  el.style.transform = end;
}

/** 星星依序點亮：每顆 120ms；減少動態時一次全亮。回傳取消函式 */
export function lightStars(target: 0 | 1 | 2 | 3, onStep: (n: 0 | 1 | 2 | 3) => void, reduced = prefersReducedMotion()): () => void {
  if (reduced || target === 0) {
    onStep(target);
    return () => {};
  }
  const timers: ReturnType<typeof setTimeout>[] = [];
  for (let i = 1; i <= target; i++) timers.push(setTimeout(() => onStep(i as 1 | 2 | 3), i * 120));
  return () => timers.forEach(clearTimeout);
}

export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
