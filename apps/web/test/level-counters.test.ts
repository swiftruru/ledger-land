// 完成關卡的累計（06 第 2.5 節的安裝提示、第 4.5 節的備份提醒）：recordLevelComplete 每次完成都把 levelsCompleted 與 backupReminder.levelsCompletedSinceExport 加一，
// 不動 lastExportedAt；配合 persistReminderDue 在 Safari 分頁完成 1 關就到期
import { MemoryProgressStore, persistReminderDue, type BackupReminderState } from '@ledgerland/progress';
import { beforeEach, describe, expect, it } from 'vitest';
import { LEVELS_COMPLETED_SETTING, recordLevelComplete } from '../src/features/quiz/record.ts';
import { meta } from './fixtures.ts';

let store: MemoryProgressStore;
beforeEach(() => {
  store = MemoryProgressStore.empty(meta());
});

describe('recordLevelComplete 的累計', () => {
  it('每完成一次就加一；第一次從沒有設定開始', async () => {
    await recordLevelComplete('lv_t3st0001', [{ scored: true, score: 1 }], store);
    expect((await store.getSetting(LEVELS_COMPLETED_SETTING))?.value).toBe(1);
    expect((await store.getSetting('backupReminder'))?.value).toEqual({ levelsCompletedSinceExport: 1 });
    await recordLevelComplete('lv_t3st0001', [{ scored: true, score: 0 }], store);
    await recordLevelComplete('lv_t3st0002', [{ scored: true, score: 1 }], store);
    expect((await store.getSetting(LEVELS_COMPLETED_SETTING))?.value).toBe(3);
    expect((await store.getSetting('backupReminder'))?.value).toEqual({ levelsCompletedSinceExport: 3 });
  });

  it('保留上次匯出與提醒的時間；Safari 分頁完成 1 關就到期、一般瀏覽器要 3 關', async () => {
    await store.setSetting('backupReminder', { levelsCompletedSinceExport: 0, lastExportedAt: '2026-10-20T10:00:00.000Z' }, '2026-10-20T10:00:00.000Z');
    await recordLevelComplete('lv_t3st0001', [{ scored: true, score: 1 }], store);
    const state = (await store.getSetting('backupReminder'))?.value as BackupReminderState;
    expect(state).toEqual({ levelsCompletedSinceExport: 1, lastExportedAt: '2026-10-20T10:00:00.000Z' });
    const now = '2026-10-21T10:00:00.000Z';
    expect(persistReminderDue({ ...state, persisted: false, environment: 'safari-tab' }, now).due).toBe(true);
    expect(persistReminderDue({ ...state, persisted: false, environment: 'browser' }, now).due).toBe(false);
  });
});
