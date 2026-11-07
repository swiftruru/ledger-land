// oxlint-disable vitest/valid-expect, vitest/no-conditional-expect -- expect 的第二個引數是失敗時指出哪一列的訊息；逐列檢查寫成迴圈
// 來源面板的純函式（features/lab/trace-model.ts）與 lab-core 的追蹤包裝：跨表對應由版面推得；0 元沒有來源的子節點被收起來；
// 公式裡的正負號；來源分錄行依步驟分組且貢獻加總等於列值（累計視窗扣掉期初）；往下鑽的路徑；traceLabLine 等於直接呼叫核心的 traceLine。
import { describe, expect, it } from 'vitest';
import { createCoreContext, replayStory, traceLine, type Story } from '@ledgerland/core';
import officialJson from '../../../content/stories/story_ywv2dy.json' with { type: 'json' };
import * as labCore from '../src/features/lab/lab-core.ts';
import { asCoreStory, entriesOfStep, replayLab, traceLabLine, type TraceNode } from '../src/features/lab/lab-core.ts';
import { ratioSpecOf, ratioSpecs } from '../src/features/lab/ratio-changes.ts';
import { newSandbox, sandboxStory, withInserted } from '../src/features/lab/sandbox.ts';
import {
  childOperators,
  crossLinks,
  focusDeeper,
  focusLine,
  focusRatio,
  focusTrail,
  isDerivedInventoryLine,
  isEmptyNode,
  nodeAtPath,
  ownParts,
  partsOf,
  ratioParts,
  sourceSteps,
  splitChildren,
  startFocus,
  statementOf,
} from '../src/features/lab/trace-model.ts';
import type { StorySnapshot } from '../src/lib/content.ts';

const snapshot = officialJson as unknown as StorySnapshot;
const lab = replayLab(asCoreStory(snapshot));
if (!lab.ok) throw new Error('replayLab 失敗');
const run = lab.value;
const layout = run.ctx.layout;
const labIfrs = replayLab(asCoreStory(snapshot), [], 'ifrs@1');
if (!labIfrs.ok) throw new Error('replayLab（ifrs@1）失敗');
const ifrsLayout = labIfrs.value.ctx.layout;
const STEP7 = 'st_98tppx';
const step7 = run.stepById(STEP7)!;

describe('crossLinks：跨表對應由版面推得', () => {
  const links = crossLinks(layout);
  it('稅前淨利②、期末現金③、未分配盈餘④、期末存貨（沒有編號），兩個方向都有；不指向直接法', () => {
    expect(links.get('cf_pretax_income')).toEqual([{ line: 'is_pretax_income', statement: 'income_statement', check: 2 }]);
    expect(links.get('is_pretax_income')).toEqual([{ line: 'cf_pretax_income', statement: 'cash_flow_indirect', check: 2 }]);
    expect(links.get('cf_cash_end')).toEqual([{ line: 'bs_cash', statement: 'balance_sheet', check: 3 }]);
    expect(links.get('bs_cash')).toEqual([{ line: 'cf_cash_end', statement: 'cash_flow_indirect', check: 3 }]);
    expect(links.get('bs_retained_earnings')).toEqual([{ line: 'is_net_income', statement: 'income_statement', check: 4 }]);
    expect(links.get('is_net_income')).toEqual([{ line: 'bs_retained_earnings', statement: 'balance_sheet', check: 4 }]);
    expect(links.get('is_closing_inventory')).toEqual([{ line: 'bs_inventory', statement: 'balance_sheet', check: null }]);
    expect(links.get('bs_inventory')).toEqual([{ line: 'is_closing_inventory', statement: 'income_statement', check: null }]);
    for (const [from, list] of links) {
      expect(from.startsWith('dc_'), from).toBe(false);
      for (const l of list) expect(l.line.startsWith('dc_'), `${from} 對 ${l.line}`).toBe(false);
    }
    expect(links.get('is_revenue')).toBeUndefined();
  });

  it('ifrs@1 不顯示期末存貨：存貨沒有跨表對應，不會指向報表上標不出來的列；其他對應照舊', () => {
    const ifrsLinks = crossLinks(ifrsLayout);
    expect(ifrsLinks.get('bs_inventory')).toBeUndefined();
    expect(ifrsLinks.get('is_closing_inventory')).toBeUndefined();
    expect(ifrsLinks.get('bs_cash')).toEqual([{ line: 'cf_cash_end', statement: 'cash_flow_indirect', check: 3 }]);
    expect(ifrsLinks.get('is_net_income')).toEqual([{ line: 'bs_retained_earnings', statement: 'balance_sheet', check: 4 }]);
    const hidden = new Set(Object.values(ifrsLayout.statements).flatMap((rows) => rows.filter((r) => r.hidden === true).map((r) => r.id)));
    for (const [from, list] of ifrsLinks) {
      expect(hidden.has(from), from).toBe(false);
      for (const l of list) expect(hidden.has(l.line), `${from} 對 ${l.line}`).toBe(false);
    }
  });

  it('statementOf', () => {
    expect(statementOf(layout, 'is_revenue')).toBe('income_statement');
    expect(statementOf(layout, 'dc_cash_end')).toBe('cash_flow_direct');
    expect(statementOf(layout, 'nope')).toBeNull();
  });
});

