// apps/web 的 Lingui 字串檔：只放頁面與殼層的文字；元件字串在 packages/web-ui 自己的 catalog（05 第 3.1 節）
import { defineConfig } from '@lingui/cli';
import { formatter } from '@lingui/format-po';
import { BASE_LOCALE, LOCALES } from '@ledgerland/i18n';

/** 第二層 catalog 的來源：這些檔案裡的字串只進 pages.po */
const PAGE_CATALOG_SOURCES = ['<rootDir>/src/pages/Credits.tsx', '<rootDir>/src/features/credits'];

export default defineConfig({
  sourceLocale: BASE_LOCALE,
  locales: LOCALES.map((l) => l.code),
  // 缺字時退回 zh-TW；也因為有這一行，CI 必須用 --mode catalog 檢查（05 第 3.4 節）
  fallbackLocales: { default: BASE_LOCALE },
  catalogs: [
    // 第一層：首次載入的字串（殼層與每個 Tab 的第一屏），建置成每個語言一個 chunk 進第一波
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['<rootDir>/src'],
      exclude: PAGE_CATALOG_SOURCES,
    },
    // 第二層（14 第 5.2 節，2026-10-27 起）：只在子頁用到的字串，由頁面自己延遲載入（i18n/pages-catalog.ts），不進首次載入的 JS；
    // 第一個住戶是幕後頁（/credits/），其他子頁的字串之後再搬
    {
      path: '<rootDir>/src/locales/{locale}/pages',
      include: PAGE_CATALOG_SOURCES,
    },
    // M0b 驗證結果（14 第 5.3 節）：macroTransform 本身能處理 workspace 套件的原始碼（web-ui 自己的 lingui extract 抽得到，app 建置時 macro 也正確轉換），
    // 但 @lingui/vite-plugin 載入 .po 時只接受「消費端 lingui.config 的 catalogs.path」底下的檔案，所以退路的一半要啟用：
    // 把 web-ui 的 catalog 也列在這裡（path 仍指向 web-ui 自己的檔案，抽取結果只寫進那裡，不會混進 app 的 catalog）
    {
      path: '<rootDir>/../../packages/web-ui/src/locales/{locale}/messages',
      include: ['<rootDir>/../../packages/web-ui/src'],
    },
  ],
  format: formatter({ lineNumbers: false }),
});
