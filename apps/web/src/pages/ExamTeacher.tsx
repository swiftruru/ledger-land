// 老師審核頁（M4c，02 第 1.1 節）：/exam/teacher/，不列導覽、不進 sitemap、noindex，只給老師固定連結。列出沒收進苦練區的題（兩份講義答案不同、
// 解析有錯字或和公式不合）與照收但想請老師確認的題，每題一張卡：講義與頁次、主題、情境與問題、三個選項（正解打勾）、解答、解析原文（HandoutQuestionReadout）、原因。
// 資料只讀 handout_review 那一檔（content.ts 的 loadHandoutReview），不載整份題庫。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useMemo, useState } from 'react';
import { formatNumber, localePath } from '@ledgerland/i18n';
import { Badge, Card, ErrorState, Segmented, TextLink, TopBar } from '@ledgerland/web-ui';
import { HandoutQuestionReadout } from '../features/exam/HandoutQuestionReadout.tsx';
import { loadHandoutIndex, loadHandoutReview, type HandoutManifestEntry, type HandoutReviewFile, type HandoutReviewQuestion } from '../lib/content.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { useLocale } from '../lib/useLocale.ts';
import '../styles/exam.css';

type Filter = 'all' | 'conflicting_answer' | 'explanation_issue' | 'check';
type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; index: HandoutManifestEntry; review: HandoutReviewFile };

export default function ExamTeacher() {
  const { t } = useLingui();
  const locale = useLocale();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [filter, setFilter] = useState<Filter>('all');
  useEffect(() => {
    let alive = true;
    Promise.all([loadHandoutIndex(), loadHandoutReview()]).then(
      ([index, review]) => alive && setState(index ? { kind: 'ok', index, review } : { kind: 'error' }),
      () => alive && setState({ kind: 'error' }),
    );
    return () => {
      alive = false;
    };
  }, []);
  usePageReady(state.kind !== 'loading');

  const reasonLabel: Record<Exclude<Filter, 'all'>, string> = {
    conflicting_answer: t({ id: 'exam.teacher.reason.conflict', message: '兩份講義答案不同', comment: '審核頁的原因標籤' }),
    explanation_issue: t({ id: 'exam.teacher.reason.explanation', message: '解析有誤', comment: '審核頁的原因標籤：解析有錯字或和公式不合' }),
    check: t({ id: 'exam.teacher.reason.check', message: '已收錄，請老師確認', comment: '審核頁的原因標籤：題目照收，但想請老師看一眼' }),
  };
  const byId = useMemo(() => new Map(state.kind === 'ok' ? state.review.questions.map((q) => [q.id, q] as const) : []), [state]);
  const deckOf = (q: HandoutReviewQuestion) => (state.kind === 'ok' ? state.review.decks.find((d) => d.id === q.deck) : undefined);
  const n = (x: number) => formatNumber(x, locale);

  const topBar = (
    <TopBar
      title={t({ id: 'exam.teacher.title', message: '講義題庫審核', comment: '老師審核頁的標題' })}
      titleId="ll-exam-teacher-title"
      backHref={localePath(locale, '/exam/')}
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
  const { index, review } = state;
  const counts = {
    conflicting_answer: review.questions.filter((q) => q.exclusion.reason === 'conflicting_answer').length,
    explanation_issue: review.questions.filter((q) => q.exclusion.reason === 'explanation_issue').length,
    check: review.questions.filter((q) => q.exclusion.reason === 'check').length,
  };
  const shown = review.questions.filter((q) => filter === 'all' || q.exclusion.reason === filter);
  const slideRef = (q: HandoutReviewQuestion) => {
    const d = deckOf(q);
    return t({
      id: 'exam.teacher.slide',
      message: `講義 ${d?.code ?? q.deck} 第 ${n(q.slide)} 頁`,
      comment: '審核頁每張卡的來源；code 是講義編號、n 是頁次（已格式化）',
    });
  };
  return (
    <>
      {topBar}
      <div className="ll-exam-teacher">
        <p className="ll-exam-intro">
          <Trans id="exam.teacher.intro" comment="審核頁開頭給老師的說明">
            這一頁列出我沒有收進苦練區的題目與原因，以及幾題照收但想請老師看一眼的題。題目、選項、解答與解析都是講義原文，只加了我的說明。這個網址沒有放在網站的任何地方，只給老師。
          </Trans>
        </p>
        <p className="ll-exam-teacher__stats ll-num" data-testid="exam-teacher-stats">
          {t({
            id: 'exam.teacher.stats',
            message: `收錄 ${n(index.questionCount)} 題；不收 ${n(index.review.excluded)} 題（答案不同 ${n(counts.conflicting_answer)}、解析有誤 ${n(counts.explanation_issue)}）；請老師確認 ${n(counts.check)} 題。`,
            comment: '審核頁的統計；數字都已格式化',
          })}
        </p>
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          label={t({ id: 'exam.teacher.filter', message: '依原因篩選', comment: '審核頁篩選列的可讀名稱' })}
          options={[
            { value: 'all', label: t({ id: 'exam.teacher.filter.all', message: `全部 ${n(review.questions.length)}`, comment: '篩選：全部；count 已格式化' }) },
            { value: 'conflicting_answer', label: `${reasonLabel.conflicting_answer} ${n(counts.conflicting_answer)}` },
            { value: 'explanation_issue', label: `${reasonLabel.explanation_issue} ${n(counts.explanation_issue)}` },
            { value: 'check', label: `${reasonLabel.check} ${n(counts.check)}` },
          ]}
          className="ll-exam-teacher__filter"
        />
        <ul className="ll-exam-teacher__list" data-testid="exam-teacher-list">
          {shown.map((q) => (
            <li key={q.id} id={q.id} className="ll-exam-teacher__item">
              <Card as="article" className="ll-exam-q-card" aria-labelledby={`${q.id}-title`} data-testid="exam-teacher-card">
                <HandoutQuestionReadout
                  q={q}
                  heading="h2"
                  headingId={`${q.id}-title`}
                  explainTag={false}
                  source={
                    <>
                      <Badge kind={q.exclusion.reason === 'check' ? 'warning' : 'danger'}>{reasonLabel[q.exclusion.reason]}</Badge>
                      <span className="ll-num">{slideRef(q)}</span>
                    </>
                  }
                  answerLine={t({ id: 'exam.teacher.answer', message: `講義的解答：${q.answer.join('／')}`, comment: '審核頁：講義標的解答字母' })}
                >
                  <div className="ll-exam-q__reason">
                    <p className="ll-exam-q__reason-title">{t({ id: 'exam.teacher.note', message: '我的說明', comment: '審核頁原因框的小標' })}</p>
                    <p>{q.exclusion.note}</p>
                    {q.exclusion.related.length > 0 && (
                      <p className="ll-exam-q__related">
                        {t({ id: 'exam.teacher.related', message: '相關的題：', comment: '審核頁原因框：答案不同的另一題的連結前綴' })}
                        {q.exclusion.related.map((id, i) => {
                          const r = byId.get(id);
                          if (!r) return null;
                          return (
                            <span key={id}>
                              {i > 0 && '、'}
                              <TextLink href={`#${id}`}>
                                {t({
                                  id: 'exam.teacher.relatedLink',
                                  message: `${slideRef(r)}（解答 ${r.answer.join('／')}）`,
                                  comment: '審核頁相關題的連結文字',
                                })}
                              </TextLink>
                            </span>
                          );
                        })}
                      </p>
                    )}
                  </div>
                </HandoutQuestionReadout>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
