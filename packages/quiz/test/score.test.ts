// 判分（03 第 2.4、2.5、2.12 節；04 第 14 節）：每種題型的正反例、多正解題的四種狀態與兩種判分、分類題部分分數、交易影響題兩種計分、分錄題、取捨題不計分
import { describe, expect, it } from 'vitest';
import { type EntryLine, buildChart, defaultAccounts } from '@ledgerland/core';
import { UNSCORED, scoreAttempt, scoreJournalEntry, scoreMultiChoice, scoreQuestion } from '../src/index.ts';
import {
  allCorrect,
  anyCorrect,
  classify,
  effect,
  effectExpected,
  fiveStep,
  journal,
  judgment,
  pickLine,
  question,
  ratioNumeric,
  ratioResult,
  single,
  trueFalse,
} from './fixtures.ts';

const statuses = (r: ReturnType<typeof scoreQuestion>) =>
  r.detail.kind === 'choice' || r.detail.kind === 'multi_choice' ? r.detail.options.map((o) => `${o.id}:${o.status}`) : [];

describe('單選類', () => {
  it('選到正解得 1，其他選項標 wrong_not_selected', () => {
    const r = scoreQuestion(single, 'o_c3d4');
    expect(r.score).toBe(1);
    expect(r.correct).toBe(true);
    expect(statuses(r)).toEqual(['o_a1b2:wrong_not_selected', 'o_c3d4:correct_selected', 'o_e5f6:wrong_not_selected']);
  });
  it('選錯得 0，正解標 correct_not_selected；不存在的選項也是 0', () => {
    const r = scoreQuestion(single, 'o_e5f6');
    expect(r).toMatchObject({ score: 0, correct: false });
    expect(statuses(r)).toEqual(['o_a1b2:wrong_not_selected', 'o_c3d4:correct_not_selected', 'o_e5f6:wrong_selected']);
    expect(scoreQuestion(single, 'o_zzzz').score).toBe(0);
  });
  it('pick_statement 與 ratio_interpret 規則相同', () => {
    const pick = question<'pick_statement'>({ ...single, id: 'q_2p6s8t4m', type: 'pick_statement' });
    const interpret = question<'ratio_interpret'>({ ...single, id: 'q_3r7n9t5k', type: 'ratio_interpret', ratioRef: 'roa@excel' });
    expect(scoreQuestion(pick, 'o_c3d4').correct).toBe(true);
    expect(scoreQuestion(interpret, 'o_a1b2').correct).toBe(false);
  });
  it('作答形狀不對是程式錯誤', () => expect(() => scoreQuestion(single, ['o_c3d4'] as unknown as string)).toThrow(TypeError));
});

describe('multi_choice any_correct', () => {
  it('選中任一正解得 1；其他正解標 also_reasonable', () => {
    const r = scoreQuestion(anyCorrect, ['o_e5f6']);
    expect(r).toMatchObject({ score: 1, correct: true });
    expect(statuses(r)).toEqual(['o_a1b2:also_reasonable', 'o_c3d4:wrong_not_selected', 'o_e5f6:correct_selected', 'o_g7h8:wrong_not_selected']);
  });
  it('選到錯的是 0；選兩個（即使都對）也是 0', () => {
    expect(scoreQuestion(anyCorrect, ['o_c3d4'])).toMatchObject({ score: 0, correct: false });
    expect(statuses(scoreQuestion(anyCorrect, ['o_c3d4']))).toContain('o_c3d4:wrong_selected');
    expect(scoreQuestion(anyCorrect, ['o_a1b2', 'o_e5f6']).score).toBe(0);
  });
});

