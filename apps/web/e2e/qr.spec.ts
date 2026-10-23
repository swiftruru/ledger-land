// App 內掃描課堂 QR（06 第 4.9 節、10 第 9 節第 7 項）：只在 desktop-chromium 跑，用 Chromium 的假攝影機（--use-file-for-fake-video-capture）播放
// 由 @zxing/library 的 QRCodeWriter 產生的 y4m 影像：一支是站內關卡網址、一支是站外網址。App 模式用 addInitScript 覆寫 matchMedia 的 display-mode。
// Playwright 預設 headless 用的 chromium-headless-shell 沒有 getUserMedia（NotSupportedError），所以這支測試改用完整的 Chromium（channel: 'chromium'，新式 headless）。
// iOS 實機（17、26、27）的辨識與每次啟動重新詢問權限不在這裡，列在實機清單。
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { BarcodeFormat, EncodeHintType, QRCodeWriter } from '@zxing/library';
import { waitForApp, watchCsp } from './helpers.ts';

const MAP = '/play/?ll-fixture=quest';
const LEVEL = 'lv_fx010003';
const SITE_QR = `https://ledgerland.swift.moe/level/${LEVEL}/`;
const OTHER_QR = `https://example.com/level/${LEVEL}/`;

// 假攝影機影像寫在 repo 內的 .cache/（已在 .gitignore）：640x480、I420、3 格一樣的畫面，QR 置中
const fixtureDir = fileURLToPath(new URL('../../../.cache/e2e-qr/', import.meta.url));
function writeQrY4m(name: string, text: string): string {
  const W = 640;
  const H = 480;
  const size = 400;
  const matrix = new QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, size, size, new Map([[EncodeHintType.MARGIN, 2]]));
  const y = Buffer.alloc(W * H, 235);
  const ox = (W - size) / 2;
  const oy = (H - size) / 2;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (matrix.get(c, r)) y[(oy + r) * W + ox + c] = 16;
  const uv = Buffer.alloc((W / 2) * (H / 2), 128);
  const frame = Buffer.concat([Buffer.from('FRAME\n'), y, uv, uv]);
  const file = `${fixtureDir}${name}.y4m`;
  mkdirSync(fixtureDir, { recursive: true });
  writeFileSync(file, Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F30:1 Ip A1:1 C420jpeg\n`), frame, frame, frame]));
  return file;
}
const fakeCamera = (file: string) => ({ channel: 'chromium', args: ['--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${file}`] });

/** App 模式（06 第 2.7 節的 isAppMode）：讓 display-mode: standalone 的媒體查詢成立；boot 腳本與 React 都看這個 */
async function emulateAppMode(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      const mql = original(query);
      if (!query.includes('display-mode: standalone')) return mql;
      return new Proxy(mql, { get: (target, prop) => (prop === 'matches' ? true : Reflect.get(target, prop)) });
    };
  });
}

/** 把每一次 getUserMedia 拿到的串流記在 window 上（站內 QR 幾百毫秒就導覽，來不及從 video.srcObject 讀），之後檢查 track 是否都 ended */
async function recordStreams(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const streams: MediaStream[] = [];
    (window as unknown as { __e2eStreams: MediaStream[] }).__e2eStreams = streams;
    const original = MediaDevices.prototype.getUserMedia;
    MediaDevices.prototype.getUserMedia = async function (constraints) {
      const stream = await original.call(this, constraints);
      streams.push(stream);
      return stream;
    };
  });
}
const trackStates = (page: Page) =>
  page.evaluate(() => (window as unknown as { __e2eStreams: MediaStream[] }).__e2eStreams.flatMap((s) => s.getTracks().map((t) => t.readyState)));

