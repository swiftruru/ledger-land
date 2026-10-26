// 五個頂層頁（首頁、闖關、實驗室、圖鑑、我的）共用的頁首（站規 1.5）：三欄 grid，中間 h1，左右各放最多三個
// StatChip、IconButton（chrome）或 sm 分段控制。切換 Tab 時頁首結構不跳動。只有闖關頁是 sticky（地圖的 HUD 是它的一個實例）。
import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: ReactNode;
  titleId?: string;
  /** 左欄 */
  start?: ReactNode;
  /** 右欄 */
  end?: ReactNode;
  /** 小螢幕的精簡高度（56px，標題 title-3）；預設 64px、標題 title-2 */
  compact?: boolean;
  /** 固定在頂端（只有闖關頁用） */
  sticky?: boolean;
  /** 標題只給螢幕閱讀器（闖關頁寬度小於 340 時，地圖規格 4.8）；其他頁不要用 */
  titleHiddenNarrow?: boolean;
  className?: string;
}

export function PageHeader({ title, titleId, start, end, compact, sticky, titleHiddenNarrow, className }: PageHeaderProps) {
  const cls = ['ll-pagehead', compact && 'll-pagehead--compact', sticky && 'll-pagehead--sticky', titleHiddenNarrow && 'll-pagehead--narrow-hide', className]
    .filter(Boolean)
    .join(' ');
  return (
    <header className={cls}>
      <div className="ll-pagehead__inner">
        <div className="ll-pagehead__start">{start}</div>
        <h1 id={titleId} className="ll-pagehead__title" tabIndex={-1}>
          {title}
        </h1>
        <div className="ll-pagehead__end">{end}</div>
      </div>
    </header>
  );
}
