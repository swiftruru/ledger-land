# 07 設計系統、Liquid Glass 與無障礙

這份文件定義 LedgerLand 會計樂園的視覺語言：一套淺色與深色共用的 design tokens、iOS 26 風格的懸浮玻璃 Tab bar 與它的退路、無障礙規格、元件清單、文案語氣與圖示。視覺方向是「紙與夜色」：淺色是紙質（幾乎白、帶一點暖的紙加暖墨），深色是三種底色色相的風味；淺色不用紫色（色票的完整規格已獨立成 [16 主題](16-themes.md)，2026-10-21）；以 iPhone Safari 為主要目標（iOS 26、27，並正式支援 iOS 17），玻璃效果只用在導覽層與少數重點元件，內容一律是實色。所有色碼都是**提案值**，對比度已先用公式估算，正式數值在 M0b 用工具與實機截圖驗證後定案。技術事實以 2026-10-20 的查證為準，事實核對的更正優先。

## 確定要做

- **三層 tokens**：基礎色票（primitive）→ 語意 tokens（semantic）→ 元件 tokens（component），以 `packages/tokens` 的 TypeScript 原始檔為唯一來源，建置時產生 CSS custom properties，以及給 manifest 與圖表使用的 TS 常數；淺色與深色各一組，預設跟隨系統（第 2 節）。
- **主題**：已決定（2026-10-21）：淺色是紙質（頁面 `#FCF8F0`、卡片 `#FFFDF9`、暖墨文字、赤陶強調色），深色是三個風味（夜空、莓果、紅酒：換底色色相，強調色也隨風味：夜空紫、莓果洋紅、紅酒覆盆子紅；狀態色與文字色共用），完整色票、對比度門檻與切換機制見 [16 主題](16-themes.md)；「不用紫色」只限淺色，夜空用紫當填色（第 2.2 節）。
- **不只靠顏色傳達資訊**：會計五大要素的顏色一律搭配圖示與文字；增減一律用 ▲▼、正負號與文字；答對答錯一律有圖示與文字（第 2.4、2.5 節）。
- **系統字型**：中文 PingFang TC 與 Noto Sans TC 等系統字型，不下載字型檔；中文堆疊把拉丁系統字放在前面（2026-10-25），關卡代號的連字號不會看起來像破折號；金額與表格一律等寬數字（第 3 節）。
- **全站不得有未設計的連結**（2026-10-24，你的要求，M3 實作）：可點元素只准用第 9.2 節列的元件與第 9.3 節的專用元件；瀏覽器預設樣式的連結、帶底線的按鈕、沒有 class 的原生按鈕、看起來像普通文字的可點元素一律視為缺陷，任何里程碑、任何占位頁都適用；由原始碼檢查 `pnpm check:links`（`tools/check-links.mjs`，規則 R1 到 R12）與 E2E `apps/web/e2e/link-style.spec.ts` 擋下（第 8.5 節）。
- **遊戲感按鈕與同一套手感**（M3）：Button 五種變體（primary、secondary、back、quiet、danger）、三種尺寸（sm 44、md 48、lg 56px）；primary、secondary、danger 是「代幣」，有 4px 立體底邊（`--ll-btn-depth`），按下時沉 4px、底邊歸零，減少動態時只換色與底邊、不位移；地圖節點用同一組底邊與按壓規則；頁首、工具列、HUD、Tab bar 是平的（第 1、4.6、9.2 節）。
- **全站一套中文換行規則**（M3）：`line-break: strict`、`text-wrap: pretty`，標點與「的」不落在行首；整句要依詞換行的地方用共用的切詞工具，不在各頁另寫（第 3.5 節）。
- **寬版頁面**（M3）：首頁、章節頁、名詞圖鑑、我的、徽章、安裝教學、關於系統設計的內容最寬 1040px，其他頁 720px，闖關地圖全幅（第 10 節）。
- **間距、圓角、陰影、動態**各有 tokens；動態含時長、彈簧曲線，以及「減少動態效果」時的 reduced 變體（第 4 節）。
- **對比度在 M0b 驗證**：每組文字與背景、圖示與背景、玻璃與最糟背景的組合都留下計算紀錄（第 2.6 節）。
- **玻璃分三層，由 JS 決定層級**：Tier 0 實色、Tier 1 霧面、Tier 2 折射；含 `url()` 的折射宣告只放在 `html[data-glass=refract]` 底下，Safari 與 Firefox 永遠不會套用；`CSS.supports` 的測試字串不放 `var()`（第 5 節）。
- **正式支援 iOS 17（D8）**：只支援前綴版 backdrop-filter 的 Safari 17 也走 Tier 1 霧面；`-webkit-backdrop-filter` 由 Lightning CSS 或 Autoprefixer 依 browserslist 自動補上，原始 CSS 不手寫前綴；閘門的判斷流程不變；M0a 加一台 iOS 17 裝置驗證玻璃外觀與層級判斷（第 5 節、「已決定的項目」）。
- **Tab bar 規格**：元素直接寫在初始 HTML 殼層（D8），React 不重建；膠囊形選取指示用 transform 加彈簧曲線移動；往下捲動時只輕微縮小（標籤保持可見，只用 transform）；blur 12 到 20px，不對 blur 做動畫；`body` 直屬的 fixed 元素；Tab bar 與祖先不觸發 Backdrop Root（含 `view-transition-name`）（第 6 節）。
- **Tab 與模組名稱（D9）**：Tab 用短名「首頁、闖關、實驗室、圖鑑、我的」與「Home、Quest、Lab、Terms、Me」；模組全名「闖關區／Quest」「報表實驗室／Statement Lab」「名詞圖鑑／Glossary」只用在頁面標題與關於頁（第 6.1 節）。
- **玻璃只用在導覽層與少數重點元件**：Tab bar、rail、側邊欄與實驗室的浮動步驟控制列；題目、報表、名詞卡一律實色（第 6.8 節）。
- **可讀性的對應做法**：Tab bar 底色的不透明度以「最糟背景」計算，文字 4.5:1、圖示 3:1 在任何背景下都達標；有系統訊號（增強對比、強制色彩）或 App 內開關時直接改實色。捲到花的背景時是否再動態加深，見「需評估」評估一（第 6.4 節）。
- **App 內「降低透明度」開關**：因為 Safari 不支援 `prefers-reduced-transparency`，iPhone 讀不到系統設定（第 7 節）。
- **無障礙**：所有題型可只用鍵盤完成、焦點樣式、跳到主要內容、換頁焦點移到標題、`nav` 加 `aria-current`、實驗室 `aria-live`、真正的表格、▲▼ 的文字替代、44px 觸控目標（第 8 節）。
- **選擇題元件（D12，M2）**：`single_choice` 與新增的 `multi_choice` 共用同一套 ChoiceGroup 元件；`any_correct` 用單選按鈕群組，`all_correct` 用核取方塊群組；單選題與兩種判分方式都用同一個「確認答案」按鈕（英文 "Check answer"），按下後才判分，焦點移到回饋區的標題；判分方式的提示放在 `fieldset` 的 `legend`，螢幕閱讀器先唸；作答後每個選項都有回饋並標出全部正確答案；不給部分分數（第 8.3、9.1 節）。
- **用詞、英文與註記（D11、D13）**：W01 到 W15 全部採用，教材原字保留為可搜尋的別名；英文拼字用英式（美式為搜尋別名），日期格式跟英式；IFRS 沒有或禁止的報表列在中英兩種介面都加標記（中文「非 IFRS 項目」、英文「Not an IFRS line item」，字串放在 `packages/web-ui` 的 catalog，訊息 ID 見 05，名詞卡說明 IFRS 的處理）；「舊稱」「簡化」「單期近似」「IFRS 對照，不計分」等註記統一用 NoteTag 元件（第 2.4、9、11 節）。
- **元件清單**（第 9 節）、**文案語氣指南**（第 11 節，也放進 08 的內容審稿清單）。
- **tokens 與元件的套件位置**：已決定（2026-10-20）：tokens 的原始檔在 `packages/tokens`（M0b 建立）；第 9 節的元件實作在 `packages/web-ui`（M0b 建立，網站與後台共用）；殼層的 Tab bar 與玻璃閘門留在 `apps/web`，其他玻璃元件的樣式在 `packages/web-ui`；視覺規格不因此改變（第 2.1、5、9 節）。
- **圖示用 Phosphor**（MIT，regular 與 fill 成對），不用 SF Symbols，不使用 Apple 圖片或介面素材（第 12 節）。

## 需評估

以下兩項沒有對應的 D 編號（見文末「建議新增的待確認」），仍待你決定。原本的評估三「是否正式支援 iOS 17 以下」已在 2026-10-20 決定（D8），見下一節「已決定的項目」。

### 評估一：捲到圖表或彩色區塊時，是否再加深 Tab bar 底色

靜態做法（底色不透明度以最糟背景計算，見 6.4）已經能保證對比達標；這一項只是在「透明感」與「保險程度」之間取捨。

| 選項 | 做法 | 優點 | 缺點與風險 |
| --- | --- | --- | --- |
| A 只用靜態高不透明度 | 底色 alpha 固定 0.80 | 最簡單、沒有額外效能成本、行為可預測 | 在一般淺色內容上，玻璃感比 iOS 原生淡 |
| B 動態加深 | 用 IntersectionObserver 偵測 Tab bar 下方是否有標記 `data-busy-bg` 的區塊（圖表、彩色卡片），有就把底色 alpha 換成 0.90（只換 background-color，不動 blur） | 平常可以用較低的 alpha（例如 0.72），透明感較好；遇到花的背景才加深 | 多一個觀察器；底色切換的瞬間可能被注意到；要逐一標記區塊，漏標就失效。alpha 0.72 在最糟背景下未選取標籤只有約 3.7 到 3.8:1，漏標的深色區塊會低於 4.5:1，等於把無障礙的保證交給標記是否齊全 |
| C 經過這些區塊時改實色 | 同 B 的偵測，但直接切到 Tier 0 | 最保險 | 捲動中玻璃忽有忽無，觀感最差 |

**建議**：先做 A，M0a 的玻璃原型實測後若覺得玻璃感不足，再加 B。理由：A 已經滿足對比要求，B 的好處只在美觀；先用最少的機制驗證效能與可讀性。由你決定（目前 registry 沒有對應編號，見文末「建議新增的待確認」）。

### 評估二：App 內是否另設「減少動態效果」開關

iOS 的「減少動態效果」可以透過 `prefers-reduced-motion` 讀到（iOS 上對應系統的 ReduceMotion 設定），所以預設直接跟隨系統。

| 選項 | 做法 | 優點 | 缺點與風險 |
| --- | --- | --- | --- |
| A 只跟隨系統 | 不設開關 | 最簡單，行為與其他 App 一致 | 想只在這個網站減少動畫的人（例如上課投影時）沒有辦法 |
| B 加一個兩段開關 | 「跟隨系統」與「一律減少」，寫入 `html[data-motion]` | 給需要的人一個出口；不提供「一律完整動畫」，不會蓋掉系統的無障礙設定 | 多一組要測的狀態（不過 reduced 樣式本來就要做） |

**建議**：B。reduced 樣式本來就必須完整實作與測試，多一個開關的成本很低。由你決定（目前沒有對應編號，見文末）。

## 已決定的項目（2026-10-20）

### 正式支援 iOS 17（D8，原評估三）

已決定（D8，2026-10-20）：A，正式支援 iOS 17。做法：

1. **前綴交給建置工具**：由 Lightning CSS 或 Autoprefixer 依 browserslist 自動補 `-webkit-backdrop-filter`（工具在 M0a 二選一，寫進 09）；browserslist 至少涵蓋 `ios_saf >= 17` 與 `safari >= 17`。原始 CSS 只寫無前綴版，不手寫前綴，避免兩邊都做（5.3）。CI 檢查建置後的 CSS 確實含前綴版，而且數值是字面值、不含 `var()`。
2. **Tab bar 寫在初始 HTML 殼層**：iOS 17 以下有「頁面載入後才插入的元素不套用 backdrop-filter」的問題（Safari 18 才修正 129517679），React 掛載的 Tab bar 可能完全沒有模糊；所以 Tab bar 的元素直接寫在 `index.html`，React 只更新它的屬性與文字（6.1，殼層見 06 第 2.3 節）。
3. **閘門的判斷流程不變**：`LEGACY_SAFARI_SOLID` 設為 false，只支援前綴版的 Safari 17 也走 Tier 1 霧面；另外寫入 `html[data-glass-legacy]`，讓執行期才插入的少數玻璃元件（實驗室的浮動步驟控制列等）在這些版本改用實色（5.2、5.3）。
4. **M0a 驗證**：實機測試加一台 iOS 17 裝置，沒有實機時用 Simulator 補並在報告註明；iOS 17 上的玻璃外觀與層級判斷一併驗證（項目見 06 第 10 節）。若 M0a 發現 iOS 17 的玻璃有無法處理的問題，先回報；把 `LEGACY_SAFARI_SOLID` 改回 true 等於改採 B，要經過你同意。

| 選項 | 做法 | 結果 | 取捨紀錄 |
| --- | --- | --- | --- |
| A 正式支援 | 自動補前綴；Tab bar 寫在殼層；測試矩陣加一台 iOS 17 | 採用 | 涵蓋還沒升級的學生；多一台測試機，Tab bar 的實作方式因此改成殼層元素 |
| B 能用但不正式支援 | iOS 16.4 到 17.x 自動走 Tier 0 實色 | 未採用 | 不必處理舊版玻璃 bug，但舊裝置看不到玻璃 |
| C 不支援 | 顯示「請更新 iOS」提示 | 未採用 | 測試範圍最小，但擋掉部分學生，不符合「盡量讓人用」的目標 |

未採用的選項：B（舊裝置看不到玻璃效果）、C（擋掉學生）。D8 只決定到 iOS 17：Vite 8 預設的建置目標（`baseline-widely-available`）對應 Safari 16.4 與 iOS 16.4，iOS 16.4 到 16.x 的程式能執行，閘門也會給 frost，但不列入測試、不保證外觀；iOS 16.4 之前不保證能執行，也不調低 Vite 的 `build.target`。

---

## 1. 設計原則

1. **內容優先，玻璃只在導覽層。** 依 Apple HIG 的指引，Liquid Glass 用在浮於內容之上的控制與導覽層，不用在內容層，而且要節制。題目、報表、名詞卡一律是實色卡片。
2. **可讀性優先於效果。** 任何玻璃組合都要在最糟的背景上達到對比標準；做不到就退回實色。
3. **不只靠顏色。** 顏色永遠是第二層提示，第一層是文字、圖示、符號與位置。
4. **溫暖、柔和、可愛，但不幼稚。** 淺色是紙：大面積是幾乎白的暖紙，彩色只在小型標籤、回饋面板與插圖，文字用暖墨；深色是夜色：底色帶一點色相，強調色明亮但只在填色與文字。淺色不用紫色；兩者都不用純黑純白當底色或文字色（16）。
5. **原生手感。** 系統字型、44px 觸控目標、彈簧動態、safe area；但不模仿 Apple 的專有素材。
6. **動態要有意義，而且可以關掉。** 動畫用來說明「數字從哪裡來、往哪裡去」，減少動態時改用醒目標示與文字，資訊不減少。
7. **一套 tokens，兩種主題，兩種語言。** 深色模式不是反色，而是另一組調過的值；英文字串較長，元件不得依賴固定寬度。
8. **形狀說明可點，不靠底線。** 按鈕有填色或外框；選單列與名詞卡有卡片與右側箭頭；底線只留給句子裡的文中連結（TextLink）。（M3，2026-10-24）
9. **可按的實體一律是代幣造型，頁首與工具列是平的。** 內容區的 Button（primary、secondary、danger）與地圖節點共用 4px 立體底邊與按壓規則；鈴是金幣、節點像硬幣、按鈕像代幣。BackButton、IconButton 的 chrome 變體、StatChip、HUD、Tab bar 沒有底邊，只有底色與按壓時的底色變化。（M3）
10. **顏色的意思固定。** `--ll-accent` 系只給動作與選取（主按鈕、目前關卡外圈）；`--ll-star` 系只給進度、收集與獎勵（進度條、圖鑑印章、星星、精通徽章）；success、danger 是對錯與狀態；`--ll-link` 只給句中連結；「已按下、目前頁」這類選取外框用 `--ll-selected`（第 2.7 節）。一個畫面一顆 primary。（M3）

---

## 2. 色彩

### 2.1 tokens 架構

| 層級 | 命名範例 | 誰可以用 |
| --- | --- | --- |
| 基礎色票 | `--ll-peach-tint`、`--ll-sky-ink` | 只有語意層可以引用 |
| 語意 tokens | `--ll-bg`、`--ll-text`、`--ll-accent`、`--ll-success-ink`、`--ll-change-up-ink` | 元件與頁面 |
| 元件 tokens | `--ll-tabbar-glass-bg`、`--ll-button-primary-bg` | 單一元件 |

- 主題寫在 `html[data-theme='light'|'dark']`，深色另有 `html[data-flavor='violet'|'berry'|'wine']`；已決定（2026-10-21）：預設跟隨系統，可在設定頁手動選擇外觀與深色風味，偏好存在 localStorage 的 `ll:theme` 與 `ll:dark-flavor`，由 boot 腳本在首次繪製前套用（16 第 7 節）。
- 原始檔位置依 [09 技術選擇](09-tech-stack.md) 第 8 節的資料夾結構。已決定（2026-10-20）：以 `packages/tokens` 的 TypeScript 原始檔為唯一來源，建置時產生 CSS 變數檔、TS 常數、manifest 色碼（`theme_color` 與 `background_color`）與 HTML 內聯的首次繪製背景色（見 [06 PWA](06-pwa-responsive.md) 第 2 節）；日後也能產生 App 用的常數。`packages/tokens` 只放 tokens，不放元件樣式與玻璃規則（第 5 節、第 9 節）。
- 媒體查詢裡不能用 `var()`，斷點（600px、1024px、1440px，見 02）的常數同樣由 `packages/tokens` 在建置期產生，CSS 與 TypeScript 共用同一份來源。
- 元件 tokens 的實際清單見第 2.7 節（M3 起：連結、按鈕、平面元件、進度與收集、遮罩、選取色）；地圖與場景的 tokens 見 [16 主題](16-themes.md) 第 11 節。

### 2.2 基礎色票（已移到 16）

已決定（2026-10-21）：色票以 [16 主題](16-themes.md) 為準。淺色是紙質：paper 五階（`#FFFDF9` 卡片、`#FCF8F0` 頁面、`#F4F0E7` 凹陷區、`#E0DACF` 髮絲線、`#C2BDB4` 裝飾）、ink 四階（`#292622`、`#625D56`、`#6D6861`、`#8F8880`）、赤陶 `#9E4A25`、蜜桃 `#F49A6C`（只做裝飾）、天空藍 `#1D5F8C`、薄荷 `#1F6E52`、赭 `#7F5A00`、珊瑚 `#A8383A`、星星 `#F0C64A`（16 第 2.1 節）。深色是三風味：每個風味的卡片、選取底、註解三階為錨定值，其餘底色階梯由公式推導；狀態色（綠 `#8AFF80`、紅 `#FF9580`、橙 `#FFCA80`、青 `#80FFEA`、黃 `#FFFF80`）與文字 `#F8F8F2` 三個風味共用；強調色隨風味：夜空是紫 `#9580FF` 與亮紫 `#AA99FF`，莓果與紅酒由各自的註解色色相推導（16 第 3.4 節）；費用要素夜空是粉 `#FF80BF`、莓果與紅酒是亮紫（16 第 4.1 節）。

