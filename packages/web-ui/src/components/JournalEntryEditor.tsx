// 借貸分錄題（03 第 2.4 節表二、第 2.6 節；D1 只在延伸章）：「新增一行」開啟科目選擇面板（可搜尋、依要素分組），
// 每行選借或貸（原生 select）、輸入金額（NumberInput）；分錄是真正的 table，每行讀成「第 1 行，借方，現金，120,000」。
// 全部用原生表單元件；判分在父層：checked 後給逐行狀態（多了這一行、金額不對）與少了的行；旁邊一句對應說明由父層以 note 傳入。
// 搜尋框在作答表單（QuestionCard 的 form）裡：按 Enter（iOS 鍵盤的「搜尋」）選畫面上的第一個結果，不觸發表單送出；注音選字的 Enter 不選科目。
// 新增或刪除的播報每次換一個新的節點（key 遞增），文字相同（連刪兩次第 2 行）也會再讀一次。
import { Trans, useLingui } from '@lingui/react/macro';
import { formatMoney, normalizeNumericInput } from '@ledgerland/i18n';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button.tsx';
import { IconButton } from './IconButton.tsx';
import { CheckCircleIcon, PlusIcon, TrashIcon, XCircleIcon } from './icons.tsx';
import { menuItemClass } from './Menu.tsx';
import { NumberInput, useUiLocale } from './NumberInput.tsx';

export type JournalSide = 'debit' | 'credit';

export interface JournalAccountOption {
  /** 科目 ID（語意 ID） */
  id: string;
  /** 顯示名稱（介面語言） */
  label: string;
  /** 分組代號（要素），對應 groups 的 id */
  group: string;
  /** 搜尋用的別名（教材用語、現行用語、英文） */
  aliases?: readonly string[];
}

export interface JournalAccountGroup {
  id: string;
  label: string;
}

export interface JournalLineState {
  /** 介面用的行鍵，與科目無關 */
  key: string;
  account: string;
  side: JournalSide;
  /** 金額的原始輸入文字 */
  raw: string;
}

export type JournalLineStatus = 'ok' | 'extra' | 'amount';

export interface JournalMissingLine {
  side: JournalSide;
  /** 科目顯示名稱 */
  account: string;
  /** 已格式化的金額 */
  amount: string;
}

export interface JournalEntryResult {
  /** 行鍵對狀態；沒列的行視為 ok */
  lines: Readonly<Partial<Record<string, JournalLineStatus>>>;
  /** 正解有、作答沒有的行 */
  missing: readonly JournalMissingLine[];
}

export interface JournalEntryEditorProps {
  accounts: readonly JournalAccountOption[];
  /** 分組順序與名稱（例如資產、負債、股東權益、收益、費損） */
  groups: readonly JournalAccountGroup[];
  lines: readonly JournalLineState[];
  onChange: (lines: readonly JournalLineState[]) => void;
  checked: boolean;
  result?: JournalEntryResult;
  /** 分錄旁的一句對應說明（例如教材版面的「本期進貨」「期末存貨」不是分錄科目） */
  note?: ReactNode;
  /** 整個編輯區的名稱所在元素（題幹）的 id */
  labelledBy?: string;
}

/** 至少一行，而且每一行都有科目與金額，才可以確認 */
export function isJournalComplete(lines: readonly JournalLineState[]): boolean {
  return lines.length > 0 && lines.every((l) => l.account !== '' && l.raw.trim() !== '');
}

let keySeq = 0;
function nextKey(): string {
  keySeq += 1;
  return `jl${keySeq}`;
}

function matches(account: JournalAccountOption, query: string): boolean {
  if (query === '') return true;
  const q = query.toLocaleLowerCase();
  if (account.label.toLocaleLowerCase().includes(q)) return true;
  return (account.aliases ?? []).some((a) => a.toLocaleLowerCase().includes(q));
}

