# 09 技術選擇、資料夾結構與 repo 初始化

這份文件說明 LedgerLand 要用哪些技術、鎖定哪些版本、採用哪一條框架路線、部署到哪個主機，以及資料夾結構與套件切分、專案隔離環境與重新部署、repo 初始化步驟、CI 與安全隱私的設計；本文件牽涉的 D3 到 D8 與 D10 相關子項都已在 2026-10-20 決定，內文已依決定改寫。版本與平台事實都以 2026-10-20 的查證為準，事實核對（factcheck）的更正優先於原始研究；建議版本一律選「發布滿兩週」的版本，也就是 2026-10-06 以前發布者。這是規劃文件，以下內容都還沒有實作，也還沒有安裝任何套件或執行 `git init`。

## 確定要做

- 以 React 19.3.0、TypeScript 6.0.3（精確鎖定）、Vite 8.3.3 以上為基礎；路由用 React Router 8.4.0 的 data mode，PWA 用 vite-plugin-pwa 2.0.0（已決定 D5，第 3 節）。中文在根路徑、英文在 `/en/`，先不預先產生 HTML。
- 套件管理用 pnpm 11.28.5，在 `pnpm-workspace.yaml` 設定 `minimumReleaseAge: 20160`（20,160 分鐘，也就是 14 天）與 `trustPolicy: no-downgrade`，讓「只用發布滿兩週的版本」由工具自動執行；`minimumReleaseAgeExclude` 的每一條都要記錄安全公告編號與到期日，到期後由 CI 提醒移除。
- Node.js 用 24 LTS，`engines` 最低寫 22.22.0；不依賴 Corepack，CI 用 `pnpm/action-setup` 搭配 `packageManager` 欄位。
- GitHub Actions 的每一個 action 都用完整的 commit SHA 釘版。
- 型別檢查以 `tsc`（TypeScript 6.0.3）的結果為準；Oxlint 的 type-aware 檢查只當輔助。
- 介面字串用 Lingui 6.9.0。原生 macroTransform 先在 M0a 驗證，不通過就改用 Babel 外掛（第 5 節，【待實測 V09】）。CI 明確執行缺翻譯檢查，不依賴任何預設值。
- Zod 4 是唯一的 schema 來源，並輸出 draft-07 的 JSON Schema；Zustand 管介面與作答狀態；idb 管 IndexedDB。
- 測試：Vitest 5、fast-check 性質測試、Playwright 1.63 以上（含 WebKit 專案與 `reducedMotion: 'reduce'` 專案；1.64 在 2026-10-21 滿兩週，建議 M0b 採用）、axe 自動檢查、lighthouse 13 CLI。
- 資料夾採 pnpm workspace，每個目錄都寫明用途與是否 commit（第 8 節）；`references/` 永遠不 commit。
- 已決定（2026-10-20）：網站與未來的 App 放在同一個 repo（monorepo）。根目錄保持精簡，程式依「app」（`apps/web`、M7 的 `apps/admin`、預留的 `apps/mobile`）與「共用套件」（`packages/tokens`、`i18n`、`content-schema`、`core`、`quiz`、`progress`、`web-ui`）分層；npm 套件名稱一律 `@ledgerland/<資料夾名>`；依賴只能往下、不能循環，`packages/` 永遠不引用 `apps/`；除了 `web-ui`，其他套件都是純 TypeScript，由 tsconfig、lint 與依賴方向檢查三道機制把關（第 8 節，已決定六）。
- 已決定（2026-10-20）：學習端的 wrangler 設定從根目錄移到 `apps/web/wrangler.jsonc`，每個要部署的 app 自己帶部署設定；Worker 名稱維持 `ledgerland`（第 7.3 節）。
- 已決定（2026-10-20）：套件、工具與快取都裝在專案自己的資料夾裡（`.pnpm-store/`、`.cache/`），不做全域安裝，整個環境可以刪掉重建；重建與部署需要的東西都在 repo 裡，部署維持 GitHub Actions 執行 wrangler，不使用 Cloudflare 儀表板的 Git 整合（Workers Builds）（第 7.5 節，已決定七）。
- repo 公開（已決定 D3）。repo 初始化依第 9 節的固定步驟在 M0b 執行；`.gitignore` 只用附加的方式補充，不整份取代。附加的規則包含 `docs/plan/01-materials.md`、`docs/plan/13-material-questions.md` 與 AI 設定的整段排除規則；這些檔案都留在原位、只存在本機，不搬移；不使用 `docs/private/`。
- 主機用 Cloudflare Workers Static Assets，正式網域 `ledgerland.swift.moe`，base path 為 `/`（已決定 D4）。用 `_headers` 設定 CSP、`frame-ancestors` 與快取；深層連結以 SPA fallback 回傳殼層 `index.html`（狀態碼 200）；PR 有預覽網址；部署用 wrangler（第 7 節）。GitHub Pages 不使用。
- 授權（已決定 D6）：根目錄 `LICENSE` 為 MIT（程式碼）；原創教學內容用 CC BY-SA 4.0，全文放在 `LICENSES/`；老師的故事情境與金額不在 CC 授權範圍內，標示「經陳彥宏老師授權使用」；名稱與標誌另外保留，寫在 `NOTICE`（第 8 節，細節見 [11 風險與授權](11-risks-license.md) 第 4 節）。
- 流量統計（已決定 D7）：M0b 一併加入不用 cookie、不收集個資的統計；服務在 M0b 開工前查證後提出（候選：Cloudflare 的網頁分析）。同步修改 CSP 的 `script-src` 與 `connect-src`、隱私說明頁與 debug 頁，統計腳本不得影響離線使用與效能預算（第 11 節）。
- 正式支援 iOS 17（已決定 D8）：browserslist 納入 iOS 17，建置時自動補 `-webkit-` 前綴；Tab bar 的完整 `nav`（五個連結、圖示、中文標籤）直接寫在初始 HTML 殼層，英文頁由緊接在 `nav` 之後的殼層在地化腳本在首次繪製前改成英文；M0a 的實機測試加一台 iOS 17 裝置（第 3.2 節、第 6.8 節）。
- CI 包含 lint、型別檢查、單元與性質測試、內容驗證、i18n 檢查、建置、體積預算、Lighthouse、Playwright 與 axe、部署到 Cloudflare（第 10 節）。已決定（2026-10-20）：CI 只跑受影響的套件（`pnpm --filter "...[origin/main]"`），部署只在 `apps/web` 或它依賴的套件有變動時執行（`apps/web` 的建置輸入 `content/`、`schemas/`、`tools/` 有變動也算，所以只改內容時同樣執行 `content:check` 並部署）；hygiene 工作執行依賴方向檢查與純 TypeScript 套件的 DOM 禁用檢查。
- 安全與隱私：完整的 CSP 寫在 `_headers`；除了 D7 的統計服務之外不載入任何第三方資源；受控運算式不使用 `eval` 或 `new Function`；`sw.js` 路徑固定；部署一律整批替換；提供隱私說明頁（第 11 節）。
- 管理後台在 M7 建置（已決定 D10(e)）：Cloudflare Access 加 Workers 加 D1，放在獨立的 origin，與學習端分開部署（第 11.3 節，架構見 [08 題庫與後台](08-content-admin.md)）。
- App 內掃描課堂 QR（D10(a)，M2）：內建 JS 解碼器並取得相機權限，`Permissions-Policy` 只對本站開放 `camera=(self)`，解碼器選型在 M2 開工前查證（第 6.9 節）。
- M6 的 Excel 匯入（D10(d)）先做本機匯入指令。不可以 `npm i xlsx`；需要讀 Excel 時，改用 read-excel-file，或 SheetJS 0.20.3 的 vendored tarball（第 6.7 節）。

## 需評估

本文件沒有需評估的項目。原本的五項評估（D5、D4、D3、D7、D8）都已在 2026-10-20 決定，決定內容已併入「確定要做」與各節；以下保留每一項的決定、做法與未採用的選項，供日後查考。已決定六與已決定七是你在 2026-10-20 另外提出的需求與決定（repo 結構、隔離環境與部署），沒有 registry 編號。唯一還沒決定的是 `apps/mobile` 的技術，屬於沒有 registry 編號、由你決定的事項，建議 M3 完成後決定（見已決定六與 [14 待確認](14-open-questions.md) 第 5.2 節）。

### 已決定一：框架路線與網址策略（D5）

- 已決定（D5，2026-10-20）：C，中文在根路徑、英文在 `/en/`。先不預先產生 HTML；框架採 React Router 8 data mode 加 vite-plugin-pwa（原 A 案的技術路線），細節見第 3.2 節。
- 理由：主機採 Cloudflare Workers（D4），沒有對應檔案的路徑可以用 SPA fallback 以狀態碼 200 回傳同一份殼層 `index.html`，帶 `/en/` 的深層連結不必預先產生 HTML 也能直接開啟；data mode 加 vite-plugin-pwa 是 Lingui 與 vite-plugin-pwa 官方文件示範的組合，整合風險最低，`index.html` 的 inline 內容固定，CSP 雜湊也固定。
- 影響：
  - 路由同時接受沒有語系段的中文網址與 `/en/` 開頭的英文網址；語系以網址為準，boot 腳本在首次繪製前依路徑寫入 `html lang`（第 3.2 節，規則見 [05 多語系](05-i18n.md) 第 7 節）。
  - 作答狀態放在路由外的 Zustand store，作答中切換語言時保留題目、已選選項、計時與捲動位置（第 3.1 節）。
  - Cloudflare 的 SPA fallback 回傳的一定是殼層 `index.html`；本案沒有語言選擇頁，根路徑 `/` 用的也是同一份殼層。
  - 【待實測 V08】暫不需要；M0a 仍要驗證 macroTransform（第 5 節，【待實測 V09】）與 CSP 雜湊（第 11.1 節，【待實測 V15】）。
  - 搜尋收錄：只有一份 HTML，內容由用戶端產生，公開頁面的收錄有限（hreflang 的處理見 05）。日後若要加強搜尋收錄，再評估預先產生 HTML（第 3.3 節）。
- 未採用的選項：A 不帶前綴（英文頁沒有自己的網址，無法分別收錄與分享）；B 全站 `/zh-TW/`、`/en/` 前綴（中文網址與 QR 都變長，根路徑還要另外設計）。原本 B、C 搭配的 framework mode 加 prerender 改列為日後再評估（第 3.3 節），理由是沒有官方 PWA 整合、fallback 要特別處理、CSP 要逐頁計算雜湊，是整個技術組合中最大的整合風險。

### 已決定二：主機與正式網域（D4）

- 已決定（D4，2026-10-20）：正式網域 `ledgerland.swift.moe`（`swift.moe` 的 DNS 在 Cloudflare，2026-10-20 查證），主機用 Cloudflare Workers Static Assets，base path 為 `/`。
- 做法：
  - 用 `_headers` 設定 CSP、`frame-ancestors` 與快取（第 11.1、11.2 節），`frame-ancestors` 因此能以 header 生效。
  - `not_found_handling = "single-page-application"`，深層連結回傳殼層 `index.html`，狀態碼 200（第 7.3 節）。
  - 用 `wrangler deploy` 整批部署（第 7.4 節）；PR 用 Workers 的預覽網址測試（第 10.1 節）。
  - base path 已定為 `/`，CI 不再以根路徑與子路徑各建置一次。
  - M0a 的技術驗證可以先用暫時的 HTTPS 預覽網址（例如 `workers.dev`），資料一律視為測試資料；正式網域確定後才印發給學生的 QR（第 7.1 節）。
- 未採用的選項：
  - GitHub Pages：不使用。不能自訂 header（CSP 只能用 meta，無法設定 `frame-ancestors`）、深層連結第一次開啟回 404、沒有 PR 預覽，而且 `swiftruru.github.io` 這個 origin 已被你其他的專案共用。
  - Cloudflare Pages：可以接外部 DNS 的子網域，但 Cloudflare 官方建議新專案改用 Workers，而 `swift.moe` 的 DNS 本來就在 Cloudflare。
  - 學校子網域：DNS 不在 Cloudflare，不能當 Workers 的自訂網域；另購網域：多一筆年費與管理。
  - 三種主機的比較表保留在第 7.2 節，作為決定時的依據。

### 已決定三：repo 公開與教材衍生內容（D3）

- 已決定（D3，2026-10-20）：repo 公開。`docs/plan/01-materials.md` 與 `docs/plan/13-material-questions.md` 留在原位，以 `.gitignore` 排除、只存在本機（由你備份），不搬移任何檔案；不使用 `docs/private/`。
- 目前事實（2026-10-20 查詢）：專案資料夾還不是 git repo；GitHub 上的 `swiftruru/ledger-land` 是公開的空 repo。第一次 push 就等於公開，而且 git 歷史無法撤回。
- 影響：
  - 第 9 節第 3 步附加的 `.gitignore` 規則加入這兩個檔案，並保留 AI 設定的整段排除規則；第 4、5、7 步與 CI 的 hygiene 檢查都把這兩個檔案列入比對；第 9 步的 push 就是公開。
  - 測試仍用自編數字。老師的故事情境與金額只出現在內容資料中（D2 已同意，屬於公開內容），repo 內只對故事資料做性質測試；與老師 Excel 的逐格比對只在本機執行（`*.local.test.ts`，第 8 節）。
  - repo 公開與網站能不能被開啟是兩件事：部署出去的網址（包括 M0a 的暫時網址與 PR 預覽）本來就任何人都能開啟。另外，公開 repo 中的內容草稿一建立就公開（見 [08 題庫與後台](08-content-admin.md)）。
- 未採用的選項：(a) repo 先改私有（M8 公開前要稽核整個 git 歷史，私有 repo 的 Actions 也有免費分鐘數上限；改為直接排除兩份教材衍生文件即可）；(b) 原案的 `docs/private/` 資料夾（要搬移檔案，而且放錯位置就會永久留在公開歷史；改為在原位以 `.gitignore` 排除）。

### 已決定四：流量統計（D7）

- 已決定（D7，2026-10-20）：一開始就加入不用 cookie、不收集個資的流量統計，M0b 一併建置。服務在 M0b 開工前查證後提出，候選是 Cloudflare 的網頁分析（與 D4 的主機同一家）。
- 影響：
  - CSP 的 `script-src` 與 `connect-src` 加上查證後的統計網域（第 11.1 節）；統計服務若在第三方網域，在第 11.3 節記錄「不載入第三方資源」的這一條例外。
  - 統計腳本只在正式網域把資料送到正式統計端點（CI 的效能量測載入同一支腳本但指向 stub 端點，讓它的成本計入預算），一律在頁面載入完成之後才插入，失敗一律忽略，不進 precache，不得影響離線使用與首次載入的效能預算（第 11.3 節的載入方式、第 10.2 節的檢查）。
  - 隱私說明頁寫明服務名稱與收集的內容（第 11.4 節）；debug 頁顯示統計是否啟用與送出的內容（見 [06 PWA 與響應式](06-pwa-responsive.md)）。
  - 學生或學校對任何追蹤都比較敏感，所以隱私頁的說明要具體，不寫模糊的「可能收集」。
- 未採用的選項：(a) 不加（看不到使用量，無法知道哪些章節最常用）；(c) 只看主機後台的匯總流量（粒度粗，看不到單頁應用內的導覽）。

### 已決定五：正式支援 iOS 17（D8）

- 已決定（D8，2026-10-20）：A（本文件原本的選項 (a)），正式支援 iOS 17。
- 背景（依 Safari 18 release notes 與 MDN browser-compat-data，查證日期 2026-10-20）：
  - 無前綴的 `backdrop-filter` 從 Safari 18 才支援，iOS 17 以下要寫 `-webkit-backdrop-filter`。
  - Safari 18 才修正「頁面載入後才插入的元素不套用 blur」（129517679）與 border-radius 邊框區域的問題（122295068）。Tab bar 若由 React 掛載後才插入，在 iOS 17 以下可能完全沒有模糊效果。
  - 同文件的 View Transitions 從 Safari 18 起支援，iOS 17 上沒有轉場動畫（只影響視覺，不影響功能）。
  - Vite 8 預設的 `build.target` 是 `baseline-widely-available`，對應 Safari 16.4 與 iOS 16.4，已涵蓋 iOS 17，不必調整。
- 做法：
  - browserslist 納入 iOS 17，由 Lightning CSS 或 Autoprefixer 依 browserslist 自動補 `-webkit-backdrop-filter`；CI 檢查建置後的 CSS 確實有前綴版本（第 6.8 節）。
  - Tab bar 帶 `backdrop-filter` 的完整 `<nav id="ll-tabbar">`（五個連結、regular 與 fill 兩套圖示、中文標籤）直接寫在初始 HTML 殼層 `index.html`；緊接在 `nav` 之後有一段 inline 的殼層在地化腳本，在首次繪製前把英文頁（`/en/`）的標籤、`href` 與 `aria-label` 換成英文。React 不建立也不替換 `nav` 與其子元素，只更新 `aria-current`、標籤文字、`href` 與收合狀態；不使用 React portal（第 3.2 節，標記、樣式與 Tier 判斷見 [07 設計系統](07-design-system.md) 第 6.1 節與 [06 PWA 與響應式](06-pwa-responsive.md) 第 2.3 節）。
  - M0a 的實機測試加一台 iOS 17 裝置，玻璃外觀與 Tier 判斷一併驗證；沒有實機時用 Simulator 補，並在報告註明。Playwright 內建的 WebKit 是新版引擎，模擬不了舊版 iOS。
