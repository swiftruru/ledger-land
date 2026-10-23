// oxlint-disable vitest/no-conditional-expect, vitest/valid-expect -- 逐列走訪時只對有來源的節點比對；expect 的第二個引數是失敗時指出哪一列的訊息
// 追蹤樹（04 第 6.4 節的範例與規則、第 18.1 節的追蹤不變式）：青檸文具社第 7 步之後的營業毛利、本筆變動視窗、各種列的規則、快取與決定性。自編數字。
import { describe, expect, it } from 'vitest';
import {
  type CoreContext,
  type Layout,
  type StatementWindow,
  type TraceNode,
  TRACE_RULES,
  buildStatements,
  canonicalJson,
  createCoreContext,
  createLedger,
  formulaRefsInOrder,
  lineValue,
  postStep,
  replayStory,
  sumOfParts,
  teacherLayout,
  traceAllLines,
  traceLine,
  traceRuleOf,
  unwrap,
  verifyTraceTree,
  windowKey,
} from '../src/index.ts';
import { LIME_LEAF_STEP_IDS as S, limeLeafStory } from './fixtures/story-lime-leaf.ts';

const ctx: CoreContext = createCoreContext();
const run = unwrap(replayStory(limeLeafStory, [], ctx));
const cumulative = (to: string | null): StatementWindow => ({ kind: 'cumulative', to });
const transaction = (step: string): StatementWindow => ({ kind: 'transaction', step });
const trace = (win: StatementWindow, line: string, layout: Layout = ctx.layout): TraceNode => traceLine(run, win, layout, ctx.policy, line);

/** 走訪整棵樹 */
function walk(node: TraceNode, f: (n: TraceNode) => void): void {
  f(node);
  for (const ch of node.children) walk(ch, f);
}

describe('04 第 6.4 節的範例：第 7 步之後累計視窗的營業毛利 480,000', () => {
  const tree = trace(cumulative(S.sellCash), 'is_gross_profit');

  it('樹根：formula 列、公式與兩個子節點', () => {
    expect(tree).toMatchObject({
      line: 'is_gross_profit',
      cell: 'R16',
      value: 480_000,
      rule: 'formula',
      expr: 'line.is_revenue - line.is_cogs',
      accounts: [],
      sources: [],
    });
    expect(tree.children.map((c) => c.line)).toEqual(['is_revenue', 'is_cogs']);
  });

  it('營業收入：accounts 列，來源是第 7 步的貸方行', () => {
    expect(tree.children[0]).toEqual({
      line: 'is_revenue',
      cell: 'R10',
      value: 1_120_000,
      rule: 'accounts',
      children: [],
      accounts: [
        {
          account: 'revenue',
          sign: 1,
          opening: 0,
          amount: 1_120_000,
          sources: [{ stepId: S.sellCash, eventId: 'e1', lineRef: 'e1.l2', side: 'credit', amount: 1_120_000, signedAmount: 1_120_000 }],
        },
      ],
      sources: [],
    });
  });

  it('營業成本：公式列，存貨子節點依公式順序，各自的來源不同（版面公式比 04 的範例多一列盤盈，teacher@1 下為 0）', () => {
    const cogs = tree.children[1];
    expect(cogs).toMatchObject({
      line: 'is_cogs',
      cell: 'R15',
      value: 640_000,
      rule: 'formula',
      expr: 'line.is_opening_inventory + line.is_purchases + line.is_inventory_overage_excluded - line.is_closing_inventory',
      accounts: [],
      sources: [],
    });
    expect(cogs?.children).toEqual([
      {
        line: 'is_opening_inventory',
        cell: 'R12',
        value: 0,
        rule: 'inventory',
        children: [],
        accounts: [{ account: 'inventory', sign: 1, opening: 0, amount: 0, sources: [] }],
        sources: [],
      },
      {
        line: 'is_purchases',
        cell: 'R13',
        value: 640_000,
        rule: 'inventory',
        children: [],
        accounts: [
          {
            account: 'inventory',
            sign: 1,
            opening: 0,
            amount: 640_000,
            sources: [{ stepId: S.purchaseCash, eventId: 'e1', lineRef: 'e1.l1', side: 'debit', amount: 640_000, signedAmount: 640_000 }],
          },
        ],
        sources: [],
      },
      {
        line: 'is_inventory_overage_excluded',
        cell: null,
        value: 0,
        rule: 'inventory',
        children: [],
        accounts: [],
        sources: [],
        note: { key: 'trace.not_in_policy', params: { policy: 'teacher@1' } },
      },
      {
        line: 'is_closing_inventory',
        cell: 'R14',
        value: 0,
        rule: 'inventory',
        children: [],
        accounts: [
          {
            account: 'inventory',
            sign: 1,
            opening: 0,
            amount: 0,
            sources: [
              { stepId: S.purchaseCash, eventId: 'e1', lineRef: 'e1.l1', side: 'debit', amount: 640_000, signedAmount: 640_000 },
              { stepId: S.sellCash, eventId: 'e1', lineRef: 'e1.l4', side: 'credit', amount: 640_000, signedAmount: -640_000 },
            ],
          },
        ],
        sources: [],
      },
    ]);
  });

  it('不變式全部成立；樹根等於報表列值', () => {
    const st = buildStatements(run, cumulative(S.sellCash), ctx.layout, ctx.policy);
    const v = verifyTraceTree(tree, ctx.layout, { statements: st });
    expect(v).toEqual({ pass: true, failures: [], nodes: 7 });
    expect(tree.value).toBe(lineValue(st, 'is_gross_profit').value);
  });
});

