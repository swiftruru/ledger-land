# 16 主題：紙質淺色與深色三風味

這份文件是 LedgerLand 主題（色彩）的完整規格，取代 [07 設計系統](07-design-system.md) 第 2.2、2.3 節原本的粉彩色票；07 其餘章節（字級、間距、玻璃三層、Tab bar、無障礙、元件）不變，只在引用顏色的地方改成本文件的 token。已決定（2026-10-21）：淺色是「紙質」（整頁是一張幾乎白、只帶一點暖的紙），深色是同一套強調色配三種底色色相的「三風味」，色彩數值取自一份你購買的商業色票（作者已書面同意使用，見第 9 節）；一套語意 token 四個主題共用，`packages/tokens` 是唯一來源。

## 確定要做

- **一個淺色、三個深色風味**：紙質淺色（`light`）；深色風味 `violet`（底色色相 250）、`berry`（290）、`wine`（350），設定頁顯示名稱「夜空、莓果、紅酒」與 "Night sky、Berry、Red wine"（走 i18n，程式只用代號）。預設跟隨系統，深色預設風味 `violet`（第 7 節）。
- **紙質原則**（第 1、2 節）：頁面與卡片都幾乎是白，沒有純白；墨色帶暖；卡片靠髮絲線與棕色淡影浮起，不靠邊框；淡底（回饋面板、要素標籤、變動標籤）是墨色混入紙色，不是粉彩色塊；主按鈕是赤陶色配紙色文字。
- **三風味原則**（第 3 節）：強調色、狀態色、文字色三個風味共用，只換底色階梯；底色階梯由固定公式推導，卡片、選取底、註解三階錨定來源色票的原值；相鄰層靠亮度差成形，不靠邊框。
- **紫色只在深色**：已決定（2026-10-21）：07「不用紫色」的規則改為只限淺色；深色用紫 `#9580FF` 當填色、亮紫 `#AA99FF` 當強調文字與圖示。
- **會計專用顏色四個主題都有對應**（第 4 節）：五大要素、增減（維持藍黃軸，不用紅綠）、答對答錯、星星、實驗室變動格的外框。
- **對比度門檻寫成測試**（第 6 節）：淺色與三個風味各跑一輪，任何一個值改動都要過同一組門檻；M0b 建立 `packages/tokens` 時一起建立。
- **名稱與素材的界線**：已取得色票作者的書面同意（2026-10-21，第 9 節），條件是專案裡不出現其品牌與產品名稱，連致謝或「靈感來自」這類提及也不要；所以程式、資料、介面文案與所有公開文件都不寫來源的名稱，也不帶入任何主題檔、字型、圖示或桌布，只使用色彩數值。來源名稱與信件保存位置只記在本機專用的 15。

## 需評估

本文件沒有需評估的項目；2026-10-21 由你決定的四件事（淺色 B 案、紫色只限淺色、風味名稱、獨立成本文件）記錄在第 10 節。仍待處理的是第 9 節的待確認與 M0b 的實機驗證。

## 0. 範圍與來源

| 項目 | 內容 |
| --- | --- |
| 做 | 四個主題的基礎色票與語意 token、會計專用顏色的對應、玻璃 Tab bar 在各主題的參數、切換機制與儲存、對比度門檻與測試、要同步修改的文件 |
| 不做 | 字級、間距、圓角、動態（07 第 3、4 節不變）；玻璃三層與閘門（07 第 5 節不變）；Tab bar 結構（07 第 6 節不變）；元件規格（07 第 9 節不變） |
| 參考做法 | 你的另一個專案 nekoserve 的「紙質淺色」與「深色三風味」規格（只讀取、學習做法，不複製它的檔案）；LedgerLand 的 token 名稱、會計顏色與 Tab bar 規則沿用 07 |
| 深色色票來源 | 一份你購買的商業色票的色彩數值：三個風味各三階（卡片、選取底、註解），以及共用的紫、亮紫、粉、亮粉、青、綠、橙、紅、黃與前景色。作者已書面同意用於本專案（第 9 節）；依其要求不寫名稱。沒有的層以第 3.2 節的規則補 |
| 推導與對比度 | WCAG 2.x 相對亮度公式（sRGB）；推導腳本與完整報表（148 組）在本機 `prototypes/.tmp/theme/`（`palette.mjs`、`contrast.md`），M0b 改寫成 `packages/tokens` 的產生與測試腳本 |
| 預覽 | `prototypes/.tmp/theme/shots/` 的五張 375px 截圖（紙質 A、紙質 B、三個風味）；2026-10-21 由你看過後選 B。`palette.json` 與 `palette.mjs` 的淺色強調色已同步為 B 案（2026-10-21） |

## 1. 設計原則

