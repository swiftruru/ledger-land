// <link rel="manifest"> 在第一次繪製送出後才插入（M3 收尾 QA，2026-10-26；vite.config.ts 的 ll-defer-manifest-link 從 index.html 拿掉建置時插入的那一個）。
// Chrome 看到 manifest 連結就會在 load 前後抓 manifest 與它的 192px 圖示做安裝條件的檢查，本機 Lighthouse 的模擬（HTTP/1.1、6 條連線）把這兩個請求
// 算進每一頁 LCP 前、和頁面內容搶第一波的頻寬；它們不影響第一次繪製，和 Service Worker 的註冊一樣延後（Root.tsx）。Chrome 與 Safari 都會處理之後才加進來的
// manifest 連結（安裝提示與「加入主畫面」在那之後才用得到）。開發模式沒有 manifest（vite-plugin-pwa 的 devOptions 關閉），不插入
import { site } from '../../site.config.ts';

export function attachManifestLink(): void {
  if (!import.meta.env.PROD || typeof document === 'undefined') return;
  if (document.querySelector('link[rel="manifest"]')) return;
  const link = document.createElement('link');
  link.rel = 'manifest';
  link.href = `${site.base}${site.manifestFile}`;
  document.head.appendChild(link);
}
