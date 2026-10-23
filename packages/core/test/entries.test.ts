// 04 第 14 節第 1 到 4 點的單元測試：別名解析、攤平與合併、移除 0 行、多重集合比對。數字自編。
import { describe, expect, it } from 'vitest';
import { type EntryLine, buildChart, compareEntries, defaultAccounts, normaliseEntries } from '../src/index.ts';

const chart = buildChart(defaultAccounts);

/** 自編：還清短期借款 900,000 並付利息 27,000 */
const expected: EntryLine[][] = [
  [
    { account: 'short_term_borrowings', side: 'debit', amount: 900_000 },
    { account: 'interest_expense', side: 'debit', amount: 27_000 },
    { account: 'cash', side: 'credit', amount: 927_000 },
  ],
];
const compound: EntryLine[][] = [
  [
    { account: 'short_term_borrowings', side: 'debit', amount: 900_000 },
    { account: 'interest_expense', side: 'debit', amount: 27_000 },
    { account: 'cash', side: 'credit', amount: 927_000 },
  ],
];
const split: EntryLine[][] = [
  [
    { account: 'short_term_borrowings', side: 'debit', amount: 900_000 },
    { account: 'cash', side: 'credit', amount: 900_000 },
  ],
  [
    { account: 'cash', side: 'credit', amount: 27_000 },
    { account: 'interest_expense', side: 'debit', amount: 27_000 },
  ],
];

describe('normaliseEntries', () => {
  it('攤平、合併同科目同方向、依科目表順序排列（借方在前）', () => {
    const r = normaliseEntries(split, chart);
    expect(r.unresolved).toEqual([]);
    expect(r.lines).toEqual([
      { account: 'cash', side: 'credit', amount: 927_000 },
      { account: 'short_term_borrowings', side: 'debit', amount: 900_000 },
      { account: 'interest_expense', side: 'debit', amount: 27_000 },
    ]);
    expect(normaliseEntries(compound, chart).lines).toEqual(r.lines);
  });

  it('別名「利息費用」、「支付利息」、「Finance costs」都解析到 interest_expense；關閉別名時只接受 ID', () => {
    const r = normaliseEntries([[{ account: '利息費用', side: 'debit', amount: 1 }]], chart);
    expect(r.lines).toEqual([{ account: 'interest_expense', side: 'debit', amount: 1 }]);
    expect(normaliseEntries([[{ account: '支付利息', side: 'debit', amount: 1 }]], chart).lines[0]?.account).toBe('interest_expense');
    expect(normaliseEntries([[{ account: ' finance  costs ', side: 'debit', amount: 1 }]], chart).lines[0]?.account).toBe('interest_expense');
    const strict = normaliseEntries([[{ account: '利息費用', side: 'debit', amount: 1 }]], chart, { allowAliases: false });
    expect(strict.lines).toEqual([]);
    expect(strict.unresolved).toEqual(['利息費用']);
    expect(normaliseEntries([[{ account: 'interest_expense', side: 'debit', amount: 1 }]], chart, { allowAliases: false }).lines).toHaveLength(1);
  });

  it('解析不到的科目列在 unresolved（去重），其餘行照常處理', () => {
    const r = normaliseEntries(
      [
        [
          { account: '不存在的科目', side: 'debit', amount: 10 },
          { account: '不存在的科目', side: 'credit', amount: 10 },
          { account: 'cash', side: 'credit', amount: 10 },
        ],
      ],
      chart,
    );
    expect(r.unresolved).toEqual(['不存在的科目']);
    expect(r.lines).toEqual([{ account: 'cash', side: 'credit', amount: 10 }]);
  });

  it('金額為 0 的行移除，合併後為 0 也移除；借貸同科目不互抵', () => {
    const r = normaliseEntries(
      [
        [
          { account: 'cash', side: 'debit', amount: 0 },
          { account: 'cash', side: 'credit', amount: 500 },
          { account: 'cash', side: 'debit', amount: 500 },
        ],
        [],
      ],
      chart,
    );
    expect(r.lines).toEqual([
      { account: 'cash', side: 'debit', amount: 500 },
      { account: 'cash', side: 'credit', amount: 500 },
    ]);
    expect(normaliseEntries([[{ account: 'cash', side: 'debit', amount: 0 }]], chart).lines).toEqual([]);
    expect(normaliseEntries([], chart)).toEqual({ lines: [], unresolved: [] });
  });

  it('金額不是非負安全整數、方向不合法、合計溢位，都是程式錯誤', () => {
    expect(() => normaliseEntries([[{ account: 'cash', side: 'debit', amount: -1 }]], chart)).toThrow(TypeError);
    expect(() => normaliseEntries([[{ account: 'cash', side: 'debit', amount: 1.5 }]], chart)).toThrow(TypeError);
    expect(() => normaliseEntries([[{ account: 'cash', side: 'up' as 'debit', amount: 1 }]], chart)).toThrow(TypeError);
    const max = Number.MAX_SAFE_INTEGER;
    expect(() =>
      normaliseEntries(
        [
          [
            { account: 'cash', side: 'debit', amount: max },
            { account: 'cash', side: 'debit', amount: 1 },
          ],
        ],
        chart,
      ),
    ).toThrow(RangeError);
    expect(normaliseEntries([[{ account: 'cash', side: 'debit', amount: max }]], chart).lines[0]?.amount).toBe(max);
  });
});

