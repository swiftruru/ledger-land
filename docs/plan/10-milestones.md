# 10 分階段里程碑

這份文件把 LedgerLand 的實作切成 M0a、M0b、M1、M2、M3、M4a、M4b、M5、M6、M7、M8 共十一個里程碑（M4 依 D10(c) 的決定拆成 M4a 與 M4b），逐一寫出目標、範圍、不做什麼、交付物、可以逐項打勾的完成標準、開工前必須先決定的事，以及主要風險。順序依你的偏好：會計核心與闖關區先做，接著做報表實驗室，最後串起交會點；多語系、PWA、設計系統與題庫架構從第一個實作階段就打基礎，題庫匯入與管理後台排在最後。D 系列已在 2026-10-20 全部決定，各里程碑的範圍都已照決定更新；T 系列（原向老師確認）已於 2026-10-23 改由規劃者依專業判斷決定（[14 待確認](14-open-questions.md) 第 2 節），各里程碑不再等待老師回覆；V 系列（待實測）仍照各里程碑的安排處理。每個里程碑做完都會停下來回報，等你確認後才進入下一個；M0a 另外要由你做出 go / no-go 的決定。

## 確定要做

- 里程碑依序為 M0a、M0b、M1、M2、M3、M4a、M4b、M5、M6、M7、M8；一次只做一個，做完停下回報，你確認後才開始下一個（第 3 節）。
- M0a 是技術驗證，結束時停下來，由你決定照原路線進行、改用備案，或調整範圍。驗證失敗時只回報並提出備案，不在里程碑中途自行切換技術路線。
- 每個里程碑開工前，先確認「開工前必須先決定」的事項都已決定；沒有決定就先問你，不自行假設。
- 從 M0b 起，每個有介面的里程碑都要通過同一組驗收閘門：axe 沒有 serious 或 critical 問題、純鍵盤操作檢查、VoiceOver 與 TalkBack 手動清單、減少動態效果的畫面檢查、效能檢查（第 4 節）。
- M1 的完成標準分兩級：故事第 1 到 3 筆「已對老師 Excel 驗證」；第 4 到 18 筆「性質測試通過，標示為依課程情境推算」（原「推論，待老師確認」，2026-10-23 依 T33 的決定改）。
- **T 系列（已決定 2026-10-23）**：不寄向老師確認的清單；每一項由規劃者依專業判斷決定並在 14 寫下做法、理由與影響，老師隨時可以回饋，有回饋再調整（第 5 節）。唯一仍要請老師看一眼的是【待確認 T34】的具名致謝文字與位置，M8 前處理，不阻擋任何里程碑。未採用的做法：在 M1 開工前寄出清單並在回覆前不計分。
- 交會點需要的元件與欄位提早設計：`labRef` 與 `termRefs` 在 M1 的 schema 就定義成選填欄位，M2 起的內容就要填；M2 的交易影響題元件依「可嵌入實驗室」的 API 設計，M4a 直接使用。M5 只做跨模組導覽。
- IndexedDB 的 schema 版本與 migration 架構放在 M2，因為 M2 是第一個可能給學生試用的版本。
- **技術路線（D4、D5、D8）**：主機用 Cloudflare Workers Static Assets，正式網域 `ledgerland.swift.moe`，base path 為 `/`；網址中文在根路徑、英文在 `/en/`（例如 `/level/lv_k7m2q9xd/` 與 `/en/level/lv_k7m2q9xd/`）；框架用 React Router 8 data mode 加 vite-plugin-pwa，先不預先產生 HTML，【待實測 V08】暫不需要；正式支援 iOS 17。M0a 依這條路線驗證（第 6 節）。
- **repo、授權與統計（D3、D6、D7）**：repo 公開；`docs/plan/01-materials.md` 與 `docs/plan/13-material-questions.md` 留在原位，以 `.gitignore` 排除、只存在本機（由你備份）；M0b 建立授權檔（程式碼 MIT、原創教學內容 CC BY-SA 4.0，老師的故事情境與金額不在 CC 授權內，標示「經陳彥宏老師授權使用」），並建置不用 cookie、不收集個資的流量統計（第 7 節）。
- **闖關區（D1、D9、D10(a)、D11、D12、D13）**：主線不出分錄題，`journal_entry` 只用在 M3 的「借貸與分錄」延伸章；M2 做多正解題型 `multi_choice`（與 `single_choice` 共用元件）、完整的進度保護（`persist()`、備份檔加文字備份碼、匯入預設合併）、關卡代號入口與 App 內相機掃描課堂 QR；W01 到 W15 全部採用；Tab 用短名；英文用英式拼字（第 9、10 節）。
- **報表實驗室（D2、D10(b)、D10(c)、D10(f)、D11）**：M4 拆成 M4a（故事、動畫、預測、自由實驗、勾稽練習）與 M4b（完整公式樹追蹤、IFRS 切換）；故事照老師的情境與金額，公司名稱原創；連續故事為主線，每一步有「單獨練習」入口；IFRS 對照不計分（第 11 節）。
- **題庫匯入與後台（D10(d)、D10(e)、D10(g)）**：M6 做 Excel 範本與本機匯入指令；M7 直接做 Cloudflare Access 加 Workers 加 D1 的資料庫型後台；內容狀態只有 draft、published、retired（第 13、14 節）。
- **repo 結構、套件切分與部署**：已決定（2026-10-20）：網站與未來的 App 放在同一個 repo（monorepo，pnpm workspace），程式依 `apps/` 與 `packages/` 分層，套件在需要時才建立：M0b 建立根目錄 workspace、`apps/web`、`packages/tokens`、`packages/i18n`、`packages/content-schema`、`packages/web-ui`；M1 建立 `packages/core`；M2 建立 `packages/quiz`、`packages/progress`；M7 建立 `apps/admin`；`apps/mobile` 等 App 技術選定後才建立（建議 M3 完成後由你決定，第 10.1 節）。部署維持 GitHub Actions 執行 wrangler，設定檔在 `apps/web/wrangler.jsonc`；套件、工具與快取都裝在專案自己的資料夾裡（第 7 節範圍第 3、12 到 14 項）。

## 需評估

本文件沒有需評估的項目。原本的五項評估已在 2026-10-20 全部決定，下面保留決定、對里程碑的影響與簡短的取捨紀錄。T 系列已於 2026-10-23 依專業判斷全部決定（第 5 節）；V 系列仍待實測，照各里程碑「開工前必須先決定」與第 16 節處理。

### 評估一（已決定）：M2 包含完整的進度保護與課堂 QR 入口

已決定（D10(a)，2026-10-20）：M2 就做完整的進度保護（原選項 A），另外加上 App 內掃描課堂 QR。形式本身的比較見 [06 PWA 與響應式](06-pwa-responsive.md)，這裡只寫放在 M2 的內容：

- `persist()`：偵測到 App 模式時在啟動時呼叫，或在第一次完成關卡時呼叫；Firefox 只走設定頁的按鈕；App 內建瀏覽器不呼叫。
- 匯出匯入：備份檔加文字備份碼；匯入預設合併，覆蓋放在進階選項；Safari 分頁轉到主畫面 App 的流程與 Safari 分頁的常駐提示。
- 課堂 QR：關卡代號入口（關卡介紹顯示關卡 ID 去掉 `lv_` 的 8 個字元，App 內可以輸入代號）；另外在 App 內加入相機掃描課堂 QR（內建 JS 解碼器與相機權限，Safari 沒有正式的 BarcodeDetector；解碼器在 M2 開工前查證選型）。暫存情境提示卡（已決定 2026-10-21）：iOS 非 App 模式且 `navigator.storage.estimate()` 配額低於 1.5 GB 時，頁面頂端顯示可關閉的「這個畫面關掉後，作答進度不會保留」，引導改用 Safari 或 App 內掃描（06 決定五的實測補充）。
- 工作量：依 06 與 14 的估計，備份檔約 2 到 3 天、文字備份碼 1 到 2 天、關卡代號 1 到 2 天、App 內掃描 3 到 5 天，另加轉移流程與 iPhone 實機走查。M2 因此比初稿大，第一次試用會晚一些。
- 未採用的選項：B（M2 只做備份檔，其餘放到 M3）與 C（全部放到 M3）。理由是 iOS 的儲存清除規則與分頁、App 不共享儲存的風險，在第一次試用時就會出現（【待實測 V02】【待實測 V04】）。

### 評估二（已決定）：借貸分錄採延伸層

已決定（D1，2026-10-20）：(b) 延伸層。主線跟著教材的倒推法；另設「借貸與分錄」延伸章，不列入期中考範圍。M1 的核心內部一律採用複式分錄，這一點本來就和 D1 無關。對各里程碑的影響：

| 里程碑 | 內容 |
| --- | --- |
| M1 | `journal_entry` 的 schema 與計分規則（同科目同方向合併後以多重集合比對）一起定義 |
| M2 | 主線不加分錄題 |
| M3 | 加「借貸與分錄」延伸章（不列入期中考範圍），`journal_entry` 題型與計分只用在這一章 |
| M4a | 「科目變動」那一步以白話為主，「看分錄與 T 字帳」預設收合，可以展開 |
| M4b | 追蹤的最底層列出來源步驟，來源分錄放在可展開的分錄層 |

- 涉及待確認做法的事件（設立費、存貨盤盈、攤銷），在老師確認前不出分錄題（交易範本以 `entryQuestionBlockedBy` 列出【待確認 T04】【待確認 T05】【待確認 T06】）。
- 未採用的選項：(a) 不做（放棄需求中的分錄題型與「分錄到帳戶」的動畫起點）；(c) 主線（和教材「從財報倒推、不從分錄學起」的教法衝突，每章都要配分錄，工作量最大）。

### 評估三（已決定）：M4 的故事模式、追蹤深度與故事資料

故事模式與追蹤深度的選項代號與定義，都以 [03 模組設計](03-modules.md) 的評估 2 與評估 3 為準（04 的追蹤深度評估使用同樣的 A、B、C）。

- 已決定（D10(b)，2026-10-20）：C 兩者並存（輕量版）。連續故事為主線，每一步另有「單獨練習」入口，沿用故事在該步之前的狀態。
- 已決定（D10(c)，2026-10-20）：A 完整公式樹與來源分錄。因為 D1 選 (b)，來源分錄放在可展開的分錄層。M4 的介面工作量因此最大，所以拆成兩個小階段：M4a 做故事、動畫、預測、自由實驗、勾稽練習；M4b 做追蹤（完整公式樹）與 IFRS 切換（第 11 節）。M1 照原計畫輸出追蹤需要的 `sources`，不必返工。
- 已決定（D2，2026-10-20）：B，故事按照老師的情境與金額（你轉達老師已同意）。故事公司取原創名稱（D9，M4a 開工前由規劃者提案、你確認）；故事的敘述文字仍用網站自己的話撰寫；第 12 筆等疑似誤植依 13 的建議處理並加註；情境不夠時（延伸章、自由實驗、故事沒涵蓋的交易）另外建立原創情境。repo 內的測試仍用自編數字，故事資料只做性質測試，與老師 Excel 的逐格比對只在本機執行。故事資料含老師的金額，屬於公開內容（已同意）。

| 項目 | 決定 | 對里程碑的影響 | 未採用的選項與理由 |
| --- | --- | --- | --- |
| 故事模式（D10(b)） | C 兩者並存（輕量版） | M4a 實作；「單獨練習」和 M5 的「帶入交易前狀態」共用同一個能力 | A 連續故事（從中間開始不便）；B 獨立情境與 D 完整版（要為每種交易另設期初狀態，內容與測試量最大） |
| 追蹤深度（D10(c)） | A 完整公式樹與來源分錄 | M4b 實作；M4a 不含追蹤 | B 只做跨表勾稽連結、C 折衷：跨表連結加一層公式（較輕，但無法回答同一張表內的公式與來源分錄） |
| 故事數字（D2） | B 老師的情境與金額 | 程式工作量不變；故事資料不在 CC 授權內，標示「經陳彥宏老師授權使用」 | A 原創數字（學生無法直接對照課堂內容）；C 兩套數字（多一套內容要維護） |

### 評估四（已決定）：M6 題庫匯入與 M7 管理後台都要做

- 已決定（D10(d)，2026-10-20）：M6 要做。文字型題目與名詞用 Excel 範本維護；上傳入口先做本機匯入指令；老師要自己操作時，再加只產出檔案的瀏覽器匯入頁（放在後台的獨立 origin）。含 scenario 的計算題、交易範本與故事仍維護在 JSON（第 13 節）。
- 已決定（D10(e)，2026-10-20）：M7 直接做資料庫型後台，平台用 Cloudflare（Access 加 Workers 加 D1），不經過 Git-based CMS。後台放在獨立的 origin；權限在伺服器端檢查（Worker 驗證 Access 的 JWT，再查 D1 的角色表）；發布時輸出靜態快照；版本紀錄與還原用 D1 的 revisions 表，D1 Time Travel 只當災難還原；Access 的獨立兩步驟驗證在免費方案能否使用仍待實測（【待實測 V10】），不行就改用 IdP 的兩步驟驗證，並在 M7 開工前回報（第 14 節）。費用預期在免費額度內（0 元）；超出時 Workers Paid 每月最低 5 美元（見 [08 題庫與後台](08-content-admin.md)）。
- 已決定（D10(g)，2026-10-20）：先不設 review（待審）狀態，只有 draft、published、retired。

| 未採用的選項 | 理由 |
| --- | --- |
| 只用檔案加 CI 驗證，不做 M6、M7 | 只有會用 Git 的人能維護題庫，老師不能自己操作 |
| Google Sheets 經 API 轉 PR | 要設定 service account 與權限，一人維運時負擔較重 |
| Git-based 後台（Sveltia，退路 Decap） | 要長期維運 OAuth 代理；公開 repo 的草稿分支會公開；編輯者需要 GitHub 帳號 |
| Supabase、Firebase | 比較過、未採用：Supabase Free 一週沒有活動就暫停而且沒有備份；Firebase 的 MFA 要先升級 Identity Platform；Cloudflare 和主機是同一家，帳號與帳單只有一套 |
| review 狀態（schema 加 `review`，或 CMS 的流程標籤） | 一人維運時形同多一道手續；CMS 不採用。老師或第二個人要正式審核內容時再加 |

### 評估五（已決定）：IFRS 對照採完整切換，放在 M4b

- 已決定（D10(f)，2026-10-20）：C 完整切換。實驗室可以切換整套 IFRS 三表與指標，不計分；M1 只在 schema 保留 `policy` 欄位與 `policyWhen`；M4b 實作 `ifrs@1` 政策與版面並加上黃金測試；IFRS 畫面明確標示「IFRS 對照，不計分」；闖關區一律以教材口徑計分。完整比較見 [04 會計核心](04-accounting-core.md) 的評估一。
- 已決定（D11，2026-10-20）：中英都用教材版面，IFRS 沒有或禁止的項目在中英兩種介面都加標記（中文「非 IFRS 項目」、英文「Not an IFRS line item」，字串放在 05 的 catalog）；M4b 起可以隨時切到 IFRS 對照。
- 放置：等於原本的放置方式 2（M4 完成後另排一個小階段），落實為 M4b。老師對【待確認 T04】【待確認 T05】的回覆主要影響教材口徑一側的數字；沒有回覆時照預設政策實作並標示待確認。
- 未採用的選項：A 不做（看不到金額差距）；B 靜態對照（看不到整套 IFRS 三表）；放置方式 1 一次放進 M4（M4 過大）。

