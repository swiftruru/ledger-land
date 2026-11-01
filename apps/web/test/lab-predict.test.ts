// 預測（features/lab/predict.ts，03 第 3.6 節）：固定六個目標加步驟資料的額外目標；方向看差額正負；指標六選項；幾乎不變時兩種答案都算對
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LINE_TARGETS,
  isPredictionComplete,
  isPredictionCorrect,
  lineDirection,
  predictTargetsOf,
  ratioDirection,
} from '../src/features/lab/predict.ts';

describe('predictTargetsOf', () => {
  it('固定是現金與五層利益；額外的 line 目標接在後面、重複的線不加、金額題不加', () => {
    const t = predictTargetsOf([
      { id: 't1', kind: 'line', line: 'bs_inventory', measure: 'direction' },
      { id: 't2', kind: 'line', line: 'bs_cash', measure: 'direction' },
      { id: 't3', kind: 'line', line: 'bs_total_assets', measure: 'delta' },
      { id: 't4', kind: 'ratio', ratioRef: 'current_ratio@excel', measure: 'direction' },
      { id: 't5', kind: 'check', step: 2, measure: 'value' },
    ]);
    expect(t.slice(0, 6).map((x) => x.id)).toEqual(DEFAULT_LINE_TARGETS.map((x) => x.id));
    expect(t.slice(6)).toEqual([
      { id: 'x-t1', kind: 'line', line: 'bs_inventory' },
      { id: 'x-t4', kind: 'ratio', ratioRef: 'current_ratio@excel' },
    ]);
    expect(predictTargetsOf(undefined)).toHaveLength(6);
  });
});

describe('方向', () => {
  it('差額的正負：虧損變小是增加', () => {
    expect(lineDirection(-42000, -5000)).toBe('up');
    expect(lineDirection(120000, 0)).toBe('down');
    expect(lineDirection(0, 0)).toBe('unchanged');
  });

  it('指標六選項：0 是數字，N/A 變數字是變得可以計算', () => {
    expect(ratioDirection({ display: null }, { display: 578.67 }).answer).toBe('becomes_computable');
    expect(ratioDirection({ display: 0 }, { display: 15.03 }).answer).toBe('up');
    expect(ratioDirection({ display: 5.66 }, { display: 4.81 }).answer).toBe('down');
    expect(ratioDirection({ display: 0 }, { display: null }).answer).toBe('becomes_na');
    expect(ratioDirection({ display: null }, { display: null }).answer).toBe('stays_na');
    expect(ratioDirection({ display: 1.5 }, { display: 1.5 }).answer).toBe('unchanged');
  });

  it('揭曉：選對算對；幾乎不變時不變與實際方向都算對；沒選算錯', () => {
    expect(isPredictionCorrect('up', 'up')).toBe(true);
    expect(isPredictionCorrect('down', 'up')).toBe(false);
    expect(isPredictionCorrect(undefined, 'up')).toBe(false);
    expect(isPredictionCorrect('unchanged', 'unchanged', true, 'up')).toBe(true);
    expect(isPredictionCorrect('up', 'unchanged', true, 'up')).toBe(true);
    expect(isPredictionCorrect('down', 'unchanged', true, 'up')).toBe(false);
  });

  it('每個目標都選了才算完成', () => {
    const t = predictTargetsOf(undefined);
    expect(isPredictionComplete(t, undefined)).toBe(false);
    const all = Object.fromEntries(t.map((x) => [x.id, 'up' as const]));
    expect(isPredictionComplete(t, all)).toBe(true);
    const { cash: _c, ...rest } = all;
    expect(isPredictionComplete(t, rest)).toBe(false);
  });
});

describe('predictTotals', () => {
  it('把每一步的成績加總，steps 是有記過預測的步數', async () => {
    const { predictTotals } = await import('../src/features/lab/progress.ts');
    expect(predictTotals({ predictScores: {} })).toEqual({ steps: 0, right: 0, total: 0 });
    expect(predictTotals({ predictScores: { a: { right: 4, total: 6 }, b: { right: 6, total: 6 } } })).toEqual({ steps: 2, right: 10, total: 12 });
  });
});
