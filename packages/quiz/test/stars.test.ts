// 星星（03 第 2.10 節）：5 到 8 題關卡的門檻表、沒有計分題、浮點邊界、levelScore 排除不計分題
import { describe, expect, it } from 'vitest';
import { STAR_THRESHOLDS, levelScore, starsFor } from '../src/index.ts';

describe('starsFor', () => {
  it('門檻是 60%、80%、100%', () => expect(STAR_THRESHOLDS).toEqual([0.6, 0.8, 1]));

  it.each([
    [5, 3, 4, 5],
    [6, 3.6, 4.8, 6],
    [7, 4.2, 5.6, 7],
    [8, 4.8, 6.4, 8],
  ])('%i 題關卡：★ 至少 %s、★★ 至少 %s、★★★ %s', (n, one, two, three) => {
    expect(starsFor(one, n)).toBe(1);
    expect(starsFor(one - 0.05, n)).toBe(0);
    expect(starsFor(two, n)).toBe(2);
    expect(starsFor(two - 0.05, n)).toBe(1);
    expect(starsFor(three, n)).toBe(3);
    expect(starsFor(three - 0.05, n)).toBe(2);
  });

  it('整題對錯時換算成答對題數：★ 3、4、5、5 題；★★ 4、5、6、7 題', () => {
    expect([5, 6, 7, 8].map((n, i) => starsFor([3, 4, 5, 5][i] as number, n))).toEqual([1, 1, 1, 1]);
    expect([5, 6, 7, 8].map((n, i) => starsFor([2, 3, 4, 4][i] as number, n))).toEqual([0, 0, 0, 0]);
    expect([5, 6, 7, 8].map((n, i) => starsFor([4, 5, 6, 7][i] as number, n))).toEqual([2, 2, 2, 2]);
    expect(starsFor(7, 8)).toBe(2);
    expect(starsFor(0, 5)).toBe(0);
  });

  it('分類題的部分分數也算進總和：三分之二加三分之二再加一題全對，3 題關卡 ≈ 77.8% 是 ★', () => {
    expect(starsFor(2 / 3 + 2 / 3 + 1, 3)).toBe(1);
    expect(starsFor(0.6 * 3, 3)).toBe(1);
  });

  it('沒有計分題是 0 顆；超出範圍是程式錯誤', () => {
    expect(starsFor(0, 0)).toBe(0);
    expect(() => starsFor(6, 5)).toThrow(RangeError);
    expect(() => starsFor(-1, 5)).toThrow(RangeError);
    expect(() => starsFor(1, 1.5)).toThrow(RangeError);
  });
});

describe('levelScore', () => {
  it('只算計分題；取捨題不進分母', () => {
    const r = levelScore([
      { scored: true, score: 1 },
      { scored: false, score: 0 },
      { scored: true, score: 0.5 },
      { scored: true, score: 1 },
      { scored: true, score: 0 },
    ]);
    expect(r).toEqual({ total: 2.5, scoredCount: 4, ratio: 0.625, stars: 1 });
  });
  it('全部不計分時 ratio 為 0、0 顆星', () => expect(levelScore([{ scored: false, score: 0 }])).toEqual({ total: 0, scoredCount: 0, ratio: 0, stars: 0 }));
  it('每題得分超出 0 到 1 是程式錯誤', () => expect(() => levelScore([{ scored: true, score: 1.2 }])).toThrow(RangeError));
});
