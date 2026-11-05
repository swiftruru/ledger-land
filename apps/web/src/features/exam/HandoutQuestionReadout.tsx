// 苦練區一題的「唯讀」呈現（M4c 第二批，2026-11-05）：主題、情境、問題、三個選項（正解打勾、可標出我選的）、解答與解析，逐字照講義。
// 用在背題瀏覽、錯題與不熟的清單、練習頁總結卡的答錯清單、老師審核頁（模擬考的結果也用）。作答用的是 HandoutQuestionCard。
// hideAnswer 時正解標記、解答行與解析用 CSS 藏起來（不是不渲染）：背題頁的「遮住答案」開關與列印都只切一個 class。
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import { Badge, CheckCircleIcon, XCircleIcon } from '@ledgerland/web-ui';
import type { HandoutQuestionSnapshot } from '../../lib/content.ts';
import { HandoutText } from './HandoutText.tsx';

export interface HandoutQuestionReadoutProps {
  q: HandoutQuestionSnapshot;
  /** 主題的標題層級；false 不畫主題（外層的展開列已經是主題） */
  heading?: 'h2' | 'h3' | 'h4' | false;
  headingId?: string;
  /** 主題上面的來源列（講義與頁次、原因標籤），由頁面給 */
  source?: ReactNode;
  /** 我選的講義字母：標在那個選項上，選錯時用 danger */
  chosen?: string | null;
  hideAnswer?: boolean;
  /** 取代預設的「正確答案：B」那一行（老師審核頁寫「講義的解答」） */
  answerLine?: ReactNode;
  /** 解析上面的「解析出自講義」標籤；老師審核頁不需要 */
  explainTag?: boolean;
  /** 接在解析後面（老師審核頁的原因框、背題頁的「看答案」按鈕） */
  children?: ReactNode;
  className?: string;
}

export function HandoutQuestionReadout({
  q,
  heading = 'h3',
  headingId,
  source,
  chosen,
  hideAnswer = false,
  answerLine,
  explainTag = true,
  children,
  className,
}: HandoutQuestionReadoutProps) {
  const { t } = useLingui();
  const Heading = heading === false ? null : heading;
  const letters = q.answer.join('、');
  return (
    <div className={`ll-exam-q${hideAnswer ? ' is-answer-hidden' : ''}${className ? ` ${className}` : ''}`}>
      {source !== undefined && <p className="ll-exam-q__source">{source}</p>}
      {Heading && (
        <Heading id={headingId} className="ll-exam-q__title" lang="zh-TW">
          {q.topic}
        </Heading>
      )}
      <HandoutText text={q.scenario} className="ll-exam-q__scenario" />
      <HandoutText text={q.question} className="ll-exam-q__question" />
      <ol className="ll-exam-q__options" lang="zh-TW">
        {q.options.map((o) => {
          const correct = q.answer.includes(o.letter);
          const mine = chosen === o.letter;
          return (
            <li key={o.letter} className={`ll-exam-q__option${correct ? ' is-correct' : ''}${mine && !correct ? ' is-wrong' : ''}`}>
              <span className="ll-exam-q__letter">{o.letter}.</span>
              <span className="ll-exam-q__text">
                {o.text}
                {mine && (
                  <span className="ll-exam-q__mine" lang={undefined}>
                    {t({ id: 'exam.q.mine', message: '我選的', comment: '苦練區唯讀的題目：標在我上次選的選項後面' })}
                  </span>
                )}
              </span>
              {correct ? (
                <span className="ll-exam-q__mark">
                  <CheckCircleIcon size={18} />
                  <span className="ll-sr-only">{t({ id: 'exam.teacher.correct', message: '正解', comment: '審核頁：講義標的正解（螢幕閱讀器）' })}</span>
                </span>
              ) : mine ? (
                <span className="ll-exam-q__mark ll-exam-q__mark--wrong">
                  <XCircleIcon size={18} />
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="ll-exam-q__answer ll-num">
        {answerLine ??
          t({ id: 'exam.feedback.answer', message: `正確答案：${letters}`, comment: '苦練區回饋的正解行；letters 是講義的字母（可能是「B、C」）' })}
      </p>
      <div className="ll-exam-q__explain">
        {explainTag && (
          <Badge kind="info" className="ll-exam-explain__tag">
            {t({ id: 'exam.feedback.fromHandout', message: '解析出自講義', comment: '苦練區回饋：解析是老師講義的原文' })}
          </Badge>
        )}
        <HandoutText text={q.explanation} />
      </div>
      {children}
    </div>
  );
}
