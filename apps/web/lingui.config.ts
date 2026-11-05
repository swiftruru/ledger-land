// apps/web 的 Lingui 字串檔：只放頁面與殼層的文字；元件字串在 packages/web-ui 自己的 catalog（05 第 3.1 節）
import { defineConfig } from '@lingui/cli';
import { formatter } from '@lingui/format-po';
import { BASE_LOCALE, LOCALES } from '@ledgerland/i18n';

/**
 * 第二層 catalog 的來源（14 第 5.2 節）：這些檔案裡的字串只進 pages.po，由路由在載入頁面 chunk 時一起載入（src/app/router.tsx 的 lazyPage 第三個參數）。
 * 住在第二層的是「不在任何 Tab 第一屏、也不在作答路徑上」的頁面：說明頁（關於、隱私、關於系統設計、幕後、安裝教學）、我的底下的子頁（設定、徽章、備份）
 * 與 debug 頁，連同只有這些頁面用到的 features 與 components。首頁、闖關地圖、章節頁、作答頁、錯題本、名詞圖鑑、名詞頁、「我的」與實驗室入口留在第一層。
 * 元件被第一層的頁面用到時（TimerSetting 也在作答頁、InstallPrompt 是首頁的橫幅、LangSwitch 在作答頁）就不能搬，否則第一層的頁面會缺字；
 * features/install 也一樣：安裝圖解（InstallGuide）會在首頁的安裝橫幅裡展開（InstallPrompt 延遲載入它），所以它的字串留在第一層，只有 /install/ 頁面本身的字串在第二層
 * （2026-11-01 PR 62 的 CI 抓到：搬過去以後首頁橫幅展開的圖解顯示的是訊息 ID）。
 * 2026-11-01（M4a 開工前）從只有幕後頁擴成這一批；M4a 的實驗室字串另開第三層（lab.po），不進這裡。
 */
const PAGE_CATALOG_SOURCES = [
  '<rootDir>/src/pages/About.tsx',
  '<rootDir>/src/pages/Backup.tsx',
  '<rootDir>/src/pages/Badges.tsx',
  '<rootDir>/src/pages/Credits.tsx',
  '<rootDir>/src/pages/Debug.tsx',
  '<rootDir>/src/pages/Design.tsx',
  '<rootDir>/src/pages/Install.tsx',
  '<rootDir>/src/pages/Privacy.tsx',
  '<rootDir>/src/pages/Settings.tsx',
  // 期中考苦練（M4c，2026-11-04）：三頁與它的元件都在第二層；首頁與「我的」的入口字串留在第一層
  '<rootDir>/src/pages/Exam.tsx',
  '<rootDir>/src/pages/ExamRun.tsx',
  '<rootDir>/src/pages/ExamTeacher.tsx',
  '<rootDir>/src/pages/ExamList.tsx',
  '<rootDir>/src/pages/ExamBrowse.tsx',
  '<rootDir>/src/features/exam',
  '<rootDir>/src/features/badges',
  '<rootDir>/src/features/credits',
  '<rootDir>/src/components/AppearanceSetting.tsx',
  '<rootDir>/src/components/ProtectProgress.tsx',
];

/** 第三層（lab.po，M4a 2026-11-01）：報表實驗室的子頁與元件；實驗室首頁 src/pages/Lab.tsx 是 Tab 的第一屏，留在第一層 */
const LAB_CATALOG_SOURCES = [
  '<rootDir>/src/pages/LabStory.tsx',
  '<rootDir>/src/pages/LabStep.tsx',
  '<rootDir>/src/pages/LabSandbox.tsx',
  '<rootDir>/src/pages/LabReconcile.tsx',
  '<rootDir>/src/pages/LabRatios.tsx',
  '<rootDir>/src/features/lab',
];

export default defineConfig({
  sourceLocale: BASE_LOCALE,
  locales: LOCALES.map((l) => l.code),
  // 缺字時退回 zh-TW；也因為有這一行，CI 必須用 --mode catalog 檢查（05 第 3.4 節）
  fallbackLocales: { default: BASE_LOCALE },
  catalogs: [
    // 第一層：首次載入的字串（殼層與每個 Tab 的第一屏、作答路徑），建置成每個語言一個 chunk 進第一波
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['<rootDir>/src'],
      exclude: [...PAGE_CATALOG_SOURCES, ...LAB_CATALOG_SOURCES],
    },
    // 第二層（14 第 5.2 節，2026-10-27 起）：只在子頁用到的字串，路由在載入頁面 chunk 時一起載入（i18n/pages-catalog.ts），不進首次載入的 JS
    {
      path: '<rootDir>/src/locales/{locale}/pages',
      include: PAGE_CATALOG_SOURCES,
    },
    // 第三層：報表實驗室（路由在載入實驗室子頁的 chunk 時一起載入）
    {
      path: '<rootDir>/src/locales/{locale}/lab',
      include: LAB_CATALOG_SOURCES,
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