刻意不用的顏色：淺色不用紫色與偏紫的藍；兩個主題都不用純黑 `#000000` 與純白 `#FFFFFF` 當底色或文字色（陰影與高光的半透明疊色除外）；淺色不用高飽和的螢光色。原本的粉彩色票（蜜桃、奶油黃、薄荷、天空藍、珊瑚粉加杏仁米底）作廢，杏仁米 `#FBF4EA` 在紙上偏黃。

### 2.3 語意 tokens（名稱不變，值見 16）

token 的名稱與角色維持本節原本的定義：`--ll-bg`、`--ll-surface`、`--ll-surface-2`、`--ll-elevated`（新增，sheet 與玻璃底）、`--ll-border`、`--ll-border-strong`、`--ll-text`、`--ll-text-2`、`--ll-text-3`、`--ll-text-4`（新增，裝飾）、`--ll-accent`、`--ll-accent-contrast`、`--ll-accent-tint`、`--ll-accent-ink`、`--ll-accent-pressed`（新增）、`--ll-selected`（2026-10-25 新增，選取色）、`--ll-link`（2026-10-24 起等於強調墨色：紙質赤陶、深色依風味）、`--ll-focus`（紙質天空藍、夜空青、莓果與紅酒是風味淡色）、`--ll-success-tint` 與 `-ink`、`--ll-danger-tint` 與 `-ink`、`--ll-warning-tint` 與 `-ink`、`--ll-info-tint` 與 `-ink`、`--ll-change-up-tint` 與 `-ink`、`--ll-change-down-tint` 與 `-ink`、`--ll-change-none-tint` 與 `-ink`、`--ll-highlight-ring`、`--ll-star`（新增）。四個主題的值在 16 第 2.2 節（淺色）與第 3.3 節（深色）。兩條規則：淺色的淡底是 ink 以 12% 疊在卡片上，深色是 15%；淺色的選取狀態（膠囊、選項）用紙色底加赤陶色邊與圖示，不用彩色塊。

### 2.4 會計要素的顏色（一律搭配圖示與文字）

| 要素 | 色系 | 圖示（Phosphor，暫定） | 中文標籤 | 英文標籤 |
| --- | --- | --- | --- | --- |
| 資產 | 天空藍（深色：青） | `Wallet` | 資產 | Assets |
| 負債 | 珊瑚（深色：紅） | `HandCoins` | 負債 | Liabilities |
| 權益 | 薄荷（深色：綠） | `Handshake` | 股東權益（教材用語，見下方說明） | Equity |
| 收入 | 赭（深色：黃） | `Coins` | 收入 | Revenue |
| 費用 | 赤陶（深色：粉） | `Receipt` | 費用 | Expenses |

- 要素標籤（tag）的樣式：該色系的 tint 當底、ink 當文字與圖示，圖示在前、文字在後，文字永遠顯示。
- 標籤文字以 [12 術語表](12-glossary.md) 為準。已決定（D13，2026-10-20）：W01 到 W15 全部採用，其中 W07 讓教材名稱維持主要顯示，所以權益要素的標籤顯示教材用語「股東權益」，現行說法「權益」列為可搜尋的別名；「舊稱」標記放在名詞卡與名詞圖鑑（NoteTag，第 9 節），不塞進小型要素標籤。英文標籤以 IFRS 用語為準；已決定（D11，2026-10-20）：拼字用英式（與 IFRS 原文一致），美式拼法只當搜尋別名。
- 色系與回饋色有重疊（例如負債與答錯都是珊瑚粉），這是有限色票下的取捨：要素只出現在小型標籤，回饋出現在整塊回饋面板並附圖示與「再想想」等文字，兩者的形狀與位置不同。
- 分類題的放置區（資產、負債、權益、收入、費用）用同一套顏色與圖示，放置區的標題文字永遠可見。

### 2.5 增加、減少與不變

| 狀態 | 符號 | 畫面文字 | 顏色 | 螢幕閱讀器讀到的內容 |
| --- | --- | --- | --- | --- |
| 增加 | ▲ 與 + | `▲ +12,000` | change-up（淺色天空藍、深色青） | 「增加 12,000」 |
| 減少 | ▼ 與 - | `▼ -12,000` | change-down（淺色赭、深色黃） | 「減少 12,000」 |
| 不變 | ＝ | `＝ 不變` | change-none（中性） | 「不變」 |
| 指標從 N/A 變成可計算 | 圖示 `Sparkle` | `可計算了` | 薄荷（深色綠） | 「由無法計算變為 1.25 倍」 |

- 正負號與千分位由 [05 多語系](05-i18n.md) 的格式器輸出，元件不自己拼字串。負號是 Intl 在 zh-TW 與 en 輸出的一般減號（U+002D），與報表、輸入框一致（iOS 實機的實際輸出【待實測 V14】）。一般數字一律用 `signDisplay: 'negative'`；變動標籤需要「+」，改用 05 第 10 節的變動值格式選項 `|sign`（`signDisplay: 'exceptZero'`，先把 -0 改成 0，四捨五入後為 0 時不帶正負號）。這是 04 第 12.6 節規則的唯一例外。
- ▲▼ 以圖示或字元呈現（二擇一，全站一致），一律 `aria-hidden="true"`，旁邊的文字或 `aria-label` 才是給輔助科技讀的內容（第 8 節）。
- **為什麼不用紅綠**：台灣股市習慣紅漲綠跌，與西方相反，兩種直覺都有人；紅綠也是最常見的色覺差異組合；而且在會計裡「增加」不代表好（費用、負債增加都可能是壞消息）。所以改用中性的藍與赭色，在紅綠色覺差異下仍能靠藍黃軸區分，再加上符號與文字。

### 2.6 對比度：估算值與 M0b 驗證

已決定（2026-10-21）：對比度以 [16 主題](16-themes.md) 第 6 節為準（淺色與三個風味各一輪，148 組，已用腳本計算）；下表是原粉彩色票的估算，保留作為紀錄，M0b 的測試依 16 的門檻：

| 組合 | 淺色 | 深色 | 要求 |
| --- | --- | --- | --- |
| text 對 bg | 11.83 | 15.05 | 4.5 |
| text-2 對 bg | 7.16 | 10.24 | 4.5 |
| text-3 對 bg、對 surface-2 | 5.18、4.76 | 6.72、5.35 | 4.5 |
| 各色系 ink 對自己的 tint（要素標籤、回饋、變動標籤） | 5.07 到 5.77 | 7.90 到 8.90 | 4.5 |
| accent-contrast 對 accent（主要按鈕） | 5.96 | 8.48 | 4.5 |
| focus 對 bg | 6.27 | 11.32 | 3（焦點指示） |
| border-strong 對 bg、對 surface-2 | 3.52、3.23 | 4.29、3.87（對 surface） | 3（元件邊界） |
| 各色系 fill 對 surface | 1.58 到 2.66 | 6.48 到 9.19（深色的 fill 偏亮） | 淺色模式只當裝飾或附文字的底色，需要 3:1 的狀態指示改用 ink 色或加邊框；深色模式的 fill 本身已達 3:1，但規則一致，同樣不單靠 fill 傳達狀態 |

**M0b 驗證方式**：

1. 一支腳本讀取 tokens 檔，列出所有「文字對背景」「圖示對背景」「邊界對相鄰色」的組合，計算對比並輸出報表；低於門檻就讓 CI 失敗。
2. 玻璃另外驗證：Playwright 在 Chromium 與 WebKit 把 Tab bar 疊在一組測試背景上（純黑、純白、各色系 fill、密集的報表、圖表），截圖後取樣標籤與圖示背後的像素，計算實際對比（見 6.4）。
3. 增強對比（`prefers-contrast: more`）與深色模式各跑一次。
4. 報表結果存進 repo，作為 [10 里程碑](10-milestones.md) 的無障礙完成標準之一。

### 2.7 元件 tokens（M3，2026-10-24 到 26）

全站可點元素重新設計時新增（`packages/tokens` 的 `COMPONENT_COLOR_TOKENS`）；元件只引用這些與第 2.3 節的語意 token，不寫死色碼。深色的值只寫在共用區塊，以 `color-mix(in oklab, …)` 帶入各風味的底色或強調色，所以夜空、莓果、紅酒自動不同；完整的值與對比見 [16 主題](16-themes.md) 第 2.2、3.3、6 節。

| 用途 | token | 紙質 | 深色（共用區塊的寫法） |
| --- | --- | --- | --- |
| 句中連結 | `--ll-link`、`--ll-link-underline`、`--ll-link-hover` | 赤陶、赤陶 45% 透明、accent-pressed | 強調墨色、墨色 50% 透明、墨色 70% 混 text |
| 主按鈕 | `--ll-btn-primary-bg`、`-fg`、`-ledge`、`-pressed` | accent、accent-contrast、`#6F341A`、accent-pressed | accent、accent-contrast、accent 60% 混 bg、accent-pressed 85% 混 bg |
| 次要按鈕 | `--ll-btn-secondary-bg`、`-fg`、`-border`、`-ledge`、`-pressed`、`-icon` | surface、text、border-strong、text-4、accent-tint、強調墨色 | elevated 68% 混 border-strong、text、border-strong、border-strong 40% 混 bg、accent-tint 80% 混 bg、selected 60% 混 text |
| 危險按鈕 | `--ll-btn-danger-bg`、`-fg`、`-ledge`、`-pressed` | danger-tint、danger-ink、danger-ink、淡底混 10% 珊瑚色 | 淡底混 20% 珊瑚色、珊瑚色混 28% text、珊瑚色 32% 混 bg、danger-tint |
| 停用 | `--ll-btn-disabled-bg`、`-fg` | surface-2、text-3 | 同左（停用是灰底加虛線外框，不用 opacity） |
| 圖示 | `--ll-btn-icon` | 強調墨色 | 強調墨色（IconButton、BackButton、quiet、Disclosure 的圖示） |
| 平面元件 | `--ll-chrome-bg`、`--ll-chrome-pressed`、`--ll-quiet-hover` | surface-2、border、surface-2 | elevated、surface-2、surface-2 |
| 列按下 | `--ll-row-pressed` | 強調色 12% 混卡片色 | accent-tint（NavRow、Disclosure、選單項目、quiet 按鈕按下的底；頁面自己的可點列也用它） |
| 地圖節點底邊 | `--ll-node-ledge` | text-4 | border-strong（節點立在路面上，暗底邊在路面上看不見，所以不跟著次要按鈕變） |
| 進度與收集 | `--ll-star-fill`、`--ll-star-edge`、`--ll-star-ink`、`--ll-collected-ring` | star、warning-ink 40% 透明、text、star 30% 透明 | star 82% 混 warning-ink、透明、bg、填色 65% 透明 |
| 進度條軌道 | `--ll-progress-track`、`--ll-progress-rim` | surface-2、border | border-strong 28% 混 surface、border-strong 70% 混 surface（空的進度條在深色看得到） |
| 遮罩 | `--ll-scrim` | `rgb(41 38 34 / 0.4)` | `rgb(0 0 0 / 0.65)` |

- 次要按鈕、危險按鈕的底邊一定比面暗（四個主題都由 `contrast.test.ts` 檢查：面對底邊至少 1.3，危險 1.2；底邊對卡片 1.3、對頁面 1.5）。
- 次要按鈕的圖示在深色用 `--ll-btn-secondary-icon`（和面同一個色相）；選單列與收藏卡的圖示也用它。NavCard 旁的動作鈕（收藏卡的垃圾桶）靜止時用它、滑過與鍵盤焦點才換回 `--ll-btn-icon`（2026-10-26 決定：深色三風味裡垃圾桶不比愛心鮮豔）。

---

## 3. 字型與字級

### 3.1 字型堆疊（只用系統字型）

```css
:root {
  --ll-font-zh: system-ui, -apple-system, "Segoe UI", Roboto, "PingFang TC", "Noto Sans TC", "Noto Sans CJK TC", "Microsoft JhengHei", sans-serif;
  --ll-font-en: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif;
  --ll-font-num: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
:lang(zh-TW) { font-family: var(--ll-font-zh); }
:lang(en) { font-family: var(--ll-font-en); }
.ll-num { font-family: var(--ll-font-num); font-variant-numeric: tabular-nums lining-nums; }
```

- 中文堆疊是拉丁系統字在前、繁體中文字型在後（2026-10-25，M3 收尾第 4 輪看圖驗收）：PingFang TC 的 ASCII 連字號寬 0.6em（比數字還寬），「1-3」「E1-1」這類關卡代號在首頁、主按鈕、小地圖、名詞卡、地圖節點、收藏卡上看起來像破折號。系統字的連字號約 0.43em，和英文版、`.ll-num` 是同一個字面。中文字與全形標點（（）「」，。－）系統字沒有，逐字退回 PingFang TC 等中文字型，字面不變（以 Chromium 的 `CSS.getPlatformFontsForNode` 逐段核對）。副作用：中文介面裡的 ASCII 數字、英文字母與「…」改用系統字（和英文版相同），數字稍寬（0.49em 對 0.41em）。各頁不另外給代號設字型。
- 原本把繁體中文字型放在 `system-ui` 前面，是怕某些系統的 `system-ui` 對中文挑到簡體字形。現在 `system-ui` 只負責拉丁字：macOS 與 iOS 的系統字依元素的 `lang="zh-TW"` 退到 PingFang TC（Chromium 實測，中文字一律是 PingFang TC）；Windows 的 Segoe UI 與 Android 的 Roboto 沒有中文字形，依堆疊往下找到微軟正黑體或 Noto Sans CJK TC。退路：若哪個平台的中文出現簡體字形，把中文字型移回前面，改成給關卡代號一個拉丁字的 class。
- 中文行首的全形括號：`:lang(zh-TW) { text-spacing-trim: trim-start }`（base.css），換行後落在行首的「（」不留半個字的空白；不支援的瀏覽器維持原樣。
- 不下載任何字型檔：首次載入更快、離線不缺字；Noto Sans TC 只在裝置已安裝時使用。不自行託管 SF Pro。
- 缺翻譯而退回中文的元素會設 `lang="zh-TW"`（見 05），自動套用中文字型堆疊。

### 3.2 數字

- 金額、報表、指標、輸入框一律 `.ll-num`：等寬數字（`tabular-nums`），上下對齊的數字才能讓學生逐位比較。
- 數字用拉丁系統字型（`--ll-font-num`），因為等寬數字依賴字型的 `tnum` 功能；各平台的實際效果在 M0b 用 iOS、Android、Windows 截圖確認數字是否等寬。
- 表格內的金額靠右對齊；完整數字加千分位，不縮寫（見 05）。

### 3.3 字級（以 16px 為 1rem，跟隨使用者的瀏覽器文字大小）

| token | 字級／行高 | 字重 | 用途 |
| --- | --- | --- | --- |
| `--ll-type-caption` | 12px／16px | 600 | Tab 標籤、圖表標註（最小字級，不放長句） |
| `--ll-type-footnote` | 13px／18px | 400 | 註腳、來源 |
| `--ll-type-body-sm` | 15px／24px | 400 | 次要說明、表格內文 |
| `--ll-type-body` | 17px／28px | 400 | 解說、題幹（中文行高約 1.65） |
| `--ll-type-input` | 17px／24px | 400 | 輸入框（至少 16px，避免 iOS 聚焦放大） |
| `--ll-type-callout` | 16px／24px | 600 | 按鈕、選項 |
| `--ll-type-title-3` | 20px／28px | 600 | 卡片標題 |
| `--ll-type-title-2` | 22px／30px | 700 | 區段標題 |
| `--ll-type-title-1` | 28px／36px | 700 | 頁面標題（h1） |
| `--ll-type-display` | `clamp(28px, 6vw, 40px)`／1.2 | 700 | 首頁大標、結算頁星星數 |
| `--ll-type-number-lg` | 28px／34px | 700 | 指標卡的主要數值（等寬） |

- 中文不加字距；英文全大寫的小標加 0.02em。
- 等寬字 `--ll-font-mono`（`ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Roboto Mono", "Liberation Mono", monospace`，M3）：備份碼、診斷資訊。Chromium 不認得 `ui-monospace`，所以不能只寫 `ui-monospace, monospace`。
- 不用 300 以下的字重：中文細字在低解析度螢幕上不易閱讀。
- 文字放大到 200% 時版面不破（WCAG 1.4.4），所以字級一律用 rem。表中以 px 標示方便閱讀，實作時換算成 rem（例如 17px 寫成 `1.0625rem`）；`clamp()` 的上下限也用 rem，只有中間的 `vw` 值例外。

### 3.4 元件的字級對照（M3）

| 角色 | token | 字重 | 用在 |
| --- | --- | --- | --- |
| 頁首標題（PageHeader、地圖 HUD 的 h1） | compact `title-3`、600px 以上 `title-2` | 700 | 五個頂層頁 |
| 子頁標題（TopBar 第二列的 h1） | `title-1`（手機 `title-2`；compact 版 `title-3`） | 700 | 章節頁、名詞頁、設定等 |
| 卡標題 | `title-3` | 700 | 名詞卡名稱、徽章格、結果卡、主卡標題 |
| 列標題 | `body` 17 | 600（選單項目 400） | NavRow、NavCard、LevelCard 名稱、Disclosure |
| 說明 | `body-sm` 15 | 400，`--ll-text-2` | 列與卡的說明、Banner 內文 |
| 群組小標、眉標 | `footnote` 13 | 600，`--ll-text-2` | NavList 標題、「第 3 章」 |
| 籤、徽章文字 | `caption` 12 | 600 | Badge、地圖的星星籤 |
| 按鈕 sm、md、lg | `body-sm` 15、`body` 17、`title-3` 20 | 600、600、700 | Button |
| 大數字 | `number-lg` 28 | 700，`.ll-num` | 圖鑑收集百分比、結果頁正確率 |

Tab bar 標籤是 `min(0.75rem, 16px)`（文字放大時跟著變大，最多 16px）；英文另加 `5vw - 2.5px` 的上限（320 寬時 13.5px，375 起 16px），長標籤換行時底盤跟著長高。

### 3.5 中文換行與依詞換行（M3，2026-10-25 到 26 定案）

全站規則寫在 `packages/web-ui/src/styles/03-core-utils.css`，都是繼承的屬性，元件與頁面不另寫：

```css
html { line-break: strict; text-wrap: pretty; }   /* 句號、逗號、頓號不落在行首；不留孤字；word-break 維持 normal */
@container (max-width: 11em) {                     /* 英文只在窄容器（文字放大 200% 的手機）的內文斷字 */
  :lang(en) { hyphens: auto; hyphenate-limit-chars: 8 4 3; }
  :is([class*='title'], [class*='name'], .ll-btn), :is([class*='title'], [class*='name'], .ll-btn) * { hyphens: manual; }
}
.ll-nowrap { white-space: nowrap; }                /* 整塊不斷開的短詞 */
.ll-phrased { word-break: keep-all; overflow-wrap: anywhere; }   /* 已經切好詞、詞之間有 <wbr> 的句子 */
```

