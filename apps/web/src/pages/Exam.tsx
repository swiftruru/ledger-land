// 期中考苦練首頁（M4c，02 第 1.1 節）：只收陳老師三份講義的練習題，題目與答案照講義。只讀 manifest.handouts 的小索引與這台裝置的紀錄（features/exam/db.ts），
// 不載題庫本身，但畫好後會請 Service Worker 把三份講義檔抓進快取（features/exam/prefetch.ts）。整體進度（練過、熟練、答對率）、入口（依講義順序、隨機抽 N 題、只練錯過的、只練不熟的）、
// 選項順序的開關、「更多練法」（模擬考、背題瀏覽、錯題與不熟的清單；M4c 第二批）、三份講義各一張卡與各段的入口。熟練 = 連續答對兩次（features/exam/stats.ts）。
// 紀錄存在這台裝置，每題的累計會跟著備份走（06 第 4.6 節；features/exam/backup.ts）；英文站的介面是英文，題目仍是中文。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useMemo, useState } from 'react';
import { formatNumber, formatPercent, localePath } from '@ledgerland/i18n';
import {
  BookIcon,
  BookmarkIcon,
  Button,
  Card,
  CardsIcon,
  Disclosure,
  ErrorState,
  NavList,
  NavRow,
  PlayIcon,
  ProgressBar,
  RetryIcon,
  Segmented,
  Switch,
  TimerIcon,
  TopBar,
} from '@ledgerland/web-ui';
import { getExamDb, type QuestionState } from '../features/exam/db.ts';
import { scheduleHandoutPrefetch } from '../features/exam/prefetch.ts';
import { COUNT_OPTIONS, DEFAULT_RANDOM_COUNT, type CountOption } from '../features/exam/options.ts';
import { readExamRandomCount, readExamShuffle, writeExamRandomCount, writeExamShuffle } from '../features/exam/prefs.ts';
import type { ExamRun } from '../features/exam/run.ts';
import { allQuestionIds } from '../features/exam/sets.ts';
import { statsOf, unsureIdsOf, wrongIdsOf } from '../features/exam/stats.ts';
import { loadHandoutIndex, type HandoutManifestEntry } from '../lib/content.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { useLocale } from '../lib/useLocale.ts';
import '../styles/exam.css';

type IndexState = { kind: 'loading' } | { kind: 'error' } | { kind: 'none' } | { kind: 'ok'; index: HandoutManifestEntry };

