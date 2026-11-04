// 期中考苦練的練習頁（M4c，02 第 1.1 節）：/exam/<setId>/，?order=random 隨機（全部題目時抽 20 題）。只抓這個題組要的講義檔；
// 有進行中的一輪就沿用（features/exam/run.ts 的 restoreRun：題庫改版的題作廢重答），沒有就開新的一輪；每一次確認都寫進 ledgerland-exam。
// 題目卡是 features/exam/HandoutQuestionCard.tsx；練完是總結卡（答對幾題、答錯的題可展開看解析、再練錯的、再練一次）。
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { formatNumber, localePath } from '@ledgerland/i18n';
import { BookIcon, Button, Card, Disclosure, ErrorState, HouseIcon, PlayIcon, RetryIcon, TopBar } from '@ledgerland/web-ui';
import { getExamDb, nextState, type QuestionState } from '../features/exam/db.ts';
import { HandoutQuestionCard } from '../features/exam/HandoutQuestionCard.tsx';
import { HandoutText } from '../features/exam/HandoutText.tsx';
import { readExamShuffle } from '../features/exam/prefs.ts';
import {
  answerOf,
  checkAnswer,
  currentQuestionId,
  isFinished,
  nextQuestion,
  restoreRun,
  selectAnswer,
  startRun,
  summarise,
  type ExamOrder,
  type ExamRun,
} from '../features/exam/run.ts';
import { isSetId, resolveSet, type ExamSet } from '../features/exam/sets.ts';
import { wrongIdsOf } from '../features/exam/stats.ts';
import { loadHandoutDeck, loadHandoutIndex, type HandoutQuestionSnapshot } from '../lib/content.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { useLocale } from '../lib/useLocale.ts';
import '../styles/exam.css';

const RANDOM_LIMIT = 20;

type State =
  | { kind: 'loading' }
  | { kind: 'notfound' }
  | { kind: 'empty'; set: ExamSet }
  | { kind: 'error' }
  | { kind: 'ok'; set: ExamSet; bankRev: number; questions: ReadonlyMap<string, HandoutQuestionSnapshot>; run: ExamRun; resumed: boolean; revised: number };

