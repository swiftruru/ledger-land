// 語言切換開關（05 第 8 節）：兩種語言時是分段式切換，選項用自己的語言寫並設定 lang；以 replace 導到另一種語言的同一頁，寫入偏好；
// 作答狀態在路由外的 store，不受影響。
import { useLingui } from '@lingui/react/macro';
import { useLocation, useNavigate } from 'react-router';
import { LOCALES, switchLocalePath, type Locale } from '@ledgerland/i18n';
import { Segmented } from '@ledgerland/web-ui';
import { writePref } from '../lib/prefs.ts';
import { useLocale } from '../lib/useLocale.ts';

/** 換到另一種語言的同一頁（replace、不重設捲動位置）並記住偏好。LangSwitch 與作答頁窄版的語言選單（QuizLangSwitch）共用 */
export function useSwitchLocale(): (to: Locale) => void {
  const current = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  return (to: Locale) => {
    if (to === current) return;
    writePref('ll:locale', to);
    void navigate(switchLocalePath(to, location.pathname, location.search, location.hash), { replace: true, preventScrollReset: true });
  };
}

/** size：頁首（首頁的 PageHeader、作答頁的 TopBar）用 sm，和返回鈕同高；設定頁用預設的 md */
export function LangSwitch({ size = 'md' }: { size?: 'sm' | 'md' } = {}) {
  const { t } = useLingui();
  const current = useLocale();
  const go = useSwitchLocale();
  return (
    <Segmented
      value={current}
      label={t({ id: 'lang.label', message: '語言' })}
      onChange={go}
      options={LOCALES.map((l) => ({ value: l.code, label: l.shortLabel, lang: l.htmlLang, ariaLabel: l.nativeName }))}
      size={size}
      className="ll-lang"
    />
  );
}
