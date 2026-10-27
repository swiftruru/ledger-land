// 幕後頁彩蛋的純函式（features/credits/eggs.ts）：設定值的容錯、去重、找齊判斷、寫回的形狀，以及特別徽章 id 的規則（03 的特別徽章）。
import { LEARNING_SETTING_KEYS } from '@ledgerland/progress';
import { describe, expect, it } from 'vitest';
import { SPECIAL_BADGES } from '../src/features/badges/special.ts';
import {
  CREDITS_BADGE_UNLOCK_ID,
  CREDITS_EGGS_SETTING_KEY,
  EGG_IDS,
  isComplete,
  isEggId,
  readFound,
  toSetting,
  withFound,
} from '../src/features/credits/eggs.ts';

describe('幕後頁的彩蛋', () => {
  it('五個彩蛋，id 不重複', () => {
    expect(EGG_IDS).toHaveLength(5);
    expect(new Set(EGG_IDS).size).toBe(EGG_IDS.length);
    for (const id of EGG_IDS) expect(isEggId(id)).toBe(true);
    expect(isEggId('nope')).toBe(false);
    expect(isEggId(3)).toBe(false);
  });

  it('readFound：不是陣列當作空的；不認識的 id 與重複都略過', () => {
    expect(readFound(undefined).size).toBe(0);
    expect(readFound('mascot').size).toBe(0);
    expect(readFound({ mascot: true }).size).toBe(0);
    expect([...readFound(['mascot', 'nope', 3, 'mascot', 'offline'])]).toEqual(['mascot', 'offline']);
  });

  it('withFound：已經有的回同一個 Set，不改原本的', () => {
    const a = readFound(['mascot']);
    expect(withFound(a, 'mascot')).toBe(a);
    const b = withFound(a, 'version');
    expect(b).not.toBe(a);
    expect(a.has('version')).toBe(false);
    expect(b.has('version')).toBe(true);
  });

  it('isComplete：五個都到才算', () => {
    let found = readFound([]);
    for (const id of EGG_IDS) {
      expect(isComplete(found)).toBe(false);
      found = withFound(found, id);
    }
    expect(isComplete(found)).toBe(true);
  });

  it('toSetting：依 EGG_IDS 的順序寫回', () => {
    expect(toSetting(readFound(['dedication', 'mascot', 'flavours']))).toEqual(['mascot', 'flavours', 'dedication']);
  });

  it('徽章 id 是 special.ts 登記的特別徽章、不以 :mastery 結尾；設定 key 在 LEARNING_SETTING_KEYS 裡', () => {
    expect(CREDITS_BADGE_UNLOCK_ID.startsWith('badge:special:')).toBe(true);
    expect(CREDITS_BADGE_UNLOCK_ID.endsWith(':mastery')).toBe(false);
    expect(CREDITS_EGGS_SETTING_KEY).toBe('creditsEggs');
    expect(LEARNING_SETTING_KEYS).toContain(CREDITS_EGGS_SETTING_KEY);
    expect(SPECIAL_BADGES.map((b) => b.unlockId)).toContain(CREDITS_BADGE_UNLOCK_ID);
  });
});
