// 五步驟勾稽填格（03 第 2.4 節表二、第 3.4 節）：每個開放格子一個 NumberInput（inputmode="decimal"、「±」按鈕），
// 標籤含勾稽點與哪一邊（父層組好，例如「步驟③（勾稽點 C），資產負債表的現金」）。判分在父層：checked 後給逐格 results，
// 燈號一律「圖示＋文字＋顏色」：相符「相符，差額 0」、不相符「差 12,000」、沒填「還沒填」；狀態文字以 aria-describedby 連到輸入框。
// M4a 的勾稽練習會再用同一個元件（results 可以在作答中即時更新）。
import { useLingui } from '@lingui/react/macro';
import type { NumericUnit } from '@ledgerland/i18n';
import { useId, type ReactNode } from 'react';
import { CheckCircleIcon, CircleIcon, XCircleIcon } from './icons.tsx';
import { NumberInput } from './NumberInput.tsx';

export interface FiveStepCell {
  /** 版面線 ID（題目的 openCells） */
  id: string;
  /** 可見標籤，含勾稽點與哪一邊 */
  label: ReactNode;
  /** 標籤下方的一句提示（例如所在的報表與列的說明） */
  hint?: ReactNode;
  /** 輸入單位；預設 money */
  unit?: NumericUnit;
  suffix?: ReactNode;
}

export interface FiveStepCellResult {
  correct: boolean;
  /** 已格式化的差額（絕對值）；沒填時省略 */
  difference?: string;
  /** 已格式化的正解；答錯時顯示 */
  expected?: string;
  feedback?: ReactNode;
}

export interface FiveStepFillProps {
  cells: readonly FiveStepCell[];
  /** 格子 ID 對原始輸入文字（父層保存，切換語言不丟） */
  values: Readonly<Partial<Record<string, string>>>;
  onChange: (cellId: string, raw: string) => void;
  checked: boolean;
  results?: Readonly<Partial<Record<string, FiveStepCellResult>>>;
  /** 整組格子的名稱所在元素（題幹）的 id */
  labelledBy?: string;
}

/** 每個格子都有輸入才可以確認 */
export function isFiveStepComplete(cells: readonly FiveStepCell[], values: Readonly<Partial<Record<string, string>>>): boolean {
  return cells.every((c) => (values[c.id] ?? '').trim() !== '');
}

export function FiveStepFill({ cells, values, onChange, checked, results, labelledBy }: FiveStepFillProps) {
  const { t } = useLingui();
  const baseId = useId();
  return (
    <div className="ll-fivestep" role="group" aria-labelledby={labelledBy}>
      {cells.map((cell) => {
        const rowId = `${baseId}-${cell.id}`;
        const resultId = `${rowId}-result`;
        const raw = values[cell.id] ?? '';
        const res = checked ? results?.[cell.id] : undefined;
        const empty = raw.trim() === '';
        const difference = res?.difference ?? '';
        const expected = res?.expected ?? '';
        let statusText: string | null = null;
        let state: 'ok' | 'off' | 'empty' | null = null;
        if (res !== undefined) {
          if (res.correct) {
            state = 'ok';
            statusText = t({ id: 'quiz.fiveStep.match', message: '相符，差額 0', comment: '五步驟勾稽的燈號：這一格與核心的數字相同' });
          } else if (empty || res.difference === undefined) {
            state = 'empty';
            statusText = t({ id: 'quiz.fiveStep.empty', message: '還沒填', comment: '五步驟勾稽的燈號：這一格沒有填' });
          } else {
            state = 'off';
            statusText =
              res.expected === undefined
                ? t({ id: 'quiz.fiveStep.off', message: `差 ${difference}`, comment: '五步驟勾稽的燈號：填的數字與核心不同；difference 是已格式化的差額' })
                : t({
                    id: 'quiz.fiveStep.offExpected',
                    message: `差 ${difference}，正解是 ${expected}`,
                    comment: '五步驟勾稽的燈號：填的數字與核心不同；difference 是差額、expected 是正解，都已格式化',
                  });
          }
        }
        return (
          <div key={cell.id} className={`ll-fivestep__cell${state === null ? '' : ` is-${state}`}`}>
            <NumberInput
              id={rowId}
              label={cell.label}
              value={raw}
              onChange={(next) => onChange(cell.id, next)}
              unit={cell.unit ?? 'money'}
              {...(cell.suffix === undefined ? {} : { suffix: cell.suffix })}
              disabled={checked}
              showParsed={!checked}
              {...(res === undefined ? {} : { describedBy: resultId })}
            />
            {cell.hint !== undefined && <p className="ll-fivestep__hint">{cell.hint}</p>}
            {res !== undefined && statusText !== null && (
              <p id={resultId} className={`ll-fivestep__light is-${state ?? 'empty'}`}>
                <span className="ll-fivestep__icon" aria-hidden="true">
                  {state === 'ok' ? <CheckCircleIcon filled size={16} /> : state === 'off' ? <XCircleIcon size={16} /> : <CircleIcon size={16} />}
                </span>
                <span className="ll-option__status">{statusText}</span>
                {res.feedback !== undefined && <span className="ll-option__feedback">{res.feedback}</span>}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
