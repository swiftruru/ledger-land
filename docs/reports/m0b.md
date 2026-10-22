# M0b 基礎建設：里程碑回報（2026-10-22）

對照 `docs/plan/10-milestones.md` 第 7 節的範圍、交付物與完成標準。本機專用的原始輸出（指令記錄、Lighthouse 報告、E2E 記錄）不在 repo 內；本文只保留結論與可以公開的數字。

## 1. repo 初始化（09 第 9 節）

- 先記錄既有的 `.gitignore`，再以附加方式加入 `.pnpm-store/`、`.cache/`，之後又附加 `apps/web/public/content/`（內容管線的輸出）；第一行始終是 `references/`。
- `git init -b main`；`git check-ignore -v` 確認教材目錄、本機專用文件與試作目錄都命中對應的規則；`git status --porcelain` 只列出 `.gitignore` 與公開的規劃文件。
- 第一個 commit 只含 `.gitignore` 與 `docs/PLAN.md`、`docs/plan/02` 到 `12`、`14`、`16`、`17`，`git add` 用明確的檔案清單。每次加入骨架後再看一次 `git status --porcelain`，沒有既有檔案被修改或刪除。
- push 之前的掃描：已追蹤檔案與全部歷史都沒有禁止路徑；`git ls-remote` 確認遠端是空的；201 個檔案的清單經專案維護者看過後才 push。

## 2. 隔離環境（範圍第 13 項；14 第 5.4 節的查證）

- `tools/env.sh`：npm 快取、pnpm state、Playwright 瀏覽器、XDG 設定與快取、wrangler 設定與記錄檔、TMPDIR 都在 `.cache/`。pnpm 以 `npx -y pnpm@11.28.5` 從 `.cache/npx-boot`（一個空的 package.json）啟動再 `--dir` 指回專案，另有 `.cache/pnpm-home/pnpm` 墊片給子程序用。原因：npm 會用啟動它的 Node 檢查目前目錄 `package.json` 的 `devEngines`，不認得 `onFail: download`。
- **pnpm 11 的 `devEngines.runtime` 可行，已採用**：`{ name: "node", version: "24.21.0", onFail: "download" }`，`pnpm install` 時下載 Node 到 `.pnpm-store/v11/links/@/node`（repo 內），lockfile 記錄版本；`.node-version` 寫 `24` 給 CI 的 setup-node。第一次安裝自動挑到 24.22.1（未滿兩週），改為精確釘 24.21.0。
- `stateDir` 自 pnpm 11.22 起不能寫在 `pnpm-workspace.yaml`，改用環境變數 `pnpm_config_state_dir`（本機與 CI 都是）。
- CI 快取：`actions/cache` 直接快取 `.pnpm-store` 與 `.cache/pnpm`（key 用 `pnpm-lock.yaml` 的 hash）；setup-node 的 `cache: pnpm` 不適用這種配置。
- 信任政策：M0a 的兩個例外（`semver@6.3.1`、`@trickfilm400/rollup-plugin-off-main-thread`）再次觸發，沿用 2026-10-20 的同意，記錄在 `tools/trust-policy-exceptions.json`；`check:exceptions` 比對它與 `pnpm-workspace.yaml`。`allowBuilds` 全部 false，安裝不執行第三方腳本。
- 結構驗收 1：`pnpm install --frozen-lockfile` 在沒有 `node_modules` 的狀態完成，store 約 1.2 GB（含 Node）、快取約 2.7 GB（含三個 Playwright 瀏覽器），沒有寫到 repo 以外的新位置。

## 3. 版本（兩週規則，截止 2026-10-08）

釘定：react 19.3.0、react-router 8.4.0、vite 8.3.3、@vitejs/plugin-react 6.1.2、vite-plugin-pwa 2.0.0、workbox-window 7.4.1、Lingui 6.9.0、zod 4.6.5、zustand 5.0.15、vitest 5.0.3、@vitest/browser-playwright 5.0.3、vitest-browser-react 2.3.0、fast-check 4.10.2、@fast-check/vitest 0.5.0、@playwright/test 1.64.0、@axe-core/playwright 4.13.0、lighthouse 13.5.0、web-vitals 6.2.3、oxlint 1.87.0、prettier 3.9.9、typescript 6.0.3（lockfile 只有這一版，`check:exceptions` 把關）、wrangler 4.148.0、lightningcss 1.33.0、browserslist 4.29.3、@phosphor-icons/core 2.1.1、@types/node 24.19.1。vite 8.3.4 與 wrangler 4.149.0 都在截止日之後幾小時發布，沒有採用。沒有加入：idb（M2 再加）、oxlint-tsgolint（type-aware 檢查先用 tsc）、@vite-pwa/assets-generator（圖示沿用 M0a 產生的原創 PNG）。`packageManager: pnpm@11.28.5`、`minimumReleaseAge: 20160`、`trustPolicy: no-downgrade`。

