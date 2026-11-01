// 列名的純函式（labels.ts 的 hook 用它，單元測試也直接用）：核心的版面（label 是 LocalizedText）與核心載入前由故事快照 firstPaint.lines
// 做成的版面（label 已依語系攤平成字串，V24）都走同一個 lineLabelOf；有 termRef 且名詞索引有那個名詞時優先用名詞的名稱。不 import 任何 React 或 Lingui。
import type { Locale } from '@ledgerland/i18n';

export type LocalizedText = { readonly 'zh-TW': string; readonly en: string };
/** 核心的版面，或核心載入前由故事快照的 firstPaint.lines 做成的版面（label 已依語系攤平成字串） */
export type LayoutLike = { readonly statements: Readonly<Record<string, readonly { id: string; label: LocalizedText | string; termRef?: string | null }[]>> };

export function lineLabelOf(layout: LayoutLike, lineId: string, locale: Locale, labelOf: (termId: string) => string | undefined): string {
  for (const lines of Object.values(layout.statements)) {
    const line = lines.find((l) => l.id === lineId);
    if (line)
      return (line.termRef ? labelOf(line.termRef) : undefined) ?? (typeof line.label === 'string' ? line.label : (line.label[locale] ?? line.label['zh-TW']));
  }
  return lineId;
}

/** 核心還沒載入時的版面（V24）：只有故事快照 firstPaint.lines 裡的列（恆等式、前情摘要與預測目標）；其他列不會在核心載入前畫 */
export function firstPaintLayout(lines: Readonly<Record<string, { readonly label: string; readonly termRef?: string }>>): LayoutLike {
  return { statements: { firstPaint: Object.entries(lines).map(([id, l]) => ({ id, label: l.label, termRef: l.termRef ?? null })) } };
}
