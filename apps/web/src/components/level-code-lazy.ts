// SafariTabNotice 延後載入的關卡代號元件：這個模組只轉匯出 LevelCode，動態匯入它就只會切出 LevelCode 本身。
// 不直接寫 import('@ledgerland/web-ui/map')：首頁、找不到頁面等首次載入的程式會靜態匯入地圖進入點的圖示，
// 這時對整個進入點的動態匯入沒有效果，地圖進入點的全部元件都會被拉進首次載入的 chunk（2026-10-25 實測多 15 KB gzip）。
export { LevelCode } from '@ledgerland/web-ui/map';