---

## 1. 里程碑總覽

D 系列都已決定（2026-10-20），所以下表把「依據的決定」和「開工前仍待處理」分開列。仍待處理的事項沒有完成時，照第 3 節的規則先問你，不自行假設。

| 里程碑 | 目標 | 主要內容 | 依據的決定 | 開工前仍待處理 | 狀態 |
| --- | --- | --- | --- | --- | --- |
| M0a 技術驗證 | 驗證會影響架構的技術假設，產出 go / no-go 報告 | data mode 加 `/en/` 前綴的最小專案、Cloudflare 預覽部署、PWA 離線與更新、玻璃 Tab bar（含 iOS 17）與減少動態、儲存隔離、QR 開啟位置、iOS 拖放、安裝外觀 | D4（預覽主機）、D5、D8 | 實機清單（iOS 17、26、27 與中低階 Android）、Cloudflare 帳號與預覽部署前的 `wrangler login`；試作程式的存放位置已決定（`prototypes/m0a/`） | 已完成（2026-10-22，建議 go；報告在本機 `prototypes/m0a/REPORT.md`；實機項目全部通過；缺漏只剩沒有硬體的 Android 與 iOS 26、17 實機） |
| M0b 基礎建設 | 讓之後每個里程碑都在同一套工具與品質閘門下進行 | repo 初始化（含 01、13 的排除規則）、monorepo 骨架（根目錄 workspace、`apps/web`、`packages/tokens`、`packages/i18n`、`packages/content-schema`、`packages/web-ui`）、隔離環境、依賴方向檢查、工具鏈、CI、Cloudflare 部署（`apps/web/wrangler.jsonc`）、語系架構、design tokens、PWA 殼層、內容 pipeline 與 Term、Chapter 最小 schema、授權檔、流量統計、debug 頁 | D3、D4、D6、D7、D8、D9（Tab 名稱） | M0a 的 go 決定；統計服務的查證結果；致謝文字請老師看過；第一次正式部署前的 API token 與 GitHub secrets | 已完成（2026-10-22；報告在 [docs/reports/m0b.md](../reports/m0b.md)；完成標準全部達成，正式網域 `ledgerland.swift.moe` 已由 CI 部署；留給 M1、M2 的事見報告第 9 節） |
| M1 會計核心 | 會計核心成為唯一的資料來源 | 建立 `packages/core`；科目表、交易範本、故事資料、教材版面三表、間接法現金流量表、指標登錄檔與狀態、五步驟檢查、effects、題目與範本 schema（含 `multi_choice`、`journal_entry`，放在 `packages/content-schema`） | D1、D2、D10(c)、D10(f)、D12、D13 | 無（T 系列已於 2026-10-23 依專業判斷決定） | 已完成（2026-10-23，回報 [docs/reports/m1.md](../reports/m1.md)） |
| M2 闖關區 MVP | 第一個可以給學生試用的版本 | `packages/quiz`、`packages/progress`、主要題型（含 `multi_choice`）、回饋與名詞卡、錯題本、進度、星星、IndexedDB 與 migration、完整的進度保護、關卡代號入口、App 內掃描 QR、前 2 到 3 章的中英原創內容 | D1、D4（正式網域）、D9、D10(a)、D11（拼字）、D12、D13 | QR 解碼器選型已決定（2026-10-23，`@zxing/library` 0.23.0 的 QR 子集在 Worker 解碼，退路 jsQR；14 第 5.2 節）；試用的對象與規模尚未決定（2026-10-23 提醒使用者，進度保護已全部做完，試用時再定） | 已完成（2026-10-24，回報 [docs/reports/m2.md](../reports/m2.md)；V19 到 V22 的實機項目與 LCP 收回留給 M3） |
| M3 闖關區完整 | 涵蓋期中考範圍 | 第一部分全部章節、其餘題型、「借貸與分錄」延伸章（`journal_entry`）、名詞圖鑑、徽章、完整安裝圖解 | D1 | 無（T32 等內容相關的 T 已決定；T18、T19、T23 牽涉的現行法規與年報格式在出題前查證） | 未開始 |
| M4a 報表實驗室：故事與動畫 | 用逐步動畫呈現交易如何流進三表與指標 | 故事模式與單獨練習、動畫、預測、自由實驗、勾稽練習、指標面板 | D1、D2、D9（故事公司）、D10(b)、D11（報表版面） | 故事公司名稱的提案與確認（T08、T29、T33、T35 已決定） | 未開始 |
| M4b 報表實驗室：追蹤與 IFRS 切換 | 回答「這個數字從哪裡來」，並能切換到 IFRS 對照 | 完整公式樹與來源分錄、`ifrs@1` 政策與版面、IFRS 黃金測試 | D1、D10(c)、D10(f)、D11 | 無（T04、T05 的兩套政策已決定） | 未開始 |
| M5 跨模組導覽 | 串起闖關區與實驗室 | `labRef` 深連結、帶入交易前的狀態、章末連結 | 沿用 M2 與 M4a 的設計 | 沒有 | 未開始 |
| M6 題庫匯入 | 讓不寫程式的人用 Excel 維護文字型題目與名詞 | 範本產生（含「判分方式」欄）、本機匯入指令、錯誤報告、預覽、差異摘要；老師要自己操作時加瀏覽器匯入頁 | D10(d)、D10(g)、D12 | xlsx 函式庫的查證；老師是否要自己操作 | 未開始 |
| M7 管理後台 | 讓管理者在後台編輯與發布 | `apps/admin`（使用 `packages/web-ui`）、Cloudflare Access 加 Workers 加 D1、獨立 origin、伺服器端權限、revisions 表、發布靜態快照 | D3、D4、D10(e)、D10(g)、D12 | V10 的結果；後台的子網域 | 未開始 |
| M8 公開上線 | 正式對外宣布（repo 從 M0b 起、網站從 M2 起就已公開） | 老師同意與署名的定稿、授權與安全標頭的最終確認、整個歷史的稽核、最終稽核 | D3、D4、D6、D7、D9、D11 | T34 的致謝文字與位置（請老師看一眼）；商標檢索 | 未開始 |

M3 完成後另有一個 App 技術決策點（不是里程碑，不改變上表的順序；沒有 registry 編號，由你決定，見 [14 待確認](14-open-questions.md) 第 5.2 節）：選定技術後，在 `apps/mobile` 比照 M0a 先做小型試作再開工（第 10.1 節）。

## 2. 排序的理由（和你的偏好對照）

| 你的偏好 | 本計畫的安排 | 理由 |
| --- | --- | --- |
| 先完成會計核心 | M1 緊接在基礎建設之後 | 核心是純 TypeScript、不依賴介面，可以最早開始；闖關區的交易影響題與實驗室都依賴它 |
| 再完成闖關區 | M2（MVP）、M3（完整） | 先做 MVP 讓同學試用，再補齊期中考範圍 |
| 再做報表實驗室 | M4a、M4b | 實驗室重用 M2 的交易影響題元件與名詞卡；D10(c) 選了最重的完整公式樹，所以追蹤與 IFRS 切換拆到 M4b，避免單一里程碑過大，M4a 完成後實驗室就能先給學生使用 |
| 最後串起交會點 | M5，但元件與欄位提早設計 | 若 `labRef` 到 M5 才加進 schema，M2、M3 寫好的題目都要回頭補欄位；若預測元件到 M5 才共用，就會先做兩份再合併。所以欄位在 M1 定義、元件在 M2 依可嵌入的 API 設計，M5 只做導覽。M5 只依賴 M4a 的故事步驟與帶入狀態，不依賴 M4b |
| 多語系、PWA、設計系統、題庫架構從第一階段打基礎 | M0b 一次建立 | 語系架構、PWA 殼層、design tokens、內容 pipeline 都在 M0b 建好。題目與交易範本的 schema 依賴科目 ID、範本參數與受控運算式，所以移到 M1 和核心一起定，避免返工 |
| 管理後台排後面 | M6、M7（D10(d)、D10(e) 已決定都要做） | 內容格式、驗證與預覽元件在 M1 到 M5 穩定之後，才加上 Excel 匯入與後台這兩個新的輸入端；兩者產出的都是同一份靜態快照 |
| （你沒有列出） | 在 M0b 之前加一個 M0a 技術驗證 | 網址策略、PWA 整合、玻璃效果與 iOS 儲存行為的驗證結果，會決定路由寫法、建置輸出、SW 的產生方式與資料夾結構。D5 已決定 C 並採 data mode，驗證重點是 `/en/` 前綴的路由與離線導覽、Cloudflare 的 SPA fallback 與 `_headers`。先驗證再建基礎，驗證失敗時不必重做 CI 與內容 pipeline；也符合「一次只做一個階段，做完停下回報」 |
| （你沒有列出） | 進度保護放在 M2（初稿排在 M3，審查後提前） | M2 是第一個可能給同學試用的版本，儲存清除與分頁、App 不共享的問題會在試用時出現；D10(a) 已決定全部放進 M2，並加上關卡代號與 App 內掃描 QR |

## 3. 每個里程碑共同的規則

1. **開工前**：確認本文件「開工前必須先決定」的事項都已決定。沒有決定的，先問你，不自行假設；可以用預設值先做的部分，會明確標示並寫進回報。T 系列（會計處理與呈現的細節）由規劃者依專業判斷決定並在 14 記錄理由（2026-10-23），不需要等老師；老師回饋後只改資料。
2. **進行中**：不擴大範圍。遇到阻礙，或實測結果和計畫不符時，停下來回報並提出選項，不自行改走其他路線。
3. **commit 與 push**：push 到 GitHub（尤其是公開 repo）之前，先取得你的同意。
4. **結束時**：停下來回報，等你確認後才開始下一個里程碑。回報包括：
   - 完成標準逐項對照，附證據（指令輸出、CI 結果、截圖、量測數字）。
   - 沒有完成的部分與原因。
   - 和計畫不同的地方，以及原因。
   - 新發現的風險與待實測事項的結果。
   - 文件需要更新的地方（例如實測推翻了某個假設）。
   - 下一個里程碑開工前需要你決定的事。
5. **M0a 的特別規則**：M0a 結束時，由你做出 go / no-go 決定：照原路線進入 M0b、對失敗的部分改用備案，或調整範圍。你的決定會記錄在 M0a 的報告裡。

## 4. 有介面的里程碑共同的驗收閘門

從 M0b 起，凡是有介面的里程碑（M0b、M2、M3、M4a、M4b、M5、M6 的瀏覽器匯入頁（老師要自己操作時才做）、M7 後台，和 M8 的最終稽核），都要通過下表前五項。後三項是伴隨的檢查，結果一起寫進回報。M1 沒有介面，只需要通過 CI。

| 檢查 | 方法 | 通過條件 | 寫進回報的紀錄 |
| --- | --- | --- | --- |
| 1. axe | `@axe-core/playwright` 掃描固定頁面清單，兩種語系、淺色與深色各一次 | 沒有 serious 或 critical 問題 | axe 報告 |
| 2. 純鍵盤操作 | Playwright 純鍵盤 E2E 涵蓋本里程碑新增的流程，另有人工檢查表 | 所有題型與流程都能只用鍵盤完成；焦點樣式清楚可見；有「跳到主要內容」連結；換頁後焦點移到頁面標題；沒有鍵盤陷阱；Esc 能關閉對話框 | 檢查表結果 |
| 3. VoiceOver 與 TalkBack | iPhone（VoiceOver）與 Android（TalkBack）手動清單，每個模組 5 到 10 個步驟 | 每一步唸出預期的名稱與狀態；Tab bar 唸出目前所在頁；實驗室每一步的 `aria-live` 摘要正確 | 清單結果、裝置與系統版本 |
| 4. 減少動態效果 | Playwright 以 `reducedMotion: 'reduce'` 跑完整流程並截圖比對；另在 iPhone 開啟系統的「減少動態效果」人工確認 | 沒有位移、縮放、彈簧動畫；Tab bar 選取指示直接跳到新位置；資訊仍然完整 | 截圖 |
| 5. 效能 | lighthouse 13 CLI 對固定網址各跑 5 次取中位數；Playwright 實際操作量 INP；CI 體積預算 | 行動版效能至少 90、無障礙至少 95；LCP 不超過 2.5 秒、INP 不超過 200ms、CLS 不超過 0.1（CLS 只在 Chromium 量測）；首次載入 JS 不超過 gzip 後 150 KB（暫訂）；D7 的統計腳本與延後載入的 QR 解碼器都不得讓上述指標超出門檻 | 數字與 `benchmarkIndex` |
| 6. 實機 | iOS 26 支援清單中最舊的 iPhone、一台 iOS 17 裝置（D8；沒有實機時用 Simulator 並註明），以及一支中低階 Android | 主要流程可用、玻璃可讀（iOS 17 上的 Tab bar 也有模糊效果或正確退回實色）、沒有明顯不順或掉格 | 機型、系統版本、觀察 |
| 7. 對比 | 玻璃與色票在最糟背景下的對比計算 | 文字至少 4.5:1、圖示至少 3:1 | 計算紀錄 |
| 8. 雙語 | CI 的 i18n 檢查，加上切換語言的人工檢查 | complete 語系沒有缺字；內容缺翻譯時正確標示；作答中切換語言（在根路徑與 `/en/` 之間換網址）時，路由外的 store 保留作答狀態；英文用英式拼字 | CI 結果 |

量測方法的細節見 [06 PWA 與響應式](06-pwa-responsive.md)；CI 的設定見 [09 技術選擇](09-tech-stack.md)。

## 5. 向老師確認清單的處理方式（已決定 2026-10-23：不寄清單）

- **已決定（2026-10-23）**：不寄向老師確認的清單。你的指示：目前提出的問題太多、太細；只要符合一般公認會計原則，其他設計與實作細節交由規劃者依專業判斷決定，不需要每個環節都再問老師；老師已經知道這個專案，也會協助留意內容，所以先把系統做出來，再隨實際使用與回饋慢慢調整。因此 T01 到 T38 每一條都在 [14 待確認](14-open-questions.md) 第 2 節加上「決定（2026-10-23，依專業判斷）」，寫明做法、理由（引用 IAS、IFRS 條號或一般公認會計原則）與影響的資料或政策開關；原則是教材的呈現方式照課程，與現行準則的差異用標記與 IFRS 說明並列，不自行改變課程的教學結構。
- **老師的回饋**：老師隨時可以口頭或訊息回饋，不需要照編號；規劃者收到後在 14 與 13 的對應條目補上「老師回饋」與日期，只改資料並重跑測試，不改核心結構（會計處理仍是政策或參數，用詞仍是主名稱與別名）。
- **介面與計分**：資料與介面不再標示「待老師確認」，改以「設計說明」連到 14 的對應條目；計分不因 T 系列停止。`entryQuestionBlockedBy` 與題目層級「`pendingRefs` 非空時暫不計分」的機制保留，但目前沒有範本或題目使用（04 第 7、14 節；08 第 3.6、3.8、5.4 節）。
- **【待確認 T34】的狀態**：故事情境與金額已同意（2026-10-20，經你轉達，D2）。公開網站與開源依 D3、D6 進行，不另外徵求同意；唯一仍要請老師看一眼的是關於頁與 README 具名致謝的文字與位置（因為牽涉具名），由你在 M8 前找機會處理，不阻擋任何里程碑；在老師看過前不放具名致謝（D6）。D6 是最終決定，老師若提到商業使用的看法只作參考。依 D3，14 與 `PLAN.md` 中原本向老師提問的標題仍用中性問句。
- **未採用的做法（原本的規劃，保留作為紀錄）**：由你在 M1 開工前寄出清單（證據與頁碼在 [13 教材疑義](13-material-questions.md)，本機專用），和 M0a、M0b 平行等待回覆，回覆前標示待老師確認、不出計分題。
- **依影響的里程碑分組**（保留作為紀錄，也是老師日後回饋時最省力的分組）：

