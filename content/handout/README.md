# 講義題庫（期中考苦練）

這個資料夾是陳彥宏老師三份「財務報表」講義的練習題原文，經老師同意（2026-11-04）收錄在網站的期中考苦練區（`/exam/`）。它不是原創內容，不在 CC BY-SA 4.0 的範圍內，標示「經陳彥宏老師授權使用」；重用前要另外取得老師同意。做法與理由見 `docs/plan/08-content-admin.md` 的「講義題庫」一節與 `docs/plan/14-open-questions.md` 第 5.2 節。

| 檔案 | 內容 | 怎麼改 |
| --- | --- | --- |
| `decks.json` | 三份講義的編號、標題、檔名、各段的投影片範圍，以及人工排除（`explanation_issue`、`conflicting_answer`）與請老師確認（`check`）的清單 | 手改；改完重抽 |
| `ids.json` | 投影片（`d2:48`）到題目 ID（`hq_` 加 8 碼）的對照表，ID 永不改變 | 工具維護，不手改 |
| `midterm.json` | 題目本身：題幹（情境、問題）、三個選項、解答字母、解析，逐字照講義；`rev` 與 `answerRev` 由工具依文字與答案的差異遞增 | 工具產生，不手改 |

重抽：pptx 原檔只在本機的 `references/handouts/`（永不 commit），執行 `pnpm handout:extract`（或 `--src <講義資料夾>`）；報告在 `.local-reports/handout/report.md`。`pnpm content:check` 會檢查三個檔案一致，`pnpm content:build` 把收錄的題依講義分檔、不收與請老師確認的題另成審核檔（老師審核頁 `/exam/teacher/` 用）。
