// 介面狀態到作答格式、可否送出、判分膠水（03 第 2.4、2.5、2.12 節；04 第 15.2 節）
import { describe, expect, it } from 'vitest';
import { canSubmit, toQuizAnswer, withEffectAnswer } from '../src/features/quiz/answers.ts';
import { scoreContextOf, scoreSnapshotQuestion } from '../src/features/quiz/scoring.ts';
import { qClassify, qEffect, qJudgment, qMulti, qSingle, qTrueFalse } from './quiz-fixtures.ts';

describe('canSubmit', () => {
  it('每種題型的最低作答條件', () => {
    expect(canSubmit(qSingle, undefined)).toBe(false);
    expect(canSubmit(qSingle, 'o_a1b2')).toBe(true);
    expect(canSubmit(qMulti, [])).toBe(false);
    expect(canSubmit(qMulti, ['o_p1a1'])).toBe(true);
    // any_correct 也是陣列（只有一個元素），字串不算作答
    expect(canSubmit({ ...qMulti, scoringMode: 'any_correct' }, ['o_p1a1'])).toBe(true);
    expect(canSubmit({ ...qMulti, scoringMode: 'any_correct' }, 'o_p1a1')).toBe(false);
    expect(canSubmit(qTrueFalse, null)).toBe(false);
    expect(canSubmit(qTrueFalse, false)).toBe(true);
    expect(canSubmit(qClassify, { it_c1a1: 'asset' })).toBe(false);
    expect(canSubmit(qClassify, { it_c1a1: 'asset', it_c2b2: 'liability', it_c3d3: 'equity' })).toBe(true);
    expect(canSubmit(qEffect, { t1: { direction: 'down' } })).toBe(false);
    expect(canSubmit(qEffect, { t1: { direction: 'down' }, t2: { raw: ' ' } })).toBe(false);
    expect(canSubmit(qEffect, { t1: { direction: 'down' }, t2: { raw: '150,000' } })).toBe(true);
    expect(canSubmit(qJudgment, 'o_j2b2')).toBe(true);
  });
});

describe('toQuizAnswer', () => {
  it('multi_choice 去重排序；transaction_effect 的金額正規化（千分位、全形、元）', () => {
    expect(toQuizAnswer(qMulti, ['o_p2b2', 'o_p1a1', 'o_p2b2'])).toEqual(['o_p1a1', 'o_p2b2']);
    expect(toQuizAnswer(qEffect, { t1: { direction: 'down' }, t2: { raw: '１５０,０００元' } })).toEqual({ t1: 'down', t2: 150000 });
    // 讀不懂的金額省略，判分時算錯
    expect(toQuizAnswer(qEffect, { t1: { direction: 'down' }, t2: { raw: '(150000)' } })).toEqual({ t1: 'down' });
    expect(toQuizAnswer(qSingle, 'o_a1b2')).toBe('o_a1b2');
  });
  it('withEffectAnswer 只留有值的欄位', () => {
    expect(withEffectAnswer({ t1: { direction: 'up' } }, 't2', { raw: '12' })).toEqual({ t1: { direction: 'up' }, t2: { raw: '12' } });
    expect(withEffectAnswer({}, 't1', { direction: 'down', raw: undefined })).toEqual({ t1: { direction: 'down' } });
  });
});

describe('scoreSnapshotQuestion', () => {
  it('classify 的正解來自 compiled.categories；部分分數', () => {
    const ctx = scoreContextOf(qClassify);
    expect(ctx.classifyKey?.({ id: 'it_c1a1' } as never, 'element')).toBe('asset');
    const { result } = scoreSnapshotQuestion(qClassify, { it_c1a1: 'asset', it_c2b2: 'asset', it_c3d3: 'equity' });
    expect(result.correct).toBe(false);
    expect(result.score).toBeCloseTo(2 / 3);
    expect(result.detail.kind).toBe('classify');
  });
  it('transaction_effect 的正解來自 compiled.expected；原始輸入先正規化', () => {
    const { result, answer } = scoreSnapshotQuestion(qEffect, { t1: { direction: 'down' }, t2: { raw: '150,000' } });
    expect(answer).toEqual({ t1: 'down', t2: 150000 });
    expect(result.correct).toBe(true);
    const wrong = scoreSnapshotQuestion(qEffect, { t1: { direction: 'up' }, t2: { raw: '150000' } }).result;
    expect(wrong.correct).toBe(false);
    expect(wrong.detail.kind === 'transaction_effect' && wrong.detail.correctCount).toBe(1);
  });
  it('single、multi、true_false 與取捨題', () => {
    expect(scoreSnapshotQuestion(qSingle, 'o_a1b2').result.correct).toBe(true);
    expect(scoreSnapshotQuestion(qSingle, 'o_c3d4').result.correct).toBe(false);
    expect(scoreSnapshotQuestion(qMulti, ['o_p2b2', 'o_p1a1']).result.correct).toBe(true);
    expect(scoreSnapshotQuestion(qMulti, ['o_p1a1']).result.correct).toBe(false);
    const any = scoreSnapshotQuestion({ ...qMulti, scoringMode: 'any_correct' }, ['o_p1a1']).result;
    expect(any.correct).toBe(true);
    expect(any.detail.kind === 'multi_choice' && any.detail.options.find((o) => o.id === 'o_p2b2')?.status).toBe('also_reasonable');
    expect(scoreSnapshotQuestion(qTrueFalse, false).result.correct).toBe(true);
    const j = scoreSnapshotQuestion(qJudgment, 'o_j1a1').result;
    expect(j.detail.kind).toBe('unscored');
    expect(j.score).toBe(0);
  });
});
