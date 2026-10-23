// 情境求解（04 第 15.1、15.2 節、第 17.2 節的交易影響題）：故事期初與自訂期初、line、account、ratio、check 四種 target、
// 兩種視窗、每個 scenario.* 錯誤碼、步驟錯誤透傳、分錄題的正解。自編數字。
import { describe, expect, it } from 'vitest';
import {
  type CoreContext,
  type Scenario,
  type ScenarioAnswer,
  type Story,
  type Target,
  type TransactionTemplate,
  SCENARIO_STEP_ID,
  createCoreContext,
  defaultTemplates,
  expectedJournalEntries,
  solveScenario,
  traceLine,
  unwrap,
  verifyTraceTree,
} from '../src/index.ts';
import { LIME_LEAF_STEP_IDS as S, limeLeafStory } from './fixtures/story-lime-leaf.ts';

const ctx: CoreContext = createCoreContext();
const stories: ReadonlyMap<string, Story> = new Map([[limeLeafStory.id, limeLeafStory]]);
const options = { stories };

const base = { policy: 'teacher@1', layout: 'teacher@1', window: 'cumulative' } as const;
const sellAll = (price: number) => [{ id: 'e1', template: 'tpl.sell_all_inventory_cash', params: { price } }];
const solve = (s: Scenario): ScenarioAnswer => unwrap(solveScenario(s, ctx, options));
const failCode = (s: Scenario): string => {
  const r = solveScenario(s, ctx, options);
  if (r.ok) throw new Error('預期失敗');
  return r.error.code;
};
const custom = (balances: Record<string, number>, events: Scenario['events'], targets: Target[], window: Scenario['window'] = 'cumulative'): Scenario => ({
  ...base,
  window,
  opening: { balances },
  events,
  targets,
});

/** 04 第 17.2 節的題目 */
const q172: Scenario = {
  ...base,
  opening: { storyRef: limeLeafStory.id, afterStep: S.purchaseCash },
  events: sellAll(1_120_000),
  targets: [
    { id: 't1', kind: 'line', line: 'bs_cash', measure: 'direction' },
    { id: 't2', kind: 'line', line: 'bs_inventory', measure: 'direction' },
    { id: 't3', kind: 'line', line: 'is_gross_profit', measure: 'direction' },
    { id: 't4', kind: 'line', line: 'cf_operating_total', measure: 'direction' },
  ],
};

