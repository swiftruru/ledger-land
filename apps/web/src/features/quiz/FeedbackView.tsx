// 回饋區（03 第 2.9 節）：由 packages/quiz 的 ScoreResult 組出 FeedbackPanel 的各段：結果列、摘要（多正解題數量、分類與逐目標的對幾個）、
// 解說（{{option:…}} 已代入）、逐選項說明（multi_choice 全部展開、取捨題列出三個方案的好處與要注意）、名詞 chip、錯題本狀態、「下一題」。
// 這一題剛收進圖鑑的名詞（newTermIds）：「相關名詞」小標旁「新收進 N」，那幾個 chip 整顆鍍金、最前面是金色勾章（不再用浮動提示，M3 驗收第 2 輪）。
import { useLingui } from '@lingui/react/macro';
import { useRef, useState, type ReactNode } from 'react';
import type { ScoreResult } from '@ledgerland/quiz';
import { FeedbackPanel, TermChip, type FeedbackOptionNote } from '@ledgerland/web-ui';
import type { QuestionSnapshot } from '../../lib/content.ts';
import { Markup } from './Markup.tsx';
import { optionsOf, useOptionTexts, useRatioStrings, valueContextOf } from './QuestionView.tsx';
import { formatRatioValue } from './ratio-format.ts';
import type { RatioUnit } from './ratio-units.ts';
import { useTerms } from './terms.tsx';
import './feedback.css';

export interface FeedbackViewProps {
  q: QuestionSnapshot;
  result: ScoreResult;
  /** 已按「我是猜的」或答錯已自動放進錯題本 */
  mistakeState: 'added' | 'can_add' | 'none';
  onAddMistake?: () => void;
  onNext: () => void;
  nextLabel?: ReactNode;
  /** 取捨題的「收藏」（03 第 2.7 節）：持久化之後再接；沒給時按鈕只切換自己的狀態 */
  onFavourite?: () => void;
  favourited?: boolean;
  /** 剛按下「確認答案」：面板出現時捲到畫面上緣（還原暫存、切換語言重新掛載時不給） */
  scrollOnMount?: boolean;
  /** 這一題剛收進圖鑑的名詞 ID（寫進進度之後才知道） */
  newTermIds?: readonly string[];
}

function TermChips({ ids, fresh }: { ids: readonly string[]; fresh: ReadonlySet<string> }) {
  const { labelOf } = useTerms();
  return (
    <>
      {ids.map((id) => (
        <TermChipButton key={id} id={id} label={labelOf(id) ?? id} isNew={fresh.has(id)} />
      ))}
    </>
  );
}

function TermChipButton({ id, label, isNew }: { id: string; label: string; isNew: boolean }) {
  const { openTerm } = useTerms();
  const ref = useRef<HTMLButtonElement>(null);
  return <TermChip ref={ref} label={label} isNew={isNew} onClick={() => openTerm(id, ref)} />;
}

function joinList(items: readonly string[], locale: string): string {
  return items.join(locale === 'en' ? ', ' : '、');
}

