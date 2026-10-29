# iOS 主畫面網頁 App 啟動交接閃白一格：一整天的追查紀錄與結論

> 給之後要做 Launch Screen（啟動畫面）的任何專案看的。先讀第 1 節的結論與第 2 節的方法論，省下一整天。
> 日期：2026-10-29。裝置：iPhone（iOS 27）、深色模式；比較對象：NekoServe 網站版（同一支手機，不閃）。

## 1. 結論

**症狀**：從主畫面冷啟動網頁 App 時，iOS 的啟動圖（`apple-touch-startup-image`）換到 App 第一格之間，會露出一格白色（深色主題看起來像閃光燈；淺色主題看起來像插圖淡掉又回來）。只有一格（8 到 16 毫秒），肉眼明顯，螢幕錄影錄不到。

**真正的原因**：App 畫出的**第一格裡有 `backdrop-filter` 的圖層**（本案是浮動 Tab bar 的玻璃）。iOS 把系統啟動圖換成 App 畫面時，若第一格含有 backdrop 圖層，會先露出一格視窗底色（白），再把畫面蓋上去；第一格沒有這種圖層時，啟動圖直接接到畫面，完全無縫。

**修法**（不改視覺、不改架構）：主畫面 App 模式的冷啟動先把玻璃層級壓成實色（沒有 backdrop-filter），等啟動交接確定結束後再開回來。本案的做法：閘門腳本在 `html[data-display=app]` 時先寫 `data-glass=solid`，App 內停留畫面離場時（導覽後至少 1.5 秒，而且覆蓋層還蓋著 Tab bar）設 `window.__llGlassReady` 並呼叫 `__llReapplyGlass()`。瀏覽器分頁沒有這個交接，一開始就套用。

**和原因無關、但一路被懷疑過的東西**（全部用實機對照排除）：樣式表是否擋繪製、Service Worker、precache、manifest 的掛法與欄位、`theme-color` meta、`color-scheme`、viewport 的 `interactive-widget`、啟動圖的張數、media 寫法、PNG 本身、App 內停留畫面、預先載入連結、第一格有沒有文字或圖片、load 事件的時機、啟動後有沒有改網址、頁面是淺色還是深色、Cloudflare Workers 或 Pages、HTTP 標頭、網域、WebKit bug 311569。

## 2. 方法論上最重要的四個教訓

1. **從子路徑加入主畫面的網頁 App 一律會閃，和內容無關。** 這一天前十八輪、三十幾個版本全部從 `/x-…/` 或 `/exp-….html` 這種子路徑安裝，所以「全部都閃」什麼都沒證明；連不閃的 NekoServe 放到子路徑（H5）也閃，放回根路徑（H7）就不閃。**比較只能用根路徑安裝**。要測多個變因，就得一個變因一個部署（Cloudflare Workers 的版本預覽網址剛好一個 commit 一個）。
2. **先證明環境無關，再逼近。** 把不閃的那個 App 整個（HTML、資源、Service Worker、manifest、啟動圖）原封不動搬到會閃的網域根路徑（H7）。它不閃，網域、主機、HTTP 標頭就全部出局，剩下的只可能是兩個 App 的差異。然後從會閃的 App 出發，一次只改一項成對方的樣子（R1 到 R13），直到不閃為止。
3. **只有肉眼和 240 格慢動作算數。** 螢幕錄影（60 格、啟動時還會丟格）錄不到單格；iOS Simulator 錄影逐格看完全不重現；Chromium 與 WebKit 的桌面自動化也量不到交接。能量化的是「哪些變因下會閃」，不是「閃了幾毫秒」。
4. **寫下每一輪的變因與結果**，不然到第十輪就會忘了哪些已經排除、哪些實驗其實無效（見第 1 點）。

## 3. 症狀的觀察紀錄

