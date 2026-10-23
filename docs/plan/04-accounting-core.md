# 04 會計核心資料模型與內容資料格式

這份文件定義 `packages/core` 的資料模型、計算規則與對外 API，以及題目、名詞、交易範本與故事的資料格式。會計核心以複式分錄為唯一的會計事實來源，三表、財務指標、五步驟勾稽、交易影響與題目答案全部由分錄推導，和 UI 無關，可以完整測試。教材沒有明說、或和現行準則不同的處理，一律標上 14 的 T 系列編號；2026-10-23 起這些編號指向已寫下理由的設計決定（14 第 2 節），畫面顯示「設計說明」而不是「待確認」，計分不受影響。正式故事依 D2 使用老師的情境與金額，但本文件的範例與 repo 內的測試一律用自編的公司（青檸文具社）與金額，只有第 10 節為了說明 IFRS 對照的差距，引用了正式故事的推算結果。

## 確定要做

- 會計核心放在 `packages/core`，是純 TypeScript、純函式，不依賴 React、DOM、瀏覽器儲存、時間、亂數與 Intl（第 1、2 節）。已決定（2026-10-20）：核心只放會計，內部依賴只有 `packages/content-schema` 與 `packages/i18n`；選擇題與數字題的判分、分錄題計分移到 `packages/quiz`，核心保留分錄的正規化比對（第 2 節）。
- 分錄是唯一儲存的會計事實。餘額、三表、指標、勾稽、`effects` 與題目答案都是推導值，不另外儲存（第 1 節）。
- 金額是安全整數，scale 宣告在帳本（情境）層級，TWD 為 0；中間運算用精確有理數；四捨五入只在具名推導值中做一次，規則與 Excel 的 ROUND 相同（第 3 節）。
- 科目表以老師的 Excel 模板為底：穩定 ID、教材用語為主要顯示、現行台灣用語與 IFRS 英文為別名，並記錄要素、正常餘額、流動性、抵銷科目、模板列、旗標（含 `ifrs_treatment_differs`）與故事用途。模板的標題列與公式列不是科目，不可入帳（第 4 節）。
- 存貨採永續盤存內帳，教材版面由內帳推導。「賣出全部存貨」的成本讀帳上餘額；盤點範本以盤點後金額 `countedAmount` 為參數，盤盈預設沖減營業成本【待確認 T06】（第 5 節）。
- 分錄驗證、過帳快照、變動量與白話的 `effects`（第 6 節）。
- 交易範本 schema 包含 `params`、`derived`、`preconditions`、逐條帶現金流量標籤的 `lines`、說明與名詞參照；故事步驟與範本分開，一步可以有多個事件（第 7、9 節）。
- 受控運算式採白名單文法，建置時解析成 AST 並做型別檢查，執行時只走訪 AST，不使用 eval（第 8 節）。
- 認列政策 `policy` 與表達版面 `layout` 分成兩層。M1 只實作 `teacher@1`，schema 保留 `policy` 欄位與 `policyWhen`；M4b 實作 `ifrs@1` 政策與 `ifrs@1` 版面並加上自編數字的黃金測試，實驗室可以切換整套 IFRS 三表與指標，畫面標示「IFRS 對照，不計分」，闖關區一律以 `teacher@1` 計分（已決定 D10(f)，評估一、第 10 節）。
- 教材版面三表：損益表五層利益、資產負債表、間接法現金流量表（H10 到 H41 每一列都有來源規則）。另外計算直接法，並以「間接法營業活動＝直接法營業活動」為不變式（第 11 節）。
- 財務指標登錄檔採「一個指標、多個版本」（`excel`、`slides03`、`slides02`、`dupont`、`slides01`）。計分題必須填 `ratioRef`，計分只看題目指定的版本（第 12 節）。
- 指標狀態的判定順序是 na、not_meaningful、zero、ok；另有連鎖指標規則、-0 與 `signDisplay` 規則，正解為 N/A 的題目用 `acceptStatus`（第 12.6 節）。
- 五步驟檢查 API：步驟①回傳五層利益，步驟②到⑤回傳兩邊數值與差額，字母 A 到 D 只當顯示別名（第 13 節）。
- 計算型題目用 `scenario` 描述，答案在建置時由核心算出，寫入發布快照與 `published.lock.json`（第 15 節）。
- 測試分五類：單元測試、性質測試（含以老師金額編成的正式故事，只斷言不變式，不寫期望值）、自編數字的黃金測試（`teacher@1` 與 `ifrs@1` 兩套）、內容編譯測試，以及只在本機執行、不用 snapshot 的老師 Excel 驗證 `*.local.test.ts`。repo 內的測試不寫入老師的金額（已決定 D2，第 18 節）。
- 附中英雙語的最低範例集，每個 JSON 範例都要能通過 schema 驗證與 `content:compile`；範例包含 `multi_choice` 的兩種判分方式與延伸章的分錄題（第 17 節）。
- 題目、名詞、交易範本與故事的 ID 格式以 [08 題庫管理](08-content-admin.md) 第 4.1 節的前綴表為準（章節 `ch_`、學習目標 `obj_`、關卡 `lv_`、題目 `q_`、名詞 `tm_`、故事 `story_`、故事步驟 `st_`、選項 `o_`、分類項目 `it_`、迷思 `mc_`）；交易範本用 `tpl.` 前綴的語意 ID（例如 `tpl.sell_all_inventory_cash`），與 08 相同。題型代號一律 snake_case（`single_choice`、`true_false`、`transaction_effect`、`ratio_numeric` 等），題幹欄位是 `prompt`（是非題用 `statement`），題目自帶的數字放在 `vars`；04 與 08 的題型代號與欄位名稱一致（第 16 節）。本文件另外定義會計語意（`scenario`、`ratioRef`、policy、受控運算式、推導值）；仍待跨文件同步的少數欄位整理在第 20 節。
- 借貸分錄採延伸層（已決定 D1，2026-10-20，評估二）：核心內部一律以分錄過帳，M1 不受影響；實驗室「科目變動」那一步以白話的 `effects` 為主，「看分錄與 T 字帳」預設收合（第 6.5 節）；`journal_entry` 題型只用在「借貸與分錄」延伸章（不列入期中考範圍），計分依第 14 節；設立費、盤盈、攤銷在老師確認前不出分錄題。
- 正式故事按照老師的情境與金額（已決定 D2，老師已同意公開）：公司名稱原創，由規劃者在 M4 前提案、你確認（D9）；故事的敘述文字以網站自己的話撰寫，第 12 筆等疑似誤植依 13 的建議處理並在交易卡加註；情境不夠時（延伸章、自由實驗、故事沒有涵蓋的交易）另建原創情境（第 9 節）。
- 故事以連續故事為主線，每一步另有「單獨練習」入口，沿用故事在該步之前的狀態（已決定 D10(b)，第 9.1 節）。
- 追蹤深度採 A 完整公式樹與來源分錄（已決定 D10(c)，評估三）：核心從 M1 起輸出追蹤樹，任一報表數字可以一層一層展開到公式、科目，最底層列出來源步驟、事件與分錄行；來源分錄放在可展開的分錄層。畫面在 M4b 實作（第 6.4 節）。
- 中英兩種介面都用教材版面，非 IFRS 項目在兩種介面都加標記（中文「非 IFRS 項目」、英文「Not an IFRS line item」，字串放在 05 的 catalog），可隨時切到 IFRS 對照；英文拼字用英式，美式拼法列為英文搜尋別名（已決定 D11，評估六、第 16.3 節）。
- 新增多正解題型 `multi_choice`（已決定 D12，評估五）：`correctOptionIds` 至少兩個，必填 `scoringMode`（`any_correct` 或 `all_correct`），不給部分分數；`scoringMode` 與 `correctOptionIds` 列入 `answerHash`，改動任一個都是答案改版；M2 與單選題共用元件實作（第 16.2、17.10 節）。
- W01 到 W15 全部採用（已決定 D13，評估七）：科目表與版面的顯示字照 W 系列修改，教材原字一律保留為可搜尋的別名；「短期放貨」已決定（2026-10-23，【待確認 T09】）比照 W 系列以「短期放款」為主要顯示、原字為別名並帶 `typo_fixed`；利息三列依【待確認 T11】的決定改為清楚的寫法、教材原字為別名（第 4、11 節）。
- 內容狀態只有 `draft`、`published`、`retired`，不設 review（已決定 D10(g)，第 7、16.2 節）。

## 需評估

只剩評估四（多期資料與年報口徑的平均餘額，registry 沒有 D 編號）仍需評估。評估一、二、三、五、六、七已在 2026-10-20 由你決定，結果已寫進上面的「確定要做」；下面保留各項的決定紀錄、濃縮後的取捨與未採用的理由，標題標示「已決定」。

### 評估一：IFRS 對照模式（已決定 D10(f)）

已決定（D10(f)，2026-10-20）：C 完整切換。實驗室可以切換整套 IFRS 三表與指標，不計分。M1 只在 schema 保留 `policy` 欄位與 `policyWhen`；M4b 實作 `ifrs@1` 政策與 `ifrs@1` 版面，並以自編數字加上黃金測試（第 10.3、18.2 節）。切到 IFRS 時畫面明確標示「IFRS 對照，不計分」；闖關區的題目一律以教材口徑 `teacher@1` 計分。

IFRS 和教材的差異在「認列」，不只是版面：設立費依 IAS 38.69 應在發生時費用化、之後不攤銷，現金流量也從投資活動移到營業活動；經常利益與非常損益在 IFRS 下不存在。同一本帳換版面算不出 IFRS 的數字，必須用另一套認列政策重算（第 10.3 節列出 `ifrs@1` 的設定與差距）。

| 選項 | 內容 | 優點 | 缺點與風險 | 成本 |
| --- | --- | --- | --- | --- |
| A 不做 | 只在名詞卡與解說用文字說明差異 | 不會讓學生混淆計分口徑 | 看不到金額差距；英文使用者對照 IFRS 財報時落差大 | 無 |
| B 靜態對照 | 實作 `ifrs@1` policy，但只在建置期使用：替受影響的交易卡與名詞卡算出差額，畫面不提供整套切換 | 差額由核心算出，數字可信；範圍小 | 只看得到差額，看不到整套 IFRS 三表 | 小 |
| C 完整切換（採用） | 實作 `ifrs@1` policy 與 `ifrs@1` layout，實驗室可切換整套三表與指標（不計分） | 最完整；英文介面可以直接對照 IFRS（D11） | 兩套政策都要維護與測試；學生可能拿 IFRS 數字去答教材口徑的題目；版面要處理經常利益與非常損益消失 | 中 |

未採用的選項：A（看不到金額差距，英文使用者對照 IFRS 財報時落差大）；B（只看得到差額，不能支援 D11 的「英文使用者可隨時切到 IFRS 對照」）。

C 的風險與對策：
- 兩套政策都要維護：`ifrs@1` 只改設立費與版面（第 10.3 節），其他開關沿用 `teacher@1`；兩套各有一份自編數字的黃金測試，性質測試對兩套政策都跑。
- 學生拿 IFRS 數字答題：計分題的 `scenario.policy` 只允許 `teacher@1`（第 15.1 節），IFRS 對照的結果不進任何計分流程；畫面固定標示「IFRS 對照，不計分」。
- 經常利益與非常損益消失：`ifrs@1` 版面不含這兩層，五步驟的步驟①在 IFRS 對照中回傳 `ordinaryIncome: null`（第 13 節）。
- 老師對 T04、T05 的回覆只影響教材口徑一側（`teacher@1` 的設立費與攤銷處理），`ifrs@1` 一側不受影響。

### 評估二：借貸分錄在核心以外要露出多少（已決定 D1）

已決定（D1，2026-10-20）：(b) 延伸層。主線跟著教材「從財報倒推」的方法；另設「借貸與分錄」延伸章，不列入期中考範圍；實驗室「科目變動」那一步以白話的 `effects` 為主，「看分錄與 T 字帳」預設收合；`journal_entry` 題型只用在延伸章；設立費、盤盈、攤銷在老師確認前不出分錄題。

核心一定用分錄過帳，這一題決定的是「分錄要不要給學生看、要不要出分錄題」。

| 選項 | 內容 | 優點 | 缺點與風險 | 成本 |
| --- | --- | --- | --- | --- |
| (a) 不做 | 實驗室只顯示白話的 `effects`；不出分錄題 | 完全跟隨教材「從財報倒推」的方法 | 與你需求中「分錄 → 帳戶」的動畫起點、以及借貸分錄題型不符 | 最低 |
| (b) 延伸層（採用） | 實驗室可展開分錄與 T 字帳（預設收合）；闖關區另設延伸章，不列入期中考範圍；分錄題依第 14 節計分 | 滿足需求又不和課程主線衝突 | 內帳是永續盤存，分錄寫「借 存貨」，和教材版面的「本期進貨」不同，需要解說；涉及待確認做法的事件（設立費、盤盈、攤銷）在老師確認前不出分錄題 | 中 |
| (c) 主線 | 分錄是每一步的必經步驟，可以先預測借貸方向 | 會計系傳統學法，分錄功力最紮實 | 與教材方法相反；對非本科學生負擔較重；原創內容量最大 | 最高 |

未採用的選項：(a)（不符合需求中的分錄題型與「分錄 → 帳戶」動畫起點）；(c)（與教材的教學順序相反，每章都要補借貸教學，工作量最大）。

對核心與資料格式的影響：
- 三個選項的核心都一樣，M1 不增加工作。`effects` 是「科目變動」那一步的主要內容；展開「看分錄與 T 字帳」時，畫面取同一步的 `PostedStep.entries` 與 `buildTAccounts` 的結果（第 2、6.5 節）。
- validator 只允許 `journal_entry` 題目屬於 `scope: "extension"`、`examScope: "not_in_exam"` 的「借貸與分錄」延伸章（章節欄位見 08 第 3.3 節，規則對應 08 的 `ans.journalScope`）；主線章節出現分錄題時建置失敗。
- `entryQuestionBlockedBy` 機制保留，但 2026-10-23 起沒有範本使用：第 5 筆設立費、第 16 筆盤盈、第 17 筆攤銷已依【待確認 T04】【待確認 T05】【待確認 T06】的決定處理，可以出分錄題；只有日後真正懸而未決的做法才填（第 14 節）。
- 延伸章的教學卡要說明內帳的永續盤存分錄（借記存貨）和教材版面「本期進貨、期末存貨」的對應（第 5.2 節）。

### 評估三：「這個數字從哪裡來」的追蹤深度（已決定 D10(c)）

已決定（D10(c)，2026-10-20）：A 完整公式樹與來源分錄。任一報表數字可以一層一層展開到公式、科目，最底層列出來源步驟；因為 D1 選 (b)，來源分錄放在可展開的分錄層（預設收合，和實驗室的「看分錄與 T 字帳」一致）。M4 拆成兩個小階段：M4a 做故事、動畫、預測、自由實驗與勾稽練習；M4b 做追蹤（完整公式樹）與 IFRS 切換（D10(f)）。

選項的代號、名稱與定義和 [03 模組](03-modules.md) 評估 3 相同。

| 選項 | 內容 | 優點 | 缺點與風險 | 成本 |
| --- | --- | --- | --- | --- |
| A 完整公式樹與來源分錄（採用） | 任一報表數字可以一層一層展開到公式、科目，最底層列出來源步驟與分錄行 | 最能回答「從哪裡來」 | 手機畫面空間有限，多層展開的介面最複雜；解說負擔重 | 高（核心資料在 M1 備妥，成本在介面） |
| B 只做跨表勾稽連結 | 只連結 R33 與 H11、R35 與 N26、H41 與 L12 等跨表關係，點一下另一張表的對應數字會以醒目標示 | 簡單、貼近五步驟 | 看不到同一張表內的公式，也看不到科目層的來源與是哪幾步造成的 | 低 |
| C 折衷：跨表連結加一層公式 | B 的跨表連結，加上「一層公式」與「哪幾步讓這個數字改變」的清單（不顯示分錄） | 涵蓋大部分初學者的疑問 | 比 B 多一層介面；完整公式樹仍要日後再做 | 低到中 |

未採用的選項：B（看不到同一張表內的公式與科目層的來源）；C（只展開一層，完整公式樹仍要日後再做；03 原本建議 M4 直接做 C，已改以 A 為準）。

對核心的要求：追蹤資料必須足以畫出完整公式樹與來源分錄，不能只是「科目加變動量」的平面清單。核心從 M1 起提供 `traceLine`（第 2 節），回傳的追蹤樹依版面列的種類分層：公式列展開成它引用的列，跨表連結列指向來源列，科目列展開成科目，最底層是來源步驟、事件與分錄行 ID（第 6.4 節）。M4b 的畫面只讀這棵樹，不需要回頭改資料模型；手機上怎麼逐層展開依 03 與 07。

### 評估四：多期資料與年報口徑的平均餘額

`slides03` 版的許多公式用平均餘額，允當比率用五年合計。教材故事是自成立起的單一期間，目前規則是 `avg()` 以期末數代替，並在結果加上 `single_period_approx` 標記。

| 選項 | 內容 | 優點 | 缺點與風險 | 成本 |
| --- | --- | --- | --- | --- |
| A 維持單期 | 照目前規則，平均以期末代替並標示 | 與老師 Excel 一致；模型最單純 | `slides03` 版在單期下只是近似 | 無 |
| B 情境可提供上期餘額 | 題目或實驗室情境可輸入「上期期末餘額」，只供指標計算使用，不建立多期帳本 | 依 0-3 改寫的計算題可以真的算平均 | 上期餘額是輸入值，不是由分錄推導；要防止前後不一致 | 小 |
| C 完整多期帳本 | 加入年度結帳（損益結轉未分配盈餘）、期初餘額帶入下期 | 可教多年度分析、五年合計 | 牽動故事、版面、勾稽與 UI；教材沒有這部分 | 高 |

建議：M1 到 M4b 用 A；若依 0-3 改寫的計算題需要平均餘額，再加 B；C 等確定要教多年度分析時才考慮。registry 沒有這一題的 D 編號，也不新增編號，和其他未編號事項一起列在第 20 節與 14 第 5 節，由你決定。

### 評估五：多正解題的資料格式（已決定 D12）

已決定（D12，2026-10-20）：B，新增多正解題型 `multi_choice`。至少要有兩個正確選項；只有一個正解的題目仍用 `single_choice`。每一題必填判分方式 `scoringMode`：
- `any_correct`（任一正確答案即可）：單選介面，學生只選一個選項，選中 `correctOptionIds` 中任一個即答對。學習端提示「這題有不只一個合理答案，選出任一個即可。」
- `all_correct`（須完整選出所有正確答案）：核取方塊可複選，按「確認答案」後才判分；必須選出全部正確選項、而且沒有選到錯誤選項才答對。學習端提示「選出所有正確答案（可複選）。」提示不透露正確答案的數量。

| 選項 | 內容 | 優點 | 缺點 | 成本 |
| --- | --- | --- | --- | --- |
| A 改寫成單一正解 | 改寫題目，使只有一個合理答案 | 不用改 schema；計分規則單純 | 失去「兩個都合理」的討論空間 | 無 |
| B 新增多選題型（採用） | 新增 `multi_choice`，選項格式同 `single_choice`，正解欄位 `correctOptionIds`，加上必填的 `scoringMode` | 保留「不只一個合理答案」的題目結構 | schema、計分、錯題本、作答 UI 都要多一種 | 中 |

未採用的選項：A（改寫成單一正解會失去「不只一個合理答案」的教學價值）。

對資料格式與計分的影響（第 16.2、17.10 節）：
- 作答後每個選項都顯示自己的 `feedback`，並標出全部正確答案；兩種判分方式都不給部分分數。
- 提示文字是固定的介面字串，依 `scoringMode` 選用，放在選項群組的標題（fieldset 的 legend）中讓螢幕閱讀器先唸出；題目資料不另寫提示。
- 改動 `scoringMode` 或 `correctOptionIds` 屬於答案改版（`revKind: "answer"`），兩者都列入 `answerHash`（第 15.3 節）。
- 後台以單選按鈕區分兩種判分方式，附說明與學習端提示的即時預覽；Excel 範本加「判分方式」下拉欄位（見 08）。教材中標示兩個選項都對的那類題目，改寫時以 `any_correct` 呈現。
- M2 與單選題共用選項元件一起實作。

### 評估六：英文介面的報表預設版面與拼字（已決定 D11）

已決定（D11，2026-10-20）：版面 A，中英都用教材版面，IFRS 沒有或禁止的項目在中英兩種介面都加標記（中文「非 IFRS 項目」、英文「Not an IFRS line item」），英文使用者可隨時切到 IFRS 對照（D10(f)）；拼字用英式（與 IFRS 原文一致，例如 amortisation、organisation），美式拼法列為英文搜尋別名，日期格式跟著英式。

| 選項 | 內容 | 優點 | 缺點與風險 | 成本 |
| --- | --- | --- | --- | --- |
| A 中英都用教材版面（採用） | 英文介面也顯示教材版面，IFRS 沒有或禁止的列在中英兩種介面都加標記（中文「非 IFRS 項目」、英文「Not an IFRS line item」） | 同一題兩種語言的數值與結構完全一致（你的需求） | 英文使用者看到非 IFRS 的結構，要靠標記、名詞卡與 IFRS 對照補充 | 低：只多一個標記 |
| B 英文預設 IFRS 對照 | 英文介面預設顯示 IFRS 對照 | 貼近國際教材 | 同一題中英數字可能不同，不能計分；切換語言時畫面數字會變，容易被誤認為錯誤 | 中 |

未採用的選項：B（同一題中英數字可能不同，不能計分）；美式拼字（與 IFRS 原文和術語表草稿不一致，改為只當搜尋別名）。

對核心與資料的影響：
- 核心不受影響。標記依科目與名詞的 `not_ifrs_line` 旗標產生，中英兩種介面都顯示；標記文字是介面字串（中文「非 IFRS 項目」、英文「Not an IFRS line item」，放在 05 的 catalog），IFRS 下的處理由名詞卡說明；本文件的英文範例一律用英式拼字。
- 名詞的 `enUsVariant` 記錄美式拼法，同時收進 `aliases.en`，用美式關鍵字也搜尋得到，但畫面不顯示（第 16.3 節）。
- 科目與範本的語意 ID 不對使用者顯示，維持現有寫法（第 16.1 節）。
- 日期格式由 UI 依 05 處理；核心不讀時間、不格式化日期（第 1 節）。

### 評估七：W 系列建議在科目表與版面上的落點（已決定 D13）

已決定（D13，2026-10-20）：A，W01 到 W15 全部採用；教材原字一律保留為可搜尋的別名。「短期放貨」不在 W 系列內；已決定（2026-10-23，【待確認 T09】）比照 W 系列以修正寫法「短期放款」為主要顯示，原字為別名並帶 `typo_fixed`。

核心是資料驅動的，科目名稱、別名與列名都是資料，四個選項在核心的成本相同，差別只在畫面上看到的字。選項代號與內容和 [14 待確認](14-open-questions.md) 的 D13 相同。

| 選項 | 內容 | 優點 | 缺點與風險 | 成本 |
| --- | --- | --- | --- | --- |
| A 全部採用（採用） | W01 到 W15 全部生效，教材原字保留為別名並可搜尋 | 用詞一致、和現行實務接軌 | 部分畫面文字和教材截圖不同，學生對照上課投影片時要多看一眼標記 | 低：只改資料 |
| B 只採用計算或結構相關的 | 只採用 W01、W02、W04、W05、W06、W12、W13；用詞類維持教材原字 | 畫面最貼近教材 | 同一份畫面出現「應付賬款」「應付帳款」兩種寫法 | 低 |
| C 都不採用 | 完全照教材字面 | 與教材一字不差 | 保留明顯的筆誤與舊稱，學生查現行財報時會困惑 | 低 |
| D 逐條決定 | 以 A 為基礎逐條否決 | 最有彈性 | 要逐條看過；同一份畫面可能混用兩種寫法 | 低 |

未採用的選項：B（同一份畫面會混用兩種寫法）；C（保留明顯的筆誤與舊稱）；D（你選擇全部採用，不逐條否決）。

W 系列在本文件的落點：

| 編號 | 本文件的落點 | 畫面效果 |
| --- | --- | --- |
| W01 | 政策開關 `officeSupplies: "expense_on_purchase"`（第 10.2 節）；延伸科目 `supplies_on_hand` 不用於故事（第 4.5 節） | 購入時全額列事務用品費；解說卡補一句「期末若有大量沒用完的用品，實務上可以列為資產；本課金額小，直接列費用」 |
| W02 | `machinery_equipment` 與 `accumulated_depreciation_machinery`（第 4.2、4.3 節）；`bs_machinery_net`（第 11.2 節） | L19 顯示淨額；交易卡註明「電腦設備，教材歸入機器設備」；`slides03` 版可以取得毛額 |
| W03 | `accounts_payable` 的別名（第 4.2 節）；H18 的列名（第 11.3 節）；指標的顯示名稱（第 12.2 節） | 介面統一寫「應付帳款」「週轉率」；「應付賬款」「應付貨款」「周轉率」為搜尋別名 |
| W04 | 間接法起算點（第 11.3 節） | 起算點固定為稅前淨利；解說寫「本課採稅前淨利起算；若從本期淨利起算，需另外加回所得稅費用」 |
| W05 | 五步驟的步驟④（第 13 節） | 核心用完整公式；畫面寫「本期淨利 vs 未分配盈餘增加額」並註明前提 |
| W06 | `window` 的 `cumulative` 與 `transaction`（第 11.5 節） | 實驗室同時提供累計三表與本筆交易變動 |
| W07 | 旗標 `old_name`（第 4.1 節）；科目別名（第 4.2 節） | 教材的舊稱為主要顯示並加「舊稱」標記，現行名稱為別名 |
| W08 | L29、N29、H23、H29、H36 的列名（第 11.2、11.3 節） | 「統計」顯示為「總計」，原字為別名 |
| W09 | `directors_remuneration`、`is_sga_total`（第 4.2、11.1 節） | 保留「銷管費用」，別名「營業費用」；解說補台灣的三分法；董監事酬勞註記現行多稱董事酬勞 |
| W10 | 延伸科目 `contract_liabilities`（第 4.5 節） | 顯示「預收收入」，別名「合約負債」 |
| W11 | 不在核心（指標的法源與報表對應見 03、12） | 核心無變化 |
| W12 | `cash_flow_adequacy`（第 12.2、12.3 節）；狀態規則（第 12.6 節） | 標「單期近似」；分母為 0 一律 N/A |
| W13 | `input.par_value`（第 12.2 節） | 顯示「每股面額」，預設 10、可修改 |
| W14 | `slides02` 版指標（第 12.4 節） | 計算器統一期間並標示是否年化；E 標「簡化」 |
| W15 | 不在核心（`judgment` 題與名詞卡標「老師觀點」，見 08） | 核心無變化 |

不在 W 系列內、但和顯示字有關的處理：
- 「短期放貨」依 T09 的決定（2026-10-23）改為「短期放款」；模板「營業利益佔時收資本比率」的「時收」依 12 的處理隨 D13 A 改為「實收」，是否仍屬現行年報指標依【待確認 T23】的決定在 M3 出題前查證。
- 牽涉 T 系列的列名（H13、H21 依 T11；H15 依 T12、T15）維持教材原字為主要顯示，建議寫法先列為別名，等老師回覆後再改。
- 現行財報用語（例如「營業活動之淨現金流量」「支付之股利」）依 W07 的原則只當別名，不取代教材原字。

---

## 1. 設計原則

| 原則 | 具體規則 | 怎麼檢查 |
| --- | --- | --- |
| 單一事實來源 | 唯一儲存的會計事實是分錄（由交易範本加參數產生）。科目餘額、三表、指標、勾稽、`effects`、題目答案都是推導值，不寫回資料。本機進度只存題目 ID、rev、作答與實驗室的參數覆寫，不存報表 | 核心沒有任何「寫入報表」的 API；性質測試 |
| 純函式 | 不讀時間、亂數、網路、檔案、DOM、IndexedDB、Intl；相同輸入一定得到相同輸出；不修改輸入（型別一律 `readonly`，開發模式另以 `Object.freeze` 防呆） | lint 規則禁止在 `packages/core` 匯入 react、使用 `window`、`document`、`Date`、`Math.random`、`Intl`；決定性測試 |
| 不依賴 UI 與語系 | 核心輸出數字、狀態碼、i18n key，以及「帶佔位符的多語文字」。千分位、百分比、負號等格式化全部在 UI 層依 05 處理 | 單元測試的期望值不含格式化後的字串 |
| 決定性 | 金額用整數；中間值用精確有理數；排序一律依科目表的 `order`；雜湊前用鍵排序的 canonical JSON；不依賴物件鍵的插入順序 | 同一組輸入跑兩次結果 deep equal；同一組黃金測試在 Node 與瀏覽器（Vitest browser mode）都跑 |
| 錯誤是值 | 預期內的錯誤（借貸不平、餘額為負、前置條件不成立）以 `Result` 回傳並附錯誤碼；只有程式錯誤才 throw | 每個錯誤碼都有單元測試 |
| 教材優先、差異分層 | 教材的處理是預設政策 `teacher@1`；現行準則的差異放在另一個 policy，不混在同一套規則裡 | policy 測試 |
| 可追蹤 | 每個報表數字都能一層一層回推到公式、來源科目、來源步驟與分錄行（核心從 M1 起輸出追蹤樹；畫面在 M4b 依 D10(c) A 做完整公式樹） | 追蹤測試：公式節點的值等於子節點代入公式的結果；所有 `sources` 的金額加總等於該列數值 |

## 2. 套件邊界與主要 API

```text
packages/core/
  src/
    money.ts        金額、有理數、四捨五入 helper
    accounts/       科目表型別、查詢、別名解析
    expr/           受控運算式：parser（只在建置工具使用）、型別檢查、AST 求值器
    journal/        分錄型別與驗證
    templates/      範本實例化（params、derived、preconditions、lines）
    ledger/         過帳、餘額快照、effects、T 字帳
    story/          故事重播、自由實驗覆寫、可輸入範圍搜尋
    policy/         認列政策開關（teacher@1；M4b 加 ifrs@1）
    statements/     教材版面三表、ifrs@1 版面、直接法、累計與本筆變動
    trace/          追蹤樹：公式、科目、來源步驟與分錄行（D10(c) A）
    ratios/         指標登錄檔、版本、狀態判定
    checks/         五步驟檢查
    scenario/       計算型題目的情境求解
    entries/        分錄的正規化比對（合併同科目同方向的行、多重集合比對；資料夾名稱示意）
  test/
```

已決定（2026-10-20）：判分移到 `packages/quiz`。多正解題判分 `scoreMultiChoice`、數字題比對（含 N/A 與位數規則）與分錄題計分 `scoreJournalEntry` 從原本 `core` 的 `scoring/` 移到 `packages/quiz`；核心只保留分錄的正規化比對（第 14 節第 1 到 4 點：解析別名、合併同科目同方向的行、移除金額為 0 的行、多重集合比對），屬於會計知識；`scoreJournalEntry` 呼叫它。判分規則本身不變（第 12.5、14、16.2 節），只是位置改變。選擇題與數字題的判分、星星、錯題本都不放在 `packages/core`。

分錄比對的函式與型別名稱原為示意（例如 `compareEntries`、`EntryComparison`），M1 實作時已定案（見本節末「M1 實作時定案的名稱」）。

已決定（2026-10-20）：`packages/core` 的內部依賴只有 `packages/content-schema` 與 `packages/i18n`（原名 `i18n-config`）；`packages/quiz` 依賴 `core`、`content-schema`、`i18n`。依賴方向與各套件的範圍以 09 為準。

核心只吃「已編譯的內容」（科目表、範本的 AST、版面、指標定義），由呼叫端傳入，核心本身不讀檔。parser 只在 `tools/` 的 `content:compile` 使用；學習端只需要 AST 求值器。

```ts
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

// 範本與分錄
function instantiateTemplate(t: CompiledTemplate, params: ParamValues, state: LedgerState, policy: Policy): Result<JournalEntry, TemplateError>;
function validateEntry(e: JournalEntry, chart: Chart, policy: Policy): Result<ValidEntry, EntryError[]>;

// 過帳與故事
function postStep(state: LedgerState, step: StoryStep, ctx: CoreContext): Result<PostedStep, StepError>;
function replayStory(story: Story, overrides: ParamOverride[], ctx: CoreContext): Result<StoryRun, StepError>;
function allowedRange(story: Story, overrides: ParamOverride[], target: ParamAddress, ctx: CoreContext): AllowedRange | null;

// 報表、指標、勾稽
function buildStatements(run: StoryRun | ScenarioRun, window: Window, layout: Layout): Statements;
function computeRatio(ratioRef: RatioRef, source: Statements | MeasureMap, inputs?: RatioInputs): RatioResult;
function fiveStepCheck(st: Statements, learnerInputs?: Partial<Record<LineId, Money>>): FiveStepResult;

// 追蹤與分錄層（D10(c) A、D1 (b)）
function traceLine(run: StoryRun | ScenarioRun, window: Window, layout: Layout, line: LineId): TraceNode;
function buildTAccounts(run: StoryRun | ScenarioRun, upToStep: string, accounts?: string[]): TAccount[];

// 題目
function solveScenario(s: Scenario, ctx: CoreContext): Result<ScenarioAnswer, ScenarioError>;
function compareEntries(submitted: EntryLine[][], expected: EntryLine[][], chart: Chart): EntryComparison;  // 名稱示意，M1 定案

// 以下判分函式在 packages/quiz（已決定，2026-10-20），不在 packages/core
function scoreNumeric(input: NumericAnswer, expected: RatioResult, q: NumericSpec): boolean;
function scoreMultiChoice(selected: readonly string[], q: MultiChoiceSpec): boolean;
function scoreJournalEntry(submitted: EntryLine[][], expected: EntryLine[][], chart: Chart): EntryScore;  // 呼叫 core 的分錄比對
```