| 分組 | 編號 | 影響 |
| --- | --- | --- |
| 影響核心（M1 前） | T01 到 T07、T09 到 T15、T21、T22、T25 到 T28、T30、T33、T36 | 損益表結構、遞延資產與攤銷、存貨、現金流量表各列、勾稽點、指標口徑；T04、T05 也影響 M4b 教材口徑一側的對照數字 |
| 影響內容（M2、M3 前） | T16 到 T20、T23、T24、T31、T32、T37、T38 | 期中考範圍、延伸章、門檻值、解說觀點的署名 |
| 影響實驗室（M4a 前） | T08、T29、T33（核心也會用到）、T35 | 故事文字、分組標題、第 4 到 18 筆的驗證資料、勾稽提示 |
| 正式宣布前（M8 前，致謝文字建議最先問；repo 自 M0b、網站自 M2 起已公開，致謝文字在老師看過前不放上） | T34 的其餘部分 | 公開網站的同意、具名致謝的文字與位置（故事情境與金額已同意） |

- **原本的「沒有收到回覆時」規則**：照計畫的預設做法實作（例如【待確認 T06】的盤盈預設沖減營業成本），做成可以切換的政策或參數，在資料與介面上標示「待老師確認」。2026-10-23 起改為照 14 各條目的決定實作，不標示待老師確認；政策與參數的隔離維持，老師回饋後只改資料並重跑測試，不必改核心結構。

---

## 6. M0a 技術驗證

**目標**：用最小的試作，驗證會影響架構的技術假設；結束時停下回報，由你做出 go / no-go 決定。

**範圍**：

1. 網址方案的最小專案（D5 已決定 C）：React Router 8 data mode 加 vite-plugin-pwa，先不預先產生 HTML。兩個語系（中文在根路徑、英文在 `/en/`）、三條路由（一個公開頁、一個名詞頁、一個作答頁，例如 `/level/lv_k7m2q9xd/` 與 `/en/level/lv_k7m2q9xd/`）。驗證 `html lang` 依網址切換；在中文網址與 `/en/` 網址之間切換語言時，作答狀態由路由外的 store 保留；SW 的 `navigateFallback` 對兩種語系的深層連結都回傳殼層。做法見 [09 技術選擇](09-tech-stack.md)。未採用的路線：framework mode 加 prerender 與 workbox-build injectManifest（原 B、C 案的技術路線，整合風險最大），所以【待實測 V08】暫不需要；日後若要加強搜尋收錄、改成預先產生 HTML，再評估並補做 V08。部署到 Cloudflare Workers Static Assets 的暫時預覽網址（HTTPS，base path 為 `/`，D4）：`not_found_handling` 設為 `single-page-application`，深層連結（含 `/en/` 底下）直接開啟時回傳殼層 `index.html`、狀態碼 200；不得回傳語言選擇頁（本案沒有語言選擇頁）。以 `_headers` 設定完整的 CSP、`frame-ancestors 'none'` 與快取規則；確認 PR 預覽可以使用。
2. PWA：完整 manifest（固定 `id`、`display: standalone`、含 maskable 的 icons）、180×180 不透明的 apple-touch-icon、離線冷啟動、prompt 模式的更新提示（不自動 skipWaiting）、固定路徑的 `sw.js`。
3. Lingui 6.9.0 的 macroTransform 與 data mode 使用的 Vite 外掛（`@vitejs/plugin-react`、`VitePWA()`）共存（【待實測 V09】）。
4. 玻璃 Tab bar 原型：Tier 0 與 Tier 1（Tier 2 只在 Chromium 桌機試做）、膠囊選取指示、捲動收合、鍵盤開啟時隱藏、減少動態效果；Safari 三種分頁列版面下的 safe area 與 fixed 位置（【待實測 V06】）；iOS 26.x 的 rubber-band 捲動閃爍（【待實測 V13】）。iOS 17（D8 正式支援）：Tab bar 的完整 `nav`（連結、圖示、中文標籤）直接寫在初始 HTML 殼層，英文頁由緊接在 `nav` 之後的殼層在地化腳本在首次繪製前換成英文，React 只更新屬性與文字、不使用 portal（見 [07 設計系統](07-design-system.md) 第 6.1 節），避開 iOS 17 以下「載入後才插入的元素不套用 backdrop-filter」的問題（Safari 18 才修正）；由 Lightning CSS 或 Autoprefixer 依 browserslist 自動補 `-webkit-backdrop-filter`；在 iOS 17 裝置上確認玻璃外觀與 Tier 判斷。
5. 儲存與模式判斷：共用的 `isAppMode()` 在各情況的結果（【待實測 V01】）。iOS 主畫面 App 的 display-mode，兩份事實核對看法相反：一份認為有 manifest 時 standalone 為 true，另一份引用 MDN browser-compat-data 認為 standalone 為 false、fullscreen 為 true；兩邊都不當定論，`isAppMode()` 兩種情況都要判斷正確，並記錄有無 manifest、從 Safari 分頁或主畫面開啟時 display-mode standalone、fullscreen 與 `navigator.standalone` 的實際值。另外驗證 Safari 分頁與主畫面 App 是否共享 IndexedDB、localStorage、Cache（【待實測 V02】）；`persist()` 的實際結果（【待實測 V04】）。
6. QR：用 iPhone 相機掃 QR，會開在 Safari 分頁還是已安裝的主畫面 App（【待實測 V03】）。
7. 拖放：`@dnd-kit/react` 在 iOS Safari 的拖曳偏移與手感（【待實測 V07】），和點選、鍵盤操作一起試。
8. 安裝外觀：主畫面圖示、啟動畫面、狀態列顏色（【待實測 V05】）。
9. 格式化：iOS 上 `Intl.NumberFormat` 的 TWD 輸出與 `signDisplay`（【待實測 V14】）。
10. CSP：data mode 的 `index.html` 有兩段 inline 腳本（head 裡的 boot 腳本、緊接在 `<nav>` 之後的殼層在地化腳本）與一段首次繪製的 `<style>`。驗證 sha256 方案能涵蓋這三段 inline 內容、完整的 CSP 放在 `_headers` 的 header，且沒有違規；同時確認殼層裡靜態 Tab bar 的標記沒有任何 `style` 屬性（【待實測 V15】）。framework mode 的離線導覽（【待實測 V08】）暫不需要。
11. 量測：首次載入 JS、precache 體積、固定網址的 Lighthouse 初測，據此提出 M0b 要用的預算數字。
12. 時間允許才做：LINE 等 App 內建瀏覽器的 SW 與儲存（【待實測 V11】）；Tier 2 的像素比對（【待實測 V12】）；React `<ViewTransition>` 在不支援的瀏覽器上的表現；主畫面 App 中相機權限（`getUserMedia`）的詢問行為，供 M2 的 App 內掃描 QR 參考。沒做的部分移到之後的里程碑，並在報告中註明。
13. 本機 AI 設定（見 [15 AI 協作與本機設定](15-ai-workflow.md)（本機專用）第 12 節）：第一步先把 AI 工具設定的排除規則附加到 `.gitignore`（只附加，不改既有內容），再建立 `CLAUDE.md`、永遠載入的 rules、M0a 需要的 agents、skills、hooks 與交接狀態檔。所有 AI 設定都留在工具預設的位置，不搬移，只靠 `.gitignore` 排除。用 `/context`、`/hooks`、`/skills` 確認載入正常（【待實測 V17】），並逐一試驗權限規則與 hooks 的攔截效果（【待實測 V18】）。例外（同 15 第 12 節）：M0a 的試作程式放在 repo 之外的獨立資料夾時（見下方「試作程式放哪裡」），本機 AI 設定與 V17、V18 可以延到 M0b 再做，但一定要在第一次 commit 之前完成；試作程式放在本 repo 內時，第一步一定是附加排除規則。附加排除規則時，可以一併加入 D3 的 `docs/plan/01-materials.md` 與 `docs/plan/13-material-questions.md`；最晚在 M0b 第一次 `git add` 之前完成。

**測試流程**：先在 iOS Simulator 用 localhost 跑一輪（localhost 屬於 secure context，可以測 SW）；再部署到 Cloudflare Workers 的暫時預覽網址（HTTPS），用 iPhone 實機測試（區網 IP 加 http 不是 secure context，不能測 SW）。預覽網址是暫時的 origin，不是正式網域 `ledgerland.swift.moe`，也不讓學生使用。實機至少一台 iOS 26 與一台 iOS 27 的 iPhone、一台 iOS 17 裝置（D8；沒有實機時用 Simulator 補，並在報告中註明），加一支中低階 Android；每個結果都記錄機型與系統版本，並顯示在原型的 debug 頁。

**試作程式放哪裡**（已決定，2026-10-20）：程式相關的內容一律只寫在 `ledger-land/` 資料夾內，不寫到其他地方。試作程式放在 `prototypes/m0a/`，M0a 開工的第一步已把 `/prototypes/` 連同 09 第 9 節的建置輸出、01 與 13、AI 工具設定的排除規則附加到 `.gitignore`（第一行 `references/` 不變），所以試作程式不會進 ledger-land 的 git 歷史。工具快取（npm、pnpm store、測試瀏覽器）也放在 `prototypes/` 底下。本機 AI 設定與 V17、V18 依你的決定延到 M0b，在第一次 commit 之前完成。

**不做什麼**：repo 初始化、CI、正式的 design tokens、會計核心、任何正式內容、正式網域、流量統計、讓學生使用。

**交付物**：

- M0a 驗證報告：每一項的測試方法、裝置與系統版本、結果、截圖、結論與建議。
- 量測數字與預算提案（首次載入 JS、precache 總量、內容 JSON 加總、Lighthouse 初測）。
- go / no-go 建議：通過的部分照原路線；失敗的部分列出備案與影響範圍。
- 文件要更新的地方（05、06、07、09 中被實測推翻或確認的敘述）。

**完成標準**：

- [ ] data mode 加 `/en/` 前綴的最小專案能建置，並部署到 Cloudflare Workers 的 HTTPS 預覽網址。
- [ ] 離線冷啟動時，三條路由的中文與 `/en/` 版本在 Safari 分頁與主畫面 App 都能開啟；`html lang` 依網址正確；在中文網址與 `/en/` 網址之間切換語言時作答狀態保留；作答中不出現更新提示。
- [ ] Cloudflare 上的深層連結（含 `/en/` 底下）直接開啟時回傳殼層、狀態碼 200，沒有語言選擇頁；`_headers` 的 CSP、`frame-ancestors 'none'` 與快取規則生效；PR 預覽可以開啟。
- [ ] V01 到 V07、V09、V13、V14、V15 各有紀錄（V08 暫不需要，報告中註明原因），每一項寫明裝置、系統版本與結果。
- [ ] 玻璃 Tab bar 在 iPhone 實機（含 iOS 17 裝置，或註明以 Simulator 代替）上可讀，有減少動態效果的截圖，也有最糟背景下的對比量測。
- [ ] 量測數字與預算提案已寫進報告。
- [ ] AI 工具設定的排除規則已附加到 `.gitignore`，既有的 `references/` 那一行沒有變動；V17、V18 各有紀錄。排除規則已在 2026-10-20 附加；本機 AI 設定依你的決定延到 M0b，報告中註明延後，V17、V18 改到 M0b 第一次 commit 之前完成。
- [ ] 每個失敗的檢查都列出備案、取捨與對後續里程碑的影響。
- [ ] 停下回報，你的 go / no-go 決定已記錄。

**開工前必須先決定**：

- D 系列都已決定：D5（C，中文在根路徑、英文在 `/en/`，data mode 加 vite-plugin-pwa，不預先產生 HTML）、D8（A，正式支援 iOS 17）、D4（預覽與正式主機都是 Cloudflare Workers Static Assets）。
- 仍待處理：需要你準備 iOS 17、iOS 26 與 iOS 27 的裝置（缺的版本用 Simulator 補，並在報告中註明實機缺漏）、一支中低階 Android、Cloudflare 帳號（由你建立，用於預覽部署）。試作程式的存放位置已決定（`prototypes/m0a/`）。
- 你要手動做的事：已決定（2026-10-20）：M0a 部署預覽之前，由你自己執行一次 `wrangler login`。這組憑證存在你自己的帳號設定裡，不放在專案內（帳號憑證不是套件，放在專案外比較安全，也不會被誤 commit）；做法見 [09 技術選擇](09-tech-stack.md) 第 7.5 節。

**主要風險**：

- 實機的 iOS 版本不齊（尤其是 iOS 17 的實機不容易取得），部分結論只能用 Simulator 推論；Simulator 無法代表實機的玻璃效能。
- data mode 加 `/en/` 前綴、`navigateFallback` 與 Cloudflare SPA fallback 的組合沒有官方的完整範例：離線導覽或 `html lang` 不通過時停下回報並提出備案，不在 M0a 中途改走其他路線。
- iOS 的行為可能隨小版本改變，結論要註明測試時的版本。
- 時間超出：建議以約一週的工作量為限，超過就停下回報目前的結果。
- 驗證不通過時想「邊做邊修」：不允許，一律停下回報並提出備案。

## 7. M0b 基礎建設

**狀態**：已完成（2026-10-22）。回報在 [docs/reports/m0b.md](../reports/m0b.md)：第 5 節逐項對照下方的完成標準，第 8 節列出 16 項與計畫不同或新發現的事（已回寫 06 第 8.2 節、09 第 7.4 與第 10 節、11 第 2 節風險 41、16），第 9 節是留給 M1 與 M2 的事（實機清單、套件 README、作答頁 CLS 複量、05 第 8.5 節的錨點還原）。下方的範圍與完成標準保留原文作為對照。

**目標**：建立 repo、工具鏈、CI 與各項基礎，讓之後每個里程碑都在同一套品質閘門下進行。

**範圍**：

