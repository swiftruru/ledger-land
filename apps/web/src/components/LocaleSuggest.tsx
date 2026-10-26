// 語言切換提示（05 第 8.3 節）：網址決定的語言和已存偏好或瀏覽器語言不同時，顯示一次可關閉的小提示，用目標語言寫；每個工作階段最多一次。
// 目標語言的文字固定在這裡（不從目標語言的 catalog 取，避免為了一句提示多載入一份 catalog；兩種語言都只有一句）。
// 要不要顯示由 useLocaleSuggest 在第一次 render 同步判斷；畫不畫由 Banners.tsx 依優先順序決定（banner-rules.ts：語言建議排最後，一次只展開一條）。
// 外觀（站規 2.17）：info 的 Banner，動作 secondary sm「切換」帶 TranslateIcon，右上角 IconButton 關閉（可讀名稱也用目標語言）。
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { getLocale, isLocale, matchLocaleOrNull, switchLocalePath, type Locale } from '@ledgerland/i18n';
import { Banner, Button, TranslateIcon } from '@ledgerland/web-ui';
import { readPref, writePref } from '../lib/prefs.ts';
import { useLocale } from '../lib/useLocale.ts';

const KEY = 'll:locale-suggest-shown';
const TEXT: Record<Locale, { text: string; action: string; close: string }> = {
  en: { text: 'Prefer English?', action: 'Switch', close: 'Dismiss' },
  'zh-TW': { text: '要改看中文嗎？', action: '切換', close: '關閉' },
};

function suggestFor(current: Locale): Locale | null {
  try {
    if (sessionStorage.getItem(KEY) === '1') return null;
  } catch {
    /* 忽略 */
  }
  const pref = readPref('ll:locale');
  const preferred = pref && isLocale(pref) ? pref : matchLocaleOrNull(navigator.languages ?? []);
  return preferred && preferred !== current ? preferred : null;
}

export interface LocaleSuggestState {
  /** 建議切換到的語言；不建議時是 null */
  target: Locale | null;
  dismiss: () => void;
  go: () => void;
}

export function useLocaleSuggest(): LocaleSuggestState {
  const current = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  // 在第一次 render 就決定要不要顯示（同步讀偏好與瀏覽器語言）：若等 effect 再插入，會把下面的內容往下推（CLS）
  const [target, setTarget] = useState<Locale | null>(() => suggestFor(current));
  useEffect(() => {
    setTarget(suggestFor(current));
  }, [current]);
  const dismiss = () => {
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {
      /* 忽略 */
    }
    setTarget(null);
  };
  const go = () => {
    if (!target) return;
    writePref('ll:locale', target);
    dismiss();
    navigate(switchLocalePath(target, location.pathname, location.search, location.hash), { replace: true, preventScrollReset: true });
  };
  return { target, dismiss, go };
}

export function LocaleSuggest({ target, dismiss, go }: LocaleSuggestState & { target: Locale }) {
  const t = TEXT[target];
  return (
    <Banner
      role="status"
      className="ll-locale-banner"
      lang={getLocale(target).htmlLang}
      onDismiss={dismiss}
      dismissLabel={t.close}
      actions={
        <Button size="sm" icon={<TranslateIcon />} onClick={go}>
          {t.action}
        </Button>
      }
    >
      <p>{t.text}</p>
    </Banner>
  );
}