- 深色：啟動圖（夜空色）之後整張白一格，再接 App 畫面。淺色：中間那一格只有底色沒有插圖，看起來像插圖淡掉再回來。
- 冷啟動的定義：先從多工列把 App 滑掉再點圖示。只把 App 叫回前景沒有啟動圖，也沒有這個交接。
- 錄影：iPhone 自己的螢幕錄影錄不到。用另一支手機的 240 格慢動作可以逐格看到那一格。
- 時間點：在「啟動圖換到 App 第一格」的交接，不在 App 自己的淡入之前或之後；所以 App 內做淡入遮不住它。

## 4. 走過的岔路（按時間，每條：假設、怎麼測、結果）

### 4.1 之前兩天就做過的事（本案 PR 46 到 49）
- 啟動圖與 App 內停留畫面同一張圖，至少停 1.5 秒：交接時插圖往下跳 25 點，原因是主畫面 App 的視窗從狀態列底下開始、比螢幕矮（WebKit bug 301994）；在首次繪製前量 `screen.height` 減 `innerHeight` 補回去，對齊修好。
- 以為白一格是「樣式表載完前 WebKit 整頁不畫」：把入口樣式表改成不擋繪製（preload 加 `media="print"`，載完切回 `all`）。第一次繪製從三秒多提早到兩百毫秒內，**但那一格還在**。這是第一個教訓：縮短空白不等於消掉那一格。
- 查到 WebKit bug 311569（深色 PWA 冷啟動閃白，回報者說 manifest 與內嵌背景色都無效），一度結案為平台行為。錯，見下文。

### 4.2 子路徑安裝的實驗（第一到第十八輪，全部無效，但仍值得記錄當時的假設）
用同一個預覽建置、以 `/x-旗標/` 當 start_url 切換變因，或是放靜態頁：
- 沒有停留畫面、樣式表擋繪製、不註冊 Service Worker（第一輪）
- 拿掉全部啟動圖、`theme-color` 兩個都改夜空色、viewport 拿掉 `interactive-widget`（第二輪）
- 第一格放 300 字文字或 64 像素圖片（WebKit 的 first visually non-empty layout 假設，第三輪）
- 啟動圖連結的 media 改成對方寫法、只留深色圖（第四輪）
- 玻璃改實色、不畫 Tab bar、manifest 加 `display_override`、全部一起（第五輪）
- 純靜態頁：沒有 JS 只有外部 CSS；我們完整的 head；再加停留畫面（第六輪）
- 靜態頁換對方的啟動圖、沒有啟動圖、拿掉 CSP 等標頭並改 `no-cache`（第七輪）
- 初始 HTML 就有 manifest 連結（第八輪）
- 對方的 HTML 原封不動搬過來（主題強制深色）、manifest 夜空色 `background_color`（第九輪）
- 同一個靜態頁放到對方的 Cloudflare Pages 分支預覽（主機對照）
- body 一開始空的、1 秒後才放文字；永遠空的（第十輪）
- 靜態頁加最簡單的 Service Worker（第十一輪）
- 用隱藏圖把 load 事件拖後幾百毫秒（第十二輪）
- 對方的 HTML 連同 React、連同真正的 manifest、連同真正的 Service Worker（資源全鏡像到同網域）（第十三到第十五輪）
- 第一格之後用 `replaceState` 改網址（第十六輪）

全部會閃。中間還差點被兩個假象帶走：(a) 第五輪的「玻璃改實色」旗標其實測到了正確方向，但因為是子路徑安裝照樣閃，被當成排除；(b) 對方的主題程式預設淺色，一度以為「不閃」只是淺色頁面看不出白，實機切深色後證明不是。

