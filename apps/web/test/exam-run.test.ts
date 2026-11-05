// 期中考苦練的狀態機、題組與統計（features/exam/run.ts、sets.ts、stats.ts）：純函式，題目是自己編的
import { describe, expect, it } from 'vitest';
import type { HandoutManifestEntry, HandoutQuestionSnapshot } from '../src/lib/content.ts';
import type { QuestionState } from '../src/features/exam/db.ts';
import {
  answerOf,
  checkAnswer,
  chosenCount,
  gotoQuestion,
  isExpired,
  isMock,
  remainingSeconds,
  selectMock,
  submitRun,
  usedSeconds,
  isCorrectChoice,
  isFinished,
  nextQuestion,
  restoreRun,
  selectAnswer,
  shuffleIds,
  startRun,
  summarise,
} from '../src/features/exam/run.ts';
import { allQuestionIds, isSetId, resolveSet } from '../src/features/exam/sets.ts';
import { isMastered, MASTERY_STREAK, picksOf, statsOf, unsureIdsOf, wrongIdsOf } from '../src/features/exam/stats.ts';
import { DEFAULT_MOCK_SETTINGS, encodeMockSettings, limitOf, parseCount, parseMockSettings, parseSeconds } from '../src/features/exam/options.ts';

const q = (id: string, answer: string[] = ['B'], rev = 1, answerRev = 1): HandoutQuestionSnapshot => ({
  id,
  rev,
  revKind: 'text',
  answerRev,
  deck: 'd1',
  section: 'd1s1',
  slide: 1,
  topic: `主題 ${id}`,
  scenario: '情境。',
  question: '問題？',
  options: [
    { letter: 'A', text: '甲' },
    { letter: 'B', text: '乙' },
    { letter: 'C', text: '丙' },
  ],
  answer: answer as ('A' | 'B' | 'C')[],
  explanation: '解析。',
});
const Q = [q('hq_aaaaaaa1'), q('hq_aaaaaaa2', ['A']), q('hq_aaaaaaa3', ['B', 'C'])];
const fixedRandom = () => 0.5;

describe('run', () => {
  it('講義順序不限題數；隨機依注入的亂數排序並可限題數', () => {
    const a = startRun({ key: 'all:handout', questions: Q, order: 'handout', bankRev: 1, random: fixedRandom, now: '2026-11-04T00:00:00Z' });
    expect(a.questionIds).toEqual(Q.map((x) => x.id));
    expect(a.runId).toHaveLength(10);
    const b = startRun({ key: 'all:random', questions: Q, order: 'random', bankRev: 1, limit: 2, random: fixedRandom });
    expect(b.questionIds).toHaveLength(2);
    expect(shuffleIds(['1', '2', '3', '4'], fixedRandom)).toEqual(['1', '4', '2', '3']);
  });

  it('選、確認、下一題；確認後不能改；最後一題之後完成；任一正確', () => {
    let r = startRun({ key: 'k', questions: Q, order: 'handout', bankRev: 1 });
    expect(checkAnswer(r, Q[0]!.id, Q[0]!.answer)).toBe(r); // 還沒選
    r = selectAnswer(r, Q[0]!.id, 'A');
    r = checkAnswer(r, Q[0]!.id, Q[0]!.answer);
    expect(answerOf(r, Q[0]!.id)).toEqual({ chosen: 'A', checked: true, correct: false });
    expect(selectAnswer(r, Q[0]!.id, 'B')).toBe(r);
    r = nextQuestion(r);
    expect(r.index).toBe(1);
    r = checkAnswer(selectAnswer(r, Q[1]!.id, 'A'), Q[1]!.id, Q[1]!.answer);
    r = nextQuestion(r);
    r = checkAnswer(selectAnswer(r, Q[2]!.id, 'C'), Q[2]!.id, Q[2]!.answer);
    expect(answerOf(r, Q[2]!.id).correct).toBe(true);
    expect(isFinished(r)).toBe(false);
    r = nextQuestion(r, '2026-11-04T01:00:00Z');
    expect(isFinished(r)).toBe(true);
    expect(r.finishedAt).toBe('2026-11-04T01:00:00Z');
    expect(summarise(r)).toEqual({ total: 3, answered: 3, correct: 2, wrongIds: [Q[0]!.id], unanswered: 0 });
    expect(isCorrectChoice(['B', 'C'], 'B')).toBe(true);
    expect(isCorrectChoice(['B'], null)).toBe(false);
  });

  it('還原：題目不見了整輪重來；rev 變了的題作廢重答並退到第一個沒確認的題', () => {
    let r = startRun({ key: 'k', questions: Q, order: 'handout', bankRev: 1 });
    r = nextQuestion(checkAnswer(selectAnswer(r, Q[0]!.id, 'B'), Q[0]!.id, Q[0]!.answer));
    r = nextQuestion(checkAnswer(selectAnswer(r, Q[1]!.id, 'A'), Q[1]!.id, Q[1]!.answer));
    expect(r.index).toBe(2);
    const same = restoreRun(r, new Map(Q.map((x) => [x.id, x])));
    expect(same?.run).toEqual(r);
    const revisedQ = [q('hq_aaaaaaa1', ['C'], 2, 2), Q[1]!, Q[2]!];
    const restored = restoreRun(r, new Map(revisedQ.map((x) => [x.id, x])));
    expect(restored?.revised).toEqual([Q[0]!.id]);
    expect(restored?.run.index).toBe(0);
    expect(restored?.run.answers[Q[0]!.id]).toBeUndefined();
    expect(restored?.run.answers[Q[1]!.id]?.checked).toBe(true);
    expect(restoreRun(r, new Map(Q.slice(1).map((x) => [x.id, x])))).toBeNull();
  });
});

