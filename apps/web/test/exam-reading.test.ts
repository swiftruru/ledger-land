// 背題瀏覽的閱讀進度（features/exam/reading.ts、read-db.ts、prefs.ts 的位置）：純函式與已讀紀錄的資料庫；題目 ID 是自己編的
import { describe, expect, it } from 'vitest';
import type { HandoutManifestEntry } from '../src/lib/content.ts';
import { getExamReadDb, indexedDbExamReadDb, memoryExamReadDb, setExamReadDbForTests, type ReadMark } from '../src/features/exam/read-db.ts';
import {
  ALL_SCOPE,
  EMPTY_POS,
  encodeBrowsePos,
  lastIn,
  neighbours,
  orderOf,
  parseBrowsePos,
  parseShow,
  readCountOf,
  readSetOf,
  resumeTarget,
  scopeOf,
  visibleIds,
  withoutPositions,
  withScope,
  withVisited,
} from '../src/features/exam/reading.ts';

const deck = (id: string, order: number, sections: string[][]) => ({
  id,
  order,
  code: `0-${order}`,
  title: `講義 ${order}`,
  questionCount: sections.flat().length,
  sections: sections.map((questionIds, i) => ({ id: `${id}s${i + 1}`, title: `段 ${i + 1}`, questionIds })),
  file: `handout_${id}.json`,
});
// 故意把 d2 放前面：順序看 order，不看陣列的位置
const index = {
  id: 'midterm',
  title: '期中考',
  rev: 1,
  questionCount: 7,
  decks: [deck('d2', 2, [['hq_d', 'hq_e']]), deck('d1', 1, [['hq_a', 'hq_b'], ['hq_c']]), deck('d3', 3, [['hq_f', 'hq_g']])],
} as unknown as HandoutManifestEntry;
const mark = (questionId: string, answerRev = 1): ReadMark => ({ questionId, answerRev, at: '2026-11-06T00:00:00Z' });
const revs = (id: string): number | undefined => (/^hq_[a-g]$/.test(id) ? 1 : undefined);

describe('背題瀏覽：範圍與已讀', () => {
  it('範圍：全部依講義順序；講義只有自己的題；不認得的範圍當作全部', () => {
    expect(orderOf(index, ALL_SCOPE)).toEqual(['hq_a', 'hq_b', 'hq_c', 'hq_d', 'hq_e', 'hq_f', 'hq_g']);
    expect(orderOf(index, 'd2')).toEqual(['hq_d', 'hq_e']);
    expect(scopeOf(index, 'd2')).toBe('d2');
    expect(scopeOf(index, 'd9')).toBe(ALL_SCOPE);
    expect(scopeOf(index, null)).toBe(ALL_SCOPE);
    expect(parseShow('unread')).toBe('unread');
    expect(parseShow('read')).toBe('read');
    expect(parseShow('x')).toBe('all');
    expect(parseShow(null)).toBe('all');
  });

  it('已讀只有一份：同一題在「全部」與講義裡一起算，各範圍的數字加得起來', () => {
    const read = readSetOf([mark('hq_a'), mark('hq_d'), mark('hq_e')], revs);
    const all = readCountOf(orderOf(index, ALL_SCOPE), read);
    const each = ['d1', 'd2', 'd3'].map((d) => readCountOf(orderOf(index, d), read));
    expect(all).toBe(3);
    expect(each).toEqual([1, 2, 0]);
    expect(each.reduce((a, b) => a + b, 0)).toBe(all);
  });

  it('答案改版的題回到未讀；題庫裡沒有的題不算', () => {
    const read = readSetOf([mark('hq_a', 1), mark('hq_b', 2), mark('hq_zzz', 1)], revs);
    expect([...read]).toEqual(['hq_a']);
  });

  it('清單的篩選：全部、未讀、已讀', () => {
    const read = new Set(['hq_b']);
    const ids = orderOf(index, 'd1');
    expect(visibleIds(ids, read, 'all')).toEqual(['hq_a', 'hq_b', 'hq_c']);
    expect(visibleIds(ids, read, 'unread')).toEqual(['hq_a', 'hq_c']);
    expect(visibleIds(ids, read, 'read')).toEqual(['hq_b']);
  });
});

