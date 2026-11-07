// 「這個數字從哪裡來」面板的純函式（03 第 3.9 節，D10(c) A）：核心的追蹤樹（traceLine）已經是完整的公式樹與來源分錄行，
// 這裡只做畫面要的整理：跨表對應（從版面推得）、0 元且沒有來源的子節點分組、節點在公式裡的正負號、來源分錄行依步驟分組、
// 往下鑽的路徑、指標公式的分子分母引用哪些線。不算任何金額，不 import React 或 Lingui。
import type { Layout, StatementId, TraceNode } from '@ledgerland/core';

/** 畫面上有的三張表（直接法不顯示，跨表對應不指向它） */
export type ShownStatement = 'income_statement' | 'balance_sheet' | 'cash_flow_indirect';
export const SHOWN_STATEMENTS: readonly ShownStatement[] = ['income_statement', 'balance_sheet', 'cash_flow_indirect'];

const isShown = (s: StatementId): s is ShownStatement => (SHOWN_STATEMENTS as readonly string[]).includes(s);

/** 某一條線在哪一張表；版面沒有這條線時是 null */
export function statementOf(layout: Layout, lineId: string): StatementId | null {
  for (const s of Object.keys(layout.statements) as StatementId[]) if (layout.statements[s].some((l) => l.id === lineId)) return s;
  return null;
}

/** 跨表對應（面板第一區）：另一張表上同一個數字，以及它是五步驟的第幾個勾稽點（沒有編號的例如期末存貨對存貨） */
export interface CrossLink {
  readonly line: string;
  readonly statement: ShownStatement;
  readonly check: 2 | 3 | 4 | null;
}

/**
 * 從版面推出跨表對應，兩個方向都有：link 列對它的 from（H11 對 R33，勾稽點②）、帶 check step3 的 balance_end 對同一科目的餘額列（H41 對 L12，③）、
 * retained_earnings 列對它的 netIncomeLine（N26 對 R35，④）、inventory_closing 對存貨的餘額列（R14 對 L14，沒有編號）。只收畫面上有的三張表。
 */
export function crossLinks(layout: Layout): ReadonlyMap<string, readonly CrossLink[]> {
  const out = new Map<string, CrossLink[]>();
  const add = (a: string, b: string, check: CrossLink['check']) => {
    const sa = statementOf(layout, a);
    const sb = statementOf(layout, b);
    if (sa === null || sb === null || !isShown(sa) || !isShown(sb) || sa === sb) return;
    const push = (from: string, to: string, statement: ShownStatement) => {
      const list = out.get(from) ?? [];
      if (!list.some((x) => x.line === to)) list.push({ line: to, statement, check });
      out.set(from, list);
    };
    push(a, b, sb);
    push(b, a, sa);
  };
  const balanceLineOf = (account: string): string | null => {
    for (const l of layout.statements.balance_sheet)
      if (l.kind === 'accounts' && l.measure === 'balance' && l.accounts.length === 1 && l.accounts[0] === account && l.hidden !== true) return l.id;
    return null;
  };
  for (const s of SHOWN_STATEMENTS)
    for (const l of layout.statements[s]) {
      switch (l.kind) {
        case 'link':
          add(l.id, l.from, l.check === 'step2' ? 2 : null);
          break;
        case 'balance_end': {
          const bs = balanceLineOf(l.account);
          if (bs !== null) add(l.id, bs, l.check === 'step3' ? 3 : null);
          break;
        }
        case 'retained_earnings':
          add(l.id, l.netIncomeLine, 4);
          break;
        case 'inventory_closing': {
          const bs = balanceLineOf('inventory');
          if (bs !== null) add(l.id, bs, null);
          break;
        }
        default:
          break;
      }
    }
  return out;
}

/** 這個節點本身有來源（科目層帶分錄行或期初餘額，或是現金行） */
export function hasSources(node: TraceNode): boolean {
  return node.sources.length > 0 || node.accounts.some((a) => a.sources.length > 0 || a.opening !== 0);
}

/** 整棵子樹都是 0 而且沒有任何來源：收進「其他 0 元的項目」 */
export function isEmptyNode(node: TraceNode): boolean {
  return node.value === 0 && !hasSources(node) && node.children.every(isEmptyNode);
}

