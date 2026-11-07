// oxlint-disable vitest/valid-expect -- expect 的第二個引數是失敗時指出哪一步、哪一列的訊息
// IFRS 對照的黃金測試（04 第 10.3、18.2 節，D10(f)，M4b）：青檸文具社 18 步（自編數字）在 ifrs@1 政策與版面下每一步之後的累計三表、
// 23 項 excel 版指標與五步驟檢查。期望值在 golden/lime-leaf.ifrs@1.json，由獨立的計算表（只用加減法逐步累計）算出，不是核心的 snapshot；
// 同一支計算表以 teacher@1 跑時和 lime-leaf.teacher@1.json 完全相同（計算表本身的核對）。第 18 步另與 04 第 10.3 節的表逐項核對。
import { describe, expect, it } from 'vitest';
import { fiveStepCheck } from '../src/checks/index.ts';
import type { CoreContext } from '../src/ledger/index.ts';
import { type RatioStatus, computeAllRatios } from '../src/ratios/index.ts';
import { unwrap } from '../src/result.ts';
import { type Statements, buildStatements, measureMap } from '../src/statements/index.ts';
import { createCoreContext, orderedSteps, replayStory } from '../src/story/index.ts';
import { limeLeafStory } from './fixtures/story-lime-leaf.ts';
import teacherGolden from './golden/lime-leaf.teacher@1.json' with { type: 'json' };
import golden from './golden/lime-leaf.ifrs@1.json' with { type: 'json' };

interface GoldenStep {
  readonly stepId: string;
  readonly order: number;
  readonly lines: Readonly<Record<string, number>>;
  readonly ratios: Readonly<Record<string, { readonly status: RatioStatus; readonly displayValue: number | null }>>;
  readonly fiveStep: {
    readonly step1: { grossProfit: number; operatingIncome: number; ordinaryIncome: number | null; pretaxIncome: number; netIncome: number };
    readonly checks: readonly { step: number; left: number; right: number; diff: number }[];
  };
}

const ctx: CoreContext = createCoreContext({ policy: 'ifrs@1' });
const teacherCtx: CoreContext = createCoreContext();
const run = unwrap(replayStory(limeLeafStory, [], ctx));
const teacherRun = unwrap(replayStory(limeLeafStory, [], teacherCtx));
const steps = golden.steps as readonly GoldenStep[];
const teacherSteps = teacherGolden.steps as readonly GoldenStep[];
const cumulativeTo = (to: string): Statements => buildStatements(run, { kind: 'cumulative', to }, ctx.layout, ctx.policy);

function excelRatios(st: Statements): Record<string, { status: RatioStatus; displayValue: number | null }> {
  const out: Record<string, { status: RatioStatus; displayValue: number | null }> = {};
  for (const r of computeAllRatios(measureMap(st), {}, ['excel'])) out[r.ratioRef.replace(/@excel$/, '')] = { status: r.status, displayValue: r.displayValue };
  return out;
}