describe('背題瀏覽：上一題與下一題', () => {
  const order = orderOf(index, ALL_SCOPE);
  it('全部：相鄰的題；兩端沒有', () => {
    expect(neighbours(order, 'hq_a', new Set(), 'all')).toEqual({ prev: null, next: 'hq_b' });
    expect(neighbours(order, 'hq_c', new Set(), 'all')).toEqual({ prev: 'hq_b', next: 'hq_d' });
    expect(neighbours(order, 'hq_g', new Set(), 'all')).toEqual({ prev: 'hq_f', next: null });
  });
  it('講義範圍：到這一份的最後一題就沒有下一題', () => {
    expect(neighbours(orderOf(index, 'd1'), 'hq_c', new Set(), 'all')).toEqual({ prev: 'hq_b', next: null });
  });
  it('篩選未讀：跳過已讀的題（目前這一題讀不讀都不影響）；已讀的篩選相反', () => {
    const read = new Set(['hq_b', 'hq_c', 'hq_e']);
    expect(neighbours(order, 'hq_a', read, 'unread')).toEqual({ prev: null, next: 'hq_d' });
    expect(neighbours(order, 'hq_d', read, 'unread')).toEqual({ prev: 'hq_a', next: 'hq_f' });
    expect(neighbours(order, 'hq_c', read, 'read')).toEqual({ prev: 'hq_b', next: 'hq_e' });
    expect(neighbours(order, 'hq_g', read, 'unread')).toEqual({ prev: 'hq_f', next: null });
  });
  it('不在範圍裡的題：兩邊都沒有', () => {
    expect(neighbours(orderOf(index, 'd1'), 'hq_d', new Set(), 'all')).toEqual({ prev: null, next: null });
  });
});

describe('背題瀏覽：接著讀', () => {
  const order = orderOf(index, 'd1');
  it('還沒開始：第一題', () => {
    expect(resumeTarget(order, null, new Set())).toEqual({ kind: 'start', id: 'hq_a' });
    expect(resumeTarget([], null, new Set())).toBeNull();
  });
  it('上次停的題還沒讀：就是它', () => {
    expect(resumeTarget(order, 'hq_b', new Set(['hq_a']))).toEqual({ kind: 'resume', id: 'hq_b' });
    // 只翻過、一題都沒標已讀，也算接著讀
    expect(resumeTarget(order, 'hq_b', new Set())).toEqual({ kind: 'resume', id: 'hq_b' });
  });
  it('上次停的題讀了：它之後第一題未讀；後面都讀了就從頭找', () => {
    expect(resumeTarget(order, 'hq_a', new Set(['hq_a']))).toEqual({ kind: 'resume', id: 'hq_b' });
    expect(resumeTarget(order, 'hq_c', new Set(['hq_b', 'hq_c']))).toEqual({ kind: 'resume', id: 'hq_a' });
  });
  it('沒有位置但讀過幾題（位置被重設）：第一題未讀', () => {
    expect(resumeTarget(order, null, new Set(['hq_a']))).toEqual({ kind: 'resume', id: 'hq_b' });
    // 位置指到別份講義的題，當作沒有
    expect(resumeTarget(order, 'hq_f', new Set(['hq_a']))).toEqual({ kind: 'resume', id: 'hq_b' });
  });
  it('都讀完了：回到上次停的題，沒有位置就是第一題', () => {
    const read = new Set(order);
    expect(resumeTarget(order, 'hq_b', read)).toEqual({ kind: 'done', id: 'hq_b' });
    expect(resumeTarget(order, null, read)).toEqual({ kind: 'done', id: 'hq_a' });
  });
});

