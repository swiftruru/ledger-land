// 期中考苦練首頁（M4c，02 第 1.1 節）：只收陳老師三份講義的練習題，題目與答案照講義。只讀 manifest.handouts 的小索引與這台裝置的紀錄（features/exam/db.ts），
// 不載題庫本身，但畫好後會請 Service Worker 把三份講義檔抓進快取（features/exam/prefetch.ts）。整體進度（練過、熟練、答對率）、入口（依講義順序、隨機抽 N 題、只練錯過的、只練不熟的）、
// 選項順序的開關、三份講義各一張卡與各段的入口。熟練 = 連續答對兩次（features/exam/stats.ts）。
// 版面（2026-11-06）：三張步驟卡，先讀題（背題瀏覽，主要按鈕直接進閱讀頁）、再自己練（作答）、最後模擬考；
// 其中一張掛「建議」的標籤、主要按鈕用實心的（features/exam/steps.ts）。很多人還沒看過題目，所以讀題排第一。
// 每張步驟卡最下面是這一步的兩枚苦練徽章（features/badges/exam.ts）；打開這一頁時判定一次全部並補發。
// 紀錄存在這台裝置，每題的累計會跟著備份走（06 第 4.6 節；features/exam/backup.ts）；英文站的介面是英文，題目仍是中文。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useMemo, useState } from 'react';
import { formatNumber, formatPercent, localePath } from '@ledgerland/i18n';
import {
  ArrowRightIcon,
  Badge,
  BookIcon,
  BookmarkIcon,
  RatioIcon,
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
  SearchIcon,
  Segmented,
  Switch,
  TimerIcon,
  TopBar,
} from '@ledgerland/web-ui';
import { awardExamBadges } from '../features/badges/award-exam.ts';
import { EXAM_BADGES, type ExamBadgeKey } from '../features/badges/exam.ts';
import { ExamBadgeArt } from '../features/badges/ExamBadgeArt.tsx';
import { ExamBadgeToast } from '../features/badges/ExamBadgeToast.tsx';
import { useExamBadgeText } from '../features/badges/exam-text.ts';
import { getExamDb, type QuestionState } from '../features/exam/db.ts';
import { scheduleHandoutPrefetch } from '../features/exam/prefetch.ts';
import { COUNT_OPTIONS, DEFAULT_RANDOM_COUNT, type CountOption } from '../features/exam/options.ts';
import { readExamBrowsePos, readExamRandomCount, readExamShuffle, writeExamRandomCount, writeExamShuffle } from '../features/exam/prefs.ts';
import { getExamReadDb } from '../features/exam/read-db.ts';
import { ALL_SCOPE, browseParams, lastIn, orderOf, resumeTarget, scopeOf } from '../features/exam/reading.ts';
import { answerOf, isFinished, isMock, MOCK_KEY, summarise, type ExamRun } from '../features/exam/run.ts';
import { allQuestionIds } from '../features/exam/sets.ts';
import { stageOf, statsOf, unsureIdsOf, wrongStatsOf } from '../features/exam/stats.ts';
import { recommendedStep, type ExamStep } from '../features/exam/steps.ts';
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
  /** 背題瀏覽讀過的題（題目 ID）；第 1 步與講義卡用 */
  const [readIds, setReadIds] = useState<ReadonlySet<string> | null>(null);
  /** 模擬考的那一輪（進行中或交過卷的）；沒有是 null */
  const [mock, setMock] = useState<ExamRun | null | undefined>(undefined);
  /** 已經拿到的苦練徽章（鍵對取得時間）；判定與補發完成前是 null */
  const [badges, setBadges] = useState<ReadonlyMap<ExamBadgeKey, string> | null>(null);
  /** 這一次打開首頁新拿到的（浮動提示用） */
  const [newBadges, setNewBadges] = useState<readonly ExamBadgeKey[]>([]);
  const badgeText = useExamBadgeText();
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
    void getExamReadDb()
      .all()
      .then(
        (list) => alive && setReadIds(new Set(list.map((m) => m.questionId))),
        () => alive && setReadIds(new Set()),
      );
    void db.getRun('all:handout').then(
      (run) => alive && setResume(run && run.finishedAt === undefined && run.index > 0 ? run : null),
      () => alive && setResume(null),
    );
    void db.getRun(MOCK_KEY).then(
      (run) => alive && setMock(run && isMock(run) ? run : null),
      () => alive && setMock(null),
    );
    return () => {
      alive = false;
    };
  }, []);
  usePageReady(
    state.kind !== 'loading' && states !== null && resume !== undefined && readIds !== null && mock !== undefined && (state.kind !== 'ok' || badges !== null),
  );

  const index = state.kind === 'ok' ? state.index : null;
  // 離線保險：頁面畫好後請 Service Worker 把三份講義檔抓進快取，沒練過的講義離線也開得了
  useEffect(() => (index ? scheduleHandoutPrefetch(index) : undefined), [index]);
  const all = useMemo(() => (index ? allQuestionIds(index) : []), [index]);
  const stats = useMemo(() => statsOf(all, states ?? new Map()), [all, states]);
  // 錯題複習（2026-11-13）：答錯過的題各在哪個階段、今天要練幾題
  const wrongStats = useMemo(() => wrongStatsOf(all, states ?? new Map()), [all, states]);
  const unsureCount = useMemo(() => (states ? [...unsureIdsOf(states)].filter((id) => all.includes(id)).length : 0), [states, all]);

  // 苦練徽章：資料都到齊後判定一次全部，達成而還沒有的寫進進度（補發），再拿來顯示
  const loaded = index !== null && states !== null && readIds !== null && mock !== undefined;
  useEffect(() => {
    if (!index || !states || !readIds || mock === undefined) return;
    let alive = true;
    const done = mock && isFinished(mock) ? summarise(mock) : null;
    void awardExamBadges({
      read: { decks: index.decks.map((d) => d.sections.flatMap((sec) => sec.questionIds)), readIds },
      practice: { total: stats.total, practised: stats.practised, wrong: stats.wrong },
      ...(done ? { mock: { total: done.total, correct: done.correct } } : {}),
    }).then((award) => {
      if (!alive) return;
      setBadges(award.owned);
      if (award.added.length > 0) setNewBadges(award.added);
    });
    return () => {
      alive = false;
    };
    // 只在資料第一次到齊時判定（之後這一頁的資料不會再變）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const topBar = (
    <TopBar
      title={t({ id: 'exam.title', message: '期中考苦練', comment: '苦練區首頁的標題；入口與 Tab 的 also 都用這個名稱' })}
      titleId="ll-exam-title"
      backHref={href('/play/')}
      backLabel={t({ id: 'exam.back', message: '回到闖關地圖', comment: '苦練區頁首返回按鈕的可讀名稱（苦練區在 Tab bar 的「闖關」底下）' })}
      backShortLabel={t({ id: 'exam.back.short', message: '地圖', comment: '苦練區頁首返回按鈕上的短字（必須是「回到闖關地圖」的一部分）' })}
    />
  );
  if (state.kind === 'loading' || states === null || readIds === null || mock === undefined || (state.kind === 'ok' && badges === null)) return topBar;
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
  const total = all.length;
  const totalText = n(total);
  // 讀題的進度與「接著讀」要去哪一題（這裡沒有載題庫，不比對答案版本，數字以背題瀏覽頁為準）
  const readCount = all.filter((id) => readIds.has(id)).length;
  const readText = n(readCount);
  const pos = readExamBrowsePos();
  const lastScope = scopeOf(bank, pos.scope);
  const inLast = resumeTarget(orderOf(bank, lastScope), lastIn(pos, lastScope), readIds);
  // 上次的範圍都讀完了但別份還沒：改看全部
  const readScope = inLast && inLast.kind === 'done' && lastScope !== ALL_SCOPE ? ALL_SCOPE : lastScope;
  const readTarget = readScope === lastScope ? inLast : resumeTarget(orderOf(bank, ALL_SCOPE), pos.last, readIds);
  const readDeck = decks.find((d) => d.sections.some((sec) => readTarget !== null && sec.questionIds.includes(readTarget.id)));
  const readCode = readDeck?.code ?? '';
  const browseHref = (params: Record<string, string>) => {
    const query = new URLSearchParams(params).toString();
    return href('/exam/browse/') + (query ? `?${query}` : '');
  };
  const readGoHref = readTarget && readTarget.kind !== 'done' ? browseHref(browseParams({ scope: readScope, q: readTarget.id })) : browseHref({});
  const step = recommendedStep({ total, read: readCount, practised: stats.practised });
  const mockDone = mock && isFinished(mock) ? summarise(mock) : null;
  // 上次模擬考答錯的題（沒作答的不寫進紀錄，不算）都進了錯題複習：其中還有幾題沒熟練
  const mockWrongIds = mock && mockDone ? mockDone.wrongIds.filter((id) => answerOf(mock, id).chosen !== null) : [];
  const mockOpen = mockWrongIds.filter((id) => {
    const stage = stageOf(states?.get(id));
    return stage === 'fix' || stage === 'review';
  }).length;
  const mockCorrect = n(mockDone?.correct ?? 0);
  const mockTotal = n(mockDone?.total ?? 0);

  /** 步驟卡最上面的一列：「第 N 步」與建議的標籤 */
  const stepHead = (which: ExamStep, no: number) => {
    const stepNo = n(no);
    return (
      <p className="ll-exam-step__head">
        <span className="ll-exam-deck__code ll-num">
          {t({ id: 'exam.step.no', message: `第 ${stepNo} 步`, comment: '苦練首頁步驟卡的小標；stepNo 是 1 到 3' })}
        </span>
        {step === which && (
          <span data-testid="exam-step-recommended">
            <Badge kind="accent">
              {which !== 'read'
                ? t({ id: 'exam.step.next', message: '建議下一步', comment: '苦練首頁：建議的步驟（已經讀過或練過）' })
                : readCount === 0
                  ? t({ id: 'exam.step.start', message: '建議從這裡開始', comment: '苦練首頁：建議的步驟（什麼都還沒做）' })
                  : t({ id: 'exam.step.resume', message: '建議接著讀', comment: '苦練首頁：建議的步驟（讀過一些、還沒作答）' })}
            </Badge>
          </span>
        )}
      </p>
    );
  };

  /** 步驟卡最下面：這一步可以拿到的兩枚徽章 */
  const stepBadges = (which: ExamStep) => (
    <ul className="ll-exam-badges" aria-label={t({ id: 'exam.step.badges', message: '這一步的徽章', comment: '苦練首頁步驟卡裡徽章列的可讀名稱' })}>
      {EXAM_BADGES.filter((b) => b.step === which).map((b) => {
        const owned = badges?.has(b.key) === true;
        const text = badgeText(b.key);
        return (
          <li key={b.key} className="ll-exam-badges__item" data-state={owned ? 'done' : 'locked'} data-testid={`exam-badge-${b.key}`}>
            <ExamBadgeArt step={b.step} tier={b.tier} state={owned ? 'done' : 'locked'} size={32} className="ll-exam-badges__icon" />
            <span className="ll-exam-badges__name">
              {text.title}
              <span className="ll-sr-only">
                {owned
                  ? t({ id: 'exam.badge.owned', message: '（已取得）', comment: '苦練首頁的徽章列：螢幕閱讀器唸的狀態' })
                  : t({ id: 'exam.badge.locked', message: '（未取得）', comment: '苦練首頁的徽章列：螢幕閱讀器唸的狀態' })}
              </span>
            </span>
            <span className="ll-exam-badges__cond">{text.cond}</span>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      {topBar}
      <p className="ll-exam-intro">
        <Trans id="exam.intro" comment="苦練首頁的一句說明">
          只收陳老師三份講義的練習題，題目、選項與解答都照講義；範圍以老師公告為準。
        </Trans>
      </p>
      <p className="ll-exam-route" data-testid="exam-route">
        <Trans id="exam.route" comment="苦練首頁：建議的順序，對應下面三張步驟卡">
          建議的順序：先讀題，再自己練，最後模擬考。
        </Trans>
      </p>

      {/* 第 1 步：先讀題（背題瀏覽）。很多人還沒看過題目，這一步放最上面；主要按鈕直接進閱讀頁 */}
      <Card as="section" className="ll-exam-hero" aria-labelledby="ll-exam-step-read" data-testid="exam-step-read">
        {stepHead('read', 1)}
        <h2 id="ll-exam-step-read" className="ll-exam-hero__title">
          {t({ id: 'exam.step.read.title', message: '先讀題', comment: '苦練首頁第 1 步的標題（背題瀏覽）' })}
        </h2>
        <p className="ll-exam-hero__note">
          {t({
            id: 'exam.step.read.desc',
            message: '還沒看過題目的話從這裡開始：題目、正解與解析一起看，一次一題，不用先作答。可以用關鍵字找題，也可以遮住答案或列印。',
            comment: '苦練首頁第 1 步的說明',
          })}
        </p>
        <div className="ll-exam-hero__progress">
          <ProgressBar size="md" value={readCount} max={total || 1} />
          <span className="ll-exam-hero__count ll-num" data-testid="exam-read-count">
            {readCount === 0
              ? t({ id: 'exam.step.read.untouched', message: '還沒開始讀', comment: '苦練首頁第 1 步的進度：還沒讀過任何一題' })
              : t({ id: 'exam.step.read.count', message: `已讀 ${readText}／${totalText} 題`, comment: '苦練首頁第 1 步的進度；數字已格式化' })}
          </span>
        </div>
        <div className="ll-exam-hero__actions">
          <Button variant={step === 'read' ? 'primary' : 'secondary'} size="md" icon={<PlayIcon />} href={readGoHref} data-testid="exam-read-go">
            {!readTarget || readTarget.kind === 'done'
              ? t({ id: 'exam.step.read.again', message: '再讀一次', comment: '苦練首頁第 1 步的按鈕：全部讀完了，回到題目清單' })
              : readCount === 0
                ? t({ id: 'exam.step.read.go', message: '從第一題開始讀', comment: '苦練首頁第 1 步的按鈕：還沒讀過' })
                : t({
                    id: 'exam.step.read.resume',
                    message: `接著讀（講義 ${readCode}）`,
                    comment: '苦練首頁第 1 步的按鈕：回到上次的進度；readCode 是講義編號',
                  })}
          </Button>
          <Button size="md" icon={<SearchIcon />} href={href('/exam/browse/')} data-testid="exam-more-browse">
            {t({ id: 'exam.step.read.list', message: '題目清單與搜尋', comment: '苦練首頁第 1 步的次要按鈕：背題瀏覽的清單' })}
          </Button>
        </div>
        {stepBadges('read')}
      </Card>

      {/* 第 2 步：再自己練（作答） */}
      <Card as="section" className="ll-exam-hero" aria-labelledby="ll-exam-step-practise" data-testid="exam-step-practise">
        {stepHead('practise', 2)}
        <h2 id="ll-exam-step-practise" className="ll-exam-hero__title">
          {t({ id: 'exam.step.practise.title', message: '再自己練', comment: '苦練首頁第 2 步的標題（作答練習）' })}
        </h2>
        <p className="ll-exam-hero__note">
          {t({
            id: 'exam.step.practise.desc',
            message: '自己作答，答完馬上看對錯與解析；答錯的題會留下來，之後可以只練那些。',
            comment: '苦練首頁第 2 步的說明',
          })}
        </p>
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
          <Button
            variant={step === 'practise' ? 'primary' : 'secondary'}
            size="md"
            icon={<PlayIcon />}
            href={href('/exam/all/')}
            data-testid="exam-start-order"
          >
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
        <div className="ll-exam-wrongbox" data-testid="exam-wrongbox">
          <h3 className="ll-exam-wrongbox__title">{t({ id: 'exam.wrongbox.title', message: '錯題複習', comment: '苦練首頁第 2 步裡的小標：錯題複習' })}</h3>
          <p className="ll-exam-hero__note">
            {t({
              id: 'exam.wrongbox.desc',
              message: '答錯的題會留在這裡安排練習：連續答對兩次才算熟練；反覆答錯的題要連對三次，而且最後一次要在隔天。',
              comment: '苦練首頁錯題複習的說明：熟練的門檻',
            })}
          </p>
          {wrongStats.everWrong > 0 && (
            <div className="ll-exam-hero__progress">
              <ProgressBar size="md" value={wrongStats.mastered} max={wrongStats.everWrong} />
              <span className="ll-exam-hero__count ll-num" data-testid="exam-wrong-counts">
                {t({
                  id: 'exam.wrongbox.counts',
                  message: `待訂正 ${n(wrongStats.fix)} 題、複習中 ${n(wrongStats.review)} 題、已熟練 ${n(wrongStats.mastered)} 題`,
                  comment: '苦練首頁錯題複習的三個階段各幾題；數字都已格式化',
                })}
              </span>
            </div>
          )}
          <div className="ll-exam-hero__actions">
            {wrongStats.due > 0 ? (
              <Button size="md" icon={<BookIcon />} href={href('/exam/wrong/')} data-testid="exam-start-wrong">
                {t({ id: 'exam.start.wrong', message: `練今天的錯題（${n(wrongStats.due)} 題）`, comment: '按鈕：錯題複習今天要練的題；count 已格式化' })}
              </Button>
            ) : (
              <Button size="md" icon={<BookIcon />} disabled data-testid="exam-start-wrong">
                {wrongStats.waiting > 0
                  ? t({
                      id: 'exam.start.wrongTomorrow',
                      message: `今天的錯題練完了（明天再練 ${n(wrongStats.waiting)} 題）`,
                      comment: '按鈕（停用）：今天要練的錯題都練完了；count 是明天再練的題數（已格式化）',
                    })
                  : t({ id: 'exam.start.wrongNone', message: '練今天的錯題（還沒有）', comment: '按鈕（停用）：沒有要練的錯題' })}
              </Button>
            )}
          </div>
        </div>
        <div className="ll-exam-hero__actions">
          <Button size="sm" variant="quiet" icon={<BookmarkIcon />} iconEnd={<ArrowRightIcon />} href={href('/exam/list/')} data-testid="exam-more-list">
            {t({ id: 'exam.step.practise.list', message: '看錯題複習的紀錄', comment: '苦練首頁第 2 步最下面的連結：錯題複習的清單頁' })}
          </Button>
          <Button size="sm" variant="quiet" icon={<RatioIcon />} iconEnd={<ArrowRightIcon />} href={href('/formulas/')} data-testid="exam-more-formulas">
            {t({ id: 'exam.step.practise.formulas', message: '查公式', comment: '苦練首頁第 2 步最下面的連結：會計公式總覽（卡住時查比率怎麼算）' })}
          </Button>
        </div>
        {stepBadges('practise')}
      </Card>

      {/* 第 3 步：最後模擬考 */}
      <Card as="section" className="ll-exam-hero" aria-labelledby="ll-exam-step-mock" data-testid="exam-step-mock">
        {stepHead('mock', 3)}
        <h2 id="ll-exam-step-mock" className="ll-exam-hero__title">
          {t({ id: 'exam.step.mock.title', message: '最後模擬考', comment: '苦練首頁第 3 步的標題' })}
        </h2>
        <p className="ll-exam-hero__note">
          {t({
            id: 'exam.step.mock.desc',
            message: '像考試一樣：作答中不顯示對錯，交卷後一次看成績與解析。範圍、題數與每題時間自己選。',
            comment: '苦練首頁第 3 步的說明',
          })}
        </p>
        {mockDone && (
          <p className="ll-exam-hero__note ll-num" data-testid="exam-mock-last">
            {t({
              id: 'exam.step.mock.last',
              message: `上次模擬考：答對 ${mockCorrect}／${mockTotal} 題`,
              comment: '苦練首頁第 3 步：上一次交卷的成績；數字已格式化',
            })}
          </p>
        )}
        {mockWrongIds.length > 0 && (
          <p className="ll-exam-hero__note ll-num" data-testid="exam-mock-wrong-note">
            {mockOpen > 0
              ? t({
                  id: 'exam.step.mock.wrongOpen',
                  message: `上次答錯的 ${n(mockWrongIds.length)} 題已放進錯題複習，還有 ${n(mockOpen)} 題沒熟練。`,
                  comment: '苦練首頁第 3 步：上次模擬考答錯的題進了錯題複習，其中還沒熟練的題數；數字都已格式化',
                })
              : t({
                  id: 'exam.step.mock.wrongDone',
                  message: `上次答錯的 ${n(mockWrongIds.length)} 題都練到熟練了。`,
                  comment: '苦練首頁第 3 步：上次模擬考答錯的題都已經熟練；count 已格式化',
                })}
          </p>
        )}
        <div className="ll-exam-hero__actions">
          <Button variant={step === 'mock' ? 'primary' : 'secondary'} size="md" icon={<TimerIcon />} href={href('/exam/mock/')} data-testid="exam-more-mock">
            {mockDone
              ? t({ id: 'exam.step.mock.result', message: '看成績，或再考一次', comment: '苦練首頁第 3 步的按鈕：上一次已經交卷' })
              : mock
                ? t({ id: 'exam.step.mock.resume', message: '回到進行中的模擬考', comment: '苦練首頁第 3 步的按鈕：有還沒交卷的模擬考' })
                : t({ id: 'exam.step.mock.go', message: '開始模擬考', comment: '苦練首頁第 3 步的按鈕' })}
          </Button>
          {mockOpen > 0 && (
            <Button size="md" variant="quiet" icon={<BookIcon />} href={href('/exam/wrong/')} data-testid="exam-mock-to-wrong">
              {t({ id: 'exam.step.mock.toWrong', message: '到錯題複習訂正', comment: '苦練首頁第 3 步的按鈕：上次模擬考答錯的題還沒熟練，連到錯題複習' })}
            </Button>
          )}
        </div>
        {stepBadges('mock')}
      </Card>

      <h2 className="ll-exam-decks">{t({ id: 'exam.decks.title', message: '各份講義', comment: '苦練首頁：三張講義卡上面的標題' })}</h2>
      {decks.map((d) => {
        const ids = d.sections.flatMap((s) => s.questionIds);
        const ds = statsOf(ids, states);
        const deckRead = n(ids.filter((id) => readIds.has(id)).length);
        const deckTotal = n(ds.total);
        const deckPractised = n(ds.practised);
        const deckMastered = n(ds.mastered);
        return (
          <Card as="section" key={d.id} className="ll-exam-deck" aria-labelledby={`ll-exam-deck-${d.id}`} data-testid={`exam-deck-${d.id}`}>
            <p className="ll-exam-deck__code ll-num">
              {t({ id: 'exam.deck.code', message: `講義 ${d.code}`, comment: '講義卡的小標；code 是講義編號，例如 0-1' })}
            </p>
            <h3 id={`ll-exam-deck-${d.id}`} className="ll-exam-deck__title" lang="zh-TW">
              {d.title}
            </h3>
            <div className="ll-exam-deck__progress">
              <ProgressBar size="sm" value={ds.practised} max={ds.total || 1} />
              <span className="ll-exam-deck__count ll-num" data-testid={`exam-deck-count-${d.id}`}>
                {t({
                  id: 'exam.deck.counts',
                  message: `已讀 ${deckRead}／${deckTotal} 題，練過 ${deckPractised}／${deckTotal} 題，熟練 ${deckMastered}`,
                  comment: '講義卡的進度：背題瀏覽讀了幾題、作答練過幾題、熟練（連續答對兩次）幾題；數字已格式化',
                })}
              </span>
            </div>
            <div className="ll-exam-deck__actions">
              <Button size="sm" icon={<CardsIcon />} href={browseHref(browseParams({ scope: d.id }))} data-testid={`exam-deck-read-${d.id}`}>
                {t({ id: 'exam.deck.read', message: '讀這份講義', comment: '講義卡的按鈕：到背題瀏覽並選好這一份' })}
              </Button>
              <Button size="sm" icon={<PlayIcon />} href={href(`/exam/${d.id}/`)}>
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

      <div className="ll-exam-hero__actions">
        <Button size="sm" variant="quiet" iconEnd={<ArrowRightIcon />} href={href('/me/badges/')} data-testid="exam-badges-link">
          {t({ id: 'exam.badges.link', message: '看全部徽章', comment: '苦練首頁最下面的連結：到「我的」的徽章頁' })}
        </Button>
      </div>
      <ExamBadgeToast keys={newBadges} onDismiss={() => setNewBadges([])} />
      <p className="ll-exam-hero__note" data-testid="exam-notes">
        <Trans id="exam.note.records" comment="苦練首頁頁尾的說明：兩種紀錄各自存在哪裡">
          作答的紀錄存在這台裝置上，匯出備份時會一起帶走；已讀的紀錄目前只在這台裝置，還不會跟著備份。
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
    </>
  );
}
