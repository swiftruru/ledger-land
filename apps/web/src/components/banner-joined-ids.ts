// 首次載入的橫幅與錯誤頁裡，中文訊息事先插入 U+2060（word joiner）的訊息 ID（M3 驗收第 7 輪，prose-units.ts 的 joinWords）。
// 全站換行是逐字換行，這些橫幅在首次載入的 chunk，不能在畫面上切詞（會多帶切詞的程式）：詞裡的字之間放看不見的 U+2060，
// 引號裡的介面名稱空格換成不斷行空格，詞與「匯出到 App」不會被拆在兩行。test/prose-units.test.ts 檢查 zh-TW catalog 的這些訊息
// 和 joinWords 的結果一致；改了中文就照測試的錯誤訊息貼上新字串（或用 joinWords 重算）。
// 不放：E2E 用完整文字找的訊息（install.title、sw.updateTitle、inapp.title、error.updated.title、storage.suspended），一行放得下的短字與按鈕。
// E2E 比對下面這些訊息時要容許字之間有 U+2060（banners.spec.ts 的 joinable()）。
export const BANNER_JOINED_IDS = [
  'backupReminder.body',
  'install.body',
  'install.ios.short',
  'safari.title',
  'safari.text',
  'safari.full',
  'safari.levelCode',
  'play.hint.safari',
  'play.hint.backup',
  'inapp.body',
  'storage.blocked',
  'storage.degraded',
  'storage.quota',
  'storage.writeFailed',
  'sw.updateBody',
  'importPrompt.title',
  'importPrompt.body',
  'ephemeral.title',
  'ephemeral.body',
  'error.updated.hint',
  'error.generic.hint',
] as const;
