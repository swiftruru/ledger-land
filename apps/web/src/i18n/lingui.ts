// 兩份 catalog 在載入時合併（05 第 3.1 節）：web-ui 的元件字串加上 apps/web 的頁面與殼層字串。
// en catalog 只在英文網址或切換到英文時才動態載入（09 第 3.2 節）；兩個 chunk 都進 precache，離線也能切換
import { i18n } from '@lingui/core';
import type { Messages } from '@lingui/core';
import { loadWebUiMessages } from '@ledgerland/web-ui';
import type { Locale } from '@ledgerland/i18n';

const appLoaders: Record<Locale, () => Promise<{ messages: Messages }>> = {
  'zh-TW': () => import('../locales/zh-TW/messages.po'),
  en: () => import('../locales/en/messages.po'),
};

const loaded = new Set<Locale>();

export async function activateLocale(locale: Locale): Promise<void> {
  if (i18n.locale === locale) return;
  if (!loaded.has(locale)) {
    const [ui, app] = await Promise.all([loadWebUiMessages(locale), appLoaders[locale]()]);
    i18n.load(locale, { ...ui, ...app.messages });
    loaded.add(locale);
  }
  i18n.activate(locale);
}

export { i18n };
