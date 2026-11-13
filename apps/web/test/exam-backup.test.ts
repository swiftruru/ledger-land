// 苦練紀錄跟著備份走（features/exam/backup.ts）：匯出成一列一列的精簡格式、驗證與還原、合併規則（最近練的為準、匯入幾次都一樣）、覆蓋
import { describe, expect, it } from 'vitest';
import { memoryExamDb, nextState, type QuestionState } from '../src/features/exam/db.ts';
import { EXAM_BACKUP_VERSION, exportExamBackup, importExamBackup, mergeExamStates, parseExamBackup, pickState } from '../src/features/exam/backup.ts';

const state = (id: string, patch: Partial<QuestionState> = {}): QuestionState => ({
  questionId: `hq_${id}`,
  answerRev: 1,
  seen: 2,
  correct: 1,
  wrong: 1,
  lastCorrect: true,
  lastAt: '2026-11-05T01:00:00.000Z',
  streak: 1,
  lastChosen: 'B',
  ...patch,
});

describe('苦練紀錄的備份', () => {
  it('匯出：每題一列、依 ID 排序、沒練過的不帶；一題都沒有回 null', async () => {
    const db = memoryExamDb();
    expect(await exportExamBackup(db)).toBeNull();
    await db.putState(state('bbbbbbb2', { lastChosen: undefined as never }));
    await db.putState(state('aaaaaaa1', { lastAt: '2026-11-05T01:00:07.900Z' }));
    await db.putState({ ...state('ccccccc3'), seen: 0, correct: 0, wrong: 0, streak: 0, lastCorrect: false });
    const backup = await exportExamBackup(db);
    expect(backup).toEqual({
      v: EXAM_BACKUP_VERSION,
      q: [
        ['aaaaaaa1', 1, 2, 1, 1, 1, Date.parse('2026-11-05T01:00:07.000Z') / 1000, 'B'],
        ['bbbbbbb2', 1, 2, 1, 1, 1, Date.parse('2026-11-05T01:00:00.000Z') / 1000, ''],
      ],
    });
    // 是純 JSON：序列化再解析不變
    expect(JSON.parse(JSON.stringify(backup))).toEqual(backup);
  });

  it('還原：欄位補回來（錯幾次是練過減對的、時間到秒）；真的作答產生的紀錄也 round-trip', async () => {
    const db = memoryExamDb();
    let s = nextState(undefined, 'hq_aaaaaaa1', 3, true, '2026-11-05T02:00:00.400Z', 'C');
    s = nextState(s, 'hq_aaaaaaa1', 3, true, '2026-11-05T02:00:09.400Z', 'C');
    s = nextState(s, 'hq_aaaaaaa1', 3, false, '2026-11-05T02:00:20.400Z', 'A');
    await db.putState(s);
    const parsed = parseExamBackup(JSON.parse(JSON.stringify(await exportExamBackup(db))));
    expect(parsed).toEqual([{ ...s, lastAt: '2026-11-05T02:00:20.000Z', lastWrongAt: '2026-11-05T02:00:20.000Z' }]);
  });

  it('第 2 版：最近一次答錯的時間跟著走（答對之後才需要多寫一欄），第 1 版的備份照樣讀得進來', async () => {
    const db = memoryExamDb();
    let s = nextState(undefined, 'hq_aaaaaaa1', 1, false, '2026-11-12T03:00:00.000Z', 'A');
    s = nextState(s, 'hq_aaaaaaa1', 1, false, '2026-11-13T03:00:00.000Z', 'A');
    await db.putState(s);
    // 最近一次是答錯的：不必多寫，讀回來就是最近一次的時間
    expect((await exportExamBackup(db))!.q[0]).toHaveLength(8);
    expect(parseExamBackup(JSON.parse(JSON.stringify(await exportExamBackup(db))))).toEqual([s]);
    s = nextState(s, 'hq_aaaaaaa1', 1, true, '2026-11-13T03:05:00.000Z', 'B');
    await db.putState(s);
    const backup = (await exportExamBackup(db))!;
    expect(backup.v).toBe(2);
    expect(backup.q[0]).toEqual(['aaaaaaa1', 1, 3, 1, 1, 1, Date.parse('2026-11-13T03:05:00.000Z') / 1000, 'B', Date.parse('2026-11-13T03:00:00.000Z') / 1000]);
    expect(parseExamBackup(JSON.parse(JSON.stringify(backup)))).toEqual([s]);
    // 沒答錯過的題還是 8 個元素
    await db.putState(nextState(undefined, 'hq_bbbbbbb2', 1, true, '2026-11-13T03:06:00.000Z', 'C'));
    expect((await exportExamBackup(db))!.q.map((row) => row.length)).toEqual([9, 8]);
    // 第 1 版：沒有那一欄；最近一次答錯的補成最近一次的時間，其餘留空
    const v1 = parseExamBackup({
      v: 1,
      q: [
        ['aaaaaaa1', 1, 3, 1, 0, 0, 1794000000, 'A'],
        ['bbbbbbb2', 1, 3, 2, 2, 1, 1794000000, 'A'],
      ],
    })!;
    expect(v1.map((x) => x.lastWrongAt)).toEqual([new Date(1794000000 * 1000).toISOString(), undefined]);
    // 第 9 個元素不合理的列略過：比最近一次作答晚、沒答錯過卻有、最近一次是答錯卻有
    const bad = parseExamBackup({
      v: 2,
      q: [
        ['aaaaaaa1', 1, 3, 1, 1, 1, 1794000000, 'A', 1794000001],
        ['aaaaaaa2', 1, 2, 2, 2, 1, 1794000000, 'A', 1793000000],
        ['aaaaaaa3', 1, 3, 1, 0, 0, 1794000000, 'A', 1793000000],
        ['aaaaaaa4', 1, 3, 1, 1, 1, 1794000000, 'A', 0],
        ['aaaaaaa5', 1, 3, 1, 1, 1, 1794000000, 'A', 1793000000],
      ],
    })!;
    expect(bad.map((x) => x.questionId)).toEqual(['hq_aaaaaaa5']);
    expect(parseExamBackup({ v: 3, q: [] })).toBeNull();
  });

  it('驗證：不是這個格式回 null；壞掉的單列略過，其餘照收；同一題重複留後面那一列', () => {
    expect(parseExamBackup(null)).toBeNull();
    expect(parseExamBackup({ v: 3, q: [] })).toBeNull();
    expect(parseExamBackup({ v: 1, questionState: [] })).toBeNull();
    const good = ['aaaaaaa1', 1, 3, 2, 0, 0, 1794000000, 'A'];
    const rows = [
      good,
      ['AAAAAAA1', 1, 3, 2, 0, 0, 1794000000, 'A'], // ID 不合規則
      ['aaaaaaa2', 1, 2, 3, 1, 1, 1794000000, 'A'], // 對的比練過的多
      ['aaaaaaa3', 1, 2, 1, 1, 0, 1794000000, 'A'], // 最近答錯卻有連對
      ['aaaaaaa4', 1, 2, 1, 0, 1, 1794000000, 'A'], // 最近答對卻沒有連對
      ['aaaaaaa5', 1, 2, 1, 1, 1, 1794000000, 'F'], // 選項只到 E
      ['aaaaaaa6', 1, 2, 1, 1, 1, 1794000000], // 少一欄
      'nope',
      ['aaaaaaa1', 1, 4, 3, 1, 1, 1794000100, 'B'],
    ];
    const parsed = parseExamBackup({ v: 1, q: rows });
    expect(parsed).toHaveLength(1);
    expect(parsed![0]).toMatchObject({ questionId: 'hq_aaaaaaa1', seen: 4, correct: 3, wrong: 1, streak: 1, lastCorrect: true, lastChosen: 'B' });
  });

  it('最近選的字母收 A 到 E（題庫的選項放寬到 5 個之後，選 D、E 的紀錄匯入時不能被丟掉）', () => {
    const rows = ['A', 'B', 'C', 'D', 'E', ''].map((letter, i) => [`aaaaaaa${i + 1}`, 1, 2, 1, 1, 1, 1794000000, letter]);
    const parsed = parseExamBackup({ v: 1, q: rows });
    expect(parsed?.map((s) => s.lastChosen)).toEqual(['A', 'B', 'C', 'D', 'E', undefined]);
  });

  it('同一題留哪一筆：答案版本新的；同版本留最近練的；一樣晚留練得多的；全一樣留本機的', () => {
    const local = state('aaaaaaa1');
    expect(pickState(local, state('aaaaaaa1', { answerRev: 2, lastAt: '2026-01-01T00:00:00.000Z' })).answerRev).toBe(2);
    expect(pickState({ ...local, answerRev: 2 }, state('aaaaaaa1', { lastAt: '2027-01-01T00:00:00.000Z' })).answerRev).toBe(2);
    expect(pickState(local, state('aaaaaaa1', { lastAt: '2026-11-05T01:00:01.000Z', seen: 9 })).seen).toBe(9);
    expect(pickState(local, state('aaaaaaa1', { lastAt: '2026-11-05T00:59:59.000Z', seen: 9 })).seen).toBe(2);
    expect(pickState(local, state('aaaaaaa1', { seen: 5, correct: 4 })).seen).toBe(5);
    expect(pickState(local, { ...local })).toBe(local);
  });

  it('合併：兩邊的題都留；同一份備份匯入兩次結果一樣；自己匯出的備份匯回來不會蓋掉本機較新的紀錄', async () => {
    const db = memoryExamDb();
    await db.putState(state('aaaaaaa1', { lastAt: '2026-11-05T03:00:00.700Z', seen: 5, correct: 4, wrong: 1 }));
    await db.putState(state('bbbbbbb2'));
    const incoming = [state('aaaaaaa1', { lastAt: '2026-11-05T02:00:00.000Z' }), state('ccccccc3', { lastCorrect: false, streak: 0 })];
    await importExamBackup(db, incoming, 'merge');
    const once = (await db.allStates()).sort((a, b) => (a.questionId < b.questionId ? -1 : 1));
    expect(once.map((s) => [s.questionId, s.seen])).toEqual([
      ['hq_aaaaaaa1', 5],
      ['hq_bbbbbbb2', 2],
      ['hq_ccccccc3', 2],
    ]);
    await importExamBackup(db, incoming, 'merge');
    expect((await db.allStates()).sort((a, b) => (a.questionId < b.questionId ? -1 : 1))).toEqual(once);
    // 匯出再匯回：時間被捨到秒，比本機的舊，本機的原樣留著
    const own = parseExamBackup(await exportExamBackup(db))!;
    await importExamBackup(db, own, 'merge');
    expect((await db.allStates()).find((s) => s.questionId === 'hq_aaaaaaa1')!.lastAt).toBe('2026-11-05T03:00:00.700Z');
    expect(mergeExamStates([], incoming)).toEqual(incoming);
  });

  it('覆蓋：先清掉本機的再寫入', async () => {
    const db = memoryExamDb();
    await db.putState(state('aaaaaaa1'));
    await db.putState(state('bbbbbbb2'));
    await importExamBackup(db, [state('ccccccc3')], 'replace');
    expect((await db.allStates()).map((s) => s.questionId)).toEqual(['hq_ccccccc3']);
  });
});