export function JournalEntryEditor({ accounts, groups, lines, onChange, checked, result, note, labelledBy }: JournalEntryEditorProps) {
  const { t } = useLingui();
  const locale = useUiLocale();
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // 「新增一行」是 Button（不轉發 ref），焦點用 id 找回
  const addId = `${baseId}-add`;
  const focusAdd = () => document.getElementById(addId)?.focus();
  const searchBox = useRef<HTMLInputElement>(null);
  const sideSelects = useRef(new Map<string, HTMLSelectElement>());
  const pendingFocus = useRef<string | null>(null);
  const [announce, setAnnounce] = useState<{ text: string; n: number }>({ text: '', n: 0 });
  const labelOf = useMemo(() => new Map(accounts.map((a) => [a.id, a.label] as const)), [accounts]);

  useEffect(() => {
    if (pendingFocus.current !== null) {
      sideSelects.current.get(pendingFocus.current)?.focus();
      pendingFocus.current = null;
    }
  });
  useEffect(() => {
    if (open) searchBox.current?.focus();
  }, [open]);

  const sideLabel: Record<JournalSide, string> = {
    debit: t({ id: 'journal.side.debit', message: '借方', comment: '分錄的借方' }),
    credit: t({ id: 'journal.side.credit', message: '貸方', comment: '分錄的貸方' }),
  };
  const lineName = (index: number) => t({ id: 'journal.line', message: `第 ${index} 行`, comment: '分錄表格的列標題；index 從 1 起算' });

  const addLine = (accountId: string) => {
    const key = nextKey();
    // 預設方向：已有借方行就給貸方，讓借貸交錯
    const side: JournalSide = lines.length > 0 && lines.every((l) => l.side === 'debit') ? 'credit' : 'debit';
    onChange([...lines, { key, account: accountId, side, raw: '' }]);
    pendingFocus.current = key;
    setOpen(false);
    setQuery('');
    const label = labelOf.get(accountId) ?? accountId;
    const index = lines.length + 1;
    const text = t({ id: 'journal.added', message: `已新增第 ${index} 行：${label}`, comment: '新增分錄行後的播報；index 是行號、label 是科目' });
    setAnnounce((a) => ({ text, n: a.n + 1 }));
  };
  const removeLine = (key: string, index: number) => {
    onChange(lines.filter((l) => l.key !== key));
    const text = t({ id: 'journal.removed', message: `已刪除第 ${index} 行`, comment: '刪除分錄行後的播報；index 是行號' });
    setAnnounce((a) => ({ text, n: a.n + 1 }));
    focusAdd();
  };
  const update = (key: string, patch: Partial<JournalLineState>) => onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const sum = (side: JournalSide) =>
    lines.reduce((acc, l) => {
      if (l.side !== side) return acc;
      const r = normalizeNumericInput(l.raw, 'money');
      return r.ok ? acc + r.value : acc;
    }, 0);
  const debitTotal = sum('debit');
  const creditTotal = sum('credit');
  const balanced = lines.length > 0 && debitTotal === creditTotal;
  const diffText = formatMoney(Math.abs(debitTotal - creditTotal), locale);

  const statusText: Record<JournalLineStatus, string> = {
    ok: t({ id: 'journal.status.ok', message: '這一行正確', comment: '分錄題逐行回饋' }),
    extra: t({ id: 'journal.status.extra', message: '多了這一行', comment: '分錄題逐行回饋：正解沒有這一行' }),
    amount: t({ id: 'journal.status.amount', message: '金額不對', comment: '分錄題逐行回饋：科目與方向對、金額不對' }),
  };
  const filtered = accounts.filter((a) => matches(a, query.trim()));

  return (
    <div className="ll-journal" role="group" aria-labelledby={labelledBy}>
      {lines.length > 0 && (
        // 寬的時候是一般的表格；外層窄（手機，container query，09-quiz-advanced.css）時每一行排成兩列的小卡（行號、科目、刪除／借或貸、金額），
        // 不必左右捲動也看得到金額與刪除鈕。改了 display 之後，較舊的 WebKit 可能不再把它讀成表格；每個控制項都有自己的完整名稱
        // （「第 1 行的借或貸」「第 1 行的金額」「刪除第 1 行」），單獨讀到也知道是哪一行。仍保留可用鍵盤水平捲動的 region（07 第 8.3 節）當保底
        // 可捲動的 region 要能用鍵盤聚焦後左右捲動（07 第 8.3 節、axe 的 scrollable-region-focusable），所以 tabIndex 是刻意的
        <div
          className="ll-journal__scroll"
          role="region"
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          aria-label={t({ id: 'journal.region', message: '分錄表格', comment: '分錄表格外層可水平捲動區域的名稱（07 第 8.3 節；窄螢幕時可以用鍵盤左右捲動）' })}
        >
          <table className="ll-journal__table">
            <caption className="ll-sr-only">{t({ id: 'journal.caption', message: '分錄', comment: '分錄表格的標題（只給螢幕閱讀器）' })}</caption>
            <thead>
              <tr>
                <th scope="col">{t({ id: 'journal.col.line', message: '行', comment: '分錄表格的行號欄表頭' })}</th>
                <th scope="col">{t({ id: 'journal.col.side', message: '借或貸', comment: '分錄表格的方向欄表頭' })}</th>
                <th scope="col">{t({ id: 'journal.col.account', message: '科目', comment: '分錄表格的科目欄表頭' })}</th>
                <th scope="col" className="ll-num">
                  {t({ id: 'journal.col.amount', message: '金額', comment: '分錄表格的金額欄表頭' })}
                </th>
                {!checked && <th scope="col">{t({ id: 'journal.col.actions', message: '操作', comment: '分錄表格的操作欄表頭' })}</th>}
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const index = i + 1;
                const name = lineName(index);
                const status = checked ? (result?.lines[l.key] ?? 'ok') : null;
                const fbId = `${baseId}-${l.key}-fb`;
                const accountLabel = labelOf.get(l.account) ?? l.account;
                return (
                  <tr key={l.key} className={`ll-journal__row${status === null ? '' : status === 'ok' ? ' is-correct' : ' is-wrong'}`}>
                    <th scope="row" className="ll-journal__no">
                      {name}
                    </th>
                    <td className="ll-journal__sidecell">
                      <select
                        className="ll-journal__side"
                        aria-label={t({ id: 'journal.sideOf', message: `${name}的借或貸`, comment: '方向下拉的可讀名稱；name 是「第 N 行」' })}
                        value={l.side}
                        disabled={checked}
                        ref={(el) => {
                          if (el) sideSelects.current.set(l.key, el);
                          else sideSelects.current.delete(l.key);
                        }}
                        onChange={(e) => update(l.key, { side: e.target.value as JournalSide })}
                      >
                        <option value="debit">{sideLabel.debit}</option>
                        <option value="credit">{sideLabel.credit}</option>
                      </select>
                    </td>
                    <td className={`ll-journal__account${l.side === 'credit' ? ' is-credit' : ''}`}>
                      <span>{accountLabel}</span>
                      {status !== null && (
                        <span id={fbId} className="ll-journal__fb">
                          <span className="ll-journal__icon" aria-hidden="true">
                            {status === 'ok' ? <CheckCircleIcon filled size={16} /> : <XCircleIcon size={16} />}
                          </span>
                          <span className="ll-option__status">{statusText[status]}</span>
                        </span>
                      )}
                    </td>
                    <td className="ll-num ll-journal__amount">
                      <NumberInput
                        id={`${baseId}-${l.key}-amount`}
                        label={t({ id: 'journal.amountOf', message: `${name}的金額`, comment: '金額輸入框的可讀名稱；name 是「第 N 行」' })}
                        hideLabel
                        value={l.raw}
                        onChange={(raw) => update(l.key, { raw })}
                        unit="money"
                        disabled={checked}
                        showParsed={false}
                        {...(status === null ? {} : { describedBy: fbId })}
                      />
                    </td>
                    {!checked && (
                      <td className="ll-journal__delcell">
                        <IconButton
                          icon={<TrashIcon />}
                          label={t({ id: 'journal.remove', message: `刪除${name}`, comment: '刪除分錄行的按鈕；name 是「第 N 行」' })}
                          onClick={() => removeLine(l.key, index)}
                          className="ll-journal__remove"
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="ll-journal__total">
                <th scope="row" colSpan={3}>
                  {t({ id: 'journal.total.debit', message: '借方合計', comment: '分錄表格的合計列' })}
                </th>
                <td className="ll-num" colSpan={checked ? 1 : 2}>
                  {formatMoney(debitTotal, locale)}
                </td>
              </tr>
              <tr className="ll-journal__total">
                <th scope="row" colSpan={3}>
                  {t({ id: 'journal.total.credit', message: '貸方合計', comment: '分錄表格的合計列' })}
                </th>
                <td className="ll-num" colSpan={checked ? 1 : 2}>
                  {formatMoney(creditTotal, locale)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {lines.length > 0 && (
        <p className={`ll-journal__balance ${balanced ? 'is-balanced' : 'is-unbalanced'}`}>
          {balanced
            ? t({ id: 'journal.balanced', message: '借貸平衡', comment: '分錄借方合計等於貸方合計時的文字' })
            : t({ id: 'journal.unbalanced', message: `借貸不平衡，差 ${diffText}`, comment: '分錄借貸合計不相等時的文字；diffText 是已格式化的差額' })}
        </p>
      )}
      {checked && result !== undefined && result.missing.length > 0 && (
        <ul
          className="ll-journal__missing"
          aria-label={t({ id: 'journal.missing.title', message: '少了的行', comment: '分錄題回饋：正解有、作答沒有的行的清單名稱' })}
        >
          {result.missing.map((m, i) => {
            const side = sideLabel[m.side];
            const account = m.account;
            const amount = m.amount;
            return (
              <li key={i} className="ll-journal__missing-item">
                <span className="ll-journal__icon" aria-hidden="true">
                  <XCircleIcon size={16} />
                </span>
                <span className="ll-option__status">
                  {t({
                    id: 'journal.status.missing',
                    message: `少了這一行：${side} ${account} ${amount}`,
                    comment: '分錄題逐行回饋：正解有、作答沒有的行；side 是借方或貸方、account 是科目、amount 是已格式化的金額',
                  })}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {!checked && (
        <div className="ll-journal__add">
          <Button
            size="sm"
            icon={<PlusIcon />}
            id={addId}
            className="ll-journal__addbtn"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((o) => !o)}
          >
            <Trans id="journal.addLine" comment="開啟科目選擇面板的按鈕">
              新增一行
            </Trans>
          </Button>
          {open && (
            <div
              id={panelId}
              className="ll-journal__panel"
              role="region"
              aria-label={t({ id: 'journal.panel', message: '選擇科目', comment: '科目選擇面板的名稱' })}
            >
              <label htmlFor={`${baseId}-search`} className="ll-journal__search-label">
                <Trans id="journal.search" comment="科目選擇面板的搜尋框標籤">
                  搜尋科目
                </Trans>
              </label>
              <input
                id={`${baseId}-search`}
                ref={searchBox}
                type="search"
                className="ll-journal__search"
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    // 注音等輸入法選字的 Enter（Safari 在 compositionend 之後才送 keyCode 229 的 keydown）：交給輸入法，不選科目
                    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                    // 不讓外層的作答表單隱含送出；有搜尋字時選畫面上（依分組順序）的第一個結果
                    e.preventDefault();
                    const first = groups.flatMap((g) => filtered.filter((a) => a.group === g.id))[0];
                    if (query.trim() !== '' && first) addLine(first.id);
                    return;
                  }
                  if (e.key === 'Escape') {
                    setOpen(false);
                    focusAdd();
                  }
                }}
              />
              {groups.map((g) => {
                const items = filtered.filter((a) => a.group === g.id);
                if (items.length === 0) return null;
                return (
                  <div key={g.id} className="ll-journal__group" role="group" aria-labelledby={`${baseId}-g-${g.id}`}>
                    <p id={`${baseId}-g-${g.id}`} className="ll-journal__group-title">
                      {g.label}
                    </p>
                    <ul className="ll-journal__options">
                      {items.map((a) => (
                        <li key={a.id}>
                          <button type="button" className={menuItemClass('ll-journal__option')} onClick={() => addLine(a.id)}>
                            <span className="ll-journal__option-icon" aria-hidden="true">
                              <PlusIcon />
                            </span>
                            <span className="ll-journal__option-label">{a.label}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <p className="ll-muted">
                  <Trans id="journal.noMatch" comment="科目搜尋沒有結果">
                    沒有符合的科目
                  </Trans>
                </p>
              )}
            </div>
          )}
        </div>
      )}
      {note !== undefined && <p className="ll-journal__note">{note}</p>}
      <div className="ll-sr-only" aria-live="polite">
        {announce.text !== '' && <span key={announce.n}>{announce.text}</span>}
      </div>
    </div>
  );
}
