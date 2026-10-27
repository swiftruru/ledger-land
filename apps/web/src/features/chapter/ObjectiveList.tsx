// 章節頁的學習目標（站規 2.3）：一張卡片裡的編號清單，每條前面 24px 圓形編號（surface-2 底）。不用灰勾：勾會被讀成「已完成」。
// 編號是裝飾（aria-hidden），順序由 <ol> 本身提供。文字照全站規則換行（07 第 3.5 節）。
import type { MapObjective } from '../quest-map/data.ts';

export function ObjectiveList({ objectives, labelledBy }: { objectives: readonly MapObjective[]; labelledBy: string }) {
  return (
    <ol className="ch-objectives" aria-labelledby={labelledBy} data-testid="chapter-objectives">
      {objectives.map((o, i) => (
        <li key={o.id} className="ch-objectives__item">
          <span className="ch-objectives__no ll-num" aria-hidden="true">
            {i + 1}
          </span>
          <span className="ch-objectives__text">{o.statement}</span>
        </li>
      ))}
    </ol>
  );
}