describe('04 第 17.2 節：賣出全部存貨的交易影響題', () => {
  const answer = solve(q172);

  it('expected 逐欄位等於文件', () => {
    expect(answer.expected).toEqual({
      t1: { direction: 'up', before: 1_094_000, after: 2_214_000, delta: 1_120_000 },
      t2: { direction: 'down', before: 640_000, after: 0, delta: -640_000 },
      t3: { direction: 'up', before: 0, after: 480_000, delta: 480_000 },
      t4: { direction: 'up', before: -796_000, after: 324_000, delta: 1_120_000 },
    });
  });

  it('values 含事件參數與推導值', () => {
    expect(answer.values).toEqual({ 'e1.price': 1_120_000, 'e1.costOfAllInventory': 640_000, 'e1.grossProfit': 480_000 });
  });

  it('steps 只有情境那一步；run 是故事到第 6 步加情境；期初步驟是 afterStep', () => {
    expect(answer.steps.map((s) => s.stepId)).toEqual([SCENARIO_STEP_ID]);
    expect(answer.run.steps.map((s) => s.stepId)).toEqual([...limeLeafStory.steps.slice(0, 6).map((s) => s.id), SCENARIO_STEP_ID]);
    expect(answer.openingStepId).toBe(S.purchaseCash);
    const tree = traceLine(answer.run, { kind: 'transaction', step: SCENARIO_STEP_ID }, ctx.layout, ctx.policy, 'is_gross_profit');
    expect(tree.value).toBe(480_000);
    expect(verifyTraceTree(tree, ctx.layout, { run: answer.run }).pass).toBe(true);
  });

  it('分錄題的正解：合併同科目同方向、依科目表 order 排序', () => {
    expect(expectedJournalEntries(answer)).toEqual([
      { account: 'cash', side: 'debit', amount: 1_120_000 },
      { account: 'inventory', side: 'credit', amount: 640_000 },
      { account: 'revenue', side: 'credit', amount: 1_120_000 },
      { account: 'cost_of_goods_sold', side: 'debit', amount: 640_000 },
    ]);
  });

  it('同一題解兩次得到相同答案', () => {
    expect(solve(q172).expected).toEqual(answer.expected);
  });

  it('transaction 視窗：direction 不變，before 為 0、after 與 delta 是本筆變動', () => {
    const tx = solve({
      ...q172,
      window: 'transaction',
      targets: [
        { id: 't1', kind: 'line', line: 'bs_cash', measure: 'value' },
        { id: 't2', kind: 'line', line: 'bs_inventory', measure: 'delta' },
      ],
    });
    expect(tx.expected).toEqual({
      t1: { direction: 'up', before: 0, after: 1_120_000, delta: 1_120_000 },
      t2: { direction: 'down', before: 0, after: -640_000, delta: -640_000 },
    });
  });

  it('account target 以正常餘額表示；transaction 視窗同樣是本筆變動', () => {
    const targets: Target[] = [
      { id: 't1', kind: 'account', account: 'inventory', measure: 'direction' },
      { id: 't2', kind: 'account', account: 'revenue', measure: 'delta' },
    ];
    expect(solve({ ...q172, targets }).expected).toEqual({
      t1: { direction: 'down', before: 640_000, after: 0, delta: -640_000 },
      t2: { direction: 'up', before: 0, after: 1_120_000, delta: 1_120_000 },
    });
    expect(solve({ ...q172, window: 'transaction', targets }).expected).toEqual({
      t1: { direction: 'down', before: 0, after: -640_000, delta: -640_000 },
      t2: { direction: 'up', before: 0, after: 1_120_000, delta: 1_120_000 },
    });
  });

  it('check target：步驟 2 到 5 的差額都是 0', () => {
    const targets: Target[] = ([2, 3, 4, 5] as const).map((step) => ({ id: `t${step}`, kind: 'check', step, measure: 'value' }));
    const r = solve({ ...q172, targets });
    for (const step of [2, 3, 4, 5]) expect(r.expected[`t${step}`]).toEqual({ direction: 'unchanged', before: 0, after: 0, delta: 0 });
  });

  it('多個事件依序套用，後一個看得到前一個的結果', () => {
    const r = solve({
      ...q172,
      events: [
        { id: 'e1', template: 'tpl.purchase_inventory_cash', params: { amount: 100_000 } },
        { id: 'e2', template: 'tpl.sell_all_inventory_cash', params: { price: 1_000_000 } },
      ],
      targets: [{ id: 't1', kind: 'line', line: 'is_cogs', measure: 'value' }],
    });
    expect(r.expected['t1']).toEqual({ direction: 'up', before: 0, after: 740_000, delta: 740_000 });
    expect(r.values['e2.costOfAllInventory']).toBe(740_000);
    expect(r.values['e1.amount']).toBe(100_000);
  });
});

describe('自訂期初', () => {
  it('平衡的期初：以正常餘額給，抵銷科目反號併入', () => {
    const r = solve(
      custom(
        {
          cash: 500_000,
          inventory: 200_000,
          machinery_equipment: 120_000,
          accumulated_depreciation_machinery: 20_000,
          short_term_borrowings: 100_000,
          share_capital: 700_000,
        },
        sellAll(350_000),
        [
          { id: 't1', kind: 'line', line: 'bs_cash', measure: 'direction' },
          { id: 't2', kind: 'line', line: 'is_gross_profit', measure: 'value' },
          { id: 't3', kind: 'line', line: 'is_opening_inventory', measure: 'value' },
          { id: 't4', kind: 'check', step: 5, measure: 'value' },
        ],
      ),
    );
    expect(r.openingStepId).toBeNull();
    expect(r.expected).toEqual({
      t1: { direction: 'up', before: 500_000, after: 850_000, delta: 350_000 },
      t2: { direction: 'up', before: 0, after: 150_000, delta: 150_000 },
      t3: { direction: 'unchanged', before: 200_000, after: 200_000, delta: 0 },
      t4: { direction: 'unchanged', before: 0, after: 0, delta: 0 },
    });
    expect(r.run.steps.map((s) => s.stepId)).toEqual([SCENARIO_STEP_ID]);
  });

  it('不平衡：scenario.opening_unbalanced 附三邊合計與差額', () => {
    const r = solveScenario(custom({ cash: 500_000, share_capital: 400_000 }, [], []), ctx, options);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatchObject({ code: 'scenario.opening_unbalanced', assets: 500_000, liabilities: 0, equity: 400_000, diff: 100_000 });
  });

  it('不合法的科目：不存在、不是資產負債表科目、政策下未啟用、不是安全整數、違反餘額規則', () => {
    const reasonOf = (balances: Record<string, number>): unknown => {
      const r = solveScenario(custom(balances, [], []), ctx, options);
      if (r.ok) throw new Error('預期失敗');
      expect(r.error.code).toBe('scenario.opening_invalid_account');
      return [r.error['account'], r.error['reason']];
    };
    expect(reasonOf({ cash: 1, nothing: 1 })).toEqual(['nothing', 'unknown_account']);
    expect(reasonOf({ cash: 1, revenue: 1 })).toEqual(['revenue', 'not_balance_sheet']);
    expect(reasonOf({ cash: 1, prepaid_expenses: 1 })).toEqual(['prepaid_expenses', 'disabled']);
    expect(reasonOf({ cash: 1.5, share_capital: 1.5 })).toEqual(['cash', 'not_money']);
    expect(reasonOf({ machinery_equipment: 50_000, accumulated_depreciation_machinery: 80_000, cash: 100_000, share_capital: 70_000 })).toEqual([
      'machinery_equipment',
      'balance_rule',
    ]);
  });

  it('空的期初與沒有事件也能解', () => {
    const r = solve(custom({}, [], [{ id: 't1', kind: 'line', line: 'bs_total_assets', measure: 'value' }]));
    expect(r.expected['t1']).toEqual({ direction: 'unchanged', before: 0, after: 0, delta: 0 });
    expect(r.values).toEqual({});
    expect(expectedJournalEntries(r)).toEqual([]);
  });
});

