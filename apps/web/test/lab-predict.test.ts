// 預測（features/lab/predict.ts，03 第 3.6 節）：固定六個目標加步驟資料的額外目標；方向看差額正負；指標六選項；幾乎不變時兩種答案都算對
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCoreContext } from '@ledgerland/core';
import officialJson from '../../../content/stories/story_ywv2dy.json' with { type: 'json' };
import type { StorySnapshot } from '../src/lib/content.ts';
import { resetProgressStoreForTests } from '../src/lib/progress/index.ts';
import { freshIndexedDB } from './fixtures.ts';
import {
  DEFAULT_LINE_TARGETS,
  answeredTargets,
  isPredictionCorrect,
  lineDirection,
  predictTargetsOf,
  ratioDirection,
  recordOnTargets,
  targetsOnLayout,
  type PredictionRecord,
  judgeTarget,
  SANDBOX_PREDICT_TARGETS,
  scorePrediction,
  type PredictPoints,
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
});

describe('依版面篩選目標（03 第 3.13 節）', () => {
  const teacher = createCoreContext().layout;
  const ifrs = createCoreContext({ policy: 'ifrs@1' }).layout;
  const story = officialJson as unknown as StorySnapshot;
  const step5 = story.steps.find((s) => s.id === 'st_yj3yex')!;
  const all = predictTargetsOf(step5.predictTargets);
  const shown = targetsOnLayout(all, ifrs);
  const lineOf = (t: (typeof all)[number]) => (t.kind === 'line' ? t.line : '');

  it('ifrs@1：經常利益不在版面上、遞延的設立費是不顯示的計算列，兩個目標都拿掉；其他照舊', () => {
    expect(all.map(lineOf)).toContain('is_ordinary_income');
    expect(all.map(lineOf)).toContain('bs_deferred_org_costs');
    expect(shown.map(lineOf)).toEqual(['bs_cash', 'is_gross_profit', 'is_operating_income', 'is_pretax_income', 'is_net_income', 'bs_total_assets']);
  });

  it('正式故事的每一步：教材一個都不少；ifrs@1 留下的線目標都是版面上看得到的列', () => {
    const rows = new Map(Object.values(ifrs.statements).flatMap((r) => r.map((l) => [l.id, l] as const)));
    for (const s of story.steps) {
      const targets = predictTargetsOf(s.predictTargets);
      expect(targetsOnLayout(targets, teacher)).toEqual(targets);
      const lines = targetsOnLayout(targets, ifrs).flatMap((t) => (t.kind === 'line' ? [t.line] : []));
      expect(lines.filter((l) => rows.get(l) === undefined || rows.get(l)?.hidden === true)).toEqual([]);
    }
  });

  it('科目與指標目標不受版面影響；版面找不到的線拿掉', () => {
    const t = [
      { id: 'a', kind: 'account', account: 'no_such_account' },
      { id: 'r', kind: 'ratio', ratioRef: 'current_ratio@excel' },
      { id: 'l', kind: 'line', line: 'no_such_line' },
    ] as const;
    expect(targetsOnLayout(t, ifrs).map((x) => x.id)).toEqual(['a', 'r']);
  });

  it('換口徑：成績只算兩邊都有的目標；另一套的紀錄不會讓目標變成沒選', () => {
    const teacherTargets = targetsOnLayout(all, teacher);
    // 教材記下的八個答案，在 IFRS 對照時算六個
    const teacherRecord = Object.fromEntries(teacherTargets.map((t) => [t.id, 'up' as const]));
    expect(answeredTargets(shown, teacherRecord).map((t) => t.id)).toEqual(shown.map((t) => t.id));
    // IFRS 對照記下的六個答案，回到教材仍是六個，不把經常利益算成沒選
    const ifrsRecord: PredictionRecord = Object.fromEntries(shown.map((t) => [t.id, 'down' as const]));
    expect(answeredTargets(teacherTargets, ifrsRecord)).toHaveLength(6);
    expect(answeredTargets(teacherTargets, ifrsRecord).some((t) => t.id === 'l3')).toBe(false);
    // 舊紀錄是空的或有已經不存在的目標：不會壞
    expect(answeredTargets(teacherTargets, {})).toEqual([]);
    expect(answeredTargets(teacherTargets, { gone: 'up' })).toEqual([]);
  });

  it('記下預測時只留畫面上的目標：教材留下的經常利益不跟著 IFRS 對照的紀錄存', () => {
    const record: PredictionRecord = { cash: 'up', l3: 'down', gone: 'up' };
    expect(recordOnTargets(shown, record)).toEqual({ cash: 'up' });
  });
});

