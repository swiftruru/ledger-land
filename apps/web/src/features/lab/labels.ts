// 實驗室的名稱與格式：版面列的名稱（版面 label 依語系，有 termRef 時優先用名詞的主名稱，和作答頁的 layout-lazy 一致）、
// 科目名稱（名詞索引的 accountRef）、指標名稱（ratioRef）、金額差額的文字（▲ 增加 210,000）。純函式加一個 hook。
import { useLingui } from '@lingui/react/macro';
import { useCallback } from 'react';
import { formatMoney, type Locale } from '@ledgerland/i18n';
import { formatRatioValue } from '../quiz/ratio-format.ts';
import type { RatioUnit } from '../quiz/ratio-units.ts';
import type { RatioResult, Statements } from './lab-core.ts';
import { useTerms } from '../quiz/terms.tsx';
import { formulaTextOf, lineLabelOf, type FormulaSpec, type LayoutLike, type LocalizedText } from './line-labels.ts';

export { firstPaintLayout, lineLabelOf, type LayoutLike } from './line-labels.ts';

/** 畫面上的名稱：列、科目、指標 */
export function useLabLabels(layout: LayoutLike) {
  const { locale, terms, labelOf } = useTerms();
  const lineLabel = useCallback((lineId: string) => lineLabelOf(layout, lineId, locale, labelOf), [layout, locale, labelOf]);
  const accountLabel = useCallback(
    (accountId: string, fallback?: LocalizedText) => {
      for (const t of terms.values()) if (t.accountRef === accountId) return t.label;
      return fallback?.[locale] ?? fallback?.['zh-TW'] ?? accountId;
    },
    [terms, locale],
  );
  const ratioLabel = useCallback(
    (ratioId: string, termRef?: string) => {
      if (termRef !== undefined) {
        const byRef = labelOf(termRef);
        if (byRef !== undefined) return byRef;
      }
      // 名詞的 ratioRef 帶版本（ar_turnover@excel），公式裡的參照與指標 ID 不帶；同一個指標的名詞只有一個
      const prefix = `${ratioId}@`;
      for (const t of terms.values()) if (t.ratioRef === ratioId || t.ratioRef?.startsWith(prefix)) return t.label;
      return ratioId;
    },
    [terms, labelOf],
  );
  return { locale, lineLabel, accountLabel, ratioLabel };
}

/** 清單的分隔符依語系：中文「、」，英文「, 」 */
export function joinList(items: readonly string[], locale: Locale): string {
  return items.join(locale === 'en' ? ', ' : '、');
}

export type ChangeDirection = 'up' | 'down' | 'same';

export function directionOf(delta: number): ChangeDirection {
  return delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';
}

export const ARROW: Record<ChangeDirection, string> = { up: '▲', down: '▼', same: '＝' };

/** 「▲ 增加 210,000」「▼ 減少 120,000」「不變」 */
export function useChangeText() {
  const { t } = useLingui();
  const { locale } = useTerms();
  return useCallback(
    (delta: number): string => {
      const d = directionOf(delta);
      const amount = formatMoney(Math.abs(delta), locale);
      if (d === 'up') return t({ id: 'lab.change.up', message: `▲ 增加 ${amount}`, comment: '金額變動的文字；amount 是已格式化的金額' });
      if (d === 'down') return t({ id: 'lab.change.down', message: `▼ 減少 ${amount}`, comment: '金額變動的文字；amount 是已格式化的金額' });
      return t({ id: 'lab.change.same', message: '不變', comment: '金額沒有變動' });
    },
    [t, locale],
  );
}

export function lineAt(st: Statements, lineId: string): number {
  return st.lines.get(lineId)?.value ?? 0;
}

/** 指標公式的文字（formulaTextOf）：指標卡與來源面板共用；放這裡是為了讓來源面板不必靜態引用 lab-stages */
export function useFormulaText(layout: LayoutLike) {
  const { locale, lineLabel, ratioLabel } = useLabLabels(layout);
  return (spec: FormulaSpec): string => formulaTextOf(spec, layout, locale, { line: lineLabel, ratio: (id) => ratioLabel(id) });
}

/** 指標的顯示文字：ok 與 zero 依版本的單位與位數格式化（和作答頁同一個函式）；na 是「N/A」；not_meaningful 有數字就顯示數字（畫面另加警示） */
export function formatRatio(r: RatioResult, unit: RatioUnit | undefined, locale: Locale, decimals: number): string {
  if (r.status === 'na' || r.displayValue === null) return 'N/A';
  return formatRatioValue(r.displayValue, unit, locale, decimals);
}