- 未採用的選項：(b) 只保證可用、iOS 17 以下一律走實色（舊手機看不到玻璃效果）；(c) 不支援並提示更新 iOS（會擋掉還沒升級的同學）。

### 已決定六：repo 結構與套件切分（2026-10-20）

- 已決定（2026-10-20）：網站與未來的 App 放在同一個 repo（monorepo，pnpm workspace）。根目錄保持精簡，只留工具必須在根目錄才找得到的檔案；程式依「app」與「共用套件」分層（資料夾樹與各路徑的用途見第 8 節）。
- 做法：
  - `apps/web` 是學習端 PWA，帶自己的 wrangler 設定 `apps/web/wrangler.jsonc`（原本放在根目錄的 `wrangler.json` 移到這裡，第 7.3 節）；`apps/admin` 在 M7 才建立，有自己的 `apps/admin/wrangler.jsonc`，是另一個 Worker；`apps/mobile` 預留，App 技術選定後才建立，現在不建立空資料夾。
  - 共用套件：`packages/tokens`、`packages/i18n`（原名 `i18n-config`，已決定改名）、`packages/content-schema`、`packages/core`、`packages/quiz`、`packages/progress`、`packages/web-ui`。各套件放什麼、不放什麼與建立的里程碑見第 8.1 節。
  - npm 套件名稱一律 `@ledgerland/<資料夾名>`（例如 `@ledgerland/core`）。每個套件有 `src/`、`test/`、`package.json`（`exports` 直接指向 `src`，不另外 build）、`README.md`（寫明範圍與允許的依賴）；套件在需要時才建立，用同一份套件樣板。
  - 依賴只能往下、不能循環，`packages/` 永遠不引用 `apps/`（依賴方向見第 8.2 節）。除了 `web-ui`，其他套件都是純 TypeScript（不碰 DOM、不碰 React、不用 Node 專屬 API），由 tsconfig、lint 規則與 `tools/` 的依賴方向檢查三道機制自動把關（第 8.3 節）。
  - 已決定（2026-10-20）：`packages/web-ui` 在 M0b 就建立（你的選擇），元件一開始就寫在這裡，後台日後直接使用。
  - `packages/core` 只放會計；多正解題判分 `scoreMultiChoice`（從 04 原本 `core` 的判分子目錄移過來）、數字題比對、分錄題計分、星星與錯題本排程改放 `packages/quiz`（分錄的正規化比對仍留在 `core`）。
  - 設計 token 改以 `packages/tokens` 的 TypeScript 原始檔為唯一來源，建置時產生 CSS 變數檔、TS 常數、manifest 色碼與首次繪製背景色（見 [07 設計系統](07-design-system.md) 第 2.1 節）。
  - `web-ui` 有自己的 Lingui 字串檔，`apps/web` 的字串檔只放頁面與殼層的文字，兩者在載入時合併（第 5 節）。
- 尚未決定：`apps/mobile` 的技術（Capacitor 包裝網站、React Native 的 Expo、原生 Swift／Kotlin）現在不選，建議在 M3 完成後決定；這是沒有 registry 編號、由你決定的事項（見 [14 待確認](14-open-questions.md) 第 5.2 節）。比較重點：Capacitor 工作量最小，畫面直接用 `apps/web` 的建置結果，進度可存原生儲存而避開 Safari 的清除規則與分頁／主畫面不共享的風險，但 App Store 審查準則 4.2（最低功能要求）對只是包裝網站的 App 較嚴；Expo 有原生手感並能用 iOS 原生玻璃元件，但畫面要重寫一次，Hermes 引擎的 Intl 支援要查證；原生 Swift／Kotlin 要用別的語言重寫會計核心，單人維運不建議。選定技術後，在 `apps/mobile` 做小型試作，比照 M0a 先驗證再開工。
- 影響：M0b 的完成標準加入結構驗收（從乾淨的 clone 安裝、全部套件的型別檢查與測試、依賴方向與 DOM 禁用檢查、`apps/web/dist/` 的建置產物、在 `apps/web` 用 `wrangler dev` 確認深層連結與 `_headers`、PR 預覽網址上的 E2E、`web-ui` 的字串抽取與編譯），見 [10 里程碑](10-milestones.md)。

### 已決定七：專案隔離環境與部署方式（2026-10-20）

- 已決定（2026-10-20）：套件、工具與快取都裝在專案自己的資料夾裡，不做全域安裝，整個環境可以刪掉重建（和 Python 的 `.venv` 一樣）；程式相關內容一律不寫到 `ledger-land/` 以外（你的規則，2026-10-20）。做法見第 7.5 節。
- 已決定（2026-10-20）：重建與部署需要的東西都在 repo 裡，不依賴任何人電腦上的狀態；部署維持 GitHub Actions 執行 wrangler（第 10 節），平常由 CI 在 main 通過檢查後自動部署。
- 代價：不同專案之間不共用快取，比較佔硬碟空間。
- 你要手動做的事只有兩次：M0a 部署預覽前執行一次 `wrangler login`；M0b 第一次正式部署前建立 API token 並存進 GitHub repo 的 Actions secrets（第 7.5 節）。之後任何目錄調整都不需要手動改 Cloudflare 設定。
- 未採用的選項：Cloudflare 儀表板的 Git 整合（Workers Builds）。採用它就要在儀表板設定根目錄、建置指令與部署指令，之後每次搬目錄都要手動改；而 GitHub Actions 讓部署前的 CSP 雜湊檢查與測試在同一條流程，目錄調整只改 repo 裡的 wrangler 設定與 workflow。

---

## 1. 技術選擇總表

「版本」欄是 2026-10-20 查證時，符合兩週規則的建議版本與發布日。標「未查證」的套件，版本在 M0b 依兩週規則選定，不在這裡臆測。

| 領域 | 建議 | 版本（發布日） | 理由 | 替代方案 |
| --- | --- | --- | --- | --- |
| 執行環境 | Node.js 24 LTS；`engines` 寫 `>=22.22.0` | 24.x（patch 於 M0b 選發布滿兩週者） | React Router 8 需要 22.22 以上，Lighthouse 13 需要 22.19 以上；Node 20 已於 2026-03-24 結束支援 | Node 22 LTS（可用）；Node 26（目前是 Current，轉 LTS 的日期官方頁面未列） |
| 套件管理 | pnpm（workspace） | 11.28.5（2026-10-06） | 內建 `minimumReleaseAge`、`trustPolicy`；pnpm 11 是成熟的 JS 實作；store 與快取放在 repo 內（第 7.5 節） | pnpm 12（2026-08-26 推出的 Rust 改寫版，約 8 週，建議 2027 年初再評估）；npm、Yarn |
| UI | React 與 react-dom | 19.3.0（2026-09-09） | 穩定版 `<ViewTransition>`、`addTransitionType`、`browser()`；符合 React Router 8 要求的 19.2.7 以上 | 19.3.1（2026-10-14，只改了 RSC 傳輸，滿兩週後再升） |
| 語言 | TypeScript，精確鎖定 | 6.0.3（2026-04-16） | 7.0 沒有 programmatic API，typescript-eslint 只支援到 6.0；詳見第 2.3 節 | TypeScript 7.0.2（2026-07-08），以官方 alias 選用 |
| 建置 | Vite 8 | 8.3.3 以上（8.3.3 發布於 2026-10-06） | Rolldown 加 Oxc；8.3.3 修補了 2026-10-06 公布的三則 dev server 安全公告 | Vite 7.3.7（只修重要與安全問題的版線） |
| 路由 | React Router 8（`react-router`）的 data mode（已決定 D5） | 8.4.0（2026-09-15） | `createBrowserRouter` 加 lazy route；中文在根路徑、英文在 `/en/`；v8 已移除 `react-router-dom`，一律從 `react-router` 與 `react-router/dom` 匯入，只出 ESM | 8.5.0（2026-10-19，未滿兩週）；framework mode 加 prerender（日後再評估，見第 3.3 節）；TanStack Router（見第 4 節） |
| React 外掛 | `@vitejs/plugin-react` | 6.1.2（2026-10-05） | v6 起不依賴 Babel，改用 Oxc 處理 React Refresh | `reactRouter()` 外掛（只在日後改用 framework mode 時使用） |
| PWA | vite-plugin-pwa，generateSW，`registerType: 'prompt'` | 2.0.0（2026-10-03） | 官方 Vite 整合；不自動 skipWaiting 的更新流程 | injectManifest（需要自訂 SW 邏輯時）；workbox-build 7.4.1（2026-05-04，只在日後改用 framework mode 時需要，見第 3.3 節） |
| CSS 前綴 | Lightning CSS 或 PostCSS 加 Autoprefixer，依 browserslist 補前綴（已決定 D8） | 未查證，M0a 選定 | browserslist 納入 iOS 17，自動補 `-webkit-backdrop-filter`（第 6.8 節） | 手寫前綴（容易漏，不採用） |
| 圖示產生 | @vite-pwa/assets-generator | 2.0.0（2026-09-12） | 產生 favicon、maskable、apple-touch-icon；Apple 啟動畫面為選用 | 手動產生 |
| 介面字串 | Lingui（`@lingui/core`、`@lingui/react`、`@lingui/cli`、`@lingui/vite-plugin`） | 6.9.0（2026-10-01） | runtime 約 2.03 kB 加 1.24 kB（gzip）；ICU 複數、PO catalog、抽取與缺字檢查、依語系動態載入 | Paraglide JS 2、i18next 26、react-intl 12（見第 6 節） |
| Schema | Zod 4 | 4.6.5（2026-09-13） | 一份 schema 同時負責建置期驗證、輸出 draft-07 JSON Schema、匯入備份時的執行期驗證 | Valibot 1.5.0（體積更小）、ArkType 2.2 |
| 狀態 | Zustand | 5.0.15（2026-08-13） | 約 0.49 kB；作答狀態放在 store，不綁在路由參數上，切換語言不會遺失 | Jotai 3（2026-09 剛發 major） |
| 本機儲存 | idb | 8.0.4（2026-10-06，剛滿兩週） | 有型別的 DBSchema 與 upgrade callback，約 1.19 kB（brotli） | Dexie 4.4.6（約 31 kB gzip，需要索引查詢時再考慮）；idb-keyval 6.3.0 |
| 動畫 | CSS 加 View Transitions；React 19.3 的 `<ViewTransition>` 只包住內容區 | 隨 React | iOS 26 支援同文件與跨文件 View Transitions；一律尊重減少動態效果 | Motion 14.0.0（2026-10-02，選用，只透過 `LazyMotion` 加 `m` 局部載入） |
| 拖放（選用） | `@dnd-kit/react`，包在自家 adapter 後面 | 0.5.0（2026-06-11） | 點選與鍵盤是必備操作，拖放是漸進增強；iOS 拖曳偏移【待實測 V07】 | Pragmatic drag and drop 4.0.0（備案）；舊版 `@dnd-kit/core` 已停止更新，不用 |
| 單元測試 | Vitest 與 `@vitest/browser-playwright` | 5.0.3（2026-10-06 以前發布） | Node 環境跑會計核心與 schema；Browser Mode 加 WebKit 跑元件 | Vitest 4.1 線 |
| 性質測試 | fast-check 與 `@fast-check/vitest` | 4.10.2（2026-09-19）與 0.5.0（2026-09-11） | 驗證借貸平衡、恆等式、現金流量等不變式 | 無 |
| E2E | `@playwright/test` | 1.63.0（2026-09-04，內含 WebKit 26.6） | iPhone 加 WebKit、桌機 Chromium、Firefox 三個專案，另有減少動態效果專案 | 1.64.0（2026-10-07，內含 WebKit 27.2，2026-10-21 起滿兩週，建議 M0b 時採用） |
| 無障礙自動檢查 | `@axe-core/playwright` | 未查證，M0b 選定 | 擋下 serious 與 critical 問題 | Lighthouse 無障礙分數（只當參考） |
| 效能 | lighthouse CLI | 13.5.0（2026-09-18） | 以 metric 做 assertion，每個網址跑 5 次取中位數 | `@lhci/cli` 0.15.1（內建的仍是 Lighthouse 12.6.1，audit ID 不同） |
| 實機量測 | web-vitals（只在 debug 頁載入） | 6.2.3（2026-10-05） | iPhone 上讀 LCP 與 INP（CLS 只有 Chromium 量得到） | Safari Web Inspector Timelines |
| 體積預算 | size-limit 或自寫腳本 | 未查證，M0b 選定 | 首次載入 JS 暫訂 gzip 後 150 KB，從 M0b 起由 CI 把關 | 無 |
| Lint | Oxlint 加 oxlint-tsgolint | oxlint 1.87.0（研究建議值，發布日 M0b 確認）；oxlint-tsgolint 7.0.2003（2026-09-24） | 一套工具涵蓋 TypeScript、React Hooks、jsx-a11y、import、vitest 規則，沒有 ESLint 10 的 peer 衝突 | ESLint 10（jsx-a11y 官方套件不支援 ESLint 10，要用 fork）；Biome 2.5 |
| 格式化 | Prettier | 3.9.9（研究建議值，發布日 M0b 確認） | 成熟穩定 | Oxfmt（仍是 0.x beta，1.0 之後再評估） |
| 圖示 | Phosphor（MIT，線條與實心成對） | 未查證，M0b 選定 | 開源授權，打包進站內，不從 CDN 載入 | 其他 MIT 圖示庫；不用 SF Symbols |
| 主機與部署 | Cloudflare Workers Static Assets，用 wrangler 部署（已決定 D4） | wrangler 未查證，M0b 依兩週規則選定（列在 devDependencies） | `_headers` 設定 CSP 與快取；SPA fallback 回 200；有預覽網址；靜態請求免費且不限量；設定檔在 `apps/web/wrangler.jsonc`（第 7 節） | GitHub Pages、Cloudflare Pages（比較過，不使用，見第 7.2 節） |
| 流量統計 | 不用 cookie、不收集個資的統計服務（已決定 D7），候選 Cloudflare 網頁分析 | 外部服務，M0b 開工前查證 | 與主機同一家；只在正式網域、頁面載入後才插入腳本，不影響離線與效能預算（第 11.3 節） | 其他隱私友善的統計服務（查證時一併比較） |
| QR 解碼（M2） | JS 的 QR 解碼器加相機權限（D10(a)） | 未查證，M2 開工前選定 | Safari 沒有正式的 BarcodeDetector；只在掃描畫面 lazy 載入（第 6.9 節） | 只用系統相機掃 QR（D10(a) 已決定另外做 App 內掃描） |
| 管理後台（M7） | Cloudflare Access 加 Workers 加 D1（已決定 D10(e)） | 未查證，M7 開工前選定 | 與主機同一家；權限在伺服器端檢查；放在獨立 origin（第 11.3 節） | Sveltia、Decap、Supabase、Firebase（比較過，未採用，見第 4 節） |
| 金額運算 | 整數加自寫 helper（集中處理四捨五入） | 不需要套件 | 金額範圍在安全整數內；見 [04 會計核心](04-accounting-core.md) | dinero.js 2.0.2、big.js 7.0.1、decimal.js 10.6.0（目前都不需要） |
| 說明文字 | 受控標記在建置期編譯成 AST，用戶端不帶 Markdown parser | 不需要 runtime 套件 | 不允許原始 HTML，也不需要執行期解析 | react-markdown（約 34 kB gzip）、MDX（能執行任意 JS，不採用） |
| Excel 匯入（M6，D10(d)） | read-excel-file 或 SheetJS 0.20.3 vendored tarball；CSV 用 papaparse | read-excel-file 9.3.12（2026-10-07，2026-10-21 起才滿兩週）；papaparse 5.7.0（2026-08-24） | 見第 6.7 節 | exceljs（約 3 年沒有穩定版，不用）；npm 上的 `xlsx`（有漏洞，禁止） |

來源：https://registry.npmjs.org/react 、https://reactrouter.com/changelog 、https://vite.dev/releases 。查證日期 2026-10-20。

## 2. 版本與供應鏈政策

### 2.1 兩週規則的範圍

「只用發布滿兩週的版本」分成兩部分執行：npm 套件由 pnpm 的 `minimumReleaseAge` 自動擋下；工具管不到的部分（GitHub Actions、pnpm 本身、Node、Playwright 下載的瀏覽器、vendored tarball）用第 2.5 節的規則人工把關。

`minimumReleaseAge` 擋不住兩種情況，要另外處理：

1. 大版本升級：已經發布很久的新 major（例如 TypeScript 7.0.2）不會被擋。所以 TypeScript 精確鎖定，並在 CONTRIBUTING 寫明禁止不帶版本的 `pnpm add typescript`。
2. 安全修補：剛發布的修補版本會被擋，要寫進 `minimumReleaseAgeExclude`。

### 2.2 pnpm 設定

pnpm 11 的非驗證類設定只從 `pnpm-workspace.yaml` 或全域 `config.yaml` 讀取，不再讀 `.npmrc`。pnpm 11 另有兩個相關預設：`blockExoticSubdeps` 預設開啟；`allowBuilds` 取代舊的 build-dependency 設定。

```yaml
packages:
  - apps/*
  - packages/*
  - tools
minimumReleaseAge: 20160
trustPolicy: no-downgrade
minimumReleaseAgeExclude: []
storeDir: .pnpm-store
cacheDir: .cache/pnpm
stateDir: .cache/pnpm
```

