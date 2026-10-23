// 帳本狀態、過帳結果、effects 與 T 字帳的型別（04 第 6.1、6.4、6.5 節）。
import type { Chart, Element, LocalizedText } from '../accounts/types.ts';
import type { JournalEntry } from '../journal/types.ts';
import type { Layout } from '../layout/types.ts';
import type { Money } from '../money.ts';
import type { PolicyDefinition } from '../policy/types.ts';
import type { CoreError } from '../result.ts';
import type { CompiledTemplate, DerivedValue } from '../templates/types.ts';

/** 以「借方減貸方」儲存的帶號整數 */
export type Balances = Readonly<Record<string, Money>>;

/** 不可變的帳本狀態；每次過帳回傳新的物件，balances 與 steps 共用未變動的部分 */
export interface LedgerState {
  readonly chart: Chart;
  /** 期初餘額（借方減貸方），預設全部為 0 */
  readonly opening: Balances;
  /** 科目表每個科目都有鍵，借方減貸方 */
  readonly balances: Balances;
  /** 每個科目累計的借方合計（含正的期初借方餘額），給 cost() 使用 */
  readonly costs: Readonly<Record<string, Money>>;
  readonly steps: readonly PostedStep[];
}

export type EffectDirection = 'increase' | 'decrease' | 'unchanged';

export interface Effect {
  readonly account: string;
  readonly element: Element;
  /** 正常餘額表示的變動 */
  readonly delta: Money;
  /** delta 的絕對值 */
  readonly amount: Money;
  readonly direction: EffectDirection;
  /** 這一步影響該科目的分錄行，依分錄順序 */
  readonly lineRefs: readonly string[];
  /** 片語樣板代入名詞卡 ID 後的文字；{{money:amount}} 留給 UI 以 amount 格式化 */
  readonly text: LocalizedText;
}

/** 片語樣板：{{term:account}} 由核心換成科目的名詞卡 ID，{{money:amount}} 由 UI 以 effect.amount 格式化 */
export interface EffectPhrases {
  readonly increase: LocalizedText;
  readonly decrease: LocalizedText;
  readonly unchanged: LocalizedText;
}

export interface PostedStep {
  readonly stepId: string;
  /** 每個事件一筆，已移除金額為 0 的行；整個事件無影響時 lines 為空 */
  readonly entries: readonly JournalEntry[];
  readonly removedZeroLines: readonly string[];
  readonly balancesBefore: Balances;
  readonly balancesAfter: Balances;
  /** 只含有變動的科目，借方減貸方 */
  readonly delta: Balances;
  readonly effects: readonly Effect[];
  /** 整步所有行都是 0 */
  readonly noEffect: boolean;
  /** 'e1.price'、'e1.costOfAllInventory'：參數與推導值，給交易卡與題目佔位符 */
  readonly derivedValues: Readonly<Record<string, DerivedValue>>;
}

/** postStep 能處理的步驟形狀；content-schema 的 StoryStep 與 scenario 的事件清單都符合 */
export interface PostableEvent {
  readonly id: string;
  readonly template: string;
  readonly params: Readonly<Record<string, number>>;
}
export interface PostableStep {
  readonly id: string;
  readonly events: readonly PostableEvent[];
}

/** 核心的執行環境：科目表、已編譯範本、政策、版面與 effects 片語樣板 */
export interface CoreContext {
  readonly chart: Chart;
  readonly templates: ReadonlyMap<string, CompiledTemplate>;
  readonly policy: PolicyDefinition;
  readonly layout: Layout;
  readonly effectPhrases: EffectPhrases;
  /** 實驗啟用的延伸科目（04 第 4.5 節） */
  readonly enabledExtensions?: readonly string[];
}

/** 某一步某個事件的錯誤：核心錯誤加上位置；故事重播時另附 edited 與 allowedRange */
export interface StepError extends CoreError {
  readonly at: { readonly stepId: string; readonly eventId: string };
}

export interface TAccountLine {
  readonly stepId: string;
  readonly lineRef: string;
  readonly amount: Money;
}

export interface TAccount {
  readonly account: string;
  /** 帳本起點的期初餘額，正常餘額表示 */
  readonly opening: Money;
  readonly debits: readonly TAccountLine[];
  readonly credits: readonly TAccountLine[];
  /** 等於 upToStep 的 balancesAfter 換算成正常餘額表示 */
  readonly closing: Money;
  /** 這一步新增的 lineRef */
  readonly highlight: readonly string[];
}

/** 已過帳的一串步驟與最後狀態；故事重播與情境求解都產生這個形狀 */
export interface PostedRun {
  readonly steps: readonly PostedStep[];
  readonly finalState: LedgerState;
}
