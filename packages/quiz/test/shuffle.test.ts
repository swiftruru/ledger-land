// oxlint-disable vitest/no-standalone-expect -- test.prop 的本體不是 it 區塊，expect 寫在性質裡
// 選項打散（03 第 2.8 節）：同種子相同、不同作答 ID 不同、pin 固定在最後；性質：結果是排列
import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';
import { seededRandom, shuffleChoiceOptions, shuffleOptions, shuffleSeedString } from '../src/index.ts';

const ids = ['o_a1b2', 'o_c3d4', 'o_e5f6', 'o_g7h8', 'o_k9m2'];
const seed = { questionId: 'q_5n2x8k4m', rev: 1, attemptId: 'at_1' };

describe('shuffleOptions', () => {
  it('同一種子每次相同（重新渲染、重新整理、切換語言都不變）', () => {
    const a = shuffleOptions(ids, seed);
    const b = shuffleOptions(ids, { ...seed });
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual([...ids].sort());
  });
  it('固定的黃金結果（自編種子）', () => {
    expect(shuffleOptions(ids, seed)).toMatchInlineSnapshot(`
      [
        "o_g7h8",
        "o_k9m2",
        "o_e5f6",
        "o_c3d4",
        "o_a1b2",
      ]
    `);
  });
  it('作答 ID、rev 或題目 ID 不同時順序會變（在這組自編資料上）', () => {
    const base = shuffleOptions(ids, seed);
    expect(shuffleOptions(ids, { ...seed, attemptId: 'at_2' })).not.toEqual(base);
    expect(shuffleOptions(ids, { ...seed, rev: 2 })).not.toEqual(base);
    expect(shuffleOptions(ids, { ...seed, questionId: 'q_9x4n3m2q' })).not.toEqual(base);
  });
  it('pin 為 last 的選項固定在最後，彼此保持原順序', () => {
    const r = shuffleOptions(ids, seed, { pinned: ['o_c3d4', 'o_k9m2'] });
    expect(r.slice(-2)).toEqual(['o_c3d4', 'o_k9m2']);
    expect([...r.slice(0, 3)].sort()).toEqual(['o_a1b2', 'o_e5f6', 'o_g7h8']);
    expect(shuffleOptions(ids, seed, { pinned: ['o_c3d4', 'o_k9m2'] })).toEqual(r);
  });
  it('shuffleChoiceOptions 讀選項的 pin 欄位，回傳同一組物件', () => {
    const options = ids.map((id, i) => ({ id, text: { 'zh-TW': `選項 ${i}`, en: `Option ${i}` }, ...(id === 'o_c3d4' ? { pin: 'last' as const } : {}) }));
    const r = shuffleChoiceOptions(options, seed);
    expect(r.map((o) => o.id)).toEqual(shuffleOptions(ids, seed, { pinned: ['o_c3d4'] }));
    expect(r.at(-1)?.id).toBe('o_c3d4');
    expect(r.every((o) => options.includes(o))).toBe(true);
    expect(() => shuffleChoiceOptions([options[0]!, options[0]!], seed)).toThrow(TypeError);
  });
  it('種子字串以分隔字元組成，避免「ab、c」與「a、bc」撞在一起；重複的選項 ID 與負的 rev 是程式錯誤', () => {
    expect(shuffleSeedString({ questionId: 'ab', rev: 1, attemptId: 'c' })).not.toBe(shuffleSeedString({ questionId: 'a', rev: 1, attemptId: 'bc' }));
    expect(() => shuffleOptions(['o_a1b2', 'o_a1b2'], seed)).toThrow(TypeError);
    expect(() => shuffleOptions(ids, { ...seed, rev: -1 })).toThrow(RangeError);
  });
  it('seededRandom 的值在 [0, 1) 且決定性', () => {
    const a = seededRandom('x');
    const b = seededRandom('x');
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(b()).toBe(v);
    }
  });
});

describe('性質', () => {
  const uniqueIds = fc.uniqueArray(fc.string({ minLength: 1, maxLength: 8 }), { minLength: 0, maxLength: 12 });
  const anySeed = fc.record({ questionId: fc.string(), rev: fc.nat(), attemptId: fc.string() });

  test.prop([uniqueIds, anySeed])('結果是輸入的排列，且同種子相同', (list, s) => {
    const r = shuffleOptions(list, s);
    expect([...r].sort()).toEqual([...list].sort());
    expect(shuffleOptions(list, s)).toEqual(r);
  });

  test.prop([uniqueIds, anySeed, fc.nat()])('固定的選項一律在最後並保持原順序，其餘是排列', (list, s, k) => {
    const pinned = list.filter((_, i) => (i + k) % 3 === 0);
    const r = shuffleOptions(list, s, { pinned });
    expect(r.slice(r.length - pinned.length)).toEqual(pinned);
    expect([...r.slice(0, r.length - pinned.length)].sort()).toEqual(list.filter((id) => !pinned.includes(id)).sort());
  });
});
