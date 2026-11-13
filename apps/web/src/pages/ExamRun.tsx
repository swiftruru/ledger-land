// 期中考苦練的練習頁（M4c，02 第 1.1 節）：/exam/<setId>/，?order=random 隨機，&n=20|30|50|all 抽幾題（預設 20；第二批）。只抓這個題組要的講義檔；
// 有進行中的一輪就沿用（features/exam/run.ts 的 restoreRun：題庫改版的題作廢重答），沒有就開新的一輪；每一次確認都寫進 ledgerland-exam。
// 隨機的一輪題數和網址要的不一樣（換了 n）就開新的一輪。題組除了全部、講義、段，還有 wrong（最近答錯的）與 unsure（練過但還沒連對兩次的）。
// wrong 與 unsure 是會變動的題組（sets.ts 的 isDynamicSet）：每次進來、每次「再練」都依目前的紀錄重新出題，不沿用上一輪（2026-11-13）。
// wrong 是錯題複習（2026-11-13）：今天要練的錯題依優先順序出題，一輪最多 WRONG_ROUND_SIZE 題；?all=1 連「明天再練」的也一起練（純練習）；
// 確認答案後正解行下面多一行階段說明（features/exam/StageNote.tsx），總結卡多一行這一輪的錯題各在哪個階段。
// 題目卡是 features/exam/HandoutQuestionCard.tsx；練完是總結卡（答對幾題、答錯的題可展開看題目與解析、再練錯的、再練一次）。
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { formatNumber, localePath } from '@ledgerland/i18n';
import { BookIcon, Button, Card, Disclosure, ErrorState, HouseIcon, PlayIcon, RatioIcon, RetryIcon, TextLink, TopBar } from '@ledgerland/web-ui';
import { deviceClock } from '../features/exam/day.ts';
import { getExamDb, nextState, type QuestionState } from '../features/exam/db.ts';
import { HandoutQuestionCard } from '../features/exam/HandoutQuestionCard.tsx';
import { HandoutQuestionReadout } from '../features/exam/HandoutQuestionReadout.tsx';
import { DEFAULT_RANDOM_COUNT, limitOf, parseCount } from '../features/exam/options.ts';
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
import { formulaIdOfSet, isDynamicSet, isSetId, resolveSet, type ExamSet } from '../features/exam/sets.ts';
import { StageNote } from '../features/exam/StageNote.tsx';
import { picksOf, stageOf, wrongQueueOf, WRONG_ROUND_SIZE } from '../features/exam/stats.ts';
import { FormulaPills, useFormulasOfQuestions } from '../features/formulas/FormulaPills.tsx';
import { loadFormulaIndex, loadHandoutDeck, loadHandoutIndex, type HandoutManifestEntry, type HandoutQuestionSnapshot } from '../lib/content.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { useLocale } from '../lib/useLocale.ts';
import '../styles/exam.css';

type State =
  | { kind: 'loading' }
  | { kind: 'notfound' }
  /** waiting：錯題複習裡明天再練的題數（今天要練的都練完了） */
  | { kind: 'empty'; set: ExamSet; waiting: number }
  | { kind: 'error' }
  | {
      kind: 'ok';
      set: ExamSet;
      /** 講義的小索引：會變動的題組「再練」時用它重新解析題組 */
      index: HandoutManifestEntry;
      questions: ReadonlyMap<string, HandoutQuestionSnapshot>;
      run: ExamRun;
      resumed: boolean;
      revised: number;
    };