describe('multi_choice all_correct', () => {
  it('集合完全相同才得 1，順序不拘', () => {
    expect(scoreQuestion(allCorrect, ['o_e5f6', 'o_a1b2'])).toMatchObject({ score: 1, correct: true });
    expect(statuses(scoreQuestion(allCorrect, ['o_e5f6', 'o_a1b2']))).toEqual([
      'o_a1b2:correct_selected',
      'o_c3d4:wrong_not_selected',
      'o_e5f6:correct_selected',
      'o_g7h8:wrong_not_selected',
    ]);
  });
  it('少選是 0（漏選標 correct_not_selected）；多選是 0（標 wrong_selected）；不給部分分數', () => {
    const fewer = scoreQuestion(allCorrect, ['o_a1b2']);
    expect(fewer.score).toBe(0);
    expect(statuses(fewer)).toContain('o_e5f6:correct_not_selected');
    const more = scoreQuestion(allCorrect, ['o_a1b2', 'o_e5f6', 'o_g7h8']);
    expect(more.score).toBe(0);
    expect(statuses(more)).toContain('o_g7h8:wrong_selected');
    expect(scoreQuestion(allCorrect, ['o_c3d4', 'o_g7h8']).score).toBe(0);
  });
  it('scoreMultiChoice 可單獨使用；detail 的 selected 已排序', () => {
    const r = scoreMultiChoice(['o_e5f6', 'o_a1b2'], { optionIds: ['o_a1b2', 'o_e5f6'], correctOptionIds: ['o_a1b2', 'o_e5f6'], scoringMode: 'all_correct' });
    expect(r.correct).toBe(true);
    expect(r.detail).toMatchObject({ kind: 'multi_choice', selected: ['o_a1b2', 'o_e5f6'] });
  });
});

describe('true_false 與 pick_line', () => {
  it('true_false 對上 correct 才得分', () => {
    expect(scoreQuestion(trueFalse, false)).toMatchObject({ score: 1, correct: true, detail: { kind: 'true_false', selected: false, expected: false } });
    expect(scoreQuestion(trueFalse, true).score).toBe(0);
  });
  it('pick_line 接受 correctLines 任一列', () => {
    expect(scoreQuestion(pickLine, 'bs_cash').correct).toBe(true);
    expect(scoreQuestion(pickLine, 'bs_short_term_borrowings').correct).toBe(true);
    expect(scoreQuestion(pickLine, 'bs_total_assets')).toMatchObject({
      score: 0,
      detail: { kind: 'pick_line', correctLines: ['bs_cash', 'bs_short_term_borrowings'] },
    });
  });
});

describe('classify', () => {
  const classifyKey = (item: { account?: string; ratio?: string }) =>
    item.account === 'cash' ? 'asset' : item.account === 'short_term_borrowings' ? 'liability' : item.ratio ? 'profitability' : undefined;
  it('全對得 1', () => {
    const r = scoreQuestion(classify, { it_2k4m: 'asset', it_3n5p: 'liability', it_4q6r: 'profitability', it_5s7t: 'not_in_books' }, { classifyKey });
    expect(r).toMatchObject({ score: 1, correct: true, detail: { kind: 'classify', correctCount: 4, total: 4 } });
  });
  it('部分分數是答對比例，detail 給每項目的正解；漏放的項目算錯', () => {
    const r = scoreQuestion(classify, { it_2k4m: 'asset', it_3n5p: 'asset', it_4q6r: 'profitability' }, { classifyKey });
    expect(r.score).toBe(0.5);
    expect(r.correct).toBe(false);
    expect(r.detail).toEqual({
      kind: 'classify',
      correctCount: 2,
      total: 4,
      items: [
        { id: 'it_2k4m', selected: 'asset', expected: 'asset', correct: true },
        { id: 'it_3n5p', selected: 'asset', expected: 'liability', correct: false },
        { id: 'it_4q6r', selected: 'profitability', expected: 'profitability', correct: true },
        { id: 'it_5s7t', selected: null, expected: 'not_in_books', correct: false },
      ],
    });
  });
  it('缺少正解分類是程式錯誤', () => {
    expect(() => scoreQuestion(classify, { it_2k4m: 'asset' })).toThrow(TypeError);
    expect(() => scoreQuestion(classify, { it_2k4m: 'asset' }, { classifyKey: () => undefined })).toThrow(TypeError);
  });
});

