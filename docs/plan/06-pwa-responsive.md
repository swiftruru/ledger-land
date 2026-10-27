# 06 PWA、響應式、效能與錯誤處理

這份文件規劃 LedgerLand 會計樂園怎麼像 App 一樣安裝、離線使用、溫和更新，以及怎麼把學習進度安全地留在裝置上；正式網址是 `https://ledgerland.swift.moe`，主機為 Cloudflare Workers Static Assets。主要目標是 iPhone Safari（iOS 26 與 iOS 27 兩代，另正式支援 iOS 17），其次是 Android Chrome 與電腦瀏覽器。技術事實以 2026-10-20 的查證為準，事實核對（factcheck）的更正優先於原始研究；還沒在實機上確認的地方一律標【待實測】，並引用 V 系列編號。各頁面的版面細節見 [02 網站架構](02-site-architecture.md)，色彩與玻璃效果見 [07 設計系統](07-design-system.md)。

## 確定要做

- **學習者不登入、進度只存在裝置本機、不收集個資。** 學習端不載入任何驗證 SDK，也不使用匿名登入（這也是 [08 題庫管理](08-content-admin.md) 後台方案的硬性限制）。唯一的外部請求是 D7 決定加入的流量統計，它不用 cookie、不收集個資，也不送出作答與進度（第 8.3 節）。
- **正式 origin 與主機（D4）**：`https://ledgerland.swift.moe`，Cloudflare Workers Static Assets，base path 為 `/`；用 `_headers` 設定 CSP、`frame-ancestors` 與快取；深層連結以 SPA fallback 回 200；PR 預覽網址只放測試資料（第 3.5 節、第 5 節）。
- **網址與離線殼層（D5）**：中文在根路徑、英文在 `/en/`；不預先產生 HTML，框架用 React Router 8 data mode 加 vite-plugin-pwa 的 `generateSW`；中文與英文的所有導覽都由同一份殼層 `index.html` 回應，Cloudflare 的 SPA fallback 也回傳這份殼層（本案沒有語言選擇頁）；作答狀態放在路由外的 store，切換語言時保留（第 3.1、3.5 節）。
- **完整的安裝資訊**：manifest 含固定的 `id`、`name`、`short_name`、`description`、`screenshots`、`display: standalone`、`theme_color`、`background_color`（由 `packages/tokens` 產生，見 07 第 2.1 節）與含 maskable 的 `icons`；HTML 放 180×180 不透明的 `apple-touch-icon`、`favicon.svg`，以及淺色與深色兩個帶 `media` 的 `theme-color` meta（第 2 節）。
- **啟動畫面**：Android 由 manifest 自動產生。iOS 的 `apple-touch-startup-image` 與狀態列顏色在 iOS 26、27 的效果未經證實，M0a 實機驗證；退路是單色背景加圖示，並在首次繪製前替 `html` 與 `body` 設定背景色【待實測 V05】。
- **安裝提示依平台分流**：iOS 用圖解教學（Safari 分頁列 Compact 與 Top／Bottom 兩種版面各一套）；Chromium 用 `beforeinstallprompt`；第一次完成一個關卡之後才提示，可關閉並記住選擇；QR 落地頁、作答中、App 內建瀏覽器、已經以 App 模式執行時一律不提示（第 2.5 節）。
- **共用的 `isAppMode()`**：判斷是否以主畫面 App 執行，結果在首次繪製前寫入 `html[data-display]`，CSS 版面一律依這個屬性，不直接寫 `@media (display-mode)`【待實測 V01】（第 2.7 節）。
- **離線**：app shell 與檔名帶 hash 的內容 JSON（中英兩種語言）預先快取，不 precache 任何預先產生的頁面；課程內容不用 stale-while-revalidate（第 3.2 節）。
- **更新採 prompt 模式**：作答中不打擾，回到列表頁才提示；按下更新之前先寫入進度；絕不自動 `skipWaiting`；啟動時、回到前景時（30 分鐘節流）與每小時檢查一次更新（第 3.3 節）。
- **`sw.js` 路徑固定**，絕不刪檔或改名；要停用時部署會自我解除的 kill-switch 版本；CI 檢查建置產物裡一定有這個檔案（第 3.4 節）。
- **本機儲存**：IndexedDB（`idb` 套件）加上 schema 版本與 migration，處理多分頁的 `blocked` 與 `versionchange`、連線中斷、配額不足；失敗時降級並提示匯出。進度資料模型、備份格式、匯入合併規則、migration 與儲存介面定義在 `packages/progress`，IndexedDB 的實作在 `apps/web`（第 4 節）。
- **清除風險的說法必須精確**：產品文案只寫「降低被清除的機率」，不寫「不會被清除」（第 4.5 節）。
- **Safari 分頁與主畫面 App 很可能不共享儲存**：Safari 分頁顯示常駐提示並提供「匯出到 App」捷徑（2026-10-27 起帶 `?to=app` 到備份頁最上面的三步引導卡：複製備份碼、打開主畫面的 App、第一次打開時貼上；備份檔只用來存到檔案或 AirDrop，iOS 的分享表單列不出 PWA）；App 第一次啟動時主動詢問是否匯入【待實測 V02、V03】（第 4.7 節）。
- **App 內建瀏覽器**（LINE、Facebook、Instagram）：偵測後顯示可收合的橫幅，不阻擋學習；不顯示安裝提示、不呼叫 `persist()`、不顯示 App 內掃描、加強匯出提醒【待實測 V11】（第 4.8 節）。
- **`persist()`、匯出匯入與課堂 QR（D10(a)，M2 實作）**：以 App 模式啟動時或第一次完成關卡時呼叫 `persist()`（Firefox 只走設定頁按鈕，App 內建瀏覽器不呼叫）；匯出提供備份檔與文字備份碼；匯入預設合併，覆蓋放在進階選項；關卡介紹顯示關卡代號，闖關地圖提供「輸入關卡代號」；App 內另有相機掃描課堂 QR（內建 JS 解碼器加相機權限，解碼器選型在 M2 前查證）（第 4.5 到 4.7 節、第 4.9 節）。
- **origin 是資料模型的一部分**：Vite base、React Router basename、manifest 的 `id`／`scope`／`start_url`、SW scope 都由同一份設定產生；事先寫好不得不搬家時的遷移流程（第 5 節）。
- **iOS 17 正式支援（D8）**：測試矩陣加一台 iOS 17 裝置（沒有實機時用 Simulator 並在報告註明）；Tab bar 的元素直接寫在初始 HTML 殼層，避開 iOS 17 以下「載入後才插入的元素不套用 backdrop-filter」的問題；`-webkit-backdrop-filter` 由建置工具依 browserslist 自動補上（第 1 節、第 2.3 節、第 10 節，玻璃細節見 07）。
- **流量統計（D7，M0b 建置）**：一開始就加入無 cookie、不收集個資的統計；服務在 M0b 前查證（候選 Cloudflare 網頁分析）；統計腳本在 App 掛載後才非同步載入，不 precache、離線時直接略過，不得影響離線與效能預算；CSP、隱私頁與 debug 頁同步修改（第 8.3 節）。
- **原生感檢查清單**：safe area、`100dvh`、44px 觸控目標、`touch-action: manipulation`、輸入框 16px、visualViewport 鍵盤處理、鍵盤開啟時隱藏 Tab bar、捲動位置還原、轉場只做在內容區（第 7 節）。
- **效能目標與量測**：mid-tier 節流下 LCP ≤ 2.5 秒、INP ≤ 200ms、CLS ≤ 0.1；Lighthouse 行動版效能 ≥ 90、無障礙 ≥ 95；首次載入 JS 暫訂 gzip 後 150 KB，從 M0b 起由 CI 把關；量測時統計腳本保持開啟（送出目的地換成測試用的 stub），QR 解碼器不計入首次載入；每個有 UI 的里程碑都要通過（第 8 節）。
- **錯誤處理與部署安全**：每條路由都有 ErrorBoundary；動態載入失敗時先寫入進度再提示重新整理；各種儲存錯誤有固定提示與「立即匯出」按鈕；本機保留最近 50 筆錯誤紀錄；只用整批部署（第 9 節）。

## 需評估

本文件沒有需評估的項目。原本的五項評估（`persist()` 的呼叫時機、匯出匯入的形式、正式網域與主機、網址策略對離線的影響、課堂 QR 的入口）都已在 2026-10-20 決定；決定內容與濃縮後的取捨紀錄見下一節，細部做法寫在後面各節。

## 已決定的項目（2026-10-20）

### 決定一：`persist()` 的呼叫時機（D10(a)）

已決定（D10(a)，2026-10-20）：A 加 B 並用。偵測到以 App 模式執行時啟動就呼叫，或第一次完成一個關卡時呼叫；Firefox 只走 C（設定頁的「保護我的進度」按鈕，按鈕旁先說明「瀏覽器會詢問是否允許保留資料」）；App 內建瀏覽器三者都不做。M2 實作，流程與程式草圖見第 4.5 節。

| 選項 | 做法 | 結果 | 取捨紀錄 |
| --- | --- | --- | --- |
| A | 偵測到以 App 模式執行時，啟動就呼叫 | 採用 | 主畫面 App 是 WebKit 舉例的授予條件之一；Safari 與 Chrome 不跳提示，使用者無感；單獨使用時只涵蓋已安裝的人 |
| B | 第一次完成一個關卡時呼叫（所有非內建瀏覽器、非 Firefox 的環境） | 採用 | 在使用者已投入時才請求，Chrome 的啟發式判斷也較可能授予 |
| C | 設定頁的「保護我的進度」按鈕由使用者主動觸發 | 只用於 Firefox，其他瀏覽器在 `persisted()` 為 false 時也顯示按鈕當作手動重試 | Firefox 會跳權限提示，由使用者主動按下時提示才有上下文 |

未採用的選項：只用 A（Safari 分頁使用者沒有任何保護）、只用 C（涵蓋率最低，多數人不會去按）、在 Firefox 自動呼叫（權限提示沒有上下文，顯得突兀）。

其他規則：「我的 › 備份」（`/me/backup/`）顯示 `persisted()` 的結果與 `estimate()` 的用量（設定頁在儲存方面只放「保護我的進度」按鈕）；沒有取得 persistent 時，提高匯出提醒的頻率。`persist()` 不保證資料不被刪（第 4.5 節），它只是多一層保護，真正的保險是匯出備份。實際授予結果【待實測 V04】。

### 決定二：匯出與匯入的形式（D10(a)）

已決定（D10(a)，2026-10-20）：M2 做 A 備份檔加 B 文字備份碼；匯入預設「合併」，「覆蓋」放在進階選項（合併規則見第 4.6 節）。第 4.6、4.7 節的流程同時走「備份檔」與「備份碼」兩條路。

| 選項 | 做法 | 結果 | 取捨紀錄 |
| --- | --- | --- | --- |
| A 備份檔 | 匯出 `ledgerland-backup-YYYYMMDD.json`：先用 `navigator.canShare({ files })` 檢查，可行就開分享表單（存到「檔案」或傳 LINE），不行就用 `<a download>`；匯入用 `<input type="file">` | 採用（M2 約 2 到 3 天） | 容量不受限、可長期保存、可放雲端硬碟；iPhone 上「存到檔案」再「選檔」步驟多；Firefox 沒有檔案分享 |
| B 文字備份碼 | 把同一份 JSON 壓縮後轉成一串文字，用「複製」與「貼上」轉移 | 採用（在 A 之上加 1 到 2 天） | Safari 分頁與主畫面 App 共用系統剪貼簿，轉移只要兩個動作，也能貼進 LINE 傳給自己；資料量大時備份碼很長，貼錯或截斷要靠檢查碼發現 |
| C 以 QR 匯出進度 | App 內產生 QR，另一台裝置在 App 內掃描 | 未採用 | QR 容量有限，進度一多就裝不下；換機已有備份檔與備份碼可用 |

未採用的選項：C 以 QR 匯出進度（理由如上）。M2 會為課堂 QR 做 App 內掃描（決定五），日後若真的需要以 QR 轉移進度，可以共用同一個解碼器再評估。

### 決定三：正式網域與主機（D4）

已決定（D4，2026-10-20）：正式網域 `ledgerland.swift.moe`（`swift.moe` 的 DNS 在 Cloudflare，2026-10-20 查證），主機用 Cloudflare Workers Static Assets，base path 為 `/`。可以用 `_headers` 設定 CSP、`frame-ancestors` 與快取；深層連結以 SPA fallback 回 200；有 PR 預覽。M0a 的技術驗證先用暫時的 HTTPS 預覽網址（base、basename、manifest scope、SW scope 都設為 `/`），預覽網址上的資料一律視為測試資料；印發給學生的 QR 一律指向正式網域。設定細節見第 3.5 節，origin 的影響見第 5 節，主機的細部比較見 [09 技術選擇](09-tech-stack.md)。

origin 一旦讓學生用了就很難換（第 5 節），這也是 D4 要在第一次讓學生使用之前定案的原因。`ledgerland.swift.moe` 與 `swift.moe` 底下其他子網域是不同的 origin，不共用 IndexedDB、localStorage 與 SW；是否設定 `Strict-Transport-Security` 的 `includeSubDomains` 會影響父網域的其他服務，由 09 一併評估。

| 選項 | 主機選擇 | 結果 | 取捨紀錄 |
| --- | --- | --- | --- |
| A 自有網域的子網域，DNS 在 Cloudflare | Cloudflare Workers Static Assets | 採用（`ledgerland.swift.moe`） | 可用 `_headers` 設定 CSP、快取分層與安全標頭；深層連結回 200；靜態請求免費且不限量；網域續約與 DNS 要長期維護 |
| B 學校子網域，DNS 由學校管理 | Cloudflare Pages 或 GitHub Pages 自訂網域 | 未採用 | Workers 自訂網域需要自己擁有且啟用的 Cloudflare zone；DNS 變更要經過學校；GitHub Pages 無法自訂 header（CSP 只能用 meta）、SPA 退路只能用 404.html（狀態碼 404）、快取固定 `max-age=600` |
| C 另購專用網域 | 同 A | 未採用 | 每年費用、要另外管理；已有 DNS 在 Cloudflare 的 `swift.moe`，不需要另購 |
| 不建議 | `swiftruru.github.io/ledger-land/` | 未採用，只適合內部測試 | 這個 origin 已被我其他的 GitHub Pages 專案共用：IndexedDB、localStorage、配額與淘汰判斷都是同一份，其他專案的腳本（包括它們的 XSS）能讀寫 LedgerLand 的進度；其他專案若在根 scope 註冊 SW，也會攔截 `/ledger-land/` 的請求 |

未採用的選項：B（學校 DNS 與主機限制多）、C（成本與管理負擔，沒有必要）、`swiftruru.github.io`（共用 origin 的安全與儲存問題）。

來源：https://developers.cloudflare.com/workers/configuration/routing/custom-domains/ 、https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/ 、https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits （查證日期 2026-10-20）

### 決定四：網址策略對離線與 fallback 的影響（D5）

已決定（D5，2026-10-20）：C，中文在根路徑、英文在 `/en/`。因為主機採 Cloudflare Workers（D4），深層連結可以直接回到網站殼層，所以先不預先產生 HTML；框架採 React Router 8 data mode 加 vite-plugin-pwa（原 A 案的技術路線），V08（framework mode 加 injectManifest 的離線導覽驗證）暫不需要。日後若要加強搜尋收錄，再評估加入預先產生 HTML（注意事項保留在第 3.5 節末）。網址策略本身的比較在 [05 多語系](05-i18n.md)，這裡只記錄它對 PWA 的影響：

| 面向 | 決定後的做法 |
| --- | --- |
| SW 產生方式 | vite-plugin-pwa 的 `generateSW`（第 3.1 節） |
| 離線導覽的 fallback | `index.html`，也就是唯一的殼層；`/`、`/level/<levelId>/`、`/en/`、`/en/level/<levelId>/` 等所有導覽都由它回應，語系由網址決定（`/en/` 開頭為 en，其餘為 zh-TW） |
| 線上深層連結 | Cloudflare 的 `not_found_handling = "single-page-application"` 回傳同一份殼層，狀態碼 200；本案沒有語言選擇頁（第 3.5 節） |
| 預先快取體積 | 最小：殼層、帶 hash 的 JS 與 CSS、中英兩種語言的內容 JSON，沒有 HTML 或 `.data` 的重複 |
| 主畫面 App 的 `start_url` | `/`（中文首頁）；已存語系偏好為 en 的使用者從主畫面 App 開啟時，根路徑依偏好轉到 `/en/`，不出現語言選擇頁（細節見 05 第 7 節） |
| 切換語言 | 在中文與 `/en/` 網址之間以 replace 導覽；題目、已選選項、計時與捲動位置放在路由外的 store，切換時保留；兩種語言的內容都已 precache，離線也能切換 |

| 選項 | 結果 | 取捨紀錄 |
| --- | --- | --- |
| A 不帶前綴 | 未採用 | PWA 設定最少；但每頁只有一個網址，無法用 hreflang 區分語言，分享連結也無法指定語言。C 在不預先產生 HTML 時，PWA 的設定和 A 幾乎相同 |
| B 全站 `/zh-TW/`、`/en/` 前綴並預先產生 HTML | 未採用 | 要用 framework mode 加建置後的 workbox-build injectManifest，沒有官方整合，要另做 V08 的整套驗證；prerender 的 HTML 與 `.data` 讓同一份文字被下載三次；中文網址也變長 |
| C 中文在根路徑、英文在 `/en/` | 採用，先不預先產生 HTML | 中文網址與 QR 最短；英文有自己的網址；PWA 沿用 A 案的低風險路線 |

未採用的選項：A（無法以網址區分語言）、B（整合風險與預先快取體積都最大）、C 加預先產生 HTML（目前不需要，日後為搜尋收錄再評估）。

### 決定五：已安裝 App 的學生掃到課堂 QR 時的入口（D10(a)）

已決定（D10(a)，2026-10-20）：B 加 C。關卡介紹顯示關卡代號，闖關地圖提供「輸入關卡代號」入口；另外在 App 內加入相機掃描課堂 QR（內建 JS 解碼器加相機權限，因為 Safari 沒有正式的 BarcodeDetector；解碼器選型於 M2 前查證）。M2 實作，流程見第 4.9 節。頁面與 ID 的細節見 [02 網站架構](02-site-architecture.md)。

背景：iPhone 相機掃 QR 很可能開在 Safari 分頁，而不是已安裝的主畫面 App【待實測 V03】，兩邊的儲存又很可能不共享【待實測 V02】。Safari 分頁的常駐提示、「匯出到 App」捷徑與 App 首次啟動的匯入詢問是基本做法（第 4.7 節）；決定五多加兩條「不經過 Safari 也能進到老師指定關卡」的路。

| 選項 | 做法 | 結果 | 取捨紀錄 |
| --- | --- | --- | --- |
| A 不做 | 學生看到 Safari 分頁的提示後，自己打開主畫面 App，從闖關地圖找到同一關 | 未採用 | 章節多時要花時間找；有人會乾脆在 Safari 分頁作答，進度又分成兩份 |
| B 關卡代號 | 關卡介紹顯示短代號（關卡 ID 去掉 `lv_` 前綴的 8 個字元），闖關地圖提供「輸入關卡代號」入口 | 採用（約 1 到 2 天） | 已安裝的學生輸入 8 個字元就能進到同一關；老師也能把代號寫在黑板上；要處理代號不存在、已下架與 320px 寬度的排版 |
| C App 內掃描 QR | App 內建掃描器，直接在 App 裡掃老師的 QR | 採用（3 到 5 天，另加解碼器體積） | 不用打字；需要內建 JS 解碼器並增加體積、要相機權限；就算 V03 的結果是 QR 會開進 App，App 內掃描也讓學生不必離開 App |

未採用的選項：A（進度容易分成兩份）。

**M0a 實測補充（2026-10-21，iPhone 實機，iOS 27、Safari 27.0.1）**：iPhone 相機掃 QR 時，網頁開在「相機的網頁面板」，不是 Safari 分頁，也不是主畫面 App【V03 已實測】。面板、Safari 分頁、主畫面 App 三者的 localStorage、IndexedDB 與 Cache 完全分開，主題設定也不共享【V02 已實測】；面板的儲存配額固定 1 GB（Safari 與 App 約 41 GB），而且每次掃描都是全新的：上次的資料、離線快取與 Service Worker 全部消失，學生在面板裡作答、關掉就沒了。已決定（2026-10-21，A 加 C）：
- A 網站偵測並提示：在 iOS、非 App 模式下，`navigator.storage.estimate()` 的配額低於 1.5 GB 就判定為「暫存情境」，所有頁面頂端顯示可關閉的提示卡「這個畫面關掉後，作答進度不會保留」（英文 "Your progress won't be kept after you close this view"），請學生點指南針改用 Safari 開啟，已安裝 App 的改用 App 內的「掃描課堂 QR」（D10(a)）；關閉狀態記在 sessionStorage。驗證：iOS 17.0、18.6、26.4.1、27.0 的一般 Safari 配額都是 38.40 GB，不會誤報；實機上相機面板與私密瀏覽有提示，Safari 分頁與主畫面 App 沒有。
- C 老師在課堂說明：掃完 QR 先點指南針用 Safari 開，或在 App 裡掃；寫進給老師的使用說明（02 第 4.3 節）。

