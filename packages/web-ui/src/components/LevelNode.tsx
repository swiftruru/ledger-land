// 關卡節點（17 第 3.1 節、圖規第 4.1、4.2 節、站規 0.4 的 A1）：<ol> 裡的 <li><button>，可讀名稱含章、關、名稱、星星與狀態；目前關卡 aria-current="step"。
// <li> 是 64 × 64，圓盤 56px 置中（上緣 4、下緣 60），立體底邊畫在 60 到 64 之間（和按鈕同一組 --ll-btn-depth），按下時圓盤沉 4px、底邊歸零。
// 星星籤（60 × 22，圓心下方 36 到 58）是按鈕的子元素：點它等於點節點。延伸章是圓角六邊形，編號寫成 E1-1。
// 不計分關卡（unscored）沒有星等：星星籤改成「已讀完」或「尚未讀」。位置由頁面以 style 指定（幾何在 apps/web 的 layout.ts），這裡只畫節點本身。
import { useLingui } from '@lingui/react/macro';
import { useState, type CSSProperties, type Ref } from 'react';
import { StarIcon } from './icons.tsx';

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
  /** 整關不計分：不顯示星等，改顯示已讀完或尚未讀 */
  unscored?: boolean;
  /** 不計分關卡是否已讀完；省略時以 status 為 done 判斷。全部完成時目前關卡是最後一次挑戰的關卡，status 是 current 但已讀完，要由頁面傳入 */
  read?: boolean;
  onSelect: (levelId: string, el: HTMLButtonElement) => void;
  style?: CSSProperties;
  className?: string;
  buttonRef?: Ref<HTMLButtonElement>;
}

/** 不計分關卡的狀態字：已讀完、尚未讀 */
export function useReadLabels() {
  const { t } = useLingui();
  return {
    read: t({ id: 'map.node.read', message: '已讀完', comment: '不計分關卡（全是取捨題）已完成時的狀態字；放在 60px 寬的星星籤裡，英文要短' }),
    unread: t({ id: 'map.node.unread', message: '尚未讀', comment: '不計分關卡還沒看過時的狀態字；放在 60px 寬的星星籤裡，英文要短' }),
    reread: t({ id: 'map.sheet.reread', message: '再讀一次', comment: '已讀完的不計分關卡的主要按鈕' }),
    heading: t({ id: 'map.sheet.readState', message: '閱讀狀態', comment: '關卡介紹表單裡不計分關卡取代最佳成績的段落標題' }),
  };
}

/** 畫面上的關卡編號：主線 3-2，延伸章 E1-1（圖規第 4.1 節） */
export function useLevelNumber() {
  const { t } = useLingui();
  return (chapterNo: number, levelNo: number, extension?: boolean): string => {
    const c = chapterNo;
    const l = levelNo;
    return extension
      ? t({ id: 'map.node.extNo', message: `E${c}-${l}`, comment: '延伸章節點與關卡列的編號：E 是 Extension（延伸），c 章序、l 關序；兩個語言都寫成 E1-1' })
      : `${c}-${l}`;
  };
}

/** 節點的可讀名稱（17 第 3.1 節的表） */
export function useLevelNodeName() {
  const { t } = useLingui();
  const readLabels = useReadLabels();
  return (p: Pick<LevelNodeProps, 'chapterNo' | 'levelNo' | 'title' | 'stars' | 'status' | 'extension' | 'unscored' | 'read'>): string => {
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
    if (p.unscored) parts.push((p.read ?? p.status === 'done') ? readLabels.read : readLabels.unread);
    else if (starText) parts.push(starText);
    if (p.status === 'current') parts.push(t({ id: 'map.node.current', message: '建議下一關', comment: '目前建議關卡的狀態字' }));
    else if (p.status === 'todo' && !p.unscored) parts.push(t({ id: 'map.node.todo', message: '尚未挑戰', comment: '尚未挑戰關卡的狀態字' }));
    return parts.join('，');
  };
}

export function LevelNode({
  levelId,
  chapterNo,
  levelNo,
  title,
  stars,
  status,
  extension,
  unscored,
  read,
  onSelect,
  style,
  className,
  buttonRef,
}: LevelNodeProps) {
  const name = useLevelNodeName();
  const readLabels = useReadLabels();
  const number = useLevelNumber();
  const isRead = read ?? status === 'done';
  // 點下去的回饋（維護者 2026-10-26：按下節點要有按鈕的立體感）：click 後播一次「沉下去再彈回」，播完（或減少動態時 animation: none 立刻）清掉
  const [pressed, setPressed] = useState(false);
  const cls = `ll-node ll-node--${status}${extension ? ' ll-node--ext' : ''}${unscored ? ' ll-node--unscored' : ''}${className ? ` ${className}` : ''}`;
  return (
    <li className={pressed ? `${cls} is-pressed` : cls} style={style} data-level-id={levelId}>
      <button
        ref={buttonRef}
        type="button"
        className="ll-node__btn"
        aria-label={name({ chapterNo, levelNo, title, stars, status, extension, unscored, read })}
        aria-current={status === 'current' ? 'step' : undefined}
        onClick={(e) => {
          setPressed(true);
          onSelect(levelId, e.currentTarget);
        }}
      >
        <span className="ll-node__disc" aria-hidden="true" onAnimationEnd={() => setPressed(false)}>
          <span className="ll-node__shape">
            <span className="ll-node__rim" />
            <span className="ll-node__face" />
          </span>
          <span className="ll-node__no ll-num">{number(chapterNo, levelNo, extension)}</span>
        </span>
        <span className={`ll-node__stars${unscored ? ' ll-node__stars--text' : ''}`} aria-hidden="true" data-stars={unscored ? undefined : stars}>
          {unscored ? (
            <span className={`ll-node__read${isRead ? ' is-read' : ''}`}>{isRead ? readLabels.read : readLabels.unread}</span>
          ) : (
            [0, 1, 2].map((i) => <StarIcon key={i} size={16} filled={i < stars} className={i < stars ? 'is-on' : 'is-off'} />)
          )}
        </span>
      </button>
    </li>
  );
}
