// 選報表（03 第 2.4 節表二）：三張報表卡片的 radiogroup；每張卡片的名稱含報表名與一句說明。
// 報表名是介面字串（三張表的名稱固定）；一句說明由父層給（名詞資料的定義，不在元件裡自己寫術語）。
import { useLingui } from '@lingui/react/macro';
import { useId, type ReactNode } from 'react';
import { deriveChoiceStatus, type ChoiceOptionStatus } from './ChoiceGroup.tsx';
import { CheckCircleIcon, CircleIcon, RadioIcon, XCircleIcon } from './icons.tsx';

export type StatementCode = 'is' | 'bs' | 'cf';

export interface StatementCard {
  code: StatementCode;
  /** 一句說明；可讀名稱是「報表名，說明」 */
  description: ReactNode;
  /** 作答後顯示在卡片下方的說明 */
  feedback?: ReactNode;
}

export interface PickStatementProps {
  name: string;
  /** 群組名稱（題幹）所在元素的 id */
  labelledBy: string;
  cards: readonly StatementCard[];
  value: StatementCode | null;
  checked: boolean;
  correct?: StatementCode;
  onChange: (code: StatementCode) => void;
}

export function useStatementNames(): Record<StatementCode, string> {
  const { t } = useLingui();
  return {
    is: t({ id: 'statement.is', message: '損益表', comment: '三張報表的名稱' }),
    bs: t({ id: 'statement.bs', message: '資產負債表', comment: '三張報表的名稱' }),
    cf: t({ id: 'statement.cf', message: '現金流量表', comment: '三張報表的名稱' }),
  };
}

export function PickStatement({ name, labelledBy, cards, value, checked, correct, onChange }: PickStatementProps) {
  const { t } = useLingui();
  const names = useStatementNames();
  const baseId = useId();
  const statusText: Record<ChoiceOptionStatus, string> = {
    correct_selected: t({ id: 'quiz.choice.status.correctSelected', message: '正確答案，你選了' }),
    also_reasonable: t({ id: 'quiz.choice.status.alsoReasonable', message: '也是合理答案' }),
    correct_not_selected: t({ id: 'quiz.choice.status.correctMissed', message: '正確答案，你沒有選' }),
    wrong_selected: t({ id: 'quiz.choice.status.wrongSelected', message: '不是正確答案，你選了' }),
    wrong_not_selected: t({ id: 'quiz.choice.status.wrongUnselected', message: '不是正確答案' }),
  };
  return (
    <div className="ll-pick-statement" role="radiogroup" aria-labelledby={labelledBy}>
      {cards.map((c) => {
        const chosen = value === c.code;
        const status = checked && correct !== undefined ? deriveChoiceStatus(chosen, correct === c.code) : null;
        const cardLabelId = `${baseId}-${c.code}-label`;
        const fbId = `${baseId}-${c.code}-fb`;
        return (
          <label key={c.code} className={`ll-option ll-statement-card${chosen ? ' is-chosen' : ''}${status ? ` is-${status.replace(/_/g, '-')}` : ''}`}>
            <input
              type="radio"
              name={name}
              value={c.code}
              checked={chosen}
              disabled={checked}
              onChange={() => onChange(c.code)}
              aria-labelledby={cardLabelId}
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
              <span id={cardLabelId}>
                <span className="ll-statement-card__name">{names[c.code]}</span>
                <span className="ll-statement-card__desc">{c.description}</span>
              </span>
              {status && (
                <span id={fbId}>
                  <span className="ll-option__status">{statusText[status]}</span>
                  {c.feedback && <span className="ll-option__feedback">{c.feedback}</span>}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}