---

## 1. 目標平台與前提

| 平台 | 定位 | 說明 |
| --- | --- | --- |
| iPhone Safari，iOS 26 與 27 | 主要目標 | Safari 27.0 於 2026-09-14 發布；iOS 26 這條線截至 2026-10-20 停在 26.6.x。兩代都要測 |
| iPhone Safari，iOS 18 | 支援（介於 iOS 17 與 26 之間），不另列實機 | 無法升級到 iOS 26 的舊 iPhone 會停在這一版（機型以 Apple 官方支援頁面為準）。Safari 18 已有無前綴 backdrop-filter，玻璃走 Tier 1；但沒有 iOS 26 的「每個網站都能以 web app 開啟」與 Compact 分頁列，安裝依賴 manifest，圖解教學用 Top／Bottom 那一套。有測試機時抽測，沒有時用 Simulator 補 |
| iPhone Safari，iOS 17 | 正式支援（D8） | 已決定（D8，2026-10-20）：A，正式支援。Safari 17 只支援前綴版 `-webkit-backdrop-filter`，由建置工具（Lightning CSS 或 Autoprefixer）依 browserslist 自動補上；Tab bar 的元素寫在初始 HTML 殼層（2.3），避開「載入後才插入的元素不套用 backdrop-filter」的問題（Safari 18 才修正）；M0a 加一台 iOS 17 裝置，沒有實機時用 Simulator 並在報告註明（第 10 節）。和 iOS 18 一樣沒有 Compact 分頁列與「以 Web App 打開」開關，安裝依賴 manifest。未採用：B「能用但一律走實色」（舊裝置看不到玻璃）、C「不支援」（擋掉部分學生） |
| iPhone Safari，iOS 16.4 到 16.x | 能用，不列入測試 | D8 只決定到 iOS 17。Vite 8 預設建置目標（`baseline-widely-available`）涵蓋 iOS 16.4，程式能執行，玻璃規則與 iOS 17 相同，但不保證外觀；iOS 16.4 之前不保證能執行 |
| iPhone 上的其他瀏覽器 | 視同 Safari | App Review Guideline 2.5.6 規定 iOS 瀏覽器必須用 WebKit，只有歐盟與日本可申請替代引擎，所以台灣 iPhone 上的 Chrome、Edge、Firefox 都是 WebKit |
| Android Chrome、Samsung Internet | 次要目標 | 支援 `beforeinstallprompt` 一鍵安裝 |
| 電腦 Chrome、Edge、Safari、Firefox | 次要目標 | 大螢幕版面與鍵盤操作 |
| App 內建瀏覽器（LINE 等） | 能用但不保證離線 | 見第 4.8 節 |

iOS 26 起，從 Safari 加入主畫面的網站預設以 web app 開啟，使用者可以關掉「以 Web App 打開」改成一般書籤；iOS 不再需要 manifest 或 meta tag 才能這樣做，Apple 也表示 Service Worker 不是必要條件。所以「能不能安裝」已不是問題，重點變成「安裝後的外觀與行為是否正確」，以及「進度會不會因為換了開啟方式而不見」。

來源：https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/ 、https://heise.de/-10749652 、https://developer.apple.com/app-store/review/guidelines/ （查證日期 2026-10-20）

---

## 2. 安裝

### 2.1 manifest 欄位

所有和 origin 有關的值（`id`、`start_url`、`scope`）都由同一份站台設定產生（第 5 節），不手寫在兩個地方。已決定（2026-10-20）：manifest 與 Service Worker 屬於 `apps/web`；`theme_color` 與 `background_color` 由 `packages/tokens` 的 TypeScript 原始檔在建置時產生（07 第 2.1 節），不手寫色碼。

| 欄位 | 值 | 用途與平台差異 |
| --- | --- | --- |
| `id` | `/`（設定後永遠不改） | App 的身分。日後改 `start_url` 也不會被當成另一個 App。Safari iOS 16.4 起支援 |
| `name` | `LedgerLand 會計樂園` | 安裝對話框、Android 啟動畫面 |
| `short_name` | `LedgerLand`（暫定） | 主畫面圖示下方的名稱；iOS 加入主畫面時使用者可以自行修改 |
| `description` | 一句話說明 | Chrome 安裝對話框 |
| `lang`、`dir` | `zh-TW`、`ltr` | 只提供一份 manifest，以 zh-TW 為主；名稱本身已中英並列；scope 已涵蓋 `/en/`，英文頁不另外提供 manifest |
| `start_url` | `/` | 已決定（D5，2026-10-20）：中文首頁。已存語系偏好為 en 的使用者從主畫面 App 開啟時，根路徑依偏好轉到 `/en/`（見 05 第 7 節）；App 啟動時不出現語言選擇頁 |
| `scope` | `/` | 站內所有頁面（含 `/en/` 開頭的英文頁）都在 App 內開啟 |
| `display` | `standalone` | Safari iOS 支援 `standalone` 與 `browser`，不支援 `fullscreen` 與 `minimal-ui`。這裡講的是 manifest 的 `display` 欄位；主畫面 App 執行時 `display-mode` 媒體查詢實際符合哪一個值，兩份事實核對看法相反，見 2.7【待實測 V01】 |
| `theme_color` | 淺色頁面底 `#FCF8F0`（16 的紙質，由 `packages/tokens` 產生） | Chrome Android 的標題列；iOS 是否採用【待實測 V05】 |
| `background_color` | 同上 | 只有 Android 用來產生啟動畫面；Safari iOS 不支援 |
| `icons` | 見 2.2 | Chrome 安裝條件需要 192 與 512 |
| `screenshots` | 手機直向 `narrow` 與寬螢幕 `wide` 各至少一張 | Chrome 的安裝對話框會呈現得更完整 |
| `categories` | `["education"]` | 參考用 |
| `prefer_related_applications` | `false` | Chrome 安裝條件要求不設或為 false |
| `orientation` | 不設定 | 平板橫向與分割畫面都要能用，不鎖方向 |

範例（路徑與色碼為提案值）：

```json
{
  "id": "/",
  "name": "LedgerLand 會計樂園",
  "short_name": "LedgerLand",
  "description": "用闖關與報表實驗室學會計入門，中英雙語，可離線使用。",
  "lang": "zh-TW",
  "dir": "ltr",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "theme_color": "#FCF8F0",
  "background_color": "#FCF8F0",
  "categories": ["education"],
  "prefer_related_applications": false,
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "screenshots": [
    { "src": "/screenshots/play-narrow.png", "sizes": "1080x1920", "type": "image/png", "form_factor": "narrow", "label": "闖關區作答畫面" },
    { "src": "/screenshots/lab-wide.png", "sizes": "1920x1080", "type": "image/png", "form_factor": "wide", "label": "報表實驗室三表並排" }
  ]
}
```

Chrome 目前的可安裝條件：HTTPS；manifest 有 `name` 或 `short_name`、192 與 512 的圖示、`start_url`、`display` 為 fullscreen、standalone、minimal-ui 或 window-controls-overlay，且 `prefer_related_applications` 未設或為 false；使用者至少點過頁面一次、累計停留至少 30 秒。條件裡沒有 Service Worker。

來源：https://web.dev/articles/install-criteria 、https://raw.githubusercontent.com/mdn/browser-compat-data/main/manifests/webapp/display.json 、https://raw.githubusercontent.com/mdn/browser-compat-data/main/manifests/webapp/id.json （查證日期 2026-10-20）

### 2.2 圖示清單

| 檔案 | 尺寸 | 宣告位置與 purpose | 誰會用 | 規則 |
| --- | --- | --- | --- | --- |
| `icons/icon-192.png` | 192×192 | manifest，`any` | Chrome 安裝條件、Android | 可透明背景 |
| `icons/icon-512.png` | 512×512 | manifest，`any` | Chrome 安裝條件、Android 啟動畫面 | 可透明背景 |
| `icons/icon-maskable-192.png` | 192×192 | manifest，`maskable` | Android 自適應圖示 | 滿版不透明背景；主體放在中央安全區（直徑為邊長 80% 的圓形）內 |
| `icons/icon-maskable-512.png` | 512×512 | manifest，`maskable` | 同上 | 同上 |
| `apple-touch-icon.png` | 180×180 | HTML `<link rel="apple-touch-icon">` | iOS 主畫面 | **必須不透明**，背景用品牌色。有它時 iOS 不使用 manifest icons |
| `favicon.svg` | 向量 | HTML `<link rel="icon" type="image/svg+xml">` | 瀏覽器分頁；Safari 26 起介面上所有圖示位置都支援 SVG | 可在 SVG 內用 `prefers-color-scheme` 切換深色版 |
| `favicon.ico` | 32×32 | HTML `<link rel="icon" sizes="32x32">` | 舊瀏覽器 | 由同一份原圖產生 |
| `screenshots/*.png` | 依實際截圖 | manifest | Chrome 安裝對話框 | 每次大改版更新 |
| `apple-touch-startup-image`（選配） | 依裝置尺寸 | HTML `<link rel="apple-touch-startup-image" media="...">` | iOS 啟動畫面 | 是否仍有效【待實測 V05】 |

為什麼 apple-touch-icon 一定要不透明：Safari iOS 只在頁面沒有 apple-touch-icon 時才用 manifest 圖示，而且只用 purpose 為 `any` 的那幾個，不會優先選 maskable；透明背景的 PNG 在主畫面會出現黑邊（WebKit bug 255596，仍是 NEW）。所以 maskable 只對 Android 有意義，iOS 一律靠不透明的 180×180 PNG。apple-touch-icon 是否接受 SVG 沒有官方說明，維持 PNG。

產生方式：用 `@vite-pwa/assets-generator` 2.0.0（2026-09-12 發布，需要 Node 20.19 以上）的 `minimal-2023` 預設，從一份 SVG 原圖產生上述 PNG；它也能產生 Apple 啟動畫面（含深色版，裝置清單已有 iPhone 17 與 iPhone Air）。圖示原圖為原創設計，不使用 Apple 素材（見 07 第 12 節）。

來源：https://raw.githubusercontent.com/mdn/browser-compat-data/main/manifests/webapp/icons.json 、https://bugs.webkit.org/show_bug.cgi?id=255596 、https://registry.npmjs.org/@vite-pwa/assets-generator （查證日期 2026-10-20）

### 2.3 HTML 殼層（head 與 body）

D5 決定不預先產生 HTML，所以整站只有一份 `index.html`，它就是殼層：中文與 `/en/` 的每個網址、線上的 SPA fallback 與離線的 SW fallback 都回傳它。

```html
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#FCF8F0" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#121018" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-title" content="LedgerLand">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<!-- manifest 連結在第一次繪製送出後才由殼層插入（見下面的規則與 8.2） -->
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="data:image/svg+xml,…" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<style>
  html, body { background: #FCF8F0; }
  @media (prefers-color-scheme: dark) { html, body { background: #121018; } }
  html[data-theme="light"], html[data-theme="light"] body { background: #FCF8F0; }
  html[data-theme="dark"], html[data-theme="dark"] body { background: #121018; }
  html[data-flavor="berry"], html[data-flavor="berry"] body { background: #171018; }
  html[data-flavor="wine"], html[data-flavor="wine"] body { background: #181012; }
</style>
<script>/* boot 腳本：依網址寫入 html lang（/en/ 開頭為 en，其餘為 zh-TW，見 05），讀 ll:theme 與 ll:dark-flavor 寫入 data-theme 與 data-flavor（16 第 7 節），並寫入 data-display、data-glass、data-motion，見 2.7 與 07 第 5 節；M3 起另依路徑插入這一頁的 modulepreload 與內容快照的 preload，表格由建置後腳本填入，見 8.2 */</script>
```

```html
<body>
  <a class="ll-skiplink" href="#main">跳到主要內容</a>
  <nav id="ll-tabbar" class="ll-tabbar" aria-label="主要導覽">
    <!-- 膠囊、五個連結、regular 與 fill 兩套圖示、中文標籤：建置時由同一份設定產生，完整標記見 07 第 6.1 節 -->
  </nav>
  <script>/* 殼層在地化：英文網址時改寫 Tab bar 的標籤、href 與 aria-label，並標出 aria-current，在首次繪製前執行 */</script>
  <div id="root"></div>
  <script type="module" src="/assets/index-HASH.js"></script>
</body>
```

規則：

- **Tab bar 寫在初始 HTML 殼層**（已決定 D8，2026-10-20）：iOS 17 以下有「頁面載入後才插入的元素不套用 backdrop-filter」的問題（Safari 18 才修正），所以帶玻璃的 `nav` 不由 React 建立，而是殼層裡 `body` 直屬的元素。React 掛載後以 ref 取得 `#ll-tabbar`，只更新 `aria-current`、標籤文字、`href` 與收合狀態，不建立也不替換 `nav` 與其子元素，也不使用 React portal；平板與電腦的 rail、側邊欄也是同一個元素，由 CSS 依斷點改變外觀（細節見 07 第 6.1 節）。iOS 17 上靜態 Tab bar、切換語言與換版面之後是否仍有模糊，列入 M0a 的 iOS 17 驗證（第 10 節）。
- 殼層在地化的小段腳本緊接在 `nav` 之後，讓英文網址第一次繪製時就是英文標籤（「跳到主要內容」連結的文字也一起改寫）；和 boot 腳本一樣由建置腳本產生並納入 CSP 的 sha256【待實測 V15】。
- D7 的統計腳本**不寫在殼層 HTML 裡**，由 App 掛載後動態載入（第 8.3 節），避免網路很差時 `defer` 腳本拖住 App 的模組腳本。
- **不寫** `maximum-scale=1` 或 `user-scalable=no`。防止連點放大改用 `touch-action: manipulation`（第 7 節），讓需要放大的人仍然可以雙指縮放。
- `viewport-fit=cover` 是 `env(safe-area-inset-*)` 有非零值的前提。
- `interactive-widget=resizes-content` 由 Chromium 支援，Safari 不支援；iOS 的鍵盤處理改用 visualViewport（第 7 節）。
- 背景色在 `<head>` 內聯，確保首次繪製就是品牌色，避免啟動或換頁時閃白，也讓 Safari 從 `html`／`body` 取色時拿到正確的值。已決定（2026-10-20）：首次繪製背景色由 `packages/tokens` 在建置時產生（07 第 2.1 節），上面的色碼是示意；殼層 `index.html` 屬於 `apps/web`。
- 不使用 `apple-mobile-web-app-status-bar-style: black-translucent` 的全螢幕延伸效果（理由見 2.4）。
- SVG 圖示寫成 HTML 裡的 data: URI（建置時由 `public/favicon.svg` 產生，檔案照常部署並進 precache），`<link rel="manifest">` 在第一次繪製送出後才由殼層插入（`src/app/manifest-link.ts`，和 Service Worker 的註冊同一個時間點；建置時插入的那一個由 `vite.config.ts` 的 `ll-defer-manifest-link` 拿掉）。已決定（2026-10-26，M3 收尾 QA）：瀏覽器在 load 前後就會抓 favicon、manifest 與 192px 的安裝圖示，本機量測把這三個請求算在 LCP 之前（8.2）；它們不影響第一次繪製，安裝提示與「加入主畫面」都在那之後才用得到，Chrome 與 Safari 都會處理之後才加進來的 manifest 連結。CSP 的 `img-src` 本來就允許 `data:`。
- CSP 的 `script-src` 放行兩段 inline 腳本的 sha256（head 的 boot 腳本、`nav` 之後的殼層在地化腳本），首次繪製的 `<style>` 另有雜湊或規則；CI 檢查兩段腳本的雜湊與殼層一致（9.4）【待實測 V15】，細節見 [09 技術選擇](09-tech-stack.md)。

### 2.4 主題色、狀態列與啟動畫面

**已知的事實**

- Safari 26 起，一般分頁的工具列顏色改從 `html` 或 `body` 的背景取色，已有多方觀察。
- MDN BCD 註記「從 Safari 26 起 theme-color 只用於已安裝的 web app」，但這條註記只有社群測試當依據，沒有 Apple 或 WebKit 的官方聲明，事實核對標為 UNCLEAR。
- WebKit bug 305546（Safari 26.2 回歸，NEW）回報：只要頂部有 fixed 元素，狀態列就取用它的不透明背景色，theme-color 沒有作用；軟導覽之後狀態列還可能變成陰影。
- WebKit bug 301994：主畫面 App 從 iOS 26.1 起內容無法延伸到狀態列後方，`env(safe-area-inset-top)` 回傳 0；26.2 回報修好，但 2026-07 在 26.5.2、2026-08 在 iOS 27 public beta 又能重現，Apple 已重新開啟（rdar://184081721），最後修改 2026-10-15。
- Safari iOS 不用 manifest 產生啟動畫面（BCD 標示 `background_color` 不支援）。傳統做法是每種裝置尺寸各放一個 `apple-touch-startup-image`，但沒有找到 2025 到 2026 年 Apple 文件確認 iOS 26、27 仍是這套機制。

**做法**

1. 淺深兩個 `theme-color` meta 都保留（Chrome Android 會用，iOS 沒有壞處）。已決定（2026-10-21）：設定頁可以手動選擇外觀與深色風味，`theme-color` 有四個值（淺色 `#FCF8F0`、夜空 `#121018`、莓果 `#171018`、紅酒 `#181012`）；手動指定時 boot 腳本與設定頁把兩個 meta 的 `content` 都改成目前主題的值（16 第 7 節）。
2. 真正決定顏色的三個來源要一致：`html`／`body` 背景、頂部區域的背景、`theme-color`。頂部用 `padding-top: env(safe-area-inset-top)` 加上與 `body` 同色的實色區域，這樣不論狀態列是否透明、safe area 是否回傳 0，畫面都不會破。
3. 浮動 Tab bar 不貼齊螢幕底邊（離 safe area 至少 8px），避免被 Safari 當成取色來源；隱藏的覆蓋層用 `display: none`，不要只設 `visibility: hidden` 或 `opacity: 0`（細節見 07 第 6.6 節）。
4. **Android 啟動畫面**：由 `name`、`background_color` 與 512 圖示自動產生，確定要做。
5. **iOS 啟動畫面**：M0a 用 assets-generator 產生淺深兩套 `apple-touch-startup-image`，在 iOS 26 與 27 實機上確認是否生效。M0a 結果（2026-10-21，iOS 27 與 18.6 Simulator，實機待重測）：有效，但有三個條件。(a) 頁面必須有 `<meta name="apple-mobile-web-app-capable" content="yes">`，iOS 才會下載啟動圖，只靠 manifest 的 `display: standalone` 不夠（另加 `mobile-web-app-capable`，避免 Chromium 的棄用警告）；(b) 啟動圖在「加入主畫面」那一刻依 iPhone 系統當時的淺色或深色固定一張，之後切換系統外觀或網站自己的外觀設定都不會跟著變（WebKit bug 259328），網站的外觀設定也不會帶進新加入的 App，因為 Safari 的網站資料不會複製到 App；(c) `media` 條件不要測 `device-height`（WebKit bug 326500，iOS 27.0.1），只用寬度與像素比。實機（iOS 27）的「深色啟動圖失敗」在 2026-10-22 查明不是 bug：我的 iPhone 系統其實是淺色，Safari 分頁看起來是深色是因為網站自己的外觀設定選了深色；新加入的 App 從空的 localStorage 開始（V02 的儲存隔離），所以跟隨系統顯示淺色，iOS 也正確選了淺色啟動圖。結論兩條：測深色啟動圖要用「設定 › 螢幕顯示與亮度 › 深色」，不是網站的外觀設定；Safari 裡手動選的外觀不會帶進新加入的 App，App 第一次啟動一律跟隨系統，所以 App 內要提供外觀選項（16 第 7 節的設定頁已涵蓋），安裝教學可以提一句。系統切成深色後重新加入，實機（iOS 27）看到深色啟動圖，V05 淺色與深色都已通過（2026-10-22）。若無效或效果不佳，退路是不提供啟動圖，改由 HTML 內聯的單色背景加置中圖示（inline SVG）當作載入畫面，React 掛載後移除；這個載入畫面要固定尺寸，不能造成版面位移。
6. M0a 完成標準：Android 與 iPhone 實機安裝截圖，涵蓋主畫面圖示、啟動畫面、狀態列顏色，淺色與深色各一張【待實測 V05】。

來源：https://bugs.webkit.org/show_bug.cgi?id=301994 、https://bugs.webkit.org/show_bug.cgi?id=305546 、https://github.com/mdn/browser-compat-data/pull/28503 （查證日期 2026-10-20）

### 2.5 安裝提示（依平台）