- `storeDir`、`cacheDir`、`stateDir`：把 pnpm 的 store、快取與狀態都放在 repo 內，不寫到專案以外（已決定七，第 7.5 節）。
- `minimumReleaseAge: 20160`：pnpm 11 的預設值是 1,440 分鐘（1 天），這裡改成 14 天。
- `trustPolicy: no-downgrade`：和發布日期較早的版本相比，若某個版本的信任等級下降（例如之前的版本有可信發布或 provenance，這一版沒有），就讓安裝失敗（pnpm 10.21 起支援，可設 `no-downgrade` 或 `off`）。
- `minimumReleaseAgeExclude`：可以寫套件名稱、pattern，或用 `||` 列出特定版本（pnpm 10.19 起支援）。這裡只放「有安全公告的特定版本」，不放整個套件。

每一條例外都要在 `tools/release-age-exceptions.json` 留下對應紀錄。CI 的 hygiene 工作會比對兩邊：`pnpm-workspace.yaml` 有、紀錄檔沒有的條目讓 CI 失敗；超過 `expires` 的紀錄也讓 CI 失敗，提醒移除。下面是格式範例，內容是虛構的佔位值，不是實際條目：

```json
{
  "exceptions": [
    {
      "entry": "example-package@1.2.3",
      "advisory": "GHSA-xxxx-xxxx-xxxx",
      "reason": "安全修補版本，發布未滿兩週",
      "added": "2026-11-01",
      "expires": "2026-11-15"
    }
  ]
}
```

`expires` 設為該版本自然滿兩週的日期；到期後這條例外就沒有必要，移除即可。

根目錄 `package.json` 的重點欄位：

```json
{
  "name": "ledger-land",
  "private": true,
  "license": "MIT",
  "type": "module",
  "packageManager": "pnpm@11.28.5",
  "engines": {
    "node": ">=22.22.0"
  },
  "devDependencies": {
    "typescript": "6.0.3"
  }
}
```

`license` 欄位只描述程式碼（D6）；原創教學內容的 CC BY-SA 4.0 與老師故事情境的授權說明寫在 `LICENSES/`、`content/` 的授權說明與 `NOTICE`（第 8 節）。`browserslist` 欄位見第 6.8 節。

pnpm 12 是 Rust 改寫版（2026-08-26），沿用 pnpm 11 的 lockfile，但 `pnpm-workspace.yaml` 有不認得的 key 時會直接失敗。目前 11.28.x 與 12.x 兩條版線並行維護，建議 2027 年初再評估是否升級。

來源：https://pnpm.io/settings/dependency-resolution 、https://pnpm.io/blog/releases/11.0 、https://pnpm.io/blog/releases/12.0 。查證日期 2026-10-20。

### 2.3 TypeScript 6.0.3 與 TypeScript 7

現況（2026-10-20）：npm 上 `typescript` 的 latest 是 7.0.2（2026-07-08 發布的 Go 原生實作）；6.x 最新是 6.0.3（2026-04-16）。

精確鎖定 6.0.3 的理由：

- TypeScript 7.0 沒有 programmatic API，官方預計 7.1 才推出新的 API。依賴 TypeScript API 的工具必須繼續用 6.0。
- typescript-eslint 8.72.0 的 peer 是 `>=4.8.4 <6.1.0`；eslint-plugin-lingui 0.16.0 的 peer 是 `^5 || ^6`。日後若要用這兩個工具，就只能用 TypeScript 6。
- `@react-router/dev` 8.4.0 的 peer 是 `^5.1.0 || ^6.0.0 || ^7.0.0`，不受影響（本站採 data mode，不安裝它；只在日後改用 framework mode 時才需要）。

tsconfig 從一開始就避開 TypeScript 7 會變成硬錯誤的設定：

- 不用 `target: "es5"`、`baseUrl`、`downlevelIteration`。
- `moduleResolution` 不用 `node`、`node10`、`classic`，改用 `bundler`。
- `module` 不用 `amd`、`umd`、`systemjs`、`none`。
- 不把 `esModuleInterop`、`allowSyntheticDefaultImports`、`alwaysStrict` 設成 `false`。
- 不用 namespace 的 `module` 關鍵字，也不用 import 的 `asserts` 語法。

TypeScript 7 的新預設值（`strict: true`、`module: "esnext"`、`types: []`、`noUncheckedSideEffectImports: true`、`rootDir` 為 `./`），現在就明確寫進設定，日後切換時行為不會改變。範例如下，M0b 依實際需要調整：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "noUncheckedSideEffectImports": true,
    "types": [],
    "skipLibCheck": true,
    "noEmit": true
  }
}
```

這是 `tsconfig.base.json` 的共用部分；`rootDir`、`include`、`jsx`、`lib` 等和目錄有關的設定，寫在各 package 自己的 tsconfig，並明確寫出 `rootDir`，不依賴預設值。

其他注意事項：

- 官方建議的並存方式是 alias：`"@typescript/native": "npm:typescript@^7.0.2"`。`@typescript/native` 只是別名，npm 上沒有這個套件，不能直接 `pnpm add @typescript/native`。M0b 不加入；等 TypeScript 7.1 推出 API 之後（預計 2027 年）再評估。
- oxlint-tsgolint v7 追蹤的是 TypeScript 7.0.2 的引擎，它是否內建自己的引擎，官方文章沒有說明。所以 CI 以 `tsc`（6.0.3）的結果為準，兩者不一致時記錄差異。
- CI 檢查 lockfile 中 `typescript` 解析到的版本必須是 6.0.3，防止有人不小心升到 7.x。

來源：https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ 、https://registry.npmjs.org/typescript-eslint 、https://registry.npmjs.org/@react-router/dev 。查證日期 2026-10-20。

### 2.4 Node.js 與 Corepack

- Node 24（Krypton）與 Node 22（Jod）是 LTS；Node 20 已於 2026-03-24 結束支援；Node 26 是 Current，官方頁面沒有列出轉 LTS 的日期。從 Node 27 起每年一個 major，而且每個 major 都會進入 LTS。
- 用 `.node-version` 寫 `24`，CI 的 `actions/setup-node` 讀這個檔案。`engines` 寫 `>=22.22.0`，這是各工具需求的最大值：React Router 8 要 22.22.0 以上、Lighthouse 13 要 22.19 以上、Vitest 5 要 22.12.0 以上、pnpm 11 要 22 以上。
- Node 25.0.0 起不再隨附 Corepack（官方 changelog 的 SEMVER-MAJOR 變更 #57617）。為了日後升級時不受影響，現在就不依賴 Corepack：pnpm 本身依 `package.json` 的 `packageManager` 欄位鎖定 11.28.5，本機請貢獻者自行安裝 pnpm 11.28.5，CI 用 `pnpm/action-setup`，它會讀 `packageManager` 欄位。
- 已決定（2026-10-20）：Node 也盡量隔離在專案內。M0b 查證 pnpm 11 能否在 `package.json` 宣告 Node 版本並自動下載到專案內；可行就採用，否則沿用版本管理工具加 `.node-version`。這是沒有 registry 編號的查證事項（見 [14 待確認](14-open-questions.md) 第 5.4 節；隔離環境的整體做法見第 7.5 節）。

來源：https://nodejs.org/en/about/previous-releases 、https://github.com/nodejs/node/blob/v26.x/doc/changelogs/CHANGELOG_V25.md 。查證日期 2026-10-20。

### 2.5 pnpm 管不到的版本

| 對象 | 鎖定方式 | 兩週規則怎麼執行 |
| --- | --- | --- |
| GitHub Actions 的 action | 一律寫完整 40 字元的 commit SHA，後面加上版本註解 | Renovate 或 Dependabot 設定 14 天冷卻期（設定名稱於 M0b 查證）；CI 用腳本檢查 workflow 裡沒有用 tag 或分支名稱引用 action |
| pnpm 本身 | `packageManager: "pnpm@11.28.5"` | 升級時人工確認發布日 |
| Node | `.node-version` 寫 major；patch 由 `actions/setup-node` 解析 | 升級 major 時人工確認 |
| Playwright 的瀏覽器 | 跟著 `@playwright/test` 的版本走 | 隨套件版本由 pnpm 把關 |
| vendored tarball（例如 SheetJS） | 放在 `vendor/`，`package.json` 以檔案路徑引用 | Dependabot 不會追蹤，要人工追版並記錄在 THIRD_PARTY_NOTICES |

workflow 的寫法範例（SHA 是佔位，實際值在 M0b 查出）：

```yaml
permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<完整 commit SHA> # vX.Y.Z
        with:
          persist-credentials: false
      - uses: pnpm/action-setup@<完整 commit SHA> # vX.Y.Z
      - uses: actions/setup-node@<完整 commit SHA> # vX.Y.Z
        with:
          node-version-file: .node-version
          cache: pnpm
      - run: pnpm install --frozen-lockfile
```

pnpm 的 store 放在 repo 內的 `.pnpm-store/`（第 7.5 節）時，CI 快取要怎麼設定（上例的 `cache: pnpm` 是否仍適用），在 M0b 查證（見 [14 待確認](14-open-questions.md) 第 5.4 節）。

## 3. 框架路線（已決定 D5）

已決定（D5，2026-10-20）：中文在根路徑、英文在 `/en/`；框架採 React Router 8 data mode 加 vite-plugin-pwa，先不預先產生 HTML。framework mode 加 prerender 改列為日後再評估（第 3.3 節）。

### 3.1 原則

- 網站設定只有一份（例如 `apps/web/site.config.ts`）：base path（已決定為 `/`）、Vite 的 `base`、React Router 的 `basename`、manifest 的 `id`、`scope`、`start_url`、SW 的 scope 都由它產生，不在多處各寫一次。base path 雖然已經定案，仍保留單一來源，萬一日後不得不搬家（第 7.1 節）只要改一處。
- 作答狀態（題目 ID、已選選項、計時、捲動位置）放在 Zustand store，不綁在路由參數上。中文與英文是不同網址，切換語言等於換網址；因為作答狀態在路由之外，作答中切換語言不會遺失。
- SW 的檔名固定為 `/sw.js`；CI 檢查建置產物裡一定有這個檔案（理由見第 7.4 節）。
- 更新採 prompt 模式：新版 SW 安裝好之後等待使用者同意，絕不自動 skipWaiting。流程細節見 [06 PWA 與響應式](06-pwa-responsive.md)。
- 讀取 IndexedDB 的元件用 React 19.3 的 `use(browser())` 包在 `<Suspense>` 裡。目前不預先產生 HTML，這個寫法不是必要；但日後若加入預先產生 HTML（第 3.3 節）就一定要這樣寫，所以從一開始就照這個寫法，日後不必改元件。
- React Compiler 預設不開，保持 Babel-free 的建置；真的遇到效能瓶頸再評估。

### 3.2 採用的路線：React Router 8 data mode 加 vite-plugin-pwa

- 路由：`createBrowserRouter` 搭配 lazy route，放在 `apps/web/src/routes/`。同一份路由定義要同時接受沒有語系段的中文網址（例如 `/level/lv_k7m2q9xd/`）與 `/en/` 開頭的英文網址（例如 `/en/level/lv_k7m2q9xd/`）：由同一個函式產生 `/` 與 `/en` 兩組路由（與 [02 網站架構](02-site-architecture.md) 第 1.2 節、05 第 7.4 節一致）。未採用的替代：選用的靜態路由段（`en?`），只在 M0a 發現兩組路由的寫法有問題時當作退路。語系段只接受 `packages/i18n` 登錄的值（網址的語系函式 `localeFromPath`、`stripLocale`、`localePath` 也在這個套件）；大小寫錯誤的語系段如何正規化，以 [05 多語系](05-i18n.md) 第 7 節為準。
- 語系以網址為準：`/en/` 開頭是 en，其餘是 zh-TW。只有根路徑 `/` 會依已存的偏好轉到 `/en/`（主畫面 App 的 `start_url` 是 `/`），其他網址與偏好不同時只顯示切換提示，規則見 05 第 7 節。
- Vite 外掛：`@vitejs/plugin-react` 6.1.2、`lingui()`（macroTransform）、`VitePWA()`。
- 建置輸出：單一 `index.html` 加上帶 hash 的 assets 與內容 JSON，中文與英文共用這一份殼層。`index.html` 的初始內容有四樣：
  - head 裡的 boot 腳本：合併了 07 的玻璃層級判斷、06 的 `isAppMode()`、主題與減少動態的判斷，以及 05 的語系判斷；它依網址在首次繪製前寫入 `html lang`（`index.html` 本身預設為 `zh-TW`）。
  - 一段首次繪製背景色的 `<style>`（見 [06 PWA 與響應式](06-pwa-responsive.md) 第 2.3 節）。
  - Tab bar 的完整 `<nav id="ll-tabbar">`（已決定 D8）：直接寫在 body 裡、React 根節點之外，含五個連結、regular 與 fill 兩套圖示與中文標籤，由建置腳本從同一份設定產生，避開 iOS 17 以下「載入後才插入的元素不套用 backdrop-filter」的問題。React 掛載後以 ref 取得 `#ll-tabbar`，只更新 `aria-current`、標籤文字、`href` 與收合狀態，不建立也不替換 `nav` 與其子元素，也不使用 React portal。標記與樣式見 [07 設計系統](07-design-system.md) 第 6.1 節，M0a 在 iOS 17 與 iOS 26 的實機上確認。
  - 緊接在 `nav` 之後的 inline 殼層在地化腳本：英文網址（`/en/` 開頭）時，在首次繪製前把 Tab bar 的標籤、`href` 與 `aria-label` 換成英文，並標出 `aria-current`（「跳到主要內容」連結的文字也一起改寫，見 06 第 2.3 節）；和 boot 腳本一樣由建置腳本產生，雜湊納入 CSP（第 11.1 節）。
  - `index.html` 裡任何元素（包括靜態 Tab bar 的標記）都不得有 `style` 屬性（第 11.1 節）。Tab bar 在 React 根節點之外，換頁時不會被重新建立，預期換頁後玻璃效果都能維持（M0a 在 iOS 17 實機上確認）。
- Lingui catalog：依網址的語系載入；en catalog 只在 `/en/` 開頭的網址或切換到英文時才動態載入，並和其他 chunk 一起進 precache，離線時也能切換語言。
- SW：vite-plugin-pwa 2.0.0 的 generateSW。generateSW 在不 skipWaiting 時，會自動內建 `SKIP_WAITING` 訊息的監聽。

```ts
import { VitePWA } from "vite-plugin-pwa";

export const pwa = VitePWA({
  strategies: "generateSW",
  registerType: "prompt",
  injectRegister: false,
  filename: "sw.js",
  workbox: {
    navigateFallback: "index.html",
    navigateFallbackDenylist: [/^\/assets\//, /^\/sw\.js$/],
    globPatterns: ["**/*.{html,js,css,woff2,svg,png,webmanifest,json}"],
    cleanupOutdatedCaches: true
  }
});
```

（`injectRegister: false` 表示由程式碼透過 `virtual:pwa-register/react` 的 `useRegisterSW` 註冊，好控制更新提示的時機。base path 已定為 `/`，fallback 與 denylist 不必再加前綴；中文與英文的導覽請求都由同一份 `index.html` 回應。D7 的統計腳本在其他網域，generateSW 預設不處理跨來源請求，也不放進 `globPatterns`，所以不會進 precache。）

- 主機 fallback：`index.html` 本來就是通用殼層。Cloudflare Workers 的 SPA fallback 對沒有對應檔案的路徑（包括 `/en/` 開頭的深層連結）都回傳它，狀態碼 200（第 7.3 節）。本案沒有語言選擇頁，不會發生 fallback 回傳語言選擇頁的問題。
- 結尾斜線：所有站內連結都帶結尾斜線（路由格式見 [02 網站架構](02-site-architecture.md)）。Workers 的 `auto-trailing-slash` 處理的是實際存在的 HTML 檔案；經由 SPA fallback 開啟、沒有結尾斜線的網址，由路由在用戶端以 `replace` 補上斜線（這是推論，M0a 確認）。CI 檢查站內連結都有結尾斜線。
- SEO：只有一份 HTML，內容由用戶端產生，公開頁面的收錄有限；hreflang 的處理方式見 05。日後若要加強搜尋收錄，再評估預先產生 HTML（第 3.3 節）。

### 3.3 日後再評估：framework mode（`ssr: false` 加 prerender）

目前不採用（D5 決定先不預先產生 HTML）。日後若要讓公開頁面（尤其英文版）被搜尋引擎收錄，再評估這條路線；採用之前必須先完成【待實測 V08】，失敗時的備案是保留 data mode，另外自寫一支用 `react-dom/static` 的小型 prerender 腳本。以下是 2026-10-20 查證時已知的重點，供屆時參考，不是目前要做的事（React Router 8.4.0 原始碼與 8.5.0 文件）：