describe('ifrs@1 黃金資料的形狀', () => {
  it('對應青檸文具社的 18 步、ifrs@1 政策與版面，步驟順序與故事一致；每一步 23 項指標與四個勾稽點，diff 全為 0，步驟①沒有經常利益', () => {
    expect(golden.story).toBe(limeLeafStory.id);
    expect(golden.policy).toBe(ctx.policy.id);
    expect(golden.layout).toBe(ctx.layout.id);
    expect(steps.map((s) => s.stepId)).toEqual(orderedSteps(limeLeafStory).map((s) => s.id));
    for (const s of steps) {
      expect(Object.keys(s.ratios), `第 ${s.order} 步`).toHaveLength(23);
      expect(s.fiveStep.step1.ordinaryIncome, `第 ${s.order} 步`).toBeNull();
      expect(
        s.fiveStep.checks.map((c) => c.step),
        `第 ${s.order} 步`,
      ).toEqual([2, 3, 4, 5]);
      for (const c of s.fiveStep.checks) expect(c.diff, `第 ${s.order} 步的步驟 ${c.step}`).toBe(0);
    }
  });

  it('第 18 步與 04 第 10.3 節的表一致：設立費費用化讓營業利益少 150,000、少記攤銷 30,000，稅前淨利淨減 120,000，期末現金不變', () => {
    const last = steps[steps.length - 1] as GoldenStep;
    const teacherLast = teacherSteps[teacherSteps.length - 1] as GoldenStep;
    expect(last.lines).toMatchObject({
      is_sga_total: 986_000,
      is_operating_income: 2_714_000,
      is_non_operating_expense_total: 27_000,
      is_pretax_income: 2_687_000,
      is_net_income: 2_127_000,
      bs_total_assets: 4_527_000,
      cf_operating_total: 97_000,
      cf_investing_total: -360_000,
      cf_financing_total: 2_400_000,
      cf_cash_end: 2_137_000,
      is_organisation_costs_expense: 150_000,
      bs_deferred_org_costs: 0,
      dc_cash_generated_from_operations: 684_000,
    });
    expect(last.lines['is_sga_total']).toBe((teacherLast.lines['is_sga_total'] ?? 0) + 150_000);
    expect(last.lines['is_operating_income']).toBe((teacherLast.lines['is_operating_income'] ?? 0) - 150_000);
    expect(last.lines['is_pretax_income']).toBe((teacherLast.lines['is_pretax_income'] ?? 0) - 120_000);
    expect(last.lines['bs_total_assets']).toBe((teacherLast.lines['bs_total_assets'] ?? 0) - 120_000);
    expect(last.lines['cf_operating_total']).toBe((teacherLast.lines['cf_operating_total'] ?? 0) - 150_000);
    expect(last.lines['cf_investing_total']).toBe((teacherLast.lines['cf_investing_total'] ?? 0) + 150_000);
    expect(last.lines['cf_cash_end']).toBe(teacherLast.lines['cf_cash_end']);
    // 版面沒有這些列
    for (const id of ['is_ordinary_income', 'is_amortisation', 'is_extraordinary_gains', 'bs_deferred_assets_group', 'cf_other_noncash_losses'])
      expect(id in last.lines, id).toBe(false);
  });

  it('前 4 步和 teacher@1 的黃金資料相同（兩套政策在第 5 步設立費之前沒有差別），只少了拿掉的列', () => {
    for (let i = 0; i < 4; i++) {
      const a = steps[i] as GoldenStep;
      const b = teacherSteps[i] as GoldenStep;
      for (const [id, v] of Object.entries(a.lines)) expect(v, `第 ${a.order} 步 ${id}`).toBe(b.lines[id]);
      expect(a.ratios).toEqual(b.ratios);
      expect(a.fiveStep.checks).toEqual(b.fiveStep.checks);
    }
  });

  it('兩套政策下每一步的現金相同', () => {
    for (let i = 0; i < run.steps.length; i++) expect(run.steps[i]?.balancesAfter['cash'], `第 ${i + 1} 步`).toBe(teacherRun.steps[i]?.balancesAfter['cash']);
  });
});

describe('青檸文具社每一步在 ifrs@1 下的累計三表、指標與五步驟檢查等於黃金資料', () => {
  for (const g of steps) {
    describe(`第 ${g.order} 步 ${g.stepId}`, () => {
      const st = cumulativeTo(g.stepId);

      it('三表每一列（含 hidden 與分組列）', () => {
        expect(measureMap(st)).toEqual(g.lines);
      });

      it('23 項 excel 版指標的狀態與顯示值', () => {
        expect(excelRatios(st)).toEqual(g.ratios);
      });

      it('四層利益（經常利益為 null）與四個勾稽點', () => {
        const r = fiveStepCheck(st);
        expect(r.step1).toEqual(g.fiveStep.step1);
        expect(r.firstFailedStep).toBeNull();
        expect(r.checks.map((c) => ({ step: c.step, left: c.left.value, right: c.right.value, diff: c.diff }))).toEqual(g.fiveStep.checks);
      });
    });
  }
});
