// 回饋區（03 第 2.9 節）：由 packages/quiz 的 ScoreResult 組出 FeedbackPanel 的各段：結果列、摘要（多正解題數量、分類與逐目標的對幾個）、
// 解說（{{option:…}} 已代入）、逐選項說明（multi_choice 全部展開、取捨題列出三個方案的好處與要注意）、名詞 chip、錯題本狀態、「下一題」。
import { useLingui } from '@lingui/react/macro';
import { useRef, type ReactNode } from 'react';
import type { ScoreResult } from '@ledgerland/quiz';
import { FeedbackPanel, TermChip, type FeedbackOptionNote } from '@ledgerland/web-ui';
import type { QuestionSnapshot } from '../../lib/content.ts';
import { Markup } from './Markup.tsx';
import { optionsOf, useOptionTexts, valueContextOf } from './QuestionView.tsx';
import { useTerms } from './terms.tsx';

export interface FeedbackViewProps {
  q: QuestionSnapshot;
  result: ScoreResult;
  /** 已按「我是猜的」或答錯已自動放進錯題本 */
  mistakeState: 'added' | 'can_add' | 'none';
  onAddMistake?: () => void;
  onNext: () => void;
  nextLabel?: ReactNode;
}

function TermChips({ ids }: { ids: readonly string[] }) {
  const { labelOf } = useTerms();
  return (
    <>
      {ids.map((id) => (
        <TermChipButton key={id} id={id} label={labelOf(id) ?? id} />
      ))}
    </>
  );
}

function TermChipButton({ id, label }: { id: string; label: string }) {
  const { openTerm } = useTerms();
  const ref = useRef<HTMLButtonElement>(null);
  return <TermChip ref={ref} label={label} onClick={() => openTerm(id, ref)} />;
}

function joinList(items: readonly string[], locale: string): string {
  return items.join(locale === 'en' ? ', ' : '、');
}

export function FeedbackView({ q, result, mistakeState, onAddMistake, onNext, nextLabel }: FeedbackViewProps) {
  const { t } = useLingui();
  const { locale } = useTerms();
  const optionTexts = useOptionTexts(q);
  const ctx = valueContextOf(q);
  const judgment = q.type === 'judgment';
  const options = optionsOf(q);
  const detail = result.detail;

  let summary: ReactNode = null;
  let notes: FeedbackOptionNote[] | undefined;
  let expandAll = false;
  let multi: 'any_correct' | 'all_correct' | undefined;
  if (detail.kind === 'multi_choice') {
    multi = detail.scoringMode;
    expandAll = true;
    const correctCount = detail.correctOptionIds.length;
    const correctList = joinList(
      detail.correctOptionIds.map((id) => optionTexts.get(id) ?? id),
      locale,
    );
    const chosenList = joinList(
      detail.selected.map((id) => optionTexts.get(id) ?? id),
      locale,
    );
    summary =
      detail.scoringMode === 'all_correct'
        ? t({
            id: 'quiz.multi.summary.allCorrect',
            message: `正確答案有 ${correctCount} 個：${correctList}。你選了 ${chosenList}。`,
            comment: 'all_correct 作答後的摘要；correctCount 是正解數、correctList 與 chosenList 是以頓號連接的選項文字',
          })
        : t({ id: 'quiz.multi.summary.anyCorrect', message: `你選了 ${chosenList}。`, comment: 'any_correct 作答後的摘要；chosenList 是你選的選項文字' });
    notes = options.map((o) => ({
      id: o.id,
      text: optionTexts.get(o.id) ?? o.id,
      feedback: o.feedback === undefined ? '' : <Markup text={o.feedback} ctx={ctx} options={optionTexts} />,
      chosen: detail.selected.includes(o.id),
    }));
  } else if (detail.kind === 'choice') {
    notes = options.map((o) => ({
      id: o.id,
      text: optionTexts.get(o.id) ?? o.id,
      feedback: o.feedback === undefined ? '' : <Markup text={o.feedback} ctx={ctx} options={optionTexts} />,
      chosen: o.id === detail.selected,
    }));
  } else if (detail.kind === 'classify') {
    const correctCount = detail.correctCount;
    const total = detail.total;
    summary = t({
      id: 'quiz.classify.summary',
      message: `你放對了 ${correctCount} 張，共 ${total} 張。`,
      comment: '分類題作答後的摘要；correctCount 是放對的張數、total 是總張數',
    });
  } else if (detail.kind === 'transaction_effect') {
    const correctCount = detail.correctCount;
    const total = detail.total;
    summary = t({
      id: 'quiz.impact.summary',
      message: `答對 ${correctCount} 個目標，共 ${total} 個。`,
      comment: '交易影響題作答後的摘要；correctCount 是答對的目標數、total 是目標數',
    });
  } else if (judgment) {
    expandAll = true;
    const upsideLabel = t({ id: 'quiz.judgment.upside', message: '好處', comment: '取捨題每個方案說明的小標' });
    const downsideLabel = t({ id: 'quiz.judgment.downside', message: '要注意', comment: '取捨題每個方案說明的小標' });
    notes = options.map((o) => ({
      id: o.id,
      text: optionTexts.get(o.id) ?? o.id,
      feedback: (
        <span>
          <strong>{upsideLabel}</strong>
          {locale === 'en' ? ': ' : '：'}
          <Markup text={o.upside ?? ''} ctx={ctx} options={optionTexts} />
          <br />
          <strong>{downsideLabel}</strong>
          {locale === 'en' ? ': ' : '：'}
          <Markup text={o.downside ?? ''} ctx={ctx} options={optionTexts} />
        </span>
      ),
      chosen: false,
    }));
  }

  const explanationText = judgment ? (q['viewpoint'] as string | undefined) : (q['explanation'] as string | undefined);
  return (
    <FeedbackPanel
      outcome={judgment ? 'neutral' : result.correct ? 'correct' : 'wrong'}
      {...(summary === null ? {} : { summary })}
      {...(multi === undefined ? {} : { multi })}
      {...(explanationText === undefined ? {} : { explanation: <Markup text={explanationText} ctx={ctx} options={optionTexts} /> })}
      {...(notes === undefined ? {} : { options: notes })}
      expandAllOptions={expandAll}
      {...(q.termRefs.length === 0 ? {} : { terms: <TermChips ids={q.termRefs} /> })}
      mistakeState={mistakeState}
      {...(onAddMistake === undefined ? {} : { onAddMistake })}
      onNext={onNext}
    >
      {judgment && (
        <p className="ll-muted ll-small">{t({ id: 'quiz.judgment.unscored', message: '這一題不計分，也不進錯題本。', comment: '取捨題回饋區的說明' })}</p>
      )}
      {nextLabel}
    </FeedbackPanel>
  );
}
