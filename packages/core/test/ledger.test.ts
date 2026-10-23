// 帳本（04 第 6.3 到 6.5 節）：餘額規則、快照共用、effects 合併與排序、T 字帳等式、視窗內的推導值。自編數字。
import { describe, expect, it } from 'vitest';
import {
  type CoreContext,
  type JournalEntry,
  type JournalLine,
  type LedgerState,
  type PostableStep,
  type PostedRun,
  type Result,
  type StepError,
  type StoryRun,
  activityOf,
  applyEntry,
  balanceAfterStep,
  balanceAtWindowStart,
  balanceOf,
  buildEffects,
  buildTAccounts,
  cashByTag,
  checkBalanceRules,
  costOf,
  createCoreContext,
  createLedger,
  debitCreditTotals,
  defaultEffectPhrases,
  inventoryTagTotals,
  normalBalance,
  postStep,
  renderEffectPhrase,
  replayStory,
  stepIndexOf,
  stepsInWindow,
  toStepError,
  unwrap,
} from '../src/index.ts';
import { LIME_LEAF_STEP_IDS as S, limeLeafStory } from './fixtures/story-lime-leaf.ts';

const ctx: CoreContext = createCoreContext();
const { chart } = ctx;
const L = (ref: string, account: string, side: 'debit' | 'credit', amount: number, extra: Partial<JournalLine> = {}): JournalLine => ({
  ref,
  account,
  side,
  amount,
  ...extra,
});
const E = (lines: JournalLine[], eventId = 'e1'): JournalEntry => ({ eventId, template: 'tpl.manual', lines });
const share = (amount: number) =>
  E([L('e1.l1', 'cash', 'debit', amount, { cf: { activity: 'financing', kind: 'share_issue' } }), L('e1.l2', 'share_capital', 'credit', amount)]);

function errorOf<T>(r: Result<T, unknown>): Record<string, unknown> {
  if (r.ok) throw new Error('預期失敗');
  return r.error as Record<string, unknown>;
}

describe('createLedger 與讀取', () => {
  it('每個科目都有 0 的餘額與成本；期初套上後借方餘額算成本', () => {
    const empty = createLedger(chart);
    expect(Object.keys(empty.balances).length).toBe(chart.accounts.length);
    expect(empty.steps).toEqual([]);
    const state = createLedger(chart, { cash: 1000, share_capital: -1000 });
    expect(balanceOf(state, 'cash')).toBe(1000);
    expect(balanceOf(state, 'share_capital')).toBe(-1000);
    expect(normalBalance(state, 'share_capital')).toBe(1000);
    expect(costOf(state, 'cash')).toBe(1000);
    expect(costOf(state, 'share_capital')).toBe(0);
    expect(state.opening).toEqual({ cash: 1000, share_capital: -1000 });
    expect(balanceOf(state, 'nowhere')).toBe(0);
    expect(costOf(state, 'nowhere')).toBe(0);
  });

  it('期初引用不存在的科目或不是安全整數是程式錯誤；normalBalance 查不到科目也是', () => {
    expect(() => createLedger(chart, { petty_cash: 1 })).toThrow(/不存在/);
    expect(() => createLedger(chart, { cash: 1.5 })).toThrow(/安全整數/);
    expect(() => normalBalance(createLedger(chart), 'petty_cash')).toThrow(/不存在/);
  });
});

