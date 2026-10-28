// 啟動畫面的停留與離場（06 第 2.4 節）：殼層 index.html 的 #ll-launch 只在 App 模式（boot 腳本寫的 html[data-display=app]）顯示，
// 系統的啟動圖換到它的時候畫面一模一樣，所以使用者從按下圖示開始看到的是同一張圖；這裡讓它至少停到導覽開始後 1.5 秒（維護者 2026-10-28：
// 系統啟動圖只閃一下，沒有記憶點），而且要等第一頁的資料齊了（PageReveal 掀開布幕）才淡出，不會露出空的殼層。
// 重新整理（更新提示的「重新整理」、重試按鈕）不算冷啟動，不等 1.5 秒；頁面一直沒掀開時 4 秒上限移除，壞掉的頁面不會被蓋住。
// 減少動態：沒有轉場，直接移除。這個模組不 import 任何東西（在首次載入的 chunk 裡，/en/ 的預算只剩約 1 KB）。
const HOLD_MS = 1500;
const CAP_MS = 4000;
const FADE_FALLBACK_MS = 400;

let done = false;
let armed = false;
let timer = 0;

function node(): HTMLElement | null {
  return document.getElementById('ll-launch');
}

function remove(): void {
  if (done) return;
  done = true;
  clearTimeout(timer);
  node()?.remove();
}

function reducedMotion(): boolean {
  if (document.documentElement.dataset.motion === 'reduced') return true;
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function leave(): void {
  if (done) return;
  const el = node();
  if (!el || reducedMotion()) {
    remove();
    return;
  }
  clearTimeout(timer);
  el.addEventListener('transitionend', remove, { once: true });
  el.dataset.leave = '';
  timer = window.setTimeout(remove, FADE_FALLBACK_MS);
}

function isReload(): boolean {
  const nav = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
  return nav?.type === 'reload';
}

/** App 啟動時（main.tsx 的第一件事）：不是 App 模式就直接移除；是的話起 4 秒的上限 */
export function armLaunchScreen(): void {
  if (armed || done) return;
  armed = true;
  if (document.documentElement.dataset.display !== 'app' || !node()) {
    remove();
    return;
  }
  timer = window.setTimeout(leave, CAP_MS);
}

/** 第一頁掀開布幕時（PageReveal）：等到導覽開始後 1.5 秒才離場；重新整理不等。重複呼叫與移除後呼叫都沒有作用 */
export function dismissLaunchScreen(): void {
  if (done) return;
  if (!armed) armLaunchScreen();
  if (done) return;
  const wait = isReload() ? 0 : HOLD_MS - performance.now();
  clearTimeout(timer);
  if (wait <= 0) leave();
  else timer = window.setTimeout(leave, wait);
}
