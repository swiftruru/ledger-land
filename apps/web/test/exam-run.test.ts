// 期中考苦練的狀態機、題組與統計（features/exam/run.ts、sets.ts、stats.ts）：純函式，題目是自己編的
import { describe, expect, it } from 'vitest';
import type { HandoutManifestEntry, HandoutQuestionSnapshot } from '../src/lib/content.ts';
import type { QuestionState } from '../src/features/exam/db.ts';
import {
  answerOf,
  checkAnswer,
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
import { statsOf, wrongIdsOf } from '../src/features/exam/stats.ts';

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
    expect(summarise(r)).toEqual({ total: 3, answered: 3, correct: 2, wrongIds: [Q[0]!.id] });
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
  it('題組：全部依講義順序；講義；段；錯過的只含有紀錄且最近答錯的', () => {
    expect(allQuestionIds(index)).toEqual(['hq_aaaaaaa1', 'hq_aaaaaaa2', 'hq_bbbbbbb1']);
    expect(resolveSet(index, 'all', new Set())?.deckIds).toEqual(['d1', 'd2']);
    expect(resolveSet(index, 'd2', new Set())).toMatchObject({ kind: 'deck', deckIds: ['d2'], questionIds: ['hq_bbbbbbb1'], title: '第二份' });
    expect(resolveSet(index, 'd1s2', new Set())).toMatchObject({ kind: 'section', questionIds: ['hq_aaaaaaa2'], title: '段二' });
    expect(resolveSet(index, 'wrong', new Set(['hq_bbbbbbb1', 'hq_zzzzzzzz']))).toMatchObject({ kind: 'wrong', deckIds: ['d2'], questionIds: ['hq_bbbbbbb1'] });
    expect(resolveSet(index, 'd9', new Set())).toBeNull();
    expect(isSetId('teacher')).toBe(false);
    expect(isSetId('d1s10')).toBe(true);
  });

  it('統計：練過的題數、答錯的題數、答對率', () => {
    const s = (questionId: string, seen: number, correct: number, lastCorrect: boolean): QuestionState => ({
      questionId,
      answerRev: 1,
      seen,
      correct,
      wrong: seen - correct,
      lastCorrect,
      lastAt: '',
    });
    const states = new Map([
      ['hq_aaaaaaa1', s('hq_aaaaaaa1', 2, 1, false)],
      ['hq_aaaaaaa2', s('hq_aaaaaaa2', 1, 1, true)],
    ]);
    expect(statsOf(allQuestionIds(index), states)).toEqual({ total: 3, practised: 2, wrong: 1, accuracy: 2 / 3 });
    expect(statsOf(['hq_bbbbbbb1'], states)).toEqual({ total: 1, practised: 0, wrong: 0, accuracy: null });
    expect([...wrongIdsOf(states)]).toEqual(['hq_aaaaaaa1']);
  });
});
