// oxlint-disable vitest/valid-expect, vitest/no-conditional-expect -- expect 的第二個引數是失敗時指出哪一步、哪一列的訊息；逐步、逐列檢查寫成迴圈
// 正式故事 story_ywv2dy（origin 為 teacher，D2）的性質測試（04 第 18.1 節、10 第 8 節 M1 第二級）：
// 逐步重播只斷言不變式，不寫任何金額。老師的金額只存在內容資料檔；對老師 Excel 的逐格比對在 test/local/excel-core.local.test.ts。
import { describe, expect, it } from 'vitest';
import { normalSign } from '../src/accounts/index.ts';
import { fiveStepCheck } from '../src/checks/index.ts';
import { type CoreContext, type PostedRun, buildTAccounts } from '../src/ledger/index.ts';
import { unwrap } from '../src/result.ts';
import { type Statements, buildStatements, checkStatementInvariants, lineValue, measureMap } from '../src/statements/index.ts';
import { type Story, createCoreContext, orderedSteps, replayStory } from '../src/story/index.ts';
import officialStoryJson from '../../../content/stories/story_ywv2dy.json' with { type: 'json' };

const ctx: CoreContext = createCoreContext();
const story = officialStoryJson as Story;
const run = unwrap(replayStory(story, [], ctx));
const stepIds = orderedSteps(story).map((s) => s.id);
const cumulative = (to: string, r: PostedRun = run): Statements => buildStatements(r, { kind: 'cumulative', to }, ctx.layout, ctx.policy);
const transaction = (step: string, r: PostedRun = run): Statements => buildStatements(r, { kind: 'transaction', step }, ctx.layout, ctx.policy);

/** 間接法與直接法必須相等的列（04 第 11.4 節） */
const INDIRECT_VS_DIRECT: ReadonlyArray<readonly [string, string]> = [
  ['cf_operating_subtotal', 'dc_cash_generated_from_operations'],
  ['cf_operating_total', 'dc_operating_total'],
  ['cf_investing_total', 'dc_investing_total'],
  ['cf_financing_total', 'dc_financing_total'],
  ['cf_net_change', 'dc_net_change'],
  ['cf_cash_end', 'dc_cash_end'],
];

