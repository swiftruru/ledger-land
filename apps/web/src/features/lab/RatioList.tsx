// 指標卡（03 第 3.3 節階段 9、第 3.10 節）：每張卡顯示名稱、版本的公式（分子 ÷ 分母，線以版面名稱顯示）、代入的分子分母、前 → 後與狀態、原因說明。
// 階段 9 先列狀態或數值有變的指標，其餘收在「其他指標」；指標實驗室列全部並依六大類分組。數字全部來自核心的 RatioResult。
import { Trans, useLingui } from '@lingui/react/macro';
import { CheckCircleIcon, Disclosure, NoteTag, ValueButton, WarningIcon, XCircleIcon } from '@ledgerland/web-ui';
import type { ReactNode } from 'react';
import type { RatioResult } from './lab-core.ts';
import { formatRatio, useFormulaText, useLabLabels } from './labels.ts';
import type { RatioUnit } from '../quiz/ratio-units.ts';

export interface RatioSpecLike {
  readonly id: string;
  readonly termRef: string;
  readonly category: string;
  readonly framework: 'input' | 'transform' | 'output' | null;
  readonly unit: RatioUnit;
  readonly displayDecimals: number;
  readonly numerator?: string;
  readonly denominator?: string;
  readonly expr?: string;
  readonly flags: readonly string[];
  readonly pendingRefs: readonly string[];
}

export interface RatioChange {
  readonly ratioRef: string;
  readonly spec: RatioSpecLike;
  readonly before: RatioResult | null;
  readonly after: RatioResult;
  readonly changed: boolean;
}

export { useFormulaText } from './labels.ts';

export function useRatioReason() {
  const { t } = useLingui();
  return (r: RatioResult): string | null => {
    const key = r.reason?.key;
    if (key === undefined) return null;
    switch (key) {
      case 'ratio.reason.denominator_zero':
        return t({ id: 'lab.ratio.reason.denominatorZero', message: '分母為 0，所以無法計算', comment: '指標無法計算的原因' });
      case 'ratio.reason.chained_source_na_or_zero':
        return t({ id: 'lab.ratio.reason.chainedNaOrZero', message: '它引用的指標是 N/A 或 0', comment: '指標無法計算的原因' });
      case 'ratio.reason.chained_source_na':
        return t({ id: 'lab.ratio.reason.chainedNa', message: '它引用的指標是 N/A', comment: '指標無法計算的原因' });
      case 'ratio.reason.chained_source_not_meaningful':
        return t({ id: 'lab.ratio.reason.chainedNotMeaningful', message: '它引用的指標不具意義', comment: '指標不具意義的原因' });
      case 'ratio.reason.negative_base':
        return t({ id: 'lab.ratio.reason.negativeBase', message: '基準為負或為 0，結果不具意義', comment: '指標不具意義的原因' });
      case 'ratio.reason.missing_input':
        return t({ id: 'lab.ratio.reason.missingInput', message: '少了需要的輸入值', comment: '指標無法計算的原因' });
      default:
        return null;
    }
  };
}

export interface RatioCardProps {
  item: RatioChange;
  layout: Parameters<typeof useLabLabels>[0];
  /** 預測揭曉（指標目標） */
  verdict?: { correct: boolean; nearly: boolean } | null;
  /** N/A 時的建議（指標實驗室） */
  suggestion?: ReactNode;
  versionLabel?: string;
  /** 點結果開來源面板（M4b，03 第 3.9 節）；N/A 沒有數字可追 */
  onTrace?: (item: RatioChange, el: HTMLButtonElement) => void;
  /** IFRS 對照（03 第 3.13 節）：教材口徑算出來的同一個指標；顯示的結果不同時另列「教材口徑：x」 */
  compare?: RatioResult;
}