describe('applyEntry 與餘額規則（04 第 6.3 節）', () => {
  const funded = unwrap(applyEntry(createLedger(chart), share(100_000))).state;

  it('過帳後 balances 與 costs 更新、原狀態不變、空分錄原樣回傳', () => {
    expect(balanceOf(funded, 'cash')).toBe(100_000);
    expect(costOf(funded, 'cash')).toBe(100_000);
    expect(balanceOf(createLedger(chart), 'cash')).toBe(0);
    const same = unwrap(applyEntry(funded, E([])));
    expect(same.state).toBe(funded);
    expect(same.delta).toEqual({});
  });

  it('資產不得為負：現金付超過餘額被擋下，附科目與過帳後餘額', () => {
    const r = applyEntry(
      funded,
      E([
        L('e1.l1', 'outsourcing_expense', 'debit', 100_001),
        L('e1.l2', 'cash', 'credit', 100_001, { cf: { activity: 'operating', kind: 'payments_for_operating_expenses' } }),
      ]),
    );
    expect(errorOf(r)).toMatchObject({ code: 'balance.negative', account: 'cash', balanceAfter: -1, rule: 'non_negative' });
  });

  it('負債、股本與公積不得為負；未分配盈餘與損益科目可以為負', () => {
    const payTooMuch = applyEntry(
      funded,
      E([L('e1.l1', 'accounts_payable', 'debit', 1), L('e1.l2', 'cash', 'credit', 1, { cf: { activity: 'operating', kind: 'payments_to_suppliers' } })]),
    );
    expect(errorOf(payTooMuch)).toMatchObject({ code: 'balance.negative', account: 'accounts_payable', balanceAfter: -1 });
    const buyBack = applyEntry(
      funded,
      E([L('e1.l1', 'share_capital', 'debit', 100_001), L('e1.l2', 'cash', 'credit', 100_001, { cf: { activity: 'financing', kind: 'dividends_paid' } })]),
    );
    expect(errorOf(buyBack)).toMatchObject({ code: 'balance.negative', account: 'share_capital' });
    const dividend = unwrap(
      applyEntry(
        funded,
        E([
          L('e1.l1', 'retained_earnings', 'debit', 30_000, { tag: 'dividend' }),
          L('e1.l2', 'cash', 'credit', 30_000, { cf: { activity: 'financing', kind: 'dividends_paid' } }),
        ]),
      ),
    );
    expect(normalBalance(dividend.state, 'retained_earnings')).toBe(-30_000);
    const overage = unwrap(
      applyEntry(funded, E([L('e1.l1', 'inventory', 'debit', 400, { tag: 'count_overage' }), L('e1.l2', 'cost_of_goods_sold', 'credit', 400)])),
    );
    expect(normalBalance(overage.state, 'cost_of_goods_sold')).toBe(-400);
  });

  it('機器設備淨額不得為負：累計折舊不得超過成本', () => {
    const withMachine = unwrap(
      applyEntry(
        funded,
        E([L('e1.l1', 'machinery_equipment', 'debit', 40_000), L('e1.l2', 'cash', 'credit', 40_000, { cf: { activity: 'investing', kind: 'capex' } })]),
      ),
    ).state;
    const depreciate = (amount: number) =>
      applyEntry(
        withMachine,
        E([L('e2.l1', 'depreciation_expense', 'debit', amount), L('e2.l2', 'accumulated_depreciation_machinery', 'credit', amount)], 'e2'),
      );
    expect(unwrap(depreciate(40_000)).delta).toEqual({ depreciation_expense: 40_000, accumulated_depreciation_machinery: -40_000 });
    expect(errorOf(depreciate(40_001))).toMatchObject({
      code: 'balance.negative',
      account: 'machinery_equipment',
      balanceAfter: -1,
      rule: 'net_of_contra',
      contra: 'accumulated_depreciation_machinery',
    });
    // 累計折舊本身也不得為負（借記超過餘額）
    const reversed = applyEntry(
      withMachine,
      E([L('e2.l1', 'accumulated_depreciation_machinery', 'debit', 1), L('e2.l2', 'depreciation_expense', 'credit', 1)], 'e2'),
    );
    expect(errorOf(reversed)).toMatchObject({ code: 'balance.negative', account: 'accumulated_depreciation_machinery' });
    // 處分設備：動到被抵銷科目時也檢查淨額
    const dispose = applyEntry(
      unwrap(depreciate(30_000)).state,
      E(
        [
          L('e3.l1', 'cash', 'debit', 20_000, { cf: { activity: 'investing', kind: 'disposal_proceeds' } }),
          L('e3.l2', 'machinery_equipment', 'credit', 20_000),
        ],
        'e3',
      ),
    );
    expect(errorOf(dispose)).toMatchObject({ code: 'balance.negative', account: 'machinery_equipment', balanceAfter: -10_000, rule: 'net_of_contra' });
    expect(checkBalanceRules(chart, withMachine.balances, ['machinery_equipment', 'machinery_equipment', 'nowhere'])).toBeUndefined();
  });

  it('餘額超出安全整數是 money.overflow', () => {
    const huge = createLedger(chart, { cash: Number.MAX_SAFE_INTEGER, share_capital: -Number.MAX_SAFE_INTEGER });
    expect(errorOf(applyEntry(huge, share(1)))).toMatchObject({ code: 'money.overflow' });
  });
});