| 平台 | 安裝機制 | LedgerLand 的介面 |
| --- | --- | --- |
| iPhone、iPad 的 Safari | 沒有一鍵安裝 API | 「加到主畫面」卡片，按下後開圖解教學（2.6） |
| iPhone 上的 Chrome、Edge 等 | 同為 WebKit，沒有安裝 API；iOS 16.4 起這些瀏覽器也能加入主畫面 | 顯示簡化的文字教學，並建議用 Safari 開啟最穩定；步驟需截圖確認（見文末建議新增） |
| Android Chrome、Samsung Internet、電腦 Chrome 與 Edge | `beforeinstallprompt`（Chrome 44 以上、Samsung Internet 5.0 以上） | 攔截事件後顯示自家的「安裝」按鈕，由使用者按下才呼叫 `prompt()` |
| Firefox（電腦與 Android） | 不支援 `beforeinstallprompt` | 不顯示安裝按鈕，「我的 › 安裝教學」頁（`/install/`，見 02 的頁面總表）提供通用文字說明 |
| 電腦 Safari | 沒有安裝 API | 不主動提示，安裝教學頁列出說明 |
| App 內建瀏覽器 | 無法安裝 | 不顯示安裝提示，改顯示「用 Safari 或 Chrome 開啟」橫幅（4.8） |
| 已經以 App 模式執行 | 不需要 | 完全不顯示 |

**顯示時機**

- 不在首次載入時跳出；不在課堂 QR 的落地頁跳出（QR 落地頁要直接進入內容，見 02）；不在作答中或實驗室步驟中跳出。
- 觸發點：第一次完成一個關卡、看到星星結算頁時，在結算頁下方顯示一張可關閉的卡片：「把會計樂園加到主畫面，開啟更快，進度也比較不容易被清除。」
- 記住選擇（存在 IndexedDB 的設定，暫定規則）：按「之後再說」後，至少再完成 3 個關卡且距離上次至少 7 天才再顯示；累計關閉 2 次後不再自動顯示，只保留「我的 › 安裝教學」入口（`/install/`）；按下安裝或偵測到 `appinstalled` 後永久不顯示。
- M2 簡易版（已決定 2026-10-23）：關閉一次就記住、不再自動顯示；只出現在首頁與章節頁；上面「3 個關卡、7 天、累計 2 次」的完整細則留到 M3 的完整安裝圖解一起做。M3 實作（2026-10-26）：完整圖解已做（2.6）；顯示時機仍是簡易版的規則（至少完成一關、不是第一次造訪、只在首頁與章節頁、關閉一次就不再自動顯示），「3 個關卡、7 天、累計 2 次」與結算頁下方的卡片沒有做：結算頁在作答頁裡，路由看不出來，地圖頁也不放安裝建議的提示條（17 第 3.4 節）。這個簡化不影響安裝，「我的 › 安裝教學」一直都在；要不要補細則等試用回饋再定。
- iOS 安裝建議的橫幅（M3 第 4 輪看圖驗收後）：說明一句「已經加入就從主畫面圖示開啟，進度存在那裡；還沒加入就看圖解。」，動作列是 secondary sm「匯出到 App」與 quiet sm 的「看圖解教學」（就地展開圖解）、「完整教學頁」、「之後再說」。

**Chromium 的實作**

```ts
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();               // 不讓瀏覽器自己跳
  deferred = e as BeforeInstallPromptEvent;
  installStore.setAvailable(true);  // 自家按鈕預設隱藏，事件觸發後才顯示
});

window.addEventListener('appinstalled', () => installStore.markInstalled());

export async function promptInstall() {
  if (!deferred) return 'unavailable' as const;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;                  // 每個事件只能 prompt 一次
  return outcome;
}
```

**安裝策略抽象**：安裝 UI 透過 `InstallStrategy` 介面取得目前可用的做法（`bip`、`ios-guide`、`text-guide`、`none`）。Chrome 的 Web Install API（`navigator.install()`）在 chromestatus 標示為 Chrome 158 桌面版、In development，Android 欄位為空，WebKit 立場為 Oppose；對 iPhone 學生沒有幫助，近期不投入，日後正式出貨時再加一個實作即可。

來源：https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/BeforeInstallPromptEvent.json 、https://web.dev/learn/pwa/installation-prompt 、https://chromestatus.com/feature/5183481574850560 （查證日期 2026-10-20）

### 2.6 iOS 圖解教學

iOS 26 的 Safari 分頁列有三種版面：Compact（預設，往下捲動時縮小）、Bottom、Top，在「設定 > App > Safari > 標籤頁」中切換。兩種主要差異在「分享」按鈕的位置，所以教學分兩套：

| 版面 | 步驟（暫定，需在 iOS 26 與 27 實機截圖確認） |
| --- | --- |
| Compact（預設） | 1. 點網址列旁的「⋯」（更多）。2. 點「分享」。3. 往下找到「加入主畫面」。4. 確認「以 Web App 打開」是開啟的。5. 點「加入」。 |
| Top 或 Bottom | 1. 點工具列上的「分享」按鈕。2. 點「加入主畫面」。3. 確認「以 Web App 打開」是開啟的。4. 點「加入」。 |

設計規則：

M3 實作（2026-10-25 到 26，`apps/web/src/features/install/`）：`/install/` 是寬版頁，最上面是「這台裝置的做法」一張卡（iOS「用 Safari 加入主畫面」、Chromium「用這個瀏覽器安裝」、其他瀏覽器「換個瀏覽器安裝」），下面是 iPhone 的完整做法（展開列，1024 以上預設展開）；首頁的 iOS 安裝建議橫幅也能就地展開同一份圖解。每一步是一張原創的 SVG 示意圖加一句說明（示意圖 96px，卡片內容 480px 以上放大到 120px；720px 以上的寬卡片改成步驟並排的方塊；文字放大 200% 的窄卡片改成圖在上、字在下）。Chromium 沒有安裝事件時是兩步（選單、確認）加「我已安裝」，有安裝事件時是一步加 primary「安裝」。iOS 的版本判斷用 Safari 的 `Version/`（Safari 的版本跟著 iOS 主版本走，沒有凍結）：26 以上給兩種分頁列版面讓使用者選，17、18 只用 Top／Bottom 那一套（E2E `glossary.spec.ts` 的「安裝圖解」三組）；沒有 `Version/` 的第三方瀏覽器 UA 讀到 OS 18 時可能是凍結值，交給使用者選。截圖與目前 iOS 介面是否一致還沒在實機確認（10 第 10 節完成標準，[M3 回報](../reports/m3.md) 第 7 節的實機清單）。

- 網頁偵測不到使用者的分頁列版面，所以教學頁上方放兩張小縮圖讓使用者自己選「我的 Safari 長這樣」，選擇記在設定裡（M3 實作是圖解上方的分段控制，選擇記在進度的 settings `installGuideLayout`）。
- 插圖為原創的簡化示意圖，不放 iOS 實機截圖（截圖含 Apple 的介面素材，見 07 第 12 節）；按鈕用 Phosphor 的圖示示意並附文字標籤。
- 教學文字與插圖放在 i18n 內容檔，iOS 改版時只要更新內容，不必改程式。
- 教學的第 0 步是「先把進度帶走」：按「匯出到 App」複製文字備份碼（同時提供存成備份檔，見 4.7），再開始加入主畫面。
- iOS 17 與 18 沒有「以 Web App 打開」開關（iOS 26 才有），而網頁無法可靠分辨 iOS 18 與 26（Safari 26 凍結了 UA 中的系統版本），所以這一步寫成「有『以 Web App 打開』就開啟，點『加入』。」（2026-10-25 M3 收尾改短：375 的步驟說明一行約 10 字，排成兩行），兩代都適用；iOS 17、18 的分頁列沒有 Compact 版面，使用者會自己選 Top／Bottom 那一套。
- 步驟依據的是第三方教學（其中一篇在 iOS 26.4 測試），事實核對標為 UNCERTAIN；另外，從 iOS 18 升級上來的裝置是否保留原本的 Bottom 或 Top 設定，目前沒有證據。M3 的「完整安裝圖解」以 M0a 的實機截圖為準（見文末建議新增）。

來源：https://9to5mac.com/2025/09/15/iphone-ios-26-safari-new-compact-design/ 、https://support.apple.com/guide/iphone/change-the-layout-ipha9ffea1a3/26/ios/26 、https://www.ithinkdiff.com/add-web-app-bookmark-iphone-home-screen-ios-26/ （查證日期 2026-10-20）

### 2.7 `isAppMode()` 與 `html[data-display]`

安裝提示要不要顯示、何時呼叫 `persist()`、要不要提示「從 Safari 匯入」、Safari 分頁的常駐提示、Tab bar 在分頁與 App 模式下的差異，全都取決於「目前是否以 App 模式執行」。所以只定義一個共用函式：

```ts
export function isAppMode(): boolean {
  const byMedia = window.matchMedia(
    '(display-mode: standalone), (display-mode: fullscreen)'
  ).matches;
  const byIOS = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return byMedia || byIOS;
}

// boot 腳本內，首次繪製前執行
document.documentElement.dataset.display = isAppMode() ? 'app' : 'browser';
```

**為什麼三者都要檢查：兩份事實核對的結論相反，兩邊依據都列出來**

兩種說法目前都沒有實機證據可以定案，本文件不把任何一方當成結論；iOS 26、27 上的實際結果以 M0a 實測為準【待實測 V01】。

| 說法 | 依據 | 來源 |
| --- | --- | --- |
| 說法一：有 manifest 且 `display: standalone` 的主畫面 App，在 iOS 上 `display-mode: standalone` 為 false、`fullscreen` 為 true | MDN BCD 把 safari_ios 的 standalone 標為部分實作並附此註記，引用 WebKit bug 264218（2023-11 開立，NEW） | factcheck_glass |
| 說法二：說法一的證據不足，有 manifest 時 `standalone` 很可能是 true | WebKit 原始碼 `MediaQueryFeatures.cpp` 直接把 manifest 的 `display` 值對應到 display-mode，2024-12 到 2026-10 沒改過；bug 250651 回報者實測 standalone 為 true；bug 264218 沒寫測試頁 manifest 的 display 值，測試頁已無法存取 | factcheck_pwa |

不論哪一種說法成立，`isAppMode()` 同時檢查 `standalone`、`fullscreen` 與 `navigator.standalone`，結果都會是 App 模式，所以判斷式不必等實測結果才能寫；實測只用來確認這個假設，並決定 debug 頁與文案要不要調整。

兩邊都同意的部分：依 WebKit 原始碼，頁面沒有 manifest 時很可能只會符合 `browser`（實機結果同樣列入 V01）。iOS 26 允許沒有 manifest 的網站也以 web app 開啟，所以 `navigator.standalone` 是必要的備援。另外 bug 250651 指出，從已安裝 App 以 `target=_blank` 開啟的頁面也可能被誤判為 standalone，因此 **App 模式下站內頁面一律不用 `target=_blank` 開啟**。

規則：

- 一定提供 manifest，並設 `display: standalone`。
- CSS 版面一律寫 `html[data-display='app']` 或 `html[data-display='browser']`，不直接寫 `@media (display-mode: ...)`，判斷邏輯只有一份。
- debug 頁分別列出四種 display-mode 的 `matches`、`navigator.standalone`、是否有 manifest，以及最後的判定結果。
- M0a 在 iOS 26 與 27 實機上各測三種情況：從 Safari 分頁開啟、從主畫面開啟（有 manifest）、從主畫面開啟一個不帶 manifest 的測試頁；結果記錄在 debug 頁與 M0a 報告【待實測 V01】。

來源：https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebCore/css/query/MediaQueryFeatures.cpp 、https://bugs.webkit.org/show_bug.cgi?id=250651 、https://bugs.webkit.org/show_bug.cgi?id=264218 （查證日期 2026-10-20）

---

## 3. 離線與更新

### 3.1 工具與策略

已決定（D5，2026-10-20）：不預先產生 HTML，框架採 React Router 8 data mode，SW 用 vite-plugin-pwa 產生。已決定（2026-10-20）：Service Worker 與 manifest 屬於 `apps/web`，不放進 `packages/`。

| 項目 | 做法 |
| --- | --- |
| SW 產生 | vite-plugin-pwa 2.0.0（2026-10-03，Node 20.19 以上，peer 支援 Vite 3 到 8）的 `generateSW` |
| 更新模式 | `registerType: 'prompt'`，React 用 `virtual:pwa-register/react` 的 `useRegisterSW` |
| SKIP_WAITING 監聽 | generateSW 在 `skipWaiting: false`（預設）時會自動內建 |
| 舊快取清理 | `cleanupOutdatedCaches: true` |
| 離線導覽 | `navigateFallback` 指向殼層 `index.html`；中文與 `/en/` 開頭的路徑都由同一份殼層回應，語系由網址決定 |
| SW 檔名 | 固定 `sw.js` |

未採用的分支：`react-router build` 之後用 workbox-build 7.4.1 的 `injectManifest`，自寫 SW 並用 `workbox-window` 監聽 `waiting`。這條路只有預先產生 HTML 時才需要（vite-plugin-pwa 沒有 React Router framework mode 的官方整合，issue #809 仍 open），D5 決定先不預先產生，所以不做（日後的注意事項見 3.5 節末）。

generateSW 的底層同樣是 Workbox：7.4.1 發布於 2026-05-04，近幾版以相依套件更新為主，維護節奏偏慢但仍持續發布新版本；SW 邏輯盡量只用 precaching、routing、strategies 這幾個常用模組。

要在 M0a 確認的坑：vite-plugin-pwa 的 issue #940（Vite 8 的 sharedConfigBuild 會產生多份 SW）在 2026-10-20 仍是 open。M0a 與之後的 CI 都要檢查建置產物裡只有一份 `sw.js`，而且 precache 清單完整。

設定草圖：

```ts
VitePWA({
  strategies: 'generateSW',
  registerType: 'prompt',
  injectRegister: false,          // 由 useRegisterSW 註冊
  filename: 'sw.js',              // 永遠不改
  scope: site.base,               // 與 manifest scope 同一份設定（'/'）
  manifest: buildManifest(site),  // 2.1 的欄位由同一份設定產生
  workbox: {
    cleanupOutdatedCaches: true,
    navigateFallback: `${site.base}index.html`, // 唯一的殼層，中文與 /en/ 共用
    navigateFallbackDenylist: [/^\/cdn-cgi\//],  // Cloudflare 保留的路徑一律走網路，不回傳殼層（8.3）
    globPatterns: ['**/*.{html,js,css,json,svg,png,webp}'],
  },
});
```

generateSW 只處理 precache、導覽 fallback 與明確設定的 `runtimeCaching`（目前只有 3.2 的安裝教學插圖等同源靜態檔，以 CacheFirst 快取）；其餘請求，包括 D7 的統計腳本與它送出的請求，直接走網路，離線時失敗就略過，不會被快取。`runtimeCaching` 的規則一律限定同源路徑，不寫萬用比對。

來源：https://vite-pwa-org.netlify.app/guide/service-worker-strategies-and-behaviors.html 、https://raw.githubusercontent.com/GoogleChrome/workbox/v7/packages/workbox-build/src/templates/sw-template.ts 、https://registry.npmjs.org/vite-plugin-pwa （查證日期 2026-10-20）

### 3.2 預先快取內容

| 資源 | 策略 | 說明 |
| --- | --- | --- |
| app shell（HTML、帶 hash 的 JS 與 CSS） | precache | 與 SW 版本一致 |
| 內容 JSON（題目、名詞、範本、章節、故事） | precache | build 時輸出帶 content hash 的檔名，例如 `content/zh-TW/ch_c5f8w2.8e41b7.json`，另加一份小型 `content-manifest.json`（含整數的 `contentVersion` 與各檔案路徑，格式見 [08 題庫管理](08-content-admin.md) 第 7.3 節）。核心課程的 zh-TW 與 en 都放進 precache，確保介面與內容版本一致，第一次安裝後即可完整離線 |
| 圖示 | precache | 使用 SVG 或 PNG，控制體積；Tab bar 的圖示直接內嵌在殼層 HTML（2.3） |
| QR 解碼器（D10(a)） | precache，動態載入 | 打包成獨立 chunk，只在打開掃描畫面時才 `import()`，不計入首次載入 JS；放進 precache，離線也能掃描站內 QR；體積計入 precache 預算（4.9） |
| 安裝教學插圖 | runtime CacheFirst | 第一次瀏覽安裝教學頁後快取（與 02 的頁面總表一致）；多數學生只看一次，不必占第一次安裝的流量。若全部是小型 SVG 且在預算內，可以改成 precache |
| 字型 | 無 | 使用系統字型，不下載字型檔（見 07 第 3 節） |
| 選讀的大型內容包（日後若有） | runtime CacheFirst | 檔名帶 hash，不會過期；設定頁提供「下載離線內容」 |
| 第三方資源 | 只有 D7 的統計 | 統計腳本與它送出的請求都不 precache、不進 runtime 快取，離線時直接略過（8.3）；除此之外不使用任何第三方資源，CSP 只為統計服務加上必要的網域（見 09） |

規則：

- **第一次啟動要上線完成快取才能離線**（M0a 實機發現，2026-10-22）：新加入主畫面的 App 有自己的儲存（V02），第一次啟動時才在背景下載 precache；加入後馬上關掉再離線開啟，會看到 Safari 的「未連接網際網路」頁。Simulator 重現：加入後約 1.5 秒就關掉，離線開啟就是錯誤頁；開一次開到快取完成，離線就正常。原本決定用 vite-plugin-pwa 的 `offlineReady` 顯示一次性提示「已經可以離線使用了。」；已改決定（2026-10-23，使用者覺得這則提示干擾又沒有意義）：不顯示提示，離線就緒的狀態只在 debug 頁看得到；安裝教學與老師的課堂說明改成提醒「加入主畫面後先打開，停留幾秒再離線」。這也是課堂情境的風險：學生裝完就失去訊號時，App 還不能離線用。
- **課程內容不用 stale-while-revalidate**：會造成介面與內容版本混用，也會讓學生在同一堂課看到前後不同版本的題目。內容更新一律走 SW 更新流程（3.3）。
- Workbox v7 在 install 時，對帶 revision 的項目（例如 `index.html`）用 `cache: 'reload'` 繞過 HTTP 快取，hash 檔名的資源用 `'default'`。所以就算 HTTP 快取標頭設錯（例如 GitHub Pages 那種固定 `max-age=600` 的主機），precache 也不會抓到舊版；Cloudflare 上的快取標頭見 3.5 與 9.4。會變動但檔名不帶 hash 的檔案都要放進 precache 清單並帶 revision。
- **precache 體積預算**（暫定）：未壓縮總和不超過 5 MB，從 M0b 起由 CI 加總 precache manifest 並把關；QR 解碼器的 chunk 也算在內。若雙語內容讓總量超過預算，改成只 precache 目前介面語言，另一個語言包用 runtime CacheFirst，並在切換語言時提示下載（這會影響 05 的切換流程與離線切換語言，屆時回報）。雙語核心內容的實際大小在 M1 之後估算。已決定（2026-10-24，M3）：CI 的檢查值（`apps/web/perf/urls.json` 的 `precacheKb`）從 2048 提高到 3600，上限 5 MB 不變。內容擴到 14 章、雙語，名詞快照分成索引與分桶的完整內容、另加章節索引後 precache 實測 2793 KB（拆分前 2633 KB），取實測值加約 30% 的餘裕；名詞內容與章節快照一律留在 precache，不為了壓預算移出（離線整章可作答是 M2 與 M3 的完成標準），超過 5 MB 才改成只 precache 目前語言。原決定（2026-10-23）：CI 的檢查值從 1024 提高到 2048；M2 發布三章後 precache 約 1.1 MB（量測值 1094 KB）。
- 進度以「題目 id 加 rev」對應（見 [08 題庫管理](08-content-admin.md)），內容更新後進度不會錯位；錯題本遇到改版顯示「題目已更新」。
- 配額不是問題：WebKit（Safari 17 起）的瀏覽器 App 每個 origin 最多約占磁碟 60%，主畫面 App 相同；真正的風險是淘汰（4.5）。

來源：https://raw.githubusercontent.com/GoogleChrome/workbox/v7/packages/workbox-precaching/src/PrecacheController.ts 、https://developer.chrome.com/docs/workbox/caching-strategies-overview 、https://webkit.org/blog/14403/updates-to-storage-policy/ （查證日期 2026-10-20）

### 3.3 更新流程（prompt 模式）

**檢查更新的時機**

| 時機 | 做法 |
| --- | --- |
| App 啟動與換頁 | 導覽到 scope 內的頁面時，瀏覽器本身就會檢查更新；`updateViaCache` 預設 `'imports'`，主 SW 腳本更新時不經 HTTP 快取。SPA 的站內換頁不是真正的導覽，所以還需要下面兩列 |
| 回到前景 | `visibilitychange` 轉為 `visible` 時呼叫 `registration.update()`，30 分鐘節流 |
| 長時間使用 | 每小時一次 |
| 共同前置 | 先檢查 `navigator.onLine`，再以 `cache: 'no-store'` 抓一次 `sw.js` 確認伺服器可用，成功才呼叫 `update()`；註冊後 1 分鐘內不重複觸發（vite-plugin-pwa 文件提醒 workbox-window 可能判斷錯誤） |

iOS 主畫面 App 從背景回到前景時是否會自動觸發更新檢查，沒有找到官方資料，所以自己在 `visibilitychange` 補呼叫（見文末建議新增）。

**流程**

