// 單選題的選項群組（07 第 9.1 節、05 第 3.6 節的 M0b 子集）：fieldset 加 legend、radio、按「確認答案」後才判分，
// 作答後每個選項以文字說明狀態（不只靠顏色）。多正解題（any_correct、all_correct）在 M2 補上。
import { Trans, useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import { Button } from './Button.tsx';

export interface ChoiceOption {
  id: string;
  text: ReactNode;
  feedback?: ReactNode;
}

export interface ChoiceGroupProps {
  name: string;
  prompt: ReactNode;
  options: readonly ChoiceOption[];
  correctOptionId: string;
  selected: string | null;
  checked: boolean;
  onSelect: (id: string) => void;
  onCheck: () => void;
  onRetry?: () => void;
}

export function ChoiceGroup({ name, prompt, options, correctOptionId, selected, checked, onSelect, onCheck, onRetry }: ChoiceGroupProps) {
  const { t } = useLingui();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!checked) onCheck();
      }}
    >
      <fieldset className="ll-choice">
        <legend>{prompt}</legend>
        <div className="ll-choice__list">
          {options.map((o) => {
            const chosen = selected === o.id;
            const isCorrect = o.id === correctOptionId;
            const state = !checked ? '' : isCorrect ? ' is-correct' : chosen ? ' is-wrong' : '';
            const status = !checked
              ? null
              : isCorrect
                ? chosen
                  ? t({ id: 'quiz.choice.status.correctSelected', message: '正確答案，你選了' })
                  : t({ id: 'quiz.choice.status.correctMissed', message: '正確答案，你沒有選' })
                : chosen
                  ? t({ id: 'quiz.choice.status.wrongSelected', message: '不是正確答案，你選了' })
                  : t({ id: 'quiz.choice.status.wrongUnselected', message: '不是正確答案' });
            return (
              <label key={o.id} className={`ll-option${state}`}>
                <input
                  type="radio"
                  name={name}
                  value={o.id}
                  checked={chosen}
                  disabled={checked}
                  onChange={() => onSelect(o.id)}
                  aria-describedby={checked ? `${name}-fb-${o.id}` : undefined}
                />
                <span>
                  {o.text}
                  {checked && (
                    <span id={`${name}-fb-${o.id}`}>
                      <span className="ll-option__status">{status}</span>
                      {o.feedback && <span className="ll-option__feedback">{o.feedback}</span>}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="ll-row ll-actions">
        {!checked ? (
          <Button type="submit" variant="primary" disabled={!selected}>
            <Trans id="quiz.submit" comment="作答的共用按鈕，按下後才判分">
              確認答案
            </Trans>
          </Button>
        ) : (
          onRetry && (
            <Button onClick={onRetry}>
              <Trans id="quiz.retry" comment="作答後重新作答同一題">
                再試一次
              </Trans>
            </Button>
          )
        )}
      </div>
    </form>
  );
}
