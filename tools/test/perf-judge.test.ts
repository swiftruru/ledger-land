// Lighthouse 量測結果的摘要、門檻判定與 LCP 的複驗（tools/lib/perf-judge.mjs，06 第 8.1 節）：複驗只在「只有模擬 LCP 不過」時啟動，
// 判定仍是同一個門檻的中位數；真的退步（每一次都慢）複驗後照樣不過
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../lib/fs.mjs';
import { judge, lcpRecheckRuns, median, summarise } from '../lib/perf-judge.mjs';

const cfg = JSON.parse(readFileSync(join(ROOT, 'apps/web/perf/urls.json'), 'utf8')) as {
  lighthouse: { runs: number; benchmarkRef: number; performanceSlack: number; lcpRecheckRuns: number };
  assertions: Record<string, { min?: number; max?: number; maxMs?: number }>;
  assertionsObserved: Record<string, { maxMs?: number }>;
};
const home = { name: 'home', path: '/' };
const LCP_MAX = cfg.assertions['largest-contentful-paint']!.maxMs!;

/** 一次量測；沒有給的項目都在門檻內 */
const run = (lcp: number, over: Partial<Record<'perf' | 'a11y' | 'tbt' | 'cls' | 'benchmarkIndex' | 'observedLcp', number>> = {}) => ({
  observedLcp: 120,
  perf: 0.96,
  a11y: 1,
  bp: 0.96,
  lcp,
  tbt: 40,
  cls: 0.01,
  benchmarkIndex: 3900,
  ...over,
});

/** 照 tools/perf.mjs 的流程判定：先量 first，只有 LCP 不過時接著量 rest 裡的前幾次，回傳最後的結果 */
function decide(first: number[], rest: number[], extra = cfg.lighthouse.lcpRecheckRuns) {
  const results = first.map((lcp) => run(lcp));
  let verdict = judge(summarise(home, results), cfg.assertions, cfg.lighthouse);
  const more = lcpRecheckRuns({ failures: verdict.failures, done: results.length, extra });
  if (more > rest.length) throw new Error(`測試資料不夠：要再量 ${more} 次`);
  for (const lcp of rest.slice(0, more)) results.push(run(lcp));
  const m = summarise(home, results);
  verdict = judge(m, cfg.assertions, cfg.lighthouse);
  return { more, m, passed: verdict.failures.length === 0, failures: verdict.failures };
}

describe('median', () => {
  it('奇數個取中間，偶數個取中間兩個的平均，不改動原陣列', () => {
    const xs = [2731, 2129, 2840];
    expect(median(xs)).toBe(2731);
    expect(xs).toEqual([2731, 2129, 2840]);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([7])).toBe(7);
  });
});

describe('summarise', () => {
  it('每一項各取中位數，並留下每一次的模擬 LCP', () => {
    const m = summarise(home, [run(2731.4, { tbt: 25, perf: 0.94 }), run(2129.2, { tbt: 77, perf: 0.97 }), run(2839.6, { tbt: 29, perf: 0.93 })]);
    expect(m).toMatchObject({
      name: 'home',
      path: '/',
      runs: 3,
      lcpMs: 2731,
      lcpRunsMs: [2731, 2129, 2840],
      tbtMs: 29,
      performance: 0.94,
      benchmarkIndex: 3900,
    });
  });
  it('有一次沒有實測 LCP 時，實測的中位數是 null', () => {
    const one = { ...run(2100), observedLcp: null };
    expect(summarise(home, [run(2100), one]).observedLcpMs).toBeNull();
    expect(summarise(home, [run(2100, { observedLcp: 80 }), run(2100, { observedLcp: 100 })]).observedLcpMs).toBe(90);
  });
});