export default function ExamRun() {
  const { t } = useLingui();
  const locale = useLocale();
  const { setId = '' } = useParams();
  const [search] = useSearchParams();
  const order: ExamOrder = search.get('order') === 'random' ? 'random' : 'handout';
  const key = `${setId}:${order}`;
  const href = (p: string) => localePath(locale, p);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [states, setStates] = useState<Map<string, QuestionState>>(new Map());
  const [freshConfirm, setFreshConfirm] = useState<string | null>(null);
  const [shuffle] = useState(readExamShuffle);
  const db = getExamDb();

  useEffect(() => {
    let alive = true;
    setState({ kind: 'loading' });
    (async () => {
      const index = await loadHandoutIndex();
      if (!index || !isSetId(setId)) return { kind: 'notfound' } as State;
      const list = await db.allStates().catch(() => [] as QuestionState[]);
      const map = new Map(list.map((s) => [s.questionId, s]));
      if (alive) setStates(map);
      const set = resolveSet(index, setId, wrongIdsOf(map));
      if (!set) return { kind: 'notfound' } as State;
      if (set.questionIds.length === 0) return { kind: 'empty', set } as State;
      const decks = await Promise.all(set.deckIds.map((d) => loadHandoutDeck(d)));
      const all = new Map(decks.flatMap((d) => d.questions).map((q) => [q.id, q] as const));
      const wanted = set.questionIds.filter((id) => all.has(id));
      const questions = new Map(wanted.map((id) => [id, all.get(id)!] as const));
      const existing = await db.getRun(key).catch(() => undefined);
      const restored = existing ? restoreRun(existing, questions) : null;
      if (restored) {
        if (restored.revised.length > 0 || restored.run !== existing) await db.putRun(restored.run).catch(() => {});
        return {
          kind: 'ok',
          set,
          bankRev: index.rev,
          questions,
          run: restored.run,
          resumed: !isFinished(restored.run) && restored.run.index > 0,
          revised: restored.revised.length,
        } as State;
      }
      const run = startRun({
        key,
        questions: wanted.map((id) => questions.get(id)!),
        order,
        bankRev: index.rev,
        ...(order === 'random' ? { limit: RANDOM_LIMIT } : {}),
      });
      await db.putRun(run).catch(() => {});
      return { kind: 'ok', set, bankRev: index.rev, questions, run, resumed: false, revised: 0 } as State;
    })().then(
      (s) => alive && setState(s),
      () => alive && setState({ kind: 'error' }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  usePageReady(state.kind !== 'loading');

  const update = useCallback(
    (fn: (run: ExamRun) => ExamRun) => {
      setState((s) => {
        if (s.kind !== 'ok') return s;
        const run = fn(s.run);
        if (run !== s.run) void db.putRun(run).catch(() => {});
        return { ...s, run, resumed: false };
      });
    },
    [db],
  );

  const setTitle = (set: ExamSet) =>
    set.kind === 'all'
      ? t({ id: 'exam.set.all', message: '全部題目', comment: '練習頁的標題：全部題目' })
      : set.kind === 'wrong'
        ? t({ id: 'exam.set.wrong', message: '錯過的題', comment: '練習頁的標題：只練錯過的' })
        : set.kind === 'deck'
          ? t({ id: 'exam.set.deck', message: `講義 ${set.deck!.code}`, comment: '練習頁的標題：一份講義；code 是講義編號' })
          : (set.title ?? '');
  const topBar = (title: string) => (
    <TopBar
      title={<span lang={state.kind === 'ok' && state.set.kind === 'section' ? 'zh-TW' : undefined}>{title}</span>}
      titleId="ll-exam-run-title"
      backHref={href('/exam/')}
      backLabel={t({ id: 'exam.run.back', message: '回到期中考苦練', comment: '練習頁頁首返回按鈕的可讀名稱' })}
      backShortLabel={t({ id: 'exam.run.back.short', message: '苦練', comment: '練習頁頁首返回按鈕上的短字（必須是「回到期中考苦練」的一部分）' })}
    />
  );

  if (state.kind === 'loading') return topBar(t({ id: 'exam.title', message: '期中考苦練' }));
  if (state.kind === 'notfound' || state.kind === 'error')
    return (
      <>
        {topBar(t({ id: 'exam.title', message: '期中考苦練' }))}
        <ErrorState
          title={
            state.kind === 'notfound'
              ? t({ id: 'exam.run.notfound', message: '沒有這一組題目', comment: '練習頁：題組 ID 不存在' })
              : t({ id: 'exam.error.title', message: '題庫載入不到' })
          }
          description={t({ id: 'exam.error.desc', message: '重新整理再試一次；離線時要先在有網路時開過這一頁。' })}
          action={
            <Button variant="primary" icon={<HouseIcon />} href={href('/exam/')}>
              {t({ id: 'exam.run.home', message: '回到苦練首頁', comment: '練習頁的按鈕' })}
            </Button>
          }
        />
      </>
    );
  if (state.kind === 'empty')
    return (
      <>
        {topBar(setTitle(state.set))}
        <ErrorState
          pose="clasp"
          title={t({ id: 'exam.run.emptyWrong', message: '還沒有錯過的題', comment: '練習頁：「只練錯過的」但這台裝置沒有答錯的紀錄' })}
          description={t({ id: 'exam.run.emptyWrong.desc', message: '先練幾題，答錯的題會集中到這裡。', comment: '練習頁空狀態的說明' })}
          action={
            <Button variant="primary" icon={<PlayIcon />} href={href('/exam/all/')}>
              {t({ id: 'exam.start.order', message: '依講義順序練' })}
            </Button>
          }
        />
      </>
    );

  const { set, run, questions } = state;
  const n = (x: number) => formatNumber(x, locale);
  const restart = () => {
    const fresh = startRun({
      key,
      questions: set.questionIds.filter((id) => questions.has(id)).map((id) => questions.get(id)!),
      order,
      bankRev: state.bankRev,
      ...(order === 'random' ? { limit: RANDOM_LIMIT } : {}),
    });
    setFreshConfirm(null);
    setState({ ...state, run: fresh, resumed: false, revised: 0 });
    void db.putRun(fresh).catch(() => {});
  };

  if (isFinished(run)) {
    const sum = summarise(run);
    const wrongHere = sum.wrongIds.map((id) => questions.get(id)).filter((q): q is HandoutQuestionSnapshot => q !== undefined);
    return (
      <>
        {topBar(setTitle(set))}
        <Card as="section" className="ll-exam-summary" aria-labelledby="ll-exam-summary-title" data-testid="exam-summary">
          <h2 id="ll-exam-summary-title" className="ll-exam-summary__title">
            {sum.correct === sum.total
              ? t({ id: 'exam.summary.perfect', message: '全部答對', comment: '總結卡標題：全對' })
              : t({ id: 'exam.summary.done', message: '練完這一輪', comment: '總結卡標題' })}
          </h2>
          <p className="ll-exam-summary__score ll-num" data-testid="exam-score">
            {t({ id: 'exam.summary.score', message: `答對 ${n(sum.correct)}／${n(sum.total)} 題`, comment: '總結卡的成績；數字已格式化' })}
          </p>
          <div className="ll-exam-summary__actions">
            {wrongHere.length > 0 && (
              <Button variant="primary" size="md" icon={<BookIcon />} href={href('/exam/wrong/')} data-testid="exam-retry-wrong">
                {t({ id: 'exam.summary.retryWrong', message: `再練錯的（${n(wrongHere.length)} 題）`, comment: '總結卡按鈕；count 已格式化' })}
              </Button>
            )}
            <Button size="md" variant={wrongHere.length > 0 ? 'secondary' : 'primary'} icon={<RetryIcon />} onClick={restart} data-testid="exam-restart">
              {t({ id: 'exam.summary.again', message: '再練一次', comment: '總結卡按鈕：同一組重來' })}
            </Button>
            <Button size="md" variant="quiet" icon={<HouseIcon />} href={href('/exam/')}>
              {t({ id: 'exam.run.home', message: '回到苦練首頁' })}
            </Button>
          </div>
          {wrongHere.length > 0 && (
            <div className="ll-exam-summary__wrong">
              <h3 className="ll-exam-summary__subtitle">{t({ id: 'exam.summary.wrongList', message: '答錯的題', comment: '總結卡：答錯清單的小標' })}</h3>
              {wrongHere.map((q) => {
                const letters = q.answer.join('、');
                return (
                  <Disclosure key={q.id} summary={<span lang="zh-TW">{q.topic}</span>} variant="plain">
                    <div className="ll-exam-review-q">
                      <HandoutText text={q.scenario} className="ll-exam-review-q__scenario" />
                      <HandoutText text={q.question} className="ll-exam-review-q__question" />
                      <p className="ll-exam-review-q__answer">
                        {t({ id: 'exam.feedback.answer', message: `正確答案：${letters}` })}{' '}
                        <span lang="zh-TW">
                          {q.options
                            .filter((o) => q.answer.includes(o.letter))
                            .map((o) => o.text)
                            .join('；')}
                        </span>
                      </p>
                      <HandoutText text={q.explanation} className="ll-exam-review-q__explain" />
                    </div>
                  </Disclosure>
                );
              })}
            </div>
          )}
        </Card>
      </>
    );
  }

  const qid = currentQuestionId(run)!;
  const q = questions.get(qid)!;
  const answer = answerOf(run, qid);
  const check = () => {
    const next = checkAnswer(run, qid, q.answer);
    const a = answerOf(next, qid);
    if (!a.checked) return;
    const at = new Date().toISOString();
    const prev = states.get(qid);
    const ns = nextState(prev, qid, q.answerRev, a.correct === true, at);
    setStates((m) => new Map(m).set(qid, ns));
    void db.putState(ns).catch(() => {});
    void db
      .addAttempt({
        id: `${run.runId}-${qid}`,
        questionId: qid,
        rev: q.rev,
        answerRev: q.answerRev,
        setId: set.id,
        chosen: a.chosen!,
        correct: a.correct === true,
        at,
      })
      .catch(() => {});
    setFreshConfirm(qid);
    update(() => next);
  };
  return (
    <>
      {topBar(setTitle(set))}
      {(state.resumed || state.revised > 0) && (
        <p className="ll-exam-resume" role="status" data-testid="exam-resume">
          {state.revised > 0
            ? t({ id: 'exam.run.revised', message: `題庫更新了，有 ${n(state.revised)} 題要重新作答。`, comment: '練習頁：還原時有題目改版；count 已格式化' })
            : t({
                id: 'exam.run.resumed',
                message: `接續上次，從第 ${n(run.index + 1)} 題開始。`,
                comment: '練習頁：沿用上次做到一半的一輪；n 是題號（已格式化）',
              })}{' '}
          <Button size="sm" variant="quiet" icon={<RetryIcon />} onClick={restart} data-testid="exam-run-restart">
            {t({ id: 'exam.run.restart', message: '重新開始', comment: '練習頁：放棄進度從第 1 題開始' })}
          </Button>
        </p>
      )}
      <div className="ll-question-wrap" data-ready="true">
        <HandoutQuestionCard
          key={qid}
          q={q}
          answer={answer}
          shuffle={shuffle}
          runId={run.runId}
          index={run.index + 1}
          total={run.questionIds.length}
          onSelect={(letter) => update((r) => selectAnswer(r, qid, letter))}
          onCheck={check}
          onNext={() => {
            setFreshConfirm(null);
            update((r) => nextQuestion(r));
          }}
          scrollOnMount={freshConfirm === qid}
        />
      </div>
      <p className="ll-exam-run__hint">
        <Trans id="exam.run.hint" comment="練習頁底部的一句：解析出自講義">
          解答與解析都照講義，有疑問以老師的說明為準。
        </Trans>
      </p>
    </>
  );
}
