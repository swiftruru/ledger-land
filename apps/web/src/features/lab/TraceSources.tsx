// 來源面板第三區（03 第 3.9 節）：讓這個科目層的數字改變的每一步（「第 6 步 現金進貨 ▲ 120,000」），每一筆下方有預設收合的「看分錄」層
// （D1 選 (b)），展開後是該步過帳的分錄；「開啟這一步」到實驗室的那一步（練習模式）。數字都來自核心的追蹤樹與過帳結果。
import { useLingui } from '@lingui/react/macro';
import { formatMoney } from '@ledgerland/i18n';
import { ArrowRightIcon, Button, Disclosure } from '@ledgerland/web-ui';
import type { LabRun, PostedEntry, TraceNode } from './lab-core.ts';
import { ARROW, directionOf, useLabLabels } from './labels.ts';
import { openingOf, sourceSteps } from './trace-model.ts';

export interface TraceStepInfo {
  readonly order: number;
  readonly title: string;
}

export interface TraceSourcesProps {
  node: TraceNode;
  run: LabRun;
  /** 某一步過帳的分錄（lab-core 的 entriesOfStep；由頁面傳入，面板的 chunk 不靜態引用核心） */
  entriesOf: (stepId: string) => readonly PostedEntry[];
  layout: Parameters<typeof useLabLabels>[0];
  /** 步驟的序號與名稱（故事快照；自由實驗插入的步驟沒有名稱） */
  stepInfo: (stepId: string) => TraceStepInfo | undefined;
  /** 「開啟這一步」的網址；目前這一步或本機插入的步驟給 null 就不放按鈕 */
  stepHref: (stepId: string) => string | null;
  /** 父層關面板用（開啟這一步之前） */
  onNavigate?: () => void;
}

export function TraceSources({ node, run, entriesOf, layout, stepInfo, stepHref, onNavigate }: TraceSourcesProps) {
  const { t } = useLingui();
  const { locale, accountLabel } = useLabLabels(layout);
  const steps = sourceSteps(node);
  const opening = openingOf(node);
  const chart = run.ctx.chart;
  if (steps.length === 0 && opening === 0) return null;
  const stepName = (stepId: string): string => {
    const info = stepInfo(stepId);
    if (info === undefined) return t({ id: 'lab.trace.localStep', message: '自由實驗插入的步驟', comment: '來源步驟：本機插入、沒有名稱的步驟' });
    return t({ id: 'lab.trace.stepName', message: `第 ${info.order} 步 ${info.title}`, comment: '來源步驟的名稱；序號與標題已代入' });
  };
  return (
    <section className="ll-lab-src" aria-label={t({ id: 'lab.trace.sources', message: '來源步驟', comment: '來源面板第三區的名稱' })}>
      <h3 className="ll-lab-trace__section">{t({ id: 'lab.trace.sources', message: '來源步驟' })}</h3>
      <ul className="ll-lab-src__list">
        {opening !== 0 && (
          <li className="ll-lab-src__step">
            <span className="ll-lab-src__name">{t({ id: 'lab.trace.opening', message: '期初帶入', comment: '來源步驟：視窗起點的餘額（自訂期初）' })}</span>
            <span className="ll-lab-src__amount ll-num">{formatMoney(opening, locale)}</span>
          </li>
        )}
        {steps.map((s) => {
          const dir = directionOf(s.contribution);
          const href = stepHref(s.stepId);
          const eventIds = [...new Set(s.lines.map((l) => l.eventId))];
          const entries = entriesOf(s.stepId).filter((e) => eventIds.includes(e.eventId));
          return (
            <li key={s.stepId} className="ll-lab-src__step" data-step={s.stepId}>
              <span className="ll-lab-src__name">{stepName(s.stepId)}</span>
              <span className={`ll-lab-src__amount ll-num is-${dir}`}>
                <span aria-hidden="true">{ARROW[dir]} </span>
                <span className="ll-sr-only">
                  {dir === 'up'
                    ? t({ id: 'lab.trace.contrib.up', message: '增加', comment: '來源步驟對這一列的方向（螢幕閱讀器）' })
                    : dir === 'down'
                      ? t({ id: 'lab.trace.contrib.down', message: '減少', comment: '來源步驟對這一列的方向（螢幕閱讀器）' })
                      : t({ id: 'lab.trace.contrib.same', message: '合計不變', comment: '來源步驟對這一列的方向（螢幕閱讀器）' })}{' '}
                </span>
                {formatMoney(Math.abs(s.contribution), locale)}
              </span>
              <Disclosure
                variant="plain"
                className="ll-lab-src__journal"
                summary={t({ id: 'lab.trace.showEntry', message: '看分錄', comment: '來源步驟下方預設收合的分錄層（D1）' })}
                data-testid="lab-trace-journal"
              >
                {entries.map((entry) => (
                  <div key={entry.eventId} className="ll-lab-table">
                    <table className="ll-mini-table ll-lab-journal__entry" data-testid="lab-trace-entry">
                      <caption>{t({ id: 'lab.journal.entry', message: `分錄 ${entry.eventId}`, comment: '分錄表格的標題；eventId 是事件代號' })}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{t({ id: 'lab.journal.account', message: '科目' })}</th>
                          <th scope="col" className="ll-num">
                            {t({ id: 'lab.journal.debit', message: '借方' })}
                          </th>
                          <th scope="col" className="ll-num">
                            {t({ id: 'lab.journal.credit', message: '貸方' })}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {entry.lines.map((l) => {
                          const mine = s.lines.some((x) => x.lineRef === l.ref);
                          return (
                            <tr key={l.ref} className={`ll-mini-table__row${mine ? ' is-marked' : ''}`}>
                              <th scope="row" className={`ll-mini-table__line ll-indent-${l.side === 'credit' ? 1 : 0}`}>
                                {accountLabel(l.account, chart.byId.get(l.account)?.labels.teacher)}
                              </th>
                              <td className="ll-num ll-mini-table__value">{l.side === 'debit' ? formatMoney(l.amount, locale) : ''}</td>
                              <td className="ll-num ll-mini-table__value">{l.side === 'credit' ? formatMoney(l.amount, locale) : ''}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
                {href !== null && (
                  <Button size="sm" variant="quiet" href={href} iconEnd={<ArrowRightIcon />} onClick={onNavigate} data-testid="lab-trace-open-step">
                    {t({ id: 'lab.trace.openStep', message: '開啟這一步', comment: '來源步驟的按鈕：到實驗室的那一步（練習模式）' })}
                  </Button>
                )}
              </Disclosure>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
