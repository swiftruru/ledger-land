// 章節頁的主卡（站規 2.3）：場景縮圖、眉標（延伸章前面一個 E1 六角形徽記）、主線章的「期中考範圍」、摘要、進度條與星星、徽章預覽、
// 主按鈕（開始、繼續或再挑戰）、「在地圖上看這一章」（帶地圖圖示的次要按鈕，整頁只有這一處），最下方一行說明。
// 「延伸」只出現在眉標與說明行；「不列入期中考」只在說明行說一次（站規 0.4 第 2 列）。進度和章節快照一起到（useQuestMap），這裡拿到的 stats 一定是確定的值，
// 沒有骨架、不先畫「開始」再換成「繼續」（維護者 2026-10-26）。
import { Trans, useLingui } from '@lingui/react/macro';
import { formatNumber, localePath, type Locale } from '@ledgerland/i18n';
import { Button, Card, InfoIcon, PlayIcon, ProgressBar, RetryIcon, StarIcon } from '@ledgerland/web-ui';
import { ChapterBadge, MapIcon, NoteTag, useLevelNumber } from '@ledgerland/web-ui/map';
import type { LevelMeta, MapChapter } from '../quest-map/data.ts';
import { ChapterThumb } from './ChapterThumb.tsx';
import { chapterAction, splitBadgeTitle, thumbKindFor, type ChapterStats } from './model.ts';

export interface ChapterHeroProps {
  locale: Locale;
  chapter: MapChapter;
  stats: ChapterStats;
  metas: ReadonlyMap<string, LevelMeta>;
  /** 章節的固定聲明含「非投資建議」 */
  notAdvice: boolean;
  /** 「在地圖上看這一章」：/play/?chapter=<id> */
  mapHref: string;
  /** 場景縮圖畫出來了（頁面的布幕條件之一） */
  onThumbReady?: () => void;
}

/** 延伸章的六角形徽記（和地圖的延伸節點同造型），20px，純裝飾 */
function ExtMark({ text }: { text: string }) {
  return (
    <svg className="ch-extmark" width="20" height="22" viewBox="0 0 20 22" aria-hidden="true" focusable="false">
      <path className="ch-extmark__hex" d="M10 1.2 L18.4 6 V16 L10 20.8 L1.6 16 V6 Z" />
      <text className="ch-extmark__text" x="10" y="14.6" textAnchor="middle">
        {text}
      </text>
    </svg>
  );
}

/** 徽章預覽的句子：徽章名（連同引號）包成 inline-block，放得下時整個換到下一行，不在名字中間斷開；
 *  比一整行還長（文字放大）時才在自己的框裡換行，不會超出卡片（model.ts 的 splitBadgeTitle）。
 *  名字前後的句子照全站規則換行（07 第 3.5 節） */
function BadgeSentence({ text, name }: { text: string; name: string }) {
  const parts = splitBadgeTitle(text, name);
  if (!parts) return <>{text}</>;
  return (
    <>
      {parts.before}
      <span className="ch-hero__badge-title">{parts.title}</span>
      {parts.after}
    </>
  );
}