async function openScanner(page: Page): Promise<void> {
  await emulateAppMode(page);
  await recordStreams(page);
  await page.goto(MAP);
  await waitForApp(page);
  await page.getByTestId('quest-map').waitFor();
  await page.getByTestId('map-scan').click();
  const overlay = page.getByTestId('scan-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText('不會拍照，也不會上傳');
  await expect(overlay).toContainText('可能會再問一次');
  await expect(page.getByTestId('qr-video')).toHaveCount(0);
  expect(await trackStates(page)).toEqual([]);
  await overlay.getByRole('button', { name: '開始掃描' }).click();
}

// launchOptions 只能放在檔案層（會換 worker）：預設假攝影機播站外 QR（不會導覽，掃描畫面留著）；站內 QR 的測試自己另外啟動一個 Chromium
test.use({ launchOptions: fakeCamera(writeQrY4m('other', OTHER_QR)), channel: 'chromium' });

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', '假攝影機只有 Chromium 支援');
});

test.describe('站內 QR', () => {
  test('App 模式掃到站內關卡 QR：導到該關卡並帶 ?via=qr，相機 track 全部 ended，沒有 CSP 違規', async ({ playwright, baseURL }) => {
    const browser = await playwright.chromium.launch(fakeCamera(writeQrY4m('site', SITE_QR)));
    try {
      const context = await browser.newContext({ baseURL: baseURL!, permissions: ['camera'], locale: 'zh-TW' });
      const page = await context.newPage();
      const assertCsp = await watchCsp(page);
      await openScanner(page);
      await expect(page).toHaveURL(new RegExp(`/level/${LEVEL}/\\?via=qr$`), { timeout: 15_000 });
      await expect(page.getByTestId('scan-overlay')).toBeHidden();
      await expect.poll(() => trackStates(page)).toEqual(['ended']);
      await assertCsp();
    } finally {
      await browser.close();
    }
  });
});

test.describe('站外 QR', () => {
  test.use({ permissions: ['camera'] });

  test('掃到站外網址：顯示「這不是 LedgerLand 的課堂 QR」、不導覽、繼續掃描；關閉疊加層後相機關閉', async ({ page }) => {
    const assertCsp = await watchCsp(page);
    await openScanner(page);
    await expect(page.getByTestId('qr-rejected')).toHaveText('這不是 LedgerLand 的課堂 QR。', { timeout: 15_000 });
    await expect(page).toHaveURL(/\/play\//);
    await expect(page.getByTestId('qr-video')).toBeVisible();
    expect(await trackStates(page)).toEqual(['live']);
    // 關閉疊加層（換頁的同一條路：疊加層卸載）
    await page.getByTestId('scan-overlay').getByRole('button', { name: '關閉' }).click();
    await expect(page.getByTestId('scan-overlay')).toBeHidden();
    await expect.poll(() => trackStates(page)).toEqual(['ended']);
    await expect(page).not.toHaveURL(/scan=1/);
    await assertCsp();
  });

  test('掃描中按取消：回到說明卡，相機 track 全部 ended', async ({ page }) => {
    const assertCsp = await watchCsp(page);
    await openScanner(page);
    const overlay = page.getByTestId('scan-overlay');
    await expect.poll(() => trackStates(page)).toEqual(['live']);
    await overlay.getByRole('button', { name: '取消' }).click();
    await expect(overlay.getByRole('button', { name: '開始掃描' })).toBeVisible();
    await expect(page.getByTestId('qr-video')).toHaveCount(0);
    await expect.poll(() => trackStates(page)).toEqual(['ended']);
    await assertCsp();
  });
});

test.describe('拒絕相機權限', () => {
  test.use({ permissions: [] });

  test('沒有權限：顯示改用代號的提示與系統設定說明，按下後進到代號輸入', async ({ page }) => {
    const assertCsp = await watchCsp(page);
    await openScanner(page);
    const overlay = page.getByTestId('scan-overlay');
    await expect(overlay.getByRole('alert')).toContainText('沒有相機權限也沒關係');
    await expect(overlay).toContainText('系統設定');
    await expect(page.getByTestId('qr-video')).toHaveCount(0);
    expect(await trackStates(page)).toEqual([]);
    await overlay.getByRole('button', { name: '改輸入關卡代號' }).click();
    await expect(overlay).toBeHidden();
    await expect(page.getByTestId('code-overlay')).toBeVisible();
    await expect(page.getByTestId('code-overlay').getByRole('textbox')).toBeFocused();
    await assertCsp();
  });
});
