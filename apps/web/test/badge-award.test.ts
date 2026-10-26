// 章節徽章在完成關卡時就寫進進度（03 第 2.10 節；features/badges/award.ts）：
// 回歸：以前只有打開 /play/ 才寫，學生做完最後一關直接去「我的 › 徽章」或匯出備份時徽章不見，取得日期也變成打開地圖那天
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuestMapData } from '../src/features/quest-map/data.ts';
import { getProgressStore, resetProgressStoreForTests } from '../src/lib/progress/index.ts';
import { freshIndexedDB } from './fixtures.ts';

const holder: { data: QuestMapData | null } = { data: null };

vi.mock('../src/features/quest-map/data.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/features/quest-map/data.ts')>();
  return {
    ...actual,
    contentSource: {
      ...actual.contentSource,
      load: () => (holder.data ? Promise.resolve(holder.data) : Promise.reject(new Error('沒有內容'))),
    },
  };
});

const { awardChapterBadges, badgeDoneAt, badgeEarnedAt, mergeCelebrations, rememberCelebrations, takeCelebrations } =
  await import('../src/features/badges/award.ts');
const { buildChapters, indexData } = await import('../src/features/quest-map/data.ts');

function data(): QuestMapData {
  return indexData(
    buildChapters(
      [
        { id: 'ch_u', order: 13, scope: 'extension', title: '不計分章', levelIds: ['lv_u1', 'lv_u2'], objectives: [] },
        { id: 'ch_s', order: 1, scope: 'core', title: '計分章', levelIds: ['lv_s1'], objectives: [] },
      ],
      new Set(['lv_u1', 'lv_u2']),
    ),
    new Map(),
  );
}

describe('awardChapterBadges', () => {
  beforeEach(async () => {
    freshIndexedDB();
    await resetProgressStoreForTests();
    holder.data = data();
    takeCelebrations();
  });
  afterEach(async () => {
    await resetProgressStoreForTests();
  });

  it('讀完不計分章的兩關：不開地圖也寫進徽章，時間是最後一關完成的時間，並記下給地圖慶祝', async () => {
    const store = await getProgressStore();
    await store.putLevelProgress({
      levelId: 'lv_u1',
      stars: 0,
      bestScore: 0,
      firstCompletedAt: '2026-10-20T09:00:00.000+08:00',
      lastPlayedAt: '2026-10-20T09:00:00.000+08:00',
    });
    // 只讀完一關：還沒有徽章
    expect(await awardChapterBadges('zh-TW', { celebrate: true })).toEqual([]);
    expect(await store.listUnlocks('badge')).toEqual([]);
    await store.putLevelProgress({
      levelId: 'lv_u2',
      stars: 0,
      bestScore: 0,
      firstCompletedAt: '2026-10-21T10:30:00.000+08:00',
      lastPlayedAt: '2026-10-21T10:30:00.000+08:00',
    });
    const written = await awardChapterBadges('zh-TW', { celebrate: true });
    expect(written).toEqual([{ chapterId: 'ch_u', state: 'done', unlockIds: ['badge:ch_u'] }]);
    expect(await store.listUnlocks('badge')).toEqual([{ id: 'badge:ch_u', kind: 'badge', unlockedAt: '2026-10-21T10:30:00.000+08:00' }]);
    // 地圖之後照樣顯示 Toast；取一次就清空
    expect(takeCelebrations()).toEqual(written);
    expect(takeCelebrations()).toEqual([]);
    // 已經寫過就不再寫
    expect(await awardChapterBadges('zh-TW')).toEqual([]);
  });

  it('「我的」與備份頁的補寫不記慶祝；內容讀不到時不寫、不丟錯', async () => {
    const store = await getProgressStore();
    await store.putLevelProgress({
      levelId: 'lv_s1',
      stars: 3,
      bestScore: 1,
      firstCompletedAt: '2026-10-22T08:00:00.000+08:00',
      lastPlayedAt: '2026-10-22T08:00:00.000+08:00',
    });
    expect(await awardChapterBadges('en')).toEqual([{ chapterId: 'ch_s', state: 'mastery', unlockIds: ['badge:ch_s', 'badge:ch_s:mastery'] }]);
    expect(takeCelebrations()).toEqual([]);
    expect((await store.listUnlocks('badge')).map((u) => [u.id, u.unlockedAt])).toEqual([
      ['badge:ch_s', '2026-10-22T08:00:00.000+08:00'],
      ['badge:ch_s:mastery', '2026-10-22T08:00:00.000+08:00'],
    ]);
    holder.data = null;
    expect(await awardChapterBadges('zh-TW', { celebrate: true })).toEqual([]);
  });

  it('完成之後又重玩過（lastPlayedAt 晚於 firstCompletedAt）：完成徽章用完成的日期，精通徽章用最後一次遊玩的日期（finding map-3）', async () => {
    const store = await getProgressStore();
    await store.putLevelProgress({
      levelId: 'lv_s1',
      stars: 3,
      bestScore: 1,
      firstCompletedAt: '2026-10-22T08:00:00.000+08:00',
      lastPlayedAt: '2026-10-25T21:00:00.000+08:00',
    });
    expect(await awardChapterBadges('zh-TW')).toEqual([{ chapterId: 'ch_s', state: 'mastery', unlockIds: ['badge:ch_s', 'badge:ch_s:mastery'] }]);
    expect((await store.listUnlocks('badge')).map((u) => [u.id, u.unlockedAt])).toEqual([
      ['badge:ch_s', '2026-10-22T08:00:00.000+08:00'],
      ['badge:ch_s:mastery', '2026-10-25T21:00:00.000+08:00'],
    ]);
  });
});