**M1 實作時定案的名稱**（2026-10-23；上面的列表保留規劃時的簽名作為對照，以程式為準）：

- `validateEntry` 回傳 `CoreError[]`（空陣列表示通過），不再包成 `Result`。
- 分錄比對是 `compareEntries(submitted, expected, chart, options)` 與 `normaliseEntries`。
- `buildStatements(run, window, layout, policy)`，多帶 `policy`。
- `computeRatio(ratioRef, measures, inputs?, registry?, options?)`：`measures` 是以線 ID 為鍵的 `MeasureMap`，`avg` 需要的期初值由 `options.opening` 提供。
- `fiveStepCheck(st, learnerInputs?)`。
- `replayStory(story, overrides, ctx)` 與 `allowedRange(story, overrides, target, ctx)`。
- 錯誤訊息的 key 慣例是 `core.error.<錯誤碼>`；`lab.*` 的介面字串由 UI 對應，不在核心。

`CoreContext` 帶著科目表、已編譯的範本與認列政策。IFRS 對照（D10(f)）不另設 API：呼叫端把 `ctx.policy` 換成 `ifrs@1` 重新呼叫 `replayStory`（沿用同一組自由實驗覆寫），再以 `ifrs@1` 版面呼叫 `buildStatements`、`computeRatio` 與 `traceLine`。計分相關的函式只用在 `teacher@1` 的結果上（第 15.1 節）。

`packages/core` 的 `exports` 直接指向原始碼，不另外 build（見 09）。型別以 `packages/content-schema` 的 Zod schema 為準，本文件的 TypeScript 型別是說明用的對照。

## 3. 金額、精度與四捨五入

- **型別**：`Money` 是 JavaScript number，但每次運算後都檢查 `Number.isSafeInteger`，超出就回傳 `money.overflow`。不直接用 bigint 的理由：bigint 不能直接 JSON 序列化，Zod 4 的 `toJSONSchema()` 預設也無法表示 bigint（見 09）。bigint 只用在有理數的內部運算。
- **scale**：宣告在帳本（情境）層級，`{ "currency": "TWD", "scale": 0 }`，1 個單位就是 1 元。同一帳本所有金額共用同一個 scale；題目引用故事狀態時沿用故事的 scale，題目不能自帶不同的 scale。
- **中間運算**：受控運算式與指標計算一律用精確有理數（分子、分母都是 bigint），不經過浮點數，所以 0.1 加 0.2 這類誤差不會出現，`zero` 狀態也能精確判定。
- **四捨五入**：只有 `round()` 能把有理數變成金額，而且只能出現在範本的 `derived` 裡。規則固定為四捨五入、負數遠離 0（與 Excel ROUND 相同），不提供其他模式。分錄行的金額不可以呼叫 `round()`，只能引用 `param` 或 `derived`，所以同一個推導值被借方與貸方同時引用時，兩邊一定相等。
- **例子**：設備成本改成 359,999、耐用年數 4 年，`round(cost(machinery_equipment) / param.usefulLifeYears)` 先得到精確值 89,999.75，再四捨五入為 90,000；借方折舊費用與貸方累計折舊都引用這個 90,000，不會借貸不平。
- **指標**：結果同時存有精確有理數與浮點近似值。顯示用的四捨五入由核心從精確值算好，再交給 UI 用固定小數位數格式化，避免浮點數在 .5 邊界上被捨錯。
- **輸入**：實驗室與作答的數字解析（全形、逗號、三種負號）在 UI 層依 05 處理，核心只收整數金額。範本參數的上限預設 999,999,999,999。

## 4. 科目表

### 4.1 欄位

```ts
type Element = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
type Section =
  | 'current_asset' | 'noncurrent_asset' | 'deferred_asset'
  | 'current_liability' | 'noncurrent_liability' | 'equity' | 'retained_earnings_group'
  | 'operating_revenue' | 'non_operating_income' | 'extraordinary_gain'
  | 'cost_of_sales' | 'sga_expense' | 'non_operating_expense' | 'extraordinary_loss' | 'income_tax';
type AccountFlag =
  | 'japanese'               // 日式科目或日式分類
  | 'old_name'               // IFRS 之前的舊稱
  | 'typo_fixed'             // 教材原文疑似誤植；W 系列涵蓋的項目依 D13 A 以修正寫法為主要顯示、原字列為別名；短期放貨不在 W 系列內，但依 T09 的決定（2026-10-23）同樣以修正寫法「短期放款」為主要顯示並帶這個旗標
  | 'unused'                 // 本課故事未用，實驗室預設隱藏
  | 'not_ifrs_line'          // IFRS 沒有或禁止的列
  | 'ifrs_treatment_differs' // 不只是用語不同，IFRS 的處理會改變金額或分類
  | 'not_in_template'        // 只用於科目表：老師模板沒有這一列，網站內部才有
  | 'extension';             // 只用於科目表：延伸科目，預設停用

interface Account {
  id: string;                         // 穩定 ID，發布後不改、不重用
  order: number;                      // 排序依據
  element: Element;
  section: Section;
  normalSide: 'debit' | 'credit';
  current: boolean | null;            // 權益與損益科目為 null
  contraOf: string | null;            // 抵銷科目指向被抵銷的科目
  allowNegative: boolean;             // 過帳後是否允許負餘額（第 6.3 節）
  enabledByDefault: boolean;
  teacherCell: string | null;         // 老師模板的儲存格，例如 'L24'
  labels: {
    teacher: { 'zh-TW': string; en: string };  // 主要顯示（教材用語與其英文）
    currentTw: string | null;                  // 現行台灣用語
    ifrsEn: string | null;                     // IFRS 英文；IFRS 沒有對應時為 null
    aliases: { 'zh-TW': string[]; en: string[] };
  };
  termRef: string;                    // 名詞卡 ID（tm_ 前綴，見 08 第 4.1 節）
  flags: AccountFlag[];
  ifrsTreatment: { note: LocalizedText; amountImpact: LocalizedText } | null; // 有 ifrs_treatment_differs 時必填
  cashFlow: { indirect: IndirectRule; defaultActivity: 'operating' | 'investing' | 'financing' | null };
  pendingRefs: string[];              // 例如 ['T04', 'T05']；相關設計決定的編號（14 的 T 系列），畫面顯示「設計說明」，不影響計分
}
```

顯示規則：教材用語是主要顯示；現行用語不同時加「舊稱」「日式」等標記，滑過或點開名詞卡看現行用語（W07）。W 系列已全部採用（已決定 D13 A，評估七）：W03、W08、W13 這類修正寫法成為主要顯示，教材原字收進 `aliases` 供搜尋；W07 的舊稱、W09 的「銷管費用」、W10 的「預收收入」仍以教材名稱為主要顯示，現行說法列為別名。帶 `not_ifrs_line` 的科目與列在中英兩種介面都加標記（中文「非 IFRS 項目」、英文「Not an IFRS line item」，字串見 05；D11），名詞卡說明 IFRS 的處理。帶 `ifrs_treatment_differs` 的科目不給「IFRS 別名」，改顯示「IFRS 下的處理」與金額影響。

旗標的前六種和名詞（Term，第 16.3 節）的旗標共用同一組名稱；`not_in_template` 與 `extension` 只描述科目表本身。科目的 `labels` 與它連到的名詞（第 16.3 節的 `label`、`teacherLabel`、`currentTwLabel`、`ifrsEnglish`、`aliases`；08 第 3.7 節列出同一組欄位）必須一致，`content:compile` 會逐欄比對，不一致就失敗，避免同一個科目在報表和名詞卡上出現兩種寫法。

### 4.2 科目一覽

「教材用語（主要顯示）」是教材原文；現行用語放在「現行台灣用語／別名」欄（`labels.currentTw` 或 `labels.aliases`）。D13 已決定 A（W01 到 W15 全部採用）：科目層級受影響的只有別名與註記（例如 W03 的「應付賬款」「應付貨款」、W07 的「舊稱」、W09 的「現行多稱董事酬勞」），沒有科目的主要顯示因此改變；牽涉 T 系列的修正寫法（例如「短期放貨」依 T09）等老師回覆後才改主要顯示。英文名稱以 [12 術語表](12-glossary.md) 為準（05 第 12 節也這樣規定）；IAS 1 的報表大項名稱等其他寫法收進英文別名 `aliases.en`，在表中以「別名」標出。英文拼字用英式，美式拼法收進 `aliases.en` 供搜尋（已決定 D11）。

| id | 教材用語（主要顯示） | 現行台灣用語／別名 | IFRS 英文 | 要素／區段 | 正常餘額 | 流動性 | 抵銷 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `cash` | 現金及約當現金 | 同 | Cash and cash equivalents | 資產／流動資產 | 借 | 流動 | |
| `accounts_receivable` | 應收帳款 | 應收帳款淨額；別名：銷貨債權（日式） | Trade receivables（別名：Trade and other receivables） | 資產／流動資產 | 借 | 流動 | |
| `inventory` | 存貨 | 同 | Inventories | 資產／流動資產 | 借 | 流動 | |
| `short_term_loans_receivable` | 短期放款（已決定【待確認 T09】，2026-10-23；教材原字「短期放貨」為別名並帶 `typo_fixed`） | 別名：短期放貨；一般公司多列其他應收款 | Short-term loans receivable（別名：Loans receivable） | 資產／流動資產 | 借 | 流動 | |
| `machinery_equipment` | 機器設備 | 不動產、廠房及設備（機器設備）；別名：固定資產（舊稱，W07） | Property, plant and equipment | 資產／非流動資產 | 借 | 非流動 | |
| `accumulated_depreciation_machinery` | 累計折舊－機器設備（模板無此列） | 累計折舊 | Accumulated depreciation | 資產／非流動資產 | 貸 | 非流動 | `machinery_equipment` |
| `intangible_assets` | 無形資產 | 同 | Intangible assets | 資產／非流動資產 | 借 | 非流動 | |
| `investments_other_assets` | 投資其他資產 | 對照待確認（可能對應採用權益法之投資、其他非流動資產等） | Investments and other assets | 資產／非流動資產 | 借 | 非流動 | |
| `deferred_organisation_costs` | 設立費 | 無對應（現行應費用化）；別名：開辦費 | 無（IAS 38.69 應費用化） | 資產／遞延資產 | 借 | 非流動 | |
| `deferred_development_costs` | 開發費 | 符合 IAS 38.57 條件才列無形資產 | 無（符合條件才列 Intangible assets） | 資產／遞延資產 | 借 | 非流動 | |
| `accounts_payable` | 應付帳款 | 同；別名：應付賬款、應付貨款（W03） | Trade payables（別名：Trade and other payables） | 負債／流動負債 | 貸 | 流動 | |
| `short_term_borrowings` | 短期借款 | 同 | Short-term borrowings | 負債／流動負債 | 貸 | 流動 | |
| `income_tax_payable` | 應付所得稅 | 本期所得稅負債 | Current tax liabilities | 負債／流動負債 | 貸 | 流動 | |
| `deposits_received` | 保證金 | 性質待確認（存入保證金或代收款） | Deposits received | 負債／流動負債 | 貸 | 流動 | |
| `long_term_borrowings` | 長期借款 | 同；別名：長期負債（舊稱，指類別，W07） | Long-term borrowings | 負債／非流動負債 | 貸 | 非流動 | |
| `share_capital` | 股本 | 普通股股本 | Share capital | 權益（教材：股東權益，舊稱標記，W07） | 貸 | 不適用 | |
| `capital_surplus` | 資本公積 | 同 | Capital surplus | 權益 | 貸 | 不適用 | |
| `legal_reserve` | 法定盈餘公積 | 同 | Legal reserve | 權益／保留盈餘 | 貸 | 不適用 | |
| `special_reserve` | 特別盈餘公積 | 同 | Special reserve | 權益／保留盈餘 | 貸 | 不適用 | |
| `retained_earnings` | 未分配盈餘 | 未分配盈餘（虧損時稱待彌補虧損） | Unappropriated retained earnings (accumulated deficit) | 權益／保留盈餘 | 貸 | 不適用 | |
| `valuation_translation_adjustments` | 評價及換算差額 | 其他權益（對照待確認） | Other components of equity（別名：Valuation and translation adjustments） | 權益 | 貸 | 不適用 | |
| `share_subscription_rights` | 新股預約申購權 | 資本公積－認股權（對照待確認） | Share options and warrants（別名：Share subscription rights） | 權益 | 貸 | 不適用 | |
| `revenue` | 營業收入 | 同 | Revenue | 收入／營業收入 | 貸 | 不適用 | |
| `non_operating_income` | 營業外收入 | 營業外收入及支出下的其他收入、利息收入等 | Non-operating income（別名：Other income） | 收入／營業外收入 | 貸 | 不適用 | |
| `extraordinary_gains` | 非常利益 | 無（現行報表沒有這一類） | 無（IAS 1.87 禁止） | 收入／非常利益 | 貸 | 不適用 | |
| `cost_of_goods_sold` | 營業成本 | 同；別名：銷貨成本 | Cost of sales | 費用／營業成本 | 借 | 不適用 | |
| `directors_remuneration` | 董監事酬勞 | 現行多稱董事酬勞（W09） | Remuneration of directors and supervisors（別名：Directors' remuneration） | 費用／銷管費用 | 借 | 不適用 | |
| `outsourcing_expense` | 外包費用 | 同 | Outsourcing expense | 費用／銷管費用 | 借 | 不適用 | |
| `packing_freight_expense` | 包裝運送費 | 運費（推銷費用） | Packing and delivery expenses（別名：Packing and freight-out expense） | 費用／銷管費用 | 借 | 不適用 | |
| `office_supplies_expense` | 事務用品費 | 文具用品 | Office supplies expense | 費用／銷管費用 | 借 | 不適用 | |
| `depreciation_expense` | 折舊費用 | 同 | Depreciation expense | 費用／銷管費用 | 借 | 不適用 | |
| `interest_expense` | 支付利息 | 利息費用；別名：財務成本 | Finance costs（別名：Interest expense） | 費用／營業外支出 | 借 | 不適用 | |
| `amortisation_deferred_assets` | 攤銷遞延資產 | 無對應 | 無（設立費在 IFRS 下不會攤銷） | 費用／營業外支出 | 借 | 不適用 | |
| `extraordinary_losses` | 非常損失 | 無 | 無（IAS 1.87 禁止） | 費用／非常損失 | 借 | 不適用 | |
| `income_tax_expense` | 所得稅費用 | 同 | Income tax expense | 費用／所得稅 | 借 | 不適用 | |

教材的「營業成本」區塊在模板上分成期初存貨、本期進貨、期末存貨(-) 三列。因為內帳採永續盤存（第 5 節），這三列不設科目，改由版面從存貨帳推導，只有 `cost_of_goods_sold` 一個科目。

### 4.3 模板對應、現金流量、旗標與故事用途

「故事用途」以教材故事 18 種交易的順序表示第幾筆。正式故事照老師的情境與金額（已決定 D2），金額只寫在故事資料裡；本文件與 repo 內測試的例子用自編數字。「預設活動」只用在分類題的正解推導。

| id | 教材模板列 | 間接法規則（第 11.3 節） | 預設活動 | 旗標 | 故事用途 | 待確認 |
| --- | --- | --- | --- | --- | --- | --- |
| `cash` | L12、H40、H41 | 現金本身；每條現金行必須有現金流量標籤 | 不適用 | | 幾乎每一筆 | |
| `accounts_receivable` | L13 | 淨增加填 H15（負）；淨減少填 H17（正） | 營業 | `japanese`（別名銷貨債權） | 第 10、12 筆 | T08、T12、T15 |
| `inventory` | L14；R12、R14 由餘額推導 | H16：增加為負，減少以正數填同列並加註 | 營業 | | 第 6、7、9、10、16 筆 | T06、T07 |
| `short_term_loans_receivable` | L15 | 付現 `loans_advanced` 填 H27；收回用延伸列 | 投資 | `japanese`、`unused`（T09 回覆前不帶 `typo_fixed`） | 未用 | T09 |
| `machinery_equipment` | L19（顯示淨額） | 付現 `capex` 填 H26 | 投資 | | 第 3 筆（電腦設備，教材歸入此科目） | W02 |
| `accumulated_depreciation_machinery` | 併入 L19 淨額 | 不直接對應；折舊經 H12 加回 | 不適用（抵銷科目，不出現金流量分類題） | `not_in_template` | 第 17 筆 | W02 |
| `intangible_assets` | L20 | 付現 `capex` 填 H26 | 投資 | `unused` | 未用 | |
| `investments_other_assets` | L21 | 付現 `other_investing_payments` 填 H28 | 投資 | `japanese`、`unused` | 未用 | T15 |
| `deferred_organisation_costs` | L24（攤銷直接減少帳面） | 付現 `capex` 填 H26（教材政策）；攤銷加回見 H14 | 投資（教材政策） | `japanese`、`not_ifrs_line`、`ifrs_treatment_differs` | 第 5、17 筆 | T04、T05、T30 |
| `deferred_development_costs` | L25 | 付現 `capex` 填 H26 | 投資 | `japanese`、`not_ifrs_line`、`ifrs_treatment_differs`、`unused` | 未用 | T04 |
| `accounts_payable` | N12 | H18：增加為正，減少以負數填同列並加註 | 營業 | | 第 9、11 筆 | W03 |
| `short_term_borrowings` | N13 | 借入 H32、償還 H33；排除於 H19 | 籌資 | | 第 8、15 筆 | T30 |
| `income_tax_payable` | N14 | 排除於 H19；付現走 H22 | 營業 | `unused` | 只在所得稅改為先估列再付款時使用 | T10、T36 |
| `deposits_received` | N15 | 暫列 H19 | 營業（暫定） | `japanese`、`unused` | 未用 | T15 |
| `long_term_borrowings` | N17 | 延伸列；排除於 H19 | 籌資 | `unused` | 未用 | W07 |
| `share_capital` | N21 | 付現 `share_issue` 填 H34 | 籌資 | | 第 1 筆 | W13 |
| `capital_surplus` | N22 | 溢價部分併入 H34 | 籌資 | `unused` | 未用 | T16 |
| `legal_reserve` | N24 | 權益內部移轉，不影響現金 | 不適用 | `unused` | 未用 | |
| `special_reserve` | N25 | 同上 | 不適用 | `unused` | 未用 | |
| `retained_earnings` | N26（加上本期淨利） | 現金股利 `dividends_paid` 填 H35 | 籌資（股利） | | 期末推導 | W05 |
| `valuation_translation_adjustments` | N27 | 不影響現金 | 不適用 | `japanese`、`unused` | 未用 | T15 |
| `share_subscription_rights` | N28 | 付現時併入 H34 | 籌資 | `japanese`、`unused` | 未用 | T15 |
| `revenue` | R10 | 經 H11 | 營業 | | 第 7、10 筆 | |
| `non_operating_income` | R25 | 經 H11 | 營業 | `unused` | 未用 | |
| `extraordinary_gains` | R31 | 經 H11 | 營業 | `not_ifrs_line`、`ifrs_treatment_differs`、`unused` | 未用（盤盈預設不放這裡） | T02、T06 |
| `cost_of_goods_sold` | R15（由 R12、R13、R14 推導） | 經 H11 | 營業 | | 第 7、10、16 筆 | T06 |
| `directors_remuneration` | R18 | 經 H11 | 營業 | | 第 13 筆 | W09 |
| `outsourcing_expense` | R19 | 經 H11 | 營業 | | 第 4 筆 | |
| `packing_freight_expense` | R20 | 經 H11 | 營業 | | 第 14 筆 | |
| `office_supplies_expense` | R21 | 經 H11 | 營業 | | 第 2 筆 | W01 |
| `depreciation_expense` | R22 | 加回 H12 | 營業 | | 第 17 筆 | T05 |
| `interest_expense` | R27 | 加回 H13；實付 H21 | 營業 | `japanese`（支付利息） | 第 15 筆 | T11 |
| `amortisation_deferred_assets` | R28 | 加回 H14（預設） | 營業 | `not_ifrs_line`、`ifrs_treatment_differs` | 第 17 筆 | T04、T05、T12 |
| `extraordinary_losses` | R32 | 經 H11；非現金部分加回 H14 | 營業 | `not_ifrs_line`、`ifrs_treatment_differs`、`unused` | 未用 | T02 |
| `income_tax_expense` | R34 | 不經 H11（起算點是稅前）；付現 H22 | 營業 | | 第 18 筆 | T10 |

其他與科目相關的處理：
- 第 3 筆的電腦設備依教材記入「機器設備」，交易卡註明「電腦設備，教材歸入機器設備」；內部保留累計折舊，L19 顯示淨額（W02，已決定 D13 A）。
- 設立費攤銷依教材直接減少帳面，不另設累計攤銷科目。
- Excel 口徑的指標一律取帳面淨額（成本減累計折舊）；只有 `slides03` 版的「不動產、廠房及設備毛額」才取成本。
- 第 12 筆依故事推定為收回應收帳款【待確認 T08】；正式故事照老師的情境（D2），這一筆依 13 的建議處理並在交易卡加註。第 8 筆依第 15 筆推定為短期借款【待確認 T30】。

### 4.4 不可入帳的分組與公式列

老師模板的標題列與公式列不是科目。在核心裡它們是版面的分組節點或公式節點，分錄不可能引用它們；手寫分錄與匯入資料若引用，驗證回傳 `entry.not_postable`。下表也記錄哪些格子會被 Excel 的 SUM 一起加總，這是「誤填會重複計算」的風險來源，匯出 Excel 時這些格子一律留白。表中的 D10、D11、D16、D17 與 L13、L20、L21 是「財務分析指標」工作表的儲存格，和決策編號的 D 系列無關。

| 模板位置 | 名稱 | 種類 | 被 Excel 加總包含 |
| --- | --- | --- | --- |
| K11 | 流動資產 | 分組 | 否 |
| K17 | 非流動資產 | 分組 | 否 |
| K18、L18 | 固定資產 | 分組 | 是：L29、D17 |
| K23、L23 | 遞延資產 | 分組 | 是：D17（L29 不含） |
| M11、N11 | 流動負債 | 分組 | 是：N29、D10、D16、D17、L20、L21 |
| M16、N16 | 非流動負債 | 分組 | 是：N29、D10、D11 |
| N18 | （空白列） | 空白 | 是：N29 |
| M19、N19、M20、N20 | 股東權益 | 分組 | 是：N29、D11、L13 |
| M23、N23 | 保留盈餘 | 分組 | 是：N29、D11、L13 |
| Q11、R11 | 營業成本 | 分組 | 否 |
| Q17、R17 | 銷管費用 | 分組 | 否 |
| Q26、R26 | 營業外支出 | 分組 | 否 |
| G10、G25、G31、G38 | 三大活動與現金流量標題 | 分組 | 否 |
| R15、R16、R23、R24、R29、R30、R33、R35 | 損益表小計與五層利益 | 公式 | 不適用 |
| L29、N29 | 資產統計、負債及股東權益統計 | 公式 | 不適用 |
| H20、H23、H29、H36、H39、H41 | 現金流量表小計與期末現金 | 公式 | 不適用 |

注意：R10「營業收入」與 R25「營業外收入」雖然是標題樣式，卻是被公式讀取的輸入格，在核心裡對應 `revenue` 與 `non_operating_income` 的帳戶發生額。

### 4.5 延伸科目（預設停用）

模板沒有、故事也用不到，但題目、自由實驗或 IFRS 對照可能需要。啟用時旗標為 `extension`，版面依第 11.3 節的延伸列顯示。

| id | 名稱 | 要素／區段 | 用途與規則 |
| --- | --- | --- | --- |
| `prepaid_expenses` | 預付費用 | 資產／流動資產 | 間接法延伸列「其他營業資產增加(-)」；`slides03` 版速動比率要扣除 |
| `supplies_on_hand` | 用品盤存 | 資產／流動資產 | W01 已採用（購入時全額費用化，解說卡補一句實務做法），故事不用；只給政策開關 `officeSupplies: "asset_then_expense"` 的延伸題使用 |
| `organisation_costs_expense` | 設立費（費用化） | 費用／銷管費用 | 只在 `ifrs@1`（`orgCosts: "expense"`）下啟用，`teacher@1` 下停用；IFRS 對照的損益表列在營業費用（第 10.3 節）；名詞與英文名稱依 12 |
| `interest_payable` | 應付利息 | 負債／流動負債 | 必須排除於 H19，否則和 H21 重複 |
| `other_payables` | 其他應付款 | 負債／流動負債 | 經 H19 |
| `contract_liabilities` | 預收收入（別名：合約負債） | 負債／流動負債 | 經 H19（W10） |
| `dividends_payable` | 應付股利 | 負債／流動負債 | 排除於 H19 |
| `research_development_expense` | 研究發展費用 | 費用／銷管費用 | `rd_intensity` 需要 |
| `marketing_expense` | 行銷費用 | 費用／銷管費用 | `me_intensity` 需要 |
| `office_equipment` | 辦公設備 | 資產／非流動資產 | W02 已採用（電腦設備依教材歸入機器設備），故事不用；只給需要另列辦公設備的延伸題使用 |

### 4.6 科目資料範例

```json
{
  "id": "deferred_organisation_costs",
  "order": 240,
  "element": "asset",
  "section": "deferred_asset",
  "normalSide": "debit",
  "current": false,
  "contraOf": null,
  "allowNegative": false,
  "enabledByDefault": true,
  "teacherCell": "L24",
  "labels": {
    "teacher": { "zh-TW": "設立費", "en": "Start-up costs" },
    "currentTw": null,
    "ifrsEn": null,
    "aliases": { "zh-TW": ["開辦費"], "en": ["Establishment costs", "Organisation costs"] }
  },
  "termRef": "tm_d9f3g7cs",
  "flags": ["japanese", "not_ifrs_line", "ifrs_treatment_differs"],
  "ifrsTreatment": {
    "note": {
      "zh-TW": "IAS 38.69 規定開辦活動的支出在發生時認列為費用，不能列為資產。",
      "en": "Under IAS 38.69, expenditure on start-up activities is recognised as an expense when it is incurred."
    },
    "amountImpact": {
      "zh-TW": "改用 IFRS 時，取得當期的費用增加、之後各期不再攤銷；付出的現金由投資活動改列營業活動。",
      "en": "Under IFRS the expense is higher in the period of payment and there is no later amortisation. The cash paid moves from investing to operating activities."
    }
  },
  "cashFlow": { "indirect": "via_cash_tag", "defaultActivity": "investing" },
  "pendingRefs": ["T04", "T05", "T30"]
}
```

## 5. 存貨模型

### 5.1 內帳規則（永續盤存）

- **進貨**：借 存貨／貸 現金或應付帳款。存貨那一行標 `tag: "purchase"`；現金行標 `operating / payments_to_suppliers`。進貨運費計入存貨成本，銷貨運費記入包裝運送費。
- **銷貨**：收入兩行（借 現金或應收帳款／貸 營業收入）之外，另加成本兩行：借 營業成本／貸 存貨，存貨行標 `tag: "cost_of_sale"`。
- **賣出全部存貨**：成本是推導值 `balance(inventory)`，不是參數；前置條件為帳上存貨大於 0，否則會出現「有營收、沒成本」的錯誤狀態。
- **盤點**：參數固定為盤點後金額 `countedAmount`（大於等於 0）。推導 `overage = max(param.countedAmount - balance(inventory), 0)` 與 `shortage = max(balance(inventory) - param.countedAmount, 0)`。
  - 盤盈：借 存貨（`count_overage`）／貸 營業成本。這是預設做法【待確認 T06】；替代做法（貸記營業外收入或非常利益）用政策開關 `inventoryOverage` 切換（第 10 節）。
  - 盤損：借 營業成本／貸 存貨（`count_shortage`）。教材沒有出現盤損，預設比照盤盈計入營業成本（見第 20 節）。
  - 不採「參數是盤盈差額」的做法：故事中盤點前帳上存貨為 0，兩種解讀結果相同；但自由實驗改了前面的金額之後，兩種解讀就會不同，以盤點後金額為參數才符合「盤點」的意思。

### 5.2 教材版面怎麼由內帳推導

| 教材列 | 線 ID | 推導規則 |
| --- | --- | --- |
| R12 期初存貨 | `is_opening_inventory` | 視窗起點的存貨餘額（故事是自成立起累計，恆為 0） |
| R13 本期進貨 | `is_purchases` | 視窗內標 `purchase` 的存貨借方合計；也是 Excel 應付款項週轉率的分子 |
| R14 期末存貨(-) | `is_closing_inventory` | 視窗終點的存貨餘額，以正數顯示，在小計中扣除 |
| 存貨盤盈（只在替代政策下出現） | `is_inventory_overage_excluded` | 標 `count_overage` 的合計；只有 `inventoryOverage` 不是 `reduce_cogs` 時才顯示，並加進營業成本小計才能對平 |
| R15 營業成本小計 | `is_cogs` | R12＋R13（＋盤盈列）－R14 |
| L14 存貨 | `bs_inventory` | 與 R14 相同 |

期末存貨在畫面上一律是正數。只有匯出成老師的 Excel 格式時，R14 才轉成負數，以配合 `R15=SUM(R12:R14)` 的公式【待確認 T07】。

### 5.3 不變式（每一步都要測）

1. `is_closing_inventory` ＝ `bs_inventory` ＝ 存貨帳戶餘額。
2. `is_cogs` ＝ 營業成本帳戶在視窗內的發生額。預設政策下公式是 R12＋R13－R14；替代政策下公式多加盤盈列（R12＋R13＋盤盈列－R14），結果仍必須等於營業成本帳戶的發生額。
3. `is_purchases` ＝ 視窗內標 `purchase` 的存貨借方合計。
4. 每一條存貨行都必須有 `tag` 標籤：`purchase` 與 `count_overage` 只能在借方，`cost_of_sale` 與 `count_shortage` 只能在貸方。
5. 不可以單純用「存貨變動」反推營業成本。若盤盈記為收益又用公式推導營業成本，盤盈會同時出現在期末存貨與收益，淨利多算一次。

### 5.4 例子（自編數字）

| 步驟（第幾筆的類型） | 交易 | 存貨餘額 | R13 本期進貨 | R14 期末存貨 | R15 營業成本 |
| --- | --- | --- | --- | --- | --- |
| 第 6 筆 | 現金進貨 640,000 | 640,000 | 640,000 | 640,000 | 0 |
| 第 7 筆 | 全部存貨以現金 1,120,000 賣出（成本＝帳上 640,000） | 0 | 640,000 | 0 | 640,000 |
| 第 9 筆 | 賒購 2,800,000 | 2,800,000 | 3,440,000 | 2,800,000 | 640,000 |
| 第 10 筆 | 全部存貨賒銷 5,600,000（成本＝帳上 2,800,000） | 0 | 3,440,000 | 0 | 3,440,000 |
| 第 16 筆 | 盤點後金額 420,000（帳上 0，盤盈 420,000，沖減營業成本） | 420,000 | 3,440,000 | 420,000 | 3,020,000 |

若盤盈改列營業外收入，第 16 筆之後營業成本帳戶仍是 3,440,000，版面要多一列「存貨盤盈 420,000」：0＋3,440,000＋420,000－420,000＝3,440,000；營業毛利因此少 420,000，稅前淨利不變。

## 6. 分錄驗證與過帳

### 6.1 型別

```ts
interface JournalLine {
  ref: string;                      // 'e1.l3'：事件 ID 加範本行 ID，供追蹤與 effects 使用
  account: string;
  side: 'debit' | 'credit';
  amount: Money;                    // 非負整數
  cf?: CashFlowTag;                 // 只有 cash 行有，而且必須有
  tag?: LineTag;                    // inventory 行必須有存貨類標籤；借記未分配盈餘時標示用途（第 13 節步驟④）
}
type LineTag = InventoryTag | 'dividend' | 'reserve_appropriation';
interface JournalEntry { eventId: string; template: string; lines: JournalLine[] }

type Balances = Readonly<Record<string, Money>>; // 以「借方減貸方」儲存的帶號整數

interface PostedStep {
  stepId: string;
  entries: JournalEntry[];          // 每個事件一筆，已移除金額為 0 的行
  removedZeroLines: string[];
  balancesBefore: Balances;
  balancesAfter: Balances;
  delta: Balances;
  effects: Effect[];
  noEffect: boolean;                // 整步所有行都是 0
  derivedValues: Record<string, Money | string>; // 'e1.costOfAllInventory' 等，給交易卡與題目佔位符
}
```

