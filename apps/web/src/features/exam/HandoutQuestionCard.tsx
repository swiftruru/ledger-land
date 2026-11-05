// 苦練區的一題（M4c，08 的講義題庫一節）：web-ui 的 QuestionCard、ChoiceGroup、FeedbackPanel 直接組起來，不走作答區的 QuestionView 與 FeedbackView
// （那兩個綁著內容快照的題型與名詞 chip）。題幹標題是講義的主題，情境是一段引述，問題是選項群組的 legend；選項、解答與解析逐字照講義。
// 選項順序（維護者 2026-11-04 的決定）：預設和講義一樣（選項前面帶 A.、B.、C.）；打亂時用 packages/quiz 的固定種子打散，確認前不顯示字母，
// 確認後每個選項下面標「講義的 B」，老師解析裡提到的 A、B、C 才對得上。B/C 都對的那一題是任一正確（any_correct，D12）。
import { useLingui } from '@lingui/react/macro';
import { useMemo, type ReactNode } from 'react';
import { shuffleChoiceOptions } from '@ledgerland/quiz';
import { Badge, ChoiceGroup, FeedbackPanel, QuestionCard } from '@ledgerland/web-ui';
import type { HandoutQuestionSnapshot } from '../../lib/content.ts';
import { HandoutText } from './HandoutText.tsx';
import type { RunAnswer } from './run.ts';

export interface HandoutQuestionCardProps {
  q: HandoutQuestionSnapshot;
  answer: RunAnswer;
  shuffle: boolean;
  runId: string;
  index: number;
  total: number;
  onSelect: (letter: string) => void;
  onCheck: () => void;
  onNext: () => void;
  /** 剛按下確認：回饋面板捲到畫面上緣 */
  scrollOnMount: boolean;
  /** 模擬考（M4c 第二批）：不判分、沒有回饋，隨時可以改選；主按鈕是 submitLabel（「下一題」或「交卷」），沒選也能按（跳過）。
   *  onCheck 是按下主按鈕、onNext 不用 */
  mode?: 'drill' | 'mock';
  submitLabel?: ReactNode;
  /** 題號列右側（模擬考的倒數） */
  meta?: ReactNode;
}

export function HandoutQuestionCard({
  q,
  answer,
  shuffle,
  runId,
  index,
  total,
  onSelect,
  onCheck,
  onNext,
  scrollOnMount,
  mode = 'drill',
  submitLabel,
  meta,
}: HandoutQuestionCardProps) {
  const { t } = useLingui();
  const options = useMemo(() => {
    if (!shuffle) return q.options;
    const order = shuffleChoiceOptions(
      q.options.map((o) => ({ id: o.letter })),
      { questionId: q.id, rev: q.rev, attemptId: runId },
    );
    return order.map((o) => q.options.find((x) => x.letter === o.id)!);
  }, [q, shuffle, runId]);
  const mock = mode === 'mock';
  const checked = !mock && answer.checked;
  const multi = q.answer.length > 1;
  const letters = q.answer.join('、');
  return (
    <QuestionCard
      className="ll-exam-question"
      index={index}
      total={total}
      prompt={<HandoutText as="span" text={q.topic} />}
      checked={checked}
      canSubmit={mock || answer.chosen !== null}
      onSubmit={onCheck}
      {...(submitLabel === undefined ? {} : { submitLabel })}
      {...(meta === undefined ? {} : { meta })}
      feedback={
        checked ? (
          <FeedbackPanel
            correct={answer.correct === true}
            {...(multi ? { multi: 'any_correct' as const } : {})}
            answer={t({ id: 'exam.feedback.answer', message: `正確答案：${letters}`, comment: '苦練區回饋的正解行；letters 是講義的字母（可能是「B、C」）' })}
            explanation={
              <div className="ll-exam-explain">
                <Badge kind="info" className="ll-exam-explain__tag">
                  {t({ id: 'exam.feedback.fromHandout', message: '解析出自講義', comment: '苦練區回饋：解析是老師講義的原文' })}
                </Badge>
                <HandoutText text={q.explanation} />
              </div>
            }
            onNext={onNext}
            scrollOnMount={scrollOnMount}
          />
        ) : undefined
      }
    >
      {() => (
        <>
          <blockquote className="ll-exam-scenario">
            <span className="ll-exam-scenario__label">{t({ id: 'exam.scenario', message: '情境', comment: '苦練區題目的情境段落標籤（講義的用語）' })}</span>
            <HandoutText text={q.scenario} />
          </blockquote>
          <ChoiceGroup
            name={`exam-${q.id}`}
            prompt={<HandoutText as="span" text={q.question} />}
            mode="single"
            {...(multi && !mock ? { hint: 'any_correct' as const } : {})}
            options={options.map((o) => ({
              id: o.letter,
              text: (
                <span lang="zh-TW">
                  {!shuffle && (
                    <span className="ll-exam-letter" aria-hidden="true">
                      {o.letter}.
                    </span>
                  )}
                  {!shuffle && <span className="ll-sr-only">{o.letter}. </span>}
                  {o.text}
                </span>
              ),
              ...(shuffle
                ? {
                    feedback: (
                      <Badge className="ll-exam-letter-tag">
                        {t({ id: 'exam.option.handoutLetter', message: `講義的 ${o.letter}`, comment: '打亂選項時確認後標在選項下的講義字母' })}
                      </Badge>
                    ),
                  }
                : {}),
            }))}
            correctOptionIds={q.answer}
            selected={answer.chosen}
            checked={checked}
            onSelect={onSelect}
          />
        </>
      )}
    </QuestionCard>
  );
}