describe('postStep', () => {
  const run = unwrap(replayStory(limeLeafStory, [], ctx));

  it('第 k 步的 balancesBefore 就是第 k-1 步的 balancesAfter（同一個物件）；delta 只含變動的科目', () => {
    for (let i = 1; i < run.steps.length; i++) {
      const prev = run.steps[i - 1];
      const cur = run.steps[i];
      expect(cur?.balancesBefore).toBe(prev?.balancesAfter);
    }
    expect(run.steps[0]?.delta).toEqual({ cash: 2_400_000, share_capital: -2_400_000 });
    expect(run.steps[0]?.balancesBefore).toBe(
      unwrap(replayStory(limeLeafStory, [], ctx)).steps[0]?.balancesBefore === undefined ? undefined : run.steps[0]?.balancesBefore,
    );
    expect(run.finalState.steps).toBe(run.steps);
    expect(run.finalState.balances).toBe(run.steps[17]?.balancesAfter);
  });

  it('同一步兩個事件依序過帳，後者看得到前者；derivedValues 以事件 ID 為前綴；effects 跨事件合併', () => {
    const start = createLedger(chart);
    const step: PostableStep = {
      id: 'st_test01',
      events: [
        { id: 'e1', template: 'tpl.issue_shares_cash', params: { amount: 50_000 } },
        { id: 'e2', template: 'tpl.purchase_inventory_cash', params: { amount: 20_000 } },
        { id: 'e3', template: 'tpl.sell_all_inventory_cash', params: { price: 35_000 } },
      ],
    };
    const r = unwrap(postStep(start, step, ctx));
    expect(r.posted.derivedValues).toEqual({
      'e1.amount': 50_000,
      'e2.amount': 20_000,
      'e3.price': 35_000,
      'e3.costOfAllInventory': 20_000,
      'e3.grossProfit': 15_000,
    });
    expect(r.posted.entries.map((e) => e.eventId)).toEqual(['e1', 'e2', 'e3']);
    expect(r.posted.effects.map((e) => [e.account, e.delta, e.direction, e.lineRefs])).toEqual([
      ['cash', 65_000, 'increase', ['e1.l1', 'e2.l2', 'e3.l1']],
      ['inventory', 0, 'unchanged', ['e2.l1', 'e3.l4']],
      ['share_capital', 50_000, 'increase', ['e1.l2']],
      ['revenue', 35_000, 'increase', ['e3.l2']],
      ['cost_of_goods_sold', 20_000, 'increase', ['e3.l3']],
    ]);
    expect(r.posted.effects[1]?.text).toEqual({ 'zh-TW': '{{term:tm_n7v3k8pq}}不變', en: '{{term:tm_n7v3k8pq}} is unchanged' });
    expect(r.posted.delta).toEqual({ cash: 65_000, share_capital: -50_000, revenue: -35_000, cost_of_goods_sold: 20_000 });
    expect(r.posted.balancesBefore).toBe(start.balances);
    expect(r.state.steps.length).toBe(1);
    expect(start.steps.length).toBe(0);
    // 第二個事件失敗：錯誤指向 e2，狀態不變
    const bad = postStep(
      start,
      {
        id: 'st_test02',
        events: [
          { id: 'e1', template: 'tpl.issue_shares_cash', params: { amount: 10 } },
          { id: 'e2', template: 'tpl.buy_equipment_cash', params: { amount: 11 } },
        ],
      },
      ctx,
    );
    expect(errorOf(bad)).toMatchObject({
      code: 'precondition.failed',
      at: { stepId: 'st_test02', eventId: 'e2' },
      message: { params: { stepId: 'st_test02', eventId: 'e2' } },
    });
  });

  it('整步無影響：entries 保留空分錄、noEffect 為 true、balancesAfter 是同一個物件', () => {
    const start = createLedger(chart);
    const r = unwrap(postStep(start, { id: 'st_test03', events: [{ id: 'e1', template: 'tpl.borrow_short_term', params: { amount: 0 } }] }, ctx));
    expect(r.posted.noEffect).toBe(true);
    expect(r.posted.entries).toEqual([{ eventId: 'e1', template: 'tpl.borrow_short_term', lines: [] }]);
    expect(r.posted.removedZeroLines).toEqual(['e1.l1', 'e1.l2']);
    expect(r.posted.balancesAfter).toBe(start.balances);
    expect(r.posted.effects).toEqual([]);
    expect(r.posted.delta).toEqual({});
  });

  it('不存在的範本是 story.unknown_template；事件 ID 重複是程式錯誤；分錄驗證失敗也帶位置', () => {
    const start = createLedger(chart);
    expect(errorOf(postStep(start, { id: 'st_test04', events: [{ id: 'e1', template: 'tpl.nope', params: {} }] }, ctx))).toMatchObject({
      code: 'story.unknown_template',
      at: { stepId: 'st_test04', eventId: 'e1' },
    });
    expect(() =>
      postStep(
        start,
        {
          id: 'st_test05',
          events: [
            { id: 'e1', template: 'tpl.issue_shares_cash', params: {} },
            { id: 'e1', template: 'tpl.issue_shares_cash', params: {} },
          ],
        },
        ctx,
      ),
    ).toThrow(/重複/);
    // 在 ifrs@1 下 teacher 的範本行引用停用科目時由驗證擋下：用自訂範本模擬（ifrs 停用 extraordinary_gains）
    const ifrsCtx = createCoreContext({ policy: 'ifrs@1' });
    const funded = unwrap(
      postStep(start, { id: 'st_test06', events: [{ id: 'e1', template: 'tpl.issue_shares_cash', params: { amount: 9000 } }] }, ifrsCtx),
    ).state;
    const policy = { ...ifrsCtx.policy, switches: { ...ifrsCtx.policy.switches, inventoryOverage: 'extraordinary_gain' as const } };
    const r = postStep(
      funded,
      { id: 'st_test07', events: [{ id: 'e1', template: 'tpl.inventory_count', params: { countedAmount: 500 } }] },
      { ...ifrsCtx, policy },
    );
    expect(errorOf(r)).toMatchObject({ code: 'entry.account_disabled', at: { stepId: 'st_test07', eventId: 'e1' } });
    const wrapped: StepError = toStepError({ code: 'entry.unbalanced', message: { key: 'core.error.entry.unbalanced' } }, 'st_x', 'e9');
    expect(wrapped).toEqual({
      code: 'entry.unbalanced',
      at: { stepId: 'st_x', eventId: 'e9' },
      message: { key: 'core.error.entry.unbalanced', params: { stepId: 'st_x', eventId: 'e9' } },
    });
  });
});

