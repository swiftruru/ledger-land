# 資安問題的回報方式

LedgerLand 會計樂園是純前端的靜態網站：沒有帳號、沒有登入、不收集個資，學習進度只存在使用者自己的裝置上。即使如此，我們仍然重視任何安全問題。

## 怎麼回報

- 請用 GitHub 的「Report a vulnerability」（Security › Advisories › Report a vulnerability）私下回報，不要在公開的 issue 描述可被利用的細節。
- 回報時請附上：受影響的頁面或網址、重現步驟、瀏覽器與系統版本，以及你認為的影響範圍。
- 我們會在收到後 7 天內回覆，並在修正後於 release notes 致謝（除非你不希望具名）。

## 範圍

- 本站的程式碼、建置流程、CI 設定與部署設定（Cloudflare Workers Static Assets）。
- 本站的 CSP、安全標頭與 Service Worker 行為。

## 不在範圍

- 老師的教材（不在 repo 內，也不在網站上）。
- 第三方服務本身的問題（Cloudflare、GitHub）請直接向該服務回報。
