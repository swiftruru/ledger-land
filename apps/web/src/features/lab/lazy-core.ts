// 實驗室核心（lab-core.ts，含整個 @ledgerland/core）的延後載入：頁面 chunk 先到、整頁等核心與故事快照齊了才一次出現（lib/page-ready.tsx）。
// 和 features/quiz/lazy-data.ts 同一套做法：失敗不留著被拒絕的 Promise，下一次呼叫重新 import。
export type LabCore = typeof import('./lab-core.ts');

let promise: Promise<LabCore> | null = null;
let loadedCore: LabCore | null = null;

export function loadLabCore(): Promise<LabCore> {
  promise ??= import('./lab-core.ts').then(
    (m) => (loadedCore = m),
    (e: unknown) => {
      promise = null;
      throw e;
    },
  );
  return promise;
}

/** 已經載好的核心（同步）；還沒載好時是 null */
export function labCoreNow(): LabCore | null {
  return loadedCore;
}
