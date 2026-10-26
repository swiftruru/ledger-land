// M3 其餘題型的介面狀態與作答格式（03 第 2.4 節表二）：five_step_fill、ratio_numeric、journal_entry 的 canSubmit 與 toQuizAnswer、
// 分錄題逐行回饋的對應、五步驟勾稽格子的勾稽點推導、指標數值的格式化
import { describe, expect, it } from 'vitest';
import { teacherLayout } from '@ledgerland/core';
import { canSubmit, journalLineStatuses, journalLinesOf, ratioInputUnitOf, toQuizAnswer } from '../src/features/quiz/answers.ts';
import { checkLetterOf, checkStepsOf, statementOfLine, stepMark } from '../src/features/quiz/five-step.ts';
import { digitsOf, formatRatioValue } from '../src/features/quiz/ratio-format.ts';
import { numericUnitOf } from '../src/features/quiz/ratio-units.ts';
import { qFiveStep, qJournal, qRatioNumeric } from './quiz-fixtures.ts';

describe('canSubmit（M3 題型）', () => {
  it('five_step_fill：每個開放格子都要有輸入', () => {
    expect(canSubmit(qFiveStep, undefined)).toBe(false);
    expect(canSubmit(qFiveStep, { cf_pretax_income: '0' })).toBe(false);
    expect(canSubmit(qFiveStep, { cf_pretax_income: '0', bs_cash: ' ' })).toBe(false);
    expect(canSubmit(qFiveStep, { cf_pretax_income: '0', bs_cash: '250,000' })).toBe(true);
  });
  it('ratio_numeric：有數字或按了 N/A', () => {
    expect(canSubmit(qRatioNumeric, {})).toBe(false);
    expect(canSubmit(qRatioNumeric, { raw: '' })).toBe(false);
    expect(canSubmit(qRatioNumeric, { raw: '25' })).toBe(true);
    expect(canSubmit(qRatioNumeric, { na: true })).toBe(true);
  });
  it('journal_entry：至少一行，而且每行有科目與金額', () => {
    expect(canSubmit(qJournal, [])).toBe(false);
    expect(canSubmit(qJournal, [{ key: 'a', account: 'inventory', side: 'debit', raw: '' }])).toBe(false);
    expect(canSubmit(qJournal, [{ key: 'a', account: 'inventory', side: 'debit', raw: '150000' }])).toBe(true);
  });
});

describe('toQuizAnswer（M3 題型）', () => {
  it('five_step_fill：格子對金額，讀不懂的省略', () => {
    expect(toQuizAnswer(qFiveStep, { cf_pretax_income: '0', bs_cash: '２５０,０００元' })).toEqual({ cf_pretax_income: 0, bs_cash: 250000 });
    expect(toQuizAnswer(qFiveStep, { cf_pretax_income: '(1)', bs_cash: '250000' })).toEqual({ bs_cash: 250000 });
  });
  it('ratio_numeric：N/A 或數值；百分比依作答單位正規化', () => {
    expect(toQuizAnswer(qRatioNumeric, { na: true })).toEqual({ kind: 'na' });
    expect(toQuizAnswer(qRatioNumeric, { raw: '25%' })).toEqual({ kind: 'value', value: 25 });
    expect(toQuizAnswer(qRatioNumeric, { raw: 'abc' })).toEqual({ kind: 'value', value: Number.MAX_SAFE_INTEGER });
    expect(ratioInputUnitOf(qRatioNumeric)).toBe('percent');
  });
  it('journal_entry：一筆分錄的行陣列，去掉介面的 key，負數與讀不懂的行省略', () => {
    expect(
      toQuizAnswer(qJournal, [
        { key: 'a', account: 'inventory', side: 'debit', raw: '150,000' },
        { key: 'b', account: 'cash', side: 'credit', raw: '150000' },
        { key: 'c', account: 'revenue', side: 'credit', raw: '-5' },
      ]),
    ).toEqual([
      [
        { account: 'inventory', side: 'debit', amount: 150000 },
        { account: 'cash', side: 'credit', amount: 150000 },
      ],
    ]);
    expect(journalLinesOf([{ key: 'a', account: 'cash', side: 'up', raw: '1' }, 'x'])).toEqual([]);
  });
});

