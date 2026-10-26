// scoring.ts 的 ScoreContext（04 第 15.2 節第 9 步）：five_step_fill 用 compiled.cells、ratio_numeric 用 compiled.ratio、journal_entry 用 compiled.expectedEntries 與預設科目表
import { describe, expect, it } from 'vitest';
import { defaultChart, scoreContextOf, scoreSnapshotQuestion } from '../src/features/quiz/scoring.ts';
import { qFiveStep, qJournal, qRatioNumeric } from './quiz-fixtures.ts';

describe('scoreContextOf', () => {
  it('五步驟：expectedCells 來自 compiled.cells', () => {
    expect(scoreContextOf(qFiveStep).expectedCells).toEqual({ cf_pretax_income: 0, bs_cash: 250000 });
  });
  it('指標計算：ratio 以快照的子集補成核心的 RatioResult 形狀', () => {
    expect(scoreContextOf(qRatioNumeric).ratio).toEqual({
      ratioRef: 'debt_ratio@excel',
      status: 'ok',
      exact: { num: '1', den: '4' },
      displayValue: 25,
      value: null,
      reason: null,
      flags: [],
      inputs: {},
    });
  });
  it('分錄：expectedEntries 包成一筆分錄的陣列、chart 是預設科目表（只建一次）', () => {
    const ctx = scoreContextOf(qJournal);
    expect(ctx.expectedEntries).toEqual([qJournal.compiled?.expectedEntries]);
    expect(ctx.chart).toBe(defaultChart());
    expect(ctx.chart?.byId.get('inventory') ?? ctx.chart?.byId.get('cash')).toBeDefined();
  });
});

describe('scoreSnapshotQuestion（M3 題型）', () => {
  it('五步驟：介面的原始輸入文字換成金額後逐格判分', () => {
    const right = scoreSnapshotQuestion(qFiveStep, { cf_pretax_income: '0', bs_cash: '250,000' });
    expect(right.result.correct).toBe(true);
    expect(right.answer).toEqual({ cf_pretax_income: 0, bs_cash: 250000 });
    const half = scoreSnapshotQuestion(qFiveStep, { cf_pretax_income: '0', bs_cash: '200000' });
    expect(half.result.correct).toBe(false);
    expect(half.result.detail).toMatchObject({ kind: 'five_step_fill', correctCount: 1, total: 2 });
  });
  it('指標計算：百分點在容差內算對，N/A 算錯', () => {
    expect(scoreSnapshotQuestion(qRatioNumeric, { raw: '25' }).result.correct).toBe(true);
    expect(scoreSnapshotQuestion(qRatioNumeric, { raw: '25.01' }).result.correct).toBe(true);
    expect(scoreSnapshotQuestion(qRatioNumeric, { raw: '26' }).result.correct).toBe(false);
    const na = scoreSnapshotQuestion(qRatioNumeric, { na: true });
    expect(na.result.correct).toBe(false);
    expect(na.result.detail).toMatchObject({ kind: 'numeric', submitted: null });
  });
  it('分錄：借存貨貸現金各 150,000 算對；少一行列在 missing', () => {
    const lines = [
      { key: 'l1', account: 'inventory', side: 'debit', raw: '150000' },
      { key: 'l2', account: 'cash', side: 'credit', raw: '150000' },
    ];
    expect(scoreSnapshotQuestion(qJournal, lines).result.correct).toBe(true);
    const one = scoreSnapshotQuestion(qJournal, [lines[0]!]);
    expect(one.result.correct).toBe(false);
    expect(one.result.detail).toMatchObject({ kind: 'journal_entry', missing: [{ account: 'cash', side: 'credit', amount: 150000 }] });
  });
});