- 輸出：`ssr: false` 加上 `prerender` 時，每個 prerender 路徑輸出 `<路徑>/index.html`；給用戶端導覽用的資料檔，v8 已把 `v8_trailingSlashAwareDataRequests` 改成預設行為，結尾有斜線的路徑產生 `<路徑>/_.data`，例如 `/en/` 產生 `/en/_.data`，根路徑 `/` 產生 `/_.data`。路由 manifest 以 `assets/manifest-<hash>.js` 輸出，precache 必須包含它（issue #809 的留言回報 vite-plugin-pwa 會漏掉這個檔案）。
- 結尾斜線：prerender 清單也要一律以 `/` 結尾。這是推論：連結沒有斜線時，用戶端會請求 `abc.data`，但建置期只產生了 `abc/_.data`，可能得到 404。
- 殼層：本站的根路徑 `/` 是中文首頁，一定會 prerender，所以沒有 prerender 的路由改由 `__spa-fallback.html` 接手，根目錄的 `index.html` 是首頁本身，不是通用殼層。
- 主機 fallback：Workers 的 `single-page-application` 固定回傳 `/index.html`，會讓深層連結拿到首頁的 HTML、造成 hydration 不一致；也不能對全站萬用路徑寫指向 `__spa-fallback.html` 的 200 改寫，因為改寫規則一律優先於既有檔案，prerender 的頁面會被蓋掉。屆時三種做法擇一：`not_found_handling = "404-page"` 並把 `__spa-fallback.html` 複製成 `404.html`（狀態碼 404）；只對不 prerender、底下也沒有靜態檔的路由前綴寫 200 改寫規則；或用一支 Worker 回傳 `env.ASSETS` 裡的 `__spa-fallback.html`（計入 Worker 請求額度）。
- 路由限制：`ssr: false` 而且沒有設定 `routeDiscovery` 時，自動解析為 `{ mode: 'initial' }`，不會請求 `/__manifest`，設 `mode: 'lazy'` 會直接回報錯誤；所有路由都不能有 `headers` 與 `action`；`loader` 只能放在被 prerender 的路由上，其他路由用 `clientLoader`；prerender 每個語系的頁面時，要先依路徑啟用對應的 Lingui catalog。
- SW：vite-plugin-pwa 沒有 React Router framework mode 的整合（issue #809 自 2024-12-27 開立至今仍 open；另有 #902、#940 也仍 open），要在 `react-router build` 之後用 workbox-build 7.4.1 的 injectManifest 產生，precache 涵蓋 `**/*.html`、`**/*.data`、`manifest-*.js`、CSS、字型與內容 JSON；injectManifest 沒有 `navigateFallback` 選項，也不會自動加 `SKIP_WAITING` 監聽，兩者都要在 SW 原始碼裡自己寫，導覽 fallback 指向 `__spa-fallback.html` 並排除 `/assets/`、`.data` 與 `sw.js`。
- 其他成本：每一頁的 hydration 腳本不同，CSP 雜湊要逐頁計算，`_headers` 最多 100 條規則，要改由建置後的腳本替每個 HTML 注入 meta CSP，header 只留與腳本、樣式無關的指令；prerender 的 HTML 若含 `style` 屬性會被 CSP 擋下；同一段文字可能被下載三次（HTML、`.data`、內容 JSON），要另設 precache 預算；`lingui()` 的 macroTransform 要與 `reactRouter()` 外掛共存（【待實測 V09】）；repo 要新增 `react-router.config.ts`、`app/` 路由模組、自寫的 SW 原始碼與 `tools/sw-build`，`.gitignore` 加 `.react-router/`。
- 屆時沿用的 M0a 通過條件：各語系的 `index.html` 與 `_.data` 內是該語系的介面字串；離線時沒有任何 `/__manifest` 請求；precache 清單涵蓋上述必要檔案；在 iOS 26 與 iOS 27 上，不論 Safari 分頁或主畫面 App，冷啟動離線時都能開啟 prerender 頁與非 prerender 頁並互相導覽；經由 `__spa-fallback.html` 開啟的路由 `<html lang>` 正確。任何一項失敗就停下回報並提出備案，不在里程碑中途自行切換。

來源：https://reactrouter.com/how-to/pre-rendering 、https://raw.githubusercontent.com/remix-run/react-router/react-router%408.4.0/packages/react-router-dev/config/config.ts 、https://github.com/vite-pwa/vite-plugin-pwa/issues/809 。查證日期 2026-10-20。

## 4. 考慮過但不採用的方案

| 方案 | 狀況（2026-10-20） | 不採用的理由 |
| --- | --- | --- |
| React Router 8 framework mode 加 prerender（原 B、C 案的技術路線） | 內建 prerender；vite-plugin-pwa 沒有官方整合（issue #809 仍 open），要用 workbox-build 自己產生 SW | D5 選了 C 但先不預先產生 HTML：主機採 Workers，SPA fallback 已能讓 `/en/` 的深層連結回到殼層。列為日後再評估，重點整理在第 3.3 節 |
| 純 Vite SPA 加自寫 prerender | vite-react-ssg 0.9.2 的 peer 是 `react-router-dom ^6.14.1`（optional），對 TanStack Router 只有實驗性支援；React Router 7 以上的使用者被建議改用官方內建 SSG | 採用的 data mode 本來就是純 SPA，目前不 prerender。日後若要 prerender，先評估 React Router 內建的做法（第 3.3 節）；自寫要自己處理 hydration 資料、head 與 fallback，成本較高，保留為 V08 不通過時的備案 |
| Astro 7 | 7.0 於 2026-06-22 發布，最新 7.4.1；內建 i18n 路由；靜態輸出的 redirect 是 meta refresh；`@vite-pwa/astro` 1.2.0 的 peer 只到 `astro ^5` | 本站以互動練習為主，作答與進度要跨頁保存並離線導覽，island 模型會讓跨頁狀態變複雜；官方 PWA 整合沒有跟上；要同時維護 `.astro` 與 React 兩種元件模型，增加貢獻者負擔 |
| Next.js 16 靜態匯出 | `output: 'export'` 不支援 redirects、rewrites、headers、Proxy、cookies、Server Actions、ISR、預設的圖片最佳化，也不支援沒有 `generateStaticParams` 的動態路由 | 靜態匯出後失去大部分框架能力；不走 Vite 工具鏈，和 Vite、Vitest 一體化的方向衝突 |
| TanStack Router 加 TanStack Start | TanStack Start 1.0 於 2026-10-13 宣布穩定（`@tanstack/react-start` 1.169.0 發布於 2026-10-12，peer 需要 Vite 8）；Router 本身幾乎每天發布新版本；vite-react-ssg 對 TanStack Router 只有實驗性支援 | 型別安全的 search params 很吸引人，但 prerender 的成熟做法要靠剛穩定一週的 Start（不符合兩週規則），另一條路 vite-react-ssg 仍是實驗性，兩者都不如 React Router 內建的 prerender 成熟；建議 2027 年再評估 |
| 後台用 Git-based CMS（Sveltia、Decap）或 Supabase、Firebase | 比較細節見 [08 題庫與後台](08-content-admin.md) | D10(e) 決定直接做資料庫型後台，平台用 Cloudflare Access 加 Workers 加 D1（與主機同一家），不經過 Git-based CMS 階段；這幾項改列為比較過、未採用 |

來源：https://registry.npmjs.org/vite-react-ssg 、https://astro.build/blog/astro-7/ 、https://nextjs.org/docs/app/guides/static-exports 。查證日期 2026-10-20。

## 5. Lingui macroTransform 的風險與退路【待實測 V09】

**現況**：

- Lingui 官方安裝文件把 `lingui({ macroTransform: true })` 列為推薦設定，不需要 Babel 或 SWC，和 Vite 8 與 plugin-react v6 的 Babel-free 路線相容。
- 但這個功能很新：`@lingui/vite-plugin` 6.8.0 還沒有它，6.9.0（2026-10-01）才加入，靠的是新的依賴 `@lingui/native-tools`（0.x，第一版 0.1.0 發布於 2026-09-21）。6.9.0 符合兩週規則，但原生 transform 推出還不到 4 週。
- 官方範例只示範搭配 `@vitejs/plugin-react`，正好是本站採用的 data mode 組合（D5）；沒有搭配 React Router `reactRouter()` 外掛的範例。【待實測 V09】中「與 `reactRouter()` 共存」的部分，只在日後改用 framework mode（第 3.3 節）時才需要驗證；macroTransform 本身仍要在 M0a 驗證。

**驗證方式（M0a）**：dev server 與 production build 都要測；確認 `t`、`Trans`、`plural` 等 macro 都被正確轉換，抽取（`lingui extract`）抓得到所有訊息；直接開啟 `/en/` 開頭的深層連結時，React 掛載後顯示的是英文字串、不會先閃過中文；從中文切到英文時，en catalog 正確動態載入。

**退路**：`@lingui/vite-plugin` 6.9.0 的 peer 仍保留 `@rolldown/plugin-babel`（`^0.1.7 || ^0.2.0`）與 `@lingui/babel-plugin-lingui-macro`。macroTransform 失敗時，改用 `@rolldown/plugin-babel` 0.2.4 加 `@lingui/babel-plugin-lingui-macro`，只對含 macro 的檔案啟用 Babel，建置速度會變慢一些，但功能相同。這個切換只改建置設定，不影響程式碼與 catalog。

**缺翻譯檢查不能依賴預設值**：

- 原始研究說「Lingui 6 的 compile 預設就會在缺翻譯時失敗」，事實核對查原始碼後推翻：不加 `--strict` 時允許缺漏翻譯，也不會讓建置失敗。
- 而且 `lingui compile --strict` 與 `lingui check missing` 的預設模式，都是在套用 `fallbackLocales` 之後才判斷。若 fallback 指向 zh-TW，就抓不到 en 的缺漏。
- 所以 CI 的 i18n 步驟明確寫成：先 `lingui extract`，再 `lingui check missing --mode catalog --locale en`（只對 complete 狀態的語系強制，beta 語系只產生報告）。zh-TW 與 en 從 M0b 起都是 complete，所以 en 缺任何一則介面字串都會讓 CI 失敗；beta 只給日後新增的第三種語言使用。規則細節見 [05 多語系](05-i18n.md)。

Catalog 位置：已決定（2026-10-20）：`apps/web/src/locales/{locale}/messages.po` 只放頁面與殼層的文字；元件裡的文字（例如 `quiz.submit` 的「確認答案」、多正解題提示、選項狀態字串）放在 `packages/web-ui/src/locales/{locale}/messages.po`；兩者在載入時合併，後台同樣合併 `web-ui` 的字串檔。PO 格式方便日後接 Weblate 或 Crowdin。M0b 要驗證 `@lingui/vite-plugin` 的 macroTransform 能處理 workspace 套件的原始碼（抽取與編譯都正確）；不行時的退路是把 `packages/web-ui/src` 加進 app 的抽取設定。這是沒有 registry 編號的驗證事項（見 [14 待確認](14-open-questions.md) 第 5.3 節）。

來源：https://lingui.dev/installation 、https://raw.githubusercontent.com/lingui/js-lingui/v6.9.0/packages/cli/src/lingui-compile.ts 、https://registry.npmjs.org/@lingui/native-tools 。查證日期 2026-10-20。

## 6. 其他函式庫說明

### 6.1 介面字串的替代方案

| 方案 | 優點 | 不選為首選的理由 |
| --- | --- | --- |
| Paraglide JS 2 | 編譯成有型別的訊息函式，型別安全最強；內建 url 語系策略 | 目前每頁會送出所有語言的訊息，語言越多 bundle 越大（官方 benchmark：5 種語言 47 KB，10 種 76 KB）；沒有從原始碼抽取訊息的流程；一週內發了多個 minor，變動頻繁 |
| i18next 26 加 react-i18next 17 | 生態最大 | runtime 約 14 kB 加 3.32 kB（gzip）；大型 resource 會拖慢型別推導；ICU 要外掛 |
| react-intl 12 | 原生 ICU | runtime 約 15 kB（gzip）；2026 年內從 8 跳到 12，major 更迭快 |

如果語言數維持在 3 種以下、而且非常重視 key 與參數的型別檢查，Paraglide 是可行的替代方案。

### 6.2 Schema 與 JSON Schema

- Zod 4 的 `z.toJSONSchema()` 預設輸出 Draft 2020-12，要明確指定 `target: 'draft-07'`，因為 VS Code 只完整支援 draft 4 到 draft 7。
- 輸出的 `schemas/*.schema.json` 要 commit；CI 重新產生後執行 `git diff --exit-code`，不一致就失敗。
- 用 `.vscode/settings.json` 的 `json.schemas` 以 `fileMatch` 對應內容檔，不在內容檔裡放 `$schema`，避免污染資料。
- `z.fromJSONSchema()` 仍屬實驗性，不使用。
- 執行期只在匯入備份等流程動態載入驗證 chunk，避免把 Zod 放進首次載入的 bundle；體積吃緊時可以改用 `zod/mini`。

範例：

```json
{
  "json.schemas": [
    {
      "fileMatch": ["content/terms/*.json"],
      "url": "./schemas/term.schema.json"
    },
    {
      "fileMatch": ["content/chapters/*.json"],
      "url": "./schemas/chapter.schema.json"
    }
  ]
}
```

### 6.3 狀態與儲存

- Zustand 管介面與作答狀態。官方說明 persist middleware 內建的 `JSON.parse` 沒有執行期驗證，所以學習進度不透過 Zustand persist，而是經過一層 repository 存進 IndexedDB（idb），讀回時用 Zod 驗證並依 schema 版本 migrate。進度資料模型、資料版本升級與儲存介面的定義在 `packages/progress`，IndexedDB 的實作在 `apps/web`（第 8.1 節）。
- MVP 用 idb 8；若之後需要對作答紀錄做索引查詢或自動更新畫面，再評估 Dexie 4.4.6（多約 30 kB gzip）。
- 不採用 OPFS：沒有證據顯示它比 IndexedDB 更不容易被淘汰，進度資料量也不需要它。儲存的細節見 [06 PWA 與響應式](06-pwa-responsive.md)。

### 6.4 動畫

- 一般轉場用 CSS 加 View Transitions。依 MDN browser-compat-data，同文件的 `startViewTransition` 是 Safari 18.0 起支援，types 與跨文件 `@view-transition` 是 Safari 18.2 起支援，所以 iOS 26 都可用；正式支援的 iOS 17（D8）上沒有轉場動畫，程式要先偵測 `document.startViewTransition` 是否存在，不存在就直接更新畫面。Firefox 的跨文件支援，BCD 與 caniuse 說法不一致。
- React 19.3 的 `<ViewTransition>` 只在 Transition 更新（`startTransition`、Suspense 顯示、`useDeferredValue`）時觸發動畫；官方部落格沒有說明不支援的瀏覽器會怎樣，也沒有提到與 React Router 8 的整合寫法，要在 M0a 順便確認。
- `<ViewTransition>` 只包住內容區，Tab bar 與它的祖先元素不設定 `view-transition-name`，否則會形成 Backdrop Root，玻璃透不出下方內容（見 [07 設計系統](07-design-system.md)）。
- Motion 只在需要手勢或 layout animation 時，以 `LazyMotion` 加 `m` 局部載入（`m` 加 `LazyMotion` 初始約 5 kB，加 `domAnimation` 再多 24 kB），不全域使用 `<motion>` 元件（約 43 kB）。

### 6.5 拖放

- 舊版 `@dnd-kit/core` 最後一次發布是 6.3.1（2024-12-05），新專案不用。新架構 `@dnd-kit/react` 仍是 0.x，包在自家 adapter 後面，隔離 API 變動。
- 依 WCAG 2.2 的 2.5.7，分類題的主要操作是「點選卡片，再點選目標」與鍵盤；拖放是漸進增強。
- Safari 拖曳偏移的 issue #1910（2026-02-20 開立）查詢時仍 open，M0a 要在 iPhone 實機驗證（【待實測 V07】）。不通過時回報，由你決定先只做點選與鍵盤，或改用備案。

### 6.6 金額與格式化

- 金額一律存整數（預設 scale 0，單位為元），四捨五入集中在 helper（遠離零的 half-up，注意 `Math.round(-2.5)` 是 `-2`）。TC39 Decimal 提案仍在 Stage 1，目前不需要 dinero.js、decimal.js；只有利率或複利計算才考慮在邊界引入 big.js。細節見 [04 會計核心](04-accounting-core.md)。
- Intl 的 TWD 預設輸出 2 位小數，要明確設定小數位數為 0。2026-10-20 查證時在 V8（Node 26.8.2）與 macOS 27.2 的 JavaScriptCore 上實測：zh-TW 的貨幣符號是 `$`，en 是 `NT$`；`currencyDisplay: 'name'` 在兩個引擎結果不同，不使用。iOS 實機的輸出還沒測（【待實測 V14】）。
- 測試不要跨引擎比對格式化後的字串，改用 `formatToParts`，或依引擎各自建立期望值。格式規則見 [05 多語系](05-i18n.md)。

### 6.7 Excel 與 CSV 匯入（M6，D10(d)）

已決定（D10(d)，2026-10-20）：文字型題目與名詞用 Excel 範本維護；上傳入口先做本機匯入指令；老師要自己操作時，再加只產出檔案的瀏覽器匯入頁，放在後台的獨立 origin（流程見 [08 題庫與後台](08-content-admin.md)）。這裡只寫函式庫的選擇，實際版本在 M6 開工時依兩週規則選定。

