// 取捨題的收藏（03 第 2.7 節）：settings 的 favourites 陣列；切換、列出、移除
import { describe, expect, it } from 'vitest';
import type { JsonValue } from '@ledgerland/progress';
import {
  FAVOURITES_SETTING,
  isFavourite,
  listFavourites,
  parseFavourites,
  removeFavourite,
  toggleFavourite,
  toggleInList,
  type FavouriteSettings,
} from '../src/features/quiz/favourites.ts';

function fakeStore(initial?: JsonValue): FavouriteSettings & { writes: { key: string; value: JsonValue; updatedAt: string }[] } {
  let value = initial;
  const writes: { key: string; value: JsonValue; updatedAt: string }[] = [];
  return {
    writes,
    getSetting: (key) => Promise.resolve(key === FAVOURITES_SETTING && value !== undefined ? { value } : undefined),
    setSetting: (key, v, updatedAt) => {
      value = v;
      writes.push({ key, value: v, updatedAt });
      return Promise.resolve();
    },
  };
}

describe('parseFavourites 與 toggleInList', () => {
  it('不是字串陣列一律當空清單；去重、保留順序', () => {
    expect(parseFavourites(undefined)).toEqual([]);
    expect(parseFavourites('q_a')).toEqual([]);
    expect(parseFavourites(['q_a', 3, 'q_b', 'q_a', ''])).toEqual(['q_a', 'q_b']);
  });
  it('切換：沒有就加到最後，有就移除', () => {
    expect(toggleInList([], 'q_a')).toEqual(['q_a']);
    expect(toggleInList(['q_a', 'q_b'], 'q_a')).toEqual(['q_b']);
    expect(isFavourite(['q_a'], 'q_a')).toBe(true);
  });
});

describe('toggleFavourite、listFavourites、removeFavourite', () => {
  it('寫進 settings 的 favourites，回傳切換後的狀態', async () => {
    const store = fakeStore();
    expect(await toggleFavourite('q_1', store, '2026-10-24T10:00:00.000+08:00')).toBe(true);
    expect(await toggleFavourite('q_2', store, '2026-10-24T10:01:00.000+08:00')).toBe(true);
    expect(await listFavourites(store)).toEqual(['q_1', 'q_2']);
    expect(await toggleFavourite('q_1', store, '2026-10-24T10:02:00.000+08:00')).toBe(false);
    expect(await listFavourites(store)).toEqual(['q_2']);
    expect(store.writes.map((w) => w.key)).toEqual([FAVOURITES_SETTING, FAVOURITES_SETTING, FAVOURITES_SETTING]);
    expect(store.writes[0]!.updatedAt).toBe('2026-10-24T10:00:00.000+08:00');
  });
  it('移除不在清單裡的題目不寫入', async () => {
    const store = fakeStore(['q_1']);
    expect(await removeFavourite('q_9', store)).toEqual(['q_1']);
    expect(store.writes).toHaveLength(0);
    expect(await removeFavourite('q_1', store)).toEqual([]);
    expect(store.writes).toHaveLength(1);
  });
});