describe('ratio target', () => {
  const ratio = (ratioRef: string, measure: Target['measure'] = 'direction'): Target => ({ id: 't1', kind: 'ratio', ratioRef, measure });

  it('N/A 變成數字是 becomes_computable；before 為 null、沒有 delta', () => {
    const r = solve(
      custom(
        { cash: 100_000, share_capital: 100_000 },
        [{ id: 'e1', template: 'tpl.borrow_short_term', params: { amount: 50_000 } }],
        [ratio('current_ratio@excel')],
      ),
    );
    expect(r.expected['t1']).toEqual({ direction: 'becomes_computable', before: null, after: 3, status: 'ok' });
  });

  it('數字變成 N/A 是 becomes_na', () => {
    const r = solve(
      custom(
        { cash: 100_000, short_term_borrowings: 40_000, share_capital: 60_000 },
        [{ id: 'e1', template: 'tpl.repay_all_short_term_loans_with_interest', params: { interest: 0 } }],
        [ratio('current_ratio@excel')],
      ),
    );
    expect(r.expected['t1']).toEqual({ direction: 'becomes_na', before: 2.5, after: null, status: 'na' });
  });

  it('兩端都是 N/A 是 unchanged；兩端都有數字時 delta 依顯示位數', () => {
    const na = solve(
      custom(
        { cash: 100_000, share_capital: 100_000 },
        [{ id: 'e1', template: 'tpl.issue_shares_cash', params: { amount: 1 } }],
        [ratio('current_ratio@excel')],
      ),
    );
    expect(na.expected['t1']).toEqual({ direction: 'unchanged', before: null, after: null, status: 'na' });
    const r = solve(
      custom(
        { cash: 2_700_000, short_term_borrowings: 900_000, share_capital: 1_800_000 },
        [{ id: 'e1', template: 'tpl.borrow_short_term', params: { amount: 1_000_000 } }],
        [ratio('debt_ratio@excel', 'value')],
      ),
    );
    expect(r.expected['t1']).toEqual({ direction: 'up', before: 33.33, after: 51.35, delta: 18.02, status: 'ok' });
  });

  it('精確值有變但顯示值相同：direction 題回 scenario.direction_ambiguous；value 題照常', () => {
    const balances = { cash: 2_700_000, short_term_borrowings: 900_000, share_capital: 1_800_000 };
    const events = [{ id: 'e1', template: 'tpl.borrow_short_term', params: { amount: 1 } }];
    expect(failCode(custom(balances, events, [ratio('debt_ratio@excel')]))).toBe('scenario.direction_ambiguous');
    expect(solve(custom(balances, events, [ratio('debt_ratio@excel', 'value')])).expected['t1']).toEqual({
      direction: 'unchanged',
      before: 33.33,
      after: 33.33,
      delta: 0,
      status: 'ok',
    });
  });

  it('前後任一端是 not_meaningful：direction 題回 scenario.direction_not_meaningful；status 題照常', () => {
    const balances = { cash: 100_000, share_capital: 100_000 };
    const events = [{ id: 'e1', template: 'tpl.pay_outsourcing_cash', params: { amount: 10_000 } }];
    expect(failCode(custom(balances, events, [ratio('dol@excel')]))).toBe('scenario.direction_not_meaningful');
    expect(solve(custom(balances, events, [ratio('dol@excel', 'status')])).expected['t1']).toMatchObject({ status: 'not_meaningful', before: null });
    // excel 版的 not_meaningful 保留數值，其他版本為 null；兩者都不算「能比較」
    expect(solve(custom(balances, events, [ratio('dol@excel', 'value')])).expected['t1']).toMatchObject({
      status: 'not_meaningful',
      before: null,
      after: 0,
      direction: 'becomes_computable',
    });
    expect(solve(custom(balances, events, [ratio('dol@slides03', 'value')])).expected['t1']).toEqual({
      status: 'not_meaningful',
      before: null,
      after: null,
      direction: 'unchanged',
    });
  });

  it('不存在的指標版本：scenario.unknown_ratio', () => {
    expect(failCode(custom({}, [], [ratio('roa@nope')]))).toBe('scenario.unknown_ratio');
    expect(failCode(custom({}, [], [ratio('nothing@excel')]))).toBe('scenario.unknown_ratio');
  });

  it('avg 型版本以帳本起點為期初', () => {
    const r = solve({
      ...q172,
      targets: [ratio('total_asset_turnover@slides03', 'value')],
    });
    expect(r.expected['t1']).toMatchObject({ status: 'ok', direction: 'up' });
  });
});