export function FeedbackView({
  q,
  result,
  mistakeState,
  onAddMistake,
  onNext,
  nextLabel,
  onFavourite,
  favourited,
  scrollOnMount,
  newTermIds,
}: FeedbackViewProps) {
  const { t } = useLingui();
  const { locale } = useTerms();
  const { versionLabel } = useRatioStrings();
  const optionTexts = useOptionTexts(q);
  const ctx = valueContextOf(q);
  const judgment = q.type === 'judgment';
  const options = optionsOf(q);
  const detail = result.detail;
  const [localFavourite, setLocalFavourite] = useState(false);
  const isFavourite = favourited ?? localFavourite;

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
      text: <Markup text={optionTexts.get(o.id) ?? o.id} plainTerms />,
      feedback: o.feedback === undefined ? '' : <Markup text={o.feedback} ctx={ctx} options={optionTexts} />,
      chosen: detail.selected.includes(o.id),
    }));
  } else if (detail.kind === 'choice') {
    notes = options.map((o) => ({
      id: o.id,
      text: <Markup text={optionTexts.get(o.id) ?? o.id} plainTerms />,
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
  } else if (detail.kind === 'five_step_fill') {
    const correctCount = detail.correctCount;
    const total = detail.total;
    summary = t({
      id: 'quiz.fiveStep.summary',
      message: `填對 ${correctCount} 格，共 ${total} 格。`,
      comment: '五步驟勾稽填格作答後的摘要；correctCount 是填對的格數、total 是總格數',
    });
  } else if (detail.kind === 'numeric') {
    const unit = q['answerUnit'] as RatioUnit | undefined;
    const decimals = typeof q['decimals'] === 'number' ? q['decimals'] : undefined;
    const naText = t({ id: 'quiz.ratio.na', message: 'N/A', comment: '指標正解是 N/A 時顯示的文字' });
    const submitted = detail.submitted === null ? naText : formatRatioValue(detail.submitted, unit, locale, decimals);
    const expected = detail.expectedValue === null ? naText : formatRatioValue(detail.expectedValue, unit, locale, decimals);
    const ratioRef = q.compiled?.ratio?.ratioRef ?? (q['compute'] as { ratioRef?: string } | undefined)?.ratioRef ?? '';
    const version = versionLabel(ratioRef.slice(ratioRef.indexOf('@') + 1));
    summary = t({
      id: 'quiz.ratio.summary',
      message: `你的答案是 ${submitted}，正解是 ${expected}（本題採${version}）。`,
      comment: '指標計算題作答後的摘要；submitted 與 expected 已格式化、version 是指標版本名稱',
    });
  } else if (detail.kind === 'journal_entry') {
    const keys = new Set([...detail.missing, ...detail.extra].map((l) => `${l.account}|${l.side}`));
    const count = keys.size;
    summary = result.correct
      ? t({ id: 'quiz.journal.summary.correct', message: '分錄全部正確。', comment: '分錄題答對時的摘要' })
      : t({ id: 'quiz.journal.summary.wrong', message: `有 ${count} 行要修正。`, comment: '分錄題答錯時的摘要；count 是要修正的行數' });
  } else if (judgment) {
    expandAll = true;
    summary = t({ id: 'quiz.judgment.shown', message: '已顯示三個方案的解說觀點。', comment: '取捨題確認後的摘要，焦點移到標題時一併讀出' });
    const upsideLabel = t({ id: 'quiz.judgment.upside', message: '好處', comment: '取捨題每個方案說明的小標' });
    const downsideLabel = t({ id: 'quiz.judgment.downside', message: '要注意', comment: '取捨題每個方案說明的小標' });
    notes = options.map((o) => ({
      id: o.id,
      text: <Markup text={optionTexts.get(o.id) ?? o.id} plainTerms />,
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

  // 只算這一題的相關名詞裡新收進的（recordAttempt 的 unlockedTerms 本來就是 termRefs 的子集）
  const fresh = new Set((newTermIds ?? []).filter((id) => q.termRefs.includes(id)));
  const explanationText = judgment ? (q['viewpoint'] as string | undefined) : (q['explanation'] as string | undefined);
  return (
    <FeedbackPanel
      outcome={judgment ? 'neutral' : result.correct ? 'correct' : 'wrong'}
      {...(summary === null ? {} : { summary })}
      {...(multi === undefined ? {} : { multi })}
      {...(explanationText === undefined ? {} : { explanation: <Markup text={explanationText} ctx={ctx} options={optionTexts} /> })}
      {...(notes === undefined ? {} : { options: notes })}
      expandAllOptions={expandAll}
      {...(q.termRefs.length === 0 ? {} : { terms: <TermChips ids={q.termRefs} fresh={fresh} />, newTerms: fresh.size })}
      mistakeState={mistakeState}
      {...(onAddMistake === undefined ? {} : { onAddMistake })}
      {...(judgment
        ? {
            onFavourite: () => {
              setLocalFavourite((v) => !v);
              onFavourite?.();
            },
            favourited: isFavourite,
          }
        : {})}
      onNext={onNext}
      scrollOnMount={scrollOnMount === true}
    >
      {judgment && (
        <p className="ll-muted ll-small">{t({ id: 'quiz.judgment.unscored', message: '這一題不計分，也不進錯題本。', comment: '取捨題回饋區的說明' })}</p>
      )}
      {nextLabel}
    </FeedbackPanel>
  );
}