export function ChapterHero({ locale, chapter, stats, metas, notAdvice, mapHref, onThumbReady }: ChapterHeroProps) {
  const { t } = useLingui();
  // 關卡編號和地圖、關卡列同一個來源（延伸章是 E1-1，闖關地圖規格 4.1）
  const code = useLevelNumber();
  const n = chapter.chapterNo;
  const eyebrow = chapter.extension
    ? t({ id: 'chapter.eyebrow.ext', message: `延伸第 ${n} 章`, comment: '章節頁主卡的眉標（延伸章）；n 是延伸區的章序' })
    : t({ id: 'chapter.eyebrow', message: `第 ${n} 章`, comment: '章節頁主卡的眉標（主線章）；n 是章序' });
  const fmt = (v: number) => formatNumber(v, locale);

  const action = chapterAction(chapter, stats);
  const actionCode = action ? code(chapter.chapterNo, action.level.levelNo, chapter.extension) : '';
  const actionTitle = action ? metas.get(action.level.id)?.title : undefined;
  const actionText = !action
    ? ''
    : action.kind === 'start'
      ? t({ id: 'chapter.action.start', message: `開始 ${actionCode}`, comment: '章節主卡的主按鈕：還沒開始這一章；actionCode 是關卡編號（1-1 或 E1-1）' })
      : action.kind === 'continue'
        ? t({
            id: 'chapter.action.continue',
            message: `繼續 ${actionCode}`,
            comment: '章節主卡的主按鈕：這一章做到一半，前往下一個還沒完成的關卡；actionCode 是關卡編號',
          })
        : t({
            id: 'chapter.action.replay',
            message: `再挑戰 ${actionCode}`,
            comment: '章節主卡的按鈕：這一章全部完成，從第一關再玩一次；actionCode 是關卡編號',
          });
  // 可讀名稱包含畫面上的字（WCAG 2.5.3），再加上關卡名稱
  const actionLabel = actionTitle
    ? t({
        id: 'chapter.action.label',
        message: `${actionText}：${actionTitle}`,
        comment: '章節主卡主按鈕的可讀名稱；actionText 是按鈕上的字、actionTitle 是關卡名稱',
      })
    : undefined;

  const done = fmt(stats.done);
  const total = fmt(stats.total);
  const stars = fmt(stats.stars);
  const maxStars = fmt(stats.maxStars);
  const levelsText = t({
    id: 'chapter.progress.levels',
    message: `${done}／${total} 關`,
    comment: '章節主卡進度條旁的完成關數；done 已完成、total 總關數（已依語系格式化）',
  });
  const starsText =
    stats.maxStars > 0
      ? t({
          id: 'chapter.progress.stars',
          message: `${stars}／${maxStars} 顆星`,
          comment: '章節主卡進度條旁的星星數（只算計分關卡）；stars 得到的、maxStars 滿星（已依語系格式化）',
        })
      : '';

  const badgeName = chapter.badgeTitle;
  const badgeText = !badgeName
    ? ''
    : stats.badge === 'mastery'
      ? t({ id: 'chapter.badge.mastery', message: `已取得精通徽章「${badgeName}」`, comment: '章節主卡的徽章預覽：已達精通；badgeName 是徽章名稱' })
      : stats.badge === 'done'
        ? t({ id: 'chapter.badge.done', message: `已取得徽章「${badgeName}」`, comment: '章節主卡的徽章預覽：已取得；badgeName 是徽章名稱' })
        : t({ id: 'chapter.badge.locked', message: `完成本章可獲得「${badgeName}」`, comment: '章節主卡的徽章預覽：還沒取得；badgeName 是徽章名稱' });
  const badgeHint =
    stats.badge === 'done' && stats.maxStars > 0
      ? t({ id: 'chapter.badge.masteryHint', message: '每一關都拿到三顆星，徽章會升級為精通', comment: '章節主卡的徽章預覽：已取得、還沒精通時的提示' })
      : '';

  // 每一行說明帶 data-testid（E2E 沿用改版前的 chapter-extension、exam-scope-note）
  const notes: { text: string; testId: string }[] = [];
  if (chapter.extension)
    notes.push({
      text: t({
        id: 'chapter.note.extension',
        message: '延伸區：不列入期中考，想多學再來。',
        comment: '延伸章主卡最下方的說明（整頁只在這裡說「不列入期中考」）',
      }),
      testId: 'chapter-extension',
    });
  else if (chapter.notInExam)
    notes.push({
      text: t({ id: 'chapter.note.notInExam', message: '這一章不列入期中考。', comment: '主線章但不列入期中考時，主卡最下方的說明' }),
      testId: 'chapter-not-in-exam',
    });
  else if (chapter.inExam)
    notes.push({
      text: t({ id: 'chapter.note.examScope', message: '期中考範圍以老師公告為準。', comment: '期中考範圍的主線章，主卡最下方的說明（T32）' }),
      testId: 'exam-scope-note',
    });
  if (notAdvice)
    notes.push({
      text: t({
        id: 'chapter.note.notAdvice',
        message: '教學用途，不構成投資建議。',
        comment: '涉及投資（本益比、融資、估價）的延伸章，主卡最下方的聲明（11 第 1 節）',
      }),
      testId: 'chapter-not-advice',
    });

  return (
    <Card as="section" className="ch-hero" aria-label={eyebrow} data-testid="chapter-hero">
      <ChapterThumb kind={thumbKindFor(chapter.chapterNo, chapter.extension)} className="ch-hero__thumb" onReady={onThumbReady} />
      <div className="ch-hero__body">
        <p className="ch-hero__eyebrow">
          {chapter.extension && (
            <ExtMark
              text={t({ id: 'chapter.extMark', message: `E${n}`, comment: '延伸章眉標前面六角形徽記裡的字（E 是 Extension，n 是章序），兩種語言相同' })}
            />
          )}
          <span>{eyebrow}</span>
          {chapter.inExam && !chapter.notInExam && <NoteTag kind="midterm" className="ch-hero__tag" />}
        </p>
        {chapter.summary && <p className="ch-hero__summary">{chapter.summary}</p>}

        {chapter.levels.length > 0 && (
          <div className="ch-hero__progress" data-testid="chapter-progress">
            <ProgressBar value={stats.done} max={chapter.levels.length} size="sm" className="ch-hero__bar" />
            <p className="ch-hero__stats ll-num">
              <span>{levelsText}</span>
              {starsText && (
                <span className="ch-hero__stars">
                  <StarIcon filled className="ch-hero__star" />
                  {starsText}
                </span>
              )}
            </p>
          </div>
        )}

        {badgeName && (
          <div className={`ch-hero__badge ch-hero__badge--${stats.badge}`} data-testid="chapter-badge" data-badge-state={stats.badge}>
            <ChapterBadge state={stats.badge} size={40} className="ch-hero__badge-art" />
            <div className="ch-hero__badge-text">
              <p className="ch-hero__badge-name">
                <BadgeSentence text={badgeText} name={badgeName} />
              </p>
              {badgeHint && <p className="ch-hero__badge-hint">{badgeHint}</p>}
            </div>
          </div>
        )}

        <div className="ch-hero__actions">
          {chapter.levels.length > 0 && action && (
            <Button
              variant={action.kind === 'replay' ? 'secondary' : 'primary'}
              size="md"
              block
              icon={action.kind === 'replay' ? <RetryIcon /> : <PlayIcon />}
              href={localePath(locale, `/level/${action.level.id}/`)}
              aria-label={actionLabel}
              data-testid="chapter-start"
            >
              {actionText}
            </Button>
          )}
          <Button variant="secondary" size="md" block icon={<MapIcon />} href={mapHref} data-testid="chapter-on-map">
            <Trans id="chapter.onMap" comment="章節頁回到地圖並捲到該章的連結">
              在地圖上看這一章
            </Trans>
          </Button>
        </div>

        {notes.length > 0 && (
          <ul className="ch-hero__notes" data-testid="chapter-notes">
            {notes.map(({ text, testId }) => (
              <li key={testId} data-testid={testId}>
                <InfoIcon className="ch-hero__note-icon" />
                <span className="ch-hero__note-text">{text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
