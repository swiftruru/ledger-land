// 結果頁元件的延後載入（06 第 8.2 節）：結果頁只在整關完成後出現，而且一定要等判分模組算出星星（scoring-lazy.ts），
// 所以和判分一起在第一次繪製送出後預載，不放在作答頁第一波的 chunk 裡。Level.tsx 先等兩者都到了才把結果寫進狀態，
// 結果頁不會出現載入中的空白，焦點也能直接移到結果標題。載入失敗時不留著被拒絕的 Promise，下一次呼叫重新 import。
export type ResultViewComponent = typeof import('./ResultView.tsx').ResultView;

let promise: Promise<ResultViewComponent> | null = null;

export function loadResultView(): Promise<ResultViewComponent> {
  promise ??= import('./ResultView.tsx').then(
    (m) => m.ResultView,
    (e: unknown) => {
      promise = null;
      throw e;
    },
  );
  return promise;
}
