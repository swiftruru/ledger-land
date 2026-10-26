// 核心資料與四種題型元件的延後載入（06 第 8.2 節）：分錄、指標計算、交易影響與五步驟題的作答區要用科目表、版面與指標登錄檔，
// 其他題型（選項類、是非、分類、有 compiled.lines 的選列）不用，所以這兩個 chunk 不在作答頁第一波裡，由需要它們的題目來載。
// 維護者 2026-10-26 的要求：點進任何一頁都要直接看到完整的資訊。作答頁整頁要等這一題的作答區齊了才淡入（lib/page-ready.tsx），
// 所以這裡不再等第一次繪製送出才開始載入（以前為了不讓 import 排在 LCP 前面）：等了只會讓整頁更晚出現。
// 回饋期間 LevelSession 以 preloadQuestionModules 預載下一題要的模組；載好之後 coreDataNow、questionTypesNow 同步取得到，
// 換題時作答區在第一次渲染就完整，不會先空一格再補上。
// import 失敗（沒有 Service Worker 時遇到部署、首次造訪時網路中斷）不留著被拒絕的 Promise：下一次呼叫重新 import。

export type CoreData = typeof import('./core-data.ts');
export type QuestionTypesModule = typeof import('./question-types.tsx');

let promise: Promise<CoreData> | null = null;
let coreLoaded: CoreData | null = null;

export function loadCoreData(): Promise<CoreData> {
  promise ??= import('./core-data.ts').then(
    (m) => (coreLoaded = m),
    (e: unknown) => {
      promise = null;
      throw e;
    },
  );
  return promise;
}

/** 已經載好的核心資料（同步）；還沒載好時是 null，呼叫端改等 loadCoreData */
export function coreDataNow(): CoreData | null {
  return coreLoaded;
}

let typesPromise: Promise<QuestionTypesModule> | null = null;
let typesLoaded: QuestionTypesModule | null = null;

/** 分錄、五步驟、指標計算、交易影響的題型元件（question-types.tsx）：和核心資料同一個時間點載入，兩個請求並行，不會一層等一層 */
export function loadQuestionTypes(): Promise<QuestionTypesModule> {
  if (typesPromise === null) {
    void loadCoreData().catch(() => {});
    typesPromise = import('./question-types.tsx').then(
      (m) => (typesLoaded = m),
      (e: unknown) => {
        typesPromise = null;
        throw e;
      },
    );
  }
  return typesPromise;
}

/** 已經載好的題型元件模組（同步）；還沒載好時是 null */
export function questionTypesNow(): QuestionTypesModule | null {
  return typesLoaded;
}

/** 一題的作答區要哪些延後載入的模組：types 是四種題型的元件（連核心資料一起），core 是只要核心資料（沒有 compiled.lines 的選列題、指標判讀題的公式版本） */
export function modulesNeededFor(type: string, hasCompiledLines: boolean): { types: boolean; core: boolean } {
  switch (type) {
    case 'five_step_fill':
    case 'ratio_numeric':
    case 'journal_entry':
    case 'transaction_effect':
      return { types: true, core: true };
    case 'pick_line':
      return { types: false, core: !hasCompiledLines };
    case 'ratio_interpret':
      return { types: false, core: true };
    default:
      return { types: false, core: false };
  }
}

/** 預載一題的作答區要的模組（回饋期間替下一題預載）；失敗不在這裡處理，真的要用時再載一次 */
export function preloadQuestionModules(q: { type: string; compiled?: { lines?: unknown } | undefined }): void {
  const need = modulesNeededFor(q.type, q.compiled?.lines !== undefined);
  if (need.types) void loadQuestionTypes().catch(() => {});
  else if (need.core) void loadCoreData().catch(() => {});
}
