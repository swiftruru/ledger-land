// 視窗是否到了 wide 斷點（packages/tokens 的 breakpoints.wide，1440 起）：三表並排時每張表才放得下「交易前、交易後、本筆變動」三欄（02 第 3.4 節）；
// 1024 到 1439 三表並排但每張只有一欄（累計或本筆變動，和手機一樣切換）。和 features/me/useExpanded.ts 同一個寫法。
import { useSyncExternalStore } from 'react';
import { breakpoints } from '@ledgerland/tokens';

const QUERY = `(min-width: ${breakpoints.wide}px)`;

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function snapshot(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;
}

export function useWide(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