GitHub Actions 全部以完整 commit SHA 加版本註解釘版：checkout v7.0.1、setup-node v7.1.0、pnpm/action-setup v6.1.0、upload-artifact v7.0.2、download-artifact v8.0.2、github-script v9.0.0、cache v6.1.0。`check:actions`：4 個 workflow、34 個 action 都釘版。

## 4. 做了什麼（範圍第 1 到 14 項）

| 範圍 | 內容 |
| --- | --- |
| 1 repo 初始化 | 第 1 節 |
| 2 工具鏈 | 根目錄 `package.json`、`pnpm-workspace.yaml`、`tsconfig.base.json`、`.oxlintrc.json`（typescript、react、jsx-a11y、import、vitest；純 TypeScript 套件的 `no-restricted-imports`）、`.prettierrc.json`、`vitest.config.ts`（node 專案加 web-ui 的 Browser Mode WebKit）、`playwright.config.ts`（iphone-webkit、desktop-chromium、desktop-firefox、reduced-motion） |
| 3 CI 與部署 | `ci.yml`（verify、build、e2e 三個工作）、`deploy.yml`（ci 在 main 通過後、只在 apps/web 或建置輸入有變動時部署、煙霧測試）、`preview.yml`（`wrangler versions upload`、留言預覽網址、對預覽網址跑 E2E；fork 與 Dependabot 的 PR 不跑）、`scheduled.yml`（每週：例外到期、pnpm audit、正式網址 Lighthouse、失敗開 issue）；`dependabot.yml` 14 天冷卻，忽略 typescript 與 @types/node 的主版本 |
| 4 語系架構 | `packages/i18n`：登錄檔、`localeFromPath`、`stripLocale`、`localePath`、`switchLocalePath`、`normalizePath`、格式化（NT$、百分比、單位、萬元 / million、日期）、輸入正規化；40 個單元與性質測試。路由由同一個函式產生 `/` 與 `/en` 兩組；boot 腳本依路徑寫 `html lang`、根路徑依 `ll:locale` 轉 `/en/`；語言切換開關、切換提示、作答狀態在 Zustand store 的示範頁 |
| 5 design tokens | `packages/tokens/src` 為唯一來源；`tokens:build` 產生 `generated/tokens.css`（四個主題區塊、動態 token 只在 `:root`、`@supports linear()`、減少動態覆寫）；`firstPaintStyle()`、`THEME_COLOR`、`MANIFEST_COLORS`、斷點常數給建置用；對比測試對淺色與三個風味各跑 23 組配對加結構檢查；設定頁的外觀、深色風味與玻璃開關；玻璃 Tab bar 沿用 M0a 定案的實作 |
| 6 PWA 殼層 | manifest（id、scope、start_url 都來自 `site.config.ts`）、圖示與 iOS 啟動圖、`sw.js`（generateSW、prompt 模式）、離線殼層、更新提示與「已經可以離線使用了」、每條路由的 ErrorBoundary（動態載入失敗提示重新整理）、本機錯誤紀錄（IndexedDB 環狀 50 筆） |
| 7 內容 pipeline | `tools/content-build.mjs`（正規化、`content-manifest.json`、依語系與章節切分的 hashed JSON）；`packages/content-schema`（Term、Chapter 的 Zod schema、ID 規則、佔位符語法、`validateBundle`）；`schemas/*.schema.json` 以 draft-07 輸出；`content:check`（結構、引用、佔位符跨語言一致、published 的 en 齊全、lock）；`docs:examples`（62 個 JSON 區塊、5 個範例通過） |
| 8 安全與隱私 | `_headers` 範本，`tools/postbuild.mjs` 填入兩段 inline 腳本與 style 的 sha256 與統計服務的兩個網域，並檢查殼層、sw.js、manifest、precache、CSS 前綴、結尾斜線、wrangler 設定、沒有殘留的佔位；HTML 與資產回應加 `Cache-Control: no-transform`；隱私頁與關於頁的中英草稿 |
| 9 debug 頁 | 版本、語系、顯示模式、儲存、版面與媒體查詢、玻璃、SW、數字格式、web-vitals、統計狀態、CSP 違規、錯誤紀錄 |
| 10 授權檔 | `LICENSE`（MIT）、`LICENSES/CC-BY-SA-4.0.txt`、`NOTICE`、`content/README.md`、README 的授權表與「名稱與標誌」、`THIRD_PARTY_NOTICES.md`（`tools/licenses.mjs` 產生，86 個執行期套件，白名單檢查）；致謝段落依 T34 暫不加入 |
| 11 流量統計 | D7 Cloudflare Web Analytics（JS Snippet 手動安裝）：App 掛載、load 之後、idle 時插入；只在正式 origin；`?ll-analytics=stub` 時照正式方式載入腳本但回報改送同源的 stub 端點；失敗一律略過；CSP 的 script-src 與 connect-src 各加一個網域；隱私頁與 debug 頁寫明服務與收集內容 |
| 12 monorepo 骨架 | apps/web、packages/tokens、i18n、content-schema、web-ui（Segmented、Banner、Card、Button、ChoiceGroup、FeedbackPanel 與自己的 catalog）、tools、content、schemas；每個套件 `exports` 指向 `src` |
| 13 隔離環境 | 第 2 節 |
| 14 依賴方向 | `tools/check-deps.mjs`、`check-dom.mjs`、oxlint 的 `no-restricted-imports`；CI 的 verify 工作執行 |

