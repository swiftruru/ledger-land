// 作答頁的收藏接線（03 第 2.7 節）：只有不計分的取捨題能收藏；寫回後以實際結果校正樂觀更新；讀寫依序執行，連按兩次不會弄反
import { describe, expect, it } from 'vitest';
import type { JsonValue } from '@ledgerland/progress';
import { FAVOURITES_SETTING, listFavourites, toggleFavourite, type FavouriteSettings } from '../src/features/quiz/favourites.ts';
import { canFavourite, createSerial, setMembership } from '../src/features/quiz/level-favourites.ts';

/** 每次讀寫都要等一下的假 settings：不依序執行時，兩次切換會讀到同一份舊清單 */
function slowStore(): FavouriteSettings & { value: () => JsonValue | undefined } {
  let value: JsonValue | undefined;
  const later = <T>(fn: () => T) => new Promise<T>((resolve) => setTimeout(() => resolve(fn()), 5));
  return {
    value: () => value,
    getSetting: (key) => later(() => (key === FAVOURITES_SETTING && value !== undefined ? { value } : undefined)),
    setSetting: (_key, v) =>
      later(() => {
        value = v;
      }),
  };
}

describe('canFavourite', () => {
  it('取捨題與不計分的題目可以收藏；計分題不行', () => {
    expect(canFavourite({ type: 'judgment', scored: false })).toBe(true);
    expect(canFavourite({ type: 'judgment', scored: true })).toBe(true);
    expect(canFavourite({ type: 'single_choice', scored: false })).toBe(true);
    expect(canFavourite({ type: 'single_choice', scored: true })).toBe(false);
    expect(canFavourite({ type: 'multi_choice', scored: true })).toBe(false);
  });
});

describe('setMembership', () => {
  it('讓清單有或沒有這一題；已經一致時回傳原清單', () => {
    const list = ['q_aaaaaaaa'];
    expect(setMembership(list, 'q_aaaaaaaa', true)).toBe(list);
    expect(setMembership(list, 'q_bbbbbbbb', false)).toBe(list);
    expect(setMembership(list, 'q_bbbbbbbb', true)).toEqual(['q_aaaaaaaa', 'q_bbbbbbbb']);
    expect(setMembership(list, 'q_aaaaaaaa', false)).toEqual([]);
  });
});

describe('createSerial', () => {
  it('依呼叫順序執行；前一件失敗不影響下一件', async () => {
    const run = createSerial();
    const order: string[] = [];
    const wait = (ms: number, label: string) => () => new Promise<string>((resolve) => setTimeout(() => (order.push(label), resolve(label)), ms));
    const failing = () => Promise.reject(new Error('寫不進去'));
    const a = run(wait(20, 'a'));
    const b = run(failing);
    const c = run(wait(1, 'c'));
    await expect(a).resolves.toBe('a');
    await expect(b).rejects.toThrow('寫不進去');
    await expect(c).resolves.toBe('c');
    expect(order).toEqual(['a', 'c']);
  });

  it('連按兩次收藏：依序寫回時結果是取消收藏；讀取排在寫入之後讀到最新的清單', async () => {
    const store = slowStore();
    const run = createSerial();
    const first = run(() => toggleFavourite('q_aaaaaaaa', store, '2026-10-24T08:00:00+08:00'));
    const second = run(() => toggleFavourite('q_aaaaaaaa', store, '2026-10-24T08:00:01+08:00'));
    const third = run(() => toggleFavourite('q_bbbbbbbb', store, '2026-10-24T08:00:02+08:00'));
    const read = run(() => listFavourites(store));
    expect(await first).toBe(true);
    expect(await second).toBe(false);
    expect(await third).toBe(true);
    expect(await read).toEqual(['q_bbbbbbbb']);
    expect(store.value()).toEqual(['q_bbbbbbbb']);
  });
});
