// 備份提醒（06 第 4.5 節、D10(a)）：沒有取得 persistent 時每完成 3 關或距上次匯出 7 天提醒一次；Safari 分頁與 App 內建瀏覽器每完成 1 關就提醒。
// 到期與否由 packages/progress 的 persistReminderDue 決定（延後載入，不進首次載入）；顯示時把 levelsCompletedSinceExport 歸零並寫 lastRemindedAt，
// 同一個工作階段只提醒一次（sessionStorage），可按「稍後」關閉；作答頁與備份頁（blocksUpdatePrompt）不顯示。可不可以出現由 Banners.tsx 決定，換頁時由它重新掛載、重新評估。
import { Trans } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { Link, useMatches } from 'react-router';
import { localePath } from '@ledgerland/i18n';
import type { BackupReminderState } from '@ledgerland/progress';
import { Banner, Button } from '@ledgerland/web-ui';
import type { RouteHandle } from '../app/router.tsx';
import { environmentKind } from '../lib/env.ts';
import { nowIso } from '../lib/progress/app-info.ts';
import { afterFirstPaint } from '../lib/idle.ts';
import { getProgressStore } from '../lib/progress/index.ts';
import { refreshPersisted } from '../lib/progress/persist.ts';
import { useStorageStatus } from '../lib/progress/status.ts';
import { useLocale } from '../lib/useLocale.ts';
import { readSessionFlag, useSessionFlag, writeSessionFlag } from './useSessionFlag.ts';

export const BACKUP_REMINDER_SETTING = 'backupReminder';
/** 'shown'：這個工作階段已經提醒過，繼續顯示到關閉；'dismissed'：這個工作階段不再顯示 */
export const BACKUP_REMINDER_SESSION_KEY = 'll:backup-reminder';

async function isReminderDue(persisted: boolean | null): Promise<boolean> {
  const store = await getProgressStore();
  const state = (await store.getSetting(BACKUP_REMINDER_SETTING))?.value as BackupReminderState | undefined;
  if (state === undefined) return false;
  const { persistReminderDue } = await import('@ledgerland/progress');
  const persistedNow = persisted ?? (await refreshPersisted()) ?? false;
  return persistReminderDue({ ...state, persisted: persistedNow, environment: environmentKind() }, nowIso()).due;
}

/** 顯示後的紀錄：歸零關卡計數、寫上提醒時間（06 第 4.5 節「提醒一次」） */
async function markReminded(): Promise<void> {
  const store = await getProgressStore();
  const now = nowIso();
  const prev = (await store.getSetting(BACKUP_REMINDER_SETTING))?.value as BackupReminderState | undefined;
  const next: BackupReminderState = { ...(prev ?? {}), levelsCompletedSinceExport: 0, lastRemindedAt: now };
  await store.setSetting(BACKUP_REMINDER_SETTING, next, now);
}

export interface BackupReminderStateHook {
  due: boolean;
  dismiss: () => void;
}

export function useBackupReminder(): BackupReminderStateHook {
  const matches = useMatches();
  const blocked = matches.some((m) => (m.handle as RouteHandle | undefined)?.blocksUpdatePrompt);
  const persisted = useStorageStatus((s) => s.persisted);
  const [session, setSession] = useSessionFlag(BACKUP_REMINDER_SESSION_KEY);
  const [due, setDue] = useState(() => readSessionFlag(BACKUP_REMINDER_SESSION_KEY) === 'shown');
  useEffect(() => {
    if (session === 'dismissed') return;
    if (session === 'shown') {
      setDue(true);
      return;
    }
    let alive = true;
    // 這個 hook 每一頁都會跑：進度資料庫等第一次繪製送出後再開（afterFirstPaint，06 第 8.2 節），否則 runtime 與 zod 的 chunk 會跟 LCP 搶頻寬，名詞頁多 300ms；
    // 提醒晚半秒出現沒有關係，作答頁的捲動錨點在版面改變時會重新記錄（useScrollAnchor），提醒晚幾百毫秒出現沒有關係
    const cancel = afterFirstPaint(() => {
      isReminderDue(persisted).then(
        (v) => alive && setDue(v),
        () => alive && setDue(false),
      );
    });
    return () => {
      alive = false;
      cancel();
    };
  }, [persisted, session]);
  return {
    due: due && !blocked && session !== 'dismissed',
    dismiss: () => {
      setSession('dismissed');
      setDue(false);
    },
  };
}

export function BackupReminder({ dismiss }: { dismiss: () => void }) {
  const locale = useLocale();
  // 真的顯示出來才算提醒過：歸零計數並記下時間；同一個工作階段之後維持顯示直到關閉
  useEffect(() => {
    if (readSessionFlag(BACKUP_REMINDER_SESSION_KEY) === 'shown') return;
    writeSessionFlag(BACKUP_REMINDER_SESSION_KEY, 'shown');
    void markReminded();
  }, []);
  return (
    <Banner className="ll-backup-reminder" role="status">
      <p>
        <Trans id="backupReminder.text" comment="備份提醒橫幅的本文">
          記得匯出備份：這台裝置的進度可能被清除，先匯出一份比較安心。
        </Trans>
      </p>
      <div className="ll-row">
        <Link className="ll-btn ll-btn--primary" to={localePath(locale, '/me/backup/')}>
          <Trans id="backupReminder.go" comment="備份提醒裡連到備份頁的按鈕">
            前往備份
          </Trans>
        </Link>
        <Button onClick={dismiss}>
          <Trans id="backupReminder.later" comment="關閉備份提醒的按鈕">
            稍後
          </Trans>
        </Button>
      </div>
    </Banner>
  );
}
