// 星星點亮與減少動態的判斷（17 第 3.6 節、圖規第 2.8 節）。角色沿路線移動的播放（walkMarkerAlong）在 walk.ts（第 5 輪看圖驗收後的體積調整：
// 只有 ?from= 的過關回饋用到，和 walkPlan、walkTimeline 一起延後載入，不佔地圖 chunk）。角色的尺寸與定位在 layout.ts（MARKER_SIZE 60、markerTransform）。

/** 系統的減少動態，或 App 內的開關（tokens.css 的 html[data-motion="reduced"]） */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  if (document.documentElement.dataset.motion === 'reduced') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