1. repo 初始化：依 [09 技術選擇](09-tech-stack.md) 第 9 節的固定步驟；之後建立骨架也依同一節的規則，不用會清空或覆寫既有檔案的方式。若本機 AI 設定從 M0a 延到這裡（第 6 節範圍第 13 項），先附加排除規則、建立 AI 設定並記錄 V17、V18，全部完成後才做第一次 commit。依 D3，repo 公開：`.gitignore` 以附加的方式加入 `docs/plan/01-materials.md` 與 `docs/plan/13-material-questions.md`，兩份文件留在原位、只存在本機（由你備份），不搬移、不使用 `docs/private/`；這一步要在任何 `git add` 之前完成。
2. 工具鏈：pnpm 11.28.5 workspace、Node 24、TypeScript 6.0.3、Oxlint、Prettier、Vitest、Playwright、axe、lighthouse 13 CLI；`minimumReleaseAge` 與例外清單檢查；GitHub Actions 以 SHA 釘版。
3. CI 與部署：09 第 10 節的全部工作；以 `wrangler deploy` 整批部署到 Cloudflare Workers Static Assets（D4），base path 為 `/`，CI 只需要以根路徑建置；PR 預覽可用。正式網域 `ledgerland.swift.moe` 可以在 M0b 接上，最晚在 M2 試用之前；在那之前的部署只供內部測試，資料一律視為測試資料。
   - 已決定（2026-10-20）：部署設定放在 `apps/web/wrangler.jsonc`（原本規劃放在根目錄的 `wrangler.json` 移到這裡，每個要部署的 app 自己帶部署設定）；`assets.directory` 改為 `"./dist"`（相對於設定檔），其餘設定（`not_found_handling`、`html_handling`、自訂網域 `ledgerland.swift.moe`）不變，Worker 名稱維持 `ledgerland`。
   - 已決定（2026-10-20）：部署維持 GitHub Actions 執行 wrangler（09 第 10 節），不使用 Cloudflare 儀表板的 Git 整合（Workers Builds）；workflow 在 `apps/web` 目錄執行 wrangler（例如 `pnpm --filter @ledgerland/web exec wrangler deploy`，或 workflow 的 `working-directory: apps/web`），預覽同理用 `wrangler versions upload`。CI 只跑受影響的套件（`pnpm --filter "...[origin/main]"`），改到 `packages/` 時，用到它的 app 測試也一起跑；部署只在 `apps/web` 或它依賴的套件有變動時執行（`apps/web` 的建置輸入 `content/`、`schemas/`、`tools/` 有變動也算，所以只改內容的合併同樣部署，見 09 第 10.1 節）。
   - 重新部署：重建與部署需要的東西都在 repo 裡（精確鎖版的 `package.json`、`pnpm-lock.yaml`、`packageManager`、`.node-version`、`apps/web/wrangler.jsonc`、`_headers` 範本、CI workflow），新環境只要 clone、`pnpm install --frozen-lockfile`、建置、部署。出問題時可以退回 Cloudflare Workers 保留的上一個版本，指令與步驟在 M0b 查證後寫入（14 第 5.4 節）。
