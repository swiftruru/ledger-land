// 苦練的練習紀錄（2026-11-13，02 第 1.1 節）：/exam/history/，?days=30 看近 30 天（預設 14 天）。
// 由這台裝置的作答明細算每天練了幾題（features/exam/history.ts）：四個數字（連續練習幾天、今天、近 7 天與前 7 天的比較、近 7 天訂正與熟練）、
// 每天練了幾題的長條圖（features/exam/DayChart.tsx）與每天的數字表格、整體進度（每題的累計，和苦練首頁同一份）。
// 每天的紀錄只存在這台裝置、不進備份（維護者 2026-11-13 的決定）；純瀏覽，不寫紀錄。noindex。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { formatMonthDay, formatNumber, formatPercent, localePath } from '@ledgerland/i18n';
import { Button, Card, Disclosure, EmptyState, ErrorState, PlayIcon, ProgressBar, Segmented, TextLink, TopBar } from '@ledgerland/web-ui';
import { DayChart } from '../features/exam/DayChart.tsx';
import { deviceClock } from '../features/exam/day.ts';
import { getExamDb, type ExamAttempt, type QuestionState } from '../features/exam/db.ts';
import { accuracyOf, dailyOf, streakOf, weekCompare, windowOf, type DayRow } from '../features/exam/history.ts';
import { allQuestionIds } from '../features/exam/sets.ts';
import { statsOf, wrongStatsOf } from '../features/exam/stats.ts';
import { loadHandoutIndex, type HandoutManifestEntry } from '../lib/content.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { useLocale } from '../lib/useLocale.ts';
import '../styles/exam.css';
import '../styles/exam-history.css';

type State =
  { kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; index: HandoutManifestEntry; states: ReadonlyMap<string, QuestionState>; rows: readonly DayRow[] };

const SPANS = ['14', '30'] as const;
type Span = (typeof SPANS)[number];

