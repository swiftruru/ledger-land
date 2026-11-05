// Lighthouse 門檻依執行器速度的校正（06 第 8.1、8.2 節），給 tools/perf.mjs 用；純函式，單元測試在 tools/test/perf-thresholds.test.ts。
// 執行器的速度看 Lighthouse 自己量的 benchmarkIndex；參考值（urls.json 的 lighthouse.benchmarkRef，我的 Mac 約 3000）以上時門檻不放寬。

/** TBT 門檻要乘的倍數：benchmarkIndex 低於參考值時是 (參考 / 實測)²，最多 2 倍；沒有參考值或量不到 benchmarkIndex 時是 1。
 * TBT 是長任務超過 50ms 的部分加總，執行器慢 1.2 倍、長任務就超過 2 倍（2026-10-26 GitHub 執行器 benchmarkIndex 2430 時
 * 名詞圖鑑 211 到 243ms、同一份建置在 4119 時 104ms），所以用平方 */
export function tbtFactorOf(ref, benchmarkIndex) {
  if (ref === null || ref === undefined || !(benchmarkIndex > 0)) return 1;
  return Math.min(2, Math.max(1, (ref / benchmarkIndex) ** 2));
}

/** 效能分數的下限：執行器慢的時候往下讓，和 TBT 用同一個倍數，倍數 2（最慢）時讓 slack，中間照比例；參考速度以上還是 min。
 * 效能分數有三成來自 TBT，TBT 的門檻已經依執行器放寬，分數的下限不跟著動就會自相矛盾：TBT 在放寬後的門檻內，分數卻被它拖到線下。
 * 依據（2026-11-05，同一份網站）：benchmarkIndex 約 2500 的執行器上地圖、名詞圖鑑與實驗室步驟頁 0.94 到 0.97，約 2000 時 0.89 到 0.94；
 * PR 88 沒有動網站，地圖頁在 2006 的執行器量到 0.89（TBT 296ms，校正後的門檻 400ms 以內）而失敗。
 * 真的變慢仍然擋得住：LCP 的門檻不校正，TBT 最多只放寬到 2 倍，分數的下限最多只讓 slack */
export function performanceMinOf(min, slack, factor) {
  if (!(slack > 0) || !(factor > 1)) return min;
  return Math.round((min - slack * (Math.min(2, factor) - 1)) * 1000) / 1000;
}
