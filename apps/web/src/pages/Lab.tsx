// 報表實驗室首頁 /lab/（02 第 1.1 節、03 第 3.1 節；Tab bar 的頂層頁，字串在第一層 catalog）：故事卡（公司、進度、繼續或開始）加四個入口
// （故事、自由實驗、勾稽練習、指標實驗室）與授權標示（D6：老師的情境與金額不在 CC 授權內）。
// 故事快照與進度一起讀，齊了才整頁出現（lib/page-ready.tsx）；讀不到故事（離線第一次來）是 ErrorState 加再試一次。
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import { localePath } from '@ledgerland/i18n';
import {
  BookIcon,
  Button,
  Card,
  ErrorState,
  FlaskIcon,
  NavList,
  NavRow,
  PageHeader,
  ProcessIcon,
  ProgressBar,
  RatioIcon,
  StatementIcon,
} from '@ledgerland/web-ui';
import { readStoryProgress, type LabProgressSnapshot } from '../features/lab/progress.ts';
import { ContentLoadError, loadManifest, loadStory, type StorySnapshot } from '../lib/content.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { useLocale } from '../lib/useLocale.ts';
import '../styles/lab.css';

type State =
  { kind: 'loading' } | { kind: 'error'; error: ContentLoadError } | { kind: 'none' } | { kind: 'ok'; story: StorySnapshot; progress: LabProgressSnapshot };