- **不再用** `word-break: keep-all` 加 `overflow-wrap: anywhere` 的組合處理整段文字：分句比一行長時沒有合法斷點，緊急換行會把「。」單獨推到下一行。只有已經切好詞的 `.ll-phrased` 用它。窄欄裡的英文長字或網址可以單獨寫 `overflow-wrap: anywhere`。
- **整塊不斷的短詞**（會計名詞、介面名稱）用 Lingui rich text 包 `<span class="ll-nowrap">`（中文 6 個字以內，英文不包）；開括號、開引號放在 span 外面（Chromium 在 nowrap 的 span 裡不套用 `text-spacing-trim`）；緊接標點而且最窄寬度放不下「詞加標點」時不包。數字和量詞之間用不換行空白 U+00A0；首次載入的 chunk 裡的字串（橫幅、首頁）只能用 `.ll-nowrap`、U+00A0 或字之間的 U+2060，不能載入切詞程式。
- **整句依詞換行**：用 `Intl.Segmenter('zh-Hant')` 切詞、詞之間放 `<wbr>`。切詞程式依用途分五種，都在懶載入的 chunk，首次載入的 JS 不變：(1) web-ui 的 `phraseParts`（`components/phrase.ts`；`Phrased`、`PhrasedRich`、名詞卡名稱、地圖標題）給名稱與短說明，單字黏前後、括號裡整段不斷，可傳 `keep` 清單；地圖標題另由 `phrased()` 在「：」「，」「、」「；」後切成子句；(2) `apps/web/src/components/prose-units.ts` 與 `ProseWords`（說明頁、安裝圖解、關卡面板的學習目標）給長段落；(3) `features/chapter/prose.ts`（章節摘要、學習目標、徽章預覽）依欄寬用容器查詢分詞、單位兩層；(4) `features/term-page/prose.ts`（名詞頁長文）以 (2) 為準，再加名詞自己的名稱與會計複合名詞整塊；(5) `features/quiz-phrase/quiz-phrase.ts`（作答頁的題幹、選項、回饋、解說與名詞卡內文）建立在 (4) 上，金額切成不換行的千分位組，切詞程式在作答頁自己的 chunk。
- **共同的規則**：「的」「地」「得」與「了」「著」等助詞黏前一個詞，不落在行首（「的」後面只剩一個字時也黏著）；否定詞「不」「沒」「未」「別」黏後面的詞；「在」「從」「而」前面可以斷、黏後面；貨幣符號和後面的數字不斷；英文接空格再接「的」時那個空格換成 U+00A0。Segmenter 切成兩個單字的會計用語（沖減、營收、籌資、賒銷、攤銷、勾稽、過帳等，`KNOWN_WORDS`）先併成一個詞。
- **還沒做**：五種工具合併成 web-ui `phrase.ts` 的 prose 模式（粒度不同，合併會改變已經看圖驗收過的換行，要重拍整套圖），留到之後。
- **檢查方式**：320、375 與文字放大 200% 各拍一次，沒有任何一行以「。」「，」「、」「；」「：」或「的」開頭，重要名詞不從中間斷；章節頁、名詞頁、作答頁各有逐行量測的單元測試（`chapter-prose.test.ts`、`term-prose.test.ts`、`quiz-phrase.test.ts`）。

---

## 4. 間距、圓角、陰影、層級與動態

### 4.1 間距（4px 基準）

| token | 值 | 常見用途 |
| --- | --- | --- |
| `--ll-space-1` | 4px | 圖示與文字間距 |
| `--ll-space-2` | 8px | 相鄰觸控目標的最小間距、標籤內距 |
| `--ll-space-3` | 12px | 清單項目內距、Tab bar 左右最小邊距 |
| `--ll-space-4` | 16px | 卡片內距、手機頁面左右邊距 |
| `--ll-space-5` | 20px | |
| `--ll-space-6` | 24px | 平板頁面邊距、區段間距 |
| `--ll-space-8` | 32px | 電腦頁面邊距 |
| `--ll-space-10` | 40px | |
| `--ll-space-12` | 48px | 大區段 |
| `--ll-space-16` | 64px | 頁尾留白 |
| `--ll-target-min` | 44px | 最小觸控目標 |

### 4.2 圓角

| token | 值 | 用途 |
| --- | --- | --- |
| `--ll-radius-xs` | 6px | 小標籤、表格內的變動標籤 |
| `--ll-radius-sm` | 10px | 輸入框 |
| `--ll-radius-md` | 14px | 按鈕、選項 |
| `--ll-radius-lg` | 20px | 卡片 |
| `--ll-radius-xl` | 28px | 底部表單（sheet）、對話框 |
| `--ll-radius-full` | 999px | Tab bar、選取膠囊、圓形按鈕 |

巢狀元素用同心圓角：內層圓角等於外層圓角減去內距（例如 Tab bar 高 64px、圓角 32px、膠囊上下內距 6px，膠囊圓角約 26px，實作直接用 full）。

### 4.3 陰影（暖色調、低強度）

| token | 淺色 | 深色 | 用途 |
| --- | --- | --- | --- |
| `--ll-shadow-1` | `0 1px 2px rgb(59 47 42 / 0.06), 0 1px 1px rgb(59 47 42 / 0.04)` | `0 1px 2px rgb(0 0 0 / 0.30)` | 卡片 |
| `--ll-shadow-2` | `0 4px 12px rgb(59 47 42 / 0.08)` | `0 4px 12px rgb(0 0 0 / 0.35)` | 浮起的卡片、選單 |
| `--ll-shadow-3` | `0 8px 24px rgb(59 47 42 / 0.12), 0 2px 6px rgb(59 47 42 / 0.08)` | `0 8px 24px rgb(0 0 0 / 0.45)` | Tab bar、sheet |
| `--ll-glass-highlight` | `inset 0 1px 0 rgb(255 255 255 / 0.65)` | `inset 0 1px 0 rgb(255 255 255 / 0.08)` | 玻璃上緣的高光 |
| `--ll-focus-ring` | `outline: 3px solid var(--ll-focus); outline-offset: 2px` | 同左 | 焦點框用 outline，不用 box-shadow（forced-colors 下 box-shadow 會被移除） |

深色模式的層次主要靠 surface 的明度差與 1px 邊框，陰影只是輔助。

### 4.4 層級（z-index）

| token | 值 | 元素 |
| --- | --- | --- |
| `--ll-z-sticky` | 10 | 實驗室的恆等式摘要（實色，不加玻璃）；闖關地圖的頂部統計列、提示條與工具選單（M3，17 第 3.4 節） |
| `--ll-z-tabbar` | 50 | Tab bar、rail、側邊欄 |
| `--ll-z-sheet` | 60 | 名詞卡、底部表單 |
| `--ll-z-toast` | 70 | 更新提示、內建瀏覽器橫幅 |
| `--ll-z-skiplink` | 100 | 跳到主要內容 |

### 4.5 動態

| token | 一般值 | reduced 變體 | 用途 |
| --- | --- | --- | --- |
| `--ll-dur-fast` | 120ms | 0ms（只保留顏色變化） | 按壓回饋、hover |
| `--ll-dur-base` | 200ms | 120ms，只做 opacity | 展開收合、淡入淡出 |
| `--ll-dur-slow` | 320ms | 0ms（瞬間切換）或 120ms 淡入 | 頁面轉場、sheet 進出 |
| `--ll-dur-lab` | 450ms | 0ms，改用醒目外框與文字 | 實驗室數字流向動畫 |
| `--ll-ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | `linear` | 一般轉場 |
| `--ll-ease-enter` | `cubic-bezier(0, 0, 0.2, 1)` | `linear` | 進場 |
| `--ll-ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | `linear` | 退場 |
| `--ll-ease-spring-snappy` | 彈簧曲線（約 3.8% 回彈），時長 420ms | 不做動畫，直接到位 | Tab bar 選取膠囊、分段控制 |
| `--ll-ease-spring-gentle` | 彈簧曲線（約 1.1% 回彈），時長 600ms | 不做動畫，直接到位 | 卡片進場、恆等式天平 |

彈簧曲線用 CSS 的 `linear()` 取樣實作（由阻尼彈簧公式產生的 17 個點），不支援時退回 cubic-bezier：

```css
:root {
  --ll-ease-spring-snappy: cubic-bezier(0.3, 1.35, 0.5, 1);
  --ll-ease-spring-gentle: cubic-bezier(0.22, 1.2, 0.36, 1);
}
@supports (transition-timing-function: linear(0, 1)) {
  :root {
    --ll-ease-spring-snappy: linear(0, 0.125, 0.373, 0.619, 0.81, 0.935, 1.004, 1.033, 1.038, 1.032, 1.022, 1.013, 1.006, 1.002, 1, 0.999, 1);
    --ll-ease-spring-gentle: linear(0, 0.103, 0.309, 0.521, 0.697, 0.826, 0.912, 0.964, 0.993, 1.006, 1.011, 1.011, 1.009, 1.006, 1.004, 1.003, 1);
  }
}
@media (prefers-reduced-motion: reduce) {
  :root { --ll-dur-fast: 0ms; --ll-dur-base: 120ms; --ll-dur-slow: 0ms; --ll-dur-lab: 0ms; }
}
html[data-motion="reduced"] { --ll-dur-fast: 0ms; --ll-dur-base: 120ms; --ll-dur-slow: 0ms; --ll-dur-lab: 0ms; }
```

（`@supports` 的測試值是字面值，不含 `var()`；`linear()` 的各瀏覽器支援版本在 M0b 查證，退路已經寫好，不影響功能。cubic-bezier 退路的回彈幅度以同樣的方式估算：snappy 約 4.1%、gentle 約 1.2%，與 `linear()` 版本的 3.8% 與 1.1% 接近，但曲線形狀只有一次回彈。最後一行的 `data-motion` 只在評估二採用 B 時才需要。）

**減少動態時的行為**（Playwright 用 `reducedMotion: 'reduce'` 跑完整流程並截圖比對，見 10）：

| 元素 | 一般 | 減少動態 |
| --- | --- | --- |
| Tab bar 選取膠囊 | 彈簧移動加水平拉伸 | 直接跳到新位置 |
| Tab bar 捲動收合 | 往下捲動時收合 | 不收合，維持展開 |
| 頁面轉場（View Transitions） | 內容區淡入加輕微位移 | 不做轉場，直接切換 |
| 實驗室每一步 | 數字從分錄流向帳戶、恆等式、報表 | 每一步仍由「下一步」推進；變動的格子加醒目外框，旁邊顯示 ▲▼ 與文字，並保留文字差異表 |
| 恆等式天平 | 傾斜後回正 | 直接顯示結果與「左右相等」文字 |
| 答對答錯回饋 | 回饋面板滑入、星星彈出 | 淡入或直接出現 |
| 捲動到輸入框 | smooth | 直接定位 |
| 按鈕與地圖節點按下（M3） | 沉 4px、底邊歸零 | 不位移，只換色與底邊厚度 |
| 名詞卡蓋章、結果頁星星、章末慶祝（M3） | 縮放與旋轉一次 | 不加動畫 class，直接是最後的樣子 |
| 角色鈴沿路線移動（M3） | 章內 700ms，跨章停在拱門下 400ms，最長 2200ms | 直接出現在新節點，星星同時出現 |

- 只用 `--ll-dur-fast` 的過渡（按鈕、分段控制、選單列、Disclosure、開關）不必另寫 `transition: none`：減少動態時 tokens 已經是 0ms，0 秒的過渡不會開始（M3 收尾時刪掉重複的規則）。用 `--ll-dur-base` 的（Disclosure 的箭頭、進度條、跳到主要內容）與動畫（Toast、骨架）仍各自處理。

- 不自動播放任何超過 5 秒的動畫；實驗室動畫一律由使用者按「下一步」推進。
- 不做閃爍、快速明暗交替的效果。

### 4.6 按鈕與連結的尺寸（M3）

| token | 值 | 用途 |
| --- | --- | --- |
| `--ll-btn-h-sm`、`-md`、`-lg` | 44、48、56px | Button 三種尺寸的面高（不含底邊）；md 是預設 |
| `--ll-btn-depth` | 4px | 代幣按鈕與地圖節點的立體底邊；元素下方自帶 4px 外距保留底邊的位置，排版時算進去，不用負外距抵銷 |
| `--ll-navrow-h` | 56px | 選單列（compact 44px） |
| `--ll-progress-h-sm`、`-md` | 6、10px | 進度條（列與卡片內用 sm；主卡、作答頁、圖鑑收集卡用 md） |
| `--ll-layout-wide` | 1040px | 寬版頁面的內容寬（第 10 節） |

- 按鈕圓角是 `max(1.6em, 面高 / 2)`：一行時是膠囊，文字放大換成多行時是圓角方塊，不變成橢圓。有前置圖示的標籤換行時，圖示與最長一行一起置中（`Button.tsx` 量最長一行再平移，不改版面）。
- 左右內距在文字放大時最多少 4px（一般字級不變），320 寬加 200% 時按鈕字排成兩行而不是四行。

---

## 5. 玻璃三層與閘門

### 5.1 三個層級

| 層級 | 名稱 | 什麼時候 | 樣式 |
| --- | --- | --- | --- |
| Tier 0 | solid 實色 | App 內開了「降低透明度」、`prefers-reduced-transparency: reduce`（Chromium）、`prefers-contrast: more`、`forced-colors: active`、瀏覽器完全不支援 blur | 不透明的 surface 底色、1px 邊框、陰影 |
| Tier 1 | frost 霧面 | 其餘所有情況，**iPhone 的主力樣式**；已決定（D8，2026-10-20）：只支援前綴版的 Safari 17 也在這一層 | 已決定（2026-10-21，Liquid Glass，6.2）：淺色 `backdrop-filter: blur(12px) saturate(180%) contrast(45%) brightness(135%)`、深色 `blur(12px) saturate(160%) contrast(50%) brightness(45%)`（前綴版由建置工具補上），底色 alpha 淺色 0.60、深色 0.5，0.5px 描邊加 1px 漸層鏡面描邊、內側高光與柔和陰影。原本的 `blur(18px) saturate(170%)` 加 alpha 0.80 作廢 |
| Tier 2 | refract 折射 | 只在確認是 Chromium 時才可能啟用：桌機預設開啟，行動裝置預設關閉、可在設定中開啟 | 在 frost 之上加 SVG 位移濾鏡（`url(#ll-refract)`）與小半徑 blur |

**為什麼折射只能在 Chromium**：

- Safari 遇到 backdrop-filter 的濾鏡串含 `url()` 時，會丟掉**整串**濾鏡，同一行的 `blur()` 也一起失效。證據來自 WebKit 原始碼：`RenderLayerBacking.cpp` 以 `!hasReferenceFilter() && setBackdropFilters(...)` 短路，整串濾鏡都不會交給圖層；backdrop 也沒有軟體退路。網路上常見「把 blur 和 url 寫在同一行當退路」的建議，在 iPhone 上會讓毛玻璃完全消失。
- Firefox 的 WebRender 原生不支援 `feDisplacementMap` 與 `feImage`；需要退回 blob image 時，`nsDisplayBackdropFilters` 會把整串濾鏡清空，blur 也在其中。
- WPT（2026-10-19）：`backdrop-filter-reference-filter` 在 Chrome 155 PASS、Firefox 158 與 Safari 27.0 FAIL。WebKit 的實作 PR #68614 仍是 open 並帶 merging-blocked，bug 245510 仍是 NEW。
- WPT 的 `backdrop-filter-svg-blur` 在三個引擎**全都 FAIL**，所以 SVG 濾鏡內不放 `feGaussianBlur`，模糊一律交給 CSS 的 `blur()`；Chromium 上也要做像素驗證【待實測 V12】。
- 台灣 iPhone 上所有瀏覽器都是 WebKit（App Review Guideline 2.5.6），所以 iPhone 使用者不論用哪個瀏覽器都看不到折射；Tier 2 只會出現在 Android Chrome、Samsung Internet 與電腦的 Chrome、Edge。

來源：https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebCore/rendering/RenderLayerBacking.cpp 、https://raw.githubusercontent.com/mozilla-firefox/firefox/main/layout/painting/nsDisplayList.cpp 、https://wpt.fyi/api/search?run_ids=6244794098778112,5917475882663936,5156841570172928&q=backdrop-filter-svg （查證日期 2026-10-20）

### 5.2 閘門腳本（內聯在 index.html，先於 CSS 執行，避免閃爍）

已決定（2026-10-20）：閘門腳本與 Tab bar 的玻璃樣式屬於 `apps/web` 的殼層，不放進 `packages/web-ui` 或 `packages/tokens`；其他玻璃元件（例如實驗室的浮動步驟控制列，6.8）的樣式在 `packages/web-ui`。以下的判斷流程與樣式不變。

```js
(function () {
  var root = document.documentElement;
  // 已決定（D8，2026-10-20）：正式支援 iOS 17，只支援前綴版的 Safari 也走 frost，所以是 false。
  // 改成 true 等於改採 D8 的 B（舊版一律實色），要先經過使用者同意。
  var LEGACY_SAFARI_SOLID = false;

  // 測試字串絕不能放 var()：含 var() 的值在解析階段一律算合法，supports 永遠回傳 true
  var unprefixed = CSS.supports('backdrop-filter', 'blur(1px)');
  var prefixed = CSS.supports('-webkit-backdrop-filter', 'blur(1px)');
  // 只支援前綴版 = Safari 17 以下（Safari 18 起才有無前綴版）
  var legacy = !unprefixed && prefixed;
  root.dataset.glassLegacy = legacy ? 'true' : 'false'; // 執行期才插入的玻璃元件依這個屬性改實色（5.3）

  function mq(q) { return window.matchMedia(q).matches; }
  function read(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }

  function resolveGlass() {
    var pref = read('ll:transparency'); // 'reduced' | 'frost' | 'refract' | null
    if (pref === 'reduced') return 'solid';
    // Safari 不認得 prefers-reduced-transparency，會判定為不成立（安全）；
    // Safari 認得 forced-colors，但在 Apple 平台永遠是 none，實際只在 Windows 生效
    if (mq('(prefers-reduced-transparency: reduce)') ||
        mq('(prefers-contrast: more)') ||
        mq('(forced-colors: active)')) return 'solid';
    if (!unprefixed && !prefixed) return 'solid';
    if (legacy && LEGACY_SAFARI_SOLID) return 'solid';
    // 不用 @supports 判斷 url()：WebKit 的 CSS.supports('backdrop-filter', 'url(#f)') 回傳 true，實際卻不渲染
    var uad = navigator.userAgentData; // 只有 Chromium 90 以上提供，且限 secure context
    var chromium = !!(uad && uad.brands && uad.brands.some(function (b) { return b.brand === 'Chromium'; }));
    if (chromium && (pref === 'refract' || (pref === null && uad.mobile === false))) return 'refract';
    return 'frost';
  }

  function apply() { root.dataset.glass = resolveGlass(); }
  apply();
  ['(prefers-reduced-transparency: reduce)', '(prefers-contrast: more)', '(forced-colors: active)']
    .forEach(function (q) { window.matchMedia(q).addEventListener('change', apply); });
  window.__llReapplyGlass = apply; // 設定頁切換開關後呼叫
})();
```

說明：