describe('本筆變動視窗', () => {
  it('只列這一步的分錄行，數值是本筆變動', () => {
    const tree = trace(transaction(S.sellCash), 'is_gross_profit');
    expect(tree.value).toBe(480_000);
    walk(tree, (n) => {
      for (const a of n.accounts) {
        expect(a.opening).toBe(0);
        for (const s of a.sources) expect(s.stepId).toBe(S.sellCash);
      }
      for (const s of n.sources) expect(s.stepId).toBe(S.sellCash);
    });
    // 期末存貨這一步由 640,000 變成 0：本筆變動 -640,000，只有第 7 步的貸方行
    const closing = tree.children[1]?.children[3];
    expect(closing).toMatchObject({ line: 'is_closing_inventory', value: -640_000 });
    expect(closing?.accounts[0]?.sources).toEqual([
      { stepId: S.sellCash, eventId: 'e1', lineRef: 'e1.l4', side: 'credit', amount: 640_000, signedAmount: -640_000 },
    ]);
  });

  it('現金行列（cash_tag）直接列出現金行；第 12 步收回帳款只有一條流入', () => {
    const tree = trace(transaction(S.collect), 'dc_receipts_from_customers');
    expect(tree.rule).toBe('cash_tag');
    expect(tree.accounts).toEqual([]);
    expect(tree.sources).toEqual([{ stepId: S.collect, eventId: 'e1', lineRef: 'e1.l1', side: 'debit', amount: 3_900_000, signedAmount: 3_900_000 }]);
    expect(tree.value).toBe(3_900_000);
  });

  it('各步本筆變動的樹根加總等於累計樹根', () => {
    let total = 0;
    for (const step of run.steps) total += trace(transaction(step.stepId), 'bs_cash').value;
    expect(total).toBe(trace(cumulative(null), 'bs_cash').value);
  });
});

