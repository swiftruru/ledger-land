// 恆等式天平（03 第 3.3 節階段 4）：資產＝負債＋股東權益，兩邊同時變動、最後仍相等。一般情況秤盤依兩邊差額先傾斜再回到水平（只動 transform），
// 減少動態效果時直接顯示兩邊數字並排與「兩邊相等」文字（03 第 3.11 節）。數字全部來自資產負債表的三條合計列。
import { useLingui } from '@lingui/react/macro';
import { formatMoney } from '@ledgerland/i18n';
import type { Statements } from './lab-core.ts';
import { useLabLabels, useChangeText, lineAt } from './labels.ts';

export interface BalanceScaleProps {
  before: Statements;
  after: Statements;
  layout: Parameters<typeof useLabLabels>[0];
  /** 動畫：false 時直接是結束狀態 */
  animate: boolean;
}

export function BalanceScale({ before, after, layout, animate }: BalanceScaleProps) {
  const { t } = useLingui();
  const { locale, lineLabel } = useLabLabels(layout);
  const change = useChangeText();
  const ids = { a: 'bs_total_assets', l: 'bs_total_liabilities', e: 'bs_total_equity' } as const;
  const item = (id: string) => {
    const b = lineAt(before, id);
    const a = lineAt(after, id);
    return { label: lineLabel(id), b, a, d: a - b };
  };
  const assets = item(ids.a);
  const liab = item(ids.l);
  const equity = item(ids.e);
  const balanced = assets.a === liab.a + equity.a;
  const verdict = balanced
    ? t({ id: 'lab.scale.balanced', message: '兩邊相等', comment: '天平的結論' })
    : t({ id: 'lab.scale.unbalanced', message: '兩邊不相等', comment: '天平的結論' });
  const summary = t({
    id: 'lab.scale.summary',
    message: `資產總計${change(assets.d)}，變為 ${formatMoney(assets.a, locale)}；負債${change(liab.d)}；股東權益${change(equity.d)}。${verdict}。`,
    comment: '恆等式天平的播報；change 是「▲ 增加 n」這類字串，verdict 是「兩邊相等」或「兩邊不相等」',
  });
  return (
    <section
      className={`ll-lab-scale${animate ? ' is-animated' : ''}${balanced ? ' is-balanced' : ''}`}
      aria-label={t({ id: 'lab.scale.label', message: '會計恆等式', comment: '天平區塊的名稱' })}
    >
      <div className="ll-lab-scale__beam" aria-hidden="true">
        <span className="ll-lab-scale__pan is-left" />
        <span className="ll-lab-scale__pivot" />
        <span className="ll-lab-scale__pan is-right" />
      </div>
      <dl className="ll-lab-scale__sides">
        <div className="ll-lab-scale__side is-left">
          <dt>{assets.label}</dt>
          <dd>
            <span className="ll-lab-scale__from">{formatMoney(assets.b, locale)}</span>
            <span className="ll-lab-scale__to">{formatMoney(assets.a, locale)}</span>
            <span className="ll-lab-scale__delta" data-dir={assets.d > 0 ? 'up' : assets.d < 0 ? 'down' : 'same'}>
              {change(assets.d)}
            </span>
          </dd>
        </div>
        <span className="ll-lab-scale__equals" aria-hidden="true">
          ＝
        </span>
        <div className="ll-lab-scale__side is-right">
          {[liab, equity].map((x) => (
            <div key={x.label} className="ll-lab-scale__part">
              <dt>{x.label}</dt>
              <dd>
                <span className="ll-lab-scale__from">{formatMoney(x.b, locale)}</span>
                <span className="ll-lab-scale__to">{formatMoney(x.a, locale)}</span>
                <span className="ll-lab-scale__delta" data-dir={x.d > 0 ? 'up' : x.d < 0 ? 'down' : 'same'}>
                  {change(x.d)}
                </span>
              </dd>
            </div>
          ))}
        </div>
      </dl>
      <p className="ll-lab-scale__verdict" data-testid="lab-scale-verdict">
        {verdict}
      </p>
      <p className="ll-sr-only" data-testid="lab-scale-summary">
        {summary}
      </p>
    </section>
  );
}
