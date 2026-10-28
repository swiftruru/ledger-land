// 啟動畫面的產生器（06 第 2.2、2.4 節）：用 Playwright 的 Chromium（repo 的 devDependency）做兩件事。
//   sheet：把描好的 SVG 和原圖並排、算差異，給人看描圖的保真度；另把 18 張啟動圖拼成一張。
//   splash：開建置好的 dist/index.html（file://），假裝 navigator.standalone 讓 boot 腳本寫 data-display=app，
//           依 splash-devices.json 的裝置尺寸與淺深色截圖，就是 iOS 的 18 張啟動圖。file:// 下 /assets 與樣式表都 404，
//           React 不會掛載、停留畫面不會被移除，正好拿來截圖；這也規定了停留畫面只能依賴內嵌的 SVG 與首次繪製的 style。
//           截完用 quantise-png.py（Pillow，128 色）壓小。
// 用法（repo 根目錄，先 source tools/env.sh 讓 PLAYWRIGHT_BROWSERS_PATH 指到 .cache/ms-playwright）：
//   node apps/web/brand/make-launch.mjs sheet --out .local-reports/launch
//   node apps/web/brand/make-launch.mjs splash [--build] [--dist apps/web/dist] [--out apps/web/public/splash] [--only 390@3,375@2]
//       [--scheme light|dark] [--python <venv>/bin/python] [--no-quantise]
// 不進 CI：Chromium 版本不同截圖的位元會變，和 trace-favicon.py 一樣是維護者手動跑的產生器。
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, '..');
const root = resolve(web, '../..');

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const flag = (name) => argv.includes(`--${name}`);

const dataUri = (file) => {
  const ext = file.endsWith('.svg') ? 'svg+xml' : 'png';
  return `data:image/${ext};base64,${readFileSync(file).toString('base64')}`;
};

/** PNG 的 IHDR：寬高在第 16 到 24 個 byte */
function pngSize(file) {
  const b = readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

async function sheet() {
  const out = resolve(root, opt('out', '.local-reports/launch'));
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const items = [
    { name: 'illustration', src: 'launch-illustration-source.png', svg: 'launch-illustration.svg', sizes: [194, 581] },
    { name: 'mark', src: 'launch-mark-source.png', svg: 'launch-mark.svg', sizes: [44, 132] },
  ];
  for (const it of items) {
    const png = dataUri(join(here, it.src));
    const svg = readFileSync(join(here, it.svg), 'utf8');
    const rows = [];
    for (const bg of ['#FCF8F0', '#121018']) {
      for (const size of it.sizes) {
        rows.push(
          `<div class="row" data-size="${size}" data-bg="${bg}"><img class="src" src="${png}" width="${size}"><span class="svg">${svg.replace('<svg ', `<svg width="${size}" `)}</span><canvas class="diff" width="${size}" height="${size}"></canvas><p class="m"></p></div>`,
        );
      }
    }
    const html = `<!doctype html><meta charset="utf-8"><style>body{margin:16px;font:14px system-ui}.row{display:flex;gap:24px;align-items:flex-start;padding:12px;margin-bottom:12px}.row[data-bg="#FCF8F0"]{background:#FCF8F0}.row[data-bg="#121018"]{background:#121018;color:#eee}.svg svg{display:block}.m{min-width:220px}</style>${rows.join('')}`;
    await page.setContent(html);
    const metrics = await page.evaluate(async () => {
      const results = [];
      for (const row of document.querySelectorAll('.row')) {
        const size = Number(row.dataset.size);
        const img = row.querySelector('img');
        await img.decode();
        const svgEl = row.querySelector('svg');
        const blob = new Blob([new XMLSerializer().serializeToString(svgEl)], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const vec = new Image();
        vec.src = url;
        await vec.decode();
        const draw = (im) => {
          const c = document.createElement('canvas');
          c.width = size;
          c.height = size;
          const ctx = c.getContext('2d');
          const r = Math.min(size / im.naturalWidth, size / im.naturalHeight);
          const w = im.naturalWidth * r;
          const h = im.naturalHeight * r;
          ctx.drawImage(im, (size - w) / 2, (size - h) / 2, w, h);
          return ctx.getImageData(0, 0, size, size).data;
        };
        const a = draw(img);
        const b = draw(vec);
        const diff = row.querySelector('canvas');
        const dctx = diff.getContext('2d');
        const out = dctx.createImageData(size, size);
        let sum = 0;
        let n = 0;
        let bad = 0;
        for (let i = 0; i < a.length; i += 4) {
          const alpha = Math.max(a[i + 3], b[i + 3]);
          if (alpha < 8) {
            out.data[i + 3] = 0;
            continue;
          }
          const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]), Math.abs(a[i + 3] - b[i + 3]));
          sum += d;
          n++;
          if (d > 48) bad++;
          out.data[i] = 255;
          out.data[i + 1] = 255 - d;
          out.data[i + 2] = 255 - d;
          out.data[i + 3] = 255;
        }
        dctx.putImageData(out, 0, 0);
        const mean = n ? sum / n : 0;
        const badPct = n ? (100 * bad) / n : 0;
        row.querySelector('.m').textContent = `${size}px：平均差 ${mean.toFixed(1)}/255，差超過 48 的像素 ${badPct.toFixed(2)}%`;
        results.push({ size, bg: row.dataset.bg, mean: Number(mean.toFixed(2)), badPct: Number(badPct.toFixed(2)) });
        URL.revokeObjectURL(url);
      }
      return results;
    });
    const file = join(out, `sheet-${it.name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`sheet：${it.name}`, JSON.stringify(metrics), '寫到', file);
  }
  // 18 張啟動圖的拼圖（已經產生過才有）
  const splashDir = join(web, 'public/splash');
  const cfg = JSON.parse(readFileSync(join(web, 'src/shell/splash-devices.json'), 'utf8'));
  const tiles = [];
  for (const d of cfg.devices) {
    for (const scheme of ['light', 'dark']) {
      const f = join(splashDir, `apple-splash-${scheme}-${d.w * d.dpr}x${d.h * d.dpr}.png`);
      if (existsSync(f))
        tiles.push(
          `<figure><img src="${dataUri(f)}" width="160"><figcaption>${scheme} ${d.w}×${d.h}@${d.dpr}（${kb(statSync(f).size)}）</figcaption></figure>`,
        );
    }
  }
  if (tiles.length) {
    await page.setContent(
      `<!doctype html><meta charset="utf-8"><style>body{margin:16px;font:12px system-ui;background:#888}figure{display:inline-block;margin:8px;text-align:center;color:#fff}img{display:block;border:1px solid #333}</style>${tiles.join('')}`,
    );
    const file = join(out, 'sheet-devices.png');
    await page.screenshot({ path: file, fullPage: true });
    console.log(`sheet：${tiles.length} 張啟動圖的拼圖 寫到 ${file}`);
  }
  await browser.close();
}