describe('effects（04 第 6.5 節）', () => {
  const run: StoryRun = unwrap(replayStory(limeLeafStory, [], ctx));

  it('第 7 步的 effects 與規格範例相同：依科目表 order 排序、正常餘額表示、文字只代入名詞卡 ID', () => {
    const step = run.steps[6];
    expect(step?.stepId).toBe(S.sellCash);
    expect(step?.effects).toEqual([
      {
        account: 'cash',
        element: 'asset',
        delta: 1_120_000,
        amount: 1_120_000,
        direction: 'increase',
        lineRefs: ['e1.l1'],
        text: { 'zh-TW': '{{term:tm_c4sh8k2p}}增加 {{money:amount}}', en: '{{term:tm_c4sh8k2p}} increases by {{money:amount}}' },
      },
      {
        account: 'inventory',
        element: 'asset',
        delta: -640_000,
        amount: 640_000,
        direction: 'decrease',
        lineRefs: ['e1.l4'],
        text: { 'zh-TW': '{{term:tm_n7v3k8pq}}減少 {{money:amount}}', en: '{{term:tm_n7v3k8pq}} decreases by {{money:amount}}' },
      },
      {
        account: 'revenue',
        element: 'revenue',
        delta: 1_120_000,
        amount: 1_120_000,
        direction: 'increase',
        lineRefs: ['e1.l2'],
        text: { 'zh-TW': '{{term:tm_v3n8q2ye}}增加 {{money:amount}}', en: '{{term:tm_v3n8q2ye}} increases by {{money:amount}}' },
      },
      {
        account: 'cost_of_goods_sold',
        element: 'expense',
        delta: 640_000,
        amount: 640_000,
        direction: 'increase',
        lineRefs: ['e1.l3'],
        text: { 'zh-TW': '{{term:tm_g5c2m8tw}}增加 {{money:amount}}', en: '{{term:tm_g5c2m8tw}} increases by {{money:amount}}' },
      },
    ]);
    expect(step?.derivedValues).toEqual({ 'e1.price': 1_120_000, 'e1.costOfAllInventory': 640_000, 'e1.grossProfit': 480_000 });
  });

  it('第 15 步同一科目的兩條現金行合併成一筆 effect；片語樣板可以替換', () => {
    const step = run.steps[14];
    expect(step?.effects.map((e) => [e.account, e.delta, e.lineRefs])).toEqual([
      ['cash', -927_000, ['e1.l3', 'e1.l4']],
      ['short_term_borrowings', -900_000, ['e1.l1']],
      ['interest_expense', 27_000, ['e1.l2']],
    ]);
    const custom = buildEffects(step?.entries ?? [], chart, {
      increase: { 'zh-TW': '+{{term:account}}', en: '+{{term:account}}' },
      decrease: { 'zh-TW': '-{{term:account}} {{term:account}}', en: '-' },
      unchanged: defaultEffectPhrases.unchanged,
    });
    expect(custom[0]?.text).toEqual({ 'zh-TW': '-{{term:tm_c4sh8k2p}} {{term:tm_c4sh8k2p}}', en: '-' });
    expect(renderEffectPhrase({ 'zh-TW': 'x', en: 'y' }, 'tm_a')).toEqual({ 'zh-TW': 'x', en: 'y' });
    expect(() => buildEffects([E([L('e1.l1', 'petty_cash', 'debit', 1)])], chart, defaultEffectPhrases)).toThrow(/不存在/);
  });
});