1. **整頁是一張紙，而且是新的紙**（淺色）：頁面 L\* 98、卡片 L\* 99，只帶一點暖，不是米黃（07 原本的杏仁米 `#FBF4EA` 偏黃，作廢）。卡片靠 1px 髮絲線與棕色淡影浮起；`--ll-border` 只用在列與列之間，卡片不用實線邊框。
2. **墨色帶暖但不偏黃**：淺色文字色相約 75、彩度 0.006 到 0.012；深色文字是來源色票的暖白 `#F8F8F2`。
3. **淡底是紙上的墨跡，不是貼紙**：淺色的回饋面板、要素標籤、變動標籤的底色，一律是該色系的 ink 以 12% 疊在卡片色上；深色是該色以 15% 疊在卡片色上。文字用 ink 本色。
4. **強調色只在填色與文字**：淺色主按鈕是赤陶 `#9E4A25` 配紙色文字；選取狀態（膠囊、選項）用紙色底加赤陶色邊與圖示，不用粉彩色塊。原本的蜜桃 `#F49A6C` 降為裝飾色：插圖與實驗室變動格的外框。
5. **深色三風味只換底色**：強調色與狀態色固定，底色階梯用公式換色相。三個風味之間切換時，文字、按鈕、要素顏色都不變，學生不必重新適應。
6. **深色的層次靠亮度，越靠近使用者越亮**：`bg` 最深，卡片次之，`surface-2`（欄位、斑馬紋）再亮，`elevated`（sheet、選單、玻璃）最亮；相鄰兩層 1.2 到 1.35:1。
7. **不只靠顏色**：07 第 2.4、2.5 節的規則不變（要素一律有圖示與文字、增減一律有符號與文字、答對答錯一律有圖示與文字）。
8. **每個值都有對比度門檻**（第 6 節），改值先過測試。

## 2. 紙質淺色（`html[data-theme="light"]`）

### 2.1 基礎色票

| 名稱 | 值 | 用途 |
| --- | --- | --- |
| paper-50 | `#FFFDF9` | 卡片、sheet、玻璃底、`--ll-surface` |
| paper-100 | `#FCF8F0` | 頁面底、manifest 的 `theme_color` 與 `background_color` |
| paper-200 | `#F4F0E7` | 凹陷區、斑馬紋、chip 底、選取膠囊 |
| paper-300 | `#E0DACF` | 髮絲線、表格格線 |
| paper-400 | `#C2BDB4` | 裝飾用的第四層文字、未點亮的星星外框 |
| ink-100 | `#8F8880` | 輸入框外框（對卡片 3.44:1） |
| ink-300 | `#6D6861` | 第三層文字 |
| ink-500 | `#625D56` | 第二層文字 |
| ink-800 | `#292622` | 主要文字 |
| terracotta | `#9E4A25` | 強調色：主按鈕填色、強調文字與圖示、費用要素 |
| peach | `#F49A6C` | 裝飾：插圖、實驗室變動格外框 |
| sky | `#1D5F8C` | 資產、增加、連結、焦點框、一般資訊 |
| mint | `#1F6E52` | 股東權益、答對、完成 |
| ochre | `#7F5A00` | 收入、減少、提醒 |
| coral | `#A8383A` | 負債、答錯、錯誤 |
| star | `#F0C64A` | 星星 |

陰影一律是棕色：`--ll-shadow-1` `0 1px 2px rgb(60 40 20 / 0.06), 0 1px 1px rgb(60 40 20 / 0.04)`；`--ll-shadow-2` `0 4px 12px rgb(60 40 20 / 0.10)`；`--ll-shadow-3` `0 8px 24px rgb(60 40 20 / 0.16), 0 2px 6px rgb(60 40 20 / 0.10)`。卡片另加 `0 0 0 1px rgb(60 40 20 / 0.07)` 的髮絲線。

### 2.2 語意 token（淺色值）