- **不可以 `npm i xlsx`**：npm registry 上的 `xlsx` 停在 0.18.5（2022-03-24），受 CVE-2023-30533（prototype pollution，0.19.3 修復）與 CVE-2024-22363（ReDoS，0.20.2 修復）影響。
- 若選 SheetJS：SheetJS 官方 CDN 的最新版是 0.20.3（Apache-2.0）。把 0.20.3 的 tarball 放進 `vendor/`，`package.json` 以檔案路徑引用，避免 CDN 失效並確保 lockfile 可重現；Dependabot 不會追蹤，要人工追版。
- 若選 read-excel-file（MIT）：只讀 `.xlsx`，可用 schema 解析，錯誤物件帶列與欄，適合產生「哪列哪欄錯」的報告。最新 9.3.12 發布於 2026-10-07，要到 2026-10-21 才滿兩週，實際版本在 M6 開工時再選。
- 不用 exceljs：穩定版 4.4.0 發布於 2023-10-19，之後只有 2024-12-20 的 4.4.1-prerelease.0，約 3 年沒有穩定版。
- CSV 用 papaparse 5.7.0（5.4.0 起處理 UTF-8 BOM）。老師用 Windows Excel 存的 CSV 可能是 Big5：偵測不到 BOM 或出現亂碼時，改用 `new TextDecoder('big5')`（`cp950` 不是合法的 label），或乾脆要求上傳 `.xlsx`。
- 範本本身要能寫出 `.xlsx`，而且 D12 要求範本有「判分方式」下拉欄（資料驗證清單）。read-excel-file 只負責讀取；能不能用程式產生含下拉清單的範本（例如同作者的寫入套件或 SheetJS），本次沒有查證。查不到可靠的做法時，改為在 Excel 裡手工做好一份範本檔並 commit，匯入指令只負責讀取。
- 匯入相關的函式庫只用在本機匯入指令，或在後台 origin 的匯入頁 lazy 載入，絕不進學習端的 bundle。匯入流程見 [08 題庫與後台](08-content-admin.md)。

來源：https://docs.sheetjs.com/docs/getting-started/installation/frameworks 、https://registry.npmjs.org/read-excel-file 、https://encoding.spec.whatwg.org/#names-and-labels 。查證日期 2026-10-20。

### 6.8 CSS 前綴與 browserslist（已決定 D8）

- 根目錄 `package.json` 的 `browserslist` 欄位納入 iOS 17，作為 CSS 前綴的唯一依據。下面是提案值，M0a 依實際測試矩陣定案：

```json
{
  "browserslist": [
    "iOS >= 17",
    "Safari >= 17",
    "last 2 Chrome versions",
    "last 2 Edge versions",
    "last 2 Firefox versions",
    "last 2 ChromeAndroid versions"
  ]
}
```

- 補前綴的工具兩種擇一，在 M0a 定案：(1) Vite 的 `css.transformer: 'lightningcss'`，用 Lightning CSS 的 `browserslistToTargets` 把 browserslist 轉成 targets；(2) PostCSS 加 Autoprefixer，直接讀 browserslist。原始碼只寫無前綴的 `backdrop-filter`，不手寫 `-webkit-` 版本。
- Vite 的 `build.target` 管的是 JavaScript 語法，不讀 browserslist，兩者分開設定；預設的 `baseline-widely-available`（Safari 16.4 與 iOS 16.4）已涵蓋 iOS 17，維持不變。
- CI 的 build 工作檢查建置後的 CSS：凡是有 `backdrop-filter` 的規則，都要同時有 `-webkit-backdrop-filter`，否則失敗。
- Tab bar 的完整 `nav` 寫在 `index.html`（第 3.2 節），玻璃層級的判斷與 iOS 17 上的退路見 [07 設計系統](07-design-system.md)；M0a 的 iOS 17 裝置（沒有實機時用 Simulator 並在報告註明）要確認模糊效果與 Tier 判斷都正確。

### 6.9 App 內掃描課堂 QR（M2，D10(a)）

- D10(a) 決定在 App 內加入相機掃描課堂 QR。Safari 沒有正式的 BarcodeDetector，所以要內建 JS 解碼器並取得相機權限；解碼器的選型在 M2 開工前查證，同樣適用兩週規則與授權白名單。
- 選型條件：純 JS 或不需要放寬 CSP 的實作優先；若解碼器用 WebAssembly，`script-src` 要加 `'wasm-unsafe-eval'`，這是放寬，必須在第 11.1 節記錄並重新評估；若用 Web Worker，維持 `worker-src 'self'`，不使用 `blob:`。
- 解碼器只在掃描畫面 lazy 載入，不計入首次載入的 JS 預算，但要進 precache，離線時也能掃描（QR 內容是站內網址，掃到之後在 App 內導覽）。
- `_headers` 的 `Permissions-Policy` 為 `camera=(self)`（第 11.2 節）；隱私說明頁寫明影像只在裝置上解碼、不上傳、不保存（第 11.4 節）。

## 7. 部署與主機

### 7.1 origin 是資料模型的一部分

學習進度只存在 IndexedDB 與 localStorage；它們、SW 的註冊、已安裝的主畫面 App、已經印出來的 QR code，全部綁定 origin（協定加主機名稱加連接埠）。換網域就是換 origin，學生的進度不會跟著搬過去。所以：

- 已決定（D4，2026-10-20）：正式的 origin 是 `https://ledgerland.swift.moe`，base path 為 `/`（base、basename、manifest scope、SW scope 都是 `/`）。這個 origin 從第一次讓學生使用（包括課堂試用與印 QR）起就不再更換。
- `ledgerland.swift.moe` 和你在 `swift.moe` 底下的其他網站是不同的 origin，不共用 IndexedDB、localStorage 與 SW。Workers 的自訂網域不能建立在已有 CNAME 記錄的主機名稱上，M0b 設定前先確認 `ledgerland` 這個名稱在 DNS 上沒有既有記錄。
- 不使用 GitHub Pages 的原因之一：`swiftruru.github.io` 這個 origin 已經被你其他的 GitHub Pages 專案共用，IndexedDB 與 localStorage 是同一個命名空間，配額與淘汰判斷也是同一份；其他專案的腳本（包括它們可能有的 XSS）都能讀寫 LedgerLand 的進度；若有專案在根 scope 註冊 SW，也會攔截子路徑底下的請求。
- M0a 的技術驗證可以先用暫時的 HTTPS 預覽網址（例如 `workers.dev` 底下的網址），那是另一個 origin，資料一律視為測試資料，不印發給學生的 QR。base path 已定為 `/`，CI 只以根路徑建置與測試。
- 不得不搬家時的遷移流程（舊網址保留匯出頁、`sw.js` 不刪除而改部署會自我解除的版本、新網址主動提供匯入）寫在 [06 PWA 與響應式](06-pwa-responsive.md)。

### 7.2 三種主機的比較（決定時的依據）

D4 已選 Cloudflare Workers Static Assets；GitHub Pages 與 Cloudflare Pages 不使用。下表保留 2026-10-20 決定時的比較，日後若要重新評估主機可以直接參考。

| 比較面向 | GitHub Pages | Cloudflare Workers Static Assets | Cloudflare Pages |
| --- | --- | --- | --- |
| 平台定位 | GitHub 內建的靜態主機 | Cloudflare 稱為主要應用平台，官方建議新專案從這裡開始 | 仍受支援，官方沒有宣布棄用，但 Pages 文件首頁寫著新專案請從 Workers 開始 |
| 自訂 HTTP header | 不能。實測回應固定為 `cache-control: max-age=600`，另有 ETag、Last-Modified、`access-control-allow-origin: *` | `_headers`，最多 100 條規則、每行 2,000 字元；預設 `Cache-Control: public, max-age=0, must-revalidate` 加 ETag | `_headers`（規則上限本次未重新查證）；預設 `public, max-age=0, must-revalidate`，200 回應一定帶 ETag |
| CSP | 只能用 `<meta http-equiv>`，無法設定 `frame-ancestors` | 用 header 設定 | 用 header 設定 |
| 找不到檔案時 | 自訂的 `404.html`，狀態碼是 404 | `not_found_handling` 可設 `single-page-application`（回傳 `/index.html`，狀態碼 200）或 `404-page`；compatibility date 在 2025-04-01 以後時，導覽請求不執行 Worker | 沒有頂層 `404.html` 時視為 SPA，對找不到的路徑回傳根目錄 `/`；有 `404.html` 時回 404 頁 |
| 轉址規則 | 不支援 `_redirects` | `_redirects`：2,000 條靜態加 100 條動態規則；200 改寫只能指向站內相對網址；不支援依國家、語言、cookie、query 條件轉址 | 支援 `_redirects`（細節本次未重新查證） |
| 結尾斜線 | `/x` 以 301 轉到 `/x/`；路徑區分大小寫（實測 `/Versions/` 回 404） | 預設 `auto-trailing-slash`，資料夾 `/x` 以 307 轉到 `/x/` | 本次未查證 |
| PR 預覽 | 沒有 | Workers 有 Previews 功能，可做分支與 PR 的隔離測試（存取保護與費用細節本次未查證） | 同一 repo 發起的 PR 與非正式分支會自動產生預覽（`<hash>.<project>.pages.dev` 與分支別名）；預設公開；access policy 只保護預覽部署，不保護正式網址；fork 的 PR 不產生預覽 |
| 私有 repo | GitHub Free 的私有 repo 不能發布 Pages | 用 GitHub Actions 執行 wrangler 上傳建置產物，與 repo 是否公開無關 | 同左，用 Actions 上傳建置產物；Git 整合對私有 repo 的支援本次未查證 |
| 自訂網域與 DNS | 子網域以 CNAME 指向 `<owner>.github.io`，Let's Encrypt 自動簽發 HTTPS，可強制 HTTPS；若有其他指向非 GitHub 的記錄，可能無法簽發 | 必須是在 Cloudflare 上啟用的 zone（nameserver 在 Cloudflare）；不能建立在已有 CNAME 記錄的主機名稱上。把外部 DNS 的子網域接到 Cloudflare 的 partial（CNAME）設定只有 Business 或 Enterprise 方案能用，所以 DNS 在學校的子網域不能用 | 外部 DNS 的子網域可以 CNAME 到 `<project>.pages.dev`，但要先在 Pages 後台加入網域，否則會出現 522；apex 網域仍必須是 Cloudflare zone；CAA 記錄可能阻擋憑證簽發 |
| 主要限制 | 網站不超過 1 GB；每月 100 GB 軟性頻寬；部署超過 10 分鐘失敗；每小時 10 次建置的軟性限制（用自訂 Actions workflow 發布時不適用）；可能回 429；不得作為商業 SaaS 主機 | 靜態資源請求免費且不限量；每個版本的檔案數 Free 20,000、Paid 100,000（需要 Wrangler 4.34 以上）；單檔 25 MiB；只有真正執行 Worker 的請求計入 Free 每日 100,000 次（`run_worker_first` 命中的路由會計入，超額回 429）；Workers Builds 免費每月 3,000 建置分鐘 | 靜態請求免費且不限量；免費方案每月 500 次建置、同時 1 個、逾時 20 分鐘、20,000 個檔案、單檔 25 MiB、每專案 100 個自訂網域 |
| 費用（本站用量） | 公開 repo 免費；公開 repo 的 GitHub-hosted runner 也免費 | 免費方案足夠 | 免費方案足夠 |

本站學習端的用量（靜態為主、教育用途；只有 `/assets/*` 請求經過一支小 Worker，第 7.3 節）遠低於三者的上限。M7 的管理後台（D10(e)）會執行 Worker 並使用 D1，但只有管理者使用，請求量很小；它的方案與額度在 M7 開工前查證。

來源：https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits 、https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/ 、https://developers.cloudflare.com/pages/configuration/custom-domains/ 。查證日期 2026-10-20。

### 7.3 Workers 的 fallback 與快取設定

- fallback：`not_found_handling = "single-page-application"`。沒有對應檔案的路徑一律回傳 `/index.html`，狀態碼 200；`index.html` 就是殼層（第 3.2 節），所以 `/level/<levelId>/`、`/en/level/<levelId>/` 這類深層連結第一次開啟就能正常顯示，SW 安裝之後改由 SW 回應。本案沒有語言選擇頁，fallback 不會回傳錯的頁面。
- 已決定（2026-10-21，M0a 實測後）：學習端有一支很小的 Worker，只在 `/assets/*` 執行（`run_worker_first: ["/assets/*"]`），其他路徑完全由 Static Assets 回應。原因：M0a 在正式的 Cloudflare 上確認，不存在的 `/assets/` 檔案（例如新部署後被刪掉的舊 chunk）對真實瀏覽器的 JS 與 CSS 請求（`Sec-Fetch-Dest: script` 或 `style`）也會被 SPA fallback 回成殼層加 200，還帶一年的 immutable 快取，瀏覽器會把 HTML 當程式執行並快取錯誤。Worker 透過 `ASSETS` binding 取檔，拿到 HTML（代表檔案不存在）就改回 404 與 `Cache-Control: no-store`；真實檔案維持 200、一年 immutable，`_headers` 照常套用。代價：`/assets/` 的請求計入 Workers 的請求次數（免費方案每日 10 萬次），導覽請求與其他路徑不計入；M0b 依實際流量確認額度。
- 不寫 `_redirects` 的 200 改寫規則：SPA 模式已經涵蓋，改寫規則反而會優先於既有檔案。
- 帶 hash 的 `/assets/` 檔案在新部署後已經不存在時，M0a 確認 Static Assets 會回殼層加 200；上一點的 Worker 把它改成 404、`no-store`，舊頁面載入已刪除的 chunk 時由第 7.4 節與 06 第 9.1 節的 ErrorBoundary 提示重新整理。
- `_headers` 的範本放在 `apps/web/public/`，建置時複製到輸出資料夾根目錄，再由 CSP 工具填入雜湊（第 11.1 節）。`/*` 規則的標頭是否也套用在 SPA fallback 回傳的 `index.html` 上，在 M0a 用 `curl -I` 對一個深層連結確認。

已決定（2026-10-20）：學習端的 wrangler 設定放在 `apps/web/wrangler.jsonc`（原本規劃放在根目錄的 `wrangler.json` 移到這裡），每個要部署的 app 自己帶部署設定。`assets.directory` 改為 `"./dist"`（相對於設定檔），其餘設定（`not_found_handling`、`html_handling`、自訂網域 `ledgerland.swift.moe`）不變，Worker 名稱維持 `ledgerland`。M7 的管理後台有自己的 `apps/admin/wrangler.jsonc`，是另一個 Worker。

`apps/web/wrangler.jsonc` 的設定範例（jsonc 允許註解，範例不加註解，維持合法的 JSON），`compatibility_date` 在 M0b 依當時的日期設定，自訂網域的寫法在 M0b 依官方文件確認：

```json
{
  "name": "ledgerland",
  "compatibility_date": "2026-10-01",
  "main": "worker/index.js",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "html_handling": "auto-trailing-slash",
    "run_worker_first": ["/assets/*"]
  },
  "routes": [
    {
      "pattern": "ledgerland.swift.moe",
      "custom_domain": true
    }
  ]
}
```

快取設定：用 `_headers` 讓帶 hash 的 `/assets/*` 設為 `public, max-age=31536000, immutable`；`index.html`、`sw.js`、`manifest.webmanifest`、內容 manifest 維持預設的 `max-age=0, must-revalidate`。Workbox precache 對帶 revision 的檔案（例如沒有 hash 的 HTML）在安裝時用 `cache: 'reload'` 繞過 HTTP 快取；`sw.js` 本身的更新檢查預設也不經過 HTTP 快取（`updateViaCache` 預設 `imports`）。完整的 `_headers` 見第 11.2 節。

來源：https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/ 、https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/ 、https://developers.cloudflare.com/workers/configuration/routing/custom-domains/ 。查證日期 2026-10-20。

### 7.4 部署安全

- 部署只用整批替換的方式：CI 在 `apps/web` 目錄執行 wrangler（例如 `pnpm --filter @ledgerland/web exec wrangler deploy`），上傳整份建置產物（wrangler 列在 devDependencies，受兩週規則管）。不逐檔同步。
- `sw.js` 的路徑固定，絕不刪檔或改名：Safari 27.0 修正了「主腳本不存在時解除 SW 註冊」，代表 `sw.js` 一旦暫時消失，iOS 27 使用者的 SW 會被直接移除；反過來，`sw.js` 回 404 時其他環境可能保留舊 SW，永遠停在舊版。要停用 SW 時，部署一個會自我解除並清除快取的版本。
- 舊頁面之後才 lazy 載入的 chunk 或內容 JSON，可能在新部署後已經不存在。每條路由都設 ErrorBoundary，偵測到動態載入失敗時先寫入進度，再提示「網站已更新，重新整理即可」（細節見 [06 PWA 與響應式](06-pwa-responsive.md)）。
- CI 在部署前檢查：`sw.js` 存在；manifest 的 `id` 與上一版相同；`apps/web/wrangler.jsonc` 的 `not_found_handling` 是 `single-page-application`、`assets.directory` 指向建置產物（`./dist`）；`_headers` 存在，而且其中 CSP 的雜湊與這次建置的 `index.html` 兩段 inline 腳本（head 的 boot 腳本、`nav` 之後的殼層在地化腳本）及首次繪製的 `<style>` 一致（第 11.1 節）。
- 部署後的煙霧測試：對正式網址的 `/`、一個中文深層連結與一個 `/en/` 深層連結各發一次請求，確認狀態碼 200、回傳的是殼層，而且帶有 CSP 等標頭。

### 7.5 專案隔離環境與重新部署

已決定（2026-10-20）：套件、工具與快取都裝在專案自己的資料夾裡，不做全域安裝；整個環境可以刪掉重建（和 Python 的 `.venv` 一樣）。程式相關內容一律不寫到 `ledger-land/` 以外（你的規則，2026-10-20）。

**做法**：