/** 子節點分成要畫的與收起來的 0 元項目（順序照公式） */
export function splitChildren(node: TraceNode): { readonly shown: readonly TraceNode[]; readonly zeros: readonly TraceNode[] } {
  const shown: TraceNode[] = [];
  const zeros: TraceNode[] = [];
  for (const c of node.children) (isEmptyNode(c) ? zeros : shown).push(c);
  return { shown, zeros };
}

export type TraceOperator = '＋' | '－';

/** 每個子節點在這一列公式裡的正負號：formula 列看運算式裡 line.x 前面的符號；其他（合計、期末餘額、未分配盈餘）一律相加 */
export function childOperators(node: TraceNode): ReadonlyMap<string, TraceOperator> {
  const out = new Map<string, TraceOperator>();
  if (node.rule === 'formula' && node.expr !== undefined) {
    const re = /([+-])?\s*line\.([a-z][a-z0-9_]*)/g;
    for (const m of node.expr.matchAll(re)) out.set(m[2] as string, m[1] === '-' ? '－' : '＋');
  }
  for (const c of node.children) if (!out.has(c.line)) out.set(c.line, '＋');
  return out;
}

/** 來源分錄行依步驟分組（面板第三區）：每一步對這一列的帶號貢獻，與構成它的每一條分錄行 */
export interface SourceLine {
  readonly eventId: string;
  readonly lineRef: string;
  readonly account: string | null;
  readonly side: 'debit' | 'credit';
  readonly amount: number;
  /** 這一行對列值的帶號貢獻（科目層乘上該科目進入這一列的符號；現金行是流入正、流出負） */
  readonly contribution: number;
}

export interface SourceStep {
  readonly stepId: string;
  readonly contribution: number;
  readonly lines: readonly SourceLine[];
}

export function sourceSteps(node: TraceNode): readonly SourceStep[] {
  const byStep = new Map<string, SourceLine[]>();
  const push = (stepId: string, line: SourceLine) => {
    const list = byStep.get(stepId) ?? [];
    list.push(line);
    byStep.set(stepId, list);
  };
  for (const a of node.accounts)
    for (const s of a.sources)
      push(s.stepId, { eventId: s.eventId, lineRef: s.lineRef, account: a.account, side: s.side, amount: s.amount, contribution: a.sign * s.signedAmount });
  for (const s of node.sources)
    push(s.stepId, { eventId: s.eventId, lineRef: s.lineRef, account: null, side: s.side, amount: s.amount, contribution: s.signedAmount });
  return [...byStep.entries()].map(([stepId, lines]) => ({ stepId, contribution: lines.reduce((acc, l) => acc + l.contribution, 0) || 0, lines }));
}

/** 視窗起點帶進來的餘額合計（自訂期初的情境才不是 0） */
export function openingOf(node: TraceNode): number {
  return node.accounts.reduce((acc, a) => acc + a.sign * a.opening, 0) || 0;
}

/** 往下鑽的路徑：root 之後每一層的線 ID；路徑指到不存在的子節點時是 null */
export function nodeAtPath(root: TraceNode, path: readonly string[]): TraceNode | null {
  let node: TraceNode = root;
  for (const id of path) {
    const next = node.children.find((c) => c.line === id);
    if (next === undefined) return null;
    node = next;
  }
  return node;
}

/** 指標公式引用的參照（面板第一層）：line.x 是報表列、ratio.x.version 是連鎖的指標、input.x 是輸入值 */
export interface RatioPart {
  readonly kind: 'line' | 'ratio' | 'input';
  readonly ref: string;
}

const REF_RE = /\b(line|input|ratio)\.([a-z][a-z0-9_]*)(?:\.([a-z][a-z0-9_]*))?/g;

export function partsOf(source: string | undefined): readonly RatioPart[] {
  if (source === undefined) return [];
  const out: RatioPart[] = [];
  for (const m of source.matchAll(REF_RE)) {
    const ns = m[1] as RatioPart['kind'];
    const ref = ns === 'ratio' ? `${m[2]}@${m[3] ?? ''}` : (m[2] as string);
    if (!out.some((p) => p.kind === ns && p.ref === ref)) out.push({ kind: ns, ref });
  }
  return out;
}

export function ratioParts(spec: { readonly numerator?: string; readonly denominator?: string; readonly expr?: string }): {
  readonly numerator: readonly RatioPart[];
  readonly denominator: readonly RatioPart[];
  readonly expr: readonly RatioPart[];
} {
  return { numerator: partsOf(spec.numerator), denominator: partsOf(spec.denominator), expr: partsOf(spec.expr) };
}