| token | 值 | 說明 |
| --- | --- | --- |
| `--ll-bg` | paper-100 | 頁面、`html` 與 `body` 背景、`theme-color` |
| `--ll-surface` | paper-50 | 卡片 |
| `--ll-surface-2` | paper-200 | 凹陷區、斑馬紋、chip |
| `--ll-elevated` | paper-50 | sheet、選單、玻璃底（淺色與卡片同色） |
| `--ll-border` | paper-300 | 列的分隔線、表格格線 |
| `--ll-border-strong` | ink-100 | 輸入框外框（3:1） |
| `--ll-text`、`--ll-text-2`、`--ll-text-3` | ink-800、ink-500、ink-300 | 文字三層 |
| `--ll-text-4` | paper-400 | 裝飾 |
| `--ll-accent` | terracotta | 主按鈕填色、選取中的單選按鈕 |
| `--ll-accent-contrast` | paper-50 | 主按鈕文字（5.97:1） |
| `--ll-accent-ink` | terracotta | 強調文字、選取中的 Tab 圖示 |
| `--ll-accent-tint` | paper-200 | 選取膠囊、選取中的選項底（文字維持 `--ll-text`） |
| `--ll-accent-pressed` | `#7F3A1C` | 按下壓暗（淺色的按下是壓暗，深色是提亮） |
| `--ll-link`、`--ll-focus` | sky | 連結一律加底線；焦點框 outline 3px |
| `--ll-success-ink`、`--ll-success-tint` | mint、`#E4ECE5` | 答對 |
| `--ll-danger-ink`、`--ll-danger-tint` | coral、`#F5E5E2` | 答錯、錯誤 |
| `--ll-warning-ink`、`--ll-warning-tint` | ochre、`#F0E9DB` | 提醒 |
| `--ll-info-ink`、`--ll-info-tint` | sky、`#E4EAEC` | 一般資訊 |
| `--ll-change-up-ink`、`--ll-change-up-tint` | sky、`#E4EAEC` | 增加 |
| `--ll-change-down-ink`、`--ll-change-down-tint` | ochre、`#F0E9DB` | 減少 |
| `--ll-change-none-ink`、`--ll-change-none-tint` | ink-500、paper-200 | 不變 |
| `--ll-highlight-ring` | peach | 實驗室變動格的 2px 外框 |
| `--ll-star` | star | 點亮的星星；未點亮用 `--ll-border-strong` |
| `--ll-tabbar-solid-bg`、`--ll-tabbar-glass-bg` | paper-50、`rgb(255 253 249 / 0.60)` | Tab bar（第 5 節，Liquid Glass） |
| `--ll-tabbar-hairline` | `rgb(59 47 42 / 0.10)` | |
| `--ll-glass-highlight` | `inset 0 1px 1px rgb(255 255 255 / 0.65), inset 0 0 12px rgb(255 255 255 / 0.25)` | |
| `--ll-tabbar-edge`、`--ll-glass-rim`、`--ll-glass-shadow` | `0 0 0 0.5px rgb(59 47 42 / 0.14)`；`linear-gradient(135deg, rgb(255 255 255 / 0.95), rgb(255 255 255 / 0.35) 22%, rgb(255 255 255 / 0.08) 50%, rgb(255 255 255 / 0.3) 80%, rgb(255 255 255 / 0.7))`；`0 8px 28px rgb(60 40 20 / 0.14), 0 1px 3px rgb(60 40 20 / 0.08)` | Tab bar 底盤的描邊、鏡面描邊與陰影（07 第 6.2 節） |
| `--ll-lens-gloss`、`--ll-lens-rim`、`--ll-lens-lift-shadow`、`--ll-lens-ring` | 光澤 `linear-gradient(180deg, 白 0.62, 白 0.22 55%, 白 0.40 100%)`；描邊與抬起陰影以 `prototypes/m0a/src/styles/tokens.css` 為準（M0b 搬進 `packages/tokens`）；色散環為固定的 conic-gradient，四主題相同 | 選取鏡片 |
| `--ll-ease-lift`、`--ll-dur-lift` | `cubic-bezier(0.34, 1.56, 0.64, 1)`、260ms（減少動態時 0ms） | 鏡片抬起與落定 |

淡底的算法：ink 以 12% 疊在 paper-50 上（例如 mint 12% 疊 `#FFFDF9` 得 `#E4ECE5`）。未採用的 A 案（07 原本的粉彩 tint `#DDF4E8`、`#FFE0DE` 等）保留在本機預覽的 `paperA` 欄作為紀錄：在紙上看起來像貼紙，你 2026-10-21 看過兩案後選 B。

## 3. 深色三風味（`html[data-theme="dark"][data-flavor="violet|berry|wine"]`）

### 3.1 官方三階與共用強調色

| 風味 | 代號 | 底色色相 | 卡片（Background） | 選取底（Selection） | 註解（Comment） |
| --- | --- | --- | --- | --- | --- |
| 夜空 | `violet` | 250 | `#22212C` | `#454158` | `#7970A9` |
| 莓果 | `berry` | 290 | `#2A212C` | `#544158` | `#9F70A9` |
| 紅酒 | `wine` | 350 | `#2C2122` | `#584145` | `#A97079` |

共用強調色：night-purple `#9580FF`、night-purple-bright `#AA99FF`、night-pink `#FF80BF`、night-pink-bright `#FF99CC`、night-cyan `#80FFEA`、night-green `#8AFF80`、night-orange `#FFCA80`、night-red `#FF9580`、night-yellow `#FFFF80`、night-fg `#F8F8F2`。

