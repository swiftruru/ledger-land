# @ledgerland/web-ui

網站與後台共用的 React 元件與樣式（07 第 9 節）。元件不判分、不載入內容、不碰路由：判分在 `@ledgerland/quiz`，內容與名詞由呼叫端（`apps/web`）準備好再以 props 傳入；元件只負責互動、無障礙與把狀態以文字加圖示呈現。元件自己的 Lingui 字串在 `src/locales/{locale}/messages.po`（抽取用 `pnpm i18n:extract`），消費端載入時以 `loadWebUiMessages(locale)` 合併。

## 共同約定

- 原生表單元件：選項是 `<input type="radio">` 或 `<input type="checkbox">` 包在 `<label>` 裡，數字是 `<input type="text" inputmode="decimal">`，下拉是 `<select>`；鍵盤、螢幕閱讀器與 Playwright 都直接操作原生輸入。
- 作答中的原始輸入文字由父層保存（切換語言不丟），正規化交給 `@ledgerland/i18n` 的 `normalizeNumericInput`。
- `checked` 為 true 後控制項停用，逐項狀態由父層從 `ScoreResult.detail` 轉成各元件的 `results` 或 `statuses` 傳入；狀態一律「圖示＋文字＋顏色」並以 `aria-describedby` 連到對應的控制項。
- 「確認答案」按鈕由 `QuestionCard` 統一放；各題型元件另有 `isXxxComplete()` 讓父層決定按鈕能不能按。
- 顏色、字級、間距只用 `@ledgerland/tokens` 的 CSS 變數（`src/styles.css`）。

## 題型元件

| 題型                                                                             | 元件                 | 判斷能否送出                           |
| -------------------------------------------------------------------------------- | -------------------- | -------------------------------------- |
| `single_choice`、`pick_statement`、`ratio_interpret`、`multi_choice`、`judgment` | `ChoiceGroup`        | 父層看 `selected`                      |
| `true_false`                                                                     | `TrueFalse`          | 父層看 `value`                         |
| `pick_statement`（選項正好是三張報表時）                                         | `PickStatement`      | 父層看 `value`                         |
| `pick_line`                                                                      | `PickLine`           | 父層看 `selected`                      |
| `classify`                                                                       | `ClassifyBoard`      | `isClassifyComplete(cards, placement)` |
| `transaction_effect`                                                             | `ImpactPicker`       | `isImpactComplete(targets, answers)`   |
| `five_step_fill`                                                                 | `FiveStepFill`       | `isFiveStepComplete(cells, values)`    |
| `ratio_numeric`                                                                  | `RatioNumeric`       | 父層看 `na` 或 `value`                 |
| `ratio_interpret` 上方的小表格                                                   | `RatioTable`         | 無（純顯示）                           |
| `journal_entry`                                                                  | `JournalEntryEditor` | `isJournalComplete(lines)`             |
| 回饋區                                                                           | `FeedbackPanel`      | 無                                     |

### FiveStepFill（五步驟勾稽填格，M3；M4a 的勾稽練習也用）

```ts
interface FiveStepCell {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  unit?: NumericUnit;
  suffix?: ReactNode;
}
interface FiveStepCellResult {
  correct: boolean;
  difference?: string;
  expected?: string;
  feedback?: ReactNode;
}
interface FiveStepFillProps {
  cells: readonly FiveStepCell[];
  values: Readonly<Partial<Record<string, string>>>; // 格子 ID 對原始輸入文字
  onChange: (cellId: string, raw: string) => void;
  checked: boolean;
  results?: Readonly<Partial<Record<string, FiveStepCellResult>>>;
  labelledBy?: string; // 題幹元素的 id
}
```

- 每格一個 `NumberInput`（`inputmode="decimal"`、「±」按鈕）；`label` 由父層組好，含勾稽點與哪一邊（例如「勾稽點③，資產負債表的現金」，`apps/web/src/features/quiz/five-step.ts` 從版面推導）。
- 燈號文字：`correct` 為「相符，差額 0」；有 `difference` 為「差 12,000」（另有 `expected` 時加「正解是 …」）；沒填為「還沒填」。`difference` 與 `expected` 由父層格式化。
- M4a 的勾稽練習可以在 `checked` 為 false 時也傳 `results`，但目前元件只在 `checked` 後顯示燈號；需要即時燈號時再加 `liveResults` 這類開關。

### RatioNumeric（指標計算）

