// 五步驟勾稽填格的格子標籤（03 第 2.4 節表二、第 3.4 節）：每個開放格子（版面線 ID）屬於哪一張表、是哪個勾稽點的哪一邊。
// 勾稽點的兩邊依核心 fiveStepCheck 的規則從版面推導（link 列的 check step2 與它的 from、balance_end 列的 check step3 與資產負債表同科目的餘額列、
// retained_earnings 列、帶 equals_line 的 total 列與它的目標），不寫死線 ID。純函式，不碰 React。
import type { Locale } from '@ledgerland/i18n';
import { loadLayout, type StatementCode } from './layout-lazy.ts';

export type CheckStep = 2 | 3 | 4 | 5;

export interface CellMeta {
  statement: StatementCode;
  /** 這一格是哪個勾稽點的一邊；不是勾稽點的格子（進階模式的調整列等）省略 */
  step?: CheckStep;
}

type LayoutLine = {
  id: string;
  kind: string;
  check?: string;
  from?: string | string[];
  account?: string;
  accounts?: readonly string[];
  measure?: string;
  invariant?: string;
};

const STATEMENT_OF_PREFIX: Record<string, StatementCode> = { is: 'is', bs: 'bs', cf: 'cf' };

/** 線 ID 的報表：以前綴判斷（is_、bs_、cf_）；直接法的 dc_ 也算現金流量表 */
export function statementOfLine(lineId: string): StatementCode {
  const prefix = lineId.slice(0, lineId.indexOf('_'));
  return STATEMENT_OF_PREFIX[prefix] ?? (prefix === 'dc' ? 'cf' : 'bs');
}

/** 由版面推導「線 ID 對勾稽點步驟」 */
export function checkStepsOf(layout: { statements: Record<string, readonly LayoutLine[]> }): ReadonlyMap<string, CheckStep> {
  const out = new Map<string, CheckStep>();
  const cf = layout.statements['cash_flow_indirect'] ?? [];
  const bs = layout.statements['balance_sheet'] ?? [];
  const step2 = cf.find((l) => l.kind === 'link' && l.check === 'step2');
  if (step2 !== undefined) {
    out.set(step2.id, 2);
    if (typeof step2.from === 'string') out.set(step2.from, 2);
  }
  const step3 = cf.find((l) => l.kind === 'balance_end' && l.check === 'step3');
  if (step3 !== undefined) {
    out.set(step3.id, 3);
    const cash = bs.find((l) => l.kind === 'accounts' && l.measure === 'balance' && l.accounts?.length === 1 && l.accounts[0] === step3.account);
    if (cash !== undefined) out.set(cash.id, 3);
  }
  const re = bs.find((l) => l.kind === 'retained_earnings');
  if (re !== undefined) out.set(re.id, 4);
  const step5 = bs.find((l) => l.kind === 'total' && l.invariant?.startsWith('equals_line:') === true);
  if (step5 !== undefined) {
    out.set(step5.id, 5);
    out.set(step5.invariant!.slice('equals_line:'.length), 5);
  }
  return out;
}

/** 每一格的報表與勾稽步驟（同步，已有版面） */
export function cellMetaIn(layout: { statements: Record<string, readonly LayoutLine[]> }, lineIds: readonly string[]): Record<string, CellMeta> {
  const steps = checkStepsOf(layout);
  const out: Record<string, CellMeta> = {};
  for (const id of lineIds) {
    const step = steps.get(id);
    out[id] = { statement: statementOfLine(id), ...(step === undefined ? {} : { step }) };
  }
  return out;
}

/** 每一格的報表與勾稽步驟（等核心資料） */
export async function cellMetaOf(lineIds: readonly string[]): Promise<Record<string, CellMeta>> {
  return cellMetaIn((await loadLayout()) as unknown as { statements: Record<string, readonly LayoutLine[]> }, lineIds);
}

const CIRCLED: Record<CheckStep, string> = { 2: '②', 3: '③', 4: '④', 5: '⑤' };

/** 步驟的編號文字：中文用圈數字（教材寫法），英文用一般數字 */
export function stepMark(step: CheckStep, locale: Locale): string {
  return locale === 'en' ? String(step) : CIRCLED[step];
}

/** 勾稽點的字母別名（14 T13）：步驟編號是主鍵，字母只當顯示別名；A 稅前淨利、B 本期淨利對未分配盈餘、C 期末現金、D 資產負債表左右平衡 */
const CHECK_LETTER: Record<CheckStep, 'A' | 'B' | 'C' | 'D'> = { 2: 'A', 3: 'C', 4: 'B', 5: 'D' };

export function checkLetterOf(step: CheckStep): 'A' | 'B' | 'C' | 'D' {
  return CHECK_LETTER[step];
}
