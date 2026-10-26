// 兩份 catalog 在載入時合併（05 第 3.1 節）：web-ui 的元件字串加上 apps/web 的頁面與殼層字串（app 的同名 ID 優先）。
// 每個語言的兩份 catalog 由 catalog-<語言>.ts 一起引入、建置成一個 chunk；en 只在英文網址或切換到英文時才動態載入（09 第 3.2 節），兩個 chunk 都進 precache，離線也能切換
import { i18n } from '@lingui/core';
import type { Messages } from '@lingui/core';
import type { Locale } from '@ledgerland/i18n';

const loaders: Record<Locale, () => Promise<{ ui: Messages; app: Messages }>> = {
  'zh-TW': () => import('./catalog-zh-TW.ts'),
  en: () => import('./catalog-en.ts'),
};

const loaded = new Set<Locale>();
/** 最後一次要求的語言：catalog 下載期間使用者又切回原語言時，晚到的 catalog 只載入、不切換（core-5） */
let wanted: Locale | null = null;

export async function activateLocale(locale: Locale): Promise<void> {
  wanted = locale; // 必須在 early return 之前，切回原語言時才能讓晚到的 chunk 失效
  if (i18n.locale === locale) return;
  if (!loaded.has(locale)) {
    const { ui, app } = await loaders[locale]();
    if (!loaded.has(locale)) {
      i18n.load(locale, { ...ui, ...app });
      loaded.add(locale);
    }
    if (wanted !== locale) return; // 使用者已改要別的語言：保留 catalog，不切換
  }
  i18n.activate(locale);
}

export { i18n };