- pnpm 的 store 放在 repo 內的 `.pnpm-store/`，快取與狀態放在 `.cache/pnpm/`（`pnpm-workspace.yaml` 的 `storeDir`、`cacheDir`、`stateDir`，第 2.2 節）；npm 快取（`npm_config_cache`）、Playwright 瀏覽器（`PLAYWRIGHT_BROWSERS_PATH`）也放在 `.cache/` 底下。M0b 時把 `.pnpm-store/` 與 `.cache/` 附加到 `.gitignore`（第 9 節第 3 步）。M0a 的 `prototypes/env.sh` 是可用的範例。
- 代價：不同專案之間不共用快取，比較佔硬碟空間。
- wrangler、lighthouse、Playwright 都列在 devDependencies，不全域安裝。pnpm 本身依 `packageManager` 欄位鎖定 11.28.5（不依賴 Corepack，第 2.4 節）。
- Node：`.node-version` 寫 24。M0b 查證 pnpm 11 能否在 `package.json` 宣告 Node 版本並自動下載到專案內（讓 Node 也隔離）；可行就採用，否則沿用版本管理工具加 `.node-version`。這是沒有 registry 編號的查證事項（見 [14 待確認](14-open-questions.md) 第 5.4 節）。
- 重設：刪掉 `node_modules/`、`.pnpm-store/`、`.cache/` 後執行 `pnpm install --frozen-lockfile` 即可重建。

**重新部署**：

- 重建與部署需要的東西都在 repo 裡：精確鎖版的 `package.json`、`pnpm-lock.yaml`、`packageManager`、`.node-version`、`apps/web/wrangler.jsonc`、`_headers` 範本、CI workflow，不依賴任何人電腦上的狀態。
- 新環境只要 clone、`pnpm install --frozen-lockfile`、建置、部署；平常由 CI 在 main 通過檢查後自動部署（第 10 節）。
- 出問題時可以退回 Cloudflare Workers 保留的上一個版本（最近 100 個）：`pnpm --filter @ledgerland/web exec wrangler rollback [<VERSION_ID>] --message "原因"`（省略版本 ID 時退回上一個版本），版本用 `wrangler versions list` 或 `wrangler deployments list` 查；儀表板路徑 Workers & Pages › ledgerland › Deployments › Rollback（查證 2026-10-22；M0b 實際演練一次）。

**部署方式**：維持 GitHub Actions 執行 wrangler（第 10 節），不使用 Cloudflare 儀表板的 Git 整合（Workers Builds）。理由：部署前的 CSP 雜湊檢查與測試在同一條流程；目錄調整只改 repo 裡的 wrangler 設定與 workflow，Cloudflare 儀表板沒有「根目錄、建置指令、輸出目錄」要改。若改用 Workers Builds，就要在儀表板設定根目錄、建置指令與部署指令，之後每次搬目錄都要手動改（未採用）。

**憑證**：`wrangler login` 的憑證存在你自己的帳號設定裡（帳號憑證不是套件，放專案外比較安全，不會被誤 commit）；CI 用存在 GitHub repo secrets 的 API token，本機不需要憑證。

**你要手動做的事與時機**：

| 時機 | 要做的事 | 備註 |
| --- | --- | --- |
| M0a 部署預覽前 | 執行一次 `wrangler login` | 憑證存在你自己的帳號設定裡，不在專案內 |
| M0b 第一次正式部署前 | 在 Cloudflare 建立只有 Workers 與 `swift.moe` 必要權限的 API token，並把 token 與 Account ID 存進 GitHub repo 的 Actions secrets（`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`） | 畫面名稱以當時介面為準 |
| 之後 | 不需要；任何目錄調整都只改 repo 裡的 wrangler 設定與 workflow | 不需要手動改 Cloudflare 設定 |

## 8. 資料夾結構

已決定（2026-10-20）：網站與未來的 App 放在同一個 repo（monorepo，pnpm workspace）。根目錄保持精簡，只留工具必須在根目錄才找得到的檔案；程式依「app」（`apps/`）與「共用套件」（`packages/`）分層（已決定六）。資料夾樹用縮排表示；括號內是說明。

```text
ledger-land/
  .github/
    workflows/                 （CI 與部署）
  .vscode/
    settings.json              （json.schemas 對應）
  apps/
    web/                       （學習端 PWA，M0b）
      index.html               （殼層：boot 腳本、首次繪製的 style、靜態 Tab bar 與殼層在地化腳本）
      site.config.ts           （base path、manifest id 與 scope 的唯一來源）
      wrangler.jsonc           （學習端的 Workers 設定，第 7.3 節）
      src/
        routes/                （data mode 的路由與頁面，中文與 `/en/` 共用）
        locales/
          zh-TW/messages.po    （頁面與殼層的介面字串）
          en/messages.po
      public/                  （圖示、manifest 素材、`_headers` 範本）
      dist/                    （建置產物，不 commit）
    admin/                     （M7 才建立：後台前端與 Worker、D1 migration、自己的 wrangler.jsonc；獨立 origin）
    mobile/                    （預留：App 技術選定後才建立，現在不建立空資料夾）
  packages/
    tokens/                    （設計 token 的唯一來源，M0b）
    i18n/                      （語系登錄檔、網址的語系函式、格式化，M0b；原名 i18n-config）
    content-schema/            （Zod schema 與內容驗證規則，M0b）
    core/                      （會計核心，M1）
      src/
      test/
    quiz/                      （判分、星星、錯題本排程，M2）
    progress/                  （進度資料模型、備份格式、資料版本升級，M2）
    web-ui/                    （網站與後台共用的 React 元件，M0b）
      src/
        locales/
          zh-TW/messages.po    （元件裡的介面字串）
          en/messages.po
      test/
  content/                     （內容的原始檔，含授權說明；資料，不是程式）
  tools/                       （建置期工具與檢查腳本）
  schemas/                     （由 Zod 產生的 JSON Schema）
  vendor/                      （只有選用 SheetJS 時才建立）
  LICENSES/                    （內容授權全文）
  docs/
    plan/                      （01、13、15 只存在本機，不 commit）
  references/                  （老師教材，永遠不 commit）
  prototypes/                  （M0a 試作與本機工具快取，不 commit）
  .pnpm-store/                 （pnpm 的 store，不 commit）
  .cache/                      （pnpm、npm 的快取與 Playwright 瀏覽器，不 commit）
```

| 路徑 | 用途 | 是否 commit |
| --- | --- | --- |
| `.github/workflows/` | CI、部署、排程檢查的 workflow | commit |
| `.vscode/settings.json` | `json.schemas` 的 `fileMatch` 對應，讓編輯器驗證內容檔 | commit（只放專案共用設定） |
| `apps/web/` | 學習端 PWA（`@ledgerland/web`）：殼層 `index.html`、路由與頁面（`src/routes/`）、Service Worker 與 manifest、IndexedDB 的儲存實作（M2 起）、頁面與殼層的樣式、`_headers` 範本、自己的 wrangler 設定。共用元件不放這裡，放在 `packages/web-ui` | commit |
| `apps/web/wrangler.jsonc` | 學習端的 Workers 設定：assets 目錄（`./dist`）、SPA fallback、自訂網域、Worker 名稱 `ledgerland`（第 7.3 節） | commit（不放任何 token） |
| `apps/web/src/locales/{locale}/messages.po` | Lingui 的介面字串 catalog，只放頁面與殼層的文字；載入時與 `web-ui` 的字串檔合併（第 5 節） | commit |
| `apps/web/dist/` | 建置產物（`wrangler deploy` 上傳的就是這個資料夾） | 不 commit |
| `apps/admin/` | 管理後台（M7，D10(e)）：Cloudflare Access 保護的前端、驗證 Access JWT 並查 D1 角色表的 Worker、D1 的 migration、自己的 `apps/admin/wrangler.jsonc`（另一個 Worker）；題目預覽使用 `packages/web-ui`；日後的瀏覽器匯入頁（D10(d)）也放在這裡。和學習端分開建置、分開部署到獨立的 origin | M7 起 commit；secrets 一律放在 Cloudflare 與 repo secrets，不進 repo |
| `apps/mobile/` | 預留給日後的 App；技術（Capacitor、Expo、原生）建議在 M3 完成後決定（已決定六） | 現在不建立 |
| `packages/tokens/` | 設計 token 的 TypeScript 原始檔（色票依 16 主題：淺色與深色三風味），建置時產生 CSS 變數檔（含風味覆寫區塊）、TS 常數、manifest 色碼與首次繪製背景色（第 8.1 節） | commit |
| `packages/i18n/` | 語系登錄檔（代號、顯示名稱、`html lang`、數字格式、退回語系、complete 或 beta；zh-TW 與 en 從 M0b 起都是 complete，beta 只給日後新增的第三種語言）、網址的語系函式、金額與百分比等格式化函式、作答輸入正規化；原名 `i18n-config`，已決定改名（第 8.1 節） | commit |
| `packages/content-schema/` | 題目、名詞、交易範本、章節、故事的 Zod schema、ID 產生、佔位符文法、內容驗證規則 | commit |
| `packages/core/` | 會計核心，只放會計：科目表、交易範本、過帳、三表、指標、五步驟勾稽、追蹤、IFRS 政策、分錄的正規化比對（第 8.1 節） | commit |
| `packages/core/test/` | 單元測試、性質測試、自編數字的黃金測試 | commit |
| `packages/core/test/**/*.local.test.ts` | 對老師 Excel 的本機驗證。期望值在執行時從 `references/` 讀出，不用 `toMatchSnapshot` 或 `toMatchInlineSnapshot`；`references/` 不存在時由 Vitest 設定自動排除 | commit（檔案本身不含老師的數字或教材文字；逐格比對只在本機執行，D3） |
| `packages/quiz/` | 題型的判分、選項打散、星星計算、錯題本的間隔複習排程（第 8.1 節） | commit |
| `packages/progress/` | 進度資料模型、備份檔與文字備份碼的格式、匯入合併規則、資料版本升級、儲存介面的定義（第 8.1 節） | commit |
| `packages/web-ui/` | 網站與後台共用的 React 元件與其樣式（第 8.1 節） | commit |
| `packages/web-ui/src/locales/{locale}/messages.po` | 元件裡的介面字串（例如 `quiz.submit` 的「確認答案」、多正解題提示、選項狀態字串）；載入時與 app 的字串檔合併 | commit |
| `content/` | 內容的原始檔（多語系同一檔）與 `published.lock.json`，另有一份簡短的授權說明指向 `LICENSES/`。除了原創內容，故事資料含老師的情境與金額（D2 已同意，屬於公開內容；不在 CC 授權範圍內，標示「經陳彥宏老師授權使用」，D6）。公開 repo 中，這裡的草稿也是公開的（見 [08 題庫與後台](08-content-admin.md)） | commit（原創內容與經授權使用的故事資料；不放教材原文、投影片或解答） |
| `tools/` | content-build、content-check、schema 輸出、i18n 報表、CSP 雜湊與 `_headers` 產生、CSS 前綴檢查、體積預算、hygiene 檢查、依賴方向檢查（第 8.3 節）、`release-age-exceptions.json` | commit |
| `tools/local/` | 只在本機執行的輔助腳本（例如與教材的相似度檢查），會讀 `references/` | 腳本 commit，輸出不 commit |
| `schemas/` | Zod 以 draft-07 產生的 JSON Schema；CI 重新產生後 `git diff --exit-code` | commit |
| `vendor/` | SheetJS 0.20.3 tarball（只有 M6 選用時才建立） | commit |
| `docs/` | 規劃與技術文件 | commit（下兩列的檔案除外，D3） |
| `docs/plan/01-materials.md`、`docs/plan/13-material-questions.md` | 教材整理與教材疑義（教材衍生內容：頁碼、答案、向老師確認的問句） | 不 commit（以 `.gitignore` 排除，檔案留在原位，只存在本機，由你備份；D3） |
| `references/` | 老師的投影片與 Excel | 永遠不 commit |
| `prototypes/` | M0a 試作程式與本機工具快取；需要產生器時的暫存資料夾（第 9 節） | 不 commit（M0a 已以 `/prototypes/` 排除） |
| `CLAUDE.md`、`CLAUDE.local.md`、`.claude/`（含 settings、rules、agents、skills、hooks、交接狀態、報告） | 本機 AI 設定，留在工具預設的位置，以 `.gitignore` 排除（見 [15 AI 協作與本機設定](15-ai-workflow.md)（本機專用）） | 永遠不 commit |
| 其他 AI 工具設定（`AGENTS.md`、`GEMINI.md`、`.mcp.json`、`.cursor/`、`.github/copilot-instructions.md` 等） | 若日後使用其他 AI 工具 | 永遠不 commit |
| `docs/plan/15-ai-workflow.md` | AI 協作規劃（屬於 AI 相關內容） | 不 commit（以 `.gitignore` 排除，檔案留在原位） |
| `coverage/`、`playwright-report/`、`test-results/`、`.local-reports/` | 測試與本機驗證的輸出 | 不 commit |
| `.wrangler/`、`.dev.vars*` | wrangler 在本機執行時產生的暫存資料與本機 secrets | 不 commit |
| `node_modules/` | 依賴套件 | 不 commit |
| `.pnpm-store/` | pnpm 的 store，放在 repo 內（`pnpm-workspace.yaml` 的 `storeDir`，第 7.5 節） | 不 commit（M0b 附加到 `.gitignore`） |
| `.cache/` | pnpm 的快取與狀態（`.cache/pnpm/`）、npm 快取、Playwright 瀏覽器（第 7.5 節） | 不 commit（M0b 附加到 `.gitignore`） |

根目錄檔案（只留工具必須在根目錄才找得到的檔案）：

| 檔案 | 用途 | 是否 commit |
| --- | --- | --- |
| `package.json` | `packageManager`、`engines`、`license`（MIT）、`browserslist`（第 6.8 節）、根層指令 | commit |
| `pnpm-workspace.yaml` | workspace 範圍、`minimumReleaseAge`、`trustPolicy`、例外清單、`storeDir`、`cacheDir`、`stateDir`（第 2.2 節、第 7.5 節） | commit |
| `pnpm-lock.yaml` | lockfile | commit |
| `.node-version` | Node major（24） | commit |
| `tsconfig.base.json` | 共用的 TypeScript 設定（第 2.3 節） | commit |
| `.oxlintrc.json`、`.prettierrc.json` | lint 與格式化設定（含純 TypeScript 套件的 `no-restricted-imports`，第 8.3 節） | commit |
| `.gitignore` | 只用附加方式補充（第 9 節） | commit |
| `README.md`、`CONTRIBUTING.md`、`SECURITY.md` | 說明、貢獻規則（含禁止不帶版本安裝 TypeScript、React Router v8 匯入路徑）、資安回報方式。README 有「授權」一節（哪些路徑適用哪一種授權），以及具名致謝陳彥宏老師的段落；致謝的文字與位置先請老師看過，看過之前 README 不放致謝段落（D6） | commit |
| `LICENSE` | 程式碼授權全文：MIT（D6） | commit |
| `LICENSES/CC-BY-SA-4.0.txt` | 原創教學內容的授權全文：CC BY-SA 4.0；寫明老師的故事情境與金額不在範圍內（D6） | commit |
| `NOTICE` | 「LedgerLand 會計樂園」的名稱與標誌另外保留，不隨 MIT 與 CC BY-SA 授出；老師的故事情境與金額「經陳彥宏老師授權使用」，不在 CC 授權範圍內（D6，寫法以 [11 風險與授權](11-risks-license.md) 第 4 節為準） | commit |
| `THIRD_PARTY_NOTICES.md` | 第三方套件、圖示、vendored tarball 的授權 | commit |
| `renovate.json` 或 `.github/dependabot.yml` | 依賴更新，設定 14 天冷卻期 | commit |
| `.env*`、`*.local` | 本機環境設定 | 不 commit |

wrangler 設定不放在根目錄：每個要部署的 app 自己帶部署設定，學習端是 `apps/web/wrangler.jsonc`（第 7.3 節），M7 的後台是 `apps/admin/wrangler.jsonc`。學習端的 `_headers` 也不放在根目錄：範本在 `apps/web/public/_headers`，建置時複製到 `apps/web/dist/`，再由 `tools/` 的 CSP 工具填入雜湊（第 11.1 節）。

### 8.1 套件切分與命名

已決定（2026-10-20）：npm 套件名稱一律 `@ledgerland/<資料夾名>`（例如 `@ledgerland/core`、`@ledgerland/web`）。每個套件的檔案配置相同：

- `src/`：原始碼。
- `test/`：測試。
- `package.json`：`exports` 直接指向 `src`，不另外 build（與原規劃相同）；Vite、Vitest、`tsc` 的模組解析要一致。
- `README.md`：寫明範圍與允許的依賴。

套件在需要時才建立，用同一份套件樣板。