### 3.2 推導規則（官方沒有的層）

底色一律 HSL 飽和度 15%，只換色相 h：

| 層 | 公式 | violet | berry | wine | 說明 |
| --- | --- | --- | --- | --- | --- |
| `--ll-bg` | HSL(h, 20%, 8%) | `#121018` | `#171018` | `#181012` | 比官方的 DimBlack 再深一階，卡片才浮得起來（1.19 到 1.20:1） |
| `--ll-surface-2` | HSL(h, 15%, 19%) | `#2C2938` | `#352938` | `#38292C` | 欄位、斑馬紋 |
| `--ll-elevated` | HSL(h, 15%, 23%) | `#353243` | `#413243` | `#433235` | sheet、選單、玻璃底；70% 疊在卡片上是髮絲線 |
| `--ll-text-3` | HSL(h, 25%, 64%) | `#948CBA` | `#B38CBA` | `#BA8C94` | 註解色只有 3.6:1，不夠當第三層文字，提亮到 5.1:1 |
| `--ll-text-2` | HSL(h, 20%, 78%) | `#BFBCD2` | `#CEBCD2` | `#D2BCBF` | 第二層文字 |

### 3.3 語意 token（深色值；三個風味不同的只有底色階梯）

| token | violet | berry | wine | 說明 |
| --- | --- | --- | --- | --- |
| `--ll-bg` | `#121018` | `#171018` | `#181012` | 頁面、`theme-color` |
| `--ll-surface` | `#22212C` | `#2A212C` | `#2C2122` | 卡片（官方 Background） |
| `--ll-surface-2` | `#2C2938` | `#352938` | `#38292C` | |
| `--ll-elevated` | `#353243` | `#413243` | `#433235` | |
| `--ll-border` | = elevated | | | 列的分隔線（70% 使用時是髮絲線） |
| `--ll-border-strong` | `#7970A9` | `#9F70A9` | `#A97079` | 輸入框外框、未點亮的星星（官方 Comment，對卡片 3.6 到 4.0:1） |
| `--ll-accent-tint` | `#454158` | `#544158` | `#584145` | 選取膠囊、選取中的選項底（官方 Selection） |
| `--ll-text` | `#F8F8F2` | 同 | 同 | 主要文字（對卡片 14.6 到 14.9:1） |
| `--ll-text-2` | `#BFBCD2` | `#CEBCD2` | `#D2BCBF` | |
| `--ll-text-3` | `#948CBA` | `#B38CBA` | `#BA8C94` | |
| `--ll-text-4` | = border-strong | | | 裝飾 |
| `--ll-accent` | `#9580FF` | 同 | 同 | 主按鈕填色、選取中的單選按鈕、變動格外框 |
| `--ll-accent-contrast` | = bg | | | 主按鈕文字（深色字在紫上 6.1:1） |
| `--ll-accent-ink` | `#AA99FF` | 同 | 同 | 強調文字、選取中的 Tab 圖示 |
| `--ll-accent-pressed` | `#AA99FF` | 同 | 同 | 按下提亮 |
| `--ll-link`、`--ll-focus` | `#80FFEA` | 同 | 同 | |
| `--ll-success-ink` | `#8AFF80` | 同 | 同 | tint = 15% 疊卡片：`#324239`、`#384239`、`#3A4230` |
| `--ll-danger-ink` | `#FF9580` | 同 | 同 | tint：`#433239`、`#4A3239`、`#4C3230` |
| `--ll-warning-ink` | `#FFCA80` | 同 | 同 | tint：`#433A39`、`#4A3A39`、`#4C3A30` |
| `--ll-info-ink` | `#80FFEA` | 同 | 同 | tint：`#304249`、`#374249`、`#394240` |
| `--ll-change-up-ink` | `#80FFEA` | 同 | 同 | tint 同 info |
| `--ll-change-down-ink` | `#FFFF80` | 同 | 同 | tint：`#434239`、`#4A4239`、`#4C4230` |
| `--ll-change-none-ink`、`-tint` | text-2、surface-2 | | | |
| `--ll-highlight-ring` | `#9580FF` | 同 | 同 | |
| `--ll-star` | `#FFFF80` | 同 | 同 | |
| `--ll-tabbar-solid-bg`、`--ll-tabbar-glass-bg` | elevated、`rgb(elevated / 0.5)` | | | 玻璃比底下的內容亮（第 5 節，Liquid Glass） |
| `--ll-tabbar-hairline` | `rgb(255 255 255 / 0.10)` | 同 | 同 | |
| `--ll-glass-highlight` | `inset 0 1px 1px rgb(255 255 255 / 0.14), inset 0 0 12px rgb(255 255 255 / 0.04)` | 同 | 同 | |
| `--ll-tabbar-edge`、`--ll-glass-rim`、`--ll-glass-shadow` | `0 0 0 0.5px rgb(255 255 255 / 0.10)`；`linear-gradient(135deg, 白 0.4, 白 0.12 22%, 白 0.03 50%, 白 0.08 80%, 白 0.22)`；`0 8px 28px rgb(0 0 0 / 0.35), 0 1px 3px rgb(0 0 0 / 0.25)` | 同 | 同 | 底盤的描邊、鏡面描邊與陰影 |
| `--ll-lens-gloss`、`--ll-lens-rim`、`--ll-lens-lift-shadow`、`--ll-lens-ring` | 光澤白 0.06 / 0.02 / 0.04；描邊與抬起陰影以 `prototypes/m0a/src/styles/tokens.css` 為準；色散環同淺色 | 同 | 同 | 選取鏡片 |
| `--ll-shadow-1/2/3` | 黑 0.30 / 0.35 / 0.40 | 同 | 同 | 深色層次靠亮度，陰影只是輔助 |