1. 新版 SW 安裝完成，進入 waiting，`needRefresh` 變成 true。
2. 判斷目前頁面能不能打擾：路由的 `handle` 標記 `blocksUpdatePrompt: true` 的頁面（作答頁、實驗室步驟頁、匯入流程）不顯示提示，只記下「有更新」。
3. 使用者回到列表類頁面（首頁、闖關地圖、章節頁、我的）時，顯示非強制的提示卡：「有新版本可以使用。你的進度已經存好，按『更新』就會重新載入。」這次更新若包含題目修正，再加一句「這次也修正了部分題目」。按鈕：「更新」「稍後」。
4. 按「更新」：先 `await` 把記憶體中的進度寫入 IndexedDB（作答本來就每答一題寫一次，這一步確保最後一筆也已寫入），再呼叫 `updateServiceWorker(true)`，由它送出 SKIP_WAITING 並重新載入。
5. 按「稍後」：下次回到列表頁或下次啟動再提示；所有分頁都關閉後，新版 SW 會自然啟用。
6. **絕不自動 `skipWaiting`**，也不在作答中重新載入。IndexedDB 的 `versionchange` 提示（4.3）與這個提示共用同一個時機與元件。

```ts
// vite-plugin-pwa（D5 已決定不預先產生 HTML，不需要另寫 workbox-window 的版本）
import { useRegisterSW } from 'virtual:pwa-register/react';

const HOUR = 60 * 60 * 1000;
const VISIBLE_THROTTLE = 30 * 60 * 1000;

export function useAppUpdate() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      if (!r) return;
      let lastCheck = Date.now();
      const check = async () => {
        if (!navigator.onLine) return;
        const res = await fetch(swUrl, { cache: 'no-store' }).catch(() => null);
        if (res?.status !== 200) return;
        lastCheck = Date.now();
        await r.update();
      };
      setInterval(check, HOUR);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && Date.now() - lastCheck > VISIBLE_THROTTLE) {
          void check();
        }
      });
    },
  });

  return {
    needRefresh,
    async apply() {
      await progress.flush();          // 先寫入進度
      await updateServiceWorker(true); // 送出 SKIP_WAITING 並重新載入
    },
  };
}
```

`useRegisterSW` 的 options 不是 reactive，只在第一次呈現時讀取，所以上面的邏輯放在 App 根部、只掛一次。

來源：https://vite-pwa-org.netlify.app/guide/prompt-for-update.html 、https://vite-pwa-org.netlify.app/guide/periodic-sw-updates.html 、https://developer.chrome.com/docs/workbox/handling-service-worker-updates （查證日期 2026-10-20）

### 3.4 `sw.js` 固定路徑與 kill-switch

- SW 路徑固定為站台 base 底下的 `sw.js`。base 為 `/`（D4），所以就是 `https://ledgerland.swift.moe/sw.js`，scope 為 `/`，同時涵蓋中文頁與 `/en/` 開頭的英文頁。日後若為了預先產生 HTML 改用 injectManifest，也沿用同一個檔名。
- CI 在部署前檢查建置產物一定有 `sw.js`，沒有就讓部署失敗。
- **為什麼絕不能刪檔或改名**：Safari 27.0 的修正清單有一項是讓 SW 在主腳本不存在時被解除註冊（原文：Fixed service worker registrations to be unregistered when the main script is missing），所以 iOS 27 使用者遇到 `sw.js` 消失，SW 與它的離線能力會被直接移除；而在 iOS 26 與 Chromium 上，`sw.js` 回 404 時更新失敗、舊 SW 繼續控制頁面，可能永遠停在舊版。兩種結果都不是我們要的。
- 要停用 SW 時，在同一個路徑部署 kill-switch 版本：

```js
// sw.js（kill-switch 版本，只在緊急停用或搬家時部署）
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    await self.registration.unregister();
    // 不強制重新載入開著的頁面：正在作答的人不會被打斷，下次導覽就直接走網路
  })());
});
```

kill-switch 只清 Cache Storage 與 SW 註冊，**不碰 IndexedDB**，學習進度會留下來。這是唯一允許 `skipWaiting` 的例外，因為它的目的就是盡快讓舊 SW 失效。

來源：https://webkit.org/blog/18325/webkit-features-for-safari-27-0/ 、https://web.dev/articles/service-worker-lifecycle （查證日期 2026-10-20）

### 3.5 Cloudflare Workers 的 SPA fallback、`_headers` 與預覽（D4、D5）

已決定（D4、D5，2026-10-20）：主機是 Cloudflare Workers Static Assets，深層連結以 SPA fallback 回 200；因為不預先產生 HTML，`index.html` 就是唯一的殼層，SPA fallback 回傳的正是它（本案沒有語言選擇頁，D5 也明文規定 fallback 必須回傳殼層）。

**SPA fallback 設定**（示意；資料夾結構見 [09 技術選擇](09-tech-stack.md) 第 8 節）。已決定（2026-10-20）：wrangler 設定不放在根目錄，而是 `apps/web/wrangler.jsonc`，每個要部署的 app 自己帶部署設定；`assets.directory` 相對於設定檔，改為 `"./dist"`（建置產物在 `apps/web/dist/`），其餘設定（`not_found_handling`、`html_handling`、自訂網域）不變，Worker 名稱維持 `ledgerland`：

```json
{
  "name": "ledgerland",
  "compatibility_date": "2026-10-01",
  "routes": [{ "pattern": "ledgerland.swift.moe", "custom_domain": true }],
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application",
    "html_handling": "auto-trailing-slash"
  }
}
```

1. **線上**：導覽請求沒有對應的靜態檔時，Cloudflare 回傳 `/index.html`，狀態碼 200。`/level/lv_k7m2q9xd/` 與 `/en/level/lv_k7m2q9xd/` 拿到的是同一份殼層，boot 腳本依網址把 `html lang` 設成 zh-TW 或 en（05）。
2. **離線**：SW 的 `navigateFallback` 回傳 precache 裡的同一份 `index.html`（3.1），線上與離線的行為一致。
3. **建置產物不放 `404.html`**，也不寫萬用字元的 `_redirects` 規則（`_redirects` 一律優先於既有檔案）。CI 檢查 `apps/web/wrangler.jsonc` 的 `not_found_handling` 是 `single-page-application`，而且 `index.html` 是殼層（含 `#root` 與靜態 Tab bar，沒有任何單一頁面的內容）。
4. **找不到的網址**：SPA 模式下，任何未知路徑也回 200 加殼層，由用戶端顯示 02 的「找不到頁面」，並在這一頁加上 `<meta name="robots" content="noindex">`，避免被當成正常頁面收錄。
5. **結尾斜線**：SPA fallback 回傳殼層時不會替缺少結尾斜線的路徑轉址，所以由用戶端路由以 replace 補上斜線；站內連結本來就一律帶結尾斜線（02）。
6. **非導覽請求**：舊頁面之後才載入、但新部署已經不存在的 chunk 或內容 JSON，Cloudflare 會回 404 還是殼層 HTML，M0a 以實際部署確認；不論結果如何，9.1 的包裝函式都檢查 `Content-Type` 並驗證 JSON，不只看狀態碼。

**`_headers`**（D4）：安全標頭與 CSP 的完整內容以 [09 技術選擇](09-tech-stack.md) 第 11 節為準；只有一份殼層，兩段 inline 腳本（head 的 boot 腳本、`nav` 之後的殼層在地化腳本）的雜湊固定，首次繪製的 `<style>` 另有雜湊或規則，所以完整的 CSP 可以直接放在 header（含 `frame-ancestors 'none'`）；D7 的統計服務網域在服務查證後也加在這裡。已決定（2026-10-20）：`_headers` 範本放在 `apps/web`。和本文件有關的部分：

```text
/*
  Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=(), usb=()

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/content/zh-TW/*
  Cache-Control: public, max-age=31536000, immutable

/content/en/*
  Cache-Control: public, max-age=31536000, immutable
```

- `Permissions-Policy` 必須允許本站使用相機（`camera=(self)`），App 內掃描課堂 QR 才能運作（D10(a)，4.9）；其餘權限一律關閉。
- 帶 hash 的 JS、CSS 與內容 JSON 設 immutable；`index.html`、`sw.js`、`manifest.webmanifest`、`content-manifest.json` 維持 Cloudflare 預設的 `public, max-age=0, must-revalidate`（9.4）。內容資料夾的規則依語系登錄檔產生，日後新增語系時一起加。

**PR 預覽**（D4）：每個 PR 的預覽網址是另一個 origin，資料一律視為測試資料，也不會和正式網站共用進度或 SW。預覽建置不載入統計腳本（8.3），並加上 `X-Robots-Tag: noindex`（`_headers` 依建置環境產生）；預覽網址任何人都能開啟（見 09），不放未公開的內容；QR 一律指向正式網域。M0a 的實機驗證可以先用這類 HTTPS 預覽網址。

**日後若加入預先產生 HTML（目前不做，V08 暫不需要）**：D5 留下「日後為加強搜尋收錄再評估」的空間。屆時要重新走一次 V08 的驗證，主要注意事項如下：

- React Router 8 framework mode（`ssr: false` 加 `prerender`）會另外輸出 `__spa-fallback.html` 當作通用殼層，根目錄的 `index.html` 會變成根路徑那一頁本身。Cloudflare 的 `single-page-application` 模式固定回傳 `/index.html`，就不能再用；要改用 `not_found_handling = "404-page"` 加上把 `__spa-fallback.html` 複製成 `404.html`、只對不 prerender 的路由前綴寫 200 改寫規則，或用 Worker 回傳 `env.ASSETS` 裡的 `__spa-fallback.html`（計入 Worker 請求額度），三者擇一。
- SW 要改成建置後用 workbox-build 的 injectManifest，自寫 `NavigationRoute(createHandlerBoundToURL('/__spa-fallback.html'), { denylist })`，並在 SW 裡自己監聽 SKIP_WAITING。
- 只 prerender 要讓搜尋引擎收錄的頁面：名詞約 375 筆（底稿約 300 筆）乘兩個語系，全部 prerender 會產生約 750 個 HTML 與同樣數量的 `.data`。
- precache 至少要包含 `**/*.html`、`**/*.data`（v8 對結尾帶斜線的路徑產生 `<path>/_.data`，例如 `/en/_.data`，根路徑是 `/_.data`）與 React Router 的 `manifest-*.js`（issue #809 回報會漏掉）；確認離線時沒有任何 `/__manifest` 請求；Lingui 外掛與 `reactRouter()` 共存【待實測 V09】。
- 每頁的 inline 腳本不同，CSP 改成逐頁注入 meta，header 只放與腳本、樣式無關的指令（見 09）。

來源：https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/ 、https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/ 、https://github.com/vite-pwa/vite-plugin-pwa/issues/809 （查證日期 2026-10-20）

---

## 4. 本機儲存

### 4.1 原則

- 主要儲存是 IndexedDB，透過 `idb` 的薄封裝存取；所有讀寫集中在進度模組，元件不直接碰資料庫。
- 已決定（2026-10-20）：進度資料模型（作答紀錄、關卡、星星、徽章、設定含 `labView`）、備份檔與文字備份碼的格式、匯入合併規則（4.6）、資料版本升級（migration，4.3）與儲存介面的定義放在 `packages/progress`（M2 建立，純 TypeScript，不碰 DOM）；IndexedDB 的實作（`idb` 的薄封裝、4.2 的 object store、4.3 的 `openDB`）放在 `apps/web`，實作這個儲存介面；元件與頁面只透過儲存介面讀寫。日後 App 的原生儲存實作放在 `apps/mobile`，同樣實作這個介面。本節描述的行為不因套件切分而改變。
- 進度資料只有 KB 等級，各平台都不會碰到配額；要防的是**淘汰、背景行程故障與使用者換裝置**。
- 首次繪製前就要用到的偏好分兩種：裝置偏好（外觀與深色風味 `ll:theme`、`ll:dark-flavor`，16 第 7 節；降低透明度與玻璃層級 `ll:transparency`；App 內的減少動態開關若採用也一樣）只存在 localStorage，每台裝置各自設定，不進 IndexedDB、不隨備份匯入（07 第 7.1 節）；學習設定（語系、計時等）以 IndexedDB 的 `settings` 為準，另外同步鏡像一份到 localStorage，讓 boot 腳本可以同步讀取。
- 每答一題就寫一次，不累積到離開頁面才寫。
- 不採用 OPFS：沒有資料顯示它比 IndexedDB 更不容易被淘汰，資料量也不需要它。

### 4.2 IndexedDB schema

資料庫名稱 `ledgerland`，版本號為整數，從 1 開始。這是 `apps/web` 的 IndexedDB 實作；各 store 存放的資料模型定義在 `packages/progress`（4.1）。

| object store | key | 主要欄位 | 索引 | 說明 |
| --- | --- | --- | --- | --- |
| `meta` | 固定 key | `deviceId`、`createdAt`、`dbSchemaVersion`、`appVersion`、`contentVersion`、`importHistory` | 無 | `deviceId` 第一次啟動時隨機產生，用於合併去重；`dbSchemaVersion` 是本機資料庫的版本，和 08 的內容 `schemaVersion` 是兩回事 |
| `attempts` | `attemptId` | `questionId`、`rev`、`chapterId`、`levelId`、`answer`、`correct`、`durationMs`、`answeredAt`、`deviceId`、`source`（play、lab、review）；選填 `score`（0 到 1，逐目標或逐格計分的題型用）與 `guessed`（答對後按「我是猜的」，2026-10-23 補） | `byQuestion`（questionId）、`byQuestionRev`（questionId、rev）、`byTime`（answeredAt） | 只增不改，是合併的基礎；`answer` 的格式依題型而定（見下表） |
| `levelProgress` | `levelId` | `stars`（0 到 3）、`bestScore`、`firstCompletedAt`、`lastPlayedAt` | 無 | 由 attempts 推導，但另存以加速列表 |
| `reviewQueue` | `questionId` | `rev`、`lastResult`、`lastAnsweredAt`、`box`、`dueAt`（本地日期 `YYYY-MM-DD`，不帶時間與時區，2026-10-23 定案）、`wrongCount`、`status`（active、mastered、question_updated） | `byDue`（dueAt） | 錯題本與簡易間隔複習 |
| `unlocks` | `id`（例如 `term:<名詞 ID>`、`badge:<徽章 ID>`） | `kind`、`unlockedAt` | 無 | 名詞圖鑑與徽章 |
| `labState` | `storyId` | `stepId`（故事模式目前所在的步驟）、`updatedAt` | 無 | 故事模式的進度；自由實驗的修改不放這裡，存在 `labSandbox` |
| `labSandbox` | `id`（目前固定為 `sandbox-default`，自由實驗只存一份） | `basedOn`（`{ story, storyRev, throughStep }`）、`policy`、`layout`、`overrides`（`{ stepId, eventId, param, value }` 的陣列，即 04 第 9.2 節的 `(stepId, eventId, param)` 覆寫）、`inserted`（新增的步驟，用 `local_` 開頭的本機 ID）、`removed`（刪除的步驟）、`updatedAt` | 無 | 自由實驗的狀態，形狀與 [03 模組設計](03-modules.md) 第 3.7 節的範例相同，欄位以 03 為準；只存修改，不存報表 |
| `settings` | `key` | `value`、`updatedAt` | 無 | 語系、計時、安裝提示狀態、備份提醒狀態、實驗室檢視偏好（`labView`：教材或 IFRS 對照、累計或本筆變動、選擇的表、分錄層展開狀態，D10(f)、D1）等；納入備份（4.6） |
| `errors` | 自動遞增 | `at`、`route`、`message`、`stack`（截斷）、`appVersion`、`contentVersion` | 無 | 環狀保留最近 50 筆（第 9 節） |
| `snapshots` | 自動遞增 | `fromVersion`、`createdAt`、`payload` | 無 | 需要轉換資料格式的 migration 先把舊資料存一份，保留到下一個 schema 版本 |

**`attempts.answer` 的格式（依題型）**：欄位與題型代號依 04 第 16.2 節；正式型別以 `packages/content-schema` 的 Zod schema 為準，M2 與作答元件一起定案。

| 題型 | `answer` 的形狀 | 範例 |
| --- | --- | --- |
| `single_choice`、`pick_statement`、`ratio_interpret`、`judgment` | 選中的選項 ID（字串） | `"o_b8k2"` |
| `multi_choice` | 選項 ID 陣列；`any_correct` 只有一個元素，`all_correct` 依 ID 排序（03 第 2.12 節） | `["o_2k7m", "o_8p3w"]` |
| `true_false` | 布林值，選「對」為 `true` | `true` |
| `pick_line` | 選中的版面列 ID（字串） | `"is_gross_profit"` |
| `classify` | 以項目 ID 為鍵、所選分類為值的物件 | `{ "it_4k2m": "asset", "it_9p3x": "expense" }` |
| `transaction_effect` | 以 target ID 為鍵的物件（03 的 `PredictionAnswer`）：方向目標存方向代號，金額目標存數字 | `{ "t1": "up", "t2": "down", "t3": 210000 }` |
| `five_step_fill` | 以開放格子的線 ID 為鍵的物件（`openCells` 的版面列 ID），值是輸入的數字（2026-10-23 定案） | `{ "is_gross_profit": 90000, "bs_cash": 210000 }` |
| `ratio_numeric` | 04 `scoreNumeric` 的輸入 `NumericAnswer`（數值，或按下 N/A 的狀態） | 依 04 |
| `journal_entry` | 04 `scoreJournalEntry` 的輸入 `EntryLine[][]`（每筆分錄的各行） | 依 04 |

**實驗室檢視偏好**（`settings` 的 `labView`，欄位名稱暫定）：實驗室共用的檢視設定（02 第 5.1 節、03 的 D10(f) 切換規則），形狀為 `{ policy, window, statement, journalLayerOpen }`：`policy` 是 `teacher@1` 或 `ifrs@1`（教材或 IFRS 對照），`window` 是 `cumulative` 或 `transaction`（累計或本筆變動），`statement` 是分段控制選到的表（`is`、`bs`、`cf`），`journalLayerOpen` 是分錄層的展開狀態。它只記錄檢視方式，不改變帳本與自由實驗的 `policy`、`layout`（`labSandbox` 維持 `teacher@1`）；讀不到時的預設值與「從 labRef 開啟時先用教材口徑」等沿用規則以 02 與 03 為準。

學習內容 ID（`ch_`、`lv_`、`q_`、`tm_`、`story_`、`st_`、`o_` 等前綴加 Crockford Base32 小寫字串）的格式、長度與產生方式依 [08 題庫管理](08-content-admin.md) 第 4.1 節；科目、指標等核心詞彙的語意 ID 見 [04 會計核心](04-accounting-core.md)。

### 4.3 migration 與多分頁

下面的 `openDB` 封裝屬於 `apps/web` 的 IndexedDB 實作；資料版本升級的規則定義在 `packages/progress`（4.1），匯入舊版備份時在記憶體中跑的也是同一套（4.6 匯入驗證第 3 步）。

```ts
import { openDB } from 'idb';

const CURRENT = 3;
const migrations: Record<number, Migration> = {
  1: createV1Stores,
  2: addReviewQueueDueIndex,
  3: moveTimerSettingIntoSettingsStore, // 會轉換資料：先寫入 snapshots
};

export function openProgressDB() {
  return openDB('ledgerland', CURRENT, {
    upgrade(db, oldVersion, _newVersion, tx) {
      for (let v = oldVersion + 1; v <= CURRENT; v++) migrations[v](db, tx);
    },
    blocked() {
      // 新版要升級，但其他分頁還開著舊連線
      ui.showBanner('closeOtherTabs');
    },
    blocking() {
      // 本分頁是舊版，其他分頁要升級
      void progress.flushThenClose(); // 先寫入、再關閉連線，讓升級可以進行
      ui.showBanner('reloadToKeepSaving');
    },
    terminated() {
      // 連線被意外關閉（例如 iOS 的 IndexedDB server lost）
      void progress.reopenOrDegrade();
    },
  });
}
```

規則：

- migration 只能往前、可重複執行不出錯；同一個版本內不刪除任何使用者資料。
- 每個舊版本都有一份 fixture 資料庫，Vitest 用 fake-indexeddb 測試「從任何舊版本升級到最新版」。
- **blocked**：顯示「請關閉其他 LedgerLand 分頁，再重新整理」。
- **blocking（收到 versionchange 的舊分頁）**：先寫入進度、關閉連線，立刻顯示橫幅「網站已在其他分頁更新，重新整理後才能繼續儲存進度」。關閉連線之後若使用者又答了題，答案暫存在 localStorage 的 `ll:pending`，重新整理後合併寫入。這個橫幅和 SW 更新提示共用元件；但因為這時已經不能儲存，它不等回到列表頁才顯示。
- **快速跳頁的補強**（M3 第一件事，2026-10-24，M2 回報第 7 節第 6 點）：每一筆寫入在開交易之前先同步排進 `ll:pending`，交易 complete 之後才移除，所以作答後馬上整頁跳轉、`pagehide`、`visibilitychange` 轉 hidden 之後被系統回收時，那一筆仍在佇列，下次啟動由 `replayPending` 依序補寫（`apps/web/src/lib/progress/pending.ts`，`apps/web/test/pending.test.ts`）。重放的每一種操作都是冪等的；重放前先比對新舊（星星與分數取大、設定比 `updatedAt`、錯題本比 rev 與作答時間、刪除比排入時間），資料庫已有較新的值時不蓋回舊值；還活著的分頁正在寫的項目用 Web Locks 標記，不重放。已知的取捨：刪除不留紀錄，所以「舊的錯題本寫入在使用者從另一個分頁手動移除之後才重放」仍會把那一題救回錯題本（只在排入的分頁於交易完成前被關閉時發生）。
- Safari 27.0 修正了多個 IndexedDB 問題（worker 連線在 network process 當機後恢復、transaction 長時間被阻塞、`onupgradeneeded` 中 abort 後回傳 version 0 的資料庫）；還停在 iOS 26，以及 D8 正式支援的 iOS 17、18 的使用者仍可能遇到，所以下面的防禦都要做。