describe('traceLabLine 與公式樹的整理', () => {
  it('traceLabLine 等於直接呼叫核心的 traceLine（累計與本筆變動）', () => {
    const cum = traceLabLine(run, step7, 'cumulative', 'is_operating_income');
    expect(cum).toEqual(traceLine(run.run, { kind: 'cumulative', to: STEP7 }, layout, run.ctx.policy, 'is_operating_income'));
    expect(cum.value).toBe(step7.after.lines.get('is_operating_income')?.value);
    const tx = traceLabLine(run, step7, 'transaction', 'is_operating_income');
    expect(tx).toEqual(traceLine(run.run, { kind: 'transaction', step: STEP7 }, layout, run.ctx.policy, 'is_operating_income'));
    expect(tx.value).toBe(step7.change.lines.get('is_operating_income')?.value);
    // 和另外建一個核心環境算的一樣（頁面不另外存數字）
    const other = createCoreContext();
    const otherRun = replayStory(officialJson as unknown as Story, [], other);
    if (!otherRun.ok) throw new Error('重播失敗');
    expect(traceLine(otherRun.value, { kind: 'cumulative', to: STEP7 }, other.layout, other.policy, 'is_operating_income')).toEqual(cum);
  });

  it('childOperators：營業利益＝營業毛利－銷管費用小計；稅前淨利的三個子節點依公式；合計列一律相加', () => {
    const oi = traceLabLine(run, step7, 'cumulative', 'is_operating_income');
    expect([...childOperators(oi)]).toEqual([
      ['is_gross_profit', '＋'],
      ['is_sga_total', '－'],
    ]);
    const pretax = traceLabLine(run, step7, 'cumulative', 'is_pretax_income');
    expect(childOperators(pretax).get('is_extraordinary_losses')).toBe('－');
    expect(childOperators(pretax).get('is_ordinary_income')).toBe('＋');
    const total = traceLabLine(run, step7, 'cumulative', 'is_sga_total');
    for (const [, op] of childOperators(total)) expect(op).toBe('＋');
  });

  it('splitChildren：第 7 步之後銷管費用小計裡 0 元且沒有來源的科目列收起來，有金額的留著；isEmptyNode 對有來源的 0 元列是 false', () => {
    const total = traceLabLine(run, step7, 'cumulative', 'is_sga_total');
    const { shown, zeros } = splitChildren(total);
    expect(shown.map((n) => n.line)).toEqual(['is_outsourcing_expense', 'is_office_supplies_expense']);
    expect(zeros.length).toBe(total.children.length - 2);
    for (const z of zeros) expect(isEmptyNode(z), z.line).toBe(true);
    // 期末存貨在第 7 步賣光是 0，但存貨帳有第 6 步進、第 7 步出的來源，不算空
    const cogs = traceLabLine(run, step7, 'cumulative', 'is_cogs');
    const closing = cogs.children.find((c) => c.line === 'is_closing_inventory')!;
    expect(closing.value).toBe(0);
    expect(isEmptyNode(closing)).toBe(false);
    expect(splitChildren(cogs).shown.map((n) => n.line)).toEqual(['is_purchases', 'is_closing_inventory']);
  });

  it('sourceSteps：來源分錄行依步驟分組，每一步的貢獻加總等於列值；每一行都指得到該步過帳的分錄', () => {
    const total = traceLabLine(run, step7, 'cumulative', 'is_sga_total');
    const steps = sourceSteps(total.children.find((c) => c.line === 'is_outsourcing_expense')!);
    expect(steps.map((s) => s.stepId)).toEqual(['st_84jzxr']);
    expect(steps[0]!.contribution).toBe(step7.after.lines.get('is_outsourcing_expense')?.value);
    expect(steps[0]!.lines).toHaveLength(1);
    expect(steps[0]!.lines[0]).toMatchObject({ eventId: 'e1', account: 'outsourcing_expense', side: 'debit' });
    // 期末存貨：第 6 步進、第 7 步出，合計 0
    const cogs = traceLabLine(run, step7, 'cumulative', 'is_cogs');
    const closing = sourceSteps(cogs.children.find((c) => c.line === 'is_closing_inventory')!);
    expect(closing.map((s) => s.stepId)).toEqual(['st_g4h3hx', STEP7]);
    expect(closing.reduce((a, s) => a + s.contribution, 0)).toBe(0);
    expect(closing[0]!.contribution).toBeGreaterThan(0);
    expect(closing[1]!.contribution).toBeLessThan(0);
    for (const s of closing)
      for (const l of s.lines) {
        const entry = entriesOfStep(run, s.stepId).find((e) => e.eventId === l.eventId);
        expect(
          entry?.lines.some((x) => x.ref === l.lineRef && x.amount === l.amount && x.side === l.side),
          `${s.stepId} ${l.lineRef}`,
        ).toBe(true);
      }
    // 現金行（cash_tag 列）：期末現金 → 淨變動 → 營業活動合計 → 支付利息沒有來源；籌資的發行股票有第 1 步
    const share = traceLabLine(run, step7, 'cumulative', 'cf_share_issue');
    expect(sourceSteps(share).map((s) => s.stepId)).toEqual(['st_9htcrg']);
    expect(sourceSteps(share)[0]!.contribution).toBe(share.value);
    // 本筆變動視窗只有這一步
    const tx = traceLabLine(run, step7, 'transaction', 'is_revenue');
    expect(sourceSteps(tx).map((s) => s.stepId)).toEqual([STEP7]);
  });

  it('nodeAtPath：依線 ID 往下走；錯的路徑是 null', () => {
    const re = traceLabLine(run, step7, 'cumulative', 'bs_retained_earnings');
    expect(nodeAtPath(re, [])?.line).toBe('bs_retained_earnings');
    expect(nodeAtPath(re, ['is_net_income', 'is_pretax_income', 'is_ordinary_income', 'is_operating_income'])?.line).toBe('is_operating_income');
    expect(nodeAtPath(re, ['is_net_income', 'nope'])).toBeNull();
  });

  it('往下鑽：第 3 層的完整路徑走得到（只帶最後一段會是 null，面板就空白了）', () => {
    const oi = traceLabLine(run, step7, 'cumulative', 'is_operating_income');
    const focus = startFocus({ kind: 'line', lineId: 'is_operating_income' });
    const deep = focusDeeper(focus, ['is_gross_profit', 'is_cogs', 'is_purchases']);
    expect(nodeAtPath(oi, deep.path)?.line).toBe('is_purchases');
    expect(nodeAtPath(oi, ['is_purchases'])).toBeNull();
    expect(sourceSteps(nodeAtPath(oi, deep.path)!).length).toBeGreaterThan(0);
    // 已經往下鑽過，再從那裡鑽：接在後面
    expect(focusDeeper({ ...focus, path: ['is_gross_profit'] }, ['is_cogs']).path).toEqual(['is_gross_profit', 'is_cogs']);
  });

  it('entriesOfStep：沒有這一步是空陣列', () => {
    expect(entriesOfStep(run, 'st_nope')).toEqual([]);
    expect(entriesOfStep(run, STEP7).length).toBeGreaterThan(0);
  });
});

