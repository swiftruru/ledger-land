# @ledgerland/core

LedgerLand 的會計核心（規格：`docs/plan/04-accounting-core.md`）。純 TypeScript，不碰 DOM、React、Node 專屬 API、`Date`、`Math.random` 與 `Intl`；相同輸入一定得到相同輸出。唯一的會計事實是分錄，科目餘額、三表、指標、勾稽與題目答案都是推導值。

## 模組

| 目錄                                            | 內容                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/money.ts`                                  | 金額（安全整數）與 bigint 有理數、四捨五入（負數遠離 0）                     |
| `src/expr/`                                     | 受控運算式：parser、型別檢查、AST 求值器（沒有 eval）                        |
| `src/accounts/`、`src/policy/`、`src/layout/`   | 科目表、認列政策、版面的型別與查詢                                           |
| `src/templates/`、`src/journal/`、`src/ledger/` | 範本編譯與實例化、分錄驗證、過帳、快照、effects、T 字帳                      |
| `src/story/`                                    | 故事重播、自由實驗覆寫、可輸入範圍                                           |
| `src/statements/`、`src/checks/`、`src/trace/`  | 教材版面三表、直接法、不變式、五步驟檢查、追蹤樹                             |
| `src/ratios/`、`src/entries/`、`src/scenario/`  | 指標登錄檔與狀態、分錄比對、計算型題目的情境求解                             |
| `data/`                                         | 科目表、21 個交易範本、政策、版面、指標登錄檔、effects 片語（程式資料，MIT） |

## 測試

- `pnpm test`：單元、性質（fast-check）與自編數字的黃金測試；`pnpm test:coverage` 的門檻是陳述式與行 90%、分支 85%、函式 90%。
- `pnpm test:local`：只在本機、有 `references/` 時執行，對老師的 Excel 逐格比對；測試程式不含教材數字。
- 判分、星星與錯題本不在這裡（M2 的 `packages/quiz`）。