export default function ExamHistory() {
  const { t } = useLingui();
  const locale = useLocale();
  const href = (p: string) => localePath(locale, p);
  const [search, setSearch] = useSearchParams();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;
    (async (): Promise<State> => {
      const index = await loadHandoutIndex();
      if (!index) return { kind: 'error' };
      const db = getExamDb();
      const [list, attempts] = await Promise.all([db.allStates().catch(() => [] as QuestionState[]), db.allAttempts().catch(() => [] as ExamAttempt[])]);
      return { kind: 'ok', index, states: new Map(list.map((s) => [s.questionId, s])), rows: dailyOf(attempts, deviceClock().dayOf) };
    })().then(
      (s) => alive && setState(s),
      () => alive && setState({ kind: 'error' }),
    );
    return () => {
      alive = false;
    };
  }, []);
  usePageReady(state.kind !== 'loading');

  const topBar = (
    <TopBar
      title={t({ id: 'exam.history.title', message: '練習紀錄', comment: '苦練的練習紀錄頁的標題' })}
      titleId="ll-exam-history-title"
      backHref={href('/exam/')}
      backLabel={t({ id: 'exam.run.back', message: '回到期中考苦練' })}
      backShortLabel={t({ id: 'exam.run.back.short', message: '苦練' })}
    />
  );
  if (state.kind === 'loading') return topBar;
  if (state.kind === 'error')
    return (
      <>
        {topBar}
        <ErrorState
          title={t({ id: 'exam.error.title', message: '題庫載入不到' })}
          description={t({ id: 'exam.error.desc', message: '重新整理再試一次；離線時要先在有網路時開過這一頁。' })}
          onRetry={() => window.location.reload()}
        />
      </>
    );

  const { index, states, rows } = state;
  const n = (x: number) => formatNumber(x, locale);
  const percent = (x: number) => formatPercent(x, locale, { digits: 0 });
  const clock = deviceClock();
  const intro = (
    <p className="ll-exam-intro">
      <Trans id="exam.history.intro" comment="練習紀錄頁開頭的說明：數字怎麼算">
        每天練了幾題、答對多少都記在這裡。同一題練兩次算兩次，模擬考交卷的題算在交卷那一天。
      </Trans>
    </p>
  );
  const deviceNote = (
    <p className="ll-exam-run__hint" data-testid="exam-history-device">
      <Trans id="exam.history.device" comment="練習紀錄頁最下面的一句：每天的紀錄不進備份">
        每天的紀錄只存在這台裝置，換裝置後會從頭累積；每一題的對錯與熟練會跟著備份走。
      </Trans>
    </p>
  );
  if (rows.length === 0)
    return (
      <>
        {topBar}
        {intro}
        <EmptyState
          title={t({ id: 'exam.history.empty', message: '還沒有練習紀錄', comment: '練習紀錄頁：這台裝置還沒有作答過' })}
          description={t({
            id: 'exam.history.empty.desc',
            message: '練過第一題之後，這裡會開始記每天練了幾題、有沒有進步。',
            comment: '練習紀錄頁空狀態的說明',
          })}
          action={
            <Button variant="primary" icon={<PlayIcon />} href={href('/exam/all/')}>
              {t({ id: 'exam.start.order', message: '依講義順序練' })}
            </Button>
          }
        />
        {deviceNote}
      </>
    );

  const span: Span = search.get('days') === '30' ? '30' : '14';
  const days = windowOf(rows, clock.today, Number(span));
  const todayRow = days[days.length - 1]!;
  const streak = streakOf(rows, clock.today);
  const { recent, previous } = weekCompare(rows, clock.today);
  const recentAcc = accuracyOf(recent);
  const previousAcc = accuracyOf(previous);
  const diff = recentAcc === null || previousAcc === null ? null : Math.round((recentAcc - previousAcc) * 100);
  const compare =
    diff === null
      ? null
      : diff > 0
        ? t({
            id: 'exam.history.week.up',
            message: `答對率比前 7 天多 ${n(diff)} 個百分點`,
            comment: '練習紀錄：近 7 天的答對率比前 7 天高；diff 是百分點（已格式化）',
          })
        : diff < 0
          ? t({
              id: 'exam.history.week.down',
              message: `答對率比前 7 天少 ${n(-diff)} 個百分點`,
              comment: '練習紀錄：近 7 天的答對率比前 7 天低；diff 是百分點（已格式化）',
            })
          : t({ id: 'exam.history.week.same', message: '答對率和前 7 天差不多', comment: '練習紀錄：近 7 天的答對率和前 7 天相差不到 1 個百分點' });
  const order = allQuestionIds(index);
  const stats = statsOf(order, states, clock);
  const wrong = wrongStatsOf(order, states, clock);
  const listed = [...days].reverse().filter((d) => d.answered > 0);
  const questions = (count: number) => t({ id: 'exam.history.count', message: `${n(count)} 題`, comment: '練習紀錄：題數；count 已格式化' });
  return (
    <>
      {topBar}
      {intro}
      <Card as="section" className="ll-exam-hero" aria-labelledby="ll-exam-history-now" data-testid="exam-history-tiles">
        <h2 id="ll-exam-history-now" className="ll-exam-wrongbox__title">
          {t({ id: 'exam.history.now.title', message: '最近的練習', comment: '練習紀錄頁第一張卡的小標' })}
        </h2>
        <dl className="ll-exam-history__tiles">
          <div>
            <dt>{t({ id: 'exam.history.streak', message: '連續練習', comment: '練習紀錄的數字：連續幾天有練習' })}</dt>
            <dd className="ll-num" data-testid="exam-history-streak">
              {t({ id: 'exam.history.streak.value', message: `${n(streak)} 天`, comment: '練習紀錄：連續練習的天數；count 已格式化' })}
            </dd>
          </div>
          <div>
            <dt>{t({ id: 'exam.history.today', message: '今天' })}</dt>
            <dd className="ll-num" data-testid="exam-history-today">
              {questions(todayRow.answered)}
            </dd>
          </div>
          <div>
            <dt>{t({ id: 'exam.history.week', message: '近 7 天', comment: '練習紀錄的數字：近 7 天（含今天）練了幾題' })}</dt>
            <dd className="ll-num" data-testid="exam-history-week">
              {questions(recent.answered)}
            </dd>
            {recentAcc !== null && (
              <dd className="ll-num">
                {t({ id: 'exam.history.week.accuracy', message: `答對率 ${percent(recentAcc)}`, comment: '練習紀錄：近 7 天的答對率；已格式化成百分比' })}
              </dd>
            )}
            {compare !== null && <dd data-testid="exam-history-compare">{compare}</dd>}
          </div>
          <div>
            <dt>{t({ id: 'exam.history.gain', message: '近 7 天的進步', comment: '練習紀錄的數字：近 7 天訂正成功與練到熟練的題數' })}</dt>
            <dd className="ll-num" data-testid="exam-history-mastered">
              {t({ id: 'exam.history.gain.mastered', message: `熟練 ${n(recent.mastered)} 題`, comment: '練習紀錄：近 7 天練到熟練的題數（已格式化）' })}
            </dd>
            <dd className="ll-num" data-testid="exam-history-fixed">
              {t({ id: 'exam.history.gain.fixed', message: `訂正成功 ${n(recent.fixed)} 題`, comment: '練習紀錄：近 7 天把答錯的題答對的題數（已格式化）' })}
            </dd>
          </div>
        </dl>
      </Card>
      <Card as="section" className="ll-exam-hero" aria-labelledby="ll-exam-history-chart">
        <div className="ll-exam-history__head">
          <h2 id="ll-exam-history-chart" className="ll-exam-wrongbox__title">
            {t({ id: 'exam.history.chart.title', message: '每天練了幾題', comment: '練習紀錄頁第二張卡的小標：長條圖' })}
          </h2>
          <Segmented<Span>
            size="sm"
            value={span}
            labelledBy="ll-exam-history-chart"
            onChange={(v) => setSearch(v === '14' ? {} : { days: v }, { replace: true })}
            options={SPANS.map((s) => ({
              value: s,
              label: t({ id: 'exam.history.span', message: `近 ${n(Number(s))} 天`, comment: '練習紀錄圖表的範圍切換；days 是天數（已格式化）' }),
            }))}
          />
        </div>
        <DayChart days={days} today={clock.today} />
        <Disclosure
          variant="plain"
          summary={t({ id: 'exam.history.table.title', message: '每天的數字', comment: '練習紀錄：展開看每天的數字表格' })}
          data-testid="exam-history-table"
        >
          {listed.length === 0 ? (
            <p className="ll-exam-hero__note">
              {t({ id: 'exam.history.table.none', message: '這段時間沒有練習。', comment: '練習紀錄的表格：選的範圍裡沒有作答' })}
            </p>
          ) : (
            <table className="ll-exam-history__table">
              <thead>
                <tr>
                  <th scope="col">{t({ id: 'exam.history.col.day', message: '日期', comment: '練習紀錄表格的欄名' })}</th>
                  <th scope="col">{t({ id: 'exam.history.col.answered', message: '題數', comment: '練習紀錄表格的欄名：那一天練了幾題' })}</th>
                  <th scope="col">{t({ id: 'exam.history.col.accuracy', message: '答對率', comment: '練習紀錄表格的欄名' })}</th>
                  <th scope="col">{t({ id: 'exam.history.col.fixed', message: '訂正', comment: '練習紀錄表格的欄名：訂正成功的題數' })}</th>
                  <th scope="col">{t({ id: 'exam.history.col.mastered', message: '熟練', comment: '練習紀錄表格的欄名：練到熟練的題數' })}</th>
                </tr>
              </thead>
              <tbody>
                {listed.map((d) => (
                  <tr key={d.day} data-day={d.day}>
                    <th scope="row">{d.day === clock.today ? t({ id: 'exam.history.today', message: '今天' }) : formatMonthDay(d.day, locale)}</th>
                    <td>{n(d.answered)}</td>
                    <td>{percent(d.correct / d.answered)}</td>
                    <td>{n(d.fixed)}</td>
                    <td>{n(d.mastered)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Disclosure>
      </Card>
      <Card as="section" className="ll-exam-hero" aria-labelledby="ll-exam-history-all" data-testid="exam-history-overall">
        <h2 id="ll-exam-history-all" className="ll-exam-wrongbox__title">
          {t({ id: 'exam.history.overall.title', message: '整體進度', comment: '練習紀錄頁第三張卡的小標' })}
        </h2>
        <div className="ll-exam-hero__progress">
          <ProgressBar size="md" value={stats.mastered} max={stats.total} />
          <span className="ll-exam-hero__count ll-num" data-testid="exam-history-progress">
            {t({
              id: 'exam.history.overall',
              message: `練過 ${n(stats.practised)}／${n(stats.total)} 題，熟練 ${n(stats.mastered)} 題`,
              comment: '練習紀錄的整體進度；數字都已格式化',
            })}
          </span>
        </div>
        {wrong.everWrong > 0 && (
          <div className="ll-exam-hero__progress">
            <ProgressBar size="md" value={wrong.mastered} max={wrong.everWrong} />
            <span className="ll-exam-hero__count ll-num">
              {t({ id: 'exam.list.progress', message: `答錯過 ${n(wrong.everWrong)} 題，已熟練 ${n(wrong.mastered)} 題` })}
            </span>
          </div>
        )}
        <p className="ll-exam-run__hint">
          <TextLink href={href('/exam/list/')}>{t({ id: 'exam.summary.toList', message: '看錯題複習的紀錄' })}</TextLink>
        </p>
      </Card>
      {deviceNote}
    </>
  );
}
