// 首頁、「我的」這一組頁面與頂部橫幅在頁面出現之前要從進度資料庫讀的東西（維護者 2026-10-26：每一頁資料齊了才一次出現，橫幅也和頁面一起出現）。
// 全部是可注入 store 的純函式、沒有 React 與 DOM，給單元測試用 MemoryProgressStore 驗；各 hook（TimerSetting、ImportPromptCard、BackupReminder、
// InstallPrompt、Backup 頁）只負責呼叫 getProgressStore() 再交給這裡，讀到後經 usePageReady 回報。
import type { BackupReminderState, PersistResult, ProgressStore, StorageEnvironment } from '@ledgerland/progress';
import { persistReminderDue } from '@ledgerland/progress';
import { environmentKind, isAppMode } from '../../lib/env.ts';
import { nowIso } from '../../lib/progress/app-info.ts';
import { hasNoProgress } from '../../lib/progress/index.ts';
import { refreshPersisted } from '../../lib/progress/persist.ts';
import { TIMER_ANNOUNCE_SETTING, TIMER_ENABLED_SETTING, TIMER_RELAXED_SETTING, parseTimerSettings, type TimerSettings } from '../quiz/timer.ts';

/** 主畫面 App 第一次啟動的匯入提示：選過任何一個選項就記在這個鍵，之後不再出現 */
export const IMPORT_PROMPT_SETTING = 'importPromptAnswered';
export const BACKUP_REMINDER_SETTING = 'backupReminder';
export const INSTALL_DISMISSED_SETTING = 'installPromptDismissed';
export const LEVELS_COMPLETED_SETTING = 'levelsCompleted';

type SettingsReader = Pick<ProgressStore, 'getSetting'>;

/** 設定頁計時卡的三個開關 */
export async function readTimerSettings(store: SettingsReader): Promise<TimerSettings> {
  const [enabled, relaxed, announce] = await Promise.all([
    store.getSetting(TIMER_ENABLED_SETTING),
    store.getSetting(TIMER_RELAXED_SETTING),
    store.getSetting(TIMER_ANNOUNCE_SETTING),
  ]);
  return parseTimerSettings(enabled?.value, relaxed?.value, announce?.value);
}

/** 要不要顯示匯入提示卡：App 模式、還沒回答過、而且資料庫裡沒有任何學習紀錄（06 第 4.7 節第 3 步） */
export async function importPromptNeeded(
  store: Pick<ProgressStore, 'getSetting' | 'listAttempts' | 'listLevelProgress'>,
  appMode: boolean = isAppMode(),
): Promise<boolean> {
  if (!appMode) return false;
  const answered = await store.getSetting(IMPORT_PROMPT_SETTING);
  if (answered !== undefined) return false;
  return hasNoProgress(store as ProgressStore);
}

/** 備份提醒到期了沒（06 第 4.5 節）：沒有任何備份狀態（還沒完成過關卡）就不提醒；persisted 是 null 時才去問瀏覽器（queryPersisted） */
export async function reminderDue(
  store: SettingsReader,
  persisted: boolean | null,
  environment: StorageEnvironment = environmentKind(),
  now: string = nowIso(),
  queryPersisted: () => Promise<boolean | null> = refreshPersisted,
): Promise<boolean> {
  const state = (await store.getSetting(BACKUP_REMINDER_SETTING))?.value as BackupReminderState | undefined;
  if (state === undefined) return false;
  const persistedNow = persisted ?? (await queryPersisted()) ?? false;
  return persistReminderDue({ ...state, persisted: persistedNow, environment }, now).due;
}

export interface InstallSettings {
  readonly levelsCompleted: number;
  readonly dismissed: boolean;
}

/** 安裝建議要用的兩個設定（06 第 2.5 節）：完成的關卡數與是否關閉過 */
export async function readInstallSettings(store: SettingsReader): Promise<InstallSettings> {
  const [levels, dismissed] = await Promise.all([store.getSetting(LEVELS_COMPLETED_SETTING), store.getSetting(INSTALL_DISMISSED_SETTING)]);
  return { levelsCompleted: typeof levels?.value === 'number' ? levels.value : 0, dismissed: dismissed !== undefined };
}

export interface BackupStats {
  readonly attempts: number;
  readonly levels: number;
  readonly badges: number;
  readonly persistResult: PersistResult | null;
  readonly lastExportedAt: string | null;
  /** navigator.storage.estimate() 的用量；查不到時 null */
  readonly usageBytes: number | null;
}

/** 備份頁狀態卡的統計（站規 2.10）：estimateUsage 可注入（預設問 navigator.storage，失敗或不支援時 null） */
export async function readBackupStats(
  store: Pick<ProgressStore, 'listAttempts' | 'listLevelProgress' | 'listUnlocks' | 'getSetting'>,
  estimateUsage: () => Promise<number | null> = browserUsage,
): Promise<BackupStats> {
  const [attempts, levels, badges, persist, reminder, usageBytes] = await Promise.all([
    store.listAttempts(),
    store.listLevelProgress(),
    store.listUnlocks('badge'),
    store.getSetting('persistResult'),
    store.getSetting(BACKUP_REMINDER_SETTING),
    estimateUsage().catch((): number | null => null),
  ]);
  return {
    attempts: attempts.length,
    levels: levels.length,
    badges: badges.length,
    persistResult: (persist?.value as PersistResult | undefined) ?? null,
    lastExportedAt: (reminder?.value as BackupReminderState | undefined)?.lastExportedAt ?? null,
    usageBytes,
  };
}

async function browserUsage(): Promise<number | null> {
  return (await navigator.storage?.estimate?.())?.usage ?? null;
}
