// 「我的 › 設定 › 計時」（03 第 2.10 節）：計時預設關閉；開啟後可選「寬鬆（時間加倍）」（計時關閉時停用、縮排成子選項，第 2 輪看圖驗收）；剩 1 分鐘與時間到的螢幕閱讀器提醒可以關閉。值都存在進度資料庫的 settings
// （timerEnabled 會同步鏡像到 localStorage，lib/progress/settings-mirror.ts），納入備份。
// 設定值一掛載就讀，讀到才經 usePageReady 回報（維護者 2026-10-26：設定頁整頁一次出現，開關不會先畫成停用、讀到後才切到真正的狀態）。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { Switch } from '@ledgerland/web-ui';
import { readTimerSettings } from '../features/me/progress-reads.ts';
import { DEFAULT_TIMER_SETTINGS, TIMER_ANNOUNCE_SETTING, TIMER_ENABLED_SETTING, TIMER_RELAXED_SETTING, type TimerSettings } from '../features/quiz/timer.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { nowIso } from '../lib/progress/app-info.ts';
import { getProgressStore } from '../lib/progress/index.ts';

export function TimerSetting() {
  const { t } = useLingui();
  const [value, setValue] = useState<TimerSettings | null>(null);
  useEffect(() => {
    let alive = true;
    getProgressStore()
      .then(readTimerSettings)
      .then(
        (v) => alive && setValue(v),
        () => alive && setValue(DEFAULT_TIMER_SETTINGS),
      );
    return () => {
      alive = false;
    };
  }, []);
  usePageReady(value !== null);
  const write = (key: string, v: boolean) => {
    void getProgressStore()
      .then((s) => s.setSetting(key, v, nowIso()))
      .catch(() => {});
  };
  const current = value ?? DEFAULT_TIMER_SETTINGS;
  return (
    <div className="ll-settings" data-testid="timer-setting">
      <h2 className="ll-settings__title">
        <Trans id="settings.timer.title" comment="設定頁計時區的標題">
          計時
        </Trans>
      </h2>
      <Switch
        checked={current.enabled}
        disabled={value === null}
        label={t({ id: 'settings.timer.enabled', message: '作答時計時', comment: '計時開關的標籤' })}
        description={t({
          id: 'settings.timer.enabledDesc',
          message: '預設關閉。開啟後作答頁顯示剩餘時間，隨時可以暫停；時間到不會送出，也不影響星星。',
          comment: '計時開關的說明',
        })}
        onChange={(v) => {
          setValue({ ...current, enabled: v });
          write(TIMER_ENABLED_SETTING, v);
        }}
      />
      <Switch
        checked={current.relaxed}
        disabled={value === null || !current.enabled}
        className="ll-settings__sub"
        label={t({ id: 'settings.timer.relaxed', message: '寬鬆（時間加倍）', comment: '計時寬鬆選項的標籤' })}
        description={t({
          id: 'settings.timer.relaxedDesc',
          message: '每一關的時間上限變成兩倍。開啟作答時計時後才有作用。',
          comment: '計時寬鬆選項的說明（計時關閉時這個開關停用）',
        })}
        onChange={(v) => {
          setValue({ ...current, relaxed: v });
          write(TIMER_RELAXED_SETTING, v);
        }}
      />
      <Switch
        checked={current.announce}
        disabled={value === null}
        label={t({ id: 'settings.timer.announce', message: '剩 1 分鐘與時間到時提醒', comment: '計時的螢幕閱讀器提醒開關的標籤（03 第 2.10 節）' })}
        description={t({
          id: 'settings.timer.announceDesc',
          message: '螢幕閱讀器在剩 1 分鐘與時間到時各唸一次提醒。關閉後倒數照常顯示，只是不唸出來。',
          comment: '計時提醒開關的說明',
        })}
        onChange={(v) => {
          setValue({ ...current, announce: v });
          write(TIMER_ANNOUNCE_SETTING, v);
        }}
      />
    </div>
  );
}
