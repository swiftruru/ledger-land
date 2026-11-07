// 模擬考（M4c 第二批的第二次交付，2026-11-05；02 第 1.1 節）：/exam/mock/，同一條路由三個畫面，由 ledgerland-exam 裡鍵是 mock 的那一輪決定。
// 設定：範圍（全部或一份講義）、題數（40、50、100；維護者 2026-11-07 的決定）、每題秒數（不限時、45、60、90；維護者的決定：由學生在開頭自己選），選的存在裝置上。
// 作答：隨機抽題，不顯示對錯、沒有回饋，可以上一題、下一題與改選；限時的場次題號列右邊倒數，時間照牆上的鐘走（離開頁面不暫停），時間到自動交卷。
// 交卷後：成績、用時、未作答題數，逐題可展開看我選的、正解與解析（HandoutQuestionReadout）。作答算進同一份紀錄（錯過的題、熟練），
// 沒選的題算錯但不寫進紀錄。成績留到下一場開始或按「換設定」為止。noindex，作答中不跳更新提示。
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatNumber, formatPercent, localePath } from '@ledgerland/i18n';
import {
  Badge,
  BookIcon,
  Button,
  Card,
  CaretLeftIcon,
  ConfirmSheet,
  Disclosure,
  ErrorState,
  GearIcon,
  HouseIcon,
  PlayIcon,
  RetryIcon,
  Segmented,
  TimerIcon,
  TopBar,
} from '@ledgerland/web-ui';
import { awardExamBadges } from '../features/badges/award-exam.ts';
import type { ExamBadgeKey } from '../features/badges/exam.ts';
import { ExamBadgeToast } from '../features/badges/ExamBadgeToast.tsx';
import { getExamDb, nextState, type QuestionState } from '../features/exam/db.ts';
import { HandoutQuestionCard } from '../features/exam/HandoutQuestionCard.tsx';
import { HandoutQuestionReadout } from '../features/exam/HandoutQuestionReadout.tsx';
import {
  MOCK_COUNT_OPTIONS,
  SECONDS_OPTIONS,
  encodeMockSettings,
  limitOf,
  parseMockSettings,
  type MockCountOption,
  type MockSettings,
  type SecondsOption,
} from '../features/exam/options.ts';
import { readExamMockSettings, readExamShuffle, writeExamMockSettings } from '../features/exam/prefs.ts';
import {
  MOCK_KEY,
  answerOf,
  chosenCount,
  currentQuestionId,
  gotoQuestion,
  isExpired,
  isFinished,
  isMock,
  remainingSeconds,
  restoreRun,
  selectMock,
  startRun,
  submitRun,
  summarise,
  usedSeconds,
  type ExamRun,
} from '../features/exam/run.ts';
import { FormulaPills, useFormulasOfQuestions } from '../features/formulas/FormulaPills.tsx';
import { loadHandoutDeck, loadHandoutIndex, type HandoutManifestEntry, type HandoutQuestionSnapshot } from '../lib/content.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { useLocale } from '../lib/useLocale.ts';
import '../styles/exam.css';

/** runs store 的鍵：一次只有一場模擬考 */
/** 剩這麼多秒時用 aria-live 提醒一次（和關卡計時一樣是 1 分鐘） */
const WARN_SECONDS = 60;

type Questions = ReadonlyMap<string, HandoutQuestionSnapshot>;
type View =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'setup'; index: HandoutManifestEntry }
  | { kind: 'run'; index: HandoutManifestEntry; run: ExamRun; questions: Questions; resumed: boolean }
  | { kind: 'result'; index: HandoutManifestEntry; run: ExamRun; questions: Questions; expired: boolean };

async function loadQuestions(index: HandoutManifestEntry, wanted: (id: string) => boolean): Promise<Map<string, HandoutQuestionSnapshot>> {
  const decks = index.decks.filter((d) => d.sections.some((s) => s.questionIds.some(wanted)));
  const files = await Promise.all(decks.map((d) => loadHandoutDeck(d.id)));
  return new Map(
    files
      .flatMap((f) => f.questions)
      .filter((q) => wanted(q.id))
      .map((q) => [q.id, q] as const),
  );
}