## 5. 完成標準逐項對照

| 標準 | 結果 |
| --- | --- |
| 初始化步驟的輸出；`git ls-files` 與歷史掃描為空 | 通過（第 1 節） |
| 本機專用文件仍在原位且被忽略 | 通過 |
| `.gitignore` 第一行仍是 `references/`，其餘附加 | 通過 |
| 每次加入骨架後的 `git status --porcelain` | 通過 |
| packageManager、.node-version、TypeScript 6.0.3、minimumReleaseAge、trustPolicy | 通過（第 2、3 節） |
| workflow 以 SHA 釘版，CI 能抓到未釘版 | 通過（刻意失敗第 7 項） |
| `ci.yml` 在一個 PR 上通過 | 通過（PR 1：verify、build、e2e、preview 全綠後 squash 合併） |
| 刻意失敗各試一次 | 通過：en 缺字、schema 不一致、引用不存在的名詞、JS 超預算、過期例外、白名單外授權、未釘版 action、純 TS 套件匯入 react，8 項都失敗，還原後都通過 |
| 整批部署成功；有 `sw.js`；manifest id 固定；site config 單一來源 | 通過（第 6 節） |
| 深層連結回殼層 200；`_headers` 生效；PR 預覽可開 | 通過 |
| 語言切換立即生效、記住偏好、`html lang`；作答中切換保留狀態與捲動 | 通過（E2E，Chromium、WebKit、Firefox） |
| 離線與更新提示測試通過；E2E 沒有 CSP 違規 | 通過 |
| 流量統計：沒有 cookie 或本機儲存、沒有 CSP 違規、離線不受影響、效能預算通過 | 通過（stub 模式與正式網址都驗過，第 6 節） |
| 內容 pipeline 產出 manifest 與 hashed JSON；schemas 一致性檢查 | 通過 |
| `docs:examples` | 通過 |
| 隱私說明頁草稿上線 | 通過 |
| 授權檔與 THIRD_PARTY_NOTICES、白名單外授權讓 CI 失敗 | 通過 |
| 致謝只在老師看過後加入 | 通過（目前沒有致謝段落） |
| 結構驗收 1 乾淨 clone 安裝 | 通過（本機乾淨安裝與 CI 的 clone） |
| 結構驗收 2 型別檢查與測試、依賴方向、DOM 禁用 | 通過：6 個套件 typecheck；vitest 169 個測試（含 web-ui 在 WebKit Browser Mode 的 3 個） |
| 結構驗收 3 建置產物在 `apps/web/dist/` | 通過 |
| 結構驗收 4 wrangler dev 深層連結與 `_headers` | 通過 |
| 結構驗收 5 PR 預覽網址上跑 E2E | 通過（PR 1 的 preview 工作） |
| 結構驗收 6 web-ui 的 Lingui 抽取與編譯 | 通過（第 8 節第 2 點說明設定的調整） |
| 殼層頁面通過第 4 節的驗收閘門 | axe、鍵盤、減少動態、效能、對比、雙語通過；VoiceOver、TalkBack 與實機尚未做 |

