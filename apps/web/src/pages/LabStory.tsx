// 故事步驟列表 /lab/story/<storyId>/（02 第 1.1 節、03 第 3.1、3.2、4.4 節）：五章分組，每一步有「開始」與「單獨練習」兩個入口；
// 走完的、目前走到的與練習過的用標記；每章結尾列本章的相關關卡（步驟資料的 chapterLinks 依章彙整、去重，有 level 連到關卡、沒有連到章節頁）。
// 字串在第三層 catalog（lab.po）。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { formatNumber, localePath } from '@ledgerland/i18n';
import { Badge, Button, CheckCircleIcon, ErrorState, NavList, NavRow, PlayIcon, TopBar } from '@ledgerland/web-ui';
import { MapIcon } from '@ledgerland/web-ui/map';
import { predictTotals } from '../features/lab/progress.ts';
import { useLabStory } from '../features/lab/useLab.ts';
import { useLabBack } from '../features/lab/useLabBack.ts';
import { loadChapterIndex, type ChapterSummary, type StorySnapshot } from '../lib/content.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { useLocale } from '../lib/useLocale.ts';
import { NotFound } from './NotFound.tsx';
import '../styles/lab.css';

function chaptersOf(story: StorySnapshot) {
  const steps = [...story.steps].sort((a, b) => a.order - b.order);
  if (story.chapters && story.chapters.length > 0) {
    const byId = new Map(steps.map((s) => [s.id, s]));
    return story.chapters.map((c) => ({ id: c.id, title: c.title, steps: c.stepIds.map((id) => byId.get(id)).filter((s) => s !== undefined) }));
  }
  return [{ id: 'all', title: story.title, steps }];
}