export default function ExamMock() {
  const { t } = useLingui();
  const locale = useLocale();
  // 成績畫面逐題的「相關公式」膠囊（作答中不顯示）
  const formulasOf = useFormulasOfQuestions();
  const href = (p: string) => localePath(locale, p);
  const n = (x: number) => formatNumber(x, locale);
  const db = getExamDb();
  const [view, setView] = useState<View>({ kind: 'loading' });
  /** 這一次交卷而新拿到的苦練徽章（浮動提示用） */
  const [newBadges, setNewBadges] = useState<readonly ExamBadgeKey[]>([]);
  // 模擬考的兩枚徽章：成績出來時判定（features/badges/exam.ts；交卷、時間到自動交卷、回來看上次的成績都會到這裡）
  const resultRun = view.kind === 'result' ? view.run : null;
  useEffect(() => {
    if (!resultRun) return;
    let alive = true;
    const sum = summarise(resultRun);
    void awardExamBadges({ mock: { total: sum.total, correct: sum.correct } }).then((award) => {
      if (alive && award.added.length > 0) setNewBadges(award.added);
    });
    return () => {
      alive = false;
    };
  }, [resultRun]);
  const [settings, setSettings] = useState<MockSettings>(readExamMockSettings);
  const [shuffle] = useState(readExamShuffle);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | 'wrong'>('all');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [live, setLive] = useState('');
  const states = useRef(new Map<string, QuestionState>());
  const warned = useRef(false);

  /** 交卷：判完、把作答過的題寫進紀錄（沒選的不寫）、存回這一輪 */
  const finish = useCallback(
    async (run: ExamRun, questions: Questions, expired: boolean): Promise<ExamRun> => {
      const at = expired && run.deadlineAt ? run.deadlineAt : new Date().toISOString();
      const done = submitRun(run, questions, at);
      for (const id of done.questionIds) {
        const a = answerOf(done, id);
        const q = questions.get(id);
        if (a.chosen === null || !q) continue;
        const ns = nextState(states.current.get(id), id, q.answerRev, a.correct === true, at, a.chosen);
        states.current.set(id, ns);
        await db.putState(ns).catch(() => {});
        await db
          .addAttempt({
            id: `${run.runId}-${id}`,
            questionId: id,
            rev: q.rev,
            answerRev: q.answerRev,
            setId: MOCK_KEY,
            chosen: a.chosen,
            correct: a.correct === true,
            at,
          })
          .catch(() => {});
      }
      await db.putRun(done).catch(() => {});
      return done;
    },
    [db],
  );

  useEffect(() => {
    let alive = true;
    (async (): Promise<View> => {
      const index = await loadHandoutIndex();
      if (!index) return { kind: 'error' };
      const list = await db.allStates().catch(() => [] as QuestionState[]);
      states.current = new Map(list.map((s) => [s.questionId, s]));
      const stored = await db.getRun(MOCK_KEY).catch(() => undefined);
      if (!stored || !isMock(stored)) return { kind: 'setup', index };
      const ids = new Set(stored.questionIds);
      const questions = await loadQuestions(index, (id) => ids.has(id));
      const restored = restoreRun(stored, questions);
      if (!restored) {
        await db.deleteRun(MOCK_KEY).catch(() => {});
        return { kind: 'setup', index };
      }
      if (isFinished(restored.run)) return { kind: 'result', index, run: restored.run, questions, expired: false };
      if (isExpired(restored.run, Date.now())) return { kind: 'result', index, run: await finish(restored.run, questions, true), questions, expired: true };
      if (restored.run !== stored) await db.putRun(restored.run).catch(() => {});
      return { kind: 'run', index, run: restored.run, questions, resumed: true };
    })().then(
      (v) => alive && setView(v),
      () => alive && setView({ kind: 'error' }),
    );
    return () => {
      alive = false;
    };
  }, [db, finish]);
  usePageReady(view.kind !== 'loading');

  // 限時的場次每秒看一次鐘；分頁切回來時馬上對時
  const ticking = view.kind === 'run' && view.run.deadlineAt !== undefined;
  useEffect(() => {
    if (!ticking) return;
    const tick = () => setNowMs(Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [ticking]);
  const remaining = view.kind === 'run' ? remainingSeconds(view.run, nowMs) : null;
  useEffect(() => {
    if (view.kind !== 'run' || remaining === null) return;
    if (remaining === 0) {
      if (busy) return;
      setBusy(true);
      setConfirming(false);
      void finish(view.run, view.questions, true).then((done) => {
        setBusy(false);
        setView({ kind: 'result', index: view.index, run: done, questions: view.questions, expired: true });
      });
    } else if (remaining <= WARN_SECONDS && !warned.current) {
      warned.current = true;
      setLive(t({ id: 'exam.mock.oneMinute', message: '剩不到 1 分鐘', comment: '模擬考：剩一分鐘內時給螢幕閱讀器的提醒（只播一次）' }));
    }
  }, [remaining, view, busy, finish, t]);

  const topBar = (
    <TopBar
      title={t({ id: 'exam.mock.title', message: '模擬考', comment: '模擬考頁的標題；苦練首頁的入口也用這個名稱' })}
      titleId="ll-exam-mock-title"
      backHref={href('/exam/')}
      backLabel={t({ id: 'exam.run.back', message: '回到期中考苦練' })}
      backShortLabel={t({ id: 'exam.run.back.short', message: '苦練' })}
    />
  );
  if (view.kind === 'loading') return topBar;
  if (view.kind === 'error')
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

  const { index } = view;
  const decks = [...index.decks].sort((a, b) => a.order - b.order);
  const idsOf = (scope: string): string[] => decks.filter((d) => scope === 'all' || d.id === scope).flatMap((d) => d.sections.flatMap((s) => s.questionIds));
  const start = async (wanted: MockSettings) => {
    if (busy) return;
    setBusy(true);
    try {
      const scope = wanted.scope === 'all' || decks.some((d) => d.id === wanted.scope) ? wanted.scope : 'all';
      const chosen: MockSettings = { ...wanted, scope };
      writeExamMockSettings(chosen);
      setSettings(chosen);
      const ids = new Set(idsOf(scope));
      const questions = await loadQuestions(index, (id) => ids.has(id));
      const pool = idsOf(scope)
        .map((id) => questions.get(id))
        .filter((q): q is HandoutQuestionSnapshot => q !== undefined);
      const run = startRun({
        key: MOCK_KEY,
        questions: pool,
        order: 'random',
        bankRev: index.rev,
        limit: limitOf(chosen.count, pool.length),
        mode: 'mock',
        secondsPerQuestion: chosen.seconds,
        settings: encodeMockSettings(chosen),
      });
      await db.putRun(run).catch(() => {});
      warned.current = false;
      setLive('');
      setFilter('all');
      setNowMs(Date.now());
      setView({ kind: 'run', index, run, questions, resumed: false });
    } catch {
      setView({ kind: 'error' });
    } finally {
      setBusy(false);
    }
  };
  const toSetup = () => {
    void db.deleteRun(MOCK_KEY).catch(() => {});
    setConfirming(false);
    setView({ kind: 'setup', index });
  };
  const clock = (seconds: number): string => {
    const m = n(Math.floor(seconds / 60));
    const s = n(seconds % 60);
    return seconds >= 60
      ? t({ id: 'exam.mock.clock', message: `${m} 分 ${s} 秒`, comment: '模擬考的時間長度；m、s 是已格式化的分與秒' })
      : t({ id: 'exam.mock.clockSeconds', message: `${s} 秒`, comment: '模擬考不到一分鐘的時間長度；s 是已格式化的秒數' });
  };

  // ---- 設定 ----
  if (view.kind === 'setup') {
    const total = limitOf(settings.count, idsOf(settings.scope).length);
    const pick = (patch: Partial<MockSettings>) => setSettings((s) => ({ ...s, ...patch }));
    return (
      <>
        {topBar}
        <p className="ll-exam-intro">
          <Trans id="exam.mock.intro" comment="模擬考設定畫面開頭的說明">
            從講義題庫隨機抽題。作答中不顯示對錯，交卷後一次看成績與每一題的解析；作答會算進錯過的題與熟練。
          </Trans>
        </p>
        <Card as="section" className="ll-exam-hero" aria-labelledby="ll-exam-mock-setup" data-testid="exam-mock-setup">
          <h2 id="ll-exam-mock-setup" className="ll-exam-hero__title">
            {t({ id: 'exam.mock.setup', message: '這一場怎麼考', comment: '模擬考設定卡的標題' })}
          </h2>
          <div className="ll-exam-mock__field">
            <span id="ll-exam-mock-scope" className="ll-exam-hero__random-label">
              {t({ id: 'exam.mock.scope', message: '範圍', comment: '模擬考設定：要考哪些講義' })}
            </span>
            <Segmented<string>
              value={settings.scope}
              labelledBy="ll-exam-mock-scope"
              onChange={(scope) => pick({ scope })}
              options={[
                { value: 'all', label: t({ id: 'exam.mock.scope.all', message: '三份講義', comment: '模擬考範圍：全部講義' }) },
                ...decks.map((d) => ({
                  value: d.id,
                  label: <span className="ll-num">{d.code}</span>,
                  ariaLabel: t({ id: 'exam.deck.code', message: `講義 ${d.code}` }),
                })),
              ]}
            />
          </div>
          <div className="ll-exam-mock__field">
            <span id="ll-exam-mock-count" className="ll-exam-hero__random-label">
              {t({ id: 'exam.mock.count', message: '題數', comment: '模擬考設定：抽幾題' })}
            </span>
            <Segmented<string>
              value={String(settings.count)}
              labelledBy="ll-exam-mock-count"
              onChange={(v) => pick({ count: MOCK_COUNT_OPTIONS.find((c) => String(c) === v) as MockCountOption })}
              options={MOCK_COUNT_OPTIONS.map((c) => ({
                value: String(c),
                label: <span className="ll-num">{n(c)}</span>,
              }))}
            />
          </div>
          <div className="ll-exam-mock__field">
            <span id="ll-exam-mock-seconds" className="ll-exam-hero__random-label">
              {t({ id: 'exam.mock.seconds', message: '每題時間', comment: '模擬考設定：每一題給幾秒（整場的時間是題數乘上它）' })}
            </span>
            <Segmented<string>
              value={String(settings.seconds)}
              labelledBy="ll-exam-mock-seconds"
              onChange={(v) => pick({ seconds: SECONDS_OPTIONS.find((s) => String(s) === v) as SecondsOption })}
              options={SECONDS_OPTIONS.map((s) => ({
                value: String(s),
                label:
                  s === 0 ? (
                    t({ id: 'exam.mock.untimed', message: '不限時', comment: '模擬考每題時間的選項：不計時' })
                  ) : (
                    <span className="ll-num">
                      {t({ id: 'exam.mock.secondsOption', message: `${n(s)} 秒`, comment: '模擬考每題時間的選項；s 是已格式化的秒數' })}
                    </span>
                  ),
              }))}
            />
          </div>
          <p className="ll-exam-hero__note ll-num" data-testid="exam-mock-plan">
            {settings.seconds === 0
              ? t({ id: 'exam.mock.plan.untimed', message: `共 ${n(total)} 題，不限時。`, comment: '模擬考設定的小結；total 已格式化' })
              : t({
                  id: 'exam.mock.plan.timed',
                  message: `共 ${n(total)} 題，限時 ${clock(total * settings.seconds)}，時間到自動交卷。`,
                  comment: '模擬考設定的小結；total 已格式化，time 是整場的時間長度',
                })}
          </p>
          <div className="ll-exam-hero__actions">
            <Button variant="primary" size="lg" icon={<PlayIcon />} busy={busy} onClick={() => void start(settings)} data-testid="exam-mock-start">
              {t({ id: 'exam.mock.start', message: '開始模擬考', comment: '模擬考設定畫面的主按鈕' })}
            </Button>
          </div>
        </Card>
      </>
    );
  }

  const { run, questions } = view;
  // ---- 成績 ----
  if (view.kind === 'result') {
    const sum = summarise(run);
    const used = usedSeconds(run) ?? 0;
    const wrongAnswered = sum.wrongIds.filter((id) => answerOf(run, id).chosen !== null).length;
    const shown = run.questionIds.map((id, i) => ({ id, no: i + 1 })).filter(({ id }) => filter === 'all' || answerOf(run, id).correct !== true);
    return (
      <>
        {topBar}
        <ExamBadgeToast keys={newBadges} onDismiss={() => setNewBadges([])} />
        <Card as="section" className="ll-exam-summary" aria-labelledby="ll-exam-mock-result" data-testid="exam-mock-result">
          <h2 id="ll-exam-mock-result" className="ll-exam-summary__title">
            {t({ id: 'exam.mock.result', message: '模擬考成績', comment: '模擬考成績卡的標題' })}
          </h2>
          {view.expired && (
            <p className="ll-exam-resume" role="status" data-testid="exam-mock-expired">
              {t({ id: 'exam.mock.expired', message: '時間到，已自動交卷。', comment: '模擬考：限時到了自動交卷的提示' })}
            </p>
          )}
          <p className="ll-exam-summary__score ll-num" data-testid="exam-mock-score">
            {t({
              id: 'exam.mock.score',
              message: `答對 ${n(sum.correct)}／${n(sum.total)} 題（${formatPercent(sum.total === 0 ? 0 : sum.correct / sum.total, locale, { digits: 0 })}）`,
              comment: '模擬考的成績；數字與百分比都已格式化',
            })}
          </p>
          <p className="ll-exam-hero__note ll-num" data-testid="exam-mock-detail">
            {t({ id: 'exam.mock.used', message: `用時 ${clock(used)}`, comment: '模擬考成績卡：用了多久；time 是時間長度' })}
            {sum.unanswered > 0 &&
              t({
                id: 'exam.mock.unanswered',
                message: `，${n(sum.unanswered)} 題沒作答（算答錯，不進紀錄）`,
                comment: '模擬考成績卡：接在用時後面；count 已格式化',
              })}
          </p>
          <div className="ll-exam-summary__actions">
            <Button
              variant="primary"
              size="md"
              icon={<RetryIcon />}
              busy={busy}
              onClick={() => void start(parseMockSettings(run.settings))}
              data-testid="exam-mock-again"
            >
              {t({ id: 'exam.mock.again', message: '再考一次', comment: '模擬考成績卡的按鈕：用同樣的設定再抽一場' })}
            </Button>
            {wrongAnswered > 0 && (
              <Button size="md" icon={<BookIcon />} href={href('/exam/wrong/')} data-testid="exam-mock-wrong">
                {t({ id: 'exam.summary.retryWrong', message: `再練錯的（${n(wrongAnswered)} 題）` })}
              </Button>
            )}
            <Button size="md" variant="quiet" icon={<GearIcon />} onClick={toSetup} data-testid="exam-mock-resetup">
              {t({ id: 'exam.mock.resetup', message: '換設定', comment: '模擬考成績卡的按鈕：回到設定畫面（這一場的成績不再保留）' })}
            </Button>
            <Button size="md" variant="quiet" icon={<HouseIcon />} href={href('/exam/')}>
              {t({ id: 'exam.run.home', message: '回到苦練首頁' })}
            </Button>
          </div>
          <div className="ll-exam-mock__field">
            <Segmented<'all' | 'wrong'>
              value={filter}
              onChange={setFilter}
              label={t({ id: 'exam.mock.filter', message: '要看哪些題', comment: '模擬考成績卡：逐題清單的篩選' })}
              options={[
                { value: 'all', label: t({ id: 'exam.browse.deck.all', message: `全部 ${n(sum.total)}` }) },
                {
                  value: 'wrong',
                  label: t({ id: 'exam.mock.filter.wrong', message: `答錯與沒作答 ${n(sum.wrongIds.length)}`, comment: '模擬考成績卡的篩選；count 已格式化' }),
                },
              ]}
            />
          </div>
          <div className="ll-exam-summary__wrong" data-testid="exam-mock-items">
            {shown.map(({ id, no }) => {
              const q = questions.get(id);
              if (!q) return null;
              const a = answerOf(run, id);
              return (
                <Disclosure
                  key={id}
                  variant="plain"
                  summary={
                    <>
                      <span className="ll-num">{n(no)}.</span> <span lang="zh-TW">{q.topic}</span>
                    </>
                  }
                  trailing={
                    a.correct === true ? (
                      <Badge kind="success">{t({ id: 'exam.mock.item.correct', message: '答對', comment: '模擬考逐題清單的標籤' })}</Badge>
                    ) : a.chosen === null ? (
                      <Badge kind="warning">{t({ id: 'exam.mock.item.blank', message: '沒作答', comment: '模擬考逐題清單的標籤' })}</Badge>
                    ) : (
                      <Badge kind="danger">{t({ id: 'exam.mock.item.wrong', message: '答錯', comment: '模擬考逐題清單的標籤' })}</Badge>
                    )
                  }
                >
                  <HandoutQuestionReadout q={q} heading={false} chosen={a.chosen}>
                    <FormulaPills questionId={q.id} formulas={formulasOf} />
                  </HandoutQuestionReadout>
                </Disclosure>
              );
            })}
          </div>
        </Card>
      </>
    );
  }

  // ---- 作答中 ----
  const update = (fn: (r: ExamRun) => ExamRun) =>
    setView((v) => {
      if (v.kind !== 'run') return v;
      const next = fn(v.run);
      if (next !== v.run) void db.putRun(next).catch(() => {});
      return { ...v, run: next, resumed: false };
    });
  const qid = currentQuestionId(run)!;
  const q = questions.get(qid)!;
  const last = run.index === run.questionIds.length - 1;
  const answered = chosenCount(run);
  const blank = run.questionIds.length - answered;
  const submit = () => {
    if (busy) return;
    setBusy(true);
    void finish(run, questions, false).then((done) => {
      setBusy(false);
      setConfirming(false);
      setView({ kind: 'result', index, run: done, questions, expired: false });
    });
  };
  return (
    <>
      {topBar}
      {view.resumed && (
        <p className="ll-exam-resume" role="status" data-testid="exam-mock-resume">
          {t({ id: 'exam.mock.resumed', message: '接續上次的模擬考；限時的場次時間照走。', comment: '模擬考：回來時接續上次沒交卷的一場' })}{' '}
          <Button size="sm" variant="quiet" icon={<RetryIcon />} onClick={toSetup} data-testid="exam-mock-abandon">
            {t({ id: 'exam.mock.abandon', message: '放棄重來', comment: '模擬考：丟掉這一場，回到設定畫面' })}
          </Button>
        </p>
      )}
      <p className="ll-exam-resume ll-num" data-testid="exam-mock-status">
        {t({ id: 'exam.mock.answered', message: `已作答 ${n(answered)}／${n(run.questionIds.length)} 題`, comment: '模擬考作答中的進度；數字已格式化' })}
      </p>
      <div className="ll-question-wrap" data-ready="true">
        <HandoutQuestionCard
          key={qid}
          mode="mock"
          q={q}
          answer={{ chosen: answerOf(run, qid).chosen, checked: false }}
          shuffle={shuffle}
          runId={run.runId}
          index={run.index + 1}
          total={run.questionIds.length}
          onSelect={(letter) => update((r) => selectMock(r, qid, letter))}
          onCheck={() => (last ? setConfirming(true) : update((r) => gotoQuestion(r, r.index + 1)))}
          onNext={() => {}}
          scrollOnMount={false}
          submitLabel={
            last
              ? t({ id: 'exam.mock.submit', message: '交卷', comment: '模擬考：交卷按鈕' })
              : t({ id: 'exam.mock.next', message: '下一題', comment: '模擬考：到下一題（不判分，可以沒選就跳過）' })
          }
          {...(remaining === null
            ? {}
            : {
                meta: (
                  <span className="ll-exam-mock__timer ll-num" data-testid="exam-mock-timer">
                    <TimerIcon size={18} />
                    {t({ id: 'exam.mock.remaining', message: `剩 ${clock(remaining)}`, comment: '模擬考的倒數；time 是時間長度' })}
                  </span>
                ),
              })}
        />
      </div>
      <div className="ll-exam-mock__nav">
        <Button
          variant="quiet"
          icon={<CaretLeftIcon />}
          disabled={run.index === 0}
          onClick={() => update((r) => gotoQuestion(r, r.index - 1))}
          data-testid="exam-mock-prev"
        >
          {t({ id: 'exam.mock.prev', message: '上一題', comment: '模擬考：回上一題（可以改選）' })}
        </Button>
        {!last && (
          <Button onClick={() => setConfirming(true)} data-testid="exam-mock-submit">
            {t({ id: 'exam.mock.submit', message: '交卷' })}
          </Button>
        )}
      </div>
      <span role="status" aria-live="polite" className="ll-sr-only">
        {live}
      </span>
      <ConfirmSheet
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={submit}
        destructive={false}
        busy={busy}
        title={t({ id: 'exam.mock.confirm.title', message: '要交卷嗎？', comment: '模擬考交卷確認面板的標題' })}
        description={
          blank > 0
            ? t({
                id: 'exam.mock.confirm.blank',
                message: `還有 ${n(blank)} 題沒作答，交卷後算答錯。交卷後不能再改。`,
                comment: '模擬考交卷確認；count 已格式化',
              })
            : t({ id: 'exam.mock.confirm.done', message: '每一題都作答了。交卷後不能再改，會顯示成績與每一題的解析。', comment: '模擬考交卷確認：全部作答' })
        }
        confirmLabel={t({ id: 'exam.mock.submit', message: '交卷' })}
        data-testid="exam-mock-confirm"
      />
    </>
  );
}
