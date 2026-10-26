# @ledgerland/progress

學習進度的資料模型、儲存介面、備份與合併規則（規格：`docs/plan/06-pwa-responsive.md` 第 4 節、`03-modules.md` 第 2.10 到 2.11 節、`02-site-architecture.md` 第 5.1 到 5.2 節）。純 TypeScript：不碰 DOM、IndexedDB、`Date`、`Math.random`、`Intl` 與 Node 專屬 API；所有「現在」都由呼叫端以 ISO 8601 字串傳入，亂數、SHA-256 與壓縮函式都由呼叫端注入。依賴只有 `@ledgerland/quiz`、`@ledgerland/content-schema` 與 zod。

## 模組

| 檔案                     | 內容                                                                                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/model.ts`           | 常數（`DB_SCHEMA_VERSION`、`ERRORS_MAX`、`META_KEY`、`DATA_STORES`）、ID 規則與產生（`generateDeviceId`、`generateAttemptId`）、`emptySnapshot` 等不需要 zod 的純函式 |
| `src/schemas.ts`         | 各 object store 的 Zod schema 與由它推導的型別（meta、attempts、levelProgress、reviewQueue、unlocks、labState、labSandbox、settings、errors、snapshots）              |
| `src/store.ts`           | 儲存介面 `ProgressStore` 與記憶體實作 `MemoryProgressStore`（測試，以及 IndexedDB 無法開啟時的降級模式）                                                              |
| `src/derive.ts`          | `deriveLevelProgress`（由作答紀錄推導關卡最佳成績，星星用 quiz 的 `starsFor`）、`recomputeWrongCount`、`persistReminderDue`（備份提醒）                               |
| `src/migrations.ts`      | migration 架構：`describeMigration(v)` 給 IndexedDB 實作建立 store 與索引、`transformSnapshot(v, snapshot)` 轉換資料、`migrateSnapshot(snapshot, from, to, { now })`  |
| `src/backup.ts`          | 備份檔（`formatVersion` 1）`buildBackup`、`validateBackup`（4.6 的驗證順序）、文字備份碼 `encodeBackupCode`、`decodeBackupCode`、`MAX_BACKUP_CODE_LENGTH`             |
| `src/merge.ts`           | 合併表的每一列：`mergeData`、`mergeSnapshots`、`replaceSnapshot`（覆蓋）、`importSnapshot`                                                                            |
| `src/session.ts`         | 作答工作階段的純函式（開始、作答、確認、下一題、暫停與繼續、捲動錨點）；對 schema 只 import type                                                                      |
| `src/session-schemas.ts` | 作答工作階段的 Zod schema 與型別（`QuizSession`、`QuestionState`、`TimerState`、`ScrollAnchor`），暫存區還原時驗證用                                                  |
| `src/time.ts`            | ISO 時間的比較與相減（不用 `Date`）、本地日期格式                                                                                                                     |
| `src/util.ts`            | canonical JSON、UTF-8 與 base64url 編解碼、純資料複製                                                                                                                 |

## runtime 與 schema 的邊界（06 第 8.2 節、14 第 5.2 節）

儲存 runtime（`model`、`store`、`derive`、`merge`、`migrations`、`time`、`util`、`result`）與作答工作階段的純函式（`session`）在執行期不載入 zod：它們對 `schemas.ts`、`session-schemas.ts` 只做 `import type`，`model.ts` 也不從 `@ledgerland/content-schema` 載入值（Crockford 字母表另抄一份，測試比對一致）。只有 `schemas.ts`、`backup.ts`（備份匯入驗證）與 `session-schemas.ts`（作答工作階段暫存的驗證）需要 zod。`test/boundaries.test.ts` 直接檢查原始碼的 import，改動這幾個檔案時要維持這條線，apps/web 的進度 chunk 才不會把 zod 連進地圖與作答頁。

## 給 IndexedDB 實作者（apps/web）

- 實作 `ProgressStore` 的每個方法；回傳的物件要是複本。`listDueReviews(today)` 的 `today` 是本地日期 `YYYY-MM-DD`，可直接用 quiz 的 `dueToday`。
- `openDB` 的 `upgrade` 回呼：`for (v = old + 1; v <= CURRENT; v++)` 依 `describeMigration(v)` 建 store 與索引；`transformsData` 為 true 的版本先把各 store 讀成 `RawSnapshot`、寫一筆 `snapshots`、呼叫 `transformSnapshot(v, snapshot)` 再寫回。`storesAtVersion(v)` 可用來比對結構。
- `exportAll()` 的結果交給 `buildBackup(snapshot, info, sha256)`；`sha256` 用 WebCrypto 的 `crypto.subtle.digest('SHA-256', bytes)`，回傳 `Uint8Array`。備份碼的 `deflate`、`inflate` 用 `CompressionStream('deflate-raw')` 與 `DecompressionStream('deflate-raw')`。
- 匯入：`decodeBackupCode`（備份碼）或讀檔文字，交給 `validateBackup(text, { currentSchemaVersion: DB_SCHEMA_VERSION, sha256, now })`，顯示 `preview` 後再 `importAll(result.data, { mode, settings, importedAt, source })`。
- 收藏（settings 的 `FAVOURITES_SETTING_KEY`）是學習資料（`LEARNING_SETTING_KEYS`）：`settings` 選項只管語言、計時等偏好；收藏在合併模式取兩邊的聯集（本機順序在前），覆蓋模式取備份的清單（備份沒有就清掉）。`preview.favourites` 是收藏的題目數，`preview.hasSettings` 只算偏好。不改資料庫結構，所以沒有新的 migration，舊版備份照樣能匯入。
- `buildBackup` 會把作答答案與設定值裡的 `NaN`、`Infinity` 寫成 `null`（`finiteJson`），舊資料裡有壞掉的數字也能匯出。
- 錯誤紀錄的環狀 50 筆（`ERRORS_MAX`）由實作負責。

## 測試

`pnpm test`：單元（每一條合併規則、覆蓋模式、備份 round-trip、checksum、版本較新拒絕、較舊 migration、備份碼、migration 可重複執行、關卡成績與 quiz 星星一致、備份提醒三種情境、作答工作階段的狀態轉移）與性質測試（attempts 與 unlocks 的合併可交換、整體合併冪等）。測試資料全部自編。