科目的「正常餘額表示」＝（借方減貸方）乘上正常方向的正負號：借方科目乘 1，貸方科目乘 -1。報表與 `effects` 一律用正常餘額表示。

### 6.2 驗證順序與錯誤碼

| 順序 | 檢查 | 錯誤碼 |
| --- | --- | --- |
| 1 | 參數型別與範圍 | `param.out_of_range`、`param.type` |
| 2 | 推導值求值（依宣告順序） | `expr.division_by_zero`、`money.not_integer`、`money.overflow` |
| 3 | 前置條件 | `precondition.failed`（附條件 ID 與說明） |
| 4 | 依政策開關篩選 `policyWhen`，移除金額為 0 的行並記錄 | 無（記在 `removedZeroLines`） |
| 5 | 全部行都被移除：合法，`noEffect: true`，畫面顯示「本筆無影響」 | 無 |
| 6 | 至少剩兩行 | `entry.too_few_lines` |
| 7 | 金額為非負安全整數 | `entry.amount_invalid` |
| 8 | 科目存在、可入帳、在目前政策下已啟用 | `entry.unknown_account`、`entry.not_postable`、`entry.account_disabled` |
| 9 | 借貸相等 | `entry.unbalanced`（附差額） |
| 10 | 現金行標籤：`cash` 行必須有且只有一個 `cf`；非現金行不得有 `cf`；`kind` 與 `activity` 相容 | `entry.cf_tag_missing`、`entry.cf_tag_unexpected`、`entry.cf_tag_mismatch` |
| 11 | 存貨行標籤與借貸方向 | `entry.inv_tag_missing`、`entry.inv_tag_side` |
| 12 | 過帳後的餘額規則（第 6.3 節） | `balance.negative`（附科目、過帳後餘額、可輸入範圍） |

建置期另外禁止「非現金的投資或籌資交易」範本（例如賒購設備、債轉股），因為教材的間接法模板沒有揭露這類交易的位置，放進來會讓 H19 誤判。若日後需要，另立規則與揭露列。

### 6.3 餘額規則

| 科目 | 規則 |
| --- | --- |
| 資產科目（現金、應收帳款、存貨、短期放貨、無形資產、投資其他資產、遞延資產） | 不得小於 0 |
| 機器設備淨額（成本減累計折舊） | 不得小於 0，累計折舊不得超過成本 |
| 負債科目 | 不得小於 0 |
| 股本、資本公積、法定與特別盈餘公積 | 不得小於 0 |
| 未分配盈餘、評價及換算差額、權益總額 | 可以為負（權益為 0 時 ROE、權益倍數是 na，小於 0 時是 not_meaningful） |
| 收入、費用科目 | 不檢查（例如盤盈在還沒有銷貨時貸記營業成本，營業成本可能暫時為負，仍合法） |

### 6.4 過帳與快照

- `postStep` 依事件順序逐一實例化範本、驗證、過帳；同一步的後一個事件看得到前一個事件的結果。
- 每一步產生不可變的快照：`balancesBefore`、`balancesAfter`、`delta`。第 k 步的 before 就是第 k-1 步的 after，資料結構共用，不複製整份。
- 追蹤資料：任一報表數字都能由 `traceLine` 展開成追蹤樹，只在呼叫端要求時計算，並依（run、視窗、版面、線 ID）快取。D10(c) 已決定 A 完整公式樹與來源分錄，所以追蹤資料不是平面的「科目加變動量」清單，而是下面的樹狀結構；M1 就輸出完整的樹，M4b 的畫面只負責呈現。

```ts
type TraceRule = 'formula' | 'link' | 'accounts' | 'working_capital' | 'cash_tag' | 'inventory'; // 與版面列的 kind 對應
interface TraceNode {
  line: string;                        // 線 ID
  cell: string | null;                 // 老師模板的儲存格；模板沒有的列與 ifrs@1 版面為 null
  value: Money;                        // 與 buildStatements 同一列的值相同
  rule: TraceRule;
  expr?: string;                       // rule 為 formula 時的版面公式，例如 'line.is_revenue - line.is_cogs'
  children: TraceNode[];               // 公式或連結引用的列；沒有時為空陣列
  accounts: AccountTrace[];            // 這一列直接取用的科目；沒有時為空陣列
  sources: SourceRef[];                // 只有 cash_tag 列直接列出現金行；其他為空陣列
  note?: { key: string; params?: Record<string, string> };  // 例如 H15、H17 擇一時，指向實際填入的列
}
interface AccountTrace {
  account: string;
  sign: 1 | -1;                        // 以什麼正負號進入這一列，例如 H16 存貨增加(-) 為 -1
  amount: Money;                       // 這一列從該科目取用的金額（依列的規則，可能是餘額、發生額、變動量或某種標籤的合計），正常餘額表示
  sources: SourceRef[];                // 視窗內構成 amount 的每一條分錄行
}
interface SourceRef {
  stepId: string;
  eventId: string;
  lineRef: string;                     // 'e1.l3'，與 JournalLine.ref 相同
  side: 'debit' | 'credit';
  amount: Money;                       // 分錄行金額（非負）
  signedAmount: Money;                 // 換算成該科目正常餘額表示的帶號金額
}
```

規則：
- `formula` 節點的值等於 `expr` 代入各子節點的值；其他節點的值等於「科目層 sign 乘 amount 的合計」加上「子節點的值」加上「現金行的帶號金額」。例如 N26 未分配盈餘有一個科目層（`retained_earnings`）與一個子節點（`is_net_income`）。
- 每個 `AccountTrace` 的 `sources` 帶號金額加總等於 `amount`；樹根的值等於報表上同一列的值。這三條都是性質測試（第 18.1 節）。
- 最底層的 `SourceRef` 指向來源步驟、事件與分錄行。畫面在「來源分錄」層展開時，用 `stepId` 與 `eventId` 取 `PostedStep.entries` 中的整筆分錄顯示（預設收合，D1 (b)），所以學生看得到這一行在整筆分錄裡的位置。
- `window: "transaction"` 時，`sources` 只列這一步的分錄行，數值是本筆變動（第 11.5 節）。
- IFRS 對照時以 `ifrs@1` 的 run 與版面呼叫同一個函式，樹的形狀依 `ifrs@1` 版面（第 10.3 節）。

例子（自編故事第 7 步之後、累計視窗，追蹤營業毛利 480,000；第 6 步現金進貨的範本是 `tpl.purchase_inventory_cash`，`l1` 為借記存貨的那一行）：

```json
{
  "line": "is_gross_profit",
  "cell": "R16",
  "value": 480000,
  "rule": "formula",
  "expr": "line.is_revenue - line.is_cogs",
  "children": [
    {
      "line": "is_revenue",
      "cell": "R10",
      "value": 1120000,
      "rule": "accounts",
      "children": [],
      "accounts": [
        {
          "account": "revenue",
          "sign": 1,
          "amount": 1120000,
          "sources": [
            { "stepId": "st_h8q3z6", "eventId": "e1", "lineRef": "e1.l2", "side": "credit", "amount": 1120000, "signedAmount": 1120000 }
          ]
        }
      ],
      "sources": []
    },
    {
      "line": "is_cogs",
      "cell": "R15",
      "value": 640000,
      "rule": "formula",
      "expr": "line.is_opening_inventory + line.is_purchases - line.is_closing_inventory",
      "children": [
        { "line": "is_opening_inventory", "cell": "R12", "value": 0, "rule": "inventory", "children": [], "accounts": [{ "account": "inventory", "sign": 1, "amount": 0, "sources": [] }], "sources": [] },
        {
          "line": "is_purchases",
          "cell": "R13",
          "value": 640000,
          "rule": "inventory",
          "children": [],
          "accounts": [
            {
              "account": "inventory",
              "sign": 1,
              "amount": 640000,
              "sources": [
                { "stepId": "st_p4n7e2", "eventId": "e1", "lineRef": "e1.l1", "side": "debit", "amount": 640000, "signedAmount": 640000 }
              ]
            }
          ],
          "sources": []
        },
        {
          "line": "is_closing_inventory",
          "cell": "R14",
          "value": 0,
          "rule": "inventory",
          "children": [],
          "accounts": [
            {
              "account": "inventory",
              "sign": 1,
              "amount": 0,
              "sources": [
                { "stepId": "st_p4n7e2", "eventId": "e1", "lineRef": "e1.l1", "side": "debit", "amount": 640000, "signedAmount": 640000 },
                { "stepId": "st_h8q3z6", "eventId": "e1", "lineRef": "e1.l4", "side": "credit", "amount": 640000, "signedAmount": -640000 }
              ]
            }
          ],
          "sources": []
        }
      ],
      "accounts": [],
      "sources": []
    }
  ],
  "accounts": [],
  "sources": []
}
```

本例中「本期進貨」只取標 `purchase` 的借方行，「期末存貨」取視窗終點的餘額，兩者的 `sources` 不同，這正是公式樹要讓學生看見的差別：營業成本 640,000 來自第 6 步的進貨，第 7 步賣出後期末存貨歸零。

### 6.5 effects

`effects` 是「影響哪些科目」的白話資料來源。D1 已決定 (b)：實驗室「科目變動」那一步以 `effects` 為主要內容；「看分錄與 T 字帳」預設收合，展開時顯示同一步的 `PostedStep.entries` 與 `buildTAccounts` 的結果（本節末）。`effects` 也給 07 的 `aria-live` 播報使用。每一步依科目合併；排序依科目表 `order`。文字由內容資料中的片語樣板產生，核心只做佔位符替換，不寫死任何語言。片語樣板裡的 `{{money:amount}}` 是核心替每一筆 effect 提供的區域值（同一筆 effect 的 `amount` 欄位）。核心輸出的 `text` 只代入名詞佔位符，`{{money:amount}}` 保留給 UI 以 `effect.amount` 格式化；`direction` 除了 `increase`、`decrease` 之外另有 `unchanged`（同一步同科目進出相抵）。佔位符依作用範圍檢查（第 16.1 節，與 05 第 10.1 節相同）：`amount` 只屬於核心的 effects 片語樣板；題目、故事與名詞等一般內容只能用 `vars.`、`<eventId>.`、`expected.<targetId>.` 與數字常值；交易範本的 `summary` 與 `explanation` 另可用 `param.`、`derived.`。

```json
{
  "stepId": "st_h8q3z6",
  "noEffect": false,
  "derivedValues": { "e1.costOfAllInventory": 640000, "e1.grossProfit": 480000 },
  "effects": [
    {
      "account": "cash",
      "element": "asset",
      "delta": 1120000,
      "amount": 1120000,
      "direction": "increase",
      "lineRefs": ["e1.l1"],
      "text": { "zh-TW": "{{term:tm_c4sh8k2p}}增加 {{money:amount}}", "en": "{{term:tm_c4sh8k2p}} increases by {{money:amount}}" }
    },
    {
      "account": "inventory",
      "element": "asset",
      "delta": -640000,
      "amount": 640000,
      "direction": "decrease",
      "lineRefs": ["e1.l4"],
      "text": { "zh-TW": "{{term:tm_n7v3k8pq}}減少 {{money:amount}}", "en": "{{term:tm_n7v3k8pq}} decreases by {{money:amount}}" }
    },
    {
      "account": "revenue",
      "element": "revenue",
      "delta": 1120000,
      "amount": 1120000,
      "direction": "increase",
      "lineRefs": ["e1.l2"],
      "text": { "zh-TW": "{{term:tm_v3n8q2ye}}增加 {{money:amount}}", "en": "{{term:tm_v3n8q2ye}} increases by {{money:amount}}" }
    },
    {
      "account": "cost_of_goods_sold",
      "element": "expense",
      "delta": 640000,
      "amount": 640000,
      "direction": "increase",
      "lineRefs": ["e1.l3"],
      "text": { "zh-TW": "{{term:tm_g5c2m8tw}}增加 {{money:amount}}", "en": "{{term:tm_g5c2m8tw}} increases by {{money:amount}}" }
    }
  ]
}
```

「看分錄與 T 字帳」的資料（D1 (b)）。分錄直接取 `PostedStep.entries`，不另外產生；T 字帳由 `buildTAccounts` 從同一組分錄行推導，預設只回傳這一步有變動的科目：

```ts
interface TAccount {
  account: string;
  opening: Money;                      // 帳本起點的期初餘額（故事恆為 0；自訂期初的情境為期初值），正常餘額表示
  debits: { stepId: string; lineRef: string; amount: Money }[];   // 起點到 upToStep（含）的借方行，依步驟順序
  credits: { stepId: string; lineRef: string; amount: Money }[];
  closing: Money;                      // 等於 upToStep 的 balancesAfter 換算成正常餘額表示
  highlight: string[];                 // 這一步新增的 lineRef，畫面用來標出剛剛記上的那一行
}
```

T 字帳和分錄都是展示用的推導值，學生不能在這裡改數字；自由實驗的修改仍以 `(stepId, eventId, param)` 覆寫（第 9.2 節）。`journal_entry` 題目的作答介面是另一個元件，只出現在「借貸與分錄」延伸章（第 14 節）。

### 6.6 自由實驗的錯誤範例

自編故事中，第 10 筆把全部存貨賒銷 5,600,000，第 12 筆收回應收帳款 3,900,000。學生把第 10 筆的售價改成 3,200,000，重播到第 12 筆時應收帳款會變成 -700,000。核心擋下，並回報這個參數的可輸入範圍（此例是最小值，因為賒銷金額不能低於後面已收回的金額）：

```json
{
  "ok": false,
  "error": {
    "code": "balance.negative",
    "at": { "stepId": "st_m2x8r5", "eventId": "e1" },
    "account": "accounts_receivable",
    "balanceAfter": -700000,
    "edited": { "stepId": "st_c6w1q4", "eventId": "e1", "param": "price" },
    "allowedRange": { "min": 3900000, "max": 999999999999 },
    "message": {
      "key": "lab.error.negative_balance",
      "params": { "account": "accounts_receivable", "stepId": "st_m2x8r5" }
    }
  }
}
```

## 7. 交易範本 schema

```ts
type CashFlowKind =
  | 'receipts_from_customers' | 'payments_to_suppliers' | 'payments_for_operating_expenses'
  | 'interest_paid' | 'income_tax_paid' | 'other_operating_receipts'
  | 'capex' | 'loans_advanced' | 'loans_collected' | 'other_investing_payments' | 'disposal_proceeds'
  | 'st_borrowing_proceeds' | 'st_borrowing_repayment' | 'lt_borrowing_proceeds' | 'lt_borrowing_repayment'
  | 'share_issue' | 'dividends_paid';
interface CashFlowTag { activity: 'operating' | 'investing' | 'financing'; kind: CashFlowKind }
type InventoryTag = 'purchase' | 'cost_of_sale' | 'count_overage' | 'count_shortage';

interface TransactionTemplate {
  id: string;                        // 'tpl.sell_all_inventory_cash'，tpl. 前綴的語意 ID，發布後不改、不重用（第 16.1 節）
  rev: number;
  revKind: 'text' | 'answer';        // 改版種類（見 08）
  status: 'draft' | 'published' | 'retired';   // 不設 review（已決定 D10(g)）
  title: LocalizedText;
  summary: LocalizedText;            // 交易卡文字（08 第 3.8 節）；範本範圍的佔位符 {{money:param.x}}、{{money:derived.y}} 引用本範本的參數與推導值，顯示時由核心代入該事件的值（等同故事或題目中的 e1.x）；作用範圍見第 16.1 節
  params: ParamSpec[];
  derived: DerivedSpec[];            // 依陣列順序求值，只能引用排在前面的 derived
  preconditions: Precondition[];
  lines: LineSpec[];
  explanation: LocalizedText;
  termRefs: string[];
  pendingRefs?: string[];            // 例如 ['T06']；相關設計決定的編號（14 的 T 系列），畫面顯示「設計說明」，不影響計分
  entryQuestionBlockedBy?: string[]; // 例如 ['T04']；非空時不得用這個範本在延伸章出分錄題（第 14 節）。機制保留，2026-10-23 起沒有範本使用
}

interface ParamSpec {
  name: string;                      // 範本內唯一，運算式以 param.<name> 引用
  type: 'money' | 'count' | 'rate' | 'years';
  min: number;
  max: number;
  default: number;
  label: LocalizedText;
  monotonic?: 'increasing' | 'decreasing' | 'none'; // 可輸入範圍搜尋用（第 9.3 節）
}

interface DerivedSpec {
  name: string;                      // 運算式以 derived.<name> 引用
  type: 'money' | 'number';
  expr: string;                      // 受控運算式（第 8 節）
  label: LocalizedText;
}

interface Precondition { id: string; expr: string; message: LocalizedText }  // expr 的型別必須是 bool

interface LineSpec {
  id: string;                        // 範本內唯一，例如 'l1'
  account: string;
  side: 'debit' | 'credit';
  amount: string;                    // 結果型別必須是整數，不可使用 round()
  cf?: CashFlowTag;                  // cash 行必填且只能一個
  tag?: LineTag;                     // inventory 行必填存貨類標籤；借記未分配盈餘時填 dividend 或 reserve_appropriation
  policyWhen?: Partial<PolicySwitches>;   // 只在符合的政策開關下產生這一行
  memo?: LocalizedText;
}
```

欄位名稱與 08 第 3.8 節一致（`title`、`summary`、`explanation`、陣列形式的 `params` 與 `derived`、`preconditions`、`lines`、`termRefs`、`pendingRefs`、`entryQuestionBlockedBy`）；08 第 3.8 節只列管理上的意義，型別與語意以本節為準。「其他政策的替代分錄行」一律寫成每一行的 `policyWhen`，不另設範本層級的欄位。`pendingRefs` 與 `entryQuestionBlockedBy` 並存、用途不同：前者是相關設計決定的編號（14 的 T 系列），讓實驗室顯示「設計說明」而不是「待確認」，不影響計分；後者阻擋用這個範本出分錄題（第 14 節）。已決定（2026-10-23）：T 系列已全部依專業判斷決定，所以沒有範本帶 `entryQuestionBlockedBy`；機制保留給日後真正懸而未決的做法。

建置期檢查（`content:compile`）：
- 所有運算式都能解析，引用的參數、推導值、科目都存在，型別正確，`derived` 沒有循環引用。
- 借貸平衡：若每條行的金額都是參數與推導值的線性組合，先做符號比對（借方與貸方的組合化簡後相同）；另外在參數範圍內隨機抽樣（fast-check）實例化，確認每次都平衡。帶 `policyWhen` 的範本，對每一套已實作的政策（`teacher@1`；M4b 起加上 `ifrs@1`）分別篩選後檢查，引用的科目也必須在該政策下啟用。
- 每條現金行恰好一個 `cf`；每條存貨行有存貨類的 `tag`。
- `summary` 與 `explanation` 的中英佔位符集合一致（見 05）；數值佔位符只用範本範圍允許的 `param.`、`derived.` 與數字常值，引用的名稱必須在 `params` 或 `derived` 宣告過（第 16.1 節）。
- 已發布的範本被修改時，`rev` 必須遞增；影響金額的修改 `revKind` 必須是 `answer`。

## 8. 受控運算式

### 8.1 文法（EBNF）

```text
expr     = or ;
or       = and { "||" and } ;
and      = cmp { "&&" cmp } ;
cmp      = add [ ( "==" | "!=" | "<" | "<=" | ">" | ">=" ) add ] ;
add      = mul { ( "+" | "-" ) mul } ;
mul      = unary { ( "*" | "/" ) unary } ;
unary    = [ "-" | "!" ] primary ;
primary  = number | ref | call | "(" expr ")" ;
number   = digit { digit } [ "." digit { digit } ] ;
ref      = ns "." ident [ "." ident ] ;
ns       = "param" | "derived" | "line" | "input" | "ratio" ;
call     = fname "(" [ arg { "," arg } ] ")" ;
arg      = expr | accountId ;
fname    = "balance" | "cost" | "round" | "min" | "max" | "avg" ;
ident    = lower { lower | upper | digit | "_" } ;  (* 最長 64 字元；參數與推導值可用 camelCase *)
accountId = lower { lower | digit | "_" } ;      (* snake_case，必須存在於科目表 *)
```

不支援字串、屬性存取、陣列、迴圈、自訂函式、科學記號與十六進位。單一運算式最長 300 字元、AST 最多 256 個節點、最深 32 層。

### 8.2 各情境可用的參照與函式

| 使用位置 | 可用參照 | 可用函式 | 結果型別 |
| --- | --- | --- | --- |
| 範本 `derived` | `param.*`、先宣告的 `derived.*` | `balance`、`cost`、`round`、`min`、`max` | `money` 必須是整數；`number` 可為有理數 |
| 範本 `lines[].amount` | `param.*`、`derived.*` | `balance`、`cost`、`min`、`max`（不可用 `round`） | 整數 |
| `preconditions` | 同 `derived` | 同 `derived`，加上比較與 `&&`、`\|\|`、`!` | 布林 |
| 指標公式 | `line.*`、`input.*`、`ratio.<id>.<version>`（連鎖） | `avg`、`min`、`max` | 有理數 |
| 版面公式列 | `line.*` | 無 | 整數 |

函式語意：
- `balance(id)`：該科目在「這個事件之前」的正常餘額。同一步裡的第二個事件，看得到第一個事件的結果。
- `cost(id)`：該資產科目累計的借方合計（取得成本），用在直接減少帳面的科目，例如設立費攤銷時，攤銷不會改變 `cost`。
- `round(x)`：四捨五入到整數，負數遠離 0。
- `avg(line.x)`：期初與期末的平均；單期資料時回傳期末數，並在指標結果加上 `single_period_approx` 標記（評估四）。

### 8.3 型別規則

型別只有三種：整數 `int`（金額、件數）、有理數 `rat`（比率、除法結果、帶小數的字面值）、布林 `bool`。`int` 加減乘 `int` 得 `int`；任何除法得 `rat`；`rat` 參與的運算得 `rat`；`round(rat)` 得 `int`；`min`、`max` 取較寬的型別；比較與邏輯運算得 `bool`。宣告為 `money` 的 `derived` 與所有分錄行金額，型別必須是 `int`，否則建置失敗並回傳 `expr.round_required`。

### 8.4 AST 與求值

建置期把運算式編譯成 AST 並存進內容快照，學習端不載入 parser。下面是 `round(cost(machinery_equipment) / param.usefulLifeYears)` 的 AST：

```json
{
  "type": "call",
  "fn": "round",
  "valueType": "int",
  "args": [
    {
      "type": "binary",
      "op": "/",
      "valueType": "rat",
      "left": {
        "type": "call",
        "fn": "cost",
        "valueType": "int",
        "args": [{ "type": "account", "id": "machinery_equipment" }]
      },
      "right": { "type": "ref", "ns": "param", "name": "usefulLifeYears", "valueType": "int" }
    }
  ]
}
```

求值器是一個對節點種類做 `switch` 的純函式，用 bigint 有理數運算；參照一律從 `Map` 查詢，名稱先以 `^[a-z][A-Za-z0-9_]{0,63}$` 驗證，因此不會碰到 `__proto__` 之類的原型屬性。沒有 eval、沒有 `new Function`，也沒有動態屬性存取。執行期可能發生的錯誤只有 `expr.division_by_zero` 與金額溢位，兩者都以 `Result` 回傳，實驗室會擋下該步並顯示原因。

## 9. 故事、步驟與自由實驗

### 9.1 型別

```ts
interface Story {
  id: string;                    // 'story_' 加 6 碼，例如 'story_q7m2v9'（08 第 4.1 節）
  rev: number;
  revKind: 'text' | 'answer';
  status: 'draft' | 'published' | 'retired';
  title: LocalizedText;
  origin: 'teacher' | 'original';         // teacher：老師授權的情境與金額（D2），畫面標示「經陳彥宏老師授權使用」，不在 CC BY-SA 授權範圍內（D6）；original：網站原創情境
  company: { name: LocalizedText };       // 原創公司名稱（D9：M4 前由規劃者提案、你確認）
  ledger: { currency: 'TWD'; scale: 0 };  // 宣告在帳本層級（第 3 節）
  opening?: Record<string, Money>;        // 期初餘額，預設全部為 0（故事累計模型，W06）
  policy: 'teacher@1';
  layout: 'teacher@1';
  steps: StoryStep[];
}

interface StoryStep {
  id: string;                    // 'st_' 加 6 碼，例如 'st_h8q3z6'；插入新步驟不影響既有 ID
  order: number;                 // 排序用，可以重排
  title: LocalizedText;
  narrative: LocalizedText;
  events: StoryEvent[];          // 一步可以有多個事件，依序過帳
  termRefs: string[];
  chapterLinks?: { chapter: string; level?: string }[];  // 步驟末連到的闖關區章節（ch_）；level 選填，指定該章的關卡（lv_）
  checkpoints?: Checkpoint[];    // 黃金測試用：只用在 repo 內自編數字的測試故事；正式故事（origin 為 teacher）不填，CI 只跑性質測試（D2，第 18 節）
  // 08 第 3.9 節建議的其他步驟欄位（predictTargets、stakeholders、verification）照 08，核心不讀
}

interface StoryEvent {
  id: string;                    // 步驟內唯一，寫成 'e1'、'e2'；佔位符與追蹤用它引用參數與推導值
  template: string;
  params: Record<string, number>;
  pendingRefs?: string[];        // 選填，列出 T 編號：這個事件的處理有設計決定（14 第 2 節），實驗室顯示「設計說明」；與範本層級的 entryQuestionBlockedBy（阻擋出分錄題）用途不同
}

interface Checkpoint { ref: string; value: number }  // 'e1.amount'（推導值）或線 ID，例如 'cf_depreciation'
```

`labRef` 一律用步驟 ID，不用索引；故事插入步驟或日後調整金額都不會指錯。步驟 ID 全站唯一，`labRef` 另帶故事 ID 方便載入，寫成 `{ "story": "story_q7m2v9", "step": "st_h8q3z6" }`（與 08 第 3.6 節相同）；validator 檢查步驟屬於該故事。

`chapterLinks` 每筆寫成 `{ "chapter": "ch_n3f8q1" }` 或 `{ "chapter": "ch_n3f8q1", "level": "lv_6d2q9w4h" }`，與 03 第 3.2 節、08 第 3.9 節的形狀相同；有 `level` 時章末卡直接連到該關，沒有時連到章節頁，validator 檢查關卡屬於該章。故事事件的形狀是 `{ id, template, params, pendingRefs? }`：`pendingRefs` 選填，用來標出這個故事裡的事件有哪些設計決定（畫面顯示「設計說明」，2026-10-23 起不再是「待老師確認」）；範本層級的 `entryQuestionBlockedBy` 則決定能不能用這個範本出分錄題，兩者用途不同。

已決定（D10(b)，2026-10-20）：C，連續故事為主線，每一步另有「單獨練習」入口，沿用故事在該步之前的狀態。資料上不另存一份練習用的故事：單獨練習的起點寫成第 15 節的 `scenario.opening`，`{ "storyRef": "<故事 ID>", "afterStep": "<前一步的 ID>" }`，事件取該步的 `events`；第一步沒有前一步，起點是全部為 0 的期初 `{ "balances": {} }`。所以練習的起點和連續故事在同一步看到的狀態相同，核心的過帳與報表 API 都不用改。入口的路由見 02（故事步驟頁中文為 `/lab/story/<storyId>/<stepId>/`，英文在前面加 `/en/`）。未採用的選項：A 只有連續故事（從中間開始需要說明前情）、B 只有獨立情境（失去故事感，累計概念難呈現）、D 另寫一套獨立情境（路由與資料兩套，內容與測試量最大）。

故事資料的來源（已決定 D2，2026-10-20）：正式故事 `origin` 為 `teacher`，按照老師的情境與金額（老師已同意公開），敘述文字以網站自己的話撰寫，疑似誤植的交易（例如第 12 筆）依 13 的建議處理並在交易卡加註。情境不夠時，延伸章、自由實驗與故事沒有涵蓋的交易另建 `origin` 為 `original` 的原創故事，或直接用題目自己的 `scenario`。repo 內的測試故事（例如第 17 節的青檸文具社）也是 `original`，只放在測試 fixtures，不進發布快照。

### 9.2 故事模式與自由實驗

- 故事模式：正式故事的交易卡顯示老師的金額（D2）。repo 內自編數字的測試故事以黃金測試斷言推導型步驟的值等於 `checkpoints`；正式故事在 CI 只跑性質測試，與老師 Excel 的逐格比對只在本機（第 18 節）。
- 自由實驗：學生改的是 `(stepId, eventId, param)` 的覆寫，核心從頭重播。後面依帳上狀態推導的金額會跟著變（例如賣出全部存貨的成本、付清貨款的金額）；固定金額的參數維持原值，若因此違反餘額規則就擋下。
- 金額為 0 合法，該行在驗證前移除；整步都是 0 時顯示「本筆無影響」。
- 未分配盈餘與權益可以為負；資產、負債與機器設備淨額不能為負（第 6.3 節）。
- IFRS 對照（D10(f)，M4b）：同一組覆寫以 `ifrs@1` 重播一次，兩套結果各自檢查餘額規則；某一步只在其中一套被擋下時，畫面在那一套顯示原因，另一套照常顯示。

### 9.3 可輸入範圍

被擋下時，`allowedRange` 對被修改的參數做整數二分搜尋：每次試一個值就重播整個故事，找出讓所有後續步驟都合法的最大值或最小值。故事最多約 30 步、每次搜尋約 40 次重播，成本很低。只有宣告 `monotonic` 的參數才搜尋；`monotonic: "none"` 時只回報第幾步、哪個科目、差多少，不給範圍。

### 9.4 推導型步驟對照（建議初稿）

| 交易類型 | 範本 | 跟著帳上狀態的值 | 其餘參數 |
| --- | --- | --- | --- |
| 第 7 筆 以現金賣出全部存貨 | `tpl.sell_all_inventory_cash` | 成本＝`balance(inventory)` | 售價固定 |
| 第 10 筆 賒銷全部存貨 | `tpl.sell_all_inventory_credit` | 成本＝`balance(inventory)` | 售價固定 |
| 第 11 筆 付清貨款 | `tpl.pay_all_payables` | 金額＝`balance(accounts_payable)` | 無 |
| 第 12 筆 收回部分帳款 | `tpl.collect_receivables` | 無 | 金額固定；超過帳上應收帳款時由第 6.3 節的餘額規則擋下（錯誤碼 `balance.negative`，見第 6.6 節）【待確認 T08】；正式故事依 13 的建議處理並在交易卡加註 |
| 第 15 筆 還清短期借款並付息 | `tpl.repay_all_short_term_loans_with_interest` | 本金＝`balance(short_term_borrowings)` | 利息固定。也可以拆成「還本」「付息」兩個事件放在同一步，分錄與報表結果相同；本文件用單一範本示範一筆付款拆成兩種現金流量活動（第 17.8 節） |
| 第 16 筆 盤點 | `tpl.inventory_count` | 差額＝`countedAmount` 減帳上存貨 | 盤點後金額固定【待確認 T06】 |
| 第 17 筆 折舊與攤銷 | `tpl.depreciation_straight_line`、`tpl.amortise_org_costs` | `round(cost ÷ 年數)`，並以帳面淨額為上限 | 年數固定；攤銷年數【待確認 T04】；折舊採直線法、無殘值、提列一整年的假設已決定採用（2026-10-23，見 14 第 5.1 節） |

其他步驟（成立、進貨、借款、各項費用、所得稅）都是固定金額。所得稅照故事設定的金額直接付現（借 所得稅費用／貸 現金），不由稅率推算【待確認 T10】。

## 10. 認列政策與表達版面

### 10.1 兩層模型

- **認列政策 `policy`**：決定「記哪些科目、金額多少、現金行屬於哪個活動」。作用在範本層級，透過 `policyWhen` 選擇分錄行。
- **表達版面 `layout`**：決定「科目怎麼排進報表的哪一列、列名是什麼、哪些列要顯示」。作用在報表產生階段。
- 同一本帳換版面只會改變呈現；要得到 IFRS 的數字，必須換政策重新過帳。所以 IFRS 對照是「policy 加 layout」的組合（`ifrs@1` 政策加 `ifrs@1` 版面，已決定 D10(f)，第 10.3 節），不是只換版面。
- 每一套政策另列出啟用的科目：`teacher@1` 停用 `organisation_costs_expense`；`ifrs@1` 停用 `deferred_organisation_costs`、`amortisation_deferred_assets`、`extraordinary_gains`、`extraordinary_losses`。過帳引用停用的科目時回傳 `entry.account_disabled`（第 6.2 節）。