4. 語系架構：`packages/i18n`（原名 `i18n-config`；已決定（2026-10-20）：改名，放語系登錄檔、網址的語系函式 `localeFromPath`、`stripLocale`、`localePath`、金額與百分比等格式化函式、作答輸入正規化）、Lingui（macroTransform 或 M0a 決定的退路）；路由依 D5，中文在根路徑、英文在 `/en/`；語言切換開關（切換等於在中文網址與 `/en/` 網址之間換頁，並記住偏好；第一次造訪時的處理依 [05 多語系](05-i18n.md)）、`html lang` 依網址設定；作答狀態放在路由外 store 的示範頁。
5. design tokens：顏色依 [16 主題](16-themes.md)（紙質淺色與深色三風味，含對比度測試 `packages/tokens/test/contrast.test.ts`）、字級、間距、圓角、陰影、動態（含 reduced 變體）；設定頁的外觀與深色風味切換、boot 腳本讀 `ll:theme` 與 `ll:dark-flavor`（16 第 7 節）；玻璃 Tab bar 與手機、平板、電腦三種版面的殼層（見 [07 設計系統](07-design-system.md)、[02 網站架構](02-site-architecture.md)）。Tab 用 D9 的短名（首頁、闖關、實驗室、圖鑑、我的；Home、Quest、Lab、Terms、Me）；Tab bar 的元素寫在初始 HTML 殼層，並自動補 `-webkit-` 前綴（D8）。已決定（2026-10-20）：tokens 以 `packages/tokens` 的 TypeScript 原始檔為唯一來源，建置時產生 CSS 變數檔、TS 常數、manifest 的 `theme_color` 與 `background_color`、首次繪製的背景色，以及媒體查詢不能用 `var()` 的斷點常數；元件樣式不放在 tokens（Tab bar 的玻璃在 `apps/web`，其他玻璃元件的樣式在 `packages/web-ui`）。
6. PWA 殼層：manifest、圖示、SW（prompt 模式）、離線殼層；ErrorBoundary 與本機錯誤紀錄（最近 50 筆）。
7. 內容 pipeline：ContentAdapter（檔案）到正規化模型，再產出 content-manifest 與依語系、依章節切分的 hashed JSON；Term 與 Chapter 的最小 schema（放在 `packages/content-schema`）；JSON Schema 輸出與一致性檢查。
8. 安全與隱私：以 Cloudflare 的 `_headers` 設定 CSP、`frame-ancestors 'none'` 與其他安全標頭（寫法見 09 第 11 節）；隱私說明頁與關於頁的草稿（中英），隱私說明頁寫明流量統計的服務名稱與收集的內容。
9. debug 頁：顯示 app 與內容版本、`isAppMode()`、`persisted()`、`estimate()`、錯誤紀錄、web-vitals，以及統計腳本是否載入。
10. 授權檔（D6）：根目錄 `LICENSE`（MIT）；`LICENSES/CC-BY-SA-4.0.txt` 與 `content/` 裡指向它的簡短說明；README 的授權表（哪些路徑適用哪一種授權；老師的故事情境與金額不在 CC 授權內，標示「經陳彥宏老師授權使用」）；README 的「名稱與標誌」一節（「LedgerLand 會計樂園」的名稱與標誌不隨開源授權授出）；THIRD_PARTY_NOTICES 由 CI 產生並檢查白名單（見 [11 風險與授權](11-risks-license.md) 第 4.4 節）。關於頁與 README 的具名致謝由規劃者準備草稿、由你請老師看過文字與位置，老師看過之後才加入。
11. 流量統計（D7）：不用 cookie、不收集個資的統計；服務在 M0b 開工前查證後提出（候選：Cloudflare 的網頁分析），由你確認。同步修改 CSP（`script-src`、`connect-src`）、隱私說明頁與 debug 頁；統計腳本不進預先快取，離線時載入失敗不影響任何功能，也不得讓首次載入的效能預算超標。若服務採用由主機自動注入腳本的方式，要先確認不會改動 HTML 而讓 CSP 的 sha256 或離線殼層失效。
12. monorepo 骨架：已決定（2026-10-20）：依下列各項建立（資料夾結構見 [09 技術選擇](09-tech-stack.md) 第 8 節）。
    - 根目錄 workspace：根目錄只留工具必須在根目錄才找得到的檔案（`package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`.node-version`、`tsconfig.base.json`、`.oxlintrc.json`、`.prettierrc.json` 等）。
    - `apps/web`：學習端 PWA（殼層 `index.html`、路由與頁面、Service Worker 與 manifest、`_headers` 範本、`apps/web/wrangler.jsonc`）；IndexedDB 的儲存實作在 M2 加入。
    - `packages/tokens`、`packages/i18n`、`packages/content-schema`、`packages/web-ui`：npm 套件名稱一律 `@ledgerland/<資料夾名>`；每個套件有 `src/`、`test/`、`package.json`（`exports` 直接指向 `src`，不另外 build）、`README.md`（寫明範圍與允許的依賴），用同一份套件樣板。
    - `packages/web-ui`：已決定（2026-10-20）：在 M0b 就建立（你的選擇）。網站與後台共用的 React 元件與其樣式一開始就寫在這裡，後台日後直接使用；路由、頁面、殼層與 Service Worker 不放這裡。它有自己的 Lingui 字串檔（`packages/web-ui/src/locales/{locale}/messages.po`），放元件裡的文字；`apps/web` 的字串檔只放頁面與殼層的文字，兩者在載入時合併。M0b 要驗證 `@lingui/vite-plugin` 的 macroTransform 能處理 workspace 套件的原始碼（抽取與編譯都正確），不行時的退路是把 `packages/web-ui/src` 加進 app 的抽取設定（14 第 5.3 節）。
    - 其他套件在需要時才建立：`packages/core`（M1）、`packages/quiz` 與 `packages/progress`（M2）、`apps/admin`（M7）；`apps/mobile` 在 App 技術選定後才建立，現在不建立空資料夾（第 10.1 節）。
13. 專案隔離環境：已決定（2026-10-20）：套件、工具與快取都裝在專案自己的資料夾裡，不做全域安裝，整個環境可以刪掉重建（見 [09 技術選擇](09-tech-stack.md) 第 7.5 節）。
    - pnpm 的 store 放在 repo 內的 `.pnpm-store/`，快取與狀態放在 `.cache/pnpm/`（`pnpm-workspace.yaml` 的 `storeDir`、`cacheDir`、`stateDir`）；npm 快取（`npm_config_cache`）、Playwright 瀏覽器（`PLAYWRIGHT_BROWSERS_PATH`）也放在 `.cache/` 底下。把 `.pnpm-store/` 與 `.cache/` 附加到 `.gitignore`（只附加，不改既有內容）。M0a 的 `prototypes/env.sh` 是可用的範例。
    - wrangler、lighthouse、Playwright 都列在 devDependencies，不全域安裝；pnpm 本身依 `packageManager` 欄位鎖定 11.28.5（不依賴 Corepack）；`.node-version` 寫 24。
    - 查證（14 第 5.4 節）：pnpm 11 能否在 `package.json` 宣告 Node 版本並自動下載到專案內（可行就採用，否則沿用版本管理工具加 `.node-version`）；pnpm store 放在 repo 內時 CI 快取的設定。
    - 重設：刪掉 `node_modules/`、`.pnpm-store/`、`.cache/` 後執行 `pnpm install --frozen-lockfile` 即可重建。
14. 依賴方向檢查：已決定（2026-10-20）：依賴只能往下、不能循環，`packages/` 永遠不引用 `apps/`。除了 `web-ui`，其他套件都是純 TypeScript（不碰 DOM、不碰 React、不用 Node 專屬 API），用三道機制自動把關：這些套件的 tsconfig 不含 DOM 型別（`lib` 不列 `DOM`）；lint 規則（`no-restricted-imports`）禁止匯入 `react`、`react-dom`、`vite`、`node:*`；`tools/` 的檢查腳本確認各套件 `package.json` 的依賴符合方向，CI 的 hygiene 工作執行它。

**不做什麼**：題目與交易範本的 schema（移到 M1）、會計核心的邏輯、題目介面、正式內容（只放少量原創的名詞與章節範例資料）、後台；`packages/core`、`packages/quiz`、`packages/progress`、`apps/admin` 與 `apps/mobile` 都不在 M0b 建立。

**交付物**：可以建置與部署的 repo（monorepo 骨架、隔離環境設定、依賴方向檢查）、通過的 CI、殼層網站、授權檔、流量統計、M0b 回報（含初始化步驟的指令輸出）。

**完成標準**：

- [ ] 初始化步驟第 1、4、5、7、8 步的指令輸出已附在回報中；`git ls-files` 沒有 `references/`、`.xlsx`、`.pdf`、`.DS_Store`、`docs/plan/01-materials.md`、`docs/plan/13-material-questions.md`，也沒有任何 AI 設定路徑（`.claude/`、`CLAUDE.md`、`CLAUDE.local.md`、`AGENTS.md`、`.mcp.json`、`docs/plan/15-ai-workflow.md` 等）；所有分支的歷史紀錄掃描結果也是空的。
- [ ] 本機 AI 設定、`docs/plan/01-materials.md` 與 `docs/plan/13-material-questions.md` 仍在原位，`git check-ignore -v` 對每一個路徑都回報命中的規則。
- [ ] `.gitignore` 第一行仍是 `references/`，其餘規則都是附加的。
- [ ] 若本機 AI 設定從 M0a 延到 M0b：排除規則、AI 設定的建立與 V17、V18 的紀錄，都在第一次 commit 之前完成，回報中附上先後順序的證據。
- [ ] 每次加入骨架後的 `git status --porcelain` 輸出已附上，沒有任何既有檔案被修改或刪除。
- [ ] `packageManager`、`.node-version`、TypeScript 6.0.3 的鎖定都生效；`pnpm-workspace.yaml` 有 `minimumReleaseAge: 20160` 與 `trustPolicy: no-downgrade`。
- [ ] 所有 workflow 的 action 都以 SHA 釘版，CI 的檢查能抓到未釘版的寫法。
- [ ] `ci.yml` 的全部工作在一個 PR 上通過。
- [ ] 刻意製造的錯誤都會讓 CI 失敗，各試一次並記錄：en 缺一則介面字串、JSON Schema 與原始碼不一致、內容引用不存在的名詞、首次載入 JS 超過預算、過期的例外條目。
- [ ] 整批部署到 Cloudflare Workers 成功；建置產物有 `sw.js`；manifest 的 `id` 固定；site config 是 base path、manifest `id`、`scope`、`start_url` 與 SW scope 的單一來源。
- [ ] 深層連結（含 `/en/` 底下）直接開啟時回傳殼層、狀態碼 200；`_headers` 的 CSP 與安全標頭生效；PR 預覽可以開啟。
- [ ] 語言切換立即生效、重新整理後仍記得、`html lang` 依網址正確；作答中在中文網址與 `/en/` 網址之間切換時，示範頁的狀態與捲動位置都保留。
- [ ] 離線測試與更新提示測試通過；E2E 中沒有任何 CSP 違規。
- [ ] 流量統計：E2E 確認沒有寫入 cookie 或本機儲存、沒有 CSP 違規、離線冷啟動不受影響、效能預算仍然通過；隱私說明頁與 debug 頁已寫明服務名稱與收集的內容。
- [ ] 內容 pipeline 能產出 content-manifest 與 hashed JSON；`schemas/` 的一致性檢查有效。
- [ ] CI 的 `docs:examples` 能抽出 `docs/` 中的 JSON 範例：全部能解析，名詞與章節的範例通過 schema 驗證（題目與交易範本的範例在 M1 加入）。只存在本機的 01 與 13 不在 CI 的檢查範圍內。
- [ ] 隱私說明頁草稿（中英）已上線到預覽網址。
- [ ] `LICENSE`（MIT）、`LICENSES/CC-BY-SA-4.0.txt`、`content/` 的授權說明、README 的授權表與「名稱與標誌」一節都已建立；THIRD_PARTY_NOTICES 由 CI 產生，白名單以外的授權會讓 CI 失敗（刻意試一次）。
- [ ] README 與關於頁的具名致謝只在老師看過文字與位置之後才加入；回報中記錄目前的狀態。
- [ ] 結構驗收 1：從乾淨的 clone 執行 `pnpm install --frozen-lockfile`，store 與快取都在專案內（`.pnpm-store/`、`.cache/`）。
- [ ] 結構驗收 2：全部套件的型別檢查與測試通過；依賴方向檢查與純 TypeScript 套件的 DOM 禁用檢查通過。
- [ ] 結構驗收 3：建置 `apps/web`，產物在 `apps/web/dist/`。
- [ ] 結構驗收 4：在 `apps/web` 用 `wrangler dev` 確認深層連結（含 `/en/`）回 200、`_headers` 生效。
- [ ] 結構驗收 5：PR 預覽網址上跑 E2E；全部通過才部署。
- [ ] 結構驗收 6：`packages/web-ui` 的 Lingui 字串抽取與編譯正確（範圍第 12 項的驗證事項，14 第 5.3 節）。
- [ ] 殼層頁面通過第 4 節的驗收閘門。
- [ ] 停下回報。

**開工前必須先決定**：

- D 系列都已決定：D3（repo 公開，01 與 13 只存在本機，第一次 `git add` 之前附加排除規則）、D4（Cloudflare Workers Static Assets、base path `/`、正式網域 `ledgerland.swift.moe`）、D6（授權檔照範圍第 10 項建立）、D7（統計照範圍第 11 項建置）、D8（Tab bar 寫在初始 HTML 殼層）、D9（Tab 短名）。
- 已決定（2026-10-20）：目錄結構、套件切分、隔離環境與部署方式（範圍第 3、12 到 14 項）。
- 仍待處理：M0a 的 go 決定；統計服務的查證結果（M0b 開工前提出，由你確認）；具名致謝的文字請老師看過（可以和 M0b 平行進行，看過之前不加入）。
- 你要手動做的事：已決定（2026-10-20）：M0b 第一次正式部署之前，由你在 Cloudflare 建立只有 Workers 與 `swift.moe` 必要權限的 API token，並把 token 與 Account ID 存進 GitHub repo 的 Actions secrets（`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`，畫面名稱以當時介面為準）。CI 用這組 secrets 部署，本機不需要憑證。之後任何目錄調整都只改 repo 裡的 wrangler 設定與 workflow，不需要手動改 Cloudflare 設定。

**主要風險**：

- 初始化時誤加入 `references/`、`.DS_Store`、AI 設定或只存在本機的 01、13：靠固定步驟與指令輸出把關，因為這時 pre-commit hook 與 CI 都還不存在；repo 公開，一旦 push 就無法撤回。01 與 13 不在版本控制內，遺失時沒有 git 可以救，請你定期備份。
- 統計腳本和 CSP、離線殼層或效能預算衝突：PR 預覽不載入統計腳本，所以改在本機建置與 CI 的效能量測中強制載入統計腳本、送出目的地指向 stub 端點（06 第 8.2 節）驗證，不送資料到正式統計端點；不通過就停下回報，不自行放寬 CSP。
- Lighthouse 在 CI 上分數浮動：用 5 次中位數與 `benchmarkIndex` 校準，必要時調整節流倍數，而不是放寬門檻。
- Lingui 的 macroTransform 在完整專案中出現 M0a 沒遇到的問題：改用 Babel 外掛的退路，只改建置設定。若問題只出在 workspace 套件的原始碼（`packages/web-ui`），退路是把 `packages/web-ui/src` 加進 app 的抽取設定。
- 隔離環境的代價：不同專案之間不共用快取，比較佔硬碟空間。

## 8. M1 會計核心

**目標**：完成 `packages/core`，讓科目表、交易範本、過帳、報表與指標都由同一顆核心計算，成為唯一的資料來源。

**範圍**（設計細節見 [04 會計核心](04-accounting-core.md)）：

已決定（2026-10-20）：M1 建立 `packages/core`，只放會計（科目表、交易範本、過帳、三表、指標、五步驟勾稽、追蹤、IFRS 政策）；分錄的正規化比對（合併同科目同方向的行、多重集合比對）屬於會計知識，也放在這裡。選擇題與數字題的判分、星星、錯題本不放在 core，M2 放進 `packages/quiz`。題目與交易範本的 schema 加進 M0b 建立的 `packages/content-schema`。

1. 科目表資料：依 D13（W01 到 W15 全部採用）建立主要顯示與別名：多數保留教材名稱為主要顯示，W 系列指定的修正寫法（例如統一寫「應付帳款」「週轉率」「資產總計」「每股面額」）改為主要顯示，教材原字一律保留為可搜尋的別名；舊稱加「舊稱」標記；「短期放貨」不在 W 系列內，主要顯示維持教材原文，等【待確認 T09】。另含各種旗標、不可入帳的分組標題。
2. 交易範本：`params`、`derived`、`preconditions`、`lines`（每條現金行帶現金流量標籤）；故事步驟與範本分開，一步可以包含多個事件。受控運算式的 parser 在建置期轉成 AST，執行期依 AST 求值，不使用 `eval`。
3. 分錄驗證與過帳：餘額快照、變動量、白話的 `effects`（中英）。
4. 存貨模型、教材版面的三表、間接法現金流量表與「分錄到教材列」的對應表；同時計算直接法供性質測試使用。
5. 指標登錄檔（一個指標、多個版本，附公式與來源）與指標狀態（na、not_meaningful、zero、ok 的判定順序）。
6. 五步驟檢查：步驟一回傳五層利益；步驟二到五回傳兩邊數值與差額。
7. 兩層模型：`policy`（預設 `teacher@1`）與 `layout`（教材版面 `teacher@1`）的結構；計分題的 `scenario.policy` 只允許 `teacher@1`。M1 不實作 IFRS 對照政策，只在 schema 保留 `policy` 欄位與 `policyWhen`；`ifrs@1` 政策與版面在 M4b 實作（D10(f)，見 04 的評估一）。
8. 題目與交易範本的 schema：題型代號一律 snake_case（見 [08 題庫與後台](08-content-admin.md) 第 3.6 節）；題幹欄位是 `prompt`（是非題用 `statement`）；題目自帶的數字放在 `vars`；計算型題目共用 `scenario`（`opening`、`events`、`policy`、`layout`、`window`、`targets`）；另含 `ratioRef`、`acceptStatus`，以及選填的 `labRef`、`termRefs`。題目層級的 `pendingRefs`（答案可能因待確認事項而改變、暫不計分）與交易範本的 `entryQuestionBlockedBy`（列出 T 編號，擋下分錄題）兩者並存、用途不同。追蹤（provenance）需要的 `sources` 由核心輸出，M4b 的完整公式樹直接使用（D10(c)）。
   - `multi_choice`（D12）：`options` 同 `single_choice`，正解欄位 `correctOptionIds` 至少兩個（只有一個正解的題目仍用 `single_choice`），另有必填的 `scoringMode`：`any_correct` 或 `all_correct`。改動 `scoringMode` 或 `correctOptionIds` 屬於答案改版（`revKind: answer`）。元件在 M2 實作。
   - `journal_entry`（D1）：schema 與計分規則在這裡定義，只用在 M3 的「借貸與分錄」延伸章。分錄比對放在 `packages/core`；呼叫它的分錄題計分 `scoreJournalEntry` 放在 `packages/quiz`（M2 建立）。
9. 計算型題目的答案在建置時由核心算出；作者若有填答案，必須和核心一致。
10. 故事資料（D2）：18 筆故事步驟照老師的情境與金額建立，公司名稱先用暫定的原創名稱（正式名稱在 M4a 開工前由規劃者提案、你確認，D9）；第 12 筆等疑似誤植依 13 的建議處理並在資料中加註；故事資料檔附上授權說明「經陳彥宏老師授權使用」，不在 CC 授權內。故事資料只做性質測試，不當成 commit 的黃金測試期望值。

**不做什麼**：任何介面（核心不依賴 UI）、正式題目內容、實驗室動畫、IFRS 對照政策與介面（M4b）。

**交付物**：`packages/core`（含測試）、科目表與 18 種交易範本的資料、故事資料、題目與範本的 schema（在 `packages/content-schema`）與 JSON Schema、M1 回報（本機驗證結果只寫摘要，不附與老師 Excel 逐格比對的明細）。

覆蓋率門檻已決定（2026-10-23）：陳述式與行 90%、分支 85%、函式 90%（只量 `packages/core/src`，`pnpm test:coverage` 低於門檻就失敗）。

**完成標準**（分兩級）：

第一級，故事第 1 到 3 筆「已對老師 Excel 驗證」：

- [x] `*.local.test.ts` 在本機執行時，第 1 到 3 筆交易後的三表各列與 Excel 版本的 23 項指標，以完整精度和老師 Excel 的公式重算值一致。Excel 版本中刻意不重現的已知錯誤（例如【待確認 T25】），改以修正後的口徑比對，差異逐項列在回報中。
- [x] 本機測試不使用 snapshot；期望值在執行時從 `references/` 讀出；輸出只寫到 gitignored 的目錄；`references/` 不存在時自動排除（在 CI 上確認會被排除）。

第二級，故事第 4 到 18 筆「性質測試通過，標示為依課程情境推算」（原「推論，待老師確認」，2026-10-23 依【待確認 T33】的決定改）：

- [x] 第 4 到 18 筆都通過性質測試：借貸平衡；資產等於負債加權益；現金流量表的合計等於現金變動；本期淨利與未分配盈餘一致；間接法與直接法的營業活動金額相等。
- [x] 這些步驟在資料中標示為推算（`verification: "inferred"`），並定義介面上的對應旗標（文字為「依課程情境推算」），供 M4a 顯示。
- [x] 推算時用到的假設（例如存貨盤盈的處理、設立費的現金流量歸類）做成可以切換的政策或參數，並列在回報中（【待確認 T06】【待確認 T30】）。

共同：

- [x] 每一個交易範本都有單元測試；黃金測試使用自編數字並 commit。故事資料（老師的情境與金額）只用在性質測試，CI 檢查黃金測試的期望值沒有引用故事資料。
- [x] `multi_choice` 的 schema 擋下 `correctOptionIds` 少於兩個、缺少 `scoringMode`，或 `scoringMode` 不是 `any_correct`、`all_correct` 的題目（有測試）。
- [x] 交易範本的 `entryQuestionBlockedBy` 機制有效：`content:check` 擋下引用帶這個欄位的範本的 `journal_entry` 題目（用自編的測試範本驗證）。2026-10-23 起設立費、存貨盤盈、攤銷的範本依【待確認 T04】【待確認 T05】【待確認 T06】的決定不再帶這個欄位（M1 實作時曾帶，需同步移除）。
- [x] 指標的每個版本都附公式與來源；狀態判定的順序與 `-0` 的處理有測試。
- [x] 受控運算式的 parser 拒絕白名單以外的語法；程式碼中沒有 `eval` 與 `new Function`（CI 檢查）。
- [x] 題目與範本的 schema 已輸出 JSON Schema；`content:check` 能用核心算出計算型題目的答案，並擋下和核心不一致的作者答案。
- [x] [04 會計核心](04-accounting-core.md) 與 [08 題庫與後台](08-content-admin.md) 的題目、交易範本、故事 JSON 範例都通過 `docs:examples` 的 schema 驗證；不一致時，以 schema 為準修正文件，並寫進回報。
- [x] `packages/core` 的測試覆蓋率達到門檻（門檻數字在 M1 開工時提出，建議不低於 90% 的陳述式覆蓋率）。
- [x] 停下回報。

**開工前必須先決定**：

- D 系列都已決定：D13（W01 到 W15 全部採用，科目表照範圍第 1 項建立主要顯示與別名）、D2（故事資料用老師的情境與金額，範圍第 10 項）、D12 與 D1（`multi_choice`、`journal_entry` 的 schema，範圍第 8 項）、D10(c)（M1 輸出 `sources`，M4b 直接使用）、D10(f)（M1 只保留 `policy` 欄位與 `policyWhen`）。
- T 系列：已決定（2026-10-23）不寄清單，影響核心的 T01 到 T15、T21、T22、T25 到 T28、T30、T33、T36 都由規劃者依專業判斷決定並記錄在 14（第 5 節），M1 的資料依決定設定；含老師金額的故事資料（範圍第 10 項）依老師已同意的範圍使用（【待確認 T34】）；commit 與 push 一律先徵求你的同意。

**主要風險**：

- 老師日後的回饋改變核心的處理（例如五層利益、非常損益、遞延資產、盤盈）：用政策與參數隔離，只改資料。
- 第 4 到 18 筆的推算有誤：介面標示「依課程情境推算」，老師日後提供檔案時（【待確認 T33】）補做第一級驗證。
- 指標定義版本多、口徑不一（【待確認 T21】【待確認 T22】）：計分一律以題目指定的 `ratioRef` 為準。

## 9. M2 闖關區 MVP

**目標**：第一個可以給學生試用的闖關區版本，部署在正式網域 `ledgerland.swift.moe`。

**範圍**：

0. 闖關地圖（已決定 2026-10-21，見 [17 闖關地圖](17-quest-map.md)）：`/play/` 改成由下往上的關卡路線：節點與星星、目前關卡的簡單版角色、章節牌、幾何色塊場景、關卡介紹表單、清單檢視、頂部統計與工具列、`?from` 的移動與點亮動畫、座標樣板；章節頁作為清單檢視。驗收：四個主題與減少動態的截圖、axe 無 serious 與 critical、鍵盤走完整張地圖、VoiceOver 唸出節點狀態、iPhone 實機捲動順暢、Lighthouse `/play/` 效能 90 以上。
1. 題型：情境單選 `single_choice`（逐選項回饋）、多正解 `multi_choice`（與 `single_choice` 共用元件，見下一項）、是非 `true_false`、選報表 `pick_statement` 與點選報表列 `pick_line`、分類 `classify`（點選與鍵盤必備；拖放依 M0a 的 V07 結果與你的決定）、交易影響 `transaction_effect`（輸入是交易範本 ID 與參數、答案由核心計算，API 可以直接嵌入實驗室）。主線不出分錄題（D1），`journal_entry` 留到 M3 的延伸章。
2. `multi_choice`（D12）：選項 3 到 5 個，至少兩個正確選項，至少一個選項不是正解；判分方式由題目的 `scoringMode` 決定；兩種判分方式和 `single_choice` 共用同一個「確認答案」按鈕。
   - `any_correct`：單選介面，選中 `correctOptionIds` 中任一個即答對；提示「這題有不只一個合理答案，選出任一個即可。」
   - `all_correct`：核取方塊可以複選，必須選出全部正確選項而且沒有選到錯誤選項才答對，按「確認答案」後才判分；提示「選出所有正確答案（可複選）。」；提示不透露正確答案的數量。
   - 提示放在選項群組的標題（`fieldset` 的 `legend`），讓螢幕閱讀器先唸出；按「確認答案」後焦點移到回饋區的標題（不另外重複 `aria-live` 播報，和 `single_choice` 共用的 ChoiceGroup 元件相同）；作答後每個選項都顯示回饋，並標出全部正確答案；不給部分分數。
3. 回饋：立即回饋與解說、名詞卡 chip（單一來源）；選項一律打散，解說引用選項 ID。「看動畫」按鈕的資料（`labRef`）照填，按鈕到 M5 才顯示。
4. 遊戲元素：章節地圖與關卡、星星（依正確率）、錯題本（簡易間隔複習），遇到題目改版時顯示「題目已更新」。
5. 本機儲存：IndexedDB schemaVersion 1 與 migration 架構；處理多分頁的 blocked 與 versionchange。IndexedDB 的儲存實作放在 `apps/web`，進度資料模型、資料版本升級（migration）與儲存介面的定義放在 `packages/progress`（範圍第 11 項）。
6. 進度保護（D10(a)，評估一）：
   - `persist()`：偵測到 App 模式時在啟動時呼叫，或在第一次完成關卡時呼叫；Firefox 只走設定頁的按鈕；App 內建瀏覽器不呼叫。文案只說「降低被清除的機率」。
   - 匯出匯入：備份檔（JSON）加文字備份碼；匯入預設合併（作答紀錄取聯集、星星取最大值等），覆蓋放在進階選項。
   - Safari 分頁轉到主畫面 App 的流程與 Safari 分頁的常駐提示。
7. 課堂 QR 入口（D10(a)）：
   - 關卡代號：關卡介紹顯示關卡 ID 去掉 `lv_` 的 8 個字元，App 內提供「輸入關卡代號」入口（處理大小寫、輸入錯誤與已下架的關卡）。
   - App 內相機掃描課堂 QR：內建 JS 解碼器（Safari 沒有正式的 BarcodeDetector），解碼器在 M2 開工前查證選型（體積、授權、iOS 實機表現，以及是否需要 WebAssembly：需要時 CSP 的 `script-src` 要加 `'wasm-unsafe-eval'`，選型時優先考慮不需要的方案）。解碼器延後載入，不計入首次載入 JS，但納入預先快取，離線時也能掃描。已決定（2026-10-23）：主案 `@zxing/library` 0.23.0（深層匯入 QR 子集、在 Web Worker 解碼、純 JS、不需要 WebAssembly），退路 jsQR 1.4.0，M2 不用原生 BarcodeDetector；未採用的方案與理由見 [14 待確認](14-open-questions.md) 第 5.2 節，實機辨識率見【待實測 V19】。
   - 相機權限只在使用者按下「掃描 QR」之後才請求；請求前先用一句話說明用途；拒絕或無法使用相機時引導改用關卡代號；解碼只在裝置上進行，不保存、不上傳影像；離開掃描畫面時一定關閉相機。掃到的網址只接受本站的關卡、故事步驟路徑，其他網址不自動開啟。相機權限反覆詢問的門檻（已決定 2026-10-23）：同一次啟動、同一個畫面內反覆詢問才算阻礙；主畫面 App 每次重新開啟再問一次是 WebKit 的已知行為（【待實測 V20】），不算阻礙，說明卡要先告訴學生。
   - 安全標頭：`_headers` 的 `Permissions-Policy` 為 `camera=(self)`（09 第 11.2 節）；M2 確認部署後的 `_headers` 仍是這個設定，而且 App 內掃描在這個設定下能正常使用相機；隱私說明頁補上相機的用途與「影像不離開裝置」。
8. App 內建瀏覽器的偵測與可收合橫幅；簡易版安裝提示（Chromium 的按鈕、iOS 的簡易說明），完整圖解在 M3。
9. 錯誤處理：內容載入失敗、IndexedDB 失敗、儲存空間不足的固定提示與「立即匯出」按鈕。
10. 內容：前 2 到 3 章的中英原創題目與名詞，依觀念覆蓋表撰寫（見 [08 題庫與後台](08-content-admin.md)）；用語依 W01 到 W15（D13）；英文用英式拼字，美式拼法列為搜尋別名，日期格式跟著英式（D11）；介面使用 D9 的 Tab 短名與模組全名（闖關區／Quest、報表實驗室／Statement Lab、名詞圖鑑／Glossary）。
11. 套件：已決定（2026-10-20）：依下列兩項建立。
    - `packages/quiz`：12 種題型的判分入口，包括多正解題判分 `scoreMultiChoice`、數字題比對（含 N/A 與位數規則）、分錄題計分 `scoreJournalEntry`（呼叫 `packages/core` 的分錄比對）；以固定種子打散選項；星星計算；錯題本的間隔複習排程；題目改版後（`id` 加 `rev`）的處理規則。畫面與儲存不放這裡。
    - `packages/progress`：進度資料模型（作答紀錄、關卡、星星、徽章、設定含 `labView`）、備份檔與文字備份碼的格式、匯入合併規則（作答紀錄取聯集、星星取最大值等）、資料版本升級（migration）、儲存介面的定義。IndexedDB 的實作在 `apps/web`；原生儲存的實作日後在 `apps/mobile`。
    - 題目、回饋與名詞卡等元件寫在 M0b 建立的 `packages/web-ui`，後台日後直接使用。

**不做什麼**：報表實驗室、名詞圖鑑與徽章、計時、其餘題型與借貸分錄延伸章（M3）、後台。

**交付物**：可以試用的闖關區（部署在正式網域 `ledgerland.swift.moe`）、`packages/quiz` 與 `packages/progress`（含測試）、`apps/web` 的 IndexedDB 儲存實作、前 2 到 3 章的內容、QR 解碼器的選型紀錄、M2 回報。

**完成標準**：

- [ ] 每種題型都能只用鍵盤完成，並通過第 4 節的驗收閘門。
- [ ] 計算型題目的答案都由核心算出，`content:check` 通過。
- [ ] `multi_choice` 的兩種判分方式都有測試：`any_correct` 選中任一正解即答對；`all_correct` 必須全選而且沒有錯選，按「確認答案」後才判分；不給部分分數；作答後每個選項都有回饋並標出全部正確答案；VoiceOver 與 TalkBack 先唸出 `legend` 裡的提示；改動 `scoringMode` 或 `correctOptionIds` 會升 `rev`（`revKind: answer`），錯題本顯示「題目已更新」。
- [ ] 作答中切換語言（在中文網址與 `/en/` 網址之間），題目、已選選項與捲動位置都保留。
- [ ] 題目 `rev` 改變時，錯題本顯示「題目已更新」（有測試）。
- [ ] IndexedDB 的 migration 有測試（以測試用的假版本模擬升級）；兩個分頁同時開啟時，升級不會卡住（Playwright 兩個頁面測試）。
- [ ] `persist()` 的呼叫時機有測試：App 模式啟動時、第一次完成關卡時；Firefox 不自動呼叫；App 內建瀏覽器不呼叫。
- [ ] 匯入的合併規則（作答紀錄取聯集、星星取最大值等）有測試；備份檔與文字備份碼都能在 Safari 分頁與主畫面 App 之間轉移；Safari 分頁的常駐提示與轉移流程在 iPhone 實機走過一次。
- [ ] 關卡代號的輸入（大小寫、錯誤代號、已下架的關卡）有測試。
- [ ] App 內掃描 QR 在 iPhone 主畫面 App 與 Android 實機上能開到正確的關卡；拒絕相機權限時改走關卡代號；離開掃描畫面後相機確實關閉；非本站網址不自動開啟；CSP 與 `Permissions-Policy` 沒有違規。
- [ ] 離線時整章可以作答。
- [ ] 已發布的題目都通過與教材的相似度人工檢查、文案語氣檢查；`content:i18n-report` 對已發布的內容沒有缺漏；英文內容通過英式拼字檢查。
- [ ] 交易影響題元件的 API 文件已寫好，標明 M4a 如何嵌入。
- [ ] 試用連結與 QR 都使用正式網域（例如 `https://ledgerland.swift.moe/level/lv_k7m2q9xd/`）。
- [ ] 停下回報。

