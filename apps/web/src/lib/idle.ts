// 第一次繪製之後才做的事（06 第 8.2 節的 LCP 預算）：開進度資料庫會載入 runtime 與核心的 chunk，不該跟頁面內容搶首次載入的頻寬與主執行緒。
// iOS Safari 沒有 requestIdleCallback，退回 setTimeout；回傳取消函式給 effect 的清理用。
export function whenIdle(fn: () => void, timeout = 2000): () => void {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(fn, { timeout });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(fn, 0);
  return () => clearTimeout(id);
}

/** 第一次繪製真的送到螢幕之後才做的暖機（開進度資料庫這類不急的事）：等兩個動畫影格（第一格把目前的畫面送出去）、等閒置，再多等 settleMs。
 *  Lighthouse 把 LCP 之前開始的請求都算進 LCP；React 的第一次 commit 與 LCP 的繪製只差幾毫秒，只靠影格與閒置仍會搶在 LCP 前面，
 *  本機量測時首頁與名詞頁因此多算約 0.3 到 0.4 秒（06 第 8.2 節）。沒有 requestAnimationFrame 的環境直接退回 whenIdle 加 settleMs。
 *  只給不會改變版面的暖機用（main.tsx 的開庫、首頁待複習數）；會插在內容上方的橫幅（Safari 分頁提示、安裝建議、備份提醒、匯入提示）仍用 whenIdle，
 *  否則它們會在使用者開始捲動之後才把內容往下推（CI 的 WebKit 曾因此讓切換語言的錨點還原差 700px）。 */
export function afterFirstPaint(fn: () => void, settleMs = 400, timeout = 2000): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const settle = () => {
    timer = setTimeout(fn, settleMs);
  };
  let cancelIdle: (() => void) | null = null;
  let outer = 0;
  let inner = 0;
  if (typeof requestAnimationFrame !== 'function') cancelIdle = whenIdle(settle, timeout);
  else
    outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        cancelIdle = whenIdle(settle, timeout);
      });
    });
  return () => {
    if (outer) cancelAnimationFrame(outer);
    if (inner) cancelAnimationFrame(inner);
    cancelIdle?.();
    if (timer !== null) clearTimeout(timer);
  };
}