- 這段腳本和 06 的 `isAppMode()`、主題與減少動態的判斷放在同一支 boot 腳本裡（head 的 inline 腳本）；殼層裡另一段 inline 腳本是 `nav` 之後的殼層在地化腳本（6.1）。CSP 的 `script-src` 以 sha256 放行這兩段腳本，CI 檢查兩段的雜湊【待實測 V15】（見 06 第 2.3 節與 09）。分頁模式與 App 模式一律以 `isAppMode()` 寫入的 `html[data-display]` 判斷，不另寫 `@media (display-mode)`；iOS 上 display-mode 的實際結果兩份事實核對看法相反，見 06 第 2.7 節【待實測 V01】。
- `navigator.userAgentData` 只有 Chromium 90 以上提供（Edge、Opera、Samsung Internet、Chrome Android 皆同），Firefox 與 Safari（含 iOS 上所有瀏覽器）都沒有，BCD 標為 experimental。Android WebView 119 以上也有這個 API，所以 LINE、Facebook 等 Android 內建瀏覽器同樣會被判斷成 Chromium；它們的 `mobile` 為 true，預設不會進入 refract。
- 不用 UA 字串判斷 iOS 版本：Safari 26 在 iOS 26 的 UA 中凍結 OS 版本，顯示的是 iOS 26 之前最後一版。iOS 17 一律以「只支援前綴版」的功能偵測辨認，不看 UA。
- `data-glass-legacy` 只在「只支援前綴版」時為 true（實際上是 Safari 17 以下）。它不改變 `data-glass` 的層級，只讓執行期才由 React 插入的玻璃元件改用實色（5.3），因為這些版本不會替動態插入的元素套用 backdrop-filter；寫在殼層裡的 Tab bar 不受影響。
- 如果 WebKit 日後真的支援 backdrop-filter 的 `url()`，這道閘門會保守地繼續把 Safari 排除在外；屆時再依實測結果決定是否開放。

來源：https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/Navigator.json 、https://developer.apple.com/documentation/safari-release-notes/safari-26-release-notes.md 、https://drafts.csswg.org/css-conditional-3/#support-definition （查證日期 2026-10-20）

### 5.3 CSS 骨架

```css
/* Tier 0：預設樣式，也是所有降級情況的終點 */
.ll-tabbar {
  position: fixed;
  z-index: 50;
  left: max(12px, env(safe-area-inset-left));
  right: max(12px, env(safe-area-inset-right));
  bottom: calc(env(safe-area-inset-bottom, 0px) + 8px);
  max-width: 480px;
  margin-inline: auto;
  height: 64px;
  border-radius: 999px;
  background: var(--ll-tabbar-solid-bg);
  color: var(--ll-text);
  border: 1px solid var(--ll-tabbar-hairline);
  box-shadow: var(--ll-shadow-3);
  transform: translateY(var(--ll-tabbar-y, 0px)) scale(var(--ll-tabbar-scale, 1));
  transition: transform var(--ll-dur-base) var(--ll-ease-standard);
}

/* Tier 1：霧面。數值一律寫字面值，不用 var()；
   -webkit-backdrop-filter 由建置工具依 browserslist 補上（D8），原始檔不手寫 */
html[data-glass="frost"] .ll-tabbar,
html[data-glass="refract"] .ll-tabbar {
  background: var(--ll-tabbar-glass-bg);
  /* 已決定 2026-10-21（Liquid Glass）：淺色值；深色改為 blur(12px) saturate(160%) contrast(50%) brightness(45%) */
  backdrop-filter: blur(12px) saturate(180%) contrast(45%) brightness(135%);
  box-shadow: var(--ll-tabbar-edge), var(--ll-glass-shadow), var(--ll-glass-highlight);
}

/* 執行期才插入的玻璃元件（例如實驗室的浮動步驟控制列）：Safari 17 以下改實色 */
html[data-glass="frost"] .ll-step-controller,
html[data-glass="refract"] .ll-step-controller {
  background: var(--ll-tabbar-glass-bg);
  backdrop-filter: blur(12px) saturate(180%) contrast(45%) brightness(135%); /* 與 Tab bar 相同；深色值同上 */
}
html[data-glass-legacy="true"] .ll-step-controller {
  background: var(--ll-tabbar-solid-bg);
  backdrop-filter: none;
}

@media (prefers-contrast: more) {
  .ll-tabbar { border-color: var(--ll-text); }
}

@media (forced-colors: active) {
  .ll-tabbar { background: Canvas; color: CanvasText; border: 1px solid CanvasText; box-shadow: none; }
  .ll-tabbar [aria-current="page"] { outline: 2px solid Highlight; }
}
```

```css
/* glass-refract.css：只有閘門判定為 refract 時才由 JS 插入這個樣式表 */
html[data-glass="refract"] .ll-tabbar {
  backdrop-filter: url(#ll-refract) blur(3px) saturate(160%) contrast(45%) brightness(135%);
}
html[data-glass="refract"][data-theme="dark"] .ll-tabbar {
  backdrop-filter: url(#ll-refract) blur(3px) saturate(160%) contrast(50%) brightness(45%);
}
```

| 元件 token | 淺色 | 深色 |
| --- | --- | --- |
| `--ll-tabbar-solid-bg` | `#FFFDF9`（paper-50） | 各風味的 `--ll-elevated`（夜空 `#353243`、莓果 `#413243`、紅酒 `#433235`） |
| `--ll-tabbar-glass-bg` | `rgb(255 253 249 / 0.60)` | 各風味的 elevated 於 0.5（Liquid Glass，6.2） |
| `--ll-tabbar-hairline` | `rgb(59 47 42 / 0.10)` | `rgb(255 255 255 / 0.10)` |

（值依 16 第 5 節，2026-10-21；深色的玻璃用比卡片亮一階的 elevated，玻璃才會比底下的內容亮。）

規則：

- **含 `url()` 的宣告永遠不出現在 Safari 會套用的規則裡**：折射規則放在獨立的 `glass-refract.css`，只有閘門判定為 refract 時才插入；選擇器本身也限定 `html[data-glass="refract"]`，雙重保險。不寫在基本規則、不寫在退路串、不寫在 `@supports` 裡。
- `<svg><filter id="ll-refract">` 只在 `data-glass="refract"` 時由 React 條件渲染，Safari 完全不必解析；濾鏡內只有 `feImage` 與 `feDisplacementMap`，位移圖是同源的靜態檔，不用 data URL（配合 CSP）。
- `-webkit-backdrop-filter` 搭配 `var()` 在 WebKitGTK 與 macOS Sonoma 有失效回報（bug 289800、297620），iOS 是否受影響未證實，所以玻璃數值一律寫字面值。
- Safari 18 起支援無前綴版，iOS 18、26、27 不需要 `-webkit-` 前綴；正式支援的 iOS 17 需要。已決定（D8，2026-10-20）：前綴交給建置工具（Lightning CSS 或 Autoprefixer）依 browserslist 自動補，原始檔不手寫，不要兩邊都做。玻璃數值本來就是字面值，所以補出來的前綴版也是字面值；CI 檢查建置後的 CSS 含 `-webkit-backdrop-filter: blur(12px) saturate(180%) contrast(45%) brightness(135%)` 這類宣告（含 contrast 與 brightness），而且不含 `var()`。
- `glass-refract.css` 只給 Chromium，不需要前綴；就算被工具補上前綴，選擇器也只在 `data-glass="refract"` 時成立，Safari 永遠不會套用。建置時可把這個檔案排除在前綴處理之外。
- 不使用 `-apple-visual-effect: -apple-system-glass-material`：它受 WebKit 的 `useSystemAppearance` 設定控制（embedder 層級，預設關閉），一般網站不能用。
- 不把任何 Liquid Glass 函式庫當成相依套件：liquid-glass-react（MIT）從 2025-06 起沒有更新，而且只在 Chromium 有位移效果；liquidGL 依賴頁面快照與 WebGL，會忽略 fixed 元素，對長列表捲動不友善，且 assets 不在 MIT 範圍內。Tier 2 的位移圖可以借鑑 shuding/liquid-glass（MIT）的產生方式，若複製程式碼，在 THIRD_PARTY_NOTICES 保留授權聲明。

來源：https://github.com/WebKit/WebKit/pull/68614 、https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebCore/css/CSSProperties.json 、https://github.com/shuding/liquid-glass （查證日期 2026-10-20）

---

## 6. Tab bar 規格

### 6.1 結構與尺寸

這段標記直接寫在殼層 `index.html` 裡，是 `body` 直屬的元素（已決定 D8，2026-10-20，殼層見 06 第 2.3 節）：

```html
<nav id="ll-tabbar" class="ll-tabbar" aria-label="主要導覽">
  <span class="ll-tabbar__pill" aria-hidden="true"></span>
  <ul>
    <li><a href="/" data-tab="home" aria-current="page"><svg class="ll-icon--regular" aria-hidden="true">...</svg><svg class="ll-icon--fill" aria-hidden="true">...</svg><span class="ll-tabbar__label">首頁</span></a></li>
    <li><a href="/play/" data-tab="play"><svg class="ll-icon--regular" aria-hidden="true">...</svg><svg class="ll-icon--fill" aria-hidden="true">...</svg><span class="ll-tabbar__label">闖關</span></a></li>
    <li><a href="/lab/" data-tab="lab"><svg class="ll-icon--regular" aria-hidden="true">...</svg><svg class="ll-icon--fill" aria-hidden="true">...</svg><span class="ll-tabbar__label">實驗室</span></a></li>
    <li><a href="/terms/" data-tab="terms"><svg class="ll-icon--regular" aria-hidden="true">...</svg><svg class="ll-icon--fill" aria-hidden="true">...</svg><span class="ll-tabbar__label">圖鑑</span></a></li>
    <li><a href="/me/" data-tab="me"><svg class="ll-icon--regular" aria-hidden="true">...</svg><svg class="ll-icon--fill" aria-hidden="true">...</svg><span class="ll-tabbar__label">我的</span></a></li>
  </ul>
</nav>
```

（路徑以 02 的頁面總表為準。英文網址時，緊接在 `nav` 之後的殼層在地化腳本在首次繪製前把 `href` 改成 `/en/`、`/en/play/` 等，標籤改成英文，`aria-label` 改成 "Main"，見 02 與 06 第 2.3 節。）

- 已決定（D9，2026-10-20）：五個項目用短名，中文「首頁、闖關、實驗室、圖鑑、我的」，英文「Home、Quest、Lab、Terms、Me」。320px 寬度下每格約 59px，中文標籤 2 到 3 字、英文都在 6 個字母以內（與 02 相同）。模組全名「闖關區／Quest」「報表實驗室／Statement Lab」「名詞圖鑑／Glossary」只用在頁面標題與關於頁，不放進 Tab bar。名稱已定案，Lingui catalog、殼層的建置設定、manifest 與安裝教學的示意圖都用這一組名稱。
- **React 不建立 Tab bar 的元素**：掛載後以 ref 取得 `#ll-tabbar`，只更新 `aria-current`、標籤文字、`href`、收合狀態等屬性與文字；切換語言時也只改文字與 `href`，不替換 `nav` 或任何子元素。站內導覽在 `click` 時呼叫 React Router 的 `navigate()`（按住 Ctrl、Cmd、Shift 或中鍵點擊時保留瀏覽器預設行為），所以不用 `<Link>` 元件。
- 圖示的 regular 與 fill 兩套 SVG 都在殼層裡，由建置腳本從 Phosphor 的 SVG 原始檔產生，CSS 依 `aria-current` 切換顯示哪一套，執行期不插入新的 SVG。
- 平板與電腦的 rail、懸浮側邊欄也是同一個 `nav`，由 CSS 依斷點改變排列與尺寸（側邊欄才需要的「收合」按鈕同樣寫在殼層，compact 時以 `display: none` 隱藏），不另外插入元素。iOS 17 上靜態 Tab bar 在切換語言、旋轉螢幕、改成 rail 之後是否仍有模糊，列入 M0a 的 iOS 17 驗證。
- 用 `<nav aria-label>` 包住一般的 `<a>` 連結，目前頁面加 `aria-current="page"`；**不用** `role="tablist"`，因為這些是頁面導覽，不是同一頁內的分頁。
- 標籤文字永遠顯示，收合時也不淡出（已決定 2026-10-21，M0a 實機回報；見 6.3）。
- 尺寸：高 64px；每個項目的觸控範圍至少 44×44；圖示 24px；標籤用 `--ll-type-caption`。
- 位置：`bottom` 為 safe area 加 8px，不貼齊螢幕底邊；medium 直向置中、最大寬度約 480px；medium 橫向改側邊 rail、expanded 與 wide 改懸浮側邊欄（見 02 與 06 第 6 節），玻璃規則相同。
- 寫在殼層裡、`body` 直屬的 `position: fixed` 元素（不使用 React portal，理由見上方 D8）；**不用 sticky**，也不放進任何 `overflow` 捲動容器，整站使用 document 捲動。理由：iOS 26 上 sticky 加 backdrop-filter 有元素消失的問題（WebKit 298709，修正後因記憶體回歸又 REOPENED），也有社群回報 overflow 捲動容器內的 sticky 玻璃元素讓整個容器變空白。
- 底部主內容加 `padding-bottom`（Tab bar 高度加 safe area 再加 16px），`html` 設 `scroll-padding-bottom` 為相同的值，讓鍵盤焦點移到的元素不會被 Tab bar 遮住（WCAG 2.4.11）。

### 6.2 選取指示（膠囊，已改為鏡片）

已決定（2026-10-21，你的要求，M0a 實作並驗證；參考你自己的 nekoserve（MIT，同一作者）的 TabBar、LiquidIndicator 與 TabLensMagnifier）：Tab bar 改成 iOS 26 以上的 Liquid Glass 做法，下面原本的「不透明膠囊」規則由這一段取代，其他段落的 transform 與減少動態規則不變。
- **底盤**：比原本更透明，淺色 `rgb(255 253 249 / 0.60)`（2026-10-22 由 0.55 調高）、深色各風味的 elevated 於 0.5；`backdrop-filter` 淺色 `blur(12px) saturate(180%) contrast(45%) brightness(135%)`、深色 `blur(12px) saturate(160%) contrast(50%) brightness(45%)`。用 contrast 與 brightness 把背後內容壓進固定的亮度範圍，所以最糟背景下標籤仍有對比下限（6.4）。另加 1px 漸層鏡面描邊、內側高光與柔和陰影。全站仍然只有底盤這一個 `backdrop-filter`。
- **版面與靜止膠囊**（第四、五輪調整，2026-10-22，你在 iPhone 實機確認這一版可以接受，Tab bar 的手感到此定案；先照 LINE 在 iOS 26 的 Tab bar 做了一版，你在 iPhone 上回報太生硬、黑底上整條看起來像被選取，於是保留版面、換回果凍感）：底盤左右邊距 21pt，主畫面 App 的底距 `max(8px, safe-area − 13px)`（Face ID 機型離螢幕底 21pt）；淺色玻璃 alpha 改為 0.60；陰影約原本的六分之一、只往下、底部加一道亮的內側帶。靜止的膠囊是半透明的灰色果凍：寬度為格距的 1.3 倍、距底盤內緣 4px；淺色 `rgb(222 216 208 / 0.65)` 加頂部光澤、頂部高光線與底部內側陰影（壓在黑底上比底盤亮、壓在白底上比底盤暗，所以在首頁的黑色色塊上仍看得出位置）；深色用 `--ll-border-strong` 的 20% 加 0.02 的光澤。標籤字重 600（原程式誤寫 400）。未採用：按住時底盤放大 4% 加白紗、每個 Tab 分身各自放大 1.12 倍、LINE 式的平白鏡面與只在兩端的彩虹邊。
- **選取鏡片**：靜止時是上面的灰色果凍膠囊；按住時抬起放大 1.3 倍、出現淡淡的色散環，並顯示放大的 Tab 分身（放大鏡，內容以鏡片中心放大 1.3 倍）；抬起的鏡片材質是光澤面、底部內側陰影、高光環與色散環，陰影窄而往下；切換時輕微拉長、過衝再落定；在 Tab bar 上拖曳可以選 Tab。鏡片與分身不用 backdrop，動畫只動 transform 與 opacity。**史萊姆式的晃動**（2026-10-22）：x 軸用 `transform: scaleX()`、y 軸用獨立的 `scale` 屬性，兩者用同一個阻尼彈簧（阻尼比 0.38、週期 270ms、總長 620ms、過衝 27%），y 軸延後 70ms，所以按下與放開時鏡片先變寬再變高。
- **水滴的動作模型**（已決定 2026-10-21，經你在 iPhone 上兩輪回報後定案：第一輪「甩回去太細長」、第二輪「少了 Q 彈感，邊緣要像鏡片」）：用兩個阻尼彈簧在同一個 rAF 迴圈裡推進（每 2ms 一小步、每幀最多 34ms），取代關鍵影格。位置彈簧週期 380ms、阻尼比 0.6（過衝約 9%，再小回彈一次）；形狀彈簧週期 220ms、阻尼比 0.3：飛行時拉伸目標 `min(0.18, 12 × |速度| ÷ 格寬)`（速度 px/ms），位置第一次越過目標時目標改為 0，水滴因此收縮再回彈；拉伸範圍：點按切換 0.94 到 1.18；拖曳中與放開後滑行 0.94 到 1.30（第三輪調整，你在 iPhone 上回報「太保守，少了骨溜感」，2026-10-22）；另一軸 `clamp(1 − 0.8 × (拉伸 − 1), 0.92, 1.06)`，長寬比最多約 1.41 倍。實測一格 1.124 → 0.961 → 1.015 → 0.995 → 1，兩格以上 1.18 → 0.945 → 1.02 → 0.993 → 1；停下約 710 到 850ms（肉眼約 550 到 600ms）。放下：過衝回頭、距目標 0.04 格以內才放下（700ms 保險），縮放 1.3 → 0.97 → 1.02 → 1 用 `linear()`、`--ll-dur-lift` 420ms（iOS 17.0 不支援 `linear()`，退回 `cubic-bezier(0.34, 1.56, 0.64, 1)` 只回彈一次）；分身在 294ms 開始淡出 160ms。兩端過衝與拖曳的橡皮筋用 tanh 飽和在 0.06 格內。拖曳放開：帶走的速度上限 2.2 px/ms，依速度往前推算 25ms 選格，背離選中格的速度乘 0.25，朝選中格的速度上限 `0.6 + 6 × 剩餘距離 ÷ 380`（水滴會滑過目標約 0.25 格再收縮回彈；Chromium 實測快速甩到第 4 格拉伸 1.25、滑過 17px，之後 0.94、1.02、1；甩到最後一格拉伸 1.29 仍在 Tab bar 內）；抓住移動中的水滴時以 70ms 時間常數收斂到手指下。
- **鏡片邊緣**（只在 Liquid Glass 層級）：`.ll-lens::after` 是 1.25px 的遮罩環（`--ll-lens-spec`，淺色 135° 從白 1.0、白 0.6、透明到暖棕 0.12、0.34；深色白 0.55、0.25、透明到黑 0.22、0.5）；`--ll-lens-rim` 加內側上亮下暗的折射陰影（淺色 `inset 0 7px 9px -9px` 白 0.9 與 `inset 0 -8px 10px -10px` 暖棕 0.22；深色白 0.22 與黑 0.4）；色散環靜止 0.14、移動 0.4、抬起 0.55。鏡片不加 backdrop（試過兩端模糊像霧玻璃且違反單一 backdrop，已拿掉）。
- **動態 tokens 只寫在 `:root`**：原本寫在 `:root, html[data-theme="light"]` 會讓 `html[data-theme]` 的權重蓋過 `@supports` 與 `prefers-reduced-motion` 的覆寫（淺色因此沒有 `linear()` 回彈、減少動態的時長也沒生效）；4.5 節的覆寫規則以此為準。
- **重新量測**（此版本）：標籤最低 7.24，圖示最低 3.31（莓果選取圖示壓白底），全部達標；Lighthouse 無障礙與最佳做法 1.00；CSP 無違規；分身對齊誤差 0。
- **其他**：未選取圖示改用主要文字色 `--ll-text`；整個 `nav`（`.ll-tabbar`）設 `-webkit-touch-callout: none`、`touch-action: none` 與 `user-select: none`，後果是手指從 Tab bar 開始的上下滑動不會捲動頁面（拖曳選 Tab 需要）。
- **減少動態**：鏡片直接跳到新位置，不抬起、不拉伸、不顯示分身；仍可點選與拖曳。
- **接受的對比例外**（2026-10-22）：按住或拖曳的瞬間，鏡片邊緣可能蓋到相鄰或選取 Tab 的一小部分字形（390pt 約 8%、320pt 約 20% 的「實驗室」標籤），放開即恢復；兩端的鏡片可超出底盤 5 到 12px，但不出螢幕。靜止與落定狀態仍遵守 4.5:1 與 3:1。量測（果凍版 build 14）：淺色標籤最低 9.80、深色標籤最低 7.31；選取圖示靜止時淺色壓黑 4.00，深色壓白 3.02 到 3.17（夜空 3.17、莓果 3.02、紅酒 3.06）；淺色拖曳瞬間鏡片緊鄰選取 Tab 壓黑 3.05（舊陰影）。已部署的 build 15（3b0fdcb2）把深色光澤由 0.04 降到 0.02 以增加餘裕，並改用較窄的陰影，估計莓果約 3.1、瞬間約 3.16 以上，但 build 15 尚未重新量測（你為了先部署而停掉最後一輪複測）；M0b 建立 `packages/tokens` 的對比測試時以實際量測為準。
- **已知限制**：拖曳選 Tab 不算「使用者在這一頁有互動」，到某一頁後第一個動作就是拖曳時，Safari 的返回鍵會跳過那一頁（WebKit 的防濫用規則，點按不受影響，程式無法改變）。iOS 17.0 Simulator 無法注入觸控，按住、拖曳與切換動畫在 iOS 17 只驗了靜態畫面，M0b 補實機。