**開工前必須先決定**：

- D 系列都已決定：D1（主線不出分錄題）、D4（正式網域 `ledgerland.swift.moe`）、D9（Tab 短名與模組全名）、D10(a)（範圍第 6、7 項）、D11（英式拼字）、D12（`multi_choice`）、D13（W01 到 W15 全部採用）。
- 仍待處理：App 內掃描 QR 的 JS 解碼器選型（M2 開工前查證並提出，由你確認）：已決定（2026-10-23），`@zxing/library` 0.23.0 的 QR 子集在 Worker 解碼，退路 jsQR 1.4.0（14 第 5.2 節）；試用的對象與規模（見文末）：尚未決定（2026-10-23 提醒使用者，試用時再定）。

**主要風險**：

- 原創內容的產量跟不上：依觀念覆蓋表估算題數，先求每個學習目標都有題目。
- 試用同學的進度被清除，或分頁與 App 各有一份：靠完整的進度保護、關卡代號與 App 內掃描降低影響，文案只說「降低被清除的機率」。
- M2 的範圍因完整的進度保護、App 內掃描 QR 與 `multi_choice` 而變大：先完成題型與進度保護；App 內掃描遇到阻礙（例如解碼器在 iOS 上效能不足，或相機權限在同一次啟動、同一個畫面內反覆詢問）時停下回報，關卡代號入口仍可以單獨上線；主畫面 App 每次重新開啟再問一次相機權限是 WebKit 的已知行為（V20），不算阻礙（已決定 2026-10-23）。

## 10. M3 闖關區完整（期中考範圍）

**目標**：闖關區涵蓋第一部分的全部章節，達到期中考複習可用的程度。

**範圍**：

1. 第一部分全部章節（章節草案見 [03 模組設計](03-modules.md)，確切範圍依【待確認 T32】）。
2. 其餘題型：五步驟勾稽填格 `five_step_fill`、指標計算 `ratio_numeric`（數字輸入，提供固定的「N/A」按鈕）、指標判讀 `ratio_interpret`、取捨思辨與利害關係人判斷（都用 `judgment`，不計分，顯示原創的解說觀點）。`multi_choice` 已在 M2 和 `single_choice` 一起做好（D12），這裡只增加題目；教材 0-2 那一題雙正解改寫成原創題目時以 `any_correct` 呈現。
3. 延伸區：本益比、融資、資本公積、利害關係人等（不列入期中考範圍）。涉及投資的內容加上「非投資建議」聲明。地圖上放在主線盡頭之外的延伸區（17 第 3.5 節）。
3a. 闖關地圖第二階段（17 第 10 節）：全部章節的原創場景插圖（會計比喻的題材）、吉祥物定稿（造型與名字先由規劃者提案、你確認）、章節徽章與章末慶祝、延伸區場景；驗收加每章場景在四個主題的截圖與場景 SVG 體積檢查。
4. 「借貸與分錄」延伸章（D1）：不列入期中考範圍；借貸分錄題型 `journal_entry` 只用在這一章，計分採 M1 定義的規則（同科目同方向合併後，以科目、借貸方、金額的多重集合比對，不看行序）；教學卡要說明核心的永續盤存分錄（借記存貨）和教材版面「本期進貨」的差別；設立費、存貨盤盈、攤銷在老師確認前不出分錄題（【待確認 T04】【待確認 T05】【待確認 T06】）。
5. 名詞圖鑑（Glossary，D9）與闖關解鎖、章節徽章。
6. 計時：預設關閉，開啟後可以暫停，並以文字顯示剩餘時間。
7. 完整的安裝圖解：依 Safari 分頁列的兩種版面各一套（Compact 與 Top／Bottom），在 iOS 26 與 iOS 27 實機上截圖確認。iOS 17、18 沒有「以 Web App 打開」開關，也沒有 Compact 分頁列，依 manifest 以 web app 開啟，使用 Top／Bottom 那一套圖解（見 [06 PWA 與響應式](06-pwa-responsive.md) 第 1 節）；在 iOS 17 裝置（D8）上走過一次確認。

**不做什麼**：報表實驗室、跨模組導覽、後台。

**交付物**：完整的闖關區與內容、M3 回報（含觀念覆蓋表的達成狀況）。

**完成標準**：

- [ ] 觀念覆蓋表中每個 `objectiveId` 都已發布預計題數的原創題目。
- [ ] 指標題都有 `ratioRef`，計分依題目指定的版本；正解為 N/A 的題目有 `acceptStatus`。
- [ ] 取捨思辨題的解說觀點全部是原創撰寫，署名方式依【待確認 T37】。
- [ ] 延伸章在介面上標示「不在期中考範圍」。
- [ ] `journal_entry` 的計分（合併同科目同方向後以多重集合比對，接受複合或拆開的分錄）有測試；`journal_entry` 只出現在「借貸與分錄」延伸章（CI 檢查）；被 `entryQuestionBlockedBy` 擋下的交易沒有分錄題（CI 檢查）。
- [ ] 名詞圖鑑的解鎖與徽章會寫入進度，也包含在匯出檔與文字備份碼裡。
- [ ] 安裝圖解在實機上走過一次，截圖與目前的 iOS 介面一致。
- [ ] 所有已發布內容通過相似度檢查、文案語氣檢查與台灣用語掃描。
- [ ] 通過第 4 節的驗收閘門。
- [ ] 停下回報。

**開工前必須先決定**：

- D 系列都已決定：D1（延伸章在這裡做）、D12（`multi_choice` 已在 M2 完成）。
- T 系列已決定（2026-10-23）：期中考範圍依【待確認 T32】的決定（第一部分主課程的章節為範圍，附錄的投資相關內容與延伸章放延伸區，畫面標示「範圍以老師公告為準」）；門檻值、六大類指標、解說署名、指標辨識題依【待確認 T24】【待確認 T31】【待確認 T37】【待確認 T38】的決定；延伸章依【待確認 T16】到【待確認 T20】、【待確認 T23】的決定。T18、T19、T23 牽涉的現行法規與年報格式在出題前查證。

**主要風險**：

- 內容產量最大的階段，品質與原創性的審稿負擔重；延伸章的教學卡與分錄題是額外的內容量，可以排在期中考範圍的章節之後。
- 題目公開後就無法當作考題，可能影響老師出題（見 [11 風險與授權](11-risks-license.md)）。

### 10.1 M3 完成後：App 技術決策點

這不是里程碑，不改變里程碑的順序；沒有 registry 編號，由你決定（[14 待確認](14-open-questions.md) 第 5.2 節）。

- 已決定（2026-10-20）：`apps/mobile` 現在不建立（技術選定後才建立，不先建空資料夾），App 技術現在不選。
- 待你決定：App 的技術（Capacitor 包裝網站、React Native 的 Expo、原生 Swift／Kotlin），建議 M3 完成後決定（14 第 5.2 節）。
- 比較重點：Capacitor 工作量最小，畫面直接用 `apps/web` 的建置結果，進度可存原生儲存而避開 Safari 的清除規則與分頁／主畫面不共享的風險，但 App Store 審查準則 4.2（最低功能要求）對只是包裝網站的 App 較嚴；Expo 有原生手感並能用 iOS 原生玻璃元件，但畫面要重寫一次，Hermes 引擎的 Intl 支援要查證；原生 Swift／Kotlin 要用別的語言重寫會計核心，單人維運不建議。
- 依賴：`apps/mobile` 使用 `packages/tokens`、`packages/i18n`、`packages/content-schema`、`packages/core`、`packages/quiz`、`packages/progress`，不使用 `packages/web-ui`；原生儲存的實作放在 `apps/mobile`，介面沿用 `packages/progress` 的定義。
- 開工方式：選定技術後，先在 `apps/mobile` 做小型試作，比照 M0a 先驗證再開工。

## 11. M4a 與 M4b 報表實驗室

D10(c) 決定做完整公式樹與來源分錄，M4 的介面工作量因此最大，所以拆成兩個小階段，各自停下回報：M4a 做故事、動畫、預測、自由實驗與勾稽練習，完成後實驗室就可以先給學生使用；M4b 在 M4a 的畫面上加入追蹤與 IFRS 切換。流程設計見 [03 模組設計](03-modules.md)。M5 只依賴 M4a 的故事步驟與帶入狀態，不依賴 M4b。