describe('各種列的規則', () => {
  const all = traceAllLines(run, cumulative(null), ctx.layout, ctx.policy);
  const byLine = new Map(all.map((n) => [n.line, n]));
  const node = (id: string): TraceNode => {
    const n = byLine.get(id);
    if (n === undefined) throw new Error(id);
    return n;
  };

  it('版面 kind 對追蹤規則', () => {
    expect(traceRuleOf('inventory_opening')).toBe('inventory');
    expect(traceRuleOf('inventory_overage')).toBe('inventory');
    expect(traceRuleOf('formula')).toBe('formula');
    expect(traceRuleOf('total')).toBe('total');
    expect(traceRuleOf('balance_end')).toBe('balance_end');
    expect(traceRuleOf('group')).toBe('group');
    const seen = new Set(all.map((n) => n.rule));
    for (const rule of TRACE_RULES) expect(seen.has(rule), rule).toBe(true);
  });

  it('link 列指向來源列；total 與 balance_end 列的子節點相加', () => {
    const h11 = node('cf_pretax_income');
    expect(h11).toMatchObject({ rule: 'link', accounts: [], sources: [] });
    expect(h11.children.map((c) => c.line)).toEqual(['is_pretax_income']);
    expect(h11.value).toBe(h11.children[0]?.value);
    const total = node('bs_total_assets');
    expect(total.rule).toBe('total');
    expect(total.children.length).toBeGreaterThan(1);
    expect(sumOfParts(total)).toBe(total.value);
    const end = node('cf_cash_end');
    expect(end.rule).toBe('balance_end');
    expect(end.value).toBe(node('bs_cash').value);
    expect(end.children.map((c) => c.line)).toContain('cf_net_change');
  });

  it('未分配盈餘：一個科目層加一個本期淨利子節點（W05）', () => {
    const re = node('bs_retained_earnings');
    expect(re.rule).toBe('retained_earnings');
    expect(re.accounts.map((a) => a.account)).toEqual(['retained_earnings']);
    expect(re.children.map((c) => c.line)).toEqual(['is_net_income']);
    expect(re.value).toBe((re.accounts[0]?.amount ?? 0) + (re.children[0]?.value ?? 0));
  });

  it('抵銷科目以 -1 進入；金額以正常餘額表示', () => {
    const net = node('bs_machinery_net');
    expect(net.accounts.map((a) => [a.account, a.sign, a.amount])).toEqual([
      ['machinery_equipment', 1, 360_000],
      ['accumulated_depreciation_machinery', -1, 90_000],
    ]);
    expect(net.value).toBe(270_000);
    const dep = node('cf_depreciation');
    expect(dep).toMatchObject({ rule: 'noncash_addback', value: 90_000, accounts: [{ account: 'depreciation_expense', sign: 1, amount: 90_000 }] });
  });

  it('H15 與 H17 擇一：被歸 0 的那一列沒有科目層，註記指向實際填入的列', () => {
    const inc = node('cf_receivables_increase');
    const dec = node('cf_receivables_decrease');
    expect(inc).toMatchObject({ rule: 'working_capital', value: -1_700_000 });
    expect(inc.accounts.map((a) => [a.account, a.sign, a.amount])).toEqual([['accounts_receivable', -1, 1_700_000]]);
    expect(inc.note).toBeUndefined();
    expect(dec).toMatchObject({ value: 0, accounts: [], note: { key: 'trace.filled_in_other_line', params: { line: 'cf_receivables_increase' } } });
  });

  it('盤盈列在 teacher@1 下不適用：值為 0、沒有科目層、註記政策', () => {
    expect(node('is_inventory_overage_excluded')).toMatchObject({
      rule: 'inventory',
      value: 0,
      accounts: [],
      note: { key: 'trace.not_in_policy', params: { policy: 'teacher@1' } },
    });
  });

  it('群組列值為 0、沒有子節點；期初餘額列只有 opening', () => {
    expect(node('cf_operating_group')).toMatchObject({ rule: 'group', value: 0, children: [], accounts: [] });
    expect(node('cf_cash_begin')).toMatchObject({
      rule: 'balance_begin',
      value: 0,
      accounts: [{ account: 'cash', sign: 1, opening: 0, amount: 0, sources: [] }],
    });
  });

  it('每一條線的樹都通過不變式，每個來源都指得到分錄行', () => {
    const st = buildStatements(run, cumulative(null), ctx.layout, ctx.policy);
    for (const n of all) {
      const v = verifyTraceTree(n, ctx.layout, { statements: st });
      expect(v.failures, n.line).toEqual([]);
    }
  });
});

