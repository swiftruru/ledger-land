// 錯題複習的階段、門檻與排題（features/exam/stats.ts、day.ts；2026-11-13）：純函式，日期由 Clock 注入
import { describe, expect, it } from 'vitest';
import { nextState, normaliseState, type QuestionState } from '../src/features/exam/db.ts';
import { localDayOf, type Clock } from '../src/features/exam/day.ts';
import {
  isMastered,
  isRepeatWrong,
  isWaiting,
  needOf,
  nextStepOf,
  picksOf,
  stageOf,
  statsOf,
  unsureIdsOf,
  wrongIdsOf,
  wrongQueueOf,
  wrongStatsOf,
} from '../src/features/exam/stats.ts';

// 測試的時間一律寫成「日期T時間」，哪一天就是前十碼（不經過裝置的時區）
const clockAt = (today: string): Clock => ({ today, dayOf: (iso) => iso.slice(0, 10) });
const D1 = clockAt('2026-11-13');
const D2 = clockAt('2026-11-14');

/** 依序作答：'x' 答錯、'o' 答對；每一次的時間自己給 */
const play = (id: string, steps: [result: 'x' | 'o', at: string][]): QuestionState => {
  let s: QuestionState | undefined;
  for (const [result, at] of steps) s = nextState(s, id, 1, result === 'o', at, 'A');
  return s!;
};

describe('錯題複習的階段與門檻', () => {
  it('沒答錯過的題不在錯題複習裡；照舊連對 2 次就熟練', () => {
    const once = play('q', [['o', '2026-11-13T01:00']]);
    expect(stageOf(once, D1)).toBeNull();
    expect(isMastered(once, D1)).toBe(false);
    expect(
      isMastered(
        play('q', [
          ['o', '2026-11-13T01:00'],
          ['o', '2026-11-13T01:01'],
        ]),
        D1,
      ),
    ).toBe(true);
    expect(stageOf(undefined, D1)).toBeNull();
    expect(nextStepOf(once, D1)).toBeNull();
  });

  it('第一次答錯：待訂正；答對一次是複習中（再連對 1 次）；當天連對 2 次就熟練', () => {
    const wrong = play('q', [['x', '2026-11-13T01:00']]);
    expect(wrong.lastWrongAt).toBe('2026-11-13T01:00');
    expect(stageOf(wrong, D1)).toBe('fix');
    expect([needOf(wrong), isRepeatWrong(wrong)]).toEqual([2, false]);
    const fixed = nextState(wrong, 'q', 1, true, '2026-11-13T01:05', 'B');
    expect(fixed.lastWrongAt).toBe('2026-11-13T01:00');
    expect(stageOf(fixed, D1)).toBe('review');
    expect(nextStepOf(fixed, D1)).toEqual({ more: 1, tomorrow: false });
    expect(isWaiting(fixed, D1)).toBe(false);
    const done = nextState(fixed, 'q', 1, true, '2026-11-13T01:10', 'B');
    expect(stageOf(done, D1)).toBe('mastered');
    expect(isMastered(done, D1)).toBe(true);
  });

  it('再答錯就是反覆答錯：要連對 3 次，而且最後一次要在最近一次答錯的隔天以後', () => {
    const twice = play('q', [
      ['x', '2026-11-13T01:00'],
      ['x', '2026-11-13T01:05'],
    ]);
    expect([needOf(twice), isRepeatWrong(twice), stageOf(twice, D1)]).toEqual([3, true, 'fix']);
    const one = nextState(twice, 'q', 1, true, '2026-11-13T01:10');
    expect(nextStepOf(one, D1)).toEqual({ more: 2, tomorrow: false });
    // 當天連對 2 次：今天到這裡，明天再練
    const two = nextState(one, 'q', 1, true, '2026-11-13T01:15');
    expect(nextStepOf(two, D1)).toEqual({ more: 1, tomorrow: true });
    expect(isWaiting(two, D1)).toBe(true);
    // 當天再多對幾次也不會熟練
    const three = nextState(two, 'q', 1, true, '2026-11-13T01:20');
    expect([stageOf(three, D1), isWaiting(three, D1)]).toEqual(['review', true]);
    // 隔天不再是「明天再練」；隔天答對一次就熟練
    expect([isWaiting(two, D2), nextStepOf(two, D2)]).toEqual([false, { more: 1, tomorrow: false }]);
    const nextDay = nextState(two, 'q', 1, true, '2026-11-14T00:30');
    expect([stageOf(nextDay, D2), isMastered(nextDay, D2)]).toEqual(['mastered', true]);
    // 隔天才開始訂正的：連對 3 次都在隔天也算
    const late = play('q', [
      ['x', '2026-11-13T01:00'],
      ['x', '2026-11-13T01:05'],
      ['o', '2026-11-14T02:00'],
      ['o', '2026-11-14T02:01'],
    ]);
    expect(nextStepOf(late, D2)).toEqual({ more: 1, tomorrow: false });
    expect(isMastered(nextState(late, 'q', 1, true, '2026-11-14T02:02'), D2)).toBe(true);
  });

  it('熟練之後又答錯：回到待訂正，累計答錯加一，門檻跟著變成反覆答錯的', () => {
    const mastered = play('q', [
      ['x', '2026-11-10T01:00'],
      ['o', '2026-11-10T01:01'],
      ['o', '2026-11-10T01:02'],
    ]);
    expect(isMastered(mastered, D1)).toBe(true);
    const again = nextState(mastered, 'q', 1, false, '2026-11-13T03:00');
    expect([stageOf(again, D1), again.wrong, needOf(again), again.lastWrongAt]).toEqual(['fix', 2, 3, '2026-11-13T03:00']);
  });

  it('答案改版（answerRev 變了）從頭算，最近一次答錯的時間也不留', () => {
    const twice = play('q', [
      ['x', '2026-11-13T01:00'],
      ['x', '2026-11-13T01:05'],
    ]);
    const fresh = nextState(twice, 'q', 2, true, '2026-11-13T02:00');
    expect([fresh.wrong, fresh.streak, fresh.lastWrongAt, stageOf(fresh, D1)]).toEqual([0, 1, undefined, null]);
  });

  it('之前存的紀錄沒有最近一次答錯的時間：照舊的門檻，已經熟練的不收回；最近一次是答錯的補成 lastAt', () => {
    const legacy: QuestionState = { questionId: 'q', answerRev: 1, seen: 5, correct: 2, wrong: 3, lastCorrect: true, lastAt: '2026-11-08T01:00', streak: 2 };
    expect([isRepeatWrong(legacy), needOf(legacy), isMastered(legacy, D1), stageOf(legacy, D1)]).toEqual([false, 2, true, 'mastered']);
    expect(stageOf({ ...legacy, streak: 1 }, D1)).toBe('review');
    const legacyWrong: QuestionState = { ...legacy, lastCorrect: false, streak: 0 };
    expect(normaliseState(legacyWrong).lastWrongAt).toBe('2026-11-08T01:00');
    expect(normaliseState(legacy).lastWrongAt).toBeUndefined();
    // 沒補過的也一樣算得出來（最近一次是答錯的，時間就是 lastAt）
    expect([isRepeatWrong(legacyWrong), stageOf(legacyWrong, D1)]).toEqual([true, 'fix']);
    // 舊紀錄再答錯一次之後就有時間了，門檻變成反覆答錯的
    expect(needOf(nextState(legacy, 'q', 1, false, '2026-11-13T01:00'))).toBe(3);
  });

  it('時間換成本地日期：不是合法的時間回空字串', () => {
    expect(localDayOf('nope')).toBe('');
    expect(localDayOf('2026-11-13T12:00:00.000Z')).toMatch(/^2026-11-1[34]$/);
  });
});

