// Lighthouse 13 CLI（06 第 8.2 節、09 第 10.2 節）：對重現 Workers 行為的本機伺服器（apps/web 的 wrangler dev）跑固定網址，
// 每個網址 runs 次取中位數，以 metric 做 assertion；記錄 benchmarkIndex。統計腳本照正式方式載入但指向 stub 端點（?ll-analytics=stub）。
// 用法：node tools/perf.mjs [--base http://127.0.0.1:8787] [--runs 5] [--out .local-reports/perf] [--only home,terms]
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, fail } from './lib/fs.mjs';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1] ?? 'true'] : []))
    .filter((x) => x.length),
);
const app = join(ROOT, 'apps/web');
const cfg = JSON.parse(readFileSync(join(app, 'perf/urls.json'), 'utf8'));
const runs = Number(args.runs ?? cfg.lighthouse.runs ?? 5);
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
  const r2 = spawnSync('find', [dir, '-maxdepth', '4', '-type', 'f', '-name', 'chrome'], { encoding: 'utf8' });
  return r2.stdout.split('\n').find((p) => /chromium-\d+\/chrome-linux\/chrome$/.test(p));
}
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const summary = [];
try {
  // --only home,terms：只量這幾個名稱（本機找效能回歸用；CI 不帶）
  const only = args.only ? new Set(String(args.only).split(',')) : null;
  for (const u of cfg.urls) {
    if (only && !only.has(u.name)) continue;
    const url = `${base}${u.path}?ll-analytics=${cfg.analytics.mode}`;
    const results = [];
    for (let i = 1; i <= runs; i++) {
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
        fail(`perf：${u.name} 第 ${i} 次 Lighthouse 失敗：${(lh.stderr || lh.stdout).slice(-600)}`);
        continue;
      }
      const r = JSON.parse(readFileSync(file, 'utf8'));
      results.push({
        perf: r.categories.performance.score,
        a11y: r.categories.accessibility.score,
        bp: r.categories['best-practices']?.score ?? null,
        lcp: r.audits['largest-contentful-paint'].numericValue,
        tbt: r.audits['total-blocking-time'].numericValue,
        cls: r.audits['cumulative-layout-shift'].numericValue,
        benchmarkIndex: r.environment.benchmarkIndex,
      });
    }
    if (!results.length) continue;
    const m = {
      name: u.name,
      path: u.path,
      runs: results.length,
      performance: median(results.map((r) => r.perf)),
      accessibility: median(results.map((r) => r.a11y)),
      bestPractices: median(results.map((r) => r.bp ?? 0)),
      lcpMs: Math.round(median(results.map((r) => r.lcp))),
      tbtMs: Math.round(median(results.map((r) => r.tbt))),
      cls: median(results.map((r) => r.cls)),
      benchmarkIndex: Math.round(median(results.map((r) => r.benchmarkIndex))),
    };
    summary.push(m);
    // 個別網址可以覆寫門檻（urls.json 的 urls[].assertions，M2 的地圖與作答頁 LCP 暫放寬到 3000ms，見 14 第 5 節）
    const a = { ...cfg.assertions, ...(u.assertions ?? {}) };
    if (m.performance < a['categories.performance'].min) fail(`perf：${u.name} 效能 ${m.performance} 低於 ${a['categories.performance'].min}`);
    if (m.accessibility < a['categories.accessibility'].min) fail(`perf：${u.name} 無障礙 ${m.accessibility} 低於 ${a['categories.accessibility'].min}`);
    if (m.lcpMs > a['largest-contentful-paint'].maxMs) fail(`perf：${u.name} LCP ${m.lcpMs}ms 超過 ${a['largest-contentful-paint'].maxMs}ms`);
    // TBT 的門檻依執行器速度校正（06 第 8.2 節）：Lighthouse 的 benchmarkIndex 低於參考值（維護者的 Mac 約 3000）時，門檻乘上 (參考 / 實測)²，
    // 最多 2 倍。TBT 是長任務超過 50ms 的部分加總，執行器慢 1.2 倍、長任務就超過 2 倍（2026-10-26 GitHub 執行器 benchmarkIndex 2430 時
    // 名詞圖鑑 211 到 243ms、同一份建置在 4119 時 104ms），所以用平方；benchmarkIndex 在參考值以上時門檻不放寬
    const ref = cfg.lighthouse.benchmarkRef ?? null;
    const tbtFactor = ref === null || !(m.benchmarkIndex > 0) ? 1 : Math.min(2, Math.max(1, (ref / m.benchmarkIndex) ** 2));
    const tbtMax = Math.round(a['total-blocking-time'].maxMs * tbtFactor);
    if (m.tbtMs > tbtMax)
      fail(
        `perf：${u.name} TBT ${m.tbtMs}ms 超過 ${tbtMax}ms（benchmarkIndex ${m.benchmarkIndex}，參考 ${ref}，門檻 ${a['total-blocking-time'].maxMs} 乘 ${tbtFactor.toFixed(2)}）`,
      );
    else if (tbtFactor > 1) console.log(`perf：${u.name} TBT ${m.tbtMs}ms（門檻依 benchmarkIndex ${m.benchmarkIndex} 校正為 ${tbtMax}ms）`);
    if (m.cls > a['cumulative-layout-shift'].max) fail(`perf：${u.name} CLS ${m.cls} 超過 ${a['cumulative-layout-shift'].max}`);
    console.log('perf:', JSON.stringify(m));
  }
} finally {
  server?.kill();
}
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
if (!process.exitCode) console.log(`perf：${summary.length} 個網址全部達標（${runs} 次中位數），報告在 ${outDir.replace(ROOT + '/', '')}`);