```ts
interface RatioFormula {
  text: ReactNode;
  versionLabel: ReactNode;
  note?: ReactNode;
}
interface RatioNumericResult {
  correct: boolean;
  expected: string;
  feedback?: ReactNode;
}
interface RatioNumericProps {
  id?: string;
  label: ReactNode;
  unit?: NumericUnit;
  suffix?: ReactNode;
  value: string;
  onChange: (raw: string) => void;
  na?: boolean;
  onNaChange?: (na: boolean) => void; // 給了 onNaChange 才顯示「N/A」
  checked: boolean;
  result?: RatioNumericResult;
  formula?: RatioFormula;
  onShowFormula?: () => void;
}
```

- 「N/A」是 `aria-pressed` 的切換按鈕，按下時數字框停用並以 `aria-describedby` 說明原因（`NumberInput` 的行為）。
- 「看公式」是原生 `<details>`，只顯示公式文字與版本名稱、不代入數字；展開時呼叫 `onShowFormula`。公式文字與版本由父層從核心登錄檔取得（`apps/web/src/features/quiz/ratio-lazy.ts`）。

### RatioTable（指標小表格）

```ts
interface RatioTableRow {
  id: string;
  label: ReactNode;
  value?: string;
  status?: 'ok' | 'zero' | 'na' | 'not_meaningful';
  note?: ReactNode;
}
interface RatioTableProps {
  caption: ReactNode;
  rows: readonly RatioTableRow[];
  valueHeader?: ReactNode;
  className?: string;
}
```

真正的 `<table>`：`caption`、`th scope="col"`、每列 `th scope="row"`；`status` 不是 `ok` 時以文字說明（N/A 與 0 分開），有任何 `note` 時才多一欄備註。

### JournalEntryEditor（借貸分錄，M3；M4a 的分錄層可以重用）

```ts
interface JournalAccountOption {
  id: string;
  label: string;
  group: string;
  aliases?: readonly string[];
}
interface JournalAccountGroup {
  id: string;
  label: string;
}
interface JournalLineState {
  key: string;
  account: string;
  side: 'debit' | 'credit';
  raw: string;
}
interface JournalEntryResult {
  lines: Readonly<Partial<Record<string, 'ok' | 'extra' | 'amount'>>>; // 行鍵對狀態
  missing: readonly { side: 'debit' | 'credit'; account: string; amount: string }[];
}
interface JournalEntryEditorProps {
  accounts: readonly JournalAccountOption[];
  groups: readonly JournalAccountGroup[];
  lines: readonly JournalLineState[];
  onChange: (lines: readonly JournalLineState[]) => void;
  checked: boolean;
  result?: JournalEntryResult;
  note?: ReactNode;
  labelledBy?: string;
}
```

- 「新增一行」（`aria-expanded`、`aria-controls`）開啟科目面板：`<input type="search">` 可以用名稱或別名搜尋，科目依 `groups` 分組（`role="group"` 加標題）；選了科目就新增一行並把焦點移到該行的借或貸 `<select>`，Esc 關閉面板並把焦點還給按鈕；新增與刪除以 `aria-live` 播報。
- 分錄是 `<table>`：列標題「第 1 行」、方向 `<select>`、科目、金額 `NumberInput`、刪除按鈕；表尾有借方合計與貸方合計，下方一句「借貸平衡」或「借貸不平衡，差 …」。
- 回饋：`result.lines` 的 `extra` 顯示「多了這一行」、`amount` 顯示「金額不對」、沒列的行是「這一行正確」；`result.missing` 逐行列出「少了這一行：貸方 營業收入 120,000」。從 `@ledgerland/quiz` 的 `JournalEntryDetail` 轉成這個形狀的函式在 `apps/web/src/features/quiz/answers.ts` 的 `journalLineStatuses`。
- `note` 放分錄旁的一句對應說明（教材版面的「本期進貨」「期末存貨」不是分錄科目）。

### FeedbackPanel

`outcome` 為 `correct`、`wrong` 或 `neutral`（取捨題的「解說觀點」）。顯示時焦點移到標題（`tabindex="-1"`），`summary` 以 `aria-describedby` 掛在標題上，所以螢幕閱讀器聚焦標題時會一併讀出摘要（取捨題用它讀出「已顯示三個方案的解說觀點」）。給 `onFavourite` 就顯示「收藏」切換按鈕（`aria-pressed` 由 `favourited` 決定），持久化由父層負責。