```ts
interface PolicySwitches {
  orgCosts: 'capitalise_amortise' | 'expense';
  inventoryOverage: 'reduce_cogs' | 'non_operating_income' | 'extraordinary_gain';
  inventoryShortage: 'increase_cogs';
  incomeTax: 'cash_direct' | 'accrue_then_pay';
  interestPaidActivity: 'operating' | 'financing';
  officeSupplies: 'expense_on_purchase' | 'asset_then_expense';
}
interface LayoutOptions {
  amortisationSection: 'non_operating' | 'operating';
  amortisationAddBack: 'H14' | 'H12';
  showOrdinaryIncome: boolean;
  showExtraordinaryRows: boolean;
  showExtensionRows: 'when_nonzero' | 'always' | 'never';
  excelExportClosingInventorySign: 'negative';
}
```

### 10.2 `teacher@1` 與 `ifrs@1` 的設定

`ifrs@1` 只改變 IFRS 和教材真正不同的地方（設立費與版面），其他開關沿用 `teacher@1`，讓對照畫面上的差額都能歸因到同一個原因。

| 開關 | `teacher@1` | `ifrs@1`（M4b） | 可選值 | 影響 | 待確認 |
| --- | --- | --- | --- | --- | --- |
| `orgCosts` | `capitalise_amortise`：設立費列遞延資產，依年數直線攤銷、直接減少帳面；付現列 H26 | `expense`：依 IAS 38.69 發生時列營業費用（`organisation_costs_expense`），付現列營業活動，之後不攤銷 | `capitalise_amortise`、`expense` | 稅前淨利、資產、各活動金額、允當比率 | T04、T30 |
| `amortisationSection`（版面） | `non_operating`：攤銷遞延資產列營業外支出；折舊列銷管費用 | 不適用（沒有攤銷遞延資產） | `non_operating`、`operating` | 營業利益、DOL、DFL、營業利益佔實收資本比率 | T05 |
| `amortisationAddBack`（版面） | H14 | 不適用 | H14、H12 | 只影響間接法哪一列 | T12 |

M1 的版面以列資料為準，`amortisationSection` 與 `amortisationAddBack` 這兩個選項只作記錄，切換時要同時改列資料（`is_amortisation` 所在的分組、`cf_depreciation` 與 `cf_other_noncash_losses` 的科目清單；`packages/core/test/data.test.ts` 有測試守住一致性）。
| `inventoryOverage` | `reduce_cogs` | `reduce_cogs`（沿用教材口徑；`ifrs@1` 不允許 `extraordinary_gain`） | `reduce_cogs`、`non_operating_income`、`extraordinary_gain` | 毛利、營業利益、存貨週轉率與平均銷貨日數、DOL、DFL、營業利益佔實收資本比率；列非常利益時另影響經常利益；稅前淨利不變 | T06 |
| `incomeTax` | `cash_direct` | `cash_direct`（兩邊都沿用故事設定的金額） | `cash_direct`、`accrue_then_pay` | 應付所得稅、H22 的時點 | T10、T36 |
| `interestPaidActivity` | `operating`（H21） | `operating`（IAS 7 目前允許營業或籌資，沿用教材以免混入第二個差異） | `operating`、`financing` | 營業與籌資活動金額 | T11 |
| `officeSupplies` | `expense_on_purchase`（W01） | `expense_on_purchase` | `expense_on_purchase`、`asset_then_expense` | 事務用品費的時點 | W01 |
| `showOrdinaryIncome`、`showExtraordinaryRows`（版面） | 顯示 | 隱藏（IFRS 沒有經常利益；IAS 1.87 禁止非常項目） | 顯示、隱藏 | 五層利益的第 3、4 層 | T01、T02、T03 |

M1 只實作 `teacher@1`。schema 保留 `policyWhen` 與替代值，讓老師回覆後可以只改資料切換做法，不用改核心。M4b 依 D10(f) C 實作 `ifrs@1`（第 10.3 節）。計分題的 `scenario.policy` 只允許 `teacher@1`；`ifrs@1` 只用在實驗室的 IFRS 對照，不進任何題目。

`ifrs@1` 以目前的 IAS 1 與 IAS 7 為準。IFRS 18 會改變損益表小計與支付利息的分類，台灣適用年度見 11；屆時 IFRS 對照另立新版本，不改 `ifrs@1`。

### 10.3 IFRS 對照：`ifrs@1` 的版面、差距與黃金測試（已決定 D10(f)）

已決定（D10(f)，2026-10-20）：C，實驗室可以切換整套 IFRS 三表與指標，不計分；M4b 實作 `ifrs@1` 政策與版面並加上黃金測試；IFRS 畫面明確標示「IFRS 對照，不計分」；闖關區一律以教材口徑計分。

切換的做法：實驗室以 `ctx.policy = ifrs@1` 重播同一個故事與同一組自由實驗覆寫，再以 `ifrs@1` 版面產生三表、指標與追蹤樹（第 2 節）。範本以每一行的 `policyWhen` 選出 `ifrs@1` 的分錄行，例如第 5 筆設立費的範本（節錄，其他欄位見第 7 節）：

```jsonc
{
  "id": "tpl.pay_org_costs",
  "lines": [
    { "id": "l1", "account": "deferred_organisation_costs", "side": "debit", "amount": "param.amount", "policyWhen": { "orgCosts": "capitalise_amortise" } },
    { "id": "l2", "account": "cash", "side": "credit", "amount": "param.amount", "cf": { "activity": "investing", "kind": "capex" }, "policyWhen": { "orgCosts": "capitalise_amortise" } },
    { "id": "l3", "account": "organisation_costs_expense", "side": "debit", "amount": "param.amount", "policyWhen": { "orgCosts": "expense" } },
    { "id": "l4", "account": "cash", "side": "credit", "amount": "param.amount", "cf": { "activity": "operating", "kind": "payments_for_operating_expenses" }, "policyWhen": { "orgCosts": "expense" } }
  ],
  "pendingRefs": ["T04", "T30"],
  "entryQuestionBlockedBy": ["T04"]
}
```

第 17 筆的 `tpl.amortise_org_costs` 兩行都只在 `capitalise_amortise` 下產生，所以在 `ifrs@1` 下這個事件「本筆無影響」，同一步的折舊事件照常過帳。

`ifrs@1` 版面和 `teacher@1` 版面的差別：

| 項目 | `teacher@1` 版面 | `ifrs@1` 版面 |
| --- | --- | --- |
| 損益表層次 | 五層利益：營業毛利、營業利益、經常利益、稅前淨利、本期淨利 | 營業毛利、營業利益、稅前淨利、本期淨利；不顯示經常利益與非常損益 |
| 營業成本 | R12 到 R15 四列 | 只顯示一列；期初存貨、本期進貨、期末存貨保留為不顯示的計算列，供指標公式使用 |
| 營業費用 | 銷管費用小計 R23（折舊在內） | 同一條線 `is_sga_total`，列名用「營業費用」，另含設立費費用化的金額 |
| 營業外支出 | 支付利息 R27 加攤銷遞延資產 R28 | 只有財務成本（`is_interest_expense`），沒有攤銷列 |
| 稅前淨利公式 | R30 ＋ R31 － R32 | 營業利益 ＋ 營業外收入 － 營業外支出小計 |
| 資產負債表 | 含遞延資產（設立費、開發費） | 沒有遞延資產列；開發費符合 IAS 38.57 才列無形資產（故事未用） |
| 間接法 | 起算點稅前淨利；H14 加回攤銷 | 起算點同為稅前淨利；沒有攤銷加回；設立費付現在營業活動，不在 H26 |
| 列名 | 教材用語（依 D13 A 的顯示字） | 現行台灣用語與 IFRS 英文（`labels.currentTw`、`labels.ifrsEn`） |
| 儲存格與匯出 | 每列有 `cell`，可匯出成老師的 Excel 格式 | `cell` 為 null，不提供 Excel 匯出 |
| 標記 | 非 IFRS 項目在中英兩種介面都加標記：中文「非 IFRS 項目」、英文「Not an IFRS line item」（D11） | 整張報表標示「IFRS 對照，不計分」 |

兩套版面中語意相同的列共用同一個線 ID（例如 `is_pretax_income`、`bs_total_assets`、`cf_operating_total`），所以指標登錄檔不用改。老師 Excel 的 23 項 `excel` 版指標只引用兩套版面都有的列（含上表的計算列）；日後若有指標版本引用 `ifrs@1` 沒有的列，建置期列出，畫面在 IFRS 對照中顯示「不適用」。五步驟檢查在 IFRS 對照中照常計算，步驟①的 `ordinaryIncome` 為 null（第 13 節）。

正式故事的差距：下表是對正式故事（老師的情境與金額，D2）18 筆的推算（推論，待老師的 Excel 核對【待確認 T33】），只用來說明「換政策會改變金額」，不是範例資料，也不寫進 repo 的測試；所得稅兩邊都沿用故事設定的金額【待確認 T10】。

| 指標 | `teacher@1` | `ifrs@1` | 差額 |
| --- | --- | --- | --- |
| 稅前淨利 | 7,590,000 | 7,350,000 | -240,000 |
| 本期淨利 | 4,590,000 | 4,350,000 | -240,000 |
| 營業活動現金流量 | -1,250,000 | -1,550,000 | -300,000 |
| 投資活動現金流量 | -800,000 | -500,000 | +300,000 |
| 期末現金 | 950,000 | 950,000 | 0 |

黃金測試的期望值（自編青檸文具社故事第 18 步之後，數字由本文件手算，實作時以計算表逐筆核對）：設立費 150,000 改為當期費用，少記攤銷 30,000，所以稅前淨利淨減 120,000；付出的 150,000 由投資活動移到營業活動，期末現金不變。

| 項目 | `teacher@1` | `ifrs@1` | 差額 |
| --- | --- | --- | --- |
| 銷管費用小計（`ifrs@1` 列名：營業費用） | 836,000 | 986,000 | +150,000 |
| 營業利益 | 2,864,000 | 2,714,000 | -150,000 |
| 營業外支出小計 | 57,000 | 27,000 | -30,000 |
| 稅前淨利 | 2,807,000 | 2,687,000 | -120,000 |
| 本期淨利 | 2,247,000 | 2,127,000 | -120,000 |
| 資產總計（L29） | 4,647,000 | 4,527,000 | -120,000 |
| 營業活動（H23） | 247,000 | 97,000 | -150,000 |
| 投資活動（H29） | -510,000 | -360,000 | +150,000 |
| 籌資活動（H36） | 2,400,000 | 2,400,000 | 0 |
| 期末現金（H41 ＝ L12） | 2,137,000 | 2,137,000 | 0 |

`ifrs@1` 一側的核對：直接法的營運產生之現金是 5,020,000 － 3,440,000 － 896,000 ＝ 684,000（營業費用付現多了設立費 150,000），等於間接法的 H20（2,687,000 ＋ 90,000 ＋ 27,000 － 1,700,000 － 420,000）；權益 2,400,000 ＋ 2,127,000 ＝ 4,527,000，等於資產總計，四個勾稽點的差額都是 0。

## 11. 教材版面三表

所有線 ID 都是穩定的語意 ID，題目的 `targets` 與指標公式引用線 ID；`cell` 只用於對照老師 Excel、匯出與本機測試。

### 11.1 損益表與五層利益

| 列 | 線 ID | 教材標籤 | 來源 |
| --- | --- | --- | --- |
| R10 | `is_revenue` | 營業收入 | `revenue` 發生額 |
| R12 | `is_opening_inventory` | 期初存貨 | 第 5.2 節 |
| R13 | `is_purchases` | 本期進貨 | 第 5.2 節 |
| R14 | `is_closing_inventory` | 期末存貨(-) | 第 5.2 節，正數顯示 |
| R15 | `is_cogs` | 營業成本小計 | R12＋R13－R14 |
| R16 | `is_gross_profit` | 1. 營業毛利 | 公式 |
| R18 到 R22 | `is_directors_remuneration` 等 | 董監事酬勞、外包費用、包裝運送費、事務用品費、折舊費用 | 各費用科目發生額 |
| R23 | `is_sga_total` | 銷管費用小計 | R18 到 R22 合計 |
| R24 | `is_operating_income` | 2. 營業利益 | 公式 |
| R25 | `is_non_operating_income` | 營業外收入 | `non_operating_income` 發生額 |
| R27 | `is_interest_expense` | 支付利息（主要顯示「利息費用」，已決定【待確認 T11】，2026-10-23；教材原字為別名） | `interest_expense` 發生額 |
| R28 | `is_amortisation` | 攤銷遞延資產 | `amortisation_deferred_assets` 發生額 |
| R29 | `is_non_operating_expense_total` | 營業外支出小計 | R27＋R28 |
| R30 | `is_ordinary_income` | 3. 經常利益 | 公式 |
| R31 | `is_extraordinary_gains` | 非常利益 | `extraordinary_gains` 發生額 |
| R32 | `is_extraordinary_losses` | 非常損失 | `extraordinary_losses` 發生額 |
| R33 | `is_pretax_income` | 4. 稅前淨利 | 公式 |
| R34 | `is_income_tax_expense` | 所得稅費用 | `income_tax_expense` 發生額 |
| R35 | `is_net_income` | 5. 本期淨利 | 公式 |

| 層 | 名稱 | 公式 | 說明與待確認 |
| --- | --- | --- | --- |
| 1 | 營業毛利 | 營業收入 － 營業成本（R10 － R15） | 營業成本由存貨帳推導（第 5 節） |
| 2 | 營業利益 | 營業毛利 － 銷管費用小計（R16 － R23） | 折舊在銷管費用【待確認 T05】；「銷管費用」別名「營業費用」（W09） |
| 3 | 經常利益 | 營業利益 ＋ 營業外收入 － 營業外支出小計（R24 ＋ R25 － R29） | IFRS 沒有這個小計，中英兩種介面都加非 IFRS 項目標記（中文「非 IFRS 項目」、英文「Not an IFRS line item」，標記文字見 05；D11）【待確認 T01】；`ifrs@1` 版面不顯示這一層；教材部分頁把它和稅前淨利併成一列【待確認 T03】 |
| 4 | 稅前淨利 | 經常利益 ＋ 非常利益 － 非常損失（R30 ＋ R31 － R32） | 非常損益 IAS 1.87 禁止【待確認 T02】；沒有非常損益時第 3、4 層相等 |
| 5 | 本期淨利 | 稅前淨利 － 所得稅費用（R33 － R34） | 所得稅金額【待確認 T10】 |

### 11.2 資產負債表

| 列 | 線 ID | 教材標籤 | 來源 |
| --- | --- | --- | --- |
| L12 | `bs_cash` | 現金及約當現金 | `cash` 餘額 |
| L13 | `bs_accounts_receivable` | 應收帳款 | 餘額 |
| L14 | `bs_inventory` | 存貨 | 餘額（＝R14） |
| L15 | `bs_short_term_loans_receivable` | 短期放貨（主要顯示「短期放款」，已決定【待確認 T09】，2026-10-23；原字為別名） | 餘額 |
| 模板無 | `bs_current_assets` | 流動資產合計 | L12 到 L15 |
| L19 | `bs_machinery_net` | 機器設備 | 成本減累計折舊（W02） |
| 模板無 | `bs_ppe_gross` | 不動產、廠房及設備毛額 | 機器設備成本；只給 `slides03` 版指標使用 |
| L20 | `bs_intangible_assets` | 無形資產 | 餘額 |
| L21 | `bs_investments_other` | 投資其他資產 | 餘額 |
| L24 | `bs_deferred_org_costs` | 設立費 | 餘額（已直接扣除攤銷） |
| L25 | `bs_deferred_dev_costs` | 開發費 | 餘額 |
| L29 | `bs_total_assets` | 資產統計（顯示「資產總計」，原字列為別名；W08，已決定 D13 A） | L12 到 L15、L19 到 L21、L24、L25 合計 |
| N12 到 N15 | `bs_accounts_payable` 等 | 應付帳款、短期借款、應付所得稅、保證金 | 餘額 |
| 模板無 | `bs_current_liabilities` | 流動負債合計 | N12 到 N15 |
| N17 | `bs_long_term_borrowings` | 長期借款 | 餘額 |
| 模板無 | `bs_noncurrent_liabilities`、`bs_total_liabilities` | 非流動負債合計、負債總額 | N17；流動加非流動 |
| N21、N22、N24、N25 | `bs_share_capital` 等 | 股本、資本公積、法定與特別盈餘公積 | 餘額 |
| N26 | `bs_retained_earnings` | 未分配盈餘 | `retained_earnings` 餘額 ＋ 視窗內本期淨利（R35） |
| N27、N28 | `bs_valuation_adjustments`、`bs_share_subscription_rights` | 評價及換算差額、新股預約申購權 | 餘額 |
| 模板無 | `bs_total_equity` | 權益總額 | N21 到 N28 |
| N29 | `bs_total_liabilities_equity` | 負債及股東權益統計（顯示「負債及股東權益總計」，原字列為別名；W08，已決定 D13 A） | 負債總額＋權益總額 |

`retained_earnings` 帳戶只記期初結轉、股利與提列公積；本期損益不結帳，由版面在 N26 加上本期淨利，所以 N26 ＝ 期初未分配盈餘 ＋ 本期淨利 － 股利 － 提列公積（W05）。

### 11.3 間接法現金流量表：H10 到 H41 對應表

共同規則：
- Δ 表示視窗內的淨變動（期末減期初），以正常餘額表示。下表的規則用來產生累計報表；「本筆變動」是累計報表逐列相減的結果（第 11.5 節），不會再套一次 H15、H17 的擇一規則。
- 模板只有「增加」列的科目（存貨、應付帳款、其他負債），減少時**以反號填入同一列**，並在列旁加註「模板無此列，以反號填入」。在故事的累計檢視中，因為期初都是 0，這種情況不會發生；它會出現在自訂期初的情境，以及「本筆變動」檢視（例如賣出存貨那一步，H16 的本筆變動是正數）。
- 起算點固定為稅前淨利（W04），所以所得稅費用不經過營業活動的調整列，只有實付所得稅出現在 H22。間接法的解說卡寫「本課採稅前淨利起算；若從本期淨利起算，需另外加回所得稅費用」。
- 「網站顯示」欄依 D13 A（W01 到 W15 全部採用）：W 系列涵蓋的列（H18 的 W03、H23、H29、H36 的 W08）改用修正寫法，教材原字列為別名；牽涉 T 系列的列（H13、H21 依 T11，H15 依 T12、T15）維持教材原字，建議寫法先列為別名；現行財報用語（例如「營業活動之淨現金流量」）依 W07 的原則只當別名。

| 列 | 線 ID | 教材標籤 | 網站顯示（D13 A） | 來源規則 | 符號 | 備註 |
| --- | --- | --- | --- | --- | --- | --- |
| H10 | | 營業活動的現金流量 | 同 | 分組標題 | | 不可入帳 |
| H11 | `cf_pretax_income` | 稅前淨利 | 同 | ＝`is_pretax_income`（同一視窗） | 可正可負 | 步驟②（勾稽點 A） |
| H12 | `cf_depreciation` | 折舊費用(+) | 同 | ＝`depreciation_expense` 發生額 | 大於等於 0 | 若 T12 決定攤銷併入本列，另加 `amortisation_deferred_assets` |
| H13 | `cf_interest_expense_addback` | 支付利息(+) | 利息費用(+)（已決定【待確認 T11】，2026-10-23；教材原字為別名） | ＝`interest_expense` 發生額（加回費用，不是付現） | 大於等於 0 | 【待確認 T11】 |
| H14 | `cf_other_noncash_losses` | 其他非現金損失增加(+) | 同 | ＝`amortisation_deferred_assets` 發生額（預設）＋標記為非現金的損失 | 大於等於 0 | 攤銷加回列【待確認 T12】，攤銷的分類【待確認 T05】 |
| H15 | `cf_receivables_increase` | 銷貨債權增加(-) | 同，加「日式」標記（別名：應收帳款增加(-)；T12、T15 回覆後再定主要顯示） | Δ應收帳款大於 0 時填 －Δ，否則 0 | 小於等於 0 | 與 H17 擇一【待確認 T12】【待確認 T15】 |
| H16 | `cf_inventory_increase` | 存貨增加(-) | 同 | ＝ －Δ存貨 | 增加為負；減少以正數填同列並加註 | 盤盈、盤損都在這一列抵銷，不需另設非現金利益列 |
| H17 | `cf_receivables_decrease` | 應收帳款減少(+) | 同 | Δ應收帳款小於 0 時填 －Δ，否則 0 | 大於等於 0 | 與 H15 擇一 |
| H18 | `cf_payables_increase` | 應付賬款增加(+) | 應付帳款增加(+)（W03；原字列為別名） | ＝ ＋Δ應付帳款 | 減少以負數填同列並加註 | |
| H19 | `cf_other_liabilities_increase` | 其他負債增加(+) | 同 | ＝ ＋Δ（營業性的其他流動負債：保證金、其他應付款、預收收入） | 減少以負數填同列 | **必須排除**應付所得稅、應付利息、短期與長期借款、應付股利，否則會和 H21、H22、籌資活動重複；保證金的性質【待確認 T15】 |
| H20 | `cf_operating_subtotal` | 小計 | 同（別名：營運產生之現金） | H11 到 H19 合計 | | 必須等於直接法的同名小計 |
| H21 | `cf_interest_paid` | 利息支出(-) | 支付利息(-)（已決定【待確認 T11】，2026-10-23；教材原字為別名） | ＝ －Σ 現金行 `interest_paid`（政策為 `operating` 時） | 小於等於 0 | 【待確認 T11】 |
| H22 | `cf_income_tax_paid` | 支付所得稅(-) | 同 | ＝ －Σ 現金行 `income_tax_paid` | 小於等於 0 | 【待確認 T10】 |
| H23 | `cf_operating_total` | 營業活動的現金流量統計 | 營業活動的現金流量總計（W08；別名：原字、營業活動之淨現金流量） | H20＋H21＋H22 | | 必須等於直接法的營業活動合計 |
| H24 | | （空白列） | | | | |
| H25 | | 投資活動的現金流量 | 同 | 分組標題 | | |
| H26 | `cf_capex` | 取得非流動資產(-) | 同 | ＝ －Σ 現金行 `capex` | 小於等於 0 | 教材政策下包含設立費【待確認 T30】 |
| H27 | `cf_loans_advanced` | 放貸支出(-) | 同 | ＝ －Σ 現金行 `loans_advanced` | 小於等於 0 | 【待確認 T09】 |
| H28 | `cf_other_investing` | 其他投資支出(-) | 同 | ＝ －Σ 現金行 `other_investing_payments` | 小於等於 0 | |
| H29 | `cf_investing_total` | 投資活動的現金流量統計(-) | 投資活動的現金流量總計(-)（W08；別名：原字、投資活動之淨現金流量） | H26 到 H28 合計＋投資類延伸列 | | |
| H30 | | （空白列） | | | | |
| H31 | | 籌資活動的現金流量 | 同 | 分組標題 | | |
| H32 | `cf_st_borrowing_proceeds` | 短期借款收入(+) | 同 | ＝ Σ 現金行 `st_borrowing_proceeds` | 大於等於 0 | |
| H33 | `cf_st_borrowing_repayment` | 短期借款返還(-) | 同 | ＝ －Σ 現金行 `st_borrowing_repayment` | 小於等於 0 | |
| H34 | `cf_share_issue` | 發行股票收入(+) | 同 | ＝ Σ 現金行 `share_issue`（股本加資本公積） | 大於等於 0 | |
| H35 | `cf_dividends_paid` | 支付股息(-) | 同（別名：支付之股利(-)） | ＝ －Σ 現金行 `dividends_paid` | 小於等於 0 | |
| H36 | `cf_financing_total` | 籌資活動的現金流量統計 | 籌資活動的現金流量總計（W08；別名：原字、籌資活動之淨現金流量） | H32 到 H35 合計＋籌資類延伸列 | | |
| H37 | | （空白列） | | | | |
| H38 | | 現金流量 | 同 | 分組標題 | | |
| H39 | `cf_net_change` | 現金及約當現金增減額 | 同 | H23＋H29＋H36 | | 必須等於視窗內現金的變動 |
| H40 | `cf_cash_begin` | 期初現金及約當現金餘額 | 同 | 視窗起點的現金餘額 | | 故事累計模型恆為 0（W06） |
| H41 | `cf_cash_end` | 期末現金及約當現金餘額 | 同 | H39＋H40 | | 必須等於 `bs_cash`：步驟③（勾稽點 C） |

延伸列（模板沒有，`showExtensionRows: "when_nonzero"` 時只在非 0 時顯示，並標「模板無此列」）：

| 線 ID | 名稱 | 活動 | 來源 |
| --- | --- | --- | --- |
| `cf_other_operating_assets_increase` | 其他營業資產增加(-) | 營業 | －Δ（預付費用、用品盤存） |
| `cf_noncash_gains` | 非現金利益減除(-) | 營業 | －（標記為非現金的利益，例如處分資產利益） |
| `cf_loans_collected` | 收回放款(+) | 投資 | Σ 現金行 `loans_collected` |
| `cf_disposal_proceeds` | 處分資產收入(+) | 投資 | Σ 現金行 `disposal_proceeds` |
| `cf_lt_borrowing_proceeds` | 長期借款收入(+) | 籌資 | Σ 現金行 `lt_borrowing_proceeds` |
| `cf_lt_borrowing_repayment` | 長期借款返還(-) | 籌資 | －Σ 現金行 `lt_borrowing_repayment` |

建置期完整性檢查：每個可入帳的資產、負債與權益科目，都必須落在「營運資金列」「非現金損益加回列」「由現金標籤決定的投資或籌資列」「排除清單（應付所得稅、應付利息、借款、應付股利）」其中之一，否則 `content:compile` 失敗。

### 11.4 直接法與相等不變式

直接法的營業活動完全由現金行的標籤加總；投資與籌資活動和間接法共用同一組列。

| 直接法列 | 來源 |
| --- | --- |
| 自客戶收取之現金 | Σ `receipts_from_customers` |
| 支付供應商之現金 | －Σ `payments_to_suppliers` |
| 支付營業費用之現金 | －Σ `payments_for_operating_expenses` |
| 其他營業收現 | Σ `other_operating_receipts` |
| 營運產生之現金（小計） | 以上合計 |
| 支付之利息 | －Σ `interest_paid` |
| 支付之所得稅 | －Σ `income_tax_paid` |
| 營業活動之淨現金流量 | 小計＋利息＋所得稅 |

每一步、每個視窗都要成立的不變式：
1. 直接法營業活動合計 ＝ H23。
2. 直接法小計 ＝ H20（因為 H21、H22 與直接法的利息、所得稅列取自同一組現金行）。
3. H39 ＝ 視窗內現金的變動 ＝ 所有現金行的借方減貸方。
4. H41 ＝ L12。

### 11.5 累計與本筆變動

- `window: "cumulative"`：從帳本期間起點到目前這一步。教材故事是自成立起累計，期初現金與期初存貨都是 0（W06）；自訂期初的情境則從期初狀態起算，損益從 0 開始。
- `window: "transaction"`：「本筆變動」定義為**累計報表的前後差額**，逐列相減，不是另外編一張只含這一筆的期間報表。例如收回應收帳款那一步，累計報表的 H15 由較大的負數變成絕對值較小的負數，所以本筆變動在 H15 是正數，H17 維持 0；不會改成「H17 應收帳款減少」的寫法。
- 指標只對累計報表計算。對差額報表算指標沒有意義，核心不提供。
- 各步驟的本筆變動加總，必須等於累計報表（性質測試）。

### 11.6 版面資料範例（節錄）

節錄只列兩張表、每張表只列幾列；完整形狀以 `packages/content-schema` 的 `Layout`（`LayoutLine` 以 `kind` 區分，每列都有 `label` 與 `aliases`）與 `packages/core/data/layouts/teacher@1.json` 為準，所以這一段不經 `docs:examples` 驗證。

```jsonc
{
  "id": "teacher@1",
  "options": {
    "amortisationSection": "non_operating",
    "amortisationAddBack": "H14",
    "showOrdinaryIncome": true,
    "showExtraordinaryRows": true,
    "showExtensionRows": "when_nonzero",
    "excelExportClosingInventorySign": "negative"
  },
  "statements": {
    "income_statement": [
      {
        "id": "is_revenue",
        "cell": "R10",
        "kind": "accounts",
        "label": { "zh-TW": "營業收入", "en": "Revenue" },
        "aliases": { "zh-TW": ["營收", "銷貨淨額"], "en": ["Sales", "Net sales"] },
        "termRef": "tm_v3n8q2ye",
        "accounts": ["revenue"],
        "measure": "activity"
      },
      {
        "id": "is_opening_inventory",
        "cell": "R12",
        "kind": "inventory_opening",
        "label": { "zh-TW": "期初存貨", "en": "Opening inventories" },
        "aliases": { "zh-TW": [], "en": [] },
        "termRef": "tm_v6j2k8sr"
      },
      {
        "id": "is_purchases",
        "cell": "R13",
        "kind": "inventory_purchases",
        "label": { "zh-TW": "本期進貨", "en": "Purchases" },
        "aliases": { "zh-TW": ["進貨"], "en": [] },
        "termRef": "tm_p7h3c5xq",
        "pendingRefs": ["T27"]
      },
      {
        "id": "is_closing_inventory",
        "cell": "R14",
        "kind": "inventory_closing",
        "label": { "zh-TW": "期末存貨(-)", "en": "Closing inventories (-)" },
        "aliases": { "zh-TW": ["期末存貨"], "en": [] },
        "termRef": "tm_q4k9v2nd",
        "pendingRefs": ["T07"],
        "display": "positive_subtracted"
      },
      {
        "id": "is_cogs",
        "cell": "R15",
        "kind": "formula",
        "label": { "zh-TW": "營業成本小計", "en": "Cost of sales (subtotal)" },
        "aliases": { "zh-TW": ["營業成本", "銷貨成本"], "en": ["Cost of sales", "Cost of goods sold"] },
        "termRef": "tm_g5c2m8tw",
        "expr": "line.is_opening_inventory + line.is_purchases + line.is_inventory_overage_excluded - line.is_closing_inventory",
        "invariant": "equals_account_activity:cost_of_goods_sold"
      },
      {
        "id": "is_gross_profit",
        "cell": "R16",
        "kind": "formula",
        "label": { "zh-TW": "營業毛利", "en": "Gross profit" },
        "aliases": { "zh-TW": ["毛利", "營業毛利（毛損）"], "en": ["Gross margin"] },
        "termRef": "tm_g8p4w1rz",
        "expr": "line.is_revenue - line.is_cogs",
        "level": 1
      }
    ],
    "cash_flow_indirect": [
      {
        "id": "cf_pretax_income",
        "cell": "H11",
        "kind": "link",
        "label": { "zh-TW": "稅前淨利", "en": "Profit before tax" },
        "aliases": { "zh-TW": [], "en": [] },
        "termRef": "tm_z971merj",
        "from": "is_pretax_income",
        "check": "step2"
      },
      {
        "id": "cf_inventory_increase",
        "cell": "H16",
        "kind": "working_capital",
        "label": { "zh-TW": "存貨增加(-)", "en": "Increase in inventories (-)" },
        "aliases": { "zh-TW": [], "en": [] },
        "termRef": "tm_bpt2kp5c",
        "pendingRefs": ["T12"],
        "accounts": ["inventory"],
        "sign": "negate_change",
        "oppositeSignNote": "template_has_no_decrease_row"
      },
      {
        "id": "cf_payables_increase",
        "cell": "H18",
        "kind": "working_capital",
        "label": { "zh-TW": "應付帳款增加(+)", "en": "Increase in trade payables (+)" },
        "aliases": { "zh-TW": ["應付賬款增加(+)"], "en": ["Increase in accounts payable (+)"] },
        "termRef": "tm_dc0p0nrv",
        "pendingRefs": ["T12"],
        "flags": ["typo_fixed"],
        "accounts": ["accounts_payable"],
        "sign": "change",
        "oppositeSignNote": "template_has_no_decrease_row"
      },
      {
        "id": "cf_interest_paid",
        "cell": "H21",
        "kind": "cash_tag",
        "label": { "zh-TW": "利息支出(-)", "en": "Interest paid (-)" },
        "aliases": { "zh-TW": ["支付之利息(-)"], "en": [] },
        "termRef": "tm_y7a34vmk",
        "pendingRefs": ["T11"],
        "activity": "operating",
        "cfKinds": ["interest_paid"],
        "sign": "outflow_negative"
      }
    ]
  }
}
```

H18 示範 W03（已決定 D13 A）：修正寫法是主要顯示，教材原字放在 `aliases` 供搜尋，並帶 `flags: ["typo_fixed"]`；H21 示範牽涉 T11 的列：這個範例保留決定前的寫法（教材原字為主要顯示、建議寫法為別名）作為紀錄；依【待確認 T11】的決定（2026-10-23），實作資料改為「支付利息(-)」為主要顯示、原字為別名，`pendingRefs` 只用來讓畫面顯示設計說明。

### 11.7 匯出成老師的 Excel 格式

