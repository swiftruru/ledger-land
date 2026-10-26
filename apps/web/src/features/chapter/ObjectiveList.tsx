// 章節頁的學習目標（站規 2.3）：一張卡片裡的編號清單，每條前面 24px 圓形編號（surface-2 底）。不用灰勾：勾會被讀成「已完成」。
// 編號是裝飾（aria-hidden），順序由 <ol> 本身提供。目標的斷行用 ChapterProse（不在詞中間斷、最後一行不只剩兩個字）。
import type { MapObjective } from '../quest-map/data.ts';
import { ChapterProse } from './ChapterProse.tsx';

export function ObjectiveList({ objectives, labelledBy }: { objectives: readonly MapObjective[]; labelledBy: string }) {
  return (
    <ol className="ch-objectives" aria-labelledby={labelledBy} data-testid="chapter-objectives">
      {objectives.map((o, i) => (
        <li key={o.id} className="ch-objectives__item">
          <span className="ch-objectives__no ll-num" aria-hidden="true">
            {i + 1}
          </span>
          <span className="ch-objectives__text">
            <ChapterProse text={o.statement} />
          </span>
        </li>
      ))}
    </ol>
  );
}
