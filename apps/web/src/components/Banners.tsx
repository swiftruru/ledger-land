// 頂部提示的統整（02 第 6 節的表）：一次只顯示一到兩條，優先順序是儲存層的錯誤提示、Safari 分頁的常駐提示、內建瀏覽器提醒、備份提醒、安裝建議；
// 語言切換提示（LocaleSuggest）與更新提示（UpdatePrompt）另計，仍由 Root 直接掛。挑選規則在 banner-rules.ts（純函式，有單元測試）。
import { useMemo } from 'react';
import { useLocation } from 'react-router';
import { environmentKind } from '../lib/env.ts';
import { useStorageStatus } from '../lib/progress/status.ts';
import { BackupReminder, useBackupReminder } from './BackupReminder.tsx';
import { InAppBrowserBanner } from './InAppBrowserBanner.tsx';
import { InstallPrompt, useInstallPrompt } from './InstallPrompt.tsx';
import { SafariTabNotice } from './SafariTabNotice.tsx';
import { StorageBanners } from './StorageBanners.tsx';
import { pickBannerSlots, type BannerKind } from './banner-rules.ts';

/** 換頁時整組重新掛載（key 是路徑）：各提示在掛載時重讀設定與路由，不必各自追蹤 pathname */
export function Banners() {
  const location = useLocation();
  return <BannersForRoute key={location.pathname} />;
}

function BannersForRoute() {
  const status = useStorageStatus();
  const storageError = status.degraded || status.blocked || status.suspended || status.quotaExceeded || status.writeFailed;
  const environment = useMemo(() => environmentKind(), []);
  const backup = useBackupReminder();
  const install = useInstallPrompt();
  const eligible: BannerKind[] = [];
  if (storageError) eligible.push('storage');
  if (environment === 'safari-tab') eligible.push('safari-tab');
  if (environment === 'in-app-browser') eligible.push('in-app');
  if (backup.due) eligible.push('backup');
  if (install.strategy !== 'none') eligible.push('install');
  const show = pickBannerSlots(eligible);
  return (
    <>
      {show.includes('storage') && <StorageBanners />}
      {show.includes('safari-tab') && <SafariTabNotice />}
      {show.includes('in-app') && <InAppBrowserBanner />}
      {show.includes('backup') && <BackupReminder dismiss={backup.dismiss} />}
      {show.includes('install') && <InstallPrompt strategy={install.strategy} dismiss={install.dismiss} />}
    </>
  );
}
