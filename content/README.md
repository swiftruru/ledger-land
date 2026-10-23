# content：內容的原始檔

這個資料夾放題目、名詞、章節、交易範本與故事的原始檔（一筆一檔，多語系同一檔），格式以 `packages/content-schema` 的 Zod schema 為唯一依據，對應的 JSON Schema 在 `schemas/`。撰寫規則、ID 規則、改版規則與審稿清單見 `docs/plan/08-content-admin.md`；佔位符文法見 `docs/plan/05-i18n.md` 第 10 節。

M0b 只有少量原創的名詞與章節範例資料；題目、交易範本與故事從 M1 起加入；學習目標與關卡從 M2 起加入。

## 資料夾與檔案形狀（M2）

| 資料夾 | 一檔放什麼 | 檔名 | JSON Schema |
| --- | --- | --- | --- |
| `chapters/` | 一章 | `<chapterId>.json` | `schemas/chapter.schema.json` |
| `objectives/` | 該章全部的學習目標：`{ "chapterId": "ch_xxxxxx", "items": [Objective, ...] }`，每個目標各自帶 `rev`、`status` | `<chapterId>.json` | `schemas/objective.schema.json` |
| `levels/` | 一關 | `<levelId>.json` | `schemas/level.schema.json` |
| `questions/<chapterId>/` | 一題，放在所屬章節的資料夾（路徑不是身分，搬章節時 ID 不變） | `<questionId>.json` | `schemas/question.schema.json` |
| `terms/` | 一個名詞 | `<termId>.json` | `schemas/term.schema.json` |
| `stories/` | 一個故事（含全部步驟） | `<storyId>.json` | `schemas/story.schema.json` |

指令（在 repo 根目錄；先 `source tools/env.sh`）：

- `pnpm content:new <question|level|objective|term|chapter> [--chapter ch_xxxxxx] [--type <題型>] [--order <n>]`：產生不與既有 ID 與 lock 衝突的 ID，建立含必填欄位骨架的草稿檔並印出路徑；`objective` 會加進該章的 `objectives/<chapterId>.json`。ID 一律由工具產生，不接受手打。
- `pnpm content:check`：結構、多語系、引用（章節的 `objectiveIds` 與 `levelIds`、關卡的 `questionIds` 同章、題目的 `objectiveId` 同章、`misconceptionId` 存在於該目標）、佔位符、會計與答案、文字風格（頁碼樣式、寫死數字、字母引用）、關卡題數（已發布的關卡 5 到 8 題計分題加至多 1 題 `judgment`；草稿只提醒）、lock。
- `pnpm content:coverage`：觀念覆蓋表（每個學習目標的預計題數、草稿數、已發布數、題型與難度分布、迷思被練到的次數），印到畫面並寫到 `.local-reports/content/coverage.md`。
- `pnpm content:lock --check` 或 `--write`：比對或更新 `published.lock.json`（名詞、章節、學習目標、關卡、範本、故事、題目）。
- `pnpm content:build`：已發布的內容做成快照（草稿不進快照）。

已發布的項目只能引用已發布的項目：章節列出的目標與關卡、關卡列出的題目、題目對應的目標都要是 `published`，否則 `content:check` 回報錯誤；寫到一半時先別把它們列進已發布的章節或關卡。

## pendingRefs 與仍開放的編號

`pendingRefs` 自 2026-10-23 起是「相關設計決定的編號」（`docs/plan/14-open-questions.md` 的 T 系列已全部決定），不代表懸而未決，計分不受影響。`content:check` 的 `acct.pendingBlocked` 只在範本或學習目標的 `pendingRefs` 列有**仍開放**的編號時才對計分題警告；仍開放的編號維護在 `tools/lib/open-refs.json` 的 `open` 陣列（目前為空）。14 新增一條還沒決定的 T 或 D 時把編號加進去，決定後再移除，不改 `content/` 的資料。

## 快照裡由工具補上的欄位

`pnpm content:build` 的快照除了原始檔的欄位，還有核心算出的 `compiled`（答案、`values`）；`pick_line` 題另帶 `compiled.lines`（該報表交易後的可見列：`id`、依語系展開的 `label`、金額 `value`、五層利益的 `level`、合計列 `total`、群組標題列 `heading`），章節檔另帶 `levels`（已發布關卡的 `id`、`order`、`title`、`objectiveIds`、`questionCount`）。這些都不是原始檔的欄位，不要手寫進 `content/`。

## 授權

- 這裡的原創教學內容（題目、名詞卡與術語說明、故事的敘述文字、交易範本的文字）依「創用 CC 姓名標示 相同方式分享 4.0 國際」授權（CC BY-SA 4.0），全文在 [`../LICENSES/CC-BY-SA-4.0.txt`](../LICENSES/CC-BY-SA-4.0.txt)。
- 故事資料中來自老師的故事情境與金額（M1 起加入 `stories/`）不在 CC 授權範圍內，標示「經陳彥宏老師授權使用」；別人重用前要另外取得老師同意。
- 「LedgerLand 會計樂園」的名稱與標誌不隨開源授權授出，見根目錄的 `NOTICE`。
- 重用原創內容時的署名格式（標題、作者、來源、授權）：

```text
〈名詞卡：資產〉，LedgerLand 會計樂園貢獻者，https://ledgerland.swift.moe/，CC BY-SA 4.0
```

## 原創政策

內容一律原創撰寫，不抄錄老師的教材或任何教科書；內容資料不記錄教材出處或頁碼；科目名稱跟著教材用語。不確定的事標【待確認】並使用 `docs/plan/14-open-questions.md` 的編號。