describe('buildTAccounts', () => {
  const run = unwrap(replayStory(limeLeafStory, [], ctx));

  it('預設只回傳該步有變動的科目、依 order 排序；期初＋借方－貸方（正常方向）＝期末＝balancesAfter', () => {
    const accounts = buildTAccounts(run, S.sellCash);
    expect(accounts.map((a) => a.account)).toEqual(['cash', 'inventory', 'revenue', 'cost_of_goods_sold']);
    const cash = accounts[0];
    expect(cash?.opening).toBe(0);
    expect(cash?.debits.map((d) => [d.stepId, d.lineRef, d.amount])).toEqual([
      [S.issueShares, 'e1.l1', 2_400_000],
      [S.sellCash, 'e1.l1', 1_120_000],
    ]);
    expect(cash?.credits.length).toBe(5);
    expect(cash?.closing).toBe(2_214_000);
    expect(cash?.highlight).toEqual(['e1.l1']);
    const inventory = accounts[1];
    expect(inventory?.highlight).toEqual(['e1.l4']);
    for (let i = 0; i < run.steps.length; i++) {
      const stepId = run.steps[i]?.stepId ?? '';
      for (const t of buildTAccounts(
        run,
        stepId,
        chart.accounts.map((a) => a.id),
      )) {
        const account = chart.byId.get(t.account);
        const sign = account?.normalSide === 'debit' ? 1 : -1;
        const debit = t.debits.reduce((s, d) => s + d.amount, 0);
        const credit = t.credits.reduce((s, c) => s + c.amount, 0);
        expect(t.opening + sign * (debit - credit), `${stepId} ${t.account}`).toBe(t.closing);
        expect(t.closing).toBe(balanceAfterStep(run, stepId, t.account));
      }
    }
  });

  it('貸方科目的正常餘額：第 15 步的短期借款關帳為 0；自訂期初帶進 opening', () => {
    const loan = buildTAccounts(run, S.repay, ['short_term_borrowings'])[0];
    expect(loan).toMatchObject({ opening: 0, closing: 0, highlight: ['e1.l1'] });
    expect(loan?.credits).toEqual([{ stepId: S.borrow, lineRef: 'e1.l2', amount: 900_000 }]);
    expect(loan?.debits).toEqual([{ stepId: S.repay, lineRef: 'e1.l1', amount: 900_000 }]);
    const opened = createLedger(chart, { cash: 500, share_capital: -500 });
    const posted = unwrap(postStep(opened, { id: 'st_open01', events: [{ id: 'e1', template: 'tpl.issue_shares_cash', params: { amount: 7 } }] }, ctx));
    const openedRun: PostedRun = { steps: posted.state.steps, finalState: posted.state };
    expect(buildTAccounts(openedRun, 'st_open01').map((a) => [a.account, a.opening, a.closing])).toEqual([
      ['cash', 500, 507],
      ['share_capital', 500, 507],
    ]);
    expect(() => buildTAccounts(run, 'st_nope00')).toThrow(/沒有步驟/);
    expect(() => buildTAccounts(run, S.repay, ['petty_cash'])).toThrow(/不存在/);
  });
});