匯出時依 `cell` 填值，分組與公式格留白（Excel 自己會算），R14 轉成負數，H 欄各列依教材的正負號慣例填入。三表之間在老師的 Excel 裡沒有公式連結，所以 H11、L12、N26 等跨表格子是直接填數字。匯出只適用於 `teacher@1` 版面；IFRS 對照沒有對應的模板格子，不提供匯出（第 10.3 節）。

## 12. 財務指標登錄檔

### 12.1 一個指標、多個版本

| 版本 | 意義 | 取數口徑 | 主要用途 |
| --- | --- | --- | --- |
| `excel` | 老師 Excel 23 格的口徑 | 期末餘額、單一期間、Excel 的分母範圍；已知錯誤不重現（見表 B） | 實驗室、依第二部分改寫的題目 |
| `slides03` | 0-3 教學頁與年報公式 | 平均餘額（單期時以期末代替並標示）、ROA 加回稅後利息、DOL 用邊際貢獻、應付款項週轉率用銷貨成本、允當比率用五年合計 | 依 0-3 改寫的計算題 |
| `slides02` | 0-2 的簡化版 | 期末值；Profit、TR、A、E | 依 0-2 改寫的題目 |
| `dupont` | 杜邦拆解的乘積形式 | 純益率 × 總資產週轉率（× 權益倍數） | 杜邦樹 |
| `slides01` | 0-1 的損益結構比率 | 損益表各列除以營業收入 | 損益表章節 |

`ratioRef` 寫成 `<id>@<version>`，例如 `roa@excel`。全部用期末值時 `dupont` 與 `slides02` 數值相同，但狀態可能不同：營收為 0 時純益率是 na，所以 `roa@dupont` 是 na，而 `roa@slides02` 仍算得出數字。這就是版本必須明確指定的原因。

```ts
type RatioUnit = 'percent' | 'turnover' | 'days' | 'multiple' | 'currency_per_share' | 'currency';
interface RatioVersion {
  numerator?: string;                 // 受控運算式（指標情境）
  denominator?: string;
  expr?: string;                      // 乘積或連鎖形式時使用
  unit: RatioUnit;
  displayDecimals: number;
  excel?: { cell: string; formula: string; format: string; iferror: string };
  naWhen: ('denominator_zero' | 'chained_source_na_or_zero' | 'chained_source_na' | 'missing_input')[];
  notMeaningfulWhen: ('denominator_negative' | 'base_not_positive')[];
  notMeaningfulBase?: string;         // 例如 'line.is_operating_income'
  flags: ('end_of_period_balance' | 'single_period_approx' | 'excel_approximation' | 'website_fix' | 'website_definition')[];
  inputs?: Record<string, { default: number | null; label: LocalizedText; pendingRefs?: string[] }>;
}
interface RatioDefinition {
  id: string;
  termRef: string;                                   // 名詞卡 ID（tm_ 前綴）
  category: 'financial_structure' | 'solvency' | 'activity' | 'profitability' | 'cash_flow' | 'leverage' | 'dupont' | 'department' | 'market' | 'income_structure';
  framework: 'input' | 'transform' | 'output' | null;   // 老師的投入、轉換、產出框架
  versions: Partial<Record<'excel' | 'slides03' | 'slides02' | 'dupont' | 'slides01', RatioVersion>>;
  pendingRefs: string[];
}
interface RatioResult {
  ratioRef: string;
  status: 'ok' | 'zero' | 'na' | 'not_meaningful';
  exact: { num: string; den: string } | null;   // 精確值（bigint 以字串表示）
  value: number | null;                           // 浮點近似
  displayValue: number | null;                    // 已依顯示位數四捨五入；百分比以百分點表示（0.25 顯示為 25）；excel 版 not_meaningful 仍有值
  reason: { key: string; params?: Record<string, string | number> } | null;
  flags: string[];
  inputs: Record<string, number | null>;          // 用到的線與輸入值，供解說與追蹤
}
```

### 12.2 表 A：老師 Excel 的 23 項指標（`excel` 版）

「Excel 格」一欄是「財務分析指標」工作表的儲存格（D10、D11、D15、D16、D17 都是儲存格位址，和決策編號的 D 系列無關；決策編號只有 D1 到 D13）。Excel 公式都包在 `IFERROR(…,"N/A")` 裡（H14 的錯誤字串是「N/A(應付帳款為0)」），公式內的參照都指向「財務報表」工作表，下表省略。「網站顯示」是預設顯示，Excel 檢視可切換成 Excel 的格式。

| # | id | Excel 標籤（類別） | Excel 格與公式 | `excel` 版公式（線 ID） | 單位；Excel 格式；網站顯示 |
| --- | --- | --- | --- | --- | --- |
| 1 | `debt_ratio` | 負債比例（資產結構，投入） | D10 `SUM(N11:N17)/L29` | `bs_total_liabilities ÷ bs_total_assets` | 百分比；0.0%；2 位 |
| 2 | `long_term_funds_to_ppe` | 長期資金占固定資產比例（資產結構） | D11 `(SUM(N16:N17)+SUM(N19:N28))/L19` | `(bs_noncurrent_liabilities + bs_total_equity) ÷ bs_machinery_net` | 百分比；0.0%；2 位並附倍數 |
| 3 | `cash_flow_adequacy` | 現金流量允當比例（現金流量，投入） | D15 `H23/(-H26-H16-H35)` | `cf_operating_total ÷ (capex + 存貨增加額 + 股利)`，三項取流出的正值，存貨增加額＝max(Δ存貨, 0)（網站修正，見表 B） | 百分比；0.0%；2 位，標「單期近似」 |
| 4 | `cash_flow_ratio` | 現金流量比率（現金流量） | D16 `H23/SUM(N11:N15)` | `cf_operating_total ÷ bs_current_liabilities` | 百分比；0.0%；2 位 |
| 5 | `cash_reinvestment` | 現金流量再投資比率（現金流量） | D17 `(H23-H35)/(SUM(L18:L21)+SUM(L23:L25)+SUM(L12:L15)-SUM(N11:N15))` | `(cf_operating_total − 股利正值) ÷ (bs_total_assets − bs_current_liabilities)` | 百分比；0.0%；2 位 |
| 6 | `ar_turnover` | 應收帳款周轉率（經營能力，轉換） | H11 `R10/L13` | `is_revenue ÷ bs_accounts_receivable` | 次；0.00；2 位 |
| 7 | `days_sales_outstanding` | 平均收現日數 | H12 `365/H11` | `365 ÷ ratio.ar_turnover.excel`（連鎖） | 天；0.00；2 位 |
| 8 | `ap_turnover` | 應付賬款周轉率 | H14 `R13/N12` | `is_purchases ÷ bs_accounts_payable` | 次；0.00；2 位 |
| 9 | `inventory_turnover` | 存貨週轉率 | H16 `R15/L14` | `is_cogs ÷ bs_inventory` | 次；0.00；2 位 |
| 10 | `days_inventory` | 平均銷貨日數 | H17 `365/H16` | `365 ÷ ratio.inventory_turnover.excel`（連鎖） | 天；0.00；2 位 |
| 11 | `ppe_turnover` | 不動產、廠房及設備週轉率 | H19 `R10/L19` | `is_revenue ÷ bs_machinery_net` | 次；0.00；2 位 |
| 12 | `total_asset_turnover` | 總資產週轉率 | H20 `R10/L29` | `is_revenue ÷ bs_total_assets` | 次；0.00；2 位 |
| 13 | `dol` | 營業槓桿（槓桿度，轉換） | H24 `R16/R24` | `is_gross_profit ÷ is_operating_income` | 倍；0.00；2 位 |
| 14 | `dfl` | 財務槓桿度 | H25 `R24/(R24-R27)` | `is_operating_income ÷ (is_operating_income − is_interest_expense)` | 倍；0.00；2 位 |
| 15 | `roa` | 資產報酬率(ROA)（獲利能力，產出） | L10 `R35/L29` | `is_net_income ÷ bs_total_assets` | 百分比；0.0%；2 位 |
| 16 | `pretax_to_paid_in_capital` | 稅前利益佔實收資本比率 | L11 `R33/N21` | `is_pretax_income ÷ bs_share_capital` | 百分比；0.0%；2 位 |
| 17 | `operating_income_to_paid_in_capital` | 營業利益佔時收資本比率（標籤誤植） | L12 `R24/N21` | `is_operating_income ÷ bs_share_capital` | 百分比；0.0%；2 位 |
| 18 | `roe` | 歸屬於母公司業主之權益報酬率 | L13 `R35/SUM(N19:N28)` | `is_net_income ÷ bs_total_equity` | 百分比；0.0%；2 位 |
| 19 | `eps` | 每股盈餘(EPS) | L14 `R35/(N21/L16)` | `is_net_income ÷ (bs_share_capital ÷ input.par_value)`，面額預設 10 | 元／股；0.00；2 位 |
| 20 | `net_profit_margin` | 純益率 | L15 `R35/R10` | `is_net_income ÷ is_revenue` | 百分比；0.0%；2 位 |
| 21 | `quick_ratio` | 速動比率（償債能力，產出） | L20 `(L12+L13+L15)/SUM(N11:N15)` | `(bs_cash + bs_accounts_receivable + bs_short_term_loans_receivable) ÷ bs_current_liabilities` | 倍；0.00；預設依 0-3 以百分比顯示，可切換 |
| 22 | `current_ratio` | 流動比率 | L21 `SUM(L12:L15)/SUM(N11:N15)` | `bs_current_assets ÷ bs_current_liabilities` | 倍；0.00；同上 |
| 23 | `interest_coverage` | 利息保障倍數 | L22 `(R33+R27)/R27` | `(is_pretax_income + is_interest_expense) ÷ is_interest_expense` | 倍；0.00；2 位 |

L16「每張股票面額」不是指標，是 EPS 的輸入值，在核心裡是 `input.par_value`，畫面顯示「每股面額」，預設 10、可修改（W13）。

「Excel 標籤」欄照錄老師 Excel 的原字，只用於對照與本機驗證。畫面上的指標名稱依 D13 A：「周轉率」統一寫成「週轉率」、「應付賬款」寫成「應付帳款」（W03），#17 的「時收」改為「實收」（是否仍屬現行年報指標仍等【待確認 T23】）；原字一律收進名詞的 `aliases` 供搜尋。正式的顯示名稱以 12 為準。

### 12.3 表 B：其他版本、N/A 規則與 Excel 已知問題

| id | `slides03` 版 | 其他版本 | na | not_meaningful | Excel 已知問題與網站處理 | 待確認 |
| --- | --- | --- | --- | --- | --- | --- |
| `debt_ratio` | 負債總額 ÷ 資產總額 | | 資產總計＝0 | | 無 | T24、T38 |
| `long_term_funds_to_ppe` | (權益＋非流動負債) ÷ 全部不動產、廠房及設備淨額 | | 淨額＝0 | | Excel 分母只取 L19；`excel` 版照做，故事中只有機器設備，結果相同 | W07 |
| `cash_flow_adequacy` | 最近五年營業活動淨現金流量 ÷ 最近五年（資本支出＋存貨增加額＋現金股利） | | 分母＝0 | 分母小於 0 | Excel 只用本期，且以 −H16 計入，存貨減少時會縮小分母；`excel` 版的存貨增加額取 max(增加, 0)，在 Excel 能表達的情況下結果相同 | W12 |
| `cash_flow_ratio` | 同 `excel` | | 流動負債＝0 | | 無 | |
| `cash_reinvestment` | (營業活動淨現金流量 − 現金股利) ÷ (不動產廠房設備毛額＋長期投資＋其他非流動資產＋營運資金) | | 分母＝0 | 分母小於 0 | **不重現**：D17 分子 `H23-H35` 在 H35 以負數輸入時會把股利加回；網站改為股利取正值，相當於 `H23+H35`。故事沒有股利，答案不受影響 | T25 |
| `ar_turnover` | 銷貨淨額 ÷ 平均應收款項 | | 應收帳款＝0 | | 期末餘額近似（Excel 註解已說明） | |
| `days_sales_outstanding` | 365 ÷ 應收款項週轉率 | | 來源為 na 或 0 | | 無 | |
| `ap_turnover` | 銷貨成本 ÷ 平均應付款項 | | 應付帳款＝0 | | **不重現**錯誤字串：Excel 顯示「N/A(應付帳款為0)」，網站統一為 na，原因放提示。分子差異：`excel` 版保留本期進貨以對上老師答案，指標卡並列銷貨成本版 | T27 |
| `inventory_turnover` | 銷貨成本 ÷ 平均存貨 | | 存貨＝0 | | 期末存貨近似；數值受盤盈處理影響 | T06 |
| `days_inventory` | 365 ÷ 存貨週轉率 | | 來源為 na 或 0 | | 無 | |
| `ppe_turnover` | 銷貨淨額 ÷ 平均不動產廠房設備淨額 | | 淨額＝0 | | 無 | |
| `total_asset_turnover` | 銷貨淨額 ÷ 平均資產總額 | `slides02`：TR ÷ A（期末） | 資產總計＝0 | | 無 | |
| `dol` | (營業收入淨額 − 變動營業成本及費用) ÷ 營業利益；需要成本習性標記。網站預設營業成本為變動、其餘費用為固定，這時結果與 Excel 相同；這個預設是網站假設，和 T26 一起確認 | | 營業利益＝0 | 營業利益小於 0 | **不重現**「營業利益為負仍當成正常數值」：Excel 以毛利近似邊際貢獻，`excel` 版保留近似以對答案，但狀態為 not_meaningful，顯示 Excel 值並加警示；說明文字依公式寫出真正原因（例如毛利為 0） | T26、T20 |
| `dfl` | 營業利益 ÷ (營業利益 − 利息費用) | | 分母＝0 | 營業利益小於等於 0，或分母小於 0 | Excel 該格註解誤寫成現金流量比率，以公式為準 | T20 |
| `roa` | [稅後純益＋利息費用 × (1 − 稅率)] ÷ 平均資產總額；稅率是輸入值 | `slides02`：Profit ÷ A；`dupont`：純益率 × 總資產週轉率 | 資產總計＝0 | | 無 | T21 |
| `pretax_to_paid_in_capital` | 稅前純益 ÷ 實收資本額 | | 股本＝0 | | 無 | |
| `operating_income_to_paid_in_capital` | 營業利益 ÷ 實收資本額 | | 股本＝0 | | 標籤「時收」誤植，依 D13 A 顯示「實收」、原字列為別名；是否仍是現行年報指標待確認，暫標「延伸指標」 | T23 |
| `roe` | 歸屬母公司稅後純益 ÷ 平均歸屬母公司權益（本課沒有子公司，等於全體版） | `slides02`：Profit ÷ E；`dupont`：純益率 × 總資產週轉率 × 權益倍數 | 權益＝0 | 權益小於 0 | 無 | T22 |
| `eps` | (歸屬母公司淨利 − 特別股股利) ÷ 加權平均流通股數 | | 股數＝0 | | 面額是輸入值，預設 10 | W13 |
| `net_profit_margin` | 稅後純益 ÷ 銷貨淨額 | `slides02`：Profit ÷ TR；`slides01` 的淨利率同義 | 營收＝0 | | 無 | |
| `quick_ratio` | (流動資產 − 存貨 − 預付費用) ÷ 流動負債 | | 流動負債＝0（顯示 N/A，不顯示「無限大」） | | 模板沒有預付費用，兩版數值相同 | T28 |
| `current_ratio` | 流動資產 ÷ 流動負債 | | 流動負債＝0（同上） | | 無 | T28 |
| `interest_coverage` | 所得稅及利息費用前純益 ÷ 本期利息支出 | | 利息費用＝0 | | 無 | T24 |

參考門檻值（負債比率、流動比率等）以資料欄位 `referenceValue` 記錄，數值整理在 01，全部標【待確認 T24】，不參與計分。

### 12.4 表 C：0-2、0-1 與延伸指標（不在老師 Excel 內）

| ratioRef | 名稱 | 公式 | 單位 | na | not_meaningful | 備註 |
| --- | --- | --- | --- | --- | --- | --- |
| `equity_multiplier@slides02` | 權益倍數 | A ÷ E（期末） | 倍 | E＝0 | E 小於 0 | 等於 1 ÷ (1 − 負債比率)；與負債比率回答同一問句的情況【待確認 T38】 |
| `roe@slides02`、`roa@slides02` | ROE、ROA 簡化版 | Profit ÷ E、Profit ÷ A | 百分比 | 分母＝0 | ROE 在 E 小於 0 時 | 與 `excel` 版數值相同；E 標「簡化」（權益另含公積與其他權益，W14） |
| `net_profit_margin@slides02` | 純益率 | Profit ÷ TR | 百分比 | TR＝0 | | |
| `total_asset_turnover@slides02` | 資產週轉率 | TR ÷ A | 次 | A＝0 | | 計算器統一分子與分母的期間，並標示是否年化（W14，已決定 D13 A） |
| `roe@dupont`、`roa@dupont` | 杜邦拆解 | 純益率 × 總資產週轉率（× 權益倍數） | 百分比 | 任一因子為 na | 任一因子為 not_meaningful | 營收為 0 時為 na |
| `revenue_per_employee@slides02` | 人均營收 | TR ÷ 員工人數（輸入） | 元 | 缺員工數或為 0 | | |
| `rd_intensity@slides02` | RD intensity | 研究發展費用 ÷ TR | 百分比 | TR＝0 | | 需要延伸科目 |
| `rd_leverage@slides02` | RD leverage | 教材只用文字說明它看的是研發投入帶動營收成長的效果，沒有給公式。候選定義有兩種：ΔTR ÷ 研究發展費用，或 ΔTR ÷ Δ研究發展費用；兩種都需要兩期資料 | 倍 | 單期資料，或分母＝0 | | 標「網站補充定義」；採用哪一種候選定義列在第 20 節，不計分 |
| `ce_intensity@slides02`、`ce_turnover@slides02` | CE intensity、CE turnover | CE ÷ TR、TR ÷ CE；CE＝取得非流動資產付現（−H26） | 百分比、倍 | 分母＝0 | | 兩者互為倒數，指標卡說明資訊相同 |
| `me_intensity@slides02`、`me_leverage@slides02` | ME intensity、ME leverage | 行銷費用 ÷ TR；leverage 的候選定義比照 RD leverage | 百分比、倍 | 分母＝0；leverage 另在單期資料時為 na | | 需要延伸科目；leverage 標「網站補充定義」，不計分 |
| `pe_ratio@slides02` | 本益比 | 股價（輸入） ÷ EPS | 倍 | EPS＝0 | EPS 小於 0 | |
| `margin_maintenance@slides02` | 融資維持率 | 擔保品市值 ÷ 融資金額 | 百分比 | 融資金額＝0 | | 追繳門檻是參數【待確認 T18】 |
| `capital_surplus_to_share_capital@slides02` | 資本公積 ÷ 股本 | 資本公積 ÷ 股本 | 百分比 | 股本＝0 | | 標「非標準比率」【待確認 T17】，不計分 |
| `gross_margin@slides01` | 毛利率 | R16 ÷ R10 | 百分比 | 營收＝0 | | |
| `operating_margin@slides01` | 營業利益率 | R24 ÷ R10 | 百分比 | 營收＝0 | | |
| `cost_ratio@slides01` | 成本率 | R15 ÷ R10 | 百分比 | 營收＝0 | | |
| `sga_ratio@slides01` | 銷管費用率 | R23 ÷ R10 | 百分比 | 營收＝0 | | W09 |
| `effective_tax_rate@slides01` | 有效稅率 | R34 ÷ R33 | 百分比 | 稅前淨利＝0 | 稅前淨利小於 0 | 與法定稅率不符時提示屬教學設定【待確認 T10】 |
| `days_payable@slides03` | 平均付款天數 | 365 ÷ 應付款項週轉率 | 天 | 來源為 na 或 0 | | 延伸，不計分 |
| `operating_cycle@slides03` | 營業週期 | 平均銷貨日數 ＋ 平均收現日數 | 天 | 任一為 na | | 延伸 |
| `cash_conversion_cycle@slides03` | 現金轉換循環 | 營業週期 − 平均付款天數 | 天 | 任一為 na | | 網站補充定義 |
| `total_leverage@slides03` | 整體槓桿度 | DOL × DFL | 倍 | 任一為 na | 任一為 not_meaningful | 延伸 |

### 12.5 單位、顯示精度與計分容許誤差

| 單位 | 預設顯示 | Excel 檢視 | 計分預設 |
| --- | --- | --- | --- |
| 百分比 | 2 位小數（投影片慣例） | 1 位小數（Excel 格式 0.0%） | 題目指定 `decimals`，容許最後一位 ±1 |
| 次、天、倍 | 2 位小數 | 0.00 | 同上 |
| 元／股 | 2 位小數 | 0.00 | 同上 |
| 長期資金比率 | 百分比 2 位，另附倍數 1 位小數 | 0.0% | 依題目指定的單位 |

計分：先把作答依 05 正規化，解析成數字，與「核心精確值依 `decimals` 四捨五入後的值」比較，差距小於等於 `tolerance` 就算對。`tolerance` 以作答單位計算（百分比題以百分點計，0.01 就是 0.01 個百分點），預設是 10 的負 `decimals` 次方，題目可覆寫。題目的 `answerUnit` 若和版本的單位不同（例如流動比率以百分比作答），先換算再比較。正解狀態是 na 時，只有按「N/A」才算對；正解是數字時，按「N/A」算錯。已決定（2026-10-20）：這組數字題比對（`scoreNumeric`）放在 `packages/quiz`，規則不變；核心只提供精確值與狀態（第 2 節）。

### 12.6 狀態規則

判定順序固定為 **na → not_meaningful → zero → ok**，先符合的優先：
1. **na**：分母恰為 0（精確判定）；必要的輸入值缺少；除法型連鎖指標（平均收現日數、平均銷貨日數、平均付款天數）的來源為 na 或 0；加總或乘積型連鎖指標（營業週期、現金轉換循環、杜邦乘積、整體槓桿度）的來源為 na。
2. **not_meaningful**：分母或基數為負使解讀失真，各指標的條件見表 B、表 C。例如毛利為 0、營業利益為負時，DOL 同時符合 zero（分子為 0）與 not_meaningful（基數為負），依順序判為 not_meaningful。
3. **zero**：分子恰為 0（以未四捨五入的精確值判定，不以顯示值判定），且分母存在。zero 表示比率算得出來、數值剛好為零；na 表示比率根本不存在（名詞卡見 12 的 N/A 條目）。
4. **ok**：其他情況。

| 狀態 | `excel` 版顯示 | 其他版本顯示 | 題目 |
| --- | --- | --- | --- |
| na | 「N/A」，提示寫出哪個分母為 0 | 「N/A」 | 正解為 na 的題目設 `acceptStatus: ["na"]`；所有指標輸入框固定提供「N/A」按鈕 |
| not_meaningful | 顯示 Excel 算出的數值並加警示，才能對上老師答案中的 0.00、1.00 | 「不適用」 | 數字題的正解不得是 not_meaningful；方向題的前後任一端是 not_meaningful 時不得出題 |
| zero | 0 | 0 | 一般數字題 |
| ok | 數值 | 數值 | 一般數字題 |

格式化規則：
- 不可以把 N/A 改填 0，也不可以隱藏 N/A 的指標。
- 格式化前若 `Object.is(v, -0)` 就改成 0；所有數字格式器一律加 `signDisplay: 'negative'`，避免極小的負數顯示成「-0.00%」。唯一的例外是變動值格式選項 `|sign`（例如 `{{money:x|sign}}`，用在 07 的變動徽章，正數帶「+」）：改用 `signDisplay: 'exceptZero'`，同樣先把 -0 改成 0（見 05 第 10.3 節）。iOS 實機的輸出【待實測 V14】。
- `reason` 用 i18n key，例如 `ratio.reason.denominator_zero`、`ratio.reason.chained_source_na_or_zero`、`ratio.reason.chained_source_na`、`ratio.reason.negative_base`、`ratio.reason.missing_input`。

### 12.7 `ratioRef` 與計分

1. 答案取決於某個指標的數值、方向或狀態的計分題，**必須**填 `ratioRef`；validator 檢查該版本存在。純觀念題可以只用 `termRefs`，但建議也填，讓解說自動帶出公式。
2. 計分一律用題目指定的版本，並以 `teacher@1` 的報表計算。學生在實驗室切換顯示版本或切到 IFRS 對照（D10(f)），都不影響任何計分；IFRS 對照中的指標以 `ifrs@1` 的報表代入同一組公式，畫面標示「IFRS 對照，不計分」。
3. 解說自動帶出所用版本的公式與 Excel 格（若有）。
4. 各情境的預設版本如下（已決定 T21、T22、T27，2026-10-23）：實驗室與依第二部分改寫的題目用 `excel`；依 0-3 改寫的計算題用 `slides03`；依 0-2 改寫的題目用 `slides02` 或 `dupont`；損益結構題用 `slides01`【待確認 T21】【待確認 T22】【待確認 T27】。

### 12.8 指標資料範例

```json
{
  "id": "roa",
  "termRef": "tm_r0a5t3kq",
  "category": "profitability",
  "framework": "output",
  "versions": {
    "excel": {
      "numerator": "line.is_net_income",
      "denominator": "line.bs_total_assets",
      "unit": "percent",
      "displayDecimals": 2,
      "excel": { "cell": "L10", "formula": "財務報表!R35/財務報表!L29", "format": "0.0%", "iferror": "N/A" },
      "naWhen": ["denominator_zero"],
      "notMeaningfulWhen": [],
      "flags": ["end_of_period_balance"]
    },
    "slides03": {
      "numerator": "line.is_net_income + line.is_interest_expense * (1 - input.tax_rate)",
      "denominator": "avg(line.bs_total_assets)",
      "unit": "percent",
      "displayDecimals": 2,
      "naWhen": ["denominator_zero", "missing_input"],
      "notMeaningfulWhen": [],
      "flags": [],
      "inputs": {
        "tax_rate": {
          "default": 0.2,
          "label": { "zh-TW": "稅率", "en": "Tax rate" },
          "pendingRefs": ["T21"]
        }
      }
    },
    "slides02": {
      "numerator": "line.is_net_income",
      "denominator": "line.bs_total_assets",
      "unit": "percent",
      "displayDecimals": 2,
      "naWhen": ["denominator_zero"],
      "notMeaningfulWhen": [],
      "flags": ["end_of_period_balance"]
    },
    "dupont": {
      "expr": "ratio.net_profit_margin.slides02 * ratio.total_asset_turnover.slides02",
      "unit": "percent",
      "displayDecimals": 2,
      "naWhen": ["chained_source_na"],
      "notMeaningfulWhen": [],
      "flags": []
    }
  },
  "pendingRefs": ["T21"]
}
```

連鎖指標分兩種：除法型（平均收現日數、平均銷貨日數、平均付款天數）用 `chained_source_na_or_zero`，來源為 na 或 0 都判為 na，因為 365 除以 0 沒有意義；乘積型（`roa@dupont`、`roe@dupont`、整體槓桿度）用 `chained_source_na`，只有來源為 na 才是 na，因數為 0（例如淨利為 0）時乘積是 0，狀態為 zero。

## 13. 五步驟檢查

```ts
interface FiveStepResult {
  step1: {                               // 只回傳五層利益，不比對
    grossProfit: Money; operatingIncome: Money;
    ordinaryIncome: Money | null;        // ifrs@1 版面沒有經常利益，為 null（第 10.3 節）
    pretaxIncome: Money; netIncome: Money;
  };
  checks: CheckResult[];                 // 步驟②到⑤，依步驟順序
  firstFailedStep: 2 | 3 | 4 | 5 | null;
}
interface CheckResult {
  step: 2 | 3 | 4 | 5;
  alias: 'A' | 'B' | 'C' | 'D';          // 只當顯示別名
  left: { line: string; cell: string | null; value: Money; source: 'core' | 'learner' };
  right: { line: string; cell: string | null; value: Money; source: 'core' | 'learner' };
  diff: Money;                           // left − right
  pass: boolean;
}
function fiveStepCheck(st: Statements, learnerInputs?: Partial<Record<string, Money>>): FiveStepResult;
```

| 步驟 | 別名 | 左邊 | 右邊 | 說明 |
| --- | --- | --- | --- | --- |
| ① | 無 | 五層利益 | 無 | 只顯示，不比對 |
| ② | A | 損益表稅前淨利 R33 | 現金流量表起算的稅前淨利 H11 | |
| ③ | C | 現金流量表期末現金 H41 | 資產負債表現金 L12 | |
| ④ | B | 期初未分配盈餘 ＋ 本期淨利 － 股利 － 提列公積 | 資產負債表未分配盈餘 N26 | 用完整公式（W05）；股利與提列公積取自 `tag` 為 `dividend`、`reserve_appropriation` 的分錄行；故事中兩者為 0，畫面寫「本期淨利 vs 未分配盈餘增加額」並註明前提 |
| ⑤ | D | 資產總計 L29 | 負債及股東權益總計 N29 | |

- 主鍵是步驟編號；字母依多數頁的用法只當顯示別名【待確認 T13】。核心不強制填表順序【待確認 T14】。
- 勾稽練習：`learnerInputs` 預設只開放 H11、L12、N26 三格（闖關區 `five_step_fill` 題型的 `openCells` 預設值相同），其餘由核心帶入；進階模式再開放期末存貨與現金流量調整列。學生填的值會參與重算（例如 L29、N29、H41），所以錯一格可能讓後面的勾稽點也不平，這和 Excel 的行為一致；畫面依 `firstFailedStep` 先提示第一個不平的點。進階模式學生填錯期末存貨時，H11 連動重算會使 H41 也變動，`firstFailedStep` 可能是 3 而不是 5，這和 Excel 的行為一致。
- 核心自己算出的報表，四個勾稽點的差額一定都是 0，這也是性質測試的一部分。

勾稽練習的結果範例（自編故事第 7 筆之後，學生把 N26 誤填成營業毛利 480,000）：

```json
{
  "step1": {
    "grossProfit": 480000,
    "operatingIncome": 324000,
    "ordinaryIncome": 324000,
    "pretaxIncome": 324000,
    "netIncome": 324000
  },
  "checks": [
    {
      "step": 2, "alias": "A",
      "left": { "line": "is_pretax_income", "cell": "R33", "value": 324000, "source": "core" },
      "right": { "line": "cf_pretax_income", "cell": "H11", "value": 324000, "source": "learner" },
      "diff": 0, "pass": true
    },
    {
      "step": 3, "alias": "C",
      "left": { "line": "cf_cash_end", "cell": "H41", "value": 2214000, "source": "core" },
      "right": { "line": "bs_cash", "cell": "L12", "value": 2214000, "source": "learner" },
      "diff": 0, "pass": true
    },
    {
      "step": 4, "alias": "B",
      "left": { "line": "re_expected", "cell": null, "value": 324000, "source": "core" },
      "right": { "line": "bs_retained_earnings", "cell": "N26", "value": 480000, "source": "learner" },
      "diff": -156000, "pass": false
    },
    {
      "step": 5, "alias": "D",
      "left": { "line": "bs_total_assets", "cell": "L29", "value": 2724000, "source": "core" },
      "right": { "line": "bs_total_liabilities_equity", "cell": "N29", "value": 2880000, "source": "core" },
      "diff": -156000, "pass": false
    }
  ],
  "firstFailedStep": 4
}
```

## 14. 借貸分錄題的計分（D1 延伸章）

已決定（D1，2026-10-20）：(b) 延伸層。`journal_entry` 只用在「借貸與分錄」延伸章：章節為 `scope: "extension"`、`examScope: "not_in_exam"`，介面標示「不在期中考範圍」。validator 拒絕出現在其他章節的分錄題（對應 08 的 `ans.journalScope`）。分錄題在延伸章內正常計分（`scored: true`），規則如下；題目的正解一律由核心依 `scenario` 的事件產生，作者不手寫分錄（範例見第 17.11 節）。出題限制：`scenario.policy` 只允許 `teacher@1`；事件用到的範本不得帶 `entryQuestionBlockedBy`（下面第 6 點）。