export default function Lab() {
  const { t } = useLingui();
  const locale = useLocale();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const load = useCallback(() => {
    let alive = true;
    setState({ kind: 'loading' });
    loadManifest()
      .then(async (m) => {
        const entry = (m.stories ?? [])[0];
        if (!entry) return { kind: 'none' } as const;
        const [story, progress] = await Promise.all([loadStory(entry.id, locale), readStoryProgress(entry.id)]);
        return { kind: 'ok', story, progress } as const;
      })
      .then(
        (s) => alive && setState(s),
        (e: unknown) => alive && setState({ kind: 'error', error: e instanceof ContentLoadError ? e : new ContentLoadError(String(e), 'network') }),
      );
    return () => {
      alive = false;
    };
  }, [locale]);
  useEffect(() => load(), [load]);
  usePageReady(state.kind !== 'loading');
  const href = (p: string) => localePath(locale, p);
  const title = <PageHeader title={t({ id: 'lab.page.title', message: '實驗室', comment: '實驗室頁（Tab bar 頂層頁）的頁首標題' })} />;
  if (state.kind === 'error') {
    return (
      <>
        {title}
        <ErrorState
          title={t({ id: 'lab.error.title', message: '讀不到實驗室的故事', comment: '實驗室首頁離線時的錯誤標題' })}
          description={t({ id: 'lab.error.desc', message: '請連上網路後再試一次。', comment: '實驗室首頁離線時的說明' })}
          onRetry={() => void load()}
        />
      </>
    );
  }
  if (state.kind === 'none') {
    return (
      <>
        {title}
        <ErrorState title={t({ id: 'lab.none.title', message: '目前沒有已發布的故事', comment: '快照裡沒有故事時' })} />
      </>
    );
  }
  const story = state.kind === 'ok' ? state.story : null;
  const progress = state.kind === 'ok' ? state.progress : null;
  const total = story?.steps.length ?? 0;
  const doneCount = progress?.progress.done.length ?? 0;
  const currentStep = progress?.state?.stepId;
  const steps = story ? [...story.steps].sort((a, b) => a.order - b.order) : [];
  const currentIndex = currentStep ? steps.findIndex((s) => s.id === currentStep) : -1;
  const nextStep = currentIndex >= 0 ? (steps[currentIndex + 1] ?? steps[currentIndex]) : steps[0];
  const storyHref = story ? href(`/lab/story/${story.id}/`) : href('/lab/');
  return (
    <>
      {title}
      {story && (
        <Card as="section" className="ll-lab-hero" aria-labelledby="ll-lab-hero-title" data-testid="lab-hero">
          <p className="ll-lab-hero__company">{story.company.name}</p>
          <h2 id="ll-lab-hero-title" className="ll-lab-hero__title">
            {story.title}
          </h2>
          <p className="ll-lab-hero__desc">
            {t({
              id: 'lab.home.storyDesc',
              message: `一家公司的第一年，${total} 筆交易一步一步走，看每一筆怎麼流進三張報表與財務指標。`,
              comment: '實驗室首頁故事卡的說明；total 是故事的步數',
            })}
          </p>
          <div className="ll-lab-hero__progress">
            <ProgressBar value={doneCount} max={total} size="sm" data-testid="lab-progress" />
            <span className="ll-lab-hero__count">
              <Plural id="lab.home.progress" value={doneCount} other={`已走完 ${doneCount}／${total} 步`} comment="故事進度；數字已代入" />
            </span>
          </div>
          <div className="ll-lab-hero__actions">
            {nextStep && (
              <Button variant="primary" size="md" href={href(`/lab/story/${story.id}/${nextStep.id}/`)} data-testid="lab-continue">
                {currentIndex >= 0
                  ? t({ id: 'lab.home.continue', message: `繼續第 ${nextStep.order} 步`, comment: '故事卡主按鈕；數字已代入' })
                  : t({ id: 'lab.home.start', message: '開始故事', comment: '故事卡主按鈕（還沒走過）' })}
              </Button>
            )}
            <Button size="md" href={storyHref} data-testid="lab-story-link">
              {t({ id: 'lab.home.steps', message: '看全部步驟', comment: '故事卡的次要按鈕' })}
            </Button>
          </div>
          {story.origin === 'teacher' && (
            <p className="ll-lab-hero__licence">
              <Trans id="lab.home.licence" comment="故事開頭的授權標示（D6）">
                故事的情境與金額經陳彥宏老師授權使用，敘述文字為網站原創。
              </Trans>
            </p>
          )}
        </Card>
      )}
      <NavList title={t({ id: 'lab.home.modes', message: '四種模式', comment: '實驗室四個入口的清單標題' })} tone="accent">
        <NavRow
          icon={<BookIcon />}
          title={t({ id: 'lab.mode.story', message: '故事', comment: '實驗室入口' })}
          description={t({
            id: 'lab.mode.story.desc',
            message: `依序走過 ${total} 筆交易，每一步都可以單獨練習。`,
            comment: '實驗室入口的說明；total 是故事的步數',
          })}
          href={storyHref}
        />
        <NavRow
          icon={<ProcessIcon />}
          title={t({ id: 'lab.mode.sandbox', message: '自由實驗', comment: '實驗室入口' })}
          description={t({ id: 'lab.mode.sandbox.desc', message: '改任何一步的金額，三表與指標立刻重算。', comment: '實驗室入口的說明' })}
          href={href('/lab/sandbox/')}
        />
        <NavRow
          icon={<StatementIcon />}
          title={t({ id: 'lab.mode.reconcile', message: '勾稽練習', comment: '實驗室入口' })}
          description={t({ id: 'lab.mode.reconcile.desc', message: '自己填跨表的勾稽格子，燈號即時檢查。', comment: '實驗室入口的說明' })}
          href={href('/lab/reconcile/')}
        />
        <NavRow
          icon={<RatioIcon />}
          title={t({ id: 'lab.mode.ratios', message: '指標實驗室', comment: '實驗室入口' })}
          description={t({ id: 'lab.mode.ratios.desc', message: '看每個指標的公式、版本與狀態，和它為什麼是 N/A。', comment: '實驗室入口的說明' })}
          href={href('/lab/ratios/')}
        />
      </NavList>
      <p className="ll-lab-home__hint">
        <FlaskIcon />{' '}
        <Trans id="lab.home.hint" comment="實驗室首頁底部的一句話">
          不計分，放心試。
        </Trans>
      </p>
    </>
  );
}
