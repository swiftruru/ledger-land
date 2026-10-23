// 錯題本（03 第 2.10 節、02 頁面地圖 /review/）：今天要複習的題目（本地日期、一次最多 10 題）逐題作答，作答來源是 review，
// 依 nextReview 更新盒子；題目改版（answer）回盒子 1 並顯示「題目已更新」、文字改版只加小標記；已下架顯示「這題已下架」可移除。
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { formatDate, localePath } from '@ledgerland/i18n';
import { generateAttemptId, type JsonValue, type ReviewQueueEntry } from '@ledgerland/progress';
import { REVIEW_DAILY_LIMIT, nextReview, onQuestionRevised } from '@ledgerland/quiz';
import { Badge, Button, Card, EmptyState, QuestionCard } from '@ledgerland/web-ui';
import { FeedbackView } from '../features/quiz/FeedbackView.tsx';
import { Markup } from '../features/quiz/Markup.tsx';
import { QuestionView, valueContextOf } from '../features/quiz/QuestionView.tsx';
import { canSubmit } from '../features/quiz/answers.ts';
import { recordAttempt, recordReviewResult } from '../features/quiz/record.ts';
import { scoreSnapshotQuestion } from '../features/quiz/scoring.ts';
import { TermsProvider, useTerms } from '../features/quiz/terms.tsx';
import { loadQuestion, resolveId, type QuestionSnapshot, type ResolvedId } from '../lib/content.ts';
import { nowIso, secureRandom, todayLocal } from '../lib/progress/app-info.ts';
import { getProgressStore } from '../lib/progress/index.ts';
import { useLocale } from '../lib/useLocale.ts';
import { installQuizPersistence, useQuiz } from '../store/quiz.ts';

export interface ReviewItem {
  entry: ReviewQueueEntry;
  question?: QuestionSnapshot;
  levelTitle?: string;
  /** 題目不在快照裡：下架或不認識 */
  resolved?: ResolvedId;
  /** 這次載入時發現的改版種類 */
  revised?: 'answer' | 'text';
}

const KEY = 'review';

/** 讀今天到期的題目並比對 rev（answer 改版回盒子 1，text 改版只標記），回傳可作答與已下架的清單 */
export async function loadReviewItems(locale: 'zh-TW' | 'en'): Promise<ReviewItem[]> {
  const store = await getProgressStore();
  const due = await store.listDueReviews(todayLocal(), REVIEW_DAILY_LIMIT);
  const items: ReviewItem[] = [];
  for (const entry of due) {
    const found = await loadQuestion(entry.questionId, locale).catch(() => undefined);
    if (found === undefined) {
      items.push({ entry, resolved: await resolveId(entry.questionId, locale).catch((): ResolvedId => ({ status: 'unknown' })) });
      continue;
    }
    const q = found.question;
    let current = entry;
    let revised: 'answer' | 'text' | undefined;
    if (q.rev > entry.rev) {
      revised = q.revKind === 'answer' ? 'answer' : 'text';
      current = onQuestionRevised(entry, q.rev, revised);
      await store.putReview(current);
    } else if (entry.updateKind !== undefined) revised = entry.updateKind;
    items.push({ entry: current, question: q, levelTitle: found.level.title, revised });
  }
  return items;
}

export default function Review() {
  const locale = useLocale();
  return (
    <TermsProvider locale={locale}>
      <ReviewSession />
    </TermsProvider>
  );
}

