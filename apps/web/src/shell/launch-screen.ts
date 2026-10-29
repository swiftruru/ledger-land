// 啟動畫面的停留與離場（06 第 2.4 節）：殼層 index.html 的 #ll-launch 只在 App 模式（boot 腳本寫的 html[data-display=app]）顯示，
// 系統的啟動圖換到它的時候畫面一模一樣，所以使用者從按下圖示開始看到的是同一張圖；這裡讓它至少停到導覽開始後 1.5 秒（維護者 2026-10-28：
// 系統啟動圖只閃一下，沒有記憶點），而且要等第一頁的資料齊了（PageReveal 掀開布幕）才淡出，不會露出空的殼層。
// 重新整理（更新提示的「重新整理」、重試按鈕）不算冷啟動，不等 1.5 秒；頁面一直沒掀開時 4 秒上限移除，壞掉的頁面不會被蓋住。
// 減少動態：沒有轉場，直接移除。這個模組不 import 任何東西（在首次載入的 chunk 裡，/en/ 的預算只剩約 1 KB）。
declare global {
  interface Window {
    __llGlassReady?: boolean;
    __llReapplyGlass?: () => void;
  }
}

const HOLD_MS = 1500;
const CAP_MS = 4000;
const FADE_FALLBACK_MS = 400;

let done = false;
let armed = false;
let timer = 0;

function node(): HTMLElement | null {
  return document.getElementById('ll-launch');
}

/** 系統啟動圖換到 App 畫面的交接已經過了，boot 腳本在 App 模式先壓成 solid 的玻璃可以開回來（06 第 2.4 節第 7 點） */
function enableGlass(): void {
  if (window.__llGlassReady) return;
  window.__llGlassReady = true;
  window.__llReapplyGlass?.();
}

function remove(): void {
  if (done) return;
  done = true;
  clearTimeout(timer);
  enableGlass();
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
  // 玻璃在覆蓋層淡出時開回來：這時交接早就結束，而且覆蓋層還蓋著 Tab bar，看不到切換
  enableGlass();
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
  // 計時器只有毫秒的解析度，取整後再多等 1ms，離場不會早於 1.5 秒
  const wait = isReload() ? 0 : Math.ceil(HOLD_MS - performance.now()) + 1;
  clearTimeout(timer);
  if (wait <= 0) leave();
  else timer = window.setTimeout(leave, wait);
}
