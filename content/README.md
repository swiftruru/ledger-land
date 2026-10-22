# content：內容的原始檔

這個資料夾放題目、名詞、章節、交易範本與故事的原始檔（一筆一檔，多語系同一檔），格式以 `packages/content-schema` 的 Zod schema 為唯一依據，對應的 JSON Schema 在 `schemas/`。撰寫規則、ID 規則、改版規則與審稿清單見 `docs/plan/08-content-admin.md`；佔位符文法見 `docs/plan/05-i18n.md` 第 10 節。

M0b 只有少量原創的名詞與章節範例資料；題目、交易範本與故事從 M1 起加入。

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