CSS 的寫法：`html[data-theme="dark"]` 區塊放 `violet` 的全部值，`html[data-theme="dark"][data-flavor="berry"]` 與 `[data-flavor="wine"]` 只覆寫底色階梯（`bg`、`surface`、`surface-2`、`elevated`、`border`、`border-strong`、`accent-tint`、`text-2`、`text-3`、`text-4`、狀態色的 tint、Tab bar 底色）；強調色與狀態色只寫一次，測試確認覆寫區塊沒有碰到它們。

## 4. 會計專用顏色

### 4.1 五大要素（一律搭配圖示與文字，07 第 2.4 節）

| 要素 | 淺色 ink | 淺色 tint | 深色 ink | 深色 tint（violet、berry、wine） |
| --- | --- | --- | --- | --- |
| 資產 | sky `#1D5F8C` | `#E4EAEC` | cyan `#80FFEA` | `#304249`、`#374249`、`#394240` |
| 負債 | coral `#A8383A` | `#F5E5E2` | red `#FF9580` | `#433239`、`#4A3239`、`#4C3230` |
| 股東權益 | mint `#1F6E52` | `#E4ECE5` | green `#8AFF80` | `#324239`、`#384239`、`#3A4230` |
| 收入 | ochre `#7F5A00` | `#F0E9DB` | yellow `#FFFF80` | `#434239`、`#4A4239`、`#4C4230` |
| 費用 | terracotta `#9E4A25` | `#F3E8E0` | pink `#FF80BF` | `#432F42`、`#4A2F42`、`#4C2F3A` |

- 淺色的費用與強調色同色（赤陶），深色的費用與強調色不同色（粉與紫）；兩者都只出現在小型標籤，07 第 2.4 節「色系與回饋色有重疊」的取捨說明不變。
- 深色的收入（黃）與星星同色：星星只出現在結算畫面與關卡卡片，形狀不同。

### 4.2 增加、減少與不變（07 第 2.5 節的藍黃軸）

| 狀態 | 淺色 | 深色 |
| --- | --- | --- |
| 增加 ▲ | sky | cyan |
| 減少 ▼ | ochre | yellow |
| 不變 ＝ | ink-500 於 paper-200 | text-2 於 surface-2 |
| 變得可計算 | mint 加 `Sparkle` 圖示 | green 加 `Sparkle` 圖示 |

兩個主題都避開紅綠，理由同 07 第 2.5 節。

### 4.3 回饋與狀態

答對 mint 或 green；答錯 coral 或 red；提醒 ochre 或 orange；資訊 sky 或 cyan。回饋面板用 tint 當底、ink 當文字與圖示，標題前有 ✓ 或 ✕ 圖示與文字（「答對了！」「再想想」）。

## 5. 玻璃 Tab bar 在各主題的參數

07 第 5、6 節的結構與規則不變，只有顏色依主題：

