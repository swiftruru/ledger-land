// 作答頁（02 第 5 節、03 第 2.4 到 2.12 節、05 第 8.5 節）：載入關卡快照，依題型渲染元件，「確認答案」後用 packages/quiz 判分、寫作答紀錄、
// 錯題本與名詞解鎖；作答工作階段在路由外的 store（切換語言、開名詞卡、重新整理都從暫存還原，不重新出題）。
// 同一路由的結束狀態是結果頁：星星、正確率、回到地圖（?from=<levelId>）、再挑戰；第一次完成任何關卡時呼叫 maybePersist('first-level-complete')。
// 從 QR 或代號進入（?via=qr、?via=code）時不顯示建議提示（地圖那邊處理）。
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { type JsonValue } from '@ledgerland/progress';
import { levelScore, type LevelItem } from '@ledgerland/quiz';
import { ErrorState, QuestionCard, Toast } from '@ledgerland/web-ui';
import { LangSwitch } from '../components/LangSwitch.tsx';
import { FeedbackView } from '../features/quiz/FeedbackView.tsx';
import { Markup } from '../features/quiz/Markup.tsx';
import { QuestionView, valueContextOf } from '../features/quiz/QuestionView.tsx';
import { ResultView } from '../features/quiz/ResultView.tsx';
import { canSubmit } from '../features/quiz/answers.ts';
import { recordAttempt, recordGuessed, recordLevelComplete } from '../features/quiz/record.ts';
import { scoreSnapshotQuestion } from '../features/quiz/scoring.ts';
import { TermsProvider, useTerms } from '../features/quiz/terms.tsx';
import { useScrollAnchor } from '../features/quiz/useScrollAnchor.ts';
import { ContentLoadError, loadLevel, type LevelSnapshot, type QuestionSnapshot } from '../lib/content.ts';
import { generateAttemptId } from '@ledgerland/progress';
import { nowIso, secureRandom } from '../lib/progress/app-info.ts';
import { maybePersist } from '../lib/progress/persist.ts';
import { useLocale } from '../lib/useLocale.ts';
import { installQuizPersistence, useQuiz } from '../store/quiz.ts';
import { NotFound } from './NotFound.tsx';

type LoadState = { kind: 'loading' } | { kind: 'error'; error: ContentLoadError } | { kind: 'ok'; snapshot: LevelSnapshot };

export function useLevelSnapshot(levelId: string | undefined, locale: 'zh-TW' | 'en'): LoadState {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  useEffect(() => {
    let alive = true;
    setState({ kind: 'loading' });
    if (!levelId) {
      setState({ kind: 'error', error: new ContentLoadError('沒有關卡 ID', 'missing') });
      return;
    }
    loadLevel(levelId, locale).then(
      (snapshot) => alive && setState({ kind: 'ok', snapshot }),
      (e: unknown) => alive && setState({ kind: 'error', error: e instanceof ContentLoadError ? e : new ContentLoadError(String(e), 'network') }),
    );
    return () => {
      alive = false;
    };
  }, [levelId, locale]);
  return state;
}

export default function Level() {
  const { levelId } = useParams();
  const locale = useLocale();
  const state = useLevelSnapshot(levelId, locale);
  if (state.kind === 'loading') return <h1 className="ll-muted">…</h1>;
  if (state.kind === 'error') {
    if (state.error.kind === 'missing') return <NotFound />;
    return <OfflineError />;
  }
  return (
    <TermsProvider locale={locale}>
      <LevelSession snapshot={state.snapshot} />
    </TermsProvider>
  );
}

function OfflineError() {
  const { t } = useLingui();
  return (
    <>
      <h1>
        <Trans id="level.unavailable.title" comment="關卡快照載入失敗時的標題">
          這一關還沒下載到這台裝置
        </Trans>
      </h1>
      <ErrorState title={t({ id: 'content.offlineMissing', message: '這一頁還沒下載到這台裝置。連上網路後再試一次，已下載的內容現在也能繼續使用。' })} />
    </>
  );
}

