// 語言切換開關（05 第 8 節）：兩種語言時是分段式切換，選項用自己的語言寫並設定 lang；以 replace 導到另一種語言的同一頁，寫入偏好；
// 作答狀態在路由外的 store，不受影響。
import { useLingui } from '@lingui/react/macro';
import { useLocation, useNavigate } from 'react-router';
import { LOCALES, switchLocalePath, type Locale } from '@ledgerland/i18n';
import { Segmented } from '@ledgerland/web-ui';
import { writePref } from '../lib/prefs.ts';
import { useLocale } from '../lib/useLocale.ts';

export function LangSwitch() {
  const { t } = useLingui();
  const current = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const go = (to: Locale) => {
    if (to === current) return;
    writePref('ll:locale', to);
    navigate(switchLocalePath(to, location.pathname, location.search, location.hash), { replace: true, preventScrollReset: true });
  };
  return (
    <Segmented
      value={current}
      label={t({ id: 'lang.label', message: '語言' })}
      onChange={go}
      options={LOCALES.map((l) => ({ value: l.code, label: l.shortLabel, lang: l.htmlLang, ariaLabel: l.nativeName }))}
      className="ll-lang"
    />
  );
}