以下是原本膠囊做法的紀錄：

- 膠囊是 Tab bar 內一個絕對定位的元素，放在目前項目背後；底色 `--ll-accent-tint`（用不透明的色碼，不用 opacity）。
- 移動只用 transform：`translateX(目標位置) scaleX(拉伸係數)`。切換時用 Web Animations API 跑三個關鍵影格：起點（拉伸 1）、途中約 40% 處（往移動方向水平拉伸到約 1.18）、終點（拉伸 1），曲線用 `--ll-ease-spring-snappy`，時長 420ms。這就是「選取流動感」的做法。
- Web Animations API 的 `easing` 不會自己解析 CSS 變數，要先用 `getComputedStyle(document.documentElement).getPropertyValue('--ll-ease-spring-snappy')` 取出實際字串再傳入；曲線設在整個動畫的 options 上，不分別設在每個關鍵影格。動畫進行中又點了別的 Tab 時，從膠囊目前的位置接著跑，不跳回起點。
- 選取中的項目：圖示由 Phosphor 的 regular 換成 fill（兩套都已在殼層，CSS 依 `aria-current` 切換）、顏色 `--ll-accent-ink`，標籤改為 `--ll-text` 加粗；選取狀態同時有膠囊、實心圖示、粗體三種提示，不只靠顏色。
- 按壓回饋：被按的項目 `scale(0.96)`，120ms。
- 減少動態：不做動畫，膠囊直接設定到新位置。

### 6.3 捲動收合與鍵盤隱藏

- 往下捲動超過門檻（暫定累計 48px，且頁面已捲離頂部 120px 以上）就收合；往上捲動 24px、捲到頂部或底部時展開。用 passive 的 scroll 監聽加 `requestAnimationFrame`，並有遲滯，避免來回跳動。
- 收合的樣子（已決定 2026-10-21，M0a 實機回報「往下捲動時標籤消失不好」後修改）：整條 Tab bar 只輕微縮小 `translateY(4px) scale(0.92)`（只動 transform），標籤一律保持可見，不再把標籤的 opacity 降到 0；Tab bar 本身與標籤都不加 opacity 動畫。收合後觸控高度約 59px（仍大於 44px），標籤仍在無障礙樹中，連結的可讀名稱不變。原本的做法（`translateY(6px) scale(0.86)` 加標籤淡出）作廢。
- 在瀏覽器分頁模式（`html[data-display='browser']`）下，Safari 自己的浮動網址列會和 Tab bar 疊在一起，收合尤其重要（見 06 第 7 節）；主畫面 App 模式也套用同樣的收合。
- 若 02 的「專注模式」被採用，作答中與實驗室步驟播放中也用同樣的方式隱藏 Tab bar。
- 輸入框聚焦（鍵盤開啟）時整條隱藏：`translateY(calc(100% + 24px))`，動畫結束後 `visibility: hidden`，不在焦點順序內（06 第 7 節）。這時 Tab bar 已整個移到畫面底邊之外，`visibility: hidden` 只負責移出焦點順序，不是用來避開 Safari 取色（見 6.6）；M0a 一併截圖確認工具列顏色沒有因此改變。
- **blur 半徑在任何狀態都不變**，不對 `backdrop-filter` 做動畫。
- 減少動態：不收合，維持展開；鍵盤開啟時仍隱藏，但不做動畫。

### 6.4 可讀性策略

背景太花時「自動加深或改實色」的需求，對應做法是：**底色不透明度以最糟背景計算**，讓任何背景下都達標；有系統訊號時直接改實色。

已決定（2026-10-21）：Tab 標籤一律用主要文字色 `--ll-text`（未選取不再用 text-2）。同日改成 Liquid Glass（6.2）後，可讀性不再靠高不透明度，而是靠 `backdrop-filter` 的 contrast 與 brightness 把背後內容壓進固定亮度範圍：M0a 用靜態截圖加 glyph mask 取樣（iPhone 17 Simulator、iOS 27；四個主題乘黑、白、條紋背景，靜止與抬起共 240 個字形區域）全部達標：標籤最低 7.27（淺色、黑底、抬起時的未選取標籤；深色最低 8.00），圖示最低 3.34（深色選取圖示壓在白底，門檻 3；這一格另外在 iOS 18.6、26.4、17.0 Simulator 重量，數字相同）；Chromium 另外檢查折射層級與 Lighthouse 無障礙 1.00；數值見 16 第 5、6 節。下面是原粉彩色票的估算，保留作為紀錄。估算方式：玻璃底色（淺色 `#FFFBF5`、深色 `#28221E`）以 alpha 0.80 疊在最糟背景上（淺色以純黑、深色以純白），在 sRGB 數值上線性混色後，再用 WCAG 相對亮度公式計算。模糊會把背景平均化，純黑或純白是最極端的情況，所以實際只會更好：

| 組合 | 淺色（最糟：純黑在下） | 深色（最糟：純白在下） | 要求 |
| --- | --- | --- | --- |
| 未選取標籤（text-2） | 約 4.73 | 約 4.81 | 4.5 |
| 選取標籤（text，在不透明的膠囊上） | 10.78 | 10.65 | 4.5 |
| 未選取圖示（text-2） | 約 4.73 | 約 4.81 | 3 |
| 選取圖示（accent-ink，在不透明的膠囊上） | 5.07 | 7.90 | 3 |

- 膠囊用不透明的 `--ll-accent-tint`，所以選取項目的對比不受背景影響。
- 未選取標籤的餘裕只有約 0.2 到 0.3。M0b 的截圖取樣若低於 4.5:1，先把 alpha 提高到 0.85（估算約 5.4 與 5.7），不降低標準。
- alpha 0.72 時未選取標籤在最糟背景下只有約 3.7 到 3.8，不達標，所以預設取 0.80；是否在平常降低 alpha、遇到花的背景才加深，見「需評估」評估一。
- `saturate()` 會稍微改變底下顏色的亮度，以上數字以 M0b 的截圖取樣為準（2.6）。
- Apple HIG 也建議文字較多或背景可能影響可讀性時用較不透明的變體；內容層一律不用玻璃，用到玻璃的少數元件見 6.8。

### 6.5 不得觸發 Backdrop Root

依 Filter Effects 2（ED 2026-10-02），backdrop-filter 只會取樣到最近的 Backdrop Root。以下情況會形成 Backdrop Root：根元素、`filter`、`opacity` 小於 1、`mask`（含 `mask-image`、`mask-border`）、`clip-path`、`backdrop-filter`、非 normal 的 `mix-blend-mode`、`will-change` 指定上述屬性；CSS View Transitions 1 另外規定 `view-transition-name` 不為 none 的元素也會形成 Backdrop Root（Safari 26 也有對應修正 146281670）。

因此 **Tab bar 本身與它的祖先（`body`、`html`）都不設定**：`opacity`、`filter`、`mask` 系列、`clip-path`、`mix-blend-mode`、`will-change`、`view-transition-name`（`:root` 本來就是 Backdrop Root，不受影響）。否則玻璃只會「看到」那個祖先，透不出下方內容。另外：

- 不做巢狀的 backdrop-filter（Tab bar 的子元素不加玻璃）。
- 路由轉場只套在內容區：React 19.3 的 `<ViewTransition>` 只包住內容區。若 `:root` 預設的根轉場會把 Tab bar 一起截成靜態圖，可把 `:root` 的 `view-transition-name` 設為 none、只替內容區命名，讓 Tab bar 不參與轉場；這個做法列入 M0a 的玻璃原型一起驗證。
- 同時要注意疊放順序：依 View Transitions 的規格，轉場期間的 `::view-transition` 疊層畫在整份文件之上，內容區的快照若延伸到 Tab bar 下方，轉場的幾百毫秒內會蓋住 Tab bar。M0a 要截圖確認；若遮擋明顯，備案是讓內容區快照不延伸到 Tab bar 的範圍，或縮短、簡化轉場（減少動態時本來就不做轉場）。
- 規格註明 Backdrop Root 的定義尚未取得工作小組共識（issue 53），WPT 中 Safari 27.0 與 Firefox 158 也有部分項目 FAIL，各引擎行為可能再變，所以 M0a 原型要截圖確認。

來源：https://drafts.csswg.org/filter-effects-2/ 、https://drafts.csswg.org/css-view-transitions-1/ 、https://developer.apple.com/documentation/safari-release-notes/safari-26-release-notes.md （查證日期 2026-10-20）

### 6.6 與 Safari 工具列、狀態列的互動

- Safari 26 的工具列取色規則只有社群逆向工程的結果，而且彼此矛盾：一說帶 backdrop-filter 的 fixed 元素不會被取樣，另一說會。所以 Tab bar 採浮動膠囊、離底部 safe area 至少 8px，不論哪種規則才正確都不會被當成取色來源；`html` 與 `body` 一定設定明確的背景色並隨主題更新。
- 隱藏的覆蓋層用 `display: none`，不要只設 `visibility: hidden` 或 `pointer-events: none`（andesco 的觀察顯示這兩種元素仍會被取樣）；`opacity: 0` 是否被取樣沒有資料，保守起見同樣不依賴。
- 頂部用實色區域加 `padding-top: env(safe-area-inset-top)`，不依賴 `black-translucent`（WebKit bug 301994 在 iOS 27 beta 仍能重現）。狀態列顏色的實際來源【待實測 V05】。
- iOS 26.x 在 rubber-band 捲動時，頂部與底部 fixed 元素可能閃爍（Safari 27.0 已修正 176226179）【待實測 V13】。
- fixed 底部元素在 Compact、Bottom、Top 三種分頁列版面下的位置，以及是否被 Safari 浮動控制列裁切【待實測 V06】。

來源：https://bugs.webkit.org/show_bug.cgi?id=301756 、https://github.com/andesco/safari-color-tinting 、https://developer.apple.com/documentation/safari-release-notes/safari-27-release-notes.md （查證日期 2026-10-20）

### 6.7 效能規則

- **全站同時最多一到兩個玻璃圖層**（Tab bar，加上實驗室的浮動步驟控制列等少數元件），不做巢狀，不做全螢幕模糊背景。
- blur 半徑 12 到 20px（預設 18px）；超過約 20px 肉眼差異很小，成本卻隨半徑與面積上升。
- 不對 blur 或任何 `backdrop-filter` 值做動畫；只對 transform 與子元素的 opacity 做動畫。
- `will-change` 不常駐使用（而且 Tab bar 與祖先完全不用，見 6.5）。
- 已知地雷：iOS 26.2 有開發者回報全螢幕 fixed 元素加上 `filter: blur(300px)` 時，在 Compact 與 Bottom 模式下捲動嚴重不順；Safari 27.0 修正了 iPhone 上大半徑 blur 造成頁面載入極慢的問題（172480480）；Safari 26.4 改善了 drop-shadow 與 blur 的渲染效能（169472992）。這些都佐證「小半徑、小面積」。
- 量測：用 Safari Web Inspector 的 Layers（26.4 起可看實際的合成圖層快照）與 Timelines，在 iOS 26 支援清單中最舊的 iPhone 上量；Tier 2 在中低階 Android 上的耗電與掉幀另外量測，決定行動裝置是否維持預設關閉【待實測 V12】。
- 以上「只動 transform、半徑不超過 20px」屬於社群經驗，沒有廠商的量測資料，所以當作預設工程規範，實際門檻以實機量測為準。

### 6.8 其他使用玻璃的元件

| 元件 | 是否用玻璃 | 理由 |
| --- | --- | --- |
| Tab bar、平板 rail、電腦側邊欄 | 是 | 導覽層，浮在內容之上；同一個殼層元素（6.1） |
| 實驗室的浮動步驟控制列（上一步、下一步） | 是；`data-glass-legacy="true"`（Safari 17 以下）時改實色 | 控制層；與 Tab bar 不同時出現在同一位置；它由 React 在執行期插入，舊版 Safari 不會替它套用 blur（D8，5.3） |
| 更新提示、安裝提示的浮動卡片 | 可選，預設實色 | 文字較多，實色較易讀；若日後改用玻璃，同樣遵守 `data-glass-legacy` 的退路 |
| 頂部標題列 | 否（實色） | 避開狀態列取色問題 |
| 題目卡、報表、名詞卡、對話框 | 否（實色） | 內容層 |
| 實驗室恆等式摘要（固定在上方） | 否（實色） | 數字密集，且 sticky 加玻璃在 iOS 26 有已知問題 |

---

## 7. 降低透明度、增強對比與強制色彩

### 7.1 為什麼要有 App 內的「降低透明度」開關

- Safari 與 iOS Safari 不支援 `prefers-reduced-transparency`：BCD 標為不支援；WebKit bug 175497（2017 年開立）仍是 NEW；WebKit 的 standards-position 標為「concerns: privacy」（指紋辨識疑慮）；WebKit 原始碼的 `MediaQueryFeatures.cpp` 完全沒有這個 feature，會被當成未知 feature、判定為不成立。Firefox 只在預設關閉的 flag 後面；Chrome 與 Edge 118 起支援。
- 結果是：iPhone 使用者即使在系統開了「降低透明度」，網頁也讀不到。
- 所以「我的 › 設定 › 外觀」（`/me/settings/`，見 02 的頁面總表）提供「降低透明度」開關，存在 localStorage 的 `ll:transparency`（每台裝置各自的設定，不隨備份匯入），boot 腳本在首次繪製前讀取。開關旁說明：「如果你在 iPhone 開了『降低透明度』，網頁讀不到這個設定，請在這裡開啟。」
- Chromium 桌機另有「折射效果」開關（預設開；行動裝置預設關），同樣寫在 `ll:transparency`。
- CSS 仍寫 `prefers-reduced-transparency`，給 Chromium 使用者用；Safari 會安全地判定為不成立。

### 7.2 增強對比

- Apple 的 James Craig 在 2025-06-11 於 w3c/csswg-drafts#3488 建議：在有合理的隱私模型之前，做玻璃效果的網頁開發者應改用現有的 `prefers-contrast: more`（2025-06-12 轉貼到 standards-positions #145）。
- WebKit 的 `ThemeIOS.mm` 顯示，iOS 上 `prefers-contrast: more` 對應系統的「增強對比」（DarkerSystemColors），`prefers-reduced-motion` 對應「減少動態效果」。在和玻璃、動態有關的系統輔助設定中，這兩個是 iPhone 上唯一能自動讀到的訊號（深淺色另由 `prefers-color-scheme` 讀取）。
- `prefers-contrast: more` 時：玻璃改 Tier 0；邊框改用 `--ll-text`；`--ll-text-2` 與 `--ll-text-3` 都改用 `--ll-text`；裝飾性的 soft 色塊加 1px 邊框。
- 支援版本：`prefers-contrast` 為 Safari 14.1、Chrome 96、Firefox 101；`prefers-reduced-motion` 為 Safari 10.1、Chrome 74、Firefox 63。

### 7.3 強制色彩（forced-colors）

- Safari 16 起認得 `forced-colors` 這個 media feature，但在 Apple 平台上永遠是 `none`；實際只在 Windows 的高對比主題下對 Chromium 與 Firefox 生效。
- `forced-colors: active` 時：玻璃改 Tier 0；改用系統色（`Canvas`、`CanvasText`、`Highlight`、`LinkText`）；焦點框用 outline（box-shadow 會被移除）；▲▼ 等圖示用 `currentColor`，讓它跟著系統文字色；要素與變動標籤的意義本來就有文字，不受影響。

來源：https://bugs.webkit.org/show_bug.cgi?id=175497 、https://github.com/w3c/csswg-drafts/issues/3488#issuecomment-2960890798 、https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebCore/platform/ios/ThemeIOS.mm （查證日期 2026-10-20）

### 7.4 各平台的玻璃行為

| 平台 | 預設層級 | 原因 | 自動降為實色的訊號 | 注意事項 |
| --- | --- | --- | --- | --- |
| iPhone Safari（iOS 26、27） | frost | 遇到 `url()` 會丟掉整串濾鏡；沒有 `userAgentData` | `prefers-contrast: more`、App 內開關 | 系統「降低透明度」讀不到；`prefers-reduced-motion` 讀得到；sticky 與 overflow 容器有已知問題；狀態列與 safe area 見 V05、V06 |
| iPhone 上的 Chrome、Edge、Firefox | frost | 都是 WebKit（2.5.6） | 同上 | 與 Safari 相同 |
| iPhone，iOS 18 | frost | 無前綴 backdrop-filter 與動態插入元素的修正都在 Safari 18 | 同 iPhone Safari | 不列入主要實機矩陣（見 06 第 1 節）；沒有 Compact 分頁列 |
| iPhone，iOS 17（D8 正式支援） | frost | 已決定（D8，2026-10-20）：只支援前綴版 backdrop-filter，前綴由建置工具補上；Tab bar 寫在殼層，避開動態插入元素不套用 blur 的問題（Safari 18 修正） | 同 iPhone Safari | 閘門以「只支援前綴版」判斷並寫入 `data-glass-legacy="true"`，執行期插入的玻璃元件改實色；沒有 Compact 分頁列；M0a 加一台 iOS 17 裝置或 Simulator 驗證 |
| iPhone，iOS 16.4 到 16.x | frost | 規則與 iOS 17 相同 | 同 iPhone Safari | 能用但不列入測試、不保證外觀（D8 只決定到 iOS 17，見 06 第 1 節） |
| iPadOS Safari | frost | 同 iPhone | 同上 | 版面改 rail 或側邊欄 |
| Android Chrome、Samsung Internet | frost | `userAgentData.mobile` 為 true，折射預設關 | `prefers-reduced-transparency`、`prefers-contrast: more`、App 內開關 | 可在設定開啟折射；中低階機效能見 V12 |
| 電腦 Chrome、Edge | refract | Chromium 且非行動裝置 | 同上，加 `forced-colors: active`（Windows） | 上線前像素比對【待實測 V12】 |
| 電腦 Safari（macOS） | frost | 同為 WebKit | `prefers-contrast: more`、App 內開關 | macOS 的「降低透明度」同樣讀不到 |
| Firefox（電腦與 Android） | frost | WebRender 不支援位移濾鏡，會丟掉整串 | `prefers-contrast: more`、`forced-colors: active`（Windows）、App 內開關 | `prefers-reduced-transparency` 只在預設關閉的 flag 後；Firefox 123 之前在 GPU 廠牌不明的系統不支援 backdrop-filter |
| iOS 的 App 內建瀏覽器（LINE、FB、IG） | frost | 是 WebKit | 同 iPhone Safari | 另顯示「用 Safari 開啟」橫幅（06 第 4.8 節） |
| Android 的 App 內建瀏覽器 | frost | WebView 119 以上有 `userAgentData`，會被判斷成 Chromium 行動裝置 | 同 Android Chrome | 折射預設關閉 |

