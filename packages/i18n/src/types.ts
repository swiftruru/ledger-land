// 語系登錄檔的型別（05 第 2.1 節）。純 TypeScript。
export type LocaleStatus = 'complete' | 'beta';
/** day：天數；times：倍數（權益倍數、流動比率等）；turns：週轉次數（資產週轉率等，04 第 12.4 節的「次」） */
export type UnitKey = 'day' | 'times' | 'turns';

export interface UnitPattern {
  /** 依 Intl.PluralRules 的分類填寫；中文只有 other */
  one?: string;
  other: string;
}

export interface CompactRule {
  minAbs: number;
  factor: number;
  maxFractionDigits: number;
  /** 一般字串，{n} 由格式化函式代換 */
  pattern: string;
}

export interface LocaleDef {
  /** BCP 47 代號，也是 catalog 資料夾名稱與內容欄位的 key */
  code: string;
  /** 用自己的語言寫的名稱，顯示在選單：繁體中文、English */
  nativeName: string;
  /** 切換開關上的短標籤：中、EN */
  shortLabel: string;
  englishName: string;
  /** 寫入 <html lang> 與元素 lang 的值 */
  htmlLang: string;
  /** 寫入 sitemap 的 xhtml:link 與用戶端 <link rel="alternate" hreflang> 的值 */
  hreflang: string;
  ogLocale: string;
  dir: 'ltr' | 'rtl';
  /** complete：CI 強制無缺字（zh-TW 與 en）；beta：只產生報表，只給日後新增的第三種語言 */
  status: LocaleStatus;
  /** 退回順序，最後一定是基準語系；基準語系本身為空陣列 */
  fallback: readonly string[];
  /** 網址中的語系片段（D5 的 C 案）：null 代表不帶前綴，只有基準語系可以是 null */
  urlSegment: string | null;
  /** 對應 navigator.languages 的前綴，例如 'zh' 會吃到 zh-TW、zh-Hant、zh-HK */
  match: readonly string[];
  /** 傳給 Intl.* 的 locale */
  intlLocale: string;
  dateStyle: 'long' | 'medium';
  /** 已決定（2026-10-21）：中英介面的金額都顯示 NT$ */
  money: { mode: 'currency'; symbol: 'NT$' };
  /** 「萬元 / million」的級距，由大到小排列（05 第 10.4 節） */
  compact: readonly CompactRule[];
  units: Record<UnitKey, UnitPattern>;
}
