// 關卡列（07 第 9 節的 LevelCard、17 第 3.7 節、站規 1.20）：清單檢視與章節頁共用，每關一列：編號、名稱、狀態、兩個動作。
// 整列不是連結（裡面有兩個動作）：「介紹」是 IconButton quiet（可讀名稱帶編號與關卡名），右側是 Button sm（最小寬 96、右緣對齊）：
// 只有建議的下一關是 primary「開始」；已完成是 secondary「再挑戰」；其他未挑戰 secondary「開始」；不計分已讀 secondary「再讀一次」。
// 狀態一律有文字（建議下一關、尚未挑戰、已下架；不計分關卡是已讀完、尚未讀），顏色只是輔助。延伸章的編號是 E1-1。
// 版面看卡片自己的寬度（container query）：很窄（< 280，320 寬）時三列（編號、名稱與介紹；狀態；動作鈕自己一列靠右），
// 中等時兩列（名稱與介紹一列、狀態與動作鈕一列，375 寬的章節頁與清單就是這種），寬的時候一列；編號欄依內容加寬（E1-1 不會頂到關名），沒有介紹鈕時名稱跨兩欄。
// 文字放大到卡片內寬不到 12 個字寬（320 與 375 寬加 200%）時，編號改成關名上方的一行眉標，關名、狀態與膠囊都用整張卡的寬度；
// 狀態與「建議下一關」膠囊放不下時先換到下一列，單獨一列還放不下才在裡面換行（第 6 輪看圖驗收：英文 320 寬加 200% 的膠囊伸出卡片）。
// 關名依詞換行（phrased 加 .ll-phrased，全站換行規則）。
import { useLingui } from '@lingui/react/macro';
import { Badge } from './Badge.tsx';
import { Button } from './Button.tsx';
import { IconButton } from './IconButton.tsx';
import { BookIcon, InfoIcon, PlayIcon, RetryIcon } from './icons.tsx';
import { useLevelNumber, useReadLabels, type LevelNodeStatus } from './LevelNode.tsx';
import { phrased } from './MapPhrase.tsx';
import { Stars } from './Stars.tsx';

export interface LevelCardProps {
  levelId: string;
  chapterNo: number;
  levelNo: number;
  title?: string;
  stars: 0 | 1 | 2 | 3;
  status: LevelNodeStatus;
  extension?: boolean;
  /** 整關不計分：不顯示星等，改顯示已讀完或尚未讀 */
  unscored?: boolean;
  /** 不計分關卡是否已讀完；省略時以 status 為 done 判斷（全部完成時目前關卡已讀完，要由頁面傳入） */
  read?: boolean;
  /** 已下架（進度有、內容沒有）：沒有按鈕，只列出 */
  retired?: boolean;
  /** 作答頁（父層以 localePath 產生、帶結尾斜線）；經 LinkProvider 走站內導覽（舊介面的 onNavigate 已沒有人用，第 7 輪移除，省地圖 chunk 的體積） */
  href?: string;
  /** 「介紹」按鈕（地圖的清單檢視開關卡表單；章節頁可省略） */
  onInfo?: (levelId: string, el: HTMLButtonElement) => void;
  /** 動作鈕的外觀：auto（預設）是建議的下一關用 primary；secondary 一律用 secondary，建議下一關的標籤與外框照樣保留
   *  （章節頁的主卡已經有一顆「開始／繼續」primary，一個畫面一顆主按鈕，站規 1.0 原則 5） */
  actionVariant?: 'auto' | 'secondary';
  /** 目前關卡（status 為 current）是否顯示「建議下一關」膠囊（預設顯示）。false 時外框與播放圖示照樣保留，只不畫膠囊：
   *  章節頁裡本章的下一關不是全站的目前關卡（延伸章、還沒輪到的主線章）時，膠囊只留給地圖與首頁指的那一關 */
  suggestedBadge?: boolean;
  className?: string;
}

export function LevelCard({
  levelId,
  chapterNo,
  levelNo,
  title,
  stars,
  status,
  extension,
  unscored,
  read,
  retired,
  href,
  onInfo,
  actionVariant = 'auto',
  suggestedBadge = true,
  className,
}: LevelCardProps) {
  const { t } = useLingui();
  const readLabels = useReadLabels();
  const number = useLevelNumber();
  const done = unscored ? (read ?? status === 'done') : stars > 0;
  const c = chapterNo;
  const l = levelNo;
  const no = number(chapterNo, levelNo, extension);
  const name = title ?? t({ id: 'map.card.untitled', message: `第 ${levelNo} 關`, comment: '關卡名稱還沒載入時的代稱；levelNo 是關序' });
  const suggested = status === 'current' && !retired;
  const actionLabel = !done
    ? t({ id: 'map.sheet.start', message: '開始', comment: '還沒挑戰過的關卡的主要按鈕' })
    : unscored
      ? readLabels.reread
      : t({ id: 'map.sheet.retry', message: '再挑戰', comment: '已挑戰過的關卡的主要按鈕' });
  const actionIcon = !done ? suggested ? <PlayIcon /> : undefined : unscored ? <BookIcon /> : <RetryIcon />;
  return (
    <li
      className={`ll-levelcard${retired ? ' ll-levelcard--retired' : ''}${suggested ? ' is-current' : ''}${unscored ? ' ll-levelcard--unscored' : ''}${className ? ` ${className}` : ''}`}
      data-level-id={levelId}
    >
      <div className="ll-levelcard__grid">
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
            <span aria-hidden="true" className="ll-phrased">
              {phrased(name)}
            </span>
          </p>
          <p className="ll-levelcard__meta">
            {retired ? (
              <Badge>{t({ id: 'map.card.retired', message: '已下架', comment: '已下架關卡的狀態標籤' })}</Badge>
            ) : unscored ? (
              <span className={`ll-levelcard__read${done ? ' is-read' : ''}`}>{done ? readLabels.read : readLabels.unread}</span>
            ) : stars > 0 ? (
              <Stars value={stars} size={16} />
            ) : (
              <span className="ll-levelcard__none">
                {t({
                  id: 'map.card.todo',
                  message: '尚未挑戰',
                  comment: '關卡列上單獨顯示的狀態標籤（英文開頭大寫 Not attempted yet；節點可讀名稱用的是 map.node.todo）',
                })}
              </span>
            )}
            {suggested && suggestedBadge && (
              <Badge kind="accent">
                {t({
                  id: 'map.card.suggested',
                  message: '建議下一關',
                  comment: '關卡列上單獨顯示的「建議下一關」膠囊（英文開頭大寫 Suggested next level；節點可讀名稱用的是 map.node.current）',
                })}
              </Badge>
            )}
          </p>
        </div>
        {!retired && (onInfo || href) && (
          <div className="ll-levelcard__actions">
            {onInfo && (
              <IconButton
                icon={<InfoIcon />}
                label={t({
                  id: 'map.card.infoLabel',
                  message: `介紹：${no} ${name}`,
                  comment: '清單檢視裡開啟關卡介紹的按鈕的可讀名稱；no 是關卡編號（例如 1-1）、name 是關卡名稱',
                })}
                onClick={(e) => onInfo(levelId, e.currentTarget as HTMLButtonElement)}
                className="ll-levelcard__info"
              />
            )}
            {href && (
              <Button
                variant={suggested && actionVariant === 'auto' ? 'primary' : 'secondary'}
                size="sm"
                minWidth="action"
                className="ll-levelcard__go"
                icon={actionIcon}
                href={href}
              >
                {actionLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