describe('journalLineStatuses', () => {
  const lines = [
    { key: 'a', account: 'inventory', side: 'debit' as const, raw: '100000' },
    { key: 'b', account: 'accounts_payable', side: 'credit' as const, raw: '100000' },
  ];
  it('同科目同方向在 extra 與 missing 裡是「金額不對」，只在 extra 裡是「多了」，其餘 missing 列為少了的行', () => {
    const r = journalLineStatuses(lines, {
      kind: 'journal_entry',
      missing: [
        { account: 'inventory', side: 'debit', amount: 150000 },
        { account: 'cash', side: 'credit', amount: 150000 },
      ],
      extra: [
        { account: 'inventory', side: 'debit', amount: 100000 },
        { account: 'accounts_payable', side: 'credit', amount: 100000 },
      ],
      unresolved: [],
    });
    expect(r.lines).toEqual({ a: 'amount', b: 'extra' });
    expect(r.missing).toEqual([{ account: 'cash', side: 'credit', amount: 150000 }]);
  });
  it('全對時每行是 ok、沒有少了的行', () => {
    const r = journalLineStatuses(lines, { kind: 'journal_entry', missing: [], extra: [], unresolved: [] });
    expect(r.lines).toEqual({ a: 'ok', b: 'ok' });
    expect(r.missing).toEqual([]);
  });
});

describe('five-step 格子的勾稽點', () => {
  it('由教材版面推導：②稅前淨利兩邊、③期末現金兩邊、④未分配盈餘、⑤左右總計', () => {
    const steps = checkStepsOf(teacherLayout as never);
    expect(steps.get('cf_pretax_income')).toBe(2);
    expect(steps.get('is_pretax_income')).toBe(2);
    expect(steps.get('cf_cash_end')).toBe(3);
    expect(steps.get('bs_cash')).toBe(3);
    expect(steps.get('bs_retained_earnings')).toBe(4);
    expect(steps.get('bs_total_assets')).toBe(5);
    expect(steps.get('bs_total_liabilities_equity')).toBe(5);
    expect(steps.get('is_closing_inventory')).toBeUndefined();
  });
  it('線 ID 的報表與勾稽點編號文字', () => {
    expect(statementOfLine('is_net_income')).toBe('is');
    expect(statementOfLine('bs_cash')).toBe('bs');
    expect(statementOfLine('cf_cash_end')).toBe('cf');
    expect(statementOfLine('dc_cash_end')).toBe('cf');
    expect(stepMark(3, 'zh-TW')).toBe('③');
    expect(stepMark(3, 'en')).toBe('3');
  });
  it('勾稽點字母只當步驟的顯示別名（14 T13）：②A、③C、④B、⑤D', () => {
    expect(checkLetterOf(2)).toBe('A');
    expect(checkLetterOf(3)).toBe('C');
    expect(checkLetterOf(4)).toBe('B');
    expect(checkLetterOf(5)).toBe('D');
  });
});

describe('指標數值格式', () => {
  it('依單位格式化；位數由 displayValue 推得', () => {
    expect(formatRatioValue(25, 'percent', 'zh-TW', 2)).toBe('25.00%');
    expect(formatRatioValue(1.5, 'turnover', 'en', 1)).toMatch(/1\.5/);
    // 週轉次數用「次」，倍數用「倍」（04 第 12.4 節）
    expect(formatRatioValue(1.5, 'turnover', 'zh-TW', 2)).toBe('1.50 次');
    expect(formatRatioValue(1.5, 'multiple', 'zh-TW', 2)).toBe('1.50 倍');
    expect(formatRatioValue(1.5, 'turnover', 'en', 2)).toBe('1.50×');
    expect(formatRatioValue(120000, 'currency', 'zh-TW')).toContain('120,000');
    expect(digitsOf(25)).toBe(0);
    expect(digitsOf(5.66)).toBe(2);
    expect(numericUnitOf('percent')).toBe('percent');
    expect(numericUnitOf('multiple')).toBe('times');
    expect(numericUnitOf('turnover')).toBe('turns');
    expect(numericUnitOf('currency_per_share')).toBe('money');
    // 天數題收「天、日、days」（quiz-14），不再當純數字
    expect(numericUnitOf('days')).toBe('days');
  });
});