describe('compareEntries（04 第 14 節的範例）', () => {
  it('一筆複合分錄與拆成多筆都算相等，不看順序', () => {
    for (const submission of [compound, split]) {
      const r = compareEntries(submission, expected, chart);
      expect(r).toEqual({ equal: true, missing: [], extra: [], unresolved: [] });
    }
    const reversed = [[...compound[0]!].reverse()];
    expect(compareEntries(reversed, expected, chart).equal).toBe(true);
  });

  it('作答用別名也算相等', () => {
    const aliased: EntryLine[][] = [
      [
        { account: '短期借款', side: 'debit', amount: 900_000 },
        { account: '利息費用', side: 'debit', amount: 27_000 },
        { account: '現金', side: 'credit', amount: 927_000 },
      ],
    ];
    expect(compareEntries(aliased, expected, chart).equal).toBe(true);
  });

  it('缺行：回報缺少的 (科目, 方向, 金額)', () => {
    const r = compareEntries(
      [
        [
          { account: 'short_term_borrowings', side: 'debit', amount: 900_000 },
          { account: 'cash', side: 'credit', amount: 900_000 },
        ],
      ],
      expected,
      chart,
    );
    expect(r.equal).toBe(false);
    expect(r.missing).toEqual([
      { account: 'cash', side: 'credit', amount: 927_000 },
      { account: 'interest_expense', side: 'debit', amount: 27_000 },
    ]);
    expect(r.extra).toEqual([{ account: 'cash', side: 'credit', amount: 900_000 }]);
    expect(r.unresolved).toEqual([]);
  });

  it('多行：回報多出的行；金額不同的同科目同方向行同時列在 missing 與 extra', () => {
    const r = compareEntries(
      [[...compound[0]!, { account: 'interest_payable', side: 'credit', amount: 1_000 }, { account: 'interest_expense', side: 'debit', amount: 1_000 }]],
      expected,
      chart,
    );
    expect(r.equal).toBe(false);
    expect(r.extra).toEqual([
      { account: 'interest_payable', side: 'credit', amount: 1_000 },
      { account: 'interest_expense', side: 'debit', amount: 28_000 },
    ]);
    expect(r.missing).toEqual([{ account: 'interest_expense', side: 'debit', amount: 27_000 }]);
  });

  it('方向相反的行不算相同', () => {
    const r = compareEntries(
      [
        [
          { account: 'cash', side: 'debit', amount: 927_000 },
          { account: 'short_term_borrowings', side: 'credit', amount: 927_000 },
        ],
      ],
      expected,
      chart,
    );
    expect(r.equal).toBe(false);
    expect(r.missing).toHaveLength(3);
    expect(r.extra).toHaveLength(2);
  });

  it('解析不到的科目讓結果不相等，並列在 unresolved（作答在前、正解在後、去重）', () => {
    const r = compareEntries(
      [[{ account: '神秘科目', side: 'debit', amount: 1 }]],
      [
        [
          { account: '另一個', side: 'debit', amount: 1 },
          { account: '神秘科目', side: 'credit', amount: 1 },
        ],
      ],
      chart,
    );
    expect(r.equal).toBe(false);
    expect(r.unresolved).toEqual(['神秘科目', '另一個']);
    expect(r.missing).toEqual([]);
    expect(r.extra).toEqual([]);
  });

  it('兩邊都空時相等；0 行不影響比對', () => {
    expect(compareEntries([], [], chart).equal).toBe(true);
    expect(compareEntries([[{ account: 'cash', side: 'debit', amount: 0 }]], [], chart).equal).toBe(true);
    expect(compareEntries([[...compound[0]!, { account: 'inventory', side: 'debit', amount: 0 }]], expected, chart).equal).toBe(true);
  });
});
