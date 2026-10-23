// 首頁「今天要複習 N 題」用的 hook（03 第 2.10 節）：本地日期、一次最多 10 題。首頁本身在另一階段接上。
import { useEffect, useState } from 'react';
import { REVIEW_DAILY_LIMIT } from '@ledgerland/quiz';
import { afterFirstPaint } from '../../lib/idle.ts';
import { todayLocal } from '../../lib/progress/app-info.ts';
import { getProgressStore } from '../../lib/progress/index.ts';

export function useDueCount(): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    // 首頁的 LCP 是歡迎卡片，不等這個數字；進度資料庫在第一次繪製送出之後才開（main.tsx 同一個時機，見 idle.ts）
    const cancel = afterFirstPaint(() => {
      getProgressStore()
        .then((s) => s.listDueReviews(todayLocal(), REVIEW_DAILY_LIMIT))
        .then(
          (list) => alive && setCount(list.length),
          () => alive && setCount(0),
        );
    });
    return () => {
      alive = false;
      cancel();
    };
  }, []);
  return count;
}