describe('背題瀏覽：上次停的位置', () => {
  it('位置跟著題目走：從「全部」讀到 d2 的題，更新的是 d2 的位置與整體的位置', () => {
    let pos = withVisited(EMPTY_POS, ALL_SCOPE, 'd2', 'hq_d');
    expect(pos).toEqual({ scope: ALL_SCOPE, decks: { d2: 'hq_d' }, last: 'hq_d' });
    expect(lastIn(pos, ALL_SCOPE)).toBe('hq_d');
    expect(lastIn(pos, 'd2')).toBe('hq_d');
    expect(lastIn(pos, 'd1')).toBeNull();
    // 再到 d1 讀：d2 的位置還在，「全部」接著讀的是最後讀的那一題
    pos = withVisited(pos, 'd1', 'd1', 'hq_b');
    expect(pos).toEqual({ scope: 'd1', decks: { d2: 'hq_d', d1: 'hq_b' }, last: 'hq_b' });
    expect(lastIn(pos, 'd2')).toBe('hq_d');
    expect(lastIn(pos, ALL_SCOPE)).toBe('hq_b');
    // 沒變的時候回同一個物件（不必重寫）
    expect(withVisited(pos, 'd1', 'd1', 'hq_b')).toBe(pos);
    expect(withScope(pos, 'd1')).toBe(pos);
    expect(withScope(pos, 'd3').scope).toBe('d3');
  });

  it('重設一份講義：只清那一份的位置；整體的位置落在那一份裡才清', () => {
    const pos = { scope: 'd1', decks: { d1: 'hq_b', d2: 'hq_d' }, last: 'hq_d' };
    expect(withoutPositions(pos, ['d1'], new Set(orderOf(index, 'd1')))).toEqual({ scope: 'd1', decks: { d2: 'hq_d' }, last: 'hq_d' });
    expect(withoutPositions(pos, ['d2'], new Set(orderOf(index, 'd2')))).toEqual({ scope: 'd1', decks: { d1: 'hq_b' }, last: null });
    expect(withoutPositions(pos, ['d1', 'd2', 'd3'], new Set(orderOf(index, ALL_SCOPE)))).toEqual({ scope: 'd1', decks: {}, last: null });
  });

  it('存取：沒讀過不寫鍵；壞掉或被改過的內容當作沒有', () => {
    expect(encodeBrowsePos(EMPTY_POS)).toBeNull();
    const pos = { scope: 'd2', decks: { d2: 'hq_d' }, last: 'hq_d' };
    expect(parseBrowsePos(encodeBrowsePos(pos))).toEqual(pos);
    // 只換過範圍、還沒讀，也要記
    expect(parseBrowsePos(encodeBrowsePos({ ...EMPTY_POS, scope: 'd3' }))).toEqual({ ...EMPTY_POS, scope: 'd3' });
    expect(parseBrowsePos(null)).toEqual(EMPTY_POS);
    expect(parseBrowsePos('{')).toEqual(EMPTY_POS);
    expect(parseBrowsePos('[]')).toEqual(EMPTY_POS);
    expect(parseBrowsePos(JSON.stringify({ scope: '../x', decks: { all: 'hq_a', d1: 'nope', d2: 'hq_d' }, last: 5 }))).toEqual({
      scope: ALL_SCOPE,
      decks: { d2: 'hq_d' },
      last: null,
    });
  });
});

describe('已讀紀錄的資料庫', () => {
  it('標成已讀、改回未讀、復原一整批；同一題重複標只留一筆', async () => {
    const db = indexedDbExamReadDb('ledgerland-exam-read-test-1');
    expect(await db.all()).toEqual([]);
    await db.put([mark('hq_a'), mark('hq_b'), mark('hq_d')]);
    await db.put([{ ...mark('hq_a'), at: '2026-11-07T00:00:00Z' }]);
    const all = await db.all();
    expect(all.map((m) => m.questionId).sort()).toEqual(['hq_a', 'hq_b', 'hq_d']);
    expect(all.find((m) => m.questionId === 'hq_a')?.at).toBe('2026-11-07T00:00:00Z');
    // 重設 d1：只拿掉 d1 的題，d2 的還在
    const d1 = orderOf(index, 'd1');
    const removed = all.filter((m) => d1.includes(m.questionId));
    await db.remove(d1);
    expect((await db.all()).map((m) => m.questionId)).toEqual(['hq_d']);
    // 復原
    await db.put(removed);
    expect((await db.all()).map((m) => m.questionId).sort()).toEqual(['hq_a', 'hq_b', 'hq_d']);
  });

  it('getExamReadDb：同一個實例；測試可以換成記憶體版', async () => {
    const memory = memoryExamReadDb();
    setExamReadDbForTests(memory);
    expect(getExamReadDb()).toBe(memory);
    await getExamReadDb().put([mark('hq_a')]);
    expect(await memory.all()).toEqual([mark('hq_a')]);
    await getExamReadDb().remove(['hq_a']);
    expect(await memory.all()).toEqual([]);
    setExamReadDbForTests(null);
    expect(getExamReadDb()).not.toBe(memory);
    expect(getExamReadDb()).toBe(getExamReadDb());
  });
});
