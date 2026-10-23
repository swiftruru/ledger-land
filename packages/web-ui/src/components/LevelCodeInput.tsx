// 輸入關卡代號（07 第 9 節、06 第 4.9 節）：可見標籤、16px 以上字級、錯誤以 aria-describedby 連到輸入框。
// 正規化與查詢由頁面負責（apps/web 的 features/quest-map/level-code.ts），這裡只收原始輸入並顯示結果。
import { useLingui } from '@lingui/react/macro';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button } from './Button.tsx';

export type LevelCodeStatus = { kind: 'idle' } | { kind: 'format' } | { kind: 'notFound' } | { kind: 'retired'; chapterHref?: string } | { kind: 'busy' };

export interface LevelCodeInputProps {
  status: LevelCodeStatus;
  onSubmit: (raw: string) => void;
  /** 站內連結由父層以 localePath 產生並帶結尾斜線；給了就用它攔截導覽 */
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
  // 疊加層的 showModal() 在父層的 effect 裡（晚於這裡），會把焦點放到第一個可聚焦元素，所以延到下一個 tick 再把焦點放進輸入框
  useEffect(() => {
    if (!focusOnOpen) return;
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [focusOnOpen]);
  const errorId = `${id}-error`;
  const hasError = status.kind === 'format' || status.kind === 'notFound' || status.kind === 'retired';
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(raw);
  };
  let message: React.ReactNode = null;
  if (status.kind === 'format')
    message = t({ id: 'map.code.errFormat', message: '代號是 8 個英文字母或數字，請再核對一次', comment: '關卡代號格式不符時的提示' });
  else if (status.kind === 'notFound')
    message = t({ id: 'map.code.errNotFound', message: '找不到這個代號，請再確認一次', comment: '關卡代號查無資料時的提示' });
  else if (status.kind === 'retired')
    message = (
      <>
        {t({ id: 'map.code.errRetired', message: '這個關卡已經下架', comment: '關卡代號對應到已下架關卡時的提示' })}
        {status.chapterHref && (
          <>
            {' '}
            <a
              href={status.chapterHref}
              onClick={(e) => {
                if (!onNavigate) return;
                e.preventDefault();
                onNavigate(status.chapterHref!);
              }}
            >
              {t({ id: 'map.code.goChapter', message: '前往所屬章節', comment: '已下架關卡提示後的連結文字' })}
            </a>
          </>
        )}
      </>
    );
  return (
    <form className={`ll-codeinput${className ? ` ${className}` : ''}`} onSubmit={submit} noValidate>
      <label className="ll-codeinput__label" htmlFor={id}>
        {t({ id: 'map.code.inputLabel', message: '關卡代號（8 碼，黑板或投影片上）', comment: '輸入關卡代號的欄位標籤' })}
      </label>
      <div className="ll-codeinput__row">
        <input
          ref={inputRef}
          id={id}
          className="ll-codeinput__input ll-num"
          type="text"
          inputMode="text"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          maxLength={16}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : undefined}
          placeholder="k7m2 q9xd"
        />
        <Button type="submit" variant="primary" disabled={status.kind === 'busy'}>
          {t({ id: 'map.code.go', message: '前往', comment: '送出關卡代號的按鈕' })}
        </Button>
      </div>
      <p id={errorId} className="ll-codeinput__error" role="alert" aria-live="assertive">
        {message}
      </p>
    </form>
  );
}
