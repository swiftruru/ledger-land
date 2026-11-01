// 階段 3 科目變動（03 第 3.3 節，D1 選 (b)）：核心 effects 的白話清單（「現金 ▲ 增加 210,000（508,000 → 718,000）」），
// 名詞是 chip；下方「看分錄與 T 字帳」預設收合（展開狀態記在 settings 的 labView.journalLayerOpen），展開後是這一步的分錄與過帳到 T 字帳的結果。
// 分錄旁加一句：教材版面的「本期進貨」「期末存貨」不是分錄裡的科目，而是由存貨帳推導出來的列。
import { Trans, useLingui } from '@lingui/react/macro';
import { formatMoney } from '@ledgerland/i18n';
import { CheckCircleIcon, Disclosure, NoteTag, XCircleIcon } from '@ledgerland/web-ui';
import { Markup } from '../quiz/Markup.tsx';
import type { LabStep } from './lab-core.ts';
import { useLabLabels } from './labels.ts';
import { RollingMoney } from './RollingMoney.tsx';

type Chart = {
  readonly byId: ReadonlyMap<
    string,
    { readonly normalSide: 'debit' | 'credit'; readonly labels: { readonly teacher: { readonly 'zh-TW': string; readonly en: string } } }
  >;
};

export interface EffectsListProps {
  step: LabStep;
  chart: Chart;
  layout: Parameters<typeof useLabLabels>[0];
  journalOpen: boolean;
  onJournalToggle: (open: boolean) => void;
  /** 預測揭曉：現金的預測結果 */
  cashVerdict?: { chosen: string; correct: boolean } | null;
  /** 有設計決定的事件（pendingRefs）要顯示「設計說明」標記 */
  designNotes?: readonly string[];
  /** 交易後的餘額從交易前滾過去（減少動態時 false） */
  animate?: boolean;
}

function normal(chart: Chart, balances: Readonly<Record<string, number>>, id: string): number {
  const v = balances[id] ?? 0;
  return chart.byId.get(id)?.normalSide === 'credit' ? -v : v;
}

