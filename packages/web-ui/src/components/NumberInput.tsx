// 金額與指標輸入（05 第 11.2 節、03 第 2.4 節表二）：type="text" 加 inputmode="decimal"、16px 以上、「±」按鈕（iOS 數字鍵盤沒有負號）、
// 選填的「N/A」切換（aria-pressed，按下時數字框停用並說明原因）、單位後綴，以及判分前的「系統讀到：…」預覽。
// 原始文字由父層保存（切換語言要保留）；正規化交給 @ledgerland/i18n 的 normalizeNumericInput，判分不在這裡。
// 天數（days）的單位字樣（天、日、day、days）也由 normalizeNumericInput 處理，和 apps/web 判分（ratio-units.ts）用同一個規則。
import {
  BASE_LOCALE,
  formatMoney,
  formatNumber,
  formatPercent,
  formatUnit,
  isLocale,
  normalizeNumericInput,
  type Locale,
  type NormalizeResult,
  type NumericUnit,
} from '@ledgerland/i18n';
import { useLingui } from '@lingui/react/macro';
import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Button } from './Button.tsx';

export interface NumberInputProps {
  id?: string;
  /** 可見的標籤（例如「步驟③（勾稽點 C），資產負債表的現金」） */
  label: ReactNode;
  /** 標籤只給螢幕閱讀器（列已有可見標題時） */
  hideLabel?: boolean;
  /** 原始輸入文字，由父層保存 */
  value: string;
  onChange: (raw: string) => void;
  /** 決定接受哪些單位字樣與預覽的格式；預設 plain */
  unit?: InputUnit;
  /** 顯示在輸入框後的單位後綴（例如「元」「%」「倍」） */
  suffix?: ReactNode;
  /** 顯示「N/A」切換按鈕（指標題） */
  allowNa?: boolean;
  na?: boolean;
  onNaChange?: (na: boolean) => void;
  disabled?: boolean;
  /** 額外的說明元素 id（錯誤訊息等），會接在內建說明之後 */
  describedBy?: string;
  invalid?: boolean;
  /** 判分前顯示「系統讀到：…」；預設 true */
  showParsed?: boolean;
  placeholder?: string;
  className?: string;
}

const NEG = /^[-−－]/;

/** 數字輸入接受的單位（i18n 的 NumericUnit，含天數） */
export type InputUnit = NumericUnit;

/** 依單位正規化輸入（天數接受結尾的單位字樣；只有單位字樣、沒有數字時讀不懂） */
export function normalizeInput(raw: string, unit: InputUnit): NormalizeResult {
  return normalizeNumericInput(raw, unit);
}

export function useUiLocale(): Locale {
  const { i18n } = useLingui();
  return isLocale(i18n.locale) ? i18n.locale : BASE_LOCALE;
}

/** 依單位把正規化後的數值格式化成「系統讀到」的文字 */
export function formatParsed(value: number, unit: InputUnit, locale: Locale): string {
  switch (unit) {
    case 'money':
      return formatMoney(value, locale);
    case 'percent':
      return formatPercent(value / 100, locale);
    case 'times':
      return formatUnit(value, locale, 'times');
    case 'turns':
      return formatUnit(value, locale, 'turns');
    case 'days':
      return formatUnit(value, locale, 'day');
    default:
      return formatNumber(value, locale);
  }
}

export function NumberInput({
  id,
  label,
  hideLabel,
  value,
  onChange,
  unit = 'plain',
  suffix,
  allowNa,
  na = false,
  onNaChange,
  disabled,
  describedBy,
  invalid,
  showParsed = true,
  placeholder,
  className,
}: NumberInputProps) {
  const { t } = useLingui();
  const locale = useUiLocale();
  const autoId = useId();
  const inputId = id ?? autoId;
  const parsedId = `${inputId}-parsed`;
  const naId = `${inputId}-na`;
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);
  // 「±」按下後把游標放回原來的位置（05 第 11.2 節）
  useLayoutEffect(() => {
    if (pendingCaret.current === null) return;
    const el = inputRef.current;
    if (el && document.activeElement === el) el.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  });
  const toggleSign = () => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? value.length;
    if (NEG.test(value)) {
      pendingCaret.current = Math.max(0, start - 1);
      onChange(value.slice(1));
    } else {
      pendingCaret.current = start + 1;
      onChange(`-${value}`);
    }
    el?.focus();
  };
  const result = value.trim() === '' ? null : normalizeInput(value, unit);
  let parsedText: string | null = null;
  if (showParsed && !na && result) {
    const value = result.ok ? formatParsed(result.value, unit, locale) : '';
    if (result.ok) parsedText = t({ id: 'input.parsed', message: `系統讀到：${value}`, comment: '判分前的數字預覽；value 已依介面語言格式化' });
    else if (result.reason === 'parentheses')
      parsedText = t({ id: 'input.error.parentheses', message: '負數請用 - 號或 ± 按鈕', comment: '輸入「(1,234)」這種括號負數時的提示' });
    else if (result.reason === 'invalid')
      parsedText = t({ id: 'input.error.invalid', message: '這不是可以判讀的數字，請只輸入數字、小數點與負號', comment: '輸入無法正規化時的提示' });
  }
  const naHelp = na
    ? t({ id: 'input.na.active', message: '已選 N/A（分母不存在），數字框停用；再按一次 N/A 取消。', comment: 'N/A 按下時數字框旁的說明' })
    : null;
  const described = [parsedText ? parsedId : null, naHelp ? naId : null, describedBy ?? null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`ll-numinput${className ? ` ${className}` : ''}`}>
      <label htmlFor={inputId} className={hideLabel ? 'll-sr-only' : 'll-numinput__label'}>
        {label}
      </label>
      <div className="ll-numinput__row">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          className="ll-numinput__input ll-num"
          value={value}
          placeholder={placeholder}
          disabled={disabled || na}
          aria-invalid={invalid || (result !== null && !result.ok) || undefined}
          aria-describedby={described}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix && <span className="ll-numinput__suffix">{suffix}</span>}
        {/* 作答後（停用）不再顯示「±」：數字框已經停用，留一顆停用的按鈕只是雜訊。N/A 按下過的話仍顯示（是作答的一部分） */}
        {!disabled && (
          <Button
            size="sm"
            className="ll-numinput__sign"
            onClick={toggleSign}
            disabled={na}
            aria-label={t({ id: 'input.toggleSign', message: '切換正負號', comment: '「±」按鈕的可讀名稱' })}
          >
            <span aria-hidden="true">±</span>
          </Button>
        )}
        {allowNa && (!disabled || na) && (
          <Button
            size="sm"
            className="ll-numinput__na"
            pressed={na}
            disabled={disabled}
            onClick={() => onNaChange?.(!na)}
            aria-label={t({ id: 'input.na', message: 'N/A，分母不存在', comment: '「N/A」切換按鈕的可讀名稱' })}
          >
            <span aria-hidden="true">N/A</span>
          </Button>
        )}
      </div>
      {naHelp && (
        <p id={naId} className="ll-numinput__help">
          {naHelp}
        </p>
      )}
      {parsedText && (
        <p id={parsedId} className={`ll-numinput__help${result && !result.ok ? ' is-error' : ''}`}>
          {parsedText}
        </p>
      )}
    </div>
  );
}
