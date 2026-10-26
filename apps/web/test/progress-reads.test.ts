// 首頁、「我的」這一組頁面與頂部橫幅在頁面出現前要讀的進度（features/me/progress-reads.ts、features/quiz/useDueCount.ts；維護者 2026-10-26：
// 資料齊了整頁才一次出現）。全部用 MemoryProgressStore 驗：讀到什麼、空資料庫是什麼、查不到的部分退成什麼
import { MemoryProgressStore } from '@ledgerland/progress';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  BACKUP_REMINDER_SETTING,
  IMPORT_PROMPT_SETTING,
  INSTALL_DISMISSED_SETTING,
  LEVELS_COMPLETED_SETTING,
  importPromptNeeded,
  readBackupStats,
  readInstallSettings,
  readTimerSettings,
  reminderDue,
} from '../src/features/me/progress-reads.ts';
import { countDueReviews } from '../src/features/quiz/useDueCount.ts';
import { NOW, attempt, badge, level, meta } from './fixtures.ts';

let store: MemoryProgressStore;
beforeEach(() => {
  store = MemoryProgressStore.empty(meta());
});

describe('countDueReviews（首頁與「我的」的今日複習數）', () => {
  it('空的資料庫是 0；到期的才算、沒到期的不算', async () => {
    expect(await countDueReviews(store, '2026-10-26')).toBe(0);
    const entry = (questionId: string, dueAt: string) => ({
      questionId,
      rev: 1,
      lastResult: 'wrong' as const,
      lastAnsweredAt: NOW,
      box: 1 as const,
      dueAt,
      wrongCount: 1,
      status: 'active' as const,
      addedBy: 'auto' as const,
    });
    await store.putReview(entry('q_7f3k2m9x', '2026-10-25'));
    await store.putReview(entry('q_8f3k2m9y', '2026-10-26'));
    await store.putReview(entry('q_9f3k2m9z', '2026-10-30'));
    expect(await countDueReviews(store, '2026-10-26')).toBe(2);
  });
});

describe('readTimerSettings（設定頁的計時卡）', () => {
  it('沒有設定時是預設值；讀到的值照設定', async () => {
    expect(await readTimerSettings(store)).toEqual({ enabled: false, relaxed: false, announce: true });
    await store.setSetting('timerEnabled', true, NOW);
    await store.setSetting('timerRelaxed', true, NOW);
    await store.setSetting('timerAnnounce', false, NOW);
    expect(await readTimerSettings(store)).toEqual({ enabled: true, relaxed: true, announce: false });
  });
});

describe('importPromptNeeded（App 第一次啟動的匯入提示卡）', () => {
  it('不是 App 模式一律不顯示；App 模式且資料庫是空的才顯示', async () => {
    expect(await importPromptNeeded(store, false)).toBe(false);
    expect(await importPromptNeeded(store, true)).toBe(true);
  });
  it('回答過、或已經有作答或關卡紀錄就不再顯示', async () => {
    await store.setSetting(IMPORT_PROMPT_SETTING, { choice: 'fresh', at: NOW }, NOW);
    expect(await importPromptNeeded(store, true)).toBe(false);
    const played = MemoryProgressStore.empty(meta());
    await played.putLevelProgress(level());
    expect(await importPromptNeeded(played, true)).toBe(false);
  });
});

describe('reminderDue（備份提醒）', () => {
  const now = '2026-10-26T10:00:00.000Z';
  it('還沒有任何備份狀態（沒完成過關卡）不提醒，也不去問瀏覽器', async () => {
    let asked = 0;
    const query = () => {
      asked += 1;
      return Promise.resolve(false);
    };
    expect(await reminderDue(store, null, 'browser', now, query)).toBe(false);
    expect(asked).toBe(0);
  });
  it('一般瀏覽器完成 3 關且沒有保留許可才到期；已保留就不提醒；Safari 分頁完成 1 關就到期', async () => {
    await store.setSetting(BACKUP_REMINDER_SETTING, { levelsCompletedSinceExport: 1 }, NOW);
    expect(await reminderDue(store, false, 'browser', now)).toBe(false);
    expect(await reminderDue(store, false, 'safari-tab', now)).toBe(true);
    await store.setSetting(BACKUP_REMINDER_SETTING, { levelsCompletedSinceExport: 3 }, NOW);
    expect(await reminderDue(store, false, 'browser', now)).toBe(true);
    expect(await reminderDue(store, true, 'browser', now)).toBe(false);
  });
  it('persisted 不知道（null）時才問瀏覽器；問不到當作沒有保留', async () => {
    await store.setSetting(BACKUP_REMINDER_SETTING, { levelsCompletedSinceExport: 3 }, NOW);
    expect(await reminderDue(store, null, 'browser', now, () => Promise.resolve(true))).toBe(false);
    expect(await reminderDue(store, null, 'browser', now, () => Promise.resolve(null))).toBe(true);
  });
});

describe('readInstallSettings（安裝建議）', () => {
  it('沒有設定時是 0 關、沒關閉過；關閉過與完成數照設定；不是數字的完成數當 0', async () => {
    expect(await readInstallSettings(store)).toEqual({ levelsCompleted: 0, dismissed: false });
    await store.setSetting(LEVELS_COMPLETED_SETTING, 2, NOW);
    await store.setSetting(INSTALL_DISMISSED_SETTING, { reason: 'later', at: NOW }, NOW);
    expect(await readInstallSettings(store)).toEqual({ levelsCompleted: 2, dismissed: true });
    await store.setSetting(LEVELS_COMPLETED_SETTING, 'two', NOW);
    expect((await readInstallSettings(store)).levelsCompleted).toBe(0);
  });
});

describe('readBackupStats（備份頁的狀態卡）', () => {
  it('空的資料庫全是 0、沒有匯出過、沒有保留結果；用量由注入的函式給', async () => {
    expect(await readBackupStats(store, () => Promise.resolve(2048))).toEqual({
      attempts: 0,
      levels: 0,
      badges: 0,
      persistResult: null,
      lastExportedAt: null,
      usageBytes: 2048,
    });
  });
  it('數作答、有星星的關卡與徽章（名詞的 unlock 不算）；上次匯出與保留結果從 settings 讀；用量查不到或失敗是 null', async () => {
    await store.addAttempt(attempt(1));
    await store.addAttempt(attempt(2));
    await store.putLevelProgress(level());
    await store.addUnlock(badge());
    await store.addUnlock({ id: 'term:tm_r4w8n2qe', kind: 'term', unlockedAt: NOW });
    const persist = { granted: true, trigger: 'settings-button' as const, at: NOW };
    await store.setSetting('persistResult', persist, NOW);
    await store.setSetting(BACKUP_REMINDER_SETTING, { levelsCompletedSinceExport: 0, lastExportedAt: NOW }, NOW);
    const stats = await readBackupStats(store, () => Promise.reject(new Error('no estimate')));
    expect(stats).toEqual({ attempts: 2, levels: 1, badges: 1, persistResult: persist, lastExportedAt: NOW, usageBytes: null });
    expect((await readBackupStats(store, () => Promise.resolve(null))).usageBytes).toBeNull();
  });
});