---

## 8. 無障礙（確定要做）

### 8.1 鍵盤操作

- **所有題型都能只用鍵盤完成**，包括分類題、交易影響題、五步驟勾稽填格、指標計算（含 N/A 按鈕與 ± 按鈕）。
- 分類題：Tab 移到卡片，Enter 或空白鍵拿起，方向鍵選擇放置區，Enter 放入，Esc 取消；點選操作（先點卡片、再點放置區）與拖放並存，拖放不是唯一方式（WCAG 2.5.7）。拖放函式庫的鍵盤感應器或自寫實作，在 M0a 一併驗證【待實測 V07】。已決定（2026-10-21，M0a 實機）：觸控的拖曳啟動條件是手指移動 8px（不用長按），滑鼠與鍵盤沿用函式庫預設；拖曳中頁面不得被誤捲動。
- 選擇題（9.1）：單選按鈕群組（`single_choice` 與 `multi_choice` 的 `any_correct`）用 Tab 進出群組、方向鍵移動並選取；核取方塊群組（`multi_choice` 的 `all_correct`）用 Tab 逐一移動、空白鍵勾選或取消；兩者都是按「確認答案」按鈕後才判分，選取本身不會判分。
- 實驗室：「上一步」「下一步」是一般按鈕；不設單一按鍵的快捷鍵（若日後加入，必須可以關閉或改鍵，WCAG 2.1.4）。
- 焦點順序與畫面順序一致；沒有鍵盤陷阱；對話框與名詞卡關閉後焦點回到開啟它的按鈕。

### 8.2 焦點與頁面結構

- 焦點樣式是 3px outline、2px offset（按鈕 3px，選單列、Disclosure、選單項目畫在內側 -3px，不被卡片裁掉），顏色 `--ll-focus`（紙質天空藍、夜空青、莓果與紅酒是帶風味色相的淡色，16 第 3.3 節），只在 `:focus-visible` 時顯示，任何元件都不得移除 outline，也不得被 `overflow` 或 Tab bar 切到。全站的 `:focus-visible` 寫在 `base.css`，元件不重寫相同的 outline（M3 收尾）。
- 返回鍵（BackButton）的可讀名稱一定包含畫面上的短字（WCAG 2.5.3，例如畫面「地圖」、可讀名稱「回到闖關地圖」；開發模式違反時丟錯誤）；返回目的地依 02 第 3.6 節的表固定。
- 切換按鈕（收藏、清單檢視、計時）用 `aria-pressed`；選單按鈕用 `aria-haspopup="menu"` 與 `aria-expanded`（M3）。
- 頁面最前面是「跳到主要內容」連結，平常隱藏、取得焦點時顯示。
- 換頁後焦點移到頁面的 `<h1>`（設 `tabindex="-1"`），並更新 `document.title`。
- `html` 設 `scroll-padding-top` 與 `scroll-padding-bottom`，讓取得焦點的元素不會被頂部列或 Tab bar 遮住（WCAG 2.4.11）。
- Tab bar、rail、側邊欄都用 `<nav aria-label>`，目前頁面標 `aria-current="page"`（第 6.1 節）。

### 8.3 螢幕閱讀器

- **實驗室每一步**用一個 `aria-live="polite"` 區域播報摘要，例如「現金減少 12,000，由 80,000 變為 68,000；資產總計不變。」（數字為示意）。自由實驗中連續輸入時，停止輸入約 500ms 後才播報一次，避免連珠炮。
- **答題回饋**：按「確認答案」後，焦點移到回饋區（FeedbackPanel）的標題（標題設 `tabindex="-1"`），螢幕閱讀器從這裡唸出「答對了」或「再想想」，使用者再往下讀解說；焦點移動已經會唸出結果，所以不另外用 `aria-live` 重複播報。單選題與多正解題共用的 ChoiceGroup 元件都一樣（與 03 第 2.4 節一致）。
- **多正解題的判分方式提示放在 `fieldset` 的 `legend`**（已決定 D12，2026-10-20）：進入選項群組時，螢幕閱讀器先唸出「這題有不只一個合理答案，選出任一個即可。」或「選出所有正確答案（可複選）。」，再唸第一個選項；提示不透露正確答案的數量。作答後每個選項的狀態（「正確答案，你選了」「也是合理答案」「正確答案，你沒有選」「不是正確答案，你選了」「不是正確答案」，字串在 05 的 catalog，與 03 一致）以文字放進選項的可讀名稱或 `aria-describedby`，不只靠顏色與圖示（9.1）。
- **報表用真正的 `<table>`**：`<caption>`、欄與列的 `<th scope>`；金額欄靠右；窄螢幕時表格放在 `role="region"`、有 `aria-label`、`tabindex="0"` 的可捲動容器中，可以用鍵盤水平捲動。
- **▲▼ 的文字替代**：符號 `aria-hidden="true"`，變動標籤整體的可讀內容是「增加 12,000」「減少 12,000」「不變」；不讓螢幕閱讀器把「+」讀成「加號」。
- **名詞卡 chip 是 `<button>`**，可讀名稱為「名詞卡：應收帳款」，開啟後是有標題的對話框。
- 圖示按鈕一律有 `aria-label`；純裝飾圖示 `aria-hidden="true"`。
- 缺翻譯而退回中文的元素設 `lang="zh-TW"`，讓螢幕閱讀器用正確的語音（見 05）。
- 星星與徽章有文字：「3 顆星中的 2 顆」。

### 8.4 觸控目標、色彩與時間

- 所有可點元素至少 44×44 CSS px（高於 WCAG 2.5.8 AA 的 24×24），相鄰目標間距至少 8px。例外只有句中的文中連結（TextLink）與行內名詞 chip（WCAG 2.5.8 的行內例外，行內 chip 至少 24px 高）；量測以元素本身的方框為準，不用偽元素補範圍（`link-style.spec.ts` 第 6 項）。
- 顏色不是唯一的資訊來源（WCAG 1.4.1）：答對答錯有圖示與文字；要素有圖示與文字；增減有符號與文字；句中的連結有底線（中文底線位置 0.16em、英文 0.24em）；按鈕、選單列、名詞卡靠形狀、圖示與箭頭辨識，沒有底線（M3）。
- 欄位錯誤狀態全站只用一種紅（`aria-invalid="true"` 時 2px `--ll-danger-ink` 外框、焦點框也是同一個紅），錯誤文字是欄位下方的 FieldError（M3）。
- 對比：文字 4.5:1（大字 3:1）、圖示與元件邊界 3:1；玻璃以最糟背景計算（第 2.6、6.4 節）。
- 計時預設關閉；開啟後可以暫停、以文字顯示剩餘時間、可以延長（WCAG 2.2.1）。
- 不禁止縮放；320px 寬、文字放大 200% 時內容可完整使用（WCAG 1.4.10、1.4.4）。
- 表單：每個輸入框有可見的標籤；錯誤訊息以 `aria-describedby` 連到輸入框；N/A 與 ± 按鈕有清楚的可讀名稱。

### 8.5 驗收（從 M0b 起，每個有 UI 的里程碑）

axe 沒有 serious 或 critical 問題；Playwright 純鍵盤 E2E；iOS VoiceOver 與 Android TalkBack 手動清單（每個模組 5 到 10 個步驟）；減少動態效果的畫面檢查；對比計算紀錄。細節見 [10 里程碑](10-milestones.md)。

M3 起另加三項（2026-10-24，你要求全站連結重新設計）：

- `pnpm check:links`（`tools/check-links.mjs`，CI 的 verify）：原始碼檢查。react-router 的 `Link` 只准出現在 `apps/web/src/components/RouterLink.tsx`；JSX 的 `<a>` 只准在設計系統的元件檔；設計系統的 class 名稱（`ll-btn`、`ll-navrow`、`ll-termitem` 等）保留給元件檔，其他檔案出現就失敗；CSS 只有 `base.css`（`:where(a)` 把所有連結重設成繼承顏色、沒有底線）、`dev.css` 與 web-ui 的 `07-core-components.css`（TextLink 與漏網裸連結的保底外觀）可以用型別選擇器 `a`；`:visited`、`text-decoration`、style 物件、innerHTML 產生的連結也在檢查範圍（規則 R1 到 R12 在 `tools/link-rules.json`）。例外寫在 `tools/link-exceptions.json`，數量必須和實際相同，用不到的例外也算失敗（目前 1 條：備份頁程式產生、不插進畫面的下載連結）。
- `apps/web/e2e/link-style.spec.ts`（desktop-chromium 與 reduced-motion）：每一頁、每一種狀態檢查沒有瀏覽器預設連結色、連結與按鈕的文字色在 token 白名單內、按鈕類與其後代沒有底線（`ll-link` 除外）、每個連結都帶核准的 class、裸連結的數量是 0、文中連結的底線合格、觸控目標 44px、滑過與按下後再檢查一次、Tab 走完整頁的焦點框、強制色彩下看得到邊界、站內連結不通往找不到頁面。按鈕狀態板（`?ll-fixture=buttons`，只在開發伺服器與 `VITE_LL_FIXTURES=1` 的建置存在）另有一組。
- 看圖驗收：設計審查者對 375、768、1280（地圖另加 1440、1920）四個主題的截圖評分（全站九項、地圖八項，各 1 到 5 分），每項至少 4 分、平均至少 4.3，而且沒有一票否決項（瀏覽器預設連結、按鈕底線、文字被遮、觸控目標不足、焦點框被切、右下浮動按鈕、同一畫面兩顆 primary、站內連結通往找不到頁面；地圖另有文字被路線壓住、元件被裁切、硬邊矩形場景、HUD 和軌道不對齊、延伸區路線斷開）才算通過。M3 跑了八輪，結果見 [M3 回報](../reports/m3.md) 第 5 節。

---

## 9. 元件清單

已決定（2026-10-20）：下表的元件實作在 `packages/web-ui`（M0b 建立，網站與後台共用，元件自己的 Lingui 字串檔放在 `packages/web-ui/src/locales/{locale}/messages.po`）；殼層與頁面不放在 `packages/web-ui`，所以 AppShell、SkipLink，以及寫在殼層 HTML 的 TabBar、NavRail、Sidebar 留在 `apps/web`（6.1）。玻璃樣式的位置見 5.2。下表的規格不因套件切分而改變。

M2 的元件已實作（2026-10-23）：下表「首次需要」為 M2 的元件都已建立。放在 `packages/web-ui` 的有 TopBar、SegmentedControl（檔名 Segmented）、Switch、Card、LevelCard、Stars、Badge、TermChip、TermSheet、QuestionCard、ChoiceGroup（含 ChoiceOption）、TrueFalse、PickStatement、PickLine、ClassifyBoard、ImpactPicker、NumberInput、FeedbackPanel、NoteTag、Toast、Banner、LevelCodeInput、LevelCode、EmptyState 與 ErrorState（檔名 States）、Skeleton，以及地圖的 LevelNode、LevelSheet、ChapterBanner、ChapterEnd、MapMarker、MapHud、MapListToggle；會用到相機、IndexedDB 或殼層狀態的 QrScanner（`apps/web/src/features/quest-map/`）、BackupPanel（備份頁 `/me/backup/`）、InstallGuide 精簡版（安裝提示卡）、Safari 分頁提示與內建瀏覽器橫幅都在 `apps/web`，後台不需要它們。與下表的差異：ElementTag 與 ChangeBadge 在 M2 還沒有獨立的元件，M4a 的報表實驗室需要時再建立；NavRail 與 Sidebar 仍是殼層的 Tab bar 元素由 CSS 變形，不是元件。做法上的共同點：選項與分段控制的原生 `<input type="radio">`、`<input type="checkbox">` 做成透明覆蓋層（`opacity: 0`，絕對定位蓋滿整張選項卡片或分段），視覺由外層的卡片與圖示呈現，鍵盤、螢幕閱讀器與 Playwright 都直接操作原生輸入，不用 `aria-hidden` 的假元件。

M3 的元件已實作（2026-10-26）：題型元件 FiveStepFill、RatioNumeric、RatioTable、JournalEntryEditor，計時 TimerDisplay，地圖的 ChapterBadge 與 RollingNumber（頂部統計的數字滾動），以及全站重新設計的連結與按鈕元件（第 9.2 節）都在 `packages/web-ui`；元件樣式依層疊順序分成 `packages/web-ui/src/styles/` 的 15 個檔（`01-core-base.css` 到 `15-quiz-session.css`，檔名的數字就是順序，不改名、不調換）。完整安裝圖解（`features/install/`）、玩家卡、首頁的章節小地圖、收藏區與按鈕狀態板（`features/design-system/ButtonBoard.tsx`，`?ll-fixture=buttons`，只在開發伺服器與 `VITE_LL_FIXTURES=1` 的建置存在）在 `apps/web`。下表是原本的清單，M3 更動的列已改寫。

