# 講義題庫（期中考苦練）

這個資料夾是陳彥宏老師「財務報表」講義的練習題原文，經老師同意（2026-11-04）收錄在網站的期中考苦練區（`/exam/`）。它不是原創內容，不在 CC BY-SA 4.0 的範圍內，標示「經陳彥宏老師授權使用」；重用前要另外取得老師同意。做法與理由見 `docs/plan/08-content-admin.md` 的「講義題庫」一節與 `docs/plan/14-open-questions.md` 第 5.2 節。

| 檔案 | 內容 | 怎麼改 |
| --- | --- | --- |
| `decks.json` | 講義的編號、標題、檔名與來源（`source` 省略是 pptx，`csv` 是老師在 iClass 用的 CSV），各段（pptx 講義有投影片範圍，CSV 講義沒有，題目依「類別」欄對上段的 `title`），以及人工排除（`explanation_issue`、`conflicting_answer`）與請老師確認（`check`）的清單（只能指到 pptx 講義） | 手改；改完重抽或重新匯入 |
| `ids.json` | 題目 ID（`hq_` 加 8 碼）的對照表：pptx 講義的鍵是投影片（`d2:48`），CSV 講義的鍵是題目文字的雜湊（`d4:k3f9a1c2b7d4e`）；ID 永不改變 | 工具維護，不手改 |
| `midterm.json` | 題目本身：題幹（情境、問題）、選項（講義的練習題三個，CSV 的題 2 到 5 個）、解答字母、解析，逐字照原文；`rev` 與 `answerRev` 由工具依文字與答案的差異遞增 | 工具產生，不手改 |
| `formula-links.json` | 會計公式（`content/formulas/`）的講義對照（2026-11-07）：每條公式在講義裡說明的投影片（公式頁的「講義出處」）與相關的講義題，分三種關係（`formula` 考公式的組成或關係、`numeric` 情境有數字可以驗算、`concept` 只考概念）。用 `deck` 與 `slide` 寫，建置時換成 `hq_` ID；指到不收錄的題或 CSV 講義會被 `content:check` 擋下。公式的原創說明不得寫頁碼，出處只能寫在這裡 | 手改；改完跑 `pnpm content:check` |

重抽 pptx 講義：pptx 原檔只在本機的 `references/handouts/`（永不 commit），執行 `pnpm handout:extract`（或 `--src <講義資料夾>`）；報告在 `.local-reports/handout/report.md`。CSV 講義的題原樣保留。

匯入 CSV 講義（2026-11-08）：老師給的 CSV 是 iClass（ee-class 3.0）「線上測驗匯入」第 4 版格式；先在 `decks.json` 加一份 `source: "csv"` 的講義，CSV 放在同一個講義資料夾，執行 `pnpm handout:import --src <講義資料夾>`（`--dry-run` 只看報告不寫檔）。只收是非與單選，其他題型略過並列在報告；任何一列有錯就整個不寫，錯誤表格另存 `.local-reports/handout/import-report.json`。pptx 講義的題原樣保留。

`pnpm content:check` 會檢查三個檔案一致，`pnpm content:build` 把收錄的題依講義分檔、不收與請老師確認的題另成審核檔（老師審核頁 `/exam/teacher/` 用）。
