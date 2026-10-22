// 語言切換提示（05 第 8.3 節）：網址決定的語言和已存偏好或瀏覽器語言不同時，顯示一次可關閉的小提示，用目標語言寫；每個工作階段最多一次。
// 目標語言的文字固定在這裡（不從目標語言的 catalog 取，避免為了一句提示多載入一份 catalog；兩種語言都只有一句）。
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { getLocale, isLocale, matchLocaleOrNull, switchLocalePath, type Locale } from '@ledgerland/i18n';
import { readPref, writePref } from '../lib/prefs.ts';
import { useLocale } from '../lib/useLocale.ts';

const KEY = 'll:locale-suggest-shown';
const TEXT: Record<Locale, { text: string; action: string; close: string }> = {
  en: { text: 'Prefer English?', action: 'Switch', close: 'Dismiss' },
  'zh-TW': { text: '要改看中文嗎？', action: '切換', close: '關閉' },
};

export function LocaleSuggest() {
  const current = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const [target, setTarget] = useState<Locale | null>(null);
  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY) === '1') return;
    } catch {
      /* 忽略 */
    }
    const pref = readPref('ll:locale');
    const preferred = pref && isLocale(pref) ? pref : matchLocaleOrNull(navigator.languages ?? []);
    if (preferred && preferred !== current) setTarget(preferred);
  }, [current]);
  if (!target) return null;
  const dismiss = () => {
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {
      /* 忽略 */
    }
    setTarget(null);
  };
  const go = () => {
    writePref('ll:locale', target);
    dismiss();
    navigate(switchLocalePath(target, location.pathname, location.search, location.hash), { replace: true, preventScrollReset: true });
  };
  const t = TEXT[target];
  return (
    <div className="ll-banner ll-locale-suggest" role="status" lang={getLocale(target).htmlLang}>
      <span>{t.text}</span>
      <button type="button" className="ll-btn" onClick={go}>
        {t.action}
      </button>
      <button type="button" className="ll-btn" onClick={dismiss} aria-label={t.close}>
        ✕
      </button>
    </div>
  );
}