export function RatioCard({ item, layout, verdict = null, suggestion, versionLabel, onTrace, compare }: RatioCardProps) {
  const { t } = useLingui();
  const { locale, ratioLabel } = useLabLabels(layout);
  const formula = useFormulaText(layout);
  const reason = useRatioReason();
  const { spec, before, after } = item;
  const fmt = (r: RatioResult) => formatRatio(r, spec.unit, locale, spec.displayDecimals);
  const status = after.status;
  const why = reason(after);
  const teacher = compare !== undefined && (compare.status !== after.status || fmt(compare) !== fmt(after)) ? fmt(compare) : null;
  const transition =
    before === null
      ? null
      : before.status === 'na' && after.status !== 'na'
        ? t({ id: 'lab.ratio.becameComputable', message: '變得可以計算', comment: '指標前後狀態的說明' })
        : before.status !== 'na' && after.status === 'na'
          ? t({ id: 'lab.ratio.becameNa', message: '變成無法計算', comment: '指標前後狀態的說明' })
          : null;
  return (
    <li className={`ll-lab-ratio is-${status}${item.changed ? ' is-changed' : ''}`} data-ratio={item.ratioRef} data-status={status}>
      <h4 className="ll-lab-ratio__name">
        {ratioLabel(spec.id, spec.termRef)}
        {versionLabel && <span className="ll-lab-ratio__version"> {versionLabel}</span>}
      </h4>
      <p className="ll-lab-ratio__formula">{formula(spec)}</p>
      <p className="ll-lab-ratio__values">
        {before !== null && (
          <>
            <span className="ll-lab-ratio__before">{fmt(before)}</span>
            <span aria-hidden="true"> → </span>
          </>
        )}
        {onTrace !== undefined && after.status !== 'na' ? (
          <ValueButton
            className="ll-lab-ratio__after"
            label={t({
              id: 'lab.trace.openRatio',
              message: `${ratioLabel(spec.id, spec.termRef)} ${fmt(after)}，看這個數字從哪裡來`,
              comment: '可追蹤的指標結果（按鈕）的可讀名稱；指標名稱與數值已代入',
            })}
            onClick={(e) => onTrace(item, e.currentTarget)}
            data-testid="lab-trace-ratio"
          >
            {fmt(after)}
          </ValueButton>
        ) : (
          <span className="ll-lab-ratio__after">{fmt(after)}</span>
        )}
        {status === 'not_meaningful' && (
          <span className="ll-lab-ratio__warn">
            <WarningIcon /> {t({ id: 'lab.ratio.notMeaningful', message: '不具意義', comment: '指標狀態的警示' })}
          </span>
        )}
        {transition && <span className="ll-lab-ratio__transition">{transition}</span>}
      </p>
      {teacher !== null && (
        <p className="ll-lab-ratio__basis" data-testid="lab-ratio-basis">
          {t({ id: 'lab.policy.teacherRatio', message: `教材口徑：${teacher}`, comment: 'IFRS 對照時指標卡下方的小字；指標值已格式化' })}
        </p>
      )}
      {why && <p className="ll-lab-ratio__reason">{why}</p>}
      {spec.flags.includes('single_period_approx') || after.flags.includes('single_period_approx') ? <NoteTag kind="single_period" /> : null}
      {verdict && (
        <p className={`ll-lab-verdict is-${verdict.correct ? 'right' : 'wrong'}`}>
          <span className="ll-lab-verdict__icon" aria-hidden="true">
            {verdict.correct ? <CheckCircleIcon /> : <XCircleIcon />}
          </span>
          {verdict.nearly
            ? t({ id: 'lab.predict.nearly', message: '幾乎不變（變動小於顯示位數）', comment: '預測揭曉：四捨五入後前後相同' })
            : verdict.correct
              ? t({ id: 'lab.predict.right', message: '你的預測正確' })
              : t({ id: 'lab.predict.wrong', message: '和你的預測不同' })}
        </p>
      )}
      {suggestion}
    </li>
  );
}

export interface RatioListProps {
  items: readonly RatioChange[];
  layout: Parameters<typeof useLabLabels>[0];
  /** 階段 9：有變的在前、沒變的收起來 */
  splitUnchanged?: boolean;
  verdicts?: Readonly<Record<string, { correct: boolean; nearly: boolean }>>;
  onTrace?: RatioCardProps['onTrace'];
  /** IFRS 對照：教材口徑在同一步交易後的全部指標（依 ratioRef 對上） */
  compareAfter?: readonly RatioResult[];
}

export function RatioList({ items, layout, splitUnchanged = false, verdicts, onTrace, compareAfter }: RatioListProps) {
  const { t } = useLingui();
  const changed = splitUnchanged ? items.filter((i) => i.changed) : items;
  const rest = splitUnchanged ? items.filter((i) => !i.changed) : [];
  const compareOf = (ref: string) => compareAfter?.find((r) => r.ratioRef === ref);
  return (
    <div className="ll-lab-ratios">
      {changed.length === 0 && splitUnchanged && (
        <p className="ll-lab-ratios__none">
          <Trans id="lab.ratio.noneChanged" comment="這一步沒有任何指標變動">
            這一步沒有指標變動。
          </Trans>
        </p>
      )}
      <ul className="ll-lab-ratios__list" data-testid="lab-ratios-changed">
        {changed.map((i) => (
          <RatioCard key={i.ratioRef} item={i} layout={layout} verdict={verdicts?.[i.ratioRef] ?? null} onTrace={onTrace} compare={compareOf(i.ratioRef)} />
        ))}
      </ul>
      {rest.length > 0 && (
        <Disclosure
          variant="plain"
          summary={t({ id: 'lab.ratio.others', message: `其他指標（${rest.length}）`, comment: '沒有變動的指標的展開區標題；括號裡是數量' })}
          className="ll-lab-ratios__rest"
        >
          <ul className="ll-lab-ratios__list">
            {rest.map((i) => (
              <RatioCard key={i.ratioRef} item={i} layout={layout} onTrace={onTrace} compare={compareOf(i.ratioRef)} />
            ))}
          </ul>
        </Disclosure>
      )}
    </div>
  );
}