### 4.3 根路徑的比較（第十七輪起，才是有效的實驗）
| 編號 | 根路徑放什麼 | 結果 |
| --- | --- | --- |
| H6 | 對方整個 App 原版（漏了它的啟動圖，iOS 用素色啟動畫面） | 不閃 |
| H7 | H6 補上它的 80 張啟動圖 | 不閃（證明網域、主機、標頭無關） |
| R1 | 我們的 App，manifest 連結寫在 HTML 裡 | 閃 |
| R2 | R1 再拿掉停留畫面、樣式表擋繪製、啟動圖連結改對方寫法 | 閃 |
| R3 | R2 再拿掉 boot 的 40 個預先載入連結 | 閃 |
| R4 | R3 再把 manifest 欄位改成對方的（`display_override`、`orientation`） | 閃 |
| R5 | R4 再不註冊 Service Worker | 閃 |
| R6 | R5 再把啟動圖整組換成對方的 80 張 | 閃 |
| R7 | R6 再拿掉 inline 樣式與 boot 腳本 | **不閃** |
| R8 | R7 把 inline 樣式放回來（只拿掉 boot） | 不閃（原因在 boot） |
| R10 | 完整 boot，只不改寫 `theme-color` meta | 閃 |
| R11 | boot 的主題段與玻璃段整段不跑 | 不閃 |
| R12 | 主題段照跑、玻璃段不跑 | 不閃（原因在玻璃段） |
| R13 | 玻璃段照跑，但一律判成 solid（Tab bar 沒有 backdrop-filter） | **不閃，定案** |

R1 到 R6 每一輪都是在上一輪之上再改一項（累積），所以 R6 等於把對方看得見的差異全部搬完，剩下的只有 inline 樣式與 boot。對半切兩次就找到了。

## 5. 最終修法

```js
// 閘門腳本（內聯在 index.html，首次繪製前執行）
function apply() {
  root.dataset.glass = root.dataset.display === 'app' && !window.__llGlassReady ? 'solid' : resolveGlass();
}
apply();
window.__llReapplyGlass = apply;
```

```ts
// launch-screen.ts：停留畫面離場時（導覽後至少 1.5 秒、覆蓋層還蓋著 Tab bar）開回玻璃
function enableGlass(): void {
  if (window.__llGlassReady) return;
  window.__llGlassReady = true;
  window.__llReapplyGlass?.();
}
```

驗證：單元測試（假 DOM 跑 boot：瀏覽器模式一開始就是 frost，App 模式先 solid、設好旗標再呼叫才變 frost；launch-screen 離場時呼叫一次）、E2E（App 模式停留畫面還在時 `data-glass=solid`，離場後不是 solid；瀏覽器分頁一開始就不是 solid）、最後是 iPhone 實機從根路徑加入主畫面冷啟動兩次。

## 6. 給新專案的檢查清單（iOS 主畫面網頁 App 的啟動畫面）

1. **第一格不要有 `backdrop-filter`**（玻璃 Tab bar、毛玻璃頁首都算）。冷啟動時先實色，交接結束再開。這是本案花一整天才找到的那一項。
2. 要有 `<meta name="apple-mobile-web-app-capable" content="yes">`，iOS 才會下載 `apple-touch-startup-image`；只靠 manifest 的 `display: standalone` 不夠。
3. 啟動圖和 App 第一格用同一張圖，交接才無縫；App 內停留畫面至少停 1 到 1.5 秒讓人看得到。
4. 主畫面 App 的視窗可能從狀態列底下開始、比螢幕矮（WebKit bug 301994）：覆蓋層用百分比版面時，在首次繪製前量 `screen.height` 減 `innerHeight` 補回去。
5. 啟動圖在「加入主畫面」那一刻依系統外觀固定一張，之後切換外觀不會跟著變；要測深淺色得刪掉重加。
6. 要比較兩個 App 的啟動行為，**都從根路徑加入主畫面**，一個變因一個部署。
7. 看那一格只能靠肉眼或 240 格慢動作；錄影與 Simulator 都不算數。
8. 和這一格無關但同一天踩到的坑：Workbox 的 precache 逐項下載（292 項從台灣約 60 秒，改並行後 13 秒）；`wrangler dev` 的 ETag 不隨檔案改變，`registration.update()` 永遠拿到 304；跨網域 precache 會因 `cache: reload` 觸發 CORS preflight 而失敗；Cloudflare Workers 的資源上傳 API 一天幾十次後會暫時拒絕，等十分鐘再試；建置外掛用正則改 `<link rel="stylesheet">` 時會誤改 boot 裡長得像的字串。
