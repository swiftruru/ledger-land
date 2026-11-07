// 報表表格（03 第 3.5 節、02 第 3.4 節）：真正的 table 與表頭，金額等寬靠右；列從核心的 Statements 來，不另存數字。
// 三種檢視：cumulative（交易後的累計一欄）、transaction（本筆變動一欄，沒變的列寫「不變」並淡化）、columns（交易前、交易後、本筆變動三欄並列，
// 平板橫向與電腦）。變動的列用醒目底色加 ▲▼ 與文字，不只靠顏色；onlyChanged 只看有變動的列。帶 (+)(-) 的累計列在本筆變動檢視加註（T12）。
// 給了 onTrace 時（M4b，03 第 3.9 節）交易後的金額與本筆變動的差額是可追蹤的數字（ValueButton，虛線下框），按下去開來源面板；
// 交易前的金額與沒變的「不變」不是（前一步的數字要到前一步追）。
import { useLingui } from '@lingui/react/macro';
import { formatMoney } from '@ledgerland/i18n';
import type { ReactNode } from 'react';
import { NoteTag, ValueButton } from '@ledgerland/web-ui';
import type { Statements, TraceWindow } from './lab-core.ts';
import { ARROW, directionOf, useLabLabels } from './labels.ts';
import { RollingMoney } from './RollingMoney.tsx';

type Row = Statements['statements'][keyof Statements['statements']][number];

export type StatementView = 'cumulative' | 'transaction' | 'columns';

export interface StatementTableProps {
  caption: ReactNode;
  /** 哪一張表（Statements.statements 的鍵） */
  statement: 'income_statement' | 'balance_sheet' | 'cash_flow_indirect';
  before: Statements;
  after: Statements;
  view: StatementView;
  onlyChanged?: boolean;
  /** 醒目標示的列（勾稽燈號點選） */
  highlight?: ReadonlySet<string>;
  /** 勾稽練習：可填的格子（數字輸入框連同它的標籤由父層畫）。累計檢視裡這一列改成一格橫跨整列：標籤在左、輸入框在右，放不下就換到下一行，
   * 不把表格撐得比欄位寬（2026-11-06：原本標籤一格、輸入框一格，三表並排時每張表都要左右捲） */
  inputs?: Readonly<Record<string, ReactNode>>;
  layout: Parameters<typeof useLabLabels>[0];
  /** 變動列的金額從交易前滾到交易後（減少動態時 false） */
  animate?: boolean;
  /** 點可追蹤的數字（交易後的金額是累計視窗、本筆變動的差額是本筆變動視窗）；沒給就只是數字（勾稽練習） */
  onTrace?: (lineId: string, window: TraceWindow, el: HTMLButtonElement) => void;
  id?: string;
  className?: string;
}

function indentOf(row: Row): 0 | 1 | 2 {
  if (row.kind === 'group') return 0;
  if (row.kind === 'total' || row.kind === 'formula') return 0;
  return 1;
}

