// 玩家統計的 hook：統計要讀進度資料庫、章節索引與名詞索引（還會連帶載入地圖的 chunk），所以用 import() 另切一個 chunk，但一掛載就開始讀
// （維護者 2026-10-26：資料齊了整頁才出現，不再等第一次繪製；進度資料庫從 main.tsx 起就在開了）。null 代表還在讀，頁面把它算進 usePageReady 的條件；
// 讀不到時給全部是 0 的統計，不擋畫面。
import { useEffect, useState } from 'react';
import type { Locale } from '@ledgerland/i18n';
import type { PlayerStats } from './player-stats.ts';

export const EMPTY_STATS: PlayerStats = { stars: 0, badges: { earned: 0, total: 0, chapterTotal: 0, list: [] }, terms: null, lastExportedAt: null };

export function usePlayerStats(locale: Locale): PlayerStats | null {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  useEffect(() => {
    let alive = true;
    setStats(null);
    import('./player-stats.ts')
      .then((m) => m.loadPlayerStats(locale))
      .then(
        (v) => alive && setStats(v),
        () => alive && setStats(EMPTY_STATS),
      );
    return () => {
      alive = false;
    };
  }, [locale]);
  return stats;
}
