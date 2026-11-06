// Lighthouse 量測結果的摘要、門檻判定與 LCP 的複驗（06 第 8.1、8.2 節），給 tools/perf.mjs 用；純函式，單元測試在 tools/test/perf-judge.test.ts。
// 門檻依執行器速度的校正在 perf-thresholds.mjs。
import { performanceMinOf, tbtFactorOf } from './perf-thresholds.mjs';

/** 中位數；偶數個時取中間兩個的平均
 * @param {number[]} xs */
export function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}

/**
 * @typedef {{ observedLcp: number | null; perf: number; a11y: number; bp: number | null; lcp: number; tbt: number; cls: number; benchmarkIndex: number }} RunResult
 * @typedef {{ metric: 'accessibility' | 'observed-lcp' | 'performance' | 'lcp' | 'tbt' | 'cls'; message: string }} Failure
 */

/** 一個網址各次量測的摘要：每一項各取中位數；lcpRunsMs 留下每一次的模擬 LCP（依量測順序），報告裡看得出是不是分成兩群
 * @param {{ name: string; path: string }} u
 * @param {RunResult[]} results */
export function summarise(u, results) {
  return {
    name: u.name,
    path: u.path,
    runs: results.length,
    performance: median(results.map((r) => r.perf)),
    accessibility: median(results.map((r) => r.a11y)),
    bestPractices: median(results.map((r) => r.bp ?? 0)),
    lcpMs: Math.round(median(results.map((r) => r.lcp))),
    lcpRunsMs: results.map((r) => Math.round(r.lcp)),
    observedLcpMs: results.every((r) => r.observedLcp !== null) ? Math.round(median(results.map((r) => /** @type {number} */ (r.observedLcp)))) : null,
    tbtMs: Math.round(median(results.map((r) => r.tbt))),
    cls: median(results.map((r) => r.cls)),
    benchmarkIndex: Math.round(median(results.map((r) => r.benchmarkIndex))),
  };
}

/** 摘要逐項比門檻。failures 是不過的項目（metric 給複驗判斷用，message 直接印出來），notes 是過了但要說明的校正。
 * TBT 的門檻與效能分數的下限依執行器速度校正（perf-thresholds.mjs）；LCP 的門檻不校正。
 * observed（每週對正式網址）：LCP 看實測值比 assertionsObserved 的門檻，模擬值與效能分數只記錄。
 * @param {ReturnType<typeof summarise>} m
 * @param {Record<string, { min?: number; max?: number; maxMs?: number }>} a 這個網址的門檻（全站門檻加上個別覆寫）
 * @param {{ benchmarkRef?: number | null; performanceSlack?: number }} lighthouse
 * @param {{ observed?: boolean; assertionsObserved?: Record<string, { maxMs?: number }> }} [options]
 * @returns {{ failures: Failure[]; notes: string[] }} */
