// 作答頁與錯題複習頁首窄的時候的語言選單（QuizLangSwitch 的窄版，LevelSession.tsx）。web-ui 的 Menu 在 overlay chunk（地圖的「更多」與關卡面板也用），
// 這個模組由 QuizLangSwitch 在第一次繪製送出後才動態載入，之前先畫外觀相同的按鈕：作答頁第一波不必為了這顆按鈕多載 overlay（M3 收尾 QA，2026-10-26，06 第 8.2 節）。
// 字串都由 QuizLangSwitch 傳進來，這裡不另外定義訊息
import { LOCALES, type Locale } from '@ledgerland/i18n';
import { CheckIcon, MenuButton, MenuItem, TranslateIcon } from '@ledgerland/web-ui';

export interface QuizLangMenuProps {
  /** 按鈕的可讀名稱（「切換語言」） */
  label: string;
  current: Locale;
  /** 目前語言那一項後面的視覺隱藏補充（「（目前）」） */
  currentNote: string;
  onSelect: (locale: Locale) => void;
  /** 載入前就按了暫代的按鈕：一掛上就打開 */
  defaultOpen: boolean;
  className: string;
}

export function QuizLangMenu({ label, current, currentNote, onSelect, defaultOpen, className }: QuizLangMenuProps) {
  return (
    <MenuButton className={className} icon={<TranslateIcon />} label={label} defaultOpen={defaultOpen} data-testid="quiz-lang-menu">
      {LOCALES.map((l) => (
        <MenuItem key={l.code} lang={l.htmlLang} icon={l.code === current ? <CheckIcon /> : undefined} onClick={() => onSelect(l.code)}>
          {l.nativeName}
          {l.code === current && <span className="ll-sr-only">{currentNote}</span>}
        </MenuItem>
      ))}
    </MenuButton>
  );
}