describe('科目層與子節點併列的列（有股利的未分配盈餘）', () => {
  const FIRST = run.stepIds[0]!;
  const LAST = run.stepIds.at(-1)!;
  const NOW = '2026-11-07T00:00:00.000Z';
  const inserted = withInserted(newSandbox(snapshot, LAST, NOW), LAST, 'tpl.pay_dividends_cash', { amount: 100_000 }, NOW);
  const replay = replayLab(asCoreStory(sandboxStory(snapshot, inserted)));
  if (!replay.ok) throw new Error('插入股利後重播失敗');
  const sandbox = replay.value;
  const dividend = sandbox.stepIds.at(-1)!;
  const last = sandbox.stepById(dividend)!;
  const re = traceLabLine(sandbox, last, 'cumulative', 'bs_retained_earnings');

  /** 畫面上的公式：列出來的子節點（依運算符號）加上科目那幾列 */
  const shownSum = (node: TraceNode): number => {
    const ops = childOperators(node);
    return (
      splitChildren(node).shown.reduce((acc, c) => acc + (ops.get(c.line) === '－' ? -c.value : c.value), 0) +
      ownParts(node).reduce((acc, p) => acc + p.amount, 0)
    );
  };

  it('未分配盈餘：本期淨利加科目那一列等於列值，股利那一步在來源步驟裡', () => {
    expect(re.value).toBe(last.after.lines.get('bs_retained_earnings')?.value);
    expect(re.children.map((c) => c.line)).toEqual(['is_net_income']);
    expect(ownParts(re)).toEqual([{ account: 'retained_earnings', amount: -100_000, op: '－' }]);
    expect(shownSum(re)).toBe(re.value);
    const steps = sourceSteps(re);
    expect(steps.map((s) => s.stepId)).toEqual([dividend]);
    expect(steps[0]!.contribution).toBe(-100_000);
    expect(steps[0]!.lines[0]).toMatchObject({ account: 'retained_earnings', side: 'debit', amount: 100_000 });
  });

  it('沒有股利時沒有科目那一列；沒有畫出子節點的列也沒有（科目層就是最底層）', () => {
    expect(ownParts(traceLabLine(run, step7, 'cumulative', 'bs_retained_earnings'))).toEqual([]);
    expect(ownParts(traceLabLine(run, step7, 'cumulative', 'is_outsourcing_expense'))).toEqual([]);
    expect(ownParts(traceLabLine(run, run.stepById(FIRST)!, 'cumulative', 'bs_retained_earnings'))).toEqual([]);
  });

  it('掃過整棵樹：只有未分配盈餘同時有子節點與科目層，其他公式列不受影響', () => {
    const seen = new Set<string>();
    const walk = (node: TraceNode) => {
      if (ownParts(node).length > 0) seen.add(node.line);
      node.children.forEach(walk);
    };
    for (const id of ['bs_total_equity', 'bs_total_liabilities_equity', 'bs_total_assets', 'cf_cash_end', 'is_net_income']) {
      if (statementOf(sandbox.ctx.layout, id) !== null) walk(traceLabLine(sandbox, last, 'cumulative', id));
    }
    expect([...seen]).toEqual(['bs_retained_earnings']);
  });
});

