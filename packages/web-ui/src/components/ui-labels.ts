// web-ui 共用的短字串（站規 7.4 的 ui.*）：元件內部與其他組的 web-ui 元件共用同一個 ID，不各自再寫一份。
// 例如地圖組的 LevelCode 複製成功時用 copied、作答組的骨架用 loading；頁面字串仍放 apps/web 自己的 catalog。
import { useLingui } from '@lingui/react/macro';

export interface UiLabels {
  /** 對話框、面板的關閉（X 的可讀名稱） */
  close: string;
  /** 提示條、Toast 的關閉 */
  dismiss: string;
  /** 「更多」選單按鈕 */
  more: string;
  loading: string;
  retry: string;
  copied: string;
  cancel: string;
  searchClear: string;
  details: string;
  externalSite: string;
}

export function useUiLabels(): UiLabels {
  const { t } = useLingui();
  return {
    close: t({ id: 'ui.close', message: '關閉', comment: '對話框關閉按鈕的可讀名稱' }),
    dismiss: t({ id: 'ui.dismiss', message: '關閉提示', comment: 'Toast 關閉按鈕的可讀名稱' }),
    more: t({ id: 'ui.more', message: '更多', comment: '頁首「更多」選單按鈕的可讀名稱' }),
    loading: t({ id: 'ui.loading', message: '載入中', comment: '內容還在載入時給螢幕閱讀器的文字（整頁布幕的載入圈、延後載入的區塊）' }),
    retry: t({ id: 'ui.retry', message: '再試一次', comment: '錯誤狀態的主要按鈕：重新讀取' }),
    copied: t({ id: 'ui.copied', message: '已複製', comment: '複製成功後按鈕上的短字（兩秒後換回原本的字）' }),
    cancel: t({ id: 'ui.cancel', message: '取消', comment: '確認面板的取消按鈕' }),
    searchClear: t({ id: 'ui.search.clear', message: '清除搜尋', comment: '搜尋框右側清除按鈕的可讀名稱' }),
    details: t({ id: 'ui.details', message: '詳細', comment: '地圖頁提示條右側「前往說明頁」圖示按鈕的可讀名稱' }),
    externalSite: t({ id: 'ui.externalSite', message: '（外部網站，另開分頁）', comment: '連到站外網址的按鈕或連結後面，給螢幕閱讀器的說明（會另開分頁）' }),
  };
}
