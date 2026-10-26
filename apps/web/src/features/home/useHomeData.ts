// 首頁的闖關進度、統計與章節小地圖的程式：一掛載就開始 import()（home-quest.ts 會連帶載入地圖的 chunk；進度資料庫從 main.tsx 起就在開了），
// 兩件事都到齊才回傳（維護者 2026-10-26：點進任何一頁都要直接看到完整的資訊，所以小地圖也要和數字一起出現，不先畫地景底色再補路線）。
// 仍然用動態 import 而不是靜態匯入：首頁在首次載入的 chunk 裡，地圖的幾何與進度的 runtime 不該進首次載入的 JS。
// undefined 代表還在讀；進度讀不到時 quest 是 null、統計是空的；小地圖的 chunk 載不到（離線又沒有快取）時 mini 是 null，卡片只畫地景底色。
import { useEffect, useState } from 'react';
import type { Locale } from '@ledgerland/i18n';
import { EMPTY_STATS } from '../me/usePlayerStats.ts';
import type { HomeData } from './home-quest.ts';

export const loadMiniMap = () => import('./ChapterMiniMap.tsx');
export type MiniMapModule = Awaited<ReturnType<typeof loadMiniMap>>;

export interface HomeState {
  readonly data: HomeData;
  /** 小地圖與它的說明元件（同一個 lazy 模組）；載不到時 null */
  readonly mini: MiniMapModule | null;
}

export function useHomeData(locale: Locale): HomeState | undefined {
  const [value, setValue] = useState<HomeState | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    setValue(undefined);
    const data = import('./home-quest.ts').then((m) => m.loadHomeData(locale)).catch((): HomeData => ({ quest: null, stats: EMPTY_STATS }));
    const mini = loadMiniMap().catch((): MiniMapModule | null => null);
    void Promise.all([data, mini]).then(([d, m]) => alive && setValue({ data: d, mini: m }));
    return () => {
      alive = false;
    };
  }, [locale]);
  return value;
}
