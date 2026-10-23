# @ledgerland/quiz

判分與遊戲化規則，依 `docs/plan/03-modules.md` 第 2 節與 `docs/plan/04-accounting-core.md` 第 2、12.5、14 節。範圍：各題型作答（`attempts.answer`）的型別與 Zod schema、`scoreQuestion` 與各題型判分（數字題的 N/A 與容許誤差、多正解題的兩種判分、分錄題呼叫核心的 `compareEntries`）、固定種子的選項打散、關卡星星門檻、錯題本的 Leitner 盒子與題目改版規則。純 TypeScript：不讀時間、亂數、`Intl`、DOM 與檔案；日期與種子都由呼叫端給，相同輸入必得相同輸出。正解一律由呼叫端用 `@ledgerland/core` 算出後傳入，本套件不含會計知識；儲存與介面分別在 `packages/progress` 與 `packages/web-ui`。
