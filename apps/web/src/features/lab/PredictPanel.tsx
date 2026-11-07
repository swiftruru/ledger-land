// 預測面板（03 第 3.3 節階段 2、第 3.6 節、第 4.2 節）：線與科目目標用共用的 ImpactPicker（▲▼＝），指標目標用六選項（含仍無法計算）的 radiogroup。
// 元件本身不做會計計算：答案由父層依核心算出；「記下預測」後父層存到本機，各階段再揭曉。
import { useLingui } from '@lingui/react/macro';
import { Button, ImpactPicker, isImpactComplete, type ImpactAnswer } from '@ledgerland/web-ui';
import { useId } from 'react';
import type { PredictChoice, PredictTarget, PredictionRecord, RatioChoice } from './predict.ts';

export interface PredictPanelProps {
  targets: readonly PredictTarget[];
  labelOf: (t: PredictTarget) => string;
  record: PredictionRecord;
  onChange: (record: PredictionRecord) => void;
  onSubmit: () => void;
  /** 已經記下（回看時可以略過） */
  submitted: boolean;
  /** 「記下預測」後的文字 */
  submittedNote?: string;
  /** 記下之後又改了選項、還沒按「更新預測」：揭曉與成績仍是記下的那一份 */
  dirty?: boolean;
}

const RATIO_CHOICES: readonly RatioChoice[] = ['up', 'down', 'unchanged', 'becomes_computable', 'becomes_na', 'stays_na'];

export function useRatioChoiceLabels(): Record<RatioChoice, string> {
  const { t } = useLingui();
  return {
    up: t({ id: 'lab.predict.ratio.up', message: '▲ 上升', comment: '指標預測的選項' }),
    down: t({ id: 'lab.predict.ratio.down', message: '▼ 下降', comment: '指標預測的選項' }),
    unchanged: t({ id: 'lab.predict.ratio.unchanged', message: '＝ 不變', comment: '指標預測的選項' }),
    becomes_computable: t({ id: 'lab.predict.ratio.becomesComputable', message: '變得可以計算', comment: '指標預測的選項' }),
    becomes_na: t({ id: 'lab.predict.ratio.becomesNa', message: '變成無法計算', comment: '指標預測的選項' }),
    stays_na: t({ id: 'lab.predict.ratio.staysNa', message: '仍無法計算', comment: '指標預測的選項' }),
  };
}

export function PredictPanel({ targets, labelOf, record, onChange, onSubmit, submitted, submittedNote, dirty = false }: PredictPanelProps) {
  const { t } = useLingui();
  const name = useId();
  const ratioLabels = useRatioChoiceLabels();
  const lineTargets = targets.filter((x) => x.kind !== 'ratio');
  const ratioTargets = targets.filter((x) => x.kind === 'ratio');
  const answers: Record<string, ImpactAnswer> = {};
  for (const tg of lineTargets) {
    const c = record[tg.id];
    if (c === 'up' || c === 'down' || c === 'unchanged') answers[tg.id] = { direction: c };
  }
  const complete =
    isImpactComplete(
      lineTargets.map((tg) => ({ id: tg.id, label: labelOf(tg), measure: 'direction' as const })),
      answers,
    ) && ratioTargets.every((tg) => record[tg.id] !== undefined);
  return (
    <form
      className="ll-lab-predict"
      data-testid="lab-predict"
      onSubmit={(e) => {
        e.preventDefault();
        if (complete) onSubmit();
      }}
    >
      <p className="ll-lab-predict__intro">
        {t({ id: 'lab.predict.intro', message: '揭曉之前先猜一猜：這筆交易會讓下面這些數字怎麼變？', comment: '預測面板的導言' })}
      </p>
      {lineTargets.length > 0 && (
        <ImpactPicker
          name={`${name}-lines`}
          targets={lineTargets.map((tg) => ({ id: tg.id, label: labelOf(tg), measure: 'direction' as const }))}
          answers={answers}
          onChange={(id, a) => {
            if (a.direction === 'up' || a.direction === 'down' || a.direction === 'unchanged') onChange({ ...record, [id]: a.direction });
          }}
          checked={false}
        />
      )}
      {ratioTargets.map((tg) => (
        <fieldset key={tg.id} className="ll-lab-predict__ratio">
          <legend>{labelOf(tg)}</legend>
          <div className="ll-lab-predict__choices" role="radiogroup" aria-label={labelOf(tg)}>
            {RATIO_CHOICES.map((c) => (
              <label key={c} className={`ll-lab-predict__choice${record[tg.id] === c ? ' is-chosen' : ''}`}>
                <input
                  type="radio"
                  name={`${name}-${tg.id}`}
                  value={c}
                  checked={record[tg.id] === c}
                  onChange={() => onChange({ ...record, [tg.id]: c as PredictChoice })}
                />
                <span>{ratioLabels[c]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="ll-lab-predict__actions">
        <Button type="submit" variant="primary" size="md" disabled={!complete} data-testid="lab-predict-submit">
          {submitted
            ? t({ id: 'lab.predict.update', message: '更新預測', comment: '預測面板的主按鈕（已記過一次）' })
            : t({ id: 'lab.predict.submit', message: '記下預測', comment: '預測面板的主按鈕' })}
        </Button>
        {submitted && (dirty || submittedNote) && (
          <span className="ll-lab-predict__done" role="status" data-testid="lab-predict-note">
            {dirty
              ? t({ id: 'lab.predict.dirty', message: '改過的選項要按「更新預測」才算數。', comment: '記下預測之後又改了選項、還沒更新時的提示' })
              : submittedNote}
          </span>
        )}
      </div>
    </form>
  );
}
