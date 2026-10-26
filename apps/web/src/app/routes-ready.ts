// 還沒有路由的頁面旗標（站規 2.2.6）：實驗室故事步驟 /lab/story/<story>/<step>/ 要到 M4a 才有路由，現在只有 /lab/ 的占位頁，
// 連過去會落到 404。為 false 時章節頁與地圖紙籤都不顯示實驗室連結；M4a 加上故事步驟路由時改成 true。E2E 檢查所有站內連結不是 404。
export const LAB_STEP_ROUTE_READY = false;