export function StatementTable({
  caption,
  statement,
  before,
  after,
  view,
  onlyChanged = false,
  highlight,
  inputs,
  layout,
  animate = false,
  onTrace,
  id,
  className,
}: StatementTableProps) {
  const { t } = useLingui();
  const { locale, lineLabel } = useLabLabels(layout);
  const rows = after.statements[statement];
  const fmt = (v: number) => formatMoney(v, locale);
  const same = t({ id: 'lab.table.same', message: '不變', comment: '本筆變動檢視裡沒有變動的列' });
  const headBefore = t({ id: 'lab.table.before', message: '交易前', comment: '三欄表頭' });
  const headAfter = t({ id: 'lab.table.after', message: '交易後', comment: '三欄表頭' });
  const headChange = t({ id: 'lab.table.change', message: '本筆變動', comment: '三欄表頭與本筆變動檢視的欄名' });
  const headAmount = t({ id: 'lab.table.amount', message: '金額', comment: '累計檢視的欄名' });
  const noteCumulative = t({
    id: 'lab.table.cumulativeNote',
    message: '這一列是累計數，所以本筆變動顯示在原本的列',
    comment: '帶 (+)(-) 的累計列在本筆變動檢視的加註（T12）',
  });
  const visible = rows.filter((r) => r.visible && !r.hidden);
  const cols = view === 'columns' ? 3 : 1;
  // 可追蹤的數字：可讀名稱是完整的一句，數字本身對螢幕閱讀器隱藏
  const traceable = (lineId: string, window: TraceWindow, amount: number, node: ReactNode): ReactNode =>
    onTrace === undefined ? (
      node
    ) : (
      <ValueButton
        label={t({
          id: 'lab.trace.open',
          message: `${lineLabel(lineId)} ${fmt(amount)}，看這個數字從哪裡來`,
          comment: '可追蹤的數字（按鈕）的可讀名稱；列名與金額已代入',
        })}
        onClick={(e) => onTrace(lineId, window, e.currentTarget)}
        data-testid="lab-trace-value"
        data-line={lineId}
      >
        {node}
      </ValueButton>
    );
  return (
    <div className={`ll-lab-table${className ? ` ${className}` : ''}`} id={id}>
      <table className="ll-mini-table ll-lab-table__table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">
              <span className="ll-sr-only">{t({ id: 'lab.table.lineHeader', message: '項目', comment: '報表表格第一欄的表頭' })}</span>
            </th>
            {view === 'columns' ? (
              <>
                <th scope="col" className="ll-num">
                  {headBefore}
                </th>
                <th scope="col" className="ll-num">
                  {headAfter}
                </th>
                <th scope="col" className="ll-num">
                  {headChange}
                </th>
              </>
            ) : (
              <th scope="col" className="ll-num">
                {view === 'transaction' ? headChange : headAmount}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => {
            const b = before.lines.get(r.id)?.value ?? 0;
            const a = after.lines.get(r.id)?.value ?? 0;
            const delta = a - b;
            const dir = directionOf(delta);
            const changed = delta !== 0;
            if (onlyChanged && !changed && r.kind !== 'group') return null;
            if (r.kind === 'group') {
              return (
                <tr key={r.id} className="ll-mini-table__heading">
                  <th scope="rowgroup" colSpan={1 + cols}>
                    {lineLabel(r.id)}
                  </th>
                </tr>
              );
            }
            const total = r.kind === 'total' || r.kind === 'formula';
            const marked = highlight?.has(r.id) === true;
            const input = inputs?.[r.id];
            const cls = `ll-mini-table__row ll-lab-row${total ? ' is-total' : ''}${changed ? ` is-changed is-${dir}` : ''}${marked ? ' is-marked' : ''}`;
            const changeCell = changed ? (
              traceable(
                r.id,
                'transaction',
                delta,
                <span className="ll-lab-delta" data-dir={dir}>
                  <span aria-hidden="true">{ARROW[dir]} </span>
                  {fmt(delta)}
                </span>,
              )
            ) : (
              <span className="ll-lab-delta is-same">{same}</span>
            );
            const note = r.kind === 'working_capital' && view !== 'cumulative' ? <span className="ll-lab-row__note">{noteCumulative}</span> : null;
            const afterCell = traceable(r.id, 'cumulative', a, changed ? <RollingMoney from={b} to={a} animate={animate} locale={locale} /> : fmt(a));
            const mark = changed ? (
              <span className="ll-lab-row__mark" data-dir={dir}>
                <span aria-hidden="true">{ARROW[dir]}</span>
                <span className="ll-sr-only">{headChange}</span>
              </span>
            ) : null;
            if (input && view === 'cumulative')
              return (
                <tr key={r.id} className={`${cls} has-input`} data-line={r.id}>
                  <td colSpan={2} className="ll-lab-row__fill">
                    <div className="ll-lab-fill">
                      <div className="ll-lab-fill__main">{input}</div>
                      {/* 箭頭的位置每一列都留著：有變動與沒變動的列，輸入框才會上下對齊 */}
                      <span className="ll-lab-fill__mark">{mark}</span>
                    </div>
                  </td>
                </tr>
              );
            return (
              <tr key={r.id} className={cls} data-line={r.id}>
                <th scope="row" className={`ll-mini-table__line ll-indent-${indentOf(r)}`}>
                  {lineLabel(r.id)}
                  {r.flags.includes('not_ifrs_line') && <NoteTag kind="not_ifrs_line" className="ll-lab-row__tag" />}
                  {note}
                </th>
                {view === 'columns' ? (
                  <>
                    <td className="ll-num ll-mini-table__value">{fmt(b)}</td>
                    <td className="ll-num ll-mini-table__value">{input ?? afterCell}</td>
                    <td className="ll-num ll-mini-table__value">{changeCell}</td>
                  </>
                ) : view === 'transaction' ? (
                  <td className="ll-num ll-mini-table__value">{changeCell}</td>
                ) : (
                  <td className="ll-num ll-mini-table__value">
                    {afterCell}
                    {mark}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** 本筆變動摘要列（03 第 3.5 節，W06）：最多 3 項，本期淨利有變時一定在最後，其餘依資產負債表的科目順序；超過寫「還有 n 列」 */
export function changeSummary(
  before: Statements,
  after: Statements,
  lineLabel: (id: string) => string,
  locale: 'zh-TW' | 'en',
): { items: string[]; more: number } {
  const bs = after.statements.balance_sheet.filter((r) => r.visible && !r.hidden && r.kind === 'accounts' && r.id !== 'bs_retained_earnings');
  const changed = bs.map((r) => ({ id: r.id, delta: (after.lines.get(r.id)?.value ?? 0) - (before.lines.get(r.id)?.value ?? 0) })).filter((x) => x.delta !== 0);
  const ni = (after.lines.get('is_net_income')?.value ?? 0) - (before.lines.get('is_net_income')?.value ?? 0);
  const slots = ni !== 0 ? 2 : 3;
  const shown = changed.slice(0, slots);
  const items = shown.map((x) => `${lineLabel(x.id)} ${ARROW[directionOf(x.delta)]} ${formatMoney(Math.abs(x.delta), locale)}`);
  if (ni !== 0) items.push(`${lineLabel('is_net_income')} ${ARROW[directionOf(ni)]} ${formatMoney(Math.abs(ni), locale)}`);
  return { items, more: Math.max(0, changed.length - shown.length) };
}
