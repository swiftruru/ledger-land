// 02 第 5.2 節：作答工作階段的狀態轉移
import { describe, expect, it } from 'vitest';
import {
  QuizSession,
  confirmAnswer,
  currentQuestionId,
  leaveSession,
  nextQuestion,
  pauseTimer,
  resumeTimer,
  selectAnswer,
  sessionSummary,
  setScrollAnchor,
  startSession,
  tickTimer,
  toggleExplanation,
} from '../src/index.ts';
import { LV1, Q1, Q2, T0 } from './fixtures.ts';

const start = () =>
  startSession({ mode: 'level', levelId: LV1, levelRev: 2, questionIds: [Q1, Q2], shuffleSeed: 'seed-1', startedAt: T0, timerTotalMs: 150_000 });

describe('作答工作階段', () => {
  it('開始：第一題、全部未確認、計時依 totalMs 開啟；可通過 Zod', () => {
    const s = start();
    expect(currentQuestionId(s)).toBe(Q1);
    expect(s.questions[Q1]).toEqual({ confirmed: false, explanationOpen: false });
    expect(s.timer).toEqual({ enabled: true, totalMs: 150_000, remainingMs: 150_000, paused: false, expired: false });
    expect(QuizSession.safeParse(s).success).toBe(true);
    expect(startSession({ mode: 'review', questionIds: [Q1], shuffleSeed: 's', startedAt: T0 }).timer.enabled).toBe(false);
    expect(() => startSession({ mode: 'review', questionIds: [], shuffleSeed: 's', startedAt: T0 })).toThrow(RangeError);
    expect(QuizSession.safeParse({ ...startSession({ mode: 'level', questionIds: [Q1], shuffleSeed: 's', startedAt: T0 }) }).success).toBe(false);
  });
  it('作答可以改到確認為止；確認後不能再改；沒選答案不能確認', () => {
    let s = start();
    expect(confirmAnswer(s, Q1, { correct: true, score: 1 })).toBe(s);
    s = selectAnswer(s, Q1, 'o_a1b2');
    s = selectAnswer(s, Q1, '12.5', '12.5 ');
    expect(s.questions[Q1]).toEqual({ confirmed: false, explanationOpen: false, answer: '12.5', rawInput: '12.5 ' });
    s = confirmAnswer(s, Q1, { correct: false, score: 0 });
    expect(s.questions[Q1]).toMatchObject({ confirmed: true, correct: false, score: 0 });
    expect(selectAnswer(s, Q1, 'o_zzzz')).toBe(s);
    expect(() => selectAnswer(s, 'q_zzzzzzzz', 'x')).toThrow(RangeError);
  });
  it('下一題要先確認；最後一題後標記完成；解說展開可切換', () => {
    let s = start();
    expect(nextQuestion(s)).toBe(s);
    s = confirmAnswer(selectAnswer(s, Q1, 'o_a1b2'), Q1, { correct: true, score: 1 });
    s = toggleExplanation(s, Q1);
    expect(s.questions[Q1]?.explanationOpen).toBe(true);
    s = nextQuestion(s);
    expect(s.currentIndex).toBe(1);
    expect(s.completed).toBe(false);
    s = confirmAnswer(selectAnswer(s, Q2, ['o_1111', 'o_2222']), Q2, { correct: true, score: 1 });
    s = nextQuestion(s);
    expect(s.completed).toBe(true);
    expect(s.currentIndex).toBe(1);
    expect(sessionSummary(s)).toEqual({ answered: 2, total: 2, totalScore: 2 });
  });
  it('計時：tick 扣時間、暫停中不扣、歸零標 expired 不自動送出；離開時自動暫停並記返回目標', () => {
    let s = start();
    s = tickTimer(s, 100_000);
    expect(s.timer.remainingMs).toBe(50_000);
    s = pauseTimer(s);
    expect(tickTimer(s, 10_000)).toBe(s);
    s = resumeTimer(s);
    s = tickTimer(s, 60_000);
    expect(s.timer).toMatchObject({ remainingMs: 0, expired: true });
    expect(s.completed).toBe(false);
    expect(() => tickTimer(s, -1)).toThrow(RangeError);
    const left = leaveSession(start(), '/lab/story/story_8k3p6t/st_2x9k4m/');
    expect(left.timer.paused).toBe(true);
    expect(left.returnTo).toBe('/lab/story/story_8k3p6t/st_2x9k4m/');
    const noTimer = startSession({ mode: 'review', questionIds: [Q1], shuffleSeed: 's', startedAt: T0 });
    expect(pauseTimer(noTimer)).toBe(noTimer);
  });
  it('捲動錨點可設可清', () => {
    const s = setScrollAnchor(start(), { elementId: 'q-stem', offset: 12 });
    expect(s.scrollAnchor).toEqual({ elementId: 'q-stem', offset: 12 });
    expect(setScrollAnchor(s, undefined).scrollAnchor).toBeUndefined();
  });
});
