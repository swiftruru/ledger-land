// 幕後頁用到地圖 chunk 裡的兩個圖（吉祥物鈴、徽章）：模組到了才畫，頁面把它算進 usePageReady（和「我的」的徽章橫排同一個做法）。
// undefined 是還在載；載不到時 null（頁面照常出現，只是沒有鈴與徽章圖）。動態匯入的是 map-lazy.ts（只重新匯出兩個元件），不是整個地圖進入點。
import { useEffect, useState } from 'react';

export type MapModule = typeof import('./map-lazy.ts');

export function useMapModule(): MapModule | null | undefined {
  const [mod, setMod] = useState<MapModule | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    import('./map-lazy.ts').then(
      (m) => alive && setMod(m),
      () => alive && setMod(null),
    );
    return () => {
      alive = false;
    };
  }, []);
  return mod;
}