1. 作答與正解都先把科目別名解析成科目 ID（教材的「支付利息」與「利息費用」是同一個科目）。
2. 把同一題的所有分錄攤平成行，**合併同科目、同方向的行**，移除金額為 0 的行。
3. 以 `(accountId, side, amount)` 的多重集合比對；相等就算對。
4. 因此接受「一筆複合分錄」或「拆成多筆」，也不看行的順序。
5. 回饋列出缺少或多出的 `(科目, 方向)`，不給部分分數（題型 UX 依 03）。已決定（2026-10-20）：第 1 到 4 點的分錄比對由核心提供；計分與回饋由 `packages/quiz` 的 `scoreJournalEntry` 呼叫它完成（第 2 節），規則不變。分錄比對的函式名稱為示意（第 2 節）。
6. `entryQuestionBlockedBy` 的機制：範本帶這個欄位時 validator 拒絕用它出分錄題。原本第 5 筆設立費、第 16 筆盤盈、第 17 筆攤銷的範本分別填 T04、T06、T04 與 T05；已決定（2026-10-23）這三項依 14 的設計決定處理（課程政策資本化與攤銷、盤盈沖減營業成本），範本移除這個欄位，可以出分錄題；機制保留給日後真正懸而未決的做法。範本的 `pendingRefs`（例如 T11）只是相關設計決定的編號，在實驗室顯示「設計說明」，不擋分錄題。題目層級的 `pendingRefs` 是另一回事：它表示「這一題的答案可能因真正懸而未決的事項而改變」，非空時這一題暫不計分；目前沒有這種題目。兩者並存、用途不同，與 08 第 3.6、3.8 節與 5.4 節的 `acct.entryBlocked` 一致。
7. 內帳採永續盤存，所以核心的分錄全部是標準分錄，沒有「借 存貨／貸 期末存貨」這類只為填表存在的調整行，可以直接展示給學生。延伸章的教學卡要說明進貨分錄「借 存貨」和教材版面「本期進貨、期末存貨」的對應（第 5.2 節）；實驗室的「看分錄與 T 字帳」顯示的也是同一組分錄（第 6.5 節）。
8. 分錄題不列入期中考範圍；題目層級 `pendingRefs` 非空時同樣不計分（第 16.2 節；機制保留，目前沒有這種題目）。

下例是自編的「還清短期借款 900,000 並付利息 27,000」。兩種寫法合併後都是同一個多重集合，都算對：

```json
{
  "expected": [
    { "account": "short_term_borrowings", "side": "debit", "amount": 900000 },
    { "account": "interest_expense", "side": "debit", "amount": 27000 },
    { "account": "cash", "side": "credit", "amount": 927000 }
  ],
  "submissionCompound": [
    {
      "lines": [
        { "account": "short_term_borrowings", "side": "debit", "amount": 900000 },
        { "account": "interest_expense", "side": "debit", "amount": 27000 },
        { "account": "cash", "side": "credit", "amount": 927000 }
      ]
    }
  ],
  "submissionSplit": [
    {
      "lines": [
        { "account": "short_term_borrowings", "side": "debit", "amount": 900000 },
        { "account": "cash", "side": "credit", "amount": 900000 }
      ]
    },
    {
      "lines": [
        { "account": "cash", "side": "credit", "amount": 27000 },
        { "account": "interest_expense", "side": "debit", "amount": 27000 }
      ]
    }
  ],
  "result": { "submissionCompound": "correct", "submissionSplit": "correct" }
}
```

## 15. 計算型題目與答案鎖定

### 15.1 scenario

欄位與 08 第 3.6 節的 `scenario` 表一致（`opening`、`events`、`policy`、`layout`、`window`、`targets`）；本節定義每個欄位的會計語意。

```ts
interface Scenario {
  opening:
    | { storyRef: string; afterStep: string }            // 故事 ID（story_）與步驟 ID（st_）
    | { balances: Record<string, Money> };               // 自訂期初（只能填資產負債表科目）
  events: ScenarioEvent[];
  policy: 'teacher@1';            // 題目一律用 teacher@1；ifrs@1 只用在實驗室的 IFRS 對照，不計分（D10(f)，第 10 節）
  layout: 'teacher@1';            // 題目只用教材版面；ifrs@1 版面同樣只用在實驗室
  window: 'cumulative' | 'transaction';
  targets: Target[];
  expected?: Record<string, TargetAnswer>; // 編譯產生，鍵是 target 的 id；作者若有填必須一致
}
interface ScenarioEvent {
  id: string;                     // 題目內唯一，寫成 'e1'、'e2'；佔位符以 {{money:e1.price}} 引用事件參數與推導值
  template: string;               // tpl. 開頭的範本 ID
  params: Record<string, number>; // 交易事件的參數只放在這裡，不放在題目的 vars
}
type Measure = 'direction' | 'delta' | 'value' | 'status';
type Target =
  | { id: string; kind: 'line'; line: string; measure: Measure }         // 線 ID，例如 'bs_cash'
  | { id: string; kind: 'account'; account: string; measure: Measure }   // 科目 ID，以正常餘額表示
  | { id: string; kind: 'ratio'; ratioRef: string; measure: Measure }    // 例如 'roa@excel'；status 只用於這一種
  | { id: string; kind: 'check'; step: 2 | 3 | 4 | 5; measure: 'value' }; // 勾稽點（步驟②到⑤）的差額；08 第 3.6 節的 targets 同樣有這一種
// target 的 id 在題目內唯一，例如 't1'；核心算出的答案以 {{money:expected.t1.delta}} 引用
type Direction = 'up' | 'down' | 'unchanged' | 'becomes_computable' | 'becomes_na';
interface TargetAnswer { direction?: Direction; before?: number | null; after?: number | null; delta?: number; status?: RatioResult['status'] }
```

ledger 的幣別與 scale 不在 `scenario` 裡：引用故事時沿用故事的設定，自訂期初時沿用全站預設（TWD、0），題目不能自帶不同的 scale（第 3 節）。

規則：
- 自訂期初必須平衡（資產＝負債＋權益），每個科目符合第 6.3 節的餘額規則，事件也要通過各自的前置條件。
- `targets` 引用的線必須存在於指定的 `layout`；ratioRef 的版本必須存在；同一題的 target `id` 不得重複，也不得有兩個 target 指向同一個線、科目或指標。
- **方向的判定**：比較的是報表模型中的值本身（含正負號，不做「(-) 列」的轉號）。例如 H16 由 -640,000 變成 0，判為 up。因此作者出題時要在題目中明確寫出列名，並優先選擇符號自然的列（現金、五層利益、資產負債表科目）。
- 指標方向：N/A 變成數字是 `becomes_computable`，數字變成 N/A 是 `becomes_na`，兩者都不是上升或下降。比較前先依版本的顯示位數四捨五入；若精確值有變、但顯示值相同，validator 判定題目有歧義並拒絕，作者要改數字。前後任一端是 not_meaningful 的指標不得出方向題。
- `window` 對 `direction` 沒有影響；對 `delta` 與 `value` 決定要顯示累計值還是本筆變動。

### 15.2 建置期求解流程（`content:compile`）

1. 用 Zod 驗證題目格式。
2. 求出期初狀態：重播故事到 `afterStep`，或驗證自訂期初。
3. 依序套用事件（參數取自 `scenario.events[].params`），產生報表與指標。
4. 算出每個 target 的答案，以 target 的 `id` 為鍵寫進 `expected`；作者若有填 `expected`，必須和核心結果完全相同，否則失敗。
5. 解析佔位符的值（`vars.<名稱>` 題目自帶的數字、`e1.price` 這類事件參數與推導值、`expected.<targetId>.<欄位>` 核心算出的答案），並檢查中英文使用的佔位符集合相同（見 05）。
6. 數字型單選題若用 `distractorExprs` 定義干擾選項（選用，見 08），編譯後依顯示位數四捨五入，不得和正解或彼此相同。
7. 分類題的正解由科目表的 `element`、`current`、`cashFlow.defaultActivity` 或指標登錄檔的 `category` 推導；作者若有填，必須一致；抵銷科目要在項目上標 `allowContra` 才能出題（與 08 第 3.6 節、5.4 節的 `acct.classifyDerived` 相同）。
8. 分錄題（D1）：檢查題目屬於「借貸與分錄」延伸章、事件用到的範本沒有 `entryQuestionBlockedBy`（2026-10-23 起沒有範本帶這個欄位，檢查仍保留）；把核心產生的分錄合併同科目、同方向的行，寫進 `compiled.expectedEntries`（第 14 節、第 17.11 節）。多正解題（D12）：檢查第 16.2 節的 `multi_choice` 規則。
9. 把答案寫進發布快照，計算 `answerHash`，與 `published.lock.json` 比對。

選擇在建置時算答案、而不是在學生端即時算，理由是：答案固定且可稽核；核心改版造成答案改變時能在 CI 被抓到；學生端不需要為了出題而重播故事。

### 15.3 `published.lock.json`

鎖檔是比對已發布內容的唯一基準，欄位、更新方式與 CI 規則以 08 第 4.4 節為準，下面是同一個檔案的節錄。`answerHash` 依 08 的定義，取「答案改版欄位」連同核心編譯出的 `expected` 的正規化 JSON 做 SHA-256：計算型題目包含 `scenario`（含 policy 與 layout）、`compute`（含 `ratioRef`）、`decimals`、`tolerance`、`acceptStatus`；`journal_entry` 另含核心產生的正解分錄；選擇題包含 `correctOptionId`；`multi_choice` 包含 `scoringMode` 與排序後的 `correctOptionIds`（已決定 D12，範例見第 17.10 節），所以改判分方式或改正解都會讓雜湊改變，必須以 `revKind: "answer"` 升版。雜湊不含核心版本號，否則每次核心升級都會讓全部題目失敗。

```json
{
  "lockVersion": 1,
  "items": [
    {
      "id": "q_m4t9x2ka",
      "kind": "question",
      "rev": 1,
      "revKind": "text",
      "answerRev": 1,
      "status": "published",
      "answerHash": "sha256:9c2f41d07e3a5b8c16f0d2e4a7b9c1d3e5f708192a3b4c5d6e7f8091a2b3c4d5",
      "optionIds": ["o_r2v8", "o_k5p1", "o_w9d3"]
    },
    {
      "id": "q_tx7h2c9d",
      "kind": "question",
      "rev": 1,
      "revKind": "text",
      "answerRev": 1,
      "status": "published",
      "answerHash": "sha256:5b1e0c7d93a2f4e6b8d0c1a3e5f7092b4d6f8a0c2e4b6d8f0a1c3e5b7d9f1a2c",
      "optionIds": []
    }
  ]
}
```

（雜湊值為示意。第一版的 `rev` 是 1，`revKind` 只在之後的改版才有比對意義。）和核心最相關的 CI 規則：`answerHash` 變了但 `rev` 沒有遞增，或 `answerHash` 變了但 `revKind` 不是 `answer`，CI 失敗；只改文字時 `rev` 照樣遞增、`revKind` 為 `text`，不會失敗。核心修正 bug 而改變答案時，`answerHash` 會跟著變，作者必須替受影響的題目升 rev 並標 `answer`，錯題本會顯示「題目已更新」。

## 16. 內容資料格式

### 16.1 ID 與共同慣例

- 核心詞彙（科目、線、指標、政策、版面）用語意 ID（小寫 snake_case），例如科目 `inventory`、版面列 `is_gross_profit`、指標 `roa`；指標版本參照寫成 `roa@excel`，認列政策與版面寫成 `teacher@1`。發布後不改、不重用。程式碼與測試直接引用它們。語意 ID（科目、線、指標、範本等）不對使用者顯示，畫面一律顯示 `labels` 或名詞的文字，所以不在 D11 的範圍內、維持現有寫法：例如 `deferred_organisation_costs`、`amortisation_deferred_assets`、`tpl.amortise_org_costs`。D11 已決定英文介面用英式拼字，這些 ID 剛好也是英式，兩者一致；美式拼法只出現在名詞的 `enUsVariant` 與 `aliases.en`。
- 交易範本也用語意 ID，加 `tpl.` 前綴（例如 `tpl.sell_all_inventory_cash`），理由是測試、故事與題目都要讀得出它是哪一種交易。這與 08 第 4.1 節的前綴表、第 2.3 節的資料夾配置一致。
- 學習內容用 08 第 4.1 節的前綴加 Crockford Base32 小寫隨機字串（不含 i、l、o、u）：章節 `ch_` 6 碼、學習目標 `obj_` 6 碼、關卡 `lv_` 8 碼、題目 `q_` 8 碼、名詞 `tm_` 8 碼、故事 `story_` 6 碼、故事步驟 `st_` 6 碼、選項 `o_` 4 碼（題內唯一）、分類項目 `it_` 4 碼、迷思 `mc_` 4 碼。例如 `q_m4t9x2ka`、`o_r2v8`、`tm_c4sh8k2p`、`story_q7m2v9`、`st_h8q3z6`。ID 格式、`rev`、`revKind`、生命週期與 `supersededBy` 的規則以 08 為準。
- 事件 ID 在題目或步驟內唯一，寫成 `e1`、`e2`；`scenario.targets` 的 ID 在題目內唯一，例如 `t1`。
- 題目資料裡不記錄教材的頁碼或題號（見 08 原創政策）。
- 多語欄位是 `{ "zh-TW": ..., "en": ... }`，zh-TW 必填。zh-TW 與 en 從 M0b 起都是 complete 語系，內容只有在中英兩種語言都齊全時才能設為 published；草稿可以只有中文。缺翻譯的退回與標示依 05：ContentSource 逐欄回傳「文字、語系、是否為退回」。
- 佔位符依 05 第 10.1 節的文法：`{{money:x}}`、`{{percent:x}}`、`{{number:x}}`、`{{date:d}}`、`{{term:tm_id}}`、`{{term:tm_id|plain}}`、`{{option:o_id}}`。`{{option:o_id}}` 讓解說用選項 ID 引用選項，畫面打散後顯示該選項的文字。一般內容（題目、故事、名詞）的數值佔位符，x 有四種來源：
  - `vars.<name>`：題目自帶的數字，例如 `{{money:vars.loan}}`。
  - `<eventId>.<參數或推導值>`：交易事件的參數或推導值，例如 `{{money:e1.price}}`、`{{money:e1.costOfAllInventory}}`。
  - `expected.<targetId>.<欄位>`：核心算出的答案，例如 `{{money:expected.t3.delta}}`。`ratio_numeric` 的答案固定以 `answer` 為 target ID，例如 `{{percent:expected.answer.value}}`。target 以 ID 引用，所以指標目標的答案也能放進佔位符，不受 ratioRef 裡 `@` 的影響。
  - 數字常值：固定值，例如門檻 `{{percent:0.5}}`，讓兩種語言用同一個值格式化。
- 佔位符有作用範圍，驗證器依作用範圍檢查（與 05 第 10.1 節相同）：
  - 一般內容：只能用上面四種來源。
  - 交易範本的 `summary` 與 `explanation`：另可用 `param.<名稱>`、`derived.<名稱>` 引用本範本的參數與推導值（第 7 節），顯示在故事或題目中時由核心代入該事件的值。
  - 核心的 `effects` 片語樣板：另可用 `amount`，也就是同一筆 effect 的金額（第 6.5 節）。
  - 在範圍外使用 `param.`、`derived.` 或 `amount`，驗證失敗。
- 變動值另有格式選項 `|sign`（例如 `{{money:x|sign}}`），正數帶「+」，用在 07 的變動徽章；正負號規則見第 12.6 節與 05 第 10.3 節。
- 可翻譯文字裡不得寫死金額或百分比，一律用佔位符（lint 檢查，見 05）。

### 16.2 題目型別

題型代號、共用欄位與各題型的專屬欄位和 08 第 3.6 節一致：題型代號一律 snake_case；題幹欄位是 `prompt`（`true_false` 用 `statement`）；題目自帶的數字放在 `vars`；選項是 `{ id, text, feedback }`，正解欄位 `correctOptionId`。08 第 3.6 節寫「完整型別見 04 第 16.2 節」，所以兩份文件以下面這組型別為同一份定義；正式型別以 `packages/content-schema` 的 Zod schema 為準。重點放在和核心有關的欄位，管理欄位（`retiredNote`、`authorNotes`、`updatedAt`）見 08 第 3.2 節。

```ts
type QuestionType =
  | 'single_choice' | 'true_false' | 'pick_statement' | 'pick_line' | 'classify'
  | 'transaction_effect' | 'five_step_fill' | 'ratio_numeric' | 'ratio_interpret'
  | 'judgment'
  | 'journal_entry'                 // 只用在「借貸與分錄」延伸章（已決定 D1，第 14 節）
  | 'multi_choice';                 // 多正解題（已決定 D12）

interface QuestionBase {
  id: string;                       // 'q_' 加 8 碼
  rev: number;
  revKind: 'text' | 'answer';
  status: 'draft' | 'published' | 'retired';   // 不設 review（已決定 D10(g)）
  type: QuestionType;
  chapterId: string;                // 'ch_' 加 6 碼
  objectiveId: string;              // 'obj_' 加 6 碼，必須屬於同一章
  difficulty: 1 | 2 | 3;
  tags: string[];                   // 可為空陣列
  termRefs: string[];               // 名詞卡 ID（tm_），可為空陣列
  labRef?: { story: string; step: string };  // 故事 ID（story_）與步驟 ID（st_），一律用 ID 不用序號
  scored: boolean;                  // judgment 一律 false；題目層級 pendingRefs 非空時也必須是 false
  vars?: Record<string, number>;    // 題目自帶的數字，例如 { "loan": 240000 }；文字以 {{money:vars.loan}} 引用
  prompt?: LocalizedText;           // 題幹（依題型必填）；true_false 改用 statement
  explanation: LocalizedText;       // 用 {{option:o_xxxx}} 引用選項
  hint?: LocalizedText;
  display?: { statements?: ('is' | 'bs' | 'cf')[]; scenario?: 'self' };
  pendingRefs?: string[];           // 題目層級的待確認：答案可能因真正懸而未決的事項而改變，非空時這一題暫不計分；機制保留，2026-10-23 起沒有這種題目
  supersededBy?: string;            // 只用於發布後的合併
}

interface ChoiceOption { id: string; text: LocalizedText; feedback: LocalizedText; misconceptionId?: string }  // id 是 'o_' 加 4 碼

interface SingleChoiceQuestion extends QuestionBase {
  type: 'single_choice' | 'pick_statement' | 'ratio_interpret';
  prompt: LocalizedText;
  options: ChoiceOption[];          // 3 或 4 個，畫面一律打散；pick_statement 的選項是三張報表
  correctOptionId: string;
  ratioRef?: string;                // ratio_interpret 必填，依第 12.7 節
  distractorExprs?: Record<string, string>;  // 數字型干擾選項（選用，第 15.2 節）
}
type ScoringMode = 'any_correct' | 'all_correct';
interface MultiChoiceQuestion extends QuestionBase {
  type: 'multi_choice';             // 多正解題（已決定 D12）
  prompt: LocalizedText;            // 不寫出正確答案的數量
  options: ChoiceOption[];          // 同 single_choice，每個選項都要有 feedback；畫面一律打散
  correctOptionIds: string[];       // 至少兩個、不重複，都必須是 options 裡的 ID；只有一個正解時改用 single_choice
  scoringMode: ScoringMode;         // 必填，沒有預設值：any_correct 單選介面，選中任一正解即答對；all_correct 核取方塊，全部正解都選、且沒選錯才答對
}
type MultiChoiceSpec = Pick<MultiChoiceQuestion, 'correctOptionIds' | 'scoringMode'>;  // packages/quiz 的 scoreMultiChoice 的輸入
interface TrueFalseQuestion extends QuestionBase {
  type: 'true_false';
  statement: LocalizedText;         // 是非題的題幹
  correct: boolean;
  feedbackTrue: LocalizedText;      // 學生選「對」時的回饋
  feedbackFalse: LocalizedText;     // 學生選「錯」時的回饋
  misconceptionId?: string;
}
interface PickLineQuestion extends QuestionBase {
  type: 'pick_line';
  prompt: LocalizedText;
  scenario: Scenario;               // 決定畫面上的數字；版面取 scenario.layout
  statement: 'is' | 'bs' | 'cf';    // 顯示哪一張表
  correctLines: string[];           // 線 ID；validator 檢查都存在於版面
  feedbackByLine?: Record<string, LocalizedText>;
}
interface ClassifyQuestion extends QuestionBase {
  type: 'classify';
  prompt: LocalizedText;
  dimension: 'element' | 'current' | 'cf_activity' | 'ratio_category';
  items: { id: string; account?: string; ratio?: string; text?: LocalizedText; allowContra?: boolean }[];  // id 是 'it_' 加 4 碼；account 或 ratio 引用核心資料，正解由核心資料推導
  correctCategories?: Record<string, string>;  // 只給自訂文字項目，鍵是項目 ID
}
interface TransactionEffectQuestion extends QuestionBase {
  type: 'transaction_effect';
  prompt: LocalizedText;
  scenario: Scenario;               // targets 可以是 direction 目標（用 choices 作答；指標 target 另有 becomes_computable、becomes_na），也可以是 delta 或 value 目標（輸入數字作答）
  choices?: Direction[];            // 只適用於 direction 目標，有 direction 目標時必填，例如 ['up', 'down', 'unchanged']
}
interface FiveStepFillQuestion extends QuestionBase {
  type: 'five_step_fill';
  prompt: LocalizedText;
  scenario: Scenario;
  openCells: string[];              // 預設 ['cf_pretax_income', 'bs_cash', 'bs_retained_earnings']（第 13 節）
}
interface RatioNumericQuestion extends QuestionBase {
  type: 'ratio_numeric';
  prompt: LocalizedText;
  compute: {
    ratioRef: string;
    scenario?: Scenario;            // 與 measures 二選一
    measures?: Record<string, string>;  // 鍵是線 ID 或輸入值名稱，值是 'vars.<名稱>'
  };
  answerUnit: RatioUnit;
  decimals: number;
  tolerance: number;
  acceptStatus?: 'na'[];
}
interface JudgmentQuestion extends QuestionBase {
  type: 'judgment';
  prompt: LocalizedText;
  scored: false;
  options: { id: string; text: LocalizedText; upside: LocalizedText; downside: LocalizedText }[];  // 3 個
  viewpoint: LocalizedText;         // 原創撰寫的解說觀點
  attribution: 'site';              // 固定為 site（已決定【待確認 T37】，2026-10-23：不以老師名義標示）
}
interface JournalEntryQuestion extends QuestionBase {
  type: 'journal_entry';            // chapterId 必須是「借貸與分錄」延伸章（scope: extension，D1）
  prompt: LocalizedText;
  scenario: Scenario;               // 正解由核心依事件產生（第 14 節）；targets 可為空陣列
  accountChoices: string[];
  allowAliases?: boolean;           // 預設 true
}
```

`ratio_numeric` 的 `compute.scenario` 與 `compute.measures` 二選一：`scenario` 由故事或自訂期初推導報表；`measures` 直接給公式需要的線值，適合觀念練習。`measures` 的鍵必須是公式用到的線 ID（例如 `is_net_income`），值是 `vars.<名稱>`；數字本身只寫在 `vars`，所以題幹以 `{{money:vars.netIncome}}` 顯示的數字和計算用的是同一個值。validator 檢查用到的線都有給值、沒用到的不准多給（08 第 5.5 節的 `ans.ratioNumericFields`）。`slides03` 這類需要額外輸入值（例如稅率）的版本，輸入值也放在 `measures`，鍵用 `input.` 後面的名稱。`ratio_numeric` 的答案在 `expected` 中固定以 `answer` 為鍵（第 16.1 節）。

`multi_choice` 的規則（已決定 D12，2026-10-20；範例見第 17.10 節）：
- 驗證：`correctOptionIds` 至少兩個且不重複，每個都存在於 `options`；選項 3 到 5 個（08 的 `struct.optionCount`），而且至少一個不是正解（否則任選或全選都對，題目沒有鑑別力）；`scoringMode` 必填。只有一個正解的題目不得用 `multi_choice`，要改成 `single_choice`。
- 判分（`scoreMultiChoice`，不給部分分數）：`any_correct` 時作答必須剛好一個選項，而且在 `correctOptionIds` 之中；`all_correct` 時作答的選項集合必須和 `correctOptionIds` 完全相同（全部正解都選、沒有選到錯誤選項），按「確認答案」後才判分。已決定（2026-10-20）：`scoreMultiChoice` 放在 `packages/quiz`（從原本 `core` 的 `scoring/` 移過來），規則不變（第 2 節）。
- 學習端提示是固定的介面字串，依 `scoringMode` 選用：`any_correct` 為「這題有不只一個合理答案，選出任一個即可。」，`all_correct` 為「選出所有正確答案（可複選）。」。提示放在選項群組的標題（fieldset 的 legend）中，讓螢幕閱讀器先唸出；提示與題幹都不透露正確答案的數量。
- 作答後每個選項都顯示自己的 `feedback`，並標出全部正確答案（`any_correct` 也一樣，讓學生知道另一個合理答案）。
- 改動 `scoringMode` 或 `correctOptionIds` 屬於答案改版（`revKind: "answer"`），兩者都列入 `answerHash`（第 15.3 節）。後台以單選按鈕選擇判分方式並即時預覽學習端提示，Excel 範本有「判分方式」下拉欄位（見 08）。
- 作答元件在 M2 與 `single_choice` 共用：`any_correct` 沿用單選介面，`all_correct` 換成核取方塊；兩種判分方式與單選題都用同一個「確認答案」按鈕（英文 "Check answer"），按下後才判分。

### 16.3 名詞

名詞資料只有一種實體 Term（`tm_` 前綴），與 08 第 2.1、3.7 節一致：術語表不另設實體，[12 術語表](12-glossary.md) 的每一列核准後轉成一筆 Term（欄位對應見 12 第 16 節）。同一筆資料包含兩部分：

- **用語欄位**：教材說法、現行台灣說法、IFRS 英文、別名、旗標、信心程度與待確認編號，供報表列名、搜尋與英文介面使用。12 的術語表就是這一部分的底稿。
- **名詞卡內容**：給學生看的原創定義、例子、常見誤解、公式與 IFRS 說明。

```ts
type TermFlag = 'japanese' | 'old_name' | 'typo_fixed' | 'unused' | 'not_ifrs_line' | 'ifrs_treatment_differs' | 'simplified';

interface Term {
  id: string;                       // 'tm_' 加 8 碼
  rev: number; revKind: 'text' | 'answer'; status: 'draft' | 'published' | 'retired';
  category: 'statement' | 'account' | 'ratio' | 'concept' | 'process' | 'other';
  // 用語欄位
  label: LocalizedText;             // 各語系的主要顯示；zh-TW 為教材用語，W 系列涵蓋的修正寫法依 D13 A 生效（原字放 aliases）；en 也是英文報表的列名，英式拼字（D11）
  teacherLabel: string;             // 教材原字
  currentTwLabel: string | null;    // 現行台灣用語；與教材相同時可填同一個詞
  ifrsEnglish: string | null;       // IFRS 英文；IFRS 沒有對應的列為 null，描述性英文放 label.en，並必須有 ifrsNote
  enUsVariant?: string;             // 美式拼法；D11 已定英式為顯示拼字，這個值同時收進 aliases.en，只供搜尋、不顯示
  aliases: { 'zh-TW': string[]; en: string[] };
  flags: TermFlag[];                // 可為空陣列；前六種與第 4.1 節的科目旗標同名
  confidence: 'high' | 'medium' | 'pending';
  pendingRefs: string[];            // 相關設計決定的編號（14 的 T 系列），可為空陣列；confidence 為 pending 時至少一個編號。2026-10-23 起 T 系列已全部決定，名詞不再因 T 系列而 pending，pendingRefs 只用來連到設計說明
  ifrsBasis?: string;               // 例如 'IAS 1'；IFRS 18 生效後據此找出要更新的名詞
  note?: LocalizedText;             // 用語本身的說明，例如教材異寫的原因
  // 名詞卡內容
  definition: LocalizedText;        // 原創撰寫
  example?: LocalizedText;
  misconception?: LocalizedText;
  formula?: LocalizedText;          // 指標以 ratioRef 帶出版本公式時可省略
  ifrsNote?: LocalizedText;         // 旗標含 not_ifrs_line 或 ifrs_treatment_differs，或 ifrsEnglish 為 null 時必填
  // 連結
  accountRef?: string;
  ratioRef?: string;
  related?: string[];               // 相關名詞卡 ID
  labRefs?: { story: string; step: string }[];  // 可開啟的故事步驟，格式同題目的 labRef
  unlock?: { levelId: string };     // 省略時，第一次在題目中遇到就解鎖
}
```

名詞卡只有一個來源，闖關區與實驗室開的是同一張；科目的 `termRef` 指向名詞，所以科目表、名詞卡與 12 的術語表用的是同一組用語。12 第 16 節提醒：模板列名、別名性質的列只需要用語欄位，`definition` 必填等於每一列都要寫一段原創定義；這一點列在第 20 節，於 M0b 建立內容 schema 時定案。

## 17. 最低範例集

以下範例都使用自編的「青檸文具社」故事（`story_q7m2v9`，`origin` 為 `original`）。它是 repo 內的測試故事，只放在測試 fixtures，不進發布快照；正式故事照老師的情境與金額（D2），公司名稱另由規劃者在 M4 前提案、你確認（D9）。這個測試故事依教材 18 種交易的順序編排，自編數字為：成立 2,400,000、事務用品 36,000、電腦設備 360,000（4 年）、外包網頁 120,000、設立費 150,000（5 年）、現金進貨 640,000、全部存貨以現金 1,120,000 賣出、借款 900,000、賒購 2,800,000、全部存貨賒銷 5,600,000、付清貨款、收回帳款 3,900,000、董監事酬勞 210,000、包裝運送費 380,000、還款並付息 27,000、盤點後存貨 420,000、年底折舊與攤銷、所得稅 560,000。ID 格式依 08 第 4.1 節，題型代號與欄位名稱依第 16 節（與 08 第 3 節一致）。

自編故事第 18 步之後的累計結果（`teacher@1`，黃金測試的一部分，數字由本文件手算，實作時以計算表逐筆核對）：

| 項目 | 金額 | 項目 | 金額 |
| --- | --- | --- | --- |
| 營業收入 | 6,720,000 | 營業活動（H23） | 247,000 |
| 營業成本（3,440,000 減盤盈 420,000） | 3,020,000 | 投資活動（H29） | -510,000 |
| 營業毛利 | 3,700,000 | 籌資活動（H36） | 2,400,000 |
| 銷管費用小計 | 836,000 | 期末現金（H41 ＝ L12） | 2,137,000 |
| 營業利益 | 2,864,000 | 應收帳款 | 1,700,000 |
| 營業外支出小計（利息 27,000、攤銷 30,000） | 57,000 | 存貨 | 420,000 |
| 經常利益＝稅前淨利 | 2,807,000 | 機器設備淨額、設立費 | 270,000、120,000 |
| 所得稅費用 | 560,000 | 資產總計（L29） | 4,647,000 |
| 本期淨利 | 2,247,000 | 股本加未分配盈餘（N29） | 2,400,000 ＋ 2,247,000 ＝ 4,647,000 |

直接法的營運產生之現金是 5,020,000 － 3,440,000 － 746,000 ＝ 834,000，等於間接法的 H20（2,807,000 ＋ 90,000 ＋ 27,000 ＋ 30,000 － 1,700,000 － 420,000），四個勾稽點的差額都是 0。

範例用到的隨機 ID（只為了讓範例好讀，實際 ID 由 `pnpm content:new` 產生）：

| ID | 代表 | ID | 代表 |
| --- | --- | --- | --- |
| `story_q7m2v9` | 青檸文具社故事 | `tm_c4sh8k2p` | 名詞卡：現金 |
| `st_p4n7e2` | 第 6 步：現金進貨 | `tm_n7v3k8pq` | 名詞卡：存貨 |
| `st_h8q3z6` | 第 7 步：以現金賣出全部存貨 | `tm_r7x2c9fa` | 名詞卡：應收帳款 |
| `st_j3v9k2` | 第 9 步：賒購 | `tm_a3p9y6kc` | 名詞卡：應付帳款 |
| `st_c6w1q4` | 第 10 步：賒銷全部存貨 | `tm_s5b8r3hd` | 名詞卡：短期借款 |
| `st_m2x8r5` | 第 12 步：收回帳款 | `tm_v3n8q2ye` | 名詞卡：營業收入 |
| `st_w4r8n2` | 第 15 步：還款並付息 | `tm_g5c2m8tw` | 名詞卡：營業成本 |
| `st_y5c1h8` | 第 17 步：折舊與攤銷 | `tm_g8p4w1rz` | 名詞卡：營業毛利 |
| `tm_b6s3k9hn` | 名詞卡：資產負債表 | `tm_n4e8t2jy` | 名詞卡：本期淨利 |
| `tm_p2a7c5vk` | 名詞卡：營業活動 | `tm_t7a3s6wb` | 名詞卡：資產總計 |
| `tm_f9a4c6md` | 名詞卡：籌資活動 | `tm_c2y9b5ex` | 名詞卡：流動負債 |
| `tm_r0a5t3kq` | 名詞卡：資產報酬率 | `tm_c8r1t4zm` | 名詞卡：流動比率 |
| `tm_n9s2t7ak` | 名詞卡：N/A 與 0 的差別 | `tm_h3c7v1xe` | 名詞卡：利息保障倍數 |
| `tm_d4p7x2mv` | 名詞卡：折舊費用 | `tm_a8d5c1pz` | 名詞卡：累計折舊 |
| `tm_a2m7z4tf` | 名詞卡：攤銷遞延資產 | `tm_x5c9e3nb` | 名詞卡：非現金費用 |
| `tm_m8d3n6qa` | 名詞卡：間接法 | `tm_k6t2e9wr` | 名詞：支付利息（現行：利息費用） |
| `ch_b7k2w9`、`ch_n3f8q1`、`ch_x4d9p2`、`ch_v8s2e5` | 章節（分別用在 17.1、17.10 第一題；17.2、17.5、17.9、17.10 第二題；17.3；17.4） | `tm_d9f3g7cs` | 名詞卡：設立費 |
| `ch_e4j7r2` | 「借貸與分錄」延伸章（`scope: "extension"`，用在 17.11） | `tm_w2j8d5ky` | 名詞卡：借貸分錄 |
| `tm_v6j2k8sr`、`tm_p7h3c5xq`、`tm_q4k9v2nd` | 名詞卡：期初存貨、本期進貨、期末存貨 | `lv_6d2q9w4h` | 關卡（名詞卡解鎖條件） |
| `obj_3hq8n2` 等 | 學習目標（每題一個，與題目同章） | `o_r2v8` 等 | 選項（4 碼，題內唯一） |

