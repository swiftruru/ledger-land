// 章節牌（17 第 3.5 節）：每章路線起點的卡片，標題是 h2（章節區段的 aria-labelledby 指向它），按下到章節頁。
// 延伸章加「延伸，不列入期中考」的標籤；徽章未取得時是灰階外框。
import { useLingui } from '@lingui/react/macro';
import { Badge } from './Badge.tsx';
import { MedalIcon } from './map-icons.tsx';

export interface ChapterBannerProps {
  chapterId: string;
  chapterNo: number;
  title: string;
  done: number;
  total: number;
  extension?: boolean;
  badgeTitle?: string;
  badgeUnlocked?: boolean;
  href: string;
  onNavigate: (href: string) => void;
  headingId: string;
  className?: string;
}

export function useChapterLabels() {
  const { t } = useLingui();
  return {
    chapter: (n: number) => t({ id: 'map.chapter.no', message: `第 ${n} 章`, comment: '章節牌的章序；n 是章序' }),
    extChapter: (n: number) => t({ id: 'map.chapter.extNo', message: `延伸第 ${n} 章`, comment: '延伸章節牌的章序；n 是章序' }),
    progress: (done: number, total: number) =>
      t({ id: 'map.chapter.progress', message: `本章 ${done}/${total} 關`, comment: '章節牌的完成進度；done 已完成、total 總關數' }),
    extensionTag: t({ id: 'map.chapter.extensionTag', message: '延伸，不列入期中考', comment: '延伸章的標籤' }),
    badgeLocked: (name: string) => t({ id: 'map.chapter.badgeLocked', message: `徽章「${name}」尚未取得`, comment: '徽章未取得時的可讀名稱；name 是徽章名稱' }),
    badgeUnlocked: (name: string) =>
      t({ id: 'map.chapter.badgeUnlocked', message: `已取得徽章「${name}」`, comment: '徽章已取得時的可讀名稱；name 是徽章名稱' }),
  };
}

export function ChapterBanner({
  chapterNo,
  title,
  done,
  total,
  extension,
  badgeTitle,
  badgeUnlocked,
  href,
  onNavigate,
  headingId,
  className,
}: ChapterBannerProps) {
  const labels = useChapterLabels();
  return (
    <header className={`ll-chbanner${extension ? ' ll-chbanner--ext' : ''}${className ? ` ${className}` : ''}`}>
      <div className="ll-chbanner__text">
        <p className="ll-chbanner__eyebrow">{extension ? labels.extChapter(chapterNo) : labels.chapter(chapterNo)}</p>
        <h2 id={headingId} className="ll-chbanner__title">
          <a
            href={href}
            onClick={(e) => {
              e.preventDefault();
              onNavigate(href);
            }}
          >
            {title}
          </a>
        </h2>
        <p className="ll-chbanner__progress ll-num">{labels.progress(done, total)}</p>
        {extension && <Badge kind="info">{labels.extensionTag}</Badge>}
      </div>
      {badgeTitle && (
        <div
          className={`ll-chbanner__badge${badgeUnlocked ? ' is-on' : ''}`}
          role="img"
          aria-label={badgeUnlocked ? labels.badgeUnlocked(badgeTitle) : labels.badgeLocked(badgeTitle)}
        >
          <MedalIcon size={28} />
          <span className="ll-chbanner__badge-name" aria-hidden="true">
            {badgeTitle}
          </span>
        </div>
      )}
    </header>
  );
}
