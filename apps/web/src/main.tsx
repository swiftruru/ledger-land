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

installErrorLog();
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
  // 進度資料庫在第一次繪製真的送出之後才開始開啟（runtime 與 zod 的 chunk 約 45 KB，不跟語系訊息搶首次載入的頻寬，也不算進 LCP；06 第 8.2 節的 LCP 預算）；
  // App 模式啟動時順便呼叫 persist()（06 第 4.5 節的 launch 觸發點）
  afterFirstPaint(() => {
    void getProgressStore()
      .then(() => maybePersist('launch'))
      .catch(() => {});
  });
}

void start();
