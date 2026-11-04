// 從 public/favicon.svg 產生 public/icons/favicon.ico（48、32、16，帶透明通道；06 第 2.2 節）。
// favicon.svg 本身是手畫的向量（鈴的金幣：外框、幣面、高光、眼睛、微笑、腮紅與歪戴的禮帽，2026-11-05），不再從點陣圖描；
// 這個腳本只負責 ICO：用 Playwright 的 Chromium 把 SVG 各尺寸畫成透明背景的 PNG（和瀏覽器自己縮的一樣），再交給 Pillow 打包成一個 ICO。
// 維護者手動跑：在 apps/web 下 `node brand/make-favicon.mjs`；需要 python3 加 pillow。
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const svgPath = resolve(here, '../public/favicon.svg');
const icoPath = resolve(here, '../public/icons/favicon.ico');
const SIZES = [48, 32, 16];

const svg = readFileSync(svgPath, 'utf8');
const dir = mkdtempSync(join(tmpdir(), 'll-favicon-'));
const browser = await chromium.launch();
try {
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(
      `<!doctype html><html><head><style>html,body{margin:0;background:transparent}img{display:block;width:${size}px;height:${size}px}</style></head><body><img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}"></body></html>`,
    );
    await page.screenshot({ path: join(dir, `${size}.png`), omitBackground: true });
    await page.close();
  }
} finally {
  await browser.close();
}
const py = `
import sys
from PIL import Image
sizes = [int(s) for s in sys.argv[2:]]
imgs = [Image.open(f"${dir}/{s}.png").convert("RGBA") for s in sizes]
imgs[0].save(sys.argv[1], format="ICO", sizes=[(s, s) for s in sizes], append_images=imgs[1:])
`;
execFileSync('python3', ['-c', py, icoPath, ...SIZES.map(String)], { stdio: 'inherit' });
rmSync(dir, { recursive: true, force: true });
console.log(`favicon.ico ${statSync(icoPath).size} bytes（${SIZES.join('、')}）`);
