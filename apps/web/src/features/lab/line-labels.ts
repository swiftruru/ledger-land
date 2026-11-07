// 列名的純函式（labels.ts 的 hook 用它，單元測試也直接用）：核心的版面（label 是 LocalizedText）與核心載入前由故事快照 firstPaint.lines
// 做成的版面（label 已依語系攤平成字串，V24）都走同一個 lineLabelOf；有 termRef 且名詞索引有那個名詞時優先用名詞的名稱。
// 例外是 ifrs@1 版面（04 第 10.3 節）：列名是現行台灣用語與 IFRS 英文，名詞的名稱是教材用語（銷管費用、利息費用），所以用版面自己的 label，名詞只當名詞卡的連結。
// 不 import 任何 React 或 Lingui。
import type { Locale } from '@ledgerland/i18n';
import { IFRS_POLICY } from './lab-policy.ts';

export type LocalizedText = { readonly 'zh-TW': string; readonly en: string };
/** 核心的版面，或核心載入前由故事快照的 firstPaint.lines 做成的版面（label 已依語系攤平成字串） */
export type LayoutLike = {
  /** 版面 ID（teacher@1、ifrs@1）；故事快照做成的版面沒有 */
  readonly id?: string;
  readonly statements: Readonly<
    Record<
      string,
      readonly { id: string; label: LocalizedText | string; termRef?: string | null; hidden?: boolean; kind?: string; accounts?: readonly string[] }[]
    >
  >;
};

export function lineLabelOf(layout: LayoutLike, lineId: string, locale: Locale, labelOf: (termId: string) => string | undefined): string {
  for (const lines of Object.values(layout.statements)) {
    const line = lines.find((l) => l.id === lineId);
    if (line) {
      const own = typeof line.label === 'string' ? line.label : (line.label[locale] ?? line.label['zh-TW']);
      if (layout.id === IFRS_POLICY) return own;
      return (line.termRef ? labelOf(line.termRef) : undefined) ?? own;
    }
  }
  return lineId;
}

/**
 * 這個版面沒有的列：不顯示的科目列，而且它的科目也不在任何顯示的列上。ifrs@1 沒有遞延資產（設立費發生時費用化、開發費故事未用，04 第 10.3 節），
 * 這些線永遠是 0，指標的公式與來源面板都不再列出來。其他不顯示的列是公式真的用到的數字，不算：不動產廠房設備毛額的科目分列在表上，本期進貨是由存貨帳推導的。
 */
export function isAbsentLine(layout: LayoutLike, lineId: string): boolean {
  const rows = Object.values(layout.statements).flat();
  const line = rows.find((l) => l.id === lineId);
  if (line?.hidden !== true || line.kind !== 'accounts') return false;
  const shown = new Set(rows.flatMap((l) => (l.hidden === true ? [] : (l.accounts ?? []))));
  return !(line.accounts ?? []).some((a) => shown.has(a));
}

export interface FormulaSpec {
  readonly numerator?: string;
  readonly denominator?: string;
  readonly expr?: string;
  /** 使用者輸入的值（稅率、每股面額）的名稱，鍵不含 input. */
  readonly inputs?: Readonly<Record<string, { readonly label: Readonly<Record<Locale, string>> }>>;
}

const REF_RE = /\b(line|input|ratio)\.([a-z][a-z0-9_]*)(?:\.([a-z][a-z0-9_]*))?/g;
const ADDED_LINE_RE = /\s*\+\s*line\.([a-z][a-z0-9_]*)/g;

/** 指標公式的文字：line.x 換成版面名稱、ratio.x 換成指標名稱、input.x 換成這個版本的輸入值名稱；版面沒有的列（isAbsentLine）是 0，連同前面的加號拿掉 */
/** 運算式在括號外有加減：拿掉每一層括號之後還看得到前後有空白的 + 或 - */
function hasTopLevelSum(source: string): boolean {
  let rest = source;
  for (let prev = ''; prev !== rest;) {
    prev = rest;
    rest = rest.replace(/\([^()]*\)/g, '');
  }
  return /\s[-+]\s/.test(rest);
}

export function formulaTextOf(
  spec: FormulaSpec,
  layout: LayoutLike,
  locale: Locale,
  names: { readonly line: (id: string) => string; readonly ratio: (id: string) => string },
): string {
  const prune = (source: string): string => source.replace(ADDED_LINE_RE, (term, id: string) => (isAbsentLine(layout, id) ? '' : term));
  // 乘除用畫面上的符號，不是運算式的 * 與 /
  const humanise = (source: string): string =>
    source
      .replace(REF_RE, (_m, ns: string, name: string) =>
        ns === 'line' ? names.line(name) : ns === 'ratio' ? names.ratio(name) : (spec.inputs?.[name]?.label[locale] ?? name.replace(/_/g, ' ')),
      )
      .replace(/ \* /g, ' × ')
      .replace(/ \/ /g, ' ÷ ');
  // 分子或分母是多項相加減時要加括號，否則「甲 + 乙 ÷ 丙 - 丁」會被讀成先除
  const side = (source: string): string => {
    const pruned = prune(source);
    return hasTopLevelSum(pruned) ? `(${humanise(pruned)})` : humanise(pruned);
  };
  return spec.expr !== undefined ? humanise(prune(spec.expr)) : `${side(spec.numerator ?? '')} ÷ ${side(spec.denominator ?? '')}`;
}

/** 核心還沒載入時的版面（V24）：只有故事快照 firstPaint.lines 裡的列（恆等式、前情摘要與預測目標）；其他列不會在核心載入前畫 */
export function firstPaintLayout(lines: Readonly<Record<string, { readonly label: string; readonly termRef?: string }>>): LayoutLike {
  return { statements: { firstPaint: Object.entries(lines).map(([id, l]) => ({ id, label: l.label, termRef: l.termRef ?? null })) } };
}