describe('自訂期初的 opening', () => {
  it('累計視窗的餘額型列把期初帶在 opening，sources 只有視窗內的行，不變式仍成立', () => {
    let state = createLedger(ctx.chart, { cash: 500_000, inventory: 200_000, share_capital: -700_000 });
    state = unwrap(
      postStep(state, { id: 'st_000001', events: [{ id: 'e1', template: 'tpl.sell_all_inventory_cash', params: { price: 350_000 } }] }, ctx),
    ).state;
    const r = { steps: state.steps, finalState: state };
    const cash = traceLine(r, cumulative(null), ctx.layout, ctx.policy, 'bs_cash');
    expect(cash.accounts).toEqual([
      {
        account: 'cash',
        sign: 1,
        opening: 500_000,
        amount: 850_000,
        sources: [{ stepId: 'st_000001', eventId: 'e1', lineRef: 'e1.l1', side: 'debit', amount: 350_000, signedAmount: 350_000 }],
      },
    ]);
    const openingInv = traceLine(r, cumulative(null), ctx.layout, ctx.policy, 'is_opening_inventory');
    expect(openingInv.accounts).toEqual([{ account: 'inventory', sign: 1, opening: 200_000, amount: 200_000, sources: [] }]);
    const st = buildStatements(r, cumulative(null), ctx.layout, ctx.policy);
    for (const n of traceAllLines(r, cumulative(null), ctx.layout, ctx.policy))
      expect(verifyTraceTree(n, ctx.layout, { statements: st }).failures, n.line).toEqual([]);
    // 沒有步驟的 run：全部是期初
    const empty = createLedger(ctx.chart, { cash: 10_000, share_capital: -10_000 });
    const er = { steps: empty.steps, finalState: empty };
    expect(traceLine(er, cumulative(null), ctx.layout, ctx.policy, 'bs_cash')).toMatchObject({
      value: 10_000,
      accounts: [{ opening: 10_000, amount: 10_000, sources: [] }],
    });
  });
});