| 範例 | 示範重點 |
| --- | --- |
| 17.1 | 情境單選（`single_choice`）：`vars`、穩定選項 ID、逐選項回饋、解說以選項 ID 引用、`termRefs`、以故事與步驟 ID 表示的 `labRef` |
| 17.2 | 交易影響題（`transaction_effect`）：`scenario`、事件參數佔位符、核心算出的答案與編譯後快照 |
| 17.3 | 指標計算題（`ratio_numeric`）：`compute`、`answerUnit`、容許誤差；另一個變體的正解是 N/A |
| 17.4 | 不計分的取捨題（`judgment`） |
| 17.5 | 缺英文翻譯的草稿（`true_false`）與預覽中的退回結果 |
| 17.6 | 名詞（Term）：教材用語、現行台灣用語、IFRS 英文、別名、旗標、待確認狀態與名詞卡內容 |
| 17.7 | 交易範本「以現金賣出全部存貨」：`derived` 與前置條件 |
| 17.8 | 交易範本「還清短期借款並付息」：一筆付款拆成兩種現金流量活動 |
| 17.9 | 一個故事步驟包含兩個事件 |
| 17.10 | 多正解題（`multi_choice`）的兩種判分方式：`any_correct` 與 `all_correct`，以及列入 `answerHash` 的欄位 |
| 17.11 | 延伸章的分錄題（`journal_entry`）：正解由核心依事件產生，合併同科目同方向後比對 |

### 17.1 情境單選

```json
{
  "id": "q_m4t9x2ka",
  "rev": 1,
  "revKind": "text",
  "status": "published",
  "type": "single_choice",
  "chapterId": "ch_b7k2w9",
  "objectiveId": "obj_3hq8n2",
  "difficulty": 1,
  "tags": ["credit_sale", "accrual_basis"],
  "termRefs": ["tm_r7x2c9fa", "tm_v3n8q2ye", "tm_b6s3k9hn"],
  "labRef": { "story": "story_q7m2v9", "step": "st_c6w1q4" },
  "scored": true,
  "vars": { "amount": 260000 },
  "prompt": {
    "zh-TW": "青檸文具社把一批筆記本送到附近的補習班，對方說月底才會付款 {{money:vars.amount}}。如果今天結算，哪一個數字最能反映「這筆錢已經賺到，但還沒收到」？",
    "en": "Lime Leaf Stationery delivered a batch of notebooks to a nearby cram school, which will pay {{money:vars.amount}} at the end of the month. If the books were closed today, which figure best shows money that has been earned but not yet collected?"
  },
  "options": [
    {
      "id": "o_r2v8",
      "text": { "zh-TW": "資產負債表上的應收帳款增加", "en": "An increase in accounts receivable on the balance sheet" },
      "feedback": {
        "zh-TW": "答對了。貨已經交出去，收入算是賺到了；錢還沒進來，所以先記成「別人欠公司的錢」，也就是{{term:tm_r7x2c9fa}}。",
        "en": "Correct. The goods have been delivered, so the revenue is earned. The cash has not arrived, so the amount is recorded as money owed to the company: {{term:tm_r7x2c9fa}}."
      }
    },
    {
      "id": "o_k5p1",
      "text": { "zh-TW": "現金流量表上的現金增加", "en": "An increase in cash on the statement of cash flows" },
      "feedback": {
        "zh-TW": "現金流量表只記錄真的收到或付出的錢。補習班還沒付款，現金一塊都沒有增加。",
        "en": "The statement of cash flows only records cash that actually comes in or goes out. The school has not paid yet, so cash has not increased at all."
      }
    },
    {
      "id": "o_w9d3",
      "text": { "zh-TW": "損益表上的營業收入維持不變", "en": "Revenue on the income statement stays the same" },
      "feedback": {
        "zh-TW": "收入看的是「賺到了沒」，不是「收到錢了沒」。貨交出去了，營業收入今天就會增加。",
        "en": "Revenue depends on whether it has been earned, not on whether the cash has been received. The goods were delivered, so revenue increases today."
      }
    }
  ],
  "correctOptionId": "o_r2v8",
  "explanation": {
    "zh-TW": "賒銷的當下，{{term:tm_v3n8q2ye}}增加、{{term:tm_r7x2c9fa}}增加，現金不變。選「{{option:o_k5p1}}」或「{{option:o_w9d3}}」，都是把「賺到」和「收到」混在一起了。",
    "en": "At the moment of a credit sale, {{term:tm_v3n8q2ye}} and {{term:tm_r7x2c9fa}} both increase while cash stays the same. Choosing {{option:o_k5p1}} or {{option:o_w9d3}} mixes up earning money with receiving it."
  }
}
```

### 17.2 交易影響題（含 scenario 與核心算出的答案）

作者撰寫的原始資料。售價只寫在事件的 `params`，題幹以 `{{money:e1.price}}` 引用，所以題幹顯示的金額與計算用的是同一個值；這一題沒有題目自帶的數字，不需要 `vars`：

```json
{
  "id": "q_tx7h2c9d",
  "rev": 1,
  "revKind": "text",
  "status": "published",
  "type": "transaction_effect",
  "chapterId": "ch_n3f8q1",
  "objectiveId": "obj_5vk2m7",
  "difficulty": 2,
  "tags": ["inventory", "sale", "cash_flow"],
  "termRefs": ["tm_g5c2m8tw", "tm_g8p4w1rz", "tm_n7v3k8pq", "tm_p2a7c5vk"],
  "labRef": { "story": "story_q7m2v9", "step": "st_h8q3z6" },
  "scored": true,
  "scenario": {
    "opening": { "storyRef": "story_q7m2v9", "afterStep": "st_p4n7e2" },
    "events": [
      { "id": "e1", "template": "tpl.sell_all_inventory_cash", "params": { "price": 1120000 } }
    ],
    "policy": "teacher@1",
    "layout": "teacher@1",
    "window": "cumulative",
    "targets": [
      { "id": "t1", "kind": "line", "line": "bs_cash", "measure": "direction" },
      { "id": "t2", "kind": "line", "line": "bs_inventory", "measure": "direction" },
      { "id": "t3", "kind": "line", "line": "is_gross_profit", "measure": "direction" },
      { "id": "t4", "kind": "line", "line": "cf_operating_total", "measure": "direction" }
    ]
  },
  "choices": ["up", "down", "unchanged"],
  "prompt": {
    "zh-TW": "青檸文具社把倉庫裡全部的貨，以現金 {{money:e1.price}} 一次賣給一家連鎖書店。這筆交易之後，下面四個數字各會怎麼變？",
    "en": "Lime Leaf Stationery sells all of its inventory to a bookstore chain for {{money:e1.price}} in cash. After this transaction, how does each of the four figures below change?"
  },
  "explanation": {
    "zh-TW": "帳上存貨的成本是 {{money:e1.costOfAllInventory}}，全部轉成{{term:tm_g5c2m8tw}}，存貨歸零，營業毛利增加 {{money:expected.t3.delta}}。收到的錢屬於營業活動，所以現金與營業活動現金流量都增加 {{money:expected.t1.delta}}。",
    "en": "The inventory on the books cost {{money:e1.costOfAllInventory}}. All of it becomes {{term:tm_g5c2m8tw}} and inventory falls to zero, so gross profit rises by {{money:expected.t3.delta}}. The cash received comes from operating activities, so both cash and operating cash flow rise by {{money:expected.t1.delta}}."
  }
}
```

`content:compile` 寫入發布快照的答案（作者不用填；若填了必須相同）：

```json
{
  "id": "q_tx7h2c9d",
  "rev": 1,
  "compiled": {
    "values": { "e1.price": 1120000, "e1.costOfAllInventory": 640000, "e1.grossProfit": 480000 },
    "expected": {
      "t1": { "direction": "up", "before": 1094000, "after": 2214000, "delta": 1120000 },
      "t2": { "direction": "down", "before": 640000, "after": 0, "delta": -640000 },
      "t3": { "direction": "up", "before": 0, "after": 480000, "delta": 480000 },
      "t4": { "direction": "up", "before": -796000, "after": 324000, "delta": 1120000 }
    },
    "policy": "teacher@1",
    "layout": "teacher@1",
    "coreVersion": "0.1.0",
    "answerHash": "sha256:5b1e0c7d93a2f4e6b8d0c1a3e5f7092b4d6f8a0c2e4b6d8f0a1c3e5b7d9f1a2c"
  }
}
```

核對：第 6 筆之後現金為 2,400,000 － 36,000 － 360,000 － 120,000 － 150,000 － 640,000 ＝ 1,094,000；營業活動累計為稅前淨利 -156,000（事務用品加外包）加 H16 的 -640,000，等於 -796,000。賣出後稅前淨利為 324,000、H16 回到 0，所以營業活動變成 324,000，增加 1,120,000，和現金的增加相同。`expected` 以 target 的 `id` 為鍵（`t1` 是現金、`t2` 是存貨、`t3` 是營業毛利、`t4` 是營業活動現金流量），所以解說裡的 `{{money:expected.t3.delta}}` 就是營業毛利的增加額。`coreVersion` 只記錄在快照裡供除錯，不參與 `answerHash`。

### 17.3 指標計算題與正解為 N/A 的變體

這題用 `compute.measures` 直接給公式需要的線值（第 16.2 節），不重播故事。數字只寫在 `vars`，`measures` 以 `vars.<名稱>` 引用：

```json
{
  "id": "q_r8n2v5qe",
  "rev": 1,
  "revKind": "text",
  "status": "published",
  "type": "ratio_numeric",
  "chapterId": "ch_x4d9p2",
  "objectiveId": "obj_8wc3k6",
  "difficulty": 2,
  "tags": ["roa", "profitability"],
  "termRefs": ["tm_r0a5t3kq", "tm_n4e8t2jy", "tm_t7a3s6wb"],
  "scored": true,
  "vars": { "netIncome": 1180000, "totalAssets": 4720000 },
  "compute": {
    "ratioRef": "roa@excel",
    "measures": { "is_net_income": "vars.netIncome", "bs_total_assets": "vars.totalAssets" }
  },
  "answerUnit": "percent",
  "decimals": 2,
  "tolerance": 0.01,
  "prompt": {
    "zh-TW": "青檸文具社今年的本期淨利是 {{money:vars.netIncome}}，年底的資產總計是 {{money:vars.totalAssets}}。請用年底的資產計算資產報酬率（ROA），以百分比作答，取到小數點後兩位。",
    "en": "This year Lime Leaf Stationery earned a net income of {{money:vars.netIncome}}, and its total assets at year end were {{money:vars.totalAssets}}. Using year-end total assets, what is its return on assets (ROA)? Answer as a percentage with two decimal places."
  },
  "explanation": {
    "zh-TW": "這一題用期末資產（與老師 Excel 相同的口徑）：ROA ＝ 本期淨利 ÷ 期末資產總計 ＝ {{money:vars.netIncome}} ÷ {{money:vars.totalAssets}} ＝ {{percent:expected.answer.value}}。若改用平均資產並加回稅後利息，數字會不同，指標卡會並列兩種算法。",
    "en": "This question uses year-end assets, the same basis as the course spreadsheet: ROA = net income ÷ year-end total assets = {{money:vars.netIncome}} ÷ {{money:vars.totalAssets}} = {{percent:expected.answer.value}}. Using average assets and adding back after-tax interest gives a different figure; the ratio card shows both versions."
  }
}
```

正解為 N/A 的變體：

```json
{
  "id": "q_c3k7w1nb",
  "rev": 1,
  "revKind": "text",
  "status": "published",
  "type": "ratio_numeric",
  "chapterId": "ch_x4d9p2",
  "objectiveId": "obj_2mz7r4",
  "difficulty": 2,
  "tags": ["current_ratio", "na_vs_zero"],
  "termRefs": ["tm_c8r1t4zm", "tm_c2y9b5ex", "tm_n9s2t7ak"],
  "scored": true,
  "vars": { "currentAssets": 1860000, "currentLiabilities": 0 },
  "compute": {
    "ratioRef": "current_ratio@excel",
    "measures": { "bs_current_assets": "vars.currentAssets", "bs_current_liabilities": "vars.currentLiabilities" }
  },
  "answerUnit": "multiple",
  "decimals": 2,
  "tolerance": 0.01,
  "acceptStatus": ["na"],
  "prompt": {
    "zh-TW": "青檸文具社目前的流動資產是 {{money:vars.currentAssets}}，而且沒有任何流動負債。它的流動比率是多少？如果算不出來，請按「N/A」。",
    "en": "Lime Leaf Stationery has current assets of {{money:vars.currentAssets}} and no current liabilities at all. What is its current ratio? If it cannot be calculated, press N/A."
  },
  "explanation": {
    "zh-TW": "流動比率 ＝ 流動資產 ÷ 流動負債。這裡沒有任何流動負債，沒有可以拿來除的數，比率根本不存在，所以答案是 N/A。N/A 和 0 不一樣：比率算得出來、只是剛好等於零，才寫 0；這裡是算不出來，也不能說成「無限大」或「滿分」。",
    "en": "Current ratio = current assets ÷ current liabilities. There are no current liabilities to divide by, so the ratio does not exist and the answer is N/A. N/A is not the same as 0: you write 0 only when the ratio can be calculated and happens to equal zero. Here it cannot be calculated at all, and it should not be described as infinite or perfect."
  }
}
```

兩題的編譯結果：

```json
[
  {
    "id": "q_r8n2v5qe",
    "rev": 1,
    "compiled": {
      "values": { "vars.netIncome": 1180000, "vars.totalAssets": 4720000 },
      "expected": {
        "answer": {
          "ratioRef": "roa@excel",
          "status": "ok",
          "exact": { "num": "1", "den": "4" },
          "value": 0.25,
          "displayValue": 25,
          "answerUnit": "percent",
          "decimals": 2,
          "reason": null
        }
      }
    }
  },
  {
    "id": "q_c3k7w1nb",
    "rev": 1,
    "compiled": {
      "values": { "vars.currentAssets": 1860000, "vars.currentLiabilities": 0 },
      "expected": {
        "answer": {
          "ratioRef": "current_ratio@excel",
          "status": "na",
          "exact": null,
          "value": null,
          "displayValue": null,
          "answerUnit": "multiple",
          "decimals": 2,
          "reason": { "key": "ratio.reason.denominator_zero", "params": { "line": "bs_current_liabilities" } }
        }
      }
    }
  }
]
```

第一題學生輸入「25」「25.00」「２５．００」都會在 05 的正規化後解析成 25，與 `displayValue` 25 的差距在 `tolerance` 0.01 以內，判為正確；解說中的 `{{percent:expected.answer.value}}` 取精確值 0.25，顯示為 25.00%。第二題只有按下「N/A」才正確，輸入 0 判為錯誤；正解是 N/A 時解說不引用 `expected.answer.value`，因為它是 null。

### 17.4 不計分的取捨題

```json
{
  "id": "q_j6p3d8vb",
  "rev": 1,
  "revKind": "text",
  "status": "published",
  "type": "judgment",
  "chapterId": "ch_v8s2e5",
  "objectiveId": "obj_6yt1q9",
  "difficulty": 3,
  "tags": ["financing", "working_capital", "judgment"],
  "termRefs": ["tm_s5b8r3hd", "tm_a3p9y6kc", "tm_c8r1t4zm"],
  "labRef": { "story": "story_q7m2v9", "step": "st_j3v9k2" },
  "scored": false,
  "vars": { "orderCost": 1500000, "cashOnHand": 760000, "termDays": 60 },
  "prompt": {
    "zh-TW": "開學季前，青檸文具社想多進一批價值 {{money:vars.orderCost}} 的貨，但帳上現金只有 {{money:vars.cashOnHand}}。你會建議哪一種做法？三種做法都說得通，重點是說出你最看重什麼。",
    "en": "Before the new semester, Lime Leaf Stationery wants to order extra stock worth {{money:vars.orderCost}}, but it only has {{money:vars.cashOnHand}} in cash. Which approach would you suggest? All three can make sense; what matters is explaining what you value most."
  },
  "options": [
    {
      "id": "o_f1b6",
      "text": { "zh-TW": "向銀行借短期借款，一次把貨進齊", "en": "Take a short-term bank loan and buy all the stock at once" },
      "upside": {
        "zh-TW": "貨量充足，旺季不怕缺貨；和供應商的付款條件維持不變。",
        "en": "There is enough stock for the busy season, and the payment terms with the supplier stay the same."
      },
      "downside": {
        "zh-TW": "要付利息；流動負債增加，流動比率下降；如果貨賣得比預期慢，還款壓力會集中在同一個時間點。",
        "en": "Interest has to be paid, current liabilities rise and the current ratio falls. If sales are slower than expected, the repayment pressure arrives all at once."
      }
    },
    {
      "id": "o_q7n4",
      "text": { "zh-TW": "請供應商給 {{number:vars.termDays}} 天的付款期限，先賒購", "en": "Ask the supplier for {{number:vars.termDays}}-day payment terms and buy on credit" },
      "upside": {
        "zh-TW": "不用付利息，可以先賣貨、再用收到的錢付款。",
        "en": "No interest is charged, and the company can sell the goods first and pay with the cash it collects."
      },
      "downside": {
        "zh-TW": "應付帳款增加，同樣讓流動比率下降；供應商不一定答應，延遲付款也可能影響之後的進貨價格。",
        "en": "Accounts payable rise, which also lowers the current ratio. The supplier may refuse, and paying late could affect future purchase prices."
      }
    },
    {
      "id": "o_z3c9",
      "text": { "zh-TW": "只用手上的現金先進一半，賣得好再補貨", "en": "Use only the cash on hand to buy half now, and restock if sales go well" },
      "upside": {
        "zh-TW": "不增加任何負債，風險最低；也能先觀察哪些品項賣得好。",
        "en": "No new debt is taken on, so the risk is lowest, and the company can see which items sell well first."
      },
      "downside": {
        "zh-TW": "現金幾乎用光，臨時要付錢時週轉會很緊；旺季可能缺貨，錯過營收。",
        "en": "Cash is almost used up, so any unexpected payment will be hard to cover, and stock may run out in the busy season, losing sales."
      }
    }
  ],
  "viewpoint": {
    "zh-TW": "這題沒有標準答案。如果你最在意的是「不要讓現金週轉卡住」，會偏向賒購或分批進貨；如果你最在意的是「旺季不能缺貨」，借款一次進齊比較合理。不管選哪一個，都要說清楚它會讓哪張報表的哪個數字改變，以及你願意承擔哪一種風險。",
    "en": "There is no single right answer here. If your main concern is not running out of cash, buying on credit or buying in batches makes more sense. If your main concern is not running out of stock in the busy season, borrowing and buying everything at once is reasonable. Whichever you choose, explain which figures on which statements will change, and which risk you are willing to accept."
  },
  "attribution": "site",
  "explanation": {
    "zh-TW": "三種做法在報表上的差別：借款讓{{term:tm_s5b8r3hd}}和存貨一起增加；賒購讓{{term:tm_a3p9y6kc}}和存貨一起增加；只用現金進貨則是現金減少、存貨增加，負債不變。",
    "en": "How the three choices differ on the statements: borrowing increases {{term:tm_s5b8r3hd}} and inventory together; buying on credit increases {{term:tm_a3p9y6kc}} and inventory together; paying cash reduces cash and increases inventory, with no change in liabilities."
  }
}
```

### 17.5 缺英文翻譯的草稿與預覽中的退回結果

zh-TW 與 en 從 M0b 起都是 complete 語系（見 05），內容只有在中英兩種語言都齊全時才能設為 published。所以只有 zh-TW 的題目只能是草稿：它會列在翻譯報表裡，但不讓 CI 失敗；作者若在補上英文之前把它改成 published，CI 就會擋下。下面的退回結果出現在含草稿的預覽建置（本機 `pnpm content:preview` 或 PR 預覽，見 08 第 6 節），正式快照不會有這一題。`beta` 只保留給日後新增的第三種語言，退回機制也同樣適用於它。

原始資料（只有 zh-TW）：

```json
{
  "id": "q_d2h5s9fb",
  "rev": 1,
  "revKind": "text",
  "status": "draft",
  "type": "true_false",
  "chapterId": "ch_n3f8q1",
  "objectiveId": "obj_9pd4x1",
  "difficulty": 1,
  "tags": ["depreciation", "non_cash"],
  "termRefs": ["tm_d4p7x2mv", "tm_m8d3n6qa"],
  "labRef": { "story": "story_q7m2v9", "step": "st_y5c1h8" },
  "scored": true,
  "statement": { "zh-TW": "公司提列折舊費用的那一刻，帳上的現金也會跟著減少。" },
  "correct": false,
  "feedbackTrue": { "zh-TW": "折舊是把設備的成本分攤到使用的年度，提列時沒有任何現金付出去；現金在當初買設備時就已經付掉了。" },
  "feedbackFalse": { "zh-TW": "沒錯。折舊不會讓現金減少，所以間接法的現金流量表要把折舊費用加回來。" },
  "explanation": { "zh-TW": "{{term:tm_d4p7x2mv}}會讓本期淨利變少，但不會讓現金變少；這就是{{term:tm_m8d3n6qa}}從稅前淨利出發後，要把折舊加回的原因。" }
}
```

在預覽建置的英文介面中，ContentSource 取這一題時的結果（欄位形狀依 08 第 7.4 節與 05 第 4.3 節的 `ResolvedText`；元件依 `isFallback` 加上「尚未翻譯」標記並設定 `lang="zh-TW"`；名詞卡本身有英文，所以不退回）。為了好讀，`text` 這裡寫成原文，實際是編譯後的 AST：

```json
{
  "questionId": "q_d2h5s9fb",
  "rev": 1,
  "requestedLocale": "en",
  "fields": {
    "statement": { "text": "公司提列折舊費用的那一刻，帳上的現金也會跟著減少。", "lang": "zh-TW", "isFallback": true },
    "feedbackTrue": { "text": "折舊是把設備的成本分攤到使用的年度，提列時沒有任何現金付出去；現金在當初買設備時就已經付掉了。", "lang": "zh-TW", "isFallback": true },
    "feedbackFalse": { "text": "沒錯。折舊不會讓現金減少，所以間接法的現金流量表要把折舊費用加回來。", "lang": "zh-TW", "isFallback": true },
    "explanation": { "text": "{{term:tm_d4p7x2mv}}會讓本期淨利變少，但不會讓現金變少；這就是{{term:tm_m8d3n6qa}}從稅前淨利出發後，要把折舊加回的原因。", "lang": "zh-TW", "isFallback": true }
  },
  "termChips": [
    { "termRef": "tm_d4p7x2mv", "label": "Depreciation expense", "lang": "en", "isFallback": false },
    { "termRef": "tm_m8d3n6qa", "label": "Indirect method", "lang": "en", "isFallback": false }
  ]
}
```

`content:i18n-report` 的對應條目（格式依 05 第 6.1 節，節錄）。en 是 complete，但這一題是草稿，依 05 第 6.2 節只列入報表，不讓 CI 失敗；同一題若是 published，`result` 會變成 `fail`：

```json
{
  "missing": [
    { "locale": "en", "itemType": "question", "id": "q_d2h5s9fb", "status": "draft", "chapterId": "ch_n3f8q1", "field": "statement" },
    { "locale": "en", "itemType": "question", "id": "q_d2h5s9fb", "status": "draft", "chapterId": "ch_n3f8q1", "field": "feedbackTrue" },
    { "locale": "en", "itemType": "question", "id": "q_d2h5s9fb", "status": "draft", "chapterId": "ch_n3f8q1", "field": "feedbackFalse" },
    { "locale": "en", "itemType": "question", "id": "q_d2h5s9fb", "status": "draft", "chapterId": "ch_n3f8q1", "field": "explanation" }
  ],
  "result": "pass"
}
```

### 17.6 名詞（用語欄位與名詞卡內容）

同一筆 Term 同時記錄用語本身（教材用語、現行台灣用語、IFRS 英文、別名、旗標、待確認狀態）與學生看到的名詞卡內容：

```json
{
  "id": "tm_k6t2e9wr",
  "rev": 2,
  "revKind": "text",
  "status": "published",
  "category": "account",
  "label": { "zh-TW": "支付利息", "en": "Finance costs" },
  "teacherLabel": "支付利息",
  "currentTwLabel": "利息費用",
  "ifrsEnglish": "Finance costs",
  "aliases": {
    "zh-TW": ["利息費用", "財務成本"],
    "en": ["Interest expense"]
  },
  "flags": ["japanese"],
  "confidence": "pending",
  "pendingRefs": ["T11"],
  "ifrsBasis": "IAS 1",
  "note": {
    "zh-TW": "教材在損益表與間接法都用「支付利息」這個字，但損益表那一列記的是利息費用，不是付出去的現金。",
    "en": "The course materials use the same label on the income statement and in the indirect method, but the income statement line records interest expense, not cash paid."
  },
  "definition": {
    "zh-TW": "公司因為借錢而要負擔的成本。教材把損益表上的這一列叫做「支付利息」，但它記的是這一期應該負擔的利息費用，不一定等於這一期實際付出去的現金。",
    "en": "The cost a company bears for borrowing money. The course materials call this income statement line interest paid, but it records the interest expense for the period, which is not necessarily the cash actually paid during the period."
  },
  "misconception": {
    "zh-TW": "看到「支付」就以為一定有現金流出。間接法會先把這筆費用加回，再在下面另外扣掉真正付出去的利息。",
    "en": "Seeing the word paid and assuming cash must have left the company. The indirect method first adds this expense back, then deducts the interest actually paid further down."
  },
  "accountRef": "interest_expense",
  "related": ["tm_h3c7v1xe", "tm_m8d3n6qa"],
  "labRefs": [{ "story": "story_q7m2v9", "step": "st_w4r8n2" }],
  "ifrsNote": {
    "zh-TW": "台灣現行的綜合損益表在營業外收入及支出下列示「財務成本」。IAS 7 目前允許支付之利息列在營業活動或籌資活動。",
    "en": "Current Taiwanese statements of comprehensive income present this as finance costs under non-operating income and expenses. IAS 7 currently allows interest paid to be classified as an operating or a financing cash flow."
  },
  "unlock": { "levelId": "lv_6d2q9w4h" }
}
```

依 08 第 3.7 節，`ifrsNote` 只在旗標含 `not_ifrs_line` 或 `ifrs_treatment_differs`，或 `ifrsEnglish` 為 null 時必填。這個名詞只有 `japanese` 旗標，而且有 IFRS 英文，所以是選填；這裡仍然填，是因為利息的現金流量分類正是 T11 的設計決定要說明的事。`pendingRefs` 是陣列，列出相關設計決定的編號；畫面顯示「設計說明」（2026-10-23 起不再是「待確認」），老師的回饋改變其中一項時，只調整那一個編號對應的資料。

### 17.7 交易範本：以現金賣出全部存貨

```json
{
  "id": "tpl.sell_all_inventory_cash",
  "rev": 1,
  "revKind": "text",
  "status": "published",
  "title": { "zh-TW": "以現金賣出全部存貨", "en": "Sell all inventory for cash" },
  "summary": {
    "zh-TW": "把帳上全部存貨（成本 {{money:derived.costOfAllInventory}}）以現金 {{money:param.price}} 賣出。",
    "en": "Sell all inventory on the books (cost {{money:derived.costOfAllInventory}}) for {{money:param.price}} in cash."
  },
  "params": [
    {
      "name": "price",
      "type": "money",
      "min": 0,
      "max": 999999999999,
      "default": 1000000,
      "monotonic": "increasing",
      "label": { "zh-TW": "售價（收到的現金）", "en": "Selling price (cash received)" }
    }
  ],
  "derived": [
    {
      "name": "costOfAllInventory",
      "type": "money",
      "expr": "balance(inventory)",
      "label": { "zh-TW": "全部存貨的帳上成本", "en": "Carrying amount of all inventory" }
    },
    {
      "name": "grossProfit",
      "type": "money",
      "expr": "param.price - derived.costOfAllInventory",
      "label": { "zh-TW": "這筆交易的毛利", "en": "Gross profit on this sale" }
    }
  ],
  "preconditions": [
    {
      "id": "has_inventory",
      "expr": "balance(inventory) > 0",
      "message": {
        "zh-TW": "帳上沒有存貨，無法「賣出全部存貨」。請先進貨。",
        "en": "There is no inventory on the books to sell. Purchase some inventory first."
      }
    }
  ],
  "lines": [
    { "id": "l1", "account": "cash", "side": "debit", "amount": "param.price", "cf": { "activity": "operating", "kind": "receipts_from_customers" } },
    { "id": "l2", "account": "revenue", "side": "credit", "amount": "param.price" },
    { "id": "l3", "account": "cost_of_goods_sold", "side": "debit", "amount": "derived.costOfAllInventory" },
    { "id": "l4", "account": "inventory", "side": "credit", "amount": "derived.costOfAllInventory", "tag": "cost_of_sale" }
  ],
  "explanation": {
    "zh-TW": "賣出全部存貨時，收入用售價記錄，成本則是帳上存貨的金額，兩者相減就是毛利。成本不是自己填的數字，而是讀帳上的存貨餘額，所以前面進貨金額改了，這裡的成本也會跟著變。",
    "en": "When all inventory is sold, revenue is recorded at the selling price and the cost is the amount of inventory on the books; the difference is the gross profit. The cost is not typed in but read from the inventory balance, so if an earlier purchase changes, this cost changes too."
  },
  "termRefs": ["tm_v3n8q2ye", "tm_g5c2m8tw", "tm_n7v3k8pq", "tm_g8p4w1rz"]
}
```

`grossProfit` 可以是負數（只用在文字，不進分錄）。售價改成 0 時，`l1`、`l2` 被移除，仍是合法的分錄（只剩成本兩行）。

### 17.8 交易範本：還清短期借款並付息（兩種現金流量活動）

```json
{
  "id": "tpl.repay_all_short_term_loans_with_interest",
  "rev": 1,
  "revKind": "text",
  "status": "published",
  "title": { "zh-TW": "還清短期借款並支付利息", "en": "Repay all short-term borrowings with interest" },
  "summary": {
    "zh-TW": "以現金還清短期借款本金 {{money:derived.principal}}，並支付利息 {{money:param.interest}}。",
    "en": "Repay short-term borrowings of {{money:derived.principal}} in cash and pay interest of {{money:param.interest}}."
  },
  "params": [
    {
      "name": "interest",
      "type": "money",
      "min": 0,
      "max": 999999999999,
      "default": 30000,
      "monotonic": "increasing",
      "label": { "zh-TW": "本期支付的利息", "en": "Interest paid" }
    }
  ],
  "derived": [
    {
      "name": "principal",
      "type": "money",
      "expr": "balance(short_term_borrowings)",
      "label": { "zh-TW": "要還的本金（帳上短期借款餘額）", "en": "Principal to repay (short-term borrowings balance)" }
    },
    {
      "name": "totalPaid",
      "type": "money",
      "expr": "derived.principal + param.interest",
      "label": { "zh-TW": "付出的現金合計", "en": "Total cash paid" }
    }
  ],
  "preconditions": [
    {
      "id": "has_loan",
      "expr": "balance(short_term_borrowings) > 0",
      "message": { "zh-TW": "帳上沒有短期借款可以還。", "en": "There are no short-term borrowings to repay." }
    },
    {
      "id": "enough_cash",
      "expr": "balance(cash) >= derived.totalPaid",
      "message": { "zh-TW": "現金不夠同時還本金和付利息。", "en": "There is not enough cash to repay the principal and pay the interest." }
    }
  ],
  "lines": [
    { "id": "l1", "account": "short_term_borrowings", "side": "debit", "amount": "derived.principal" },
    { "id": "l2", "account": "interest_expense", "side": "debit", "amount": "param.interest" },
    { "id": "l3", "account": "cash", "side": "credit", "amount": "derived.principal", "cf": { "activity": "financing", "kind": "st_borrowing_repayment" } },
    { "id": "l4", "account": "cash", "side": "credit", "amount": "param.interest", "cf": { "activity": "operating", "kind": "interest_paid" } }
  ],
  "explanation": {
    "zh-TW": "同一次付款拆成兩條現金行：還本金屬於籌資活動，出現在短期借款返還；付利息在教材的間接法裡屬於營業活動，出現在支付之利息。損益表上的{{term:tm_k6t2e9wr}}會在小計之前先加回，所以利息不會被扣兩次。",
    "en": "One payment is split into two cash lines. Repaying the principal is a financing activity and appears as repayment of short-term borrowings. In the course's indirect method, paying interest is an operating activity and appears as interest paid. The {{term:tm_k6t2e9wr}} on the income statement is added back before the subtotal, so the interest is not deducted twice."
  },
  "termRefs": ["tm_s5b8r3hd", "tm_k6t2e9wr", "tm_f9a4c6md", "tm_p2a7c5vk"],
  "pendingRefs": ["T11"]
}
```

