// 故事重播與自由實驗（04 第 9 節、第 6.6 節、第 17 節的青檸文具社）。自編數字。
import { Story as StorySchema } from '@ledgerland/content-schema';
import { describe, expect, it } from 'vitest';
import {
  type CoreContext,
  type ParamOverride,
  type Story,
  type TransactionTemplate,
  allowedRange,
  applyOverrides,
  canonicalJson,
  createCoreContext,
  defaultTemplates,
  normalBalance,
  orderedSteps,
  replayStory,
  stateAfterStep,
  unwrap,
} from '../src/index.ts';
import { LIME_LEAF_FINAL, LIME_LEAF_STEP_IDS as S, limeLeafStory } from './fixtures/story-lime-leaf.ts';

const ctx: CoreContext = createCoreContext();
const ifrsCtx: CoreContext = createCoreContext({ policy: 'ifrs@1' });
const priceOverride: ParamOverride = { stepId: S.sellCredit, eventId: 'e1', param: 'price', value: 3_200_000 };

describe('createCoreContext', () => {
  it('以內建資料建立：21 個範本、teacher@1、教材版面、片語樣板；可以改政策或傳自訂資料', () => {
    expect(ctx.templates.size).toBe(21);
    expect(ctx.policy.id).toBe('teacher@1');
    expect(ctx.layout.id).toBe('teacher@1');
    expect(ctx.effectPhrases.increase['zh-TW']).toContain('{{money:amount}}');
    expect(ifrsCtx.policy.id).toBe('ifrs@1');
    expect(createCoreContext({ policy: ifrsCtx.policy, templates: ctx.templates, chart: ctx.chart, enabledExtensions: ['marketing_expense'] })).toMatchObject({
      policy: { id: 'ifrs@1' },
      enabledExtensions: ['marketing_expense'],
    });
    expect(createCoreContext({ templates: [] }).templates.size).toBe(0);
    expect(() => createCoreContext({ policy: 'nope@1' })).toThrow(/找不到政策/);
    const issue = defaultTemplates.find((t) => t.id === 'tpl.issue_shares_cash');
    expect(issue).toBeDefined();
    const broken: TransactionTemplate = { ...(issue as TransactionTemplate), lines: [{ id: 'l1', account: 'cash', side: 'debit', amount: 'param.amount' }] };
    expect(() => createCoreContext({ templates: [broken] })).toThrow(/範本編譯失敗/);
  });
});