const index: HandoutManifestEntry = {
  id: 'midterm',
  title: '題庫',
  rev: 1,
  questionCount: 3,
  decks: [
    {
      id: 'd2',
      order: 2,
      code: '0-2',
      title: '第二份',
      questionCount: 1,
      sections: [{ id: 'd2s1', title: '段', questionIds: ['hq_bbbbbbb1'] }],
      file: 'content/zh-TW/handout_d2.x.json',
    },
    {
      id: 'd1',
      order: 1,
      code: '0-1',
      title: '第一份',
      questionCount: 2,
      sections: [
        { id: 'd1s1', title: '段一', questionIds: ['hq_aaaaaaa1'] },
        { id: 'd1s2', title: '段二', questionIds: ['hq_aaaaaaa2'] },
      ],
      file: 'content/zh-TW/handout_d1.x.json',
    },
  ],
  review: { excluded: 0, check: 0, file: 'content/zh-TW/handout_review.x.json' },
};

describe('sets 與 stats', () => {
  it('題組：全部依講義順序；講義；段；錯過的與不熟的只含這台裝置挑出來的題', () => {
    const none = { wrongIds: new Set<string>(), unsureIds: new Set<string>() };
    expect(allQuestionIds(index)).toEqual(['hq_aaaaaaa1', 'hq_aaaaaaa2', 'hq_bbbbbbb1']);
    expect(resolveSet(index, 'all', none)?.deckIds).toEqual(['d1', 'd2']);
    expect(resolveSet(index, 'd2', none)).toMatchObject({ kind: 'deck', deckIds: ['d2'], questionIds: ['hq_bbbbbbb1'], title: '第二份' });
    expect(resolveSet(index, 'd1s2', none)).toMatchObject({ kind: 'section', questionIds: ['hq_aaaaaaa2'], title: '段二' });
    const picks = { wrongIds: new Set(['hq_bbbbbbb1', 'hq_zzzzzzzz']), unsureIds: new Set(['hq_bbbbbbb1', 'hq_aaaaaaa2']) };
    expect(resolveSet(index, 'wrong', picks)).toMatchObject({ kind: 'wrong', deckIds: ['d2'], questionIds: ['hq_bbbbbbb1'] });
    expect(resolveSet(index, 'unsure', picks)).toMatchObject({ kind: 'unsure', deckIds: ['d1', 'd2'], questionIds: ['hq_aaaaaaa2', 'hq_bbbbbbb1'] });
    expect(resolveSet(index, 'd9', none)).toBeNull();
    for (const page of ['teacher', 'list', 'browse', 'mock']) expect(isSetId(page)).toBe(false);
    expect(isSetId('unsure')).toBe(true);
    expect(isSetId('d1s10')).toBe(true);
  });

  it('統計：練過的題數、答錯的題數、熟練的題數、答對率；不熟的是練過但還沒連對兩次的', () => {
    const s = (questionId: string, seen: number, correct: number, lastCorrect: boolean, streak: number): QuestionState => ({
      questionId,
      answerRev: 1,
      seen,
      correct,
      wrong: seen - correct,
      lastCorrect,
      lastAt: '',
      streak,
    });
    const states = new Map([
      ['hq_aaaaaaa1', s('hq_aaaaaaa1', 2, 1, false, 0)],
      ['hq_aaaaaaa2', s('hq_aaaaaaa2', 1, 1, true, 1)],
      ['hq_bbbbbbb1', s('hq_bbbbbbb1', 3, 2, true, MASTERY_STREAK)],
    ]);
    expect(statsOf(allQuestionIds(index), states)).toEqual({ total: 3, practised: 3, wrong: 1, mastered: 1, accuracy: 4 / 6 });
    expect(statsOf(['hq_zzzzzzzz'], states)).toEqual({ total: 1, practised: 0, wrong: 0, mastered: 0, accuracy: null });
    expect([...wrongIdsOf(states)]).toEqual(['hq_aaaaaaa1']);
    expect([...unsureIdsOf(states)]).toEqual(['hq_aaaaaaa1', 'hq_aaaaaaa2']);
    expect(isMastered(states.get('hq_bbbbbbb1'))).toBe(true);
    expect(isMastered(undefined)).toBe(false);
    expect(picksOf(states)).toEqual({ wrongIds: new Set(['hq_aaaaaaa1']), unsureIds: new Set(['hq_aaaaaaa1', 'hq_aaaaaaa2']) });
  });
});

