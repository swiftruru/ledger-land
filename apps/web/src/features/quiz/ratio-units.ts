// 指標單位（04 第 12.4 節）與數字輸入單位的對應：純函式，不載入核心資料。作答頁第一次繪製就要用（answers.ts 的 ratioInputUnitOf），
// 所以和 ratio-lazy.ts（公式文字，要等核心資料）分開：放在一起會讓第一波的 chunk（2026-10-26 起是 session 群組，之前是 level-view）連 ratio-lazy、layout-lazy 一起帶進來（06 第 8.2 節）。
// 天數（days）的單位字樣（天、日、day、days）由 @ledgerland/i18n 的 normalizeNumericInput 處理，和 web-ui 的 NumberInput 顯示「系統讀到」用同一個規則。
import { normalizeNumericInput, type NormalizeResult, type NumericUnit } from '@ledgerland/i18n';

export type RatioUnit = 'percent' | 'turnover' | 'days' | 'multiple' | 'currency_per_share' | 'currency';

/** 數字輸入的單位（i18n 的 NumericUnit，含天數） */
export type RatioInputUnit = NumericUnit;

/** 指標單位對應數字輸入的單位（接受的字樣與「系統讀到」的格式） */
export function numericUnitOf(unit: RatioUnit | undefined): RatioInputUnit {
  switch (unit) {
    case 'percent':
      return 'percent';
    case 'turnover':
      return 'turns';
    case 'multiple':
      return 'times';
    case 'days':
      return 'days';
    case 'currency':
    case 'currency_per_share':
      return 'money';
    default:
      return 'plain';
  }
}

/** 依單位正規化作答輸入（天數接受結尾的單位字樣；只有單位字樣、沒有數字時讀不懂） */
export function normalizeRatioInput(raw: string, unit: RatioInputUnit): NormalizeResult {
  return normalizeNumericInput(raw, unit);
}
