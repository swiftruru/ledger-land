// 「我的 › 設定」（站規 2.9）：TopBar 返回「我的」；卡片依序是語言、外觀（分段控制與風味圓點，16 第 7 節）、計時、保護進度；
// 最後一組選單列「更多」放安裝教學。卡片小標統一 footnote 600（.ll-settings__title）。
// 整頁一次出現（維護者 2026-10-26）：計時的設定值由 TimerSetting 自己回報 usePageReady；保護進度那一張的「已開啟」要等 navigator.storage.persisted()
// 問過一次（ProtectProgress 只讀 status.persisted），所以這裡先問一次、問完才回報，按鈕不會在頁面出現後才變成停用。外觀卡只讀 localStorage，同步就齊了。
import { useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { localePath } from '@ledgerland/i18n';
import { Card, DeviceIcon, NavList, NavRow, TopBar } from '@ledgerland/web-ui';
import { AppearanceSetting } from '../components/AppearanceSetting.tsx';
import { LangSwitch } from '../components/LangSwitch.tsx';
import { ProtectProgress } from '../components/ProtectProgress.tsx';
import { TimerSetting } from '../components/TimerSetting.tsx';
import { Phrased } from '../features/me/Phrased.tsx';
import { usePageReady } from '../lib/page-ready.tsx';
import { refreshPersisted } from '../lib/progress/persist.ts';
import { useLocale } from '../lib/useLocale.ts';
import '../styles/me.css';

export default function Settings() {
  const { t } = useLingui();
  const locale = useLocale();
  const [persistChecked, setPersistChecked] = useState(false);
  useEffect(() => {
    let alive = true;
    void refreshPersisted().finally(() => alive && setPersistChecked(true));
    return () => {
      alive = false;
    };
  }, []);
  usePageReady(persistChecked);
  return (
    <div className="ll-settings-page">
      <TopBar
        title={t({ id: 'settings.title', message: '設定' })}
        backHref={localePath(locale, '/me/')}
        backLabel={t({ id: 'me.back', message: '回到我的', comment: '子頁返回「我的」的可讀名稱（必須包含短字「我的」）' })}
        backShortLabel={t({ id: 'me.back.short', message: '我的', comment: '子頁返回「我的」在畫面上的短字' })}
      />
      <Card as="section" aria-labelledby="ll-settings-lang">
        <h2 id="ll-settings-lang" className="ll-settings__title">
          {t({ id: 'lang.label', message: '語言' })}
        </h2>
        <LangSwitch />
      </Card>
      <Card as="section">
        <AppearanceSetting />
      </Card>
      <Card as="section">
        <TimerSetting />
      </Card>
      <Card as="section">
        <ProtectProgress />
      </Card>
      <NavList title={t({ id: 'settings.more', message: '更多', comment: '設定頁最後一組選單列的標題' })}>
        <NavRow
          icon={<DeviceIcon />}
          title={t({ id: 'me.install', message: '安裝教學', comment: '「我的」與設定頁連到安裝教學' })}
          description={<Phrased text={t({ id: 'me.install.desc', message: '把會計樂園加到主畫面', comment: '安裝教學列的說明' })} />}
          href={localePath(locale, '/install/')}
        />
      </NavList>
    </div>
  );
}