describe('judge', () => {
  it('都在門檻內時沒有不過的項目', () => {
    expect(judge(summarise(home, [run(2130), run(2140), run(2200)]), cfg.assertions, cfg.lighthouse)).toEqual({ failures: [], notes: [] });
  });
  it('LCP 剛好等於門檻算過，多 1ms 不過', () => {
    expect(judge(summarise(home, [run(LCP_MAX)]), cfg.assertions, cfg.lighthouse).failures).toEqual([]);
    expect(judge(summarise(home, [run(LCP_MAX + 1)]), cfg.assertions, cfg.lighthouse).failures).toEqual([
      { metric: 'lcp', message: `perf：home LCP ${LCP_MAX + 1}ms 超過 ${LCP_MAX}ms` },
    ]);
  });
  it('每一項各自判定', () => {
    const metricsOf = (over: Parameters<typeof run>[1]) =>
      judge(summarise(home, [run(2100, over)]), cfg.assertions, cfg.lighthouse).failures.map((f) => f.metric);
    expect(metricsOf({ a11y: 0.9 })).toEqual(['accessibility']);
    expect(metricsOf({ perf: 0.8 })).toEqual(['performance']);
    expect(metricsOf({ tbt: 250 })).toEqual(['tbt']);
    expect(metricsOf({ cls: 0.2 })).toEqual(['cls']);
    expect(metricsOf({ perf: 0.8, tbt: 250, cls: 0.2 })).toEqual(['performance', 'tbt', 'cls']);
  });
  it('慢的執行器：TBT 的門檻與效能分數的下限放寬並留下說明，LCP 的門檻不變', () => {
    const slow = judge(summarise(home, [run(2100, { benchmarkIndex: 2006, tbt: 296, perf: 0.89 })]), cfg.assertions, cfg.lighthouse);
    expect(slow.failures).toEqual([]);
    expect(slow.notes).toHaveLength(2);
    expect(slow.notes[0]).toContain('校正為 0.85');
    expect(slow.notes[1]).toContain('校正為 400ms');
    // 同樣的數字在參考速度的機器上不過
    expect(
      judge(summarise(home, [run(2100, { benchmarkIndex: 3000, tbt: 296, perf: 0.89 })]), cfg.assertions, cfg.lighthouse).failures.map((f) => f.metric),
    ).toEqual(['performance', 'tbt']);
    expect(judge(summarise(home, [run(LCP_MAX + 31, { benchmarkIndex: 2006 })]), cfg.assertions, cfg.lighthouse).failures.map((f) => f.metric)).toEqual([
      'lcp',
    ]);
  });
  it('實測模式：LCP 看實測值，模擬值與效能分數只記錄', () => {
    const options = { observed: true, assertionsObserved: cfg.assertionsObserved };
    const ok = judge(summarise(home, [run(3900, { observedLcp: 1600, perf: 0.7 })]), cfg.assertions, cfg.lighthouse, options);
    expect(ok.failures).toEqual([]);
    expect(ok.notes[0]).toContain('實測 LCP 1600ms');
    const over = judge(summarise(home, [run(2100, { observedLcp: 3100 })]), cfg.assertions, cfg.lighthouse, options);
    expect(over.failures.map((f) => f.metric)).toEqual(['observed-lcp']);
    const none = judge(summarise(home, [{ ...run(2100), observedLcp: null }]), cfg.assertions, cfg.lighthouse, options);
    expect(none.failures[0]?.message).toContain('沒有實測 LCP');
  });
});

describe('lcpRecheckRuns', () => {
  const lcp = { metric: 'lcp' as const, message: '' };
  it('只有 LCP 不過時才複驗', () => {
    expect(lcpRecheckRuns({ failures: [lcp], done: 3, extra: 6 })).toBe(6);
    expect(lcpRecheckRuns({ failures: [], done: 3, extra: 6 })).toBe(0);
    expect(lcpRecheckRuns({ failures: [{ metric: 'tbt', message: '' }], done: 3, extra: 6 })).toBe(0);
    expect(lcpRecheckRuns({ failures: [lcp, { metric: 'performance', message: '' }], done: 3, extra: 6 })).toBe(0);
    expect(lcpRecheckRuns({ failures: [lcp, { metric: 'accessibility', message: '' }], done: 3, extra: 6 })).toBe(0);
  });
  it('總次數湊成奇數', () => {
    expect(lcpRecheckRuns({ failures: [lcp], done: 3, extra: 6 })).toBe(6);
    expect(lcpRecheckRuns({ failures: [lcp], done: 5, extra: 6 })).toBe(6);
    expect(lcpRecheckRuns({ failures: [lcp], done: 2, extra: 6 })).toBe(7);
    expect(lcpRecheckRuns({ failures: [lcp], done: 3, extra: 3 })).toBe(4);
    expect(lcpRecheckRuns({ failures: [lcp], done: 1, extra: 1 })).toBe(2);
  });
  it('沒有設定次數、設成 0、實測模式或一次都沒量到時不複驗', () => {
    expect(lcpRecheckRuns({ failures: [lcp], done: 3, extra: 0 })).toBe(0);
    expect(lcpRecheckRuns({ failures: [lcp], done: 3, extra: Number.NaN })).toBe(0);
    expect(lcpRecheckRuns({ failures: [lcp], done: 3, extra: -2 })).toBe(0);
    expect(lcpRecheckRuns({ failures: [lcp], done: 3, extra: 0.5 })).toBe(0);
    expect(lcpRecheckRuns({ failures: [lcp], done: 0, extra: 6 })).toBe(0);
    expect(lcpRecheckRuns({ failures: [lcp], done: 3, extra: 6, observed: true })).toBe(0);
  });
  it('urls.json 設定的次數讓 PR 的 3 次與 main 的 5 次都湊成奇數', () => {
    const extra = cfg.lighthouse.lcpRecheckRuns;
    expect(extra).toBeGreaterThanOrEqual(4);
    expect(lcpRecheckRuns({ failures: [lcp], done: 3, extra })).toBe(extra);
    expect(lcpRecheckRuns({ failures: [lcp], done: cfg.lighthouse.runs, extra })).toBe(extra);
  });
});

