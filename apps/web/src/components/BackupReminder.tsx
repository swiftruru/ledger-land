// 備份提醒（06 第 4.5 節、D10(a)）：沒有取得 persistent 時每完成 3 關或距上次匯出 7 天提醒一次；Safari 分頁與 App 內建瀏覽器每完成 1 關就提醒。
// 到期與否由 packages/progress 的 persistReminderDue 決定：derive.ts 的純函式，不帶 zod，靜態 import（約 2 KB gzip 進首次載入）。
// 不用 import('@ledgerland/progress') 動態載入套件入口：那會把套件所有模組綁成同一個動態進入點，作答頁與地圖第一次繪製就要的 session chunk
// 因此連回儲存 runtime、備份與合併（2026-10-24 收回 LCP 門檻時實測，06 第 8.2 節）；顯示時把 levelsCompletedSinceExport 歸零並寫 lastRemindedAt，
// 同一個工作階段只提醒一次（sessionStorage），可按「之後再說」關閉；作答頁與備份頁（blocksUpdatePrompt）不顯示。可不可以出現由 Banners.tsx 決定，換頁時由它重新掛載、重新評估。
// 要不要出現只看進度與 sessionStorage，所以一掛載就讀、讀到才經 usePageReady 回報（維護者 2026-10-26：橫幅和頁面一起出現，不在頁面出現後才插進來把內容往下推）；
// Banners 目前掛在 PageReveal 外面，這個回報要等 Root 把 Banners 放進 PageReveal 的範圍才生效（回報裡的 handoff），在那之前是 no-op。
// 外觀（站規 2.17，第 1 輪驗收改）：一般頁是 Banner（標題、說明、主動作 secondary sm「前往備份」帶 ExportIcon、次動作 quiet sm「之後再說」；
// 畫面上唯一的 primary 留給頁面主卡）；地圖頁是單行的 HintBar（站規 2.2.4）。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { useMatches } from 'react-router';
import { localePath } from '@ledgerland/i18n';
import type { BackupReminderState } from '@ledgerland/progress';
import { Banner, Button, ExportIcon, HintBar } from '@ledgerland/web-ui';
import type { RouteHandle } from '../app/router.tsx';
import { BACKUP_REMINDER_SETTING, reminderDue } from '../features/me/progress-reads.ts';
import { nowIso } from '../lib/progress/app-info.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { getProgressStore } from '../lib/progress/index.ts';
import { useStorageStatus } from '../lib/progress/status.ts';
import { useLocale } from '../lib/useLocale.ts';
import { readSessionFlag, useSessionFlag, writeSessionFlag } from './useSessionFlag.ts';

export { BACKUP_REMINDER_SETTING };
/** 'shown'：這個工作階段已經提醒過，繼續顯示到關閉；'dismissed'：這個工作階段不再顯示 */
export const BACKUP_REMINDER_SESSION_KEY = 'll:backup-reminder';

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
  // 決定好了沒：sessionStorage 已有答案時同步就是；否則等進度讀完（取不到也算決定好，不顯示）
  const [decided, setDecided] = useState(() => readSessionFlag(BACKUP_REMINDER_SESSION_KEY) !== null);
  useEffect(() => {
    if (session === 'dismissed') return;
    if (session === 'shown') {
      setDue(true);
      return;
    }
    let alive = true;
    // 進度資料庫從 main.tsx 起就和頁面一起開啟，這裡直接讀（不再等第一次繪製）；在作答頁與備份頁 blocked 為 true，讀到也不顯示
    getProgressStore()
      .then((s) => reminderDue(s, persisted))
      .then(
        (v) => alive && setDue(v),
        () => alive && setDue(false),
      )
      .finally(() => alive && setDecided(true));
    return () => {
      alive = false;
    };
  }, [persisted, session]);
  usePageReady(decided || blocked);
  return {
    due: due && !blocked && session !== 'dismissed',
    dismiss: () => {
      setSession('dismissed');
      setDue(false);
    },
  };
}

/** 真的顯示出來才算提醒過：歸零計數並記下時間；同一個工作階段之後維持顯示直到關閉（Banner 與地圖頁的提示條共用） */
function useMarkRemindedOnShow() {
  useEffect(() => {
    if (readSessionFlag(BACKUP_REMINDER_SESSION_KEY) === 'shown') return;
    writeSessionFlag(BACKUP_REMINDER_SESSION_KEY, 'shown');
    void markReminded();
  }, []);
}

export function BackupReminder({ dismiss }: { dismiss: () => void }) {
  const locale = useLocale();
  useMarkRemindedOnShow();
  return (
    <Banner
      className="ll-backup-reminder"
      role="status"
      title={
        <Trans id="backupReminder.title" comment="備份提醒橫幅的標題">
          記得匯出備份
        </Trans>
      }
      actions={
        <>
          <Button size="sm" icon={<ExportIcon />} href={localePath(locale, '/me/backup/')}>
            <Trans id="backupReminder.go" comment="備份提醒裡連到備份頁的按鈕">
              前往備份
            </Trans>
          </Button>
          <Button variant="quiet" size="sm" onClick={dismiss}>
            <Trans id="backupReminder.notNow" comment="關閉備份提醒的按鈕（這個工作階段不再提醒）">
              之後再說
            </Trans>
          </Button>
        </>
      }
    >
      <p>
        <Trans id="backupReminder.body" comment="備份提醒橫幅的說明">
          這台裝置的進度可能被清除，先匯出一份比較安心。
        </Trans>
      </p>
    </Banner>
  );
}

/** 地圖頁的提示條（地圖規格 4.9、站規 2.2.4）：一行字、「詳細」前往備份頁、「關閉」等於「之後再說」 */
export function BackupHint({ dismiss }: { dismiss: () => void }) {
  const { t } = useLingui();
  const locale = useLocale();
  useMarkRemindedOnShow();
  return (
    <HintBar
      className="ll-backup-reminder"
      detailsHref={localePath(locale, '/me/backup/')}
      detailsLabel={t({ id: 'play.hint.details.backup', message: '詳細：前往備份', comment: '地圖頁備份提示條右側「詳細」圖示按鈕的可讀名稱' })}
      onClose={dismiss}
      data-testid="map-hint-backup"
    >
      {t({ id: 'play.hint.backup', message: '記得備份進度', comment: '地圖頁的單行提示條：備份提醒' })}
    </HintBar>
  );
}
