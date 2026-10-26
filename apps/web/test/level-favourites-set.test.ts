// 作答頁的收藏寫回（quiz-5）：依畫面上看到的狀態寫入目標值，不反轉資料庫；清單還沒讀到時按「收藏」也不會把已收藏的題目取消；
// 讀取完成時以資料庫清單為底，套上這段期間還沒寫完的操作，不丟掉資料庫的清單
import { describe, expect, it, vi } from 'vitest';
import type { JsonValue } from '@ledgerland/progress';
import { FAVOURITES_SETTING, type FavouriteSettings } from '../src/features/quiz/favourites.ts';
import { mergePending, writeFavourite } from '../src/features/quiz/level-favourites.ts';

function memoryStore(initial?: JsonValue): FavouriteSettings & { value: () => JsonValue | undefined } {
  let value = initial;
  return {
    value: () => value,
    getSetting: async (key) => (key === FAVOURITES_SETTING && value !== undefined ? { value } : undefined),
    setSetting: async (_key, v) => {
      value = v;
    },
  };
}

describe('writeFavourite', () => {
  it('資料庫已有 X、畫面清單還沒讀到時按「收藏」（目標是已收藏）：資料庫仍然有 X，不寫入', async () => {
    const store = memoryStore(['q_xxxxxxxx', 'q_yyyyyyyy']);
    const set = vi.spyOn(store, 'setSetting');
    expect(await writeFavourite('q_xxxxxxxx', true, store, '2026-10-25T08:00:00+08:00')).toBe(true);
    expect(store.value()).toEqual(['q_xxxxxxxx', 'q_yyyyyyyy']);
    expect(set).not.toHaveBeenCalled();
  });

  it('目標是未收藏就移除、已收藏就加到最後', async () => {
    const store = memoryStore(['q_xxxxxxxx']);
    expect(await writeFavourite('q_xxxxxxxx', false, store, '2026-10-25T08:00:00+08:00')).toBe(false);
    expect(store.value()).toEqual([]);
    expect(await writeFavourite('q_zzzzzzzz', true, store, '2026-10-25T08:00:01+08:00')).toBe(true);
    expect(store.value()).toEqual(['q_zzzzzzzz']);
  });
});

describe('mergePending', () => {
  it('讀到的資料庫清單為底，套上還沒寫完的操作', () => {
    const pending = new Map<string, boolean>([
      ['q_aaaaaaaa', true],
      ['q_yyyyyyyy', false],
    ]);
    expect(mergePending(['q_xxxxxxxx', 'q_yyyyyyyy'], pending)).toEqual(['q_xxxxxxxx', 'q_aaaaaaaa']);
    expect(mergePending(['q_xxxxxxxx'], new Map())).toEqual(['q_xxxxxxxx']);
  });
});
