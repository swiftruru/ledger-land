// 選擇題的選項群組（07 第 9.1 節、03 第 2.12 節、05 第 3.6 節）：原生 fieldset，單選用 radio、複選用 checkbox，
// 整張選項卡片都是 label。判分不在這裡：按「確認答案」後由父層把結果（checked 加 correctOptionIds 或逐選項的 statuses）傳進來，
// 元件只負責把每個選項的狀態以文字加圖示顯示（不只靠顏色），並以 aria-describedby 連到選項。
import { Trans, useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import { Button } from './Button.tsx';
import { CheckCircleIcon, CheckSquareIcon, CircleIcon, LightbulbIcon, RadioIcon, SquareIcon, XCircleIcon } from './icons.tsx';

export interface ChoiceOption {
  id: string;
  text: ReactNode;
  /** 作答後顯示在選項下方的說明（父層已把 {{option:…}} 等佔位符代入） */
  feedback?: ReactNode;
}

/** 作答後每個選項的狀態（07 第 9.1 節的表） */
export type ChoiceOptionStatus = 'correct_selected' | 'also_reasonable' | 'correct_not_selected' | 'wrong_selected' | 'wrong_not_selected';

/** 多正解題的判分提示；單選題不給 */
export type ChoiceHint = 'any_correct' | 'all_correct';

export interface ChoiceGroupProps {
  name: string;
  /** 題幹。沒有 hint 時放在 legend 當群組名稱；有 hint 時題幹改放群組前，legend 是提示（03 第 2.12 節） */
  prompt?: ReactNode;
  /** 題幹已由外層（QuestionCard）的標題顯示時，給該標題的 id，讓群組以它命名 */
  promptId?: string;
  /** 單選（radio）或複選（checkbox） */
  mode?: 'single' | 'multiple';
  /** 多正解題在 legend 顯示的固定提示 */
  hint?: ChoiceHint;
  options: readonly ChoiceOption[];
  /** 單一正解（single_choice 等） */
  correctOptionId?: string;
  /** 多正解（multi_choice）；給了就以這個為準 */
  correctOptionIds?: readonly string[];
  /** 作答後逐選項的狀態；給了就蓋過由 correctOptionIds 推導的結果（給 packages/quiz 的判分結果用） */
  statuses?: Readonly<Partial<Record<string, ChoiceOptionStatus>>>;
  /** 單選是選項 ID 或 null；複選是已勾選的 ID 陣列 */
  selected: string | null | readonly string[];
  checked: boolean;
  /** 單選：選取；複選：切換該選項 */
  onSelect: (id: string) => void;
  /** 給了才顯示「確認答案」按鈕列；由 QuestionCard 統一放按鈕時不給 */
  onCheck?: () => void;
  onRetry?: () => void;
}

export function toSelectedIds(selected: string | null | readonly string[]): readonly string[] {
  if (selected === null) return [];
  return typeof selected === 'string' ? [selected] : selected;
}

/** 由正解集合推導每個選項作答後的狀態（any_correct 未選的正解是「也是合理答案」） */
export function deriveChoiceStatus(chosen: boolean, isCorrect: boolean, hint?: ChoiceHint): ChoiceOptionStatus {
  if (isCorrect) return chosen ? 'correct_selected' : hint === 'any_correct' ? 'also_reasonable' : 'correct_not_selected';
  return chosen ? 'wrong_selected' : 'wrong_not_selected';
}

function StatusMark({ status, mode }: { status: ChoiceOptionStatus; mode: 'single' | 'multiple' }) {
  switch (status) {
    case 'correct_selected':
      return <CheckCircleIcon filled />;
    case 'also_reasonable':
    case 'correct_not_selected':
      return <CheckCircleIcon />;
    case 'wrong_selected':
      return <XCircleIcon />;
    default:
      return mode === 'multiple' ? <SquareIcon /> : <CircleIcon />;
  }
}

export function ChoiceGroup({
  name,
  prompt,
  promptId,
  mode = 'single',
  hint,
  options,
  correctOptionId,
  correctOptionIds,
  statuses,
  selected,
  checked,
  onSelect,
  onCheck,
  onRetry,
}: ChoiceGroupProps) {
  const { t } = useLingui();
  const selectedIds = toSelectedIds(selected);
  const correctSet = new Set(correctOptionIds ?? (correctOptionId ? [correctOptionId] : []));
  const statusText: Record<ChoiceOptionStatus, string> = {
    correct_selected: t({ id: 'quiz.choice.status.correctSelected', message: '正確答案，你選了' }),
    also_reasonable: t({ id: 'quiz.choice.status.alsoReasonable', message: '也是合理答案', comment: 'any_correct 沒選、但也是正解的選項' }),
    correct_not_selected: t({ id: 'quiz.choice.status.correctMissed', message: '正確答案，你沒有選' }),
    wrong_selected: t({ id: 'quiz.choice.status.wrongSelected', message: '不是正確答案，你選了' }),
    wrong_not_selected: t({ id: 'quiz.choice.status.wrongUnselected', message: '不是正確答案' }),
  };
  const hintText =
    hint === 'any_correct'
      ? t({
          id: 'quiz.multi.hint.anyCorrect',
          message: '這題有不只一個合理答案，選出任一個即可。',
          comment: '多正解題 any_correct 的提示；不可加入正確答案的數量',
        })
      : hint === 'all_correct'
        ? t({ id: 'quiz.multi.hint.allCorrect', message: '選出所有正確答案（可複選）。', comment: '多正解題 all_correct 的提示；不可加入正確答案的數量' })
        : null;
  const promptBeforeGroup = hintText !== null && prompt !== undefined;
  const legendId = `${name}-legend`;
  const promptBeforeId = `${name}-prompt`;
  // 有提示時 legend 是提示，群組的可讀名稱再加上題幹（群組前的題幹或外層標題）
  const labelledBy = hintText === null ? undefined : promptBeforeGroup ? `${promptBeforeId} ${legendId}` : promptId ? `${promptId} ${legendId}` : undefined;
  const body = (
    <>
      {promptBeforeGroup && (
        <p id={promptBeforeId} className="ll-choice__prompt">
          {prompt}
        </p>
      )}
      <fieldset className="ll-choice" data-mode={mode} aria-labelledby={labelledBy}>
        {hintText !== null ? (
          <legend id={legendId} className="ll-choice__hint">
            <LightbulbIcon size={16} />
            <span>{hintText}</span>
          </legend>
        ) : prompt !== undefined ? (
          <legend id={legendId}>{prompt}</legend>
        ) : null}
        <div className="ll-choice__list">
          {options.map((o) => {
            const chosen = selectedIds.includes(o.id);
            const status: ChoiceOptionStatus | null = checked ? (statuses?.[o.id] ?? deriveChoiceStatus(chosen, correctSet.has(o.id), hint)) : null;
            const stateClass = status === null ? '' : ` is-${status.replace(/_/g, '-')}`;
            const fbId = `${name}-fb-${o.id}`;
            const textId = `${name}-text-${o.id}`;
            return (
              <label key={o.id} className={`ll-option${chosen ? ' is-chosen' : ''}${stateClass}`}>
                <input
                  type={mode === 'multiple' ? 'checkbox' : 'radio'}
                  name={name}
                  value={o.id}
                  checked={chosen}
                  disabled={checked}
                  onChange={() => onSelect(o.id)}
                  aria-labelledby={textId}
                  aria-describedby={checked ? fbId : undefined}
                  className="ll-option__input"
                />
                <span className="ll-option__mark">
                  {status !== null ? (
                    <StatusMark status={status} mode={mode} />
                  ) : mode === 'multiple' ? (
                    chosen ? (
                      <CheckSquareIcon />
                    ) : (
                      <SquareIcon />
                    )
                  ) : chosen ? (
                    <RadioIcon />
                  ) : (
                    <CircleIcon />
                  )}
                </span>
                <span className="ll-option__body">
                  <span id={textId} className="ll-option__text">
                    {o.text}
                  </span>
                  {status !== null && (
                    <span id={fbId}>
                      <span className="ll-option__status">{statusText[status]}</span>
                      {o.feedback && <span className="ll-option__feedback">{o.feedback}</span>}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </>
  );
  if (!onCheck) return body;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!checked && selectedIds.length > 0) onCheck();
      }}
    >
      {body}
      <div className="ll-row ll-actions">
        {!checked ? (
          <Button type="submit" variant="primary" disabled={selectedIds.length === 0}>
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