describe('transaction_effect', () => {
  const all = { t1: 'up', t2: 80000, t3: 'unchanged' } as const;
  it('預設 allOrNothing：全對得 1，錯一個得 0，detail 逐目標', () => {
    expect(scoreQuestion(effect, all, { expected: effectExpected })).toMatchObject({
      score: 1,
      correct: true,
      detail: { scoring: 'allOrNothing', correctCount: 3, total: 3 },
    });
    const r = scoreQuestion(effect, { ...all, t2: 8000 }, { expected: effectExpected });
    expect(r).toMatchObject({ score: 0, correct: false });
    expect(r.detail).toMatchObject({
      targets: [
        { id: 't1', correct: true },
        { id: 't2', measure: 'delta', selected: 8000, expected: 80000, correct: false },
        { id: 't3', correct: true },
      ],
    });
  });
  it('perTarget：得分是答對比例；沒填的目標算錯', () => {
    expect(scoreQuestion(effect, { ...all, t2: 8000 }, { expected: effectExpected, effectScoring: 'perTarget' })).toMatchObject({
      score: 2 / 3,
      correct: false,
    });
    expect(scoreQuestion(effect, { t1: 'up' }, { expected: effectExpected, effectScoring: 'perTarget' })).toMatchObject({ score: 1 / 3 });
    expect(scoreQuestion(effect, all, { expected: effectExpected, effectScoring: 'perTarget' })).toMatchObject({ score: 1, correct: true });
  });
  it('題目的 scoring 欄位優先於 context', () => {
    const withField = question<'transaction_effect'>({ ...effect, scoring: 'perTarget' });
    expect(scoreQuestion(withField, { t1: 'up' }, { expected: effectExpected, effectScoring: 'allOrNothing' })).toMatchObject({ score: 1 / 3 });
    expect(scoreQuestion(withField, { t1: 'up' }, { expected: effectExpected })).toMatchObject({ score: 1 / 3, detail: { scoring: 'perTarget' } });
  });
  it('status 目標比指標狀態；缺 expected 或缺某個 target 的正解是程式錯誤', () => {
    const statusQ = question<'transaction_effect'>({
      ...effect,
      scenario: { ...effect.scenario, targets: [{ id: 't1', kind: 'ratio', ratioRef: 'roa@excel', measure: 'status' }] },
      choices: undefined,
    });
    expect(scoreQuestion(statusQ, { t1: 'na' }, { expected: { t1: { status: 'na', before: null, after: null } } }).correct).toBe(true);
    expect(scoreQuestion(statusQ, { t1: 'ok' }, { expected: { t1: { status: 'na', before: null, after: null } } }).correct).toBe(false);
    expect(() => scoreQuestion(effect, all)).toThrow(TypeError);
    expect(() => scoreQuestion(effect, all, { expected: { t1: effectExpected.t1 } })).toThrow(TypeError);
  });
});

describe('five_step_fill', () => {
  const expectedCells = { cf_pretax_income: 0, bs_cash: 580000 };
  it('逐格完全相同才得 1；差 1 元也是 0', () => {
    expect(scoreQuestion(fiveStep, { cf_pretax_income: 0, bs_cash: 580000 }, { expectedCells })).toMatchObject({
      score: 1,
      correct: true,
      detail: { kind: 'five_step_fill', correctCount: 2 },
    });
    const r = scoreQuestion(fiveStep, { cf_pretax_income: 0, bs_cash: 579999 }, { expectedCells });
    expect(r).toMatchObject({ score: 0, correct: false });
    expect(r.detail).toMatchObject({
      cells: [
        { line: 'cf_pretax_income', correct: true },
        { line: 'bs_cash', selected: 579999, expected: 580000, correct: false },
      ],
    });
  });
  it('沒填的格子算錯；缺正確金額是程式錯誤', () => {
    expect(scoreQuestion(fiveStep, { bs_cash: 580000 }, { expectedCells }).detail).toMatchObject({
      cells: [
        { line: 'cf_pretax_income', selected: null, correct: false },
        { line: 'bs_cash', correct: true },
      ],
      correctCount: 1,
    });
    expect(() => scoreQuestion(fiveStep, { bs_cash: 580000 }, { expectedCells: { bs_cash: 580000 } })).toThrow(TypeError);
    expect(() => scoreQuestion(fiveStep, { bs_cash: 580000 })).toThrow(TypeError);
  });
});

describe('ratio_numeric 經由 scoreQuestion', () => {
  it('用題目的 decimals、tolerance、answerUnit 與 context.ratio', () => {
    expect(scoreQuestion(ratioNumeric, { kind: 'value', value: 12.5 }, { ratio: ratioResult() })).toMatchObject({
      score: 1,
      correct: true,
      detail: { kind: 'numeric', expectedValue: 12.5 },
    });
    expect(scoreQuestion(ratioNumeric, { kind: 'value', value: 12.52 }, { ratio: ratioResult() }).correct).toBe(false);
    expect(() => scoreQuestion(ratioNumeric, { kind: 'na' })).toThrow(TypeError);
  });
});

