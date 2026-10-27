// 關卡介紹面板（17 第 3.3 節、站規 1.10 與 1.20）：從節點彈出，結構用共用的 Sheet（原生 dialog、焦點鎖定、Esc、X、點遮罩關閉，
// 開啟時焦點在標題，關閉後焦點回到節點）。頭部是三欄：關卡節點圖示、標題與章名、關閉鈕（第 4 輪看圖驗收；星星只在「最佳成績」），
// 身是學習目標、最佳成績與「給老師：關卡代號」，腳是「章節資訊」（和清單檢視同款的 NavRow，有圖示方塊與箭頭，第 2 輪看圖驗收：
// 置中的 quiet 按鈕靜止時沒有外框，看起來像一段文字連結）與最下方唯一的主按鈕「開始」（primary lg block），間距 12。沒有「關閉」按鈕（右上的 X 就是）。
// 歷史紀錄（返回關閉）由頁面負責；站內連結由父層以 localePath 產生並帶結尾斜線，經 LinkProvider 走站內導覽
// （舊介面的 onNavigate 已沒有人用，第 9 輪移除，和 LevelCard 第 7 輪一樣省地圖 chunk 的體積）。
// 中文的標題、章名與提示依詞換行（地圖的 phrased，全站換行規則；第 9 輪：320 加 200% 的章名斷成「損／益表」），關卡編號整塊不斷（不會排成「3-」換行「1」）。
import { useLingui } from '@lingui/react/macro';
import type { ReactNode, RefObject } from 'react';
import { Button } from './Button.tsx';
import { Disclosure } from './Disclosure.tsx';
import { InfoIcon, PlayIcon, RetryIcon, BookIcon } from './icons.tsx';
import { LevelCode } from './LevelCode.tsx';
import { useLevelNumber, useReadLabels, type LevelNodeStatus } from './LevelNode.tsx';
import { phrased } from './MapPhrase.tsx';
import { NavList, NavRow } from './NavList.tsx';
import { Sheet } from './Sheet.tsx';
import { Stars } from './Stars.tsx';

export interface LevelSheetData {
  levelId: string;
  title: string;
  /** 副標：第 3 章 損益表 */
  subtitle: string;
  /** 頂端節點圖示的編號與外觀（省略時不畫節點圖示） */
  chapterNo?: number;
  levelNo?: number;
  extension?: boolean;
  status?: LevelNodeStatus;
  /** 學習目標 1 到 3 行，照全站規則換行（07 第 3.5 節） */
  objectives: readonly ReactNode[];
  /** 最佳成績；沒挑戰過時省略 */
  best?: { stars: 0 | 1 | 2 | 3; accuracyText: string };
  /** 整關不計分：沒有最佳成績，改顯示閱讀狀態（read 是否已讀完） */
  unscored?: boolean;
  read?: boolean;
  startHref: string;
  chapterHref?: string;
  /** 還沒完成前一關時顯示「建議先完成『○○』，也可以直接開始」（畫面上是第一層引號「」，和章末紙籤的徽章名稱一致；英文是 ‘ ’） */
  suggestedPrevTitle?: string;
  /** 還在載入關卡名稱與目標時為 true */
  loading?: boolean;
}

export interface LevelSheetProps {
  open: boolean;
  onClose: () => void;
  level: LevelSheetData | null;
  /** 關閉後要把焦點還給的元素（開啟它的節點） */
  returnFocusTo?: RefObject<HTMLElement | null>;
  /** 「給老師：關卡代號」展開列裡代號下方的額外內容（apps/web 放給老師的關卡 QR） */
  teacherExtra?: ReactNode;
}

const phrasedSpan = (text: string) => <span className="ll-phrased">{phrased(text)}</span>;

