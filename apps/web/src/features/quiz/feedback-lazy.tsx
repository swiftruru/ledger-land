// 回饋區的延後載入（06 第 8.2 節）：回饋只在按下「確認答案」或還原已確認的作答之後出現，而那兩條路都先等判分模組（scoring-lazy.ts），
// 所以回饋區（FeedbackView 與 web-ui 的 FeedbackPanel）和判分放在同一個 Promise 裡、第一次繪製送出後預載，不放在作答頁第一波的 chunk 裡。
// 判分到了回饋區一定也到了，DeferredFeedbackView 直接畫已載入的元件，不會閃一下空白；萬一還沒到（理論上不會）才退回 Suspense。
import { Suspense, lazy } from 'react';
import type { FeedbackViewProps } from './FeedbackView.tsx';

type FeedbackViewComponent = typeof import('./FeedbackView.tsx').FeedbackView;

let loaded: FeedbackViewComponent | null = null;
let promise: Promise<FeedbackViewComponent> | null = null;

export function loadFeedbackView(): Promise<FeedbackViewComponent> {
  // 載入失敗時不留著被拒絕的 Promise：下一次（判分重試時）重新 import
  promise ??= import('./FeedbackView.tsx').then(
    (m) => (loaded = m.FeedbackView),
    (e: unknown) => {
      promise = null;
      throw e;
    },
  );
  return promise;
}

const LazyFeedbackView = lazy(() => loadFeedbackView().then((C) => ({ default: C })));

export function DeferredFeedbackView(props: FeedbackViewProps) {
  const C = loaded;
  if (C !== null) return <C {...props} />;
  return (
    <Suspense fallback={null}>
      <LazyFeedbackView {...props} />
    </Suspense>
  );
}
