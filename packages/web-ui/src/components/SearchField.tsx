// 搜尋框（站規 1.14）：48px 膠囊、左側 20px 搜尋圖示、可見標籤在上方（07 第 8.4 節；placeholder 只是例子）。
// 有輸入時右側出現 IconButton「清除搜尋」，清除後焦點回輸入框；Esc 也清除（框是空的時候不攔，讓外層面板照常處理 Esc）。
// 輸入法：組字中（注音、倉頡）不回呼 onChange，組完才回呼；框裡的字由元件自己保管，父層非同步更新（例如寫回網址）時不會回彈。
// 父層改了 value（例如從網址還原、按「清除搜尋」）而且不在組字中時，框裡的字跟著換；父層晚一步回傳自己剛送出的值（回音）不算，不會蓋掉後來打的字。
import { useEffect, useId, useImperativeHandle, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import { IconButton } from './IconButton.tsx';
import { SearchIcon, XIcon } from './icons.tsx';
import { useUiLabels } from './ui-labels.ts';

export interface SearchFieldProps {
  /** 可見標籤（footnote 13/600） */
  label: ReactNode;
  /** 只給螢幕閱讀器的標籤（少數版面已經有標題說明時） */
  labelHidden?: boolean;
  /** 受控值；省略時用 defaultValue 不受控 */
  value?: string;
  defaultValue?: string;
  /** 每次輸入（組字完成後）回呼 */
  onChange: (value: string) => void;
  /** 按清除鈕或 Esc 清除之後 */
  onClear?: () => void;
  placeholder?: string;
  id?: string;
  name?: string;
  /** 欄位下方的說明或結果數的 id */
  describedBy?: string;
  inputRef?: Ref<HTMLInputElement>;
  /** 預設 search（iOS 鍵盤顯示「搜尋」）；放在表單裡、不想按 Enter 就送出時改 done */
  enterKeyHint?: 'search' | 'done' | 'go';
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  /** 只給版面用 */
  className?: string;
  'data-testid'?: string;
}

export function SearchField({
  label,
  labelHidden,
  value,
  defaultValue,
  onChange,
  onClear,
  placeholder,
  id,
  name,
  describedBy,
  inputRef,
  enterKeyHint = 'search',
  onKeyDown,
  className,
  'data-testid': testId,
}: SearchFieldProps) {
  const labels = useUiLabels();
  const autoId = useId();
  const inputId = id ?? autoId;
  const own = useRef<HTMLInputElement | null>(null);
  const [text, setText] = useState(value ?? defaultValue ?? '');
  const composing = useRef(false);
  // 送出過、父層還沒回傳的值（回音）；父層的 value 是其中之一時不覆寫框裡的字
  const sent = useRef<string[]>([]);
  const emit = (v: string) => {
    sent.current.push(v);
    if (sent.current.length > 50) sent.current.shift();
    onChange(v);
  };
  useEffect(() => {
    if (value === undefined) return;
    const echo = sent.current.indexOf(value);
    if (echo >= 0) {
      sent.current = sent.current.slice(echo + 1);
      return;
    }
    sent.current = [];
    if (!composing.current) setText(value);
  }, [value]);

  // 父層要的輸入框 ref（例如「清除搜尋」之後把焦點放回來）
  useImperativeHandle(inputRef, () => own.current as HTMLInputElement, []);

  const clear = () => {
    setText('');
    emit('');
    onClear?.();
    own.current?.focus();
  };

  return (
    <div className={`ll-search${className ? ` ${className}` : ''}`} data-testid={testId}>
      <label htmlFor={inputId} className={labelHidden ? 'll-sr-only' : 'll-search__label'}>
        {label}
      </label>
      <div className={`ll-search__field${text ? ' has-value' : ''}`}>
        <span className="ll-search__icon" aria-hidden="true">
          <SearchIcon />
        </span>
        <input
          ref={own}
          id={inputId}
          name={name}
          className="ll-search__input"
          type="search"
          inputMode="search"
          enterKeyHint={enterKeyHint}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={placeholder}
          aria-describedby={describedBy}
          value={text}
          onChange={(e) => {
            const v = e.currentTarget.value;
            setText(v);
            if (!composing.current) emit(v);
          }}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={(e) => {
            composing.current = false;
            const v = e.currentTarget.value;
            setText(v);
            emit(v);
          }}
          onKeyDown={(e) => {
            onKeyDown?.(e);
            if (e.defaultPrevented) return;
            if (e.key === 'Escape' && !composing.current && text !== '') {
              e.preventDefault();
              e.stopPropagation();
              clear();
            }
          }}
        />
        {text !== '' && <IconButton icon={<XIcon />} label={labels.searchClear} onClick={clear} className="ll-search__clear" noTitle />}
      </div>
    </div>
  );
}