以自編故事為例（本金 900,000、利息 27,000）：H33 為 -900,000；H13 加回 27,000；H21 為 -27,000。營業活動淨額不會因為利息被扣兩次，直接法的「支付之利息」也是 -27,000。`enough_cash` 這個前置條件和第 6.3 節「現金不得為負」的餘額規則擋的是同一件事，留著是為了給交易卡一句比較好懂的提示。

這個範本帶 `pendingRefs: ["T11"]`，T11 只影響列名，不影響金額，所以沒有 `entryQuestionBlockedBy`，可以用它在「借貸與分錄」延伸章出分錄題（D1，第 17.11 節）。這與 08 第 3.8 節、5.4 節的 `acct.entryBlocked` 一致：只帶範本層級 `pendingRefs` 的範本不擋分錄題。

### 17.9 一個步驟包含兩個事件

```json
{
  "id": "st_y5c1h8",
  "order": 17,
  "title": { "zh-TW": "年底調整：設備折舊與設立費攤銷", "en": "Year-end adjustments: depreciation and amortisation" },
  "narrative": {
    "zh-TW": "年底結帳前，會計提醒老闆兩件事：電腦設備已經用了一年，要提列折舊；當初列成資產的設立費，也要攤銷今年的部分。這兩件事都不用付錢，但都會讓今年的利潤變少。",
    "en": "Before closing the books, the accountant reminds the owner of two things: the computer equipment has been used for a year and needs to be depreciated, and part of the start-up costs recorded as an asset must be amortised this year. Neither involves paying cash, but both reduce this year's profit."
  },
  "events": [
    { "id": "e1", "template": "tpl.depreciation_straight_line", "params": { "usefulLifeYears": 4 } },
    { "id": "e2", "template": "tpl.amortise_org_costs", "params": { "years": 5 }, "pendingRefs": ["T04", "T05", "T12"] }
  ],
  "termRefs": ["tm_d4p7x2mv", "tm_a8d5c1pz", "tm_a2m7z4tf", "tm_x5c9e3nb"],
  "chapterLinks": [{ "chapter": "ch_n3f8q1" }],
  "checkpoints": [
    { "ref": "e1.amount", "value": 90000 },
    { "ref": "e2.amount", "value": 30000 },
    { "ref": "cf_depreciation", "value": 90000 },
    { "ref": "cf_other_noncash_losses", "value": 30000 }
  ]
}
```

兩個範本的推導值：
- 「直線法折舊」範本（`tpl.depreciation_straight_line`）：`amount = min(round(cost(machinery_equipment) / param.usefulLifeYears), balance(machinery_equipment) - balance(accumulated_depreciation_machinery))`，分錄為借 折舊費用／貸 累計折舊。自編故事中 360,000 ÷ 4 ＝ 90,000。
- 「設立費攤銷」範本（`tpl.amortise_org_costs`）：`amount = min(round(cost(deferred_organisation_costs) / param.years), balance(deferred_organisation_costs))`，分錄為借 攤銷遞延資產／貸 設立費。自編故事中 150,000 ÷ 5 ＝ 30,000。

用 `cost()` 而不是 `balance()` 當分子，攤銷後帳面減少也不會讓下一年的攤銷額改變；用 `min()` 以帳面淨額為上限，自由實驗把設備或設立費改得很小時，也不會攤過頭變成負數。兩個事件在同一步依序過帳，`effects` 在步驟層級合併；本筆變動檢視中，稅前淨利（H11）減少 120,000，H12 增加 90,000、H14 增加 30,000，營業活動淨額不變。步驟的 `chapterLinks` 列出這一步結束時建議練習的闖關區章節（第 9.1 節），這裡連到 17.5 那一題所在的章節；沒有填 `level`，所以章末卡連到章節頁。

`e2` 帶事件層級的 `pendingRefs`（第 9.1 節的選填欄位），讓實驗室在這一步標出設立費攤銷的資本化、損益表分類與間接法加回列各有設計決定（T04、T05、T12），畫面顯示「設計說明」。它只是標記，不影響過帳；能不能用這個範本出分錄題，仍由範本層級的 `entryQuestionBlockedBy` 決定。切到 IFRS 對照（`ifrs@1`）時，`e2` 的兩行都被 `policyWhen` 篩掉，這個事件「本筆無影響」，`e1` 的折舊照常過帳（第 10.3 節）。

### 17.10 多正解題的兩種判分方式

兩題都是 `multi_choice`（已決定 D12），差別只在 `scoringMode`。題幹與選項都不寫出正確答案的數量；學習端提示由介面依 `scoringMode` 放在選項群組的標題（第 16.2 節）。

`any_correct`：學生在單選介面選一個選項，選中 `o_a7k2` 或 `o_c8t3` 都算答對：

```json
{
  "id": "q_h6w3m8ta",
  "rev": 1,
  "revKind": "text",
  "status": "published",
  "type": "multi_choice",
  "chapterId": "ch_b7k2w9",
  "objectiveId": "obj_7cq2v5",
  "difficulty": 2,
  "tags": ["cash", "liabilities"],
  "termRefs": ["tm_c4sh8k2p", "tm_c2y9b5ex", "tm_s5b8r3hd"],
  "scored": true,
  "scoringMode": "any_correct",
  "prompt": {
    "zh-TW": "青檸文具社想讓帳上的現金變多，但老闆堅持「不能增加任何負債」。下面哪一個做法符合他的要求？",
    "en": "Lime Leaf Stationery wants more cash on its books, but the owner insists that liabilities must not increase at all. Which of the following approaches meets that requirement?"
  },
  "options": [
    {
      "id": "o_a7k2",
      "text": { "zh-TW": "股東再拿錢出來增資", "en": "The shareholders put in more capital" },
      "feedback": {
        "zh-TW": "答對了。增資讓現金和股本一起增加，負債完全沒有變。",
        "en": "Correct. New capital increases cash and share capital together, and liabilities do not change at all."
      }
    },
    {
      "id": "o_b4m9",
      "text": { "zh-TW": "向銀行借一筆短期借款", "en": "Take out a short-term bank loan" },
      "feedback": {
        "zh-TW": "現金會增加，但{{term:tm_s5b8r3hd}}也一起增加，違反了「不增加負債」的要求。",
        "en": "Cash goes up, but so do {{term:tm_s5b8r3hd}}, which breaks the rule of not increasing liabilities."
      }
    },
    {
      "id": "o_c8t3",
      "text": { "zh-TW": "把倉庫裡的一批存貨以現金賣掉", "en": "Sell a batch of inventory for cash" },
      "feedback": {
        "zh-TW": "答對了。賣貨收到現金，存貨減少，負債不受影響；這也是一個合理答案。",
        "en": "Correct. Selling goods brings in cash and reduces inventory without touching liabilities. This is also a reasonable answer."
      }
    },
    {
      "id": "o_d5x6",
      "text": { "zh-TW": "先跟客戶預收下個月的貨款", "en": "Collect next month's payment from a customer in advance" },
      "feedback": {
        "zh-TW": "現金確實增加，但貨還沒交，公司欠客戶一批貨，這是預收收入，屬於負債。",
        "en": "Cash does increase, but the goods have not been delivered yet. The company owes the customer the goods, so the amount is unearned revenue, which is a liability."
      }
    }
  ],
  "correctOptionIds": ["o_a7k2", "o_c8t3"],
  "explanation": {
    "zh-TW": "要讓現金增加又不增加負債，錢必須來自股東（{{option:o_a7k2}}）或來自把其他資產換成現金（{{option:o_c8t3}}）。選「{{option:o_b4m9}}」或「{{option:o_d5x6}}」，都是用將來的義務換來今天的現金，所以{{term:tm_c2y9b5ex}}會增加。",
    "en": "To increase cash without increasing liabilities, the money has to come from the shareholders ({{option:o_a7k2}}) or from turning another asset into cash ({{option:o_c8t3}}). Choosing {{option:o_b4m9}} or {{option:o_d5x6}} trades a future obligation for cash today, so {{term:tm_c2y9b5ex}} increase."
  }
}
```

`all_correct`：學生用核取方塊複選，按「確認答案」後判分；必須剛好選出 `o_f3k8` 與 `o_h7n2`，少選或多選都算錯：

```json
{
  "id": "q_p9k4r7cx",
  "rev": 1,
  "revKind": "text",
  "status": "published",
  "type": "multi_choice",
  "chapterId": "ch_n3f8q1",
  "objectiveId": "obj_4tw8m3",
  "difficulty": 2,
  "tags": ["cash_flow", "operating_activities"],
  "termRefs": ["tm_p2a7c5vk", "tm_r7x2c9fa", "tm_f9a4c6md"],
  "labRef": { "story": "story_q7m2v9", "step": "st_m2x8r5" },
  "scored": true,
  "scoringMode": "all_correct",
  "prompt": {
    "zh-TW": "青檸文具社這個月發生了下面幾件事。哪些會讓{{term:tm_p2a7c5vk}}的現金流量增加？",
    "en": "Several things happened at Lime Leaf Stationery this month. Which of them increase cash flows from {{term:tm_p2a7c5vk}}?"
  },
  "options": [
    {
      "id": "o_f3k8",
      "text": { "zh-TW": "收回客戶上個月賒帳的貨款", "en": "Collecting payment for last month's credit sales" },
      "feedback": {
        "zh-TW": "正確。收回{{term:tm_r7x2c9fa}}是本業的收現，屬於營業活動。",
        "en": "Correct. Collecting {{term:tm_r7x2c9fa}} is cash from the core business, so it is an operating activity."
      }
    },
    {
      "id": "o_g6v4",
      "text": { "zh-TW": "向銀行借入一筆短期借款", "en": "Borrowing a short-term bank loan" },
      "feedback": {
        "zh-TW": "現金增加了，但借錢屬於{{term:tm_f9a4c6md}}，不是營業活動。",
        "en": "Cash increases, but borrowing belongs to {{term:tm_f9a4c6md}}, not operating activities."
      }
    },
    {
      "id": "o_h7n2",
      "text": { "zh-TW": "把一批存貨以現金賣給書店", "en": "Selling a batch of inventory to a bookstore for cash" },
      "feedback": {
        "zh-TW": "正確。賣貨收現是營業活動的現金流入。",
        "en": "Correct. Cash received from selling goods is an operating cash inflow."
      }
    },
    {
      "id": "o_j2c9",
      "text": { "zh-TW": "用現金買一台新的電腦設備", "en": "Buying new computer equipment with cash" },
      "feedback": {
        "zh-TW": "買設備是投資活動，而且是現金流出，不會讓營業活動的現金流量增加。",
        "en": "Buying equipment is an investing activity and a cash outflow, so it does not increase operating cash flows."
      }
    }
  ],
  "correctOptionIds": ["o_f3k8", "o_h7n2"],
  "explanation": {
    "zh-TW": "營業活動看的是本業的收付。{{option:o_f3k8}}和{{option:o_h7n2}}都是做生意收到的錢；{{option:o_g6v4}}是籌資活動，{{option:o_j2c9}}是投資活動的流出。這一題要全部選對才算答對。",
    "en": "Operating activities cover the cash of the core business. {{option:o_f3k8}} and {{option:o_h7n2}} are both cash received from doing business; {{option:o_g6v4}} is a financing activity, and {{option:o_j2c9}} is an investing outflow. Every correct choice must be selected for the answer to count."
  }
}
```

兩題列入 `answerHash` 的答案欄位（正規化後的節錄；`correctOptionIds` 排序後再雜湊，只調整陣列順序不算答案改版）：

```json
[
  { "id": "q_h6w3m8ta", "type": "multi_choice", "scoringMode": "any_correct", "correctOptionIds": ["o_a7k2", "o_c8t3"] },
  { "id": "q_p9k4r7cx", "type": "multi_choice", "scoringMode": "all_correct", "correctOptionIds": ["o_f3k8", "o_h7n2"] }
]
```

判分結果：第一題選 `o_a7k2` 或 `o_c8t3` 都判為正確；第二題只選 `o_f3k8` 判為錯誤（少選），選 `o_f3k8`、`o_h7n2`、`o_g6v4` 也判為錯誤（多選）。兩題作答後都顯示每個選項的 `feedback`，並標出全部正確答案。若作者把第二題的 `scoringMode` 改成 `any_correct`，`answerHash` 會改變，CI 要求 `rev` 遞增且 `revKind` 為 `answer`。

### 17.11 延伸章的分錄題

分錄題只出現在「借貸與分錄」延伸章 `ch_e4j7r2`（`scope: "extension"`、`examScope: "not_in_exam"`，D1）。正解由核心依事件產生，作者只寫情境：

```json
{
  "id": "q_y3m7k2dw",
  "rev": 1,
  "revKind": "text",
  "status": "published",
  "type": "journal_entry",
  "chapterId": "ch_e4j7r2",
  "objectiveId": "obj_9wr3e6",
  "difficulty": 2,
  "tags": ["journal_entry", "borrowing", "interest"],
  "termRefs": ["tm_w2j8d5ky", "tm_s5b8r3hd", "tm_k6t2e9wr"],
  "labRef": { "story": "story_q7m2v9", "step": "st_w4r8n2" },
  "scored": true,
  "scenario": {
    "opening": { "storyRef": "story_q7m2v9", "afterStep": "st_m2x8r5" },
    "events": [
      { "id": "e1", "template": "tpl.repay_all_short_term_loans_with_interest", "params": { "interest": 27000 } }
    ],
    "policy": "teacher@1",
    "layout": "teacher@1",
    "window": "transaction",
    "targets": []
  },
  "accountChoices": ["cash", "short_term_borrowings", "interest_expense", "accounts_payable", "revenue"],
  "allowAliases": true,
  "prompt": {
    "zh-TW": "青檸文具社用現金還清全部短期借款 {{money:e1.principal}}，同時付了利息 {{money:e1.interest}}。請寫出這筆交易的分錄。",
    "en": "Lime Leaf Stationery repays all of its short-term borrowings of {{money:e1.principal}} in cash and pays interest of {{money:e1.interest}} at the same time. Write the journal entry for this transaction."
  },
  "explanation": {
    "zh-TW": "還本金讓{{term:tm_s5b8r3hd}}減少，記在借方；利息是這一期的費用，借記{{term:tm_k6t2e9wr}}；付出的現金合計 {{money:e1.totalPaid}}，貸記現金。寫成一筆複合分錄，或拆成還本和付息兩筆，都算對。",
    "en": "Repaying the principal reduces {{term:tm_s5b8r3hd}}, so it is debited. The interest is an expense of the period, so {{term:tm_k6t2e9wr}} is debited. The total cash paid, {{money:e1.totalPaid}}, is credited to cash. A single compound entry or two separate entries for the principal and the interest are both accepted."
  }
}
```

`content:compile` 寫入發布快照的正解（核心合併同科目、同方向的行後的結果，與第 14 節的例子相同）：

```json
{
  "id": "q_y3m7k2dw",
  "rev": 1,
  "compiled": {
    "values": { "e1.interest": 27000, "e1.principal": 900000, "e1.totalPaid": 927000 },
    "expectedEntries": [
      { "account": "cash", "side": "credit", "amount": 927000 },
      { "account": "short_term_borrowings", "side": "debit", "amount": 900000 },
      { "account": "interest_expense", "side": "debit", "amount": 27000 }
    ],
    "policy": "teacher@1",
    "layout": "teacher@1"
  }
}
```

核對：自編故事第 12 步之後短期借款餘額是第 8 步借入的 900,000，現金 4,214,000 足夠支付 927,000，前置條件成立。`expectedEntries` 是核心依科目表順序輸出的（現金在前），比對不看順序。這個範本沒有 `entryQuestionBlockedBy`，所以可以出分錄題；若改用第 17 筆的 `tpl.amortise_org_costs`，validator 會因為它帶 `entryQuestionBlockedBy: ["T04", "T05"]` 而拒絕。`accountChoices` 另外放了兩個不相關的科目當干擾；學生若輸入別名（例如「利息費用」），會先解析成 `interest_expense` 再比對。

## 18. 測試策略

| 類別 | 範圍 | 位置與檔名 | 何時執行 | 進 repo |
| --- | --- | --- | --- | --- |
| 單元測試 | 金額 helper、運算式 parser、型別檢查、求值器、每個範本（含 `policyWhen` 在兩套政策下的篩選）、每個版面列規則、每個指標版本、狀態判定、每個錯誤碼、追蹤樹、T 字帳、分錄比對（別名解析、合併同科目同方向的行、多重集合比對）。已決定（2026-10-20）：判分測試跟著判分移到 `packages/quiz`：多正解題判分（兩種 `scoringMode`）、數字題比對（含 N/A 與位數規則）、分錄題計分的判分結果與回饋（呼叫 `core` 的分錄比對），判分規則不變 | 會計：`packages/core/test/**/*.test.ts`；判分：`packages/quiz/test/**/*.test.ts` | 每次 CI | 是 |
| 性質測試 | 隨機產生合法的事件序列，檢查不變式（下表），`teacher@1` 與 `ifrs@1` 都跑；另對正式故事（老師的金額，D2）逐步重播，只斷言不變式（每一步都能過帳、四個勾稽點差額為 0、間接法等於直接法、追蹤加總），不寫任何期望值 | `*.property.test.ts`，用 fast-check 與 `@fast-check/vitest`（版本見 09） | 每次 CI | 是 |
| 黃金測試 | 自編青檸文具社 18 步的完整三表、23 項指標與勾稽結果，`teacher@1` 與 `ifrs@1` 各一份（第 10.3 節）；自訂期初情境；狀態邊界（na、zero、not_meaningful） | `*.golden.test.ts`，期望值放 `test/golden/*.json` | 每次 CI | 是 |
| 內容編譯測試 | 本文件與 fixtures 中的 JSON 範例通過 Zod 驗證與 `content:compile`；正式內容的 `multi_choice` 與 `journal_entry` 規則（第 14、16.2 節） | `tools/` | 每次 CI | 是 |
| 本機老師 Excel 驗證 | 重播正式故事，對老師 Excel 情境 1 到 3 逐格比對 | `*.local.test.ts` | 只在本機 | 測試程式可進 repo（不寫入教材數字或文字）；期望值在執行時從本機的 `references/` 讀出，不進 repo |

### 18.1 性質測試的不變式

| 不變式 | 說明 |
| --- | --- |
| 借貸平衡 | 每一筆分錄借方合計等於貸方合計；全部科目「借方減貸方」加總為 0 |
| 會計恆等式 | 每一步之後 L29 ＝ N29 |
| 勾稽四點 | H11 ＝ R33；H41 ＝ L12；N26 ＝ 期初＋本期淨利－股利－提列公積；L29 ＝ N29 |
| 現金 | H39 ＝ 所有現金行合計；H41 ＝ 現金餘額 |
| 間接法等於直接法 | 營業活動合計相等，營運產生之現金小計也相等 |
| 存貨 | R14 ＝ L14 ＝ 存貨餘額；R15 ＝ 營業成本發生額（替代政策下公式含盤盈列）；R13 ＝ 標 `purchase` 的存貨借方合計 |
| 餘額規則 | 受限科目不為負，或該步被擋下並回報可輸入範圍 |
| 本筆變動 | 各步本筆變動逐列加總 ＝ 累計報表 |
| 決定性 | 同一輸入跑兩次 deep equal；序列化再解析後結果相同 |
| 指標狀態 | 狀態為 na 時分母為 0 或來源為 na；狀態為 zero 時分子精確為 0；連鎖規則成立 |
| 追蹤 | 每個報表數字的追蹤樹（第 6.4 節）：樹根的值等於報表上的值；`formula` 節點等於子節點代入公式；其他節點等於科目層、子節點與現金行的合計；每個科目層的 `sources` 帶號金額加總等於 `amount`；每個 `SourceRef` 都指得到 `PostedStep.entries` 裡的一行 |
| T 字帳 | 期初 ＋ 借方合計 － 貸方合計（依正常方向換算）＝ 期末 ＝ 該步的 `balancesAfter` |
| 兩套政策 | 同一組事件與覆寫在 `teacher@1` 與 `ifrs@1` 下都過帳成功時，每一步的現金餘額相同（兩者只差認列與分類，不差現金）；兩套各自滿足上面所有不變式 |

事件產生器採 model-based 的方式：每一步先讀目前帳上狀態，只在前置條件成立的範圍內產生參數（例如還款不超過借款餘額），避免大量無效樣本。

### 18.2 黃金測試

期望值由我們自己從零建立的計算表算出（不使用老師的檔案，也不寫入正式故事的金額，D2），在 PR 中附上計算過程，由人逐筆核對。黃金資料至少涵蓋：自編故事每一步的三表與 23 項指標，`teacher@1` 與 `ifrs@1` 各一份（M4b 加入 `ifrs@1`，第 18 步的期望值見第 10.3 節）；自編故事第 7 步營業毛利的追蹤樹（第 6.4 節）；「毛利為 0、營業利益為負」使 DOL 為 not_meaningful 的步驟；流動負債為 0 使流動比率為 na 的步驟；股利不為 0 的自訂情境（驗證現金再投資比率，也就是 Excel 格 D17 的分子修正）；盤點後金額低於帳上的盤損情境。

### 18.3 本機老師 Excel 驗證

- 檔名 `*.local.test.ts`。Vitest 設定在 `references/` 不存在時自動排除這些檔案；CI 沒有 `references/`，所以永遠不會執行。
- 不使用 snapshot，測試程式與期望值檔不寫入任何教材數字（正式故事的金額只存在內容資料中）。期望值在執行時從 `references/02-excel-statements/` 讀出。
- 老師的 xlsx 由 openpyxl 存檔，公式格沒有快取的計算值。測試讀出輸入格與公式字串，用一個只支援 `SUM`、`IFERROR`、四則運算與跨工作表參照的極小公式求值器重算，再與核心結果以完整精度比對；與解答 PDF 或投影片比對時，依各來源印出的位數四捨五入後再比。xlsx 讀取方式依 08 的函式庫決定（不使用 npm 上有已知漏洞的 xlsx 0.18.5），需要先確認能讀出公式字串（見第 20 節）；如果選用的函式庫讀不到，退路是在本機用一支只讀不寫的轉換腳本先把公式字串匯出成 JSON，同樣不進 repo。已決定（2026-10-23）：M1 採用自製讀取器（只用 node 內建的 zip 解壓與 XML 解析，放在 `packages/core/test/local/`，見 [14 待確認事項](14-open-questions.md) 第 5.3 節），不使用 SheetJS，也不需要退路的轉換腳本。
- D2 已決定正式故事用老師的情境與金額（老師已同意公開），所以正式故事資料本身就在 repo 的內容裡；本機測試直接重播正式故事，再與 `references/` 中的老師 Excel 逐格比對，不需要另一份本機故事資料。repo 內的測試程式不寫入任何老師的金額；CI 對正式故事只跑性質測試（第 18 節的表）。
- M1 的完成標準分兩級：第 1 到 3 筆「已對老師 Excel 驗證」；第 4 到 18 筆「性質測試通過，標示為依課程情境推算」（【待確認 T33】的決定，2026-10-23）。第 16 筆之後的資產負債表示意可以當部分檢查點，但有一筆來源不明的差額【待確認 T36】。

## 19. 與其他文件的介面

- 03 模組：實驗室的每一步使用 `PostedStep`、`effects`、`buildStatements`（累計與本筆變動）、`fiveStepCheck`；「看分錄與 T 字帳」使用 `PostedStep.entries` 與 `buildTAccounts`（D1 (b)）；追蹤畫面使用 `traceLine`（D10(c) A，M4b）；IFRS 對照以 `ifrs@1` 重播（D10(f)，M4b）；單獨練習以 `scenario.opening` 指到前一步（D10(b)）；預測題直接重用交易影響題的 `scenario` 與求解器。
- 05 多語系：佔位符文法、數字格式化（含 `signDisplay`）、作答正規化、缺翻譯退回。
- 06 PWA：本機只存題目 ID、rev、作答與實驗室參數覆寫（`(stepId, eventId, param)`，第 9.2 節）；報表一律重算。
- 08 題庫：Zod schema、ID 前綴、題型代號與欄位名稱、生命週期、`rev` 與 `revKind`、`published.lock.json`、驗證清單、原創政策。本文件第 7、9、15、16、17 節的欄位名稱與 08 第 3、4 節一致（snake_case 題型代號、`prompt`、`vars`、`correctOptionId`、`multi_choice` 的 `correctOptionIds` 與 `scoringMode`、`labRef` 的 `{ story, step }`、`tpl.` 範本 ID、`story_` 與 `st_` 的 ID、`teacher@1`、只有 draft、published、retired 三種狀態）；`journal_entry` 的章節限制對應 08 的 `ans.journalScope`；仍待同步的少數欄位見第 20 節。
- 09 技術：`packages/core`、`packages/quiz`、`packages/content-schema` 與 `packages/i18n` 的位置與依賴方向、測試工具版本、JSON Schema 產生方式。
- 10 里程碑：M1 的範圍與兩級完成標準（追蹤樹與 `policyWhen` 欄位在 M1 就位）；M2 的 `multi_choice` 與題型凍結（`journal_entry` 的 schema 一併凍結，延伸章的題目與元件時程以 10 為準）；M4a（故事、動畫、預測、自由實驗、勾稽練習）與 M4b（完整公式樹追蹤、`ifrs@1` 政策與版面、IFRS 黃金測試）的範圍。
- 12 術語表：名詞資料與科目表的 `termRef` 是同一份來源；D13 A 的顯示字與別名、D11 的英式拼字與 `enUsVariant`、`ifrs@1` 版面的列名與 `organisation_costs_expense` 的名詞，以 12 為準。
- 13、14：本文件引用的 T、W、D 編號。

## 20. 建議新增的待確認

以下項目沒有給編號（registry 不新增編號），集中列在 14 第 5 節，是否另行處理由你決定。

向老師確認：

1. 盤損（盤點後金額低於帳上）的處理：教材沒有出現，網站預設比照盤盈計入營業成本。建議和 T06 一起向老師確認。
2. `slides03` 版現金再投資比率的分母：年報公式寫「不動產、廠房及設備毛額＋長期投資＋其他非流動資產＋營運資金」，教材的無形資產與遞延資產是否算在「其他非流動資產」內，需要確認。老師 Excel 的分母兩者都有計入。
3. RD leverage、ME leverage 的公式（第 12.4 節列了「ΔTR ÷ 費用」與「ΔTR ÷ Δ費用」兩種候選），以及現金轉換循環的網站補充定義，是否請老師認可或指定。
4. `slides03` 版營業槓桿的成本習性預設（營業成本為變動、其餘費用為固定，第 12.3 節），建議和 T26 一起確認。

你決定：

5. 年報口徑的多期資料（平均餘額、五年合計）是否支援（評估四）。不新增編號，和其他未編號事項一起列在 14 第 5 節。

待實測：

6. M1 本機測試開始前，確認選用的 xlsx 讀取方式能取得公式字串與輸入值（老師的檔案沒有快取的計算值）；讀不到時改用第 18.3 節的本機轉換腳本。已完成（2026-10-23）：採用自製讀取器，不使用 SheetJS，也不需要轉換腳本（第 18.3 節、14 第 5.3 節）。

跨文件需要同步（不是待確認，列在這裡方便統一審稿）：

先前列在這裡的幾項已經解決，不再列出：
- 05 第 10.1 節的佔位符文法已列入 `{{option:o_id}}` 與 `expected.<targetId>.<欄位>`。
- 08 第 4.1 節的前綴表把交易範本列為 `tpl.` 開頭的語意 ID，與 08 第 2.3 節的資料夾配置及本文件第 16.1 節一致。
- 範本的 `entryQuestionBlockedBy` 與題目層級的 `pendingRefs` 已確定並存、用途不同（08 第 3.6、3.8 節與 5.4 節的 `acct.entryBlocked`；本文件第 14 節、第 17.8 節）。
- 08 已列出 `scenario.events[].id`、`measure` 的 `status`、分類題項目的 `allowContra`、故事的 `policy` 與 `layout`、步驟的 `checkpoints`，`scenario.policy` 也統一寫成 `teacher@1`；範本欄位的型別與語意由 08 第 3.8 節明定以本文件第 7 節為準。
- 題目欄位依跨文件的統一規範定案為 `prompt`、`vars`、`correctOptionId`、`compute`，08 第 8.2 節的 `{{money:vars.loan}}` 是正確寫法；步驟與故事 ID 一律用 `st_` 與 `story_`。
- 勾稽點 target（第 15.1 節的 `kind: 'check'`，`step` 為 2 到 5、`measure` 為 `value`）採用為 `scenario.targets` 的第四種 kind，與 `line`、`account`、`ratio` 並列。
- 名詞的 `unlock` 寫成 `{ levelId }`（與 03 第 2.10 節「完成指定關卡才收進圖鑑」相同），`flags` 用第 16.3 節的 TermFlag（`japanese`、`old_name`、`typo_fixed`、`unused`、`not_ifrs_line`、`ifrs_treatment_differs`、`simplified`），`category` 用第 16.3 節的列舉；依跨文件的統一規範，名詞欄位以本文件第 16.3 節為準。
- 故事步驟的 `chapterLinks` 寫成 `[{ chapter, level? }]`，故事事件可帶選填的 `pendingRefs`（第 9.1 節）；交易影響題的 targets 可以是 direction、delta 或 value，`choices` 只適用於 direction 目標（第 16.2 節）。
- 佔位符的作用範圍（範本 `summary` 與 `explanation` 的 `param.`、`derived.`，effects 片語樣板的 `amount`）與變動值選項 `|sign`，依 05 第 10.1、10.3 節（本文件第 16.1、12.6 節）。

仍待同步的項目：

第 7 到 12 項中，除了第 9 項，都是 [03 模組](03-modules.md) 文末「跨文件待同步」提出、本文件與 08 的 schema 還沒有的欄位。是否採用在 M0b 建立內容 schema 時一併定案；定案前本文件的型別維持原樣。第 13 項以後是 2026-10-20 決定 D 系列之後，本文件為了落實決定而新增、需要 08 或 12 對齊的欄位；決定本身不必再議，只需同步寫法。

7. 指標方向多一個值 `stays_na`（前後都是 N/A）：03 第 3.6 節的預測題使用；若採用，要加進第 15.1 節的 `Direction`。
8. 交易影響題的計分模式 `scoring: 'allOrNothing' | 'perTarget'`（03 第 2.4、4.2 節，預設 `allOrNothing`）：若採用，要加進第 16.2 節的 `TransactionEffectQuestion` 與 08 第 3.6 節。
9. 名詞的 `definition` 在 08 第 3.7 節與本文件第 16.3 節都是必填；12 第 16 節指出模板列名、別名性質的列只需要用語欄位。這一點在 M0b 建立內容 schema 時定案；12 第 16 節的欄位對應以單一 Term（本文件第 16.3 節、08 第 2.1 節）為準。
10. 選項的簡短文字 `short` 與固定位置 `pin: "last"`（03 第 2.8 節）：若採用，要加進第 16.2 節的 `ChoiceOption` 與 08 第 3.6 節的選項欄位。
11. 分類題的事件卡（03 第 2.5 節）：卡片可以是「範本加參數」的交易事件，正解依範本現金行的活動標籤推導；若採用，第 16.2 節分類題的 `items` 與 08 第 3.6 節要另加對應欄位。
12. 故事層級的章節分組 `chapters: [{ id, title, stepIds }]`（03 第 3.2 節）：若採用，要加進第 9.1 節的 `Story` 與 08 第 3.9 節。
13. 故事的 `origin: 'teacher' | 'original'`（第 9.1 節，D2、D6）：用來決定授權標示（老師的情境與金額不在 CC 授權內）與 `checkpoints` 是否允許；`teacher` 時顯示「經陳彥宏老師授權使用」並排除在 CC BY-SA 之外。08 第 3.9 節的 Story 欄位用同一個 `origin` 欄位同步，不另設 `rights` 欄位。
14. `multi_choice` 的驗證細節（第 16.2 節）：選項 3 到 5 個且至少一個不是正解、`correctOptionIds` 排序後列入 `answerHash`；08 第 3.6 節的題型表、第 5.5 節的答案驗證與第 4.4 節的 `answerHash` 欄位要同步。
15. `journal_entry` 的 `scenario.targets` 可為空陣列，編譯結果的正解放在 `compiled.expectedEntries`（第 17.11 節）；08 第 3.6 節與發布快照的欄位要同步。
16. `ifrs@1` 用到的延伸科目 `organisation_costs_expense` 與 `ifrs@1` 版面的列名（第 4.5、10.3 節）：12 要補對應的名詞與英文名稱。
