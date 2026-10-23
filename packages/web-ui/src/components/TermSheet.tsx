// 共用名詞卡（03 第 4.3 節、05 第 13.1 節）：原生 dialog（showModal 提供焦點鎖定與 Esc；關閉後焦點回到開啟它的 chip）。
// 內容由父層依介面語言從名詞資料取好後傳入；元件不自己寫術語。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { Button } from './Button.tsx';
import { XIcon } from './icons.tsx';
import { NoteTag, type NoteTagKind } from './NoteTag.tsx';

export interface TermSheetData {
  /** 主標（中文介面是教材用語，英文介面是 IFRS 英文） */
  label: string;
  /** 副標（另一種語言的名稱）與它的 lang */
  secondaryLabel?: string;
  secondaryLang?: string;
  teacherLabel: string;
  currentTwLabel: string | null;
  ifrsEnglish: string | null;
  definition: ReactNode;
  example?: ReactNode;
  misconception?: ReactNode;
  formula?: ReactNode;
  /** 「IFRS 怎麼處理」段落 */
  ifrsNote?: ReactNode;
  /** 顯示成 NoteTag 的旗標 */
  flags?: readonly NoteTagKind[];
  /** 英文譯名本身還不確定時顯示「譯名尚待確認」 */
  translationPending?: boolean;
  /** 相關名詞 chip 等額外內容 */
  related?: ReactNode;
  footer?: ReactNode;
}

export interface TermSheetProps {
  open: boolean;
  onClose: () => void;
  term: TermSheetData;
  /** 旗標被點時（例如開到 IFRS 段落） */
  onFlagClick?: (kind: NoteTagKind) => void;
  /** 關閉後要把焦點還給的元素（開啟它的 chip）；Safari 點選按鈕不會給焦點，所以不能只靠 document.activeElement */
  returnFocusTo?: RefObject<HTMLElement | null>;
}

export function TermSheet({ open, onClose, term, onFlagClick, returnFocusTo }: TermSheetProps) {
  const { t } = useLingui();
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      d.showModal();
    } else if (!open && d.open) {
      d.close();
      // 關閉後焦點回到開啟它的 chip（07 第 8.1 節）：優先用 returnFocusTo，其次是開啟時的焦點元素；都沒有就至少不讓焦點留在關閉的對話框裡
      const el = returnFocusTo?.current ?? opener.current;
      if (el && el.isConnected && el !== document.body) el.focus();
      else if (d.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      opener.current = null;
    }
  }, [open, returnFocusTo]);
  const ifrsId = `${titleId}-ifrs`;
  return (
    <dialog
      ref={ref}
      className="ll-sheet"
      aria-labelledby={titleId}
      aria-modal="true"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="ll-sheet__body">
        <div className="ll-sheet__head">
          <div>
            <h2 id={titleId} className="ll-sheet__title">
              {term.label}
            </h2>
            {term.secondaryLabel && (
              <p className="ll-sheet__subtitle" lang={term.secondaryLang}>
                {term.secondaryLabel}
                {term.translationPending && (
                  <span className="ll-sheet__pending">
                    {' '}
                    {t({ id: 'term.translationPending', message: '譯名尚待確認', comment: '名詞卡：英文譯名本身還不確定時的標示' })}
                  </span>
                )}
              </p>
            )}
          </div>
          <button
            type="button"
            className="ll-iconbtn"
            onClick={onClose}
            aria-label={t({ id: 'ui.close', message: '關閉', comment: '對話框關閉按鈕的可讀名稱' })}
          >
            <XIcon />
          </button>
        </div>
        <div className="ll-sheet__definition">{term.definition}</div>
        <dl className="ll-sheet__names">
          <div>
            <dt>
              <Trans id="term.teacherLabel" comment="名詞卡：教材用語的欄位標題">
                教材用語
              </Trans>
            </dt>
            <dd lang="zh-TW">{term.teacherLabel}</dd>
          </div>
          {term.currentTwLabel && (
            <div>
              <dt>
                <Trans id="term.currentTwLabel" comment="名詞卡：現行台灣用語的欄位標題">
                  現行用語
                </Trans>
              </dt>
              <dd lang="zh-TW">{term.currentTwLabel}</dd>
            </div>
          )}
          <div>
            <dt>IFRS</dt>
            <dd lang="en">
              {term.ifrsEnglish ?? (
                <Trans id="term.noIfrs" comment="名詞卡：IFRS 沒有對應名稱時的文字">
                  沒有對應的 IFRS 名稱
                </Trans>
              )}
            </dd>
          </div>
        </dl>
        {term.flags && term.flags.length > 0 && (
          <div className="ll-row ll-sheet__flags">
            {term.flags.map((f) => (
              <NoteTag key={f} kind={f} subject={term.label} onClick={onFlagClick ? () => onFlagClick(f) : undefined} />
            ))}
          </div>
        )}
        {term.formula && (
          <section className="ll-sheet__section">
            <h3>
              <Trans id="term.formula" comment="名詞卡：公式段落標題">
                公式
              </Trans>
            </h3>
            <div className="ll-num">{term.formula}</div>
          </section>
        )}
        {term.example && (
          <section className="ll-sheet__section">
            <h3>
              <Trans id="term.example" comment="名詞卡：例子段落標題">
                例子
              </Trans>
            </h3>
            {term.example}
          </section>
        )}
        {term.misconception && (
          <section className="ll-sheet__section">
            <h3>
              <Trans id="term.misconception" comment="名詞卡：常見誤解段落標題">
                常見誤解
              </Trans>
            </h3>
            {term.misconception}
          </section>
        )}
        {term.ifrsNote && (
          <section className="ll-sheet__section" id={ifrsId}>
            <h3>
              <Trans id="term.underIfrs" comment="名詞卡：IFRS 怎麼處理的段落標題">
                IFRS 怎麼處理
              </Trans>
            </h3>
            {term.ifrsNote}
          </section>
        )}
        {term.related && (
          <section className="ll-sheet__section">
            <h3>
              <Trans id="term.related" comment="名詞卡：相關名詞段落標題">
                相關名詞
              </Trans>
            </h3>
            <div className="ll-row">{term.related}</div>
          </section>
        )}
        {term.footer}
        <div className="ll-row ll-actions">
          <Button onClick={onClose}>
            <Trans id="ui.close" comment="對話框關閉按鈕的可讀名稱">
              關閉
            </Trans>
          </Button>
        </div>
      </div>
    </dialog>
  );
}
