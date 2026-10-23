// 作答格式（06 第 4.2 節）：各題型的 parseAnswer 正反例、多正解題的去重與排序
import { describe, expect, it } from 'vitest';
import { normaliseMultiChoiceAnswer, parseAnswer } from '../src/index.ts';

describe('parseAnswer', () => {
  it('單選類是選項 ID 字串', () => {
    expect(parseAnswer('single_choice', 'o_a1b2')).toEqual({ ok: true, value: 'o_a1b2' });
    expect(parseAnswer('pick_statement', 'o_a1b2').ok).toBe(true);
    expect(parseAnswer('ratio_interpret', 'o_a1b2').ok).toBe(true);
    expect(parseAnswer('judgment', 'o_a1b2').ok).toBe(true);
    expect(parseAnswer('single_choice', 'opt_1').ok).toBe(false);
    expect(parseAnswer('single_choice', ['o_a1b2']).ok).toBe(false);
  });
  it('multi_choice 是去重、排序後的選項 ID 陣列，至少一個', () => {
    expect(parseAnswer('multi_choice', ['o_e5f6', 'o_a1b2', 'o_e5f6'])).toEqual({ ok: true, value: ['o_a1b2', 'o_e5f6'] });
    expect(parseAnswer('multi_choice', []).ok).toBe(false);
    expect(parseAnswer('multi_choice', 'o_a1b2').ok).toBe(false);
    expect(normaliseMultiChoiceAnswer(['o_c3d4', 'o_a1b2', 'o_c3d4'])).toEqual(['o_a1b2', 'o_c3d4']);
  });
  it('true_false 是布林；pick_line 是線 ID', () => {
    expect(parseAnswer('true_false', false)).toEqual({ ok: true, value: false });
    expect(parseAnswer('true_false', 'true').ok).toBe(false);
    expect(parseAnswer('pick_line', 'is_gross_profit').ok).toBe(true);
    expect(parseAnswer('pick_line', 'gross_profit').ok).toBe(false);
  });
  it('classify 是項目 ID 對分類；transaction_effect 是 target ID 對方向、狀態或數字；five_step_fill 是線 ID 對數字', () => {
    expect(parseAnswer('classify', { it_2k4m: 'asset', it_3n5p: 'liability' }).ok).toBe(true);
    expect(parseAnswer('classify', { item1: 'asset' }).ok).toBe(false);
    expect(parseAnswer('classify', { it_2k4m: 'Asset' }).ok).toBe(false);
    expect(parseAnswer('transaction_effect', { t1: 'up', t2: 80000, t3: 'na' }).ok).toBe(true);
    expect(parseAnswer('transaction_effect', { t1: 'sideways' }).ok).toBe(false);
    expect(parseAnswer('transaction_effect', { t1: Number.NaN }).ok).toBe(false);
    expect(parseAnswer('five_step_fill', { bs_cash: 580000 }).ok).toBe(true);
    expect(parseAnswer('five_step_fill', { bs_cash: '580000' }).ok).toBe(false);
  });
  it('ratio_numeric 是 value 或 na；journal_entry 是分錄行的二維陣列', () => {
    expect(parseAnswer('ratio_numeric', { kind: 'value', value: 12.5 }).ok).toBe(true);
    expect(parseAnswer('ratio_numeric', { kind: 'na' }).ok).toBe(true);
    expect(parseAnswer('ratio_numeric', { kind: 'na', value: 1 }).ok).toBe(false);
    expect(parseAnswer('ratio_numeric', 12.5).ok).toBe(false);
    expect(parseAnswer('journal_entry', [[{ account: 'cash', side: 'debit', amount: 80000 }]]).ok).toBe(true);
    expect(parseAnswer('journal_entry', [[{ account: 'cash', side: 'debit', amount: -1 }]]).ok).toBe(false);
    expect(parseAnswer('journal_entry', [[{ account: 'cash', side: 'dr', amount: 1 }]]).ok).toBe(false);
    expect(parseAnswer('journal_entry', [{ account: 'cash', side: 'debit', amount: 1 }]).ok).toBe(false);
  });
  it('失敗時是 Result 錯誤值，附題型與問題路徑', () => {
    const r = parseAnswer('classify', { it_2k4m: 7 });
    expect(r).toMatchObject({ ok: false, error: { code: 'answer.invalid', type: 'classify' } });
    expect(r.ok ? [] : r.error.issues.map((i) => i.path)).toEqual(['it_2k4m']);
  });
});
