// 期中考苦練的資料庫（features/exam/db.ts）：IndexedDB 由 fake-indexeddb 提供（test/setup.ts）；三個 store 的讀寫、累計規則與記憶體退路
import { describe, expect, it } from 'vitest';
import { getExamDb, indexedDbExamDb, memoryExamDb, nextState, normaliseState, setExamDbForTests, type QuestionState } from '../src/features/exam/db.ts';
import { startRun } from '../src/features/exam/run.ts';

const run = startRun({ key: 'd1:handout', questions: [], order: 'handout', bankRev: 1, now: '2026-11-04T00:00:00Z' });

describe('exam db', () => {
  it('runs、questionState、attempts 都存得進去、讀得出來', async () => {
    const db = indexedDbExamDb('ledgerland-exam-test-1');
    expect(await db.getRun('d1:handout')).toBeUndefined();
    await db.putRun(run);
    expect(await db.getRun('d1:handout')).toEqual(run);
    await db.deleteRun('d1:handout');
    expect(await db.getRun('d1:handout')).toBeUndefined();
    const s = nextState(undefined, 'hq_aaaaaaa1', 1, false, '2026-11-04T00:00:01Z', 'A');
    await db.putState(s);
    await db.putState(nextState(s, 'hq_aaaaaaa1', 1, true, '2026-11-04T00:00:02Z', 'B'));
    expect(await db.allStates()).toEqual([
      { questionId: 'hq_aaaaaaa1', answerRev: 1, seen: 2, correct: 1, wrong: 1, lastCorrect: true, lastAt: '2026-11-04T00:00:02Z', streak: 1, lastChosen: 'B' },
    ]);
    await db.addAttempt({ id: 'r-1', questionId: 'hq_aaaaaaa1', rev: 1, answerRev: 1, setId: 'd1', chosen: 'B', correct: true, at: '' });
    await db.addAttempt({ id: 'r-1', questionId: 'hq_aaaaaaa1', rev: 1, answerRev: 1, setId: 'd1', chosen: 'B', correct: true, at: '' });
    expect(await db.countAttempts()).toBe(1);
  });

  it('nextState：answerRev 變了就從頭算', () => {
    const a = nextState(undefined, 'q', 1, true, 't1');
    const b = nextState(a, 'q', 1, false, 't2');
    expect(b).toMatchObject({ seen: 2, correct: 1, wrong: 1, lastCorrect: false });
    const c = nextState(b, 'q', 2, true, 't3');
    expect(c).toEqual({ questionId: 'q', answerRev: 2, seen: 1, correct: 1, wrong: 0, lastCorrect: true, lastAt: 't3', streak: 1 });
  });

  it('nextState：連對累計、答錯歸零；第一批沒有 streak 的紀錄讀出來時補上', async () => {
    const a = nextState(undefined, 'q', 1, true, 't1', 'B');
    const b = nextState(a, 'q', 1, true, 't2', 'B');
    expect(b).toMatchObject({ streak: 2, lastChosen: 'B' });
    expect(nextState(b, 'q', 1, false, 't3', 'A')).toMatchObject({ streak: 0, lastChosen: 'A', wrong: 1 });
    // 沒給 chosen（舊的呼叫方式）不動 lastChosen
    expect(nextState(b, 'q', 1, true, 't4').lastChosen).toBe('B');
    const legacy = { questionId: 'old', answerRev: 1, seen: 3, correct: 2, wrong: 1, lastCorrect: true, lastAt: 't0' } as QuestionState;
    expect(normaliseState(legacy).streak).toBe(1);
    expect(normaliseState({ ...legacy, lastCorrect: false }).streak).toBe(0);
    expect(nextState(legacy, 'old', 1, true, 't5').streak).toBe(2);
    const db = indexedDbExamDb('ledgerland-exam-test-legacy');
    await db.putState(legacy);
    expect((await db.allStates())[0]).toMatchObject({ questionId: 'old', streak: 1 });
  });

  it('getExamDb：同一個實例；測試可以換成記憶體版', async () => {
    const memory = memoryExamDb();
    setExamDbForTests(memory);
    expect(getExamDb()).toBe(memory);
    await getExamDb().putRun(run);
    expect(await memory.getRun(run.key)).toEqual(run);
    setExamDbForTests(null);
    expect(getExamDb()).not.toBe(memory);
    expect(getExamDb()).toBe(getExamDb());
  });
});
