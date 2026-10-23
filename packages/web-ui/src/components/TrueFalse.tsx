// 是非題（03 第 2.4 節表二）：兩個大按鈕「對」「不對」組成 radiogroup，群組名稱是完整敘述，避免只聽到「對、不對」。
// 判分在父層：checked 後給 correct（正解），元件以文字加圖示顯示每個選項的狀態。
import { useLingui } from '@lingui/react/macro';
import { useId, type ReactNode } from 'react';
import { deriveChoiceStatus, type ChoiceOptionStatus } from './ChoiceGroup.tsx';
import { CheckCircleIcon, CircleIcon, RadioIcon, XCircleIcon } from './icons.tsx';

export interface TrueFalseProps {
  name: string;
  /** 要判斷的敘述（畫面上顯示，也是 radiogroup 的名稱） */
  statement: ReactNode;
  /** 已選：true 是「對」、false 是「不對」 */
  value: boolean | null;
  checked: boolean;
  /** 正解；checked 後才需要 */
  correct?: boolean;
  onChange: (value: boolean) => void;
  /** 作答後顯示在所選按鈕下方的說明（題目的 feedbackTrue 或 feedbackFalse，父層依 value 挑好） */
  feedback?: ReactNode;
}

export function TrueFalse({ name, statement, value, checked, correct, onChange, feedback }: TrueFalseProps) {
  const { t } = useLingui();
  const labelId = useId();
  const statusText: Record<ChoiceOptionStatus, string> = {
    correct_selected: t({ id: 'quiz.choice.status.correctSelected', message: '正確答案，你選了' }),
    also_reasonable: t({ id: 'quiz.choice.status.alsoReasonable', message: '也是合理答案' }),
    correct_not_selected: t({ id: 'quiz.choice.status.correctMissed', message: '正確答案，你沒有選' }),
    wrong_selected: t({ id: 'quiz.choice.status.wrongSelected', message: '不是正確答案，你選了' }),
    wrong_not_selected: t({ id: 'quiz.choice.status.wrongUnselected', message: '不是正確答案' }),
  };
  const choices: { v: boolean; label: string }[] = [
    { v: true, label: t({ id: 'quiz.tf.true', message: '對', comment: '是非題的按鈕' }) },
    { v: false, label: t({ id: 'quiz.tf.false', message: '不對', comment: '是非題的按鈕' }) },
  ];
  return (
    <div className="ll-tf">
      <p id={labelId} className="ll-tf__statement">
        {statement}
      </p>
      <div className="ll-tf__choices" role="radiogroup" aria-labelledby={labelId}>
        {choices.map(({ v, label }) => {
          const chosen = value === v;
          const status = checked && correct !== undefined ? deriveChoiceStatus(chosen, correct === v) : null;
          const fbId = `${name}-fb-${v ? 'true' : 'false'}`;
          const textId = `${name}-text-${v ? 'true' : 'false'}`;
          return (
            <label key={String(v)} className={`ll-option ll-tf__option${chosen ? ' is-chosen' : ''}${status ? ` is-${status.replace(/_/g, '-')}` : ''}`}>
              <input
                type="radio"
                name={name}
                value={v ? 'true' : 'false'}
                checked={chosen}
                disabled={checked}
                onChange={() => onChange(v)}
                aria-labelledby={textId}
                aria-describedby={status ? fbId : undefined}
                className="ll-option__input"
              />
              <span className="ll-option__mark">
                {status === 'correct_selected' ? (
                  <CheckCircleIcon filled />
                ) : status === 'correct_not_selected' ? (
                  <CheckCircleIcon />
                ) : status === 'wrong_selected' ? (
                  <XCircleIcon />
                ) : chosen ? (
                  <RadioIcon />
                ) : (
                  <CircleIcon />
                )}
              </span>
              <span className="ll-option__body">
                <span id={textId} className="ll-option__text ll-tf__label">
                  {label}
                </span>
                {status && (
                  <span id={fbId}>
                    <span className="ll-option__status">{statusText[status]}</span>
                    {chosen && feedback && <span className="ll-option__feedback">{feedback}</span>}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