| 元件 | 用途 | 主要變體 | 玻璃 | 無障礙重點 | 首次需要 |
| --- | --- | --- | --- | --- | --- |
| AppShell | 殼層、safe area、背景 | 手機、平板、電腦 | 否 | 地標區域（header、nav、main） | M0b |
| SkipLink | 跳到主要內容 | 無 | 否 | 第一個可聚焦元素 | M0b |
| TabBar | 手機底部導覽；元素寫在殼層 HTML，React 只更新屬性與文字（D8，6.1） | 展開、收合、隱藏 | 是 | `nav`、`aria-current` | M0a 原型、M0b |
| NavRail、Sidebar | 平板橫向與電腦導覽；與 TabBar 是同一個殼層元素，由 CSS 依斷點改變外觀 | rail、懸浮側邊欄 | 是 | 同 TabBar | M2 |
| TopBar | 子頁的頁首（M3 改版）：第一列 BackButton 與右側 actions，第二列 h1 | 一般（兩列）、compact（一列：圖示返回、標題、actions） | 否 | 返回鍵的可讀名稱包含短字；h1 `tabindex="-1"` | M2，M3 改版 |
| Button、IconButton | 操作（M3 重寫，第 9.2 節） | Button：primary、secondary、back、quiet、danger；sm、md、lg；pressed、busy、block、external。IconButton：quiet、chrome | 否 | 44px、焦點框、`aria-pressed`；IconButton 的 `label` 必填 | M0b，M3 重寫 |
| SegmentedControl | 小手機切換三表、篩選 | 2 到 4 段 | 否 | radio group 語意 | M2 |
| Switch | 設定開關 | 無 | 否 | `role="switch"` 與狀態文字 | M2 |
| LanguageToggle | 語言切換 | 兩種語言時為開關、超過兩種自動改選單（見 05） | 否 | 顯示目標語言的原文名稱 | M0b |
| Card、LevelCard | 關卡、章節 | 鎖定、進行中、完成 | 否 | 狀態有文字 | M2 |
| Stars、Badge | 星星、徽章 | 0 到 3 星 | 否 | 「3 顆星中的 2 顆」 | M2 |
| ElementTag | 會計要素標籤 | 五種要素 | 否 | 圖示加文字 | M2 |
| ChangeBadge | 增減標籤 | 增加、減少、不變、變得可計算 | 否 | 文字替代 | M2 |
| TermChip、TermSheet | 名詞卡入口與內容 | 中文、中英並列 | 否 | chip 為 button；sheet 為對話框 | M2 |
| QuestionCard | 題目外框 | 各題型（題型代號見 08 第 3.6 節） | 否 | 題號、進度文字 | M2 |
| ChoiceGroup、ChoiceOption | 選擇題的選項群組與選項（`single_choice`、`pick_statement`、`ratio_interpret`，以及 D12 新增的 `multi_choice`，規格見 9.1） | 單選（radio）、複選（checkbox）；作答前：未選、已選；作答後：選對、也是合理答案、漏選、選錯、未選的錯誤選項 | 否 | `fieldset` 加 `legend`（多正解題的提示放在 legend）、逐選項回饋、狀態有文字 | M2 |
| TrueFalse | 是非題（`true_false`） | 無 | 否 | 同 ChoiceOption | M2 |
| JournalEntryEditor（原名 JournalEntryInput） | 借貸分錄題（`journal_entry`，只用在延伸章「借貸與分錄」，不列入期中考範圍，D1） | 借方、貸方列；新增與移除列；科目面板（借用選單項目的外觀 `menuItemClass()`） | 否 | 每列有可見標籤，金額用 NumberInput；純鍵盤可完成（`journal-entry-keyboard.test.tsx`）；窄螢幕時表格在可捲動的 region 裡 | M3（已實作） |
| FiveStepFill、RatioNumeric、RatioTable | 五步驟勾稽填格（`five_step_fill`）、指標計算（`ratio_numeric`，固定的 N/A 按鈕）、指標判讀題上方的指標小表格（`ratio_interpret`） | 填格、作答後逐格對錯 | 否 | 每格有可見標籤；N/A 按鈕有可讀名稱 | M3（已實作） |
| ClassifyBoard | 分類題（`classify`） | 點選、拖放 | 否 | 鍵盤流程（8.1） | M2 |
| ImpactPicker | 交易影響（`transaction_effect`；增加、減少、不變，題目需要時另有變得可計算、變成 N/A，見 08 第 3.6 節） | 單列、多列 | 否 | 每列一組 radio | M2 |
| NumberInput | 金額與指標輸入（`ratio_numeric`、`five_step_fill`） | 含 N/A 按鈕、± 按鈕 | 否 | 16px 以上字級、`inputmode` | M2 |
| FeedbackPanel | 答題回饋 | 答對、答錯、取捨題的解說觀點；多正解題標出全部正確答案（9.1） | 否 | 按「確認答案」後焦點移到回饋區標題，不另用 `aria-live` 重複播報（8.3） | M2 |
| NoteTag | 小型註記標籤，一律有文字，可點開名詞卡或說明 | 「舊稱」（W07）、「簡化」（W14）、「單期近似」（W12）、「非 IFRS 項目」／"Not an IFRS line item"（D11，中英介面都加，字串在 `packages/web-ui` 的 catalog，訊息 ID 見 05）、「IFRS 對照，不計分」（D10(f)）、「老師觀點」（W15，能否以老師名義標示【待確認 T37】） | 否 | 標籤是按鈕時有完整的可讀名稱（例如 "Not an IFRS line item: Ordinary profit. Show how IFRS treats this."，見 05） | M2 |
| Timer（實作名稱 TimerDisplay） | 計時 | 關閉、進行、暫停；全站設定或「這一關計時」單次開啟；寬鬆加倍 | 否 | 可暫停、文字時間；剩 1 分鐘與時間到的提醒可在設定關閉；切到背景或離開作答畫面自動暫停 | M3（已實作） |
| StatementTable | 三表 | 累計、本筆變動（W06 並列）；教材版面（中英都用，D11）、IFRS 對照（M4b，D10(f)）；非 IFRS 的列加 NoteTag | 否 | 真正的 table | M4a（IFRS 對照在 M4b） |
| EquationBalance | 會計恆等式天平 | 平衡、失衡（自由實驗擋下時） | 否 | 文字結論 | M4a |
| CheckLights | 四個勾稽燈號 | 通過、未通過、尚未計算 | 否 | 燈號有文字與圖示 | M4a |
| RatioCard | 指標卡 | ok、zero、na、not_meaningful（見 04） | 否 | 狀態文字，N/A 與 0 分開說明 | M4a |
| TransactionCard | 交易卡 | 故事步驟、自由實驗；步驟上的「單獨練習」入口（D10(b)） | 否 | 標題層級 | M4a |
| JournalLayer | 實驗室「看分錄與 T 字帳」的可展開層（D1；D10(c) 的來源分錄也放在這一層） | 收合（預設）、展開，展開狀態會記住 | 否 | 展開按鈕用 `aria-expanded`；T 字帳是有標題的表格 | M4a |
| TraceTree | 追蹤：一層一層展開公式，最底層列出來源步驟（D10(c)） | 收合、展開到某一層 | 否 | 樹狀結構用巢狀清單與按鈕，`aria-expanded`；每層有文字公式 | M4b |
| PolicyToggle | 教材口徑與 IFRS 對照的切換（D10(f)） | 教材、IFRS 對照 | 否 | 分段控制的 radio 語意；切到 IFRS 時頁面頂部顯示 NoteTag「IFRS 對照，不計分」 | M4b |
| StepController | 實驗室的上一步、下一步 | 浮動 | 是；Safari 17 以下改實色（5.3） | 一般按鈕 | M4a |
| StakeholderCard | 利害關係人觀點 | 正面、反面、建議 | 否 | 標題層級 | M4a |
| LabLink | 從題目跳到實驗室對應步驟 | 無 | 否 | 連結文字說明去處 | M5 |
| Toast、Banner、HintBar | 更新提示、內建瀏覽器、Safari 分頁提示、備份提醒；HintBar 是地圖頁專用的單行提示條（M3） | 資訊、提醒、錯誤、收集（`kind="collect"`，取得徽章）；Banner 有標題、動作列、關閉鈕 | 預設否 | 事件型提示放在常駐的 `ToastRegion`（`role="status"`）；不搶焦點；焦點或滑鼠停在提示裡時暫停自動收起 | M2，M3 改版 |
| InstallGuide | iOS 圖解教學 | Compact、Top／Bottom；iOS 17、18 只用 Top／Bottom | 否 | 每步有文字，插圖有替代文字 | M2 精簡、M3 完整（已實作，`/install/` 與安裝建議卡的展開圖解） |
| BackupPanel | 匯出、匯入、合併預覽（D10(a)） | 備份檔、文字備份碼；匯入預設合併，覆蓋放在進階選項 | 否 | 步驟文字與確認 | M2 |
| LevelCodeInput | 闖關地圖的「輸入關卡代號」（D10(a)，06 第 4.9 節） | 一般、錯誤（格式不符、找不到、已下架） | 否 | 可見標籤、錯誤以 `aria-describedby` 連到輸入框、16px 以上字級 | M2 |
| LevelCode | 關卡介紹顯示的代號（例如 `k7m2 q9xd`） | 無 | 否 | 等寬字型；可讀名稱念出完整代號 | M2 |
| QrScanner | App 內掃描課堂 QR（D10(a)，06 第 4.9 節） | 說明、掃描中、無權限、非站內 QR | 否 | 預覽畫面有文字說明；取消按鈕永遠可用；無權限時提供關卡代號入口 | M2 |
| EmptyState、ErrorState | 空狀態與錯誤頁 | 錯題本空、離線、載入失敗；預設插圖是鈴（空 `clasp`、錯 `cheek`，96px；整頁狀態在 1024 以上是 480px 的卡片） | 否 | 有下一步按鈕（`action` 只接受 Button，`onRetry` 自動放「再試一次」）；ErrorState 是 `role="alert"` | M2，M3 改版 |
| LevelNode、LevelSheet、ChapterBanner、ChapterEnd、MapMarker、MapHud、ChapterBadge、RollingNumber | 闖關地圖（[17 闖關地圖](17-quest-map.md)）：關卡節點與星星籤、關卡介紹面板（共用 Sheet）、立柱章節牌、章末拱門與紙籤、角色鈴、頂部統計列（StatChip、IconButton chrome、compact 的「更多」選單）、章節徽章、數字滾動 | 節點：已完成、目前、尚未挑戰、延伸章（六邊形、`E1-1`）、不計分已讀；面板：開始、再挑戰 | 否 | 節點是 `<ol>` 裡的 `<button>`，可讀名稱含章、關、名稱、星星與狀態；目前關卡 `aria-current="step"`；角色 `aria-hidden`；面板是對話框 | M2（幾何場景、簡單版角色），M3（版面重做、場景插圖、徽章與章末慶祝；已實作）。MapListToggle 與右下的 MapToolbar 已不用（工具併入 HUD） |
| PageReveal（`apps/web/src/lib/page-ready.tsx`，殼層） | 頁面布幕：每一頁第一次繪製要的資料（內容快照、進度、第一屏的懶載入作答區）齊了才整頁一次淡入，齊之前整頁隱形（版面照排）；超過 0.7 秒才顯示載入圈 | 無骨架畫面：Skeleton 元件與「…」佔位已於 2026-10-26 全站移除（維護者的要求：遊戲每一頁點進去就要是完整的，不先畫版面再補資料） | 否 | 淡入 `--ll-dur-base`，減少動態時直接出現；掀開那一刻才把焦點移到 h1 | M3 收尾 |
| DebugPanel | `/debug/` 量測頁 | 無 | 否 | 純文字 | M0a（量測用的最小版）、M0b |

### 9.1 選擇題元件（D12，M2）

已決定（D12，2026-10-20）：新增多正解題型 `multi_choice`（至少兩個正確選項；只有一個正解的題目仍用 `single_choice`），必填的 `scoringMode` 有 `any_correct` 與 `all_correct` 兩種。於 M2 與單選題共用元件一起實作；教材 0-2 p17 這類題目改寫時以 `any_correct` 呈現。資料欄位與判分規則以 03、04、08 為準，這裡定義學習端的介面。

| 題型 | 輸入元件 | `legend` 中的提示 | 什麼時候判分 |
| --- | --- | --- | --- |
| `single_choice` 等單一正解的題型 | 單選按鈕群組（radio），可以改選 | 無（群組名稱以題幹為準，見 03） | 按「確認答案」後 |
| `multi_choice`，`any_correct` | 單選按鈕群組（radio），和單選題外觀相同 | 「這題有不只一個合理答案，選出任一個即可。」 | 按「確認答案」後；選中 `correctOptionIds` 任一個即答對 |
| `multi_choice`，`all_correct` | 核取方塊群組（checkbox），可複選 | 「選出所有正確答案（可複選）。」，不透露正確答案的數量 | 按「確認答案」後才判分；必須選出全部正確選項且沒有選到錯誤選項才答對；一個都沒選時「確認答案」按鈕停用 |

「確認答案」按鈕（英文 "Check answer"）是作答的共用按鈕：單選題與多正解題的兩種判分方式都用同一個按鈕，`all_correct` 也是按下後才判分（見 03 與 05 第 3.6 節）。提示文字以 05 的 Lingui catalog 為準，英文為 `any_correct` "This question has more than one reasonable answer. Choose any one of them."、`all_correct` "Select all the correct answers. You can choose more than one."。

結構示意（`all_correct`；題目與選項 ID 依 08 第 4.1 節的格式，文字為示意）：

```html
<p id="q_7f3k2m9x-prompt" class="ll-question__prompt">（題幹）</p>
<fieldset class="ll-choice-group" data-mode="multiple">
  <legend class="ll-choice-group__hint">選出所有正確答案（可複選）。</legend>
  <label class="ll-choice"><input type="checkbox" name="q_7f3k2m9x" value="o_b8k2"><span class="ll-choice__text">（選項文字）</span></label>
  <label class="ll-choice"><input type="checkbox" name="q_7f3k2m9x" value="o_c3m9"><span class="ll-choice__text">（選項文字）</span></label>
  <label class="ll-choice"><input type="checkbox" name="q_7f3k2m9x" value="o_d7p4"><span class="ll-choice__text">（選項文字）</span></label>
</fieldset>
<button type="button" class="ll-button ll-button--primary">確認答案</button>
```

M0a 實測後補充（2026-10-21，iOS 17.0 Simulator；已採用，2026-10-23 的 ChoiceGroup 就是這樣寫）：
- `fieldset` 本身維持 block（加 `min-width: 0`），選項另外包一層 `div` 做 grid 或 flex；iOS 17.0 的 Safari 在 `fieldset` 直接是 grid 時，`legend` 會縮成一行只剩一兩個字，給 `legend` 寬度 100% 反而更窄。iOS 18.6、26.4.1、27.0 沒有這個問題。
- 作答後的狀態樣式（`.is-correct`、`.is-wrong` 等）要寫在「選取中」樣式（`:has(input:checked)`）之後並確保能蓋過它，因為 `:has()` 的權重較高。
- 選取狀態的文字一律用 `--ll-text`，`--ll-accent-ink` 只用在圖示（通用規則，見 16 第 5 節）。

規則：

- 選項群組與「確認答案」按鈕列之間留 20px（`--ll-space-5`；M0a 實機回報選項與按鈕太近，2026-10-21）。
- 一律用原生的 `<input type="radio">` 與 `<input type="checkbox">` 包在 `<label>` 裡，整張選項卡片都是點擊範圍（至少 44px 高）；`any_correct` 用 radio，所以方向鍵行為與單選題一致（8.1）。
- 提示放在 `legend`，視覺上是選項群組上方的一行小字（`--ll-type-body-sm`，`--ll-text-2`，前面加 `Lightbulb` 圖示並 `aria-hidden`），螢幕閱讀器進入群組時先唸（8.3）。
- 核取方塊與單選按鈕的外觀要能一眼分辨：複選題的選項左側是方形勾選框（Phosphor `Square` 與 `CheckSquare`），單選題是圓形（`Circle` 與 `RadioButton`），不只靠提示文字。
- **作答後每個選項都有回饋，並標出全部正確答案**；不給部分分數，整題只有「答對」與「再想想」兩種結果。選項的作答後狀態：

| 狀態 | 什麼時候 | 外觀 | 文字（畫面與可讀名稱） |
| --- | --- | --- | --- |
| 選對 | 選了，而且是正確答案 | 薄荷 tint 底、`CheckCircle` | 「正確答案，你選了」 |
| 也是合理答案 | `any_correct`：沒選，但也在 `correctOptionIds` 裡 | 薄荷 tint 底、`CheckCircle` 線條版 | 「也是合理答案」 |
| 漏選 | `all_correct`：沒選，但是正確答案 | 薄荷 ink 的虛線外框、`CheckCircle` 線條版 | 「正確答案，你沒有選」 |
| 選錯 | 選了，但不是正確答案 | 珊瑚粉 tint 底、`XCircle` | 「不是正確答案，你選了」 |
| 未選的錯誤選項 | 沒選，也不是正確答案 | 維持 surface 底色 | 「不是正確答案」，加上該選項的回饋說明 |

- 每個選項的 `feedback` 都顯示在選項下方（以 `aria-describedby` 連到選項）；FeedbackPanel 的第一句說明整題結果，例如 `all_correct` 漏選時「你選對了其中兩個，還有一個正確答案沒選到。」（作答後才說數量，不違反「提示不透露數量」）。
- 按「確認答案」後，焦點移到 FeedbackPanel 的標題，不另外用 `aria-live` 重複播報（8.3）；`any_correct` 與 `all_correct` 和單選題的做法相同。
- 選項打散、作答紀錄與錯題本的規則和單選題相同（03）；作答紀錄的 `answer` 是選項 ID 陣列，`any_correct` 只會有一個元素（格式見 06 第 4.2 節）。
- 後台的題目編輯畫面以單選按鈕選擇判分方式，並用同一個 ChoiceGroup 元件（`packages/web-ui`）即時預覽學習端的提示（後台在獨立 origin，見 08）；Excel 範本的「判分方式」下拉欄位見 08。改動 `scoringMode` 或 `correctOptionIds` 屬於答案改版（見 08）。
- 減少動態時，作答後的狀態直接出現，不做逐一亮起的動畫。

### 9.2 連結與按鈕（M3，2026-10-24 到 26）

可點元素只准有下列外觀（從 `@ledgerland/web-ui` 匯入）；頁面的 `className` 只給版面（外距、grid 位置），不得改元件的顏色、底線、高度與圓角。站內 href 一律由 `localePath()` 產生、帶結尾斜線，經 `LinkProvider` 交給 react-router（不整頁重新載入；web-ui 不依賴 react-router）。

| 元件 | 什麼時候用 | 外觀與規則 |
| --- | --- | --- |
| `Button` | 下一步用 primary（一個畫面一顆）；替代動作 secondary；第三層 quiet；破壞性 danger；`back` 只在少數平面情境 | 第 4.6 節的尺寸與底邊；`icon`、`iconEnd` 的大小由尺寸決定；`busy` 轉圈但寬度不變；`pressed` 輸出 `aria-pressed`；`external` 自動加外連箭頭與「（外部網站）」，不加 `target`；連結形式停用時是不可聚焦的 span，旁邊要寫原因；`minWidth="action"` 是列表右側的動作鈕（最小 96px） |
| `IconButton` | 只有圖示（關閉、介紹、HUD 的工具） | 44px 圓形、圖示 22px、沒有底邊；`label` 必填，同時是 `aria-label` 與 `title`；quiet 給面板、橫幅、Toast，chrome 給頁首與 HUD |
| `BackButton`、`TopBar`、`PageHeader` | 返回與頁首 | 頂層五頁用 PageHeader（三欄 grid，手機 56px、600 以上 64px；闖關頁 sticky）；其他頁用 TopBar 加 BackButton，返回目的地固定（02 第 3.6 節） |
| `StatChip` | 頁首的狀態數字（星星、徽章、錯題、圖鑑） | 44px 平面膠囊；`value` 是畫面上的數字，`label` 是完整的可讀名稱；有 href 是連結，沒有是不可聚焦的 span；`dot` 是需要注意時的小紅點 |
| `NavList`、`NavRow`、`NavCard` | 兩個以上的去處用 NavList 加 NavRow；單一大去處或一筆收集物（收藏的題目）用 NavCard | 列 56px（compact 44px）、36px 圖示方塊、標題 17/600、說明 15、右側箭頭；一個 NavList 最多兩種 tone（accent、neutral），需要注意的狀態只改右側的 Badge；每列只有一個可聚焦元素，`aside`（例如收藏卡的移除鈕）在連結外面；`current` 輸出 `aria-current` |
| `Disclosure` | 所有 `<details>`（參考名詞、進階選項、iPhone 步驟、回饋的「其他選項」、地圖清單的章節） | 原生 `<details>`；summary 48px、右側箭頭展開轉 180 度；card 與 plain 兩種；可受控（搜尋命中時強制展開） |
| `MenuButton`、`MenuItem` | 頁首的「更多」選單（地圖 HUD 的 compact 版） | `role="menu"`；方向鍵、Home、End、Esc 關閉並還焦點、Tab 離開時關閉；會開疊加層的項目焦點不回選單按鈕 |
| `Sheet`、`ConfirmSheet` | 所有面板（關卡介紹、名詞卡、地圖疊加層）與確認（覆蓋進度） | 原生 `<dialog>`；頭部是選用的 lead、h2（開啟時的初始焦點）、副標與右上的關閉鈕；腳部不再放「關閉」按鈕，最後一顆是主動作；手機是滿寬的底部面板，768 以上置中 560 寬；關閉後焦點回到 `returnFocusTo` |
| `GlossaryItem`、`GlossaryGrid`、`TermPill` | 名詞圖鑑的收集卡與參考名詞膠囊 | 依格子本身的寬度排欄（每張至少 264px：375 一欄、600 到 1023 兩欄、寬版三欄）；未收進是虛線空位，已收進右上角是金色印章（第一次出現時蓋章一次）；徽記：科目類用要素的淡底與圖示，其他類別用中性底加類別圖示 |
| `TextLink` | 只用在句子裡提到的頁面 | 強調墨色加半透明底線（中文 0.16em、英文 0.24em）；錯誤與危險區塊裡不用（改 Button sm）；漏網的裸 `<a>` 會套到同一個外觀當保底，但 E2E 要求畫面上沒有任何元素套到它 |
| `SearchField`、`.ll-input`、`FieldError` | 搜尋框、文字欄位與錯誤 | 48px；搜尋框有字時右側「清除搜尋」；注音組字中不回呼，父層晚一步回傳的值不蓋掉後來打的字 |
| `ProgressBar` | 進度與收集 | 本身 `aria-hidden`，旁邊一定有文字；填色 `--ll-star-fill` |
| `Segmented`、`Switch` | 單選切換與開關 | Segmented 的選取段是浮起的按鍵、一列放不下時改成等寬格子（不水平捲動）；Switch 的開啟軌道是 `--ll-selected` |

保留的 class（只准元件檔使用，`check:links` 擋手寫）：`ll-btn*`、`ll-iconbtn*`、`ll-backbtn`、`ll-topbar--page`、`ll-topbar--compact`、`ll-pagehead*`、`ll-statchip*`、`ll-link*`、`ll-navlist*`、`ll-navrow*`、`ll-navcard*`、`ll-disclosure*`、`ll-menu*`、`ll-menuitem*`、`ll-termitem*`、`ll-termgrid*`、`ll-termpill*`、`ll-search*`、`ll-progress*`、`ll-hintbar*`。

### 9.3 專用元件（M3）

下列元件不是第 9.2 節的通用元件，但同樣設計過：各有自己的 `ll-` class，滑過、按下、焦點、停用、選取都有規格，至少 44px（行內例外除外），沒有底線，減少動態時不位移。新增專用元件要先加進這張表。

| 元件 | class | 狀態來源 |
| --- | --- | --- |
| Tab bar 分頁（殼層） | `ll-tabbar__link` | 第 6 節；選中的圖示是強調墨色 |
| 地圖節點 `LevelNode` | `ll-node`、`ll-node__disc` | 17 第 3.1 節；按壓與底邊同 Button（`--ll-node-ledge`） |
| 星星籤 | `ll-node__stars` | 節點按鈕的子元素，不單獨可點 |
| 章節牌的章名連結 | `ll-chbanner__link` | 至少 44px、文字 `--ll-text`、結尾 16px 箭頭；滑過時文字換強調墨色、箭頭右移 2px；按下時整張卡換 surface-2 |
| 章末紙籤 | `ll-chend__plaque` | 不可點；有實驗室步驟路由時才放 Button quiet sm「看實驗室步驟」 |
| 地圖頂部統計列 | `MapHud` | StatChip 加 IconButton chrome；compact 用 MenuButton |
| 地圖提示條 `HintBar` | `ll-hintbar` | 44px、info 淡底、右側「詳細」與「關閉」兩顆 IconButton |
| 分段控制 `Segmented` | `ll-seg`、`ll-seg__opt` | 16 第 7 節 |
| 開關 `Switch` | `ll-switch` | 停用是灰底虛線外框 |
| 選項卡（ChoiceGroup、TrueFalse） | 各元件現有 class | 第 9.1 節；點按範圍量 label |
| 分類題卡片與落點 | `ll-classify__card`、`ll-classify__drop` | 第 9.1 節 |
| 選行、選表、影響方向 | 各元件現有 class | 第 9.1 節 |
| 名詞 chip `TermChip` | `ll-chip`（44px）、句中的 `ll-chip--inline` | 句中 chip 是行內例外，沒有底線，用強調墨色的虛線下框表示可點 |
| 註記標籤 `NoteTag`（按鈕形式） | `ll-notetag--btn`、內層 `ll-notetag__pill` | 按鈕本身 44px、透明，膠囊在內層，結尾 14px 資訊圖示 |
| 星星 `Stars`、徽章 `ChapterBadge` | 不可點 | 只是圖形 |

