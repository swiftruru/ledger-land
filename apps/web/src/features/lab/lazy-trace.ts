// 來源面板（TracePanel.tsx 與它的樹、來源步驟、純函式）的延後載入：第一次點可追蹤的數字才載（06 第 8.2 節），不在步驟頁的第一波，
// 也不在階段 2 到 10 的畫面元件 chunk 裡（lab-stages）。和 lazy-stages.ts 同一套做法：失敗不留著被拒絕的 Promise，下一次呼叫重新 import。
export type TraceViews = typeof import('./TracePanel.tsx');

let promise: Promise<TraceViews> | null = null;
let loaded: TraceViews | null = null;

export function loadTracePanel(): Promise<TraceViews> {
  promise ??= import('./TracePanel.tsx').then(
    (m) => (loaded = m),
    (e: unknown) => {
      promise = null;
      throw e;
    },
  );
  return promise;
}

/** 已經載好的面板（同步）；還沒載好時是 null */
export function tracePanelNow(): TraceViews | null {
  return loaded;
}