describe('錯誤碼與程式錯誤', () => {
  it('scenario.unknown_story、scenario.unknown_step', () => {
    expect(failCode({ ...q172, opening: { storyRef: 'story_nope00', afterStep: S.purchaseCash } })).toBe('scenario.unknown_story');
    expect(failCode({ ...q172, opening: { storyRef: limeLeafStory.id, afterStep: 'st_nope00' } })).toBe('scenario.unknown_step');
  });

  it('scenario.unknown_line、scenario.unknown_account', () => {
    expect(failCode({ ...q172, targets: [{ id: 't1', kind: 'line', line: 'is_nothing', measure: 'value' }] })).toBe('scenario.unknown_line');
    expect(failCode({ ...q172, targets: [{ id: 't1', kind: 'account', account: 'nothing', measure: 'value' }] })).toBe('scenario.unknown_account');
  });

  it('步驟錯誤透傳，附 at 為情境那一步', () => {
    const r = solveScenario(custom({ cash: 1_000, share_capital: 1_000 }, sellAll(100), []), ctx, options);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatchObject({ code: 'precondition.failed', at: { stepId: SCENARIO_STEP_ID, eventId: 'e1' } });
    const unknown = solveScenario(custom({}, [{ id: 'e1', template: 'tpl.nothing', params: {} }], []), ctx, options);
    expect(unknown.ok ? null : unknown.error.code).toBe('story.unknown_template');
  });

  it('故事本身重播失敗時透傳故事的步驟錯誤', () => {
    const broken: Story = {
      ...limeLeafStory,
      id: 'story_br0k3n',
      steps: [{ ...limeLeafStory.steps[0]!, events: [{ id: 'e1', template: 'tpl.sell_all_inventory_cash', params: { price: 1 } }] }],
    };
    const r = solveScenario({ ...q172, opening: { storyRef: broken.id, afterStep: broken.steps[0]!.id } }, ctx, { stories: new Map([[broken.id, broken]]) });
    expect(r.ok ? null : r.error).toMatchObject({ code: 'precondition.failed', at: { stepId: broken.steps[0]!.id } });
  });

  it('ctx 的政策或版面和題目不同是程式錯誤', () => {
    const ifrs = createCoreContext({ policy: 'ifrs@1' });
    expect(() => solveScenario(q172, ifrs, options)).toThrow(TypeError);
    const otherLayout = createCoreContext({ layout: { ...ctx.layout, id: 'other@1' } });
    expect(() => solveScenario(q172, otherLayout, options)).toThrow(TypeError);
  });

  it('非整數的推導值以浮點近似放進 values', () => {
    const third: TransactionTemplate = {
      id: 'tpl.borrow_thirds',
      rev: 1,
      revKind: 'text',
      status: 'draft',
      title: { 'zh-TW': '借款（測試）', en: 'Borrow (test)' },
      summary: { 'zh-TW': '借款', en: 'Borrow' },
      params: [{ name: 'amount', type: 'money', min: 0, max: 1_000_000, default: 300, label: { 'zh-TW': '金額', en: 'Amount' } }],
      derived: [{ name: 'third', type: 'number', expr: 'param.amount / 3', label: { 'zh-TW': '三分之一', en: 'One third' } }],
      preconditions: [],
      lines: [
        { id: 'l1', account: 'cash', side: 'debit', amount: 'param.amount', cf: { activity: 'financing', kind: 'st_borrowing_proceeds' } },
        { id: 'l2', account: 'short_term_borrowings', side: 'credit', amount: 'param.amount' },
      ],
      explanation: { 'zh-TW': '借款', en: 'Borrow' },
      termRefs: [],
    };
    const withThird = createCoreContext({ templates: [...defaultTemplates, third] });
    const r = unwrap(solveScenario(custom({}, [{ id: 'e1', template: 'tpl.borrow_thirds', params: { amount: 100 } }], []), withThird, options));
    expect(r.values['e1.amount']).toBe(100);
    expect(r.values['e1.third']).toBeCloseTo(100 / 3, 10);
  });
});