describe('視窗內的推導值（給三表與追蹤模組）', () => {
  const run = unwrap(replayStory(limeLeafStory, [], ctx));
  const last = S.incomeTax;

  it('stepsInWindow 與 stepIndexOf', () => {
    expect(stepsInWindow(run, null, S.equipment).map((s) => s.stepId)).toEqual([S.issueShares, S.officeSupplies, S.equipment]);
    expect(stepsInWindow(run, S.sellCash, S.sellCash).map((s) => s.stepId)).toEqual([S.sellCash]);
    expect(stepIndexOf(run, S.sellCash)).toBe(6);
    expect(() => stepsInWindow(run, S.sellCash, S.equipment)).toThrow(/之後/);
  });

  it('activityOf：損益科目的本期金額與資產負債科目的淨變動，正常餘額表示', () => {
    expect(activityOf(run, null, last, 'revenue')).toBe(6_720_000);
    expect(activityOf(run, null, last, 'cost_of_goods_sold')).toBe(3_020_000);
    expect(activityOf(run, null, last, 'depreciation_expense')).toBe(90_000);
    expect(activityOf(run, null, last, 'amortisation_deferred_assets')).toBe(30_000);
    expect(activityOf(run, null, last, 'interest_expense')).toBe(27_000);
    expect(activityOf(run, null, last, 'income_tax_expense')).toBe(560_000);
    expect(activityOf(run, null, last, 'accounts_receivable')).toBe(1_700_000);
    expect(activityOf(run, null, last, 'short_term_borrowings')).toBe(0);
    expect(activityOf(run, S.borrow, S.borrow, 'short_term_borrowings')).toBe(900_000);
    expect(debitCreditTotals(run, null, last, 'cash')).toEqual({ debit: 8_320_000, credit: 6_183_000 });
    expect(() => activityOf(run, null, last, 'petty_cash')).toThrow(/不存在/);
  });

  it('cashByTag：各活動合計與 04 第 17 節的表相同，total 等於現金餘額', () => {
    const cash = cashByTag(run, null, last);
    expect(cash.byActivity).toEqual({ operating: 247_000, investing: -510_000, financing: 2_400_000 });
    expect(cash.total).toBe(2_137_000);
    expect(cash.byKind.receipts_from_customers).toBe(5_020_000);
    expect(cash.byKind.payments_to_suppliers).toBe(-3_440_000);
    expect(cash.byKind.payments_for_operating_expenses).toBe(-746_000);
    expect(cash.byKind.interest_paid).toBe(-27_000);
    expect(cash.byKind.income_tax_paid).toBe(-560_000);
    expect(cash.byKind.capex).toBe(-510_000);
    expect(cash.byKind.st_borrowing_proceeds).toBe(900_000);
    expect(cash.byKind.st_borrowing_repayment).toBe(-900_000);
    expect(cash.byKind.share_issue).toBe(2_400_000);
    expect(cash.byKind.dividends_paid).toBe(0);
    expect(cashByTag(run, S.repay, S.repay).byActivity).toEqual({ operating: -27_000, investing: 0, financing: -900_000 });
  });

  it('inventoryTagTotals：R13 本期進貨、銷貨成本與盤盈；視窗起點餘額', () => {
    expect(inventoryTagTotals(run, null, last)).toEqual({ purchase: 3_440_000, cost_of_sale: 3_440_000, count_overage: 420_000, count_shortage: 0 });
    expect(inventoryTagTotals(run, null, S.sellCash)).toEqual({ purchase: 640_000, cost_of_sale: 640_000, count_overage: 0, count_shortage: 0 });
    expect(balanceAtWindowStart(run, null, 'inventory')).toBe(0);
    expect(balanceAtWindowStart(run, S.purchaseCredit, 'inventory')).toBe(0);
    expect(balanceAtWindowStart(run, S.sellCredit, 'inventory')).toBe(2_800_000);
    expect(balanceAfterStep(run, S.count, 'inventory')).toBe(420_000);
    // 存貨不變式：期初＋進貨＋盤盈－銷貨成本－盤損＝期末
    const t = inventoryTagTotals(run, null, last);
    expect(balanceAtWindowStart(run, null, 'inventory') + t.purchase + t.count_overage - t.cost_of_sale - t.count_shortage).toBe(
      balanceAfterStep(run, last, 'inventory'),
    );
  });

  it('LedgerState 的 steps 與 run.steps 一致，state 可以直接當 PostedRun 用', () => {
    const state: LedgerState = run.finalState;
    const asRun: PostedRun = { steps: state.steps, finalState: state };
    expect(cashByTag(asRun, null, last).total).toBe(normalBalance(state, 'cash'));
  });
});