export function judge(m, a, lighthouse, { observed = false, assertionsObserved = {} } = {}) {
  /** @type {Failure[]} */
  const failures = [];
  /** @type {string[]} */
  const notes = [];
  const ref = lighthouse.benchmarkRef ?? null;
  const tbtFactor = tbtFactorOf(ref, m.benchmarkIndex);
  const a11yMin = /** @type {number} */ (a['categories.accessibility'].min);
  const perfBase = /** @type {number} */ (a['categories.performance'].min);
  const lcpMax = /** @type {number} */ (a['largest-contentful-paint'].maxMs);
  const tbtBase = /** @type {number} */ (a['total-blocking-time'].maxMs);
  const clsMax = /** @type {number} */ (a['cumulative-layout-shift'].max);
  if (m.accessibility < a11yMin) failures.push({ metric: 'accessibility', message: `perf：${m.name} 無障礙 ${m.accessibility} 低於 ${a11yMin}` });
  if (observed) {
    const maxObserved = assertionsObserved['largest-contentful-paint']?.maxMs ?? lcpMax;
    if (m.observedLcpMs === null)
      failures.push({ metric: 'observed-lcp', message: `perf：${m.name} 沒有實測 LCP（metrics audit 缺 observedLargestContentfulPaint）` });
    else if (m.observedLcpMs > maxObserved)
      failures.push({
        metric: 'observed-lcp',
        message: `perf：${m.name} 實測 LCP ${m.observedLcpMs}ms 超過 ${maxObserved}ms（模擬 ${m.lcpMs}ms、效能 ${m.performance} 只記錄）`,
      });
    else notes.push(`perf：${m.name} 實測 LCP ${m.observedLcpMs}ms（門檻 ${maxObserved}ms；模擬 ${m.lcpMs}ms、效能 ${m.performance} 只記錄）`);
  } else {
    const perfMin = performanceMinOf(perfBase, lighthouse.performanceSlack ?? 0, tbtFactor);
    const perfNote = perfMin < perfBase ? `（下限 ${perfBase} 依 benchmarkIndex ${m.benchmarkIndex} 校正為 ${perfMin}）` : '';
    if (m.performance < perfMin) failures.push({ metric: 'performance', message: `perf：${m.name} 效能 ${m.performance} 低於 ${perfMin}${perfNote}` });
    else if (perfNote && m.performance < perfBase) notes.push(`perf：${m.name} 效能 ${m.performance}${perfNote}`);
    if (m.lcpMs > lcpMax) failures.push({ metric: 'lcp', message: `perf：${m.name} LCP ${m.lcpMs}ms 超過 ${lcpMax}ms` });
  }
  const tbtMax = Math.round(tbtBase * tbtFactor);
  if (m.tbtMs > tbtMax)
    failures.push({
      metric: 'tbt',
      message: `perf：${m.name} TBT ${m.tbtMs}ms 超過 ${tbtMax}ms（benchmarkIndex ${m.benchmarkIndex}，參考 ${ref}，門檻 ${tbtBase} 乘 ${tbtFactor.toFixed(2)}）`,
    });
  else if (tbtFactor > 1) notes.push(`perf：${m.name} TBT ${m.tbtMs}ms（門檻依 benchmarkIndex ${m.benchmarkIndex} 校正為 ${tbtMax}ms）`);
  if (m.cls > clsMax) failures.push({ metric: 'cls', message: `perf：${m.name} CLS ${m.cls} 超過 ${clsMax}` });
  return { failures, notes };
}

/** LCP 的複驗：原訂的次數量完、只有模擬 LCP 這一項不過時，再多量幾次，改用全部次數的中位數判定（門檻不變）。回傳要再量幾次，0 是不複驗。
 *
 * 為什麼需要：模擬 LCP 不是連續的數字。Lighthouse 把「實測的 LCP 那一刻之前已經載完的請求」算進關鍵路徑再模擬，本機伺服器沒有網路延遲，
 * 第一次繪製和下一批請求只差幾毫秒到幾十毫秒，誰先誰後每次不一定，同一份建置因此量出相隔好幾百毫秒的兩群數字。首頁就是這樣：
 * 2026-11-05 到 06 的 35 次 CI、137 次量測，132 次在 942 到 2269ms，5 次在 2731 到 2860ms，中間沒有任何一次；慢的 5 次都是第一次繪製
 * 晚於第二波 chunk 載完，而且只出現在快的執行器（benchmarkIndex 3000 以上 14 次裡 3 次，2250 到 3000 的 45 次裡 2 次，2250 以下 78 次裡 0 次）。
 * 3 次裡碰到 2 次慢的，中位數就超過門檻（PR 103：2731、2129、2840），那個 PR 沒有動首頁。
 *
 * 為什麼不會放過真的退步：門檻沒有動，判定仍然是中位數，只是樣本變多。真的退步（關鍵路徑多了位元組或多一層請求）會讓每一次量測都變慢，
 * 全部次數的中位數照樣超過門檻；複驗只會在「過半數的量測其實在門檻內」時把結果翻回來。總次數一定湊成奇數，剛好一半一半時中位數
 * 不會落在兩群的平均。其他項目（TBT、CLS、效能、無障礙）不過時不複驗；每週對正式網址的實測模式也不複驗（不對正式站多發請求）。
 * 機率（每次量測有 p 的機會超過門檻、PR 的 3 次加 6 次）：p 0.2 時不過的機會從 10.4% 降到 1.2%；p 0.7 是 78.4% 對 74.9%，p 0.9 是 97.2% 對 97.2%，p 1 都是 100%。
 * @param {{ failures: Failure[]; done: number; extra: number; observed?: boolean }} input done 是已經量完的次數，extra 是設定的複驗次數（urls.json 的 lighthouse.lcpRecheckRuns）
 * @returns {number} */
export function lcpRecheckRuns({ failures, done, extra, observed = false }) {
  if (observed || !(extra > 0) || !(done > 0)) return 0;
  if (failures.length !== 1 || failures[0].metric !== 'lcp') return 0;
  const more = Math.floor(extra);
  if (more < 1) return 0;
  return (done + more) % 2 === 1 ? more : more + 1;
}
