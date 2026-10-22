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
}

void start();