describe('正式故事 story_ywv2dy 的不變式（每一步、累計與本筆變動）', () => {
  it('18 步全部重播成功，每一步的借方合計等於貸方合計', () => {
    expect(run.steps.map((s) => s.stepId)).toEqual(stepIds);
    for (const step of run.steps) {
      expect(step.noEffect, step.stepId).toBe(false);
      for (const entry of step.entries) {
        const debit = entry.lines.filter((l) => l.side === 'debit').reduce((a, l) => a + l.amount, 0);
        const credit = entry.lines.filter((l) => l.side === 'credit').reduce((a, l) => a + l.amount, 0);
        expect(debit, `${step.stepId} ${entry.eventId}`).toBe(credit);
      }
      expect(
        Object.values(step.balancesAfter).reduce((a, b) => a + b, 0),
        step.stepId,
      ).toBe(0);
    }
  });

  for (const stepId of stepIds) {
    describe(`步驟 ${stepId}`, () => {
      const cum = cumulative(stepId);
      const tx = transaction(stepId);

      it('累計與本筆變動的報表不變式全部成立', () => {
        for (const st of [cum, tx]) {
          const failed = checkStatementInvariants(st).filter((r) => !r.pass);
          expect(
            failed.map((r) => `${st.window.kind} ${r.rule} ${r.line} vs ${r.against}`),
            `${stepId} ${st.window.kind}`,
          ).toEqual([]);
        }
      });

      it('四個勾稽點的差額都是 0；五層利益彼此一致', () => {
        const r = fiveStepCheck(cum);
        expect(r.checks.map((c) => c.diff)).toEqual([0, 0, 0, 0]);
        expect(r.firstFailedStep).toBeNull();
        expect(r.step1.ordinaryIncome).not.toBeNull();
        // 沒有非常損益時第 3、4 層相等；本期淨利 ＝ 稅前淨利 － 所得稅費用
        expect(r.step1.pretaxIncome).toBe(r.step1.ordinaryIncome);
        expect(r.step1.netIncome).toBe(r.step1.pretaxIncome - lineValue(cum, 'is_income_tax_expense').value);
        expect(r.step1.operatingIncome).toBe(r.step1.grossProfit - lineValue(cum, 'is_sga_total').value);
      });

      it('間接法等於直接法；現金流量表的增減額等於現金變動、期末現金等於資產負債表現金', () => {
        for (const st of [cum, tx]) {
          for (const [indirect, direct] of INDIRECT_VS_DIRECT)
            expect(lineValue(st, indirect).value, `${st.window.kind} ${indirect}`).toBe(lineValue(st, direct).value);
          expect(lineValue(st, 'cf_cash_end').value, st.window.kind).toBe(lineValue(st, 'bs_cash').value);
        }
        const before = run.steps[stepIds.indexOf(stepId) - 1];
        const cashBefore = before === undefined ? 0 : (before.balancesAfter['cash'] ?? 0);
        const cashAfter = run.steps[stepIds.indexOf(stepId)]?.balancesAfter['cash'] ?? 0;
        expect(lineValue(tx, 'cf_net_change').value).toBe(cashAfter - cashBefore);
        expect(lineValue(cum, 'cf_net_change').value).toBe(cashAfter);
        expect(lineValue(cum, 'cf_cash_begin').value).toBe(0);
      });

      it('資產總計等於負債加權益；本期淨利等於未分配盈餘（故事沒有股利與提列公積）', () => {
        expect(lineValue(cum, 'bs_total_assets').value).toBe(lineValue(cum, 'bs_total_liabilities_equity').value);
        expect(lineValue(cum, 'bs_retained_earnings').value).toBe(lineValue(cum, 'is_net_income').value);
      });

      it('本筆變動逐列加總到這一步等於累計', () => {
        const sums: Record<string, number> = {};
        for (const id of stepIds.slice(0, stepIds.indexOf(stepId) + 1)) {
          for (const [line, v] of Object.entries(measureMap(transaction(id)))) sums[line] = (sums[line] ?? 0) + v;
        }
        for (const id of Object.keys(sums)) if (Object.is(sums[id], -0)) sums[id] = 0;
        expect(sums).toEqual(measureMap(cum));
      });

      it('T 字帳：期初 ＋ 借方合計 － 貸方合計（依正常方向換算）＝ 期末 ＝ 該步的 balancesAfter', () => {
        const chart = run.finalState.chart;
        const posted = run.steps[stepIds.indexOf(stepId)];
        expect(posted).toBeDefined();
        const touched = new Set(posted?.entries.flatMap((e) => e.lines.map((l) => l.account)) ?? []);
        for (const t of buildTAccounts(
          run,
          stepId,
          chart.accounts.map((a) => a.id),
        )) {
          const account = chart.byId.get(t.account);
          expect(account, t.account).toBeDefined();
          if (account === undefined) continue;
          const debits = t.debits.reduce((a, l) => a + l.amount, 0);
          const credits = t.credits.reduce((a, l) => a + l.amount, 0);
          expect(t.opening + normalSign(account) * (debits - credits), t.account).toBe(t.closing);
          expect(t.closing, t.account).toBe(normalSign(account) * (posted?.balancesAfter[t.account] ?? 0) || 0);
          expect(t.highlight.length > 0, t.account).toBe(touched.has(t.account));
        }
      });
    });
  }

  it('決定性：重播兩次與各自建立的報表 deep equal', () => {
    const again = unwrap(replayStory(story, [], createCoreContext()));
    expect(again.steps).toEqual(run.steps);
    expect(again.finalState.balances).toEqual(run.finalState.balances);
    for (const stepId of stepIds) {
      expect(measureMap(cumulative(stepId, again))).toEqual(measureMap(cumulative(stepId)));
      expect(measureMap(transaction(stepId, again))).toEqual(measureMap(transaction(stepId)));
      expect(fiveStepCheck(cumulative(stepId, again))).toEqual(fiveStepCheck(cumulative(stepId)));
    }
  });
});