來源：https://webkit.org/blog/18325/webkit-features-for-safari-27-0/ 、https://bugs.webkit.org/show_bug.cgi?id=273827 （查證日期 2026-10-20）

### 4.4 錯誤與降級

| 錯誤 | 偵測 | 處理 |
| --- | --- | --- |
| `QuotaExceededError` | 寫入時的例外 | 顯示「儲存空間不足」提示與「立即匯出」按鈕；清理過期的內容快取後重試一次 |
| `UnknownError`、`InvalidStateError`、連線中斷 | 例外或 `terminated` | 重開連線並重試一次；仍失敗就把精簡快照（各關星星、錯題本、解鎖）寫入 localStorage，並提示立即匯出 |
| IndexedDB 完全無法開啟 | `openDB` 失敗 | 以記憶體模式繼續學習，頂部常駐提示「這台裝置目前無法儲存進度，請匯出備份」 |
| 匯入檔損壞或版本太新 | 驗證失敗 | 見 4.6 |

iOS 17.4 曾有「Connection to Indexed Database server lost」的回歸（bug 273827），Apple 表示已在 iOS 17.6 與 18 透過系統修正，但之後仍有零星回報，有人要重開機才恢復。D8 決定正式支援 iOS 17，所以 iOS 17 的測試機盡量用 17.6 以上並在 debug 頁記錄系統版本（iOS 17 的 UA 仍帶真實版本，凍結是從 Safari 26 開始）；17.4、17.5 的使用者遇到連線中斷且重試失敗時，提示文字加一句「更新 iOS 可能會改善」。localStorage 快照只能防 IndexedDB 背景行程故障，**防不了** ITP 清除或淘汰（兩者同屬 script 寫入的儲存）；它是否真能防行程故障也屬推論，需實測。

### 4.5 清除規則與 `persist()` 的正確說法

這一節的文字會直接影響產品文案，所以每一句都要精確：

- **ITP 的 7 天規則**：在 Safari 中，只要「防止跨網站追蹤」是開啟的（預設開啟），網站若在 **7 個 Safari 使用日**內都沒有使用者互動，所有 script 寫入的儲存（IndexedDB、localStorage、sessionStorage、SW 註冊與 Cache）都會被刪除；伺服器設定的 cookie 不受影響。注意是「使用日」，不是日曆天：學生放寒暑假期間若照常用 Safari 但沒開 LedgerLand，就會累計。
- **主畫面 App 的豁免**：只出自 WebKit 2020 年的官方文章，說主畫面 web app 不屬於 Safari，有自己的使用日計數，WebKit「不預期」它的第一方資料被刪除。MDN（2026-01-05）仍記載 Safari 的主動淘汰規則，卻沒有提到這項豁免；iOS 26、27 也沒有官方重申。只能當作「2020 年官方說法，未見更新」。
- **`persist()`**：Safari 15.2 起支援 `persist()` 與 `persisted()`，Safari 17 起支援 `estimate()`。Safari 依啟發式自動決定是否授予（WebKit 舉的例子是是否以主畫面 web app 開啟），不保證授予。WebKit 2023 年的原文是 persistent mode 的 origin「might be excluded」於淘汰，而且沒有說明適用哪一種淘汰條件，所以**不能**把 `persist()` 當成可以免除 ITP 刪除的保證。Chrome 依互動程度自動決定、不跳提示；Firefox 會跳權限提示。
- **其他瀏覽器的配額**：Chrome 每個 origin 最多約磁碟 60%；Firefox best-effort 取磁碟 10% 與 10 GiB 群組上限的較小者。

**產品文案只能寫**：「加到主畫面，可以降低進度被清除的機率；定期匯出備份最保險。」設定頁「保護我的進度」按鈕旁的說明也只能寫「降低機率」。不得寫「安裝後就不會被刪」。`persist()` 的實際結果，以及它是否影響 7 個使用日的清除規則【待實測 V04】。

**`persist()` 的呼叫流程**（已決定 D10(a)，2026-10-20，見「已決定的項目」決定一；M2 實作）：

| 觸發點 | 什麼時候 | 哪些環境 |
| --- | --- | --- |
| `launch` | 每次啟動，`isAppMode()` 為 true 且 `persisted()` 仍為 false 時 | 主畫面 App（iOS、Android、電腦的已安裝 Chromium App） |
| `first-level-complete` | 第一次完成一個關卡、進入結算頁時，只觸發一次 | Safari 分頁、Chrome 等一般分頁與 App 模式；Firefox 與 App 內建瀏覽器除外 |
| `settings-button` | 使用者在設定頁按「保護我的進度」 | Firefox 的唯一入口；其他瀏覽器在 `persisted()` 為 false 時也顯示，當作手動重試；App 內建瀏覽器不顯示。被拒時不能只說「沒有同意」就停住（2026-10-27）：一般分頁被拒的下一步是加到主畫面、從主畫面開啟再按一次，結果旁附「看安裝教學」的按鈕；已是主畫面 App 仍被拒才只剩定期備份。狀態每次進設定頁與切回分頁時都重新問 `persisted()`（主畫面 App 與分頁的儲存是分開的，移除 App 後分頁顯示的是分頁自己的狀態） |

```ts
type PersistTrigger = 'launch' | 'first-level-complete' | 'settings-button';

export async function maybePersist(trigger: PersistTrigger) {
  if (!navigator.storage?.persist) return 'unsupported' as const;
  if (isInAppBrowser()) return 'skipped' as const;              // 4.8：內建瀏覽器一律不呼叫
  if (await navigator.storage.persisted()) return 'already' as const;
  if (isGeckoFirefox() && trigger !== 'settings-button') return 'skipped' as const; // Firefox 會跳權限提示
  if (trigger === 'launch' && !isAppMode()) return 'skipped' as const;
  const granted = await navigator.storage.persist();
  await settings.set('persistResult', { granted, trigger, at: new Date().toISOString() });
  return granted ? ('granted' as const) : ('denied' as const);
}
```

- `isGeckoFirefox()` 只認 Gecko 引擎的 Firefox（電腦與 Android）；iPhone 上的 Firefox 是 WebKit（UA 含 `FxiOS`），比照 Safari。
- 結果寫進設定，「我的 › 備份」（`/me/backup/`）與 debug 頁顯示「觸發來源、是否取得、時間」與 `estimate()` 的用量；沒有取得時套用下面較頻繁的備份提醒。

**備份提醒**（暫定預設）：沒有取得 persistent 時，每完成 3 個關卡或距離上次匯出 7 天（先到者）提醒一次；在 Safari 分頁與 App 內建瀏覽器中，每完成 1 個關卡就提醒。已決定（2026-10-23）：提醒顯示時把設定裡的 `levelsCompletedSinceExport` 歸零並寫入 `lastRemindedAt`，所以同一個條件不會連續出現；匯出成功時同樣歸零。

來源：https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/ 、https://webkit.org/blog/14403/updates-to-storage-policy/ 、https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria （查證日期 2026-10-20）

### 4.6 匯出與匯入

已決定（D10(a)，2026-10-20）：M2 同時提供**備份檔**與**文字備份碼**兩種形式，匯入預設「合併」，「覆蓋」放在進階選項（取捨見「已決定的項目」決定二）。以下是兩種形式共用的格式與規則；已決定（2026-10-20）：備份檔與文字備份碼的格式、匯入合併規則定義在 `packages/progress`（4.1），寫入裝置由 `apps/web` 的 IndexedDB 實作執行。

**備份檔格式**（`formatVersion` 1；內容 ID 依 08 第 4.1 節的格式「前綴加 Crockford Base32 小寫」，數值與日期為示意；`labSandbox` 的形狀同 03 第 3.7 節，`tpl.borrow_short_term` 沿用 03 的示意範本 ID，正式名稱以 04 的範本清單為準；`attempts` 的那一筆是 07 第 9.1 節示意的 `all_correct` 多正解題，只勾了一個選項，`answer` 的格式見 4.2）：

```json
{
  "format": "ledgerland-backup",
  "formatVersion": 1,
  "dbSchemaVersion": 3,
  "app": { "version": "0.3.0", "contentVersion": 12 },
  "origin": "https://ledgerland.swift.moe",
  "deviceId": "d_9k2m7q4x",
  "mode": "browser",
  "exportedAt": "2026-11-05T09:30:00.000Z",
  "data": {
    "attempts": [
      {
        "attemptId": "a_01j9z8k2",
        "questionId": "q_7f3k2m9x",
        "rev": 2,
        "answer": ["o_b8k2"],
        "correct": false,
        "answeredAt": "2026-11-04T13:05:12.000Z",
        "deviceId": "d_9k2m7q4x",
        "source": "play"
      }
    ],
    "levelProgress": [
      { "levelId": "lv_k7m2q9xd", "stars": 2, "bestScore": 0.8, "firstCompletedAt": "2026-11-03T08:00:00.000Z", "lastPlayedAt": "2026-11-04T13:06:00.000Z" }
    ],
    "reviewQueue": [
      { "questionId": "q_7f3k2m9x", "rev": 2, "lastResult": "wrong", "lastAnsweredAt": "2026-11-04T13:05:12.000Z", "box": 1, "dueAt": "2026-11-05", "wrongCount": 1, "status": "active" }
    ],
    "unlocks": [
      { "id": "term:tm_c4sh8k2p", "kind": "term", "unlockedAt": "2026-11-03T08:01:00.000Z" }
    ],
    "labState": [
      { "storyId": "story_k8p3x6", "stepId": "st_r2x9k4", "updatedAt": "2026-11-04T12:00:00.000Z" }
    ],
    "labSandbox": [
      {
        "id": "sandbox-default",
        "basedOn": { "story": "story_k8p3x6", "storyRev": 1, "throughStep": "st_r2x9k4" },
        "policy": "teacher@1",
        "layout": "teacher@1",
        "overrides": [
          { "stepId": "st_m6t3w8", "eventId": "e1", "param": "amount", "value": 120000 }
        ],
        "inserted": [
          {
            "id": "local_1",
            "after": "st_r2x9k4",
            "events": [{ "id": "e1", "template": "tpl.borrow_short_term", "params": { "amount": 80000 } }]
          }
        ],
        "removed": [],
        "updatedAt": "2026-11-04T12:20:00.000Z"
      }
    ],
    "settings": {
      "locale": "zh-TW",
      "timerEnabled": false,
      "labView": { "policy": "teacher@1", "window": "cumulative", "statement": "bs", "journalLayerOpen": false }
    }
  },
  "errors": [],
  "checksum": "sha256-PLACEHOLDER"
}
```

- 檔名：`ledgerland-backup-YYYYMMDD.json`。
- **文字備份碼**（介面上稱「備份碼」）：`LL1:` 前綴加上壓縮後的 base64url 字串，內容與備份檔相同，`checksum` 用來發現貼錯或截斷。已決定（2026-10-23）：壓縮用瀏覽器內建 CompressionStream 的 `deflate-raw`（iOS 16.4 起支援，涵蓋 D8 的 iOS 17），`LL1:` 後接 base64url，上限 8000 字元；格式與上限定義在 `packages/progress`，壓縮與 SHA-256 由 `apps/web` 注入。超過上限時畫面建議改用備份檔（實機轉移見【待實測 V21】）。原本的寫法（壓縮方式與上限在 M2 依實際大小訂定）保留作為紀錄。
- 匯出畫面兩個按鈕並列：「存成備份檔」（分享表單或下載）與「複製備份碼」（`navigator.clipboard.writeText`，需由使用者點按觸發）；匯入畫面同樣有「選擇備份檔」與「貼上備份碼」。
- `errors` 預設為空陣列，只有使用者在匯出畫面勾選「附上錯誤紀錄」時才填入。
- `origin` 與 `mode` 用來辨識來源（例如「這份來自 Safari 分頁」），也用於搬家流程（第 5 節）。`mode` 的值是 `browser`（一般分頁）、`app`（主畫面 App）、`in-app-browser`（App 內建瀏覽器）（2026-10-23 定案）。
- 進度不放進網址參數或片段：會留在瀏覽紀錄，長度也有限。

**匯入驗證**（依序，任何一步失敗就停止並說明原因）：

1. `format` 與 `formatVersion` 正確。
2. `checksum` 相符（偵測截斷或貼錯）。
3. `dbSchemaVersion` 比 App 新：拒絕，提示「請先更新網站再匯入」；比 App 舊：在記憶體中跑同一套 migration。題目的 `rev` 與目前內容不同時照常匯入，錯題本依 08 的規則顯示「題目已更新」。
4. 用 Zod schema 驗證所有欄位（與 08 共用驗證工具）；檔案大小上限暫定 5 MB。
5. 顯示預覽摘要：「將匯入 128 筆作答紀錄、12 個關卡的星星、5 個徽章」，使用者確認後才寫入。
6. 所有文字欄位一律當純文字顯示，不執行、不轉成 HTML。

**合併規則**（預設「合併」；「覆蓋」放在進階選項）：

| 資料 | 合併規則 | 說明 |
| --- | --- | --- |
| 作答紀錄 `attempts` | 依（題目 id、rev、作答時間、deviceId）取聯集，完全相同的去重 | 兩邊各自累積的紀錄都保留 |
| 關卡星星 `levelProgress.stars` | 取最大值 | `bestScore` 取最大值，`firstCompletedAt` 取最早，`lastPlayedAt` 取最晚 |
| 錯題本 `reviewQueue` | 同一題以最後一次作答結果為準；rev 不同時保留較高的 rev | `wrongCount` 由合併後的 attempts 重新計算 |
| 徽章與名詞解鎖 `unlocks` | 取聯集，`unlockedAt` 取最早 | 只會變多 |
| 實驗室進度 `labState` | 同一個故事取 `updatedAt` 較晚的一筆 | |
| 自由實驗 `labSandbox` | 同一個 `id` 整筆取 `updatedAt` 較晚的一筆；`overrides`、`inserted`、`removed` 不逐項合併 | 三者互相依賴（例如插入的步驟接在某個被改過的步驟之後），逐項合併可能組出違反餘額規則的帳本，所以整筆取代 |
| 設定 `settings` | 預設不匯入；匯入畫面可勾選「也套用語言與計時設定」 | 實驗室檢視偏好（`labView`）也在備份檔的 `settings` 裡，同樣依這一列的規則；降低透明度、玻璃層級等裝置偏好永遠不匯入 |
| 錯誤紀錄 `errors` | 不匯入 | 只用於回報問題 |
| `meta.deviceId` | 保留本機的值 | 來源的 deviceId 與時間記在 `meta.importHistory` |

**覆蓋**（進階選項）：除了設定之外全部取代。執行前自動匯出一份目前的進度（存成備份檔或複製備份碼），並要求再確認一次。

### 4.7 Safari 分頁與主畫面 App 的隔離與轉移流程

**已知的事實**：WebKit bug 181849 至今仍是 NEW；WebKit 工程師在 2022-02-01 留言說目前的行為「by design」，兩者是「isolated entities without shared state」。之後沒有新留言，也查不到 iOS 26、27 的官方更新，所以「iOS 26、27 仍然隔離」既沒有被推翻、也沒有被證實【待實測 V02】。另外，iOS 不支援 manifest 的 `launch_handler`，沒有資料顯示 iOS 26、27 支援 link capturing；用 iPhone 相機掃課堂 QR，連結很可能開在 Safari 分頁，而不是已安裝的 App【待實測 V03】。結果是學生可能在兩個地方各累積一份進度。

**轉移流程**

1. 學生在 Safari 分頁完成第一個關卡，看到安裝卡片。圖解教學的第 0 步是「先按『匯出到 App』」：複製文字備份碼到剪貼簿（同時提供「存成備份檔」）。
2. 學生依圖解加入主畫面；教學最後一步提醒「從主畫面打開後，貼上剛剛複製的備份碼」（存成檔案的人改成「選擇剛剛存的備份檔」）。
3. 主畫面 App 第一次啟動：偵測到 `isAppMode()` 為 true 且資料庫是空的，主動詢問「要從 Safari 匯入進度嗎？」，選項為「貼上備份碼」「選擇備份檔」「從頭開始」；匯入一律預設合併。
4. iOS 的 Safari 分頁一律顯示一條精簡的常駐提示（可收合成小圖示，但不能永久關閉）。2026-10-27 起改成引導加到主畫面（維護者在手機上的提議）：標題「把會計樂園加到主畫面」，內文「Safari 分頁的進度可能被清掉。加到主畫面後開啟更快，進度也比較不容易被清除；已經加入的話，請從主畫面的圖示開啟。」主要動作「看安裝教學」連到安裝教學頁，「匯出到 App」退成次要；學生在教學頁按過「我已加入主畫面」後，Safari 這一側記下旗標，提示改成「請從主畫面開啟會計樂園」加完整說明、主要動作換回「匯出到 App」。安裝教學頁本身不顯示這條；地圖頁的單行提示條「加到主畫面，進度才不會消失」的「詳細」也連到安裝教學。原本的文字：「如果你已經加入主畫面，請從主畫面圖示開啟，進度存在那裡。」旁邊是「匯出到 App」捷徑。
5. 課堂 QR 開在 Safari 分頁時：落地頁照樣直接進入內容（不擋、不跳安裝提示），只多一條上述提示。因為合併規則是聯集，學生之後隨時可以再把 Safari 這一側的紀錄匯入 App，不會覆蓋掉任何一邊。
6. 已決定（D10(a)，2026-10-20）：每個關卡在介紹畫面顯示短的「關卡代號」，闖關地圖提供「輸入關卡代號」入口，App 內另有「掃描課堂 QR」，讓已安裝的學生不必經過 Safari 就能進到老師指定的關卡（4.9）。

若 V02 實測結果是兩邊共享儲存，就移除第 3 到 5 步，只保留一般的匯出功能；關卡代號與 App 內掃描仍保留（不必離開 App，老師也能不投影 QR 就指定關卡）。

**V02 的實測方法**（寫在 debug 頁）：在 Safari 分頁按「寫入測試標記」，分別寫入 IndexedDB、localStorage 與 Cache Storage 一筆帶時間的標記；再從主畫面 App 開啟 debug 頁，看三處能否讀到；反向再做一次。iOS 26 與 27 各測一次。

來源：https://bugs.webkit.org/show_bug.cgi?id=181849 、https://raw.githubusercontent.com/mdn/browser-compat-data/main/manifests/webapp/launch_handler.json 、https://wwdcnotes.com/notes/wwdc23/10120 （查證日期 2026-10-20）

### 4.8 App 內建瀏覽器與相機的網頁面板

相機的網頁面板（iPhone 相機掃 QR 後開啟的面板）是第三種獨立而且暫存的情境：儲存與 Safari、主畫面 App 分開，配額 1 GB，關閉就清空。處理方式見「已決定的項目」決定五的 M0a 實測補充（偵測配額低於 1.5 GB 顯示暫存提示卡）；提示卡與 App 內建瀏覽器的橫幅不同時出現，暫存提示優先。

台灣老師常在 LINE 群組貼連結，學生會直接在 LINE 的內建瀏覽器開啟。在 iOS 上，這是 LINE 自己的 WKWebView：網站資料與 Safari、主畫面 App 很可能是分開的，也不能加入主畫面；第三方 App 的 WKWebView 能不能註冊 SW 有限制（一般需要 App-Bound Domains），離線與更新流程可能完全失效，進度也可能隨 App 清除快取而消失。這些都還沒實測【待實測 V11】。在 Android 上，這類瀏覽器（WebView 119 以上）有 `navigator.userAgentData`，brands 含 Chromium，會影響 07 的折射閘門。

做法：

1. 用 UA 偵測常見的內建瀏覽器（`Line/`、`FBAN`、`FBAV`、`Instagram`），清單集中在一個設定檔，方便擴充。
2. 顯示常駐但可收合的橫幅：「你正在 LINE 裡開啟。改用 Safari 或 Chrome，進度比較不會消失，也能離線使用。」附「複製連結」按鈕。不阻擋學習。
3. 偵測到內建瀏覽器時：不顯示安裝提示、不呼叫 `persist()`、不顯示 App 內掃描課堂 QR（這些 App 多半有自己的掃描器，WKWebView 的相機權限也未驗證）、每完成 1 個關卡就提醒匯出；「輸入關卡代號」照常提供。
4. 給老師分享用的連結要不要加 LINE 的開啟外部瀏覽器參數，先查證現行行為再決定（見文末建議新增）；課堂用的 QR code 一律指向一般網址。
5. 測試矩陣加入 iOS 與 Android 的 LINE 內建瀏覽器（第 10 節）。
6. Android 內建瀏覽器的玻璃層級：屬於「行動裝置」，折射預設關閉（見 07 第 5 節）。

### 4.9 關卡代號與 App 內掃描課堂 QR（D10(a)，M2）