describe('快取、決定性與程式錯誤', () => {
  it('同一個 (run、視窗、版面、政策、線) 回同一個節點物件；不同視窗各自獨立；序列化後相同', () => {
    const a = trace(cumulative(S.sellCash), 'is_gross_profit');
    const b = trace(cumulative(S.sellCash), 'is_gross_profit');
    expect(b).toBe(a);
    expect(trace(cumulative(S.sellCredit), 'is_gross_profit')).not.toBe(a);
    const other = unwrap(replayStory(limeLeafStory, [], ctx));
    const c = traceLine(other, cumulative(S.sellCash), ctx.layout, ctx.policy, 'is_gross_profit');
    expect(c).not.toBe(a);
    expect(canonicalJson(c)).toBe(canonicalJson(a));
    expect(windowKey(cumulative(null))).toBe('cumulative:');
    expect(windowKey(transaction('st_x'))).toBe('transaction:st_x');
  });

  it('呼叫端可以傳入已建好的報表；不是同一個來源的報表是程式錯誤', () => {
    const win = cumulative(S.borrow);
    const st = buildStatements(run, win, ctx.layout, ctx.policy);
    const n = traceLine(run, win, ctx.layout, ctx.policy, 'bs_cash', { statements: st });
    expect(n.value).toBe(lineValue(st, 'bs_cash').value);
    expect(traceLine(run, win, ctx.layout, ctx.policy, 'bs_cash', { statements: st })).toBe(n);
    const otherSt = buildStatements(run, cumulative(S.collect), ctx.layout, ctx.policy);
    expect(() => traceLine(run, win, ctx.layout, ctx.policy, 'bs_cash', { statements: otherSt })).toThrow(TypeError);
  });

  it('線不存在或視窗指到不存在的步驟是程式錯誤', () => {
    expect(() => trace(cumulative(null), 'is_nothing')).toThrow(RangeError);
    expect(() => trace(cumulative('st_nope00'), 'bs_cash')).toThrow(RangeError);
  });

  it('verifyTraceTree 會指出不成立的地方', () => {
    const tree = trace(cumulative(S.sellCash), 'is_gross_profit');
    const broken: TraceNode = { ...tree, value: 1 };
    const st = buildStatements(run, cumulative(S.sellCash), ctx.layout, ctx.policy);
    const v = verifyTraceTree(broken, ctx.layout, { statements: st });
    expect(v.pass).toBe(false);
    expect(v.failures.map((f) => f.rule)).toEqual(['root_equals_line', 'formula_equals_children']);
    const revenue = tree.children[0];
    if (revenue === undefined) throw new Error('沒有子節點');
    const acct = revenue.accounts[0];
    if (acct === undefined) throw new Error('沒有科目層');
    const badSources: TraceNode = {
      ...revenue,
      accounts: [{ ...acct, sources: [{ ...(acct.sources[0] as (typeof acct.sources)[number]), lineRef: 'e1.l9' }] }],
    };
    const v2 = verifyTraceTree(badSources, ctx.layout, { run });
    expect(v2.failures.map((f) => f.rule)).toEqual(['source_resolves']);
    const badAmount: TraceNode = { ...revenue, accounts: [{ ...acct, amount: 5 }] };
    expect(verifyTraceTree(badAmount, ctx.layout).failures.map((f) => f.rule)).toEqual(['sum_equals_value', 'account_sources_sum']);
    const badCash: TraceNode = { ...trace(cumulative(S.collect), 'dc_receipts_from_customers') };
    const badCashSources: TraceNode = { ...badCash, sources: badCash.sources.map((s) => ({ ...s, eventId: 'e9' })) };
    expect(verifyTraceTree(badCashSources, ctx.layout, { run }).failures.every((f) => f.rule === 'source_resolves')).toBe(true);
    expect(() => verifyTraceTree({ ...tree, line: 'is_nothing' }, ctx.layout, { statements: st })).toThrow(RangeError);
    expect(() => verifyTraceTree({ ...tree, children: [] }, ctx.layout)).toThrow(RangeError);
    expect(() => verifyTraceTree({ ...revenue, rule: 'formula' }, ctx.layout)).toThrow(RangeError);
  });

  it('formulaRefsInOrder 依公式出現順序、不重複', () => {
    expect(
      formulaRefsInOrder({
        type: 'binary',
        op: '+',
        left: { type: 'ref', ns: 'line', name: 'b' },
        right: { type: 'unary', op: '-', operand: { type: 'ref', ns: 'line', name: 'a' } },
      }),
    ).toEqual(['b', 'a']);
    expect(
      formulaRefsInOrder({
        type: 'call',
        fn: 'max',
        args: [
          { type: 'ref', ns: 'line', name: 'a' },
          { type: 'ref', ns: 'line', name: 'a' },
          { type: 'number', value: '0' },
        ],
      }),
    ).toEqual(['a']);
    expect(formulaRefsInOrder({ type: 'ref', ns: 'param', name: 'x' })).toEqual([]);
  });

  it('版面物件相同但列值不同的政策各自快取', () => {
    const ifrs = createCoreContext({ policy: 'ifrs@1' });
    const ifrsRun = unwrap(replayStory(limeLeafStory, [], ifrs));
    const a = traceLine(ifrsRun, cumulative(null), teacherLayout, ifrs.policy, 'is_net_income');
    const b = traceLine(ifrsRun, cumulative(null), teacherLayout, ctx.policy, 'is_net_income');
    expect(a).not.toBe(b);
    const st = buildStatements(ifrsRun, cumulative(null), teacherLayout, ifrs.policy);
    for (const n of traceAllLines(ifrsRun, cumulative(null), teacherLayout, ifrs.policy))
      expect(verifyTraceTree(n, teacherLayout, { statements: st }).failures, n.line).toEqual([]);
  });
});