### 11.1 M4a 報表實驗室：故事與動畫

**目標**：用由使用者逐步推進的動畫，呈現一筆交易如何流進三表與財務指標。

**範圍**：

1. 故事模式（D10(b) 選 C、D2 選 B）：連續故事為主線，照老師的情境與金額；公司名稱原創（D9）；敘述文字用網站自己的話撰寫；第 12 筆等疑似誤植依 13 的建議處理並在畫面上加註。每一步依序是交易卡、預測、科目變動、會計恆等式天平、損益表五層利益、現金流量表、資產負債表、勾稽燈號、指標變化、管理意涵與利害關係人卡。由「下一步」按鈕推進，不自動播放。故事步驟的網址是 `/lab/story/<storyId>/<stepId>/`，英文是 `/en/lab/story/<storyId>/<stepId>/`。
2. 單獨練習：每一步都有「單獨練習」入口，沿用故事在該步之前的狀態，不另外寫情境資料。
3. 科目變動（D1）：以白話為主（例如某科目增加多少），「看分錄與 T 字帳」預設收合、可以展開；展開後的分錄由核心過帳的結果產生。
4. 累計三表與本筆變動：依 W06（D13 採用），學生一定看得到「本筆變動」，不會誤讀累計數；手機與寬版的排法以 03 評估 6 為準。指標只對累計報表計算。
5. 預測：直接使用 M2 的交易影響題元件。
6. 自由實驗：改了前面的金額，後面依帳上狀態推導的步驟跟著變；資產與負債科目不得為負，違反時擋下並顯示可輸入的最大值；整步都是 0 時顯示「本筆無影響」。故事沒涵蓋的交易可以用原創情境的範本加入。
7. 勾稽練習：預設只開放三個手動輸入格，其餘由核心帶入；進階模式再開放更多格。
8. 指標面板（指標實驗室）：可以切換顯示不同版本，但不影響任何計分。
9. 報表版面（D11）：中英都用教材版面，IFRS 沒有或禁止的項目在中英兩種介面都加標記（中文「非 IFRS 項目」、英文「Not an IFRS line item」，字串放在 05 的 catalog；名詞卡說明 IFRS 的處理）；IFRS 切換在 M4b 才加入。
10. 無障礙：每一步用 `aria-live="polite"` 播報摘要；報表用真正的 table 與表頭；減少動態效果時直接顯示結果並保留文字差異表。
11. 版面：小手機一次顯示一張表（分段控制切換，恆等式摘要固定在上方）；電腦多欄並排三表。
12. 第 4 到 18 筆在介面上顯示「依課程情境推算」的旗標（沿用 M1 的資料，T33 的決定）；故事頁與關於頁標示老師的情境與金額「經陳彥宏老師授權使用」。

**不做什麼**：追蹤「這個數字從哪裡來」與 IFRS 切換（M4b）、跨模組導覽（M5）、後台。

**交付物**：報表實驗室（故事、單獨練習、自由實驗、勾稽練習、指標面板）、故事的中英敘述文字、M4a 回報。

**完成標準**：

- [ ] 18 個步驟在兩種語言都能從頭走到尾。
- [ ] 畫面上的每個數字都來自核心，沒有另外存的數字（有測試比對畫面與核心輸出）。
- [ ] 從任一步開啟「單獨練習」時，帶入的狀態等於故事在該步之前的狀態（有測試）。
- [ ] 「看分錄與 T 字帳」預設收合，展開後的分錄與核心過帳的分錄一致。
- [ ] 以 `reducedMotion: 'reduce'` 跑完整個故事並截圖比對，資訊完整。
- [ ] VoiceOver 與 TalkBack 清單包含每一步的 `aria-live` 摘要，結果正確。
- [ ] 自由實驗的限制（不得為負、最大值提示、本筆無影響）都有測試。
- [ ] 中英介面的報表都是教材版面，非 IFRS 項目都有標記（中文「非 IFRS 項目」、英文「Not an IFRS line item」）。
- [ ] 故事的敘述文字通過原創性與文案語氣檢查；授權標示正確。
- [ ] 實驗室第 7 筆在 mid-tier 節流下的互動 INP 不超過 200ms；中低階 Android 實機上動畫沒有明顯不順或掉格。
- [ ] [02 網站架構](02-site-architecture.md) 列出的所有測試尺寸都檢查過版面。
- [ ] 通過第 4 節的驗收閘門。
- [ ] 停下回報。

**開工前必須先決定**：

- D 系列都已決定：D1（科目變動以白話為主，分錄與 T 字帳預設收合）、D2（老師的情境與金額）、D10(b)（連續故事加單獨練習）、D11（教材版面加標記）、D13（W06）。
- 仍待處理：故事公司的原創名稱（D9，規劃者在 M4a 開工前提案、你確認）。實驗室相關的【待確認 T08】、【待確認 T29】、【待確認 T33】、【待確認 T35】已於 2026-10-23 依專業判斷決定，照 14 的決定實作。

**主要風險**：

- 動畫與玻璃效果在中低階手機上的效能。
- 複雜報表對螢幕閱讀器的可用性。
- 老師日後對第 4 到 18 筆的回饋改變故事內容：資料與核心分離，只改資料。

### 11.2 M4b 報表實驗室：追蹤與 IFRS 切換

**目標**：讓學生點任何數字都能看到「這個數字從哪裡來」，並能把實驗室切換到整套 IFRS 對照（不計分）。

**範圍**：

1. 追蹤（D10(c) 選 A 完整公式樹與來源分錄，選項定義見 03 評估 3）：可追蹤的數字有虛線底線，點一下或聚焦後按 Enter 開啟「來源」面板（手機是底部面板、電腦是側邊面板，`role="dialog"`，Esc 關閉，焦點回到原本的數字）。公式一層一層展開，最底層列出來源步驟；公式跨表時（例如未分配盈餘和本期淨利）標出另一張表的對應數字。資料都來自 M1 核心輸出的 `sources` 與版面公式。介面細節見 03 第 3.9 節。
2. 來源分錄（D1）：最底層的來源分錄放在可展開的分錄層，預設收合。
3. IFRS 切換（D10(f) 選 C）：實作 `ifrs@1` 認列政策與版面（例如設立費在發生時費用化、不攤銷，現金流量也從投資活動移到營業活動；細節見 04）。實驗室的故事與自由實驗可以切換整套 IFRS 三表與指標；IFRS 畫面明確標示「IFRS 對照，不計分」；`ifrs@1` 標示依據的準則版本（IFRS 18 的影響見 [11 風險與授權](11-risks-license.md) 第 2.1 節）。闖關區一律以教材口徑計分，不顯示 IFRS 數字。
4. 預設與切換（D11）：中英預設都是教材版面；切到 IFRS 是使用者的動作，切換時以 `aria-live` 播報目前的口徑；IFRS 對照下開啟來源面板時，面板也標示目前是 IFRS 口徑。
5. 黃金測試：`ifrs@1` 的黃金測試使用自編數字並 commit；故事資料在 `ifrs@1` 下也要通過性質測試。

**不做什麼**：闖關區的 IFRS 題目或 IFRS 計分、跨模組導覽（M5）、後台。

**交付物**：來源面板、`ifrs@1` 政策與版面、IFRS 的黃金測試、M4b 回報。

**完成標準**：

- [ ] 三表上每個可追蹤的數字都能展開到來源步驟；公式樹每一層的數字都和核心輸出一致（有測試）。
- [ ] 來源分錄層預設收合；展開後的分錄和核心過帳的分錄一致。
- [ ] 來源面板可以只用鍵盤操作（Enter 開啟、Esc 關閉、焦點回到原數字）；VoiceOver 與 TalkBack 唸出每一層的公式與數字。
- [ ] 小手機（320px）上的多層展開可用，沒有整頁橫向捲動。
- [ ] `ifrs@1` 的黃金測試（自編數字）通過；故事資料在 `ifrs@1` 下通過性質測試。
- [ ] IFRS 畫面一律顯示「IFRS 對照，不計分」；計分題的 `scenario.policy` 只允許 `teacher@1`（CI 檢查）；切換 IFRS 不影響任何計分與錯題紀錄（有測試）。
- [ ] 英文與中文介面的預設仍是教材版面；直接開啟故事步驟的網址時一律是教材版面（M5 的 `labRef` 深連結也走這條規則）。
- [ ] 通過第 4 節的驗收閘門。
- [ ] 停下回報。

**開工前必須先決定**：

- D 系列都已決定：D10(c)（A 完整公式樹與來源分錄）、D1（來源分錄放在可展開的分錄層）、D10(f)（C 完整切換，不計分）、D11（預設教材版面）。
- 【待確認 T04】【待確認 T05】已決定（2026-10-23）：教材口徑一側照課程政策（資本化、五年攤銷、攤銷列營業外支出），IFRS 一側於發生時費用化（IAS 38.69）；畫面以「設計說明」連到 14。實作 IFRS 說明前要先核對 IFRS 18 對 IAS 7 的修正（見 11 第 2.1 節）。

**主要風險**：

- 小手機上的多層展開介面複雜：一次只展開一層並保留返回路徑，先在 320px 寬度驗證。
- 學生把 IFRS 數字當成教材口徑的答案：標示、預設教材版面、闖關區不顯示 IFRS 數字（見 [11 風險與授權](11-risks-license.md) 第 2 節）。
- 兩套政策都要維護與測試：黃金測試分開維護，老師若對 T04、T05 有回饋，只改教材口徑一側的資料。

## 12. M5 跨模組導覽

**目標**：串起闖關區與實驗室，讓答錯的同學一鍵看到對應交易的動畫，看完再回到題目。

**範圍**：

1. `labRef` 深連結：答錯時開啟對應的步驟（`/lab/story/<storyId>/<stepId>/`，英文介面是 `/en/lab/story/<storyId>/<stepId>/`），並帶入交易前的狀態；這和 M4a 的「單獨練習」共用同一個能力（D10(b)）。
2. 從實驗室回到題目時，保留作答狀態與捲動位置。
3. 實驗室章末連到相關關卡。
4. 確認名詞卡在兩個模組開的是同一張（M2 起就是單一來源，這裡只驗證）。
5. 顯示 M2 起已填好 `labRef` 的「看動畫」按鈕。

**不做什麼**：新的題型或新的實驗室功能。

**交付物**：跨模組導覽、M5 回報。

**完成標準**：

- [ ] CI 檢查每個 `labRef` 都指向存在的故事步驟 ID（`st_` 開頭，格式見 08 第 4.1 節）；交易影響題都有 `labRef`，或明確標示不需要。
- [ ] E2E：答錯，開啟實驗室對應步驟，交易前的狀態正確，返回後作答狀態與捲動位置保留；中文與 `/en/` 兩種網址各走一次，語言不會在跳轉中改變。
- [ ] 離線時跨模組導覽仍然可用。
- [ ] 步驟下架時，連結導向替代步驟或故事該章的開頭。
- [ ] 通過第 4 節的驗收閘門。
- [ ] 停下回報。

**開工前必須先決定**：沒有新的決定，沿用 M2 與 M4a 的設計（D5 的網址、D10(b) 的帶入狀態）。M5 不依賴 M4b，若 M4b 遇到阻礙，可以由你決定先做 M5。

**主要風險**：內容改版（`rev` 改變）後，舊的錯題紀錄帶入的狀態和新版內容不一致：以 `id` 加 `rev` 判斷，不一致時提示「題目已更新」。

## 13. M6 題庫匯入

**目標**：讓不寫程式的人用 Excel 維護文字型題目與名詞，再匯入並經過同一套驗證（D10(d)）。

**範圍**（設計見 [08 題庫與後台](08-content-admin.md)）：

1. 範本：由 Zod schema 自動產生 xlsx 與 CSV 範本（欄位說明、下拉選單、中英範例列、範本版本號）。只涵蓋文字型的題目與名詞；含 scenario 的計算題、交易範本與故事仍維護在 JSON。`multi_choice` 的題目有「判分方式」下拉欄（`any_correct`、`all_correct`，欄位說明寫出兩種方式的差別與學習端提示，D12）；狀態欄只有 draft、published、retired（D10(g)）。
2. 本機匯入指令：解析用 read-excel-file 或 SheetJS 0.20.3 的 vendored tarball；CSV 用 papaparse 並處理 Big5。不可以 `npm i xlsx`（見 [09 技術選擇](09-tech-stack.md)）。
3. 錯誤報告：「工作表、列、欄、訊息、建議修正」。
4. 預覽：使用學習端同一套元件（`packages/web-ui`）。
5. 確認前顯示新增、修改、下架的差異摘要；改動「判分方式」或正解的列標為答案改版（`revKind: answer`）；確認後寫入正規化模型，再跑 `content:check`。
6. 瀏覽器匯入頁（老師要自己操作時才加）：只產出檔案、不上傳到任何伺服器，放在後台的獨立 origin，和學習端完全分開；產出的檔案由你檢查後再進 repo。

**不做什麼**：管理後台（M7）、帳號系統、含 scenario 的計算題與故事的試算表維護。未採用的做法：Google Sheets 經 API 轉 PR、PR 上的 GitHub Action 匯入（匯入檔會留在公開歷史）。

**交付物**：範本、本機匯入指令、M6 回報；老師要自己操作時，另加瀏覽器匯入頁。

**完成標準**：

- [ ] 來回測試：產生範本、填入範例、匯入後 `content:check` 通過。
- [ ] 格式錯誤的工作表會產生指出列與欄的錯誤報告（有測試）。
- [ ] Big5 編碼的 CSV 能正確讀取（有測試）。
- [ ] 「判分方式」欄的值正確對應 `scoringMode`；`multi_choice` 少於兩個正解、缺少判分方式時，錯誤報告指出列與欄（有測試）。
- [ ] 狀態欄只接受 draft、published、retired（有測試）。
- [ ] lockfile 中沒有 npm 上的 `xlsx`（CI 檢查）。
- [ ] 匯入相關的函式庫不出現在學習端的 bundle（體積預算檢查）。
- [ ] 若加了瀏覽器匯入頁：放在後台的獨立 origin，檔案只在瀏覽器內處理、沒有任何上傳請求（有測試），並通過第 4 節的驗收閘門。
- [ ] 停下回報。

**開工前必須先決定**：

- D 系列都已決定：D10(d)（Excel 範本與本機匯入指令）、D10(g)（沒有 review 狀態）、D12（「判分方式」欄）。
- 仍待處理：SheetJS CE 0.20.3 能否寫入帶下拉選單的 xlsx（查證後決定用哪一個函式庫產生範本）；老師是否要自己操作（決定要不要做瀏覽器匯入頁，見【待確認 T34】第 (3) 問）。

**主要風險**：試算表的格式差異（合併儲存格、日期格式）；雙語表格很寬，維護者對流程的熟悉度；瀏覽器匯入頁若在 M7 之前就要做，後台的獨立 origin 要提前建立。

## 14. M7 管理後台

**目標**：讓管理者在後台新增、編輯、預覽、發布、下架與還原題目（D10(e)）。