| 套件 | 放什麼 | 不放什麼 | 何時建立 |
| --- | --- | --- | --- |
| `packages/tokens` | 色彩（淺色、深色）、間距、圓角、陰影、字級、動態時長與曲線、斷點、層級的原始檔（TypeScript）；產生網站的 CSS 變數檔、TS 常數、manifest 的 `theme_color` 與 `background_color`、首次繪製的背景色；日後也能產生 App 用的常數 | 元件樣式；玻璃規則（Tab bar 的玻璃在 `apps/web`，其他玻璃元件的樣式在 `packages/web-ui`） | M0b |
| `packages/i18n`（原名 `i18n-config`，已決定改名） | 語系登錄檔、網址的語系函式（`localeFromPath`、`stripLocale`、`localePath`）、金額與百分比等格式化函式、作答輸入正規化 | Lingui 的介面字串檔 | M0b |
| `packages/content-schema` | 題目、名詞、交易範本、章節、故事的 Zod schema、ID 產生、佔位符文法、內容驗證規則 | 內容本身（在 `content/`）、會計計算 | M0b |
| `packages/web-ui` | 網站與後台共用的 React 元件與其樣式：題目（ChoiceGroup 等）、回饋（FeedbackPanel）、名詞卡、報表表格、實驗室的步驟元件等；元件自己的 Lingui 字串檔 | 路由、頁面、殼層、Service Worker；App 的畫面 | 已決定（2026-10-20）：M0b 就建立（你的選擇），元件一開始就寫在這裡，後台日後直接使用 |
| `packages/core` | 只放會計：科目表、交易範本、過帳、三表、指標、五步驟勾稽、追蹤、IFRS 政策；分錄的正規化比對（合併同科目同方向的行、多重集合比對）屬於會計知識，留在這裡 | 選擇題與數字題的判分、星星、錯題本 | M1 |
| `packages/quiz` | 12 種題型的判分入口：多正解題判分 `scoreMultiChoice`（從 04 原本規劃在 `core` 的判分子目錄移過來）、數字題比對（含 N/A 與位數規則）、分錄題計分 `scoreJournalEntry`（呼叫 `core` 的分錄比對）；以固定種子打散選項；星星計算；錯題本的間隔複習排程；題目改版後（`id` 加 `rev`）的處理規則 | 畫面、儲存 | M2 |
| `packages/progress` | 進度資料模型（作答紀錄、關卡、星星、徽章、設定含 `labView`）、備份檔與文字備份碼的格式、匯入合併規則（作答紀錄取聯集、星星取最大值等）、資料版本升級（migration）、儲存介面的定義 | IndexedDB 的實作（在 `apps/web`）、原生儲存的實作（日後在 `apps/mobile`） | M2 |

各里程碑建立的項目：

- M0b：根目錄 workspace、`apps/web`、`packages/tokens`、`packages/i18n`、`packages/content-schema`、`packages/web-ui`；`apps/web/wrangler.jsonc`；隔離環境設定（第 7.5 節）；依賴方向檢查。
- M1：`packages/core`。
- M2：`packages/quiz`、`packages/progress`；`apps/web` 的 IndexedDB 儲存實作。
- M7：`apps/admin`（使用 `packages/web-ui` 預覽）。
- App 決策點（建議 M3 完成後）：選定技術後，在 `apps/mobile` 做小型試作，比照 M0a 先驗證再開工。

設計 token 的來源：以 `packages/tokens` 的 TypeScript 原始檔為唯一來源，建置時產生 CSS 變數檔、TS 常數、manifest 色碼與首次繪製背景色；媒體查詢不能用 `var()` 的斷點常數同樣由它產生（見 [07 設計系統](07-design-system.md) 第 2.1 節）。

### 8.2 依賴方向

已決定（2026-10-20）：依賴只能往下，不能循環；`packages/` 永遠不引用 `apps/`。

```text
tokens、i18n          不依賴其他內部套件
content-schema     -> i18n
core               -> content-schema、i18n
quiz               -> core、content-schema、i18n
progress           -> quiz、content-schema
web-ui             -> tokens、quiz、core、content-schema、i18n

apps/web    -> 全部
apps/admin  -> web-ui、quiz、core、content-schema、i18n、tokens
apps/mobile -> tokens、i18n、content-schema、core、quiz、progress（不含 web-ui）
tools       -> content-schema、core、quiz、i18n、tokens
```

### 8.3 純 TypeScript 套件

已決定（2026-10-20）：除了 `web-ui`，其他套件都是純 TypeScript：不碰 DOM、不碰 React、不用 Node 專屬 API。用三道機制自動把關：

1. 這些套件的 tsconfig 不含 DOM 型別（`lib` 不列 `DOM`）。
2. lint 規則（`no-restricted-imports`）禁止匯入 `react`、`react-dom`、`vite`、`node:*`。
3. `tools/` 的檢查腳本確認各套件 `package.json` 的依賴符合第 8.2 節的方向，CI 的 hygiene 工作執行它（第 10.2 節）。

## 9. repo 初始化的固定步驟（M0b 執行）

**目前事實**（2026-10-20）：

- 專案資料夾還不是 git repo。
- 根目錄的 `.gitignore` 原本只有 `references/` 一行；M0a 開工時（2026-10-20）已依第 3 步附加建置輸出、01 與 13、`/prototypes/`（M0a 試作程式與本機工具快取）與 AI 工具設定的排除規則，第一行不變。`.pnpm-store/` 與 `.cache/` 還沒有附加，M0b 補上（第 3 步）。
- 根目錄與 `references/` 底下都有 `.DS_Store`；M0a 附加的規則已經忽略它們。
- GitHub 上的 `swiftruru/ledger-land` 是公開的空 repo（沒有任何 ref），沒有東西要合併；第一次 push 就等於公開。
- `docs/plan/01-materials.md`、`docs/plan/13-material-questions.md` 與 `docs/plan/15-ai-workflow.md` 已經存在於本機，必須在任何 `git add` 之前就被 `.gitignore` 排除。

**開工前提**：D3（repo 公開，01、13 以 `.gitignore` 排除）與 D6（授權）都已在 2026-10-20 決定，所以第一次 commit 可以放授權檔。

**步驟**：

1. 記錄現有 `.gitignore` 的內容，寫進 M0b 的回報。
2. 執行 `git init -b main`，確保預設分支是 main。
3. 用附加的方式補 `.gitignore`，不整份取代，也不用編輯器另存覆蓋。要附加的規則分三段：
   - 建置與本機輸出：`.DS_Store`、`node_modules/`、`build/`、`dist/`、`coverage/`、`playwright-report/`、`test-results/`、`.local-reports/`、`.wrangler/`、`.dev.vars*`、`.env*`、`*.local`，以及專案內的 pnpm store 與快取 `.pnpm-store/`、`.cache/`（已決定七，第 7.5 節）。
   - 教材衍生文件（D3）：`docs/plan/01-materials.md`、`docs/plan/13-material-questions.md`。
   - M0a 試作程式與本機工具快取：`/prototypes/`。
   - AI 工具設定的整段排除規則（`**/.claude/`、`**/CLAUDE.md`、`**/CLAUDE.local.md`、`.mcp.json`、`docs/plan/15-ai-workflow.md` 等，完整區塊見 [15 AI 協作與本機設定](15-ai-workflow.md)（本機專用）第 9.1 節），整段照抄，不刪減。M0a 開工時已附加過這三段與 `/prototypes/`（2026-10-20），這裡只確認這些段落完整存在，不重複附加。M0a 附加的建置與本機輸出規則還沒有 `.pnpm-store/` 與 `.cache/`，M0b 另外以附加的方式補上這兩條（寫在檔案末尾，不改動既有的行）。

   附加後確認第一行仍是 `references/`。教材衍生文件與 AI 設定一律留在原位，只靠這些規則排除，不搬移任何檔案，也不建立 `docs/private/`。這一步必須在任何 `git add` 之前完成。
4. 對 `references/` 底下的每一個檔案、根目錄與 `references/` 內的 `.DS_Store`、`docs/plan/01-materials.md`、`docs/plan/13-material-questions.md`，以及每一個已存在的 AI 設定路徑（例如 `CLAUDE.md`、`.claude/settings.json`、`docs/plan/15-ai-workflow.md`），執行 `git check-ignore -v`，全部都要命中規則才繼續。
5. 執行 `git status --porcelain`，輸出不能出現 `references/`、`.DS_Store`、`01-materials.md`、`13-material-questions.md`，也不能出現任何 AI 設定路徑。
6. 第一次 commit 只明確加入指定的檔案，例如 `git add .gitignore README.md LICENSE LICENSES/CC-BY-SA-4.0.txt NOTICE`；`docs/` 底下的文件逐一列出檔名加入（01、13、15 已被排除，也不要列出）。不使用 `git add -A` 或 `git add .`。README 的致謝段落要等老師看過文字與位置後才加入（第 8 節）。
7. push 前執行 `git ls-files`，用 grep 比對 `references/`、`.xlsx`、`.pdf`、`.DS_Store`、`01-materials.md`、`13-material-questions.md` 與 AI 設定路徑（`.claude/`、`CLAUDE`、`AGENTS.md`、`.mcp.json`、`15-ai-workflow.md` 等），結果必須是空的；再用 `git log --all --name-only --format=` 對所有分支的歷史紀錄做同樣的比對，結果也必須是空的。
8. 執行 `git ls-remote` 確認遠端狀態。若遠端已經有 commit，先 fetch 再 rebase；若遠端也有 `.gitignore`，合併方式是「保留本機每一行，再附加遠端新增的行」，禁止 `checkout --theirs` 或整份取代。絕不 force push。
9. push 前停下來，由你確認。repo 是公開的（D3），這一步就是公開，git 歷史無法撤回。
10. 以上完成後，才執行 `pnpm install`、加入 pre-commit hook（工具於 M0b 選定）與 CI。pre-commit hook 要等 `pnpm install` 之後才存在，CI 要等 push 之後才執行，所以兩者都只是後續的防線，前面的步驟才是第一道防線。

**建立骨架的規則**（第 10 步之後，加入 `apps/web`、`packages/*` 等目錄時）：

- 不在專案根目錄或任何非空的資料夾執行會詢問「是否清空」或會覆寫既有檔案的產生器指令。
- 需要產生器時，先在 `prototypes/` 底下的暫存資料夾（已被 `.gitignore` 排除；程式相關內容不寫到 `ledger-land/` 以外）產生，再逐檔複製需要的檔案；複製前確認不會覆蓋 `.gitignore`、`README.md`、`LICENSE`、`NOTICE`、`docs/` 與 `references/`。產生器若附帶自己的 `wrangler` 設定或 `.gitignore`，不直接複製，只把需要的設定併入既有檔案。
- 每次加入骨架後執行 `git status --porcelain`，確認只有預期的新增檔案，沒有任何既有檔案被修改或刪除。

M0b 的完成標準要附上第 1、4、5、7、8 步的指令輸出。

## 10. CI workflows

### 10.1 workflow 一覽

| workflow | 觸發 | 內容 | 擋下合併或部署 |
| --- | --- | --- | --- |
| `ci.yml` | pull request、push 到 main | 第 10.2 節的全部工作；只跑受影響的套件（`pnpm --filter "...[origin/main]"`），改到 `packages/` 時，用到它的 app 測試也一起跑；`apps/web` 的建置輸入（`content/`、`schemas/`、`tools/`）有變動也算受影響，所以只改內容時同樣執行 `content:check` | 是 |
| `deploy.yml` | `ci.yml` 在 main 上全部通過後，而且 `apps/web` 或它依賴的套件有變動（`apps/web` 的建置輸入 `content/`、`schemas/`、`tools/` 有變動也算，所以只改內容的合併同樣部署） | 在 `apps/web` 目錄執行 wrangler（`pnpm --filter @ledgerland/web exec wrangler deploy`，或 workflow 的 `working-directory: apps/web`），整批部署到 Cloudflare Workers（`ledgerland.swift.moe`）；`concurrency` 確保同時只有一個部署；部署後執行第 7.4 節的煙霧測試 | 不適用 |
| `preview.yml` | pull request | 同樣在 `apps/web` 目錄以 `wrangler versions upload` 上傳不切換正式流量的版本，取得預覽網址並留言在 PR 上（指令與預覽網址的存取保護於 M0b 查證）；上傳後對預覽網址執行 Playwright E2E，全部通過才允許合併與部署；fork 的 PR 拿不到 secrets，不部署預覽，只靠 `ci.yml` 的 e2e 工作 | 是 |
| `scheduled.yml` | 每週一次 | 例外清單到期檢查、`pnpm audit`、對正式網址的 Lighthouse 趨勢紀錄（含 D7 的統計腳本） | 失敗時開 issue 提醒 |

所有 workflow 預設 `permissions: contents: read`；`actions/checkout` 一律設 `persist-credentials: false`。部署到 Cloudflare 不需要 GitHub 的額外權限，只需要 repo secrets 中的 `CLOUDFLARE_API_TOKEN`（權限只限這個帳號的 Workers 與 `swift.moe` 這個 zone 的必要範圍）與 `CLOUDFLARE_ACCOUNT_ID`；token 由你在 Cloudflare 建立並存進 repo secrets。若部署流程要建立 [08 題庫與後台](08-content-admin.md) 的 `content/v{n}` tag，只有 `deploy.yml` 另外加 `contents: write`。預覽網址是另一個 origin，進度不會和正式網址共用，一律視為測試資料，也不啟用統計。M7 的管理後台另有自己的部署 workflow（獨立的 Worker、`apps/admin/wrangler.jsonc` 與 D1 migration），細節在 M7 開工前定案。

已決定（2026-10-20）：部署維持由 GitHub Actions 執行 wrangler，不使用 Cloudflare 儀表板的 Git 整合（Workers Builds），理由見第 7.5 節。學習端的 workflow 一律在 `apps/web` 目錄執行 wrangler（M7 的後台 workflow 在 `apps/admin` 執行），所以目錄調整只改 repo 裡的 wrangler 設定與 workflow，不需要改 Cloudflare 的設定。

### 10.2 `ci.yml` 的工作

| 工作 | 指令或內容 | 通過條件 |
| --- | --- | --- |
| install | `pnpm install --frozen-lockfile` | 成功；lockfile 中 `typescript` 為 6.0.3 |
| lint | `oxlint`（啟用 typescript、react、jsx-a11y、import、vitest，type-aware 只當輔助）、`prettier --check`、台灣用語與破折號掃描（docs、content、介面字串）、workflow 的 SHA 釘版檢查；純 TypeScript 套件的 `no-restricted-imports`（禁止匯入 `react`、`react-dom`、`vite`、`node:*`，第 8.3 節） | 沒有錯誤 |
| typecheck | `tsc -b`（TypeScript 6.0.3） | 沒有錯誤；這是型別的權威結果 |
| test | `vitest run`：會計核心單元測試、fast-check 性質測試、黃金測試、元件測試；`*.local.test.ts` 自動排除 | 全部通過；`packages/core` 的覆蓋率達門檻（門檻數字 M1 定案） |
| content | `content:check`：Zod 格式與必填欄位、各語系欄位、引用存在、範本借貸平衡、核心算得出答案且與作者填的一致、佔位符中英一致、已發布 ID 不得消失、`published.lock.json` 的 rev 檢查；`schemas:check`：重新產生 JSON Schema 後 `git diff --exit-code`；`docs:examples`：抽出 `docs/` 中所有 `json` 程式碼區塊，全部要能解析，有對應 schema 的範例（M0b 起是名詞與章節，M1 起加上題目、交易範本與故事）要通過同一套 Zod 驗證（見 [08 題庫與後台](08-content-admin.md)） | 全部通過 |
| i18n | `lingui extract` 後確認 catalog 沒有未 commit 的變動；`lingui check missing --mode catalog --locale en`；`content:i18n-report`（只對已發布的內容、complete 語系強制；內容只有中英兩種語言都齊全時才能設為 published） | complete 語系沒有缺字 |
| build | 以根路徑建置 `apps/web` 一次（base path 已定為 `/`），產物在 `apps/web/dist/`；檢查產物：`sw.js` 存在、manifest 正確、precache 清單涵蓋殼層、JS、CSS 與內容 JSON 而且不含統計腳本；`index.html` 含完整的靜態 Tab bar（`#ll-tabbar` 與五個連結，D8）與緊接在後的殼層在地化腳本、不含 `style` 屬性；`_headers` 的 CSP 雜湊與 `index.html` 的兩段 inline 腳本（boot 腳本、殼層在地化腳本）及首次繪製的 `<style>` 一致；有 `backdrop-filter` 的 CSS 規則都同時有 `-webkit-backdrop-filter`（第 6.8 節）；站內連結都有結尾斜線 | 全部通過；上傳建置產物給後續工作 |
| budget | 首次載入 JS（gzip）不超過 150 KB（暫訂，見 [06 PWA 與響應式](06-pwa-responsive.md)），中文入口與 `/en/` 入口分別計算（英文多載入 en catalog）；precache 總量不超過預算（數字由 M0a 實測後提出）；QR 解碼器與 Excel 相關函式庫不得出現在首次載入的 chunk | 不超過預算 |
| e2e | Playwright 專案：`iphone-webkit`（iPhone 裝置設定加 WebKit）、`desktop-chromium`、`desktop-firefox`，另有 `reducedMotion: 'reduce'` 的專案並做截圖比對；純鍵盤操作流程；直接開啟中文與 `/en/` 的深層連結；作答中切換語言後題目、已選選項、計時與捲動位置都保留；離線測試（SW 就緒後切離線，冷啟動與導覽，含 `/en/` 網址）；把統計服務的網域攔截成失敗時，功能與離線測試都不受影響；更新提示測試（作答中不出現）；監聽 `securitypolicyviolation`，有任何 CSP 違規就失敗；INP 用腳本實際操作量測（作答一題、分類、在實驗室改一個數字）；PR 另由 `preview.yml` 對預覽網址再跑一次（第 10.1 節） | 全部通過 |
| axe | `@axe-core/playwright` 掃描固定頁面清單，兩種語系、淺色與深色各一次 | 沒有 serious 或 critical 問題 |
| lighthouse | lighthouse 13 CLI 對本機伺服器跑固定網址，伺服器要重現 Workers 的行為（沒有對應檔案的路徑回 `index.html`、狀態碼 200，並套用 `_headers`；候選做法是在 `apps/web` 執行 `wrangler dev`，不穩定時改用自寫的靜態伺服器），每個網址 5 次取中位數；以 metric 做 assertion，不依賴 audit ID；記錄 `benchmarkIndex` 並據此校準 `cpuSlowdownMultiplier`。量測時照正式網站的方式載入 D7 的統計腳本，但送出目的地指向 stub 端點（不送出真實資料，設定見 06 第 8.2 節的 `perf/urls.json`），讓統計腳本的成本計入效能預算；正式網址的長期趨勢由 `scheduled.yml` 量測 | 行動版效能至少 90、無障礙至少 95；LCP 不超過 2.5 秒；CLS 不超過 0.1（只有 Chromium 量得到） |
| hygiene | `git ls-files` 不得出現 `references/`、`.xlsx`、`.pdf`、`.DS_Store`、`docs/plan/01-materials.md`、`docs/plan/13-material-questions.md`，也不得出現 AI 設定路徑（`.claude/`、`CLAUDE.md`、`CLAUDE.local.md`、`AGENTS.md`、`.mcp.json`、`docs/plan/15-ai-workflow.md` 等）；`.gitignore` 仍包含上述排除規則；`release-age-exceptions.json` 與 `pnpm-workspace.yaml` 一致且沒有過期條目；`tools/` 的依賴方向檢查（各套件 `package.json` 的依賴符合第 8.2 節的方向，`packages/` 不引用 `apps/`）；純 TypeScript 套件的 DOM 禁用檢查（`web-ui` 以外的套件 tsconfig 的 `lib` 不列 `DOM`，第 8.3 節） | 全部通過 |