describe('複驗的整個流程（urls.json 的門檻與次數）', () => {
  // 2026-11-06 PR 103 的三次：同一份建置，兩次落在慢的那一群
  const pr103 = [2731, 2129, 2840];
  // 首頁平常的數字（2026-11-05 到 06 的 CI：137 次裡 132 次在 942 到 2269ms）
  const usual = [2139, 2132, 2121, 2209, 2148, 2125];

  it('第一次繪製的時序造成的兩次慢：複驗後回到平常的中位數，過關', () => {
    const r = decide(pr103, usual);
    expect(r.more).toBe(6);
    expect(r.m.runs).toBe(9);
    expect(r.m.lcpMs).toBe(2139);
    expect(r.passed).toBe(true);
  });
  it('複驗時又碰到慢的，只要全部次數裡不過半就過關', () => {
    expect(decide(pr103, [2860, 2139, 2132, 2770, 2121, 2209]).passed).toBe(true); // 9 次裡 4 次慢
    expect(decide(pr103, [2860, 2139, 2731, 2770, 2121, 2209]).passed).toBe(false); // 9 次裡 5 次慢
  });
  it('真的退步（每一次都超過門檻）：複驗後照樣不過', () => {
    const r = decide([2880, 2731, 2840], [2790, 2870, 2745, 2731, 2812, 2905]);
    expect(r.more).toBe(6);
    expect(r.passed).toBe(false);
    expect(r.failures.map((f) => f.metric)).toEqual(['lcp']);
  });
  it('平常那一群整個移到門檻以上（多一層請求）：偶爾量到快的幾次也救不回來', () => {
    expect(decide([2731, 2129, 2840], [2745, 2731, 2012, 2790, 2731, 2860]).passed).toBe(false); // 9 次裡 7 次慢
  });
  it('原訂的次數就過關時不多量，結果和以前一樣', () => {
    const r = decide([2129, 2731, 2139], usual);
    expect(r.more).toBe(0);
    expect(r.m.runs).toBe(3);
    expect(r.m.lcpMs).toBe(2139);
    expect(r.passed).toBe(true);
  });
  it('LCP 之外還有別的項目不過時不複驗，直接不過', () => {
    const results = [run(2731, { tbt: 400 }), run(2129, { tbt: 420 }), run(2840, { tbt: 390 })];
    const verdict = judge(summarise(home, results), cfg.assertions, cfg.lighthouse);
    expect(verdict.failures.map((f) => f.metric)).toEqual(['lcp', 'tbt']);
    expect(lcpRecheckRuns({ failures: verdict.failures, done: 3, extra: cfg.lighthouse.lcpRecheckRuns })).toBe(0);
  });
  it('複驗把次數加多以後，其他項目也用全部次數的中位數重新判定', () => {
    const results = [run(2731), run(2129), run(2840), ...usual.map((lcp) => run(lcp, { tbt: 260 }))];
    expect(judge(summarise(home, results), cfg.assertions, cfg.lighthouse).failures.map((f) => f.metric)).toEqual(['tbt']);
  });
  it('main 的 5 次：3 次慢時複驗，11 次裡 5 次慢過關、6 次慢不過', () => {
    const first = [2731, 2129, 2840, 2139, 2770];
    expect(decide(first, [2139, 2132, 2860, 2121, 2209, 2731]).passed).toBe(true);
    expect(decide(first, [2139, 2860, 2860, 2121, 2209, 2731]).passed).toBe(false);
    expect(decide(first, usual).m.runs).toBe(11);
  });
});