export default function ExamRun() {
  const { t } = useLingui();
  const locale = useLocale();
  const { setId = '' } = useParams();
  const [search] = useSearchParams();
  const order: ExamOrder = search.get('order') === 'random' ? 'random' : 'handout';
  const count = parseCount(search.get('n'), DEFAULT_RANDOM_COUNT);
  const key = `${setId}:${order}`;
  // 錯題複習的 ?all=1：連今天已經升不上去（明天再練）的題也一起練
  const everything = setId === 'wrong' && search.get('all') === '1';
  const href = (p: string) => localePath(locale, p);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [states, setStates] = useState<Map<string, QuestionState>>(new Map());
  const [freshConfirm, setFreshConfirm] = useState<string | null>(null);
  const [shuffle] = useState(readExamShuffle);
  const db = getExamDb();
  const formulasOf = useFormulasOfQuestions();

  useEffect(() => {
    let alive = true;
    setState({ kind: 'loading' });
    (async () => {
      const index = await loadHandoutIndex();
      if (!index || !isSetId(setId)) return { kind: 'notfound' } as State;
      const list = await db.allStates().catch(() => [] as QuestionState[]);
      const map = new Map(list.map((s) => [s.questionId, s]));
      if (alive) setStates(map);
      // 公式題組（formula:<id>）的題目清單在公式索引裡（在 precache），只有這種題組才讀
      const formulas = formulaIdOfSet(setId) === null ? undefined : await loadFormulaIndex(locale).catch(() => []);
      const clock = deviceClock();
      const set = resolveSet(index, setId, picksOf(map, clock, { all: everything }), formulas);
      if (!set) return { kind: 'notfound' } as State;
      if (set.questionIds.length === 0) return { kind: 'empty', set, waiting: set.kind === 'wrong' ? wrongQueueOf(map, clock).waiting.length : 0 } as State;
      const decks = await Promise.all(set.deckIds.map((d) => loadHandoutDeck(d)));
      const all = new Map(decks.flatMap((d) => d.questions).map((q) => [q.id, q] as const));
      const wanted = set.questionIds.filter((id) => all.has(id));
      const questions = new Map(wanted.map((id) => [id, all.get(id)!] as const));
      // 錯題複習一輪最多 WRONG_ROUND_SIZE 題（questions 留著全部要練的，下一輪接著用）
      const round = set.kind === 'wrong' ? wanted.slice(0, WRONG_ROUND_SIZE) : wanted;
      const limit = limitOf(count, round.length);
      // 會變動的題組不沿用存下來的一輪：上一輪練完了會只看到舊的總結卡，練到一半則會跳過已經答錯的題
      const stored = isDynamicSet(setId) ? undefined : await db.getRun(key).catch(() => undefined);
      // 隨機的一輪：題數和這次要的不一樣（換了 n、或題組變大變小）就不沿用
      const existing = stored && order === 'random' && stored.questionIds.length !== limit ? undefined : stored;
      const restored = existing ? restoreRun(existing, questions) : null;
      if (restored) {
        if (restored.revised.length > 0 || restored.run !== existing) await db.putRun(restored.run).catch(() => {});
        return {
          kind: 'ok',
          set,
          index,
          questions,
          run: restored.run,
          resumed: !isFinished(restored.run) && restored.run.index > 0,
          revised: restored.revised.length,
        } as State;
      }
      const run = startRun({
        key,
        questions: round.map((id) => questions.get(id)!),
        order,
        bankRev: index.rev,
        ...(order === 'random' ? { limit } : {}),
      });
      await db.putRun(run).catch(() => {});
      return { kind: 'ok', set, index, questions, run, resumed: false, revised: 0 } as State;
    })().then(
      (s) => alive && setState(s),
      () => alive && setState({ kind: 'error' }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, count, everything]);
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

  const setTitle = (set: ExamSet): string => {
    switch (set.kind) {
      case 'all':
        return t({ id: 'exam.set.all', message: '全部題目', comment: '練習頁的標題：全部題目' });
      case 'wrong':
        return t({ id: 'exam.set.wrong', message: '錯題複習', comment: '練習頁的標題：錯題複習（答錯過、還沒熟練的題）' });
      case 'unsure':
        return t({ id: 'exam.set.unsure', message: '還不熟的題', comment: '練習頁的標題：只練不熟的（練過但還沒連對兩次）' });
      case 'deck':
        return t({ id: 'exam.set.deck', message: `講義 ${set.deck!.code}`, comment: '練習頁的標題：一份講義；code 是講義編號' });
      case 'formula': {
        const label = set.title ?? '';
        return t({ id: 'exam.set.formula', message: `公式：${label}`, comment: '練習頁的標題：一條公式的相關題；label 是公式名稱' });
      }
      default:
        return set.title ?? '';
    }
  };
  // 公式題組從公式頁進來：返回鍵回公式頁
  const formulaId = formulaIdOfSet(setId);
  const formulaHref = formulaId === null ? null : href(`/formulas/${formulaId}/`);
  const topBar = (title: string) => (
    <TopBar
      title={<span lang={state.kind === 'ok' && state.set.kind === 'section' ? 'zh-TW' : undefined}>{title}</span>}
      titleId="ll-exam-run-title"
      backHref={formulaHref ?? href('/exam/')}
      backLabel={
        formulaHref === null
          ? t({ id: 'exam.run.back', message: '回到期中考苦練', comment: '練習頁頁首返回按鈕的可讀名稱' })
          : t({ id: 'exam.run.backFormula', message: '回到公式', comment: '公式題組的練習頁：返回按鈕的可讀名稱（回公式頁）' })
      }
      backShortLabel={
        formulaHref === null
          ? t({ id: 'exam.run.back.short', message: '苦練', comment: '練習頁頁首返回按鈕上的短字（必須是「回到期中考苦練」的一部分）' })
          : t({ id: 'exam.run.backFormula.short', message: '公式', comment: '公式題組的練習頁：返回按鈕的短字（必須是「回到公式」的一部分）' })
      }
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
  if (state.kind === 'empty' && state.set.kind === 'wrong' && state.waiting > 0)
    return (
      <>
        {topBar(setTitle(state.set))}
        <ErrorState
          pose="clasp"
          title={t({ id: 'exam.run.doneToday', message: '今天的錯題都練完了', comment: '錯題複習：今天要練的都練完了，只剩明天再練的題' })}
          description={t({
            id: 'exam.run.doneToday.desc',
            message: `還有 ${formatNumber(state.waiting, locale)} 題要等明天再答對一次才算熟練。`,
            comment: '錯題複習空狀態的說明；count 是明天再練的題數（已格式化）',
          })}
          action={
            <Button variant="secondary" icon={<RetryIcon />} href={href('/exam/wrong/?all=1')} data-testid="exam-wrong-all">
              {t({ id: 'exam.run.practiseAnyway', message: '還是想再練一次', comment: '錯題複習空狀態的按鈕：把明天再練的題也拿來練（純練習）' })}
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
          title={
            state.set.kind === 'unsure'
              ? t({ id: 'exam.run.emptyUnsure', message: '還沒有不熟的題', comment: '練習頁：「只練不熟的」但這台裝置沒有練過而未熟練的題' })
              : state.set.kind === 'formula'
                ? t({ id: 'exam.run.emptyFormula', message: '這條公式還沒有相關題目', comment: '練習頁：公式題組沒有題' })
                : t({ id: 'exam.run.emptyReview', message: '沒有要練的錯題', comment: '練習頁：錯題複習裡沒有還沒熟練的題（沒答錯過，或都練到熟練了）' })
          }
          description={
            state.set.kind === 'unsure'
              ? t({
                  id: 'exam.run.emptyUnsure.desc',
                  message: '練過的題連續答對兩次就算熟練；還沒熟練的會集中到這裡。',
                  comment: '練習頁空狀態的說明（不熟的題）',
                })
              : state.set.kind === 'formula'
                ? t({
                    id: 'exam.run.emptyFormula.desc',
                    message: '講義的練習題裡沒有用到這條公式的題，先練整份講義吧。',
                    comment: '練習頁空狀態的說明（公式題組）',
                  })
                : t({ id: 'exam.run.emptyReview.desc', message: '答錯的題會集中到這裡，練到熟練為止。', comment: '練習頁空狀態的說明（錯題複習）' })
          }
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
  const dynamic = isDynamicSet(set.id);
  // 會變動的題組：下一輪的題依頁面裡最新的紀錄重新挑（這一輪答對的已經離開、答錯的還在）。題目只會比載入時少，questions 夠用
  const clock = deviceClock();
  const nextSet = dynamic ? (resolveSet(state.index, set.id, picksOf(states, clock, { all: everything })) ?? set) : set;
  const nextAll = nextSet.questionIds.filter((id) => questions.has(id));
  const nextIds = set.kind === 'wrong' ? nextAll.slice(0, WRONG_ROUND_SIZE) : nextAll;
  const waiting = set.kind === 'wrong' ? wrongQueueOf(states, clock).waiting.length : 0;
  const restart = () => {
    setFreshConfirm(null);
    if (nextIds.length === 0) {
      setState({ kind: 'empty', set: nextSet, waiting });
      return;
    }
    const fresh = startRun({
      key,
      questions: nextIds.map((id) => questions.get(id)!),
      order,
      bankRev: state.index.rev,
      ...(order === 'random' ? { limit: limitOf(count, nextIds.length) } : {}),
    });
    setState({ ...state, set: nextSet, run: fresh, resumed: false, revised: 0 });
    void db.putRun(fresh).catch(() => {});
  };

  if (isFinished(run)) {
    const sum = summarise(run);
    const wrongHere = sum.wrongIds.map((id) => questions.get(id)).filter((q): q is HandoutQuestionSnapshot => q !== undefined);
    // 這一輪作答過的題裡，答錯過的各在哪個階段
    const stages = { fix: 0, review: 0, mastered: 0 };
    for (const id of run.questionIds) {
      const stage = answerOf(run, id).checked ? stageOf(states.get(id), clock) : null;
      if (stage !== null) stages[stage]++;
    }
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
          {stages.fix + stages.review + stages.mastered > 0 && (
            <p className="ll-exam-summary__stages ll-num" data-testid="exam-summary-stages">
              {t({
                id: 'exam.summary.stages',
                message: `這一輪的錯題：已熟練 ${n(stages.mastered)} 題、複習中 ${n(stages.review)} 題、待訂正 ${n(stages.fix)} 題`,
                comment: '總結卡：這一輪作答過的題裡，答錯過的各在錯題複習的哪個階段；數字都已格式化',
              })}
            </p>
          )}
          {set.kind === 'wrong' && nextAll.length === 0 && waiting > 0 && (
            <p className="ll-exam-summary__stages" data-testid="exam-summary-waiting">
              {t({
                id: 'exam.summary.waiting',
                message: `今天的錯題都練完了，還有 ${n(waiting)} 題明天再練。`,
                comment: '錯題複習的總結卡：今天要練的都練完了；count 是明天再練的題數（已格式化）',
              })}
            </p>
          )}
          <div className="ll-exam-summary__actions">
            {set.kind === 'wrong'
              ? // 錯題複習：網址不會變，直接在這一頁依最新的紀錄開下一輪（連到同一個網址不會重新載入）
                nextAll.length > 0 && (
                  <Button variant="primary" size="md" icon={<BookIcon />} onClick={restart} data-testid="exam-retry-wrong">
                    {t({
                      id: 'exam.summary.nextRound',
                      message: `再練下一輪（還有 ${n(nextAll.length)} 題）`,
                      comment: '錯題複習的總結卡按鈕：依最新的紀錄再出一輪；count 是今天還要練的題數（已格式化）',
                    })}
                  </Button>
                )
              : wrongHere.length > 0 && (
                  <Button variant="primary" size="md" icon={<BookIcon />} href={href('/exam/wrong/')} data-testid="exam-retry-wrong">
                    {t({
                      id: 'exam.summary.retryWrong',
                      message: `到錯題複習訂正（${n(wrongHere.length)} 題）`,
                      comment: '總結卡與模擬考成績卡的按鈕：這一輪答錯的題數，連到錯題複習；count 已格式化',
                    })}
                  </Button>
                )}
            {/* 錯題複習的「再練下一輪」就是再練一次；其他會變動的題組沒有題可練了就不給 */}
            {set.kind !== 'wrong' && nextIds.length > 0 && (
              <Button size="md" variant={wrongHere.length > 0 ? 'secondary' : 'primary'} icon={<RetryIcon />} onClick={restart} data-testid="exam-restart">
                {t({ id: 'exam.summary.again', message: '再練一次', comment: '總結卡按鈕：同一組重來' })}
              </Button>
            )}
            {formulaHref !== null && (
              <Button size="md" variant="quiet" icon={<RatioIcon />} href={formulaHref} data-testid="exam-back-formula">
                {t({ id: 'exam.summary.formula', message: '再看公式', comment: '公式題組的總結卡：回公式頁' })}
              </Button>
            )}
            <Button size="md" variant="quiet" icon={<HouseIcon />} href={href('/exam/')}>
              {t({ id: 'exam.run.home', message: '回到苦練首頁' })}
            </Button>
          </div>
          {wrongHere.length > 0 && (
            <div className="ll-exam-summary__wrong">
              <h3 className="ll-exam-summary__subtitle">{t({ id: 'exam.summary.wrongList', message: '答錯的題', comment: '總結卡：答錯清單的小標' })}</h3>
              {wrongHere.map((q) => (
                <Disclosure key={q.id} summary={<span lang="zh-TW">{q.topic}</span>} variant="plain">
                  <HandoutQuestionReadout q={q} heading={false} chosen={answerOf(run, q.id).chosen}>
                    <FormulaPills questionId={q.id} formulas={formulasOf} />
                  </HandoutQuestionReadout>
                </Disclosure>
              ))}
              <p className="ll-exam-run__hint">
                <TextLink href={href('/exam/list/')}>
                  {t({ id: 'exam.summary.toList', message: '看錯題複習的紀錄', comment: '總結卡：連到錯題複習的清單頁' })}
                </TextLink>
              </p>
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
    const ns = nextState(prev, qid, q.answerRev, a.correct === true, at, a.chosen!);
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
          note={answer.checked ? <StageNote state={states.get(qid)} correct={answer.correct === true} /> : undefined}
          extra={<FormulaPills questionId={qid} formulas={formulasOf} />}
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