| 項目 | 淺色 | 深色（依風味） |
| --- | --- | --- |
| 玻璃底 | paper-50 於 0.60（2026-10-22 由 0.55 調高），`backdrop-filter: blur(12px) saturate(180%) contrast(45%) brightness(135%)` | 各風味的 elevated 於 0.5，`backdrop-filter: blur(12px) saturate(160%) contrast(50%) brightness(45%)`（已決定 2026-10-21，Liquid Glass；07 第 6.2 節） |
| 髮絲線 | `rgb(59 47 42 / 0.10)` | `rgb(255 255 255 / 0.10)` |
| 上緣高光（`--ll-glass-highlight`） | `inset 0 1px 1px` 白 0.65 加 `inset 0 0 12px` 白 0.25 | `inset 0 1px 1px` 白 0.14 加 `inset 0 0 12px` 白 0.04 |
| 選取鏡片 | 靜止：半透明灰色果凍膠囊 `rgb(222 216 208 / 0.65)` 加光澤；抬起：透明水滴加鏡面描邊（07 第 6.2 節） | 靜止：`--ll-border-strong` 20% 加 0.02 光澤；抬起同左 |
| 選取圖示 | terracotta（實心版） | 亮紫 `#AA99FF`（實心版） |
| 標籤文字 | 一律 `--ll-text`；選取加粗 | 同左 |
| 最糟背景（M0a 取樣，Liquid Glass） | 標籤最低 7.27:1（純黑背景、鏡片抬起時的未選取標籤）；選取圖示最低 3.59:1（純黑） | 標籤最低 8.00:1（莓果選取標籤壓白底，靜止）、未選取標籤最低 8.79:1；選取圖示壓白底 3.34 到 3.40:1（圖示門檻 3） |

- 已決定（2026-10-21）：Tab 標籤改用主要文字色 `--ll-text`（07 第 6.4 節原本用 text-2），因為紙質的第二層文字在最糟背景下只有 3.99:1。同日依你的要求改成 Liquid Glass：底盤改為 0.55 與 0.5 的低不透明度，靠 `contrast()` 與 `brightness()` 壓住背後內容的亮度範圍來保證對比（07 第 6.2 節）；原本「不透明度 0.86」的做法作廢。選取狀態有鏡片、實心圖示、粗體三種提示。
- 深色鏡片上只有圖示用亮紫，標籤文字維持 `--ll-text`。實測（圖示門檻 3:1）：Liquid Glass 霧面的選取圖示壓白底 3.34 到 3.40；Tier 0 實色（不透明的 accent tint 鏡片）3.83 到 4.05，實色標籤 8.66 到 9.16。
- **通用規則**（M0a 實測後補充，2026-10-21）：任何選取狀態（Tab、分段控制、選項、chip）的文字一律用 `--ll-text`，`--ll-accent-ink` 只用在圖示與非選取狀態的強調文字。原因：深色三風味的亮紫在選取底上只有 3.83 到 4.05:1，當文字會被 Lighthouse 判為不合格。
- Tier 2 折射（只在 Chromium 桌機）：淺色 `url(#ll-refract) blur(3px) saturate(160%) contrast(45%) brightness(135%)`、深色 `url(#ll-refract) blur(3px) saturate(160%) contrast(50%) brightness(45%)`。鏡片本身沒有 backdrop，光澤用 `--ll-lens-gloss`（淺色白 0.62 / 0.22 / 0.40，深色白 0.06 / 0.02 / 0.04）；全站只有底盤一個 backdrop 圖層。
- Tier 0 實色與 `data-glass-legacy` 的退路不變：閘門未改；實色時底盤用不透明的 `--ll-tabbar-solid-bg` 加髮絲線與 shadow-3，鏡片與放大鏡底色用不透明的 `--ll-accent-tint`，沒有描邊環與色散環（M0a 實測：深色選取圖示 4.05、選取標籤 9.16；淺色選取圖示最低 3.83、標籤最低 8.66）；forced-colors 時鏡片隱藏、改用 Highlight 外框，不啟動手勢。iOS 17.0 Simulator 判定 frost 加 legacy，前綴版 `-webkit-backdrop-filter`（含 contrast 與 brightness）正常。
- 量測條件（M0a，2026-10-21）：240 個字形區域的矩陣在 iPhone 17 Simulator（iOS 27、402×874pt、3x、Safari 分頁）用靜態截圖加 glyph mask 量，字形底下的背景由周圍非字形像素補出；最弱的一格（深色選取圖示壓白底）另外在 iOS 18.6、26.4、17.0 Simulator 重量，數字相同；Chromium 另外檢查折射層級的對比與 Lighthouse 無障礙 1.00。原始數據在本機 `prototypes/m0a/results/glass/a2-contrast.json`。

## 6. 對比度門檻與驗證

主要配對（WCAG 相對亮度；完整 148 組在本機 `prototypes/.tmp/theme/contrast.md`，M0b 改由 `packages/tokens` 的測試產生）：

