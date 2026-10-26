// 讀進度裡的 unlock（名詞與徽章）：一掛載就開進度資料庫（main.tsx 已讓資料庫和頁面一起開始開啟；維護者 2026-10-26：每一頁資料齊了才一次出現，
// 不再等第一次繪製之後才讀），讀不到時當作沒有任何解鎖。頁面把回傳值是不是 null 算進 usePageReady 的條件。
import { useEffect, useState } from 'react';
import type { Unlock } from '@ledgerland/progress';
import { getProgressStore } from '../../lib/progress/index.ts';

/** 指定種類的 unlock：id 對 unlockedAt；null 代表還在讀（取不到進度時是空的 Map，不會一直是 null）。
 *  prepare 在讀之前先做（例如「我的 › 徽章」先補寫還沒寫進進度的章節徽章）；失敗也照樣讀。prepare 要是穩定的參照（模組層級的函式或 useCallback） */
export function useUnlocks(kind: Unlock['kind'], prepare?: () => Promise<unknown>): Map<string, string> | null {
  const [value, setValue] = useState<Map<string, string> | null>(null);
  useEffect(() => {
    let alive = true;
    (prepare ? prepare().catch(() => undefined) : Promise.resolve())
      .then(() => getProgressStore())
      .then((s) => s.listUnlocks(kind))
      .then(
        (list) => alive && setValue(new Map(list.map((u) => [u.id, u.unlockedAt]))),
        () => alive && setValue(new Map()),
      );
    return () => {
      alive = false;
    };
  }, [kind, prepare]);
  return value;
}
