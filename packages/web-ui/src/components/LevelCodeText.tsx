// 關卡代號的文字與佔位（07 第 9 節、06 第 4.7 節）：代號的格式（去掉 lv_、4 個一組）、標題、可讀名稱與「複製」的字串只寫在這裡，
// 地圖 chunk 裡的 LevelCode 與殼層的 Safari 分頁提示共用。LevelCodePlaceholder 是 LevelCode 從地圖 chunk 載入前的佔位：
// 同樣的 class 與內容，「複製」的位置先放同尺寸的骨架膠囊，載入後換成完整元件時版面不會動（不讓題目與「確認答案」被往下推）。
// 這個檔案從主入口匯出，會進殼層的 chunk，不要在這裡 import 地圖的元件或圖示。
import { useLingui } from '@lingui/react/macro';

export function levelCodeOf(levelId: string): string {
  return levelId.replace(/^lv_/, '');
}

export function formatLevelCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)} ${code.slice(4)}` : code;
}

export function useLevelCodeText() {
  const { t } = useLingui();
  return {
    label: t({ id: 'map.code.label', message: '關卡代號', comment: '關卡介紹表單裡代號的欄位標題' }),
    a11y: (code: string) => t({ id: 'map.code.a11y', message: `關卡代號 ${code}`, comment: '代號的可讀名稱；code 是 8 碼代號' }),
    copy: t({ id: 'map.code.copy', message: '複製', comment: '複製關卡代號的按鈕' }),
  };
}

export function canCopyLevelCode(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.clipboard;
}

export interface LevelCodePlaceholderProps {
  levelId: string;
  className?: string;
}

export function LevelCodePlaceholder({ levelId, className }: LevelCodePlaceholderProps) {
  const text = useLevelCodeText();
  const code = levelCodeOf(levelId);
  return (
    <div className={`ll-levelcode${className ? ` ${className}` : ''}`} data-testid="level-code-placeholder">
      <span className="ll-levelcode__label">{text.label}</span>
      <code className="ll-levelcode__code ll-num" aria-label={text.a11y(code)}>
        {formatLevelCode(code)}
      </code>
      {canCopyLevelCode() && (
        // 載入模組失敗時的同尺寸占位（站規 3.2）：不是按鈕，是 44px 高的空膠囊（沒有骨架樣式，整頁布幕通常讓它根本不會被看到）；
        // 裡面放看不見的圖示槽與「複製」，寬度就和載入後的 Button quiet sm 一樣
        <span className="ll-levelcode__slot" aria-hidden="true">
          <span className="ll-levelcode__icon-slot" />
          {text.copy}
        </span>
      )}
    </div>
  );
}