async function splash() {
  const dist = resolve(root, opt('dist', 'apps/web/dist'));
  if (flag('build')) {
    for (const args of [['content:build'], ['--filter', '@ledgerland/web', 'build']]) {
      const r = spawnSync('pnpm', args, { cwd: root, stdio: 'inherit' });
      if (r.status !== 0) throw new Error(`pnpm ${args.join(' ')} 失敗`);
    }
  }
  const index = join(dist, 'index.html');
  if (!existsSync(index)) throw new Error(`找不到 ${index}：先 pnpm content:build && pnpm --filter @ledgerland/web build，或加 --build`);
  const out = resolve(root, opt('out', 'apps/web/public/splash'));
  mkdirSync(out, { recursive: true });
  const cfg = JSON.parse(readFileSync(join(web, 'src/shell/splash-devices.json'), 'utf8'));
  const only = opt('only', '') ? new Set(opt('only', '').split(',')) : null;
  const schemes = opt('scheme', '') ? [opt('scheme', '')] : ['light', 'dark'];
  const browser = await chromium.launch();
  const files = [];
  for (const d of cfg.devices) {
    if (only && !only.has(`${d.w}@${d.dpr}`)) continue;
    for (const scheme of schemes) {
      const context = await browser.newContext({
        viewport: { width: d.w, height: d.h },
        deviceScaleFactor: d.dpr,
        colorScheme: scheme,
        isMobile: true,
        hasTouch: true,
        locale: 'zh-TW',
      });
      const page = await context.newPage();
      // 和 e2e/page-states.ts 的 App 模式一樣：boot 腳本看到 navigator.standalone 就寫 data-display=app
      await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true, configurable: true }));
      await page.goto(pathToFileURL(index).href, { waitUntil: 'domcontentloaded' });
      const state = await page.evaluate(() => ({ display: document.documentElement.dataset.display, theme: document.documentElement.dataset.theme }));
      if (state.display !== 'app' || state.theme !== scheme)
        throw new Error(`${d.w}@${d.dpr} ${scheme}：data-display=${state.display}、data-theme=${state.theme}，殼層沒有進 App 模式或主題不對`);
      await page.locator('#ll-launch').waitFor({ state: 'visible', timeout: 10_000 });
      const file = join(out, `apple-splash-${scheme}-${d.w * d.dpr}x${d.h * d.dpr}.png`);
      await page.screenshot({ path: file, animations: 'disabled', caret: 'hide' });
      const size = pngSize(file);
      if (size.w !== d.w * d.dpr || size.h !== d.h * d.dpr) throw new Error(`${file} 是 ${size.w}×${size.h}，不是 ${d.w * d.dpr}×${d.h * d.dpr}`);
      files.push(file);
      await context.close();
    }
  }
  await browser.close();
  if (!flag('no-quantise')) {
    const python = opt('python', process.env.LL_PYTHON ?? 'python3');
    const r = spawnSync(python, [join(here, 'quantise-png.py'), ...files], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`quantise-png.py 失敗（${python}）；要跳過壓色用 --no-quantise`);
  }
  for (const f of files) console.log(`${kb(statSync(f).size).padStart(9)}  ${f.replace(root + '/', '')}`);
  console.log(`splash：${files.length} 張`);
}

if (cmd === 'sheet') await sheet();
else if (cmd === 'splash') await splash();
else {
  console.error('用法：node apps/web/brand/make-launch.mjs sheet|splash [選項]（見檔頭）');
  process.exit(2);
}
