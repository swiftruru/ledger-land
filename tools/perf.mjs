// Lighthouse 13 CLI（06 第 8.2 節、09 第 10.2 節）：對重現 Workers 行為的本機伺服器（apps/web 的 wrangler dev）跑固定網址，
// 每個網址 runs 次取中位數，以 metric 做 assertion；記錄 benchmarkIndex。統計腳本照正式方式載入但指向 stub 端點（?ll-analytics=stub）。
// 用法：node tools/perf.mjs [--base http://127.0.0.1:8787] [--runs 5] [--out .local-reports/perf] [--only home,terms] [--shard 2/3] [--observed] [--lcp-recheck 6]
// LCP 的複驗（06 第 8.1 節）：一個網址量完 runs 次、只有模擬 LCP 不過時，再量 lighthouse.lcpRecheckRuns 次（--lcp-recheck 可覆寫，0 是關掉），
// 用全部次數的中位數判定，門檻不變；理由與依據在 lib/perf-judge.mjs 的 lcpRecheckRuns。
// --shard i/n：只量第 i 組網址（CI 把網址分給 n 個同時跑的工作，分法在 lib/perf-shard.mjs）；門檻逐網址、依那一台執行器的 benchmarkIndex 校正，分開量不影響判定。
// --observed（每週對正式網址用，06 第 8.2 節）：LCP 以實測值（網路不節流、CPU 仍降速）比 assertionsObserved 的門檻，模擬值與效能分數只記錄當趨勢。
// 真實邊緣上每個請求有伺服器延遲、zone 又可能注入統計腳本，Lighthouse 的模擬會逐層放大（2026-10-27：正式站模擬 LCP 3.5 到 4.2 秒、實測 0.3 到 1.6 秒）；
// 比較建置好壞用本機伺服器的模擬值（PR 與 main），正式站用實測值看使用者真的等多久。
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, fail } from './lib/fs.mjs';
import { judge, lcpRecheckRuns, summarise } from './lib/perf-judge.mjs';
import { shardUrls } from './lib/perf-shard.mjs';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    // 旗標後面接的是另一個旗標（--observed --out …）或沒有東西時，值是 'true'
    .map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1] === undefined || arr[i + 1].startsWith('--') ? 'true' : arr[i + 1]] : []))
    .filter((x) => x.length),
);
const app = join(ROOT, 'apps/web');
const cfg = JSON.parse(readFileSync(join(app, 'perf/urls.json'), 'utf8'));
const runs = Number(args.runs ?? cfg.lighthouse.runs ?? 5);
const recheckRuns = Number(args['lcp-recheck'] ?? cfg.lighthouse.lcpRecheckRuns ?? 0);
const observedMode = args.observed === 'true';
// 先決定要量哪些網址（格式不對就在起伺服器之前結束）
let urls = cfg.urls;
if (args.shard) {
  try {
    urls = shardUrls(cfg.urls, args.shard);
  } catch (error) {
    console.error(`perf：${error.message}`);
    process.exit(1);
  }
  console.log(`perf：第 ${args.shard} 組，量 ${urls.map((u) => u.name).join('、') || '（沒有網址）'}`);
}
const outDir = join(ROOT, args.out ?? '.local-reports/perf');
mkdirSync(outDir, { recursive: true });
let base = args.base;
let server = null;
if (!base) {
  const port = 8791;
  base = `http://127.0.0.1:${port}`;
  server = spawn('pnpm', ['exec', 'wrangler', 'dev', '--port', String(port), '--ip', '127.0.0.1'], { cwd: app, stdio: 'ignore' });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${base}/`);
      if (r.ok) break;
    } catch {
      /* 還沒起來 */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}
const chrome = process.env.CHROME_PATH ?? findPlaywrightChromium();
function findPlaywrightChromium() {
  const dir = process.env.PLAYWRIGHT_BROWSERS_PATH ?? join(ROOT, '.cache/ms-playwright');
  if (!existsSync(dir)) return undefined;
  const r = spawnSync('find', [dir, '-maxdepth', '4', '-type', 'f', '-name', 'Chromium', '-path', '*chromium-*'], { encoding: 'utf8' });
  const hit = r.stdout.split('\n').find((p) => p.includes('Chromium.app/Contents/MacOS/Chromium'));
  if (hit) return hit;
  // Linux 的目錄名依 Playwright 版本與架構不同：chrome-linux、chrome-linux64（amd64）、chrome-linux-arm64。
  // 一定要找到 Playwright 的 Chromium：容器裡沒有系統的 Chrome（2026-10-27 CI 改在 Playwright 容器裡跑時找不到，Lighthouse 全部失敗），
  // 而且用同一個 Chromium 量，結果才和 E2E 一致
  const r2 = spawnSync('find', [dir, '-maxdepth', '4', '-type', 'f', '-name', 'chrome'], { encoding: 'utf8' });
  const hit2 = r2.stdout.split('\n').find((p) => /chromium-\d+\/chrome-linux(64|-arm64)?\/chrome$/.test(p));
  if (!hit2) console.warn(`perf：在 ${dir} 找不到 Playwright 的 Chromium，Lighthouse 會改找系統的 Chrome（CHROME_PATH）`);
  return hit2;
}
/** 量一次：成功時回傳這一次的數字，Lighthouse 失敗時記一筆錯誤並回傳 null */
function measure(u, url, i) {
  const file = join(outDir, `${u.name}-run${i}.json`);
  const lh = spawnSync(
    'pnpm',
    [
      'exec',
      'lighthouse',
      url,
      '--output=json',
      `--output-path=${file}`,
      '--quiet',
      '--chrome-flags=--headless=new --no-sandbox --disable-gpu',
      '--only-categories=performance,accessibility,best-practices',
      '--form-factor=mobile',
      '--screenEmulation.mobile',
      ...(cfg.lighthouse.cpuSlowdownMultiplier ? [`--throttling.cpuSlowdownMultiplier=${cfg.lighthouse.cpuSlowdownMultiplier}`] : []),
    ],
    { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...(chrome ? { CHROME_PATH: chrome } : {}) } },
  );
  if (lh.status !== 0 || !existsSync(file)) {
    const out = (lh.stderr || lh.stdout || '').trim();
    // 錯誤訊息在開頭（stack 在後面），開頭與結尾都留
    fail(`perf：${u.name} 第 ${i} 次 Lighthouse 失敗：${out.length > 1200 ? `${out.slice(0, 600)}\n…\n${out.slice(-600)}` : out}`);
    return null;
  }
  const r = JSON.parse(readFileSync(file, 'utf8'));
  const observed = r.audits['metrics']?.details?.items?.[0] ?? {};
  return {
    observedLcp: observed.observedLargestContentfulPaint ?? observed.observedLargestContentfulPaintAllFrames ?? null,
    perf: r.categories.performance.score,
    a11y: r.categories.accessibility.score,
    bp: r.categories['best-practices']?.score ?? null,
    lcp: r.audits['largest-contentful-paint'].numericValue,
    tbt: r.audits['total-blocking-time'].numericValue,
    cls: r.audits['cumulative-layout-shift'].numericValue,
    benchmarkIndex: r.environment.benchmarkIndex,
  };
}
const summary = [];
let rechecked = 0;
try {
  // --only home,terms：只量這幾個名稱（本機找效能回歸用；CI 不帶）
  const only = args.only ? new Set(String(args.only).split(',')) : null;
  for (const u of urls) {
    if (only && !only.has(u.name)) continue;
    const url = `${base}${u.path}?ll-analytics=${cfg.analytics.mode}`;
    const results = [];
    for (let i = 1; i <= runs; i++) {
      const r = measure(u, url, i);
      if (r) results.push(r);
    }
    if (!results.length) continue;
    // 個別網址可以覆寫門檻（urls.json 的 urls[].assertions，M2 的地圖與作答頁 LCP 暫放寬到 3000ms，見 14 第 5 節）
    const a = { ...cfg.assertions, ...(u.assertions ?? {}) };
    // TBT 的門檻與效能分數的下限依執行器速度校正（06 第 8.1 節；算法與依據在 lib/perf-thresholds.mjs）：benchmarkIndex 低於參考值時才放寬
    const options = { observed: observedMode, assertionsObserved: cfg.assertionsObserved ?? {} };
    let m = summarise(u, results);
    let verdict = judge(m, a, cfg.lighthouse, options);
    // 只有模擬 LCP 不過時再多量幾次，用全部次數的中位數判定（lib/perf-judge.mjs 的 lcpRecheckRuns）
    const more = lcpRecheckRuns({ failures: verdict.failures, done: results.length, extra: recheckRuns, observed: observedMode });
    if (more > 0) {
      console.log(
        `perf：${u.name} LCP 各次 ${m.lcpRunsMs.join('、')}ms，中位數 ${m.lcpMs}ms 超過 ${a['largest-contentful-paint'].maxMs}ms，其他項目都過；再量 ${more} 次，用全部 ${results.length + more} 次的中位數判定`,
      );
      for (let i = runs + 1; i <= runs + more; i++) {
        const r = measure(u, url, i);
        if (r) results.push(r);
      }
      m = summarise(u, results);
      verdict = judge(m, a, cfg.lighthouse, options);
      rechecked += 1;
      console.log(
        `perf：${u.name} 複驗後 LCP 各次 ${m.lcpRunsMs.join('、')}ms，${m.runs} 次的中位數 ${m.lcpMs}ms${verdict.failures.length ? '' : '，在門檻內'}`,
      );
    }
    summary.push(m);
    for (const note of verdict.notes) console.log(note);
    for (const failure of verdict.failures) fail(failure.message);
    console.log('perf:', JSON.stringify(m));
  }
} finally {
  server?.kill();
}
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
if (!process.exitCode)
  console.log(
    `perf：${summary.length} 個網址全部達標（${runs} 次中位數${rechecked ? `，其中 ${rechecked} 個網址的 LCP 經過複驗` : ''}），報告在 ${outDir.replace(ROOT + '/', '')}`,
  );
