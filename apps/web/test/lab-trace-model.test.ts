// oxlint-disable vitest/valid-expect, vitest/no-conditional-expect -- expect 的第二個引數是失敗時指出哪一列的訊息；逐列檢查寫成迴圈
// 來源面板的純函式（features/lab/trace-model.ts）與 lab-core 的追蹤包裝：跨表對應由版面推得；0 元沒有來源的子節點被收起來；
// 公式裡的正負號；來源分錄行依步驟分組且貢獻加總等於列值（累計視窗扣掉期初）；往下鑽的路徑；traceLabLine 等於直接呼叫核心的 traceLine。
import { describe, expect, it } from 'vitest';
import { createCoreContext, replayStory, traceLine, type Story } from '@ledgerland/core';
import officialJson from '../../../content/stories/story_ywv2dy.json' with { type: 'json' };
import { asCoreStory, entriesOfStep, replayLab, traceLabLine } from '../src/features/lab/lab-core.ts';
import {
  childOperators,
  crossLinks,
  isEmptyNode,
  nodeAtPath,
  partsOf,
  ratioParts,
  sourceSteps,
  splitChildren,
  statementOf,
} from '../src/features/lab/trace-model.ts';
import type { StorySnapshot } from '../src/lib/content.ts';

const snapshot = officialJson as unknown as StorySnapshot;
const lab = replayLab(asCoreStory(snapshot));
if (!lab.ok) throw new Error('replayLab 失敗');
const run = lab.value;
const layout = run.ctx.layout;
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

  it('entriesOfStep：沒有這一步是空陣列', () => {
    expect(entriesOfStep(run, 'st_nope')).toEqual([]);
    expect(entriesOfStep(run, STEP7).length).toBeGreaterThan(0);
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
});
