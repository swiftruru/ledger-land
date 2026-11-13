// 錯題複習清單頁的整理（features/exam/notebook.ts）：三個階段的分組、最需要加強的段與公式；題目是自己編的
import { describe, expect, it } from 'vitest';
import type { FormulaIndexEntry, HandoutManifestEntry } from '../src/lib/content.ts';
import { nextState, type QuestionState } from '../src/features/exam/db.ts';
import type { Clock } from '../src/features/exam/day.ts';
import { stageGroups, weakFormulas, weakSections } from '../src/features/exam/notebook.ts';

const clock: Clock = { today: '2026-11-13', dayOf: (iso) => iso.slice(0, 10) };

const index: HandoutManifestEntry = {
  id: 'h1',
  title: '講義',
  rev: 1,
  questionCount: 6,
  decks: [
    {
      id: 'd2',
      order: 2,
      code: '0-2',
      title: '第二份',
      questionCount: 2,
      sections: [{ id: 'd2s1', title: '乙一', questionIds: ['q5', 'q6'] }],
      file: 'content/zh-TW/handout_d2.x.json',
    },
    {
      id: 'd1',
      order: 1,
      code: '0-1',
      title: '第一份',
      questionCount: 4,
      sections: [
        { id: 'd1s1', title: '甲一', questionIds: ['q1', 'q2'] },
        { id: 'd1s2', title: '甲二', questionIds: ['q3', 'q4'] },
      ],
      file: 'content/zh-TW/handout_d1.x.json',
    },
  ],
  review: { excluded: 0, check: 0, file: 'content/zh-TW/handout_review.x.json' },
};

const play = (id: string, steps: string): QuestionState => {
  let s: QuestionState | undefined;
  [...steps].forEach((step, i) => {
    s = nextState(s, id, 1, step === 'o', `2026-11-13T01:0${i}`, 'A');
  });
  return s!;
};
const states = new Map<string, QuestionState>(
  [
    play('q1', 'x'), // 待訂正
    play('q2', 'xo'), // 複習中
    play('q3', 'xxx'), // 待訂正，答錯 3 次
    play('q4', 'xoo'), // 已熟練
    play('q5', 'o'), // 沒答錯過
    play('q6', 'xx'), // 待訂正，答錯 2 次
  ].map((s) => [s.questionId, s] as const),
);

const formula = (id: string, label: string, questionIds: string[]): FormulaIndexEntry => ({
  id,
  kind: 'ratio',
  category: 'x',
  label,
  aliases: [],
  formula: '',
  termRef: 't',
  questionIds,
});

describe('錯題複習的清單', () => {
  it('三個階段：依給的順序分組，沒答錯過的不在裡面', () => {
    expect(stageGroups(['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'nope'], states, clock)).toEqual({ fix: ['q1', 'q3', 'q6'], review: ['q2'], mastered: ['q4'] });
    expect(stageGroups([], states, clock)).toEqual({ fix: [], review: [], mastered: [] });
  });

  it('最需要加強的段：還沒熟練的題多的先，同數時累計答錯多的先，再同照講義順序；沒有還沒熟練的題的段不列', () => {
    expect(weakSections(index, states, clock)).toEqual([
      { id: 'd1s1', title: '甲一', deckCode: '0-1', open: 2, wrong: 2 },
      { id: 'd1s2', title: '甲二', deckCode: '0-1', open: 1, wrong: 3 },
      { id: 'd2s1', title: '乙一', deckCode: '0-2', open: 1, wrong: 2 },
    ]);
    expect(weakSections(index, states, clock, 1)).toHaveLength(1);
    expect(weakSections(index, new Map(), clock)).toEqual([]);
  });

  it('最需要加強的公式：一題掛好幾條公式各算一次', () => {
    const formulas = [
      formula('fm_a', '甲', ['q4', 'q5']),
      formula('fm_b', '乙', ['q1', 'q3']),
      formula('fm_c', '丙', ['q3', 'q6']),
      formula('fm_d', '丁', ['q2']),
    ];
    expect(weakFormulas(formulas, states, clock)).toEqual([
      { id: 'fm_c', title: '丙', open: 2, wrong: 5 },
      { id: 'fm_b', title: '乙', open: 2, wrong: 4 },
      { id: 'fm_d', title: '丁', open: 1, wrong: 1 },
    ]);
  });
});
