// zh-TW 的兩份 catalog（web-ui 的元件字串與 apps/web 的頁面與殼層字串，05 第 3.1 節）由同一個模組靜態引入，lingui.ts 只動態載入這一個模組，
// 建置後兩份合成一個 chunk：每一頁第一次繪製前少一個請求（06 第 8.2 節，2026-10-24 實測）。殼層依路徑預先載入的表也用這個模組（src/shell/route-preload.json）
export { messages as ui } from '@ledgerland/web-ui/locales/zh-TW/messages.po';
export { messages as app } from '../locales/zh-TW/messages.po';
