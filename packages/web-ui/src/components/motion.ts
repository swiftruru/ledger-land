// 元件內要判斷「減少動態」時共用：系統的 prefers-reduced-motion，或 App 內的開關（tokens.css 的 html[data-motion="reduced"]）
export function uiPrefersReducedMotion(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return true;
  if (document.documentElement.dataset['motion'] === 'reduced') return true;
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
