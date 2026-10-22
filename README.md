# LedgerLand 會計樂園

公開、開源、手機優先、中英雙語（中文在根路徑、英文在 `/en/`）的會計入門學習 PWA：用闖關題目與報表實驗室，從一家小店的帳開始認識資產、負債、股東權益與三大財務報表，可離線使用。

- 正式網址：https://ledgerland.swift.moe/ （基礎建設階段，內容陸續加入）
- 規劃文件：[`docs/PLAN.md`](docs/PLAN.md) 與 [`docs/plan/`](docs/plan/)
- 貢獻方式：[`CONTRIBUTING.md`](CONTRIBUTING.md)；資安回報：[`SECURITY.md`](SECURITY.md)

## 目前狀態

M0b 基礎建設：monorepo 骨架、隔離環境、CI 與部署、殼層網站（Tab bar、語言切換、外觀與深色風味、名詞圖鑑的範例資料、作答示範頁、隱私說明與關於頁的草稿）。闖關關卡、報表實驗室與正式內容在之後的里程碑加入；進度見 [`docs/plan/10-milestones.md`](docs/plan/10-milestones.md)。

## 結構

```text
apps/web                學習端 PWA（殼層、路由與頁面、Service Worker 與 manifest、_headers 範本、wrangler 設定）
packages/tokens         設計 token 的唯一來源（紙質淺色與深色三風味、字級、間距、動態、斷點）
packages/i18n           語系登錄檔、網址的語系函式、格式化、作答輸入正規化
packages/content-schema 內容的 Zod schema（Term、Chapter 起），輸出 JSON Schema 到 schemas/
packages/web-ui         網站與後台共用的 React 元件與其 Lingui 字串檔
tools                   建置期工具與檢查腳本
content                 內容的原始檔（一筆一檔，多語系同一檔）
schemas                 由 Zod 產生的 JSON Schema
```

## 本機開發

```bash
source tools/env.sh
pnpm install --frozen-lockfile
pnpm content:build
pnpm --filter @ledgerland/web dev
```

套件、store、快取與測試瀏覽器都只放在 repo 內（`.pnpm-store/`、`.cache/`），不做全域安裝；細節見 `CONTRIBUTING.md`。

## 授權

| 路徑                                                          | 內容                       | 授權                                                                    |
| ------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------- |
| `apps/`、`packages/`、`tools/`、設定檔                        | 程式碼                     | [MIT](LICENSE)                                                          |
| `content/` 的題目、名詞、章節、故事的敘述文字、交易範本的文字 | 原創教學內容               | [CC BY-SA 4.0](LICENSES/CC-BY-SA-4.0.txt)                               |
| `content/stories/` 中來自老師的故事情境與金額（M1 起）        | 老師授權使用的素材         | 經陳彥宏老師授權使用，不在 CC 授權範圍內；重用前要另外取得老師同意      |
| `docs/`                                                       | 規劃與技術文件             | 與教學內容相同（CC BY-SA 4.0）                                          |
| 第三方套件與圖示                                              | React、Lingui、Phosphor 等 | 各自原本的授權，列在 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) |
| 老師的教材                                                    | 投影片、Excel、題目、解答  | 不收錄、不散布，本站的授權不涵蓋                                        |

重用原創內容時的署名格式（標題、作者、來源、授權）：

```text
〈名詞卡：資產〉，LedgerLand 會計樂園貢獻者，https://ledgerland.swift.moe/，CC BY-SA 4.0
```

## 名稱與標誌

「LedgerLand 會計樂園」的名稱、標誌與 App 圖示另外保留，不隨 MIT 與 CC BY-SA 授出。改作或 fork 的版本請改用其他名稱與標誌，不得暗示是 LedgerLand 官方版本。詳見 [`NOTICE`](NOTICE)。
