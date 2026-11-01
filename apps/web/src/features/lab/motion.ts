// 減少動態效果（03 第 3.11 節）：系統設定或 App 內的開關（tokens.css 的 html[data-motion="reduced"]）。和 quest-map/animation.ts 同一個判斷，
// 不從那裡 import（會把地圖的 chunk 一起載進實驗室）。
export function labPrefersReducedMotion(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;
  if (document.documentElement.dataset['motion'] === 'reduced') return true;
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