---

## 10. 版面密度與插圖

- 插圖用粉彩的 soft 色、圓潤造型、少量線條，原創繪製；不使用 Apple 或其他品牌的圖片與介面截圖。
- 插圖都是裝飾或輔助，一律有文字說明同樣的資訊；純裝飾的插圖 `alt=""`。
- 卡片之間至少 12px，區段之間至少 24px；小手機上不並排兩個以上的主要按鈕。
- 資訊密集的報表區不加插圖與漸層，背景用 surface 或 surface-2。
- 章節場景與吉祥物（17 第 4、9 節）：原創 SVG，手繪風線條加粉彩填色，只用 16 的 tokens 上色（四個主題自動換色）；題材用會計的比喻，不用糖果或任何遊戲的角色；角色設計與名稱另外保留，不隨授權授出。M3 定案（2026-10-25）：場景是俯視的地景，只用場景 tokens（16 第 11 節），**不用強調色、要素的淡底、`--ll-highlight-ring` 與 `--ll-star`**，不畫虛線、點線、文字、數字、像節點的大圓色塊與動畫（場景裡不能有看起來像路線或可點的東西）；體積改成 gzip 數字：單章 8 KB、14 章與海峽合計 80 KB、共用的 scene-kit 5 KB（`apps/web/perf/urls.json`，原本的「單章 12 KB（gzip 前）」作廢）。
- **寬版頁面**（M3，2026-10-25）：路由的 `handle.layout` 是 `wide` 時，Root 在 `<main>` 寫 `data-layout="wide"`，內容最寬 1040px（`--ll-layout-wide`）；1024 以上另加 rail 的 120px 左內距。目前是首頁、章節頁、名詞圖鑑、我的、徽章、安裝教學、關於系統設計（安裝教學原規格是一般寬度；第 4 輪看圖驗收時大畫面上的示意圖太小、卡片空，改成寬版，圖解卡片內容 720px 以上時步驟並排成方塊）。其他頁一般 720px（1024 以上的內容寬也真的是 720，不扣 rail）；闖關地圖是 `map`，全幅。
- **各頁的桌面欄位**（1024 以上）：首頁 7/12 與 5/12 兩欄（左欄是主卡海報，右欄是章節小地圖、今日複習與捷徑）；章節頁 5/12 與 7/12（左欄頁首與主卡，夠高時 sticky；右欄學習目標、關卡、實驗室與已下架）；我的是左欄玩家卡與「關於」、右欄選單列與收藏；名詞圖鑑是搜尋卡與收集進度卡並排、名詞卡三欄；徽章 375 兩欄、600 三欄、1024 四欄；關於系統設計是本文加右側的段落目錄。名詞卡 600 起兩欄。

---

## 11. 文案語氣指南

這份指南同時是 [08 題庫管理](08-content-admin.md) 內容審稿清單的一部分。

### 11.1 中文

- 稱「你」，口語但用詞精確；會計科目與指標名稱一律用教材用語（見 12），並透過名詞參照語法（`{{term:tm_id}}`，只要純文字時用 `{{term:tm_id|plain}}`，見 05）帶出，不自己換說法。
- 已決定（D13，2026-10-20）：W01 到 W15 全部採用。舊稱（例如股東權益、固定資產）照教材用並加「舊稱」標記；誤植與異體字改成正確寫法（例如「統計」改「總計」、「應付賬款」改「應付帳款」、「周轉率」改「週轉率」、「每張股票面額」改「每股面額」），教材原字一律保留為可搜尋的別名。「短期放貨」不在 W 系列內，主要顯示仍照教材原文，等老師回覆【待確認 T09】。
- 答錯時先肯定學生做對的部分，再說明差在哪裡；不寫「錯！」「答錯了，請重新學習」。
- 不用「很簡單」「顯然」「大家都知道」這類會讓人覺得自己笨的字眼。
- 一句話講一件事；回饋的第一句控制在手機上兩行以內，細節放在「看解說」。
- 驚嘆號節制使用（答對可以一個，不連用）；介面文案不用 emoji，改用圖示。
- **不使用破折號**，補充說明用全形冒號、括號或拆成兩句。
- 金額、百分比一律用佔位符（例如 `{{money:vars.loan}}`、`{{percent:expected.<targetId>.<欄位>}}`，完整語法見 05），不寫死在文字裡。
- 涉及資料保存的說法要精確：寫「降低被清除的機率」，不寫「不會被清除」（見 06 第 4.5 節）。

### 11.2 英文

- 第二人稱（you），plain English，短句；介面標籤用 sentence case（只有第一個字大寫）。
- 會計術語用 IFRS 英文並經由名詞參照帶出（見 12）。已決定（D11，2026-10-20）：拼字全站用英式，與 IFRS 原文一致（例如 amortisation、organisation、analyse、colour），美式拼法只列為搜尋別名；日期格式也跟英式（日、月、年的順序，例如 5 November 2026，格式器設定以 05 為準）。介面字串同樣用英式拼字。
- 英文介面的報表也用教材版面（D11），IFRS 沒有或禁止的列加 NoteTag「Not an IFRS line item」，按下後開啟名詞卡的「Under IFRS」段落（見 05）；切到 IFRS 對照時標示「IFRS 對照，不計分」（英文介面的對應文字放在翻譯檔，見 05）。
- 答錯時先肯定，再說明；不用 "Wrong!"、"Incorrect, try harder"。
- **不使用 em dash 或 en dash**（這是你在需求中明確要求的，英文也一樣），用逗號、冒號、括號或拆句。
- 不用行銷語（"best experience"、"supercharge"）。

### 11.3 範例

| 情境 | 好的寫法 | 要避免的寫法 | 原因 |
| --- | --- | --- | --- |
| 答對（中） | 答對了！現金減少、存貨增加，所以資產總額不變。 | 正確。 | 太冷，沒有說明為什麼對 |
| 答對（英） | Nice work. Cash went down and inventory went up, so total assets stayed the same. | CORRECT!!! You're a genius! | 誇張、連續驚嘆號 |
| 答錯（中） | 你注意到有科目變動，這點沒錯。不過賒購還沒付錢，所以現金其實不變：存貨增加，應付帳款也增加同樣的金額。 | 錯！賒購不影響現金，請重新學習本章。 | 沒有肯定、語氣責備 |
| 答錯（英） | You spotted that something changed, good. A credit purchase hasn't been paid yet, so cash stays the same: inventory goes up, and so does the amount owed to the supplier. | Wrong. Review the chapter. | 沒有說明、語氣責備 |
| N/A 說明（中） | 這個指標現在是 N/A：分母（流動負債）還不存在，所以無法計算。它和 0 不一樣。 | 無法計算。 | 沒有說明原因，也沒點出 N/A 與 0 的差別 |
| N/A 說明（英） | This ratio is N/A for now: there are no current liabilities yet, so there's nothing to divide by. That's different from 0. | Error: division by zero. | 像程式錯誤，不是教學說明 |
| 錯題本是空的（中） | 錯題本目前是空的。答錯的題目會自動收進這裡，方便你之後複習。 | 沒有資料。 | 沒有告訴使用者這裡會放什麼 |
| 更新提示（中） | 有新版本可以使用。你的進度已經存好，按「更新」就會重新載入。 | 偵測到新版本，系統將強制重新整理。 | 「強制」讓人緊張，也不符合實際行為 |
| 更新提示（英） | A new version is ready. Your progress is saved. Tap Update to reload. | New version detected. The app will now force a refresh. | 同上 |
| 離線（中） | 這一頁還沒下載到這台裝置。連上網路後再試一次，已下載的章節現在也能繼續練習。 | 網路錯誤（ERR_FAILED）。 | 技術用語，沒有下一步 |
| 內建瀏覽器（中） | 你正在 LINE 裡開啟。改用 Safari 或 Chrome，進度比較不會消失，也能離線使用。 | 本網站不支援此瀏覽器。 | 不正確（其實能用），也沒有給方法 |
| 內建瀏覽器（英） | You're viewing this inside LINE. Open it in Safari or Chrome so your progress is less likely to be lost and works offline. | This browser is not supported. | 同上 |
| 安裝提示（中） | 把會計樂園加到主畫面，開啟更快，進度也比較不容易被清除。 | 立即安裝 App，享受最佳體驗！ | 行銷語，沒有說明對學生的好處 |
| 備份提醒（中） | 好一陣子沒備份了。花 10 秒匯出一份，換手機也能接著學。 | 警告：資料可能遺失！ | 製造恐慌 |
| 多正解提示，任一即可（中） | 這題有不只一個合理答案，選出任一個即可。 | 本題為多選題。 | 沒說清楚只要選一個；D12 定案的文字 |
| 多正解提示，全部選出（中） | 選出所有正確答案（可複選）。 | 本題有 2 個正確答案，請全部選出。 | 不可透露正確答案的數量（D12） |
| 多正解作答後（中） | 答對了！另一個選項也說得通，兩個都標出來了，看看它們各自的理由。 | 答對了。 | 沒有帶出「也是合理答案」的選項 |
| 多正解漏選（中） | 你選對了其中兩個，還有一個正確答案沒選到。看看標示「正確答案，你沒有選」的那一個。 | 部分正確，得 2/3 分。 | 不給部分分數，也不用分數打擊學習者 |
| 掃描 QR 前的說明（中） | 接下來會請你允許使用相機。相機只用來辨識 QR，不會拍照，也不會上傳。 | 請允許相機權限。 | 沒說明用途，學生會不放心 |
| 不是站內 QR（中） | 這不是 LedgerLand 的課堂 QR。你也可以改輸入老師給的關卡代號。 | 無效的 QR code。 | 沒有下一步 |

（英文範例中的會計術語，實際內容一律用名詞參照語法帶出，以 12 的英文用語為準。N/A 的範例只示範語氣：流動負債為 0 時，流動比率要顯示 N/A 還是「無限大」，教材有兩種說法【待確認 T28】，正式文案依老師的回覆與 04 的指標狀態規則撰寫。更新提示若這次包含題目修正，可再加一句說明，見 06 第 3.3 節。）

---

## 12. 圖示與素材授權

- **採用 Phosphor**（MIT）。它有 thin、light、regular、bold、fill、duotone 六種 weight，React 套件用 `weight` prop 切換；Tab bar 需要「未選取用線條、選取用實心」的成對圖示，Phosphor 的 regular 加 fill 正好符合。
- 需要更多圖示時可補 Tabler Icons（MIT，有 outline 與 filled）。Lucide（ISC，源自 Feather 的圖示另屬 MIT）只有線條風格，不作為主圖示集。
- 依需求只匯入用到的圖示，讓打包工具移除其餘部分。
- 尺寸：20px（行內）、24px（Tab bar、按鈕）、28px（大按鈕）；同一畫面的線條粗細一致。
- **授權**：在 About 頁與 THIRD_PARTY_NOTICES 列出 Phosphor（以及日後加入的其他圖示集）的著作權與 MIT 授權聲明；MIT 與 ISC 都要求保留著作權與許可聲明。
- **不使用 SF Symbols**：依 Apple 開發者論壇引用的授權條款（2023 年摘錄），SF Symbols 只能用於為 Apple 作業系統上的軟體建立介面，而 LedgerLand 是會在 Android、Windows 瀏覽器上執行的開源網站，超出授權範圍；HIG 也禁止把 SF Symbols 或與它容易混淆的圖像用於 App 圖示、logo 或商標。現行版本的授權原文這次沒有直接讀到，但結論不受影響。也不描摹與 SF Symbols 相似的圖形。
- **不使用 Apple 的圖片與介面素材**，包括 iOS 實機截圖（安裝教學改用原創示意圖，見 06 第 2.6 節）。
- App 圖示與 logo 為原創設計，不直接拿圖示庫的圖形當 logo。「LedgerLand 會計樂園」的名稱與標誌另外保留，不隨開源授權授出（D6，見 11）；M8 前查詢名稱是否與既有商標衝突（D9）。
- 不自行託管 SF Pro 或其他 Apple 字型（第 3 節）。

暫定的圖示對照（名稱以 Phosphor 現行版本為準）：

| 用途 | 圖示 |
| --- | --- |
| 首頁、闖關、實驗室、圖鑑、我的（Home、Quest、Lab、Terms、Me） | `House`、`MapTrifold`、`Flask`、`Cards`（備選 `BookOpenText`）、`UserCircle`（與 02 相同；regular 與 fill 兩套都內嵌在殼層） |
| 資產、負債、權益、收入、費用 | `Wallet`、`HandCoins`、`Handshake`、`Coins`、`Receipt` |
| 會計恆等式 | `Scales` |
| 答對、答錯、提示 | `CheckCircle`、`XCircle`、`Lightbulb` |
| 星星、徽章 | `Star`、`Medal` |
| 計時、暫停 | `Timer`、`Pause` |
| 匯出、匯入、分享 | `Export`、`DownloadSimple`、`ShareNetwork` |
| 語言、設定 | `Translate`、`Gear` |
| 指標變得可計算 | `Sparkle` |
| 單選與複選的選取框 | `Circle`、`RadioButton`；`Square`、`CheckSquare` |
| 掃描課堂 QR、輸入關卡代號 | `QrCode`（備選 `Scan`）、`Keyboard` |

M3 補充（2026-10-24 到 25）：Phosphor 只用在殼層的 Tab bar（`apps/web` 內嵌 SVG 原始檔）；`packages/web-ui` 的元件圖示是同樣風格的原創線條（24 格、2px 線、圓頭、`currentColor`、一律 `aria-hidden`，`components/icons.tsx` 與 `map-icons.tsx`），不加依賴、不描摹 SF Symbols、不用品牌圖形（GitHub 連結用 `CodeIcon`）。M3 新增：`CaretRightIcon`、`CaretDownIcon`、`ArrowRightIcon`、`ArrowUpRightIcon`（外部網站）、`PlayIcon`、`RetryIcon`、`InfoIcon`、`LockIcon`、`CheckIcon`、`SearchIcon`、`TrashIcon`、`PlusIcon`、`GearIcon`、`ExportIcon`、`FileIcon`、`DeviceIcon`、`ShieldIcon`、`CompassIcon`、`FlaskIcon`、`CardsIcon`、`HouseIcon`、`BookIcon`、`CodeIcon`、`TranslateIcon`、`TimerIcon`、`PauseIcon`、`MoreIcon`、`HeartIcon`（收藏題目；星星只代表關卡成績）、`PulseIcon`（診斷資訊）、`PaletteIcon`（關於系統設計的「顏色」），名詞類別的 `StatementIcon`、`AccountIcon`、`RatioIcon`、`ConceptIcon`、`ProcessIcon`、`OtherIcon`，以及會計要素的 `WalletIcon`、`IouIcon`、`HandshakeIcon`、`CoinsIcon`、`ReceiptIcon`；`StarIcon`、`BookmarkIcon`、`HeartIcon` 有實心版（切換按鈕已按下時用）。

來源：https://github.com/phosphor-icons/react 、https://github.com/tabler/tabler-icons 、https://developer.apple.com/forums/thread/739523 、https://developer.apple.com/design/human-interface-guidelines/sf-symbols （查證日期 2026-10-20）

---

## 13. 參考來源（查證日期 2026-10-20）

- Apple HIG Materials：https://developer.apple.com/design/human-interface-guidelines/materials
- WCAG 2.2：https://www.w3.org/TR/WCAG22/
- Safari 18、26、26.4、27 release notes：https://developer.apple.com/documentation/safari-release-notes/
- WebKit 原始碼（RenderLayerBacking.cpp、CSSProperties.json、MediaQueryFeatures.cpp、ThemeIOS.mm）：https://github.com/WebKit/WebKit
- WebKit PR #68614 與 bug 245510、175497、298709、301756、301994、317059：https://github.com/WebKit/WebKit/pull/68614 、https://bugs.webkit.org/
- Firefox 原始碼（StaticPrefList.yaml、nsDisplayList.cpp）與 bug 1961378：https://github.com/mozilla-firefox/firefox 、https://bugzilla.mozilla.org/show_bug.cgi?id=1961378
- WPT 結果：https://wpt.fyi/
- Filter Effects 2 與 CSS View Transitions 1：https://drafts.csswg.org/filter-effects-2/ 、https://drafts.csswg.org/css-view-transitions-1/
- MDN browser-compat-data（backdrop-filter、media features、Navigator）：https://github.com/mdn/browser-compat-data
- WebKit standards-positions #145：https://github.com/WebKit/standards-positions/issues/145
- 圖示：https://github.com/phosphor-icons/react 、https://github.com/tabler/tabler-icons 、https://github.com/lucide-icons/lucide

---

## 建議新增的待確認

以下項目目前沒有對應的編號，建議由 PLAN.md 的總表統一編號：

- 使用者決定：捲到圖表或彩色區塊時，是否再加深 Tab bar 底色（本文件「需評估」評估一）。
- 使用者決定：App 內是否另設「減少動態效果」開關（本文件「需評估」評估二）。
- 實機驗證：`:root` 的 `view-transition-name` 設為 none、只替內容區命名時，Tab bar 在轉場中是否維持即時的玻璃效果，以及內容區快照（畫在 `::view-transition` 疊層）是否在轉場期間蓋住 Tab bar（6.5）。
- （已解決）變動值格式：05 已提供 `|sign` 選項，變動標籤的「+12,000」由格式器產生（2.5）。
- 查證：CSS `linear()` 緩動函式與 Web Animations API 的 `linear()` easing 在 iOS 26、27 的支援情況（4.5，已有退路）。
- 實機驗證：PingFang TC、Noto Sans CJK TC、Microsoft JhengHei 搭配 `tabular-nums` 時數字是否等寬（3.2）。
- 實機驗證（D8 的 M0a 項目，registry 沒有對應的 V 編號）：iOS 17 上，寫在殼層的 Tab bar 在切換語言（只改文字與 `href`）、旋轉螢幕、由 Tab bar 改成 rail 之後是否仍有模糊；執行期插入的玻璃元件在 `data-glass-legacy="true"` 時是否確實改為實色（5.2、5.3、6.1）。
- 查證（M0a）：Lightning CSS 與 Autoprefixer 依 browserslist 補 `-webkit-backdrop-filter` 的實際輸出，選定其中一個並寫進 09（5.3）。
- （已決定 2026-10-25，選項 B）莓果與紅酒是否各自有強調色：各自換成和風味同色相的強調色，見 16 第 3.4 節與 14 第 5.2 節。
- （沿用 02）作答時是否進入專注模式：已是 02「需評估」第二項，M3 的設計兩種情況都能套用，不另開。
