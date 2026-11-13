// 每天的練習紀錄（features/exam/history.ts、day.ts 的 addDays）：純函式；作答明細是自己編的
import { describe, expect, it } from 'vitest';
import type { ExamAttempt } from '../src/features/exam/db.ts';
import { memoryExamDb } from '../src/features/exam/db.ts';
import { addDays, type DayOf } from '../src/features/exam/day.ts';
import { accuracyOf, axisTop, dailyOf, streakOf, totalsOf, weekCompare, windowOf } from '../src/features/exam/history.ts';

/** 測試用的「本地日期」：固定用台灣時間（UTC+8），不看執行環境的時區 */
const taipei: DayOf = (iso) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? '' : new Date(t + 8 * 3_600_000).toISOString().slice(0, 10);
};

let seq = 0;
const at = (questionId: string, time: string, correct: boolean, answerRev = 1): ExamAttempt => ({
  id: `run${seq++}-${questionId}`,
  questionId,
  rev: 1,
  answerRev,
  setId: 'all',
  chosen: correct ? 'B' : 'A',
  correct,
  at: time,
});

describe('addDays', () => {
  it('跨月、跨年、往回；不是日期回空字串', () => {
    expect(addDays('2026-11-13', 1)).toBe('2026-11-14');
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-11-13', 0)).toBe('2026-11-13');
    expect(addDays('昨天', 1)).toBe('');
  });
});

describe('dailyOf', () => {
  it('依本地日期分日：台灣凌晨的作答算在當天，不是 UTC 的前一天；順序不影響結果；時間不合法的略過', () => {
    const list = [
      at('hq_aaaaaaa1', '2026-11-12T15:30:00.000Z', true), // 台灣 11-12 23:30
      at('hq_aaaaaaa2', '2026-11-12T16:30:00.000Z', false), // 台灣 11-13 00:30
      at('hq_aaaaaaa3', '2026-11-13T02:00:00.000Z', true),
      at('hq_aaaaaaa4', '不是時間', true),
    ];
    const want = [
      { day: '2026-11-12', answered: 1, correct: 1, fixed: 0, mastered: 0 },
      { day: '2026-11-13', answered: 2, correct: 1, fixed: 0, mastered: 0 },
    ];
    expect(dailyOf(list, taipei)).toEqual(want);
    expect(dailyOf([...list].reverse(), taipei)).toEqual(want);
    expect(dailyOf([], taipei)).toEqual([]);
  });

  it('訂正與熟練：答錯後答對是訂正；沒答錯過或答錯 1 次的連對 2 次熟練；同一題練兩次算兩次', () => {
    const rows = dailyOf(
      [
        at('hq_aaaaaaa1', '2026-11-10T01:00:00.000Z', true),
        at('hq_aaaaaaa1', '2026-11-10T01:05:00.000Z', true), // 沒答錯過，連對 2 次：熟練
        at('hq_aaaaaaa2', '2026-11-10T01:10:00.000Z', false),
        at('hq_aaaaaaa2', '2026-11-10T01:15:00.000Z', true), // 訂正
        at('hq_aaaaaaa2', '2026-11-11T01:00:00.000Z', true), // 答錯 1 次，連對 2 次：熟練
      ],
      taipei,
    );
    expect(rows).toEqual([
      { day: '2026-11-10', answered: 4, correct: 3, fixed: 1, mastered: 1 },
      { day: '2026-11-11', answered: 1, correct: 1, fixed: 0, mastered: 1 },
    ]);
  });

  it('反覆答錯的題：當天連對 3 次還不算熟練，隔天再答對才算；熟練後又答錯再練回來會再算一次', () => {
    const rows = dailyOf(
      [
        at('hq_aaaaaaa1', '2026-11-10T01:00:00.000Z', false),
        at('hq_aaaaaaa1', '2026-11-10T01:01:00.000Z', false),
        at('hq_aaaaaaa1', '2026-11-10T01:02:00.000Z', true), // 訂正
        at('hq_aaaaaaa1', '2026-11-10T01:03:00.000Z', true),
        at('hq_aaaaaaa1', '2026-11-10T01:04:00.000Z', true), // 連對 3 次，但和答錯同一天
        at('hq_aaaaaaa1', '2026-11-11T01:00:00.000Z', true), // 隔天：熟練
        at('hq_aaaaaaa1', '2026-11-12T01:00:00.000Z', false),
        at('hq_aaaaaaa1', '2026-11-12T01:01:00.000Z', true), // 訂正
      ],
      taipei,
    );
    expect(rows).toEqual([
      { day: '2026-11-10', answered: 5, correct: 3, fixed: 1, mastered: 0 },
      { day: '2026-11-11', answered: 1, correct: 1, fixed: 0, mastered: 1 },
      { day: '2026-11-12', answered: 2, correct: 1, fixed: 1, mastered: 0 },
    ]);
  });

  it('答案改版後從頭算：改版前停在答錯，改版後第一次答對不算訂正', () => {
    const rows = dailyOf([at('hq_aaaaaaa1', '2026-11-10T01:00:00.000Z', false, 1), at('hq_aaaaaaa1', '2026-11-11T01:00:00.000Z', true, 2)], taipei);
    expect(rows.map((r) => r.fixed)).toEqual([0, 0]);
  });
});

