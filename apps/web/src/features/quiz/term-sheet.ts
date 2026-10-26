// 名詞卡元件的動態載入點（terms.tsx 的 loadTermSheet）：只轉出 web-ui 的 TermSheet。不要在 terms.tsx 直接 import('@ledgerland/web-ui')：
// 那會把整個 web-ui 入口當成動態進入點，所有元件都綁進同一個 chunk。
export { TermSheet } from '@ledgerland/web-ui';