**範圍**（比較與設計見 [08 題庫與後台](08-content-admin.md)）：

1. 平台：Cloudflare Access 加 Workers 加 D1，和學習端的主機同一家；後台放在獨立的 origin（子網域在 M7 開工時提出、由你確認），有自己的 CSP。
2. 驗證與權限：Access 在邊緣驗證管理者；Worker 以 Access 團隊的 JWKS 驗證 `Cf-Access-Jwt-Assertion`（金鑰會輪替，不寫死），再查 D1 的角色表；所有權限檢查都在伺服器端，不靠隱藏按鈕。兩步驟驗證：Access 的獨立兩步驟驗證在免費方案能否使用仍待實測（【待實測 V10】），不行就改用 IdP 本身的兩步驟驗證，並在 M7 開工前回報。
3. 內容與狀態：草稿與內容存在 D1，草稿不進公開 repo；狀態只有 draft、published、retired（D10(g)）。
4. 版本紀錄與還原：D1 的 revisions 表記錄每次修改，可以還原任一版本；D1 Time Travel 只當災難還原。
5. 表單：使用 `packages/content-schema` 的同一份 schema；`multi_choice` 的判分方式用單選按鈕區分，附說明文字與學習端提示的即時預覽（D12）；預覽使用學習端同一套元件（`packages/web-ui`）。
6. 發布：輸出靜態快照，通過 `content:check` 後輸出到 git（commit 或 release 附件），學習端照常建置與部署；學習端只讀快照，不放任何登入元件，也不呼叫後台。
7. M6 的瀏覽器匯入頁若已經做了，放在同一個後台 origin。
8. 程式位置：已決定（2026-10-20）：M7 建立 `apps/admin`，放後台前端與 Worker、D1 migration，以及自己的 `apps/admin/wrangler.jsonc`（和學習端的 `ledgerland` 是不同的 Worker）；預覽與表單元件使用 `packages/web-ui`，介面字串同樣合併 `web-ui` 的字串檔；依賴 `packages/web-ui`、`packages/quiz`、`packages/core`、`packages/content-schema`、`packages/i18n`、`packages/tokens`。

**不做什麼**：學習者帳號、學習端的線上同步、不重新部署就發布的遠端快照來源。未採用的方案（比較過）：Git-based CMS（Sveltia、Decap）、Supabase、Firebase、自架後端。

**交付物**：後台（`apps/admin`）、Worker API 與 D1 schema（含 migration）、權限與發布流程的文件、M7 回報。

**完成標準**：

- [ ] 所有管理者都必須通過兩步驟驗證（Access 的獨立兩步驟驗證；V10 不可行時用 IdP 的兩步驟驗證，並已在 M7 開工前回報）。
- [ ] Worker 對每個寫入請求驗證 Access 的 JWT（簽章、`aud`、到期時間），再查 D1 的角色表；沒有 JWT、JWT 無效或角色不符時拒絕（有測試）。
- [ ] 以非管理者身分嘗試寫入會被伺服器端拒絕（有測試）。
- [ ] 草稿只存在 D1，不出現在學習端快照，也不出現在公開 repo。
- [ ] 發布產生的快照通過 `content:check`；可以從 revisions 表還原任一版本並重新發布（有測試）；用 Time Travel 做過一次災難還原的演練。
- [ ] 後台停機時，學習端完全不受影響（有測試）。
- [ ] 後台的 origin 獨立，並有自己的 CSP；學習端的 bundle 沒有任何驗證元件（CI 檢查）。
- [ ] `multi_choice` 表單的判分方式單選按鈕與學習端提示的即時預覽正確。
- [ ] 秘密只放在 Worker secrets 或 GitHub Actions secrets，沒有 `VITE_` 前綴的秘密（CI 檢查）。
- [ ] 通過第 4 節的驗收閘門，並完成一次安全檢查。
- [ ] 停下回報。

**開工前必須先決定**：

- D 系列都已決定：D10(e)（Cloudflare Access 加 Workers 加 D1）、D10(g)（沒有 review 狀態）、D3（repo 公開，所以草稿只存在 D1）、D4（同一家主機）、D12（判分方式的表單）。
- 仍待處理：【待實測 V10】的結果；後台的子網域；老師是否會自己操作後台（【待確認 T34】第 (3) 問）。【待實測 V16】原本只服務 Git-based 後台，D10(e) 不採用後不再是 M7 的前提。

**主要風險**：Worker API 與後台介面都要自己寫，單人維運的負擔；V10 不可行時兩步驟驗證要改走 IdP；學習端主機、DNS、統計與後台都在 Cloudflare，供應商集中的風險見 [11 風險與授權](11-risks-license.md) 第 2 節。

## 15. M8 公開上線

**目標**：在取得老師對公開網站與致謝方式的同意之後，正式對外宣布網站。repo 依 D3 從 M0b 起就是公開的，網站也從 M2 起就在正式網域上試用，所以 M8 是定稿、總稽核與正式宣布，而不是第一次公開。

**範圍**：

1. 致謝（【待確認 T34】）：故事情境與金額已同意（2026-10-20，經你轉達）；公開網站與開源依 D3、D6 進行，不另外徵求同意（2026-10-23 的決定）；關於頁與 README 具名致謝陳彥宏老師的文字與位置，以老師看過的版本定稿（D6），這是唯一要請老師看一眼的事。
2. 授權（D6）：M0b 建立的 `LICENSE`（MIT）、`LICENSES/CC-BY-SA-4.0.txt`、README 的授權表與「名稱與標誌」一節、THIRD_PARTY_NOTICES，和目前的路徑與相依套件一致；老師的故事情境與金額標示「經陳彥宏老師授權使用」，不在 CC 授權內（見 [11 風險與授權](11-risks-license.md) 第 4 節）。
3. 正式網域 `ledgerland.swift.moe` 的 HTTPS 與安全標頭最終確認（D4）；是否加 `Strict-Transport-Security` 在這裡定案（見 09 第 11.2 節）。
4. 流量統計（D7，M0b 起已建置）：確認 CSP、隱私說明頁與實際收集的內容一致。
5. 整個 git 歷史的總稽核（D3）：確認所有分支從來沒有 commit 過 `references/`、教材檔案（`.pdf`、`.xlsx`）、`docs/plan/01-materials.md`、`docs/plan/13-material-questions.md` 與 AI 設定路徑。若發現問題，停下回報，改寫歷史前一定先取得你的同意。
6. 名稱：模組全名與 Tab 短名照 D9；查詢「LedgerLand」與「會計樂園」是否與既有商標衝突，結果寫進回報。
7. 隱私說明頁（含流量統計與 App 內掃描 QR 的相機用途）、關於與授權頁定稿；README 與 CONTRIBUTING 定稿。
8. 最終稽核：完整的無障礙檢查（axe 加兩個平台的螢幕閱讀器）、實機效能（含 iOS 17 裝置）、CSP 與安全標頭、內容相似度與台灣用語掃描、介面上所有「設計說明」與「依課程情境推算」的標記依老師的回饋更新或保留。
9. 課堂用的 QR code 一律使用正式網域（M2 起就是如此），這裡再抽查一次。

**不做什麼**：新功能。

**交付物**：正式公開的網站、最終稽核報告、M8 回報。

**完成標準**：

- [ ] 具名致謝的文字與位置已請老師看過，並反映在關於頁與 README。
- [ ] 授權檔、內容授權、老師素材的授權標示與 THIRD_PARTY_NOTICES 都和目前的內容一致。
- [ ] 正式網域的 HTTPS、CSP 與安全標頭都通過檢查。
- [ ] 整個 git 歷史的稽核結果（`git log --all --name-only` 比對 `references/`、`.pdf`、`.xlsx`、`.DS_Store`、`01-materials.md`、`13-material-questions.md` 與 AI 設定路徑）已附在回報中，結果是空的。
- [ ] 商標檢索的結果已記錄。
- [ ] 第 4 節的驗收閘門全部通過，實機效能符合目標。
- [ ] 所有已發布內容通過相似度檢查與用語掃描。
- [ ] 介面上的「依課程情境推算」標記都已依老師的回饋更新，或保留並在關於頁說明。
- [ ] 停下回報。

**開工前必須先決定**：

- D 系列都已決定：D3（repo 公開）、D4（正式網域與主機）、D6（授權與具名致謝）、D7（流量統計）、D9（名稱）、D11（英文介面用教材版面與英式拼字）。
- 仍待處理：【待確認 T34】的致謝文字與位置（請老師看一眼）；商標檢索；`Strict-Transport-Security` 是否加。

**主要風險**：

- 老師不同意公開網站或要求調整致謝：致謝與老師素材集中在關於頁、README 與故事資料，可以一次修改；但已經 push 的內容會留在公開歷史，見 [11 風險與授權](11-risks-license.md) 第 2 節第 20 列。
- 公開 repo 的歷史無法撤回：靠 M0b 起每次 push 前的檢查，加上這裡的總稽核。
- 準則變動（例如 IFRS 18）讓部分用語或分類需要加註，見 [11 風險與授權](11-risks-license.md)。

---

## 16. 決策與實測的時程對照

**D 系列（2026-10-20 全部已決定）**：

| 編號 | 內容 | 已決定 | 落在哪些里程碑 |
| --- | --- | --- | --- |
| D1 | 借貸分錄的範圍 | (b) 延伸層：主線跟著教材倒推法，另設「借貸與分錄」延伸章（不列入期中考範圍） | M1（schema）、M3（延伸章）、M4a（分錄與 T 字帳預設收合）、M4b（來源分錄層） |
| D2 | 故事數字 | B：照老師的情境與金額（老師已同意），敘述文字原創 | M1（故事資料與性質測試）、M4a |
| D3 | repo 是否公開、教材衍生內容 | repo 公開；01 與 13 留在原位、以 `.gitignore` 排除、只存在本機；不使用 `docs/private/` | M0a（試作程式放在 `prototypes/`，以 `.gitignore` 排除）、M0b（第一次 `git add` 前）、M8（總稽核） |
| D4 | 網域與主機 | `ledgerland.swift.moe`；Cloudflare Workers Static Assets；base path `/` | M0a（預覽）、M0b（部署）、M2（試用）、M7（同一家的後台） |
| D5 | 網址策略 | C：中文在根路徑、英文在 `/en/`；data mode 加 vite-plugin-pwa；先不預先產生 HTML | M0a、M0b |
| D6 | 授權與署名 | 程式碼 MIT；原創內容 CC BY-SA 4.0；老師的故事情境與金額另外標示；具名致謝（文字與位置先請老師看過）；名稱與標誌另外保留 | M0b（授權檔）、M4a（故事的授權標示）、M8（致謝定稿） |
| D7 | 流量統計 | 一開始就加入不用 cookie、不收集個資的統計 | M0b |
| D8 | iOS 17 | A：正式支援 | M0a、M0b，之後每個有介面的里程碑 |
| D9 | 名稱 | Tab 短名；模組全名沿用；故事公司取原創名稱；M8 前查商標 | M0b（Tab）、M4a 前（故事公司提案）、M8（商標） |
| D10(a) | 進度保護與課堂 QR | `persist()` 時機、備份檔加文字備份碼、匯入預設合併、關卡代號、App 內掃描 QR | M2 |
| D10(b) | 故事模式 | C：連續故事加單獨練習 | M4a、M5 |
| D10(c) | 追蹤深度 | A：完整公式樹與來源分錄 | M1（`sources`）、M4b |
| D10(d) | 試算表與上傳入口 | Excel 範本、本機匯入指令；需要時加只產出檔案的瀏覽器匯入頁 | M6 |
| D10(e) | 後台 | Cloudflare Access 加 Workers 加 D1 的資料庫型後台 | M7 |
| D10(f) | IFRS 對照 | C：完整切換，不計分 | M1（`policy` 欄位）、M4b |
| D10(g) | review 狀態 | 不設，只有 draft、published、retired | M6、M7 |
| D11 | 英文版面與拼字 | 教材版面加非 IFRS 項目標記（中文「非 IFRS 項目」、英文「Not an IFRS line item」）；英式拼字 | M2（拼字）、M4a（版面）、M4b（IFRS 切換） |
| D12 | 雙正解題 | 新增 `multi_choice`，必填 `scoringMode` | M1（schema）、M2（元件）、M6（範本欄）、M7（表單） |
| D13 | W01 到 W15 | A：全部採用，教材原字保留為可搜尋的別名 | M1（科目表）、M2（介面用語） |

**V 系列（待實測）**：

| 里程碑 | 編號 |
| --- | --- |
| M0a | V01、V02、V03、V04、V05、V06、V07、V09、V13、V14、V15、V17、V18；時間允許再做 V11、V12；V08 暫不需要（D5 採 data mode，日後改成預先產生 HTML 時才補做） |
| M0b | M0a 沒做完的事項（本機 AI 設定延到 M0b 才建立時，V17、V18 在第一次 commit 之前完成）；V12（若 Tier 2 要在 M8 前啟用） |
| M2 | V04 與 V11 的完整結果（實際試用環境）；V02、V03 在正式網域上再確認一次；V19 到 V22（2026-10-23 新增：App 內掃描的實機辨識率、主畫面 App 的相機權限、備份碼轉移、螢幕閱讀器） |
| M7 | V10（V16 不再是 M7 的前提，因為 D10(e) 不採用 Git-based 後台） |

T 系列已於 2026-10-23 依專業判斷全部決定，不再有等待回覆的時程；決定與理由見 [14 待確認](14-open-questions.md) 第 2 節，處理方式見第 5 節。

## 建議新增的待確認

以下是撰寫本文件時發現、registry 還沒有編號的事項，供統一審稿時決定是否新增：

- M0a 需要的實機清單（iOS 17、iOS 26、iOS 27 的 iPhone 機型，中低階 Android 機型）與 Cloudflare 帳號，需要你準備或提供。
- M0a 試作程式的存放位置：已決定（2026-10-20），`prototypes/m0a/`，以 `.gitignore` 排除。
- M1 的測試覆蓋率門檻、TBT 門檻、precache 體積預算等數字，要在對應里程碑開工時提出，由你確認。覆蓋率門檻已決定（2026-10-23，第 8 節）；TBT 與 precache 體積等介面門檻仍在對應里程碑開工時提出。
- M2 試用的對象與規模（同班同學、幾位志願者），會影響進度保護與 App 內掃描 QR 的急迫程度。
- App 內掃描 QR 的 JS 解碼器選型（M2 開工前查證），以及主畫面 App 的相機權限是否每次啟動都要重新詢問（未查證，需要實機確認）。
- M7 後台的子網域（獨立 origin），以及 M6 的瀏覽器匯入頁若比 M7 先做時要放在哪裡。
- 具名致謝的文字請老師看過的時程（建議和 M0b 平行進行）。
- App 的技術（Capacitor、Expo、原生）：建議 M3 完成後由你決定（第 10.1 節，14 第 5.2 節）。
- M0b 的驗證與查證事項：Lingui macroTransform 對 workspace 套件原始碼的處理（14 第 5.3 節）；pnpm 11 由專案管理 Node 版本的寫法、Cloudflare Workers 退回上一版的指令、pnpm store 放在 repo 內時 CI 快取的設定（14 第 5.4 節）。