describe('journal_entry', () => {
  const chart = buildChart(defaultAccounts);
  const expected: EntryLine[][] = [
    [
      { account: 'cash', side: 'debit', amount: 80000 },
      { account: 'short_term_borrowings', side: 'credit', amount: 80000 },
    ],
  ];
  it('多重集合相同得 1；拆開寫、用別名也對', () => {
    expect(scoreQuestion(journal, expected, { expectedEntries: expected, chart })).toMatchObject({
      score: 1,
      correct: true,
      detail: { kind: 'journal_entry', missing: [], extra: [], unresolved: [] },
    });
    const split: EntryLine[][] = [
      [
        { account: 'cash', side: 'debit', amount: 50000 },
        { account: '短期借款', side: 'credit', amount: 50000 },
      ],
      [
        { account: 'cash', side: 'debit', amount: 30000 },
        { account: '短期借款', side: 'credit', amount: 30000 },
      ],
    ];
    expect(scoreQuestion(journal, split, { expectedEntries: expected, chart }).correct).toBe(true);
  });
  it('方向反了得 0，detail 列出 missing 與 extra；不給部分分數', () => {
    const wrong: EntryLine[][] = [
      [
        { account: 'cash', side: 'credit', amount: 80000 },
        { account: 'short_term_borrowings', side: 'debit', amount: 80000 },
      ],
    ];
    const r = scoreQuestion(journal, wrong, { expectedEntries: expected, chart });
    expect(r).toMatchObject({ score: 0, correct: false });
    expect(r.detail).toMatchObject({
      missing: expect.arrayContaining([{ account: 'cash', side: 'debit', amount: 80000 }]),
      extra: expect.arrayContaining([{ account: 'cash', side: 'credit', amount: 80000 }]),
    });
    expect(r.detail.kind === 'journal_entry' ? r.detail.missing.length : -1).toBe(2);
  });
  it('金額不對的行同時在 missing 與 extra；解析不到的科目列在 unresolved', () => {
    const r = scoreJournalEntry(
      [
        [
          { account: 'cash', side: 'debit', amount: 80000 },
          { account: 'short_term_borrowings', side: 'credit', amount: 8000 },
        ],
      ],
      expected,
      chart,
    );
    expect(r.correct).toBe(false);
    expect(r.detail).toMatchObject({
      missing: [{ account: 'short_term_borrowings', side: 'credit', amount: 80000 }],
      extra: [{ account: 'short_term_borrowings', side: 'credit', amount: 8000 }],
    });
    const u = scoreJournalEntry([[{ account: '不存在', side: 'debit', amount: 1 }]], expected, chart);
    expect(u.detail).toMatchObject({ unresolved: ['不存在'] });
  });
  it('題目 allowAliases 為 false 時別名不接受', () => {
    const strict = question<'journal_entry'>({ ...journal, allowAliases: false });
    const alias: EntryLine[][] = [
      [
        { account: '現金', side: 'debit', amount: 80000 },
        { account: 'short_term_borrowings', side: 'credit', amount: 80000 },
      ],
    ];
    expect(scoreQuestion(strict, alias, { expectedEntries: expected, chart }).correct).toBe(false);
    expect(scoreQuestion(journal, alias, { expectedEntries: expected, chart }).correct).toBe(true);
    expect(() => scoreQuestion(journal, expected, { chart })).toThrow(TypeError);
  });
});

describe('不計分', () => {
  it('judgment 永遠是 UNSCORED', () => {
    expect(scoreQuestion(judgment, 'o_j1k1')).toEqual(UNSCORED);
    expect(UNSCORED).toEqual({ score: 0, correct: false, detail: { kind: 'unscored', unscored: true } });
  });
  it('scored 為 false 的題目（例如 pendingRefs 非空）也不計分', () => {
    const pending = question<'single_choice'>({ ...single, scored: false, pendingRefs: ['T04'] });
    expect(scoreQuestion(pending, 'o_c3d4')).toEqual(UNSCORED);
  });
});

describe('scoreAttempt', () => {
  it('先解析未知形狀再判分；形狀不對以 Result 回傳', () => {
    expect(scoreAttempt(single, 'o_c3d4')).toMatchObject({ ok: true, value: { score: 1 } });
    expect(scoreAttempt(single, 42)).toMatchObject({ ok: false, error: { code: 'answer.invalid', type: 'single_choice' } });
  });
});
