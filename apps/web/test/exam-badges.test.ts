// 苦練徽章的判定（features/badges/exam.ts）：純函式
import { describe, expect, it } from 'vitest';
import { EXAM_BADGES, MOCK_BADGE_MIN_QUESTIONS, earnedExamBadges, examBadgesOf, isExamBadgeId } from '../src/features/badges/exam.ts';
import { isSpecialBadgeId } from '../src/features/badges/special.ts';

const decks = [
  ['a1', 'a2'],
  ['b1', 'b2', 'b3'],
];

describe('苦練徽章：定義', () => {
  it('六枚，三步各兩枚（一枚好拿、一枚要走完），ID 不重複而且都以 badge:exam: 開頭', () => {
    expect(EXAM_BADGES).toHaveLength(6);
    for (const step of ['read', 'practise', 'mock'] as const) expect(EXAM_BADGES.filter((b) => b.step === step).map((b) => b.tier)).toEqual([1, 2]);
    expect(new Set(EXAM_BADGES.map((b) => b.unlockId)).size).toBe(6);
    for (const b of EXAM_BADGES) {
      expect(isExamBadgeId(b.unlockId)).toBe(true);
      expect(isSpecialBadgeId(b.unlockId)).toBe(false);
      // 進度的 unlock ID 格式（packages/progress 的 schema）
      expect(b.unlockId).toMatch(/^badge:[A-Za-z0-9_.:-]+$/);
    }
    expect(isExamBadgeId('badge:ch_abc')).toBe(false);
    expect(isExamBadgeId('badge:special:credits-eggs')).toBe(false);
  });
});

describe('苦練徽章：讀題', () => {
  it('一份都還沒讀完：沒有', () => {
    expect(earnedExamBadges({ read: { decks, readIds: new Set(['a1', 'b1', 'b2']) } })).toEqual([]);
  });
  it('讀完任一份：讀完一份', () => {
    expect(earnedExamBadges({ read: { decks, readIds: new Set(['a1', 'a2', 'b1']) } })).toEqual(['readDeck']);
  });
  it('全部讀完：兩枚都有', () => {
    expect(earnedExamBadges({ read: { decks, readIds: new Set(['a1', 'a2', 'b1', 'b2', 'b3']) } })).toEqual(['readDeck', 'readAll']);
  });
  it('沒有題目的講義不算讀完；沒有題庫時沒有徽章', () => {
    expect(earnedExamBadges({ read: { decks: [[], ['a1']], readIds: new Set() } })).toEqual([]);
    expect(earnedExamBadges({ read: { decks: [[], ['a1']], readIds: new Set(['a1']) } })).toEqual(['readDeck', 'readAll']);
    expect(earnedExamBadges({ read: { decks: [], readIds: new Set(['a1']) } })).toEqual([]);
  });
});

describe('苦練徽章：刷題', () => {
  it('還有題沒練過：沒有', () => {
    expect(earnedExamBadges({ practice: { total: 307, practised: 306, wrong: 0 } })).toEqual([]);
    expect(earnedExamBadges({ practice: { total: 0, practised: 0, wrong: 0 } })).toEqual([]);
  });
  it('每一題都練過：題題練過；還有題停在答錯就沒有錯題歸零', () => {
    expect(earnedExamBadges({ practice: { total: 307, practised: 307, wrong: 3 } })).toEqual(['practisedAll']);
    expect(earnedExamBadges({ practice: { total: 307, practised: 307, wrong: 0 } })).toEqual(['practisedAll', 'noWrong']);
  });
});

describe('苦練徽章：模擬考', () => {
  it('太短的場次不算', () => {
    expect(earnedExamBadges({ mock: { total: MOCK_BADGE_MIN_QUESTIONS - 10, correct: MOCK_BADGE_MIN_QUESTIONS - 10 } })).toEqual([]);
  });
  it('交卷一次 30 題以上：初次上場；答對八成才過關（剛好八成算過）', () => {
    expect(earnedExamBadges({ mock: { total: 30, correct: 0 } })).toEqual(['mockFirst']);
    expect(earnedExamBadges({ mock: { total: 30, correct: 23 } })).toEqual(['mockFirst']);
    expect(earnedExamBadges({ mock: { total: 30, correct: 24 } })).toEqual(['mockFirst', 'mockPass']);
    expect(earnedExamBadges({ mock: { total: 50, correct: 40 } })).toEqual(['mockFirst', 'mockPass']);
    expect(earnedExamBadges({ mock: { total: 50, correct: 39 } })).toEqual(['mockFirst']);
  });
});

describe('苦練徽章：只判定手上有的事實；已經拿到的', () => {
  it('沒給的那一類不判定；一次給三類時照定義的順序', () => {
    expect(earnedExamBadges({})).toEqual([]);
    expect(
      earnedExamBadges({
        mock: { total: 30, correct: 30 },
        practice: { total: 5, practised: 5, wrong: 0 },
        read: { decks, readIds: new Set(['a1', 'a2']) },
      }),
    ).toEqual(['readDeck', 'practisedAll', 'noWrong', 'mockFirst', 'mockPass']);
  });
  it('從進度的 unlock 讀出已經拿到的與取得時間；別種徽章不算', () => {
    const unlocks = new Map([
      ['badge:exam:read-deck', '2026-11-06T10:00:00+08:00'],
      ['badge:exam:mock-pass', '2026-11-07T10:00:00+08:00'],
      ['badge:special:credits-eggs', '2026-11-01T10:00:00+08:00'],
      ['badge:ch_abc', '2026-11-01T10:00:00+08:00'],
    ]);
    expect([...examBadgesOf(unlocks)]).toEqual([
      ['readDeck', '2026-11-06T10:00:00+08:00'],
      ['mockPass', '2026-11-07T10:00:00+08:00'],
    ]);
  });
});
