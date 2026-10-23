// 關卡節點（17 第 3.1 節）：<ol> 裡的 <li><button>，可讀名稱含章、關、名稱、星星與狀態；目前關卡 aria-current="step"；延伸章是圓角六邊形。
// 位置由頁面以 style 指定（座標樣板在 apps/web），這裡只畫節點本身。
import { useLingui } from '@lingui/react/macro';
import type { CSSProperties, Ref } from 'react';
import { Stars } from './Stars.tsx';

export type LevelNodeStatus = 'done' | 'current' | 'todo';

export interface LevelNodeProps {
  levelId: string;
  chapterNo: number;
  levelNo: number;
  /** 關卡名稱；還沒載入時省略，可讀名稱只念章與關 */
  title?: string;
  stars: 0 | 1 | 2 | 3;
  status: LevelNodeStatus;
  extension?: boolean;
  onSelect: (levelId: string, el: HTMLButtonElement) => void;
  style?: CSSProperties;
  className?: string;
  buttonRef?: Ref<HTMLButtonElement>;
}

/** 節點的可讀名稱（17 第 3.1 節的表） */
export function useLevelNodeName() {
  const { t } = useLingui();
  return (p: Pick<LevelNodeProps, 'chapterNo' | 'levelNo' | 'title' | 'stars' | 'status' | 'extension'>): string => {
    const c = p.chapterNo;
    const l = p.levelNo;
    const name = p.title ?? '';
    const head = p.extension
      ? t({ id: 'map.node.extHead', message: `延伸第 ${c} 章第 ${l} 關 ${name}`, comment: '延伸章節點的可讀名稱開頭；c 章序、l 關序、name 關卡名稱' })
      : t({ id: 'map.node.head', message: `第 ${c} 章第 ${l} 關 ${name}`, comment: '節點的可讀名稱開頭；c 章序、l 關序、name 關卡名稱' });
    const n = p.stars;
    const max = 3;
    const starText = n > 0 ? t({ id: 'stars.label', message: `${max} 顆星中的 ${n} 顆`, comment: '星星的可讀名稱；n 是得到的顆數、max 是滿星數' }) : '';
    const parts = [head.trim()];
    if (starText) parts.push(starText);
    if (p.status === 'current') parts.push(t({ id: 'map.node.current', message: '建議下一關', comment: '目前建議關卡的狀態字' }));
    else if (p.status === 'todo') parts.push(t({ id: 'map.node.todo', message: '尚未挑戰', comment: '尚未挑戰關卡的狀態字' }));
    return parts.join('，');
  };
}

export function LevelNode({ levelId, chapterNo, levelNo, title, stars, status, extension, onSelect, style, className, buttonRef }: LevelNodeProps) {
  const name = useLevelNodeName();
  const cls = `ll-node ll-node--${status}${extension ? ' ll-node--ext' : ''}${className ? ` ${className}` : ''}`;
  return (
    <li className={cls} style={style} data-level-id={levelId}>
      <button
        ref={buttonRef}
        type="button"
        className="ll-node__btn"
        aria-label={name({ chapterNo, levelNo, title, stars, status, extension })}
        aria-current={status === 'current' ? 'step' : undefined}
        onClick={(e) => onSelect(levelId, e.currentTarget)}
      >
        <span className="ll-node__disc" aria-hidden="true">
          <span className="ll-node__no ll-num">
            {chapterNo}-{levelNo}
          </span>
        </span>
        <Stars value={stars} size={14} className="ll-node__stars" />
      </button>
    </li>
  );
}