已決定（D10(a)，2026-10-20）：關卡代號入口與 App 內相機掃描課堂 QR 都做，M2 實作；取捨見「已決定的項目」決定五。兩者都只是「帶學生進到指定頁面」，不讀寫任何進度，也不把掃到的內容存起來。

**關卡代號**

- 代號就是關卡 ID 去掉 `lv_` 前綴的 8 個字元（Crockford Base32 小寫，格式見 08 第 4.1 節）。關卡介紹畫面以等寬數字字型分兩組顯示，例如 `k7m2 q9xd`，320px 寬度下排得下；老師可以寫在黑板或投影片上。
- 闖關地圖（`/play/`，英文介面為 `/en/play/`）提供「輸入關卡代號」：輸入框用 `autocapitalize="off"`、`autocomplete="off"`、`spellcheck="false"`、`enterkeyhint="go"`，字級至少 16px（第 7 節）。
- 正規化：去掉空白與連字號、不分大小寫；依 Crockford 的規則把 `o` 當成 `0`、`i` 與 `l` 當成 `1`（ID 的字母表本來就不含這幾個字母，所以不會誤判）；含 `u` 或長度不是 8 時直接提示格式錯誤。
- 查詢 content-manifest 與各章節的關卡清單：找到就以目前的介面語言導覽到 `/level/lv_<代號>/` 或 `/en/level/lv_<代號>/`；是已下架的墓碑 ID 就顯示「這個關卡已經下架」並連到所屬章節（02 第 4.4 節）；不存在就顯示「找不到這個代號，請再確認一次」。全部在本機完成，離線也能用。

**App 內掃描課堂 QR**

- **入口**：首頁與闖關地圖的「掃描課堂 QR」按鈕，只在 `isAppMode()` 為 true、不是 App 內建瀏覽器，而且 `navigator.mediaDevices?.getUserMedia` 存在時顯示。Safari 分頁的學生直接用系統相機即可，不另外提供。
- **流程**：按下後先顯示一張說明卡：「接下來會請你允許使用相機。相機只用來辨識 QR，不會拍照，也不會上傳。」按「開始掃描」才呼叫 `getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })`，畫面以 `<video playsinline muted>` 顯示預覽；影格交給 Web Worker 裡的解碼器，避免主執行緒卡住影響 INP。
- **只接受站內網址**：解出的文字必須能解析成網址、origin 剛好是站台設定的 `https://ledgerland.swift.moe`（5.2），路徑符合站內的格式（`/level/<levelId>/`、`/chapter/<chapterId>/`、`/lab/story/<storyId>/<stepId>/` 等，可帶 `/en/` 前綴）。符合就關閉相機、以站內導覽前往；語言與網址不同時依 05 只顯示切換提示，不自動轉址。不符合就顯示「這不是 LedgerLand 的課堂 QR」，**絕不開啟站外網址**，也不提供「仍要開啟」的選項。
- **相機一定要關**：辨識成功、按「取消」、換頁、`visibilitychange` 轉為 hidden 時，一律對所有 track 呼叫 `stop()`。
- **沒有權限或沒有相機**：拒絕權限、找不到相機或 `getUserMedia` 失敗時，顯示「沒有相機權限也沒關係，可以改輸入關卡代號」並直接帶到代號輸入框；另附一句如何在系統設定重新允許。
- **離線**：解碼在本機完成，解碼器已 precache（3.2），掃到的網址只要對應的內容已下載就能開啟。
- **解碼器選型（M2 前查證）**：已決定（2026-10-23，與 14 第 5.2 節相同）：主案 `@zxing/library` 0.23.0，深層匯入 QR 子集、在 Web Worker 解碼（Apache-2.0、純 JS、不需要 WebAssembly、約 25 KB gzip，每 200 ms 取一格、影格縮到最長邊 640px）；退路 jsQR 1.4.0；M2 不用原生 BarcodeDetector（iOS Safari 到 27 仍在旗標後）。未採用：zxing-wasm 與 barcode-detector（需要 WebAssembly 與放寬 CSP）、zbar-wasm（LGPL）、qr-scanner（blob worker 違反 CSP，且已停更）。實機辨識率與速度見【待實測 V19】。原本的比較項目如下：Safari 沒有正式的 BarcodeDetector，所以要內建 JS 解碼器。比較項目：gzip 後的大小（以動態 `import()` 載入，不計入首次載入 JS，但計入 precache 預算）、授權（要和 MIT 程式碼相容，並列入 THIRD_PARTY_NOTICES）、維護狀況、在投影幕反光與教室燈光下的辨識率、iOS 17 上能否執行。若選用的解碼器需要 WebAssembly，CSP 另評估是否在 `script-src` 加上 `'wasm-unsafe-eval'`（M2 前查證，見 09），純 JS 的解碼器不需要這一項，所以這一點也列入比較；在有原生 BarcodeDetector 的瀏覽器（例如 Android Chrome）是否優先用原生 API，選型時一併評估。
- **標頭**：`_headers` 的 `Permissions-Policy` 為 `camera=(self)`（3.5、09 第 11.2 節），App 內掃描才能使用相機；其餘權限一律關閉。
- **測試**：Playwright 的 Chromium 專案用假的攝影機影像（內含站內與站外 QR）測試導覽、拒絕站外網址與拒絕權限三種情況；iOS Simulator 沒有相機，iOS 17、26、27 的掃描都在實機上測（第 10 節）。主畫面 App 中相機權限是否每次啟動都重新詢問【待實測 V20】：每次重新開啟 App 再問一次是 WebKit 的已知行為，不算阻礙；同一次啟動、同一個畫面內反覆詢問才算（10 第 9 節）。

---

## 5. 網站來源（origin）與遷移

### 5.1 為什麼 origin 是資料模型的一部分

以下全部綁定 origin（協定加主機加埠），換網域等於換 origin：

| 綁定 origin 的東西 | 換 origin 的後果 |
| --- | --- |
| IndexedDB、localStorage、Cache Storage | 新網址看不到舊進度 |
| SW 註冊與 precache | 舊網址的 SW 繼續存在，新網址要重新安裝 |
| `persist()` 的授予狀態 | 要重新取得 |
| 已安裝的主畫面 App（manifest `id` 以 origin 解析） | 舊圖示仍指向舊網址，無法自動搬家 |
| 已印出的 QR code、老師貼在 LINE 的連結 | 仍指向舊網址 |

所以正式網域必須在第一次讓學生使用之前決定（包括課堂試用與印 QR）。已決定（D4，2026-10-20）：`https://ledgerland.swift.moe`，主機 Cloudflare Workers Static Assets，base path 為 `/`。M0a 的暫時預覽網址與 PR 預覽只放測試資料；課堂試用與印出的 QR 一律用正式網域。`swift.moe` 底下其他子網域是不同的 origin，不共用儲存與 SW。

### 5.2 單一設定來源

```ts
// site.config.ts（示意）：所有與 origin、路徑有關的值都從這裡產生
export const site = {
  origin: 'https://ledgerland.swift.moe', // D4；預覽建置改用各自的預覽網址
  base: '/',            // Vite base 與 React Router basename（D4）
  manifestId: '/',      // manifest id，設定後永遠不改
  startUrl: '/',        // 中文首頁；en 偏好由根路徑轉到 /en/（D5，見 05）
  scope: '/',           // manifest scope 與 SW scope，涵蓋 /en/
  swPath: '/sw.js',     // 永遠不改
} as const;
```

語系的網址片段（中文沒有前綴、英文為 `/en/`）由 05 的語系登錄檔提供，不在這裡另寫一份；App 內掃描 QR 驗證網址時用的 origin 也讀這份設定（4.9）。

已決定（D4，2026-10-20）：base path 為 `/`，CI 不再以根路徑與子路徑各建置一次；CI 只檢查 `site.config.ts` 以外沒有寫死的路徑（單一設定來源見 09）。E2E 照常涵蓋中文與 `/en/` 的網址（8.2）。

### 5.3 不得不搬家時的遷移流程

1. **新 origin 上線**：功能完整，第一次啟動偵測到空資料庫時主動提供匯入（與 4.7 第 3 步相同的畫面，多一個「從舊網址搬過來」說明）。
2. **舊 origin 部署「搬家版」**（一般更新，走 prompt 流程）：所有頁面頂部顯示「網站搬家了」橫幅；新增「匯出進度並前往新網址」頁，先讓學生複製備份碼或存成備份檔，再帶著相同路徑前往新網址。舊網址的深層連結（含印出的 QR）都先經過這個頁面，不直接轉址，否則學生還沒匯出就被帶走。
3. **至少保留一個學期**後，舊 origin 的 `sw.js` 換成 kill-switch 版本（3.4），站上只留一個靜態的搬家頁；這個頁面仍內含讀取 IndexedDB 並匯出的小腳本，因為 kill-switch 不會刪除進度。
4. **主畫面圖示**：無法自動搬家。搬家頁說明「匯入完成後，刪除舊圖示，從新網址重新加入主畫面」。
5. **舊網域盡量長期續約**，避免被他人註冊後接收舊連結。

---

## 6. 響應式版面原則

頁面層級的版面、導覽型態與測試尺寸以 [02 網站架構](02-site-architecture.md) 為準。這裡只列跨頁面的原則。

| 版面（名稱同 02） | 寬度 | 導覽 | 內容 | 報表實驗室 |
| --- | --- | --- | --- | --- |
| compact | 320 到 599px（小手機 320 到 374px、大手機 375 到 599px，兩者同一套版面，只在測試時分開檢查） | 底部懸浮玻璃 Tab bar，往下捲動時收合，鍵盤開啟時隱藏 | 單欄；左右邊距 16px | 一次只顯示一張表，用分段控制切換；恆等式摘要固定在上方 |
| medium 直向 | 600 到 1023px，高度大於等於寬度 | 置中的懸浮 Tab bar（最大寬度約 480px） | 置中，閱讀頁最大約 720px；依容器寬度改為兩欄卡片 | 兩欄 |
| medium 橫向 | 600 到 1023px，寬度大於高度（例如手機橫向） | 左側 rail | rail 右側，左右各留 safe area | 兩欄，表格在欄內捲動 |
| expanded | 1024 到 1439px | 懸浮側邊欄（可收合成 rail） | 閱讀頁最大約 760px | 容器夠寬時三表並排，否則兩欄 |
| wide | 1440px 以上 | 懸浮側邊欄 | 最大約 1200px 置中，可停靠名詞卡面板 | 三欄 |

原則：

- **殼層用 viewport 斷點，元件用 container queries**。同一個題目卡放在手機單欄或電腦側欄，都依自己的容器寬度排版。
- **只看實際寬度，不看裝置類型**。iPad 分割畫面的實際寬度依機型而異，一律依斷點處理；不用 UA 判斷平板。
- 最小支援寬度 320px，在 320px 寬、頁面縮放 200% 時不出現水平捲動（表格除外，表格放在可捲動並可用鍵盤操作的容器中，見 07 第 8 節）。
- 數字欄位一律完整數字加千分位，窄螢幕不縮寫成「萬」（見 05）。
- 英文字串通常比中文長，按鈕與 Tab 標籤要允許換行或改用較短的英文標籤，不截斷。
- 測試尺寸：320×568、375×667、393×852、430×932、iPad 直向 820、橫向 1180、分割畫面 1/3 與 1/2、桌機 1440（與 02 相同）。

---

## 7. 原生感檢查清單

| 項目 | 做法 | 驗證 |
| --- | --- | --- |
| safe area | viewport 加 `viewport-fit=cover`；頂部 `padding-top: env(safe-area-inset-top)`；Tab bar `bottom: calc(env(safe-area-inset-bottom, 0px) + 8px)`，左右 `max(12px, env(safe-area-inset-left))`；主內容 `padding-bottom` 為 Tab bar 高度加 `env(safe-area-inset-bottom)` 再加 16px | debug 頁量測 inset 實際值【待實測 V06】 |
| 視窗高度 | app shell 用 `min-height: 100dvh`，**禁用** `100vh`；svh、lvh、dvh 自 Safari 15.4 起支援 | iOS 26、27 在三種分頁列版面與兩種模式下的實際值【待實測 V06】 |
| 觸控目標 | 所有可點元素至少 44×44 CSS px，相鄰目標間距至少 8px | Playwright 檢查每個互動元素的 bounding box |
| 連點不放大 | 互動元素與 `html` 設 `touch-action: manipulation`；不在 viewport 禁止縮放 | 實機雙擊按鈕不放大、雙指仍可縮放 |
| 輸入框字級 | 所有 `input`、`select`、`textarea` 字級至少 16px，避免 iOS 聚焦時自動放大 | lint 規則加 Playwright 檢查 computed style |
| 數字鍵盤 | 金額輸入用 `inputmode="decimal"` 或 `"numeric"`，加 `enterkeyhint`；iOS 數字鍵盤沒有負號，提供「±」按鈕（見 05） | 實機 |
| 鍵盤不擋輸入框 | Chromium 靠 `interactive-widget=resizes-content`；iOS 用 visualViewport 算出鍵盤高度，聚焦時把輸入框捲到可見範圍中央，表單底部加上等於鍵盤高度的留白 | 指標計算與勾稽填格的輸入框都在頁面下方，逐一實測 |
| 鍵盤開啟時隱藏 Tab bar | `focusin` 到輸入元素時立刻設 `html[data-input-focus='true']`，Tab bar 以 transform 移出畫面，動畫結束後設 `visibility: hidden`（不在焦點順序內）；`focusout` 且 visualViewport 恢復後再顯示 | 也避開 iOS 鍵盤造成的底部空白與 fixed 元素偏移問題（WebKit 292603，PR 尚未合併） |
| 捲動位置還原 | 使用 React Router 的 `<ScrollRestoration />`，依 location key 記住每頁位置；從關卡頁返回章節頁時回到原位 | Playwright：捲動、進入、返回、比對 scrollY |
| 切換語言保留狀態 | 作答中切換語言時，在中文網址與 `/en/` 網址之間以 replace 導覽（D5），題目、已選選項、計時與捲動位置放在路由外的 store 並保留（見 05）；Tab bar 只更新文字與 `href`，不重建元素（2.3） | Playwright，含離線時切換 |
| 轉場只做在內容區 | View Transitions 只包住內容區（React 19.3 的 `<ViewTransition>`）；Tab bar 與它的祖先不設 `view-transition-name`（見 07 第 6 節）；減少動態時不做轉場 | 截圖比對，Tab bar 在轉場中保持玻璃效果 |
| 文件捲動 | 整站使用 document 捲動，不把主內容放進 `overflow: auto` 的容器；Tab bar 是 `body` 直屬的 fixed 元素 | 避開 iOS 26 的 sticky 與 backdrop-filter 問題 |
| 彈性捲動 | 底部表單（sheet）與水平捲動的表格設 `overscroll-behavior: contain`；不全域關閉 | iOS 26.x rubber-band 捲動時 fixed 元素閃爍（Safari 27 已修正 176226179）【待實測 V13】 |
| 點按回饋 | `-webkit-tap-highlight-color: transparent`，改用自家的 `:active` 樣式（縮放 0.96 與底色變化） | 實機 |
| 長按選單 | 按鈕、卡片、Tab 設 `-webkit-touch-callout: none`；解說文字保留可選取 | 實機 |
| 拖放 | 拖曳把手設 `user-select: none`；拖放函式庫在 iOS 的偏移問題另行驗證 | 【待實測 V07】 |
| hover | hover 樣式只寫在 `@media (hover: hover)` 內，觸控裝置不會殘留 hover 狀態 | Playwright 的 hasTouch 專案 |
| 方向 | 不鎖方向，直向橫向都能用 | 測試尺寸矩陣 |

鍵盤處理的草圖：

```ts
const vv = window.visualViewport;
const root = document.documentElement;

function onViewportChange() {
  if (!vv) return;
  const keyboard = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  root.style.setProperty('--ll-keyboard', `${Math.round(keyboard)}px`);
  root.dataset.keyboard = keyboard > 80 ? 'open' : 'closed';
}
vv?.addEventListener('resize', onViewportChange);
vv?.addEventListener('scroll', onViewportChange);

document.addEventListener('focusin', (e) => {
  const el = e.target as HTMLElement;
  if (!el.matches('input, textarea, select, [contenteditable="true"]')) return;
  root.dataset.inputFocus = 'true';
  const behavior = root.dataset.motion === 'reduced' ? 'auto' : 'smooth';
  window.setTimeout(() => el.scrollIntoView({ block: 'center', behavior }), 300); // 等鍵盤動畫，數值實測後調整
});
document.addEventListener('focusout', () => {
  window.setTimeout(() => {
    if (!document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')) {
      delete root.dataset.inputFocus;
    }
  }, 0);
});
```

在 iOS 26 的瀏覽器分頁模式下，Safari 自己的浮動網址列會和 LedgerLand 的浮動 Tab bar 疊在一起，畫面底部出現兩層 chrome；所以往下捲動時收合 Tab bar 在 `html[data-display='browser']` 時尤其重要（主畫面 App 模式也套用同樣的收合，見 07 第 6.3 節）。兩層 chrome 在三種分頁列版面下的實際位置【待實測 V06】。

來源：https://bugs.webkit.org/show_bug.cgi?id=301756 、https://bugs.webkit.org/show_bug.cgi?id=292603 、https://raw.githubusercontent.com/mdn/browser-compat-data/main/css/types/length.json （查證日期 2026-10-20）

---

## 8. 效能目標與量測

### 8.1 目標

| 指標 | 目標 | 條件 | 說明 |
| --- | --- | --- | --- |
| LCP | ≤ 2.5 秒；CI 的檢查值 2700ms（2026-10-26 放寬，見 8.2 的收尾紀錄） | mid-tier 行動裝置節流 | Core Web Vitals 良好門檻；超過 4.0 秒為差。放寬的理由：每一頁改成資料齊了才整頁出現，Lighthouse 量到的是「資料齊了那一刻」，比原本「先畫版面」的做法多約 60 到 100ms |
| LCP（低階） | 盡量 ≤ 4 秒 | low-tier 節流 | 正式發布前檢查一次，不擋 CI |
| INP | ≤ 200ms | 作答、分類、實驗室改數字等實際互動 | 超過 500ms 為差 |
| CLS | ≤ 0.1 | Chromium | 超過 0.25 為差；Safari 量不到 |
| TBT | ≤ 200ms | Lighthouse 行動版 | Lighthouse 導覽模式量不到 INP，用 TBT 當代理指標。門檻依執行器速度校正（2026-10-26）：benchmarkIndex 低於參考值 3000 時乘上 (3000 / 實測)²、最多 2 倍，`tools/perf.mjs` 會印出校正後的門檻；參考速度的機器上仍是 200ms |
| Lighthouse 效能分數 | ≥ 90 | 行動版、5 次中位數 | |
| Lighthouse 無障礙分數 | ≥ 95 | 同上 | 另有人工檢查，見 07 第 8 節 |
| 首次載入 JS | ≤ 150 KB（gzip 後，暫定）；CI 的檢查值 152 KB（2026-10-26 放寬，見 8.2 的收尾紀錄） | 首頁與 QR 落地頁 | 從 M0b 起由 CI 把關；M0a 實測後調整，只能附理由放寬。放寬的理由：M3 收尾的頁面布幕進了入口 chunk，給老師的說明與關卡 QR 的介面字串進了兩種語言的 catalog，/en/ 入口實測 150.4 KB；英文作答頁的 LCP 實測 2420ms |
| 首次載入 CSS | ≤ 30 KB（gzip 後，暫定）；CI 只算 `index.html` 引用的入口 CSS（`initialCssGzipKb`，2026-10-25 起，懶載入頁面的 CSS 和頁面 chunk 一樣不算） | 同上 | 同上 |
| 全部 CSS | ≤ 44 KB（gzip 後，暫定；2026-10-25 到 26 是 40）；`assets` 底下所有 CSS 的合計，含懶載入頁面自己的 CSS（`allCssGzipKb`，2026-10-25 起） | 建置產物 | 維護者 2026-10-25 決定把 CSS 預算拆成兩項。理由：原本的檢查名為首次載入，實際加總所有 CSS，地圖、章節頁、名詞圖鑑的版面 CSS 拆成頁面 CSS 以後，那個數字已經不是開頁時要下載的量；入口那一項管開頁速度，合計這一項防止頁面 CSS 不受控制地長大。M3 新增設計系統（遊戲按鈕、選單列、名詞卡、面板、橫幅）並重做地圖與章節頁，全部 CSS 從約 14 KB 變成 36.8 KB，40 是實測值加約一成的餘裕；只能附理由放寬。2026-10-27 放寬到 44：幕後頁（`/credits/`）的技術棧探索器、彩蛋與浮動提示的版面加進說明頁的 CSS（`info.css`，和其他說明頁一起懶載入，不在入口），全部 CSS 實測到 40 的邊上；頁面 CSS 本來就會隨頁數成長，入口 30 KB 不動所以開頁速度不受影響，44 仍是實測值加約一成的餘裕 |
| precache 總量 | ≤ 5 MB（未壓縮，暫定）；CI 的檢查值 3600 KB（`precacheKb` 3600，2026-10-24 從 2048 提高；2026-10-23 從 1024 提高到 2048） | 第一次安裝 SW | 見 3.2 |
| `/en/` 首次載入 JS | ≤ 150 KB（gzip，和首次載入 JS 同一個上限） | 英文網址的入口 JS 加英文訊息 catalog（`tools/budget.mjs` 的 `initialJsEnGzipKb`） | M3 收尾不提高 150、也不拆 catalog，M4a 開工時拆兩層（14 第 5.2 節）；2026-10-26 實測 149.5 KB |
| 闖關地圖 chunk | ≤ 28 KB（gzip，`mapChunkGzipKb`） | Play 頁與 `quest-map` chunk 的合計，不在首頁與其他頁的第一波 | 2026-10-25 從 25 改成 28（M3 地圖重做實測 26.8 KB，17 第 8 節）；2026-10-26 實測 27.5 KB |
| 場景 chunk | 單章 ≤ 8 KB、合計 ≤ 80 KB、共用的 scene-kit ≤ 5 KB（gzip，`sceneChunkGzipKb`、`sceneChunksTotalGzipKb`、`sceneKitGzipKb`） | 各章場景物件層的 lazy chunk（延伸區與海峽共用的 chunk、主線交界重畫的 chunk 都算進單章與合計） | 2026-10-25 從單章 2、合計 20 放寬（物件層要畫整章的地形塊與兩翼，不在第一波，不影響 LCP 與 TBT）；scene-kit 原訂 4，第 2 輪看圖驗收後改 5；2026-10-26 實測單章最大 7.6、合計 66.3、scene-kit 4.7 KB |

