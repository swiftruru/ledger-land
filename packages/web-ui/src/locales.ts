// 元件字串的 catalog 載入器：apps/web（與日後的後台）在載入時把它和自己的 catalog 合併（05 第 3.1 節）
import type { Locale } from '@ledgerland/i18n';
import type { Messages } from '@lingui/core';

const loaders: Record<Locale, () => Promise<{ messages: Messages }>> = {
  'zh-TW': () => import('./locales/zh-TW/messages.po'),
  en: () => import('./locales/en/messages.po'),
};

export async function loadWebUiMessages(locale: Locale): Promise<Messages> {
  const { messages } = await loaders[locale]();
  return messages;
}