固定量測網址：首頁 `/`、一個章節頁 `/chapter/<chapterId>/`（頁面上是該章的關卡列表，例如 `/chapter/ch_c5f8w2/`）、一個作答頁 `/level/<levelId>/`（例如 `/level/lv_k7m2q9xd/`）、實驗室故事第 7 筆 `/lab/story/<storyId>/<stepId>/`（例如 `/lab/story/story_k8p3x6/st_r2x9k4/`），另加同一個關卡的英文作答頁 `/en/level/<levelId>/`（例如 `/en/level/lv_k7m2q9xd/`，D5），確認英文殼層與英文 catalog 同樣達標。實際清單寫在 06 的 `perf/urls.json`，兩份文件一致。路由格式以 [02 網站架構](02-site-architecture.md) 為準，所有路徑都帶結尾斜線，ID 格式依 [08 題庫與後台](08-content-admin.md) 第 4.1 節（以上 ID 為示意）。作答頁與實驗室都經由 SPA fallback 直接開啟。還沒有對應頁面的里程碑，只量已存在的頁面。

注意事項：

- Playwright 的 WebKit 由上游 WebKit 原始碼建置，不等於 iOS Safari。PWA 安裝、主畫面模式、儲存隔離、拖曳手感等，仍要依 [10 里程碑](10-milestones.md) 的手動清單在實機上檢查；實機清單包含一台 iOS 17 裝置（D8，沒有實機時用 Simulator 並在報告註明）。
- Lighthouse 12 起已經沒有 PWA 類別，PWA 的驗收改用上面的離線與更新測試，加上 iOS 手動檢查清單。
- `@lhci/cli` 0.15.1 內建的是 Lighthouse 12.6.1，audit ID 和 DevTools 的 13.x 不同，所以直接用 lighthouse 13 CLI 加自寫 assertion。
- 對老師 Excel 的本機驗證不在 CI 執行（CI 環境沒有 `references/`）。

來源：https://playwright.dev/docs/browsers 、https://developer.chrome.com/blog/lighthouse-13-0 、https://github.com/GoogleChrome/lighthouse/releases/tag/v12.0.0 。查證日期 2026-10-20。

## 11. 安全與隱私

### 11.1 CSP 基準

在 M0a 實測後定案（【待實測 V15】）。主機採 Cloudflare Workers（D4），完整的 CSP 寫在 `_headers`；D7 的統計服務網域在 M0b 開工前查證後填入：

| 指令 | 值 | 說明 |
| --- | --- | --- |
| `default-src` | `'self'` | 除了 D7 的統計服務之外，不載入任何第三方資源（第 11.3 節） |
| `script-src` | `'self'`、建置期計算的兩個 `'sha256-...'`，以及 D7 統計服務的腳本網域 | 雜湊涵蓋兩段 inline 腳本：head 裡的 boot 腳本（玻璃層級、`isAppMode()`、主題、減少動態、語系，見 05、06、07），以及緊接在 `nav` 之後的殼層在地化腳本（英文頁的 Tab bar 標籤、`href` 與 `aria-label`，見 06 第 2.3 節、07 第 6.1 節）。統計腳本的網域以 Cloudflare 網頁分析為例，常見的是 `https://static.cloudflareinsights.com`，本次沒有查證，M0b 前確認後才寫入 |
| `style-src` | `'self'` 加上建置期計算的 `'sha256-...'` | 除了 head 裡那段首次繪製背景色的 `<style>`（見 [06 PWA 與響應式](06-pwa-responsive.md) 第 2.3 節），樣式全部是外部檔案；這段 `<style>` 的背景色由 `packages/tokens` 產生，內容改變時雜湊跟著重算 |
| `style-src-attr` | 不另外設定，沿用 `style-src`（不允許 inline 的 `style` 屬性） | `index.html` 殼層（含靜態 Tab bar 的標記）不得有 `style` 屬性；React 與動畫函式庫透過 CSSOM（`element.style`）設定樣式，不受這條限制；用 `setAttribute('style', ...)` 會被擋下，由 e2e 的 `securitypolicyviolation` 監聽抓出 |
| `img-src` | `'self' data:` | 允許 data URL 的小圖示；統計服務若以圖片回報，查證後另外加上它的網域 |
| `font-src` | `'self'` | 使用系統字型，不從外部載入 |
| `connect-src` | `'self'` 加上 D7 統計服務的回報網域 | 內容 JSON 與 SW 只需要 `'self'`。回報網域以 Cloudflare 網頁分析為例，常見的是 `https://cloudflareinsights.com`，本次沒有查證，M0b 前確認後才寫入 |
| `worker-src`、`manifest-src` | `'self'` | SW 與 manifest；QR 解碼器若用 Web Worker 也只從 `'self'` 載入（第 6.9 節） |
| `object-src` | `'none'` | 不使用外掛內容 |
| `base-uri` | `'self'` | 防止竄改 base |
| `form-action` | `'none'` | 本站沒有送出表單的流程 |
| `frame-ancestors` | `'none'` | 只有 header 有效；防止被嵌入框架 |

**為什麼可以不開 `'unsafe-eval'`**：交易範本的受控運算式由 `packages/core` 的手寫 parser 在建置期驗證並轉成 AST，執行期依 AST 求值，禁止 `eval` 與 `new Function`（見 [04 會計核心](04-accounting-core.md)）。說明文字也在建置期編譯成 AST，不插入原始 HTML。QR 解碼器若需要 WebAssembly，就要加 `'wasm-unsafe-eval'`，所以選型時優先選不需要放寬的實作（第 6.9 節）。

**CSP 只放在 header**：

- `index.html` 是唯一的殼層，inline 內容只有兩段 inline 腳本（head 的 boot 腳本、`nav` 之後的殼層在地化腳本）與一段 `<style>`，雜湊固定，所以完整的 CSP 直接寫在 `_headers` 的 `/*` 規則，不使用 meta CSP。
- 雜湊由 `tools/` 的 CSP 工具在建置後計算並填入 `apps/web/dist/_headers`；boot 腳本、殼層在地化腳本或 `<style>` 一改，雜湊就跟著重算，CI 比對兩段腳本與 `<style>` 的雜湊都和 `_headers` 一致（第 7.4 節、第 10.2 節）。
- 同一頁不要同時有 header 與 meta 兩份 CSP：瀏覽器會同時套用每一份，任何一份沒有允許的內容都會被擋下。
- `frame-ancestors 'none'` 透過 header 生效，[11 風險與授權](11-risks-license.md) 第 2 節第 30 列的 clickjacking 風險因為 D4 採用 Cloudflare 而得到緩解。
- 若日後改用 framework mode 加 prerender（第 3.3 節），每一頁的 inline 腳本都不同，就要改成建置後替每個 HTML 注入 meta CSP，header 只留與腳本、樣式無關的指令；這是屆時的工作，現在不做。

### 11.2 `_headers` 的完整寫法

範本如下。角括號是建置時或查證後才填入的值：`<boot 腳本的雜湊>`、`<殼層在地化腳本的雜湊>` 與 `<首次繪製 style 的雜湊>` 由 CSP 工具填入；`<統計腳本網域>` 與 `<統計回報網域>` 在 M0b 開工前查證 D7 的服務後填入，CI 檢查產物中不得殘留角括號。

```text
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' '<boot 腳本的雜湊>' '<殼層在地化腳本的雜湊>' <統計腳本網域>; style-src 'self' '<首次繪製 style 的雜湊>'; img-src 'self' data:; font-src 'self'; connect-src 'self' <統計回報網域>; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=(), usb=()

/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

- `Permissions-Policy` 的 `camera=(self)`：D10(a) 決定在 App 內用相機掃描課堂 QR，所以本站自己的頁面可以要求相機權限，其他來源（例如被嵌入的框架）一律不行；其餘功能維持全部關閉。
- `Referrer-Policy: no-referrer` 是隱私優先的選擇：站外連結（例如授權說明）不會收到來源網址。查證 D7 的統計服務時，一併確認它在這個設定下能正常運作；若不能，改成 `strict-origin-when-cross-origin` 並在隱私說明頁寫明。
- `Strict-Transport-Security`：網域已定為 `ledgerland.swift.moe`（D4），建議只在這個主機名稱上加 `max-age=31536000`，不加 `includeSubDomains` 與 `preload`，避免影響 `swift.moe` 底下的其他網站；也不使用 Cloudflare 在整個 zone 層級的 HSTS 設定。是否啟用與 max-age 的數值在 M0b 確認 HTTPS 正常後定案。
- 管理後台（M7）在自己的 origin 另有一套標頭，不共用這份 `_headers`。

### 11.3 不載入第三方資源

- 字型用系統字型；圖示（Phosphor）打包進站內；不使用任何 CDN、嵌入影片、社群按鈕或第三方腳本。
- 唯一的例外是 D7 的流量統計（已決定 D7，2026-10-20）。服務在 M0b 開工前查證後提出，候選是 Cloudflare 的網頁分析；查證內容至少包括：是否不用 cookie、不收集個資；腳本與回報的網域（寫進第 11.1 節的 CSP）；單頁應用內的換頁是否計入；在 `Referrer-Policy: no-referrer` 下能否運作；能否關閉 Cloudflare 在邊緣自動插入腳本的功能，改由網站自己控制載入。
- 統計腳本的載入規則，確保不影響離線使用與效能預算：
  - 只有正式網域 `ledgerland.swift.moe` 的建置把資料送到正式統計端點。CI 的效能量測照正式網站的方式載入統計腳本，但送出目的地指向 stub 端點，不送到正式統計端點，也不送出真實資料，讓它的成本計入效能預算（第 10.2 節，見 06 第 8.2 節）；本機開發、PR 預覽與 M0a 的暫時網址不載入，避免測試流量混入正式統計。
  - 由網站自己的程式在頁面載入完成之後才插入腳本，不寫在 `index.html` 的初始內容裡，不在首次載入的關鍵路徑上；離線時不插入。
  - 不進 precache；載入或回報失敗一律忽略，不顯示錯誤、不重試、不寫入錯誤紀錄。
  - 只送匿名的頁面瀏覽：網址只送路徑（內容 ID），查詢字串一律去掉（見 06 第 8.3 節）。
  - debug 頁顯示統計是否啟用、服務名稱與送出的內容（見 [06 PWA 與響應式](06-pwa-responsive.md)）。
- 學習端不載入任何驗證 SDK，也不使用匿名登入。
- 管理後台（已決定 D10(e)，M7）：Cloudflare Access 加 Workers 加 D1，一律放在獨立的 origin（主機名稱在 M7 開工前決定），避免學習端的 XSS 取得後台的 token。權限在伺服器端檢查：Worker 驗證 Access 的 JWT，再查 D1 的角色表；發布時輸出靜態快照，學習端只讀快照、不放任何登入元件；題目版本紀錄與還原用 D1 的 revisions 表，D1 Time Travel 只當災難還原。Access 的獨立兩步驟驗證在免費方案能否使用待實測（【待實測 V10】），不行就改用 IdP 本身的兩步驟驗證並在 M7 前回報。細節見 [08 題庫與後台](08-content-admin.md)。

### 11.4 隱私說明頁

路徑依 [02 網站架構](02-site-architecture.md) 的頁面地圖，中文是 `/privacy/`，英文是 `/en/privacy/`（D5），內容至少包括：

- 不需要登入，不收集姓名、email 或任何個人資料。
- 學習進度、設定與錯誤紀錄只存在你的裝置上（IndexedDB 與 localStorage），不會上傳。
- 網站本身不寫入 cookie，也沒有廣告。
- 流量統計（D7）：寫明服務名稱、收集的內容（例如瀏覽的頁面路徑、瀏覽器類型與載入效能，以查證結果為準；網址只送路徑，查詢字串一律去掉）、不使用 cookie、不收集個資，以及資料由誰保存；只在正式網址啟用。
- 相機（D10(a)）：只在你按下「掃描 QR」時才要求相機權限；影像只在裝置上解碼，不上傳也不保存。
- 主機業者（Cloudflare）會記錄存取紀錄（包括 IP 位址），依主機業者的政策保存。
- 匯出的備份檔只包含學習進度；錯誤紀錄要不要附在匯出檔裡由你選擇。
- 如何刪除資料：「我的 › 設定」的「清除這台裝置上的資料」（需再次確認，見 02 第 7 節），或在瀏覽器清除網站資料；提醒刪除後無法復原，建議先到「我的 › 備份」（`/me/backup/`）匯出。
- Safari 分頁與主畫面 App 的資料很可能是分開的，以及「降低被清除的機率」的說明（不承諾不會被清除，見 [06 PWA 與響應式](06-pwa-responsive.md)）。

### 11.5 其他

- 每週執行 `pnpm audit`，有高風險公告時評估是否用 `minimumReleaseAgeExclude` 提前升級（並記錄到期日）。
- `SECURITY.md` 寫明資安問題的回報方式。
- 對老師 Excel 的本機測試不產生 snapshot，輸出只寫到 gitignored 的 `.local-reports/`。

## 建議新增的待確認

以下是撰寫本文件時發現、registry 還沒有編號的事項，供統一審稿時決定是否新增：

- `@axe-core/playwright`、體積預算工具、Phosphor 圖示、pre-commit hook 工具的版本，以及 oxlint 1.87.0 與 Prettier 3.9.9 的發布日，本次沒有查證，要在 M0b 依兩週規則確認。
- React 19.3 的 `<ViewTransition>` 在不支援的瀏覽器上是否只是沒有動畫、不會出錯，以及與 React Router 8 導覽的整合寫法（研究標為 UNCERTAIN），建議列為 M0a 的實測事項。
- Workers 預覽網址（`wrangler versions upload`）的存取保護、是否預設公開與費用，本次沒有查證。
- oxlint-tsgolint 是否內建自己的 TypeScript 7 引擎，以及它和 `tsc` 6 結果不一致的程度（研究標為 UNCERTAIN）。
- 匯出備份檔（blob 下載與分享表單）在本文件的 CSP 下是否正常運作。
- M0a 的 HTTPS 預覽與 M0b 的部署，要在 `swift.moe` 所在的 Cloudflare 帳號建立 API token（權限只限 Workers 與這個 zone 的必要範圍）；token 要由你建立並存進 repo secrets。
- data mode 下「中文沒有語系段、英文在 `/en/`」由同一個函式產生兩組路由的寫法是否順利（不順利時才改用 `en?` 選用路由段的退路），以及 Workers 的 SPA fallback 是否套用 `_headers`、遺失的 `/assets/` 檔案回 404 還是殼層、沒有結尾斜線的網址如何補斜線，建議列為 M0a 的實測事項。
- D7 統計服務（候選 Cloudflare 網頁分析）的腳本與回報網域、單頁應用換頁的計入方式、在 `Referrer-Policy: no-referrer` 下能否運作、能否關閉邊緣自動插入腳本，本次沒有查證，要在 M0b 開工前查證。
- 是否在設定頁提供「不傳送統計」的開關（D7 沒有要求，屬於額外的隱私選項），供統一審稿時決定。
- D12 的 Excel 範本需要「判分方式」下拉欄：哪一個符合授權白名單的函式庫能寫出含資料驗證清單的 `.xlsx`，或改為手工維護範本檔，要在 M6 開工前查證。
- D10(a) 的 QR 解碼器是否需要 WebAssembly 或 `blob:` Worker（會影響 CSP），以及 iOS 主畫面 App 與 iOS 17 上相機權限的實際行為，要在 M2 開工前查證。
- `Strict-Transport-Security` 是否啟用與 max-age 數值，以及 `ledgerland` 這個主機名稱在 DNS 上沒有既有記錄，要在 M0b 確認。
- 2026-10-20 的 repo 結構與隔離環境決定（已決定六、七）帶來的查證與驗證事項，已列在 [14 待確認](14-open-questions.md) 第 5 節，不新增 registry 編號：`apps/mobile` 的技術（建議 M3 完成後由你決定，第 5.2 節）；Lingui macroTransform 對 workspace 套件原始碼的處理（M0b，第 5.3 節）；pnpm 11 由專案管理 Node 版本的寫法、Cloudflare Workers 退回上一版的指令、pnpm store 放在 repo 內時 CI 快取的設定（都在 M0b，第 5.4 節）。
