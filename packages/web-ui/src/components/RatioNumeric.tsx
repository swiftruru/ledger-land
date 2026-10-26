// 指標計算題（03 第 2.4 節表二、第 2.9 節）：NumberInput 加單位後綴、「N/A」切換（aria-pressed，按下時數字框停用並說明原因）、「±」，
// 以及可展開的「看公式」（Disclosure plain，底層仍是原生 details；只顯示 ratioRef 版本的公式、不代入數字，使用後不扣分）。
// 公式與版本名稱由父層從核心登錄檔取得；判分在父層：checked 後給 result（你的答案與正解都已格式化）。
import { Trans, useLingui } from '@lingui/react/macro';
import { useId, type ReactNode } from 'react';
import { Disclosure } from './Disclosure.tsx';
import { CheckCircleIcon, XCircleIcon } from './icons.tsx';
import { NumberInput, type InputUnit } from './NumberInput.tsx';

export interface RatioFormula {
  /** 公式文字，例如「負債總額 ÷ 資產總計」 */
  text: ReactNode;
  /** 版本名稱，例如「Excel 口徑」 */
  versionLabel: ReactNode;
  /** 補充說明（單期近似、期末餘額等旗標的文字） */
  note?: ReactNode;
}

export interface RatioNumericResult {
  correct: boolean;
  /** 已格式化的正解（N/A 時是「N/A」的文字） */
  expected: string;
  feedback?: ReactNode;
}

export interface RatioNumericProps {
  id?: string;
  /** 輸入框的可見標籤（指標名稱） */
  label: ReactNode;
  /** 輸入單位；決定接受的字樣與「系統讀到」的格式 */
  unit?: InputUnit;
  /** 單位後綴（「%」「倍」「天」） */
  suffix?: ReactNode;
  value: string;
  onChange: (raw: string) => void;
  /** 「N/A」切換；省略時不顯示按鈕 */
  na?: boolean;
  onNaChange?: (na: boolean) => void;
  checked: boolean;
  result?: RatioNumericResult;
  formula?: RatioFormula;
  /** 公式展開時呼叫（之後可記錄「看過公式」） */
  onShowFormula?: () => void;
}

export function RatioNumeric({
  id,
  label,
  unit = 'plain',
  suffix,
  value,
  onChange,
  na,
  onNaChange,
  checked,
  result,
  formula,
  onShowFormula,
}: RatioNumericProps) {
  const { t } = useLingui();
  const autoId = useId();
  const inputId = id ?? autoId;
  const resultId = `${inputId}-result`;
  const res = checked ? result : undefined;
  const expected = res?.expected ?? '';
  return (
    <div className={`ll-ratio-numeric${res === undefined ? '' : res.correct ? ' is-correct' : ' is-wrong'}`}>
      <NumberInput
        id={inputId}
        label={label}
        value={value}
        onChange={onChange}
        unit={unit}
        {...(suffix === undefined ? {} : { suffix })}
        {...(onNaChange === undefined ? {} : { allowNa: true, na: na === true, onNaChange })}
        disabled={checked}
        showParsed={!checked}
        {...(res === undefined ? {} : { describedBy: resultId })}
      />
      {formula !== undefined && (
        <Disclosure
          variant="plain"
          className="ll-ratio-numeric__formula"
          onToggle={(open) => open && onShowFormula?.()}
          summary={
            <Trans id="quiz.ratio.showFormula" comment="指標計算題展開公式的按鈕；只顯示公式不代入數字">
              看公式
            </Trans>
          }
        >
          <p className="ll-ratio-numeric__formula-text">{formula.text}</p>
          <p className="ll-ratio-numeric__formula-version">{formula.versionLabel}</p>
          {formula.note !== undefined && <p className="ll-ratio-numeric__formula-note">{formula.note}</p>}
        </Disclosure>
      )}
      {res !== undefined && (
        <p id={resultId} className={`ll-ratio-numeric__result ${res.correct ? 'is-correct' : 'is-wrong'}`}>
          <span className="ll-ratio-numeric__icon" aria-hidden="true">
            {res.correct ? <CheckCircleIcon filled size={16} /> : <XCircleIcon size={16} />}
          </span>
          <span className="ll-option__status">
            {res.correct
              ? t({ id: 'quiz.ratio.correct', message: `答對了，正解是 ${expected}`, comment: '指標計算題的結果；expected 是已格式化的正解' })
              : t({ id: 'quiz.ratio.wrong', message: `不對，正解是 ${expected}`, comment: '指標計算題的結果；expected 是已格式化的正解' })}
          </span>
          {res.feedback !== undefined && <span className="ll-option__feedback">{res.feedback}</span>}
        </p>
      )}
    </div>
  );
}
