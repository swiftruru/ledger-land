# 貢獻指南

感謝你想要參與 LedgerLand 會計樂園。這份文件說明怎麼在本機開發、用語與原創的規則，以及提交流程。規劃與規格都在 `docs/`（入口是 [`docs/PLAN.md`](docs/PLAN.md)）。

## 本機開發

```bash
source tools/env.sh
pnpm install --frozen-lockfile
pnpm content:build
pnpm --filter @ledgerland/web dev
```

- `tools/env.sh` 讓套件、store、快取、Playwright 瀏覽器與 wrangler 的設定都只寫在 repo 內的 `.pnpm-store/` 與 `.cache/`，不做任何全域安裝；Node 由 pnpm 依 `package.json` 的 `devEngines.runtime` 下載到專案內。整個環境可以刪掉 `node_modules/`、`.pnpm-store/`、`.cache/` 後重建。
- 常用指令：`pnpm typecheck`、`pnpm lint`、`pnpm format:check`、`pnpm test`、`pnpm content:check`、`pnpm schemas:check`、`pnpm i18n:check`、`pnpm --filter @ledgerland/web build`、`pnpm e2e`、`pnpm perf`。
- 本機模擬 Cloudflare Workers：`pnpm --filter @ledgerland/web cf:dev`（先建置）。

## 版本規則

- 只用發布滿兩週的套件版本，由 pnpm 的 `minimumReleaseAge: 20160` 自動執行；安全修補需要提前時，寫進 `pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude` 並在 `tools/release-age-exceptions.json` 留下公告編號與到期日。
- TypeScript 精確鎖定 6.0.3：不要執行不帶版本的 `pnpm add typescript`，也不要升到 7.x。
- React Router v8 一律從 `react-router` 與 `react-router/dom` 匯入（沒有 `react-router-dom`）。
- GitHub Actions 的每個 action 都用完整 commit SHA 釘版並附版本註解。

## 文字規則

- 中文一律台灣繁體中文與台灣用語；不用破折號（em dash、en dash）。英文用英式拼字。
- 介面字串一律走 Lingui：元件字串放 `packages/web-ui/src/locales/`，頁面與殼層字串放 `apps/web/src/locales/`；每個 PR 要同時附上英文（CI 檢查 en 不得缺字）。
- 介面字串與內容不寫死金額、百分比或日期，用 `packages/i18n` 的格式化函式或內容的佔位符。

## 原創政策

題目、名詞卡、解說、範例一律原創撰寫，不抄錄老師的教材或任何教科書；內容資料不記錄教材出處或頁碼。內容貢獻的 PR 請勾選「這份內容是我原創撰寫，沒有抄錄老師的教材或其他教科書」。

## 授權

你貢獻的程式碼以本專案的程式碼授權（MIT）釋出，貢獻的教學內容以本專案的內容授權（CC BY-SA 4.0）釋出（進來與出去的授權相同）。目前不要求 DCO 簽署。

## 提交流程

1. 從 `main` 開分支，小步提交；commit 訊息用台灣中文。
2. 送出 PR 後，CI 會跑 lint、型別檢查、測試、內容驗證、i18n 檢查、建置、體積預算、E2E、axe 與 Lighthouse；PR 預覽網址會留言在 PR 上。
3. 全部通過並經審閱後合併；合併到 `main` 會自動部署。
4. 不要 commit `references/`（老師的教材）、任何 AI 工具設定、`docs/plan/01`、`13`、`15`、`.xlsx`、`.pdf` 或 `.DS_Store`；`.gitignore` 只能附加。
