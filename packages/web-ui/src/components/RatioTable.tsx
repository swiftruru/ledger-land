// 指標小表格（03 第 2.4 節表二的 ratio_interpret）：真正的 table，有欄列表頭；數字由父層格式化（來自快照的 compiled）。
// 指標狀態不是 ok 時以文字說明（N/A 與 0 分開，04 第 12.6 節），不只靠顏色。
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type RatioRowStatus = 'ok' | 'zero' | 'na' | 'not_meaningful';

export interface RatioTableRow {
  id: string;
  /** 指標名稱 */
  label: ReactNode;
  /** 已格式化的數值；status 不是 ok 或 zero 時可省略 */
  value?: string;
  status?: RatioRowStatus;
  /** 備註（版本名稱、單期近似等） */
  note?: ReactNode;
}

export interface RatioTableProps {
  caption: ReactNode;
  rows: readonly RatioTableRow[];
  /** 數值欄表頭；預設「數值」 */
  valueHeader?: ReactNode;
  className?: string;
}

export function RatioTable({ caption, rows, valueHeader, className }: RatioTableProps) {
  const { t } = useLingui();
  const statusText: Record<Exclude<RatioRowStatus, 'ok'>, string> = {
    zero: t({ id: 'ratio.status.zero', message: '0（分子是 0）', comment: '指標表格：分子為 0 的狀態文字' }),
    na: t({ id: 'ratio.status.na', message: 'N/A（分母不存在）', comment: '指標表格：分母為 0 或缺少輸入的狀態文字' }),
    not_meaningful: t({ id: 'ratio.status.notMeaningful', message: '不具意義（分母為負）', comment: '指標表格：分母為負時的狀態文字' }),
  };
  const hasNote = rows.some((r) => r.note !== undefined);
  return (
    <table className={`ll-mini-table ll-ratio-table${className ? ` ${className}` : ''}`}>
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{t({ id: 'ratio.col.name', message: '指標', comment: '指標表格的名稱欄表頭' })}</th>
          <th scope="col" className="ll-num">
            {valueHeader ?? t({ id: 'ratio.col.value', message: '數值', comment: '指標表格的數值欄表頭' })}
          </th>
          {hasNote && <th scope="col">{t({ id: 'ratio.col.note', message: '備註', comment: '指標表格的備註欄表頭' })}</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const status = r.status ?? 'ok';
          const text = status === 'ok' ? (r.value ?? '') : status === 'zero' && r.value !== undefined ? r.value : statusText[status];
          return (
            <tr key={r.id} className={`ll-ratio-table__row is-${status}`}>
              <th scope="row">{r.label}</th>
              <td className="ll-num">{text}</td>
              {hasNote && <td className="ll-ratio-table__note">{r.note}</td>}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
