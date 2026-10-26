// 「我的 › 徽章」（站規 2.11，寬版；02 的頁面總表 /me/badges/，noindex）：TopBar 返回「我的」，摘要卡與徽章格在 BadgesSection
import { useLingui } from '@lingui/react/macro';
import { localePath } from '@ledgerland/i18n';
import { TopBar } from '@ledgerland/web-ui';
import BadgesSection from '../features/badges/BadgesSection.tsx';
import { useLocale } from '../lib/useLocale.ts';

export default function Badges() {
  const { t } = useLingui();
  const locale = useLocale();
  return (
    <>
      <TopBar
        title={t({ id: 'badges.title', message: '徽章', comment: '徽章頁的標題' })}
        backHref={localePath(locale, '/me/')}
        backLabel={t({ id: 'me.back', message: '回到我的', comment: '子頁返回「我的」的可讀名稱（必須包含短字「我的」）' })}
        backShortLabel={t({ id: 'me.back.short', message: '我的', comment: '子頁返回「我的」在畫面上的短字' })}
      />
      <BadgesSection locale={locale} />
    </>
  );
}