export default function LabStory() {
  const { storyId } = useParams();
  const locale = useLocale();
  const { t } = useLingui();
  const back = useLabBack();
  const lab = useLabStory(storyId, locale);
  const [chapterIndex, setChapterIndex] = useState<ChapterSummary[] | null>(null);
  useEffect(() => {
    let alive = true;
    loadChapterIndex(locale).then(
      (list) => alive && setChapterIndex(list),
      () => alive && setChapterIndex([]),
    );
    return () => {
      alive = false;
    };
  }, [locale]);
  usePageReady(lab.kind !== 'loading' && chapterIndex !== null);
  const href = (p: string) => localePath(locale, p);
  const chapters = useMemo(() => (lab.kind === 'ok' ? chaptersOf(lab.story) : []), [lab]);
  if (lab.kind === 'error' && lab.error.kind === 'missing') return <NotFound />;
  const top = (
    <TopBar
      title={lab.kind === 'ok' ? lab.story.title : t({ id: 'lab.story.title', message: '故事', comment: '故事頁讀取中的標題' })}
      backHref={href('/lab/')}
      backLabel={back.label}
      backShortLabel={back.short}
    />
  );
  if (lab.kind === 'error') {
    return (
      <>
        {top}
        <ErrorState title={t({ id: 'lab.error.title', message: '讀不到實驗室的故事', comment: '實驗室離線時的錯誤標題' })} onRetry={lab.retry} />
      </>
    );
  }
  if (lab.kind !== 'ok') return top;
  const { story, progress } = lab;
  const done = new Set(progress.progress.done);
  const practised = new Set(progress.progress.practised);
  const current = progress.state?.stepId;
  const totals = predictTotals(progress.progress);
  const chapterTitle = (id: string) => chapterIndex?.find((c) => c.id === id)?.title ?? id;
  const levelTitle = (chapterId: string, levelId: string) =>
    chapterIndex?.find((c) => c.id === chapterId)?.levels?.find((l) => l.id === levelId)?.title ?? levelId;
  return (
    <>
      {top}
      <p className="ll-lab-story__company">{story.company.name}</p>
      {totals.steps > 0 && (
        <p className="ll-lab-story__score" data-testid="lab-story-score">
          {t({
            id: 'lab.story.score',
            message: `預測成績：${formatNumber(totals.steps, locale)} 步猜對 ${formatNumber(totals.right, locale)}／${formatNumber(totals.total, locale)}`,
            comment: '故事頁公司名稱下面的預測成績；數字都已格式化',
          })}
        </p>
      )}
      {chapters.map((c, ci) => {
        const links = new Map<string, { chapter: string; level?: string }>();
        for (const s of c.steps) for (const l of s.chapterLinks ?? []) links.set(`${l.chapter}:${l.level ?? ''}`, l);
        return (
          <section key={c.id} className="ll-lab-chapter" aria-labelledby={`ll-lab-ch-${c.id}`} data-testid="lab-chapter">
            <h2 id={`ll-lab-ch-${c.id}`} className="ll-lab-chapter__title">
              {t({ id: 'lab.story.chapter', message: `第 ${ci + 1} 章 ${c.title}`, comment: '故事的章標題；數字與章名已代入' })}
            </h2>
            <ol className="ll-lab-steps">
              {c.steps.map((s) => {
                const isDone = done.has(s.id);
                const isCurrent = current === s.id;
                return (
                  <li
                    key={s.id}
                    className={`ll-lab-step${isDone ? ' is-done' : ''}${isCurrent ? ' is-current' : ''}`}
                    data-testid="lab-step-row"
                    data-step={s.id}
                  >
                    <span className="ll-lab-step__order" aria-hidden="true">
                      {s.order}
                    </span>
                    <span className="ll-lab-step__body">
                      <span className="ll-lab-step__title">
                        <span className="ll-sr-only">{t({ id: 'lab.story.stepN', message: `第 ${s.order} 步`, comment: '步驟編號（螢幕閱讀器）' })} </span>
                        {s.title}
                      </span>
                      <span className="ll-lab-step__badges">
                        {isDone && (
                          <Badge kind="success">
                            <CheckCircleIcon />{' '}
                            <Trans id="lab.story.done" comment="步驟狀態">
                              走完了
                            </Trans>
                          </Badge>
                        )}
                        {isCurrent && !isDone && (
                          <Badge kind="accent">
                            <Trans id="lab.story.current" comment="步驟狀態">
                              目前在這裡
                            </Trans>
                          </Badge>
                        )}
                        {practised.has(s.id) && (
                          <Badge kind="info">
                            <Trans id="lab.story.practised" comment="步驟狀態">
                              練習過
                            </Trans>
                          </Badge>
                        )}
                      </span>
                    </span>
                    <span className="ll-lab-step__actions">
                      <Button size="sm" variant="primary" icon={<PlayIcon />} href={href(`/lab/story/${story.id}/${s.id}/`)} data-testid="lab-step-start">
                        {t({ id: 'lab.story.start', message: '開始', comment: '步驟列的按鈕' })}
                      </Button>
                      <Button size="sm" variant="quiet" href={href(`/lab/story/${story.id}/${s.id}/?mode=practice`)} data-testid="lab-step-practice">
                        {t({ id: 'lab.story.practice', message: '單獨練習', comment: '步驟列的按鈕' })}
                      </Button>
                    </span>
                  </li>
                );
              })}
            </ol>
            {links.size > 0 && (
              <NavList
                title={t({ id: 'lab.story.related', message: '相關關卡', comment: '章末相關關卡清單的標題' })}
                tone="neutral"
                titleAs="h3"
                className="ll-lab-chapter__links"
              >
                {[...links.values()].map((l) => (
                  <NavRow
                    key={`${l.chapter}:${l.level ?? ''}`}
                    icon={<MapIcon />}
                    size="compact"
                    title={l.level ? levelTitle(l.chapter, l.level) : chapterTitle(l.chapter)}
                    description={l.level ? chapterTitle(l.chapter) : undefined}
                    href={l.level ? href(`/level/${l.level}/`) : href(`/chapter/${l.chapter}/`)}
                  />
                ))}
              </NavList>
            )}
          </section>
        );
      })}
    </>
  );
}
