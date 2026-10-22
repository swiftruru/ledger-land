// 網站設定的唯一來源（09 第 3.1 節、06 第 5.2 節）：base path、manifest 的 id、scope、start_url、SW scope、正式 origin 與統計服務都從這裡產生。
// 純資料，Vite 設定（Node）與用戶端程式都會匯入；建置時也會寫成 dist/site-config.json 給建置後檢查用。
export const site = {
  /** base path（D4 已定為 /；base、basename、manifest scope、SW scope 都用它） */
  base: '/',
  /** manifest 的 id：設定後永遠不改（06 第 2.1 節） */
  manifestId: '/',
  /** 正式 origin（D4）：只有這個 origin 的建置會把統計送到正式端點 */
  productionOrigin: 'https://ledgerland.swift.moe',
  name: 'LedgerLand 會計樂園',
  shortName: 'LedgerLand',
  description: '用闖關與報表實驗室學會計入門，中英雙語，可離線使用。',
  repo: 'https://github.com/swiftruru/ledger-land',
  issues: 'https://github.com/swiftruru/ledger-land/issues',
  /**
   * 流量統計（D7，已決定採用 Cloudflare Web Analytics，2026-10-22）：JS Snippet 手動安裝，不用邊緣自動注入。
   * token 是公開的站台識別碼（會出現在每一頁的 HTML 裡），由使用者在 Cloudflare 儀表板建立後填入；空字串代表還沒設定，統計不載入。
   */
  analytics: {
    service: 'Cloudflare Web Analytics',
    scriptOrigin: 'https://static.cloudflareinsights.com',
    scriptPath: '/beacon.min.js',
    reportOrigin: 'https://cloudflareinsights.com',
    reportPath: '/cdn-cgi/rum',
    token: 'a16a4e523a3b430db3d348ea97ed6a85', // Web Analytics 的 beacon token（公開值；網站以 JS Snippet 手動安裝，2026-10-22 建立）
  },
} as const;

export type SiteConfig = typeof site;