interface ToastItem {
  id: number;
  text: string;
}

function LevelSession({ snapshot }: { snapshot: LevelSnapshot }) {
  const { level, questions } = snapshot;
  const { t } = useLingui();
  const locale = useLocale();
  const { labelOf, ready: termsReady } = useTerms();
  const quiz = useQuiz();
  const key = `level:${level.id}`;
  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q] as const)), [questions]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const completionRecorded = useRef<string | null>(null);
  const [previousStars, setPreviousStars] = useState<0 | 1 | 2 | 3 | undefined>(undefined);

  useEffect(() => {
    installQuizPersistence();
  }, []);

  const beginFresh = useCallback(() => {
    useQuiz.getState().begin(key, {
      mode: 'level',
      levelId: level.id,
      levelRev: level.rev,
      questionIds: level.questionIds,
      shuffleSeed: generateAttemptId(secureRandom),
      startedAt: nowIso(),
    });
  }, [key, level.id, level.rev, level.questionIds]);

  // 開始或還原工作階段：同一關、同一個 rev、同一組題目才還原；還原後依存下的答案重算判分結果
  useEffect(() => {
    let alive = true;
    const s = useQuiz.getState();
    if (s.hydratedKey === key && s.session !== null) return;
    void s.hydrate(key).then((restored) => {
      if (!alive) return;
      const current = useQuiz.getState();
      const session = current.session;
      const matches =
        restored &&
        session !== null &&
        session.levelId === level.id &&
        session.levelRev === level.rev &&
        session.questionIds.length === level.questionIds.length &&
        session.questionIds.every((id, i) => id === level.questionIds[i]);
      if (!matches) {
        beginFresh();
        return;
      }
      for (const id of session.questionIds) {
        const qs = session.questions[id];
        const q = byId.get(id);
        if (qs?.confirmed && qs.answer !== undefined && q && current.results[id] === undefined)
          current.setResult(id, scoreSnapshotQuestion(q, qs.answer).result);
      }
    });
    return () => {
      alive = false;
    };
  }, [key, level, byId, beginFresh]);

  const session = quiz.key === key ? quiz.session : null;
  const completed = session?.completed === true;
  useScrollAnchor(
    session !== null && !completed && termsReady,
    () => useQuiz.getState().getAnchor(),
    (anchor) => useQuiz.getState().setAnchor(anchor),
  );

  // 完成關卡：更新 levelProgress（星星取最大），第一次完成任何關卡時呼叫 persist
  const items: LevelItem[] = useMemo(
    () => (session === null ? [] : session.questionIds.map((id) => ({ scored: byId.get(id)?.scored === true, score: session.questions[id]?.score ?? 0 }))),
    [session, byId],
  );
  useEffect(() => {
    if (!completed || completionRecorded.current === key || session === null) return;
    completionRecorded.current = key;
    void recordLevelComplete(level.id, items).then((done) => {
      setPreviousStars(done.previousStars);
      if (done.firstEver) void maybePersist('first-level-complete');
    });
    document.getElementById('ll-result-title')?.focus();
  }, [completed, key, level.id, items, session]);

  // 換題後焦點移到題幹
  const currentIndex = session?.currentIndex ?? -1;
  useEffect(() => {
    if (currentIndex < 0 || completed) return;
    const h = document.querySelector<HTMLElement>('.ll-question__prompt');
    if (h && document.activeElement !== h && !document.activeElement?.closest('.ll-feedback')) h.focus({ preventScroll: true });
  }, [currentIndex, completed]);

  const pushToast = (text: string) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list, { id, text }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 5000);
  };

  // 名詞資料載好才渲染題目（名詞 chip、科目卡與目標名稱都要用到），避免載入中途重新掛載題型元件
  if (session === null || !termsReady) return <h1 className="ll-muted">…</h1>;

  const onSubmit = (q: QuestionSnapshot) => {
    const current = useQuiz.getState();
    const qs = current.session?.questions[q.id];
    if (!qs || qs.confirmed || qs.answer === undefined) return;
    const { result, answer } = scoreSnapshotQuestion(q, qs.answer);
    current.confirm(q.id, result);
    if (current.attemptIds[q.id] !== undefined) return;
    void recordAttempt({ q, answer, result, source: 'play', levelId: level.id, durationMs: Date.now() - current.questionShownAt }).then(
      ({ attemptId, unlockedTerms }) => {
        useQuiz.getState().markAttempt(q.id, attemptId);
        for (const termId of unlockedTerms) {
          const label = labelOf(termId) ?? termId;
          pushToast(t({ id: 'level.termUnlocked', message: `收進名詞圖鑑：${label}`, comment: '送出含名詞的題目後的提示；label 是名詞' }));
        }
      },
    );
  };

  const retry = () => {
    void useQuiz
      .getState()
      .clear()
      .then(() => {
        completionRecorded.current = null;
        beginFresh();
      });
  };

  const header = (
    <div id="ll-level-head" data-ll-anchor>
      <h1>{level.title}</h1>
      <div className="ll-row">
        <LangSwitch />
      </div>
    </div>
  );

  if (completed) {
    const score = levelScore(items);
    const wrongCount = session.questionIds.filter((id) => byId.get(id)?.scored && session.questions[id]?.correct === false).length;
    return (
      <>
        {header}
        <ResultView
          locale={locale}
          levelId={level.id}
          title={level.title}
          score={score}
          wrongCount={wrongCount}
          onRetry={retry}
          {...(previousStars === undefined ? {} : { bestStars: previousStars })}
        />
      </>
    );
  }

  const qid = session.questionIds[session.currentIndex]!;
  const q = byId.get(qid);
  if (!q) return <NotFound />;
  const qs = session.questions[qid]!;
  const result = quiz.results[qid];
  const guessed = quiz.guessed[qid] === true;
  const mistakeState: 'added' | 'can_add' | 'none' = !q.scored || result === undefined ? 'none' : result.correct ? (guessed ? 'added' : 'can_add') : 'added';
  const promptText = (q.type === 'true_false' ? (q['prompt'] as string | undefined) : (q['prompt'] as string)) ?? '';
  return (
    <>
      {header}
      {toasts.map((item) => (
        <Toast key={item.id} kind="success" onDismiss={() => setToasts((list) => list.filter((x) => x.id !== item.id))}>
          {item.text}
        </Toast>
      ))}
      <div id={`ll-q-${qid}`} data-ll-anchor>
        <QuestionCard
          index={session.currentIndex + 1}
          total={session.questionIds.length}
          prompt={
            promptText === '' ? (
              t({ id: 'quiz.tf.prompt', message: '下面這句話對不對？', comment: '是非題沒有題幹時的標題' })
            ) : (
              <Markup text={promptText} ctx={valueContextOf(q)} plainTerms />
            )
          }
          checked={qs.confirmed}
          canSubmit={canSubmit(q, qs.answer)}
          onSubmit={() => onSubmit(q)}
          {...(q.type === 'classify' ? { submitLabel: t({ id: 'quiz.submit.classify', message: '確認分類', comment: '分類題的送出按鈕' }) } : {})}
          feedback={
            result === undefined ? undefined : (
              <div id={`ll-fb-${qid}`} data-ll-anchor>
                <FeedbackView
                  q={q}
                  result={result}
                  mistakeState={mistakeState}
                  onAddMistake={() => {
                    useQuiz.getState().markGuessed(qid);
                    void recordGuessed(q);
                  }}
                  onNext={() => useQuiz.getState().next()}
                />
              </div>
            )
          }
        >
          {({ promptId }) => (
            <QuestionView
              q={q}
              answer={qs.answer as JsonValue | undefined}
              checked={qs.confirmed}
              {...(result === undefined ? {} : { result })}
              shuffleSeed={session.shuffleSeed}
              promptId={promptId}
              onChange={(answer, rawInput) => useQuiz.getState().select(qid, answer, rawInput)}
            />
          )}
        </QuestionCard>
      </div>
    </>
  );
}