Core Web Vitals 的門檻以第 75 百分位為準，行動與桌面分開計算。坊間有「2026 年調整門檻」的說法，但查不到 Google 的一手來源，維持現行門檻。

### 8.2 量測方式

**CI（從 M0b 起，每個有 UI 的里程碑都要通過）**

- 用 **lighthouse 13 CLI**（13.5.0，2026-09-18 發布，需要 Node 22.19 以上；09 選定的 Node 24 LTS 符合），不用 Lighthouse CI：`@lhci/cli` 0.15.1 內建的仍是 Lighthouse 12.6.1，audit ID 與 DevTools、PageSpeed Insights 用的 13.x 不同。
- 每個網址跑 **5 次取中位數**。CI runner 效能浮動大，只跑一次的結果時好時壞。
- 每週對正式網址的檢查（`scheduled.yml`，`pnpm perf --observed`，2026-10-27 起）：LCP 看實測值（網路不節流、CPU 4 倍降速）≤ 3000ms（闖關地圖最重，單次實測 2.3 到 2.6 秒；web.dev 的 2.5 秒是不降速的真實使用者數字），模擬值與效能分數只記錄當趨勢。真實邊緣每個請求約 50 到 60ms 的伺服器延遲會被 Lighthouse 的模擬逐層放大，swift.moe 這個 zone 的 Web Analytics 自動注入又在 HTML 多一段第三方 script（維護者決定留著，其他子網域要用），正式站模擬 LCP 3.5 到 4.2 秒、實測 0.3 到 1.6 秒；比較建置好壞用本機伺服器的模擬值（PR 與 main），正式站用實測值看使用者真的等多久。
- assertion 只看 metric 數值（LCP、TBT、CLS、總傳輸量）與類別分數，不依賴會改名的 insight 或 opportunity audit（Lighthouse 13.0 已把舊的效能 audit 換成 insights，另移除 8 個沒有替代的 audit；效能計分方式不變）。
- 記錄每次報告的 `benchmarkIndex`，據此校準 `--throttling.cpuSlowdownMultiplier`。Lighthouse 預設的行動節流是 simulated：RTT 150ms、下行 1.6 Mbps、上行 750 Kbps、CPU 4 倍減速，模擬中階行動裝置；`benchmarkIndex` 125 到 800 為中階、低於 125 為低階。另加一組 6 倍減速的低階設定，代表較舊的 Android 手機。
- **M0b 的兩個實測教訓（2026-10-22）**：(1) 會插入到內容上方的元素（語言切換提示、橫幅）必須在首次繪製就決定要不要顯示或預留空間，不能在 effect 裡才插入，否則會把下面的卡片往下推，首頁與作答頁的 CLS 曾因此到 0.073 與 0.097；(2) 內容頁不能在頁面 chunk 載入後才開始串行請求 manifest 與內容快照，名詞頁曾因此比列表頁多約 450ms、LCP 超過 2.5 秒；做法是殼層 `preload` manifest、App 啟動就讀 manifest、路由在載入 chunk 的同時讀快照。
- **M2 的實測教訓（2026-10-23）**：(1) 量效能只能用完整建置（`vite build` 之後要跑 `tools/postbuild.mjs` 填 CSP 雜湊），只跑 `vite build` 會讓殼層的 inline 腳本與首次繪製的 style 被 CSP 擋掉，每一頁 LCP 一致多約 300ms，看起來像程式回歸其實不是；(2) rolldown 的 `codeSplitting.groups` 預設連依賴一起抓（`includeDependenciesRecursively`），群組要依「共用的先宣告」排序，作答頁專用的群組用 `entriesAware` 拆開，否則地圖頁會多載判分與題目元件；(3) 進度資料庫的開啟（runtime、zod 約 37 KB gzip）一律在第一次繪製送出之後（`afterFirstPaint`：兩個動畫影格、閒置、再等 400ms），任何在 effect 裡直接呼叫 `getProgressStore()` 的元件都會搶在 LCP 前面；(4) 闖關地圖與作答頁第二波仍要 75 到 110 KB，M2 把這兩頁的 LCP 門檻暫放寬到 3300ms（CI 執行器對同一頁的波動約 300 到 400ms，門檻要留餘裕），M3 拆 progress 的 schema 與 runtime、判分改成按下確認才載入後收回（14 第 5.2 節）。
- **M3 的實測教訓（2026-10-24）**：(1) 判分、core 與作答紀錄改成按下「確認答案」才動態載入並在第一次繪製後預載，儲存 runtime 由 `session` chunk 分出（`codeSplitting` 群組 `session` 在 `progress` 之前宣告，`progress` 加 `entriesAware`），地圖元件分成 `quest-map` chunk 之後，作答頁與地圖的第一波 JS 從約 70 KB 降到約 45 KB gzip，zod 與 runtime 都不在關鍵路徑；三章內容的快照上 LCP 2.9 秒變 2607ms、2.75 秒變 2605ms，門檻尚未收回（14 第 5.2 節）；(2) 群組會連依賴一起抓，所以「第一次繪製就要、又是 runtime 依賴」的小模組（`generateAttemptId` 所在的 `model.ts`、content-schema 的 `ids.ts`）要由先宣告的群組拿走，否則作答頁靜態連回 runtime；頂層就建 zod schema 的模組（`content-schema/common.ts`、`quiz/answers.ts`）只要被第一波用到一個常數就會把 zod 帶進來，不帶 zod 的常數與純函式要另開檔案；(3) 不要 `import('@ledgerland/progress')` 之後解構整個入口：那會把套件所有模組綁成一個動態進入點，第一波 chunk 又連回 runtime；(4) 內容快照才是現在的瓶頸：十二章發布後名詞快照 52 KB gzip（兩種語言各一份），作答頁與名詞列表第一次繪製都要等它，作答頁 3490ms、名詞列表 3471ms，比第二波 JS 的影響大；收回 2500ms 要先把名詞快照拆成關卡用的名稱索引與完整定義。(5) 名詞快照分兩層（2026-10-24 收回門檻時實測）：每個語系一份名詞索引（名稱、別名、科目與指標對照，約 10 KB gzip），完整定義依名詞 ID 分桶、打開名詞卡或名詞頁才讀；章節也另有一個語系一檔的章節索引（約 8 KB gzip），地圖與名詞圖鑑不再逐章讀十四個章節檔（08 第 7.3 節）；(6) 本機量測是 wrangler dev 的 HTTP/1.1，Lighthouse 的模擬依實際連線數排隊，第一次繪製前每多一層或多一批請求就多約 150ms：小 chunk 要併起來（`common`、`level-view` 群組，每個語言的兩份訊息 catalog 合成一個 chunk），殼層的 boot 腳本依路徑先發出頁面 chunk、訊息 catalog 與內容快照的預先載入（表格由 `tools/postbuild.mjs` 在建置後填入，`src/shell/route-preload.json`），`<link rel="preload" as="fetch">` 要加 `crossorigin` 才會被 `fetch()` 重用（少了它 manifest 會讀兩次）；(7) 進度讀到後才改的文字不要放在最大的文字區塊裡：名詞列表「已收進圖鑑 N／M」的 N 換數字時整段被當成新的 LCP（多約 500ms），數字改放 inline-block 的小方塊；名詞頁的解鎖狀態先照「未解鎖」排版、只把小標藏起來。場景 SVG、Service Worker 註冊（workbox-window）與統計腳本也延到第一次繪製之後，地圖先畫路線、進度到了再套上星星與目前關卡。收回後六個量測網址本機中位數約 2.0 到 2.3 秒，門檻回到全站 2500ms（14 第 5.2 節）。
- **M3 收尾 QA 的實測教訓（2026-10-26）**：設計系統、地圖重做與依詞換行加進第一波以後（入口 CSS 從約 24 KB 變約 30 KB gzip，作答頁第一波多了五個 chunk），2026-10-25 下午起八個網址有六個超過 2500ms（作答頁 2739ms、地圖 2607ms、章節頁 2594ms、名詞頁 2583ms）。原因用 Lighthouse 的 artifacts（`-G` 存下、改網路紀錄後 `-A` 重算）做假設實驗找出來：(1) 本機的 HTTP/1.1 每個網域 6 條連線，模擬時每條連線分到「總頻寬除以同時進行的請求數」（還在等第一個位元組的請求也算），約 133 KB 的入口 JS 整段只分到約六分之一，LCP 幾乎就是入口 JS 下載完的時間；它以一次往返（約 150ms）為一級跳動，第一波的位元組或請求多到跨過一級就多 150ms，少一點不會少，所以要看的是「總量有沒有跨級」，單看某一個檔案大小常常看不出差別；(2) 瀏覽器在 load 前後自己抓的 favicon、manifest 與安裝圖示也算在 LCP 之前，三個請求約等於一級，改成 2.3 節的寫法；(3) 第一波裡不該有的 chunk：作答頁為了名詞旗標一個 10 行的函式載整個名詞卡 chunk、為了窄版語言選單載面板與選單的 overlay、依詞換行分在三個 chunk，名詞頁為了佔位符與欄位對應載作答頁的 level-view 與 session，地圖與章節頁為了 ID 規則與「中途離開的關卡」載 session；改成 `prose` 群組（切詞、佔位符、欄位對應、名詞旗標與 `ids.ts`）、`level-exit.ts` 放 `common`、`level-view` 群組併進 `session` 與 `quiz-view`（結果頁元件改回第一次繪製後才載），窄版語言選單在第一次繪製後才載入（之前畫外觀相同的按鈕），作答頁第一波的 JS 從 10 個 chunk 變 5 個；(4) 地圖頁偶爾在 window 上出現「ResizeObserver loop completed with undelivered notifications」（`--qm-sticky-h` 在 ResizeObserver 的回呼裡改到地圖內容的 min-height），錯誤紀錄因此在 LCP 之前開進度資料庫、多載約 16 KB（同一棵樹 3 次裡有 1 到 3 次）：觸發點改到下一個影格才寫，錯誤紀錄也等第一次繪製送出後才寫入、不記這個無害的通知（9.2）。結果（`pnpm perf --runs 3` 中位數）：首頁 1981、地圖 2458、作答頁 2431、英文作答頁 2419、名詞圖鑑 2473、名詞頁 2433、交易影響開頭的作答頁 2444、章節頁 2446ms，體積預算都沒有動（入口 CSS 29.6、全部 CSS 39.6、`/en/` 首次載入 JS 149.4、地圖 chunk 27.4 KB）。餘裕很小：作答頁三個網址的入口 CSS 只能再多約 0.5 KB gzip（多 1 KB 就回到約 2580ms），訊息 catalog 約 1 KB；其他頁至少還能多 2 KB。入口 CSS 的 30 KB 預算比 LCP 門檻允許的寬，加 CSS 或 catalog 字串之前先量作答頁；之後要再留餘裕，可以考慮把只在作答頁結果、錯題本、備份、題型元件用的樣式移出入口 CSS（拆檔會讓全部 CSS 的合計多約 0.8 KB，超過 40 KB 的預算，要由維護者決定），或把說明頁的長文字串拆成另一份 catalog。
- **M3 收尾的頁面布幕（2026-10-26）**：維護者在本機預覽看到首頁、地圖清單、名詞圖鑑先出現「…」、灰色長條與沒印章的卡片、半秒後才補上，要求每一頁點進去就是完整的（可以整頁淡入）。做法：(1) 進度資料庫改成和頁面一起開始載入（`main.tsx` 不再 `afterFirstPaint`，runtime 的 chunk 由殼層依 `route-preload.json` 的 `always` 和頁面 chunk 一起預先載入；Vite 的 manifest 對 `codeSplitting.groups` 併出的 chunk 沒有原始碼鍵，所以建置時另產生 `.vite/chunk-modules.json` 找出含 `runtime.ts` 的 chunk）；(2) 殼層的 `PageReveal`（`lib/page-ready.tsx`）包住每一頁，頁面用 `usePageReady` 回報內容快照、進度與第一屏的懶載入作答區齊了沒，齊之前整頁 `visibility: hidden`、齊了淡入 `--ll-dur-base`，超過 0.7 秒才顯示載入圈；(3) Skeleton 元件、骨架 CSS、所有「…」佔位移除，橫幅也在布幕裡和頁面一起出現，換頁後的焦點在掀開那一刻才移到 h1。代價：Lighthouse 的 LCP 變成資料齊了那一刻，八個網址實測 home 2124、play 2563、quiz 2570、quiz-en 2420、terms 2564、term 2434、quiz-effect 2569、chapter 2564（5 次中位數），超過 2500 的五個都在 70ms 內；維護者決定接受，門檻改 2700（`urls.json`、14 第 5.2 節）。另外 `firstPaintSettled` 只剩錯誤紀錄與分析腳本在用（看不見的工作照舊延後）。同一天的 /en/ 入口 JS 實測 150.4 KB（布幕的程式在入口、給老師的說明與關卡 QR 的字串在 catalog），`initialJsGzipKb` 從 150 放寬到 152；英文作答頁 LCP 2420ms。
- **固定量測網址**：首頁（`/`）、闖關地圖（`/play/`，17 第 8 節）、一個章節頁（`/chapter/<chapterId>/`）、一個關卡作答頁（`/level/<levelId>/`）、實驗室故事的第 7 個步驟（`/lab/story/<storyId>/<stepId>/`），另加同一個關卡的英文作答頁（`/en/level/<levelId>/`），確認英文殼層與英文 catalog 同樣達標。M3 結束時（2026-10-26）`perf/urls.json` 有八個：home、play、quiz（`/level/lv_h2zx7srx/`）、quiz-en、terms（名詞圖鑑）、term（名詞頁 `/terms/tm_r4w8n2qe/`）、quiz-effect（交易影響題開頭的作答頁 `/level/lv_14xjcbk8/`，2026-10-24 加入，守住非單選開頭的關卡）、chapter（`/chapter/ch_c5f8w2/`）；實驗室步驟在 M4a 加入。路徑格式以 02 的頁面總表為準（關卡不巢狀在章節底下，一律帶結尾斜線）；D5 決定中文在根路徑、英文加 `/en/`。實際網址寫在 `perf/urls.json`，不因功能調整而換網址。D5 也決定不預先產生 HTML，所以每個網址都是經由 Cloudflare 的 SPA fallback 拿到殼層、再由用戶端載入資料，一律量「冷啟動直接開啟深層連結」的情況。
- **統計腳本保持開啟**（D7，8.3）：量測時照正式網站的方式載入統計腳本，但把送出目的地換成本機的 stub（或用 Playwright 攔截請求），讓它的體積與執行成本算進結果，又不汙染正式的統計資料。統計腳本讓數值超出預算時，改它的載入方式，不放寬預算。
- **JS 與 CSS 體積**：用 size-limit 之類的工具在每個 PR 檢查；QR 解碼器是動態載入的 chunk，不計入首次載入，但另設一條 chunk 體積的檢查，數值在解碼器選型後訂定。

設定示意（數值為暫定；路徑依 02 的格式，中文在根路徑、英文在 `/en/`；ID 依 08 第 4.1 節的格式但為示意）：

```json
{
  "lighthouse": { "version": "13.5.0", "runs": 5, "aggregate": "median", "formFactor": "mobile" },
  "analytics": { "mode": "stub" },
  "urls": [
    { "name": "home", "path": "/" },
    { "name": "chapter", "path": "/chapter/ch_c5f8w2/" },
    { "name": "quiz", "path": "/level/lv_k7m2q9xd/" },
    { "name": "quiz-en", "path": "/en/level/lv_k7m2q9xd/" },
    { "name": "map", "path": "/play/" },
    { "name": "lab-step-7", "path": "/lab/story/story_k8p3x6/st_r2x9k4/" }
  ],
  "assertions": {
    "largest-contentful-paint": { "maxMs": 2700 },
    "total-blocking-time": { "maxMs": 200 },
    "cumulative-layout-shift": { "max": 0.1 },
    "categories.performance": { "min": 0.9 },
    "categories.accessibility": { "min": 0.95 }
  },
  "budgets": { "initialJsGzipKb": 152, "initialCssGzipKb": 30, "allCssGzipKb": 44, "precacheKb": 3600 }
}
```

**INP（互動）**

- 用 Playwright 腳本實際操作：作答一題並看回饋、在分類題完成一次分類（點選與拖放各一次）、在實驗室改一個金額看三表重算、開關名詞卡。
- 在 Chromium 專案中用 CDP 的 CPU 節流（與 Lighthouse 相同的倍數），頁面注入 web-vitals 6.x（6.2.3）的 `onINP`，每個互動的結果都要 ≤ 200ms。
- 門檻依執行器速度校正（2026-10-26 起）：測試開始前在同樣的節流下跑一段固定的計算與 DOM 工作，和基準機器相比慢幾倍，門檻就放寬幾倍（最多 2.5 倍，不會比 200ms 嚴）；CI 把這一支單獨用一個 worker 跑，不和其他測試搶 CPU。GitHub 的執行器量到的互動時間約是維護者 Mac 的 2.4 倍，而且時間都在繪製而不是 JS，固定 200ms 在那裡只是在量執行器。
- 也可以用 Lighthouse user flow 的 timespan 模式補充。
- Safari 26.2 起支援 LCP 與 Event Timing API（INP 的基礎），兩者成為 Baseline Newly available；但各引擎的量測終點略有不同，也有報告指出 Safari 的 INP 實作數值偏高。所以 iPhone 上的 INP 只當參考，CI 門檻以 Chromium 為準。
- **CLS 只能在 Chromium 量測**（Layout Instability API 只有 Chromium 有）。

**實機（正式發布前）**

- iPhone：iOS 26 支援清單中最舊的機型（預計是 iPhone 11 或第二代 iPhone SE 等級，開工前以 Apple 官方支援頁面確認）。用 Safari Web Inspector 的 Timelines 與 Layers（Safari 26.4 起可看實際的合成圖層快照），並在 debug 頁讀出 web-vitals 的 LCP 與 INP。
- iPhone（iOS 17，D8 正式支援）：正式發布前在 iOS 17 裝置上跑一次主要流程（首頁、作答、實驗室一步、離線開啟），沒有實機時用 Simulator 並在報告註明；效能數值只當參考。
- Android：一支中低階手機（例如記憶體 4 GB 等級），用 Chrome 遠端偵錯。
- 開發時用 Chrome DevTools 的 calibrated mid-tier 節流（Chrome 134 起可依開發機校準），正式發布前用 low-tier 檢查一次。CPU 節流模擬不了 GPU、磁碟、記憶體與降頻，所以實機測試不能省。
- WebPageTest 不列為必要工具（所屬公司在 2025 年易主，免費方案的額度說法不一）。
- 已決定（D7，2026-10-20）加入無 cookie、不收集個資的流量統計（8.3）。若選定的服務也提供 Core Web Vitals 的匯總（候選的 Cloudflare 網頁分析是否提供、提供哪些指標，以 M0b 前的查證為準），可以當作實際使用者的參考；CI 的門檻仍以 Lighthouse 與 Playwright 為準。流量太小，CrUX 不會收錄。

**PWA 功能測試（Lighthouse 12 起已經沒有 PWA 類別）**

自動化（Playwright，含 Chromium 與 WebKit 專案）：