describe('抽幾題的選項（options.ts）', () => {
  it('parseCount：20、30、50、all 之外用預設', () => {
    expect(parseCount('30', 20)).toBe(30);
    expect(parseCount('all', 20)).toBe('all');
    expect(parseCount('25', 20)).toBe(20);
    expect(parseCount(null, 30)).toBe(30);
    expect(parseCount('', 20)).toBe(20);
  });

  it('limitOf：all 是全部，其餘不超過題組的題數', () => {
    expect(limitOf('all', 300)).toBe(300);
    expect(limitOf(50, 300)).toBe(50);
    expect(limitOf(50, 12)).toBe(12);
  });
});

describe('模擬考（run.ts 的 mock 模式）', () => {
  const T0 = '2026-11-05T00:00:00.000Z';
  const bank = [q('hq_m0000001', ['A']), q('hq_m0000002', ['B', 'C']), q('hq_m0000003', ['C']), q('hq_m0000004', ['A'])];
  const byId = new Map(bank.map((x) => [x.id, x]));
  const begin = (seconds: number, limit = 3) =>
    startRun({
      key: 'mock',
      questions: bank,
      order: 'random',
      bankRev: 1,
      limit,
      now: T0,
      random: () => 0.5,
      mode: 'mock',
      secondsPerQuestion: seconds,
      settings: 'all|30|60',
    });

  it('開始：隨機抽 limit 題；限時的期限是題數乘每題秒數，不限時沒有期限', () => {
    const timed = begin(60);
    expect(isMock(timed)).toBe(true);
    expect(timed.questionIds).toHaveLength(3);
    expect(timed.deadlineAt).toBe('2026-11-05T00:03:00.000Z');
    expect(timed.settings).toBe('all|30|60');
    expect(remainingSeconds(timed, Date.parse(T0))).toBe(180);
    expect(remainingSeconds(timed, Date.parse(T0) + 179_001)).toBe(1);
    expect(isExpired(timed, Date.parse(T0) + 180_000)).toBe(true);
    const untimed = begin(0);
    expect(untimed.deadlineAt).toBeUndefined();
    expect(remainingSeconds(untimed, Date.parse(T0) + 9e9)).toBeNull();
    expect(isExpired(untimed, Date.parse(T0) + 9e9)).toBe(false);
    // 練習的一輪沒有這些欄位
    expect(isMock(startRun({ key: 'd1:handout', questions: bank, order: 'handout', bankRev: 1, now: T0 }))).toBe(false);
  });

  it('作答中：可以前後移動、改選，不判分', () => {
    let r = begin(0);
    const [a, b] = r.questionIds as [string, string, string];
    r = selectMock(r, a, 'A');
    r = selectMock(r, a, 'B');
    expect(answerOf(r, a)).toEqual({ chosen: 'B', checked: false });
    expect(chosenCount(r)).toBe(1);
    r = gotoQuestion(r, 1);
    expect(r.index).toBe(1);
    expect(gotoQuestion(r, 99).index).toBe(2);
    expect(gotoQuestion(r, -5).index).toBe(0);
    expect(gotoQuestion(r, 1)).toBe(r);
    expect(selectMock(r, 'hq_zzzzzzzz', 'A')).toBe(r);
    expect(isFinished(selectMock(r, b, 'C'))).toBe(false);
  });

  it('交卷：一次判完；沒選的算錯、算未作答；交卷後不能再改', () => {
    let r = begin(60);
    const ids = r.questionIds;
    r = selectMock(r, ids[0]!, byId.get(ids[0]!)!.answer[0]!);
    r = selectMock(r, ids[1]!, byId.get(ids[1]!)!.answer.includes('A') ? 'B' : 'A');
    const done = submitRun(r, byId, '2026-11-05T00:01:30.000Z');
    expect(isFinished(done)).toBe(true);
    expect(answerOf(done, ids[0]!)).toMatchObject({ checked: true, correct: true });
    expect(answerOf(done, ids[1]!)).toMatchObject({ checked: true, correct: false });
    expect(answerOf(done, ids[2]!)).toEqual({ chosen: null, checked: true, correct: false });
    expect(summarise(done)).toEqual({ total: 3, answered: 3, correct: 1, wrongIds: [ids[1], ids[2]], unanswered: 1 });
    expect(usedSeconds(done)).toBe(90);
    expect(usedSeconds(r)).toBeNull();
    expect(submitRun(done, byId)).toBe(done);
    expect(selectMock(done, ids[2]!, 'A')).toBe(done);
    expect(gotoQuestion(done, 0)).toBe(done);
  });

  it('還原：改版的題清掉選擇並列為要重答，停在原來那一題；題目不見就整場作廢', () => {
    let r = begin(0);
    const ids = r.questionIds;
    r = selectMock(r, ids[0]!, 'A');
    r = selectMock(r, ids[1]!, 'B');
    r = gotoQuestion(r, 2);
    const revised = new Map(byId);
    revised.set(ids[0]!, { ...byId.get(ids[0]!)!, rev: 2 });
    const restored = restoreRun(r, revised)!;
    expect(restored.revised).toEqual([ids[0]]);
    expect(answerOf(restored.run, ids[0]!)).toEqual({ chosen: null, checked: false });
    expect(answerOf(restored.run, ids[1]!).chosen).toBe('B');
    expect(restored.run.index).toBe(2);
    const gone = new Map(byId);
    gone.delete(ids[1]!);
    expect(restoreRun(r, gone)).toBeNull();
    expect(restoreRun(r, byId)).toEqual({ run: r, revised: [] });
  });

  it('設定：秒數選項與 localStorage 的寫法', () => {
    expect(parseSeconds('45', 60)).toBe(45);
    expect(parseSeconds('0', 60)).toBe(0);
    expect(parseSeconds('50', 60)).toBe(60);
    expect(parseSeconds(null, 90)).toBe(90);
    expect(parseMockSettings(null)).toEqual(DEFAULT_MOCK_SETTINGS);
    expect(parseMockSettings('d2|all|0')).toEqual({ scope: 'd2', count: 'all', seconds: 0 });
    expect(parseMockSettings('teacher|7|x')).toEqual(DEFAULT_MOCK_SETTINGS);
    expect(encodeMockSettings({ scope: 'd3', count: 50, seconds: 90 })).toBe('d3|50|90');
    expect(parseMockSettings(encodeMockSettings({ scope: 'all', count: 20, seconds: 45 }))).toEqual({ scope: 'all', count: 20, seconds: 45 });
  });
});