## 6. 部署、退回演練與正式網址

- 第一次整批部署到 workers.dev：58 個檔案。煙霧測試：首頁、作答頁、英文作答頁、英文名詞頁、不存在的路徑都回殼層 200 並帶 CSP；`sw.js`、manifest、content-manifest 200；不存在的 `/assets/` 檔案回 404 加 `no-store`。
- 退回演練：第二次部署產生新版本後，`wrangler rollback` 把第一個版本退回 100% 流量，`wrangler deployments list` 最新一筆就是它。
- 自訂網域：`ledgerland.swift.moe` 原本綁在 M0a 試作的 Worker 上，專案維護者先在儀表板移除，之後 `wrangler.jsonc` 加回 `routes`，由部署流程綁定。
- 換版演練（本機）：同一個 origin 先起試作版的建置，瀏覽器讓舊 Service Worker 接管並確認離線可開；換成正式版的建置後，第一次載入仍是舊版（舊 SW 的快取），更新檢查後舊版顯示「有新版本可以使用」，按「更新」後是正式版殼層；新 SW 接管後離線冷啟動英文名詞頁正常。
- 正式網址驗證（Chromium）：200、CSP、`Referrer-Policy: no-referrer`、`Cache-Control: no-transform`、`X-Content-Type-Options: nosniff`；統計腳本以 module 載入，回報送到統計服務都回 204 且 Referer 空白；沒有 cookie、localStorage、sessionStorage 寫入；沒有頁面錯誤與 CSP 違規；深層連結與 404 頁回殼層 200；`/assets/nope.js` 404 `no-store`。

## 7. 驗收閘門的數字

- Lighthouse 13.5.0（行動版、模擬節流、CPU 4 倍、5 次中位數，本機 benchmarkIndex 約 3000）：五個網址效能 0.97 到 0.98、無障礙 1.00、最佳做法 0.96；LCP 2144 到 2287 ms；TBT 0 ms；CLS 全部 0。CI 的 runner benchmarkIndex 約 2400 到 2450，同一組網址也通過。
- axe（Chromium，8 個頁面乘兩種語系乘淺深）：32 個組合都沒有 serious 或 critical 問題。
- 純鍵盤：Tab 鍵先到「跳到主要內容」、Enter 切換 Tab 後焦點在 h1（Chromium、Firefox）；WebKit 的 Tab 鍵順序依系統設定，列入實機清單。
- 減少動態：鏡片沒有進行中的動畫，捲動不收合。
- 體積預算：首次載入 JS 114.5 KB（gzip；`/en/` 118.4 KB）、CSS 6.3 KB、precache 468 KB（43 個檔案）；預算 150 KB、30 KB、1 MB。
- 對比：tokens 的 23 組配對乘四個主題全部達標；Tab bar 在最糟背景的取樣沿用 M0a 的數字。
- 雙語：`i18n:check`（抽取後 catalog 無變動、en 無缺字）通過；內容的 i18n 報表：已發布的都齊全，2 個草稿欄位缺英文是刻意的。
- E2E：Chromium、WebKit、Firefox 的 shell、locale、offline、update、axe、reduced-motion 全部通過（CI）；本機 Firefox 無法啟動，見第 8 節第 5 點。

## 8. 和計畫不同的地方、新發現