- [ ] SW 註冊成功並控制頁面；`/sw.js` 存在且 scope 正確。
- [ ] manifest 可解析，必填欄位齊全，所有圖示檔存在且尺寸相符。
- [ ] precache 清單涵蓋殼層 `index.html`、帶 hash 的 JS 與 CSS、中英兩種語言的內容 JSON 與 QR 解碼器的 chunk，總量在預算內。
- [ ] 直接開啟深層連結（`/level/<levelId>/`、`/en/level/<levelId>/`、不存在的路徑）時，Cloudflare 的 SPA fallback 回 200，內容是殼層 `index.html`（在 `apps/web` 用 `wrangler dev` 或用 PR 預覽網址測）。
- [ ] `context.setOffline(true)` 後重新載入首頁、章節頁、關卡作答頁、實驗室故事步驟頁，以及它們的 `/en/` 版本，都能正常顯示並作答；離線時切換語言，作答狀態不變。
- [ ] 更新流程：先部署 v1 並載入，換成 v2 後觸發更新；在作答頁不出現提示，回到列表才出現；按下更新前進度已寫入；重新載入後是 v2。
- [ ] 作答中任何情況都不會自動重新載入。
- [ ] 匯出後清空資料庫再匯入，資料一致；備份檔與備份碼兩條路都測；合併規則逐條測試；截斷或改錯一個字元的備份碼會被 `checksum` 擋下。
- [ ] 模擬 IndexedDB 開啟失敗與 `QuotaExceededError`，出現固定提示與「立即匯出」。
- [ ] `persist()`：以 App 模式啟動、第一次完成關卡、設定頁按鈕三個觸發點，各自只在 4.5 表列的環境呼叫（以 stub 記錄呼叫次數）。
- [ ] 關卡代號：正確代號、大小寫混用、含空白或連字號、含 `o`／`i`／`l`、已下架、不存在六種輸入的結果。
- [ ] App 內掃描：以假的攝影機影像掃到站內 QR 會導覽；站外網址被拒絕；拒絕相機權限時出現關卡代號入口；離開畫面後相機已停止。
- [ ] 統計腳本被擋、載入失敗或離線時，頁面功能、錯誤紀錄與效能結果都不受影響；預覽建置不載入統計腳本。

iOS 手動檢查清單（iOS 26 與 27 各一次；iOS 17 跑標示「17」的項目）：

- [ ] 依兩套圖解從 Compact 與 Top／Bottom 版面加入主畫面，步驟與截圖一致（17：Top／Bottom 那一套）。
- [ ] 主畫面圖示清楚、沒有黑邊；啟動畫面與狀態列在淺色與深色下的顏色（V05）。
- [ ] 從主畫面冷啟動，飛航模式下能開啟並作答，中文與 `/en/` 都測（17）。
- [ ] `isAppMode()` 在分頁與主畫面各自的結果（V01）。
- [ ] 分頁與主畫面的儲存是否隔離（V02）；相機掃 QR 開在哪裡（V03）。
- [ ] `persisted()` 在 App 模式啟動與第一次完成關卡後的結果（V04）。
- [ ] 鍵盤開啟時 Tab bar 隱藏、輸入框不被擋住；三種分頁列版面的 safe area 與 fixed 底部元素位置（V06）。
- [ ] 分享表單匯出 JSON 是否出現「儲存到檔案」；`<a download>` 是否正常；複製與貼上備份碼（17）。
- [ ] App 內掃描課堂 QR：相機權限提示、後鏡頭、投影幕與紙本 QR 的辨識、離開畫面後相機確實關閉（17，實機）。
- [ ] Tab bar 的玻璃：靜態殼層中的 Tab bar 有模糊，切換語言與旋轉螢幕後仍有模糊；`data-glass` 的值符合 07 第 5 節（17）。
- [ ] LINE 內建瀏覽器開啟時的橫幅、離線行為與儲存（V11）。

來源：https://github.com/GoogleChrome/lighthouse/releases/tag/v12.0.0 、https://developer.chrome.com/blog/lighthouse-13-0 、https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md 、https://web.dev/blog/lcp-and-inp-are-now-baseline-newly-available （查證日期 2026-10-20）

### 8.3 流量統計（D7，M0b）

已決定（D7，2026-10-20）：一開始就加入不用 cookie、不收集個資的流量統計，M0b 一併建置。服務在 M0b 開工前查證後提出（候選：Cloudflare 的網頁分析，與 D4 的主機一致），同步修改 CSP（`script-src`、`connect-src`）、隱私說明頁與 debug 頁；統計腳本不得影響離線使用與首次載入的效能預算。服務名稱與 CSP 的寫法以 [09 技術選擇](09-tech-stack.md) 為準，這裡只規定 PWA 與效能面的規則：

1. **載入時機**：不寫在殼層 HTML 裡。App 掛載完成、`load` 事件之後，用 `requestIdleCallback`（不支援時用 `setTimeout`）動態插入一個 `async` 腳本；`navigator.onLine` 為 false 時不插入。理由：網路很差時，寫在 HTML 的 `defer` 腳本會拖住後面的模組腳本與 `DOMContentLoaded`，學生就開不了 App。
2. **失敗一律略過**：腳本被內容阻擋器擋下、載入失敗或送出失敗時，不重試、不顯示訊息，也不寫入本機錯誤紀錄（避免離線時塞滿 50 筆的環狀紀錄）。App 的任何功能都不依賴統計腳本。
3. **SW 不碰它**：統計腳本與送出的請求不 precache、不進 runtime 快取（3.1）；若服務使用同源路徑（例如 Cloudflare 保留的 `/cdn-cgi/` 開頭路徑，以 M0b 的查證為準），這些路徑已列在 `navigateFallbackDenylist`，不會被殼層攔截。
4. **安裝方式**：已決定（D7，2026-10-22）：採用 Cloudflare Web Analytics，站點以「不屬於 Cloudflare 網站」的方式建立，所以是手動 JS 片段，不會自動注入；片段是 `type="module"` 的 `beacon.min.js` 加 `data-cf-beacon` 的 token（token 本來就在網頁原始碼裡，放在 `site.config.ts`）；`spa` 省略時預設開啟，程式仍明確寫 `spa: true`；`_headers` 原本對 HTML、`/assets`、`/content` 與 manifest 的回應加 `Cache-Control: no-transform` 當作邊緣注入的第二道保險，2026-10-26 拿掉：Cloudflare 看到 `no-transform` 就不壓縮回應，正式站的主 JS 以 387 KB 的原始大小傳送（gzip 是 133 KB），每週排程的 Lighthouse 量到首頁 LCP 4.4 秒、作答頁 6.5 秒（issue 20）；站點以 JS 片段方式安裝，本來就不會自動注入，這道保險用不到。綁上正式網域後要回儀表板確認仍是 JS Snippet 安裝。原則：自動注入會改寫回應的 HTML，和 precache 的 revision、CSP 雜湊與上面的載入時機都對不上。實際行為以 M0b 的查證為準。
5. **站內換頁**：SPA 的換頁不是真正的導覽，服務必須支援以 History API 計算頁面瀏覽（例如 beacon 的 SPA 設定），M0b 查證時確認。
6. **只送匿名的頁面瀏覽**：網址只送路徑（內容 ID），查詢字串（例如 `?term=`、`?from=`）一律去掉；不送作答內容、進度、錯誤紀錄或 `deviceId`，也不另外定義含學習資料的自訂事件。
7. **環境**：正式網域的建置載入統計腳本並送到正式端點；CI 的效能量測也載入統計腳本，但指向 stub 端點（不送出真實資料；M0b 實測（2026-10-22）：beacon 預設用 XMLHttpRequest 送回報、離開頁面時才用 sendBeacon，所以 stub 要同時改寫 `XMLHttpRequest.prototype.open`、`fetch` 與 `sendBeacon`，否則會有回報真的送到正式端點；非 Cloudflare 網域上 beacon 打絕對網址 `https://cloudflareinsights.com/cdn-cgi/rum`，綁到 `swift.moe` 後可能改打同源的 `/cdn-cgi/rum`，`connect-src 'self'` 已涵蓋，stub 兩種都攔），讓它的成本計入效能預算（8.2）；本機開發與 PR 預覽都不載入（3.5）；正式站的趨勢由 scheduled workflow 量測（見 09）。
8. **說明與診斷**：隱私說明頁（`/privacy/` 與 `/en/privacy/`）寫明服務名稱與收集的內容（見 09）；debug 頁顯示統計腳本的狀態（已載入、略過及原因：離線、非正式環境、被擋）。

---

## 9. 錯誤處理與部署安全

### 9.1 執行期的錯誤處理

- **每條路由都設 ErrorBoundary**（React Router 的 route ErrorBoundary），顯示友善訊息、「回到首頁」與「立即匯出」按鈕，並寫入本機錯誤紀錄。
- **動態載入失敗**：部署會整批替換檔案，舊頁面之後才 lazy 載入的 chunk（包括 QR 解碼器）或內容 JSON 可能已經不存在。所有 `import()` 與內容載入都經過同一個包裝函式，失敗時：先寫入進度，再顯示「網站已更新，重新整理即可」與「重新整理」按鈕。用 sessionStorage 記錄，同一個分頁只自動建議一次；重新整理後仍失敗，就改顯示錯誤頁與匯出按鈕，避免無限重新整理。各瀏覽器的錯誤訊息文字不同，所以靠包裝函式判斷，不比對訊息字串。
- **SPA fallback 可能回傳殼層而不是 404**：Cloudflare 的 SPA 模式對找不到的檔案是否也回傳殼層 HTML（狀態碼 200），M0a 實測（3.5）。包裝函式因此一律檢查 `Content-Type`，內容 JSON 再用 Zod 驗證，拿到 HTML 時視同「檔案不存在」，走上面的流程。
- 已安裝 SW 的使用者，舊版的 chunk 都在 precache 裡，版本錯位主要發生在還沒有 SW 的第一次造訪，或 precache 不完整時。已決定（2026-10-21）：Cloudflare 上不存在的 `/assets/` 檔案由只在 `/assets/*` 執行的小 Worker 改回 404 與 `no-store`（09 第 7.3 節），所以舊頁面載入已刪除的 chunk 時拿到的是乾淨的 404，不會把殼層 HTML 當程式快取；ErrorBoundary 照上一點提示重新整理。

**固定提示**（中文為暫定文案，英文放在 Lingui 翻譯檔；語氣依 07 第 11 節）

| 情況 | 使用者看到的訊息 | 按鈕 | 記錄 |
| --- | --- | --- | --- |
| 動態載入的程式或資料檔失敗 | 網站已更新，重新整理即可繼續。你的進度已經存好。 | 重新整理 | 是 |
| 內容 JSON 載入失敗（離線且沒有快取） | 這一頁還沒下載到這台裝置。連上網路後再試一次，已下載的章節現在也能繼續練習。 | 重試、回到首頁 | 是 |
| IndexedDB 無法開啟 | 這台裝置目前無法儲存進度。你可以繼續練習，但請先匯出備份。 | 立即匯出 | 是（寫入記憶體） |
| 儲存空間不足 | 這台裝置的儲存空間不太夠，進度可能存不進去。建議你先匯出備份。 | 立即匯出 | 是 |
| IndexedDB 連線中斷且重試失敗 | 進度暫時無法儲存。重要進度已先暫存起來，建議你現在匯出備份。 | 立即匯出、重新整理 | 是 |
| 其他分頁更新了網站（versionchange） | 網站已在其他分頁更新，重新整理後才能繼續儲存進度。 | 重新整理 | 否 |
| SW 註冊失敗 | 不打擾使用者；設定頁的「離線使用」顯示為「目前無法離線使用」 | 無 | 是 |
| 匯入失敗 | 依原因：檔案不完整、版本比網站新、格式不是 LedgerLand 備份 | 重新選擇 | 否 |

### 9.2 本機錯誤紀錄

- IndexedDB 的 `errors` store 環狀保留最近 50 筆；IndexedDB 不能用時改存在記憶體。
- 欄位：時間、路由、訊息、截斷後的 stack、`appVersion`、`contentVersion`。
- 在 `/debug/` 頁可以檢視與清除；使用者匯出時可勾選「附上錯誤紀錄」，自己決定要不要提供給維護者。
- 第一次載入時發生的錯誤，紀錄在發生當下組好，等第一次繪製送出後才開資料庫寫入（`lib/errors.ts`，2026-10-26）：開資料庫會載入進度 runtime 與作答工作階段的 chunk，不和頁面內容搶第一波（8.2）。瀏覽器在 ResizeObserver 一輪送不完通知時丟的「ResizeObserver loop …」不是程式錯誤（沒有 error 物件，下一個影格照常通知），不記錄。
- 沒有任何遠端錯誤回報。D7 決定加入的統計只計算匿名的頁面瀏覽，不送出錯誤紀錄、作答或進度（8.3）。

### 9.3 debug 頁的量測項目

隱藏的 `/debug/` 頁（見 02 第 8 節）即時顯示：四種 display-mode 的結果、`navigator.standalone`、`isAppMode()`、`env(safe-area-inset-*)`（用 probe 元素量測）、`innerHeight`、visualViewport 的寬高與位移、svh／lvh／dvh 的 probe 高度、各 matchMedia 狀態（深淺色、減少動態、對比、forced-colors、prefers-reduced-transparency）、`ll:theme` 與 `ll:dark-flavor` 的值和解析後的 `data-theme`、`data-flavor`（16 第 7 節）、`data-glass` 與 `data-glass-legacy` 的值、`CSS.supports` 對無前綴與前綴版 backdrop-filter 的結果（D8 的 iOS 17 驗證用）、系統版本（UA 能讀到時）、`persisted()` 與 `estimate()` 以及 `persist()` 的觸發來源與結果、SW 狀態與版本、IndexedDB schema 版本、目前網址判定的語系與 `html lang`、統計腳本的狀態（8.3）、相機支援情況（`getUserMedia` 是否存在、權限狀態，不開啟相機）、web-vitals 的 LCP 與 INP、V02 的儲存隔離測試按鈕、最近 50 筆錯誤。

### 9.4 部署安全

- **只用整批部署**（`wrangler deploy`，D4），不逐檔同步，避免部署途中出現新舊檔案混雜。
- **部署前檢查**（CI 失敗就不部署）：`sw.js` 存在；manifest 可解析、圖示齊全，`id` 與上一版相同；precache 總量與 JS 體積在預算內；`index.html` 是殼層（含 `#root` 與靜態 Tab bar），建置產物沒有 `404.html`，`apps/web/wrangler.jsonc` 的 `not_found_handling` 是 `single-page-application`（3.5）；`_headers` 的規則數在上限內，CSP 的 sha256 與殼層裡的 boot 腳本、殼層在地化腳本一致；正式建置有統計腳本的設定，預覽建置沒有。
- **快取標頭**（Cloudflare 的 `_headers`，D4）：`/assets/*` 與帶 hash 的內容 JSON 設 `Cache-Control: public, max-age=31536000, immutable`（與 09 相同）；`index.html`、`sw.js`、`manifest.webmanifest`、`content-manifest.json` 維持 Cloudflare 預設的 `public, max-age=0, must-revalidate`。precache 對帶 revision 的項目用 `cache: 'reload'`，`sw.js` 的更新也不經 HTTP 快取，所以就算標頭設錯也不會卡在舊版。
- **還原舊版**：保留最近幾次的建置產物，還原舊版就是重新部署舊產物（Workers 本身也保留過去的版本，退回的指令與步驟在 M0b 查證後寫入 [09 技術選擇](09-tech-stack.md) 第 7.5 節）。對使用者而言，還原舊版也是一次「新版本」，同樣走 prompt 流程；`sw.js` 路徑不變。
- **內容修正的流程**：改內容 JSON，產生新的 hash 檔名與新的 precache manifest，`sw.js` 內容因此改變，使用者收到更新提示。
- **緊急停用**：部署 kill-switch 版本（3.4），不刪檔。

---

## 10. 實機驗證矩陣

| 環境 | 模式 | 重點 | 對應編號 |
| --- | --- | --- | --- |
| iPhone，iOS 26.x | Safari 分頁（Compact、Bottom、Top）與主畫面 App；淺色、深色；鍵盤開與關；增強對比、減少動態 | isAppMode、狀態列與啟動畫面、safe area 與 dvh、儲存隔離、persist、rubber-band 閃爍、QR 開啟位置 | V01 到 V06、V13 |
| iPhone，iOS 27.x | 同上 | 同上；Safari 27 的 IndexedDB 修正與 SW 解除行為；App 內掃描課堂 QR | V01 到 V06 |
| iPhone，iOS 17.x（D8 新增；沒有實機時用 Simulator 並在 M0a 報告註明） | Safari 分頁（Top、Bottom）與主畫面 App；淺色、深色；鍵盤開與關 | 玻璃外觀與 Tier 判斷（只支援前綴版時應為 frost）、殼層中的靜態 Tab bar 是否有模糊、動態插入的玻璃元件是否改為實色（07 第 5 節）、安裝（沒有「以 Web App 打開」開關）、離線與中英切換、IndexedDB 穩定性（盡量用 17.6 以上）、App 內掃描 QR（只能在實機測） | 無對應編號（D8 的 M0a 驗證項目） |
| iPhone 的 LINE 內建瀏覽器 | 一般開啟 | 橫幅、SW 能否註冊、儲存是否隔離、清除快取的影響 | V11 |
| Android 中低階手機，Chrome | 分頁與已安裝 | beforeinstallprompt、啟動畫面、效能、INP | 無 |
| Android 的 LINE 內建瀏覽器 | 一般開啟 | 橫幅、玻璃層級為行動裝置預設 | V11、V12 |
| 電腦 Chrome、Edge、Safari、Firefox | 一般與已安裝（Chromium） | 側邊欄版面、鍵盤操作、折射層級 | V12 |
| iOS Simulator（本機已有 iOS 27.0 runtime；iOS 17 的 runtime 需另外下載） | M0a 第一輪；沒有 iOS 17 實機時也用來補 iOS 17 | 先在 localhost 跑一輪，再部署 HTTPS 預覽網址用實機；Simulator 沒有相機，掃描功能不在這裡測 | 無 |

iPhone 實機測試 SW 需要 secure context，`http://` 加區網 IP 不算，所以 M0a 用 Cloudflare 的 HTTPS 預覽網址；正式網域（`ledgerland.swift.moe`，D4）接上之後，iOS 26、27 與 17 各在正式網域上再做一次冷啟動與離線檢查。

---

## 11. 參考來源（查證日期 2026-10-20）

- WebKit：Safari 26 web app（https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/ ）、Safari 27.0 功能（https://webkit.org/blog/18325/webkit-features-for-safari-27-0/ ）、儲存政策（https://webkit.org/blog/14403/updates-to-storage-policy/ ）、2020 ITP（https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/ ）
- WebKit bugs：181849、250651、255596、264218、273827、292603、301756、301994、305546（https://bugs.webkit.org/ ）
- MDN browser-compat-data（manifest、display-mode、BeforeInstallPromptEvent、StorageManager、launch_handler）：https://github.com/mdn/browser-compat-data
- MDN 儲存配額與淘汰：https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- vite-plugin-pwa 文件：https://vite-pwa-org.netlify.app/ ；Workbox v7 原始碼：https://github.com/GoogleChrome/workbox/tree/v7
- Chrome 可安裝條件：https://web.dev/articles/install-criteria ；安裝提示：https://web.dev/learn/pwa/installation-prompt
- Lighthouse 12 與 13：https://github.com/GoogleChrome/lighthouse/releases/tag/v12.0.0 、https://developer.chrome.com/blog/lighthouse-13-0
- Core Web Vitals：https://web.dev/articles/vitals
- Cloudflare Workers Static Assets（D4 採用的主機）與 SPA 模式：https://developers.cloudflare.com/workers/static-assets/ 、https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/ 、https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- 比較過、未採用的主機：Cloudflare Pages（https://developers.cloudflare.com/pages/ ）、GitHub Pages 限制（https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits ）

---

## 建議新增的待確認

以下項目目前沒有對應的編號，建議由 PLAN.md 的總表統一編號：

- iOS 主畫面 App 從背景回到前景時，是否會自動觸發 Service Worker 更新檢查（決定 `visibilitychange` 補呼叫是否必要）。屬於實機驗證。
- iPhone 上的 Chrome、Edge 等瀏覽器加入主畫面的實際步驟與結果（是否同樣以 web app 開啟、是否與 Safari 分頁共享儲存）。屬於實機驗證。
- iOS 26、27 在 Compact 與 Top／Bottom 分頁列版面下，「加入主畫面」的實際步驟與按鈕位置（圖解教學的依據目前只有第三方教學），以及從 iOS 18 升級的裝置是否保留原本的分頁列設定。屬於實機驗證。
- iOS 26、27 主畫面 App 中，`navigator.share({ files })` 分享 JSON 時是否出現「儲存到檔案」，以及 `<a download>` 是否正常。屬於實機驗證。
- 給老師分享用的連結是否加上 LINE 的「以外部瀏覽器開啟」參數：先查證 LINE 現行行為，再由我決定。
- Safari 26 擴大套用的進階指紋保護，是否影響第一方學習網站的 localStorage 或 IndexedDB 存活時間（目前只知道它針對已知的指紋腳本）。屬於查證。
- iOS 17、26、27 的主畫面 App 與 Safari 分頁中，`getUserMedia` 的相機權限提示頻率（是否每次啟動都重新詢問）、拒絕後如何重新允許，以及後鏡頭的選擇是否可靠（App 內掃描課堂 QR，4.9）。屬於實機驗證。
- Cloudflare Workers 的 `single-page-application` 模式下，非導覽請求（舊的 chunk、內容 JSON）找不到檔案時回 404 還是殼層 HTML（3.5、9.1）。屬於部署後實測。
- 使用者決定：D8 只決定正式支援 iOS 17，iOS 16.4 到 16.x 目前寫成「能用，不列入測試」（第 1 節）；是否也要正式支援，需要另外決定。
