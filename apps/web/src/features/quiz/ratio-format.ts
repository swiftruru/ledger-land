// 指標數值的顯示（05 第 10 節的格式化函式）：依指標單位把快照的 displayValue 或判分的 expectedValue 格式化成字串。純函式，不碰 React。
import { formatMoney, formatNumber, formatPercent, formatUnit, type Locale } from '@ledgerland/i18n';
import type { RatioUnit } from './ratio-units.ts';

/** value 以作答單位計（percent 是百分點，例如 5.66）；digits 是顯示位數 */
export function formatRatioValue(value: number, unit: RatioUnit | undefined, locale: Locale, digits?: number): string {
  const opts = digits === undefined ? {} : { digits };
  switch (unit) {
    case 'percent':
      return formatPercent(value / 100, locale, opts);
    case 'turnover':
      return formatUnit(value, locale, 'turns', opts);
    case 'multiple':
      return formatUnit(value, locale, 'times', opts);
    case 'days':
      return formatUnit(value, locale, 'day', opts);
    case 'currency':
    case 'currency_per_share':
      return formatMoney(value, locale);
    default:
      return formatNumber(value, locale, opts);
  }
}

/** 快照 compiled.ratio 的 displayValue 已依 displayDecimals 四捨五入，位數由小數部分決定 */
export function digitsOf(value: number): number {
  const s = String(value);
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}