describe('聚焦的位置與路徑', () => {
  const target = { kind: 'ratio', ratioRef: 'days_sales_outstanding@excel' } as const;

  it('指標目標：連鎖指標、公式樹、往下鑽都在路徑上，每一段都回得去', () => {
    const start = startFocus(target);
    expect(start).toEqual({ ratios: [], lineRoot: null, path: [] });
    expect(focusTrail(target, start).map((c) => c.ref)).toEqual(['days_sales_outstanding@excel']);
    const chained = focusRatio(start, 'ar_turnover@excel');
    expect(chained).toEqual({ ratios: ['ar_turnover@excel'], lineRoot: null, path: [] });
    const line = focusLine(chained, 'is_revenue');
    const deep = focusDeeper(line, ['a', 'b']);
    const trail = focusTrail(target, deep);
    expect(trail.map((c) => [c.kind, c.ref])).toEqual([
      ['ratio', 'days_sales_outstanding@excel'],
      ['ratio', 'ar_turnover@excel'],
      ['line', 'is_revenue'],
      ['line', 'a'],
      ['line', 'b'],
    ]);
    expect(new Set(trail.map((c) => c.key)).size).toBe(trail.length);
    expect(trail[0]!.focus).toEqual(start);
    expect(trail[1]!.focus).toEqual(chained);
    expect(trail[2]!.focus).toEqual(line);
    expect(trail[3]!.focus.path).toEqual(['a']);
    expect(trail[4]!.focus).toEqual(deep);
  });

  it('線目標：路徑從那條線開始；目標是 null 時沒有根', () => {
    const lineTarget = { kind: 'line', lineId: 'is_operating_income' } as const;
    expect(focusTrail(lineTarget, startFocus(lineTarget)).map((c) => c.ref)).toEqual(['is_operating_income']);
    expect(startFocus(null).lineRoot).toBeNull();
  });
});