export function LevelSheet({ open, onClose, level, returnFocusTo, teacherExtra }: LevelSheetProps) {
  const { t } = useLingui();
  const readLabels = useReadLabels();
  const number = useLevelNumber();
  const played = level?.unscored ? level.read === true : !!level?.best;
  const status: LevelNodeStatus = level?.status ?? (played ? 'done' : 'todo');
  // 標題列：關卡圓章在左欄，標題與章名在右欄（第 4 輪看圖驗收：圓章、星星、標題、章名由上往下疊成四列，左邊一條窄柱、右邊一大片空白；
  // 星星又在「最佳成績」再出現一次）。星星只留在「最佳成績」那一行
  const lead =
    level && level.chapterNo !== undefined && level.levelNo !== undefined ? (
      <span className={`ll-levelsheet__node ll-levelsheet__node--${status}${level.extension ? ' ll-levelsheet__node--ext' : ''}`} aria-hidden="true">
        <span className="ll-num ll-keep">{number(level.chapterNo, level.levelNo, level.extension)}</span>
      </span>
    ) : undefined;
  const startLabel = !played
    ? t({ id: 'map.sheet.start', message: '開始', comment: '還沒挑戰過的關卡的主要按鈕' })
    : level?.unscored
      ? readLabels.reread
      : t({ id: 'map.sheet.retry', message: '再挑戰', comment: '已挑戰過的關卡的主要按鈕' });
  const startIcon = !played ? <PlayIcon /> : level?.unscored ? <BookIcon /> : <RetryIcon />;
  return (
    <Sheet
      open={open && !!level}
      onClose={onClose}
      className="ll-sheet--level"
      data-testid="level-sheet"
      returnFocusTo={returnFocusTo}
      lead={lead}
      title={
        level ? (level.loading ? t({ id: 'map.sheet.loading', message: '載入關卡中', comment: '關卡介紹還在載入時的標題' }) : phrasedSpan(level.title)) : ''
      }
      subtitle={level && phrasedSpan(level.subtitle)}
      footer={
        level ? (
          <>
            {level.chapterHref && (
              <NavList
                className="ll-levelsheet__chapter"
                aria-label={t({ id: 'map.sheet.chapterNav', message: '所屬章節', comment: '關卡介紹面板腳部「章節資訊」列的群組可讀名稱' })}
              >
                <NavRow
                  size="compact"
                  icon={<InfoIcon />}
                  title={t({ id: 'map.sheet.chapterInfo', message: '章節資訊', comment: '到章節頁的次要按鈕' })}
                  href={level.chapterHref}
                />
              </NavList>
            )}
            <Button variant="primary" size="lg" block icon={startIcon} href={level.startHref} data-testid="level-sheet-start">
              {startLabel}
            </Button>
          </>
        ) : undefined
      }
    >
      {level && (
        <>
          {level.suggestedPrevTitle && (
            // 依詞換行（地圖的 phrased）：375 原本斷成「也可以直／接開始」；引號裡的關卡名稱整塊不斷，「也可以直接開始」整句一起換行
            <p className="ll-levelsheet__suggest ll-phrased">
              {phrased(
                t({
                  id: 'map.sheet.suggestPrev',
                  message: `建議先完成「${level.suggestedPrevTitle}」，也可以直接開始`,
                  comment: '還沒完成前一關時的提示；title 是前一關的名稱',
                }),
              )}
            </p>
          )}
          {level.objectives.length > 0 && (
            <section className="ll-levelsheet__section">
              <h3 className="ll-levelsheet__h">{t({ id: 'map.sheet.objectives', message: '學習目標', comment: '關卡介紹表單的學習目標段落標題' })}</h3>
              <ul className="ll-levelsheet__objectives">
                {level.objectives.slice(0, 3).map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </section>
          )}
          <section className="ll-levelsheet__section">
            <h3 className="ll-levelsheet__h">
              {level.unscored ? readLabels.heading : t({ id: 'map.sheet.best', message: '最佳成績', comment: '關卡介紹表單的最佳成績段落標題' })}
            </h3>
            {level.unscored ? (
              <p className={level.read ? 'll-levelsheet__value' : 'll-levelsheet__value ll-muted'} data-testid="sheet-read-state">
                {level.read ? readLabels.read : readLabels.unread}
              </p>
            ) : level.best ? (
              <p className="ll-levelsheet__best">
                <Stars value={level.best.stars} size={16} />
                <span className="ll-num">{level.best.accuracyText}</span>
              </p>
            ) : (
              <p className="ll-levelsheet__value ll-muted">{t({ id: 'map.sheet.notPlayed', message: '還沒挑戰過', comment: '還沒挑戰過這一關時的文字' })}</p>
            )}
          </section>
          <Disclosure
            variant="plain"
            summary={t({
              id: 'map.sheet.teacherCode',
              message: '給老師：關卡代號',
              comment: '關卡介紹面板裡收起關卡代號的展開列標題（老師在課堂上請學生輸入代號）',
            })}
            className="ll-levelsheet__code"
          >
            <LevelCode levelId={level.levelId} />
            {/* 給老師的一句說明（維護者 2026-10-26：老師問代號怎麼用，寫在代號旁邊最找得到） */}
            <p className="ll-levelsheet__hint ll-muted">
              {t({
                id: 'map.sheet.teacherCodeHint',
                message:
                  '把代號寫在黑板上，學生在闖關地圖按「輸入關卡代號」就會直接到這一關；或按「顯示 QR」做成 QR 放在投影片上給學生掃。大小寫、空白與連字號都可以省略。',
                comment: '關卡介紹面板「給老師：關卡代號」展開列裡的說明',
              })}
            </p>
            {teacherExtra}
          </Disclosure>
        </>
      )}
    </Sheet>
  );
}
