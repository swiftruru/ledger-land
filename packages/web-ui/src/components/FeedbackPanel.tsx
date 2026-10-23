// 回饋面板（03 第 2.9 節、07 第 8.3 節）：依序是結果列、你的答案與正解、解說、逐選項說明、名詞 chip、「看動畫」、錯題本狀態、「下一題」。
// 按「確認答案」後焦點移到這裡的標題（tabindex="-1"），不另用 aria-live；標題前有圖示加文字，不只靠顏色（16 第 4.3 節）。
// 取捨題用中性標題「解說觀點」。判分在父層：這裡只收結果與各段內容。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './Button.tsx';
import { ChatIcon, CheckCircleIcon, XCircleIcon } from './icons.tsx';

export type FeedbackOutcome = 'correct' | 'wrong' | 'neutral';

export interface FeedbackOptionNote {
  id: string;
  text: ReactNode;
  feedback: ReactNode;
  /** 你選的選項一定展開 */
  chosen: boolean;
}

export interface FeedbackPanelProps {
  /** 舊介面：true 答對、false 答錯；與 outcome 二選一 */
  correct?: boolean;
  /** correct 答對、wrong 答錯、neutral 取捨題的「解說觀點」 */
  outcome?: FeedbackOutcome;
  /** 結果列下方的第一句摘要（例如「你選對了其中兩個，還有一個正確答案沒選到。」） */
  summary?: ReactNode;
  /** 多正解題：答對時加「這題的其他合理答案也標出來了。」；答錯時加 all_correct 的規則說明 */
  multi?: 'any_correct' | 'all_correct';
  /** 你的答案與正解（計算型題目的算式等） */
  answer?: ReactNode;
  /** 解說（父層已把 {{option:…}} 等佔位符代入） */
  explanation?: ReactNode;
  /** 逐選項說明；你選的展開，其他收在「看其他選項為什麼不對」，expandAllOptions 時全部展開（multi_choice） */
  options?: readonly FeedbackOptionNote[];
  expandAllOptions?: boolean;
  /** 名詞卡 chip 插槽 */
  terms?: ReactNode;
  /** 「看動畫」：M5 才顯示，由 showAnimation 控制 */
  showAnimation?: boolean;
  onShowAnimation?: () => void;
  /** 錯題本狀態：added 顯示「已放進錯題本」、can_add 顯示「我是猜的，加入錯題本」按鈕 */
  mistakeState?: 'added' | 'can_add' | 'none';
  onAddMistake?: () => void;
  onNext?: () => void;
  children?: ReactNode;
  /** 顯示時把焦點移到標題（預設 true） */
  focusOnMount?: boolean;
  className?: string;
}

