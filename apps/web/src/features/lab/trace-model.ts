// 「這個數字從哪裡來」面板的純函式（03 第 3.9 節，D10(c) A）：核心的追蹤樹（traceLine）已經是完整的公式樹與來源分錄行，
// 這裡只做畫面要的整理：跨表對應（從版面推得）、0 元且沒有來源的子節點分組、節點在公式裡的正負號、來源分錄行依步驟分組、
// 往下鑽的路徑與聚焦的位置、指標公式的分子分母引用哪些線、同時有子節點與科目層的列（未分配盈餘）的科目部分。不算任何金額，不 import React 或 Lingui。
import type { Layout, StatementId, TraceNode } from '@ledgerland/core';
import { isAbsentLine } from './line-labels.ts';

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
 * retained_earnings 列對它的 netIncomeLine（N26 對 R35，④）、inventory_closing 對存貨的餘額列（R14 對 L14，沒有編號）。只收畫面上有的三張表，
 * 版面不顯示的列（hidden，例如 ifrs@1 的期末存貨）報表上標不出來，不算對應。
 */
export function crossLinks(layout: Layout): ReadonlyMap<string, readonly CrossLink[]> {
  const out = new Map<string, CrossLink[]>();
  const shownOn = (lineId: string): ShownStatement | null => {
    const s = statementOf(layout, lineId);
    return s !== null && isShown(s) && layout.statements[s].find((l) => l.id === lineId)?.hidden !== true ? s : null;
  };
  const add = (a: string, b: string, check: CrossLink['check']) => {
    const sa = shownOn(a);
    const sb = shownOn(b);
    if (sa === null || sb === null || sa === sb) return;
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

/** 同時有子節點與科目層的列（有股利的未分配盈餘）裡，科目層那一部分：amount 已帶號，公式裡顯示 op 與絕對值 */
export interface OwnPart {
  readonly account: string;
  readonly amount: number;
  readonly op: TraceOperator;
}

/**
 * 公式列裡自己的科目層：只有畫出子節點的時候才需要（沒有子節點時科目層就是最底層，直接列來源步驟）。
 * 0 元而且沒有來源的科目不佔一列（沒有股利的未分配盈餘）。子節點加上這幾列等於列值，畫面上的公式才對得起來。
 */
export function ownParts(node: TraceNode): readonly OwnPart[] {
  if (splitChildren(node).shown.length === 0) return [];
  return node.accounts
    .filter((a) => a.amount !== 0 || a.sources.length > 0)
    .map((a) => ({ account: a.account, amount: a.amount, op: a.amount < 0 ? ('－' as const) : ('＋' as const) }));
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

/**
 * 面板聚焦的位置。ratios 是從指標目標往下進過的連鎖指標（ratio 參照），lineRoot 是公式樹的根（指標目標一開始是 null，進了某條線才有），
 * path 是 lineRoot 之後每一層的線 ID（一定是完整路徑，nodeAtPath 才走得到）。
 */
export interface TraceFocus {
  readonly ratios: readonly string[];
  readonly lineRoot: string | null;
  readonly path: readonly string[];
}

/** 面板的目標：這裡只需要它是哪一條線或哪一個指標 */
export type FocusTarget = { readonly kind: 'line'; readonly lineId: string } | { readonly kind: 'ratio'; readonly ratioRef: string };

/** 開面板時聚焦的位置：線目標是那條線本身，指標目標是指標的分子與分母 */
export function startFocus(target: FocusTarget | null): TraceFocus {
  return { ratios: [], lineRoot: target?.kind === 'line' ? target.lineId : null, path: [] };
}

/** 往下鑽：trail 是從目前聚焦的節點走到那個子節點的完整路徑（原地展開的第 3 層是三段，不是只有最後一段） */
export function focusDeeper(focus: TraceFocus, trail: readonly string[]): TraceFocus {
  return { ...focus, path: [...focus.path, ...trail] };
}

/** 從指標的分子或分母進到某條線的公式樹 */
export function focusLine(focus: TraceFocus, lineId: string): TraceFocus {
  return { ratios: focus.ratios, lineRoot: lineId, path: [] };
}

/** 從指標進到它引用的另一個指標（連鎖指標），看那個指標自己的分子與分母 */
export function focusRatio(focus: TraceFocus, ratioRef: string): TraceFocus {
  return { ratios: [...focus.ratios, ratioRef], lineRoot: null, path: [] };
}

/** 頂端路徑的一段：名稱由畫面查（kind 與 ref），focus 是按下去要回到的位置 */
export interface FocusCrumb {
  readonly key: string;
  readonly kind: 'ratio' | 'line';
  readonly ref: string;
  readonly focus: TraceFocus;
}

/** 頂端路徑：目標的指標、進過的連鎖指標、公式樹的根、往下鑽的每一層；最後一段就是目前的位置 */
export function focusTrail(target: FocusTarget, focus: TraceFocus): readonly FocusCrumb[] {
  const out: FocusCrumb[] = [];
  const push = (kind: FocusCrumb['kind'], ref: string, to: TraceFocus) => out.push({ key: `${out.length}:${kind}:${ref}`, kind, ref, focus: to });
  if (target.kind === 'ratio') push('ratio', target.ratioRef, { ratios: [], lineRoot: null, path: [] });
  focus.ratios.forEach((ref, i) => push('ratio', ref, { ratios: focus.ratios.slice(0, i + 1), lineRoot: null, path: [] }));
  if (focus.lineRoot !== null) {
    const lineRoot = focus.lineRoot;
    push('line', lineRoot, { ratios: focus.ratios, lineRoot, path: [] });
    focus.path.forEach((id, i) => push('line', id, { ratios: focus.ratios, lineRoot, path: focus.path.slice(0, i + 1) }));
  }
  return out;
}

/** 本期進貨與期末存貨：不是分錄裡的科目，是由存貨帳推導出來的列（03 第 3.3 節的說明，面板的「看分錄」旁要加註） */
export function isDerivedInventoryLine(layout: Layout, lineId: string): boolean {
  for (const s of Object.keys(layout.statements) as StatementId[]) {
    const line = layout.statements[s].find((l) => l.id === lineId);
    if (line !== undefined) return line.kind === 'inventory_purchases' || line.kind === 'inventory_closing';
  }
  return false;
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

export function ratioParts(
  spec: { readonly numerator?: string; readonly denominator?: string; readonly expr?: string },
  layout?: Layout,
): {
  readonly numerator: readonly RatioPart[];
  readonly denominator: readonly RatioPart[];
  readonly expr: readonly RatioPart[];
} {
  // 版面沒有的列不列出來（ifrs@1 的遞延資產）：和公式句（formulaTextOf）一致
  const parts = (source: string | undefined) => partsOf(source).filter((p) => !(layout !== undefined && p.kind === 'line' && isAbsentLine(layout, p.ref)));
  return { numerator: parts(spec.numerator), denominator: parts(spec.denominator), expr: parts(spec.expr) };
}
