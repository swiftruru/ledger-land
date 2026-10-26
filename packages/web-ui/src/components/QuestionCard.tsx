// 題目外框（07 第 9 節、站規 2.4.1）：題號「第 1 題，共 6 題」（同一列右側是 meta，例如計時）與它下方的進度條（ProgressBar md，確認後才往前一格）、題幹標題、
// 題型子元件插槽、「確認答案」與「下一題」（primary lg；手機撐滿、600px 以上靠右，版面在 15-quiz-session.css 的 .ll-question__actions）。
// 停用的「確認答案」是站規 1.2.3 的中性灰加虛線外框，文字照樣讀得到。
// 判分由父層負責：按鈕只在 canSubmit 時可按，按下後呼叫 onSubmit；checked 後回饋由父層放進 feedback 插槽。
import { Trans, useLingui } from '@lingui/react/macro';
import { useId, type ReactNode } from 'react';
import { Button } from './Button.tsx';
import { ProgressBar } from './ProgressBar.tsx';

export interface QuestionCardProps {
  /** 1 起算 */
  index: number;
  total: number;
  prompt: ReactNode;
  /** 題幹標題的層級；頁面標題是 h1，預設 h2 */
  promptAs?: 'h2' | 'h3';
  /** 題幹標題的 id（子元件以 aria-labelledby 指向它）；不給就自動產生，可從 children 的 render prop 取得 */
  children: ReactNode | ((ctx: { promptId: string }) => ReactNode);
  checked: boolean;
  /** 沒有作答時為 false，「確認答案」停用 */
  canSubmit: boolean;
  onSubmit: () => void;
  /** 分類題改成「確認分類」等；預設「確認答案」 */
  submitLabel?: ReactNode;
  /** 作答後顯示在子元件下方（FeedbackPanel） */
  feedback?: ReactNode;
  /** 給了就在作答後顯示「下一題」；若 FeedbackPanel 已放「下一題」就不要再給 */
  onNext?: () => void;
  /** 題號列右側的額外內容（計時、「這一關計時」按鈕、題型標籤）：和題號同一列、靠右，窄螢幕放不下時換到下一行 */
  meta?: ReactNode;
  className?: string;
}

export function QuestionCard({
  index,
  total,
  prompt,
  promptAs: Heading = 'h2',
  children,
  checked,
  canSubmit,
  onSubmit,
  submitLabel,
  feedback,
  onNext,
  meta,
  className,
}: QuestionCardProps) {
  const { t } = useLingui();
  const promptId = useId();
  // 進度：確認這一題之後才算完成一格（第 1 題作答前是空的）
  const done = Math.max(0, Math.min(total, index - (checked ? 0 : 1)));
  return (
    <article className={`ll-card ll-question${className ? ` ${className}` : ''}`} aria-labelledby={promptId}>
      <div className="ll-question__head">
        <div className="ll-question__progress">
          <p className="ll-question__count">
            {t({ id: 'quiz.progress', message: `第 ${index} 題，共 ${total} 題`, comment: '題目外框頂端的進度文字；index 與 total 是題號與題數' })}
          </p>
          {meta && <div className="ll-question__meta">{meta}</div>}
        </div>
        <ProgressBar value={done} max={total} size="md" className="ll-question__bar" />
      </div>
      <Heading id={promptId} className="ll-question__prompt">
        {prompt}
      </Heading>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!checked && canSubmit) onSubmit();
        }}
      >
        <div className="ll-question__body">{typeof children === 'function' ? children({ promptId }) : children}</div>
        {!checked && (
          <div className="ll-question__actions">
            <Button type="submit" variant="primary" size="lg" disabled={!canSubmit}>
              {submitLabel ?? (
                <Trans id="quiz.submit" comment="作答的共用按鈕，按下後才判分">
                  確認答案
                </Trans>
              )}
            </Button>
          </div>
        )}
      </form>
      {checked && feedback}
      {checked && onNext && (
        <div className="ll-question__actions">
          <Button variant="primary" size="lg" onClick={onNext}>
            <Trans id="quiz.next" comment="回饋之後前往下一題">
              下一題
            </Trans>
          </Button>
        </div>
      )}
    </article>
  );
}
