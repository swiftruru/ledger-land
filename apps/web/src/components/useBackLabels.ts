// 子頁返回鍵的字（站規 2.0 的返回目的地表、1.4）：畫面上的短字與可讀名稱，可讀名稱一定包含短字（WCAG 2.5.3）。
// 「我的」底下的子頁（安裝教學、隱私說明、關於與授權、關於系統設計，以及設定、備份、徽章）回到 /me/；診斷資訊回到 /about/。
import { useLingui } from '@lingui/react/macro';

export interface BackLabels {
  /** 畫面上的短字 */
  short: string;
  /** 可讀名稱 */
  label: string;
}

export function useBackToMe(): BackLabels {
  const { t } = useLingui();
  return {
    short: t({ id: 'me.back.short', message: '我的', comment: '子頁頂部返回鍵上的短字（回到「我的」）' }),
    label: t({ id: 'me.back', message: '回到我的', comment: '子頁頂部返回鍵的可讀名稱' }),
  };
}

export function useBackToAbout(): BackLabels {
  const { t } = useLingui();
  return {
    short: t({ id: 'about.back.short', message: '關於', comment: '診斷資訊頁頂部返回鍵上的短字（回到「關於與授權」）' }),
    label: t({ id: 'about.back', message: '回到關於與授權', comment: '診斷資訊頁頂部返回鍵的可讀名稱' }),
  };
}