export function EffectsList({ step, chart, layout, journalOpen, onJournalToggle, cashVerdict = null, designNotes = [], animate = false }: EffectsListProps) {
  const { t } = useLingui();
  const { locale, accountLabel } = useLabLabels(layout);
  const effects = step.posted.effects.filter((e) => e.direction !== 'unchanged');
  return (
    <section className="ll-lab-effects" aria-label={t({ id: 'lab.effects.label', message: '科目變動', comment: '階段 3 區塊的名稱' })}>
      {step.posted.noEffect ? (
        <p className="ll-lab-effects__none" data-testid="lab-no-effect">
          <Trans id="lab.effects.none" comment="整步所有金額都是 0">
            本筆無影響
          </Trans>
        </p>
      ) : (
        <ol className="ll-lab-effects__list" data-testid="lab-effects">
          {effects.map((e) => {
            const b = normal(chart, step.posted.balancesBefore, e.account);
            const a = normal(chart, step.posted.balancesAfter, e.account);
            const verdict = e.account === 'cash' ? cashVerdict : null;
            return (
              <li key={e.account} className={`ll-lab-effect is-${e.direction}`} data-account={e.account}>
                <span className="ll-lab-effect__arrow" aria-hidden="true">
                  {e.direction === 'increase' ? '▲' : '▼'}
                </span>
                <span className="ll-lab-effect__text">
                  <Markup text={e.text[locale] ?? e.text['zh-TW']} ctx={{ values: { amount: e.amount } }} />
                  <span className="ll-lab-effect__range">
                    （{formatMoney(b, locale)} → <RollingMoney from={b} to={a} animate={animate} locale={locale} />）
                  </span>
                </span>
                {verdict && (
                  <span className={`ll-lab-verdict is-${verdict.correct ? 'right' : 'wrong'}`} data-testid="lab-cash-verdict">
                    <span className="ll-lab-verdict__icon" aria-hidden="true">
                      {verdict.correct ? <CheckCircleIcon /> : <XCircleIcon />}
                    </span>
                    {verdict.correct
                      ? t({ id: 'lab.predict.right', message: '你的預測正確', comment: '預測揭曉' })
                      : t({ id: 'lab.predict.wrong', message: '和你的預測不同', comment: '預測揭曉' })}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {designNotes.length > 0 && (
        <p className="ll-lab-effects__notes">
          <NoteTag kind="design_note" subject={designNotes.join(', ')} />
        </p>
      )}
      <Disclosure
        variant="card"
        open={journalOpen}
        onToggle={onJournalToggle}
        className="ll-lab-journal"
        summary={t({ id: 'lab.journal.toggle', message: '看分錄與 T 字帳', comment: '階段 3 下方展開區的標題（預設收合，D1）' })}
      >
        <p className="ll-lab-journal__note">
          <Trans id="lab.journal.note" comment="分錄層的說明（03 第 3.3 節）">
            報表上的「本期進貨」「期末存貨」不是分錄裡的科目，而是由存貨帳推導出來的列。
          </Trans>
        </p>
        {step.posted.entries.map((entry) => (
          <div key={entry.eventId} className="ll-lab-table">
            <table className="ll-mini-table ll-lab-journal__entry" data-testid="lab-journal-entry">
              <caption>{t({ id: 'lab.journal.entry', message: `分錄 ${entry.eventId}`, comment: '分錄表格的標題；eventId 是事件代號' })}</caption>
              <thead>
                <tr>
                  <th scope="col">{t({ id: 'lab.journal.account', message: '科目', comment: '分錄表格的欄名' })}</th>
                  <th scope="col" className="ll-num">
                    {t({ id: 'lab.journal.debit', message: '借方', comment: '分錄表格的欄名' })}
                  </th>
                  <th scope="col" className="ll-num">
                    {t({ id: 'lab.journal.credit', message: '貸方', comment: '分錄表格的欄名' })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {entry.lines.map((l) => (
                  <tr key={l.ref} className="ll-mini-table__row">
                    <th scope="row" className={`ll-mini-table__line ll-indent-${l.side === 'credit' ? 1 : 0}`}>
                      {accountLabel(l.account, chart.byId.get(l.account)?.labels.teacher)}
                    </th>
                    <td className="ll-num ll-mini-table__value">{l.side === 'debit' ? formatMoney(l.amount, locale) : ''}</td>
                    <td className="ll-num ll-mini-table__value">{l.side === 'credit' ? formatMoney(l.amount, locale) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <div className="ll-lab-taccounts" data-testid="lab-taccounts">
          {step.tAccounts.map((ta) => {
            const normalSide = chart.byId.get(ta.account)?.normalSide;
            const closingSide =
              ta.closing === 0 || normalSide === undefined ? undefined : ta.closing > 0 ? normalSide : normalSide === 'debit' ? 'credit' : 'debit';
            const closingAmount = formatMoney(Math.abs(ta.closing), locale);
            return (
              <table key={ta.account} className="ll-lab-taccount">
                <caption>{accountLabel(ta.account, chart.byId.get(ta.account)?.labels.teacher)}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t({ id: 'lab.journal.debit', message: '借方' })}</th>
                    <th scope="col">{t({ id: 'lab.journal.credit', message: '貸方' })}</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: Math.max(ta.debits.length, ta.credits.length) }).map((_, i) => {
                    const d = ta.debits[i];
                    const c = ta.credits[i];
                    return (
                      <tr key={i}>
                        <td className={`ll-num${d && ta.highlight.includes(d.lineRef) ? ' is-new' : ''}`}>{d ? formatMoney(d.amount, locale) : ''}</td>
                        <td className={`ll-num${c && ta.highlight.includes(c.lineRef) ? ' is-new' : ''}`}>{c ? formatMoney(c.amount, locale) : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" colSpan={2} className="ll-num">
                      {closingSide === 'debit'
                        ? t({
                            id: 'lab.journal.closingDebit',
                            message: `借方餘額 ${closingAmount}`,
                            comment: 'T 字帳的結餘落在借方（課本寫借餘）；數字已格式化',
                          })
                        : closingSide === 'credit'
                          ? t({
                              id: 'lab.journal.closingCredit',
                              message: `貸方餘額 ${closingAmount}`,
                              comment: 'T 字帳的結餘落在貸方（課本寫貸餘）；數字已格式化',
                            })
                          : t({ id: 'lab.journal.closing', message: `餘額 ${closingAmount}`, comment: 'T 字帳的結餘是零，不分借貸；數字已格式化' })}
                    </th>
                  </tr>
                </tfoot>
              </table>
            );
          })}
        </div>
      </Disclosure>
    </section>
  );
}