describe('錯題複習的排題與統計', () => {
  const states = new Map<string, QuestionState>(
    [
      // 待訂正：答錯 1 次（較早）、答錯 1 次（最近）、反覆答錯
      play('fix-old', [['x', '2026-11-12T01:00']]),
      play('fix-new', [['x', '2026-11-13T02:00']]),
      play('fix-repeat', [
        ['x', '2026-11-11T01:00'],
        ['x', '2026-11-12T05:00'],
      ]),
      // 複習中：昨天訂正的、今天訂正的
      play('review-old', [
        ['x', '2026-11-12T01:00'],
        ['o', '2026-11-12T01:05'],
      ]),
      play('review-new', [
        ['x', '2026-11-13T01:00'],
        ['o', '2026-11-13T01:05'],
      ]),
      // 明天再練：反覆答錯、今天連對 2 次
      play('waiting', [
        ['x', '2026-11-13T01:00'],
        ['x', '2026-11-13T01:01'],
        ['o', '2026-11-13T01:02'],
        ['o', '2026-11-13T01:03'],
      ]),
      // 已熟練、沒答錯過
      play('mastered', [
        ['x', '2026-11-12T01:00'],
        ['o', '2026-11-12T01:05'],
        ['o', '2026-11-12T01:06'],
      ]),
      play('clean', [['o', '2026-11-13T01:00']]),
    ].map((s) => [s.questionId, s] as const),
  );

  it('順序：待訂正在前（答錯次數多的先、同次數先錯的先），然後是複習中（等最久的先）；明天再練的今天不排', () => {
    const queue = wrongQueueOf(states, D1);
    expect(queue.due).toEqual(['fix-repeat', 'fix-old', 'fix-new', 'review-old', 'review-new']);
    expect(queue.waiting).toEqual(['waiting']);
    expect(queue.open).toEqual(['fix-repeat', 'fix-old', 'fix-new', 'review-old', 'review-new', 'waiting']);
    // 隔天：昨天等著的題回到要練的清單
    expect(wrongQueueOf(states, D2).waiting).toEqual([]);
    expect(wrongQueueOf(states, D2).due).toContain('waiting');
  });

  it('題組的挑選：wrong 是今天要練的（all 時連明天再練的也算），unsure 是練過但還沒熟練的', () => {
    const picks = picksOf(states, D1);
    expect(picks.wrongOrder).toEqual(['fix-repeat', 'fix-old', 'fix-new', 'review-old', 'review-new']);
    expect([...picks.wrongIds].sort()).toEqual(['fix-new', 'fix-old', 'fix-repeat', 'review-new', 'review-old']);
    expect(picksOf(states, D1, { all: true }).wrongOrder).toHaveLength(6);
    expect([...unsureIdsOf(states, D1)].sort()).toEqual(['clean', 'fix-new', 'fix-old', 'fix-repeat', 'review-new', 'review-old', 'waiting']);
    expect([...wrongIdsOf(states)].sort()).toEqual(['fix-new', 'fix-old', 'fix-repeat']);
  });

  it('各階段的題數；一般的統計裡熟練的題數跟著新的門檻，「最近一次答錯」的題數不變', () => {
    const ids = [...states.keys()];
    expect(wrongStatsOf(ids, states, D1)).toEqual({ everWrong: 7, fix: 3, review: 3, mastered: 1, due: 5, waiting: 1 });
    expect(wrongStatsOf(['clean', 'nope'], states, D1)).toEqual({ everWrong: 0, fix: 0, review: 0, mastered: 0, due: 0, waiting: 0 });
    expect(statsOf(ids, states, D1)).toMatchObject({ practised: 8, wrong: 3, mastered: 1 });
  });
});