describe('青檸文具社（story_q7m2v9）', () => {
  it('fixture 符合 content-schema 的 Story schema', () => {
    const parsed = StorySchema.safeParse(limeLeafStory);
    expect(parsed.success ? 'ok' : JSON.stringify(parsed.error.issues)).toBe('ok');
  });

  const run = unwrap(replayStory(limeLeafStory, [], ctx));

  it('18 步全部過帳，步驟依 order 排列，沒有一步無影響', () => {
    expect(run.steps.length).toBe(18);
    expect(run.steps.map((s) => s.stepId)).toEqual(orderedSteps(limeLeafStory).map((s) => s.id));
    expect(run.steps.every((s) => !s.noEffect)).toBe(true);
    expect(run.story).toBe(limeLeafStory);
    expect(run.policy).toBe('teacher@1');
  });

  it('checkpoints：推導型步驟的值與 fixture 一致', () => {
    for (const step of limeLeafStory.steps) {
      const posted = run.steps.find((s) => s.stepId === step.id);
      for (const c of step.checkpoints ?? []) expect(posted?.derivedValues[c.ref], `${step.id} ${c.ref}`).toBe(c.value);
    }
  });

  it('第 7 步後現金 2,214,000；第 17 步折舊 90,000 與攤銷 30,000；第 18 步後的餘額與 04 第 17 節相同', () => {
    const after7 = stateAfterStep(run, S.sellCash);
    expect(normalBalance(after7, 'cash')).toBe(2_214_000);
    expect(normalBalance(after7, 'inventory')).toBe(0);
    const step17 = run.steps[16];
    expect(step17?.derivedValues).toEqual({ 'e1.usefulLifeYears': 4, 'e1.amount': 90_000, 'e2.years': 5, 'e2.amount': 30_000 });
    const final = run.finalState;
    expect(Object.fromEntries(Object.keys(LIME_LEAF_FINAL).map((id) => [id, normalBalance(final, id)]))).toEqual(LIME_LEAF_FINAL);
    expect(normalBalance(final, 'machinery_equipment') - normalBalance(final, 'accumulated_depreciation_machinery')).toBe(270_000);
    expect(normalBalance(final, 'short_term_borrowings')).toBe(0);
    expect(normalBalance(final, 'accounts_payable')).toBe(0);
    // 全部科目借方減貸方加總為 0
    expect(Object.values(final.balances).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('stateAfterStep 重算 costs 與 steps，第 18 步等於 finalState', () => {
    const after3 = stateAfterStep(run, S.equipment);
    expect(after3.steps.length).toBe(3);
    expect(after3.costs['cash']).toBe(2_400_000);
    expect(after3.costs['machinery_equipment']).toBe(360_000);
    expect(after3.balances).toBe(run.steps[2]?.balancesAfter);
    const after18 = stateAfterStep(run, S.incomeTax);
    expect(after18.balances).toEqual(run.finalState.balances);
    expect(after18.costs).toEqual(run.finalState.costs);
    expect(after18.steps).toEqual(run.steps);
    expect(() => stateAfterStep(run, 'st_nope00')).toThrow(/沒有步驟/);
  });

  it('ifrs@1 重播：每一步現金相同，第 5 步費用化、第 17 步 e2 本筆無影響', () => {
    const ifrsRun = unwrap(replayStory(limeLeafStory, [], ifrsCtx));
    expect(ifrsRun.policy).toBe('ifrs@1');
    for (let i = 0; i < run.steps.length; i++) expect(ifrsRun.steps[i]?.balancesAfter['cash']).toBe(run.steps[i]?.balancesAfter['cash']);
    expect(ifrsRun.steps[4]?.entries[0]?.lines.map((l) => l.account)).toEqual(['organisation_costs_expense', 'cash']);
    expect(ifrsRun.steps[16]?.entries[1]).toEqual({ eventId: 'e2', template: 'tpl.amortise_org_costs', lines: [] });
    expect(ifrsRun.steps[16]?.noEffect).toBe(false);
    expect(normalBalance(ifrsRun.finalState, 'deferred_organisation_costs')).toBe(0);
    expect(normalBalance(ifrsRun.finalState, 'organisation_costs_expense')).toBe(150_000);
    expect(normalBalance(ifrsRun.finalState, 'amortisation_deferred_assets')).toBe(0);
  });

  it('決定性：跑兩次 deep equal；canonicalJson 序列化再解析相同', () => {
    const again = unwrap(replayStory(limeLeafStory, [], ctx));
    expect(again.steps).toEqual(run.steps);
    expect(again.finalState.balances).toEqual(run.finalState.balances);
    const text = canonicalJson(run.steps);
    expect(canonicalJson(again.steps)).toBe(text);
    expect(JSON.parse(text)).toEqual(JSON.parse(canonicalJson(run.steps)));
  });
});

describe('自由實驗（04 第 9.2、9.3、6.6 節）', () => {
  it('把第 10 步售價改成 3,200,000 時在第 12 步擋下，錯誤形狀與 04 第 6.6 節相同，allowedRange 最小 3,900,000', () => {
    const r = replayStory(limeLeafStory, [priceOverride], ctx);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatchObject({
      code: 'balance.negative',
      at: { stepId: S.collect, eventId: 'e1' },
      account: 'accounts_receivable',
      balanceAfter: -700_000,
      edited: { stepId: S.sellCredit, eventId: 'e1', param: 'price' },
      allowedRange: { min: 3_900_000, max: 999_999_999_999 },
      message: { key: 'core.error.balance.negative', params: { account: 'accounts_receivable', stepId: S.collect } },
    });
  });

  it('覆寫在範圍內時重播成功，後面依帳上狀態推導的金額跟著變', () => {
    const r = unwrap(replayStory(limeLeafStory, [{ ...priceOverride, value: 4_000_000 }], ctx));
    expect(normalBalance(r.finalState, 'accounts_receivable')).toBe(100_000);
    const purchase = unwrap(replayStory(limeLeafStory, [{ stepId: S.purchaseCredit, eventId: 'e1', param: 'amount', value: 2_000_000 }], ctx));
    expect(purchase.steps[9]?.derivedValues['e1.costOfAllInventory']).toBe(2_000_000);
    expect(purchase.steps[10]?.derivedValues['e1.amount']).toBe(2_000_000);
    expect(normalBalance(purchase.finalState, 'cash')).toBe(2_937_000);
  });

  it('allowedRange：只對有 monotonic 的參數搜尋；none 回 null；找不到合法支點回 null；非失敗情況也能算', () => {
    const target = { stepId: S.sellCredit, eventId: 'e1', param: 'price' };
    expect(allowedRange(limeLeafStory, [priceOverride], target, ctx)).toEqual({ min: 3_900_000, max: 999_999_999_999 });
    expect(allowedRange(limeLeafStory, [], target, ctx)).toEqual({ min: 3_900_000, max: 999_999_999_999 });
    expect(allowedRange(limeLeafStory, [], { stepId: S.count, eventId: 'e1', param: 'countedAmount' }, ctx)).toBeNull();
    expect(allowedRange(limeLeafStory, [], { stepId: S.count, eventId: 'e1', param: 'nope' }, ctx)).toBeNull();
    expect(allowedRange(limeLeafStory, [], { stepId: 'st_nope00', eventId: 'e1', param: 'price' }, ctx)).toBeNull();
    // 第 6 步現金進貨：0 會讓第 7 步「賣出全部存貨」的前置條件失敗，所以最小 1；
    // 上限不是第 6 步之前的現金 1,734,000，而是第 11 步付清貨款後現金不能為負：954,000
    expect(allowedRange(limeLeafStory, [], { stepId: S.purchaseCash, eventId: 'e1', param: 'amount' }, ctx)).toEqual({ min: 1, max: 954_000 });
    // 第 12 步收款：不能超過應收帳款 5,600,000；也不能少於後面要付的 210,000＋380,000＋927,000＋560,000 減去手上的 314,000
    expect(allowedRange(limeLeafStory, [], { stepId: S.collect, eventId: 'e1', param: 'amount' }, ctx)).toEqual({ min: 1_763_000, max: 5_600_000 });
    // 折舊年數：1 年折 360,000 仍不會讓淨額為負（min 以淨額為上限），所以整個範圍都合法
    expect(allowedRange(limeLeafStory, [], { stepId: S.yearEnd, eventId: 'e1', param: 'usefulLifeYears' }, ctx)).toEqual({ min: 1, max: 50 });
    // 把成立股款改成 0：後面每一步都付不出錢，連 min、max 都不合法，找不到支點
    const broken: Story = {
      ...limeLeafStory,
      steps: limeLeafStory.steps.map((s) =>
        s.id === S.issueShares ? { ...s, events: [{ id: 'e1', template: 'tpl.borrow_short_term', params: { amount: 0 } }] } : s,
      ),
    };
    expect(allowedRange(broken, [], { stepId: S.officeSupplies, eventId: 'e1', param: 'amount' }, ctx)).toBeNull();
  });

  it('沒有覆寫時的失敗不附 edited；最後一筆覆寫是 edited；monotonic none 的覆寫沒有 allowedRange', () => {
    const broken: Story = {
      ...limeLeafStory,
      steps: limeLeafStory.steps.map((s) =>
        s.id === S.purchaseCash ? { ...s, events: [{ id: 'e1', template: 'tpl.purchase_inventory_cash', params: { amount: 2_000_000 } }] } : s,
      ),
    };
    const r = replayStory(broken, [], ctx);
    expect(!r.ok && r.error).toMatchObject({ code: 'precondition.failed', at: { stepId: S.purchaseCash, eventId: 'e1' }, precondition: 'enough_cash' });
    expect(!r.ok && 'edited' in r.error).toBe(false);
    // 借款改成 100：第 11 步付清貨款時現金不夠，前置條件先擋下；edited 是最後一筆覆寫（盤點金額，monotonic none），所以沒有 allowedRange
    const two = replayStory(
      limeLeafStory,
      [
        { stepId: S.borrow, eventId: 'e1', param: 'amount', value: 100 },
        { stepId: S.count, eventId: 'e1', param: 'countedAmount', value: 999_999_999_999 },
      ],
      ctx,
    );
    expect(!two.ok && two.error).toMatchObject({
      code: 'precondition.failed',
      at: { stepId: S.payPayables, eventId: 'e1' },
      edited: { stepId: S.count, eventId: 'e1', param: 'countedAmount' },
    });
    expect(!two.ok && 'allowedRange' in two.error).toBe(false);
    // 同樣的借款覆寫單獨出現時，可輸入範圍的下限是讓第 11 步付得出貨款的借款金額
    const one = replayStory(limeLeafStory, [{ stepId: S.borrow, eventId: 'e1', param: 'amount', value: 100 }], ctx);
    expect(!one.ok && one.error).toMatchObject({
      code: 'precondition.failed',
      edited: { stepId: S.borrow, eventId: 'e1', param: 'amount' },
      allowedRange: { min: 586_000, max: 999_999_999_999 },
    });
  });

  it('覆寫指到不存在的步驟或事件沒有作用；指到不存在的參數是 param.type', () => {
    const ignored = unwrap(
      replayStory(
        limeLeafStory,
        [
          { stepId: 'st_nope00', eventId: 'e1', param: 'amount', value: 1 },
          { stepId: S.borrow, eventId: 'e9', param: 'amount', value: 1 },
        ],
        ctx,
      ),
    );
    expect(normalBalance(ignored.finalState, 'cash')).toBe(LIME_LEAF_FINAL.cash);
    const bad = replayStory(limeLeafStory, [{ stepId: S.borrow, eventId: 'e1', param: 'rate', value: 1 }], ctx);
    expect(!bad.ok && bad.error).toMatchObject({
      code: 'param.type',
      at: { stepId: S.borrow, eventId: 'e1' },
      edited: { stepId: S.borrow, eventId: 'e1', param: 'rate' },
    });
    const step = limeLeafStory.steps[7];
    expect(step !== undefined && applyOverrides(step, [])).toBe(step);
    expect(step !== undefined && applyOverrides(step, [{ stepId: S.borrow, eventId: 'e1', param: 'amount', value: 5 }]).events[0]?.params).toEqual({
      amount: 5,
    });
  });

  it('期初餘額：故事可以自帶 opening', () => {
    const withOpening: Story = { ...limeLeafStory, opening: { cash: 1000, share_capital: -1000 } };
    const r = unwrap(replayStory(withOpening, [], ctx));
    expect(normalBalance(r.finalState, 'cash')).toBe(LIME_LEAF_FINAL.cash + 1000);
    expect(r.finalState.opening).toEqual({ cash: 1000, share_capital: -1000 });
  });
});
