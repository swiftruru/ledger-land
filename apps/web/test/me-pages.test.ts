// 「我的」這一組頁面的純函式（站規 2.8、2.11；finding pages-a-1）：整章不計分的章、備份列的「幾天前」、玩家卡的徽章數
import { describe, expect, it } from 'vitest';
import { unscoredChapterIds } from '../src/features/badges/badges.ts';
import { daysSinceLocal } from '../src/features/me/days.ts';
import { earnedChapterBadges } from '../src/features/me/player-stats.ts';
import { buildChapters, indexData } from '../src/features/quest-map/data.ts';
import type { MapProgress } from '../src/features/quest-map/progress.ts';

describe('unscoredChapterIds（徽章頁的不計分文字，finding pages-a-1）', () => {
  it('已發布的關卡全部 unscored 才算；有一關計分、沒有關卡或缺 levels 都不算', () => {
    const ids = unscoredChapterIds([
      { id: 'ch_k9548t', levels: [{ unscored: true }, { unscored: true }] },
      { id: 'ch_mixed', levels: [{ unscored: true }, {}] },
      { id: 'ch_scored', levels: [{}, { unscored: false }] },
      { id: 'ch_empty', levels: [] },
      { id: 'ch_nolevels' },
    ]);
    expect([...ids]).toEqual(['ch_k9548t']);
  });
});

describe('daysSinceLocal（「我的」備份列右側）', () => {
  const now = new Date(2026, 9, 25, 9, 0, 0);
  it('同一個本地日期是 0，跨過午夜就是 1，往前幾天就是幾', () => {
    expect(daysSinceLocal(new Date(2026, 9, 25, 0, 5).toISOString(), now)).toBe(0);
    expect(daysSinceLocal(new Date(2026, 9, 24, 23, 59).toISOString(), now)).toBe(1);
    expect(daysSinceLocal(new Date(2026, 9, 20, 12, 0).toISOString(), now)).toBe(5);
  });
  it('未來的時間與讀不懂的字串當作今天', () => {
    expect(daysSinceLocal(new Date(2026, 9, 27).toISOString(), now)).toBe(0);
    expect(daysSinceLocal('not-a-date', now)).toBe(0);
  });
});

describe('earnedChapterBadges（玩家卡與首頁捷徑的徽章數）', () => {
  const data = indexData(
    buildChapters(
      [
        { id: 'ch_a', order: 1, title: 'A', levelIds: ['lv_a1', 'lv_a2'], objectives: [] },
        { id: 'ch_b', order: 2, title: 'B', levelIds: ['lv_b1'], objectives: [] },
        { id: 'ch_x', order: 3, scope: 'extension', title: 'X', levelIds: ['lv_x1'], objectives: [] },
      ],
      new Set(['lv_x1']),
    ),
    new Map(),
  );
  const at = '2026-10-20T10:00:00.000+08:00';
  const best = (stars: 0 | 1 | 2 | 3) => ({ stars, bestScore: stars / 3, lastPlayedAt: at });
  it('星星算出的等級與已存的 unlock 取較高者；整章不計分的章讀完就是完成；依章節順序', () => {
    const progress: MapProgress = {
      levels: new Map([
        ['lv_a1', best(3)],
        ['lv_a2', best(3)],
        ['lv_x1', best(0)],
      ]),
      badges: new Set(['badge:ch_b']),
      due: 0,
    };
    expect(earnedChapterBadges(data, progress)).toEqual([
      { chapterId: 'ch_a', state: 'mastery' },
      { chapterId: 'ch_b', state: 'done' },
      { chapterId: 'ch_x', state: 'done' },
    ]);
  });
  it('沒有進度時是空的', () => {
    expect(earnedChapterBadges(data, { levels: new Map(), badges: new Set(), due: 0 })).toEqual([]);
  });
});
