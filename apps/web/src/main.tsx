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
import { installErrorLog } from './lib/errors.ts';

installErrorLog();

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