function ReviewSession() {
  const { t } = useLingui();
  const locale = useLocale();
  const { ready: termsReady } = useTerms();
  const quiz = useQuiz();
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [boxNotes, setBoxNotes] = useState<Record<string, ReviewQueueEntry>>({});

  useEffect(() => {
    installQuizPersistence();
  }, []);

  useEffect(() => {
    let alive = true;
    loadReviewItems(locale).then(
      (list) => alive && setItems(list),
      () => alive && setItems([]),
    );
    return () => {
      alive = false;
    };
  }, [locale]);

  const answerable = useMemo(() => (items ?? []).filter((it) => it.question !== undefined), [items]);
  const retired = useMemo(() => (items ?? []).filter((it) => it.question === undefined), [items]);
  const byId = useMemo(() => new Map(answerable.map((it) => [it.entry.questionId, it] as const)), [answerable]);

  const beginFresh = useCallback(() => {
    if (answerable.length === 0) return;
    useQuiz.getState().begin(KEY, {
      mode: 'review',
      questionIds: answerable.map((it) => it.entry.questionId),
      shuffleSeed: generateAttemptId(secureRandom),
      startedAt: nowIso(),
    });
  }, [answerable]);

  // 開始或還原：還原的工作階段題目要和今天的清單一致，否則重新開始
  useEffect(() => {
    if (items === null || answerable.length === 0) return;
    let alive = true;
    const s = useQuiz.getState();
    if (s.hydratedKey === KEY && s.session !== null) return;
    void s.hydrate(KEY).then((restored) => {
      if (!alive) return;
      const current = useQuiz.getState();
      const session = current.session;
      const ids = answerable.map((it) => it.entry.questionId);
      const matches = restored && session !== null && session.questionIds.length === ids.length && session.questionIds.every((id, i) => id === ids[i]);
      if (!matches) {
        beginFresh();
        return;
      }
      for (const id of session.questionIds) {
        const qs = session.questions[id];
        const q = byId.get(id)?.question;
        if (qs?.confirmed && qs.answer !== undefined && q && current.results[id] === undefined)
          current.setResult(id, scoreSnapshotQuestion(q, qs.answer).result);
      }
    });
    return () => {
      alive = false;
    };
  }, [items, answerable, byId, beginFresh]);

  const removeEntry = async (questionId: string) => {
    const store = await getProgressStore();
    await store.removeReview(questionId);
    setItems((list) => (list === null ? list : list.filter((it) => it.entry.questionId !== questionId)));
  };

  const title = (
    <h1>
      <Trans id="review.title" comment="錯題本頁面的標題">
        錯題本
      </Trans>
    </h1>
  );

  if (items === null) return <h1 className="ll-muted">…</h1>;

  const retiredList = retired.length > 0 && (
    <Card as="section" aria-labelledby="ll-review-retired">
      <h2 id="ll-review-retired">
        <Trans id="review.retired.title" comment="錯題本裡已下架題目的區塊標題">
          已下架的題目
        </Trans>
      </h2>
      <ul className="ll-list">
        {retired.map((it) => (
          <li key={it.entry.questionId} className="ll-row">
            <span>
              {t({ id: 'review.retired.item', message: '這題已下架', comment: '錯題本裡題目已下架時的說明' })}
              {it.resolved?.status === 'retired' && it.resolved.supersededBy !== undefined && (
                <span className="ll-muted ll-small">
                  {' '}
                  {t({ id: 'review.retired.superseded', message: '已有替代題目，會在重玩該關時遇到。', comment: '下架題目有替代題時的補充' })}
                </span>
              )}
            </span>
            <Button className="ll-btn--small" onClick={() => void removeEntry(it.entry.questionId)}>
              <Trans id="review.retired.remove" comment="從錯題本移除已下架題目的按鈕">
                移除
              </Trans>
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );

  if (answerable.length === 0) {
    return (
      <>
        {title}
        <EmptyState
          title={t({ id: 'review.empty.title', message: '今天沒有要複習的題目', comment: '錯題本沒有到期題目時的標題' })}
          description={t({ id: 'review.empty.body', message: '答錯的題目會依間隔排進來；去闖關或明天再來看看。', comment: '錯題本沒有到期題目時的說明' })}
          action={
            <Link className="ll-btn ll-btn--primary" to={localePath(locale, '/play/')}>
              <Trans id="review.empty.goPlay" comment="錯題本空狀態的按鈕">
                去闖關
              </Trans>
            </Link>
          }
        />
        {retiredList}
      </>
    );
  }

  const session = quiz.key === KEY ? quiz.session : null;
  if (session === null || !termsReady) return <h1 className="ll-muted">…</h1>;

  if (session.completed) {
    const correct = session.questionIds.filter((id) => session.questions[id]?.correct === true).length;
    const total = session.questionIds.length;
    return (
      <>
        {title}
        <Card as="section" aria-labelledby="ll-review-done">
          <h2 id="ll-review-done" tabIndex={-1}>
            <Trans id="review.done.title" comment="今天的複習做完時的標題">
              今天的複習完成了
            </Trans>
          </h2>
          <p>
            {t({
              id: 'review.done.summary',
              message: `答對 ${correct} 題，共 ${total} 題。答對的往上一個盒子，答錯的回到盒子 1。`,
              comment: '複習完成的摘要；correct 是答對題數、total 是題數',
            })}
          </p>
          <div className="ll-row ll-actions">
            <Link className="ll-btn ll-btn--primary" to={localePath(locale, '/play/')}>
              <Trans id="review.done.goPlay" comment="複習完成後回到闖關的按鈕">
                回到闖關
              </Trans>
            </Link>
          </div>
        </Card>
        {retiredList}
      </>
    );
  }

  const qid = session.questionIds[session.currentIndex]!;
  const item = byId.get(qid);
  const q = item?.question;
  if (!item || !q) return <NotFoundInline />;
  const qs = session.questions[qid]!;
  const result = quiz.results[qid];
  const note = boxNotes[qid];

  const onSubmit = () => {
    const current = useQuiz.getState();
    const state = current.session?.questions[qid];
    if (!state || state.confirmed || state.answer === undefined) return;
    const { result: r, answer } = scoreSnapshotQuestion(q, state.answer);
    current.confirm(qid, r);
    if (current.attemptIds[qid] !== undefined) return;
    void recordAttempt({ q, answer, result: r, source: 'review', durationMs: Date.now() - current.questionShownAt }).then(({ attemptId }) => {
      useQuiz.getState().markAttempt(qid, attemptId);
    });
    // 盒子的下一個狀態是純函式，先顯示再寫入
    const next = nextReview(item.entry, r.correct ? 'correct' : 'wrong', nowIso());
    setBoxNotes((m) => ({ ...m, [qid]: next }));
    void recordReviewResult(item.entry, r.correct);
  };

  const boxText = (entry: ReviewQueueEntry) => {
    if (entry.status === 'mastered') return t({ id: 'review.box.mastered', message: '已掌握，離開複習清單。', comment: '複習答對後盒子 4 升級為已掌握' });
    const box = entry.box;
    const dueAt = formatDate(entry.dueAt, locale);
    return t({
      id: 'review.box.next',
      message: `現在在盒子 ${box}，下次複習：${dueAt}。`,
      comment: '複習作答後的盒子狀態；box 是盒子號碼、dueAt 是已格式化的日期',
    });
  };

  return (
    <>
      {title}
      <p className="ll-muted ll-small">
        {item.levelTitle}
        {item.revised === 'answer' && (
          <>
            {' '}
            <Badge kind="warning">{t({ id: 'review.updated.answer', message: '題目已更新', comment: '錯題本：題目答案改版時的標示' })}</Badge>
          </>
        )}
        {item.revised === 'text' && (
          <>
            {' '}
            <Badge kind="info">{t({ id: 'review.updated.text', message: '文字有更新', comment: '錯題本：題目文字改版時的小標記' })}</Badge>
          </>
        )}
      </p>
      <QuestionCard
        index={session.currentIndex + 1}
        total={session.questionIds.length}
        prompt={
          <Markup text={(q['prompt'] as string | undefined) ?? t({ id: 'quiz.tf.prompt', message: '下面這句話對不對？' })} ctx={valueContextOf(q)} plainTerms />
        }
        checked={qs.confirmed}
        canSubmit={canSubmit(q, qs.answer)}
        onSubmit={onSubmit}
        {...(q.type === 'classify' ? { submitLabel: t({ id: 'quiz.submit.classify', message: '確認分類' }) } : {})}
        feedback={
          result === undefined ? undefined : (
            <FeedbackView
              q={q}
              result={result}
              mistakeState="none"
              onNext={() => useQuiz.getState().next()}
              nextLabel={note && <p className="ll-muted ll-small">{boxText(note)}</p>}
            />
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
      {retiredList}
    </>
  );
}

function NotFoundInline() {
  return (
    <p className="ll-muted">
      <Trans id="review.questionMissing" comment="錯題本裡的題目載入不到時的說明">
        這題暫時載入不到，重新整理後再試一次。
      </Trans>
    </p>
  );
}