export default function Exam() {
  const { t } = useLingui();
  const locale = useLocale();
  const href = (p: string) => localePath(locale, p);
  const [state, setState] = useState<IndexState>({ kind: 'loading' });
  const [states, setStates] = useState<ReadonlyMap<string, QuestionState> | null>(null);
  const [resume, setResume] = useState<ExamRun | null | undefined>(undefined);
  const [shuffle, setShuffle] = useState(readExamShuffle);
  const [randomCount, setRandomCount] = useState<CountOption>(readExamRandomCount);

  useEffect(() => {
    let alive = true;
    loadHandoutIndex().then(
      (index) => alive && setState(index ? { kind: 'ok', index } : { kind: 'none' }),
      () => alive && setState({ kind: 'error' }),
    );
    const db = getExamDb();
    void db.allStates().then(
      (list) => alive && setStates(new Map(list.map((s) => [s.questionId, s]))),
      () => alive && setStates(new Map()),
    );
    void db.getRun('all:handout').then(
      (run) => alive && setResume(run && run.finishedAt === undefined && run.index > 0 ? run : null),
      () => alive && setResume(null),
    );
    return () => {
      alive = false;
    };
  }, []);
  usePageReady(state.kind !== 'loading' && states !== null && resume !== undefined);

  const index = state.kind === 'ok' ? state.index : null;
  // 離線保險：頁面畫好後請 Service Worker 把三份講義檔抓進快取，沒練過的講義離線也開得了
  useEffect(() => (index ? scheduleHandoutPrefetch(index) : undefined), [index]);
  const all = useMemo(() => (index ? allQuestionIds(index) : []), [index]);
  const stats = useMemo(() => statsOf(all, states ?? new Map()), [all, states]);
  const wrongCount = useMemo(() => (states ? [...wrongIdsOf(states)].filter((id) => all.includes(id)).length : 0), [states, all]);
  const unsureCount = useMemo(() => (states ? [...unsureIdsOf(states)].filter((id) => all.includes(id)).length : 0), [states, all]);

  const topBar = (
    <TopBar
      title={t({ id: 'exam.title', message: '期中考苦練', comment: '苦練區首頁的標題；入口與 Tab 的 also 都用這個名稱' })}
      titleId="ll-exam-title"
      backHref={href('/play/')}
      backLabel={t({ id: 'exam.back', message: '回到闖關地圖', comment: '苦練區頁首返回按鈕的可讀名稱（苦練區在 Tab bar 的「闖關」底下）' })}
      backShortLabel={t({ id: 'exam.back.short', message: '地圖', comment: '苦練區頁首返回按鈕上的短字（必須是「回到闖關地圖」的一部分）' })}
    />
  );
  if (state.kind === 'loading' || states === null) return topBar;
  if (state.kind !== 'ok') {
    return (
      <>
        {topBar}
        <ErrorState
          title={
            state.kind === 'none'
              ? t({ id: 'exam.none.title', message: '這個版本還沒有講義題庫', comment: '苦練區：快照裡沒有講義題庫時的標題' })
              : t({ id: 'exam.error.title', message: '題庫載入不到', comment: '苦練區：manifest 讀不到時的標題' })
          }
          description={t({ id: 'exam.error.desc', message: '重新整理再試一次；離線時要先在有網路時開過這一頁。', comment: '苦練區載入失敗的說明' })}
          onRetry={() => window.location.reload()}
        />
      </>
    );
  }
  const n = (x: number) => formatNumber(x, locale);
  const bank = state.index;
  const decks = [...bank.decks].sort((a, b) => a.order - b.order);
  return (
    <>
      {topBar}
      <p className="ll-exam-intro">
        <Trans id="exam.intro" comment="苦練首頁的一句說明">
          只收陳老師三份講義的練習題，題目、選項與解答都照講義；範圍以老師公告為準。
        </Trans>
      </p>
      <Card as="section" className="ll-exam-hero" aria-labelledby="ll-exam-hero-title" data-testid="exam-hero">
        <h2 id="ll-exam-hero-title" className="ll-exam-hero__title">
          {t({ id: 'exam.hero.title', message: `講義 ${n(bank.questionCount)} 題`, comment: '苦練首頁主卡的標題；count 是收錄的題數（已格式化）' })}
        </h2>
        <div className="ll-exam-hero__progress">
          <ProgressBar size="md" value={stats.practised} max={stats.total || 1} />
          <span className="ll-exam-hero__count ll-num" data-testid="exam-progress">
            {stats.accuracy === null
              ? t({ id: 'exam.hero.untouched', message: '還沒開始練', comment: '主卡進度：這台裝置還沒練過任何一題' })
              : t({
                  id: 'exam.hero.progress',
                  message: `練過 ${n(stats.practised)}／${n(stats.total)} 題，熟練 ${n(stats.mastered)} 題，答對率 ${formatPercent(stats.accuracy, locale)}`,
                  comment: '主卡進度；熟練是連續答對兩次的題數；數字都已格式化',
                })}
          </span>
        </div>
        <div className="ll-exam-hero__actions">
          <Button variant="primary" size="md" icon={<PlayIcon />} href={href('/exam/all/')} data-testid="exam-start-order">
            {resume
              ? t({
                  id: 'exam.start.resume',
                  message: `繼續依講義順序練（第 ${n(resume.index + 1)} 題）`,
                  comment: '主按鈕：有做到一半的一輪時；n 是題號（已格式化）',
                })
              : t({ id: 'exam.start.order', message: '依講義順序練', comment: '主按鈕：全部題目依講義順序' })}
          </Button>
          <Button
            size="md"
            icon={<RetryIcon />}
            href={href(randomCount === DEFAULT_RANDOM_COUNT ? '/exam/all/?order=random' : `/exam/all/?order=random&n=${randomCount}`)}
            data-testid="exam-start-random"
          >
            {randomCount === 'all'
              ? t({ id: 'exam.start.randomAll', message: '全部隨機練', comment: '次要按鈕：全部題目打亂順序練一輪' })
              : t({ id: 'exam.start.random', message: `隨機抽 ${n(randomCount)} 題`, comment: '次要按鈕：全部題目裡隨機抽幾題；count 已格式化' })}
          </Button>
          {wrongCount > 0 ? (
            <Button size="md" variant="quiet" icon={<BookIcon />} href={href('/exam/wrong/')} data-testid="exam-start-wrong">
              {t({ id: 'exam.start.wrong', message: `只練錯過的（${n(wrongCount)} 題）`, comment: '按鈕：只練這台裝置上一次答錯的題；count 已格式化' })}
            </Button>
          ) : (
            <Button size="md" variant="quiet" icon={<BookIcon />} disabled data-testid="exam-start-wrong">
              {t({ id: 'exam.start.wrongNone', message: '只練錯過的（還沒有）', comment: '按鈕（停用）：還沒有答錯的題' })}
            </Button>
          )}
          {unsureCount > 0 ? (
            <Button size="md" variant="quiet" icon={<BookIcon />} href={href('/exam/unsure/')} data-testid="exam-start-unsure">
              {t({ id: 'exam.start.unsure', message: `只練不熟的（${n(unsureCount)} 題）`, comment: '按鈕：只練練過但還沒連對兩次的題；count 已格式化' })}
            </Button>
          ) : (
            <Button size="md" variant="quiet" icon={<BookIcon />} disabled data-testid="exam-start-unsure">
              {t({ id: 'exam.start.unsureNone', message: '只練不熟的（還沒有）', comment: '按鈕（停用）：還沒有練過而未熟練的題' })}
            </Button>
          )}
        </div>
        <div className="ll-exam-hero__random">
          <span id="ll-exam-random-label" className="ll-exam-hero__random-label">
            {t({ id: 'exam.random.label', message: '隨機抽幾題', comment: '苦練首頁：隨機練習題數選擇的標籤' })}
          </span>
          <Segmented<string>
            size="sm"
            value={String(randomCount)}
            labelledBy="ll-exam-random-label"
            onChange={(v) => {
              const next = COUNT_OPTIONS.find((c) => String(c) === v) ?? DEFAULT_RANDOM_COUNT;
              setRandomCount(next);
              writeExamRandomCount(next);
            }}
            options={COUNT_OPTIONS.map((c) => ({
              value: String(c),
              label: c === 'all' ? t({ id: 'exam.random.all', message: '全部', comment: '題數選項：全部題目' }) : <span className="ll-num">{n(c)}</span>,
            }))}
          />
        </div>
        <Switch
          className="ll-exam-hero__switch"
          checked={shuffle}
          onChange={(on) => {
            setShuffle(on);
            writeExamShuffle(on);
          }}
          label={t({ id: 'exam.shuffle.label', message: '打亂選項順序', comment: '苦練首頁的開關' })}
          description={t({
            id: 'exam.shuffle.desc',
            message: '關閉時 A、B、C 的位置和講義一樣；打開後每次隨機，確認答案後會標出講義的字母。',
            comment: '打亂選項開關的說明',
          })}
        />
        <p className="ll-exam-hero__note">
          <Trans id="exam.note.device" comment="主卡下方的說明：紀錄只在這台裝置">
            練習紀錄存在這台裝置上，匯出備份時會一起帶走。
          </Trans>
          {locale !== 'zh-TW' && (
            <>
              {' '}
              <Trans id="exam.note.zhOnly" comment="英文站多一句：題目只有中文">
                題庫只有中文。
              </Trans>
            </>
          )}
        </p>
        <p className="ll-exam-hero__licence">
          <Trans id="exam.licence" comment="授權標示（D6、2026-11-04 老師同意）">
            題目經陳彥宏老師授權使用。
          </Trans>
        </p>
      </Card>
      <NavList className="ll-exam-more" title={t({ id: 'exam.more.title', message: '更多練法', comment: '苦練首頁：主卡下面的入口清單標題' })}>
        <NavRow
          icon={<TimerIcon />}
          title={t({ id: 'exam.mock.title', message: '模擬考' })}
          description={t({
            id: 'exam.more.mock',
            message: '自己選範圍、題數與每題時間；作答中不顯示對錯，交卷後一次看成績與解析。',
            comment: '苦練首頁入口的說明：模擬考',
          })}
          href={href('/exam/mock/')}
          data-testid="exam-more-mock"
        />
        <NavRow
          icon={<CardsIcon />}
          title={t({ id: 'exam.browse.title', message: '背題瀏覽' })}
          description={t({
            id: 'exam.more.browse',
            message: '依講義列出全部題目、正解與解析，可以遮住答案，也可以列印。',
            comment: '苦練首頁入口的說明：背題瀏覽',
          })}
          href={href('/exam/browse/')}
          data-testid="exam-more-browse"
        />
        <NavRow
          icon={<BookmarkIcon />}
          title={t({ id: 'exam.list.title', message: '錯過與還不熟的題' })}
          description={t({
            id: 'exam.more.list',
            message: '慢慢看答錯過與還沒連對兩次的題，連同你上次選的答案與解析。',
            comment: '苦練首頁入口的說明：錯題與不熟的清單',
          })}
          href={href('/exam/list/')}
          data-testid="exam-more-list"
        />
      </NavList>
      {decks.map((d) => {
        const ids = d.sections.flatMap((s) => s.questionIds);
        const ds = statsOf(ids, states);
        return (
          <Card as="section" key={d.id} className="ll-exam-deck" aria-labelledby={`ll-exam-deck-${d.id}`} data-testid={`exam-deck-${d.id}`}>
            <p className="ll-exam-deck__code ll-num">
              {t({ id: 'exam.deck.code', message: `講義 ${d.code}`, comment: '講義卡的小標；code 是講義編號，例如 0-1' })}
            </p>
            <h2 id={`ll-exam-deck-${d.id}`} className="ll-exam-deck__title" lang="zh-TW">
              {d.title}
            </h2>
            <div className="ll-exam-deck__progress">
              <ProgressBar size="sm" value={ds.practised} max={ds.total || 1} />
              <span className="ll-exam-deck__count ll-num">
                {t({
                  id: 'exam.deck.count',
                  message: `練過 ${n(ds.practised)}／${n(ds.total)} 題，熟練 ${n(ds.mastered)}`,
                  comment: '講義卡的進度；熟練是連續答對兩次的題數；數字已格式化',
                })}
              </span>
            </div>
            <div className="ll-exam-deck__actions">
              <Button size="sm" variant="primary" icon={<PlayIcon />} href={href(`/exam/${d.id}/`)}>
                {t({ id: 'exam.deck.practise', message: '練這份講義', comment: '講義卡的按鈕' })}
              </Button>
            </div>
            <Disclosure
              summary={t({ id: 'exam.deck.sections', message: '各段分開練', comment: '講義卡的展開列：列出這份講義的各段' })}
              variant="plain"
              className="ll-exam-deck__sections"
            >
              <NavList>
                {d.sections.map((s) => {
                  const ss = statsOf(s.questionIds, states);
                  return (
                    <NavRow
                      key={s.id}
                      icon={<BookIcon />}
                      title={<span lang="zh-TW">{s.title}</span>}
                      description={
                        ss.practised === 0
                          ? t({ id: 'exam.section.untouched', message: `${n(ss.total)} 題`, comment: '段的說明（還沒練）；total 已格式化' })
                          : t({ id: 'exam.section.count', message: `練過 ${n(ss.practised)}／${n(ss.total)} 題`, comment: '段的說明；數字已格式化' })
                      }
                      href={href(`/exam/${s.id}/`)}
                      data-testid={`exam-section-${s.id}`}
                    />
                  );
                })}
              </NavList>
            </Disclosure>
          </Card>
        );
      })}
    </>
  );
}