| 配對 | 紙質 | 夜空 | 莓果 | 紅酒 | 門檻 |
| --- | --- | --- | --- | --- | --- |
| text 對 surface | 14.82 | 14.90 | 14.57 | 14.62 | 7 |
| text-2 對 surface | 6.42 | 8.58 | 8.69 | 8.67 | 4.5 |
| text-3 對 surface | 5.44 | 5.08 | 5.45 | 5.39 | 4.5 |
| text-2 對 surface-2（chip） | 5.74 | 5.27 | 5.17 | 5.18 | 4.5 |
| border-strong 對 surface | 3.44 | 3.56 | 3.97 | 3.92 | 3 |
| 主按鈕文字對填色 | 5.97 | 6.12 | 6.06 | 6.07 | 4.5 |
| accent-ink 對 surface | 5.97 | 6.59 | 6.44 | 6.46 | 4.5 |
| text 對選取膠囊 | 12.57 | 9.16 | 8.66 | 8.73 | 4.5 |
| accent-ink 對選取膠囊（圖示） | 5.07 | 4.05 | 3.83 | 3.86 | 3 |
| accent 對 surface-2（選取對未選取，非文字） | 不適用 | 3.17 | 2.99 | 3.02 | 3 |
| link 對 surface | 6.74 | 13.17 | 12.87 | 12.92 | 4.5 |
| focus 對 bg | 6.46 | 15.64 | 15.49 | 15.52 | 3 |
| surface 對 bg（層次） | 1.04 | 1.19 | 1.20 | 1.20 | 紙質靠髮絲線；深色 1.15 到 1.35 |
| success、danger、warning、info 對各自 tint | 5.11、5.22、5.17、5.63 | 8.46、5.62、7.36、8.70 | 8.32、5.46、7.17、8.54 | 8.34、5.46、7.17、8.59 | 4.5 |
| 五大要素 ink 對各自 tint（最低） | 5.04（費用） | 5.27（費用） | 5.12 | 5.12 | 4.5 |
| change-up、change-down 對 surface-2 | 6.02、5.49 | 11.75、13.41 | 11.41、13.02 | 11.44、13.06 | 4.5 |
| Tab 標籤對玻璃（最糟背景，估算） | 8.2 | 5.2 | 5.1 | 5.1 | 4.5 |
| Tab 標籤對玻璃（M0a Simulator 取樣，0.86 版，疊黑 / 疊白） | 12.3 到 12.5 / 14.7 | 12.0 到 12.6 / 8.0 到 9.5 | 同左 | 同左 | 4.5（作廢的做法，保留紀錄） |
| Tab 標籤與圖示對玻璃（Liquid Glass 版，M0a 靜態截圖加 glyph mask 取樣 240 個區域：黑、白、條紋背景，靜止與抬起） | 標籤最低 7.27，選取圖示最低 3.59 | 標籤最低 8.17，選取圖示最低 3.40 | 標籤最低 8.00，選取圖示最低 3.34 | 標籤最低 8.04，選取圖示最低 3.35 | 標籤 4.5、圖示 3（全部達標；加上鏡片邊緣後重量：標籤最低 7.24、圖示最低 3.31，仍達標） |

已知並接受的例外：
- 莓果的「紫對官方 Selection」2.99:1，差 0.01 達 3:1；選取另有實心圖示與粗體，不改官方值。
- 淺色不用蜜桃當選取填色（蜜桃對紙色 chip 只有 1.91:1），所以蜜桃只做裝飾與變動格外框。

**M0b 的測試**（`packages/tokens/test/contrast.test.ts`）：讀 tokens 原始檔，對淺色與三個風味各跑一輪：文字三層的門檻、主按鈕、強調文字、選取膠囊、狀態色與要素色對各自 tint、焦點框、深色相鄰層 1.15 到 1.35:1、深色玻璃底比卡片亮、深色覆寫區塊只含底色階梯、卡片與 Selection 與 Comment 等於官方值、淺色沒有純白與純黑當底色或文字色。另外 Playwright 把 Tab bar 疊在測試背景上取樣（07 第 2.6 節的做法不變）。

## 7. 切換機制與儲存