describe('慶祝的合併', () => {
  it('badgeEarnedAt 取章內最晚的完成時間；章內沒有紀錄時 undefined', () => {
    const d = data();
    const progress = {
      levels: new Map([
        ['lv_u1', { stars: 0 as const, bestScore: 0, lastPlayedAt: '2026-10-21T10:00:00.000+08:00' }],
        ['lv_u2', { stars: 0 as const, bestScore: 0, lastPlayedAt: '2026-10-20T10:00:00.000+08:00' }],
      ]),
      badges: new Set<string>(),
      due: 0,
    };
    expect(badgeEarnedAt(d, progress, 'ch_u')).toBe('2026-10-21T10:00:00.000+08:00');
    expect(badgeEarnedAt(d, progress, 'ch_s')).toBeUndefined();
  });
  it('badgeDoneAt 取章內最晚的第一次完成時間（沒有時退回最後遊玩時間）；不計分章看全部關卡', () => {
    const d = data();
    const progress = {
      levels: new Map([
        ['lv_u1', { stars: 0 as const, bestScore: 0, lastPlayedAt: '2026-10-24T10:00:00.000+08:00', firstCompletedAt: '2026-10-19T10:00:00.000+08:00' }],
        ['lv_u2', { stars: 0 as const, bestScore: 0, lastPlayedAt: '2026-10-20T10:00:00.000+08:00' }],
        ['lv_s1', { stars: 2 as const, bestScore: 0.8, lastPlayedAt: '2026-10-23T10:00:00.000+08:00', firstCompletedAt: '2026-10-21T10:00:00.000+08:00' }],
      ]),
      badges: new Set<string>(),
      due: 0,
    };
    expect(badgeDoneAt(d, progress, 'ch_u')).toBe('2026-10-20T10:00:00.000+08:00');
    expect(badgeDoneAt(d, progress, 'ch_s')).toBe('2026-10-21T10:00:00.000+08:00');
    expect(badgeDoneAt(d, { ...progress, levels: new Map() }, 'ch_s')).toBeUndefined();
  });
  it('同一章只留一則、精通優先，依地圖的章節順序；remember 重複記同一章時合併', () => {
    const d = data();
    rememberCelebrations([{ chapterId: 'ch_u', state: 'done', unlockIds: ['badge:ch_u'] }]);
    rememberCelebrations([{ chapterId: 'ch_u', state: 'done', unlockIds: ['badge:ch_u'] }]);
    const remembered = takeCelebrations();
    expect(remembered).toHaveLength(1);
    const merged = mergeCelebrations(
      d,
      [
        { chapterId: 'ch_s', state: 'mastery', unlockIds: ['badge:ch_s', 'badge:ch_s:mastery'] },
        { chapterId: 'ch_u', state: 'done', unlockIds: ['badge:ch_u'] },
      ],
      remembered,
    );
    expect(merged.map((e) => [e.chapterId, e.state, e.unlockIds])).toEqual([
      ['ch_s', 'mastery', ['badge:ch_s', 'badge:ch_s:mastery']],
      ['ch_u', 'done', ['badge:ch_u']],
    ]);
    // 不在地圖資料裡的章（例如已下架）不顯示
    expect(mergeCelebrations(d, [], [{ chapterId: 'ch_gone', state: 'done', unlockIds: ['badge:ch_gone'] }])).toEqual([]);
  });
});
