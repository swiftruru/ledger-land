// Zod 的 JIT 要在任何 schema 定義前關掉（CSP 沒有 unsafe-eval），所以這是第一個 import
import './lib/zod-config.ts';
import { I18nProvider } from '@lingui/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { localeFromPath } from '@ledgerland/i18n';
import '@ledgerland/tokens/tokens.css';
import '@ledgerland/web-ui/styles.css';
import './styles/base.css';
import './styles/tabbar.css';
import { router } from './app/router.tsx';
import { activateLocale, i18n } from './i18n/lingui.ts';
import { loadManifest } from './lib/content.ts';
import { installErrorLog } from './lib/errors.ts';
import { afterFirstPaint } from './lib/idle.ts';
import { getProgressStore } from './lib/progress/index.ts';
import { maybePersist } from './lib/progress/persist.ts';
import { armLaunchScreen } from './shell/launch-screen.ts';

installErrorLog();
// 啟動畫面（06 第 2.4 節）：App 模式起 4 秒上限、瀏覽器模式直接拿掉；掀開第一頁時 PageReveal 再叫它離場
armLaunchScreen();
// 內容 manifest 在殼層已 preload，這裡立刻開始讀，讓名詞頁的快照請求不用等頁面 chunk（06 第 8.2 節的 LCP 預算）
void loadManifest().catch(() => {});
async function start() {
  await activateLocale(localeFromPath(location.pathname));
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <RouterProvider router={router} />
      </I18nProvider>
    </StrictMode>,
  );
  // 進度資料庫和頁面一起開始開啟（維護者 2026-10-26：每一頁都要資料齊了才一次出現，不能先畫版面再補數字；runtime 的 chunk 由殼層依
  // route-preload.json 的 always 和頁面 chunk 一起預先載入，zod 不在這條路徑上）。App 模式啟動時的 persist()（06 第 4.5 節的 launch 觸發點）仍等第一次繪製之後
  const store = getProgressStore().catch(() => null);
  afterFirstPaint(() => {
    void store.then((s) => s && maybePersist('launch')).catch(() => {});
  });
}

void start();