describe('連鎖指標的規格', () => {
  const core: Parameters<typeof ratioSpecOf>[0] = labCore;

  it('用 ratioRef 查到來源版本自己的單位、位數與 termRef', () => {
    const dso = ratioSpecOf(core, 'days_sales_outstanding@excel')!;
    expect(dso.unit).toBe('days');
    const chained = ratioSpecOf(core, 'ar_turnover@excel')!;
    expect(chained).toMatchObject({ id: 'ar_turnover', unit: 'turnover' });
    expect(chained.termRef.length).toBeGreaterThan(0);
    expect(chained.numerator).toBeDefined();
    expect(chained.denominator).toBeDefined();
    expect(ratioSpecOf(core, 'nope@excel')).toBeNull();
    expect(ratioSpecOf(core, 'nope')).toBeNull();
    // 這個指標沒有這個版本
    expect(ratioSpecOf(core, 'eps@dupont')).toBeNull();
  });

  it('連鎖的每一層都查得到規格與結果：平均收現日數、平均銷貨日數、杜邦版的 ROA 與 ROE', () => {
    const results = new Map(step7.ratiosAfter.map((r) => [r.ratioRef, r]));
    for (const ref of ['days_sales_outstanding@excel', 'days_inventory@excel', 'roa@dupont', 'roe@dupont', 'cash_conversion_cycle@slides03']) {
      const spec = ratioSpecOf(core, ref)!;
      const parts = ratioParts(spec);
      const chained = [...parts.expr, ...parts.numerator, ...parts.denominator].filter((p) => p.kind === 'ratio');
      expect(chained.length, ref).toBeGreaterThan(0);
      for (const p of chained) {
        expect(ratioSpecOf(core, p.ref), p.ref).not.toBeNull();
        expect(results.get(p.ref), p.ref).toBeDefined();
      }
    }
  });

  it('輸入值帶著兩種語言的名稱：每股面額還在', () => {
    const eps = ratioSpecOf(core, 'eps@excel')!;
    expect(ratioParts(eps).denominator).toContainEqual({ kind: 'input', ref: 'par_value' });
    expect(eps.inputs?.['par_value']?.label).toEqual({ 'zh-TW': '每股面額', en: 'Par value per share' });
    // ratioSpecs 也帶同一份
    expect(ratioSpecs(core, 'excel').find((s) => s.id === 'eps')?.inputs?.['par_value']).toBeDefined();
  });
});

describe('由存貨帳推導的列', () => {
  it('本期進貨與期末存貨是；其他列（包括存貨餘額）不是', () => {
    expect(isDerivedInventoryLine(layout, 'is_purchases')).toBe(true);
    expect(isDerivedInventoryLine(layout, 'is_closing_inventory')).toBe(true);
    expect(isDerivedInventoryLine(layout, 'bs_inventory')).toBe(false);
    expect(isDerivedInventoryLine(layout, 'is_cogs')).toBe(false);
    expect(isDerivedInventoryLine(layout, 'nope')).toBe(false);
  });
});

describe('指標公式的參照', () => {
  it('分子分母各自列出引用的線；連鎖指標列出 ratio；輸入值列出 input；重複的只留一個', () => {
    expect(ratioParts({ numerator: 'line.is_net_income', denominator: 'line.bs_total_assets' })).toEqual({
      numerator: [{ kind: 'line', ref: 'is_net_income' }],
      denominator: [{ kind: 'line', ref: 'bs_total_assets' }],
      expr: [],
    });
    expect(partsOf('365 / ratio.ar_turnover.excel')).toEqual([{ kind: 'ratio', ref: 'ar_turnover@excel' }]);
    expect(partsOf('line.bs_share_capital / input.par_value')).toEqual([
      { kind: 'line', ref: 'bs_share_capital' },
      { kind: 'input', ref: 'par_value' },
    ]);
    expect(partsOf('-line.cf_capex + max(-line.cf_inventory_increase, 0) - line.cf_dividends_paid + line.cf_capex')).toEqual([
      { kind: 'line', ref: 'cf_capex' },
      { kind: 'line', ref: 'cf_inventory_increase' },
      { kind: 'line', ref: 'cf_dividends_paid' },
    ]);
    expect(partsOf(undefined)).toEqual([]);
  });

  it('給了版面時，版面沒有的列不列出來：ifrs@1 的現金再投資比率沒有設立費與開發費，毛額與進貨這些不顯示的計算列還在', () => {
    const spec = ratioSpecOf(labCore, 'cash_reinvestment@slides03')!;
    const denominator = (l: typeof layout) => ratioParts(spec, l).denominator.map((p) => p.ref);
    expect(denominator(layout)).toContain('bs_deferred_org_costs');
    expect(denominator(ifrsLayout)).not.toContain('bs_deferred_org_costs');
    expect(denominator(ifrsLayout)).not.toContain('bs_deferred_dev_costs');
    expect(denominator(ifrsLayout)).toContain('bs_ppe_gross');
    const apTurnover = ratioSpecOf(labCore, 'ap_turnover@excel')!;
    expect(ratioParts(apTurnover, ifrsLayout).numerator).toEqual([{ kind: 'line', ref: 'is_purchases' }]);
  });
});
