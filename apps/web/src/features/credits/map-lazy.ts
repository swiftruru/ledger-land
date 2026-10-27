// 幕後頁要用的兩個地圖元件（鈴、特別徽章圖）的延後載入進入點。
// 不直接寫 import('@ledgerland/web-ui/map')：首頁、找不到頁面等首次載入的程式靜態匯入了地圖進入點的圖示，動態匯入整個進入點會讓 rolldown
// 把整個地圖進入點（LevelNode、LevelSheet、MapHud 等）併進首次載入的 chunk（2026-10-27 量到 /en/ 入口多 9 KB gzip）；和 components/level-code-lazy.ts 同一個做法：
// 這個小模組只重新匯出要用的元件，由 useMapModule 動態匯入它，模組本身落在地圖的 quest-map chunk 旁的 shared chunk，不進第一波。
export { MapMarker, SpecialBadge } from '@ledgerland/web-ui/map';
