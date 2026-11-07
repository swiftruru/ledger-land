// 預測（03 第 3.6 節）：目標、方向判定與揭曉，純函式。畫面固定提供現金與五層利益六個目標，步驟資料的 predictTargets 再加（02、03）。
// 目標要是畫面上真的有的列（targetsOnLayout）：ifrs@1 版面沒有經常利益、遞延的設立費也不顯示，這些目標在 IFRS 對照時不出現、不揭曉、不算成績（03 第 3.13 節）。
// 方向看數字本身的差額正負，不因列名的 (+)(-) 再轉號；指標目標有六個選項（up、down、unchanged、becomes_computable、becomes_na、stays_na），
// 0 是數字（從 0 變成數字是上升，不是變得可以計算）；比較前先依顯示位數四捨五入，四捨五入後相同就是「幾乎不變」，不變與實際方向都算對。
import type { StoryPredictTarget } from '../../lib/content.ts';
import type { LayoutLike } from './line-labels.ts';

export type LineChoice = 'up' | 'down' | 'unchanged';
export type RatioChoice = LineChoice | 'becomes_computable' | 'becomes_na' | 'stays_na';
export type PredictChoice = RatioChoice;

/** 畫面固定的六個目標：現金與五層利益（03 第 3.3 節階段 2） */
export const DEFAULT_LINE_TARGETS: readonly { id: string; line: string }[] = [
  { id: 'cash', line: 'bs_cash' },
  { id: 'l1', line: 'is_gross_profit' },
  { id: 'l2', line: 'is_operating_income' },
  { id: 'l3', line: 'is_ordinary_income' },
  { id: 'l4', line: 'is_pretax_income' },
  { id: 'l5', line: 'is_net_income' },
];

export type PredictTarget =
  | { readonly id: string; readonly kind: 'line'; readonly line: string }
  | { readonly id: string; readonly kind: 'account'; readonly account: string }
  | { readonly id: string; readonly kind: 'ratio'; readonly ratioRef: string };

/** 這一步的全部預測目標：固定六個加步驟資料的 predictTargets（只收方向題的 line、account、ratio；金額與勾稽目標實驗室不出） */
export function predictTargetsOf(extra: readonly StoryPredictTarget[] | undefined): PredictTarget[] {
  const out: PredictTarget[] = DEFAULT_LINE_TARGETS.map((t) => ({ id: t.id, kind: 'line', line: t.line }));
  const seen = new Set(out.map((t) => `line:${t.kind === 'line' ? t.line : ''}`));
  for (const t of extra ?? []) {
    if (t.measure !== 'direction') continue;
    if (t.kind === 'line') {
      if (seen.has(`line:${t.line}`)) continue;
      seen.add(`line:${t.line}`);
      out.push({ id: `x-${t.id}`, kind: 'line', line: t.line });
    } else if (t.kind === 'account') out.push({ id: `x-${t.id}`, kind: 'account', account: t.account });
    else if (t.kind === 'ratio') out.push({ id: `x-${t.id}`, kind: 'ratio', ratioRef: t.ratioRef });
  }
  return out;
}

/**
 * 這個版面看得到的目標：線目標要在版面上、而且不是不顯示的計算列；科目與指標目標不受版面影響。
 * 只看版面本身，不看這一步的金額（`when_nonzero` 的列金額是 0 時也不顯示，依金額篩選等於先告訴使用者答案）。
 */
export function targetsOnLayout(targets: readonly PredictTarget[], layout: LayoutLike): PredictTarget[] {
  const lines = new Map(Object.values(layout.statements).flatMap((rows) => rows.map((r) => [r.id, r] as const)));
  return targets.filter((t) => {
    if (t.kind !== 'line') return true;
    const line = lines.get(t.line);
    return line !== undefined && line.hidden !== true;
  });
}

/**
 * 揭曉與成績要算的目標：畫面上有、而且這份預測真的猜過。換口徑之後兩邊的目標不同：教材記下的預測在 IFRS 對照時少了經常利益，
 * IFRS 對照記下的預測回到教材時，沒猜過的經常利益不算錯，也不算進總數。
 */
export function answeredTargets(targets: readonly PredictTarget[], record: PredictionRecord): PredictTarget[] {
  return targets.filter((t) => record[t.id] !== undefined);
}

/** 記下預測時只留畫面上這些目標的答案：另一套口徑留下的答案不跟著這次的紀錄存 */
export function recordOnTargets(targets: readonly PredictTarget[], record: PredictionRecord): PredictionRecord {
  return Object.fromEntries(targets.flatMap((t) => (record[t.id] === undefined ? [] : [[t.id, record[t.id]!] as const])));
}

/** 金額或餘額的方向 */
export function lineDirection(before: number, after: number): LineChoice {
  if (after > before) return 'up';
  if (after < before) return 'down';
  return 'unchanged';
}

export interface RatioPoint {
  /** 算得出數字（ok 或 zero）時是依顯示位數四捨五入後的值；N/A 是 null */
  readonly display: number | null;
}

/** 指標的六選項正解（03 第 3.6 節的表）；精確值有變但顯示位數相同時是「幾乎不變」，回傳 unchanged 並標 nearly */
export function ratioDirection(before: RatioPoint, after: RatioPoint): { readonly answer: RatioChoice; readonly nearly: boolean } {
  if (before.display === null && after.display === null) return { answer: 'stays_na', nearly: false };
  if (before.display === null) return { answer: 'becomes_computable', nearly: false };
  if (after.display === null) return { answer: 'becomes_na', nearly: false };
  if (after.display > before.display) return { answer: 'up', nearly: false };
  if (after.display < before.display) return { answer: 'down', nearly: false };
  return { answer: 'unchanged', nearly: false };
}

/** 揭曉：方向題選了正解就對；「幾乎不變」時不變與實際方向都算對 */
export function isPredictionCorrect(chosen: PredictChoice | undefined, answer: PredictChoice, nearly = false, exactDirection?: LineChoice): boolean {
  if (chosen === undefined) return false;
  if (chosen === answer) return true;
  return nearly && exactDirection !== undefined && chosen === exactDirection;
}

export type PredictionRecord = Readonly<Record<string, PredictChoice>>;

/** 一步的預測成績：猜對幾個、總共幾個（記下預測時算好存進進度，故事頁與「我的」不必重播核心） */
export interface PredictScore {
  readonly right: number;
  readonly total: number;
}
