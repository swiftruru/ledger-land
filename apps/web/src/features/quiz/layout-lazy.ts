// 版面線的顯示文字與迷你報表的列（04 第 11 節）：只延後載入核心的 teacher@1 版面資料（lazy-data.ts，不帶判分與 zod），
// 不把會計核心帶進學習端。線的文字用版面自己的 label（D13 A 的網站顯示字；合計列與群組列的字不同），缺的才退回名詞資料（termRef）。
// 金額沒有在快照裡（04 第 15.2 節只寫答案），所以迷你報表先只列出列名；列的金額等快照補上再顯示。
// 兩種寫法：…In(layout, …) 是同步版，給已經拿到核心資料（lazy-data.ts 的 coreDataNow）的題目元件在第一次渲染就算出名稱；
// 沒有 In 的是等 loadCoreData 的非同步版（指標公式的文字、測試）。
import type { Locale } from '@ledgerland/i18n';
import { loadCoreData, type CoreData } from './lazy-data.ts';

type LayoutModule = { teacherLayout: { statements: Record<string, readonly LayoutLine[]> } };
export type TeacherLayout = LayoutModule['teacherLayout'];
interface LayoutLine {
  readonly id: string;
  readonly kind: string;
  readonly label: { readonly 'zh-TW': string; readonly en: string };
  readonly termRef?: string;
  readonly hidden?: boolean;
  readonly extension?: boolean;
  readonly flags?: readonly string[];
}

/** 核心資料裡的教材版面 */
export function layoutOf(core: CoreData): TeacherLayout {
  return core.teacherLayout as unknown as TeacherLayout;
}

/** 教材版面（模組 Promise 已經在 loadCoreData 快取，這裡不再多快取一層，否則失敗會被永久留住） */
export function loadLayout(): Promise<TeacherLayout> {
  return loadCoreData().then(layoutOf);
}

export const STATEMENT_ID = { is: 'income_statement', bs: 'balance_sheet', cf: 'cash_flow_indirect' } as const;
export type StatementCode = keyof typeof STATEMENT_ID;

export interface LineRow {
  id: string;
  label: string;
  kind: string;
  /** 群組標題列（不能選） */
  heading: boolean;
  total: boolean;
}

export function findLine(layout: TeacherLayout, lineId: string): LayoutLine | undefined {
  for (const lines of Object.values(layout.statements)) {
    const line = lines.find((l) => l.id === lineId);
    if (line) return line;
  }
  return undefined;
}

function labelFor(line: LayoutLine, locale: Locale, labelOf: (termId: string) => string | undefined): string {
  const own = line.label[locale];
  if (own !== undefined && own !== '') return own;
  return (line.termRef === undefined ? undefined : labelOf(line.termRef)) ?? line.label['zh-TW'];
}

/** 線 ID 的顯示文字（同步，已有版面）：版面的 label，缺的退回名詞資料（termRef）；找不到時回傳 ID */
export function lineLabelIn(layout: TeacherLayout, lineId: string, locale: Locale, labelOf: (termId: string) => string | undefined): string {
  const line = findLine(layout, lineId);
  return line ? labelFor(line, locale, labelOf) : lineId;
}

/** 線 ID 的顯示文字（等核心資料） */
export async function lineLabel(lineId: string, locale: Locale, labelOf: (termId: string) => string | undefined): Promise<string> {
  return lineLabelIn(await loadLayout(), lineId, locale, labelOf);
}

/** 迷你報表的列（同步，已有版面）：略過隱藏列與延伸列（金額未知時不顯示 when_nonzero 的延伸列） */
export function statementRowsIn(layout: TeacherLayout, code: StatementCode, locale: Locale, labelOf: (termId: string) => string | undefined): LineRow[] {
  const lines = layout.statements[STATEMENT_ID[code]] ?? [];
  return lines
    .filter((l) => !l.hidden && !l.extension)
    .map((l) => ({
      id: l.id,
      label: labelFor(l, locale, labelOf),
      kind: l.kind,
      heading: l.kind === 'group',
      total: l.kind === 'total' || l.kind === 'formula' || l.kind === 'balance_end',
    }));
}

/** 迷你報表的列（等核心資料） */
export async function statementRows(code: StatementCode, locale: Locale, labelOf: (termId: string) => string | undefined): Promise<LineRow[]> {
  return statementRowsIn(await loadLayout(), code, locale, labelOf);
}
