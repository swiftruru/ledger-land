// 作答頁第一次繪製之後才要的核心資料（06 第 8.2 節、14 第 5.2 節）：科目表、教材版面（teacher@1）、指標登錄檔三份內建資料，給分錄題的科目選項、
// 版面線的名稱、五步驟的勾稽點與指標的名稱、單位與公式文字用。這個檔案只轉出資料（packages/core/src/data 與 data/*.json），
// vite.config.ts 的 core-data 群組把它們和這個檔案合成一個 chunk（除了殼層入口不依賴其他 chunk，見檔尾）。
// 不要改成 import('@ledgerland/core') 再取資料：那會把整個核心的入口當成動態進入點，連判分、題目 schema 與 zod 一起載
// （2026-10-24 實測分錄、指標計算、交易影響、五步驟開頭的關卡因此多載約 51 KB gzip，LCP 2.6 到 2.9 秒）。
export { defaultAccounts, defaultRatios, teacherLayout } from '@ledgerland/core';
// 刻意從殼層入口（app chunk）轉出一個函式：沒有任何依賴的動態 chunk 需要 rolldown 的 runtime（模組命名空間的輔助函式）時，
// rolldown 會把 runtime 拆成獨立的 chunk，殼層入口每一頁都多一個請求（2026-10-24 實測）；這個 chunk 依賴入口之後，runtime 就留在入口裡。
// 入口一定已經載入，這個 import 不會多任何請求。拿掉之前先建置確認 dist/assets 沒有 rolldown-runtime 開頭的檔案。
export { whenIdle as runtimeAnchor } from '../../lib/idle.ts';
