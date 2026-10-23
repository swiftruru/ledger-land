// 交易影響題（03 第 2.4 節表二）：每個目標一列。方向目標是一組 radiogroup（原生 radio 包在 label 裡，三段按鈕外觀），
// 列以目標命名（「現金的變動方向」）；金額目標用 NumberInput（「營業毛利的變動金額」）。判分在父層：checked 後給逐目標 results。
import { useLingui } from '@lingui/react/macro';
import type { Direction } from '@ledgerland/content-schema';
import type { NumericUnit } from '@ledgerland/i18n';
import { useId, type ReactNode } from 'react';
import { CheckCircleIcon, XCircleIcon } from './icons.tsx';
import { NumberInput } from './NumberInput.tsx';

export interface ImpactTarget {
  id: string;
  /** 目標名稱（線、科目或指標，父層已從名詞資料取得） */
  label: string;
  measure: 'direction' | 'delta' | 'value';
  /** 金額目標的輸入單位；預設 money */
  unit?: NumericUnit;
  suffix?: ReactNode;
}

export interface ImpactAnswer {
  direction?: Direction;
  /** 金額目標的原始輸入文字 */
  raw?: string;
}

export interface ImpactResult {
  correct: boolean;
  /** 已格式化的正解文字（方向或金額），答錯時顯示 */
  expected?: string;
  feedback?: ReactNode;
}

export interface ImpactPickerProps {
  name: string;
  targets: readonly ImpactTarget[];
  /** 方向目標可選的方向，依題目的 choices；預設增加、減少、不變 */
  choices?: readonly Direction[];
  answers: Readonly<Partial<Record<string, ImpactAnswer>>>;
  onChange: (targetId: string, answer: ImpactAnswer) => void;
  checked: boolean;
  results?: Readonly<Partial<Record<string, ImpactResult>>>;
}

const DEFAULT_CHOICES: readonly Direction[] = ['up', 'down', 'unchanged'];
const SYMBOL: Record<Direction, string> = { up: '▲', down: '▼', unchanged: '＝', becomes_computable: '', becomes_na: '' };

export function useDirectionLabels(): Record<Direction, string> {
  const { t } = useLingui();
  return {
    up: t({ id: 'quiz.direction.up', message: '增加', comment: '交易影響題的方向按鈕' }),
    down: t({ id: 'quiz.direction.down', message: '減少', comment: '交易影響題的方向按鈕' }),
    unchanged: t({ id: 'quiz.direction.unchanged', message: '不變', comment: '交易影響題的方向按鈕' }),
    becomes_computable: t({ id: 'quiz.direction.becomesComputable', message: '變得可計算', comment: '交易影響題的方向按鈕：指標從 N/A 變成有值' }),
    becomes_na: t({ id: 'quiz.direction.becomesNa', message: '變成 N/A', comment: '交易影響題的方向按鈕：指標的分母變成不存在' }),
  };
}

/** 每個目標都有作答時才可以確認 */
export function isImpactComplete(targets: readonly ImpactTarget[], answers: Readonly<Partial<Record<string, ImpactAnswer>>>): boolean {
  return targets.every((tg) => {
    const a = answers[tg.id];
    return tg.measure === 'direction' ? a?.direction !== undefined : (a?.raw ?? '').trim() !== '';
  });
}

export function ImpactPicker({ name, targets, choices = DEFAULT_CHOICES, answers, onChange, checked, results }: ImpactPickerProps) {
  const { t } = useLingui();
  const labels = useDirectionLabels();
  const baseId = useId();
  return (
    <div className="ll-impact">
      {targets.map((tg) => {
        const rowId = `${baseId}-${tg.id}`;
        const res = checked ? results?.[tg.id] : undefined;
        const a = answers[tg.id];
        const label = tg.label;
        const expected = res?.expected ?? '';
        const rowName =
          tg.measure === 'direction'
            ? t({ id: 'quiz.impact.directionOf', message: `${label}的變動方向`, comment: '交易影響題每一列的名稱；label 是目標名稱' })
            : tg.measure === 'delta'
              ? t({ id: 'quiz.impact.deltaOf', message: `${label}的變動金額`, comment: '交易影響題每一列的名稱；label 是目標名稱' })
              : t({ id: 'quiz.impact.valueOf', message: `${label}的金額`, comment: '交易影響題每一列的名稱；label 是目標名稱' });
        const resultNode = res && (
          <p id={`${rowId}-result`} className={`ll-impact__result ${res.correct ? 'is-correct' : 'is-wrong'}`}>
            <span className="ll-impact__icon">{res.correct ? <CheckCircleIcon filled size={16} /> : <XCircleIcon size={16} />}</span>
            <span className="ll-option__status">
              {res.correct
                ? t({ id: 'quiz.impact.correct', message: '答對了', comment: '交易影響題逐目標的結果' })
                : res.expected !== undefined
                  ? t({ id: 'quiz.impact.expected', message: `不對，正解是 ${expected}`, comment: '交易影響題逐目標的結果；expected 是正解文字' })
                  : t({ id: 'quiz.impact.wrong', message: '不對', comment: '交易影響題逐目標的結果' })}
            </span>
            {res.feedback && <span className="ll-option__feedback">{res.feedback}</span>}
          </p>
        );
        if (tg.measure === 'direction') {
          return (
            <div key={tg.id} className={`ll-impact__row${res ? (res.correct ? ' is-correct' : ' is-wrong') : ''}`}>
              <span id={rowId} className="ll-impact__label">
                {rowName}
              </span>
              <div className="ll-seg ll-impact__seg" role="radiogroup" aria-labelledby={rowId} aria-describedby={res ? `${rowId}-result` : undefined}>
                {choices.map((d) => {
                  const chosen = a?.direction === d;
                  return (
                    <label key={d} className={`ll-seg__item${chosen ? ' is-chosen' : ''}`}>
                      <input
                        type="radio"
                        name={`${name}-${tg.id}`}
                        value={d}
                        checked={chosen}
                        disabled={checked}
                        onChange={() => onChange(tg.id, { ...a, direction: d })}
                        className="ll-seg__input"
                      />
                      {SYMBOL[d] && (
                        <span aria-hidden="true" className="ll-impact__symbol">
                          {SYMBOL[d]}
                        </span>
                      )}
                      <span>{labels[d]}</span>
                    </label>
                  );
                })}
              </div>
              {resultNode}
            </div>
          );
        }
        return (
          <div key={tg.id} className={`ll-impact__row${res ? (res.correct ? ' is-correct' : ' is-wrong') : ''}`}>
            <NumberInput
              id={rowId}
              label={rowName}
              value={a?.raw ?? ''}
              onChange={(raw) => onChange(tg.id, { ...a, raw })}
              unit={tg.unit ?? 'money'}
              suffix={tg.suffix}
              disabled={checked}
              showParsed={!checked}
              describedBy={res ? `${rowId}-result` : undefined}
            />
            {resultNode}
          </div>
        );
      })}
    </div>
  );
}
