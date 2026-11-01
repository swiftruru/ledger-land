// 五步驟燈號（03 第 3.4 節）：步驟②到⑤各一個燈，圖示加文字加顏色（相符、差額、還沒填）；步驟①列五層利益。
// 點燈號會醒目標示兩張表上對應的格子（onSelect 回報兩條線的 ID）。勾稽練習中燈號依學習者填的值即時變化。
import { useLingui } from '@lingui/react/macro';
import { formatMoney } from '@ledgerland/i18n';
import { Button, CheckCircleIcon, CircleIcon, XCircleIcon } from '@ledgerland/web-ui';
import type { FiveStepResult, Statements } from './lab-core.ts';
import { useLabLabels } from './labels.ts';

export interface CheckLightsProps {
  fiveStep: FiveStepResult;
  /** 勾稽練習：這些步驟用到的格子還沒填，燈號顯示「還沒填」 */
  pendingSteps?: ReadonlySet<number>;
  selected?: number | null;
  onSelect?: (step: 2 | 3 | 4 | 5 | null, lines: readonly string[]) => void;
  layout: Parameters<typeof useLabLabels>[0];
  compact?: boolean;
}

const CIRCLED = { 1: '①', 2: '②', 3: '③', 4: '④', 5: '⑤' } as const;

export function CheckLights({ fiveStep, pendingSteps, selected = null, onSelect, layout, compact = false }: CheckLightsProps) {
  const { t } = useLingui();
  const { locale, lineLabel: rawLineLabel } = useLabLabels(layout);
  // 步驟④的左邊是核心算的「未分配盈餘增加額」（期初未分配盈餘＋本期淨利－股利－提列公積，W05），版面沒有這條線
  const reExpected = t({ id: 'lab.check.reExpected', message: '未分配盈餘增加額（本期淨利）', comment: '勾稽步驟④左邊那個數字的名稱（W05）' });
  const lineLabel = (id: string) => (id === 're_expected' ? reExpected : rawLineLabel(id));
  const names: Record<2 | 3 | 4 | 5, string> = {
    2: t({ id: 'lab.check.step2', message: '稅前淨利', comment: '勾稽步驟②的名稱' }),
    3: t({ id: 'lab.check.step3', message: '期末現金', comment: '勾稽步驟③的名稱' }),
    4: t({ id: 'lab.check.step4', message: '本期淨利與未分配盈餘', comment: '勾稽步驟④的名稱' }),
    5: t({ id: 'lab.check.step5', message: '左右平衡', comment: '勾稽步驟⑤的名稱' }),
  };
  return (
    <ul
      className={`ll-lab-lights${compact ? ' is-compact' : ''}`}
      aria-label={t({ id: 'lab.check.label', message: '四個勾稽燈號', comment: '勾稽燈號清單的名稱' })}
    >
      {fiveStep.checks.map((c) => {
        const waiting = pendingSteps !== undefined && pendingSteps.has(c.step);
        const state = waiting ? 'empty' : c.pass ? 'pass' : 'fail';
        const text = waiting
          ? t({ id: 'lab.check.empty', message: '還沒填', comment: '燈號狀態：格子還沒填' })
          : c.pass
            ? t({ id: 'lab.check.pass', message: '相符，差額 0', comment: '燈號狀態：兩邊相符' })
            : t({ id: 'lab.check.fail', message: `差 ${formatMoney(Math.abs(c.diff), locale)}`, comment: '燈號狀態：兩邊差額；數字已格式化' });
        const title = t({
          id: 'lab.check.title',
          message: `步驟${CIRCLED[c.step]}（勾稽點 ${c.alias}）`,
          comment: '燈號標題；步驟編號為主，字母是顯示別名（T13）',
        });
        const detail = compact ? null : (
          <span className="ll-lab-light__detail">
            {lineLabel(c.left.line)} {formatMoney(c.left.value, locale)}
            {' vs '}
            {lineLabel(c.right.line)} {formatMoney(c.right.value, locale)}
          </span>
        );
        const inner = (
          <span className="ll-lab-light__grid">
            <span className={`ll-lab-light__icon is-${state}`} aria-hidden="true">
              {state === 'pass' ? <CheckCircleIcon /> : state === 'fail' ? <XCircleIcon /> : <CircleIcon />}
            </span>
            <span className="ll-lab-light__body">
              <span className="ll-lab-light__title">
                {title}
                {!compact && <span className="ll-lab-light__name"> {names[c.step]}</span>}
              </span>
              <span className={`ll-lab-light__state is-${state}`}>{text}</span>
              {detail}
            </span>
          </span>
        );
        return (
          <li
            key={c.step}
            className={`ll-lab-light is-${state}${selected === c.step ? ' is-selected' : ''}`}
            data-testid={`lab-light-${c.step}`}
            data-state={state}
          >
            {onSelect ? (
              <Button
                variant="quiet"
                size="md"
                block
                className="ll-lab-light__btn"
                aria-pressed={selected === c.step}
                onClick={() => onSelect(selected === c.step ? null : c.step, [c.left.line, c.right.line])}
              >
                {inner}
              </Button>
            ) : (
              <span className="ll-lab-light__btn is-static">{inner}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** 步驟①：五層利益的清單，交易前 → 交易後（數字從累計報表的五條 formula 列來） */
export function ProfitLevels({ before, after, layout }: { before: Statements; after: Statements; layout: Parameters<typeof useLabLabels>[0] }) {
  const { t } = useLingui();
  const { locale, lineLabel } = useLabLabels(layout);
  const rows = ['is_gross_profit', 'is_operating_income', 'is_ordinary_income', 'is_pretax_income', 'is_net_income'].map((id) => ({
    id,
    b: before.lines.get(id)?.value ?? null,
    a: after.lines.get(id)?.visible ? (after.lines.get(id)?.value ?? null) : null,
  }));
  return (
    <table className="ll-mini-table ll-lab-levels">
      <caption>{t({ id: 'lab.check.step1', message: '步驟①：五層利益', comment: '五層利益清單的標題' })}</caption>
      <thead>
        <tr>
          <th scope="col">
            <span className="ll-sr-only">{t({ id: 'lab.table.lineHeader', message: '項目' })}</span>
          </th>
          <th scope="col" className="ll-num">
            {t({ id: 'lab.table.before', message: '交易前' })}
          </th>
          <th scope="col" className="ll-num">
            {t({ id: 'lab.table.after', message: '交易後' })}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows
          .filter((r) => r.a !== null)
          .map((r) => (
            <tr key={r.id} className={`ll-mini-table__row${r.a !== r.b ? ' is-changed' : ''}`}>
              <th scope="row" className="ll-mini-table__line ll-indent-0">
                {lineLabel(r.id)}
              </th>
              <td className="ll-num ll-mini-table__value">{formatMoney(r.b ?? 0, locale)}</td>
              <td className="ll-num ll-mini-table__value">{formatMoney(r.a ?? 0, locale)}</td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}
