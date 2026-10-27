// 章節牌（圖規第 4.4 節、站規 1.20）：立在地景上的告示牌（卡片下方兩根 6 × 16 的木柱，柱腳各有一片地面陰影），每章路線起點旁、入口走廊的另一側。
// 第一列是眉標「第 3 章」或「延伸第 1 章」與本章進度；第二列是 h2 章名連結（章節區段的 aria-labelledby 指向它），最多 3 行、不截字；
// 主線而且屬於期中考範圍的章再放「期中考範圍」標籤（T32）。延伸章不放標籤（眉標已經說明，「不列入期中考」只在海峽說明卡說一次）。
// 徽章不在這裡：走完這一章才拿得到，放在章末紙籤（ChapterEnd）。位置由頁面以 style 指定（left、bottom、width，幾何在 apps/web 的 layout.ts）。
import { useLingui } from '@lingui/react/macro';
import type { CSSProperties } from 'react';
import { CaretRightIcon } from './icons.tsx';
import { UiLink } from './link-context.tsx';
import { phrased } from './MapPhrase.tsx';
import { NoteTag } from './NoteTag.tsx';

export interface ChapterBannerProps {
  chapterId: string;
  chapterNo: number;
  title: string;
  done: number;
  total: number;
  extension?: boolean;
  /** 期中考範圍（主線章節的 examScope 為 midterm，T32）：標「期中考範圍」；延伸章不標 */
  inExam?: boolean;
  /** 章節頁（父層以 localePath 產生、帶結尾斜線）；經 LinkProvider 走站內導覽 */
  href: string;
  headingId: string;
  /** 窄螢幕（compact）：進度用短版字串 */
  compact?: boolean;
  style?: CSSProperties;
  className?: string;
}

export function useChapterLabels() {
  const { t } = useLingui();
  return {
    chapter: (n: number) => t({ id: 'map.chapter.no', message: `第 ${n} 章`, comment: '章節牌的章序；n 是章序' }),
    extChapter: (n: number) => t({ id: 'map.chapter.extNo', message: `延伸第 ${n} 章`, comment: '延伸章節牌的章序；n 是章序' }),
    progress: (done: number, total: number) =>
      t({ id: 'map.chapter.progress', message: `本章 ${done}/${total} 關`, comment: '章節牌的完成進度；done 已完成、total 總關數' }),
    /** 窄螢幕（compact）的短版：中文同長版，英文只寫「0/3 levels」，文字放大時也放得下一行 */
    progressShort: (done: number, total: number) =>
      t({
        id: 'map.chapter.countShort',
        message: `本章 ${done}/${total} 關`,
        comment: '窄螢幕的章節牌與清單用的短版進度；done 已完成、total 總關數；英文寫成 0/3 levels（不加 in this chapter）',
      }),
    badgeLocked: (name: string) => t({ id: 'map.chapter.badgeLocked', message: `徽章「${name}」尚未取得`, comment: '徽章未取得時的可讀名稱；name 是徽章名稱' }),
    badgeUnlocked: (name: string) =>
      t({ id: 'map.chapter.badgeUnlocked', message: `已取得徽章「${name}」`, comment: '徽章已取得時的可讀名稱；name 是徽章名稱' }),
    badgeMastery: (name: string) =>
      t({ id: 'map.chapter.badgeMastery', message: `已取得精通徽章「${name}」`, comment: '徽章達到精通（每關三星）時的可讀名稱；name 是徽章名稱' }),
    extensionNote: t({ id: 'play.extensionGap', message: '延伸區：不列入期中考，想多學再來', comment: '主線與延伸區之間的分隔文字' }),
    examScopeNote: t({
      id: 'map.examScopeNote',
      message: '期中考範圍以老師公告為準。',
      comment: '章節頁、清單檢視與延伸區分隔的說明：網站標的期中考範圍只是參考，學生以老師的公告為準（T32）',
    }),
  };
}

/**
 * 章名的結尾和箭頭綁在一起，箭頭不會自己掉到下一行：英文是最後一個單字；中文是最後兩個字（四個字以上的章名），
 * 換行時第二行至少兩個字，不會只剩「帳 ›」一個孤字（第 2 輪看圖驗收的 200%：中文章名整串沒有斷點時只能斷在箭頭前）。
 * 前面的部分照全站規則逐字換行；結尾放進 phrased 的最後一個子句裡（第 7 輪看圖驗收：放得進一行的子句整段換行，子句是 inline-block）
 */
function splitTail(title: string): [string, string] {
  const t = title.trimEnd();
  const space = t.lastIndexOf(' ');
  if (space > 0 && /[A-Za-z0-9]$/.test(t)) return [t.slice(0, space + 1), t.slice(space + 1)];
  const chars = Array.from(t);
  const n = chars.length >= 4 && !/\s/.test(chars[chars.length - 2]!) ? 2 : 1;
  return [chars.slice(0, -n).join(''), chars.slice(-n).join('')];
}

export function ChapterBanner({ chapterNo, title, done, total, extension, inExam, href, headingId, compact, style, className }: ChapterBannerProps) {
  const labels = useChapterLabels();
  const [head, tail] = splitTail(title);
  return (
    <header className={`ll-chbanner${extension ? ' ll-chbanner--ext' : ''}${className ? ` ${className}` : ''}`} style={style}>
      <div className="ll-chbanner__top">
        <p className="ll-chbanner__eyebrow">{extension ? labels.extChapter(chapterNo) : labels.chapter(chapterNo)}</p>
        <p className="ll-chbanner__progress ll-num">{compact ? labels.progressShort(done, total) : labels.progress(done, total)}</p>
      </div>
      <h2 id={headingId} className="ll-chbanner__title">
        <UiLink href={href} className="ll-chbanner__link">
          <span className="ll-chbanner__name ll-phrased">
            {phrased(
              head,
              <span key="tail" className="ll-chbanner__tail">
                {tail}
                <CaretRightIcon size={16} className="ll-chbanner__caret" />
              </span>,
            )}
          </span>
        </UiLink>
      </h2>
      {inExam && !extension && (
        <div className="ll-chbanner__tags">
          <NoteTag kind="midterm" />
        </div>
      )}
      {/* 兩根立柱與地面陰影（裝飾） */}
      <span className="ll-chbanner__legs" aria-hidden="true">
        <span className="ll-chbanner__leg" />
        <span className="ll-chbanner__leg" />
      </span>
    </header>
  );
}
