// 判分與紀錄的延後載入（06 第 8.2 節的 LCP 預算、14 第 5.2 節）：packages/quiz 的 score.ts 會帶進 packages/core（金額、分錄比對）、
// content-schema 的題目 schema 與 zod，而作答頁第一次繪製只需要題目元件；判分只在按下「確認答案」或還原已確認的作答時才需要，
// 寫紀錄也只在那之後。這裡把 scoring.ts 與 record.ts 合成一個動態 import，頁面在第一次繪製送出後預先載入（afterFirstPaint），
// 按下確認時通常已經在記憶體裡。不要在這裡 import('@ledgerland/quiz') 整個套件：QuestionView 已靜態用到它的 shuffle，
// 動態載入同一個入口會把整個套件（含判分與 zod）併回第一波的 chunk。
// 回饋區（feedback-lazy.tsx）也在這裡一起等：有判分結果才有回饋，判分到了回饋區就一定到了。
// 載入失敗（第一次造訪時網路中斷、部署後舊 chunk 不在）不留著被拒絕的 Promise：下一次呼叫重新 import，頁面顯示錯誤與「再試一次」。
import { loadFeedbackView } from './feedback-lazy.tsx';

export type ScoringModule = typeof import('./scoring.ts') & typeof import('./record.ts');

let promise: Promise<ScoringModule> | null = null;

export function loadScoring(): Promise<ScoringModule> {
  promise ??= Promise.all([import('./scoring.ts'), import('./record.ts'), loadFeedbackView()]).then(
    ([scoring, record]) => ({ ...scoring, ...record }),
    (e: unknown) => {
      promise = null;
      throw e;
    },
  );
  return promise;
}
