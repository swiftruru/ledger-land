// 視窗是否到了寬版斷點（packages/tokens 的 breakpoints.expanded，1024 起；和 me.css 的 @media 同一個值）。
// 「我的」的「關於」群組只渲染一份，依這個值放在左欄或右欄（第 2 輪看圖驗收：DOM 裡有兩份時，選第二列的 E2E 與截圖會選到隱藏的那份）。
// 這個 App 沒有伺服器端繪製；matchMedia 是同步的，第一次繪製就是正確的位置。
import { useSyncExternalStore } from 'react';
import { breakpoints } from '@ledgerland/tokens';

const QUERY = `(min-width: ${breakpoints.expanded}px)`;

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function snapshot(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;
}

export function useExpanded(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
