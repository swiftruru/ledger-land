// Tab bar 的唯一設定來源（07 第 6.1 節、02 第 2.1 節、D9）：建置時產生殼層 nav 與殼層在地化腳本，執行期由 tabbar 控制器讀取。
export type TabId = 'home' | 'play' | 'lab' | 'terms' | 'me';

export interface TabDef {
  id: TabId;
  /** 不含語系段、帶結尾斜線的路徑；首頁為空字串 */
  path: string;
  /** 這些路徑前綴也算在這個 Tab 底下（不含語系段；02 第 1.4 節） */
  also: string[];
  label: { 'zh-TW': string; en: string };
  /** Phosphor 圖示名稱（regular 與 fill 兩套） */
  icon: string;
}

export const TABS: TabDef[] = [
  { id: 'home', path: '', also: [], label: { 'zh-TW': '首頁', en: 'Home' }, icon: 'house' },
  { id: 'play', path: 'play/', also: ['level/', 'chapter/', 'review/'], label: { 'zh-TW': '闖關', en: 'Quest' }, icon: 'map-trifold' },
  { id: 'lab', path: 'lab/', also: [], label: { 'zh-TW': '實驗室', en: 'Lab' }, icon: 'flask' },
  { id: 'terms', path: 'terms/', also: [], label: { 'zh-TW': '圖鑑', en: 'Terms' }, icon: 'cards' },
  {
    id: 'me',
    path: 'me/',
    also: ['install/', 'privacy/', 'about/', 'design/', 'credits/', 'debug/'],
    label: { 'zh-TW': '我的', en: 'Me' },
    icon: 'user-circle',
  },
];

export const NAV_LABEL = { 'zh-TW': '主要導覽', en: 'Main' } as const;
export const SKIP_LABEL = { 'zh-TW': '跳到主要內容', en: 'Skip to main content' } as const;
