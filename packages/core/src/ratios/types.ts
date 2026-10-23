// 指標登錄檔與指標結果的型別（04 第 12.1 節的 RatioResult、第 12.6 節的狀態）。
// 指標的輸入是「線的量測值」：鍵是版面線 ID（例如 is_net_income），值是 Money 或 Rat；三表模組完成後由 measureMap(statements) 產生。
import type { RatioDefinition, RatioVersion, RatioVersionId } from '../data/types.ts';
import type { TypedAst } from '../expr/ast.ts';
import type { Money, Rat } from '../money.ts';
import type { LocalizedMessage } from '../result.ts';

/** 線 ID 對期末值；avg(line.x) 需要期初值時另以 ComputeRatioOptions.opening 提供 */
export type MeasureMap = Readonly<Record<string, Money | Rat>>;

/** 指標輸入值（input.*）：鍵是輸入名稱（例如 tax_rate）；沒有給的鍵用版本的預設值，null 表示缺少 */
export type RatioInputs = Readonly<Record<string, number | null>>;

export type RatioStatus = 'ok' | 'zero' | 'na' | 'not_meaningful';
export const RATIO_STATUSES: readonly RatioStatus[] = ['ok', 'zero', 'na', 'not_meaningful'];

export interface RatioResult {
  /** <id>@<version> */
  readonly ratioRef: string;
  readonly status: RatioStatus;
  /** 精確值；na 時為 null，not_meaningful 只有 excel 版保留數值 */
  readonly exact: { readonly num: string; readonly den: string } | null;
  /** 浮點近似 */
  readonly value: number | null;
  /** 依 displayDecimals 四捨五入（.5 遠離 0）；percent 以百分點表示（0.25 顯示為 25） */
  readonly displayValue: number | null;
  /** 狀態不是 ok 或 zero 時的原因（i18n key：ratio.reason.*） */
  readonly reason: LocalizedMessage | null;
  /** 版本旗標加上求值旗標（single_period_approx），連鎖來源的旗標一併帶上 */
  readonly flags: readonly string[];
  /** 用到的線、輸入與連鎖來源的值，鍵是公式裡的參照寫法（line.is_net_income、input.tax_rate、ratio.ar_turnover.excel） */
  readonly inputs: Readonly<Record<string, number | null>>;
}

/** 編譯後的公式：分數型（numerator 與 denominator）或運算式型（expr，乘積與連鎖） */
export type CompiledRatioFormula =
  | { readonly kind: 'fraction'; readonly numerator: TypedAst; readonly denominator: TypedAst; readonly denominatorSource: string }
  | { readonly kind: 'expr'; readonly expr: TypedAst; readonly source: string };

export interface CompiledRatioVersion {
  readonly ratioRef: string;
  readonly id: string;
  readonly version: RatioVersionId;
  readonly definition: RatioDefinition;
  readonly spec: RatioVersion;
  readonly formula: CompiledRatioFormula;
  /** notMeaningfulWhen 含 base_not_positive 時，notMeaningfulBase 編譯後的運算式 */
  readonly base?: TypedAst;
  /** 公式引用的線 ID、輸入名稱與連鎖來源（ratioRef），依公式出現順序 */
  readonly lineRefs: readonly string[];
  readonly inputRefs: readonly string[];
  readonly ratioRefs: readonly string[];
  /** 版本宣告的輸入預設值 */
  readonly inputDefaults: ReadonlyMap<string, number | null>;
}

export interface RatioRegistry {
  readonly definitions: readonly RatioDefinition[];
  readonly byId: ReadonlyMap<string, RatioDefinition>;
  /** ratioRef 對編譯後的版本；順序是定義順序乘上 RATIO_VERSION_IDS 的順序 */
  readonly versions: ReadonlyMap<string, CompiledRatioVersion>;
}

export interface ComputeRatioOptions {
  /** 線的期初值；提供時 avg(line.x) 取期初與期末平均，沒有就以期末代替並加 single_period_approx 旗標 */
  readonly opening?: MeasureMap;
}
