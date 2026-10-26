// 輸入關卡代號（07 第 9 節、06 第 4.9 節、站規 1.2.4、1.20 與 2.2.5）：可見標籤「關卡代號」、共用文字欄位 .ll-input（16px 以上字級），
// 錯誤時 aria-invalid、FieldError 以 aria-describedby 連到輸入框；送出是 Button primary md block。
// 已下架（站規 2.2.5）：錯誤句下一行是 Button secondary sm「前往所屬章節」（箭頭在後），送出鈕維持 primary md block、可以按
// （使用者改了代號直接送出）。第 4 輪看圖驗收：原本已下架時把「前往所屬章節」升成主動作、送出鈕變成停用的虛線框，像一個空位，改回規格。
// 正規化與查詢由頁面負責（apps/web 的 features/quest-map/level-code.ts），這裡只收原始輸入並顯示結果。
import { useLingui } from '@lingui/react/macro';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button } from './Button.tsx';
import { FieldError } from './FieldError.tsx';
import { ArrowRightIcon } from './icons.tsx';

export type LevelCodeStatus = { kind: 'idle' } | { kind: 'format' } | { kind: 'notFound' } | { kind: 'retired'; chapterHref?: string } | { kind: 'busy' };

export interface LevelCodeInputProps {
  status: LevelCodeStatus;
  onSubmit: (raw: string) => void;
  /** 舊介面相容：給了就在按下「前往所屬章節」時攔截導覽（有 LinkProvider 時不需要） */
  onNavigate?: (href: string) => void;
  /** 疊加層打開時把焦點放進輸入框 */
  focusOnOpen?: boolean;
  className?: string;
}

export function LevelCodeInput({ status, onSubmit, onNavigate, focusOnOpen, className }: LevelCodeInputProps) {
  const { t } = useLingui();
  const id = useId();
  const [raw, setRaw] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // 面板的 showModal() 在父層的 effect 裡（晚於這裡），會把焦點放到標題，所以延到下一個 tick 再把焦點放進輸入框
  useEffect(() => {
    if (!focusOnOpen) return;
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [focusOnOpen]);
  const errorId = `${id}-error`;
  const hasError = status.kind === 'format' || status.kind === 'notFound' || status.kind === 'retired';
  const message =
    status.kind === 'format'
      ? t({ id: 'map.code.errFormat', message: '代號是 8 個英文字母或數字，請再核對一次', comment: '關卡代號格式不符時的提示' })
      : status.kind === 'notFound'
        ? t({ id: 'map.code.errNotFound', message: '找不到這個代號，請再確認一次', comment: '關卡代號查無資料時的提示' })
        : status.kind === 'retired'
          ? t({ id: 'map.code.errRetired', message: '這個關卡已經下架', comment: '關卡代號對應到已下架關卡時的提示' })
          : null;
  const chapterHref = status.kind === 'retired' ? status.chapterHref : undefined;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(raw);
  };
  return (
    <form className={`ll-codeinput${className ? ` ${className}` : ''}`} onSubmit={submit} noValidate>
      <label className="ll-codeinput__label" htmlFor={id}>
        {t({ id: 'map.code.fieldLabel', message: '關卡代號', comment: '輸入關卡代號的欄位標籤（說明句在疊加層上方）' })}
      </label>
      <input
        ref={inputRef}
        id={id}
        className="ll-input ll-codeinput__input ll-num"
        type="text"
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
        maxLength={16}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        aria-invalid={hasError ? 'true' : undefined}
        aria-describedby={hasError ? errorId : undefined}
        placeholder="k7m2 q9xd"
      />
      <div className="ll-codeinput__status" role="alert" aria-live="assertive">
        {message && <FieldError id={errorId}>{message}</FieldError>}
      </div>
      {chapterHref && (
        <Button
          variant="secondary"
          size="sm"
          iconEnd={<ArrowRightIcon />}
          href={chapterHref}
          className="ll-codeinput__chapter"
          onClick={
            onNavigate
              ? (e) => {
                  e.preventDefault();
                  onNavigate(chapterHref);
                }
              : undefined
          }
        >
          {t({ id: 'map.code.goChapter', message: '前往所屬章節', comment: '已下架關卡提示下面的按鈕' })}
        </Button>
      )}
      <Button type="submit" variant="primary" block busy={status.kind === 'busy'} className="ll-codeinput__submit">
        {t({ id: 'map.code.go', message: '前往', comment: '送出關卡代號的按鈕' })}
      </Button>
    </form>
  );
}