| 項目 | 做法 |
| --- | --- |
| 外觀偏好 | `ll:theme`（localStorage）：`system`（預設）、`light`、`dark`。裝置偏好，不進 IndexedDB、不隨備份匯入（與 `ll:transparency` 同一類，06 第 4.1 節） |
| 深色風味 | `ll:dark-flavor`：`violet`（預設）、`berry`、`wine`；非法值退回 `violet` |
| 首次繪製前 | boot 腳本（06 第 2.3 節）讀兩個 key，寫入 `html[data-theme]`（`light` 或 `dark`，`system` 依 `prefers-color-scheme` 解析）與 `html[data-flavor]`，並設定 `color-scheme`；`system` 時監聽 `prefers-color-scheme` 的變化即時切換。boot 腳本內容改變，CSP 的 sha256 跟著重算（09 第 11 節） |
| `theme-color` | 四個值：淺色 `#FCF8F0`、夜空 `#121018`、莓果 `#171018`、紅酒 `#181012`。殼層仍放淺深兩個帶 media 的 meta；手動指定淺色或深色時，boot 腳本與設定頁把兩個 meta 的 `content` 都改成目前主題的值（06 第 2.4 節第 1 點），深色依風味選值 |
| manifest | `theme_color` 與 `background_color` 用淺色 `#FCF8F0`（manifest 只有一份，06 第 2.1 節） |
| 設定頁 | 「我的 › 設定 › 外觀」：「外觀」分段控制（跟隨系統、淺色、深色）；目前生效是深色時，下方多一組「深色風味」分段控制（夜空、莓果、紅酒），每段前有該風味卡片色的圓點；「降低透明度」與「折射效果」開關維持 07 第 7.1 節 |
| i18n | `settings.theme.label`（外觀 / Appearance）、`settings.theme.system`（跟隨系統 / Follow system）、`settings.theme.light`（淺色 / Light）、`settings.theme.dark`（深色 / Dark）、`settings.flavor.label`（深色風味 / Dark flavour）、`settings.flavor.violet`（夜空 / Night sky）、`settings.flavor.berry`（莓果 / Berry）、`settings.flavor.wine`（紅酒 / Red wine）；字串在 `apps/web` 的 catalog（設定頁屬於頁面） |
| debug 頁 | 列出 `ll:theme`、`ll:dark-flavor`、解析後的 `data-theme`、`data-flavor`、`data-glass` |
| 圖表與插圖（M4 起） | 圖表色由 `packages/tokens` 產生的 TS 常數依主題與風味取得，元件用一個 hook 監聽 `data-theme` 與 `data-flavor` 的變化重讀；不寫死 hex |

## 8. 要同步修改的文件與里程碑

- 07：第 2.2、2.3 節改成摘要並指向本文件；第 2.1 節的「目前只跟隨系統」改為第 7 節的機制；第 2.4、2.5 節加深色對應；第 2.6 節的估算表改指向本文件第 6 節；第 5.3 節的元件 token 表改為依主題；第 6.4 節的可讀性表改用 `--ll-text`，並改成 Liquid Glass 的 contrast 與 brightness 做法（第 6.2 節）；「確定要做」的粉彩與「不用紫色」兩條改寫。
- 06：第 2.1 節 manifest 色碼、第 2.3 節的 `theme-color` meta 與 boot 腳本說明、第 2.4 節手動切換時改寫 meta、第 4.1 節裝置偏好加 `ll:theme` 與 `ll:dark-flavor`、第 9.3 節 debug 頁。
- 02：設定頁的項目加「外觀」與「深色風味」。
- 09：`packages/tokens` 的產生物多一組風味覆寫區塊；CSP 雜湊重算屬既有流程。
- 10：M0b 建立 `packages/tokens` 時以本文件為準並建立對比度測試；M0a 的試作可以先換成本文件的值在實機確認可讀性（由你決定要不要在 M0a 補做）。
- 11：風險 37「深色色票的授權」已結案；14 第 5.2 節的對應項目已結案。
- 05：第 3.6 節之後加設定頁的主題字串（訊息 ID 與中英文）。

## 9. 待確認

1. **深色色票的授權**：已結案（2026-10-21）。你先依授權條款判斷這是個人非商業專案而選擇沿用原值，隨後寫信詢問，作者團隊當天回信同意在 LedgerLand 使用，不需要署名，只要求專案裡不出現其品牌與產品名稱（含致謝與「靈感來自」）。信件的保存位置記在本機專用的 15。若日後條件改變，改用自行推導的錨定值與強調色（底色階梯的公式不變），本文件第 3.1 節跟著改，重新部署即可。
2. **OLED 實機**：深色 `bg` 與卡片只差 1.19:1，在 OLED 的 iPhone 上是否分得開，M0b 用實機確認；分不開就把 `bg` 的亮度降到 HSL 6%，重算後回寫。
3. **增強對比與強制色彩**：`prefers-contrast: more` 時深色文字改 `#FFFFFF`、淺色文字改 `#000000` 是否足夠，M0b 的 axe 與手動檢查決定。
4. **插圖色票**（M4 前）：實驗室動畫與圖表的深色色票依第 7 節的機制從 tokens 產生，具體對應在 M4a 開工前補進本文件。

## 10. 決定紀錄

| 日期 | 內容 |
| --- | --- |
| 2026-10-21 | 色票作者回信同意使用，公開文件移除其名稱，第 9 節第 1 項結案 |
| 2026-10-21 | 初版。你的決定：淺色採 B 案（紙質混色淡底、赤陶主按鈕、紙色膠囊）；「不用紫色」改為只限淺色；風味名稱「夜空、莓果、紅酒」；主題規格獨立成本文件，07 第 2 節改成摘要。預覽五張截圖與推導腳本在 `prototypes/.tmp/theme/` |