export function FeedbackPanel({
  correct,
  outcome,
  summary,
  multi,
  answer,
  explanation,
  options,
  expandAllOptions,
  terms,
  showAnimation,
  onShowAnimation,
  mistakeState = 'none',
  onAddMistake,
  onNext,
  children,
  focusOnMount = true,
  className,
}: FeedbackPanelProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const { t } = useLingui();
  const kind: FeedbackOutcome = outcome ?? (correct ? 'correct' : 'wrong');
  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);
  const chosen = options?.filter((o) => o.chosen) ?? [];
  const others = options?.filter((o) => !o.chosen) ?? [];
  const renderOption = (o: FeedbackOptionNote) => (
    <li key={o.id} className={`ll-feedback__option${o.chosen ? ' is-chosen' : ''}`}>
      <span className="ll-feedback__option-text">{o.text}</span>
      <span className="ll-feedback__option-note">{o.feedback}</span>
    </li>
  );
  return (
    <section
      className={`ll-feedback ll-feedback--${kind === 'correct' ? 'ok' : kind === 'wrong' ? 'no' : 'neutral'}${className ? ` ${className}` : ''}`}
      aria-labelledby={undefined}
    >
      <h2 ref={ref} tabIndex={-1} className="ll-feedback__title">
        <span className="ll-feedback__icon">{kind === 'correct' ? <CheckCircleIcon filled /> : kind === 'wrong' ? <XCircleIcon /> : <ChatIcon />}</span>
        {kind === 'correct' ? (
          <Trans id="quiz.feedback.correct" comment="答對時的回饋標題">
            答對了！
          </Trans>
        ) : kind === 'wrong' ? (
          <Trans id="quiz.feedback.wrong" comment="答錯時的回饋標題">
            再想想
          </Trans>
        ) : (
          <Trans id="quiz.feedback.viewpoint" comment="取捨題（不計分）的中性回饋標題">
            解說觀點
          </Trans>
        )}
      </h2>
      {summary && <p className="ll-feedback__summary">{summary}</p>}
      {multi === 'any_correct' && kind === 'correct' && (
        <p className="ll-feedback__summary">
          <Trans id="quiz.multi.result.anyCorrectNote" comment="any_correct 答對時的加註">
            這題的其他合理答案也標出來了。
          </Trans>
        </p>
      )}
      {multi === 'all_correct' && kind === 'wrong' && (
        <p className="ll-feedback__summary">
          <Trans id="quiz.multi.result.allCorrectRule" comment="all_correct 答錯時的結果說明；不可加入正確答案的數量">
            要選出所有正確答案，而且沒有選到錯誤的選項，才算答對。
          </Trans>
        </p>
      )}
      {answer && (
        <div className="ll-feedback__section">
          <h3 className="ll-feedback__h">
            <Trans id="quiz.feedback.answer" comment="回饋區「你的答案與正解」段落標題">
              你的答案與正解
            </Trans>
          </h3>
          {answer}
        </div>
      )}
      {explanation && (
        <div className="ll-feedback__section">
          <h3 className="ll-feedback__h">
            <Trans id="quiz.feedback.explanation" comment="回饋區「解說」段落標題">
              解說
            </Trans>
          </h3>
          <div className="ll-feedback__explanation">{explanation}</div>
        </div>
      )}
      {options && options.length > 0 && (
        <div className="ll-feedback__section">
          <ul className="ll-feedback__options">{(expandAllOptions ? options : chosen).map(renderOption)}</ul>
          {!expandAllOptions && others.length > 0 && (
            <details className="ll-feedback__others">
              <summary>
                <Trans id="quiz.feedback.otherOptions" comment="回饋區收合其他選項說明的展開鈕">
                  看其他選項為什麼不對
                </Trans>
              </summary>
              <ul className="ll-feedback__options">{others.map(renderOption)}</ul>
            </details>
          )}
        </div>
      )}
      {children}
      {terms && <div className="ll-feedback__terms ll-row">{terms}</div>}
      {showAnimation && onShowAnimation && (
        <div className="ll-row">
          <Button onClick={onShowAnimation}>
            <Trans id="quiz.feedback.showAnimation" comment="題目有 labRef 時開啟實驗室動畫的按鈕（M5）">
              看動畫
            </Trans>
          </Button>
        </div>
      )}
      {mistakeState === 'added' && (
        <p className="ll-feedback__mistake">{t({ id: 'quiz.feedback.mistakeAdded', message: '已放進錯題本', comment: '答錯時的錯題本狀態' })}</p>
      )}
      {mistakeState === 'can_add' && onAddMistake && (
        <div className="ll-row">
          <Button onClick={onAddMistake} className="ll-btn--small">
            <Trans id="quiz.feedback.addMistake" comment="答對時可自行加入錯題本的小按鈕">
              我是猜的，加入錯題本
            </Trans>
          </Button>
        </div>
      )}
      {onNext && (
        <div className="ll-row ll-actions">
          <Button variant="primary" onClick={onNext}>
            <Trans id="quiz.next" comment="回饋之後前往下一題">
              下一題
            </Trans>
          </Button>
        </div>
      )}
    </section>
  );
}
