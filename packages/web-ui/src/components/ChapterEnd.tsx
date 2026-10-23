// 章末區（17 第 3.5 節）：每章最後一關之後的小拱門與路標；走過時顯示「第 N 章完成」與徽章。
// M2 只有文字與幾何拱門；相關實驗室步驟的小卡在 M5 接上。
import { useLingui } from '@lingui/react/macro';
import { useChapterLabels } from './ChapterBanner.tsx';
import { FlagIcon, MedalIcon } from './map-icons.tsx';

export interface ChapterEndProps {
  chapterNo: number;
  extension?: boolean;
  completed: boolean;
  badgeTitle?: string;
  /** 剛完成時的慶祝狀態（?from 跨章時由頁面短暫設為 true） */
  celebrating?: boolean;
  className?: string;
}

export function ChapterEnd({ chapterNo, extension, completed, badgeTitle, celebrating, className }: ChapterEndProps) {
  const { t } = useLingui();
  const labels = useChapterLabels();
  const chapter = extension ? labels.extChapter(chapterNo) : labels.chapter(chapterNo);
  const text = completed
    ? t({ id: 'map.end.completed', message: `${chapter}完成`, comment: '章末區：本章已完成；chapter 是「第 N 章」' })
    : t({ id: 'map.end.ahead', message: `走完這一章，就到${chapter}的終點`, comment: '章末區：本章尚未完成；chapter 是「第 N 章」' });
  return (
    <div
      className={`ll-chend${completed ? ' is-done' : ''}${celebrating ? ' is-celebrating' : ''}${className ? ` ${className}` : ''}`}
      data-testid="chapter-end"
    >
      <svg className="ll-chend__arch" viewBox="0 0 120 64" aria-hidden="true" focusable="false">
        <path d="M14 64V30a46 46 0 0 1 92 0v34" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <path d="M26 64V32a34 34 0 0 1 68 0v32" fill="var(--ll-surface)" stroke="none" />
      </svg>
      <p className="ll-chend__text">
        {completed ? <MedalIcon size={18} /> : <FlagIcon size={18} />}
        <span>{text}</span>
      </p>
      {badgeTitle && (
        <p className="ll-chend__badge">
          {completed
            ? t({ id: 'map.end.badgeGot', message: `徽章：${badgeTitle}`, comment: '章末區已取得的徽章；badgeTitle 是徽章名稱' })
            : t({ id: 'map.end.badgeAhead', message: `可獲得徽章「${badgeTitle}」`, comment: '章末區尚未取得的徽章；badgeTitle 是徽章名稱' })}
        </p>
      )}
    </div>
  );
}
