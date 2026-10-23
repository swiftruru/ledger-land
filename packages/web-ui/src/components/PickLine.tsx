// 點選報表列（03 第 2.4 節表二）：迷你報表是真正的 table，每列一個 aria-pressed 的 button（高度至少 44px），
// 方向鍵上下移動列，Enter 選取；選取後以 aria-live 播報「已選：營業利益」。判分在父層：checked 後給 correctLineIds 或逐列 statuses。
import { useLingui } from '@lingui/react/macro';
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { CheckCircleIcon, XCircleIcon } from './icons.tsx';

export interface PickLineRow {
  id: string;
  /** 列名（畫面文字，也用在播報） */
  label: string;
  /** 已格式化的金額文字；沒有就留空 */
  value?: string;
  /** 縮排層級（小計列等） */
  indent?: 0 | 1 | 2;
  /** 合計列：粗體加上方細線 */
  total?: boolean;
  /** 標題列不能選 */
  heading?: boolean;
  /** 作答後顯示在列下方的說明 */
  feedback?: ReactNode;
}

export type PickLineStatus = 'correct_selected' | 'correct_not_selected' | 'wrong_selected';

export interface PickLineProps {
  /** 表格標題（報表名稱加期間） */
  caption: ReactNode;
  /** 金額欄表頭；預設「金額」 */
  valueHeader?: ReactNode;
  rows: readonly PickLineRow[];
  selected: string | null;
  checked: boolean;
  /** 可接受的正解列（可以有多個） */
  correctLineIds?: readonly string[];
  /** 逐列狀態；給了就蓋過由 correctLineIds 推導的結果 */
  statuses?: Readonly<Partial<Record<string, PickLineStatus>>>;
  onSelect: (id: string) => void;
}

export function PickLine({ caption, valueHeader, rows, selected, checked, correctLineIds, statuses, onSelect }: PickLineProps) {
  const { t } = useLingui();
  const baseId = useId();
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const [announce, setAnnounce] = useState('');
  const selectable = rows.filter((r) => !r.heading);
  const correctSet = new Set(correctLineIds ?? []);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const i = selectable.findIndex((r) => r.id === id);
    const next = selectable[(i + (e.key === 'ArrowDown' ? 1 : -1) + selectable.length) % selectable.length];
    if (next) buttons.current.get(next.id)?.focus();
  };
  const statusText: Record<PickLineStatus, string> = {
    correct_selected: t({ id: 'quiz.choice.status.correctSelected', message: '正確答案，你選了' }),
    correct_not_selected: t({ id: 'quiz.choice.status.correctMissed', message: '正確答案，你沒有選' }),
    wrong_selected: t({ id: 'quiz.choice.status.wrongSelected', message: '不是正確答案，你選了' }),
  };
  return (
    <div className="ll-pick-line">
      <table className="ll-mini-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t({ id: 'report.col.line', message: '項目', comment: '迷你報表的列名欄表頭' })}</th>
            <th scope="col" className="ll-num">
              {valueHeader ?? t({ id: 'report.col.amount', message: '金額', comment: '迷你報表的金額欄表頭' })}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            if (r.heading)
              return (
                <tr key={r.id} className="ll-mini-table__heading">
                  <th scope="row" colSpan={2}>
                    {r.label}
                  </th>
                </tr>
              );
            const chosen = selected === r.id;
            const status: PickLineStatus | null = !checked
              ? null
              : (statuses?.[r.id] ?? (correctSet.has(r.id) ? (chosen ? 'correct_selected' : 'correct_not_selected') : chosen ? 'wrong_selected' : null));
            const fbId = `${baseId}-${r.id}-fb`;
            return (
              <tr
                key={r.id}
                className={`ll-mini-table__row${r.total ? ' is-total' : ''}${chosen ? ' is-chosen' : ''}${status ? ` is-${status.replace(/_/g, '-')}` : ''}`}
              >
                <th scope="row" className={`ll-mini-table__line ll-indent-${r.indent ?? 0}`}>
                  <button
                    type="button"
                    className="ll-mini-table__btn"
                    aria-pressed={chosen}
                    disabled={checked}
                    ref={(el) => {
                      if (el) buttons.current.set(r.id, el);
                      else buttons.current.delete(r.id);
                    }}
                    onKeyDown={(e) => onKey(e, r.id)}
                    onClick={() => {
                      const label = r.label;
                      onSelect(r.id);
                      setAnnounce(t({ id: 'quiz.pickLine.selected', message: `已選：${label}`, comment: '點選報表列後的播報；label 是列名' }));
                    }}
                    aria-describedby={status ? fbId : undefined}
                  >
                    <span className="ll-mini-table__mark">
                      {status === 'correct_selected' ? (
                        <CheckCircleIcon filled size={16} />
                      ) : status === 'correct_not_selected' ? (
                        <CheckCircleIcon size={16} />
                      ) : status === 'wrong_selected' ? (
                        <XCircleIcon size={16} />
                      ) : null}
                    </span>
                    <span>{r.label}</span>
                  </button>
                  {status && (
                    <span id={fbId} className="ll-mini-table__fb">
                      <span className="ll-option__status">{statusText[status]}</span>
                      {r.feedback && <span className="ll-option__feedback">{r.feedback}</span>}
                    </span>
                  )}
                </th>
                <td className="ll-num ll-mini-table__value">{r.value ?? ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="ll-sr-only" aria-live="polite">
        {announce}
      </div>
    </div>
  );
}
