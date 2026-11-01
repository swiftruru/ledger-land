// 步驟頁階段 2 到 10 的畫面元件（stage-views.tsx）的延後載入：和 lazy-core.ts 同一套做法，頁面在畫面掀開之後預載，
// 使用者要往階段 2 走而還沒載好時先記著（LabStep.tsx 的 pendingStage）。失敗不留著被拒絕的 Promise，下一次呼叫重新 import。
export type StageViews = typeof import('./stage-views.tsx');

let promise: Promise<StageViews> | null = null;
let loaded: StageViews | null = null;

export function loadStageViews(): Promise<StageViews> {
  promise ??= import('./stage-views.tsx').then(
    (m) => (loaded = m),
    (e: unknown) => {
      promise = null;
      throw e;
    },
  );
  return promise;
}

/** 已經載好的階段畫面（同步）；還沒載好時是 null */
export function stageViewsNow(): StageViews | null {
  return loaded;
}
