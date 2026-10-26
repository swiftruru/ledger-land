// 首頁與「我的」的「今天要複習 N 題」（03 第 2.10 節）：本地日期、一次最多 10 題。
// 進度資料庫從 main.tsx 起就和頁面一起開啟（維護者 2026-10-26：每一頁都要資料齊了才一次出現），所以這裡直接讀，不再等第一次繪製；
// null 代表還在讀，頁面把它算進 usePageReady 的條件。讀不到時是 0（畫面照樣要出來）。
import { useEffect, useState } from 'react';
import { REVIEW_DAILY_LIMIT } from '@ledgerland/quiz';
import type { ProgressStore } from '@ledgerland/progress';
import { todayLocal } from '../../lib/progress/app-info.ts';
import { getProgressStore } from '../../lib/progress/index.ts';

/** 今天到期的題數（最多 REVIEW_DAILY_LIMIT）；store 可注入給測試 */
export async function countDueReviews(store: Pick<ProgressStore, 'listDueReviews'>, today: string = todayLocal()): Promise<number> {
  return (await store.listDueReviews(today, REVIEW_DAILY_LIMIT)).length;
}

export function useDueCount(): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    getProgressStore()
      .then((s) => countDueReviews(s))
      .then(
        (n) => alive && setCount(n),
        () => alive && setCount(0),
      );
    return () => {
      alive = false;
    };
  }, []);
  return count;
}