1. **16 的相鄰層門檻與推導值不符**：原文寫 1.15 到 1.35，實際 surface-2 對 surface 只有 1.12 到 1.13。測試依實際值設門檻，文件已修正。
2. **Lingui macroTransform 對 workspace 套件：一半通過**。macro 對 `packages/web-ui` 的原始碼正常，但 `@lingui/vite-plugin` 載入 `.po` 時只接受消費端 `lingui.config` 列出的 catalog 路徑，所以 `apps/web/lingui.config.ts` 同時列出 web-ui 的 catalog（檔案仍在 web-ui 裡），抽取設定只有這一份。
3. **E2E 的捲動位置**：M0b 用 scrollY 還原；兩種語言文字高度不同，WebKit 上差 85px，測試只斷言沒有被重設；05 第 8.5 節的錨點還原在 M2 做。Playwright 的 `click` 會先把元素捲進畫面，切換語言的捲動斷言改用 DOM click。
4. **Service Worker 在 prompt 模式不 clientsClaim**：第一次載入的頁面要重新整理一次才受控；更新提示的測試改成直接改 `dist/sw.js`（`page.route` 攔不到 SW 腳本本身的請求）。
5. **Firefox 本機無法啟動**：Playwright 的 Firefox 在 Documents 底下的暫存目錄建 profile 時失敗，判斷是 macOS 的隱私保護；CI 的 Ubuntu 不受影響。
6. **lint 規則取捨**：oxlint 的 `react/set-state-in-effect`、`react/purity`、`no-underscore-dangle`、`no-shadow`、`import/no-unassigned-import`、`jsx-a11y/prefer-tag-over-role` 關閉；其餘 correctness 全開；`lint` 以 `--deny-warnings` 執行。
7. **Tab bar 圖示**依 02 第 2.1 節用 `map-trifold` 與 `cards`。
8. **THIRD_PARTY_NOTICES** 列的是執行期依賴圖的 86 個套件（含 tree shaking 拿掉的間接依賴），`caniuse-lite` 以套件名稱允許 CC-BY-4.0。
9. **boot 腳本的佔位替換錯誤**：建置時用 `replace` 填主題色，只換到註解裡的第一個，程式那一行沒換，殼層腳本在執行期拋 ReferenceError，主題與 theme-color 的首次繪製邏輯都沒執行。先前的 E2E 沒有監看頁面錯誤所以沒抓到。改為 `replaceAll`、註解不再含佔位、`postbuild` 檢查 `index.html` 不得殘留佔位。
10. **鍵盤 E2E 在遠端失敗**：測試在 React 掛載前就按 Enter，遠端較慢時殼層連結以一般連結整頁載入。測試改為先等 `main h1`（漸進增強下這是正常行為）。
11. **名詞頁 LCP 超過預算**（CI 兩次 2588 與 2769 ms）：名詞頁比列表多 manifest 與名詞快照兩段串行請求，而且在頁面 chunk 之後才開始。改為殼層 preload manifest、啟動就讀 manifest、名詞路由在載入 chunk 時同時讀快照；門檻沒有放寬。
12. **首頁與作答頁 CLS 接近門檻**（0.073、0.097）：Lighthouse 的瀏覽器語言是英文，語言切換提示在 effect 裡才插入到內容上方，把卡片往下推。改為第一次繪製就決定。原則：會插入到內容上方的元素必須在首次繪製就決定或預留空間。
13. **一次停機**：加回 routes 之前只看了 PR 的 CI，沒注意 main 的 ci 已在 Lighthouse 失敗，deploy 被跳過而舊網域已移除，正式網址約 40 分鐘打不開，最後以本機 `wrangler deploy` 止損。之後的規則：觸發正式部署的改動之前先確認 main 的 ci 是綠的。
14. **Dependabot 的第一個 PR**（@types/node 升 26）：preview 工作拿不到 secrets 而失敗，改為跳過 Dependabot 的 PR；執行環境釘在 Node 24，型別定義不跟到下一個主版本。
15. **統計腳本的細節**：官方片段是 `type=module`，載入器照用；`spa` 省略時預設開啟，程式仍明確寫 `spa: true`；beacon 預設用 XMLHttpRequest 送出，stub 模式連同 `sendBeacon`、`fetch` 一起改寫；在非 Cloudflare 網域上它打絕對網址，綁到自家網域後可能改打同源的 `/cdn-cgi/rum`，`connect-src 'self'` 已涵蓋。
16. **祕密掃描的通知**：統計服務的 beacon token 被通用的高熵偵測器標記。它是寫在每個訪客 HTML 裡的公開值，不是機密；真正的部署權杖只在 CI 的 secrets。

## 9. 留給下一個里程碑

- 實機清單（VoiceOver、TalkBack、iOS 17 與 Android）；M0b 沒有新的手勢流程，清單同 M0a。
- 套件 README 的範圍說明（目前在 package.json 的 description）。
- 作答頁 CLS 在 M2 做正式作答頁時要再量一次；05 第 8.5 節的錨點還原在 M2。
- 本機的 wrangler 登入會過期，部署前先 `wrangler whoami`。