describe('windowOf、totalsOf、streakOf、weekCompare', () => {
  const row = (day: string, answered: number, correct: number) => ({ day, answered, correct, fixed: 0, mastered: 0 });
  const rows = [row('2026-10-30', 10, 5), row('2026-11-05', 4, 2), row('2026-11-11', 6, 3), row('2026-11-12', 2, 2), row('2026-11-13', 8, 7)];

  it('windowOf：最近 n 天一天一列、沒練的補 0、由早到晚', () => {
    const w = windowOf(rows, '2026-11-13', 4);
    expect(w.map((r) => r.day)).toEqual(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']);
    expect(w.map((r) => r.answered)).toEqual([0, 6, 2, 8]);
    expect(windowOf([], '2026-11-13', 14)).toHaveLength(14);
  });

  it('axisTop：縱軸的頂端是不小於最大值的整齊數字', () => {
    expect([0, 1, 2, 3, 7, 10, 11, 20, 35, 61, 307].map(axisTop)).toEqual([2, 2, 2, 4, 10, 10, 20, 20, 40, 100, 400]);
    expect(axisTop(12345)).toBe(20000);
  });

  it('totalsOf 與 accuracyOf', () => {
    expect(totalsOf(rows)).toEqual({ answered: 30, correct: 19, fixed: 0, mastered: 0 });
    expect(accuracyOf({ answered: 8, correct: 6 })).toBe(0.75);
    expect(accuracyOf({ answered: 0, correct: 0 })).toBeNull();
  });

  it('streakOf：今天有練從今天數；今天還沒練、昨天有練從昨天數；斷一天就重來', () => {
    expect(streakOf(rows, '2026-11-13')).toBe(3);
    expect(streakOf(rows, '2026-11-14')).toBe(3);
    expect(streakOf(rows, '2026-11-15')).toBe(0);
    expect(streakOf(rows, '2026-11-06')).toBe(1);
    expect(streakOf([], '2026-11-13')).toBe(0);
  });

  it('weekCompare：近 7 天含今天，前 7 天是再往前的 7 天', () => {
    const { recent, previous } = weekCompare(rows, '2026-11-13');
    expect(recent).toEqual({ answered: 16, correct: 12, fixed: 0, mastered: 0 }); // 11-07 到 11-13
    expect(previous).toEqual({ answered: 4, correct: 2, fixed: 0, mastered: 0 }); // 10-31 到 11-06
  });
});

describe('ExamDb.allAttempts', () => {
  it('記憶體版：寫進去的每一次作答都讀得回來', async () => {
    const db = memoryExamDb();
    expect(await db.allAttempts()).toEqual([]);
    const a = at('hq_aaaaaaa1', '2026-11-13T01:00:00.000Z', true);
    await db.addAttempt(a);
    expect(await db.allAttempts()).toEqual([a]);
    expect(await db.countAttempts()).toBe(1);
  });
});
