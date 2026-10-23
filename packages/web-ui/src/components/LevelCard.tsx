// 關卡列（07 第 9 節的 LevelCard、17 第 3.7 節）：清單檢視與章節頁共用，每關一列：編號、名稱、星星、按鈕。
// 狀態一律有文字（目前、尚未挑戰、已下架），顏色只是輔助。
import { useLingui } from '@lingui/react/macro';
import { Badge } from './Badge.tsx';
import type { LevelNodeStatus } from './LevelNode.tsx';
import { Stars } from './Stars.tsx';

export interface LevelCardProps {
  levelId: string;
  chapterNo: number;
  levelNo: number;
  title?: string;
  stars: 0 | 1 | 2 | 3;
  status: LevelNodeStatus;
  extension?: boolean;
  /** 已下架（進度有、內容沒有）：沒有按鈕，只列出 */
  retired?: boolean;
  href?: string;
  onNavigate?: (href: string) => void;
  /** 「介紹」按鈕（地圖的清單檢視開關卡表單；章節頁可省略） */
  onInfo?: (levelId: string, el: HTMLButtonElement) => void;
  className?: string;
}

export function LevelCard({ levelId, chapterNo, levelNo, title, stars, status, extension, retired, href, onNavigate, onInfo, className }: LevelCardProps) {
  const { t } = useLingui();
  const c = chapterNo;
  const l = levelNo;
  const no = `${c}-${l}`;
  const name = title ?? t({ id: 'map.card.untitled', message: `第 ${levelNo} 關`, comment: '關卡名稱還沒載入時的代稱；levelNo 是關序' });
  return (
    <li
      className={`ll-levelcard${retired ? ' ll-levelcard--retired' : ''}${status === 'current' ? ' is-current' : ''}${className ? ` ${className}` : ''}`}
      data-level-id={levelId}
    >
      <span className="ll-levelcard__no ll-num" aria-hidden="true">
        {no}
      </span>
      <div className="ll-levelcard__main">
        <p className="ll-levelcard__title">
          <span className="ll-sr-only">
            {extension
              ? t({ id: 'map.node.extHead', message: `延伸第 ${c} 章第 ${l} 關 ${name}`, comment: '延伸章節點的可讀名稱開頭；c 章序、l 關序、name 關卡名稱' })
              : t({ id: 'map.node.head', message: `第 ${c} 章第 ${l} 關 ${name}`, comment: '節點的可讀名稱開頭；c 章序、l 關序、name 關卡名稱' })}
          </span>
          <span aria-hidden="true">{name}</span>
        </p>
        <p className="ll-levelcard__meta">
          {retired ? (
            <Badge>{t({ id: 'map.card.retired', message: '已下架', comment: '已下架關卡的狀態標籤' })}</Badge>
          ) : stars > 0 ? (
            <Stars value={stars} size={16} />
          ) : (
            <span className="ll-levelcard__none">{t({ id: 'map.node.todo', message: '尚未挑戰', comment: '尚未挑戰關卡的狀態字' })}</span>
          )}
          {status === 'current' && !retired && (
            <Badge kind="accent">{t({ id: 'map.node.current', message: '建議下一關', comment: '目前建議關卡的狀態字' })}</Badge>
          )}
        </p>
      </div>
      {!retired && (
        <div className="ll-levelcard__actions">
          {onInfo && (
            <button type="button" className="ll-btn ll-btn--small" onClick={(e) => onInfo(levelId, e.currentTarget)}>
              {t({ id: 'map.card.info', message: '介紹', comment: '清單檢視裡開啟關卡介紹的按鈕' })}
            </button>
          )}
          {href && (
            <a
              className="ll-btn ll-btn--small ll-btn--primary"
              href={href}
              onClick={(e) => {
                if (!onNavigate) return;
                e.preventDefault();
                onNavigate(href);
              }}
            >
              {stars > 0
                ? t({ id: 'map.sheet.retry', message: '再挑戰', comment: '已挑戰過的關卡的主要按鈕' })
                : t({ id: 'map.sheet.start', message: '開始', comment: '還沒挑戰過的關卡的主要按鈕' })}
            </a>
          )}
        </div>
      )}
    </li>
  );
}