describe('predictTotals', () => {
  it('把每一步的成績加總，steps 是有記過預測的步數', async () => {
    const { predictTotals } = await import('../src/features/lab/progress.ts');
    expect(predictTotals({ predictScores: {} })).toEqual({ steps: 0, right: 0, total: 0 });
    expect(predictTotals({ predictScores: { a: { right: 4, total: 6 }, b: { right: 6, total: 6 } } })).toEqual({ steps: 2, right: 10, total: 12 });
  });
});

describe('savePrediction 的口徑（03 第 3.13 節）', () => {
  beforeEach(async () => {
    freshIndexedDB();
    await resetProgressStoreForTests();
  });
  afterEach(() => resetProgressStoreForTests());

  it('IFRS 對照時記 predictBasis；教材時拿掉；成績照常存', async () => {
    const { readStoryProgress, savePrediction } = await import('../src/features/lab/progress.ts');
    await savePrediction('story_x', 'st_a', { cash: 'up' }, { right: 1, total: 1 }, 'ifrs@1');
    let p = (await readStoryProgress('story_x')).progress;
    expect(p.predictBasis).toEqual({ st_a: 'ifrs@1' });
    expect(p.predictScores).toEqual({ st_a: { right: 1, total: 1 } });
    await savePrediction('story_x', 'st_b', { cash: 'down' }, { right: 0, total: 1 });
    p = (await readStoryProgress('story_x')).progress;
    expect(p.predictBasis).toEqual({ st_a: 'ifrs@1' });
    await savePrediction('story_x', 'st_a', { cash: 'up' }, { right: 1, total: 1 }, 'teacher@1');
    p = (await readStoryProgress('story_x')).progress;
    expect(p.predictBasis).toEqual({});
    expect(Object.keys(p.predictions).sort()).toEqual(['st_a', 'st_b']);
  });
});

describe('自由實驗的先猜再改（judgeTarget、scorePrediction）', () => {
  const points = (lines: Record<string, number>, ratios: Record<string, { display: number | null; exact: number | null }>): PredictPoints => ({
    line: (id) => lines[id] ?? 0,
    ratio: (ref) => ratios[ref] ?? { display: null, exact: null },
  });
  it('目標是固定六個加流動比率與負債比率', () => {
    expect(SANDBOX_PREDICT_TARGETS.map((t) => t.id)).toEqual(['cash', 'l1', 'l2', 'l3', 'l4', 'l5', 'r-current', 'r-debt']);
  });
  it('線看金額差額的正負；指標 N/A 變成數字是變得可以計算，0 變成數字是上升；幾乎不變時兩種答案都算對', () => {
    const before = points({ bs_cash: 718_000 }, { 'current_ratio@excel': { display: null, exact: null }, 'debt_ratio@excel': { display: 0, exact: 0 } });
    const after = points(
      { bs_cash: 868_000 },
      { 'current_ratio@excel': { display: 5.79, exact: 5.786 }, 'debt_ratio@excel': { display: 15.03, exact: 0.1503 } },
    );
    const { results, score } = scorePrediction(SANDBOX_PREDICT_TARGETS, { cash: 'up', l1: 'unchanged', 'r-current': 'up', 'r-debt': 'up' }, before, after);
    const byId = Object.fromEntries(results.map((r) => [r.target.id, r]));
    expect(byId['cash']!.answer).toEqual({ answer: 'up', nearly: false });
    expect(byId['cash']!.correct).toBe(true);
    expect(byId['l1']!.correct).toBe(true);
    expect(byId['r-current']!.answer.answer).toBe('becomes_computable');
    expect(byId['r-current']!.correct).toBe(false);
    expect(byId['r-debt']!.answer.answer).toBe('up');
    expect(byId['r-debt']!.correct).toBe(true);
    // 沒選的四個目標算錯
    expect(score).toEqual({ right: 3, total: 8 });
    // 幾乎不變：精確值有變、顯示值相同
    const nearly = judgeTarget(
      { id: 'x', kind: 'ratio', ratioRef: 'roa@excel' },
      points({}, { 'roa@excel': { display: 5.66, exact: 0.05661 } }),
      points({}, { 'roa@excel': { display: 5.66, exact: 0.05664 } }),
    );
    expect(nearly).toEqual({ answer: 'unchanged', nearly: true, exact: 'up' });
    expect(isPredictionCorrect('up', nearly.answer, nearly.nearly, nearly.exact)).toBe(true);
    expect(isPredictionCorrect('unchanged', nearly.answer, nearly.nearly, nearly.exact)).toBe(true);
  });
});
